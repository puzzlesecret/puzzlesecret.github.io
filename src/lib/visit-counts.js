// Shared by /api/visitors and /api/event: where the Visitors' Book sheet lives, and the site-visit count.
//
// The sheet is the Sanctum Wall's own Apps Script (same SANCTUM_WEBHOOK / SANCTUM_AUTH on the live site).
// site/.env holds those LIVE values, so a local `astro dev` must never use them: in dev only VISITORS_WEBHOOK /
// VISITORS_AUTH (a local stand-in in .env.development.local) are read, and with none set nothing is sent.
export const HOOK = (import.meta.env.VISITORS_WEBHOOK ?? process.env.VISITORS_WEBHOOK)
  ?? (import.meta.env.PROD ? (import.meta.env.SANCTUM_WEBHOOK ?? process.env.SANCTUM_WEBHOOK) : undefined);
export const AUTH = (import.meta.env.VISITORS_AUTH ?? process.env.VISITORS_AUTH)
  ?? (import.meta.env.PROD ? (import.meta.env.SANCTUM_AUTH ?? process.env.SANCTUM_AUTH) : undefined);

// ---- SITE VISITS (Dan, 2026-11-14): each browser's FIRST arrival on any page adds one to a public count for its
// COUNTRY — and, in the US and Canada, its state or province — read from the connection, never asked. Shown as
// copper pins on the Keeper's globe in Vault I. Nothing else is stored: the connection address is only held in
// memory here, for a day, so one machine is not counted twice. Dan's own browsers ("keeper"), crawlers and the
// quiet countries are never counted (the caller has already dropped those last two).
const US = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const CA = 'AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' ');
export function visitKey(request) {
  const h = request.headers;
  const c = (h.get('x-vercel-ip-country') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return '';
  if (c === 'US' || c === 'CA') {
    const r = (h.get('x-vercel-ip-country-region') || '').toUpperCase();
    if ((c === 'US' ? US : CA).includes(r)) return c + '-' + r;
  }
  return c;
}
export const RE_VISIT_KEY = /^[A-Z]{2}(-[A-Z]{2})?$/;

const seen = new Map();            // ip -> time of its last count (per warm instance; the sheet caps the rest)
export async function countSiteVisit(request, ip) {
  if (!HOOK || !AUTH) return false;
  const key = visitKey(request); if (!key) return false;
  const now = Date.now(), id = ip || 'unknown';
  if (now - (seen.get(id) || 0) < 86400000) return false;
  seen.set(id, now);
  if (seen.size > 5000) seen.delete(seen.keys().next().value);
  try {
    const r = await fetch(HOOK, {
      method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tab: 'sitevisits', key, auth: AUTH }), signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    return !!(d && d.ok);
  } catch { return false; }
}
