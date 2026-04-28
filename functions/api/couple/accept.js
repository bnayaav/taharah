import { jsonOk, jsonError, getUserFromRequest, getCoupleForUser } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }
  const code = (body.code || '').trim();
  if (!/^\d{6}$/.test(code)) return jsonError('קוד לא תקין', 400);

  // Check if user already in active couple
  const existing = await getCoupleForUser(env, user.id);
  if (existing && existing.status === 'active') {
    return jsonError('כבר קיים חיבור פעיל. יש לנתק קודם.', 409);
  }

  const couple = await env.DB.prepare(
    `SELECT * FROM couples WHERE invite_code = ? AND status = 'pending'`
  ).bind(code).first();

  if (!couple) return jsonError('קוד לא קיים או לא תקף', 404);
  if (couple.invite_expires_at < Date.now()) return jsonError('הקוד פג תוקף', 400);
  if (couple.tracker_user_id === user.id) return jsonError('לא ניתן לאשר הזמנה שיצרת בעצמך', 400);

  // Activate
  await env.DB.prepare(
    `UPDATE couples SET partner_user_id = ?, status = 'active', invite_code = NULL, invite_expires_at = NULL WHERE id = ?`
  ).bind(user.id, couple.id).run();

  // Get tracker info
  const tracker = await env.DB.prepare(
    'SELECT email, display_name FROM users WHERE id = ?'
  ).bind(couple.tracker_user_id).first();

  return jsonOk({
    couple: {
      role: 'partner',
      sharedStains: couple.shared_stains === 1,
      partnerEmail: tracker?.email,
      partnerName: tracker?.display_name
    }
  });
}
