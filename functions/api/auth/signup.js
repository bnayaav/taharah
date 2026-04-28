import { jsonOk, jsonError, hashPassword, validateEmail, validatePassword, createSession, setSessionCookie, newId } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const displayName = (body.displayName || '').trim().slice(0, 100) || null;

  if (!validateEmail(email)) return jsonError('כתובת אימייל לא תקינה', 400);
  if (!validatePassword(password)) return jsonError('הסיסמה חייבת להיות באורך 8 תווים לפחות', 400);

  // Check if email already exists
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return jsonError('כתובת אימייל זו כבר רשומה', 409);

  const userId = newId('u_');
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, displayName, now, now).run();

  // Default settings
  await env.DB.prepare(
    'INSERT INTO settings (user_id, full_day, or_le, notifications) VALUES (?, 0, 0, 0)'
  ).bind(userId).run();

  const session = await createSession(env, userId);
  return jsonOk({
    user: { id: userId, email, displayName }
  }, { 'Set-Cookie': setSessionCookie(session.token, session.expiresAt) });
}
