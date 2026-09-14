// The vault's event pipe — a single POST endpoint for every browser-side "someone just did
// X" ping. Every event name is validated against a fixed allowlist (see events.js). Extras
// are optional short strings, per-event whitelisted, sanitized before they touch Telegram.
//
// Design notes worth carrying into future edits:
//   * Rate limit key = hash(ip + ev), NOT vid. Vid is client-assigned and trivially rotated;
//     it stays only for the solver-tag narrative in Telegram, never for throttling.
//   * IPv6 → /64. Otherwise a device that rotates a /128 defeats the limiter for free.
//   * The Map is a best-effort defence — serverless cold starts make it leaky. The real
//     backstop is the global flood breaker in keeper-telegram.js (silent 60s mute on burst).
//   * Unknown ev names → 204. No error. No confirmation to a probe of what does exist.
//   * `parse_mode` is deliberately never set on the Telegram side (see keeper-telegram.js).
//
// This endpoint MUST NOT be used for `reward.served.*` — those are server-emitted from
// /api/reward when a PDF actually streams. Anything in SERVER_EV is refused as a probe.
export const prerender = false;

import { notify, solverTag, place, safeExtra } from '../../lib/keeper-telegram.js';
import { ALLOW, EXTRA_ALLOWED, line } from '../../lib/events.js';

// Per-IP+event cooldown. 5 minutes per (ip64, ev) pair. Also caps the Map to 5000 entries
// with FIFO pruning so a long-lived warm instance can't grow without bound.
const buckets = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;
const MAP_CAP = 5000;
function ip64(ip) {
  if (!ip) return 'unknown';
  if (ip.indexOf(':') === -1) return ip;                   // IPv4 → keep whole
  return ip.split(':').slice(0, 4).join(':') + '::/64';    // IPv6 → first 64 bits
}
function shouldSkip(ip, ev) {
  const now = Date.now();
  const key = ip64(ip) + '|' + ev;
  const last = buckets.get(key);
  if (last && now - last < COOLDOWN_MS) return true;
  buckets.set(key, now);
  if (buckets.size > MAP_CAP) {
    // FIFO prune: drop the oldest ~10% to keep amortised work small.
    const keys = buckets.keys();
    for (let i = 0; i < Math.floor(MAP_CAP * 0.1); i++) {
      const k = keys.next(); if (k.done) break; buckets.delete(k.value);
    }
  }
  return false;
}

// Global per-IP burst limiter: max 40 accepted events per IP per 5 minutes across ALL evs.
const ipCounts = new Map();
function ipBurst(ip) {
  const now = Date.now();
  const key = ip64(ip);
  const b = ipCounts.get(key) || { n: 0, t: now };
  if (now - b.t > COOLDOWN_MS) { b.n = 0; b.t = now; }
  b.n += 1;
  ipCounts.set(key, b);
  if (ipCounts.size > MAP_CAP) {
    const keys = ipCounts.keys();
    for (let i = 0; i < Math.floor(MAP_CAP * 0.1); i++) {
      const k = keys.next(); if (k.done) break; ipCounts.delete(k.value);
    }
  }
  return b.n > 40;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const NOOP204 = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function POST({ request, clientAddress }) {
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const ev = String(body && body.ev || '');
  // 1. Unknown event → 204 silence (no probe confirmation).
  if (!ALLOW.has(ev)) return NOOP204();
  const ip = clientAddress || 'unknown';
  // 2. Per-IP burst gate.
  if (ipBurst(ip)) return NOOP204();
  // 3. Per-IP + per-event cooldown.
  if (shouldSkip(ip, ev)) return NOOP204();

  // 4. Extras — only accepted for events that declare a cap, and only through the sanitizer.
  const cap = EXTRA_ALLOWED[ev] || 0;
  const extra = cap ? safeExtra(body.extra, cap) : '';

  const tag = solverTag(body && body.vid);
  const geo = place(request);
  await notify(`${line(ev, extra)} · ${tag} · ${geo}`);
  return NOOP204();
}

export const GET = () => json({ ok: true, service: 'event', ready: true });
