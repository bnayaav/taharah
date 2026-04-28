// Shared utilities for all API endpoints
// /functions/_lib.js

// =============== Response helpers ===============
export function jsonOk(data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

export function jsonError(message, status = 400, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

// =============== Password hashing (PBKDF2) ===============
const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64dec(parts[2]);
  const expected = parts[3];
  const computed = await pbkdf2(password, salt, iterations);
  return constantTimeEq(b64(computed), expected);
}

async function pbkdf2(password, salt, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
  );
  return new Uint8Array(bits);
}

function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}
function b64dec(s) {
  return new Uint8Array([...atob(s)].map(c => c.charCodeAt(0)));
}
function constantTimeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// =============== Sessions ===============
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function createSession(env, userId) {
  const token = randomToken(32);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, userId, now, now + SESSION_DURATION_MS).run();
  return { token, expiresAt: now + SESSION_DURATION_MS };
}

export async function destroySession(env, token) {
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function getUserFromRequest(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)taharah_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1]);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, Date.now()).first();
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name, sessionToken: token };
}

export function setSessionCookie(token, expiresAt) {
  const expires = new Date(expiresAt).toUTCString();
  return `taharah_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

export function clearSessionCookie() {
  return 'taharah_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

// =============== Random / IDs ===============
export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function newId(prefix = '') {
  return prefix + randomToken(8);
}

export function randomCode(digits = 6) {
  let n = 0;
  while (n < Math.pow(10, digits - 1)) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    n = buf[0] % Math.pow(10, digits);
  }
  return String(n).padStart(digits, '0');
}

// =============== Validation ===============
export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;
}

// =============== Couple helpers ===============
export async function getCoupleForUser(env, userId) {
  return env.DB.prepare(
    `SELECT * FROM couples WHERE (tracker_user_id = ? OR partner_user_id = ?) AND status = 'active'`
  ).bind(userId, userId).first();
}

// Get the user_id whose data we should display (self or partner-tracker)
export async function getDataOwnerId(env, user) {
  const couple = await getCoupleForUser(env, user.id);
  if (couple && couple.partner_user_id === user.id) {
    // This user is a partner viewing the tracker's data
    return { ownerId: couple.tracker_user_id, isPartner: true, couple };
  }
  return { ownerId: user.id, isPartner: false, couple };
}
