// The Keeper's messenger — Telegram notifications for vault activity.
//
// Dan's requirement: know when someone is actually at the vault and how far they get —
// visits, every word attempt (right or wrong), tile pickups, page reads, reward downloads,
// carvings — with NO personal information. What we send: a self-assigned random 4-char
// solver tag (so the same browser's journey reads as a story), a COARSE place (country
// always; US/CA state only), and the event itself. Wrong guesses are normalized to bare
// A-Z upstream so an accidentally-typed email or name can never reach this channel.
//
// GDPR / CCPA / COPPA posture: no vid persistence across cookies/browsers, no city
// resolution, no lat/long, no user-typed free text ever forwarded, no `parse_mode` so
// Telegram never renders anything from a solver's input. See docs at
// `site/_content/keeper-telegram-events.md`.
//
// Fail-safe by design: if env vars are missing or Telegram is down, every function here
// silently no-ops. A notification must never break an unlock.

const TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
const CHAT = import.meta.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;
// Local testing: TELEGRAM_DRYRUN=1 prints the message instead of sending it.
const DRYRUN = (import.meta.env.TELEGRAM_DRYRUN ?? process.env.TELEGRAM_DRYRUN) === '1';

export function solverTag(vid) {
  // Client sends a random self-assigned id; show only 4 chars. Never an IP, never a name.
  const v = String(vid || '').replace(/[^a-z0-9]/gi, '').slice(0, 4);
  return v ? v.toLowerCase() : 'anon';
}

// Coarse geography from Vercel's edge headers. Country ALWAYS; state ONLY for US/CA
// (US privacy law is more forgiving than EU/UK law, and US state is genuinely useful to
// a US-only book launch). Never city, never region for anywhere else. Format examples:
//   "Portland, ME · US"   → suppressed to "US" (no city)
//   "US · ME"             ← what we actually return for US
//   "Berlin · DE"         → returns "DE"
//   "??"                  ← nothing known
export function place(request) {
  try {
    const h = request.headers;
    const c = (h.get('x-vercel-ip-country') || '').toUpperCase();
    if (!c) return '??';
    if (c === 'US' || c === 'CA') {
      const r = (h.get('x-vercel-ip-country-region') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 4);
      return r ? `${c} · ${r}` : c;
    }
    return c;
  } catch { return '??'; }
}

// Back-compat: existing routes imported `country`. Keep it working, but map to place().
export function country(request) { return place(request); }

// Sanitizer for any `extra` string that might reach a Telegram line. Never call notify()
// with raw client input.
export function safeExtra(s, cap = 40) {
  // No ':' and no '/' — without them a hostile `extra` cannot form a URL, and Telegram
  // auto-links bare URLs even with `parse_mode` unset. No real extra needs either
  // character ("first", "5 in 23.4s", "6 rooms · 12m", "listing").
  return String(s || '').replace(/[^A-Za-z0-9 ._·×\-]/g, '').slice(0, cap);
}

// A shared, global flood breaker — a hard ceiling that trips a 60-second silent mute if
// the process would otherwise send too many messages. This is defence-in-depth against a
// rate-limit bypass (serverless Maps don't survive cold starts, so the per-key limiter is
// best-effort). We DO NOT tell the client it hit the breaker — silent drop.
let breakerCount = 0;
let breakerWindow = Date.now();
let breakerMuted = 0;
const BREAKER_MAX = 300;  // total notifies allowed in any 60s window
function breakerTrip() {
  const now = Date.now();
  if (now < breakerMuted) return true;                     // still muted
  if (now - breakerWindow > 60000) { breakerCount = 0; breakerWindow = now; }
  breakerCount += 1;
  if (breakerCount > BREAKER_MAX) {
    breakerMuted = now + 60000;                            // full minute of silence
    return true;
  }
  return false;
}

export async function notify(text) {
  if (breakerTrip()) return;                               // flood breaker
  if (DRYRUN) { console.log('[telegram-dryrun]', text); return; }
  if (!TOKEN || !CHAT) return;                             // not configured — silently off
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // NB: no parse_mode. Every character in `text` renders literally in the client.
      body: JSON.stringify({ chat_id: CHAT, text, disable_notification: false }),
      signal: AbortSignal.timeout(1500),                   // bounded: the word box never waits on us
    });
  } catch { /* Telegram down or slow — the vault does not care */ }
}
