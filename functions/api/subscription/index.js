import { jsonOk, jsonError, getUserFromRequest, getSubscription, isAdmin, FREE_QUESTIONS_LIMIT, SUBSCRIPTION_PRICE_NIS } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);

  const sub = await getSubscription(env, user.id);
  return jsonOk({
    subscription: sub,
    freeLimit: FREE_QUESTIONS_LIMIT,
    monthlyPriceNis: SUBSCRIPTION_PRICE_NIS,
    isAdmin: isAdmin(user, env)
  });
}
