import { jsonOk, jsonError, getUserFromRequest, isAdmin } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  if (!isAdmin(user, env)) return jsonError('Admin access required', 403);

  // Get all pending payment requests with user info
  const { results } = await env.DB.prepare(`
    SELECT pr.id, pr.user_id, pr.amount, pr.status, pr.note, pr.created_at, pr.resolved_at,
           u.email, u.display_name,
           s.subscription_until, s.questions_used
    FROM payment_requests pr
    JOIN users u ON u.id = pr.user_id
    LEFT JOIN subscriptions s ON s.user_id = pr.user_id
    ORDER BY pr.status = 'pending' DESC, pr.created_at DESC
    LIMIT 100
  `).all();

  return jsonOk({
    requests: results.map(r => ({
      id: r.id,
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      amount: r.amount,
      status: r.status,
      note: r.note,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      subscriptionUntil: r.subscription_until,
      questionsUsed: r.questions_used
    }))
  });
}
