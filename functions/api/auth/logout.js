import { jsonOk, getUserFromRequest, destroySession, clearSessionCookie } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (user) await destroySession(env, user.sessionToken);
  return jsonOk({ ok: true }, { 'Set-Cookie': clearSessionCookie() });
}
