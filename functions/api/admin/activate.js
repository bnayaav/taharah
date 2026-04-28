import { jsonOk, jsonError, getUserFromRequest, isAdmin, activateSubscription } from '../../_lib.js';

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  if (!isAdmin(user, env)) return jsonError('Admin access required', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const { requestId, userId, months } = body;
  const monthsToAdd = Math.max(1, Math.min(12, parseInt(months || 1, 10)));

  let targetUserId = userId;

  // If requestId provided, mark it resolved and use its user_id
  if (requestId) {
    const pr = await env.DB.prepare(
      `SELECT user_id FROM payment_requests WHERE id = ? AND status = 'pending'`
    ).bind(requestId).first();
    if (!pr) return jsonError('בקשה לא נמצאה או כבר טופלה', 404);
    targetUserId = pr.user_id;
    await env.DB.prepare(
      `UPDATE payment_requests SET status = 'approved', resolved_at = ? WHERE id = ?`
    ).bind(Date.now(), requestId).run();
  }

  if (!targetUserId) return jsonError('userId or requestId required', 400);

  // Verify user exists
  const targetUser = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(targetUserId).first();
  if (!targetUser) return jsonError('משתמש לא נמצא', 404);

  const newUntil = await activateSubscription(env, targetUserId, monthsToAdd);

  return jsonOk({
    ok: true,
    userId: targetUserId,
    email: targetUser.email,
    subscriptionUntil: newUntil,
    monthsAdded: monthsToAdd
  });
}
