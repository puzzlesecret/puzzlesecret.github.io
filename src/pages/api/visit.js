// A once-per-session "someone is at the vault door" ping. No cookies, no PII —
// the client sends its self-assigned random id and which mode it is in (3D/flat).
export const prerender = false;

import { notify, solverTag, country } from '../../lib/keeper-telegram.js';

const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 4;                                    // a session pings once; 4/min is generous
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST({ request, clientAddress }) {
  if (rateLimited(clientAddress || 'unknown')) return json({ ok: true });
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const mode = body.mode === 'flat' ? 'the flat vault' : 'the 3D vault';
  await notify(`\u{1F441} ${solverTag(body.vid)} · ${country(request)} · at ${mode} door`);
  return json({ ok: true });
}

export const GET = () => json({ ok: true, service: 'visit' });
