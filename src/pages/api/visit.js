// A once-per-session "someone is at the vault door" ping. No cookies, no PII —
// the client sends its self-assigned random id and which mode it is in (3D/painted).
export const prerender = false;

import { notify, solverTag, place, isBot } from '../../lib/keeper-telegram.js';

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

// The two vault modules send 'painted' and '3d'; an older build sent 'flat'. Anything else
// is a probe and reads as 3D, which is the default mode anyway.
const MODE = { painted: 'the painted vault', flat: 'the painted vault', '3d': 'the 3D vault' };

export async function POST({ request, clientAddress }) {
  if (isBot(request)) return json({ ok: true });
  if (rateLimited(clientAddress || 'unknown')) return json({ ok: true });
  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const mode = MODE[String(body.mode || '')] || MODE['3d'];
  await notify(`\u{1F441} ${solverTag(body.vid)} · ${place(request)} · at ${mode} door`);
  return json({ ok: true });
}

export const GET = () => json({ ok: true, service: 'visit' });
