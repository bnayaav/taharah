// /api/ask - Halachic Q&A based on ספר דרכי טהרה
// Sends the book PDFs + user question to Claude API
// Uses prompt caching so follow-up questions are cheap

import { getUserFromRequest, getSubscription, incrementQuestionsUsed, isAdmin, FREE_QUESTIONS_LIMIT, SUBSCRIPTION_PRICE_NIS } from '../_lib.js';

const SYSTEM_PROMPT = `אתה עוזר הלכתי המתמחה בהלכות נדה וטהרת המשפחה. אתה עונה אך ורק בהתבסס על הספר "דרכי טהרה" של הראשון לציון הרב מרדכי אליהו זצ"ל, המצורף.

כללי תשובה:
1. ענה בעברית, בצורה ברורה ומובנת.
2. תמיד התבסס על הכתוב בספר. אם השאלה אינה מכוסה בספר, אמור זאת בפירוש.
3. צטט את הפרק והנושא בספר כשרלוונטי (למשל: "לפי פרק ב' - כתמים").
4. סיים תמיד עם המשפט: "להלכה למעשה יש להתייעץ עם רב מורה הוראה."
5. אל תמציא או תוסיף הלכות שאינן בספר.
6. אם השאלה כללית או דורשת ניתוח מצב פרטי, ענה את הכללים מהספר וציין שהכרעה למעשה דורשת רב.
7. אם השאלה היא מצב חירום או שאלה דחופה (כמו ספק טבילה לפני שבת), ציין זאת בראש התשובה ועודד פנייה מיידית לרב.
8. שמור על שפה מכבדת ותורנית.`;

async function fetchPdfAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  };

  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: corsHeaders });
  }

  // Check subscription / free quota (admins are exempt)
  const adminUser = isAdmin(user, env);
  const sub = await getSubscription(env, user.id);
  if (!adminUser && !sub.canAsk) {
    return new Response(JSON.stringify({
      error: 'quota_exceeded',
      message: `ניצלת את ${FREE_QUESTIONS_LIMIT} השאלות החינם. ניתן להירשם למנוי חודשי בעלות ${SUBSCRIPTION_PRICE_NIS} ₪.`,
      subscription: sub
    }), { status: 402, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

  const question = (body.question || '').trim();
  if (!question || question.length > 1000) {
    return new Response(JSON.stringify({ error: 'שאלה חסרה או ארוכה מדי' }), { status: 400, headers: corsHeaders });
  }

  // Fetch the two PDF parts from the same origin
  const url = new URL(request.url);
  const origin = url.origin;

  let part1B64, part2B64;
  try {
    [part1B64, part2B64] = await Promise.all([
      fetchPdfAsBase64(`${origin}/data/sefer_part1.pdf`),
      fetchPdfAsBase64(`${origin}/data/sefer_part2.pdf`)
    ]);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'שגיאה בטעינת הספר: ' + e.message }), { status: 500, headers: corsHeaders });
  }

  const claudeBody = {
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: part1B64 },
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: part2B64 },
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: `שאלה: ${question}`
        }
      ]
    }]
  };

  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(claudeBody)
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'שגיאה בתקשורת עם השרת: ' + e.message }), { status: 502, headers: corsHeaders });
  }

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    console.error('Claude API error:', claudeRes.status, errText);
    return new Response(JSON.stringify({ error: `שגיאת AI (${claudeRes.status})` }), { status: 502, headers: corsHeaders });
  }

  const data = await claudeRes.json();
  const answer = data.content?.[0]?.text || '';

  // Increment usage only if user is on free tier (subscribers and admins don't deplete)
  if (!sub.hasActiveSubscription && !adminUser) {
    await incrementQuestionsUsed(env, user.id);
  }

  // Return updated subscription info
  const updatedSub = await getSubscription(env, user.id);

  return new Response(JSON.stringify({
    answer,
    subscription: updatedSub,
    usage: {
      cacheCreation: data.usage?.cache_creation_input_tokens || 0,
      cacheRead: data.usage?.cache_read_input_tokens || 0,
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0
    }
  }), { status: 200, headers: corsHeaders });
}
