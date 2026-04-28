import { jsonOk, jsonError, getUserFromRequest, newId, SUBSCRIPTION_PRICE_NIS } from '../../_lib.js';

function buildPaymentInfo(env) {
  return {
    amount: SUBSCRIPTION_PRICE_NIS,
    currency: 'NIS',
    bitPhone: env.PAYMENT_BIT_PHONE || null,
    payboxLink: env.PAYMENT_PAYBOX_LINK || null,
    paypalEmail: env.PAYMENT_PAYPAL_EMAIL || null,
    whatsappNumber: env.ADMIN_WHATSAPP || null,
    adminEmail: env.ADMIN_EMAIL || null,
    instructions: env.PAYMENT_INSTRUCTIONS || 'שלחי תשלום באחת מהדרכים שלמעלה ויידעי את האדמין. המנוי יופעל ידנית.'
  };
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const note = (body.note || '').trim().slice(0, 500) || null;

  // Check for existing pending request from same user - return info anyway
  const existing = await env.DB.prepare(
    `SELECT id, created_at FROM payment_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`
  ).bind(user.id).first();

  if (existing) {
    return jsonOk({
      requestId: existing.id,
      pending: true,
      pendingSince: existing.created_at,
      paymentInfo: buildPaymentInfo(env)
    });
  }

  const id = newId('pr_');
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO payment_requests (id, user_id, amount, status, note, created_at) VALUES (?, ?, ?, 'pending', ?, ?)`
  ).bind(id, user.id, SUBSCRIPTION_PRICE_NIS, note, now).run();

  return jsonOk({
    requestId: id,
    pending: false,
    paymentInfo: buildPaymentInfo(env)
  });
}
