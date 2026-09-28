// The vault's event pipe — a single POST endpoint for every browser-side "someone just did
// X" ping. Every event name is validated against a fixed allowlist (see events.js). Extras
// are optional short strings, per-event whitelisted, sanitized before they touch Telegram.
//
// Design notes worth carrying into future edits:
//   * Rate limit key = hash(ip + ev [+ extra]), NOT vid. Vid is client-assigned and trivially
//     rotated; it stays only for the solver-tag narrative in Telegram, never for throttling.
//     Extra joins the key only for events that declare one, so "word box at door 2" and then
//     "at door 3" a minute later both arrive — that IS the journey Dan wants to read.
//   * IPv6 → /64. Otherwise a device that rotates a /128 defeats the limiter for free.
//   * The Map is a best-effort defence — serverless cold starts make it leaky. The real
//     backstop is the global flood breaker in keeper-telegram.js (silent 60s mute on burst).
//   * Unknown ev names → 204. No error. No confirmation to a probe of what does exist.
//   * Crawlers that execute JS (Googlebot, Bingbot, headless audits) are dropped by user
//     agent so `arrive` stays a count of people.
//   * `parse_mode` is deliberately never set on the Telegram side (see keeper-telegram.js).
//
// This endpoint MUST NOT be used for `reward.served.*` — those are server-emitted from
// /api/reward when a PDF actually streams. Anything in SERVER_EV is refused as a probe.
export const prerender = false;

import { notify, solverTag, place, safeExtra, isBot } from '../../lib/keeper-telegram.js';
import { ALLOW, EXTRA_ALLOWED, validExtra, keeperLine, CLIENT_EV } from '../../lib/events.js';
import { guessSource } from '../../lib/traffic-guess.js';

// Per-IP+event cooldown. 5 minutes per (ip64, ev, extra) tuple. Also caps the Map to 5000
// entries with FIFO pruning so a long-lived warm instance can't grow without bound.
const buckets = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;
const MAP_CAP = 5000;
function ip64(ip) {
  if (!ip) return 'unknown';
  if (ip.indexOf(':') === -1) return ip;                   // IPv4 → keep whole
  // IPv6 → first 64 bits. Expand a compressed `::` first so `2001:db8::1` and
  // `2001:db8:0:0:0:0:0:1` land in the same bucket.
  let groups;
  if (ip.indexOf('::') !== -1) {
    const [head, tail] = ip.split('::');
    const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
    groups = h.concat(Array(Math.max(0, 8 - h.length - t.length)).fill('0'), t);
  } else groups = ip.split(':');
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '') || '0').join(':') + '::/64';
}
function prune(map) {
  if (map.size <= MAP_CAP) return;
  const keys = map.keys();                                 // FIFO: drop the oldest ~10%
  for (let i = 0; i < Math.floor(MAP_CAP * 0.1); i++) { const k = keys.next(); if (k.done) break; map.delete(k.value); }
}
function shouldSkip(ip, ev, extra) {
  const now = Date.now();
  const key = ip64(ip) + '|' + ev + (extra ? '|' + extra : '');
  const last = buckets.get(key);
  if (last && now - last < COOLDOWN_MS) return true;
  buckets.set(key, now);
  prune(buckets);
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
  prune(ipCounts);
  return b.n > 40;
}

// Arrivals with no link, on a desktop, from a browser that has never been here, in the last ten
// minutes, counted once per IP. Several at once is how an email scanner, a crawler sweep — or a
// newsletter going out — looks; the Telegram line names all three. Per warm instance, so best-effort,
// and one sender cannot inflate it (a repeat IP does not count again). Someone with many IPs could
// still fake a burst; that only relabels lines, it cannot put text in them.
// Also returns `nearby`: other such visits from the SAME country inside an hour — a crawler working
// slowly through the site from somewhere no outlet of ours reaches (traffic-guess.js decides that).
const noLink = new Map();                                  // ip64 → { t, c }
function noLinkBurst(extra, ip, country) {
  if (!/ from direct · desktop · first visit( ·|$)/.test(extra || '')) return { burst: 0, nearby: 0 };
  const now = Date.now();
  for (const [k, v] of noLink) if (now - v.t > 60 * 60 * 1000) noLink.delete(k);
  const key = ip64(ip);
  let burst = 0, nearby = 0;
  for (const [k, v] of noLink) {
    if (k === key) continue;
    if (now - v.t <= 10 * 60 * 1000) burst++;
    if (v.c === country) nearby++;
  }
  noLink.set(key, { t: now, c: country });
  if (noLink.size > 300) noLink.delete(noLink.keys().next().value);
  return { burst, nearby };
}
// An arrival's cooldown key is its stable head (page, source, device). The visit count and the rest
// change every session, and keying on them would let one sender mint unlimited distinct keys.
const arriveKey = (extra) => extra.split(' · ').slice(0, 2).join(' · ');

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const NOOP204 = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function POST({ request, clientAddress }) {
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const ev = String(body && body.ev || '');
  // 1. Unknown event → 204 silence (no probe confirmation).
  if (!ALLOW.has(ev)) return NOOP204();
  // 2. Crawlers and headless audits are not visitors.
  if (isBot(request)) return NOOP204();
  const ip = clientAddress || 'unknown';
  // 3. Per-IP burst gate.
  if (ipBurst(ip)) return NOOP204();
  // 4. Extras — character-sanitized, then held to the event's exact grammar. Anything that
  //    is not the shape our own clients produce is dropped; the event still goes through.
  const cap = EXTRA_ALLOWED[ev] || 0;
  const extra = cap ? validExtra(ev, safeExtra(body.extra, cap)) : '';
  // 5. Per-IP + per-event (+ extra) cooldown.
  if (shouldSkip(ip, ev, ev === CLIENT_EV.ARRIVE ? arriveKey(extra) : extra)) return NOOP204();

  const where = place(request);
  let msg = keeperLine(ev, extra, solverTag(body && body.vid), where);
  // Every arrival carries the Keeper's best guess at where it came from, on a second line. The guess
  // is built only from the validated extra, the country and our own placement registry.
  if (ev === CLIENT_EV.ARRIVE) {
    try {
      const n = noLinkBurst(extra, ip, where.slice(0, 2));
      const g = guessSource(extra, where, Date.now(), n.burst, n.nearby);
      if (g) msg += '\n   ↳ ' + g;
    } catch { /* a guess is never worth a lost line */ }
  }
  await notify(msg);
  return NOOP204();
}

export const GET = () => json({ ok: true, service: 'event', ready: true });
