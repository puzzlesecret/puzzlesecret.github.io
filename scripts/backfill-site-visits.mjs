#!/usr/bin/env node
// Backfill the Vault I globe's "Site Visits" tab from a Telegram export of the Keeper's feed (2026-11-15).
//
// Export the chat first: Telegram Desktop → the PuzzleSecret bot chat → ⋮ → Export chat history →
// untick every media box, Format "Machine-readable JSON". Then:
//
//   node scripts/backfill-site-visits.mjs "<...>\ChatExport_YYYY-MM-DD\result.json"
//
// Counts each 4-char solver tag ONCE, at its first "arrives at" line before live counting began (T0), and credits
// that line's place: "US · NY" -> US-NY, "CA · ON" -> CA-ON, a bare US/CA -> "US"/"CA" (state unknown), else the country.
// Left out: CN; lines marked "· keeper" (and every other line of a tag that was ever marked keeper); bot lines (🤖 ⚡);
// and, before 2026-11-11 (when the CN/bot filters arrived), tags whose only line is the arrival (no other activity).
// Prints the totals and a tab-separated block to paste into the "Site Visits" tab (Place | Visitors | Last visit).
import fs from 'node:fs';

const file = process.argv[2];
// --skip a,b,c : tags known to be Dan's own devices (old lines never carried the "keeper" mark)
const ki = process.argv.indexOf('--skip');
const SKIP = new Set(ki > 0 ? process.argv[ki + 1].split(',') : []);
if (!file) { console.error('usage: node scripts/backfill-site-visits.mjs <result.json>'); process.exit(1); }
// T0 = the deploy that started live counting, 2026-11-15 ~05:15 UTC. Export dates are the PC's local time (ET, UTC-5).
const T0_LOCAL = '2026-11-15T00:15:00';
const FILTER_DAY = '2026-11-11';
const US = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const CAP = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const LINE = /^(\S+) ([0-9a-f]{4}) · ([A-Z]{2}(?: · [A-Z0-9-]{1,4})?) · (.*)$/u;

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const text = (m) => Array.isArray(m.text) ? m.text.map((x) => typeof x === 'string' ? x : x.text || '').join('') : String(m.text || '');

const lines = new Map(), first = new Map(), keeper = new Set();
for (const m of data.messages || []) {
  const t = text(m).split('\n')[0], x = t.match(LINE);
  if (!x) continue;
  const [, icon, tag, place, rest] = x;
  if (/🤖|⚡/u.test(icon)) continue;
  if (/ · keeper\b/.test(rest)) keeper.add(tag);
  lines.set(tag, (lines.get(tag) || 0) + 1);
  if (m.date >= T0_LOCAL || !rest.startsWith('arrives at ') || first.has(tag)) continue;
  first.set(tag, { date: m.date.slice(0, 10), place });
}

const counts = {}, last = {}, dropped = { cn: 0, keeper: 0, lone: 0 };
for (const [tag, f] of first) {
  const [cc, st] = f.place.split(' · ');
  if (cc === 'CN') { dropped.cn++; continue; }
  if (keeper.has(tag) || SKIP.has(tag)) { dropped.keeper++; continue; }
  if (f.date < FILTER_DAY && lines.get(tag) <= 1) { dropped.lone++; continue; }
  const key = cc === 'US' && US.has(st) ? 'US-' + st : cc === 'CA' && CAP.has(st) ? 'CA-' + st : cc;
  counts[key] = (counts[key] || 0) + 1;
  if (!last[key] || f.date > last[key]) last[key] = f.date;
}

const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
console.log('tags counted:', keys.reduce((s, k) => s + counts[k], 0), '| places:', keys.length, '| left out:', dropped);
console.log('earliest arrival in export:', [...first.values()].map((f) => f.date).sort()[0]);
console.log('\n--- paste into "Site Visits" (A2 down), replacing the interim Vercel rows ---');
for (const k of keys) console.log([k, counts[k], last[k]].join('\t'));
