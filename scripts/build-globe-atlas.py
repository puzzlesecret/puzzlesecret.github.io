"""Build the Keeper's globe atlas (Dan, 2026-11-15: "land in greens and browns, water in blues... zoom in and see
countries, states and cities"). Everything is Natural Earth (public domain; credited in the close-up).

  python site/scripts/build-globe-atlas.py reference/pinpoint-room/naturalearth

Inputs (in that folder):
  raster/HYP_50M_SR_W.tif                         cross-blended hypsometric tints + shaded relief + water, 10800x5400
  ne_50m_lakes.geojson                            lakes, painted in (the raster's lakes are nearly land-coloured)
  ne_50m_admin_0_boundary_lines_land.geojson      country borders on land (international boundaries only)
  ne_10m_admin_1_states_provinces_lines.geojson   state / province lines (large countries only)
  ne_10m_populated_places_simple.geojson          cities
  ne_110m_admin_0_countries.geojson               country name label points
Outputs (site/public/data/globe/):
  atlas-2k.webp, atlas-4k.webp, atlas-8k.webp     equirectangular paint (room: 2k phones / 4k desktop; close-up 4k / 8k)
  borders.json, states.json                       {"l":[[lon*100,lat*100, ...], ...]} simplified, densified polylines
  cities.json                                     {"c":[[name, lat*100, lon*100, rank]], "n":[[country, lat*100, lon*100, rank]]}
Choices made after the 2026-11-15 critiques: disputed / indefinite / line-of-control borders are left out (a kids' site
shouldn't rule on them), capitals aren't marked (some are contested), state lines only for a few large countries (the
UK's and France's counties cluttered Europe), every line segment is cut to 1 degree or less (a long straight chord dips
under the globe and is hidden).
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageEnhance
Image.MAX_IMAGE_PIXELS = None

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'data', 'globe')
os.makedirs(out, exist_ok=True)
load = lambda n: json.load(open(os.path.join(src, n), encoding='utf-8'))

# ---- paint: the raster, with the lakes painted the colour of the nearby sea, and a touch more colour
im = Image.open(os.path.join(src, 'raster', 'HYP_50M_SR_W.tif')).convert('RGB')
W, H = im.size
X = lambda lon: (lon + 180) / 360 * W
Y = lambda lat: (90 - lat) / 180 * H
mask = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(mask)
LAKE = (112, 160, 200)
for f in load('ne_50m_lakes.geojson')['features']:
    g = f['geometry']
    if not g: continue
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        outer = [(X(x), Y(y)) for x, y in poly[0]]
        if len(outer) >= 3: draw.polygon(outer, fill=255)
        for hole in poly[1:]:                                     # islands in lakes stay land
            if len(hole) >= 3: draw.polygon([(X(x), Y(y)) for x, y in hole], fill=0)
im.paste(Image.new('RGB', (W, H), LAKE), (0, 0), mask)
im = ImageEnhance.Color(im).enhance(1.12)
for w, q in ((2048, 82), (4096, 80), (8192, 78)):
    r = im.resize((w, w // 2), Image.LANCZOS)
    p = os.path.join(out, 'atlas-%dk.webp' % (w // 1024))
    r.save(p, 'WEBP', quality=q, method=6)
    print(os.path.basename(p), round(os.path.getsize(p) / 1e6, 2), 'MB')

# ---- lines
def rdp(pts, eps):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-12
        best, bi = -1, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
            if d > best: best, bi = d, i
        if best > eps: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def densify(pts, step=1.0):
    outp = [pts[0]]
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        n = int(math.hypot(x2 - x1, y2 - y1) // step)
        for k in range(1, n + 1): outp.append((x1 + (x2 - x1) * k / (n + 1), y1 + (y2 - y1) * k / (n + 1)))
        outp.append((x2, y2))
    return outp

def lines(path, eps, ok=lambda p: True):
    res = []
    for f in load(path)['features']:
        if not ok(f['properties']): continue
        g = f['geometry']
        if not g: continue
        parts = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for part in parts:
            s = rdp([tuple(c[:2]) for c in part], eps)
            if len(s) < 2: continue
            flat = []
            for x, y in densify(s): flat += [round(x * 100), round(y * 100)]
            res.append(flat)
    return res

B = lines('ne_50m_admin_0_boundary_lines_land.geojson', 0.02, lambda p: p.get('FEATURECLA') == 'International boundary (verify)')
json.dump({'l': B}, open(os.path.join(out, 'borders.json'), 'w'), separators=(',', ':'))
STATES = {'USA', 'CAN', 'AUS', 'BRA', 'MEX', 'IND', 'CHN', 'RUS', 'ARG', 'DEU', 'ZAF'}
S = lines('ne_10m_admin_1_states_provinces_lines.geojson', 0.03, lambda p: p.get('ADM0_A3') in STATES)
json.dump({'l': S}, open(os.path.join(out, 'states.json'), 'w'), separators=(',', ':'))
for n in ('borders.json', 'states.json'):
    print(n, round(os.path.getsize(os.path.join(out, n)) / 1e6, 2), 'MB')

# ---- names: cities by Natural Earth's scalerank (0 = shown first); countries by their label rank
C = []
for f in load('ne_10m_populated_places_simple.geojson')['features']:
    p = f['properties']
    rk = int(p.get('scalerank') or 10)
    if rk > 6 and not p.get('adm0cap'): continue
    C.append([p.get('nameascii') or p['name'], round(p['latitude'] * 100), round(p['longitude'] * 100), min(rk, 10)])
C.sort(key=lambda c: c[3])
N = []
for f in load('ne_110m_admin_0_countries.geojson')['features']:
    p = f['properties']
    if p.get('LABEL_X') is None: continue
    N.append([p.get('NAME_EN') or p['NAME'], round(p['LABEL_Y'] * 100), round(p['LABEL_X'] * 100), int(p.get('LABELRANK') or 9)])
N.sort(key=lambda c: c[3])
json.dump({'c': C, 'n': N}, open(os.path.join(out, 'cities.json'), 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print('cities.json', len(C), 'cities', len(N), 'countries', round(os.path.getsize(os.path.join(out, 'cities.json')) / 1e3), 'KB')
