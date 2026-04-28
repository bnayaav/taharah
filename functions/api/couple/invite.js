import { jsonOk, jsonError, getUserFromRequest, randomCode, newId, getCoupleForUser } from '../../_lib.js';

const INVITE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  // Check if already in a couple
  const existing = await getCoupleForUser(env, user.id);
  if (existing && existing.status === 'active') {
    return jsonError('כבר קיים חיבור פעיל. יש לנתק קודם.', 409);
  }

  // Try to generate a unique code (very unlikely collision but be safe)
  let code, attempts = 0;
  while (attempts < 5) {
    code = randomCode(6);
    const exists = await env.DB.prepare('SELECT id FROM couples WHERE invite_code = ?').bind(code).first();
    if (!exists) break;
    attempts++;
  }
  if (attempts >= 5) return jsonError('שגיאה ביצירת קוד', 500);

  const expiresAt = Date.now() + INVITE_DURATION_MS;

  // Delete any existing pending couple for this tracker
  await env.DB.prepare(
    `DELETE FROM couples WHERE tracker_user_id = ? AND status = 'pending'`
  ).bind(user.id).run();

  const id = newId('cp_');
  await env.DB.prepare(
    `INSERT INTO couples (id, tracker_user_id, invite_code, invite_expires_at, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(id, user.id, code, expiresAt, Date.now()).run();

  return jsonOk({ inviteCode: code, expiresAt });
}
