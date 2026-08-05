// The Sanctum Wall — a register of INITIALS ONLY, carved by solvers of the fourth word.
//
// COPPA discipline, deliberate: 2–3 letters A–Z is all we ever accept or store. Initials
// identify nobody, so this is not "personal information in identifiable form" — the whole
// point of the design. Never widen this input. No email, no free text, no fourth character.
//
// Carving requires PROOF: the client must present the fourth word itself, which we verify
// against the same salted hash /api/unlock uses. No session state, no new secrets — knowing
// the word IS the credential, exactly as it is at the vault door.
export const prerender = false;

import crypto from 'node:crypto';
import { notify, solverTag, country } from '../../lib/keeper-telegram.js';

const SALT = import.meta.env.VAULT_SALT ?? process.env.VAULT_SALT;
const HOOK = import.meta.env.SANCTUM_WEBHOOK ?? process.env.SANCTUM_WEBHOOK;
const AUTH = import.meta.env.SANCTUM_AUTH ?? process.env.SANCTUM_AUTH;

// hash( SALT | WORD ) for the fourth word — the same entry as api/unlock.js HASHES.
const FOURTH_HASH = '7009db01f308f2c18da9b71bfcda568213d322a136fd95b8e5a9da5d2b8c5abe';

const RE = /^[A-Z]{2,3}$/;
// Same list the Apps Script enforces (defense in depth — either side alone suffices).
const BLOCK = ['ASS', 'FAG', 'FUK', 'FCK', 'FUX', 'FKU', 'KKK', 'NIG', 'NGR', 'CUM', 'TIT',
  'SEX', 'DIK', 'DCK', 'COK', 'KOK', 'PIS', 'VAG', 'HOE', 'JIZ', 'FAP', 'KYS'];

const CARVE_TOKEN = SALT ? crypto.createHash('sha256').update(SALT + '|carve-proof-v1').digest('hex') : '';
const norm = (w) => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
const hash = (w) => crypto.createHash('sha256').update(SALT + '|' + w).digest('hex');

// Carving is a once-per-person act — tighter bucket than the word box.
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 6;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// The wall changes slowly; don't hammer the Apps Script on every visitor.
let wallCache = { t: 0, data: null };

export async function GET() {
  if (!HOOK) return json({ ok: false, reason: 'not_configured' }, 503);
  if (wallCache.data && Date.now() - wallCache.t < 60000) return json(wallCache.data);
  try {
    const r = await fetch(HOOK, { redirect: 'follow' });
    const d = await r.json();
    if (d && d.ok) { wallCache = { t: Date.now(), data: d }; return json(d); }
  } catch { /* fall through */ }
  return json({ ok: false, reason: 'wall_unreachable' }, 502);
}

export async function POST({ request, clientAddress }) {
  if (!SALT || !HOOK || !AUTH) return json({ ok: false, reason: 'not_configured' }, 503);
  const ip = clientAddress || 'unknown';
  if (rateLimited(ip)) return json({ ok: false, reason: 'slow_down' }, 429);

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }

  const initials = norm(body.initials);
  if (!RE.test(initials)) return json({ ok: false, reason: 'bad_initials' });
  if (BLOCK.includes(initials)) return json({ ok: false, reason: 'bad_initials' });

  // proof: either the fourth word itself, OR the persisted token minted when it was solved.
  const word = norm(body.word);
  const wordOk = word.length >= 4 && word.length <= 12 && hash(word) === FOURTH_HASH;
  const tokenOk = CARVE_TOKEN && body.token === CARVE_TOKEN;
  if (!wordOk && !tokenOk) {
    return json({ ok: false, reason: 'no_proof' }, 403);
  }

  // The Apps Script relay usually answers in ~2s but occasionally stalls for 60-100s on
  // Google's side \u2014 long enough to blow the serverless timeout and hand the client a
  // non-JSON error page, even though the row was already appended (the write happens before
  // Google's slow RESPONSE). So bound the wait, and treat a TIMEOUT as the success it almost
  // certainly is rather than telling a solver their mark failed when it's on the wall.
  wallCache = { t: 0, data: null };              // whatever happens, the wall may have changed
  try {
    const r = await fetch(HOOK, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initials, auth: AUTH }),
      signal: AbortSignal.timeout(6000),
    });
    const d = await r.json();
    if (d && d.ok) {
      await notify(`\u{1FAA8} ${solverTag(body.vid)} \u00b7 ${country(request)} \u00b7 carved \u201c${initials}\u201d \u2014 mark #${d.count}`);
      return json({ ok: true, count: d.count });
    }
    return json({ ok: false, reason: d && d.reason ? d.reason : 'refused' });
  } catch (e) {
    // AbortError = the request WAS sent and the append almost certainly landed; report the
    // optimistic success (count unknown) so the mark reads as cut. A pre-flight failure
    // (never reached Google) is the only true failure.
    if (e && e.name === 'TimeoutError') {
      await notify(`\u{1FAA8} ${solverTag(body.vid)} \u00b7 ${country(request)} \u00b7 carved \u201c${initials}\u201d (relay slow)`);
      return json({ ok: true, count: null, pending: true });
    }
    return json({ ok: false, reason: 'wall_unreachable' }, 502);
  }
}
