import { jsonOk, getUserFromRequest, getCoupleForUser } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonOk({ user: null });

  const couple = await getCoupleForUser(env, user.id);
  let coupleInfo = null;
  if (couple) {
    const isTracker = couple.tracker_user_id === user.id;
    coupleInfo = {
      role: isTracker ? 'tracker' : 'partner',
      sharedStains: couple.shared_stains === 1,
      partnerId: isTracker ? couple.partner_user_id : couple.tracker_user_id
    };
    // Get partner email/name
    if (coupleInfo.partnerId) {
      const partner = await env.DB.prepare(
        'SELECT email, display_name FROM users WHERE id = ?'
      ).bind(coupleInfo.partnerId).first();
      if (partner) {
        coupleInfo.partnerEmail = partner.email;
        coupleInfo.partnerName = partner.display_name;
      }
    }
  }

  return jsonOk({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    couple: coupleInfo
  });
}
