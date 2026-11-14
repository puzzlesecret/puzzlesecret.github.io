// Builds the place lists for the PinPoint Visitors' Book (Dan, 2026-11-14).
//
//   node scripts/build-visitor-places.mjs <path to GeoNames cities15000.txt>
//
// Source: GeoNames "cities15000" (every populated place of 15,000+ people), CC BY 4.0,
// https://download.geonames.org/export/dump/ — credited on the privacy page and under the book.
// Only places of 15,000+ are offered ON PURPOSE: a finder picks the nearest real city, never a
// village, so initials + place can never single anyone out (and nobody can type free text).
// Writes:
//   public/data/places/<CC>.json   one sorted array of names per country (loaded on demand)
//   src/data/visitor-places.json   { CC: [names] } for the server to check every entry against
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node scripts/build-visitor-places.mjs <cities15000.txt>'); process.exit(1); }

// city-level populated places only (no neighbourhoods/sections, historical, abandoned or destroyed places)
const KEEP = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLA5', 'PPLC', 'PPLG', 'PPLS', 'PPLL']);
const byCc = {};
for (const line of fs.readFileSync(src, 'utf8').split('\n')) {
  const c = line.split('\t');
  if (c.length < 15) continue;
  const name = (c[1] || '').normalize('NFC').trim(), code = c[7], cc = c[8];
  if (!name || !KEEP.has(code) || !/^[A-Z]{2}$/.test(cc)) continue;
  if (name.length > 40 || /[0-9<>{}\[\]@#/\\:;"=+_|~`^*%$&]/.test(name)) continue;   // keep display text plain
  (byCc[cc] ||= new Set()).add(name);
}
const out = {};
for (const cc of Object.keys(byCc).sort()) out[cc] = [...byCc[cc]].sort((a, b) => a.localeCompare(b, 'en'));

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pubDir = path.join(root, 'public', 'data', 'places');
fs.mkdirSync(pubDir, { recursive: true });
for (const f of fs.readdirSync(pubDir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(pubDir, f));
for (const [cc, names] of Object.entries(out)) fs.writeFileSync(path.join(pubDir, cc + '.json'), JSON.stringify(names));
fs.writeFileSync(path.join(pubDir, 'index.json'), JSON.stringify(Object.keys(out)));   // the country codes the form offers
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'data', 'visitor-places.json'), JSON.stringify(out));
const total = Object.values(out).reduce((n, a) => n + a.length, 0);
console.log(`countries ${Object.keys(out).length} · places ${total} · US ${out.US?.length} · GB ${out.GB?.length} · CA ${out.CA?.length}`);
