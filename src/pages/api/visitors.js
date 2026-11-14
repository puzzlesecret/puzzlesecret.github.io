// The PinPoint Visitors' Book (Dan, 2026-11-14) — a public, optional guest book in the PinPoint study.
//
// What a finder may leave, and nothing else: 2–3 initials (A–Z), a COUNTRY, and the nearest CITY of
// 15,000+ people chosen from the GeoNames list for that country (src/data/visitor-places.json, built
// by scripts/build-visitor-places.mjs). Nobody can type free text: every field is checked against a
// fixed pattern or list. Initials + a city that size identify nobody — the same discipline as the
// Sanctum Wall (api/carve.js), widened only by a picked-from-a-list place.
//
// It is NOT a geocaching log and never part of the find (Groundspeak bans extra logging requirements);
// the copy says so. Storage: a "PinPoint Visitors" tab of the Sanctum Wall Google Sheet, through the
// same Apps Script web app, which re-checks everything and enforces the site-wide caps under a lock.
//
// Env: on the live site it rides the Sanctum Wall's own SANCTUM_WEBHOOK / SANCTUM_AUTH (same Apps Script,
// `tab:'visitors'`). site/.env holds those LIVE values, so a local `astro dev` must never use them: in dev
// the book only talks to VISITORS_WEBHOOK / VISITORS_AUTH (a local stand-in in .env.development.local),
// and with none set it answers "not configured". Never test through `astro preview` (it runs as PROD).
export const prerender = false;

import { notify } from '../../lib/keeper-telegram.js';
import PLACES from '../../data/visitor-places.json';

const HOOK = (import.meta.env.VISITORS_WEBHOOK ?? process.env.VISITORS_WEBHOOK)
  ?? (import.meta.env.PROD ? (import.meta.env.SANCTUM_WEBHOOK ?? process.env.SANCTUM_WEBHOOK) : undefined);
const AUTH = (import.meta.env.VISITORS_AUTH ?? process.env.VISITORS_AUTH)
  ?? (import.meta.env.PROD ? (import.meta.env.SANCTUM_AUTH ?? process.env.SANCTUM_AUTH) : undefined);

const RE_INI = /^[A-Z]{2,3}$/;
// carve.js's list plus two-letter insults that read badly beside a place ("FU · near Leeds")
const BLOCK = ['ASS', 'FAG', 'FUK', 'FCK', 'FUX', 'FKU', 'KKK', 'NIG', 'NGR', 'CUM', 'TIT',
  'SEX', 'DIK', 'DCK', 'COK', 'KOK', 'PIS', 'VAG', 'HOE', 'JIZ', 'FAP', 'KYS', 'FU', 'FK', 'KY', 'XX', 'WTF', 'STFU'];

export function checkEntry(body) {
  const initials = String(body && body.initials || '').toUpperCase().replace(/[^A-Z]/g, '');
  const cc = String(body && body.cc || '').toUpperCase();
  const place = String(body && body.place || '').normalize('NFC').trim();
  if (!RE_INI.test(initials) || BLOCK.includes(initials)) return { ok: false, reason: 'bad_initials' };
  if (!/^[A-Z]{2}$/.test(cc) || !Object.prototype.hasOwnProperty.call(PLACES, cc)) return { ok: false, reason: 'bad_country' };
  if (!place || !PLACES[cc].includes(place)) return { ok: false, reason: 'bad_place' };
  return { ok: true, initials, cc, place };
}

// per-instance only — the real caps live in the Apps Script (shared state, under a lock)
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 600000) { b.n = 0; b.t = now; }
  b.n += 1; buckets.set(ip, b);
  return b.n > 3;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };

// Only the entry list is cached (never the visitor's own country, which is per request).
let cache = { t: 0, entries: null, total: 0 };

export async function GET({ request }) {
  const you = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const youOk = /^[A-Z]{2}$/.test(you) && Object.prototype.hasOwnProperty.call(PLACES, you) ? you : '';
  if (!HOOK) return json({ ok: false, reason: 'not_configured', you: youOk }, 503);
  if (!cache.entries || Date.now() - cache.t > 60000) {
    try {
      const u = new URL(HOOK); u.searchParams.set('tab', 'visitors');
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (!d || !d.ok || !Array.isArray(d.rows)) throw new Error('bad');
      // re-check every row on the way out too: only list-valid entries are ever shown
      const entries = [];
      for (const row of d.rows) {
        const c = checkEntry({ initials: row.i, cc: row.cc, place: row.p });
        if (c.ok) entries.push({ i: c.initials, p: c.place, cc: c.cc, m: monthOf(row.t) });
        if (entries.length >= 150) break;
      }
      cache = { t: Date.now(), entries, total: Number(d.total) || entries.length };
    } catch {
      if (!cache.entries) return json({ ok: false, reason: 'book_unreachable', you: youOk }, 502);
    }
  }
  return json({ ok: true, entries: cache.entries, total: cache.total, you: youOk });
}

export async function POST({ request, clientAddress }) {
  if (!HOOK || !AUTH) return json({ ok: false, reason: 'not_configured' }, 503);
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const c = checkEntry(body);
  if (!c.ok) return json(c);                     // a refused entry never reaches the sheet, so it isn't counted
  if (rateLimited(clientAddress || 'unknown')) return json({ ok: false, reason: 'slow_down' }, 429);
  cache = { t: 0, entries: null, total: 0 };
  try {
    const r = await fetch(HOOK, {
      method: 'POST', redirect: 'follow',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tab: 'visitors', initials: c.initials, cc: c.cc, place: c.place, auth: AUTH }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    if (d && d.ok) {
      // the Keeper's line carries initials + country only — never the city (privacy §2)
      await notify(`\u{1F4D6} PinPoint visitors' book · signed “${c.initials}” · ${c.cc}${d.dup ? ' (repeat, not added)' : ''}`);
      return json({ ok: true, dup: !!d.dup });
    }
    return json({ ok: false, reason: d && d.reason ? String(d.reason).slice(0, 20) : 'refused' });
  } catch (e) {
    // a slow Google answer usually means the row landed; the client re-reads the list to be sure
    if (e && e.name === 'TimeoutError') return json({ ok: true, pending: true });
    return json({ ok: false, reason: 'book_unreachable' }, 502);
  }
}
