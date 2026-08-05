// The Keeper's messenger — Telegram notifications for vault activity.
//
// Dan's requirement: know when someone is actually at the vault and how far they get —
// visits, every word attempt (right or wrong), which vault opened, carvings — with NO
// personal information. What we send: a self-assigned random 4-char solver tag (so the
// same browser's journey reads as a story), coarse country from Vercel's edge header,
// and the event itself. Wrong guesses are already normalized to bare A-Z upstream, so
// an accidentally-typed email or name can never reach this channel.
//
// Fail-safe by design: if the env vars are missing or Telegram is down, every function
// here silently no-ops. A notification must never break an unlock.

const TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
const CHAT = import.meta.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;
// Local testing: TELEGRAM_DRYRUN=1 prints the message instead of sending it.
const DRYRUN = (import.meta.env.TELEGRAM_DRYRUN ?? process.env.TELEGRAM_DRYRUN) === '1';

export function solverTag(vid) {
  // Client sends a random self-assigned id; show only 4 chars. Never an IP, never a name.
  const v = String(vid || '').replace(/[^a-z0-9]/gi, '').slice(0, 4);
  return v ? v.toLowerCase() : 'anon';
}

export function country(request) {
  try { return request.headers.get('x-vercel-ip-country') || '??'; } catch { return '??'; }
}

export async function notify(text) {
  if (DRYRUN) { console.log('[telegram-dryrun]', text); return; }
  if (!TOKEN || !CHAT) return;                       // not configured — silently off
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_notification: false }),
      signal: AbortSignal.timeout(1500),             // bounded: the word box never waits on us
    });
  } catch { /* Telegram down or slow — the vault does not care */ }
}
