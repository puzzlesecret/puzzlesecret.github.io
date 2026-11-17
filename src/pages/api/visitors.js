// The PinPoint Visitors' Book (Dan, 2026-11-14) — a public, optional guest book in the PinPoint study.
//
// What a finder may leave, and nothing else: 2–3 initials (A–Z), a COUNTRY, a state / province / county
// where we offer one (required in the US, Canada and Australia), and optionally the nearest TOWN of
// 15,000+ people — every one picked from the GeoNames lists in src/data/visitor-places2.json (built by
// scripts/build-visitor-places.mjs). Nobody can type free text: every field is checked against a fixed
// pattern or list. No village is ever listed, so initials + place never single anyone out.
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

import { createHash } from 'node:crypto';
import { notify, isBot, quietPlace } from '../../lib/keeper-telegram.js';
import PLACES from '../../data/visitor-places2.json';
import { HOOK, AUTH, RE_VISIT_KEY } from '../../lib/visit-counts.js';

// one shared book, signed in two rooms (Dan, 2026-11-14): the room is a fixed word, never free text
const ROOMS = { book: 'Vault I', pinpoint: 'PinPoint' };
const roomOf = (v) => (v === 'book' ? 'book' : 'pinpoint');

const RE_INI = /^[A-Z]{2,3}$/;
// carve.js's list plus two-letter insults that read badly beside a place ("FU · near Leeds")
const BLOCK = ['ASS', 'FAG', 'FUK', 'FCK', 'FUX', 'FKU', 'KKK', 'NIG', 'NGR', 'CUM', 'TIT',
  'SEX', 'DIK', 'DCK', 'COK', 'KOK', 'PIS', 'VAG', 'HOE', 'JIZ', 'FAP', 'KYS', 'FU', 'FK', 'KY', 'XX', 'WTF', 'STFU'];

const has = (cc) => Object.prototype.hasOwnProperty.call(PLACES, cc);
const townIn = (cc, region, town) => {
  const t = PLACES[cc].t;
  if (region) return Array.isArray(t[region]) && t[region].includes(town);
  return Object.values(t).some((l) => l.includes(town));
};
// `forWrite` enforces the required region; rows read back (older rows had a town and no region) don't need it.
export function checkEntry(body, forWrite = true) {
  const initials = String(body && body.initials || '').toUpperCase().replace(/[^A-Z]/g, '');
  const cc = String(body && body.cc || '').toUpperCase();
  const region = String(body && body.region || '').normalize('NFC').trim();
  const town = String(body && body.town || '').normalize('NFC').trim();
  if (!RE_INI.test(initials) || BLOCK.includes(initials)) return { ok: false, reason: 'bad_initials' };
  if (!/^[A-Z]{2}$/.test(cc) || !has(cc)) return { ok: false, reason: 'bad_country' };
  if (region && !PLACES[cc].r.includes(region)) return { ok: false, reason: 'bad_region' };
  if (forWrite && PLACES[cc].req && !region) return { ok: false, reason: 'need_region' };
  if (town && !townIn(cc, region, town)) return { ok: false, reason: 'bad_place' };
  return { ok: true, initials, cc, region, town };
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
let cache = { t: 0, entries: null, total: 0, visits: {}, site: {} };

export async function GET({ request }) {
  const you = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const youOk = /^[A-Z]{2}$/.test(you) && has(you) ? you : '';
  const params = new URL(request.url).searchParams;
  const paged = ['limit', 'cursor', 'snapshot'].some((key) => params.has(key));
  const limitText = params.get('limit') ?? '10';
  const cursor = params.get('cursor');
  const snapshot = params.get('snapshot');
  const offset = cursor === null ? 0 : /^v1\.(0|[1-9]\d*)$/.test(cursor) ? Number(cursor.slice(3)) : NaN;
  const limit = Number(limitText);
  if (paged && (!/^[1-9]\d*$/.test(limitText) || limit > 25 || !Number.isSafeInteger(offset)
    || (cursor !== null && !snapshot) || (snapshot !== null && !/^[a-f0-9]{64}$/.test(snapshot))
    || ['limit', 'cursor', 'snapshot'].some((key) => params.getAll(key).length > 1))) {
    return json({ ok: false, reason: 'bad_page', you: youOk }, 400);
  }
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
        if (!row || typeof row !== 'object') continue;
        const c = checkEntry({ initials: row.i, cc: row.cc, region: row.r, town: row.p }, false);
        if (c.ok) entries.push({ i: c.initials, p: c.town, r: c.region, cc: c.cc, m: monthOf(row.t), rm: roomOf(row.room) });
      }
      // visits: {CC: n} — country counts only (never a time), and only for countries we know
      const visits = {};
      if (d.visits && typeof d.visits === 'object') for (const [k, v] of Object.entries(d.visits)) if (/^[A-Z]{2}$/.test(k) && has(k) && Number(v) > 0) visits[k] = Math.min(999999, Math.floor(Number(v)));
      // site: {US-NY | GB: n} — every site visitor's country (US/Canadian state), counts only, never a time
      const site = {};
      if (d.site && typeof d.site === 'object') for (const [k, v] of Object.entries(d.site)) if (RE_VISIT_KEY.test(k) && has(k.slice(0, 2)) && Number(v) > 0) site[k] = Math.min(999999, Math.floor(Number(v)));
      const reportedTotal = Number(d.total);
      const total = Number.isSafeInteger(reportedTotal) && reportedTotal >= entries.length ? reportedTotal : entries.length;
      // Hash public, sanitized fields only. Exact timestamps and other upstream fields never leave here.
      const snapshot = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
      cache = { t: Date.now(), entries, total, visits, site, snapshot };
    } catch {
      if (!cache.entries) return json({ ok: false, reason: 'book_unreachable', you: youOk }, 502);
    }
  }
  const availableTotal = cache.entries.length;
  const common = { total: cache.total, availableTotal, visits: cache.visits || {}, site: cache.site || {}, you: youOk };
  // Existing globe/signing callers still receive their latest 150 entries. Only the book opts into paging.
  if (!paged) return json({ ok: true, entries: cache.entries.slice(0, 150), ...common });
  if (snapshot !== null && snapshot !== cache.snapshot) return json({ ok: false, reason: 'page_changed', you: youOk }, 409);
  if (offset > availableTotal) return json({ ok: false, reason: 'bad_page', you: youOk }, 400);
  const hasMore = offset + limit < availableTotal;
  return json({ ok: true, entries: cache.entries.slice(offset, offset + limit), ...common,
    limit, offset, snapshot: cache.snapshot, hasMore,
    nextCursor: hasMore ? `v1.${offset + limit}` : null,
    prevCursor: offset > 0 ? `v1.${Math.max(0, offset - limit)}` : null });
}

// ---- A VISIT (Dan, 2026-11-14): each browser's first arrival at the PinPoint door adds one to a public count for
// its COUNTRY (from the connection, never asked), shown as ink dots on the Keeper's globe. Nothing else is stored —
// the connection address is only used here, for a moment, to stop repeat counting. Crawlers and the quiet countries
// (CN: nearly all automated) are not counted. No Telegram line: the arrival line already tells Dan.
const visitBuckets = new Map();
async function handleVisit(request, clientAddress) {
  const cc = (request.headers.get('x-vercel-ip-country') || '').toUpperCase();
  // `final` tells the browser to stop asking: true when it was counted or should never be; false when the sheet
  // didn't take it (e.g. the script not updated yet), so the next visit tries again
  if (!/^[A-Z]{2}$/.test(cc) || !has(cc) || isBot(request) || quietPlace(request)) return json({ ok: true, counted: false, final: true });
  const ip = clientAddress || 'unknown', now = Date.now(), last = visitBuckets.get(ip) || 0;
  if (now - last < 3600000) return json({ ok: true, counted: false, final: true });
  visitBuckets.set(ip, now);
  try {
    // awaited: Vercel may freeze the function once it answers, which would drop an un-awaited request
    const r = await fetch(HOOK, {
      method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tab: 'visits', cc, auth: AUTH }), signal: AbortSignal.timeout(4000),
    });
    const d = await r.json();
    const ok = !!(d && d.ok);
    return json({ ok: true, counted: ok, final: ok || (d && d.reason === 'full') });
  } catch (e) {
    return json({ ok: true, counted: null, final: true });   // unknown (slow) — it probably landed; don't send again
  }
}

export async function POST({ request, clientAddress }) {
  if (!HOOK || !AUTH) return json({ ok: false, reason: 'not_configured' }, 503);
  let peek = null;
  try { peek = await request.clone().json(); } catch { /* not a visit */ }
  if (peek && peek.visit === true) return handleVisit(request, clientAddress);
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const c = checkEntry(body);
  if (!c.ok) return json(c);                     // a refused entry never reaches the sheet, so it isn't counted
  if (rateLimited(clientAddress || 'unknown')) return json({ ok: false, reason: 'slow_down' }, 429);
  cache = { t: 0, entries: null, total: 0, visits: {}, site: {} };
  const room = roomOf(body && body.room);
  try {
    const r = await fetch(HOOK, {
      method: 'POST', redirect: 'follow',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tab: 'visitors', initials: c.initials, cc: c.cc, place: c.town, region: c.region, room, auth: AUTH }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    if (d && d.ok) {
      // the Keeper's line carries initials + country only — never the region or town (privacy §2; keep it so)
      await notify(`\u{1F4D6} Visitors' book (${ROOMS[room]}) · signed “${c.initials}” · ${c.cc}${d.dup ? ' (repeat, not added)' : ''}`);
      return json({ ok: true, dup: !!d.dup });
    }
    return json({ ok: false, reason: d && d.reason ? String(d.reason).slice(0, 20) : 'refused' });
  } catch (e) {
    // a slow Google answer usually means the row landed; the client re-reads the list to be sure
    if (e && e.name === 'TimeoutError') return json({ ok: true, pending: true });
    return json({ ok: false, reason: 'book_unreachable' }, 502);
  }
}
