#!/usr/bin/env node
// Where is the traffic coming from? Re-reads a Telegram chat export of the Keeper's feed and runs
// every arrival through the same guess the live feed now prints (src/lib/traffic-guess.js), so old
// visits get the same "↳ maybe …" line new ones do.
//
// Export the chat first: Telegram Desktop → the PuzzleSecret bot chat → ⋮ → Export chat history →
// untick everything, Format "Machine-readable JSON". Then:
//
//   node scripts/traffic-report.mjs "R:\Telegram Desktop\ChatExport_2026-09-28\result.json"
//   node scripts/traffic-report.mjs <result.json> --since 2026-09-20
//
// Visit counts and words held are reconstructed from the log itself (earlier arrivals and
// "opened Vault" lines for the same tag), because lines before 2026-09-28 do not carry them.
// The chat export's dates are the PC's local time; the report prints them as-is.
import fs from 'node:fs';
import { guessSource, returningNote } from '../src/lib/traffic-guess.js';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/traffic-report.mjs <result.json> [--since YYYY-MM-DD]'); process.exit(1); }
const si = process.argv.indexOf('--since');
const since = si > 0 ? process.argv[si + 1] : '';

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const text = (m) => Array.isArray(m.text) ? m.text.map((x) => typeof x === 'string' ? x : x.text || '').join('') : String(m.text || '');
const LINE = /^\S+ ([0-9a-f]{4}) · ([A-Z]{2}(?: · [A-Z0-9]{1,4})?) · (.*)$/;

const visits = {}, words = {}, rows = [];
// pass 1: every no-link first visit on a desktop, by time
const noLinkAll = [];
{
  const seen = new Set();
  for (const m of data.messages || []) {
    const x = text(m).split('\n')[0].match(LINE);
    if (!x || !x[3].startsWith('arrives at ')) continue;
    const first = !seen.has(x[1]); seen.add(x[1]);
    if (first && / from direct · desktop/.test(x[3])) noLinkAll.push({ t: Date.parse(m.date), c: x[2].slice(0, 2) });
  }
}
const bySource = {}, byGuess = {};
for (const m of data.messages || []) {
  const t = text(m).split('\n')[0];
  const x = t.match(LINE);
  if (!x) continue;
  const [, tag, place, rest] = x;
  // Every true word counts: the book's (Vaults I-III), the fourth (its own line, "found the
  // FOURTH word"), and a guest key (always Vault I). Old lines carry no quoted word; new ones do.
  const o = rest.match(/^opened Vault (I|II|III|IV)\b/);
  const act = o ? o[1] : /^found the FOURTH word\b/.test(rest) ? 'IV' : /^GUEST KEY\b/.test(rest) ? 'I' : '';
  if (act) { (words[tag] ||= new Set()).add(act); continue; }
  const a = rest.match(/^arrives at (.+)$/);
  if (!a) continue;
  visits[tag] = (visits[tag] || 0) + 1;
  if (since && m.date.slice(0, 10) < since) continue;
  let extra = a[1];
  // Old lines have no visit count or vaults — add what the log itself knows. A first visit gets no
  // marker, so it stays "old format" (the country + date guess and the bot rules apply); a repeat visit
  // gets "visit N", which only ever leads to "back again".
  const n = visits[tag];
  const w = words[tag] ? words[tag].size : 0;
  if (!/ · (first visit|visit )/.test(extra)) {
    const old = extra;
    extra = old + (n >= 10 ? ' · visit 10 or more' : n > 1 ? ` · visit ${n}` : '') + (w ? ` · ${w} vault${w > 1 ? 's' : ''} opened` : '');
  }
  // The live feed can only count a burst as it builds; with the whole log in hand we look both ways,
  // so every member of a scanner sweep is flagged, not just the third onwards.
  const ts = Date.parse(m.date);
  const mine = n === 1 && / from direct · desktop/.test(extra);
  const others = mine ? noLinkAll.filter((o) => o.t !== ts) : [];
  const burst = others.filter((o) => Math.abs(o.t - ts) <= 10 * 60000).length;
  const nearby = others.filter((o) => o.c === place.slice(0, 2) && Math.abs(o.t - ts) <= 60 * 60000).length;
  const g = guessSource(extra, place, ts, burst, nearby);
  const src = (a[1].match(/ from ([^·]+?) ·/) || [, 'inside'])[1];
  bySource[src] = (bySource[src] || 0) + 1;
  const kind = g.split(' ')[0] || '—';
  byGuess[kind] = (byGuess[kind] || 0) + 1;
  const r = returningNote(extra);
  rows.push(`${m.date.replace('T', ' ').slice(0, 16)}  ${tag}  ${place.padEnd(7)}  ${a[1]}\n${' '.repeat(18)}↳ ${g || '—'}` + (r ? `\n${' '.repeat(18)}${r}` : ''));
}

console.log(rows.join('\n'));
console.log('\n── Arrivals by what the link said ─────────────');
for (const [k, v] of Object.entries(bySource).sort((p, q) => q[1] - p[1])) console.log(`${String(v).padStart(4)}  ${k}`);
console.log('\n── Arrivals by how sure the Keeper is ─────────');
const KIND = { '🔗': 'the browser named one of our outlets', '🔎': 'search engine (or Gmail)', '📌': 'Pinterest', '📧': 'email', '💬': 'social, messaging or AI assistant', '📚': 'book sites', '🤔': 'a guess from country + date (old-format lines only)', '❔': 'no link, or a site not on our list', '🤖': 'probably not a person', '↩': 'been here before', '🏷': 'tagged link not on file', '🛒': 'Amazon', '🏠': 'your own device', '⚡': 'a burst: bots, or an email going out' };
for (const [k, v] of Object.entries(byGuess).sort((p, q) => q[1] - p[1])) console.log(`${String(v).padStart(4)}  ${k} ${KIND[k] || ''}`);
