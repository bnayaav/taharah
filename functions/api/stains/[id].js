import { jsonOk, jsonError, getUserFromRequest, getDataOwnerId } from '../../_lib.js';

export async function onRequestDelete({ request, env, params }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים למחוק', 403);

  const result = await env.DB.prepare(
    'DELETE FROM stains WHERE id = ? AND user_id = ?'
  ).bind(params.id, ownerId).run();

  if (result.meta.changes === 0) return jsonError('בדיקה לא נמצאה', 404);
  return jsonOk({ ok: true });
}
