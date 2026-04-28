import { jsonOk, jsonError, getUserFromRequest, getDataOwnerId, newId } from '../../_lib.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner, couple } = await getDataOwnerId(env, user);

  // If partner viewing tracker's stains - check if sharing is enabled
  if (isPartner && (!couple || couple.shared_stains !== 1)) {
    return jsonOk({ stains: [], notShared: true });
  }

  const { results } = await env.DB.prepare(
    'SELECT id, date, bg, location, notes, concern_level, verdict_text, ai_analyzed, created_at FROM stains WHERE user_id = ? ORDER BY date DESC, created_at DESC'
  ).bind(ownerId).all();

  return jsonOk({
    stains: results.map(r => ({
      id: r.id,
      date: r.date,
      bg: r.bg,
      location: r.location,
      notes: r.notes,
      concernLevel: r.concern_level,
      verdictText: r.verdict_text,
      aiAnalyzed: r.ai_analyzed === 1,
      createdAt: r.created_at
    }))
  });
}

export async function onRequestPost({ request, env }) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonError('Unauthorized', 401);
  const { ownerId, isPartner } = await getDataOwnerId(env, user);
  if (isPartner) return jsonError('שותפים אינם יכולים להוסיף בדיקות', 403);

  let body;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const { date, bg, location, notes, concernLevel, verdictText, aiAnalyzed, analysisJson } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('תאריך לא תקין', 400);

  const id = newId('s_');
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO stains (id, user_id, date, bg, location, notes, concern_level, verdict_text, ai_analyzed, analysis_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, ownerId, date,
    bg || null, location || null, notes || null,
    concernLevel || null, verdictText || null,
    aiAnalyzed ? 1 : 0, analysisJson ? JSON.stringify(analysisJson) : null, now
  ).run();

  return jsonOk({
    stain: { id, date, bg, location, notes, concernLevel, verdictText, aiAnalyzed: !!aiAnalyzed, createdAt: now }
  });
}
