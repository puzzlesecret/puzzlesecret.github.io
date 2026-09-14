// Secret word-check — SERVER ONLY. The answer words never appear here in
// plaintext (only salted SHA-256 hashes) and never reach the client bundle.
// Client POSTs { word }; we normalize, hash, and look it up. Rate-limited.
export const prerender = false;

import crypto from 'node:crypto';
import { notify, solverTag, place } from '../../lib/keeper-telegram.js';
import { rewardUrl } from './reward.js';

// Salt lives ONLY in the VAULT_SALT env var (site/.env locally — gitignored;
// a Vercel env var in production). It must NEVER be committed: without it the
// hashes below are uncrackable, which is what makes this file safe to publish.
const SALT = import.meta.env.VAULT_SALT ?? process.env.VAULT_SALT; // .env in dev / Vercel env var in prod

// hash( SALT | NORMALIZED_WORD ) -> reward metadata. No plaintext answers here.
const HASHES = {
  '54cd85880c16e9fdd2e794428ab8cca5e9b9db0dba570914772289495d2fcbee': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10 },
  '09ebb42c1c790c0df466c2594ed1f9412746e5fd1183f047bf5509bf77042376': { act: 'II', reward: '100 bonus Medium puzzles', tier: 'medium', discount: 20 },
  '14931225a6efb6f746b42dd5dc7d068af053a88cd3bcec24c7d21827e558f72a': { act: 'III', reward: '200 bonus Hard puzzles', tier: 'hard', discount: 30 },
  '7009db01f308f2c18da9b71bfcda568213d322a136fd95b8e5a9da5d2b8c5abe': { act: 'IV', reward: "the Keeper's private epilogue", tier: 'lantern', discount: 0, hidden: true },

  // ── GUEST KEYS ───────────────────────────────────────────────────────────
  // A guest key opens Vault I for readers of an outlet that printed one of our
  // puzzles. It is NOT one of the book's four words and never will be: printing
  // a real answer word would let anyone skip an act of the book, and that secret
  // is the one thing a buyer cannot get anywhere else. A guest gets the same
  // vault and the same gift — vault access costs us nothing and a delighted
  // stranger is a warmer prospect than one who never saw the door.
  // `guest` is a label only; it changes the Keeper's Telegram line so Dan can
  // tell WHICH placement sent someone. That is the only attribution this
  // program has. Add one line per outlet; never reuse a key across two.
  '179d3b60d2b445d5ef073dfea5ddc3b401fce6779eceed81a11912de85ce03db': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Magazin Mensa (CZ)' },
};

// An opaque, unguessable proof that SOMEONE solved the fourth word. Returned only on that
// success, stored by the client, and accepted by /api/carve instead of re-typing the word.
// It reveals nothing (a hash of the salt) and never appears for a non-solver.
const CARVE_TOKEN = SALT ? crypto.createHash('sha256').update(SALT + '|carve-proof-v1').digest('hex') : '';
const norm = (w) => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
const hash = (w) => crypto.createHash('sha256').update(SALT + '|' + w).digest('hex');

// Tiny per-IP token bucket (generous for humans, hostile to wordlist scripts).
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 10000) { b.n = 0; b.t = now; } // reset window every 10s
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 25; // >25 guesses / 10s from one IP = throttled
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST({ request, clientAddress }) {
  if (!SALT) return json({ ok: false, error: 'vault_offline' }, 503); // env var missing
  let word = '', body = null;
  try { body = await request.json(); word = body.word; } catch { /* ignore */ }
  const w = norm(word);
  const ip = clientAddress || 'unknown';

  if (rateLimited(ip)) return json({ ok: false, error: 'slow_down' }, 429);
  if (w.length < 4 || w.length > 12) return json({ ok: false });

  const hit = HASHES[hash(w)];
  const tag = solverTag(body && body.vid);
  const geo = place(request);
  if (hit) {
    const line = hit.guest
      ? `\u{1F4F0} ${tag} \u00b7 ${geo} \u00b7 GUEST KEY \u2014 came in from ${hit.guest}`
      : hit.act === 'IV'
        ? `\u{1F56F} ${tag} \u00b7 ${geo} \u00b7 found the FOURTH word \u2014 the floor opens`
        : `\u{1F513} ${tag} \u00b7 ${geo} \u00b7 opened Vault ${hit.act}`;
    await notify(line);
    return json({ ok: true, act: hit.act, reward: hit.reward, tier: hit.tier, discount: hit.discount, hidden: !!hit.hidden, rewardUrl: rewardUrl(hit.act, body && body.vid), carveToken: hit.act === 'IV' ? CARVE_TOKEN : undefined });
  }
  await notify(`\u274C ${tag} \u00b7 ${geo} \u00b7 guessed \u201c${w}\u201d`);
  return json({ ok: false });
}

// A GET is handy for a health check; never reveals anything.
export const GET = () => json({ ok: true, service: 'unlock', ready: true });
