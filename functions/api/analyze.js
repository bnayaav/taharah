// Cloudflare Pages Function: /api/analyze
// מקבל תמונה + הקשר, שולח ל-Claude לניתוח, ומחזיר JSON מובנה
// משתנה סביבה דרוש: ANTHROPIC_API_KEY

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const { image, context: ctx } = body;
  if (!image || !image.startsWith('data:image/')) {
    return jsonResponse({ error: 'Missing or invalid image' }, 400, corsHeaders);
  }

  // Parse data URL
  const match = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) {
    return jsonResponse({ error: 'Invalid image format' }, 400, corsHeaders);
  }
  const mediaType = match[1];
  const imageData = match[2];

  // Sanity: image should not be huge (after base64 it could be >5MB)
  if (imageData.length > 7_500_000) {
    return jsonResponse({ error: 'Image too large' }, 413, corsHeaders);
  }

  const backgroundLabel = ctx?.background === 'white' ? 'בד/בגד לבן' : 'בד/בגד צבעוני';
  const locationLabels = {
    'garment': 'בגד רגיל',
    'white-cloth': 'בד בדיקה לבן (עד-בדיקה)',
    'floor': 'רצפה / כיסא / מקום שאינו מקבל טומאה',
    'body': 'על הגוף'
  };
  const locationLabel = locationLabels[ctx?.location] || 'לא צוין';
  const userNotes = ctx?.userNotes || '(אין)';

  const systemPrompt = `אתה עוזר ויזואלי בלבד באפליקציית מעקב טהרת המשפחה. תפקידך: ניתוח אובייקטיבי של תמונות כתמים — לא פסיקת הלכה.

הכללים שלך:
1. נתח רק מה שאתה רואה בתמונה: צבע, גודל, רקע, אופי הכתם.
2. אל תפסוק הלכה. תן הערכת חומרת חשש ויזואלית בלבד.
3. כשיש ספק - העלה את רמת החשש (concernLevel="medium" או "high").
4. תמיד הפנה לרב מורה הוראה כשהחשש בינוני או גבוה.
5. אם בתמונה לא נראה כתם או שלא ברור מה זה - ציין זאת.

כללים בסיסיים שאתה מכיר (לידיעתך בלבד, לא לפסיקה):
- כתם הקטן מגריס (כ-19 מ״מ קוטר) על בגד צבעוני - לרוב אינו מטמא.
- כתם הגדול מגריס על בד לבן בגוון אדום/חום/שחור - מצריך שאלת רב.
- צבעים אדמדמים, חומים כהים ושחורים - חששיים יותר.
- צבעים צהובים, ירוקים, כתומים בהירים, ולבנים - אינם מטמאים.
- מקום שאינו מקבל טומאה (רצפה, ספסל קשיח) - לא מטמא.

החזר אך ורק JSON תקני בפורמט הבא, ללא טקסט נוסף לפניו או אחריו:
{
  "stainVisible": true/false,
  "observations": {
    "colorDescription": "תיאור קצר בעברית של הצבע שאתה רואה",
    "sizeDescription": "תיאור גודל יחסי - אם רואים אובייקט ייחוס (מטבע, חפץ) ציין",
    "backgroundDescription": "תיאור הרקע / הבד שעליו הכתם",
    "extraNotes": "הערות נוספות אם רלוונטי, או מחרוזת ריקה"
  },
  "concernLevel": "low" | "medium" | "high",
  "recommendation": "המלצה קצרה בעברית למשתמשת - מה לעשות בהמשך"
}`;

  const userPrompt = `הקשר שסיפקה המשתמשת:
- סוג רקע: ${backgroundLabel}
- מיקום הכתם: ${locationLabel}
- הערות: ${userNotes}

נתחי את התמונה והחזירי JSON תקני בלבד.`;

  // Call Claude API
  let aiResponse;
  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageData }
              },
              { type: 'text', text: userPrompt }
            ]
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Claude API error:', apiResponse.status, errText);
      return jsonResponse({
        error: 'AI service error',
        details: `${apiResponse.status}`,
      }, 502, corsHeaders);
    }

    aiResponse = await apiResponse.json();
  } catch (e) {
    console.error('Network error:', e);
    return jsonResponse({ error: 'Network error contacting AI service' }, 502, corsHeaders);
  }

  // Extract text content
  const textBlocks = (aiResponse.content || []).filter(b => b.type === 'text');
  if (textBlocks.length === 0) {
    return jsonResponse({ error: 'Empty AI response' }, 502, corsHeaders);
  }
  const rawText = textBlocks.map(b => b.text).join('\n').trim();

  // Try to parse JSON (handle code fences if any)
  let parsed;
  try {
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    // Find first { and last }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found');
    parsed = JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    console.error('JSON parse failed:', e, 'Raw:', rawText);
    return jsonResponse({
      concernLevel: 'medium',
      recommendation: 'לא הצלחנו לפענח את הניתוח. מומלץ להתייעץ עם רב.',
      observations: { colorDescription: '—', sizeDescription: '—', backgroundDescription: '—', extraNotes: 'ניתוח חלקי' },
      stainVisible: null
    }, 200, corsHeaders);
  }

  // Validate / normalize
  const result = {
    stainVisible: parsed.stainVisible ?? null,
    observations: {
      colorDescription: parsed.observations?.colorDescription || '—',
      sizeDescription: parsed.observations?.sizeDescription || '—',
      backgroundDescription: parsed.observations?.backgroundDescription || '—',
      extraNotes: parsed.observations?.extraNotes || ''
    },
    concernLevel: ['low', 'medium', 'high'].includes(parsed.concernLevel) ? parsed.concernLevel : 'medium',
    recommendation: parsed.recommendation || 'יש להתייעץ עם רב לקבלת פסק.'
  };

  // If no stain visible, force low concern with note
  if (result.stainVisible === false) {
    result.concernLevel = 'low';
    result.recommendation = 'בתמונה לא זוהה כתם ברור. ' + (result.recommendation || '');
  }

  return jsonResponse(result, 200, corsHeaders);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}
