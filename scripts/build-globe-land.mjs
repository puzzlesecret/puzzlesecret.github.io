// Builds the coastline data for the Keeper's globe in the PinPoint study (Dan, 2026-11-14).
//
//   node scripts/build-globe-land.mjs <path to Natural Earth land-50m.json (TopoJSON, world-atlas@2.0.2)>
//
// Natural Earth is public domain. The globe's map is DRAWN in code from this data (ink on parchment) —
// not an image. Coastlines only: no country borders, so no disputed borders.
// Writes public/data/globe-land.json: { rings: [[lon10, lat10, lon10, lat10, ...], ...] } (tenths of a degree).
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node scripts/build-globe-land.mjs <land-50m.json>'); process.exit(1); }
const topo = JSON.parse(fs.readFileSync(src, 'utf8'));
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
// decode delta-encoded, quantized arcs to absolute lon/lat
const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const arcPts = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
const rings = [];
const geom = topo.objects.land.geometries || [topo.objects.land];
for (const g of geom) {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  for (const poly of polys) for (const ring of poly) {
    const pts = [];
    ring.forEach((ai, k) => { const p = arcPts(ai); pts.push(...(k ? p.slice(1) : p)); });
    // thin to ~0.15° spacing — the 2048 px texture is ~0.18°/px, so nothing visible is lost
    const out = []; let lx = 1e9, ly = 1e9;
    for (const [x, y] of pts) if (Math.hypot(x - lx, y - ly) >= 0.15) { out.push(Math.round(x * 10), Math.round(y * 10)); lx = x; ly = y; }
    if (out.length >= 6) rings.push(out);
  }
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dst = path.join(root, 'public', 'data', 'globe-land.json');
fs.writeFileSync(dst, JSON.stringify({ rings }));
console.log('rings', rings.length, 'points', rings.reduce((n, r) => n + r.length / 2, 0), 'bytes', fs.statSync(dst).size);
