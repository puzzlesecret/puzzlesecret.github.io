// The Keeper's gifts — SERVER ONLY. A reward PDF is handed out only to someone who spoke the
// vault's word: /api/unlock returns a per-act token (a salted hash, unguessable without the
// server's salt) and this route streams the file for a valid token. The PDFs live in
// rewards-src/ (bundled with the function), never in public/. Dan's call 2026-09-03: earned,
// not open. Nothing personal is collected here; the token names an act, not a person.
export const prerender = false;

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SALT = import.meta.env.VAULT_SALT ?? process.env.VAULT_SALT;
const FILES = {
  I: 'PuzzleSecret-Vault-I-50-Easy.pdf',
  II: 'PuzzleSecret-Vault-II-100-Medium.pdf',
  III: 'PuzzleSecret-Vault-III-200-Hard.pdf',
  IV: 'PuzzleSecret-Secret-Vault-20-Master.pdf',
};
export const rewardToken = (act) => (SALT ? crypto.createHash('sha256').update(SALT + '|reward-v1|' + act).digest('hex').slice(0, 40) : '');
export const rewardUrl = (act) => '/api/reward?act=' + act + '&t=' + rewardToken(act);

function locate(file) {
  const candidates = [
    path.join(process.cwd(), 'rewards-src', file),
    new URL('../../../rewards-src/' + file, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  ];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) { /* next */ } }
  return null;
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET({ url }) {
  const act = url.searchParams.get('act'), t = url.searchParams.get('t') || '';
  if (!act && !t) return json({ ok: true, service: 'reward', ready: !!SALT });
  if (!SALT) return json({ ok: false, error: 'vault_offline' }, 503);
  if (!FILES[act]) return json({ ok: false, error: 'no_such_gift' }, 404);
  const want = rewardToken(act);
  const a = Buffer.from(t), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json({ ok: false, error: 'speak_the_word' }, 403);
  const file = locate(FILES[act]);
  if (!file) return json({ ok: false, error: 'gift_missing' }, 500);
  const bytes = fs.readFileSync(file);
  return new Response(bytes, { status: 200, headers: {
    'content-type': 'application/pdf',
    'content-disposition': 'attachment; filename="' + FILES[act] + '"',
    'content-length': String(bytes.length),
    'cache-control': 'private, no-store',
    'x-robots-tag': 'noindex',
  } });
}
