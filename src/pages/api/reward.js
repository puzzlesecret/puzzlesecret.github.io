// The Keeper's gifts — SERVER ONLY. A reward PDF is handed out only to someone who spoke the
// vault's word: /api/unlock returns a per-act token (a salted hash, unguessable without the
// server's salt) and this route streams the file for a valid token. The PDFs live in
// rewards-src/ (bundled with the function), never in public/. Dan's call 2026-09-03: earned,
// not open. Nothing personal is collected here; the token names an act, not a person.
export const prerender = false;

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { notify, place, solverTag } from '../../lib/keeper-telegram.js';
import { SERVER_EV, line } from '../../lib/events.js';

const SALT = import.meta.env.VAULT_SALT ?? process.env.VAULT_SALT;
// One "served" ping per act per IP per 5 min. Server-side dedup — this is the truthful
// signal (bytes actually left the function) so it deserves the same courtesy as event.js.
const SERVED_TTL_MS = 5 * 60 * 1000;
const served = new Map();
function servedRecent(ip, act) {
  const now = Date.now();
  const k = (ip || 'unknown') + '|' + act;
  const t = served.get(k);
  if (t && now - t < SERVED_TTL_MS) return true;
  served.set(k, now);
  if (served.size > 2000) {
    const it = served.keys();
    for (let i = 0; i < 200; i++) { const r = it.next(); if (r.done) break; served.delete(r.value); }
  }
  return false;
}
const FILES = {
  I: 'PuzzleSecret-Vault-I-50-Easy.pdf',
  II: 'PuzzleSecret-Vault-II-100-Medium.pdf',
  III: 'PuzzleSecret-Vault-III-200-Hard.pdf',
  IV: 'PuzzleSecret-Secret-Vault-20-Master.pdf',
};
export const rewardToken = (act) => (SALT ? crypto.createHash('sha256').update(SALT + '|reward-v1|' + act).digest('hex').slice(0, 40) : '');
// vid is optional and opaque — the Telegram line uses it for the solver tag only. Missing vid = anonymous.
export const rewardUrl = (act, vid) => {
  const tail = vid ? '&vid=' + encodeURIComponent(String(vid).replace(/[^a-z0-9]/gi, '').slice(0, 8)) : '';
  return '/api/reward?act=' + act + '&t=' + rewardToken(act) + tail;
};

function locate(file) {
  const candidates = [
    path.join(process.cwd(), 'rewards-src', file),
    new URL('../../../rewards-src/' + file, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) { /* next */ } }
  return null;
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET({ url, request, clientAddress }) {
  const act = url.searchParams.get('act'), t = url.searchParams.get('t') || '';
  const vid = url.searchParams.get('vid') || '';                // opaque tag only, for the Telegram line
  if (!act && !t) return json({ ok: true, service: 'reward', ready: !!SALT });
  if (!SALT) return json({ ok: false, error: 'vault_offline' }, 503);
  if (!FILES[act]) return json({ ok: false, error: 'no_such_gift' }, 404);
  const want = rewardToken(act);
  const a = Buffer.from(t), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json({ ok: false, error: 'speak_the_word' }, 403);
  const file = locate(FILES[act]);
  if (!file) return json({ ok: false, error: 'gift_missing' }, 500);
  const bytes = fs.readFileSync(file);
  // The bytes are on their way — the download is the truthful signal, distinct from a
  // client-side click. Dedup per (IP, act) so a stray retry doesn't double-ping.
  try {
    if (!servedRecent(clientAddress || 'unknown', act)) {
      const ev = SERVER_EV['REWARD_SERVED_' + act];
      if (ev) notify(`${line(ev)} · ${solverTag(vid)} · ${place(request)}`);   // fire-and-forget; response is not awaited
    }
  } catch { /* never break a download over a notification */ }
  return new Response(bytes, { status: 200, headers: {
    'content-type': 'application/pdf',
    'content-disposition': 'attachment; filename="' + FILES[act] + '"',
    'content-length': String(bytes.length),
    'cache-control': 'private, no-store',
    'x-robots-tag': 'noindex',
  } });
}
