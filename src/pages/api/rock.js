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
const attemptsPerBrowser = 6;
const attemptsPerConnection = 36;

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

function bookplate(initials = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 500" width="720" height="500">
    <rect width="720" height="500" fill="#f4e9cf"/><g fill="none" stroke="#705338"><rect x="17" y="17" width="686" height="466" rx="8" stroke-width="3"/><rect x="25" y="25" width="670" height="450" rx="4"/>
    <path d="M315 77Q360 69 405 77V122Q405 148 360 168Q315 148 315 122Z" stroke-width="3"/>
    <path d="M329 104h15v11h15v11h15v11h16M332 94q15-7 28 0 13-7 28 0v10q-14-6-28 0-14-6-28 0zM360 94v10" stroke-width="2"/>
    <path d="M80 200h160m240 0h160M135 325h450M175 397h370"/></g>
    <g text-anchor="middle" fill="#403121" font-family="Georgia,serif"><text x="360" y="204" font-size="18" letter-spacing="4">EX LIBRIS</text>
    <text x="360" y="266" font-size="44">Beneath The Rock</text><text x="360" y="304" font-size="19" font-style="italic">I found the room beneath the Keeper’s floor.</text>
    <text x="360" y="365" font-size="16" letter-spacing="2">FROM THE LIBRARY OF</text><text x="360" y="390" font-size="22">${initials}</text><text x="360" y="451" font-size="15">PuzzleSecret · The Keeper’s Gallery</text></g></svg>`;
}

function writeRecord(request, mark) {
  const payload = '1.' + (Math.floor(Date.now() / 1000) + lifetime) + '.' + mark;
  const encoded = payload + '.' + digest('rock-record|' + payload);
  return json({ ok: true, solved: true, signed: mark !== '_', ...(mark === '_' ? { bookplate: bookplate() } : { initials: mark }) }, 200, {
    'Set-Cookie': cookieHeader(request, cookieName, encoded, lifetime),
  });
}

// The short-lived signed counter keeps a reader's cooldown across server restarts.
// The connection bucket also covers requests from browsers that do not retain cookies.
function takeAttempt(request, address, failed) {
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
  const blockedUntil = Math.max(bucket.attempts >= attemptsPerConnection ? bucket.until : 0,
    browser.attempts >= attemptsPerBrowser ? browser.until : 0);
  if (blockedUntil) return { delay: Math.max(1, Math.ceil((blockedUntil - now) / 1000)) };
  if (!failed) return {};
  if (!buckets.has(key) && buckets.size >= 8192) return { delay: 60 };
  bucket.attempts += 1;
  buckets.set(key, bucket);
  const value = browser.until + '.' + (browser.attempts + 1);
  return { cookie: cookieHeader(request, 'ps_rock_tries', value + '.' + digest('rock-tries|' + value),
    Math.ceil((browser.until - now) / 1000)) };
}

export function GET({ request }) {
  if (!secret) return fail('unavailable', 503);
  const record = readRecord(request);
  if (new URL(request.url).searchParams.get('bookplate') === '1') {
    if (!record) return fail('no_proof', 403);
    return new Response(bookplate(record.initials), { headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="keepers-bookplate.svg"',
      'Cache-Control': 'private, no-store', Vary: 'Cookie',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    } });
  }
  return json({ ok: true, ...(record || { solved: false, signed: false }) });
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
    const matches = equalHashes(digest('gallery-dial-v1|' + hour + '|' + minute), dialDigest);
    const { delay, cookie } = takeAttempt(request, clientAddress || 'unknown', !matches);
    if (delay) return json({ ok: false, reason: 'slow_down', retryAfter: delay }, 429, { 'Retry-After': String(delay) });
    if (!matches) {
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
