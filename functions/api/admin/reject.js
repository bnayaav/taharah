import { jsonOk, jsonError, getUserFromRequest, isAdmin } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  if (!isAdmin(user, env)) return jsonError('Admin access required', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const { requestId } = body;
  if (!requestId) return jsonError('requestId required', 400);

  const result = await env.DB.prepare(
    `UPDATE payment_requests SET status = 'rejected', resolved_at = ? WHERE id = ? AND status = 'pending'`
  ).bind(Date.now(), requestId).run();

  if (result.meta.changes === 0) return jsonError('בקשה לא נמצאה או כבר טופלה', 404);
  return jsonOk({ ok: true });
}
