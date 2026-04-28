import { jsonOk, jsonError, getUserFromRequest, getDataOwnerId, newId } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId } = await getDataOwnerId(env, user);

  const { results } = await env.DB.prepare(
    'SELECT id, start_date, start_onah, hefsek_date, mikveh_date, notes, created_at, updated_at FROM cycles WHERE user_id = ? ORDER BY start_date DESC'
  ).bind(ownerId).all();

  return jsonOk({
    cycles: results.map(r => ({
      id: r.id,
      startDate: r.start_date,
      startOnah: r.start_onah,
      hefsekDate: r.hefsek_date,
      mikvehDate: r.mikveh_date,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  });
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים להוסיף נתונים', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const { startDate, startOnah, notes } = body;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return jsonError('תאריך לא תקין', 400);
  if (!['day', 'night'].includes(startOnah)) return jsonError('עונה לא תקינה', 400);

  const id = newId('c_');
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO cycles (id, user_id, start_date, start_onah, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, ownerId, startDate, startOnah, notes || null, now, now).run();

  return jsonOk({
    cycle: { id, startDate, startOnah, hefsekDate: null, mikvehDate: null, notes: notes || null, createdAt: now, updatedAt: now }
  });
}
