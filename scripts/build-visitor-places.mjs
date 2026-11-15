// Builds the place lists for the PinPoint Visitors' Book (Dan, 2026-11-14; regions added the same day).
//
//   node scripts/build-visitor-places.mjs <dir holding cities15000.txt, admin1CodesASCII.txt, admin2Codes.txt>
//
// Source: GeoNames (CC BY 4.0), https://download.geonames.org/export/dump/ — credited under the book and on
// the privacy page. A finder picks: country → (state / province / county, where we offer one) → optionally
// the nearest town of 15,000+ people. Nothing is typed freely and no village is listed, so initials + place
// never single anyone out (Dan chose to keep the 15,000 floor, 2026-11-14).
//
// Region levels are CURATED, never automatic (seven critiques, 2026-11-14): GeoNames' own UK list mixes
// counties with metropolitan boroughs and splits Shropshire from Telford, so England uses the 47 ceremonial
// counties people actually say (City of London folded into Greater London), Scotland/Wales/NI their council
// areas with tidied names, Ireland its 26 counties. Labels follow Google's address data (libaddressinput).
//
// Writes:
//   public/data/places2/<CC>.json  { label, req, regions:[[name, group]], towns:{ region:[names], '':[...] } }
//   public/data/places2/index.json  the country codes the form offers
//   src/data/visitor-places2.json   { CC: { req, r:[names], t:{ region:[names], '':[...] } } } for the server
// (public/data/places/ — the first, city-only format — is left in place one release for tabs still open.)
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'cities15000.txt'))) { console.error('usage: node scripts/build-visitor-places.mjs <geonames dir>'); process.exit(1); }
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => l.replace(/\r$/, '').split('\t'));

const A1 = Object.fromEntries(read('admin1CodesASCII.txt').map((c) => [c[0], c[1]]));
const A2 = Object.fromEntries(read('admin2Codes.txt').map((c) => [c[0], c[1]]));

// ---- curated region levels ----
const LEVEL = {
  US: { label: 'State', req: true }, CA: { label: 'Province or territory', req: true }, AU: { label: 'State or territory', req: true },
  GB: { label: 'County', req: false }, IE: { label: 'County', req: false }, DE: { label: 'State', req: false },
  NL: { label: 'Province', req: false }, FR: { label: 'Region', req: false }, NZ: { label: 'Region', req: false },
};
const tidyA1 = (n) => n.normalize('NFC').replace(/^State of /, '').replace(/ (Region|District)$/, '').trim();
// England: GeoNames admin2 name → ceremonial county
const ENG = {
  'Barnsley': 'South Yorkshire', 'Bath and North East Somerset': 'Somerset', 'City and Borough of Birmingham': 'West Midlands',
  'Blackburn with Darwen': 'Lancashire', 'Blackpool': 'Lancashire', 'Bournemouth, Christchurch and Poole Council': 'Dorset',
  'Borough of Bolton': 'Greater Manchester', 'Bracknell Forest': 'Berkshire', 'Bradford': 'West Yorkshire', 'Brighton and Hove': 'East Sussex',
  'City of Bristol': 'Bristol', 'Buckinghamshire': 'Buckinghamshire', 'Borough of Bury': 'Greater Manchester', 'Calderdale': 'West Yorkshire',
  'Cambridgeshire': 'Cambridgeshire', 'Cornwall': 'Cornwall', 'Isles of Scilly': 'Cornwall', 'Coventry': 'West Midlands', 'Cumbria': 'Cumbria',
  'Cumberland': 'Cumbria', 'Westmorland and Furness': 'Cumbria', 'Darlington': 'County Durham', 'Derby': 'Derbyshire', 'Derbyshire': 'Derbyshire',
  'Devon': 'Devon', 'Doncaster': 'South Yorkshire', 'Dorset': 'Dorset', 'Dudley': 'West Midlands', 'County Durham': 'County Durham',
  'East Riding of Yorkshire': 'East Riding of Yorkshire', 'East Sussex': 'East Sussex', 'Essex': 'Essex', 'Gateshead': 'Tyne and Wear',
  'Gloucestershire': 'Gloucestershire', 'Borough of Halton': 'Cheshire', 'Hampshire': 'Hampshire', 'Hartlepool': 'County Durham',
  'Herefordshire': 'Herefordshire', 'Hertfordshire': 'Hertfordshire', 'Isle of Wight': 'Isle of Wight', 'Kent': 'Kent',
  'City of Kingston upon Hull': 'East Riding of Yorkshire', 'Kirklees': 'West Yorkshire', 'Knowsley': 'Merseyside', 'Greater London': 'Greater London',
  'City of London': 'Greater London', 'Lancashire': 'Lancashire', 'City and Borough of Leeds': 'West Yorkshire', 'City of Leicester': 'Leicestershire',
  'Leicestershire': 'Leicestershire', 'Lincolnshire': 'Lincolnshire', 'Liverpool': 'Merseyside', 'Luton': 'Bedfordshire',
  'Manchester': 'Greater Manchester', 'Medway': 'Kent', 'Middlesbrough': 'North Yorkshire', 'Milton Keynes': 'Buckinghamshire',
  'Newcastle upon Tyne': 'Tyne and Wear', 'Norfolk': 'Norfolk', 'North East Lincolnshire': 'Lincolnshire', 'North Lincolnshire': 'Lincolnshire',
  'North Somerset': 'Somerset', 'North Tyneside': 'Tyne and Wear', 'Northumberland': 'Northumberland', 'North Yorkshire': 'North Yorkshire',
  'Nottingham': 'Nottinghamshire', 'Nottinghamshire': 'Nottinghamshire', 'Borough of Oldham': 'Greater Manchester', 'Oxfordshire': 'Oxfordshire',
  'Peterborough': 'Cambridgeshire', 'Plymouth': 'Devon', 'Portsmouth': 'Hampshire', 'Reading': 'Berkshire', 'Redcar and Cleveland': 'North Yorkshire',
  'Borough of Rochdale': 'Greater Manchester', 'Rotherham': 'South Yorkshire', 'Rutland': 'Rutland', 'City and Borough of Salford': 'Greater Manchester',
  'Shropshire': 'Shropshire', 'Sandwell': 'West Midlands', 'Sefton': 'Merseyside', 'Sheffield': 'South Yorkshire', 'Slough': 'Berkshire',
  'Solihull': 'West Midlands', 'Somerset': 'Somerset', 'Southampton': 'Hampshire', 'Southend-on-Sea': 'Essex',
  'South Gloucestershire': 'Gloucestershire', 'South Tyneside': 'Tyne and Wear', 'Staffordshire': 'Staffordshire', 'St. Helens': 'Merseyside',
  'Borough of Stockport': 'Greater Manchester', 'Stockton-on-Tees': 'County Durham', 'Stoke-on-Trent': 'Staffordshire', 'Suffolk': 'Suffolk',
  'Sunderland': 'Tyne and Wear', 'Surrey': 'Surrey', 'Borough of Swindon': 'Wiltshire', 'North Northamptonshire': 'Northamptonshire',
  'Borough of Tameside': 'Greater Manchester', 'Telford and Wrekin': 'Shropshire', 'Borough of Thurrock': 'Essex', 'Borough of Torbay': 'Devon',
  'Trafford': 'Greater Manchester', 'City and Borough of Wakefield': 'West Yorkshire', 'Walsall': 'West Midlands', 'Warrington': 'Cheshire',
  'Warwickshire': 'Warwickshire', 'West Berkshire': 'Berkshire', 'West Sussex': 'West Sussex', 'Borough of Wigan': 'Greater Manchester',
  'Wiltshire': 'Wiltshire', 'Royal Borough of Windsor and Maidenhead': 'Berkshire', 'Metropolitan Borough of Wirral': 'Merseyside',
  'Wokingham': 'Berkshire', 'Wolverhampton': 'West Midlands', 'Worcestershire': 'Worcestershire', 'City of York': 'North Yorkshire',
  'West Northamptonshire': 'Northamptonshire', 'Bedford': 'Bedfordshire', 'Central Bedfordshire': 'Bedfordshire', 'Cheshire East': 'Cheshire',
  'Cheshire West and Chester': 'Cheshire',
};
const ENG_ALL = ['Bedfordshire', 'Berkshire', 'Bristol', 'Buckinghamshire', 'Cambridgeshire', 'Cheshire', 'Cornwall', 'County Durham', 'Cumbria',
  'Derbyshire', 'Devon', 'Dorset', 'East Riding of Yorkshire', 'East Sussex', 'Essex', 'Gloucestershire', 'Greater London', 'Greater Manchester',
  'Hampshire', 'Herefordshire', 'Hertfordshire', 'Isle of Wight', 'Kent', 'Lancashire', 'Leicestershire', 'Lincolnshire', 'Merseyside', 'Norfolk',
  'North Yorkshire', 'Northamptonshire', 'Northumberland', 'Nottinghamshire', 'Oxfordshire', 'Rutland', 'Shropshire', 'Somerset', 'South Yorkshire',
  'Staffordshire', 'Suffolk', 'Surrey', 'Tyne and Wear', 'Warwickshire', 'West Midlands', 'West Sussex', 'West Yorkshire', 'Wiltshire', 'Worcestershire'];
const tidyUK = (n) => n.replace(/^(City and County of|City of|County of|The) /, '').replace(/ (City|county borough|County Borough)$/, '')
  .replace(/^Sir /, '').replace(/^Eilean Siar$/, 'Western Isles')
  .replace(/^Armagh City Banbridge and Craigavon$/, 'Armagh Banbridge and Craigavon').trim();
const IE_BY_CODE = { 'C.10': 'Galway', 'C.36': 'Galway', 'C.14': 'Leitrim', 'C.20': 'Mayo', 'C.24': 'Roscommon', 'C.25': 'Sligo', 'L.01': 'Carlow',
  'L.12': 'Kildare', 'L.13': 'Kilkenny', 'L.15': 'Laois', 'L.18': 'Longford', 'L.19': 'Louth', 'L.21': 'Meath', 'L.23': 'Offaly', 'L.29': 'Westmeath',
  'L.30': 'Wexford', 'L.31': 'Wicklow', 'L.33': 'Dublin', 'L.34': 'Dublin', 'L.35': 'Dublin', 'L.39': 'Dublin', 'M.03': 'Clare', 'M.04': 'Cork',
  'M.32': 'Cork', 'M.11': 'Kerry', 'M.26': 'Tipperary', 'M.42': 'Limerick', 'M.44': 'Waterford', 'U.02': 'Cavan', 'U.06': 'Donegal', 'U.22': 'Monaghan' };
const UK_GROUP = { ENG: 'England', SCT: 'Scotland', WLS: 'Wales', NIR: 'Northern Ireland' };

// every region a country offers (even ones with no 15,000+ town), as [name, group]
function regionsOf(cc) {
  if (cc === 'GB') {
    const out = ENG_ALL.map((n) => [n, 'England']);
    for (const [k, n] of Object.entries(A2)) {
      const m = k.match(/^GB\.(SCT|WLS|NIR)\./); if (m) out.push([tidyUK(n), UK_GROUP[m[1]]]);
    }
    return out;
  }
  if (cc === 'IE') return [...new Set(Object.values(IE_BY_CODE))].map((n) => [n, '']);
  return Object.entries(A1).filter(([k]) => k.startsWith(cc + '.')).map(([, n]) => [tidyA1(n), '']);
}
function regionOfRow(c) {
  const cc = c[8], a1 = c[10], a2 = c[11];
  if (cc === 'GB') {
    const n = A2[`GB.${a1}.${a2}`]; if (!n) return '';
    return a1 === 'ENG' ? (ENG[n] || '') : tidyUK(n);
  }
  if (cc === 'IE') return IE_BY_CODE[`${a1}.${a2}`] || '';
  const n = A1[`${cc}.${a1}`]; return n ? tidyA1(n) : '';
}

// ---- towns: city-level places of 15,000+, minus neighbourhoods inside a big city ----
const KEEP = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLA5', 'PPLC', 'PPLG', 'PPLS', 'PPLL']);
const rows = read('cities15000.txt').filter((c) => c.length >= 15);
const big = rows.filter((c) => Number(c[14]) >= 600000).map((c) => ({ cc: c[8], a1: c[10], lat: +c[4], lon: +c[5], name: c[1] }));
const km = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.hypot(x, y) * 6371; };
// plain display text only: no digits, no separators the sheet or the page would trip over
const BAD = /[0-9<>{}\[\]@#/\\:;"=+_|~`^*%$&·,]/;
const ANSWERS = ['clever', 'solvers', 'triumph', 'lantern'];
const shift = (w, k) => w.replace(/[a-z]/g, (ch) => String.fromCharCode((ch.charCodeAt(0) - 97 + k + 26) % 26 + 97));
const LEAKS = ANSWERS.flatMap((w) => [w, shift(w, 3), shift(w, -3)]);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const leaky = (s) => LEAKS.some((w) => fold(s).includes(w));
const okName = (n) => n && n.length <= 40 && !BAD.test(n) && !/^['\- ]/.test(n) && !leaky(n);

const out = {}; let dropped = { hood: 0, bad: 0, leak: 0 };
for (const c of rows) {
  const name = (c[1] || '').normalize('NFC').trim(), code = c[7], cc = c[8], pop = Number(c[14]);
  if (!KEEP.has(code) || !/^[A-Z]{2}$/.test(cc)) continue;
  if (leaky(name)) { dropped.leak++; continue; }
  if (!okName(name)) { dropped.bad++; continue; }
  if (code === 'PPL' && pop < 100000 && big.some((b) => b.cc === cc && b.a1 === c[10] && b.name !== name && km(b.lat, b.lon, +c[4], +c[5]) < 10)) { dropped.hood++; continue; }
  const o = (out[cc] ||= { towns: {}, xy: {} });
  const reg = LEVEL[cc] ? regionOfRow(c) : '';
  ((o.towns[reg] ||= new Set())).add(name);
  const key = reg + '|' + name; if (!o.xy[key]) o.xy[key] = [Math.round(+c[4] * 100) / 100, Math.round(+c[5] * 100) / 100];   // [lat, lon] for the globe's pins
}
const pub = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pubDir = path.join(pub, 'public', 'data', 'places2');
fs.mkdirSync(pubDir, { recursive: true });
for (const f of fs.readdirSync(pubDir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(pubDir, f));
const server = {}, centroids = {}; const sortEn = (a, b) => a.localeCompare(b, 'en');
for (const cc of Object.keys(out).sort()) {
  const lv = LEVEL[cc];
  let regions = [];
  if (lv) {
    const seen = new Map();
    for (const [n, g] of regionsOf(cc)) { if (okName(n) && !seen.has(n)) seen.set(n, g); else if (!okName(n)) console.warn('region skipped', cc, n); }
    regions = [...seen.entries()].sort((a, b) => (a[1] === b[1] ? 0 : a[1] < b[1] ? -1 : 1) || sortEn(a[0], b[0]));
    for (const k of Object.keys(out[cc].towns)) if (k && !seen.has(k)) { console.warn('town region not offered', cc, k); (out[cc].towns[''] ||= new Set()); for (const t of out[cc].towns[k]) { out[cc].towns[''].add(t); out[cc].xy['|' + t] ||= out[cc].xy[k + '|' + t]; } delete out[cc].towns[k]; }
  }
  const towns = Object.fromEntries(Object.entries(out[cc].towns).map(([k, s]) => [k, [...s].sort(sortEn)]));
  // positions for the Keeper's globe: each town (aligned with towns[region]), each region's middle (mean of its
  // towns) and the country's middle. Pins never go finer than a town of 15,000+.
  const tc = {}, rc = {}; let sumLat = 0, sumLon = 0, nAll = 0;
  for (const [k, list] of Object.entries(towns)) {
    tc[k] = list.map((t) => out[cc].xy[k + '|' + t] || [0, 0]);
    if (k && tc[k].length) rc[k] = [+(tc[k].reduce((a, p) => a + p[0], 0) / tc[k].length).toFixed(2), +(tc[k].reduce((a, p) => a + p[1], 0) / tc[k].length).toFixed(2)];
    tc[k].forEach(([la, lo]) => { sumLat += la; sumLon += lo; nAll++; });
  }
  // the country's middle for its globe pin: the MEDIAN town position, so far-off islands don't drag it into the sea
  const allXY = Object.values(tc).flat(), med = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };
  let c = nAll ? [+med(allXY.map((p) => p[0])).toFixed(2), +med(allXY.map((p) => p[1])).toFixed(2)] : [0, 0];
  // snap to the real town nearest that point, so an island or crescent-shaped country never gets a pin in the sea
  if (allXY.length) { let best = allXY[0], bd = 1e9; for (const p of allXY) { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; best = p; } } c = best; }
  centroids[cc] = c;
  const file = { label: lv ? lv.label : '', req: !!(lv && lv.req), regions: regions.map(([n, g]) => (g ? [n, g] : [n])), towns, tc, rc, c };
  fs.writeFileSync(path.join(pubDir, cc + '.json'), JSON.stringify(file));
  server[cc] = { req: file.req, r: regions.map(([n]) => n), t: towns };
}
fs.writeFileSync(path.join(pubDir, 'index.json'), JSON.stringify(Object.keys(server)));
fs.writeFileSync(path.join(pubDir, 'centroids.json'), JSON.stringify(centroids));   // one pin spot per country, for the globe's visitor pins
fs.writeFileSync(path.join(pub, 'src', 'data', 'visitor-places2.json'), JSON.stringify(server));
const n = (cc) => Object.values(server[cc]?.t || {}).reduce((a, b) => a + b.length, 0);
const where = (cc, town) => Object.entries(server[cc].t).filter(([, l]) => l.includes(town)).map(([k]) => k || '(none)').join('/');
console.log(`countries ${Object.keys(server).length} · dropped ${JSON.stringify(dropped)}`);
for (const cc of ['US', 'CA', 'AU', 'GB', 'IE', 'DE', 'NL', 'FR', 'NZ']) console.log(cc, 'regions', server[cc].r.length, 'towns', n(cc), 'unregioned', (server[cc].t[''] || []).length);
console.log('Buffalo→', where('US', 'Buffalo'), '· Telford→', where('GB', 'Telford'), '· Shrewsbury→', where('GB', 'Shrewsbury'), '· Birmingham→', where('GB', 'Birmingham'), '· Toronto→', where('CA', 'Toronto'), '· Dublin→', where('IE', 'Dublin'));
