// Unsubscribe — the other half of the promise /newsletter makes ("unsubscribe with
// a single click anytime"). Removal happens in the same Google Sheet the signups
// land in, via the Dispatch Apps Script (site/scripts/dispatch-mailer.gs).
//
// Configure ONE env var in Vercel (Production + Preview):
//   UNSUB_WEBHOOK = the /exec Web-app URL of the Dispatch Apps Script deployment
//
// DELIBERATELY POST-ONLY. Mail clients and corporate security appliances prefetch
// every GET link in a message; if removal happened on GET, those scanners would
// silently unsubscribe people who never clicked. The emailed link therefore points
// at the /unsubscribed PAGE, where the reader presses ONE confirm button that performs this POST (2026-11-09:
// no longer fired on page load, so a forwarded issue can't let the next reader silently remove the subscriber).
export const prerender = false;

const HOOK = import.meta.env.UNSUB_WEBHOOK ?? process.env.UNSUB_WEBHOOK;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// One person unsubscribing is a handful of requests, never a flood.
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 20;
}

async function readToken(request) {
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) return String((await request.json()).t || '');
    // The no-JS <form> fallback on /unsubscribed posts url-encoded.
    const form = await request.formData();
    return String(form.get('t') || '');
  } catch {
    return '';
  }
}

export async function POST({ request, clientAddress }) {
  const type = request.headers.get('content-type') || '';
  const isForm = !type.includes('application/json');
  const token = (await readToken(request)).trim();

  // The no-JS path is a browser navigation, so it must answer with a page, not JSON.
  const fail = (reason, status) => isForm
    ? Response.redirect(new URL('/unsubscribed/?state=error', request.url), 303)
    : json({ ok: false, reason }, status);

  if (rateLimited(clientAddress || 'unknown')) return fail('slow_down', 429);
  if (!token || token.length > 200) return fail('bad_token', 400);
  if (!HOOK) return fail('not_configured', 503);

  try {
    // Apps Script answers a web-app call with a 302 to googleusercontent — follow it.
    const res = await fetch(`${HOOK}?t=${encodeURIComponent(token)}`, { redirect: 'follow' });
    const data = await res.json();
    if (!data || !data.ok) return fail('provider_error', 502);
  } catch {
    return fail('provider_error', 502);
  }

  return isForm
    ? Response.redirect(new URL('/unsubscribed/?state=done', request.url), 303)
    : json({ ok: true });
}

// A GET never removes anyone (see the note at the top). But the mailer's footer pointed HERE until 2026-11-09
// (dispatch-mailer.gs footer_ built /api/unsubscribe?t=…), so a reader who clicked it got raw JSON — a dead link.
// With a token, send the reader on to the /unsubscribed page and its one confirm button; any copy of the old
// footer still in someone's inbox now works. Without a token it stays the health check, which reports whether
// removal is wired and never leaks the webhook URL.
export const GET = ({ request }) => {
  const t = (new URL(request.url).searchParams.get('t') || '').trim();
  if (t && t.length <= 200) {
    return new Response(null, {
      status: 303,
      headers: { location: `/unsubscribed/?t=${encodeURIComponent(t)}`, 'cache-control': 'no-store' },
    });
  }
  return json({ ok: true, service: 'unsubscribe', configured: !!HOOK });
};
