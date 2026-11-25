import { createHmac, timingSafeEqual } from 'node:crypto';

import { rewardToken } from '../../lib/reward-token.js';

export const prerender = false;

const dialDigest = '83936fd3cfa0cbd8b8795aa1e16ec740852ae4fa6ea6a45ff9784caab4f1a203';
const cookieName = 'ps_rock_record';
const lifetime = 365 * 86400;
const secret = import.meta.env?.VAULT_SALT ?? process.env.VAULT_SALT;
const blocked = new Set('ASS FAG FUK FCK FUX FKU KKK NIG NGR CUM TIT SEX DIK DCK COK KOK PIS VAG HOE JIZ FAP KYS FU FK KY XX WTF'.split(' '));
const buckets = new Map();
const windowMs = 15 * 60000;
const attemptsPerWindow = 6;

function digest(message) {
  return createHmac('sha256', secret).update(message).digest('hex');
}

function equalHashes(a, b) {
  return /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function json(data, status = 200, extraHeaders) {
  return Response.json(data, {
    status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extraHeaders },
  });
}

function fail(reason, status) {
  return json({ ok: false, reason }, status);
}

function cookieValue(request, name) {
  const entry = (request.headers.get('cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : '';
}

function readRecord(request) {
  const match = cookieValue(request, cookieName).match(/^1\.(\d{1,12})\.([A-Z]{2,3}|_)\.([a-f0-9]{64})$/);
  if (!match) return null;
  const [, expiry, mark, signature] = match;
  const payload = '1.' + expiry + '.' + mark;
  if (Number(expiry) < Date.now() / 1000 || !equalHashes(digest('rock-record|' + payload), signature)) return null;
  return { solved: true, signed: mark !== '_', ...(mark === '_' ? {} : { initials: mark }) };
}

function cookieHeader(request, name, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return name + '=' + value + '; Path=/api/rock; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure;
}

function writeRecord(request, mark) {
  const payload = '1.' + (Math.floor(Date.now() / 1000) + lifetime) + '.' + mark;
  const encoded = payload + '.' + digest('rock-record|' + payload);
  return json({ ok: true, solved: true, signed: mark !== '_', ...(mark === '_' ? {} : { initials: mark }) }, 200, {
    'Set-Cookie': cookieHeader(request, cookieName, encoded, lifetime),
  });
}

// The short-lived signed counter keeps a reader's cooldown across server restarts.
// The connection bucket also covers requests from browsers that do not retain cookies.
function takeAttempt(request, address) {
  const now = Date.now();
  const key = digest('rock-attempt|' + address);
  for (const [id, item] of buckets) {
    if (item.until > now) break;
    buckets.delete(id);
  }
  const bucket = buckets.get(key) || { attempts: 0, until: now + windowMs };
  const saved = cookieValue(request, 'ps_rock_tries').match(/^(\d{1,13})\.([1-6])\.([a-f0-9]{64})$/);
  let browser = { until: now + windowMs, attempts: 0 };
  if (saved && Number(saved[1]) > now && equalHashes(digest('rock-tries|' + saved[1] + '.' + saved[2]), saved[3])) {
    browser = { until: Number(saved[1]), attempts: Number(saved[2]) };
  }
  const blockedUntil = Math.max(bucket.attempts >= attemptsPerWindow ? bucket.until : 0,
    browser.attempts >= attemptsPerWindow ? browser.until : 0);
  if (blockedUntil) return { delay: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) };
  if (!buckets.has(key) && buckets.size >= 8192) return { delay: 60 };
  bucket.attempts += 1;
  buckets.set(key, bucket);
  const value = browser.until + '.' + (browser.attempts + 1);
  return { cookie: cookieHeader(request, 'ps_rock_tries', value + '.' + digest('rock-tries|' + value),
    Math.ceil((browser.until - now) / 1000)) };
}

export function GET({ request }) {
  if (!secret) return fail('unavailable', 503);
  return json({ ok: true, ...(readRecord(request) || { solved: false, signed: false }) });
}

export async function POST({ request, clientAddress }) {
  if (!secret) return fail('unavailable', 503);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return fail('bad_request', 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('bad_request', 415);
  let body;
  try { body = await request.json(); } catch { return fail('bad_request', 400); }
  if (!body || typeof body !== 'object') return fail('bad_request', 400);
  const record = readRecord(request);
  if (body.action === 'set') {
    if (record) return json({ ok: true, ...record });
    const pass = request.headers.get('x-gallery-pass') || '';
    if (!/^[a-f0-9]{40}$/.test(pass) || !timingSafeEqual(Buffer.from(pass), Buffer.from(rewardToken('G', secret)))) {
      return fail('no_gallery', 403);
    }
    const { hour, minute } = body;
    if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      return fail('bad_request', 400);
    }
    const { delay, cookie } = takeAttempt(request, clientAddress || 'unknown');
    if (delay) return json({ ok: false, reason: 'slow_down', retryAfter: delay }, 429, { 'Retry-After': String(delay) });
    if (!equalHashes(digest('gallery-dial-v1|' + hour + '|' + minute), dialDigest)) {
      return json({ ok: false, reason: 'wrong_time' }, 422, { 'Set-Cookie': cookie });
    }
    return writeRecord(request, '_');
  }
  if (body.action === 'sign') {
    if (!record) return fail('no_proof', 403);
    if (record.signed) return json({ ok: true, ...record });
    const mark = typeof body.initials === 'string' ? body.initials.trim().toUpperCase() : '';
    if (!/^[A-Z]{2,3}$/.test(mark) || blocked.has(mark)) return fail('bad_initials', 422);
    return writeRecord(request, mark);
  }
  return fail('bad_request', 400);
}
