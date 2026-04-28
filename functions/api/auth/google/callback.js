import { jsonError, createSession, setSessionCookie, newId } from '../../../_lib.js';

export async function onRequestGet({ request, env }) {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return jsonError('Google login not configured', 503);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return jsonError('Missing code or state', 400);

  // Verify state from cookie
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)taharah_oauth_state=([^;]+)/);
  if (!m || m[1] !== state) return jsonError('Invalid state', 400);

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok) return jsonError('Google auth failed', 502);
  const { access_token } = await tokenRes.json();

  // Get user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!userRes.ok) return jsonError('Failed to fetch user info', 502);
  const profile = await userRes.json();
  const googleId = profile.id;
  const email = (profile.email || '').toLowerCase();
  const displayName = profile.name || null;
  if (!googleId || !email) return jsonError('Incomplete Google profile', 502);

  // Find or create user
  let user = await env.DB.prepare(
    'SELECT id FROM users WHERE google_id = ? OR email = ?'
  ).bind(googleId, email).first();

  if (user) {
    // Link Google ID if not already
    await env.DB.prepare(
      'UPDATE users SET google_id = ?, last_login = ? WHERE id = ?'
    ).bind(googleId, Date.now(), user.id).run();
  } else {
    const userId = newId('u_');
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO users (id, email, google_id, display_name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, googleId, displayName, now, now).run();
    await env.DB.prepare(
      'INSERT INTO settings (user_id, full_day, or_le, notifications) VALUES (?, 0, 0, 0)'
    ).bind(userId).run();
    user = { id: userId };
  }

  const session = await createSession(env, user.id);

  // Redirect to home with session cookie set
  const headers = new Headers();
  headers.set('Location', '/');
  headers.append('Set-Cookie', setSessionCookie(session.token, session.expiresAt));
  headers.append('Set-Cookie', 'taharah_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}
