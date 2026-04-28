import { jsonOk, jsonError, getUserFromRequest, getCoupleForUser } from '../../_lib.js';

// Disconnect couple
export async function onRequestDelete({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  const couple = await getCoupleForUser(env, user.id);
  if (!couple) return jsonError('אין חיבור פעיל', 404);

  await env.DB.prepare('DELETE FROM couples WHERE id = ?').bind(couple.id).run();
  return jsonOk({ ok: true });
}

// Toggle sharing settings (only tracker can do this)
export async function onRequestPatch({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  const couple = await getCoupleForUser(env, user.id);
  if (!couple) return jsonError('אין חיבור פעיל', 404);
  if (couple.tracker_user_id !== user.id) return jsonError('רק בעלת המעקב יכולה לשנות הגדרות שיתוף', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  if ('sharedStains' in body) {
    await env.DB.prepare('UPDATE couples SET shared_stains = ? WHERE id = ?')
      .bind(body.sharedStains ? 1 : 0, couple.id).run();
  }

  return jsonOk({ ok: true });
}
