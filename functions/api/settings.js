import { jsonOk, jsonError, getUserFromRequest, getDataOwnerId } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId } = await getDataOwnerId(env, user);

  const row = await env.DB.prepare(
    'SELECT full_day, or_le, notifications FROM settings WHERE user_id = ?'
  ).bind(ownerId).first();

  return jsonOk({
    settings: {
      fullDay: row?.full_day === 1,
      orLe: row?.or_le === 1,
      notifications: row?.notifications === 1
    }
  });
}

export async function onRequestPatch({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים לעדכן הגדרות', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const fields = [];
  const values = [];
  if ('fullDay' in body) { fields.push('full_day = ?'); values.push(body.fullDay ? 1 : 0); }
  if ('orLe' in body) { fields.push('or_le = ?'); values.push(body.orLe ? 1 : 0); }
  if ('notifications' in body) { fields.push('notifications = ?'); values.push(body.notifications ? 1 : 0); }
  if (fields.length === 0) return jsonOk({ ok: true });

  values.push(ownerId);
  // Upsert
  await env.DB.prepare(`INSERT INTO settings (user_id, full_day, or_le, notifications) VALUES (?, 0, 0, 0) ON CONFLICT(user_id) DO NOTHING`)
    .bind(ownerId).run();
  await env.DB.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE user_id = ?`).bind(...values).run();

  return jsonOk({ ok: true });
}
