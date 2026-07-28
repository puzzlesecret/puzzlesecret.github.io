// Newsletter signup — SERVER ONLY. Honest by design: this endpoint NEVER tells
// the visitor they subscribed unless the email was actually handed to a real
// mailing-list provider.
//
// Configure by setting ONE env var in Vercel (Production + Preview):
//   NEWSLETTER_WEBHOOK = the POST endpoint of your list provider
// It works with anything that accepts a JSON POST — Buttondown, MailerLite,
// Kit/ConvertKit, a Zapier/Make hook, or a Google-Sheets webhook.
// Optional: NEWSLETTER_AUTH = a value sent as the Authorization header.
//
// With NO env var set, this returns {ok:false, reason:'not_configured'} and the
// page tells the truth ("the list isn't open yet") instead of faking success.
export const prerender = false;

const WEBHOOK = import.meta.env.NEWSLETTER_WEBHOOK ?? process.env.NEWSLETTER_WEBHOOK;
const AUTH = import.meta.env.NEWSLETTER_AUTH ?? process.env.NEWSLETTER_AUTH;

// Deliberately permissive but structural — we are not trying to fully validate
// email syntax (impossible), just to reject obvious junk before a network call.
const looksLikeEmail = (e) =>
  typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(e);

// Per-IP token bucket — same shape as the unlock endpoint.
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; } // 1-minute window
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 5; // 5 signups/min from one IP is plenty for a human
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function POST({ request, clientAddress }) {
  let email = '';
  try { email = (await request.json()).email; } catch { /* ignore */ }
  email = String(email || '').trim().toLowerCase();

  if (rateLimited(clientAddress || 'unknown')) return json({ ok: false, reason: 'slow_down' }, 429);
  if (!looksLikeEmail(email)) return json({ ok: false, reason: 'bad_email' }, 400);

  // No provider wired yet — say so plainly rather than pretending.
  if (!WEBHOOK) return json({ ok: false, reason: 'not_configured' }, 503);

  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(AUTH ? { authorization: AUTH } : {}),
      },
      body: JSON.stringify({ email, source: 'puzzlesecret.com/newsletter', ts: new Date().toISOString() }),
    });
    if (!res.ok) return json({ ok: false, reason: 'provider_error' }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: false, reason: 'provider_error' }, 502);
  }
}

// Health check — reports whether a provider is wired, never leaks the URL.
export const GET = () => json({ ok: true, service: 'subscribe', configured: !!WEBHOOK });
