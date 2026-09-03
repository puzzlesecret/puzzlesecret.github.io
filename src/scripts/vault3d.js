// THE 3D VAULT CRAWL — loaded on demand by vault.astro ONLY when the visitor chooses the 3D
// mode (the default is the painted vault, public/js/painted-vault.js). Split out of the page
// on 2026-09-02 so the painted path never downloads three.js. Nothing inside changed.
import * as THREE from 'three';

/* ================= setup / params ================= */
const qs = new URLSearchParams(location.search);
const DEBUG_CAM = qs.get('cam');            // "x,z,yaw,pitch" — skip gate, no audio
const FORCE_OPEN = qs.get('open') === '1';  // bookcase pre-opened (screenshots)
const FORCE_PANEL = qs.get('panel') === '1';
const FORCE_SLOW = qs.get('slowtest') === '1';  // exercise the slow-device offer
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.getElementById('stage');
const gate = document.getElementById('gate');
const fadeEl = document.getElementById('fade');
const capText = document.getElementById('capText');
const labelEl = document.getElementById('label');
const rewardEl = document.getElementById('reward');
const hintEl = document.getElementById('hint');
const FROM_DOOR = qs.get('from') === 'door';
if (FROM_DOOR) { gate.style.display = 'none'; fadeEl.classList.add('from-door'); }

let renderer = null;
try {
  // The inline flat-vault script already decided this visit is text-only (no WebGL, or
  // ?flat=1). Don't build a scene nobody will see.
  if (window.__flatMode) throw new Error('flat vault');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no ctx');
} catch (e) {
  if (window.__showFlatVault) window.__showFlatVault('nowebgl');
  else document.getElementById('fallback').hidden = false;
  gate.style.display = 'none';
  fadeEl.classList.add('clear');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); // perf cap (§4B)
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0603);
scene.fog = new THREE.FogExp2(0x0e0803, 0.052);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';

/* ================= procedural canvas textures ================= */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const R = Math.random;

function speckle(g, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,240,210,${a * 0.7})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}
// Flagstone floor — big irregular warm-gray stones with dark mortar (matches concept)
function drawFloor(g, w, h) {
  g.fillStyle = '#241a10'; g.fillRect(0, 0, w, h);
  const rows = 5, cols = 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const off = (r % 2) * 0.5;
    const x = ((c + off) % cols) * (w / cols), y = r * (h / rows);
    const p = 4 + R() * 4;
    const l = 24 + R() * 10;
    g.fillStyle = `hsl(${26 + R() * 10}, ${16 + R() * 10}%, ${l}%)`;
    g.beginPath();
    g.roundRect(x + p, y + p, w / cols - p * 2, h / rows - p * 2, 8 + R() * 8);
    g.fill();
    g.strokeStyle = 'rgba(255,220,160,0.05)'; g.stroke();
  }
  speckle(g, w, h, 1200, 0.05);
}
// Coursed stone wall — warmer, candle-lit
function drawWall(g, w, h) {
  g.fillStyle = '#20150b'; g.fillRect(0, 0, w, h);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const bw = 130 + R() * 70;
    let x = -R() * 90;
    while (x < w) {
      const ww = bw * (0.7 + R() * 0.7);
      g.fillStyle = `hsl(${26 + R() * 9}, ${17 + R() * 11}%, ${19 + R() * 8}%)`;
      g.beginPath();
      g.roundRect(x + 4, r * (h / rows) + 4, ww - 8, h / rows - 8, 9 + R() * 6);
      g.fill();
      g.strokeStyle = 'rgba(255,215,150,0.045)'; g.stroke();
      x += ww;
    }
  }
  speckle(g, w, h, 1100, 0.045);
}
function drawWood(g, w, h) {
  g.fillStyle = '#57351a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(${20 + R() * 40},${10 + R() * 24},4,${0.25 + R() * 0.3})`;
    g.lineWidth = 1 + R() * 2;
    g.beginPath();
    const y = R() * h;
    g.moveTo(0, y);
    g.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 16, w * 0.7, y + (R() - 0.5) * 16, w, y + (R() - 0.5) * 10);
    g.stroke();
  }
  // plank seams
  for (let i = 1; i < 4; i++) {
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke();
  }
  speckle(g, w, h, 400, 0.05);
}
// Book spines — muted leather colors + gold bands
function drawSpines(g, w, h) {
  const pal = ['#5a2f22', '#74452a', '#3c2b4e', '#27422f', '#661f24', '#8a6a30', '#2f3f4e', '#4a3320'];
  g.fillStyle = '#170e07'; g.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const bw = 10 + R() * 18, bh = h * (0.86 + R() * 0.13);
    g.fillStyle = pal[(R() * pal.length) | 0];
    g.fillRect(x + 1, h - bh, bw - 2, bh);
    g.fillStyle = 'rgba(246,178,60,0.55)';
    g.fillRect(x + 3, h - bh + 6 + R() * 10, bw - 6, 2);
    if (R() > 0.5) g.fillRect(x + 3, h - 14 - R() * 10, bw - 6, 2);
    x += bw;
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 4);
}
// Handwritten puzzle page — faint grid + digits
function drawPaper(withGrid) {
  return (g, w, h) => {
    g.fillStyle = '#e6d7b4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,20,0.35)'; g.lineWidth = 1;
    if (withGrid) {
      const s = w * 0.62, ox = (w - s) / 2, oy = h * 0.16;
      for (let i = 0; i <= 9; i++) {
        g.lineWidth = i % 3 === 0 ? 2 : 1;
        g.beginPath(); g.moveTo(ox + i * s / 9, oy); g.lineTo(ox + i * s / 9, oy + s); g.stroke();
        g.beginPath(); g.moveTo(ox, oy + i * s / 9); g.lineTo(ox + s, oy + i * s / 9); g.stroke();
      }
      g.fillStyle = 'rgba(60,40,15,0.75)'; g.font = `${(s / 12) | 0}px serif`;
      for (let i = 0; i < 14; i++)
        g.fillText(String(1 + (R() * 9) | 0), ox + ((R() * 9) | 0) * s / 9 + s / 27, oy + ((R() * 9) | 0) * s / 9 + s / 11);
    }
    g.strokeStyle = 'rgba(70,45,15,0.4)';
    for (let i = 0; i < 5; i++) {
      const y = h * 0.78 + i * h * 0.04;
      g.beginPath(); g.moveTo(w * 0.12, y);
      g.bezierCurveTo(w * 0.4, y + 2, w * 0.6, y - 2, w * 0.88, y + 1); g.stroke();
    }
  };
}
// Cork pinboard with pinned notes & mini grids (back wall, per concept)
function drawBoard(g, w, h) {
  g.fillStyle = '#7d5a35'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 700, 0.08);
  for (let i = 0; i < 8; i++) {
    const nw = 60 + R() * 40, nh = 70 + R() * 40;
    const x = 14 + R() * (w - nw - 28), y = 12 + R() * (h - nh - 24);
    g.save(); g.translate(x + nw / 2, y + nh / 2); g.rotate((R() - 0.5) * 0.16);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-nw / 2 + 3, -nh / 2 + 4, nw, nh);
    g.fillStyle = i % 3 === 2 ? '#efe3c0' : '#e9dcbc'; g.fillRect(-nw / 2, -nh / 2, nw, nh);
    g.strokeStyle = 'rgba(80,50,15,0.5)'; g.lineWidth = 1;
    if (i % 2 === 0) { // mini grid
      const s = nw * 0.62, ox = -s / 2, oy = -nh / 2 + 10;
      for (let k = 0; k <= 4; k++) {
        g.beginPath(); g.moveTo(ox + k * s / 4, oy); g.lineTo(ox + k * s / 4, oy + s); g.stroke();
        g.beginPath(); g.moveTo(ox, oy + k * s / 4); g.lineTo(ox + s, oy + k * s / 4); g.stroke();
      }
    } else {
      for (let k = 0; k < 4; k++) {
        g.beginPath(); g.moveTo(-nw / 2 + 8, -nh / 2 + 16 + k * 12);
        g.lineTo(nw / 2 - 8, -nh / 2 + 16 + k * 12); g.stroke();
      }
    }
    g.fillStyle = '#8a1f1f';
    g.beginPath(); g.arc(0, -nh / 2 + 5, 3.4, 0, 7); g.fill();
    g.restore();
  }
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,214,130,1)');
  gr.addColorStop(0.35, 'rgba(255,178,70,0.55)');
  gr.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Library parquet — warm diagonal tiles w/ dark border band (concept v3 floor)
function drawParquet(g, w, h) {
  g.fillStyle = '#33220f'; g.fillRect(0, 0, w, h);
  const s = w / 3;   // big warm stone tiles set on the diagonal (concept v3 floor)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    g.save(); g.translate(c * s + s / 2, r * s + s / 2); g.rotate(Math.PI / 4);
    const d = s * 0.66;
    g.fillStyle = `hsl(${25 + R() * 7}, ${22 + R() * 8}%, ${17 + R() * 5}%)`;
    g.fillRect(-d / 2, -d / 2, d, d);
    g.strokeStyle = 'rgba(220,170,90,0.1)'; g.lineWidth = 2; g.strokeRect(-d / 2, -d / 2, d, d);
    g.restore();
  }
  speckle(g, w, h, 600, 0.045);
}
// Carved stone frieze — vault III walls (relief bands per concept)
function drawFrieze(g, w, h) {
  drawWall(g, w, h);
  // two horizontal carved relief bands
  [0.3, 0.72].forEach(fy => {
    const y = h * fy, bh = h * 0.09;
    g.fillStyle = 'rgba(15,9,4,0.55)'; g.fillRect(0, y, w, bh);
    g.strokeStyle = 'rgba(230,180,110,0.28)'; g.lineWidth = 2;
    g.strokeRect(1, y + 1, w - 2, bh - 2);
    // plain recessed groove lines — carved, elegant, and unreadable as text
    g.strokeStyle = 'rgba(230,180,110,0.16)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, y + bh * 0.32); g.lineTo(w, y + bh * 0.32); g.stroke();
    g.beginPath(); g.moveTo(0, y + bh * 0.68); g.lineTo(w, y + bh * 0.68); g.stroke();
    g.strokeStyle = 'rgba(10,6,3,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y + bh * 0.5); g.lineTo(w, y + bh * 0.5); g.stroke();
  });
}
function drawChecker(g, w, h) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    g.fillStyle = (r + c) % 2 ? '#2b1a0d' : '#c8a86a';
    g.fillRect(c * w / 8, r * h / 8, w / 8, h / 8);
  }
}
// Enigma-machine face — rows of round keys + lamp board
function drawEnigma(g, w, h) {
  g.fillStyle = '#241a10'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(210,170,110,0.5)'; g.strokeRect(3, 3, w - 6, h - 6);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const x = w * 0.1 + c * w * 0.108, y = h * 0.3 + r * h * 0.24;
    g.fillStyle = r === 0 ? '#d9b46a' : '#3c2d1a';
    g.beginPath(); g.arc(x, y, w * 0.036, 0, 7); g.fill();
    g.strokeStyle = 'rgba(240,200,140,0.6)'; g.stroke();
  }
  g.fillStyle = '#845f2e'; g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.12); // rotor slots
  g.fillStyle = '#1a120a';
  for (let i = 0; i < 4; i++) g.fillRect(w * (0.14 + i * 0.2), h * 0.075, w * 0.1, h * 0.09);
}
// Series seal glyph — glowing arcane emblem in a volume color (vault III back wall)
function sealTexture(colA, colB) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 170;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0704'; g.fillRect(0, 0, 128, 170);
  const cx = 64, cy = 85;
  const grad = g.createRadialGradient(cx, cy, 4, cx, cy, 70);
  grad.addColorStop(0, colA); grad.addColorStop(0.55, colB); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 170);
  g.strokeStyle = colA; g.lineWidth = 2.4; g.shadowColor = colA; g.shadowBlur = 9;
  g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.stroke();
  g.beginPath(); // diamond
  g.moveTo(cx, cy - 46); g.lineTo(cx + 30, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 30, cy); g.closePath(); g.stroke();
  g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.stroke();
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + Math.PI / 4;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    g.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.stroke(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const floorTex = canvasTex(512, 512, drawFloor, 3, 3);
const parquetTex = canvasTex(512, 512, drawParquet, 3, 3);
const friezeTex = canvasTex(512, 256, drawFrieze, 2.2, 1.35);
const checkerTex = canvasTex(128, 128, drawChecker);
const enigmaTex = canvasTex(256, 192, drawEnigma);
const wallTex = canvasTex(512, 256, drawWall, 2.2, 1.35);
const woodTex = canvasTex(256, 256, drawWood, 1, 1);
const spineTex = canvasTex(256, 64, drawSpines, 1, 1);
const paperTexA = canvasTex(128, 170, drawPaper(true));
const paperTexB = canvasTex(128, 170, drawPaper(false));
const boardTex = canvasTex(512, 340, drawBoard);
const glowTex = glowTexture();

/* ---- texture loaders for high-res bump maps and PBR materials ---- */
const texLoader = new THREE.TextureLoader();
function loadTex(url, rx = 1, ry = 1) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/* Painted textures upgrade a procedurally-drawn surface WITHOUT being able to break it:
   if the file is missing or fails to decode, the canvas texture it replaces stays on the
   material, so the room always renders. This is what lets the art tier land room by room. */
let paintedCount = 0, paintedMissing = 0;
function paintedTex(url, fallback, rx = 1, ry = 1) {
  // start life as the procedural texture, so a missing file is simply "not upgraded yet"
  const t = fallback.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;   // grazing-angle floors alias into phantom blocks without this
  texLoader.load(
    url,
    (img) => { t.image = img.image; t.needsUpdate = true; paintedCount++; },
    undefined,
    () => { paintedMissing++; }   // keeps the canvas texture already in place
  );
  return t;
}
const wallBumpTex = loadTex('/art/stone_wall_bump.webp', 4, 2);
const woodMatTex = loadTex('/art/mahogany_wood.webp', 2, 2);
const goldFoilTex = loadTex('/art/gold_foil_bg.webp', 1, 1);
wallBumpTex.colorSpace = THREE.NoColorSpace;   // a bump map carries height, not colour

/* ---- the painted art tier (Phase 1B) ----
   Highest-leverage surfaces first: the ones that fill the most screen as you walk.
   Each falls back to its procedural texture until the painted file exists. */
// Repeat counts are set by REAL-WORLD scale, not by the procedural textures they replace:
// the study floor is ~8m across, so ~1.6 repeats puts the planks at a believable width,
// and the library's herringbone blocks need to stay coarse enough not to alias at range.
const floorTexP   = paintedTex('/art/tex/study_floor.webp',   floorTex,   1.6, 1.6);
const parquetTexP = paintedTex('/art/tex/library_floor.webp', parquetTex, 1.3, 1.3);
const wallTexP    = paintedTex('/art/tex/stone_wall.webp',    wallTex,    2.2, 1.35);
const spineTexP   = paintedTex('/art/tex/book_spines.webp',   spineTex,   1, 1);


/* ================= materials ================= */
const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorTexP, bumpMap: wallBumpTex, bumpScale: 0.03, roughness: 0.88 }),
  wall: new THREE.MeshStandardMaterial({ map: wallTexP, bumpMap: wallBumpTex, bumpScale: 0.05, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ map: woodMatTex, roughness: 0.55, metalness: 0.1 }),
  woodDark: new THREE.MeshStandardMaterial({ map: woodMatTex, color: 0x6a4a2c, roughness: 0.65 }),
  gold: new THREE.MeshStandardMaterial({ map: goldFoilTex, color: 0xe6b84c, metalness: 0.9, roughness: 0.25 }),
  goldGlow: new THREE.MeshStandardMaterial({ map: goldFoilTex, color: 0xffd47a, metalness: 0.85, roughness: 0.2, emissive: 0xa06a14, emissiveIntensity: 0.4 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2c2620, metalness: 0.65, roughness: 0.55 }),
  paperA: new THREE.MeshStandardMaterial({ map: paperTexA, roughness: 0.9 }),
  paperB: new THREE.MeshStandardMaterial({ map: paperTexB, roughness: 0.9 }),
  spines: new THREE.MeshStandardMaterial({ map: spineTexP, roughness: 0.85 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xe9e2ce, roughness: 0.6 }),
  flame: new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff9a30, emissiveIntensity: 1.5 }),
  stack: new THREE.MeshStandardMaterial({ color: 0xcaa24e, emissive: 0xffb43c, emissiveIntensity: 0.8, roughness: 0.45, metalness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 1 }),
  parquet: new THREE.MeshStandardMaterial({ map: parquetTexP, roughness: 0.7 }),
  frieze: new THREE.MeshStandardMaterial({ map: friezeTex, bumpMap: wallBumpTex, bumpScale: 0.04, roughness: 0.92 }),
  checker: new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.7 }),
  enigma: new THREE.MeshStandardMaterial({ map: enigmaTex, roughness: 0.65 }),
  brass: new THREE.MeshStandardMaterial({ map: goldFoilTex, color: 0x9a7434, metalness: 0.92, roughness: 0.35 }),
  coin: new THREE.MeshStandardMaterial({ map: goldFoilTex, color: 0xd9a940, metalness: 0.95, roughness: 0.25, emissive: 0x442a08, emissiveIntensity: 0.3 }),
  stonePed: new THREE.MeshStandardMaterial({ bumpMap: wallBumpTex, color: 0x6a5843, roughness: 0.88 }),
  chestWood: new THREE.MeshStandardMaterial({ map: woodMatTex, color: 0x4a2c16, roughness: 0.75 }),
  chestWood2: new THREE.MeshStandardMaterial({ map: woodMatTex, color: 0x5e3018, roughness: 0.75 }),
  glowStrip: new THREE.MeshStandardMaterial({ color: 0xffcf7a, emissive: 0xffb84a, emissiveIntensity: 1.6 }),
};
const GEMS = [0x2aa864, 0xc06a86, 0x2aa8bc, 0xc07d22].map(c =>
  new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.22, roughness: 0.25, metalness: 0.1 }));
// series seal colors: V2 emerald / V3 rose / V4 cyan / V5 amber
const SEALS = [
  { a: 'rgba(53,207,127,1)', b: 'rgba(20,90,55,0.55)', light: 0x35cf7f },
  { a: 'rgba(231,138,166,1)', b: 'rgba(110,45,66,0.55)', light: 0xe78aa6 },
  { a: 'rgba(51,208,230,1)', b: 'rgba(20,90,105,0.55)', light: 0x33d0e6 },
  { a: 'rgba(239,154,43,1)', b: 'rgba(115,70,15,0.55)', light: 0xef9a2b },
];

/* Stone walls are built from separate boxes (segments either side of a doorway, the
   lintel above it, side walls). BoxGeometry UVs are normalised 0..1 per face, so one
   shared material paints the SAME texture across a 4.65m wall and a 1.7m lintel alike —
   the blocks come out ~2.8x smaller on the narrow pieces. That difference framed the
   secret bookcase and gave the door away. Re-project wall UVs from WORLD position so the
   block grid is one continuous course across every segment, whatever its size. */
const WALL_REF_W = 4.65, WALL_REF_H = 4.0;   // the big study back wall = the look we match
function worldWallUVs(geo, w, h, d, x, y, z) {
  const uv = geo.attributes.uv;
  const x0 = x - w / 2, y0 = y - h / 2, z0 = z - d / 2;
  // per BoxGeometry face order (+X, -X, +Y, -Y, +Z, -Z): the world span and origin of U,V
  const F = [
    [d, h, z0, y0], [d, h, z0, y0],
    [w, d, x0, z0], [w, d, x0, z0],
    [w, h, x0, y0], [w, h, x0, y0],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv, ou, ov] = F[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i,
        (ou + uv.getX(i) * su) / WALL_REF_W,
        (ov + uv.getY(i) * sv) / WALL_REF_H);
    }
  }
  uv.needsUpdate = true;
}
function box(w, h, d, mat, x, y, z, ry = 0, parent = scene) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (mat === M.wall) worldWallUVs(geo, w, h, d, x, y, z);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
}
function sprite(scale, x, y, z, parent = scene, opacity = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale); s.position.set(x, y, z); parent.add(s); return s;
}

/* ---- original still art loader & framed picture builder ---- */
function makeFramedPicture(artPath, w, h, x, y, z, ry = 0, parent = scene) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = ry;
  const frameT = 0.07;
  box(w + frameT * 2, h + frameT * 2, 0.05, M.goldGlow, 0, 0, -0.025, 0, group);
  box(w + 0.02, h + 0.02, 0.04, M.woodDark, 0, 0, -0.01, 0, group);
  const canvasTex = texLoader.load(artPath);
  canvasTex.generateMipmaps = true;
  canvasTex.minFilter = THREE.LinearMipmapLinearFilter;
  const canvasMat = new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.45, metalness: 0.1 });
  const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvasMesh.position.z = 0.005;
  group.add(canvasMesh);
  parent.add(group);
  return group;
}

/* ================= the room ================= */
// Room: x -4..4, z -4..4, ceiling 4. Player enters at +z looking toward -z.
const WALL_H = 4;

// floor & ceiling
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), M.floor);
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6a4a2c, roughness: 0.95 }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; scene.add(ceil);
[-2.4, 0, 2.4].forEach(z => box(8.4, 0.26, 0.24, M.woodDark, 0, WALL_H - 0.13, z));

// walls — back wall (z=-4) has the secret-passage opening (x -2.35..-0.65, h 2.5)
box(1.65, WALL_H, 0.2, M.wall, -3.175, WALL_H / 2, -4);           // back-left of opening
box(4.65, WALL_H, 0.2, M.wall, 1.675, WALL_H / 2, -4);            // back-right of opening
box(1.7, WALL_H - 2.5, 0.2, M.wall, -1.5, 2.5 + (WALL_H - 2.5) / 2, -4); // above opening
box(0.2, WALL_H, 8.4, M.wall, -4.1, WALL_H / 2, 0);               // left
box(0.2, WALL_H, 8.4, M.wall, 4.1, WALL_H / 2, 0);                // right
// front wall (z=+4) with the grand entrance opening (x -1.2..1.2, h 3.2)
box(2.8, WALL_H, 0.2, M.wall, -2.6, WALL_H / 2, 4);
box(2.8, WALL_H, 0.2, M.wall, 2.6, WALL_H / 2, 4);
box(2.4, WALL_H - 3.2, 0.2, M.wall, 0, 3.2 + (WALL_H - 3.2) / 2, 4);

// grand engraved-gold entrance frame (behind the player) + darkness beyond
box(0.34, 3.5, 0.42, M.goldGlow, -1.34, 1.75, 4);
box(0.34, 3.5, 0.42, M.goldGlow, 1.34, 1.75, 4);
box(3.05, 0.36, 0.42, M.goldGlow, 0, 3.36, 4);
box(0.07, 3.3, 0.46, M.gold, -1.17, 1.65, 4);                 // inner engraved ridge
box(0.07, 3.3, 0.46, M.gold, 1.17, 1.65, 4);
box(2.42, 0.08, 0.46, M.gold, 0, 3.2, 4);
[0.6, 1.4, 2.2, 3.0].forEach(y => [-1.34, 1.34].forEach(x => { // rivets down the jambs
  const rv = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), M.gold);
  rv.position.set(x, y, 3.77); scene.add(rv);
}));
box(3.0, 0.08, 0.5, M.gold, 0, 0.04, 4);                      // gold threshold
box(4, 4.6, 0.1, M.dark, 0, 2.2, 5.6);                        // darkness beyond
sprite(2.4, 0, 1.4, 4.35, scene, 0.4);                        // faint glow in the doorway

/* ---- desk group (diagonal, chair behind — concept v4) ---- */
const desk = new THREE.Group();
desk.position.set(0.5, 0, -0.4); desk.rotation.y = 0.42; scene.add(desk);
box(1.95, 0.09, 0.98, M.wood, 0, 0.78, 0, 0, desk);           // top
box(2.02, 0.035, 1.04, M.woodDark, 0, 0.725, 0, 0, desk);     // moulded edge band
box(1.72, 0.16, 0.8, M.woodDark, 0, 0.655, 0, 0, desk);       // apron
box(1.6, 0.05, 0.72, M.gold, 0, 0.585, 0, 0, desk);           // thin gold inlay line under the apron
[[-0.86, 0.42], [0.86, 0.42], [-0.86, -0.42], [0.86, -0.42]].forEach(([x, z]) => {
  // turned legs — foot, swell, shaft, collar (the "fancier desk" Dan wanted)
  const leg = new THREE.Group(); leg.position.set(x, 0, z); desk.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.07, 10), M.woodDark); foot.position.y = 0.035; leg.add(foot);
  const swell = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), M.woodDark); swell.position.y = 0.13; leg.add(swell);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.38, 10), M.woodDark); shaft.position.y = 0.38; leg.add(shaft);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 10), M.woodDark); collar.position.y = 0.615; leg.add(collar);
});
// chair behind the desk (local -z), facing the desk
const chair = new THREE.Group(); chair.position.set(0.1, 0, -0.92); desk.add(chair);
box(0.46, 0.06, 0.44, M.wood, 0, 0.46, 0, 0, chair);
[[-0.19, 0.18], [0.19, 0.18], [-0.19, -0.18], [0.19, -0.18]].forEach(([x, z]) =>
  box(0.05, 0.46, 0.05, M.woodDark, x, 0.23, z, 0, chair));
box(0.05, 0.62, 0.05, M.woodDark, -0.19, 0.8, -0.2, 0, chair);
box(0.05, 0.62, 0.05, M.woodDark, 0.19, 0.8, -0.2, 0, chair);
[0.72, 0.9, 1.06].forEach(y => box(0.42, 0.07, 0.03, M.wood, 0, y, -0.2, 0, chair));

// ✦ THE REWARD — glowing puzzle stack, center of the desk (clickable)
const stack = new THREE.Group();
stack.position.set(0.02, 0.825, 0.05); desk.add(stack);
stack.userData = { kind: 'stack', label: "Take the Keeper's gift" };
[0, 1, 2, 3].forEach(i =>
  box(0.44 - i * 0.02, 0.08, 0.33 - i * 0.015, M.stack, (R() - 0.5) * 0.03, 0.04 + i * 0.082, (R() - 0.5) * 0.03, (R() - 0.5) * 0.3, stack));
const stackGlow = sprite(1.5, 0, 0.28, 0, stack, 0.95);
const stackLight = new THREE.PointLight(0xffb84a, 30, 7, 2);
stackLight.position.set(0, 0.55, 0); stack.add(stackLight);

// candle (right of desk) with flicker
const candle = new THREE.Group(); candle.position.set(0.74, 0.825, 0.18); desk.add(candle);
const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.025, 16), M.gold);
holder.position.y = 0.012; candle.add(holder);
const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.17, 12), M.candle);
stick.position.y = 0.1; candle.add(stick);
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 10), M.flame);
flame.position.y = 0.22; candle.add(flame);
const candleGlow = sprite(0.5, 0, 0.24, 0, candle);
const candleLight = new THREE.PointLight(0xffab4a, 24, 8, 2);
candleLight.position.set(0, 0.4, 0); candle.add(candleLight);
candle.userData = { kind: 'candle', label: 'A candle' };
let candleLit = true;
function setCandle(lit) { candleLit = lit; flame.visible = lit; candleGlow.visible = lit; }

// inkwell + quill (left of desk)
const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x181310, roughness: 0.4, metalness: 0.3 }));
ink.position.set(-0.72, 0.87, 0.12); desk.add(ink);
const quill = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.34), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, side: THREE.DoubleSide, roughness: 0.8 }));
quill.position.set(-0.72, 1.02, 0.12); quill.rotation.set(0.5, 0.4, 0.9); desk.add(quill);
ink.userData = { kind: 'say', say: 'quill', found: 'quill', label: 'Quill and ink' };
quill.userData = { kind: 'say', say: 'quill', found: 'quill', label: 'Quill and ink' };
chair.userData = { kind: 'chair', label: "Sit at the Keeper's desk" };
// the Keeper's Notebook — a small closed book at the desk's edge
const notebook = new THREE.Group(); notebook.position.set(-0.42, 0.825, -0.22); notebook.rotation.y = 0.25; desk.add(notebook);
box(0.22, 0.035, 0.16, new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.7 }), 0, 0.018, 0, 0, notebook);
box(0.2, 0.012, 0.14, M.candle, 0, 0.04, 0, 0, notebook);                       // the page block
box(0.03, 0.045, 0.16, M.brass, -0.095, 0.022, 0, 0, notebook);                  // brass spine
notebook.userData = { kind: 'notebook', label: "The Keeper's notebook" };

// scattered pages on the desk
[[-0.45, 0.28, 0.5, M.paperA], [0.5, -0.25, -0.4, M.paperB], [-0.15, -0.3, 1.2, M.paperB], [0.42, 0.3, 2.4, M.paperA]].forEach(([x, z, r, mt]) => {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), mt);
  p.rotation.x = -Math.PI / 2; p.rotation.z = r; p.position.set(x, 0.828, z); desk.add(p);
});
// soft contact shadow under the desk
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const deskShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
deskShadow.rotation.x = -Math.PI / 2; deskShadow.position.set(0, 0.012, -0.35); desk.add(deskShadow);

// three crumpled rejects near the walls — each unfolds into a draft with TWO answers
const rejects = [];
[[-2.9, 2.3], [3.15, -1.5], [-3.3, -2.5]].forEach(([x, z], i) => {
  const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), M.paperB);
  w.position.set(x, 0.07, z); w.rotation.set(R() * 3, R() * 3, R() * 3); scene.add(w);
  w.userData = { kind: 'reject', idx: i, label: 'A crumpled page' };
  rejects.push(w);
});

/* ---- pinboard of sudoku sheets (back wall, right — per concept) ---- */
box(2.1, 1.5, 0.06, M.woodDark, 1.9, 2.15, -3.94);
const board = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 1.34), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95 }));
board.position.set(1.9, 2.15, -3.86); scene.add(board);
board.userData = { kind: 'say', say: 'board', found: 'board', label: 'A pinboard of grids' };

// (Removed 2026-07-28, Dan's call: the framed picture that hung on the left wall between
// the bookcases read as a big blank slab rather than artwork. Its dedicated point light
// went with it — on its own it was just an unexplained hotspot on bare stone.
// The gallery frames in Vault III are unaffected.)

/* ---- bookcases (left & right walls) ---- */
function makeBookcase(w, h, d) {
  const g = new THREE.Group();
  box(w, h, d * 0.35, M.woodDark, 0, h / 2, -d * 0.3, 0, g);           // back panel
  box(0.08, h, d, M.wood, -w / 2 + 0.04, h / 2, 0, 0, g);
  box(0.08, h, d, M.wood, w / 2 - 0.04, h / 2, 0, 0, g);
  box(w, 0.09, d, M.wood, 0, h - 0.045, 0, 0, g);
  box(w, 0.09, d, M.wood, 0, 0.05, 0, 0, g);
  // Same rule as the library shelves: the rows have to divide the case's full inner
  // height. With a fixed count of 4 the top row finished ~0.38m below the top board,
  // baring a strip of back panel across the whole case.
  const inner = h - 0.23;                                  // base board → underside of the top board
  const shelves = Math.max(3, Math.round(inner / 0.45));
  const gap = inner / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = 0.14 + i * gap;
    if (i > 0) box(w - 0.12, 0.05, d - 0.04, M.wood, 0, y, 0, 0, g);
    const books = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, gap * 0.74, d - 0.14),
      [M.woodDark, M.woodDark, M.woodDark, M.woodDark, M.spines, M.woodDark]);
    books.position.set(0, y + gap * 0.42, 0.02); g.add(books);
  }
  return g;
}
const wallCases = [];
[[-3.82, -1.6, Math.PI / 2], [-3.82, 1.4, Math.PI / 2], [3.82, -1.2, -Math.PI / 2], [3.82, 1.7, -Math.PI / 2]].forEach(([x, z, ry]) => {
  const bc = makeBookcase(1.9, 2.5, 0.4);
  bc.position.set(x, 0, z); bc.rotation.y = ry; scene.add(bc);
  bc.userData = { kind: 'say', say: 'shelf', found: 'shelf', label: "The Keeper's shelves" };
  wallCases.push(bc);
});
// the Corsair's Chart, half-covered on an easel in the corner — Volume II, as an object
const easelS = new THREE.Group(); easelS.position.set(3.05, 0, -3.0); easelS.rotation.y = -0.7; scene.add(easelS);
box(0.05, 1.5, 0.05, M.woodDark, -0.32, 0.75, 0.1, 0.12, easelS);
box(0.05, 1.5, 0.05, M.woodDark, 0.32, 0.75, 0.1, -0.12, easelS);
box(0.05, 1.55, 0.05, M.woodDark, 0, 0.77, -0.28, 0, easelS);
box(0.72, 0.05, 0.05, M.woodDark, 0, 0.62, 0.08, 0, easelS);
const chartBoardS = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.02, 0.04), M.woodDark);
chartBoardS.position.set(0, 1.12, 0.03); chartBoardS.rotation.x = -0.09; easelS.add(chartBoardS);
const chartFaceS = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.96), new THREE.MeshStandardMaterial({ map: paperTexA, color: 0xcaa870, roughness: 0.9 }));
chartFaceS.position.set(0, 1.12, 0.052); chartFaceS.rotation.x = -0.09; easelS.add(chartFaceS);
const clothS = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.8, 0.14), new THREE.MeshStandardMaterial({ color: 0x9a8d6f, roughness: 1 }));
clothS.position.set(0, 1.32, 0.02); clothS.rotation.x = -0.09; easelS.add(clothS);
box(0.98, 0.5, 0.13, new THREE.MeshStandardMaterial({ color: 0x8a7d60, roughness: 1 }), 0, 1.02, 0.02, 0, easelS);
box(0.4, 0.02, 0.08, M.brass, 0, 0.66, 0.11, 0, easelS);
const chartHitS = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
chartHitS.position.set(0, 0.9, 0); easelS.add(chartHitS);
easelS.userData = { kind: 'chartStudy', label: 'Something half-covered on an easel' };

// wall sconce with flame (left wall, near the entrance — per concept)
const sconce = new THREE.Group(); sconce.position.set(-3.88, 2.3, 1.9); scene.add(sconce);
box(0.1, 0.34, 0.1, M.iron, 0, -0.12, 0, 0, sconce);
const sconceCup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.1, 10), M.gold);
sconceCup.position.set(0.12, 0.02, 0); sconce.add(sconceCup);
const sflame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), M.flame);
sflame.position.set(0.12, 0.14, 0); sconce.add(sflame);
sprite(0.75, 0.12, 0.16, 0, sconce);
const sconceLight = new THREE.PointLight(0xff9a3a, 28, 9, 2);
sconceLight.position.set(0.25, 0.2, 0); sconce.add(sconceLight);
sconce.userData = { kind: 'say', say: 'sconce', found: 'sconce', label: 'A wall sconce' };

/* ---- THE SECRET BOOKCASE (hinged over the passage opening) ---- */
const hinge = new THREE.Group();
hinge.position.set(-2.35, 0, -3.85); scene.add(hinge);
const bookdoor = makeBookcase(1.74, 2.44, 0.34);
bookdoor.position.set(0.87, 0, 0); hinge.add(bookdoor);
bookdoor.traverse(o => { o.userData.kindParent = 'bookcase'; });
hinge.userData = { kind: 'bookcase', label: 'A bookcase… slightly ajar' };
let doorAmt = 0;                       // 0 closed → 1 open (rotY 0 → -1.62)
let doorAnim = null;                   // {from,to,start,dur}
const DOOR_AJAR = 0.07;
hinge.rotation.y = -DOOR_AJAR;

/* ---- the passage + sealed Vault II door ---- */
const CORR = { minX: -2.2, maxX: -0.8, endZ: -6.95 };
const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.6), M.floor);
corrFloor.rotation.x = -Math.PI / 2; corrFloor.position.set(-1.5, 0.001, -5.7); scene.add(corrFloor);
box(0.18, 2.6, 3.6, M.wall, -2.48, 1.3, -5.7);
box(0.18, 2.6, 3.6, M.wall, -0.52, 1.3, -5.7);
box(2.1, 0.2, 3.6, M.wall, -1.5, 2.6, -5.7);
// torch in the passage
const torch = new THREE.Group(); torch.position.set(-2.36, 1.85, -5.3); scene.add(torch);
const tflame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), M.flame);
tflame.position.set(0.1, 0.1, 0); torch.add(tflame);
box(0.07, 0.3, 0.07, M.iron, 0.06, -0.08, 0, 0.3, torch);
sprite(0.55, 0.1, 0.12, 0, torch, 0.6);
const torchLight = new THREE.PointLight(0xff8f35, 14, 9, 2);
torchLight.position.set(0.2, 0.15, 0); torch.add(torchLight);
/* ================= THE DEEPER WORLD — Vaults II & III ================= */
const AX = -1.5;   // the deep axis: corridor → library aisle → treasure room all line up on it

// sealed circular vault door, hinged to swing open when its word is spoken
function makeVaultDoor(z, kind, label) {
  const hg = new THREE.Group(); hg.position.set(AX - 1.02, 1.32, z); scene.add(hg);
  const d = new THREE.Group(); d.position.set(1.02, 0, 0); hg.add(d);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.2, 40), M.iron);
  slab.rotation.x = Math.PI / 2; d.add(slab);
  d.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.075, 12, 48), M.goldGlow));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 10, 32), M.gold);
  wheel.position.z = 0.16; d.add(wheel);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 8), M.gold);
    sp.position.z = 0.16; sp.rotation.z = i * Math.PI / 2.5; d.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M.gold);
  hub.position.z = 0.18; d.add(hub);
  hg.userData = { kind, label };
  return hg;
}
const door2 = makeVaultDoor(-7.45, 'door2', 'The second door — sealed with a word');
const door3 = makeVaultDoor(-19.55, 'door3', 'The third door — sealed with a word');

/* ---- VAULT II — THE LIBRARY OF PUZZLES (z -7.6 … -16.9, x -6.5 … 3.5, H 5) ---- */
const LIB = { minX: AX - 5, maxX: AX + 5, minZ: -16.9, maxZ: -7.6, H: 5 };
// front wall (holds Door II), doorway opening w1.8 h2.6 on the axis
box(4.1, LIB.H, 0.2, M.wall, AX - 2.95, LIB.H / 2, -7.6);
box(4.1, LIB.H, 0.2, M.wall, AX + 2.95, LIB.H / 2, -7.6);
box(1.8, LIB.H - 2.6, 0.2, M.wall, AX, 2.6 + (LIB.H - 2.6) / 2, -7.6);
// gold frame around Door II
box(0.26, 2.8, 0.3, M.goldGlow, AX - 1.02, 1.4, -7.58);
box(0.26, 2.8, 0.3, M.goldGlow, AX + 1.02, 1.4, -7.58);
box(2.3, 0.26, 0.3, M.goldGlow, AX, 2.72, -7.58);
// floor / ceiling
const libFloor = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 9.5), M.parquet);
libFloor.rotation.x = -Math.PI / 2; libFloor.position.set(AX, 0.001, -12.25); scene.add(libFloor);
const libCeil = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 9.5), new THREE.MeshStandardMaterial({ map: woodTex, color: 0x5a3c22, roughness: 0.95 }));
libCeil.rotation.x = Math.PI / 2; libCeil.position.set(AX, LIB.H, -12.25); scene.add(libCeil);
[-9.5, -12.25, -15].forEach(z => box(10.2, 0.3, 0.26, M.woodDark, AX, LIB.H - 0.15, z));
box(0.26, 0.3, 9.5, M.woodDark, AX, LIB.H - 0.15, -12.25, 0);
// side walls + back wall (doorway to the deeper corridor, w1.6 h2.4)
box(0.2, LIB.H, 9.5, M.wall, LIB.minX - 0.1, LIB.H / 2, -12.25);
box(0.2, LIB.H, 9.5, M.wall, LIB.maxX + 0.1, LIB.H / 2, -12.25);
box(4.2, LIB.H, 0.2, M.wall, AX - 2.9, LIB.H / 2, -16.9);
box(4.2, LIB.H, 0.2, M.wall, AX + 2.9, LIB.H / 2, -16.9);
box(1.6, LIB.H - 2.4, 0.2, M.wall, AX, 2.4 + (LIB.H - 2.4) / 2, -16.9);
// glowing back doorway (the pull toward Vault III)
box(0.24, 2.6, 0.28, M.goldGlow, AX - 0.92, 1.3, -16.88);
box(0.24, 2.6, 0.28, M.goldGlow, AX + 0.92, 1.3, -16.88);
box(2.1, 0.24, 0.28, M.goldGlow, AX, 2.6, -16.88);
sprite(2.2, AX, 1.3, -16.55, scene, 0.5);

/* puzzle-treasure props (procedural, engraved-gold) */
function propCipherDisc() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.035, 24), M.brass); g.add(base);
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.055, 24), M.gold); mid.position.y = 0.04; g.add(mid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 16), M.brass); top.position.y = 0.09; g.add(top);
  return g;
}
function propCryptex() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.075, 16), i % 2 ? M.brass : M.gold);
    seg.rotation.z = Math.PI / 2; seg.position.x = -0.16 + i * 0.08; g.add(seg);
  }
  [-0.23, 0.23].forEach(x => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.05, 16), M.woodDark);
    cap.rotation.z = Math.PI / 2; cap.position.x = x; g.add(cap);
  });
  g.position.y = 0.082; return g;
}
function propPuzzleChest(mat = M.chestWood) {
  const g = new THREE.Group();
  box(0.36, 0.2, 0.24, mat, 0, 0.1, 0, 0, g);
  const lid = box(0.36, 0.09, 0.24, mat, 0, 0.245, 0, 0, g);
  lid.rotation.z = 0;
  [-0.11, 0.11].forEach(x => box(0.045, 0.31, 0.26, M.gold, x, 0.155, 0, 0, g));
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), M.gold);
  dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.12, 0.13); g.add(dial);
  return g;
}
function propChess() {
  const g = new THREE.Group();
  box(0.4, 0.03, 0.4, M.checker, 0, 0.015, 0, 0, g);
  [[-0.1, -0.05], [0.05, 0.1], [0.14, -0.12]].forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.09, 10), i % 2 ? M.brass : M.iron);
    p.position.set(x, 0.075, z); g.add(p);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), i % 2 ? M.brass : M.iron);
    h.position.set(x, 0.13, z); g.add(h);
  });
  return g;
}
function propEnigma() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.3),
    [M.woodDark, M.woodDark, M.enigma, M.woodDark, M.woodDark, M.woodDark]); // enigma face on top
  body.position.y = 0.12; g.add(body);
  return g;
}
function propSphere() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), M.brass); s.position.y = 0.16; g.add(s);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 8, 28), M.gold); r.position.y = 0.16; r.rotation.x = 0.6; g.add(r);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 12), M.woodDark); st.position.y = 0.03; g.add(st);
  return g;
}
const PROPS = [propCipherDisc, propCryptex, propPuzzleChest, propChess, propEnigma, propSphere];

// tall gold-pilastered treasure shelves along both library walls
function makeTreasureShelf(w, h, d) {
  const g = new THREE.Group();
  box(w, h, d * 0.3, M.woodDark, 0, h / 2, -d * 0.32, 0, g);
  box(0.1, h, d, M.wood, -w / 2 + 0.05, h / 2, 0, 0, g);
  box(0.1, h, d, M.wood, w / 2 - 0.05, h / 2, 0, 0, g);
  box(w, 0.1, d, M.wood, 0, h - 0.05, 0, 0, g);
  box(w, 0.14, d + 0.06, M.wood, 0, 0.07, 0, 0, g);
  // Rows must divide the unit's FULL inner height, or the top compartment is left
  // oversized and reads as a big blank slab of back panel above the last shelf.
  // Row count follows the height (~0.62m per compartment) so a 4.3m library unit
  // gets six shelves like a real one, not four with a metre of bare wood on top.
  const inner = h - 0.30;                                  // base plinth → underside of the top board
  const shelves = Math.max(3, Math.round(inner / 0.62));
  const gap = inner / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = 0.2 + i * gap;
    if (i > 0) box(w - 0.16, 0.055, d - 0.05, M.wood, 0, y, 0, 0, g);
    // warm under-shelf glow strip (emissive only — no light cost)
    box(w - 0.2, 0.025, 0.03, M.glowStrip, 0, y + gap - 0.09, d / 2 - 0.05, 0, g);
    if (i % 2 === 0) { // books row
      const books = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, gap * 0.62, d - 0.16),
        [M.woodDark, M.woodDark, M.woodDark, M.woodDark, M.spines, M.woodDark]);
      books.position.set(0, y + gap * 0.36, 0.02); g.add(books);
    } else {           // treasures row
      const n = 2 + (R() * 2 | 0);
      for (let k = 0; k < n; k++) {
        const p = PROPS[(R() * PROPS.length) | 0]();
        p.position.set(-w / 2 + 0.35 + k * (w - 0.7) / Math.max(1, n - 1) + (R() - 0.5) * 0.06, y + 0.03, 0.02);
        p.rotation.y = (R() - 0.5) * 0.8; g.add(p);
      }
    }
  }
  return g;
}
[[LIB.minX + 0.33, -9.3, Math.PI / 2], [LIB.minX + 0.33, -12.25, Math.PI / 2], [LIB.minX + 0.33, -15.2, Math.PI / 2],
 [LIB.maxX - 0.33, -9.3, -Math.PI / 2], [LIB.maxX - 0.33, -12.25, -Math.PI / 2], [LIB.maxX - 0.33, -15.2, -Math.PI / 2]].forEach(([x, z, ry]) => {
  const s = makeTreasureShelf(2.6, 4.3, 0.5);
  s.position.set(x, 0, z); s.rotation.y = ry; scene.add(s);
});
// gold pilasters between shelf bays + cornice and baseboards (the engraved-gold trim)
[-10.78, -13.73].forEach(z => {
  box(0.34, LIB.H, 0.34, M.goldGlow, LIB.minX + 0.17, LIB.H / 2, z);
  box(0.34, LIB.H, 0.34, M.goldGlow, LIB.maxX - 0.17, LIB.H / 2, z);
});
box(0.14, 0.2, 9.5, M.gold, LIB.minX + 0.07, LIB.H - 0.32, -12.25);   // cornice rails
box(0.14, 0.2, 9.5, M.gold, LIB.maxX - 0.07, LIB.H - 0.32, -12.25);
box(10.2, 0.2, 0.14, M.gold, AX, LIB.H - 0.32, -16.82);
box(0.16, 0.24, 9.5, M.woodDark, LIB.minX + 0.08, 0.12, -12.25);      // baseboards
box(0.16, 0.24, 9.5, M.woodDark, LIB.maxX - 0.08, 0.12, -12.25);
// freestanding stacks flanking the aisle (gives the concept's "walking a corridor of shelves")
[[AX - 1.95, -10.7, Math.PI / 2], [AX + 1.95, -13.9, -Math.PI / 2]].forEach(([x, z, ry]) => {
  const st = makeTreasureShelf(2.2, 2.5, 0.5);
  st.position.set(x, 0, z); st.rotation.y = ry; scene.add(st); // both faces turned toward the aisle
});
// low display counters flanking the entrance (like the concept's foreground cabinets)
[[AX - 2.2, -8.6], [AX + 2.2, -8.6]].forEach(([x, z]) => {
  box(1.7, 0.95, 0.6, M.woodDark, x, 0.475, z);
  box(1.8, 0.06, 0.68, M.wood, x, 0.98, z);
  const p = PROPS[(R() * PROPS.length) | 0]();
  p.position.set(x, 1.01, z); p.rotation.y = R() * 6.3; scene.add(p);
});

// gold-framed puzzle pages on the blank wall stretches (front + back walls)
[[AX - 3.3, 2.7, -7.74, Math.PI], [AX + 3.3, 2.7, -7.74, Math.PI],
 [AX - 3.5, 2.7, -16.76, 0], [AX + 3.5, 2.7, -16.76, 0]].forEach(([x, y, z, ry]) => {
  const fr = new THREE.Group(); fr.position.set(x, y, z); fr.rotation.y = ry; scene.add(fr);
  box(0.74, 0.94, 0.05, M.gold, 0, 0, 0, 0, fr);
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), M.paperA);
  pg.position.z = 0.032; fr.add(pg);
});

// ✦ THE VAULT II REWARD — a glowing tome on a reading lectern, beside the aisle
const lectern = new THREE.Group(); lectern.position.set(AX + 1.7, 0, -11.6); lectern.rotation.y = -0.5; scene.add(lectern);
lectern.userData = { kind: 'tome', label: "The Keeper's second gift" };
box(0.16, 1.05, 0.16, M.wood, 0, 0.52, 0, 0, lectern);
box(0.55, 0.06, 0.28, M.woodDark, 0, 0.09, 0, 0, lectern);
const deskTop = box(0.62, 0.05, 0.5, M.wood, 0, 1.12, 0, 0, lectern);
deskTop.rotation.x = -0.42;
const tomeStack = new THREE.Group(); tomeStack.position.set(0, 1.19, -0.04); tomeStack.rotation.x = -0.42; lectern.add(tomeStack);
[0, 1, 2].forEach(i =>
  box(0.4 - i * 0.02, 0.07, 0.3 - i * 0.012, M.stack, (R() - 0.5) * 0.02, i * 0.072, (R() - 0.5) * 0.02, (R() - 0.5) * 0.2, tomeStack));
const tomeGlow = sprite(1.2, 0, 0.25, 0, tomeStack, 0.9);
const tomeLight = new THREE.PointLight(0xffb84a, 16, 6, 2);
tomeLight.position.set(0, 0.6, 0.2); lectern.add(tomeLight);

// aisle lanterns (hanging) — the library's main light
const libLights = [];
[-9.4, -12.2, -15].forEach((z) => {
  const lamp = new THREE.Group(); lamp.position.set(AX, LIB.H - 0.9, z); scene.add(lamp);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), M.iron);
  cable.position.y = 0.45; lamp.add(cable);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 12), M.brass);
  shade.position.y = -0.12; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.flame);
  bulb.position.y = -0.26; lamp.add(bulb);
  sprite(0.85, 0, -0.3, 0, lamp, 0.7);
  const L = new THREE.PointLight(0xffbb55, 85, 14, 2);
  L.position.set(0, -0.55, 0); lamp.add(L);
  libLights.push(L);
});

/* ---- corridor II→III (z -16.9 … -19.7, on the axis) ---- */
const corr2Floor = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.0), M.floor);
corr2Floor.rotation.x = -Math.PI / 2; corr2Floor.position.set(AX, 0.001, -18.3); scene.add(corr2Floor);
box(0.18, 2.7, 3.0, M.wall, AX - 0.98, 1.35, -18.3);
box(0.18, 2.7, 3.0, M.wall, AX + 0.98, 1.35, -18.3);
box(2.1, 0.2, 3.0, M.wall, AX, 2.7, -18.3);
const torch2 = new THREE.Group(); torch2.position.set(AX + 0.86, 1.9, -18.1); scene.add(torch2);
const t2flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), M.flame);
t2flame.position.set(-0.1, 0.1, 0); torch2.add(t2flame);
box(0.07, 0.3, 0.07, M.iron, -0.06, -0.08, 0, -0.3, torch2);
sprite(0.55, -0.1, 0.12, 0, torch2, 0.6);
const torch2Light = new THREE.PointLight(0xff8f35, 12, 8, 2);
torch2Light.position.set(-0.2, 0.15, 0); torch2.add(torch2Light);

/* ---- VAULT III — THE GRAND TREASURE (z -19.7 … -25.9, x AX±3.7, H 4.3) ---- */
const V3 = { minX: AX - 3.7, maxX: AX + 3.7, minZ: -25.9, maxZ: -19.7, H: 4.3 };
// front wall around Door III
box(2.75, V3.H, 0.2, M.frieze, AX - 2.32, V3.H / 2, -19.7);
box(2.75, V3.H, 0.2, M.frieze, AX + 2.32, V3.H / 2, -19.7);
box(1.9, V3.H - 2.6, 0.2, M.frieze, AX, 2.6 + (V3.H - 2.6) / 2, -19.7);
box(0.26, 2.8, 0.3, M.goldGlow, AX - 1.02, 1.4, -19.68);
box(0.26, 2.8, 0.3, M.goldGlow, AX + 1.02, 1.4, -19.68);
box(2.3, 0.26, 0.3, M.goldGlow, AX, 2.72, -19.68);
// floor / ceiling / walls (carved frieze stone)
/* The treasure floor is built in four pieces around the hidden stairwell mouth, so the
   stair can genuinely drop through it. STAIR is the single source of truth for the
   opening -- floor pieces, walk zones, the ramp height and the slab all derive from it. */
const STAIR = { x0: AX - 3.25, x1: AX - 2.05, zTop: -21.2, zBot: -24.2, depth: 2.4 };
STAIR.cx = (STAIR.x0 + STAIR.x1) / 2;
STAIR.cz = (STAIR.zTop + STAIR.zBot) / 2;
/* Splitting a floor into pieces re-creates the wall problem: PlaneGeometry UVs are 0..1
   per piece, so each piece squeezes the whole texture into its own size and the seams
   show as a change of plank scale. Project from world position instead, exactly as the
   walls do -- which ALSO makes the secret slab vanish, because its stone lines up with
   the floor around it instead of sitting there as an obvious rectangle. */
const FLOOR_REF = 7.8;
function worldFloorUVs(geo, x0, x1, z0, z1) {
  const uv = geo.attributes.uv;                            // plane: 4 verts, TL TR BL BR
  const u0 = x0 / FLOOR_REF, u1 = x1 / FLOOR_REF;
  const v0 = z0 / FLOOR_REF, v1 = z1 / FLOOR_REF;
  uv.setXY(0, u0, v1); uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
  uv.needsUpdate = true;
}
function floorSlab(x0, x1, z0, z1, parent) {               // z0 = far, z1 = near
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  worldFloorUVs(geo, x0, x1, z0, z1);
  const m = new THREE.Mesh(geo, M.floor);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2);
  (parent || scene).add(m); return m;
}
const V3F = { x0: AX - 3.9, x1: AX + 3.9, z0: -26.1, z1: -19.5 };
const v3Floor  = floorSlab(STAIR.x1, V3F.x1, V3F.z0, V3F.z1);        // everything right of it
const v3FloorL = floorSlab(V3F.x0, STAIR.x0, V3F.z0, V3F.z1);        // thin strip left of it
const v3FloorB = floorSlab(STAIR.x0, STAIR.x1, V3F.z0, STAIR.zBot);  // behind the mouth
const v3FloorF = floorSlab(STAIR.x0, STAIR.x1, STAIR.zTop, V3F.z1);  // in front of the mouth
const v3Ceil = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 6.6), new THREE.MeshStandardMaterial({ map: wallTex, color: 0x5a4630, roughness: 1 }));
v3Ceil.rotation.x = Math.PI / 2; v3Ceil.position.set(AX, V3.H, -22.8); scene.add(v3Ceil);
box(0.2, V3.H, 6.6, M.frieze, V3.minX - 0.1, V3.H / 2, -22.8);
box(0.2, V3.H, 6.6, M.frieze, V3.maxX + 0.1, V3.H / 2, -22.8);
box(7.8, V3.H, 0.2, M.frieze, AX, V3.H / 2, -25.9);
// stone pilasters
[[V3.minX + 0.22, -21.4], [V3.minX + 0.22, -24.3], [V3.maxX - 0.22, -21.4], [V3.maxX - 0.22, -24.3],
 [AX - 2.9, -25.75], [AX + 2.9, -25.75]].forEach(([x, z]) => {
  box(0.42, V3.H, 0.42, M.stonePed, x, V3.H / 2, z);
  box(0.56, 0.16, 0.56, M.stonePed, x, V3.H - 0.08, z);  // capital
  box(0.56, 0.18, 0.56, M.stonePed, x, 0.09, z);         // base
  box(0.5, 0.05, 0.5, M.gold, x, V3.H - 0.2, z);         // gold collar
});
// torch sconces (two lights for the whole room)
[[V3.minX + 0.45, -21.6, 1], [V3.maxX - 0.45, -21.6, -1]].forEach(([x, z, side]) => {
  const tg = new THREE.Group(); tg.position.set(x, 2.35, z); scene.add(tg);
  box(0.08, 0.34, 0.08, M.iron, 0, -0.12, 0, 0, tg);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), M.flame);
  fl.position.set(side * 0.1, 0.12, 0); tg.add(fl);
  sprite(0.6, side * 0.1, 0.14, 0, tg, 0.6);
});
const v3LightA = new THREE.PointLight(0xff9a3a, 26, 11, 2); v3LightA.position.set(V3.minX + 0.7, 2.5, -21.6); scene.add(v3LightA);
const v3LightB = new THREE.PointLight(0xff9a3a, 26, 11, 2); v3LightB.position.set(V3.maxX - 0.7, 2.5, -21.6); scene.add(v3LightB);
// unlit sconce pair deeper in (dressing only)
[[V3.minX + 0.45, -24.6, 1], [V3.maxX - 0.45, -24.6, -1]].forEach(([x, z, side]) => {
  const tg = new THREE.Group(); tg.position.set(x, 2.35, z); scene.add(tg);
  box(0.08, 0.34, 0.08, M.iron, 0, -0.12, 0, 0, tg);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), M.flame);
  fl.position.set(side * 0.1, 0.12, 0); tg.add(fl);
  sprite(0.5, side * 0.1, 0.13, 0, tg, 0.5);
});

// ✦ THE SERIES SEALS — 4 glowing jewel emblems on the back wall (V2–V5 tease)
const sealPulse = [];
SEALS.forEach((s, i) => {
  const x = AX - 2.25 + i * 1.5;
  box(0.78, 1.06, 0.07, M.woodDark, x, 2.25, -25.84);
  box(0.84, 0.07, 0.09, M.gold, x, 2.79, -25.84);
  box(0.84, 0.07, 0.09, M.gold, x, 1.71, -25.84);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.88),
    new THREE.MeshBasicMaterial({ map: sealTexture(s.a, s.b), transparent: false }));
  plane.position.set(x, 2.25, -25.79);
  plane.userData = { kind: 'seals', label: 'Four more secrets — the hunt continues' };
  scene.add(plane); sealPulse.push(plane);
  const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: s.light, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  gs.scale.setScalar(1.15); gs.position.set(x, 2.25, -25.65); scene.add(gs); sealPulse.push(gs);
});
const sealsWall = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.2), new THREE.MeshBasicMaterial({ visible: false }));
sealsWall.position.set(AX, 2.25, -25.78); scene.add(sealsWall);
sealsWall.userData = { kind: 'seals', label: 'Four more secrets — the hunt continues' };

// stone pedestals: manuscripts + a small cracked puzzle-chest with cryptex
function pedestal(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(0.62, 0.12, 0.62, M.stonePed, 0, 0.06, 0, 0, g);
  box(0.46, 0.85, 0.46, M.stonePed, 0, 0.545, 0, 0, g);
  box(0.58, 0.08, 0.58, M.stonePed, 0, 1.0, 0, 0, g);
  return g;
}
const pedA = pedestal(AX - 1.15, -22.2);
[0, 1, 2].forEach(i => box(0.4 - i * 0.03, 0.075, 0.3 - i * 0.02, i === 2 ? M.chestWood2 : M.woodDark, (R() - 0.5) * 0.03, 1.08 + i * 0.076, 0, (R() - 0.5) * 0.3, pedA));
const pedB = pedestal(AX + 1.15, -22.7);
const pbChest = propPuzzleChest(M.chestWood2); pbChest.scale.setScalar(1.15); pbChest.position.y = 1.04; pedB.add(pbChest);

// ✦ THE GRAND REWARD — the great cracked-open chest, center back (clickable)
const chestG = new THREE.Group(); chestG.position.set(AX, 0, -24.5); scene.add(chestG);
chestG.userData = { kind: 'chest', label: 'The Grand Vault — claim it all' };
box(0.95, 0.5, 0.6, M.chestWood, 0, 0.25, 0, 0, chestG);
[-0.3, 0, 0.3].forEach(x => box(0.07, 0.54, 0.64, M.gold, x, 0.27, 0, 0, chestG));
const lid3 = new THREE.Group(); lid3.position.set(0, 0.5, -0.3); lid3.rotation.x = -1.9; chestG.add(lid3);
box(0.95, 0.16, 0.6, M.chestWood, 0, 0.08, 0.3, 0, lid3);
[-0.3, 0, 0.3].forEach(x => box(0.07, 0.18, 0.64, M.gold, x, 0.09, 0.3, 0, lid3));
const hoardMat = new THREE.MeshStandardMaterial({ color: 0xd9a940, emissive: 0xcf8a20, emissiveIntensity: 1.0, roughness: 0.5 });
const chestInner = box(0.85, 0.1, 0.5, hoardMat, 0, 0.48, 0, 0, chestG); // glowing hoard
const chestGlow = sprite(1.35, 0, 0.7, 0, chestG, 0.7);
const chestLight = new THREE.PointLight(0xffc25a, 22, 8, 2);
chestLight.position.set(0, 1.0, 0.2); chestG.add(chestLight);
// combination dial on the chest front — the "puzzle-locked" cue
const cdial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 18), M.gold);
cdial.rotation.x = Math.PI / 2; cdial.position.set(0, 0.28, 0.33); chestG.add(cdial);

// two smaller cracked chests + scattered coins & gems (restrained, per Dan's note)
[[AX - 1.9, -23.6, 0.5, M.chestWood], [AX + 1.75, -23.9, -0.7, M.chestWood2]].forEach(([x, z, ry, mat]) => {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
  box(0.6, 0.34, 0.4, mat, 0, 0.17, 0, 0, c);
  [-0.19, 0.19].forEach(bx => box(0.05, 0.38, 0.44, M.gold, bx, 0.19, 0, 0, c));
  const lid = new THREE.Group(); lid.position.set(0, 0.34, -0.2); lid.rotation.x = -1.2; c.add(lid);
  box(0.6, 0.1, 0.4, mat, 0, 0.05, 0.2, 0, lid);
  box(0.5, 0.05, 0.3, M.glowStrip, 0, 0.31, 0.02, 0, c);
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), M.gold);
  d.rotation.x = Math.PI / 2; d.position.set(0, 0.17, 0.22); c.add(d);
});
// coins (instanced)
const coinGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.014, 12);
const coins = new THREE.InstancedMesh(coinGeo, M.coin, 90);
const cm = new THREE.Matrix4(), ce = new THREE.Euler(), cq = new THREE.Quaternion(), cs = new THREE.Vector3(1, 1, 1);
const coinSpots = [[AX, -24.1, 1.1], [AX - 1.9, -23.3, 0.55], [AX + 1.75, -23.6, 0.55]];
for (let i = 0; i < 90; i++) {
  const [sx, sz, sr] = coinSpots[i % coinSpots.length];
  const a = R() * 6.3, r = Math.sqrt(R()) * sr;
  ce.set((R() - 0.5) * 0.7, R() * 6.3, (R() - 0.5) * 0.7); cq.setFromEuler(ce);
  cm.compose(new THREE.Vector3(sx + Math.cos(a) * r, 0.012 + R() * 0.02, sz + Math.sin(a) * r * 0.8), cq, cs);
  coins.setMatrixAt(i, cm);
}
scene.add(coins);
// gems in the four series colors
for (let i = 0; i < 16; i++) {
  const gm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028 + R() * 0.022, 0), GEMS[i % 4]);
  const [sx, sz, sr] = coinSpots[i % coinSpots.length];
  const a = R() * 6.3, r = Math.sqrt(R()) * (sr + 0.25);
  gm.position.set(sx + Math.cos(a) * r, 0.05, sz + Math.sin(a) * r * 0.8);
  gm.rotation.set(R() * 3, R() * 3, R() * 3); scene.add(gm);
}
// a fallen cryptex by the great chest
const fallenCx = propCryptex(); fallenCx.position.set(AX + 0.75, 0, -24.15); fallenCx.rotation.y = 1.1; scene.add(fallenCx);

// the unlit lantern — the hidden fourth door's keyhole (Phase-2 payoff, wired to the word box)
const lantern = new THREE.Group(); lantern.position.set(V3.minX + 0.55, 0, -25.3); lantern.rotation.y = 0.7; scene.add(lantern);
lantern.userData = { kind: 'fourth', label: 'Something unlit… waiting' };
box(0.16, 0.02, 0.16, M.iron, 0, 0.01, 0, 0, lantern);
[[-0.065, -0.065], [0.065, -0.065], [-0.065, 0.065], [0.065, 0.065]].forEach(([x, z]) => box(0.016, 0.24, 0.016, M.iron, x, 0.14, z, 0, lantern));
box(0.17, 0.03, 0.17, M.iron, 0, 0.26, 0, 0, lantern);
const lringM = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), M.iron);
lringM.position.y = 0.3; lantern.add(lringM);
const lglass = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.11), new THREE.MeshStandardMaterial({ color: 0x18130c, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 }));
lglass.position.y = 0.14; lantern.add(lglass);
const lanternGlim = sprite(0.22, 0, 0.14, 0, lantern, 0.0); // dark until noticed… then the faintest breath of light

// Series Wall Gallery of original still pictures behind the chest in Vault III
makeFramedPicture('/art/door-v10.webp', 0.9, 1.3, AX - 2.1, 2.4, -25.35);
makeFramedPicture('/art/door-v2.webp', 0.9, 1.3, AX - 1.05, 2.4, -25.35);
makeFramedPicture('/art/og-door.jpg', 1.1, 1.5, AX, 2.5, -25.35);
makeFramedPicture('/art/door-v4.webp', 0.9, 1.3, AX + 1.05, 2.4, -25.35);
makeFramedPicture('/art/door-v5.webp', 0.9, 1.3, AX + 2.1, 2.4, -25.35);
const galleryLight = new THREE.PointLight(0xffd47a, 20, 8, 2);
galleryLight.position.set(AX, 3.2, -24.5); scene.add(galleryLight);

/* ---- VAULT IV -- THE SECRET SANCTUM, now BENEATH the treasure vault ----
   Dan's call: no wall passage and no teleport. A slab in the floor grinds aside and a
   stone stair goes down. It is walkable in BOTH directions -- nothing is ever locked
   behind you. Everything below lives in sanctumG, one storey down. */
const V4Y = -STAIR.depth;
const sanctumG = new THREE.Group(); sanctumG.position.y = V4Y; scene.add(sanctumG);

// -- the flight: 12 steps over a 3m run and a 2.4m drop (~39 degrees)
const STEPS = 12, RUN = (STAIR.zTop - STAIR.zBot) / STEPS, RISE = STAIR.depth / STEPS;
const stairG = new THREE.Group(); scene.add(stairG);
for (let i = 0; i < STEPS; i++) {
  const treadY = -RISE * (i + 1);
  const z = STAIR.zTop - (i + 0.5) * RUN;
  box(STAIR.x1 - STAIR.x0, 0.26, RUN + 0.015, M.stonePed, STAIR.cx, treadY - 0.13, z, 0, stairG);
  // a worn brass nosing catches the light so each tread reads on the way down
  box(STAIR.x1 - STAIR.x0 - 0.1, 0.012, 0.03, M.brass, STAIR.cx, treadY + 0.007, z - RUN / 2 + 0.02, 0, stairG);
}
// shaft walls, so you descend through cut rock rather than mid-air
const SHAFT_H = STAIR.depth + 0.3, SHAFT_L = STAIR.zTop - STAIR.zBot + 0.5;
box(0.16, SHAFT_H, SHAFT_L, M.wall, STAIR.x0 - 0.08, -SHAFT_H / 2 + 0.02, STAIR.cz, 0, stairG);
box(0.16, SHAFT_H, SHAFT_L, M.wall, STAIR.x1 + 0.08, -SHAFT_H / 2 + 0.02, STAIR.cz, 0, stairG);
box(STAIR.x1 - STAIR.x0 + 0.32, SHAFT_H, 0.16, M.wall, STAIR.cx, -SHAFT_H / 2 + 0.02, STAIR.zTop + 0.08, 0, stairG);
// a raised kerb around the mouth so nobody steps into an invisible hole
const KERB = 0.09;
box(STAIR.x1 - STAIR.x0 + 0.3, KERB, 0.14, M.stonePed, STAIR.cx, KERB / 2, STAIR.zTop + 0.07, 0, stairG);
box(0.14, KERB, STAIR.zTop - STAIR.zBot, M.stonePed, STAIR.x0 - 0.07, KERB / 2, STAIR.cz, 0, stairG);
box(0.14, KERB, STAIR.zTop - STAIR.zBot, M.stonePed, STAIR.x1 + 0.07, KERB / 2, STAIR.cz, 0, stairG);
// light spilling up out of the opening -- the first thing you see when it grinds aside
const stairLight = new THREE.PointLight(0xffc472, 0, 7, 2);
stairLight.position.set(STAIR.cx, -STAIR.depth + 1.1, STAIR.zBot + 0.6); scene.add(stairLight);
// a bracket lamp just inside the mouth: something to walk toward on the way down,
// and the reason the shaft is not pitch black the moment the slab moves
const stairSconce = new THREE.Group(); stairSconce.position.set(STAIR.x1 - 0.06, -0.55, STAIR.zTop - 0.55);
stairG.add(stairSconce);
box(0.06, 0.16, 0.06, M.iron, 0, 0, 0, 0, stairSconce);
box(0.12, 0.05, 0.12, M.brass, -0.07, 0.09, 0, 0, stairSconce);
const stairFlame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 8), M.flame);
stairFlame.position.set(-0.07, 0.17, 0); stairSconce.add(stairFlame);
const stairSconceLight = new THREE.PointLight(0xffb559, 0, 3.6, 2);
stairSconceLight.position.set(-0.07, 0.2, 0); stairSconce.add(stairSconceLight);
stairG.visible = false;                                   // hidden until the slab moves

// -- the slab hiding it: flush flagstone, indistinguishable until it moves
const slab = new THREE.Group(); scene.add(slab);
slab.position.set(STAIR.cx, -0.055, STAIR.cz);
box(STAIR.x1 - STAIR.x0 + 0.02, 0.11, STAIR.zTop - STAIR.zBot + 0.02, M.stonePed, 0, 0, 0, 0, slab);
// its face carries the SAME world-projected stone as the floor it sits in, so while it is
// shut there is nothing to see -- the lantern is the only way to know it is there.
const slabTop = floorSlab(STAIR.x0, STAIR.x1, STAIR.zBot, STAIR.zTop, slab);
slabTop.position.set(0, 0.056, 0);

// -- the tunnel from the stair foot through to the sanctum (under the treasure floor)
const tunG = new THREE.Group(); scene.add(tunG); tunG.visible = false;
const tunZ0 = -26.1, tunZ1 = STAIR.zBot, tunMid = (tunZ0 + tunZ1) / 2, tunLen = tunZ1 - tunZ0;
box(STAIR.x1 - STAIR.x0 + 0.3, 0.12, tunLen, M.floor, STAIR.cx, V4Y - 0.06, tunMid, 0, tunG);
box(0.16, 2.0, tunLen, M.wall, STAIR.x0 - 0.08, V4Y + 1.0, tunMid, 0, tunG);
box(0.16, 2.0, tunLen, M.wall, STAIR.x1 + 0.08, V4Y + 1.0, tunMid, 0, tunG);
box(STAIR.x1 - STAIR.x0 + 0.3, 0.14, tunLen, M.wall, STAIR.cx, V4Y + 2.0, tunMid, 0, tunG);

const v4Floor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.3), M.floor);
v4Floor.rotation.x = -Math.PI / 2; v4Floor.position.set(AX, 0.001, -28.55); sanctumG.add(v4Floor);
const v4Ceil = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.3), new THREE.MeshStandardMaterial({ map: wallTex, color: 0x4a3420, roughness: 0.95 }));
v4Ceil.rotation.x = Math.PI / 2; v4Ceil.position.set(AX, 2.75, -28.55); sanctumG.add(v4Ceil);
box(0.2, 2.75, 5.3, M.frieze, AX - 3.2, 1.375, -28.55, 0, sanctumG);
box(0.2, 2.75, 5.3, M.frieze, AX + 3.2, 1.375, -28.55, 0, sanctumG);
box(6.4, 2.75, 0.2, M.frieze, AX, 1.375, -31.2, 0, sanctumG);
// front wall of the sanctum, with the tunnel mouth cut out of it
box(STAIR.x0 - (AX - 3.2), 2.75, 0.2, M.frieze, ((AX - 3.2) + STAIR.x0) / 2, 1.375, -26.1, 0, sanctumG);
box((AX + 3.2) - STAIR.x1, 2.75, 0.2, M.frieze, (STAIR.x1 + (AX + 3.2)) / 2, 1.375, -26.1, 0, sanctumG);
box(STAIR.x1 - STAIR.x0, 0.75, 0.2, M.frieze, STAIR.cx, 2.375, -26.1, 0, sanctumG);

// Master Altar Tapestry of original still art on the back wall of Vault IV
makeFramedPicture('/art/door-v10.webp', 3.8, 2.5, AX, 1.5, -31.05, 0, sanctumG);
// dialled back from 35: the ceiling is 2.75m here, not 4.2m, so the lamp sits far closer
const sanctumLight = new THREE.PointLight(0xffd47a, 16, 7.5, 2);
sanctumLight.position.set(AX, V4Y + 1.9, -29.5); scene.add(sanctumLight);

/* ---- THE KEEPER'S REGISTER ----
   A polished slab on the sanctum's left wall carrying the carved initials of everyone
   who found the fourth word. Initials only, 2-3 letters -- the server enforces it, the
   Apps Script behind it enforces it again, and the fiction explains it: nobody carves
   their full name into vault stone. */
const wallCanvas = document.createElement('canvas');
wallCanvas.width = 1024; wallCanvas.height = 472;
const wallTexReg = new THREE.CanvasTexture(wallCanvas);
wallTexReg.colorSpace = THREE.SRGBColorSpace;
let wallMarks = [], wallCount = 0;
function drawRegister() {
  const g = wallCanvas.getContext('2d');
  const W = wallCanvas.width, H = wallCanvas.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#41301d'); grad.addColorStop(1, '#241708');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(217,168,80,0.55)'; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28);
  g.strokeStyle = 'rgba(217,168,80,0.22)'; g.lineWidth = 1; g.strokeRect(24, 24, W - 48, H - 48);
  g.textAlign = 'center';
  try { g.letterSpacing = '7px'; } catch (e) { /* older canvas */ }
  g.fillStyle = '#d9a850'; g.font = '600 34px Cinzel, serif';
  g.fillText("THE KEEPER'S REGISTER", W / 2, 72);
  g.fillStyle = 'rgba(232,213,174,0.55)'; g.font = 'italic 21px "Cormorant Garamond", serif';
  try { g.letterSpacing = '1px'; } catch (e) { /* older canvas */ }
  g.fillText('those who found what was never lit', W / 2, 106);
  const marks = wallMarks.slice(-240);
  if (marks.length) {
    const areaTop = 138, areaH = H - areaTop - 56;
    const cols = Math.max(6, Math.ceil(Math.sqrt(marks.length * 2.6)));
    const rows = Math.max(1, Math.ceil(marks.length / cols));
    const cw = (W - 70) / cols, ch = areaH / rows;
    const fpx = Math.max(15, Math.min(42, ch * 0.6, cw / 2.3));
    g.font = '600 ' + fpx + 'px Cinzel, serif';
    try { g.letterSpacing = '2px'; } catch (e) { /* older canvas */ }
    marks.forEach((m, i) => {
      const cx = 35 + (i % cols) * cw + cw / 2;
      const cy = areaTop + Math.floor(i / cols) * ch + ch / 2;
      const j = (i * 2654435761 % 97) / 97;              // stable per-slot jitter
      g.save();
      g.translate(cx + (j - 0.5) * 6, cy + (j - 0.5) * 5);
      g.rotate((j - 0.5) * 0.09);
      g.fillStyle = 'rgba(255,214,150,0.3)';             // chisel light on the lower edge
      g.fillText(m, 0, 1.8);
      g.fillStyle = '#150c04';                            // the cut itself
      g.fillText(m, 0, 0);
      g.restore();
    });
  }
  g.font = 'italic 19px "Cormorant Garamond", serif';
  g.fillStyle = 'rgba(217,168,80,0.7)';
  g.fillText(wallCount > 0
    ? (wallCount === 1 ? 'one mark, cut into the stone' : wallCount + ' marks, cut into the stone')
    : 'the stone is bare — be the first', W / 2, H - 30);
  wallTexReg.needsUpdate = true;
}
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('600 34px Cinzel'), document.fonts.load('italic 21px "Cormorant Garamond"')])
    .then(drawRegister).catch(drawRegister);
} else drawRegister();
const wall4 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.75),
  new THREE.MeshStandardMaterial({ map: wallTexReg, roughness: 0.62, metalness: 0.08 }));
wall4.rotation.y = Math.PI / 2;
wall4.position.set(AX - 3.08, 1.35, -28.9);
wall4.userData = { kind: 'wall4', label: "The Keeper's register" };
sanctumG.add(wall4);
const wallLamp = new THREE.PointLight(0xffca70, 7, 4.5, 2);
wallLamp.position.set(AX - 2.3, V4Y + 2.2, -28.9); scene.add(wallLamp);
let wallFetched = false;
function fetchWall() {
  if (wallFetched) return;
  wallFetched = true;
  fetch('/api/carve').then((r) => r.json()).then((d) => {
    if (d && d.ok) { wallMarks = d.marks || []; wallCount = d.count || 0; drawRegister(); }
  }).catch(() => { /* the wall stays bare; carving may still work */ });
}

// central golden pedestal holding the Master Secret Tome
const ped4 = pedestal(AX, -28.5); sanctumG.add(ped4);
const masterTome = new THREE.Group(); masterTome.position.set(0, 1.05, 0); ped4.add(masterTome);
masterTome.userData = { kind: 'masterTome', label: "The Secret Sanctum — Master Reward" };
box(0.48, 0.09, 0.36, M.stack, 0, 0.05, 0, 0, masterTome);
sprite(1.5, 0, 0.3, 0, masterTome, 0.95);
const mtLight = new THREE.PointLight(0xffd47a, 9, 4.5, 2);
mtLight.position.set(0, 0.5, 0); masterTome.add(mtLight);

/* ---- THE LAMP, LIT (fourth-vault keystone) ----
   The reward line promises "you found what was never lit." So the fourth vault's light
   IS a lantern, hung above the reward, finally burning. The generic sanctum fill was
   dialled down (16 -> 6) so this reads as the true source of the room's warmth. */
sanctumLight.intensity = 6;
const hangL = new THREE.Group(); hangL.position.set(AX, 2.75, -28.5); sanctumG.add(hangL);
const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), M.iron);
chain.position.y = -0.31; hangL.add(chain);
const lanternBody = new THREE.Group(); lanternBody.position.y = -0.78; hangL.add(lanternBody);
box(0.19, 0.03, 0.19, M.iron, 0, 0.13, 0, 0, lanternBody);          // cap
box(0.17, 0.03, 0.17, M.iron, 0, -0.15, 0, 0, lanternBody);         // base
[[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]].forEach(([x, z]) =>
  box(0.016, 0.28, 0.016, M.iron, x, -0.01, z, 0, lanternBody));    // corner posts
const lantGlass = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.14),
  new THREE.MeshStandardMaterial({ color: 0xffcf82, emissive: 0xffb347, emissiveIntensity: 1.6, transparent: true, opacity: 0.82 }));
lantGlass.position.y = -0.01; lanternBody.add(lantGlass);
const lantFlame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), M.flame);
lantFlame.position.y = -0.03; lanternBody.add(lantFlame);
sprite(0.95, 0, -0.01, 0, lanternBody, 0.5);                        // soft halo
const lantLight = new THREE.PointLight(0xffc266, 22, 6.5, 2);
lantLight.position.y = -0.02; lanternBody.add(lantLight);
const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), M.iron);
ringM.position.y = 0.16; ringM.rotation.x = Math.PI / 2; lanternBody.add(ringM);

/* ---- THE KEEPER'S THREE LETTERS, with the gilded acrostic ----
   Post-solve reveal on the right wall: three framed letters, one gilded capital at the
   start of seven thoughts. Read down, they are the acrostic the P.S. promised. The
   capitals are stored as SEPARATE characters and drawn one at a time -- the answer word
   never exists as a string in this bundle. */
const ACROSTIC = [
  { cap: 'L', rest: 'ong before this vault was ever sealed,' },
  { cap: 'A', rest: ' puzzle, I always believed, should not end.' },
  { cap: 'N', rest: 'ever did I make an easy thing look hard.' },
  { cap: 'T', rest: 'hose who look twice will always find more.' },
  { cap: 'E', rest: 'very shaded square was a choice, not chance.' },
  { cap: 'R', rest: 'emember this: the looking was the secret.' },
  { cap: 'N', rest: 'ow you hold what almost no one ever will.' },
];
const lettersCanvas = document.createElement('canvas');
lettersCanvas.width = 1024; lettersCanvas.height = 460;
const lettersTex = new THREE.CanvasTexture(lettersCanvas);
lettersTex.colorSpace = THREE.SRGBColorSpace;
function drawLetters() {
  const g = lettersCanvas.getContext('2d'), W = lettersCanvas.width, H = lettersCanvas.height;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#efe2c4'); grad.addColorStop(1, '#dcc79c');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,86,32,0.55)'; g.lineWidth = 3; g.strokeRect(16, 16, W - 32, H - 32);
  g.textAlign = 'left';
  g.fillStyle = '#5a4020'; g.font = 'italic 24px "Cormorant Garamond", serif';
  g.textAlign = 'center';
  g.fillText("From the Keeper's three letters", W / 2, 52);
  g.textAlign = 'left';
  const x0 = 70, top = 92, lh = (H - top - 46) / ACROSTIC.length;
  ACROSTIC.forEach((row, i) => {
    const y = top + i * lh + lh * 0.5;
    g.font = '700 40px Cinzel, serif';
    g.fillStyle = '#b8860b';                                  // the gilded capital
    g.fillText(row.cap, x0, y + 6);
    const capW = g.measureText(row.cap).width;
    g.font = 'italic 27px "Cormorant Garamond", serif';
    g.fillStyle = 'rgba(60,44,20,0.78)';                      // the faded rest
    g.fillText(row.rest, x0 + capW + 2, y);
  });
  g.textAlign = 'center';
  g.font = 'italic 20px "Cormorant Garamond", serif';
  g.fillStyle = 'rgba(120,86,32,0.85)';
  g.fillText('one letter, hidden at the start of every thought', W / 2, H - 24);
  lettersTex.needsUpdate = true;
}
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('italic 27px "Cormorant Garamond"')])
    .then(drawLetters).catch(drawLetters);
} else drawLetters();
const letters4 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.7),
  new THREE.MeshStandardMaterial({ map: lettersTex, roughness: 0.85 }));
letters4.rotation.y = -Math.PI / 2;
letters4.position.set(AX + 3.08, 1.4, -28.5);
letters4.userData = { kind: 'letters4', label: "The Keeper's three letters" };
sanctumG.add(letters4);
// a gold frame + its own soft lamp so it reads as a hung document, not a poster
box(0.06, 1.86, 3.96, M.goldGlow, AX + 3.14, 1.4, -28.5, 0, sanctumG);
const lettersLamp = new THREE.PointLight(0xffe0a0, 5, 4, 2);
lettersLamp.position.set(AX + 2.3, V4Y + 2.2, -28.5); scene.add(lettersLamp);

/* ---- THE CORSAIR'S CHART, under a dust cloth ----
   Volume II as an OBJECT in the room, not a button: an easel holding a covered board,
   the cloth half-thrown so a corner of a sea-chart shows. Clicking teases Vol II. */
const easel = new THREE.Group(); easel.position.set(AX - 2.25, 0, -30.25);
easel.rotation.y = 0.62; sanctumG.add(easel);
box(0.05, 1.5, 0.05, M.woodDark, -0.32, 0.75, 0.1, 0.12, easel);    // front legs
box(0.05, 1.5, 0.05, M.woodDark, 0.32, 0.75, 0.1, -0.12, easel);
box(0.05, 1.55, 0.05, M.woodDark, 0, 0.77, -0.28, 0, easel);        // rear leg
box(0.72, 0.05, 0.05, M.woodDark, 0, 0.62, 0.08, 0, easel);         // ledge
const chartBoard = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.02, 0.04), M.woodDark);
chartBoard.position.set(0, 1.12, 0.03); chartBoard.rotation.x = -0.09; easel.add(chartBoard);
// a corner of the chart peeking out from under the cloth
const chartFace = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.96),
  new THREE.MeshStandardMaterial({ map: paperTexA, color: 0xcaa870, roughness: 0.9 }));
chartFace.position.set(0, 1.12, 0.052); chartFace.rotation.x = -0.09; easel.add(chartFace);
// the dust cloth, thrown over most of it
const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.8, 0.14),
  new THREE.MeshStandardMaterial({ color: 0x9a8d6f, roughness: 1 }));
cloth.position.set(0, 1.32, 0.02); cloth.rotation.x = -0.09; easel.add(cloth);
box(0.98, 0.5, 0.13, new THREE.MeshStandardMaterial({ color: 0x8a7d60, roughness: 1 }), 0, 1.02, 0.02, 0, easel);
// brass plate on the ledge
box(0.4, 0.02, 0.08, M.brass, 0, 0.66, 0.11, 0, easel);
const chart4 = new THREE.Group(); chart4.position.copy(easel.position);
chart4.userData = { kind: 'chart', label: 'Something half-covered on an easel' };
// invisible click target sized to the whole easel
const chartHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.6),
  new THREE.MeshBasicMaterial({ visible: false }));
chartHit.position.set(0, 0.9, 0); chart4.add(chartHit);
chart4.rotation.y = 0.62; sanctumG.add(chart4);


/* ---- THE KEEPER'S STORY: 9 scattered manuscript pages ----------------------
   Dan's parked idea, built 2026-07-28. Numbered pages lie about all three rooms;
   clicking one lifts it up readable and the Keeper reads it aloud. The numbers are
   deliberately NOT in room order (Study 1,4,7 / Library 2,5,8 / Treasure 3,6,9) so
   assembling the story means walking the whole crawl. Purely optional lore — it never
   gates a reward. Finding all 9 unlocks a final letter that teases Volume II.
   Copy lives in site/_content/keeper-story-pages.md. NEVER contains a secret word. */
const STORY_SPOTS = [
  // [pageNo, x, z, rotY]  — on the floor, tucked beside furniture, never blocking a path
  [1,  1.95, -1.35,  0.5],   // study: by the desk's far corner
  [4, -2.55,  1.05, -0.7],   // study: near the bookcases, behind you on entry
  [7,  2.35,  2.15,  1.2],   // study: back corner by the entrance frame
  [2, LIB.minX + 1.25, -9.9,  0.35],  // library: left aisle
  [5, LIB.maxX - 1.25, -13.6, -0.5],  // library: right aisle, deeper
  [8, AX + 0.15,       -15.9,  0.9],  // library: far end near corridor II
  [3, V3.minX + 1.15, -21.2,  0.6],   // treasure: left of the first pedestals
  [6, V3.maxX - 1.15, -23.9, -0.4],   // treasure: right, near the chests
  [9, AX + 0.2,       -25.35, 1.1],   // treasure: beneath the seals wall
];
const storyPages = [];
STORY_SPOTS.forEach(([no, x, z, ry]) => {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  g.userData = { kind: 'page', pageNo: no, label: 'A page in the Keeper’s hand' };
  // the sheet itself, a hair off the floor so it never z-fights
  const sheet = box(0.30, 0.006, 0.40, M.paperA, 0, 0.012, 0, 0, g);
  sheet.rotation.x = 0.02;
  // a second sheet slightly askew reads as "loose papers", not a floor decal
  box(0.28, 0.005, 0.37, M.paperB, 0.02, 0.007, 0.015, 0.22, g);
  // soft glow so it's findable without shouting
  const gl = sprite(0.85, 0, 0.10, 0, g, 0.30);
  g.userData.glow = gl;
  storyPages.push(g);
});
/* ---- dust motes ---- */
const dustN = REDUCED ? 0 : 280;
let dust = null;
if (dustN) {
  const pos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { // motes across all three rooms
    pos[i * 3] = -6.3 + R() * 10; pos[i * 3 + 1] = 0.2 + R() * 3.2; pos[i * 3 + 2] = -25.5 + R() * 29;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd9a860, size: 0.012, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);
}

/* ---- lights ---- */
scene.add(new THREE.AmbientLight(0x4a2e12, 1.15));
const hemi = new THREE.HemisphereLight(0x8a5c2c, 0x120a04, 0.62);
scene.add(hemi);
const doorwayLight = new THREE.PointLight(0xffc060, 22, 9, 2); // glow spilling from the entrance
doorwayLight.position.set(0, 2.2, 3.6); scene.add(doorwayLight);

/* ================= audio (ported from the landing) ================= */
let actx = null, master = null, ambient = null, audioReady = false, muted = false;
function initAudio() {
  if (audioReady) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain(); master.gain.value = muted ? 0 : 0.9;
  master.connect(actx.destination);
  audioReady = true;
}
function makeNoise() {
  const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
}
/* ---- THE VAULT SOUNDSCAPE (redesigned 2026-07-22 per Dan: the old 55Hz sawtooth
   hum read as "hospital fluorescent lights"). Now: a hollow cavern room-tone,
   slow breathing air drafts, echoing water drips, and a deep sub rumble —
   crossfaded per room as you walk. All synthesized, no files. ---- */
function makeNoiseFor(ctx) {
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
}
function buildAmbience(ctx, dest) {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(dest);
  // hollow room tone — air through twin resonant "cavern" filters, slowly wandering
  const noise = makeNoiseFor(ctx);
  const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 145; bp1.Q.value = 5.5;
  const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 410; bp2.Q.value = 9;
  const roomG = ctx.createGain(); roomG.gain.value = 0.05;
  noise.connect(bp1); bp1.connect(roomG); noise.connect(bp2); bp2.connect(roomG); roomG.connect(bus);
  const wander = ctx.createOscillator(); wander.type = 'sine'; wander.frequency.value = 0.045;
  const wG = ctx.createGain(); wG.gain.value = 60; wander.connect(wG); wG.connect(bp2.frequency);
  // moving air — soft low noise, breathing on a very slow cycle
  const noise2 = makeNoiseFor(ctx);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
  const airG = ctx.createGain(); airG.gain.value = 0.012;
  noise2.connect(lp); lp.connect(airG); airG.connect(bus);
  const breath = ctx.createOscillator(); breath.type = 'sine'; breath.frequency.value = 0.07;
  const bG = ctx.createGain(); bG.gain.value = 0.008; breath.connect(bG); bG.connect(airG.gain);
  // deep vault rumble — felt more than heard
  const rum = ctx.createOscillator(); rum.type = 'sine'; rum.frequency.value = 33;
  const rumG = ctx.createGain(); rumG.gain.value = 0.025; rum.connect(rumG); rumG.connect(bus);
  // drip chain — each drip echoes down the stone
  const dripBus = ctx.createGain(); dripBus.gain.value = 0.3; dripBus.connect(bus);
  const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.34;
  const dlLp = ctx.createBiquadFilter(); dlLp.type = 'lowpass'; dlLp.frequency.value = 1300;
  const fb = ctx.createGain(); fb.gain.value = 0.4;
  dripBus.connect(dl); dl.connect(dlLp); dlLp.connect(fb); fb.connect(dl); dlLp.connect(bus);
  function spawnDrip(t, loud = 1) {
    const p = 480 + Math.random() * 1300;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(p * 2.7, t);
    o.frequency.exponentialRampToValueAtTime(p, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((0.24 + Math.random() * 0.16) * loud, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(pan); pan.connect(dripBus);
    } else g.connect(dripBus);
    o.start(t); o.stop(t + 0.25);
  }
  // candle crackle (study only) — tiny warm ticks
  const crackG = ctx.createGain(); crackG.gain.value = 0; crackG.connect(bus);
  function spawnCrack(t) {
    const len = Math.floor(ctx.sampleRate * 0.025);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = b;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 2500;
    const g = ctx.createGain(); g.gain.value = 0.25 + Math.random() * 0.5;
    s.connect(hp); hp.connect(g); g.connect(crackG); s.start(t);
  }
  // gold shimmer (treasure vault only) — the faintest bell partials, very rare
  const shimG = ctx.createGain(); shimG.gain.value = 0; shimG.connect(bus);
  function spawnShimmer(t) {
    [2600, 3920].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + Math.random() * 0.01);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(shimG); o.start(t); o.stop(t + 1.2);
    });
  }
  noise.start(); noise2.start(); wander.start(); breath.start(); rum.start();
  // per-room mixes (crossfaded with setTargetAtTime as the player walks)
  const PROFILES = {
    study:    { room: 0.045, air: 0.008, drip: 0.2,  rum: 0.018, crack: 0.05, shim: 0 },
    corridor: { room: 0.06,  air: 0.02,  drip: 0.62, rum: 0.03,  crack: 0,    shim: 0 },
    library:  { room: 0.035, air: 0.01,  drip: 0.2,  rum: 0.022, crack: 0,    shim: 0 },
    treasure: { room: 0.05,  air: 0.012, drip: 0.5,  rum: 0.04,  crack: 0,    shim: 0.9 },
  };
  function setRoom(key, tc = 1.6) {
    const p = PROFILES[key], t = ctx.currentTime;
    roomG.gain.setTargetAtTime(p.room, t, tc);
    airG.gain.setTargetAtTime(p.air, t, tc);
    dripBus.gain.setTargetAtTime(p.drip, t, tc);
    rumG.gain.setTargetAtTime(p.rum, t, tc);
    crackG.gain.setTargetAtTime(p.crack, t, tc);
    shimG.gain.setTargetAtTime(p.shim, t, tc);
  }
  return { bus, setRoom, spawnDrip, spawnCrack, spawnShimmer };
}
function startAmbient() {
  if (!audioReady || ambient) return;
  ambient = buildAmbience(actx, master);
  ambient.setRoom('study', 0.4);
  ambient.bus.gain.linearRampToValueAtTime(0.85, actx.currentTime + 3);
  (function dripLoop() {
    if (!ambient) return;
    if (actx.state === 'running') ambient.spawnDrip(actx.currentTime + 0.05);
    ambient.dripT = setTimeout(dripLoop, 2200 + Math.random() * 5600);
  })();
  (function crackLoop() {
    if (!ambient) return;
    if (actx.state === 'running' && ambRoom === 'study') ambient.spawnCrack(actx.currentTime + 0.02);
    ambient.crackT = setTimeout(crackLoop, 90 + Math.random() * 480);
  })();
  (function shimLoop() {
    if (!ambient) return;
    if (actx.state === 'running' && ambRoom === 'treasure') ambient.spawnShimmer(actx.currentTime + 0.05);
    ambient.shimT = setTimeout(shimLoop, 14000 + Math.random() * 18000);
  })();
}
function playBoom(gain = 1) {
  if (!audioReady || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  const og = actx.createGain();
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.7 * gain, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0006, t + 0.9);
  o.connect(og).connect(master); o.start(t); o.stop(t + 1.0);
  const crackLen = actx.sampleRate * 0.25;
  const cbuf = actx.createBuffer(1, crackLen, actx.sampleRate); const cd = cbuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / crackLen);
  const csrc = actx.createBufferSource(); csrc.buffer = cbuf;
  const cf = actx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 900; cf.Q.value = 0.9;
  const cg = actx.createGain(); cg.gain.setValueAtTime(0.5 * gain, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  csrc.connect(cf).connect(cg).connect(master); csrc.start(t);
  [740, 1180, 1980].forEach((f, i) => {
    const ro = actx.createOscillator(); ro.type = 'triangle'; ro.frequency.value = f;
    const rg = actx.createGain();
    rg.gain.setValueAtTime(0.0001, t + 0.01); rg.gain.exponentialRampToValueAtTime(0.06 * gain / (i + 1), t + 0.03); rg.gain.exponentialRampToValueAtTime(0.0005, t + 0.5 + i * 0.08);
    ro.connect(rg).connect(master); ro.start(t + 0.01); ro.stop(t + 0.7);
  });
}
function playUnlock() {
  if (!audioReady || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.5);
  const og = actx.createGain();
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0008, t + 1.3);
  o.connect(og).connect(master); o.start(t); o.stop(t + 1.4);
  [130.81, 196.0, 261.63].forEach((f) => {
    const osc = actx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(0.07, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.3);
    osc.connect(g).connect(master); osc.start(t + 0.05); osc.stop(t + 2.4);
  });
}
// stone-on-stone groan for the bookcase swing
function playCreak() {
  if (!audioReady || muted) return;
  const t = actx.currentTime;
  const noise = makeNoise();
  const bf = actx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 6;
  bf.frequency.setValueAtTime(160, t); bf.frequency.linearRampToValueAtTime(90, t + 1.4);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.15);
  g.gain.linearRampToValueAtTime(0.1, t + 1.1); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  noise.connect(bf).connect(g).connect(master); noise.start(t); noise.stop(t + 1.7);
  const o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(32, t + 1.4);
  const og = actx.createGain();
  og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.08, t + 0.2); og.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
  o.connect(og).connect(master); o.start(t); o.stop(t + 1.7);
}
function playThud() { // locked door
  if (!audioReady || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.45);
}
function setMuted(m) {
  muted = m;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (currentVO) { try { currentVO.pause(); } catch (e) {} }
  if (master && actx) master.gain.setTargetAtTime(m ? 0 : 0.9, actx.currentTime, 0.03);
  if (actx) { if (m) actx.suspend(); else actx.resume(); }
  document.getElementById('muteBtn').textContent = m ? '🔇' : '🔊';
}
document.getElementById('muteBtn').addEventListener('click', () => setMuted(!muted));

/* ---- the Keeper (captions + VO files w/ browser-TTS fallback, landing pattern) ---- */
// NOTE: none of these lines may ever contain a secret word — this text ships to every
// visitor's view-source. (The canon "Clever. Yes…" lines live only in the book/VO doc.)
const VO = {
  entry:   { file: '/audio/vo/vo_vault1_entry.wav',   text: 'So… you found my first word. Take what the first door guarded.' },
  reward1: { file: '/audio/vo/vo_vault1_reward.wav',  text: 'Fifty puzzles, yours — no word, no name, no price. The first door is open.' },
  door2:   { file: '/audio/vo/vo_vault2_door.wav',    text: "The fire took my second plate. But you read my letter anyway… didn't you? Say the word." },
  libentry:{ file: '/audio/vo/vo_lib_entry.wav',      text: 'My library. Every puzzle I ever loved… and a hundred more, waiting at the stand.' },
  reward2: { file: '/audio/vo/vo_vault2_reward.wav',  text: 'One hundred more. My letter chose its reader well.' },
  door3:   { file: '/audio/vo/vo_vault3_door.wav',    text: 'Step back three… and step inside.' },
  v3entry: { file: '/audio/vo/vo_v3_entry.wav',       text: 'The heart of my vault. Everything here was locked by a puzzle… and opened by one.' },
  finale:  { file: '/audio/vo/vo_vault3_finale.wav',  text: 'Three words, three doors — and you spoke them all. The vault is yours… but a Keeper always keeps one secret more.' },
  fourth:  { file: '/audio/vo/vo_fourth.wav',         text: 'What flickers at the start of every thought?' },
  fail1:   { file: '/audio/vo/vo_fail_1.wav',         text: 'That is not the word I sealed it with.' },
  fail2:   { file: '/audio/vo/vo_fail_2.wav',         text: 'Close… or not close at all. I will never tell.' },
  fail3:   { file: '/audio/vo/vo_fail_3.wav',         text: 'Stubborn. Good — but perhaps you need my hints.' },
  // The Keeper's Story — 9 scattered pages + the final letter (see _content/keeper-story-pages.md)
  page1:   { file: '/audio/vo/vo_page1.wav', text: 'I was not always a keeper of vaults. I was a maker of puzzles, and a poor one, in a room exactly this size.' },
  page2:   { file: '/audio/vo/vo_page2.wav', text: 'My first hundred were rubbish. I burned them. My second hundred were worse, so I kept those — a man should remember what bad work looks like.' },
  page3:   { file: '/audio/vo/vo_page3.wav', text: 'The trouble with a good puzzle is that it ends. You solve it, you set it down, and the solving is gone forever. I wanted one that kept going.' },
  page4:   { file: '/audio/vo/vo_page4.wav', text: 'So I began hiding a second puzzle inside the first. A number here. A shaded square there. Nothing a solver would notice — until they noticed everything.' },
  page5:   { file: '/audio/vo/vo_page5.wav', text: 'They told me no one would look. They were right, mostly. But “mostly” is a wonderful word. It leaves a door open.' },
  page6:   { file: '/audio/vo/vo_page6.wav', text: 'I built this vault for the ones who look twice. Everything in it was locked by a puzzle, and every lock was made to be opened — eventually, by somebody stubborn.' },
  page7:   { file: '/audio/vo/vo_page7.wav', text: 'A confession: I hid one more thing than I ever announced. Not in the grids. In the letters. In the way a sentence begins.' },
  page8:   { file: '/audio/vo/vo_page8.wav', text: 'Read the openings. That is all the help I will give, and it is more than I gave anyone else.' },
  page9:   { file: '/audio/vo/vo_page9.wav', text: 'If you are reading this, you did not simply solve my book. You searched it. That is the rarer thing, and this vault knows the difference.' },
  pagefinal:{ file: '/audio/vo/vo_pagefinal.wav', text: 'Nine pages, and you found every one. Most never look up from the grid. So here is the truth of it: the puzzles were never the secret. The looking was.' },
};
let currentVO = null, capTimer = null;
function showCaption(text, holdMs = 5200) {
  capText.textContent = text;
  capText.classList.add('show');
  clearTimeout(capTimer);
  capTimer = setTimeout(() => capText.classList.remove('show'), holdMs);
}
// ONE voice only — the Keeper's recorded lines, preloaded and unlocked on the
// first real tap so mobile autoplay rules can never block them. If a file
// truly can't play, the caption carries the line in silence: NEVER a
// browser-TTS impostor voice (that mismatch is exactly what Dan rejected).
const VO_PLAYERS = {};
for (const [k, line] of Object.entries(VO)) {
  const a = new Audio(line.file + '?v=3');   // v3 = the true reference voice (bm_george)
  a.preload = 'auto'; a.volume = 0.95;
  VO_PLAYERS[k] = a;
}
let voUnlocked = false;
function unlockVO() {          // must be called from inside a genuine user gesture
  if (voUnlocked) return; voUnlocked = true;
  Object.values(VO_PLAYERS).forEach((a) => {
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
                      .catch(() => { a.muted = false; });
    else a.muted = false;
  });
}
renderer.domElement.addEventListener('pointerdown', unlockVO, { once: true });
function keeper(key) {
  const line = VO[key]; if (!line) return;
  showCaption(line.text, 6500);
  if (muted) return;
  const a = VO_PLAYERS[key];
  try { a.currentTime = 0; } catch (e) {}
  a.play().then(() => { currentVO = a; }).catch(() => { /* caption carries it */ });
}
function silenceAll() {
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  try { if (currentVO) currentVO.pause(); } catch (e) {}
  try { if (actx && actx.state === 'running') actx.suspend(); } catch (e) {}
}
window.addEventListener('pagehide', silenceAll);
window.addEventListener('beforeunload', silenceAll);

/* ================= movement / interaction ================= */
const player = { pos: new THREE.Vector3(0, 0, 3.0), target: new THREE.Vector3(0, 0, 2.6) };
let yaw = 0, pitch = -0.02;
let pendingAction = null;      // fires when the glide arrives
let rewardGiven = false, doorOpened = false;
let door2Open = false, door3Open = false, door4Open = false;
let seenLib = false, seenV3 = false, seenV4 = false;
let ambT = 0, ambRoom = 'study';
const roomNameEl = document.getElementById('roomName');

// Walkable world = a union of zones, each gated by story progress.
const ZONES = [
  { minX: -3.55, maxX: 3.55, minZ: -3.5, maxZ: 3.45, ok: () => true },                          // the study
  { minX: CORR.minX, maxX: CORR.maxX, minZ: -6.95, maxZ: -3.5, ok: () => doorAmt > 0.85 },      // corridor I
  { minX: AX - 0.5, maxX: AX + 0.5, minZ: -8.1, maxZ: -6.95, ok: () => door2Open },             // through Door II
  { minX: LIB.minX + 0.75, maxX: LIB.maxX - 0.75, minZ: -16.55, maxZ: -8.1, ok: () => door2Open }, // the library
  { minX: AX - 0.62, maxX: AX + 0.62, minZ: -19.15, maxZ: -16.55, ok: () => door2Open },        // corridor II
  { minX: AX - 0.5, maxX: AX + 0.5, minZ: -20.3, maxZ: -19.15, ok: () => door3Open },           // through Door III
  // the treasure vault, in three pieces so nobody stands on the stairwell opening
  { minX: STAIR.x1, maxX: V3.maxX - 0.45, minZ: -25.45, maxZ: -20.3, ok: () => door3Open },
  { minX: V3.minX + 0.45, maxX: STAIR.x0, minZ: -25.45, maxZ: -20.3, ok: () => door3Open },
  { minX: STAIR.x0, maxX: STAIR.x1, minZ: -25.45, maxZ: STAIR.zBot, ok: () => door3Open },
  { minX: STAIR.x0, maxX: STAIR.x1, minZ: STAIR.zTop, maxZ: -20.3, ok: () => door3Open },
  // ...except while the slab is still closed, when it is simply floor
  { minX: STAIR.x0, maxX: STAIR.x1, minZ: STAIR.zBot, maxZ: STAIR.zTop, ok: () => !door4Open },
  // the stair, the tunnel at its foot, and the sanctum -- open in BOTH directions
  { minX: STAIR.x0 + 0.1, maxX: STAIR.x1 - 0.1, minZ: STAIR.zBot, maxZ: STAIR.zTop, ok: () => door4Open },
  { minX: STAIR.x0 + 0.1, maxX: STAIR.x1 - 0.1, minZ: -26.1, maxZ: STAIR.zBot, ok: () => door4Open },
  { minX: AX - 2.8, maxX: AX + 2.8, minZ: -30.8, maxZ: -26.1, ok: () => door4Open },
];
const OBSTACLES = [
  { x: 0.5, z: -0.55, r: 1.55 },                                   // desk + chair
  { x: 3.05, z: -3.0, r: 0.6 },                                    // the Chart's easel
  { x: AX + 1.7, z: -11.6, r: 0.72 },                              // lectern
  { x: AX - 2.2, z: -8.6, r: 1.0 }, { x: AX + 2.2, z: -8.6, r: 1.0 }, // library counters
  { x: AX - 1.95, z: -10.7, r: 1.25 }, { x: AX + 1.95, z: -13.9, r: 1.25 }, // aisle stacks
  { x: AX - 1.15, z: -22.2, r: 0.55 }, { x: AX + 1.15, z: -22.7, r: 0.55 }, // pedestals
  { x: AX, z: -24.5, r: 0.88 },                                    // the grand chest
  { x: AX - 1.9, z: -23.6, r: 0.62 }, { x: AX + 1.75, z: -23.9, r: 0.62 }, // side chests
  { x: AX, z: -28.5, r: 0.65 },                                    // master pedestal
  { x: AX - 2.25, z: -30.25, r: 0.55 },                            // the Corsair's Chart easel
];
/* How high the ground is under a given spot. Everything above y=0 is the vaults proper;
   only the stair, its tunnel and the sanctum go below, and only once the slab has moved.
   The stair is treated as a smooth ramp underfoot while it RENDERS as real steps --
   standard practice, and it keeps the descent from juddering tread by tread. */
function floorYAt(x, z) {
  if (!door4Open) return 0;
  const inShaft = x > STAIR.x0 - 0.25 && x < STAIR.x1 + 0.25;
  if (inShaft && z <= STAIR.zTop && z >= STAIR.zBot) {
    return -STAIR.depth * ((STAIR.zTop - z) / (STAIR.zTop - STAIR.zBot));
  }
  if (inShaft && z < STAIR.zBot && z > -26.1) return -STAIR.depth;   // the tunnel
  if (z <= -26.1) return -STAIR.depth;                                // the sanctum
  return 0;
}
function clampPos(p) {
  if (seated) { p.x = 0.2; p.z = -1.3; return p; }
  let bx = 0, bz = 0, bd = Infinity;
  for (const z of ZONES) {
    if (!z.ok()) continue;
    const cx = THREE.MathUtils.clamp(p.x, z.minX, z.maxX);
    const cz = THREE.MathUtils.clamp(p.z, z.minZ, z.maxZ);
    const d = (p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz);
    if (d < bd) { bd = d; bx = cx; bz = cz; }
  }
  p.x = bx; p.z = bz;
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
    if (d < o.r && d > 1e-4) { p.x = o.x + dx / d * o.r; p.z = o.z + dz / d * o.r; }
  }
  return p;
}
function moveTo(x, z, action = null) {
  player.target.set(x, 0, z); clampPos(player.target);
  pendingAction = action;
}
function stepForward(dist) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  moveTo(player.pos.x + dir.x * dist, player.pos.z + dir.z * dist);
}

/* ---- pointer: drag = look, tap = interact/walk ---- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const interactables = [stack, hinge, door2, door3, wall4, letters4, chart4, lectern, chestG, masterTome, sealsWall, lantern,
  candle, ink, quill, board, sconce, chair, notebook, easelS, ...rejects, ...wallCases,
  ...storyPages,
  ...sealPulse.filter(o => o.isMesh)];
let down = null, dragging = false;
const overlayOpen = () => !rewardEl.hidden || !document.getElementById('wordbox').hidden
  || !document.getElementById('pageview').hidden || !document.getElementById('desk').hidden
  || !document.getElementById('notebook').hidden || !document.getElementById('draft').hidden;

function pick(clientX, clientY, targets) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(targets, true);
}
function findKind(obj) {
  let o = obj;
  while (o) { if (o.userData && o.userData.kind) return o; o = o.parent; }
  return null;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw, pitch };
  dragging = false; holdWalk = false;
  renderer.domElement.setPointerCapture(e.pointerId);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {           // held still → start walking toward the finger
    if (down && !dragging) { holdWalk = true; walkToward(down.lastX ?? down.x, down.lastY ?? down.y); }
  }, 240);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (down) {
    down.lastX = e.clientX; down.lastY = e.clientY;
    if (holdWalk) { walkToward(e.clientX, e.clientY); return; }  // finger steers the destination
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 9) dragging = true;
    if (dragging) {
      yaw = down.yaw - dx * 0.0034;
      pitch = THREE.MathUtils.clamp(down.pitch - dy * 0.0026, -0.75, 0.6);
    }
    return;
  }
  // hover highlight
  const hits = pick(e.clientX, e.clientY, interactables);
  const hit = hits.length ? findKind(hits[0].object) : null;
  if (hit) {
    labelEl.textContent = hit.userData.label;
    labelEl.style.display = 'block';
    labelEl.style.left = e.clientX + 'px';
    labelEl.style.top = e.clientY + 'px';
    document.body.style.cursor = 'pointer';
  } else {
    labelEl.style.display = 'none';
    document.body.style.cursor = '';
  }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  clearTimeout(holdTimer);
  if (holdWalk) { holdWalk = false; walkRing.visible = false; down = null; dragging = false; return; }
  const wasDrag = dragging || !down || (performance.now() - down.t) > 500;
  down = null; dragging = false;
  if (wasDrag) return;
  // 1) interactables first
  const hits = pick(e.clientX, e.clientY, interactables);
  const hit = hits.length ? findKind(hits[0].object) : null;
  if (hit) { activate(hit.userData.kind, hit); return; }
  // 2) otherwise walk to the tapped floor point
  const fhits = pick(e.clientX, e.clientY, [floor, corrFloor, libFloor, corr2Floor, v3Floor]);
  if (fhits.length) moveTo(fhits[0].point.x, fhits[0].point.z);
});
addEventListener('wheel', (e) => { if (!overlayOpen()) stepForward(e.deltaY < 0 ? 1.3 : -1.0); }, { passive: true });
addEventListener('keydown', (e) => {
  if (overlayOpen()) return;   // typing a word must never walk the player
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') stepForward(1.3);
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') stepForward(-1.0);
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') yaw += 0.22;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') yaw -= 0.22;
});
document.getElementById('fwdBtn').addEventListener('click', () => stepForward(1.3));

/* ---- press-and-hold to walk: hold the floor and you glide toward your finger,
   and keep following it as it slides. A quick swipe still looks around. ---- */
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (IS_TOUCH) {
  hintEl.textContent = 'Drag to look · hold the floor to walk · tap what glows';
  hintEl.style.display = 'block';
}
// glowing destination ring on the floor while holding
const walkRing = new THREE.Mesh(
  new THREE.RingGeometry(0.14, 0.2, 24),
  new THREE.MeshBasicMaterial({ color: 0xf6b23c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
);
walkRing.rotation.x = -Math.PI / 2; walkRing.position.y = 0.02; walkRing.visible = false;
scene.add(walkRing);
let holdWalk = false, holdTimer = null;
function walkToward(cx, cy) {
  const fhits = pick(cx, cy, [floor, corrFloor, libFloor, corr2Floor, v3Floor]);
  if (fhits.length) {
    moveTo(fhits[0].point.x, fhits[0].point.z);
    walkRing.position.set(player.target.x, 0.02, player.target.z);
    walkRing.visible = true;
  }
}

/* ---- rewards (one panel, three gifts) ---- */
const REWARDS = {
  I: {
    kicker: "THE KEEPER'S FIRST GIFT", title: 'FIFTY PUZZLES, YOURS',
    text: "No word, no name, no price. Fifty easy puzzles from the Keeper's own desk — the first door is open.",
    btn: 'Download the 50 puzzles (PDF)', file: '/rewards/PuzzleSecret-Vault-I-50-Easy.pdf', vo: 'reward1',
  },
  II: {
    kicker: 'THE SECOND GIFT', title: 'ONE HUNDRED MORE',
    text: 'A hundred medium puzzles, bound for the readers of my letter. The library approves of you.',
    btn: 'Download the 100 puzzles (PDF)', file: '/rewards/PuzzleSecret-Vault-II-100-Medium.pdf', vo: 'reward2',
  },
  III: {
    kicker: 'THE GRAND VAULT IS YOURS', title: 'TWO HUNDRED — AND THE HUNT GOES ON',
    text: 'Two hundred hard puzzles, the deepest hoard. And on the wall behind you… four seals, four secrets still to come.',
    btn: 'Download the 200 puzzles (PDF)', file: '/rewards/PuzzleSecret-Vault-III-200-Hard.pdf', vo: 'finale',
    ask: true,   // they finished the hard act - the one moment worth asking
  },
  IV: {
    kicker: "THE KEEPER'S SECRET SANCTUM", title: 'TWENTY MASTER PUZZLES',
    text: "You found what was never lit, and decoded what was never written. Twenty master puzzles from the Keeper's private collection.",
    btn: 'Download the 20 Master Puzzles (PDF)', file: '/rewards/PuzzleSecret-Secret-Vault-20-Master.pdf', vo: 'fourth',
    ask: true,   // found the hidden fourth word - the most invested solver there is
  },
};
const rewardsGiven = {};
let sealFlareT = -99;
/* ---- The Keeper's Story: reading + progress ---------------------------------
   Progress lives in localStorage so a reload never costs you the hunt. Pages are
   pure lore: they gate nothing, and finding all nine earns the final letter. */
const STORY_KEY = 'ps_story_v1';
const PAGE_WORDS = {
  1: 'I was not always a keeper of vaults. I was a maker of puzzles — and a poor one — in a room exactly this size.',
  2: 'My first hundred were rubbish. I burned them. My second hundred were worse, so I kept those — a man should remember what bad work looks like.',
  3: 'The trouble with a good puzzle is that it ends. You solve it, you set it down, and the solving is gone forever. I wanted one that kept going.',
  4: 'So I began hiding a second puzzle inside the first. A number here. A shaded square there. Nothing a solver would notice — until they noticed everything.',
  5: 'They told me no one would look. They were right, mostly. But “mostly” is a wonderful word. It leaves a door open.',
  6: 'I built this vault for the ones who look twice. Everything in it was locked by a puzzle, and every lock was made to be opened — eventually, by somebody stubborn.',
  7: 'A confession: I hid one more thing than I ever announced. Not in the grids. In the letters. In the way a sentence begins.',
  8: 'Read the openings. That is all the help I will give — and it is more than I gave anyone else.',
  9: 'If you are reading this, you did not simply solve my book. You searched it. That is the rarer thing, and this vault knows the difference.',
};
const FINAL_LETTER =
  'Nine pages, and you found every one. Most never look up from the grid. So here is the truth of it: ' +
  'the puzzles were never the secret — the looking was. Keep the habit. I have hidden another chart, ' +
  'another seam, another door. The Corsair’s Chart is already being drawn, and it will not be kinder than this one. — The Keeper';
const NUM_WORD = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

function loadStory() {
  try { const v = JSON.parse(localStorage.getItem(STORY_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveStory(list) {
  try { localStorage.setItem(STORY_KEY, JSON.stringify(list)); } catch { /* private mode — fine */ }
}
let pagesFound = loadStory();

const pageviewEl = document.getElementById('pageview');
function openPage(no) {
  if (!pagesFound.includes(no)) { pagesFound.push(no); saveStory(pagesFound); }
  const n = pagesFound.length;
  document.getElementById('pgNo').textContent = 'PAGE ' + (NUM_WORD[no] || no);
  document.getElementById('pgBody').textContent = PAGE_WORDS[no];
  const roomOf = no <= 0 ? null : [[1, 4, 7], [2, 5, 8], [3, 6, 9]].find((r) => r.includes(no));
  const inRoom = roomOf ? roomOf.filter((p) => pagesFound.includes(p)).length : 0;
  document.getElementById('pgFound').textContent =
    n >= 9 ? 'All nine pages found' : ('Found in this room: ' + inRoom + ' of 3 · nine pages lie across the vaults');
  markFound('p' + no);
  pageviewEl.hidden = false;
  keeper('page' + no);
  dimPage(no);
  if (n >= 9 && !pagesFound.includes('final')) {
    // the payoff: hand over the final letter a beat after this page finishes
    setTimeout(() => {
      document.getElementById('pgNo').textContent = 'THE KEEPER’S LAST PAGE';
      document.getElementById('pgBody').textContent = FINAL_LETTER;
      document.getElementById('pgFound').textContent = 'The story is complete';
      keeper('pagefinal');
      burstConfetti();
      pagesFound.push('final'); saveStory(pagesFound);
    }, 2600);
  }
}
function dimPage(no) {
  const g = storyPages.find((p) => p.userData.pageNo === no);
  if (g && g.userData.glow) g.userData.glow.material.opacity = 0.08;  // read = quiet, still visible
}
// pages already read in a past visit start dimmed
pagesFound.forEach((n) => { if (typeof n === 'number') dimPage(n); });
document.getElementById('pageClose').addEventListener('click', () => { pageviewEl.hidden = true; });

function openReward(act) {
  const RW = REWARDS[act];
  document.getElementById('rwKicker').textContent = RW.kicker;
  document.getElementById('rwTitle').textContent = RW.title;
  document.getElementById('rwText').textContent = RW.text;
  const b = document.getElementById('rwBtn'); b.href = RW.file; b.textContent = RW.btn;
  document.getElementById('rwAsk').hidden = !RW.ask;
  rewardEl.hidden = false;
  burstConfetti();
  playUnlock();
  if (!rewardsGiven[act]) { keeper(RW.vo); rewardsGiven[act] = true; }
  if (act === 'III') sealFlareT = simT; // the series wall flares with the finale
  stampVault(act);
}
/* the passport is a RECORD, not a gate — the PDFs stay open to everyone either way */
const VAULT_KEY = 'ps_vaults_v1';
function stampVault(act) {
  try {
    const v = JSON.parse(localStorage.getItem(VAULT_KEY) || '{}');
    if (v[act]) return;                       // already stamped — keep the original date
    v[act] = new Date().toISOString().slice(0, 10);
    localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  } catch { /* private mode — the vault still works, it just won't remember */ }
}
document.getElementById('rewardClose').addEventListener('click', () => {
  rewardEl.hidden = true;
  if (!door2Open) showCaption('Something in the far shelves is… not quite shut.', 5200);
});

/* ---- sealed doors + the word box ---- */
const DOORS = {
  door2: { act: 'II', stand: { x: AX, z: -6.35 }, inside: { x: AX, z: -8.9 },
           kicker: 'THE SECOND DOOR', vo: 'door2', isOpen: () => door2Open, setOpen: () => { door2Open = true; }, obj: door2 },
  door3: { act: 'III', stand: { x: AX, z: -18.55 }, inside: { x: AX, z: -21.0 },
           kicker: 'THE THIRD DOOR', vo: 'door3', isOpen: () => door3Open, setOpen: () => { door3Open = true; }, obj: door3 },
  // The fourth secret has no door object any more -- lanternSuccess() opens the FLOOR.
  fourth: { act: 'IV', stand: { x: V3.minX + 1.2, z: -24.8 }, inside: { x: AX, z: -28.5 },
           kicker: 'THE FOURTH SECRET', vo: 'fourth', isOpen: () => door4Open, setOpen: () => { door4Open = true; }, obj: null },
};
const doorAnims = [];
function openVaultDoor(key) {
  const D = DOORS[key];
  D.setOpen();
  playBoom();
  doorAnims.push({ hg: D.obj, from: D.obj.rotation.y, to: 2.05, start: simT, dur: 2.3 }); // swings away, into the next room
  D.obj.userData.kind = null; // no longer interactable
  setTimeout(() => moveTo(D.inside.x, D.inside.z), 900); // walk through as it swings
}

const wordboxEl = document.getElementById('wordbox');
const tilesEl = document.getElementById('tiles');
const wbInput = document.getElementById('wbInput');
const wbMsg = document.getElementById('wbMsg');
const wbSubmit = document.getElementById('wbSubmit');
const WORD_LEN = 12;                     // the box no longer advertises any word's length
let wbTarget = null, wbWord = '', wbFails = 0, wbBusy = false;
function renderTiles() {
  tilesEl.innerHTML = '';
  const shown = Math.min(WORD_LEN, Math.max(5, wbWord.length + 1));
  for (let i = 0; i < shown; i++) {
    const t = document.createElement('div');
    t.className = 'tile' + (wbWord[i] ? ' filled' : '');
    t.textContent = wbWord[i] || '';
    tilesEl.appendChild(t);
  }
}
function openWordbox(key) {
  wbTarget = key; wbWord = ''; wbBusy = false;
  document.getElementById('wbKicker').textContent = DOORS[key].kicker;
  document.getElementById('wbLine').textContent = VO[DOORS[key].vo].text;
  wbMsg.textContent = ''; renderTiles();
  wordboxEl.hidden = false;
  wbInput.value = ''; wbInput.style.pointerEvents = 'auto'; wbInput.focus();
  keeper(DOORS[key].vo);
}
function closeWordbox() { wordboxEl.hidden = true; wbTarget = null; }
document.getElementById('wbCancel').addEventListener('click', closeWordbox);
function wbSet(w) {
  wbWord = w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, WORD_LEN);
  renderTiles();
}
wbInput.addEventListener('input', () => wbSet(wbInput.value));
addEventListener('keydown', (e) => {
  if (wordboxEl.hidden) return;
  if (e.key === 'Enter') { submitWord(); e.preventDefault(); }
  else if (e.key === 'Escape') closeWordbox();
  else if (e.key === 'Backspace') { wbSet(wbWord.slice(0, -1)); wbInput.value = wbWord; e.preventDefault(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { wbSet(wbWord + e.key); wbInput.value = wbWord; }
  e.stopPropagation();
}, true);
async function submitWord() {
  if (wbBusy || !wbTarget) return;
  if (wbWord.length < 4) {
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
    return;
  }
  wbBusy = true; wbSubmit.textContent = 'The vault is listening…';
  let j = null;
  try {
    const r = await fetch('/api/unlock', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: wbWord, vid: psVid() }),
    });
    j = await r.json();
  } catch (e) { /* offline / static preview */ }
  wbBusy = false; wbSubmit.textContent = 'Open the door';
  if (!j) { wbMsg.textContent = 'The vault cannot hear you right now — try again in a moment.'; return; }
  const D = DOORS[wbTarget];
  if (j.ok && j.act === D.act) {
    const key = wbTarget;
    if (key === 'fourth') {
      fourthWord = wbWord;                              // in-memory proof for this session
      try { if (j.carveToken) localStorage.setItem('ps_carve', j.carveToken); } catch (e) {}
    }
    closeWordbox();
    if (key === 'fourth') lanternSuccess();
    else openVaultDoor(key);
  } else if (j.ok) {
    playThud();
    wbMsg.textContent = 'A true word… but it belongs to a different door.';
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
  } else {
    wbFails++;
    playThud();
    const failKey = 'fail' + Math.min(wbFails, 3);
    keeper(failKey);
    wbMsg.innerHTML = wbFails >= 3
      ? 'Perhaps you need <a href="/hints" style="color:var(--gold)">the Keeper’s hints</a>.'
      : VO[failKey].text;
    wbSet('');
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
  }
}
wbSubmit.addEventListener('click', submitWord);
// 🎙 the vault listens — same Web Speech trick as the landing
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const speakBtn = document.getElementById('speakBtn');
if (!SR) speakBtn.style.display = 'none';
else speakBtn.addEventListener('click', () => {
  try {
    const rec = new SR();
    rec.lang = 'en-US'; rec.maxAlternatives = 1;
    speakBtn.classList.add('listening'); speakBtn.textContent = '🎙  Listening…';
    rec.onresult = (e) => {
      const said = (e.results[0][0].transcript || '');
      wbSet(said);
      if (wbWord.length >= 4) submitWord();
    };
    rec.onend = () => { speakBtn.classList.remove('listening'); speakBtn.textContent = '🎙  Speak the word'; };
    rec.onerror = rec.onend;
    rec.start();
  } catch (e) { /* ignore */ }
});
function psVid() {
  try {
    let v = localStorage.getItem('ps_vid');
    if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('ps_vid', v); }
    return v;
  } catch (e) { return ''; }
}
let fourthWord = '';                  // in memory only, never persisted anywhere
/* ---- the carve panel ---- */
const carveboxEl = document.getElementById('carvebox');
const cbInput = document.getElementById('cbInput');
const cbMsg = document.getElementById('cbMsg');
const cbSubmit = document.getElementById('cbSubmit');
let cbBusy = false;
function openCarvebox() {
  cbMsg.textContent = '';
  cbInput.value = '';
  carveboxEl.hidden = false;
  setTimeout(() => { try { cbInput.focus(); } catch (e) {} }, 60);
}
cbInput.addEventListener('input', () => {
  cbInput.value = cbInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
});
document.getElementById('cbCancel').addEventListener('click', () => { carveboxEl.hidden = true; });
cbInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') cbSubmit.click(); });
cbSubmit.addEventListener('click', async () => {
  if (cbBusy) return;
  const initials = cbInput.value;
  if (initials.length < 2) { cbMsg.textContent = 'Two or three letters — no more, no less.'; return; }
  var cbAgeEl = document.getElementById('cbAge');
  if (!cbAgeEl || !cbAgeEl.checked) { cbMsg.textContent = 'Confirm you are 13 or older before you carve.'; return; }
  cbBusy = true; cbSubmit.textContent = 'The chisel bites…';
  let j = null;
  try {
    const r = await fetch('/api/carve', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initials, word: fourthWord, token: (function(){ try { return localStorage.getItem('ps_carve') || ''; } catch (e) { return ''; } })(), vid: psVid() }),
    });
    j = await r.json();
  } catch (e) { /* offline */ }
  cbBusy = false; cbSubmit.textContent = 'Carve it';
  if (!j) { cbMsg.textContent = 'The stone will not take the mark right now. Try again shortly.'; return; }
  if (!j.ok) {
    cbMsg.textContent =
      j.reason === 'bad_initials' ? 'The stone refuses those letters.' :
      j.reason === 'no_proof' ? 'Only those who spoke the fourth word may carve. Find what was never lit, and say it.' :
      j.reason === 'slow_down' ? 'The chisel needs a rest. A moment, please.' :
      'The stone will not take the mark right now. Try again shortly.';
    return;
  }
  try { localStorage.setItem('ps_mark_v1', initials); } catch (e) { /* private mode */ }
  wallMarks.push(initials);
  wallCount = j.count || wallCount + 1;
  drawRegister();
  carveboxEl.hidden = true;
  burstConfetti();
  showCaption('Stone remembers what paper forgets. Yours is mark ' + wallCount + '.', 7000);
});

let slabAnim = null;                  // {start, dur} -- the slab grinding aside
function lanternSuccess() {
  lanternGlim.material.opacity = 1.0;
  door4Open = true;
  stairG.visible = true; tunG.visible = true;
  slabAnim = { start: performance.now(), dur: 2600 };
  playBoom && playBoom();
  burstConfetti();
  fetchWall();
  showCaption('The floor answers. A stair, cut long before this vault was sealed \u2014 go down, and come back up when you please.', 9000);
}
function tickSlab() {
  if (!slabAnim) return;
  const e = Math.min(1, (performance.now() - slabAnim.start) / slabAnim.dur);
  const k = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;   // easeInOutQuad
  slab.position.x = STAIR.cx + k * ((STAIR.x1 - STAIR.x0) + 0.05);   // slides under its neighbours
  slab.position.y = -0.055 - k * 0.16;
  stairLight.intensity = 16 * k;
  stairSconceLight.intensity = 7 * k;
  if (e >= 1) { slabAnim = null; slab.visible = false; }
}

/* ---- what clicking things does ---- */
function goThen(x, z, fn) {
  const d = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (d > 1.2) moveTo(x, z, fn); else fn();
}
function stackWorldPos() { const v = new THREE.Vector3(); stack.getWorldPosition(v); return v; }
function activate(kind, hitObj) {
  if (kind === 'say') {
    const u = hitObj && hitObj.userData || {};
    showCaption(STUDY_SAY[u.say] || '…', 5600);
    if (u.found) markFound(u.found);
    return;
  }
  if (kind === 'candle') {
    goThen(0.9, -1.75, () => {
      setCandle(!candleLit); study.candle = candleLit ? 'on' : 'out'; saveStudy();
      showCaption(candleLit ? STUDY_SAY.candleOn : STUDY_SAY.candleOut, 4200);
      playThud(); markFound('candle');
    });
    return;
  }
  if (kind === 'reject') { const w = hitObj; goThen(w.position.x + (player.pos.x - w.position.x) * 0.35, w.position.z + (player.pos.z - w.position.z) * 0.35, () => openDraft(w.userData.idx)); return; }
  if (kind === 'notebook') { goThen(-0.2, -1.9, () => openNotebook()); return; }
  if (kind === 'chartStudy') { goThen(2.3, -2.3, () => { showCaption(STUDY_SAY.chart, 8000); markFound('chart'); }); return; }
  if (kind === 'chair') { sitAtDesk(); return; }
  if (kind === 'stack') {
    markFound('stack');
    const sp = stackWorldPos();
    const d = Math.hypot(player.pos.x - sp.x, player.pos.z - sp.z);
    if (d > 2.4) {
      const dirx = (player.pos.x - sp.x) / d, dirz = (player.pos.z - sp.z) / d;
      moveTo(sp.x + dirx * 1.9, sp.z + dirz * 1.9, () => openReward('I'));
    } else openReward('I');
  } else if (kind === 'tome') {
    goThen(AX + 0.85, -11.3, () => openReward('II'));
  } else if (kind === 'chest') {
    goThen(AX, -23.4, () => openReward('III'));
  } else if (kind === 'masterTome') {
    goThen(AX, -27.6, () => openReward('IV'));
  } else if (kind === 'bookcase') {
    if (doorAnim || doorAmt > 0.5) return;
    openBookcase();
  } else if (kind === 'door2' || kind === 'door3') {
    const D = DOORS[kind];
    if (D.isOpen()) return;
    goThen(D.stand.x, D.stand.z, () => openWordbox(kind));
  } else if (kind === 'page') {
    // walk most of the way to the page, then lift it and read
    const g = hitObj;
    if (!g || !g.userData.pageNo) return;
    const p = g.position;
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    goThen(p.x + (dx / d) * 0.9, p.z + (dz / d) * 0.9, () => openPage(g.userData.pageNo));
  } else if (kind === 'seals') {
    showCaption('Four seals. Four secrets still to come — the hunt continues beyond this vault.', 6200);
  } else if (kind === 'wall4') {
    goThen(AX - 2.15, -28.9, () => {
      const mine = localStorage.getItem('ps_mark_v1');
      if (mine) {
        showCaption('Your mark — ' + mine + ' — is on this wall' +
          (wallCount > 1 ? ', one of ' + wallCount + '.' : '. The first.'), 6200);
      } else openCarvebox();
    });
  } else if (kind === 'letters4') {
    goThen(AX + 2.2, -28.5, () =>
      showCaption('The secret you cracked, laid bare: one gilded letter at the start of every thought. Read them down.', 8000));
  } else if (kind === 'chart') {
    goThen(AX - 1.7, -29.9, () =>
      showCaption("Under the cloth, a chart still being drawn \u2014 The Corsair's Chart. Volume II. The hunt is not over.", 8000));
  } else if (kind === 'fourth') {
    if (door4Open) {
      // walk them to the head of the stair and let them take it themselves
      goThen(STAIR.cx, STAIR.zTop + 0.9,
        () => showCaption('The stair is open. Walk down \u2014 and back up whenever you like.', 5200));
    } else {
      lanternGlim.material.opacity = 0.5;
      goThen(V3.minX + 1.3, -24.8, () => openWordbox('fourth'));
    }
  }
}
function openBookcase() {
  if (doorAnim || doorAmt >= 1) return;
  doorAnim = { from: hinge.rotation.y, to: -1.62, start: performance.now(), dur: 1700 };
  playCreak();
  setTimeout(() => playBoom(0.5), 1400);
  showCaption('The shelves swing wide — a passage, kept from every map.', 5600);
  hinge.userData.label = 'The way lies open';
  doorOpened = true;
}

/* ================= THE STUDY, ALIVE (2026-09-03) =================
   Object lines, the candle that stays snuffed, the Keeper's Notebook, three rejects that unfold
   into two-answer drafts, the discovery count, and the desk where today's page is played.
   Nothing here gates anything; no line may ever contain an answer word. */
const STUDY_KEY = 'ps_study_v1';
const STUDY_ITEMS = ['stack', 'p1', 'p4', 'p7', 'candle', 'quill', 'board', 'reject0', 'reject1', 'reject2', 'shelf', 'sconce', 'notebook', 'chart', 'desk'];
let study = (() => { try { const v = JSON.parse(localStorage.getItem(STUDY_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } })();
if (!Array.isArray(study.found)) study.found = [];
function saveStudy() { try { localStorage.setItem(STUDY_KEY, JSON.stringify(study)); } catch (e) { /* private mode */ } }
const studyCountEl = document.getElementById('studyCount');
function studyFound() {
  const s = new Set(study.found);
  pagesFound.forEach((p) => { if (p === 1 || p === 4 || p === 7) s.add('p' + p); });
  try { const v = JSON.parse(localStorage.getItem(VAULT_KEY) || '{}'); if (v && v.I) s.add('stack'); } catch (e) {}
  return s;
}
function renderStudyCount() {
  const n = studyFound().size, m = STUDY_ITEMS.length;
  studyCountEl.innerHTML = n >= m ? 'Every one of my things, found' : ('Found <b>' + n + '</b> of ' + m + ' in the study');
}
function markFound(id) {
  if (!STUDY_ITEMS.includes(id) || study.found.includes(id)) { renderStudyCount(); return; }
  study.found.push(id); saveStudy(); renderStudyCount();
  if (studyFound().size >= STUDY_ITEMS.length) setTimeout(() => { showCaption('Every one of my things, and you touched them all. The study is yours as much as mine now.', 7000); burstConfetti(); }, 900);
}
setCandle(study.candle !== 'out');
renderStudyCount();
const STUDY_SAY = {
  quill: 'Every puzzle I ever set began with that nib. Most of them ended in the fire.',
  board: 'Two hundred grids, pinned and re-pinned. Twenty were never quite what they seemed.',
  shelf: 'Books I solved, and books I never will. A keeper collects both.',
  sconce: 'That sconce has burned since before I came. I never asked what feeds it.',
  candleOut: 'Snuffed. The dark is patient.',
  candleOn: 'Lit again. Better.',
  chart: "Under the cloth, a chart still being drawn — The Corsair's Chart. Volume II. It will not be kinder than this one.",
  sit: 'Sit. I set a new page every morning; this one is today’s.',
  rise: 'The page will keep. Come back tomorrow — I will have set another.',
  solved: 'Solved. Tomorrow I will have set another.',
  exit: (n) => 'You are leaving ' + n + ' of my things untouched. They will keep.',
};
/* --- the rejects: three drafts, each with exactly two answers (machine-verified) --- */
const DRAFTS = [
  { g: '0030030100000012', a: '1234432121433412', b: '2134432112433412', note: 'Two answers. Burn it. A grid that cannot make up its mind is not a puzzle — it is a coin toss with numbers on it.' },
  { g: '0040000003002003', a: '3142423113242413', b: '3241413213242413', note: 'I gave it too few clues, and it gave me two truths back. Every one of the two hundred in my book has exactly one. This one has a twin.' },
  { g: '0000300010020040', a: '4123321414322341', b: '4213312414322341', note: 'The deadly rectangle: four cells, two digits, and no way to choose between them. Every setter falls into this hole once. Then never again.' },
];
const draftEl = document.getElementById('draft'), draftGrid = document.getElementById('draftGrid');
let draftCur = 0, draftShow = null;
function drawDraft() {
  const D = DRAFTS[draftCur]; draftGrid.innerHTML = '';
  const fill = draftShow ? D[draftShow] : null;
  const diff = new Set(); for (let i = 0; i < 16; i++) if (D.a[i] !== D.b[i]) diff.add(i);
  for (let i = 0; i < 16; i++) {
    const c = document.createElement('i');
    const given = D.g[i] !== '0';
    c.textContent = given ? D.g[i] : (fill ? fill[i] : '');
    if (!given && fill) c.classList.add('pen');
    if (diff.has(i) && fill) c.classList.add('hot');
    if (i % 4 === 1) c.classList.add('b2'); if (Math.floor(i / 4) === 1) c.classList.add('r2');
    draftGrid.appendChild(c);
  }
  document.getElementById('draftNote').textContent = D.note;
}
function openDraft(idx) {
  draftCur = idx; draftShow = null; drawDraft(); draftEl.hidden = false;
  showCaption('A page I threw away. Look at it and tell me why.', 4800);
  markFound('reject' + idx);
}
document.getElementById('draftA').addEventListener('click', () => { draftShow = 'a'; drawDraft(); });
document.getElementById('draftB').addEventListener('click', () => { draftShow = 'b'; drawDraft(); });
document.getElementById('draftClose').addEventListener('click', () => { draftEl.hidden = true; });
/* --- the Keeper's Notebook: six pages --- */
const NOTEBOOK = [
  '<h4>THE KEEPER’S NOTEBOOK</h4><p>Notes I kept while setting two hundred grids. Take what is useful; leave the rest for the next reader.</p><p>Turn the page.</p>',
  '<h4>I · SPOTTING A KEY</h4><p>Twenty of my grids carry one shaded square. It is never a given — it sits empty and waits for you to solve it honestly. The digit that lands in the shade is the key.</p><p>Copy it to the Vault Door Tally (page 210) before you forget. The plates that turn digits into letters are in the back of the book, pages 211 to 213.</p>',
  '<h4>II · SCANNING</h4><p>Pick a digit that already appears often. Run its rows and columns across the grid like beams of light. Where the beams leave exactly one dark cell in a box, that digit lives there.</p><p>It is the fastest way through my easy grids, and it still works on the hard ones.</p>',
  '<h4>III · THE LONELY CANDIDATE</h4><p>When a cell has only one digit left that could fit, write it and move on. When a digit has only one cell left in a row, a column or a box, it goes there — even if that cell could take others.</p><p>The first rule looks at a cell. The second looks at a digit. Learn to switch between them.</p>',
  '<h4>IV · PAIRS</h4><p>Two cells in the same unit that share the same two candidates own those two digits between them. Strike both digits from every other cell in that unit.</p><p>Pencil marks are not cheating. They are how I set the grids in the first place.</p>',
  '<h4>V · WHAT COMES NEXT</h4><img class="sketch" src="/teasers/v2.webp" alt="A pencil sketch of a sea chart" /><p>The Corsair’s Chart. Volume II. Still being drawn, and it will not be kinder than this one.</p><p>When it is finished, it will be where the first one was.</p>',
];
const nbEl = document.getElementById('notebook'), nbBody = document.getElementById('nbBody'), nbPrev = document.getElementById('nbPrev'), nbNext = document.getElementById('nbNext');
let nbPage = 0;
function drawNotebook() {
  nbBody.innerHTML = NOTEBOOK[nbPage];
  document.getElementById('nbNo').textContent = nbPage === 0 ? 'FROM THE DESK' : ('PAGE ' + NUM_WORD[nbPage] + ' OF FIVE');
  nbPrev.disabled = nbPage === 0; nbNext.disabled = nbPage === NOTEBOOK.length - 1;
  nbPrev.style.opacity = nbPage === 0 ? '.35' : ''; nbNext.style.opacity = nbPage === NOTEBOOK.length - 1 ? '.35' : '';
}
function openNotebook() { nbPage = 0; drawNotebook(); nbEl.hidden = false; markFound('notebook'); showCaption('My notebook. Read it, and the rest of my book will go easier.', 5200); }
nbPrev.addEventListener('click', () => { if (nbPage > 0) { nbPage--; drawNotebook(); } });
nbNext.addEventListener('click', () => { if (nbPage < NOTEBOOK.length - 1) { nbPage++; drawNotebook(); } });
document.getElementById('nbClose').addEventListener('click', () => { nbEl.hidden = true; });
/* --- the desk: sit, and play today's page --- */
const DESK_KEY = 'ps_desk_v1';
let deskState = (() => { try { const v = JSON.parse(localStorage.getItem(DESK_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } })();
if (!deskState.days || typeof deskState.days !== 'object') deskState.days = {};
function saveDesk() { try { const keys = Object.keys(deskState.days).sort(); while (keys.length > 60) delete deskState.days[keys.shift()]; localStorage.setItem(DESK_KEY, JSON.stringify(deskState)); } catch (e) {} }
function localDay() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dayIndex() { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
// one new line every morning — the reason to come back; the grid is the excuse
const DESK_LINES = [
  'Sit. I set a new page every morning; this one is today’s.',
  'A page a day. That is how the two hundred got written, and how they get solved.',
  'This one I set before breakfast. It is kinder than it looks.',
  'Do not rush it. The grid knows when you are guessing.',
  'I set this one in the dark. Forgive the ink.',
  'Today’s page has a mean streak in the middle band. You will find it.',
  'Scan first. Always scan first.',
  'Some days the grid opens like a door. Some days you have to knock.',
  'I nearly threw this one away. Then I saw what it was hiding.',
  'Pencil marks are permitted. I insist on them.',
  'A quiet one, for a quiet morning.',
  'Start with the digit that appears most. It always tells you where it lives next.',
  'This page fought me for an hour. It will fight you for less.',
  'The chair is old. So are the puzzles. Both still hold.',
  'Solve it honestly and it will thank you at the end.',
  'Today’s is one of my favourites. I will not tell you why.',
  'A fair grid has one answer. This one has one. I checked twice.',
  'If the corners give you nothing, try the middle box.',
  'I set this one for someone who never came. Take it.',
  'The candle is short. So is this page.',
  'Look for the pair. There is always a pair.',
  'Not every grid is a fight. This one is a walk.',
  'I write the date on the back of every page. Today’s is the newest.',
  'One page. Then the rest of your day.',
  'The ink was still wet when I left this one. Careful.',
  'The best solvers look twice before they write once.',
  'Today the grid is generous. Tomorrow, less so.',
  'I set this one twice. The first attempt had two answers, and went into the fire.',
  'You may sit as long as you like. The vault does not close.',
  'A page for the ones who look twice.',
];
const deskEl = document.getElementById('desk'), deskFrame = document.getElementById('deskFrame');
let seated = false, eyeTarget = 1.6;
function renderDeskStamps() {
  const n = Object.keys(deskState.days).length, today = deskState.days[localDay()];
  document.getElementById('deskStamps').textContent = (today ? 'TODAY’S PAGE — SOLVED · ' : '') + (n ? n + (n === 1 ? ' PAGE' : ' PAGES') + ' SOLVED AT THIS DESK' : 'NO PAGE SOLVED AT THIS DESK YET');
}
function sitAtDesk() {
  if (seated) return;
  // glide to the chair and settle the eye at the desk; the room stays visible around the page
  seated = true; eyeTarget = 1.25;
  player.target.set(0.2, 0, -1.3); pendingAction = null;
  yaw = -2.85; pitch = -0.42;
  setTimeout(() => {
    document.getElementById('deskLine').textContent = DESK_LINES[dayIndex() % DESK_LINES.length];
    renderDeskStamps();
    if (!deskFrame.src) deskFrame.src = '/play?embed=1&daily=1';
    deskEl.hidden = false;
    showCaption(STUDY_SAY.sit, 5000);
    setTimeout(() => { try { deskFrame.contentWindow.focus(); } catch (e) {} }, 400);
  }, 900);
}
function riseFromDesk() {
  deskEl.hidden = true; seated = false; eyeTarget = 1.6;
  player.target.set(0.1, 0, -2.3); pitch = -0.02;
  showCaption(STUDY_SAY.rise, 4200);
}
document.getElementById('deskRise').addEventListener('click', riseFromDesk);
addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'ps-desk-solved') return;
  const d = localDay();
  if (!deskState.days[d]) { deskState.days[d] = e.data.id; }
  if (e.data.secs && (!deskState.best || e.data.secs < deskState.best)) deskState.best = e.data.secs;
  saveDesk(); renderDeskStamps(); markFound('desk');
  showCaption(STUDY_SAY.solved, 6000); burstConfetti(); playUnlock();
});
let exitSaid = false;

/* ---- confetti (gold, hand-rolled, no library) ---- */
const conf = document.getElementById('confetti');
const cg = conf.getContext('2d');
let confParts = [];
function burstConfetti() {
  conf.width = innerWidth; conf.height = innerHeight;
  confParts = [];
  for (let i = 0; i < 130; i++) {
    confParts.push({
      x: innerWidth / 2, y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 13, vy: -4 - Math.random() * 9,
      s: 3 + Math.random() * 5, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3,
      c: ['#f6b23c', '#ffd37a', '#c9973f', '#fff1cf'][(Math.random() * 4) | 0], life: 1,
    });
  }
}
function tickConfetti(dt) {
  if (!confParts.length) return;
  cg.clearRect(0, 0, conf.width, conf.height);
  confParts.forEach(p => {
    p.vy += 18 * dt; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= dt * 0.4;
    cg.save(); cg.translate(p.x, p.y); cg.rotate(p.r);
    cg.globalAlpha = Math.max(0, p.life);
    cg.fillStyle = p.c; cg.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
    cg.restore();
  });
  confParts = confParts.filter(p => p.life > 0 && p.y < conf.height + 30);
  if (!confParts.length) cg.clearRect(0, 0, conf.width, conf.height);
}

/* ================= entry / gate ================= */
let entered = false;
function begin(withAudio) {
  entered = true;
  try {
    if (!sessionStorage.getItem('ps_visited')) {
      sessionStorage.setItem('ps_visited', '1');
      fetch('/api/visit', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vid: psVid(), mode: '3d' }) }).catch(() => {});
    }
  } catch (e) { /* private mode */ }
  gate.classList.add('gone');
  fadeEl.classList.add('clear');
  if (withAudio) {
    initAudio(); startAmbient(); playBoom();
    setTimeout(() => keeper('entry'), 1300);
  } else {
    showCaption(VO.entry.text, 6500);
  }
  setTimeout(() => { hintEl.style.opacity = '1'; }, 2500);
}
document.getElementById('enterBtn').addEventListener('click', () => { unlockVO(); begin(true); });
// From the landing's opened door there is no gate: the room is simply there. Browsers refuse sound
// before a gesture, so the soundscape and the Keeper's voice start on the first tap or key.
if (FROM_DOOR) {
  begin(false);
  hintEl.textContent = (IS_TOUCH ? 'Tap anywhere for sound · ' : 'Click anywhere for sound · ') + hintEl.textContent;
  hintEl.style.display = 'block';
  const wake = () => {
    unlockVO(); initAudio(); startAmbient();
    hintEl.textContent = IS_TOUCH ? 'Drag to look · hold the floor to walk · tap what glows' : 'Drag to look around · Tap the floor to walk · Click what glows';
    setTimeout(() => keeper('entry'), 400);
  };
  addEventListener('pointerdown', wake, { once: true });
  addEventListener('keydown', wake, { once: true });
}

if (DEBUG_CAM) {
  const [cx, cz, cyaw, cpitch] = DEBUG_CAM.split(',').map(Number);
  player.pos.set(cx || 0, 0, cz || 3);
  player.target.copy(player.pos);
  yaw = cyaw || 0; pitch = cpitch || 0;
  gate.style.display = 'none';
  fadeEl.style.transition = 'none'; fadeEl.style.display = 'none'; // instant — no transition race in headless captures
}
if (FORCE_OPEN) { hinge.rotation.y = -1.62; doorAmt = 1; doorOpened = true; }
if (qs.get('d2') === '1') { door2Open = true; door2.rotation.y = 2.05; door2.userData.kind = null; }
if (qs.get('d3') === '1') { door3Open = true; door3.rotation.y = 2.05; door3.userData.kind = null; }
if (FORCE_PANEL) rewardEl.hidden = false;
if (qs.get('wb') === '1') openWordbox(qs.get('wbk') || 'door2');

/* ================= debug hooks (headless verification) ================= */
window.__vault = {
  scene, camera, renderer,
  player, moveTo, openBookcase, openReward, activate, openWordbox, submitWord,
  floorYAt, get door4Open() { return door4Open; }, STAIR,
  get doorAmt() { return doorAmt; },
  get door2Open() { return door2Open; },
  get door3Open() { return door3Open; },
  forceDoor: (n) => openVaultDoor(n === 3 ? 'door3' : 'door2'), // test-only client force (reveals no words)
  setWord: (w) => wbSet(w),
  walkToward, get holdWalk() { return holdWalk; },     // test hooks for hold-to-walk
  // story-page hooks (test/QA)
  openPage, storyPages,
  get pagesFound() { return pagesFound.slice(); },
  resetStory: () => { pagesFound = []; saveStory(pagesFound); storyPages.forEach(g => { if (g.userData.glow) g.userData.glow.material.opacity = 0.30; }); },
  // offline-render the soundscape and measure it (headless quality loop)
  testAmbience: async (room = 'corridor', secs = 8) => {
    const sr = 44100;
    const octx = new OfflineAudioContext(2, sr * secs, sr);
    const amb = buildAmbience(octx, octx.destination);
    amb.bus.gain.value = 0.85;
    amb.setRoom(room, 0.05);
    for (let dt2 = 1; dt2 < secs - 0.5; dt2 += 2.1) amb.spawnDrip(dt2);
    if (room === 'study') for (let ct = 0.5; ct < secs; ct += 0.3) amb.spawnCrack(ct);
    if (room === 'treasure') amb.spawnShimmer(2);
    const buf = await octx.startRendering();
    const x = buf.getChannelData(0);
    const w = Math.floor(sr * 0.02), n = Math.floor(x.length / w);
    const rms = [];
    for (let i = 0; i < n; i++) {
      let s = 0; for (let j = 0; j < w; j++) { const vv = x[i * w + j]; s += vv * vv; }
      rms.push(Math.sqrt(s / w));
    }
    const mean = rms.reduce((a2, b2) => a2 + b2, 0) / n;
    let trans = 0;
    for (let i = 2; i < n; i++) if (rms[i] > mean * 2.2 && rms[i - 1] <= mean * 2.2) trans++;
    const seg = x.slice(sr * 3, sr * 4);
    const goertzel = (f) => {
      const c = 2 * Math.cos(2 * Math.PI * f / sr); let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < seg.length; i++) { s0 = seg[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      return Math.sqrt(Math.abs(s1 * s1 + s2 * s2 - c * s1 * s2)) / seg.length;
    };
    const bands = []; for (let f = 40; f <= 800; f += 10) bands.push(goertzel(f));
    const sorted = [...bands].sort((a2, b2) => a2 - b2);
    const med = sorted[Math.floor(bands.length / 2)] + 1e-9;
    return { room, rms: +mean.toFixed(4), transients: trans, tonalPeakRatio: +(Math.max(...bands) / med).toFixed(1) };
  },
  get yaw() { return yaw; }, set yaw(v) { yaw = v; },
  info: () => renderer.info,
  step: (dt, n = 1) => { for (let i = 0; i < n; i++) tick(dt); }, // manual frame-step (headless verification)
};

/* ================= main loop ================= */
const clock = new THREE.Clock();
let running = true;
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;                      // pause when hidden (§4B)
  if (document.hidden) silenceAll();
  else { if (!muted && actx && actx.state === 'suspended') actx.resume(); clock.getDelta(); loop(); }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  tick(Math.min(clock.getDelta(), 0.1));
}
let simT = 0;
let eyeY = 1.6;                       // smoothed eye height, so stairs read as a walk
/* Some devices start WebGL happily and then crawl through a ~900-draw-call scene.
   Sample the first few seconds after entering and OFFER the illustrated vault — never
   yank someone out of the room they are standing in. */
let fpsFrames = 0, fpsT0 = 0, fpsChecked = false;
function watchFrameRate() {
  if (fpsChecked || !entered) return;
  // Never judge a backgrounded tab: rAF is throttled there, and because dt is capped at
  // 0.1s the accumulated-time version of this read ~10fps for a perfectly fast machine
  // that had simply been left in another tab. Measure wall-clock, and restart the sample
  // whenever the page comes back to the foreground.
  if (FORCE_SLOW) { fpsChecked = true; offerFlat(12); return; }   // debug hook only
  if (document.hidden) { fpsT0 = 0; fpsFrames = 0; return; }
  const now = performance.now();
  if (!fpsT0) { fpsT0 = now; fpsFrames = 0; return; }
  fpsFrames++;
  const elapsed = (now - fpsT0) / 1000;
  if (elapsed < 4) return;
  fpsChecked = true;
  const fps = fpsFrames / elapsed;
  if (fps < 20) offerFlat(Math.round(fps));
}
function offerFlat(fps) {
  if (document.getElementById('slowBar')) return;
  const bar = document.createElement('div');
  bar.id = 'slowBar';
  bar.innerHTML = '<span>This is running at about ' + fps +
    ' frames a second on your device.</span>' +
    '<a class="ghost-btn" href="/vault?flat=1">Switch to the illustrated vault</a>' +
    '<button id="slowDismiss" aria-label="Keep the 3D vault">Stay in 3D</button>';
  document.body.appendChild(bar);
  document.getElementById('slowDismiss').addEventListener('click', () => bar.remove());
}

function tick(dt) {
  simT += dt;
  const t = simT;
  watchFrameRate();
  tickSlab();

  // destination ring breathes while holding
  if (walkRing.visible) {
    const rs = 1 + 0.18 * Math.sin(t * 6);
    walkRing.scale.set(rs, rs, rs);
    walkRing.material.opacity = 0.65 + 0.25 * Math.sin(t * 6);
  }
  // glide toward target (tap / hold-to-walk)
  const k = REDUCED ? 1 : Math.min(1, dt * 2.4);
  player.pos.lerp(player.target, k);
  clampPos(player.pos);
  if (pendingAction && player.pos.distanceTo(player.target) < 0.18) {
    const a = pendingAction; pendingAction = null; a();
  }
  // eye height follows the ground; eased so the lip of the stair does not snap
  const groundY = floorYAt(player.pos.x, player.pos.z);
  eyeY += (groundY + eyeTarget - eyeY) * Math.min(1, dt * (seated ? 4 : 9));
  camera.position.set(player.pos.x, eyeY, player.pos.z);
  camera.rotation.set(pitch, yaw, 0);

  // auto-open the bookcase as you draw near
  if (!doorOpened && !doorAnim && player.pos.distanceTo(new THREE.Vector3(-1.5, 0, -3.4)) < 2.0)
    openBookcase();

  // bookcase swing (sim-time driven so manual stepping works too)
  if (doorAnim) {
    if (doorAnim.simStart === undefined) doorAnim.simStart = simT - dt;
    const p = Math.min(1, (simT - doorAnim.simStart) / (doorAnim.dur / 1000));
    const e = 1 - Math.pow(1 - p, 3);
    hinge.rotation.y = doorAnim.from + (doorAnim.to - doorAnim.from) * e;
    doorAmt = Math.abs(hinge.rotation.y) / 1.62;
    if (p >= 1) doorAnim = null;
  }
  // vault doors swinging open
  for (let i = doorAnims.length - 1; i >= 0; i--) {
    const a = doorAnims[i];
    const p = Math.min(1, (simT - a.start) / a.dur);
    const e = 1 - Math.pow(1 - p, 3);
    a.hg.rotation.y = a.from + (a.to - a.from) * e;
    if (p >= 1) doorAnims.splice(i, 1);
  }

  // flickers & pulses
  const fl = 0.82 + 0.28 * (Math.sin(t * 11) * 0.35 + Math.sin(t * 23 + 1.7) * 0.3 + Math.sin(t * 5.1) * 0.35);
  candleLight.intensity = candleLit ? 24 * fl : 0;
  sconceLight.intensity = 28 * (0.85 + 0.3 * Math.sin(t * 9.2 + 2));
  torchLight.intensity = 14 * (0.85 + 0.3 * Math.sin(t * 8.1 + 4));
  flame.scale.y = sflame.scale.y = tflame.scale.y = 0.9 + 0.2 * Math.sin(t * 13);
  const pulse = 0.75 + 0.45 * Math.sin(t * 2.2);
  M.stack.emissiveIntensity = pulse;
  stackLight.intensity = 30 * (0.8 + 0.3 * Math.sin(t * 2.2));
  stackGlow.scale.setScalar(1.4 + 0.25 * Math.sin(t * 2.2));
  // the deeper rooms breathe too
  libLights.forEach((L, i) => { L.intensity = 85 * (0.9 + 0.14 * Math.sin(t * 7.3 + i * 2.1)); });
  torch2Light.intensity = 12 * (0.85 + 0.3 * Math.sin(t * 8.8 + 1));
  t2flame.scale.y = 0.9 + 0.2 * Math.sin(t * 12.4);
  v3LightA.intensity = 26 * (0.86 + 0.24 * Math.sin(t * 9.4 + 2.4));
  v3LightB.intensity = 26 * (0.86 + 0.24 * Math.sin(t * 8.2 + 0.7));
  tomeLight.intensity = 16 * (0.8 + 0.3 * Math.sin(t * 2.4));
  tomeGlow.scale.setScalar(1.1 + 0.2 * Math.sin(t * 2.4));
  chestLight.intensity = 22 * (0.82 + 0.28 * Math.sin(t * 2.0 + 1));
  chestGlow.scale.setScalar(1.3 + 0.2 * Math.sin(t * 2.0));
  // series seals breathe — and flare when the finale is claimed
  const flareAmt = Math.max(0, 1 - (simT - sealFlareT) / 6) * 0.8;
  sealPulse.forEach((o, i) => {
    const b = 0.85 + 0.2 * Math.sin(t * 1.6 + i * 1.3) + flareAmt;
    if (o.isSprite) o.material.opacity = Math.min(1, 0.4 * b);
    else o.material.color.setScalar(Math.min(1.8, b));
  });
  // room label + first-entry lines
  const zp = player.pos.z;
  const label = player.pos.y < -0.4 || (door4Open && floorYAt(player.pos.x, zp) < -0.4)
    ? 'VAULT IV — THE SECRET SANCTUM'
    : zp > -7.2 ? "VAULT I — THE WRITER'S STUDY"
    : zp > -19.4 ? 'VAULT II — THE LIBRARY OF PUZZLES'
    : 'VAULT III — THE GRAND TREASURE VAULT';
  if (roomNameEl.textContent !== label) roomNameEl.textContent = label;
  const inStudy = entered && zp > -3.6 && player.pos.y > -0.4;
  if (studyCountEl.hidden === inStudy) studyCountEl.hidden = !inStudy;
  if (!exitSaid && entered && zp < -4.2 && zp > -7.0) {
    exitSaid = true;
    const left = STUDY_ITEMS.length - studyFound().size;
    if (left > 0) showCaption(STUDY_SAY.exit(left), 5600);
  }
  if (!seenLib && zp < -8.0) { seenLib = true; keeper('libentry'); }
  if (!seenV3 && zp < -20.2) { seenV3 = true; keeper('v3entry'); }
  // the soundscape follows you room to room
  ambT += dt;
  if (ambient && ambT > 0.4) {
    ambT = 0;
    const rk = zp > -3.6 ? 'study' : zp > -8.0 ? 'corridor' : zp > -16.9 ? 'library' : zp > -20.3 ? 'corridor' : 'treasure';
    if (rk !== ambRoom) { ambRoom = rk; ambient.setRoom(rk); }
  }

  // dust drift
  if (dust) {
    const a = dust.geometry.attributes.position;
    for (let i = 0; i < dustN; i++) {
      let y = a.getY(i) + dt * 0.05;
      if (y > 3.5) y = 0.2;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.02);
    }
    a.needsUpdate = true;
  }

  tickConfetti(dt);
  // a full-cover overlay is up: render every third frame, not every one (phones thank you)
  frameNo++;
  if (!overlayOpen() || frameNo % 3 === 0) renderer.render(scene, camera);
}
let frameNo = 0;
loop();
