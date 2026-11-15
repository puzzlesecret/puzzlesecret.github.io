/* The Keeper's globe, close up (Dan, 2026-11-15): tap the globe in either study and it opens here, big, to spin and
   zoom. The paint is Natural Earth's cross-blended hypsometric tints (greens, browns, ice and blue seas; public
   domain), with the lakes painted in; country borders are drawn as lines, so they stay crisp however close you go;
   country names, then state / province lines (large countries only) and city names come in as you zoom. The same pins
   as the room's globe, each tappable. Loaded only when someone opens it (vault3d.js imports it on demand) and torn
   down on close, so phones get their memory back. Everything shown is set with textContent, never innerHTML.
   Reviewed by three critics on 2026-11-15 (UX, code, risk); their fixes are folded in below.

   openGlobeCloseup({ pins: [{ lat, lon, kind: 'visit'|'signer'|'home'|'dot', n, line }], center: [lat, lon],
                      title, hint, reduced, onClose }) */
import * as THREE from 'three';

const R = 1, Y_UP = new THREE.Vector3(0, 1, 0);
// same mapping as the room globe (vault3d.js) and SphereGeometry's UVs: longitude 0 on +X, east toward -Z
const vec = (lat, lon, r = R, out = new THREE.Vector3()) => {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  return out.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
};
const CSS = `
#globeView{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(ellipse at center,#1d1710 0%,#0b0907 75%);touch-action:none;user-select:none;-webkit-user-select:none}
#globeView[hidden]{display:none}
#globeView canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}
#globeView canvas.grab{cursor:grabbing}
#globeView .gv-top{position:absolute;z-index:3;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px 0;pointer-events:none}
#globeView .gv-top>div{background:rgba(20,14,8,.8);border:1px solid rgba(201,161,74,.35);border-radius:10px;padding:8px 12px;max-width:min(520px,calc(100% - 70px))}
#globeView .gv-title{font:600 13px/1.3 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#e7cf9a}
#globeView .gv-hint{font:italic 13px/1.35 Georgia,serif;color:#d8c59b;margin-top:4px}
#globeView .gv-credit{font:11px/1.3 Georgia,serif;color:#a8977a;margin-top:4px}
#globeView button{pointer-events:auto;font:600 20px/1 Georgia,serif;color:#2a1a06;background:linear-gradient(#e2c27a,#b48a3c);border:1px solid #6a4a18;border-radius:999px;width:44px;height:44px;box-shadow:0 2px 6px rgba(0,0,0,.5);cursor:pointer}
#globeView button:focus-visible{outline:2px solid #fff3c4;outline-offset:2px}
#globeView .gv-zoom{position:absolute;z-index:3;right:16px;bottom:96px;display:flex;flex-direction:column;gap:10px}
#globeView .gv-say{position:absolute;z-index:3;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(560px,calc(100% - 32px));padding:10px 14px;border-radius:10px;background:rgba(20,14,8,.85);border:1px solid rgba(201,161,74,.45);font:15px/1.4 Georgia,serif;color:#f1e3c2;text-align:center}
#globeView .gv-say:empty{display:none}
#globeView .gv-labels{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
#globeView .gv-lab{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}
#globeView .gv-city{font:12px/1 Georgia,serif;color:#1d140b;text-shadow:0 0 3px #f6efdc,0 0 3px #f6efdc,0 0 2px #f6efdc}
#globeView .gv-city::before{content:'';display:inline-block;width:5px;height:5px;margin-right:4px;border-radius:50%;background:#3a2410;border:1px solid #f6efdc;vertical-align:1px}
#globeView .gv-country{font:600 11px/1 Georgia,serif;letter-spacing:.18em;text-transform:uppercase;color:#3a2410;text-shadow:0 0 3px #f3ead2,0 0 3px #f3ead2}
#globeView .gv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:600px){#globeView .gv-zoom{bottom:110px}#globeView .gv-city{font-size:11px}#globeView .gv-country{font-size:10px}}
`;

let open = null;
export function globeCloseupOpen() { return !!open; }
export function closeGlobeCloseup() { if (open) open.close(); }

export function openGlobeCloseup(opts = {}) {
  if (open) return;
  // the renderer first: if WebGL won't start (memory pressure on a phone), nothing is left over the vault
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  let alive = true;
  const abort = new AbortController();
  if (!document.getElementById('gvCss')) { const s = document.createElement('style'); s.id = 'gvCss'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.id = 'globeView'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', opts.title || 'The Keeper’s globe');
  root.appendChild(canvas);
  canvas.setAttribute('aria-hidden', 'true');
  const labels = document.createElement('div'); labels.className = 'gv-labels'; root.appendChild(labels);
  const top = document.createElement('div'); top.className = 'gv-top';
  const tbox = document.createElement('div');
  const tt = document.createElement('div'); tt.className = 'gv-title'; tt.textContent = opts.title || 'The Keeper’s globe'; tbox.appendChild(tt);
  const th = document.createElement('div'); th.className = 'gv-hint'; th.textContent = opts.hint || 'Drag to turn it. Scroll, pinch or use + and − to look closer.'; tbox.appendChild(th);
  const tc = document.createElement('div'); tc.className = 'gv-credit'; tc.textContent = 'Maps: Natural Earth'; tbox.appendChild(tc);
  const closeB = document.createElement('button'); closeB.type = 'button'; closeB.textContent = '×'; closeB.setAttribute('aria-label', 'Close the globe');
  top.appendChild(tbox); top.appendChild(closeB); root.appendChild(top);
  const zoom = document.createElement('div'); zoom.className = 'gv-zoom';
  const zin = document.createElement('button'); zin.type = 'button'; zin.textContent = '+'; zin.setAttribute('aria-label', 'Zoom in');
  const zout = document.createElement('button'); zout.type = 'button'; zout.textContent = '−'; zout.setAttribute('aria-label', 'Zoom out');
  zoom.appendChild(zin); zoom.appendChild(zout); root.appendChild(zoom);
  const say = document.createElement('div'); say.className = 'gv-say'; say.setAttribute('role', 'status'); say.setAttribute('aria-live', 'polite'); root.appendChild(say);
  // for screen readers: every pin's line, in a list
  const sr = document.createElement('ul'); sr.className = 'gv-sr'; sr.setAttribute('aria-label', 'Pins on the globe');
  for (const p of opts.pins || []) if (p.line) { const li = document.createElement('li'); li.textContent = p.line; sr.appendChild(li); }
  root.appendChild(sr);
  const before = document.activeElement;
  document.body.appendChild(root);
  root.hidden = false;   // a 'hidden' change: the vault's Back-button guard (vault.astro) sees it open, like its own panels

  const touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const reduced = !!opts.reduced;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touchy ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0); camera.add(sun); sun.position.set(-1.5, 1.2, 1); scene.add(camera);
  const disposables = [];
  const getJSON = (url) => fetch(url, { signal: abort.signal }).then((x) => x.json());

  // ---- the paint: 4k (sharp enough on a phone), then 8k on a big desktop with memory to spare
  const maxTex = renderer.capabilities.maxTextureSize;
  const mat = new THREE.MeshLambertMaterial({ color: 0x7aa6cf });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), mat);
  scene.add(sphere); disposables.push(sphere.geometry, mat);
  const loader = new THREE.TextureLoader();
  const useTex = (t) => {
    if (!alive) { t.dispose(); return false; }
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const old = mat.map; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; disposables.push(t); dirty = true;
    if (old) old.dispose();
    return true;
  };
  const big = maxTex >= 8192 && !touchy && (!navigator.deviceMemory || navigator.deviceMemory >= 8);
  loader.load(maxTex >= 4096 ? '/data/globe/atlas-4k.webp' : '/data/globe/atlas-2k.webp', (t) => {
    if (useTex(t) && big) loader.load('/data/globe/atlas-8k.webp', useTex);
  });

  // ---- lines: borders always; states (large countries only) fetched the first time you zoom in near them
  const lineGroup = (url, r, color, opacity) => {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    disposables.push(m);
    const obj = { mat: m, base: opacity, mesh: null, asked: false };
    obj.load = () => {
      if (obj.asked) return; obj.asked = true;
      getJSON(url).then((d) => {
        if (!alive || !d || !Array.isArray(d.l)) return;
        const pos = [], a = new THREE.Vector3(), b = new THREE.Vector3();
        for (const l of d.l) for (let i = 0; i + 3 < l.length; i += 2) {
          vec(l[i + 1] / 100, l[i] / 100, r, a); vec(l[i + 3] / 100, l[i + 2] / 100, r, b);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        obj.mesh = new THREE.LineSegments(g, m); obj.mesh.renderOrder = 2; scene.add(obj.mesh); disposables.push(g); dirty = true;
      }).catch(() => { obj.asked = false; });
    };
    return obj;
  };
  const borders = lineGroup('/data/globe/borders.json', R * 1.0012, 0x3b2414, 0.85); borders.load();
  const states = lineGroup('/data/globe/states.json', R * 1.0009, 0x5a4636, 0.55);

  // ---- names: countries at a distance, cities as you come closer
  let cities = [], countries = [];
  getJSON('/data/globe/cities.json').then((d) => {
    if (!alive || !d) return;
    if (Array.isArray(d.c)) cities = d.c.map(([name, la, lo, rk]) => ({ name: String(name), p: vec(la / 100, lo / 100), rk }));
    if (Array.isArray(d.n)) countries = d.n.map(([name, la, lo, rk]) => ({ name: String(name), p: vec(la / 100, lo / 100), rk }));
    dirty = true;
  }).catch(() => {});

  // ---- pins (the room's own, passed in)
  const pinGeo = new THREE.SphereGeometry(1, 14, 10), shaftGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6);
  disposables.push(pinGeo, shaftGeo);
  const pinMats = {
    visit: new THREE.MeshLambertMaterial({ color: 0xb4602c, emissive: 0x2a1006 }),
    signer: new THREE.MeshLambertMaterial({ color: 0xe0b24e, emissive: 0x3a2608 }),
    home: new THREE.MeshLambertMaterial({ color: 0xb0201a, emissive: 0x3a0604 }),
    dot: new THREE.MeshLambertMaterial({ color: 0x7a2a16, emissive: 0x2a0a04 }),
    iron: new THREE.MeshLambertMaterial({ color: 0x2c241c }),
  };
  Object.values(pinMats).forEach((m) => disposables.push(m));
  const pins = [];
  for (const p of opts.pins || []) {
    if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
    const g = new THREE.Group(), n = vec(p.lat, p.lon, 1);
    g.position.copy(n).multiplyScalar(R); g.quaternion.setFromUnitVectors(Y_UP, n);
    const h = p.kind === 'home' ? 0.05 : 0.032;
    const shaft = new THREE.Mesh(shaftGeo, pinMats.iron); shaft.scale.y = h; shaft.position.y = h / 2; g.add(shaft);
    const s = p.kind === 'visit' || p.kind === 'dot' ? Math.min(0.013, 0.006 + 0.0016 * Math.log2(1 + (p.n || 1))) : p.kind === 'home' ? 0.012 : 0.01;
    const head = new THREE.Mesh(pinGeo, pinMats[p.kind] || pinMats.visit); head.scale.setScalar(s); head.position.y = h; g.add(head);
    g.userData = p; g.userData.head = head; scene.add(g); pins.push(g);
  }

  // ---- camera: orbit around the globe; dist = distance from the centre in globe radii
  const cen = opts.center || [30, -30];
  const MIN = 1.2, MAX = 4.6;
  const fit = () => {   // far enough that the whole globe fits the narrow side of the screen
    const w = root.clientWidth, h = root.clientHeight, vf = (w < h ? 60 : 40) * Math.PI / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * w / h), f = Math.min(vf, hf);
    return THREE.MathUtils.clamp(R / Math.sin(f / 2 * 0.9), 2.2, MAX);
  };
  const view = { lat: cen[0], lon: cen[1], dist: 3, tLat: cen[0], tLon: cen[1], tDist: 3 };
  let dirty = true;
  function place() { camera.position.copy(vec(view.lat, view.lon, view.dist)); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); }
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 60 : 40; camera.updateProjectionMatrix(); dirty = true;
  }
  addEventListener('resize', resize); resize();
  view.dist = view.tDist = fit();

  // ---- labels: biggest first; more as you come closer; never on top of each other, a pin, or the buttons
  const pool = [], tmp = new THREE.Vector3();
  function labelsUpdate() {
    const w = root.clientWidth, h = root.clientHeight, camDir = tmp.copy(camera.position).normalize().clone();
    const d = view.dist, horizon = R * R / d + 0.04;
    const maxRank = d > 2.6 ? 1 : d > 2.1 ? 2 : d > 1.7 ? 3 : d > 1.45 ? 4 : d > 1.3 ? 6 : 10;
    const taken = [];
    // keep the corner with the + and − buttons clear, and the title box
    taken.push([w - 76, h - 220, 76, 220], [0, 0, Math.min(540, w), 96]);
    for (const p of pins) {
      const v = p.getWorldPosition(tmp).project(camera);
      taken.push([(v.x + 1) / 2 * w - 8, (1 - v.y) / 2 * h - 8, 16, 16]);
    }
    let k = 0;
    const put = (text, cls, x, y) => {
      let el = pool[k];
      if (!el) { el = document.createElement('div'); labels.appendChild(el); pool.push(el); }
      if (el.textContent !== text) el.textContent = text;
      if (el.className !== 'gv-lab ' + cls) el.className = 'gv-lab ' + cls;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; el.style.display = '';
      k++;
    };
    const tryLab = (c, cls, cw, centred) => {
      if (c.p.dot(camDir) < horizon) return;                            // beyond the horizon from here
      const v = tmp.copy(c.p).project(camera);
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      const bw = 12 + c.name.length * cw, bh = 18, x0 = centred ? x - bw / 2 : x - 3;
      if (x0 < 4 || x0 + bw > w - 4 || y < 8 || y > h - 8) return;
      if (taken.some((r) => x0 < r[0] + r[2] && x0 + bw > r[0] && y - bh / 2 < r[1] + r[3] && y + bh / 2 > r[1])) return;
      taken.push([x0, y - bh / 2, bw, bh]);
      put(c.name, cls, x0, y - 6);
    };
    // country names at a distance (gone once the cities take over)
    if (d > 1.5) for (const c of countries) { if (c.rk > (d > 2.6 ? 3 : d > 2 ? 5 : 7)) continue; tryLab(c, 'gv-country', 11, true); if (k >= 40) break; }
    const cap = touchy ? 45 : 90;
    for (const c of cities) { if (k >= cap) break; if (c.rk > maxRank) continue; tryLab(c, 'gv-city', 6.6, false); }
    for (let i = k; i < pool.length; i++) pool[i].style.display = 'none';
  }

  // ---- input
  const ptrs = new Map();
  let drag = null, pinch = null, vel = { lat: 0, lon: 0 }, lastMove = 0, lastTap = 0;
  const degPerPx = () => (view.dist - R) * 70 / Math.max(260, Math.min(root.clientWidth, root.clientHeight));
  const startDrag = (x, y) => { drag = { x, y, sx: x, sy: y, moved: false }; vel = { lat: 0, lon: 0 }; };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: view.tDist }; drag = null; }
    else startDrag(e.clientX, e.clientY);
    canvas.classList.add('grab');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; setDist(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    const k = degPerPx();
    view.tLon -= dx * k; view.tLat = THREE.MathUtils.clamp(view.tLat + dy * k, -80, 80);
    view.lon = view.tLon; view.lat = view.tLat;
    const now = performance.now(), dt = Math.max(8, now - lastMove); lastMove = now;
    vel = { lon: -dx * k / dt * 1000 * 0.5 + vel.lon * 0.5, lat: dy * k / dt * 1000 * 0.5 + vel.lat * 0.5 };
    dirty = true;
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (!ptrs.size) canvas.classList.remove('grab');
    if (pinch) {
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 1) { const [p] = [...ptrs.values()]; startDrag(p.x, p.y); drag.moved = true; }   // the other finger keeps turning it
      return;
    }
    if (!drag) return;
    const d = drag; drag = null;
    if (reduced || performance.now() - lastMove > 120) vel = { lat: 0, lon: 0 };
    if (!d.moved && e.type === 'pointerup') {
      const now = performance.now();
      if (now - lastTap < 320) { lastTap = 0; return; }                   // the second half of a double-click: that zooms
      lastTap = now; tap(e.clientX, e.clientY);
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
    setDist(view.tDist * Math.exp(px * 0.0015));
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => { const p = surfaceAt(e.clientX, e.clientY); if (p) { view.tLat = p.lat; view.tLon = p.lon; } setDist(view.tDist * 0.6); });
  zin.addEventListener('click', () => setDist(view.tDist * 0.7));
  zout.addEventListener('click', () => setDist(view.tDist / 0.7));
  closeB.addEventListener('click', () => close());
  const focusables = [closeB, zin, zout];
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {   // keep keyboard focus inside the globe while it is open
      const i = focusables.indexOf(document.activeElement);
      const n = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i + 1) % focusables.length;
      focusables[n].focus(); e.preventDefault(); e.stopPropagation(); return;
    }
    if (e.key === '+' || e.key === '=') setDist(view.tDist * 0.8);
    else if (e.key === '-' || e.key === '_') setDist(view.tDist / 0.8);
    else if (e.key.startsWith('Arrow')) {
      const k = degPerPx() * 30;
      if (e.key === 'ArrowLeft') view.tLon -= k; if (e.key === 'ArrowRight') view.tLon += k;
      if (e.key === 'ArrowUp') view.tLat = Math.min(80, view.tLat + k); if (e.key === 'ArrowDown') view.tLat = Math.max(-80, view.tLat - k);
    } else return;
    e.preventDefault(); e.stopPropagation(); dirty = true;
  };
  addEventListener('keydown', onKey, true);
  function setDist(d) { view.tDist = THREE.MathUtils.clamp(d, MIN, MAX); dirty = true; if (d < 2.4) states.load(); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function surfaceAt(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(sphere); if (!h.length) return null;
    const p = h[0].point.clone().normalize();
    return { lat: Math.asin(p.y) * 180 / Math.PI, lon: Math.atan2(-p.z, p.x) * 180 / Math.PI };
  }
  // a tap picks the nearest pin head on screen (within a finger's width), however small the pin is drawn
  function tap(x, y) {
    const r = canvas.getBoundingClientRect(), camDir = camera.position.clone().normalize();
    let best = null, bd = touchy ? 26 : 16;
    for (const g of pins) {
      if (g.position.dot(camDir) < R * R / view.dist) continue;          // on the far side
      const v = g.userData.head.getWorldPosition(tmp).project(camera);
      const dd = Math.hypot(r.left + (v.x + 1) / 2 * r.width - x, r.top + (1 - v.y) / 2 * r.height - y);
      if (dd < bd) { bd = dd; best = g; }
    }
    say.textContent = best ? best.userData.line || '' : '';
  }

  // ---- loop (paused while the tab is hidden)
  let raf = 0, last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag && !reduced && (Math.abs(vel.lon) > 0.05 || Math.abs(vel.lat) > 0.05)) {
      view.tLon += vel.lon * dt; view.tLat = THREE.MathUtils.clamp(view.tLat + vel.lat * dt, -80, 80);
      const f = Math.exp(-3.5 * dt); vel.lon *= f; vel.lat *= f; dirty = true;
    }
    const e = reduced ? 1 : 1 - Math.exp(-10 * dt);
    const dl = view.tLon - view.lon, dla = view.tLat - view.lat, dd = view.tDist - view.dist;
    if (Math.abs(dl) + Math.abs(dla) + Math.abs(dd) > 1e-4) { view.lon += dl * e; view.lat += dla * e; view.dist += dd * e; dirty = true; }
    if (!dirty) return;
    dirty = false;
    // states fade in from a medium zoom; pins shrink as you come close, so they never smother a town
    const sOp = THREE.MathUtils.clamp((2.3 - view.dist) / 0.6, 0, 1);
    states.mat.opacity = states.base * sOp; if (states.mesh) states.mesh.visible = sOp > 0.01;
    const ps = THREE.MathUtils.clamp((view.dist - R) / 1.9, 0.08, 1);
    for (const p of pins) p.scale.setScalar(ps);
    place();
    renderer.render(scene, camera);
    labelsUpdate();
  }
  raf = requestAnimationFrame(frame);
  closeB.focus({ preventScroll: true });

  function close() {
    if (!open) return;
    open = null; alive = false; abort.abort();
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize); removeEventListener('keydown', onKey, true);
    disposables.forEach((x) => { try { x.dispose(); } catch (err) { /* already gone */ } });
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (err) { /* fine */ }
    root.hidden = true;                       // the Back-button guard sees it close and pops its history entry quietly
    setTimeout(() => root.remove(), 60);
    if (window.__globeClose === close) window.__globeClose = null;
    try { if (before && before.focus) before.focus({ preventScroll: true }); } catch (err) { /* fine */ }
    if (opts.onClose) opts.onClose();
  }
  open = { close };
  window.__globeClose = close;                // the vault's Back-button guard closes it through here
  // test hook (local debugging only): read the view
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.__globeView = { view, setDist, tap, root, pins, camera };
}
