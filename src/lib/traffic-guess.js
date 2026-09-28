// The Keeper's best guess at where a visitor came from — the second line under every `arrive`.
//
// Input is ONLY what already passed the arrive grammar (page, source word, device, visit count,
// vaults opened, language, the keeper mark) plus the Vercel country. Output is text WE wrote: a fixed
// phrase and, at most, one outlet `short` name from src/lib/placements.js. Nothing a visitor sends is
// echoed, so it can never spell a hostname or a sentence the Keeper did not write.
//
// Honesty rules (from the 2026-09-28 critique):
//  · Everything here is REPORTED BY THE BROWSER and can be faked by anyone who POSTs to /api/event.
//    So a named outlet reads "🔗 link from …", never "certain". The only verified attribution on the
//    site is a guest-key unlock, which /api/unlock reports on its own line.
//  · A new-format arrival (it carries "first visit" / "visit N") already names every outlet whose site
//    or tag is on file. So "another site" there means a site NOT on file — it must never be "maybe"
//    one of ours. The country + date guess applies only to OLD-format lines (history, stale browsers),
//    which could not name our outlets.
//  · Guest keys open Vault I only, so one vault proves nothing about owning the book; two or more do.
//  · Keep the line short enough to read on a phone.
import { PLACEMENTS, placementById, placementByUtm } from './placements.js';

const SEARCH = new Set(['bing', 'duckduckgo', 'yahoo', 'brave', 'ecosia']);
const AI = new Set(['chatgpt', 'perplexity', 'claude', 'gemini']);
const SOCIAL = new Set(['youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'reddit', 'x', 'linkedin', 'whatsapp', 'messenger', 'telegram']);
const BOOKISH = new Set(['goodreads', 'librarything', 'bookbub', 'substack']);
// Pages nobody lands on first by choice — a first visit that starts here, with no link, on a
// desktop, is almost always a crawler, a security scanner or a link-preview bot.
const BACK_PAGES = new Set(['privacy', 'terms', 'faq', 'hints', 'newsletter', 'unsubscribed', 'passport', 'the-keeper', '404']);
// What a landing page says about the link that brought someone there.
const PAGE_HINT = {
  'how-to-play-sudoku': 'a "learn sudoku" link or article',
  'play': 'a free-puzzles link',
  'daily': 'a daily-puzzle link (the pins point here)',
  'escape-room-sudoku-book': 'an escape-room or puzzle-book article',
  'shop': 'a link to the shop',
};
// Countries some outlet of ours plausibly reaches (plus home).
const REACHED = new Set(['US', ...PLACEMENTS.flatMap((p) => p.audience), 'CZ']);
const TLD_COUNTRY = { uk: 'GB', ie: 'IE', au: 'AU', nz: 'NZ', ca: 'CA', de: 'DE', fr: 'FR', cz: 'CZ', it: 'IT', es: 'ES', nl: 'NL', in: 'IN', sg: 'SG' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pretty = (ymd) => { const [, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const daysSince = (ymd, now) => (now - Date.parse(ymd + 'T00:00:00Z')) / 86400000;

// Parse a validated arrive extra. Old clients send only "<page>[ from <src>] · <device>".
export function parseArrive(extra) {
  const out = { page: '', source: '', tld: '', device: '', visit: 0, fresh: false, words: 0, lang: '', keeper: false, newFormat: false };
  if (!extra) return out;
  const parts = extra.split(' · ');
  const m = (parts.shift() || '').match(/^(\S+)(?: from (.+))?$/);
  if (m) { out.page = m[1]; out.source = m[2] || 'inside'; }
  const t = out.source.match(/^another site \.([a-z]{2})$/);
  if (t) { out.source = 'another site'; out.tld = t[1]; }
  for (const p of parts) {
    if (p === 'phone' || p === 'desktop' || p === 'tablet') out.device = p;
    else if (p === 'first visit') { out.visit = 1; out.fresh = true; out.newFormat = true; }
    else if (p === 'visit 10 or more') { out.visit = 10; out.newFormat = true; }
    else if (/^visit \d+$/.test(p)) { out.visit = Number(p.slice(6)); out.newFormat = true; }
    else if (/^\d vaults? opened$/.test(p)) out.words = Number(p[0]);
    else if (p === 'keeper') out.keeper = true;
    else if (/^[a-z]{2}(-[A-Z]{2})?$/.test(p)) out.lang = p;
  }
  return out;
}

// Outlets that have published and plausibly reach `country`, newest first, within `days`.
function recentLanded(country, days, now, pred) {
  return PLACEMENTS
    .filter((p) => p.landed && p.audience.includes(country) && pred(p))
    .filter((p) => { const d = daysSince(p.landed, now); return d >= 0 && d <= days; })
    .sort((a, b) => b.landed.localeCompare(a.landed));
}

/**
 * @param {string} extra   the validated arrive extra
 * @param {string} place   place() output, e.g. "GB" or "US · NY"
 * @param {number} now     ms epoch (injectable for tests and for the history report)
 * @param {number} burst   how many OTHER no-link first visits arrived within 10 minutes (0 if unknown)
 * @param {number} nearby  how many OTHER no-link first visits came from the SAME country within an hour
 * @returns {string} one short line, or '' when there is nothing worth adding
 */
export function guessSource(extra, place, now = Date.now(), burst = 0, nearby = 0) {
  const a = parseArrive(extra);
  if (a.keeper) return '🏠 you (a device you marked)';
  const country = String(place || '').slice(0, 2);
  const src = a.source;
  // History, worded as history: these vaults were opened on EARLIER visits, not now.
  // "(visit 4; Vault I so far)" / "(visit 10+; 3 vaults so far, has the book)"
  const bits = [];
  if (a.visit >= 2) bits.push(a.visit >= 10 ? 'visit 10+' : `visit ${a.visit}`);
  if (a.words >= 2) bits.push(`${a.words} vaults so far, has the book`);
  else if (a.words === 1) bits.push('Vault I so far');
  const who = bits.length ? ` (${bits.join('; ')})` : '';

  // 1. The browser names the outlet (its site, or the tag on its link). An outlet that has not
  // published yet is almost always the outlet itself (or Dan) trying the link, so history is dropped.
  const u = src.startsWith('utm ') ? src.slice(4) : '';
  const bySite = placementById(src);
  const named = bySite || (u ? placementByUtm(u) : null);
  if (named && named.landed) return `🔗 link from ${named.short}${who}`;
  // Their own WEBSITE sent someone, but we have no record of them publishing: that is news.
  if (bySite) return `🆕 from ${named.short}'s site: new coverage? Worth a look`;
  // The tagged link we handed them, before anything is out: almost always them trying it.
  if (named) return `🔗 ${named.short} link, not out yet: them testing?`;
  if (u === 'qr') return `🔗 scanned a QR code${who}`;
  if (u === 'pinterest') return `📌 a tagged Pinterest pin${who}`;
  if (u) return `🏷 a tagged link not on file${who}`;

  // 2. The kind of site.
  if (src === 'google') return `🔎 Google: a search, or a click in Gmail${who}`;
  if (SEARCH.has(src)) return `🔎 a search on ${src}${who}`;
  if (AI.has(src)) return `💬 an AI assistant (${src})${who}`;
  if (src === 'pinterest') return `📌 Pinterest, likely a daily pin${who}`;
  if (src === 'amazon') return `🛒 from Amazon${who}`;
  if (src === 'mensa') return `🔗 link from Magazín Mensa${who}`;
  if (src === 'email') return `📧 a link in an email${who}`;
  if (SOCIAL.has(src)) return `💬 a post or message on ${src}${who}`;
  if (BOOKISH.has(src)) return `📚 from ${src}${who}`;

  // 3. Probably not a person.
  if (src === 'direct' && (a.fresh || !a.newFormat) && a.device === 'desktop' && BACK_PAGES.has(a.page)) {
    return `🤖 likely a crawler: first stop the ${a.page.replace(/^the-/, '')} page, no link`;
  }
  if (src === 'direct' && (a.fresh || !a.newFormat) && a.device === 'desktop' && burst >= 2) {
    return `⚡ ${burst + 1} no-link visits in 10 min: bots, or an email just went out`;
  }
  // Several no-link desktop visits from one country we have never reached (no outlet's audience)
  // inside an hour is a crawler working through the site, not readers.
  if (src === 'direct' && (a.fresh || !a.newFormat) && a.device === 'desktop' && nearby >= 1 && !REACHED.has(country)) {
    return `🤖 likely bots: ${nearby + 1} no-link visits from ${country || 'one country'} within an hour`;
  }

  // 4. Returning visitors need no source guess.
  if ((a.words || a.visit >= 2) && (src === 'direct' || src === 'another site' || src === 'inside')) {
    return '↩ back again' + who;
  }

  // 5. A site we don't know.
  if (src === 'another site') {
    const where = a.tld ? ` (.${a.tld})` : '';
    const hint = PAGE_HINT[a.page] ? `, likely ${PAGE_HINT[a.page]}` : '';
    if (!a.newFormat) {
      // OLD-format line: it could not name our outlets, so a published one that links here is fair.
      const c = TLD_COUNTRY[a.tld] || country;
      const hits = recentLanded(c, 21, now, (p) => p.linksSite);
      if (hits.length) return `🤔 maybe ${hits[0].short}, out ${pretty(hits[0].landed)}`;
    }
    return `❔ a site not on our list${where}${hint}`;
  }

  // 6. No link at all.
  if (src === 'direct') {
    // Outlets whose piece names the site in words but gives no clickable link to it.
    const hits = (a.fresh || !a.newFormat) ? recentLanded(country, 7, now, (p) => p.mentionsSite && !p.linksSite) : [];
    const maybe = hits.length ? `; maybe ${hits[0].short}` : '';
    if (a.page === 'home') return `❔ no link: typed the address, or tapped it in an app or email${maybe}`;
    return `❔ no link: a saved or shared link to ${a.page.replace(/^the-/, '')}${maybe}`;
  }
  return who ? '↩ back again' + who : '';
}
