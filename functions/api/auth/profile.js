import { jsonOk, jsonError, getUserFromRequest } from '../../_lib.js';

export async function onRequestPatch({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  if ('displayName' in body) {
    const name = (body.displayName || '').trim().slice(0, 100) || null;
    await env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name, user.id).run();
  }

  // Return updated user
  const updated = await env.DB.prepare('SELECT id, email, display_name FROM users WHERE id = ?').bind(user.id).first();
  return jsonOk({ user: { id: updated.id, email: updated.email, displayName: updated.display_name } });
}
