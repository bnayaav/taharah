import { jsonOk, jsonError, getUserFromRequest, getDataOwnerId } from '../../_lib.js';

export async function onRequestPatch({ request, env, params }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים לעדכן נתונים', 403);

  const id = params.id;
  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const fields = [];
  const values = [];
  if ('hefsekDate' in body) {
    if (body.hefsekDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.hefsekDate)) return jsonError('תאריך הפסק טהרה לא תקין', 400);
    fields.push('hefsek_date = ?'); values.push(body.hefsekDate);
  }
  if ('mikvehDate' in body) {
    if (body.mikvehDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.mikvehDate)) return jsonError('תאריך טבילה לא תקין', 400);
    fields.push('mikveh_date = ?'); values.push(body.mikvehDate);
  }
  if ('notes' in body) {
    fields.push('notes = ?'); values.push(body.notes || null);
  }
  if ('cleanChecks' in body) {
    if (typeof body.cleanChecks !== 'object' || body.cleanChecks === null) return jsonError('cleanChecks invalid', 400);
    fields.push('clean_checks = ?'); values.push(JSON.stringify(body.cleanChecks));
  }
  if (fields.length === 0) return jsonError('No fields to update', 400);

  fields.push('updated_at = ?'); values.push(Date.now());
  values.push(id, ownerId);

  const result = await env.DB.prepare(
    `UPDATE cycles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  if (result.meta.changes === 0) return jsonError('מחזור לא נמצא', 404);
  return jsonOk({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים למחוק נתונים', 403);

  const result = await env.DB.prepare(
    'DELETE FROM cycles WHERE id = ? AND user_id = ?'
  ).bind(params.id, ownerId).run();

  if (result.meta.changes === 0) return jsonError('מחזור לא נמצא', 404);
  return jsonOk({ ok: true });
}
