import { jsonOk, jsonError, verifyPassword, validateEmail, createSession, setSessionCookie } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!validateEmail(email) || !password) return jsonError('פרטי התחברות חסרים', 400);

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, display_name FROM users WHERE email = ?'
  ).bind(email).first();

  // Constant-ish time response: even if user not found, run verifyPassword once
  if (!user || !user.password_hash) {
    await verifyPassword(password, 'pbkdf2$100000$AAAA$AAAA');
    return jsonError('אימייל או סיסמה שגויים', 401);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return jsonError('אימייל או סיסמה שגויים', 401);

  await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Date.now(), user.id).run();

  const session = await createSession(env, user.id);
  return jsonOk({
    user: { id: user.id, email: user.email, displayName: user.display_name }
  }, { 'Set-Cookie': setSessionCookie(session.token, session.expiresAt) });
}
