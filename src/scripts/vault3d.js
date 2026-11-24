// THE 3D VAULT CRAWL — loaded on demand by vault.astro ONLY when the visitor chooses the 3D
// mode (the default is the painted vault, public/js/painted-vault.js). Split out of the page
// on 2026-09-02 so the painted path never downloads three.js. Nothing inside changed.
import * as THREE from 'three';
import { PAGE_WORDS, FINAL_LETTER, NUM_WORD, NOTEBOOK } from '../lib/lore.js';
import { buildGallery } from './gallery-room.js';

/* Small event helpers — the same shape as public/js/events.js so a call reads the same in
   both vault modules. Non-blocking, silent on failure. Every string here must match the
   allowlist in src/lib/events.js; scripts/verify-events.js diffs the two files. */
const PS_EV = Object.freeze({
  ARRIVE: 'arrive', PAGE_VIEW: 'page.view',
  BOOKCASE_OPEN: 'bookcase.open',
  WORDBOX_OPEN: 'wordbox.open', WORDBOX_CLOSE: 'wordbox.close',
  DOOR_OPEN_I: 'door.open.I', DOOR_OPEN_II: 'door.open.II', DOOR_OPEN_III: 'door.open.III',
  STAIR_DESCEND: 'stair.descend', STAIR_ASCEND: 'stair.ascend',
  PAGE_NOTEBOOK: 'page.notebook', PAGE_REJECTS: 'page.rejects', STUDY_COMPLETE: 'study.complete', DESK_SOLVED: 'desk.solved',
  ROUND_START: 'round.start', ROUND_SOLVED: 'round.solved', ROUND_FAIL: 'round.fail',
  LOCK_START: 'lock.start', LOCK_SOLVED: 'lock.solved',
  TILE_5: 'tile.5', TILE_7: 'tile.7',
  REWARD_OPEN_I: 'reward.open.I', REWARD_OPEN_II: 'reward.open.II', REWARD_OPEN_III: 'reward.open.III', REWARD_OPEN_IV: 'reward.open.IV',
  REWARD_CLICK_I: 'reward.click.I', REWARD_CLICK_II: 'reward.click.II', REWARD_CLICK_III: 'reward.click.III', REWARD_CLICK_IV: 'reward.click.IV',
  VAULT4_FLOOR_OPEN: 'vault4.floor_open', VAULT4_ENTERED: 'vault4.entered',
  CARVE_OPEN: 'carve.open',
  HINT_VIEW: 'hint.view', HINT_REVEAL: 'hint.reveal', IDLE: 'idle', PERF_SLOW: 'perf.slow',
  PLAY_START: 'play.start', PLAY_SOLVED: 'play.solved', PLAY_OFFER: 'play.offer',
  LEARN_START: 'learn.start', LEARN_MID: 'learn.mid', LEARN_DONE: 'learn.done',
  PASSPORT_VIEW: 'passport.view', SHARE_COPY: 'share.copy', OUTBOUND_AMAZON: 'outbound.amazon',
  GUEST_SCRAP: 'guest.scrap', GUEST_BOARD: 'guest.board', GUEST_SOLVED: 'guest.solved', GUEST_COPY: 'guest.copy', DAILY_DECODE: 'daily.decode', GUEST_CARD: 'guest.card',
  REVIEW_ASK: 'review.ask',
  GALLERY_SCRAP: 'gallery.scrap', GALLERY_GRID: 'gallery.grid', GALLERY_CLOCK: 'gallery.clock', GALLERY_DONE: 'gallery.done', GALLERY_BOOKMARK: 'gallery.bookmark',
  SESSION_DEPTH: 'session.depth',
});
function psEvent(ev, extra) {
  try {
    const body = { vid: (typeof psVid === 'function' ? psVid() : ''), ev: ev };
    if (extra != null) body.extra = String(extra).slice(0, 64);
    fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
  } catch (e) { /* best-effort */ }
}
function psEventOnce(ev, extra) {
  try { const k = 'ps_ev_once_' + ev; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {}
  psEvent(ev, extra);
}
function psBeacon(ev, extra) {
  try {
    const body = JSON.stringify({ vid: (typeof psVid === 'function' ? psVid() : ''), ev, extra: String(extra || '').slice(0, 64) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
    else fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(function () {});
  } catch (e) { /* best-effort */ }
}
/* The story's last line: how many things this tab touched, how long it stayed, and which
   room it was standing in. Sent once, on whichever comes first — the tab hiding (phones
   backgrounding) or pagehide (close / navigate away). */
const psTouched = new Set();
function psTouch(name) { psTouched.add(String(name).slice(0, 24)); }
const psT0 = Date.now();
let psRoom = 'the study';                         // short room name, kept current by tick()
const psRooms = new Set(['the study']);           // distinct rooms actually stood in
const PS_ROOM_SHORT = {
  "VAULT I — THE WRITER'S STUDY": 'the study',
  'VAULT II — THE LIBRARY OF PUZZLES': 'the library',
  'VAULT III — THE GRAND TREASURE VAULT': 'the treasure room',
  'VAULT IV — THE SECRET SANCTUM': 'the sanctum',
  "THE KEEPER'S GALLERY": 'the gallery',
};
/* Sent on every tab-hide and on pagehide, re-armed when the tab comes back, so a glance
   at a text message mid-visit does not end the story early. The server collapses identical
   repeats; the last one is the exit. Nothing is sent before the gate is passed — a bounce
   at the gate, or a WebGL failure that hands off to the painted vault, is not a visit. */
let psArmed = true;
function psLeave() {
  try {
    if (!psArmed || !entered) return; psArmed = false;
    const mins = Math.max(1, Math.round((Date.now() - psT0) / 60000));
    psBeacon(PS_EV.SESSION_DEPTH, '3D · ' + psRooms.size + ' rooms · ' + mins + 'm · last ' + psRoom);
  } catch (e) { /* `entered` not yet declared (module threw early) — nothing to report */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) psLeave(); else psArmed = true; });
addEventListener('pagehide', psLeave);
/* "Lingers in the library — 4 minutes without progress." Once per room per session. A
   hidden tab never counts as stuck, and neither does sitting at the desk — the daily
   puzzle lives in an iframe whose keystrokes never reach this window. */
(function psIdle() {
  const IDLE_MS = 4 * 60 * 1000, said = {}; let last = Date.now();
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((n) => addEventListener(n, bump, { passive: true, capture: true }));
  setInterval(() => {
    try {
      const deskOpen = (() => { const d = document.getElementById('desk'); return d && !d.hidden; })();
      if (document.hidden || deskOpen) { last = Date.now(); return; }
      if (!entered || said[psRoom]) return;
      if (Date.now() - last > IDLE_MS) { said[psRoom] = true; psEvent(PS_EV.IDLE, psRoom); }
    } catch (e) { /* `entered` not yet declared — the module threw before the gate */ }
  }, 20000);
})();
/* Once-per-session flags for stair crossings (see the render loop). */
const stairSeen = { down: false, up: false };

/* ================= setup / params ================= */
const qs = new URLSearchParams(location.search);
// Test switches below work only on local/preview hosts (2026-11-24): on the live site they would open doors with no word.
const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.vercel\.app$/.test(location.hostname);
const devQ = (k) => (DEV_HOST ? qs.get(k) : null);
const DEBUG_CAM = devQ('cam');            // "x,z,yaw,pitch" — skip gate, no audio
const FORCE_OPEN = devQ('open') === '1';  // bookcase pre-opened (screenshots)
const FORCE_PANEL = devQ('panel') === '1';
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
/* A GUEST ROOM: an outlet's own story inside Vault I. It exists only when
   /api/unlock handed this tab a `room` on that outlet's word — the front door stashes it in
   sessionStorage. Nothing in the URL can switch it on; a bad or stale stash reads as null and
   the canonical room is built, byte for byte. The four position pieces are validated here
   and rendered with textContent only. */
/* THE KEEPER'S GALLERY (Dan, 2026-11-24). The Gift cover's word opens the Keeper's front room (gallery-room.js),
   never Vault I: /api/unlock answers it with act 'G'. A browser holding only that gift and no book word
   is a Gallery visitor on every load, in every tab. Its far door is the door to Vault I: a word from
   inside a book (or any true book word) turns this browser into an ordinary visitor and walks it in. */
const GALLERY = (() => {
  try {
    const r = JSON.parse(localStorage.getItem('ps_rewards_v1') || '{}') || {};
    const v = JSON.parse(localStorage.getItem('ps_vaults_v1') || '{}') || {};
    return !['I', 'II', 'III', 'IV'].some((a) => r[a] || v[a]) && !!r.G;
  } catch (e) { return false; }
})();
let galleryRoom = null;   // set near the end of this file when GALLERY (declared early: activate/overlayOpen read it)
const GALLERY_ENTRY = 'The front room. Your fifty are on the end table. My study is through that door. It wants a word from inside a book.';
const GUEST = (() => {
  if (GALLERY) return null;   // the Gallery is the book's study, never an outlet's guest room
  try {
    const s = JSON.parse(sessionStorage.getItem('ps_guest_room_v1') || 'null');
    if (!s || typeof s !== 'object' || !/^[a-z]{2,16}$/.test(String(s.id || ''))) return null;
    const ok = (v, max) => typeof v === 'string' && v.length <= max;
    for (const k of ['entry', 'scrapLabel', 'scrapLine', 'allFound', 'retired', 'boardEmpty', 'exit', 'door2Kicker', 'door2Line', 'door2LinkText']) if (!ok(s[k], 400)) return null;
    if (!/^\/[a-z0-9\-\/]{0,40}$/.test(String(s.door2LinkHref || ''))) return null;
    const frags = Array.isArray(s.frags) ? s.frags.filter((f) => ok(f, 16) && /^[NSEW0-9°.'… ]+$/.test(f)) : [];
    const home = /^\/[a-z0-9\-]{1,40}$/.test(String(s.home || '')) ? s.home : '/';   // the room's own front door (optional)
    return { ...s, home, frags: frags.length === 4 ? frags : [], items: ['scrap0', 'scrap1', 'scrap2', 'scrap3'] };
  } catch (e) { return null; }
})();
if (FROM_DOOR) { gate.style.display = 'none'; fadeEl.classList.add('from-door'); }

let renderer = null;
try {
  // The inline flat-vault script already decided this visit is text-only (no WebGL, or
  // ?flat=1). Don't build a scene nobody will see.
  if (window.__flatMode) throw new Error('flat vault');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no ctx');
} catch (e) {
  // no WebGL: the painted vault takes over (same page, same arrival parameters)
  const u = new URL(location.href); u.searchParams.set('mode', 'painted'); location.replace(u.toString());
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
// the way out: the doorway itself is a target — turn around, click it, and you are back at the door
const exitHit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.5),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
exitHit.position.set(0, 1.6, 4.1); scene.add(exitHit);
exitHit.userData = { kind: 'exit', label: 'The door you came in by — back to the beginning' };
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
if (GUEST) stackGlow.raycast = () => {};   // in a guest room its big halo stole clicks meant for a scrap behind it; the stack itself still takes the tap
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
// A real quill (Dan, 2026-11-16: the old flat white plank "doesn't look anything like" a pen): a dark nib,
// a bare horn barrel, a central shaft and a curved, tapering feather vane with a few split barbs, standing
// in the inkwell and leaning back over the desk the way a resting quill does.
function makeQuill(len) {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.55 });
  const vaneMat = new THREE.MeshStandardMaterial({ color: 0xf1e9d6, side: THREE.DoubleSide, roughness: 0.9 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, side: THREE.DoubleSide, roughness: 0.9 });
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.0055, 0.035 * len, 8), new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.3, metalness: 0.2 }));
  nib.rotation.x = Math.PI; nib.position.y = 0.0175 * len; g.add(nib);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0055, 0.4 * len, 8), shaftMat);
  shaft.position.y = 0.035 * len + 0.2 * len; g.add(shaft);
  // the vane: a long leaf shape, wider on the trailing side, with a soft curl at the top
  const v = new THREE.Shape(), L = 0.33 * len, b = 0.12 * len;
  v.moveTo(0, 0);
  v.bezierCurveTo(0.05 * len, 0.05 * len, 0.075 * len, 0.2 * len, 0.012 * len, L);
  v.bezierCurveTo(-0.015 * len, 0.26 * len, -0.045 * len, 0.12 * len, -0.012 * len, 0);
  v.lineTo(0, 0);
  const vane = new THREE.Mesh(new THREE.ShapeGeometry(v, 16), vaneMat);
  vane.position.y = b; vane.rotation.y = 0.25; g.add(vane);
  // a second, slightly smaller layer turned across the first, so the feather has body from every side
  const vane2 = new THREE.Mesh(vane.geometry, vaneMat);
  vane2.position.y = b + 0.01 * len; vane2.rotation.y = 0.25 + 1.35; vane2.scale.set(0.8, 0.95, 1); g.add(vane2);
  // a darker tip band and three split barbs, so it reads as feather and not paper
  const tipS = new THREE.Shape();
  tipS.moveTo(0.045 * len, 0.27 * len); tipS.bezierCurveTo(0.04 * len, 0.3 * len, 0.02 * len, 0.32 * len, 0.012 * len, L);
  tipS.bezierCurveTo(0, 0.31 * len, -0.008 * len, 0.29 * len, -0.009 * len, 0.27 * len); tipS.lineTo(0.045 * len, 0.27 * len);
  const tip = new THREE.Mesh(new THREE.ShapeGeometry(tipS, 8), tipMat);
  tip.position.set(0, b, 0.0006); tip.rotation.y = 0.25; g.add(tip);
  [[0.1, 0.06, -0.5], [0.17, 0.065, -0.6], [0.06, -0.035, 0.5]].forEach(([y, x, r]) => {
    const barb = new THREE.Mesh(new THREE.PlaneGeometry(0.004 * len, 0.05 * len), vaneMat);
    barb.position.set(x * len, b + y * len, 0.001); barb.rotation.set(0, 0.25, r); g.add(barb);
  });
  return g;
}
const quill = makeQuill(1);
quill.position.set(-0.72, 0.84, 0.12); quill.rotation.set(0.12, 0.6, 0.38); desk.add(quill);
ink.userData = { kind: 'say', say: 'quill', found: 'quill', label: 'Quill and ink' };
quill.userData = { kind: 'say', say: 'quill', found: 'quill', label: 'Quill and ink' };
chair.userData = { kind: 'chair', label: GUEST ? "The Keeper's logbook" : "Sit at the Keeper's desk" };
// a guest's logbook glows at the desk once the note is whole, until it is signed (set by setLogGlow)
const logGlow = GUEST ? sprite(0.9, 0.1, 1.0, -0.92, desk, 0.0) : null;
// the Keeper's Notebook — a small closed book at the desk's edge
const notebook = new THREE.Group(); notebook.position.set(-0.42, 0.825, -0.22); notebook.rotation.y = 0.25; desk.add(notebook);
box(0.22, 0.035, 0.16, new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.7 }), 0, 0.018, 0, 0, notebook);
box(0.2, 0.012, 0.14, M.candle, 0, 0.04, 0, 0, notebook);                       // the page block
box(0.03, 0.045, 0.16, M.brass, -0.095, 0.022, 0, 0, notebook);                  // brass spine
notebook.userData = { kind: 'notebook', label: "The Keeper's notebook" };

// TODAY'S PAGE (Dan, 2026-11-16): the chair was the only way in to the daily puzzle and nobody would guess
// it. A small walnut reading stand at the desk's front corner holds a gilt-framed parchment page with a
// sudoku grid and a soft gold glow; it does exactly what the chair does. Not in a guest room (the chair is a logbook there).
const todayStand = new THREE.Group();
let todayGlow = null;
if (!GUEST) {
  todayStand.position.set(-0.4, 0.825, 0.24); todayStand.rotation.y = -0.18; todayStand.scale.setScalar(1.6); desk.add(todayStand);
  const pageTex = (() => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 480; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 480); bg.addColorStop(0, '#e6d3a6'); bg.addColorStop(1, '#cdb37a');
    g.fillStyle = bg; g.fillRect(0, 0, 384, 480);
    g.fillStyle = '#5a3a10'; g.textAlign = 'center'; g.font = 'bold 30px Cinzel, Georgia, serif'; g.fillText('TODAY’S PAGE', 192, 52);
    g.strokeStyle = '#b8862e'; g.lineWidth = 2; g.beginPath(); g.moveTo(90, 66); g.lineTo(294, 66); g.stroke();
    const x0 = 48, y0 = 88, cs = 32;
    g.strokeStyle = '#1e1408';
    for (let i = 0; i <= 9; i++) {
      g.lineWidth = i % 3 ? 2 : 5;
      g.beginPath(); g.moveTo(x0 + i * cs, y0); g.lineTo(x0 + i * cs, y0 + 9 * cs); g.stroke();
      g.beginPath(); g.moveTo(x0, y0 + i * cs); g.lineTo(x0 + 9 * cs, y0 + i * cs); g.stroke();
    }
    // a valid decorative grid (a patterned solution with cells blanked), never a book or daily puzzle
    const givens = Array.from({ length: 81 }, (_, k) => { const r = Math.floor(k / 9), c = k % 9; return (r * 4 + c * 7) % 9 < 4 ? String(((r * 3 + Math.floor(r / 3) + c) % 9) + 1) : '.'; }).join('');
    g.fillStyle = '#120b04'; g.font = 'bold 25px Georgia, serif'; g.textBaseline = 'middle';
    for (let i = 0; i < 81; i++) { const ch = givens[i]; if (ch && ch >= '1' && ch <= '9') g.fillText(ch, x0 + (i % 9) * cs + cs / 2, y0 + Math.floor(i / 9) * cs + cs / 2 + 1); }
    g.fillStyle = '#7a5520'; g.font = 'italic 20px Georgia, serif'; g.fillText('Sit, and solve', 192, 420);
    g.fillText('❧', 192, 450);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const walnut = new THREE.MeshStandardMaterial({ color: 0x3b2112, roughness: 0.55 });
  box(0.26, 0.02, 0.17, walnut, 0, 0.01, 0, 0, todayStand);                  // base
  box(0.27, 0.006, 0.18, M.gold, 0, 0.022, 0, 0, todayStand);                // gilt edge on the base
  const lean = new THREE.Group(); lean.position.set(0, 0.02, -0.04); lean.rotation.x = -0.42; todayStand.add(lean);
  box(0.23, 0.29, 0.012, walnut, 0, 0.145, -0.008, 0, lean);                  // the board
  box(0.245, 0.305, 0.006, M.gold, 0, 0.145, -0.016, 0, lean);               // gilt frame behind it
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.85, emissive: 0x000000 }));
  page.position.set(0, 0.148, 0.0); lean.add(page);
  box(0.24, 0.02, 0.03, M.brass, 0, 0.012, 0.012, 0, lean);                   // brass ledge the page rests on

  todayGlow = sprite(0.9, 0, 0.17, -0.16, todayStand, 0.5); todayGlow.raycast = () => {};   // behind the board, a halo, never over the page
  todayStand.userData = { kind: 'chair', label: 'Play today’s puzzle' };
}

// scattered pages on the desk
[[-0.62, -0.3, 0.5, M.paperA], [0.5, -0.25, -0.4, M.paperB], [-0.15, -0.3, 1.2, M.paperB], [0.42, 0.3, 2.4, M.paperA]].forEach(([x, z, r, mt]) => {
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

// three crumpled rejects near the walls — each unfolds into a draft with TWO answers.
// In a GUEST ROOM they are four crumpled scraps instead, each holding a piece of the note.
const rejects = [];

/* ---- A GUEST ROOM's four scraps, and the furniture they hide behind (Dan, 2026-11-14) ----
   Dan: smaller, real balled-up paper, and "slightly harder but not too hard": one in the open by the
   barrel (the warm-up), one behind the sea chest, one under the desk, one behind the map cabinet.
   The GPSr still points at the nearest piece, so nobody is stranded. Everything here is guest-only;
   the book's own study is untouched. Positions were checked by seven critiques and a headless
   click test (props are in `interactables`, so they block a tap aimed at a scrap behind them). */
const guestProps = [], guestObstacles = [];
let globe = null;   // the Keeper's globe, built below (both rooms since 2026-11-14)
// The book's own study shares the furniture, the globe and the visitors' book (Dan, 2026-11-14) — but never the
// scraps, the desk panels or anything to do with co-ordinates. BOOK_ROOM picks each room's wording and spots.
const BOOK_ROOM = !GUEST;
let paperBallFn = null, paperBallMat = null;   // lent to the Keeper's Gallery for its one paper ball
{
  // seeded so every visit sees the same four balls, each crumpled differently
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const unit = (r) => { const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1); return v.lengthSq() < 1e-4 ? v.set(0, 1, 0) : v.normalize(); };
  // A paper ball is flat planes and sharp folds, not a lumpy rock: each fold plane cuts a straight
  // valley across the sphere. The offset depends only on the vertex DIRECTION, so the duplicated
  // corners of the non-indexed icosahedron all move together and the mesh never cracks.
  function crumpledPaper(r0, seed) {
    const r = rng(seed);
    const folds = Array.from({ length: 8 }, () => ({ n: unit(r), c: 0.18 + r() * 0.14, a: 0.28 + r() * 0.2 }));
    const tips = Array.from({ length: 3 }, () => unit(r));
    const geo = new THREE.IcosahedronGeometry(r0, 2);
    const pos = geo.attributes.position, d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      let s = 1;
      for (const f of folds) s -= f.a * Math.max(0, f.c - Math.abs(d.dot(f.n)));
      for (const t of tips) s += 1.1 * Math.max(0, d.dot(t) - 0.86);
      s = Math.max(0.62, s);
      pos.setXYZ(i, d.x * r0 * s, d.y * r0 * s * 0.8, d.z * r0 * s);   // a ball dropped on the floor settles a little
    }
    geo.computeVertexNormals(); geo.computeBoundingBox();
    return geo;
  }
  // written-on paper: faint ruled lines and pencil strokes over the whole tile, so it reads as a used page
  const scrapTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#efe8d6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,140,170,0.35)'; g.lineWidth = 1;
    for (let y = 10; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const r = rng(7);
    g.strokeStyle = 'rgba(40,30,22,0.55)'; g.lineWidth = 1.4;
    for (let k = 0; k < 14; k++) {
      const x0 = r() * w, y0 = Math.floor(r() * 10) * 12 + 8, len = 14 + r() * 40;
      g.globalAlpha = 0.45 + r() * 0.5; g.beginPath(); g.moveTo(x0, y0);
      for (let x = x0; x < x0 + len; x += 4) g.lineTo(x, y0 - 2 + r() * 3);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 2, 2);
  const scrapMat = new THREE.MeshStandardMaterial({ map: scrapTex, color: 0xfff4e2, roughness: 0.92, metalness: 0, flatShading: true, emissive: 0x1c160c, emissiveIntensity: 0.25 });
  paperBallFn = crumpledPaper; paperBallMat = scrapMat;
  const contact = (w, d, x, z, ry = 0, parent = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, 0.011, z); m.raycast = () => {}; parent.add(m); return m;
  };
  // THE BOOK'S THREE DRAFTS: same drafts, same places (reject #2 moved out of the chest's footprint and the open
  // bookcase's swing), now real crumpled paper. No glow, as before. They are the study's own finds, never hidden.
  if (BOOK_ROOM) [[-2.9, 2.3], [3.15, -1.5], [-2.95, -1.95]].forEach(([x, z], i) => {
    const geo = crumpledPaper(0.08, 211 + i * 37), rr = rng(301 + i * 11);
    const w = new THREE.Mesh(geo, scrapMat);
    w.rotation.set((rr() - 0.5) * 0.35, rr() * Math.PI * 2, (rr() - 0.5) * 0.35);
    w.position.set(x, -geo.boundingBox.min.y - 0.006, z); scene.add(w);
    w.userData = { kind: 'reject', idx: i, label: 'A crumpled page' };
    rejects.push(w);
  });
  // [x, z]: 0 by the barrel (open) · 1 behind the sea chest · 2 under the desk (desk-local 0.70, 0, 0.0) · 3 behind the map cabinet
  if (GUEST) [[-2.7, 3.15], [-3.47, -3.35], [1.139, -0.685], [3.72, 0.25]].forEach(([x, z], i) => {
    const R0 = 0.1, rr = rng(101 + i * 17);
    const geo = crumpledPaper(R0, 31 + i * 53);
    const w = new THREE.Mesh(geo, scrapMat);
    w.rotation.set((rr() - 0.5) * 0.35, rr() * Math.PI * 2, (rr() - 0.5) * 0.35);
    w.position.set(x, -geo.boundingBox.min.y - 0.006, z); scene.add(w);
    w.userData = { kind: 'scrap', idx: i, label: GUEST.scrapLabel };
    // the glow guides the eye but never takes a tap (it poked out past the props' edges);
    // an invisible ball a little bigger than the paper takes it instead
    const gl = sprite(0.6, 0, 0, 0, w, 0.36); gl.raycast = () => {};
    w.userData.glow = gl;                                            // dimmed below once `study` has loaded
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    w.add(hit);
    contact(0.3, 0.3, x, z);
    guestObstacles.push({ x, z, r: 0.3 });                           // never stand ON a piece: it would be under your feet, off-screen
    rejects.push(w);
  });

  const prop = (g, line, stand) => { g.userData = { kind: 'prop', label: line.label, line: line.say, stand }; guestProps.push(g); scene.add(g); return g; };
  const pine = new THREE.MeshStandardMaterial({ map: woodMatTex, color: 0x8a6a44, roughness: 0.8 });

  // SEA CHEST across the back-left corner — clear of the secret bookcase's swing (x ≥ -2.52 when open)
  const chest = new THREE.Group(); chest.position.set(-3.05, 0, -2.85); chest.rotation.y = 0.7;
  box(0.8, 0.4, 0.5, M.chestWood, 0, 0.2, 0, 0, chest);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 18, 1, false, 0, Math.PI), M.chestWood2);
  dome.rotation.z = Math.PI / 2; dome.position.y = 0.4; chest.add(dome);
  [-0.3, 0.3].forEach((bx) => {
    box(0.06, 0.42, 0.52, M.gold, bx, 0.2, 0, 0, chest);
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.06, 18, 1, true, 0, Math.PI), M.gold);
    arc.rotation.z = Math.PI / 2; arc.position.set(bx, 0.4, 0); chest.add(arc);
  });
  box(0.12, 0.14, 0.03, M.goldGlow, 0, 0.37, 0.26, 0, chest);       // the lock plate
  box(0.82, 0.04, 0.52, M.woodDark, 0, 0.02, 0, 0, chest);          // plinth
  contact(1.15, 0.8, 0, 0, 0, chest);
  prop(chest, { label: 'A sea chest', say: BOOK_ROOM ? 'Locked since before my time. Whatever it holds, it was never mine to open.' : 'Locked since before my time. Things roll behind it and stay there.' }, BOOK_ROOM ? [-2.0, -2.3] : [-2.5, -3.35]);
  guestObstacles.push({ x: -3.05, z: -2.85, r: 0.6 });

  // MAP CABINET in the stone gap between the right-hand bookcases, pulled off the wall a hand's width
  const cab = new THREE.Group(); cab.position.set(3.2, 0, 0.25);
  box(0.45, 1.42, 0.9, M.wood, 0, 0.77, 0, 0, cab);                  // carcass (x = depth, toward the wall)
  box(0.47, 0.08, 0.92, M.woodDark, 0, 0.04, 0, 0, cab);             // plinth
  box(0.52, 0.06, 0.98, M.woodDark, -0.02, 1.51, 0, 0, cab);         // overhanging top
  for (let k = 0; k < 7; k++) {                                      // seven shallow drawers, brass pulls
    const y = 0.2 + k * 0.18, out = k === 2 ? 0.1 : 0;
    box(0.025, 0.15, 0.82, M.woodDark, -0.235 - out, y, 0, 0, cab);
    box(0.03, 0.025, 0.14, M.brass, -0.255 - out, y, 0, 0, cab);
  }
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), new THREE.MeshStandardMaterial({ map: paperTexA, color: 0xcaa870, roughness: 0.9 }));
  roll.rotation.x = Math.PI / 2; roll.position.set(-0.3, 0.6, 0.05); cab.add(roll);   // a chart rolled up in the open drawer
  contact(0.7, 1.2, 0, 0, 0, cab);
  prop(cab, { label: 'A map cabinet', say: BOOK_ROOM ? 'My map cabinet. Charts of every place a reader has written to me from.' : 'My map cabinet. It never did sit flush to the wall.' }, [3.3, -0.55]);
  guestObstacles.push({ x: 3.2, z: 0.25, r: 0.6 });

  // BARREL in the front-left corner — the warm-up piece lies beside it
  const barrel = new THREE.Group(); barrel.position.set(-3.15, 0, 3.05);
  const prof = [[0.2, 0], [0.24, 0.12], [0.265, 0.35], [0.24, 0.58], [0.2, 0.7]].map(([r, y]) => new THREE.Vector2(r, y));
  barrel.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 20), M.chestWood));
  const lidB = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), M.woodDark); lidB.rotation.x = -Math.PI / 2; lidB.position.y = 0.695; barrel.add(lidB);
  [[0.1, 0.235], [0.35, 0.268], [0.6, 0.232]].forEach(([y, r]) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 24), M.brass); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; barrel.add(hoop);
  });
  contact(0.75, 0.75, 0, 0, 0, barrel);
  prop(barrel, { label: 'A barrel', say: 'Rainwater, for the ink. I would not drink it.' }, [-2.25, 2.6]);
  guestObstacles.push({ x: -3.15, z: 3.05, r: 0.4 });

  // THE KEEPER'S GLOBE in the front-right corner (Dan, 2026-11-14; it replaced two packing crates).
  // A floor-standing library globe painted as a physical atlas (Natural Earth, public domain; since 2026-11-15 —
  // it was ink on parchment, which read with sea and land swapped). Drag it to spin; tap it for the close-up. Brass pins mark where Visitors' Book signers come from (never finer than a town of
  // 15,000+, never initials), a red pin marks Telford, and a brass plaque carries Geocaching HQ's numbers.
  const gb = (globe = { group: new THREE.Group(), spin: new THREE.Group(), vel: 0, pins: [], dragging: null });
  gb.group.position.set(2.85, 0, 3.0); gb.group.rotation.y = 2.33;          // local +X (longitude 0) faces the room
  const globeBrass = new THREE.MeshStandardMaterial({ map: goldFoilTex, color: 0xc29a4c, metalness: 0.45, roughness: 0.38, emissive: 0x4a3010, emissiveIntensity: 0.5 });
  const GR = 0.29, GY = 0.86;                                                // radius, centre height
  [0, 1, 2].forEach((k) => {                                                 // three turned legs and a stretcher
    const a = k * Math.PI * 2 / 3, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, GY, 10), M.woodDark);
    leg.position.set(x, GY / 2, z); gb.group.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.woodDark); foot.position.set(x, 0.03, z); gb.group.add(foot);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.woodDark);
    bar.position.set(x / 2, 0.22, z / 2); bar.rotation.set(0, -a, Math.PI / 2); gb.group.add(bar);
  });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 12), M.woodDark); hub.position.y = 0.22; gb.group.add(hub);
  const horizon = new THREE.Mesh(new THREE.RingGeometry(GR + 0.035, GR + 0.1, 64), globeBrass);
  horizon.rotation.x = -Math.PI / 2; horizon.position.y = GY; gb.group.add(horizon);
  const horizonEdge = new THREE.Mesh(new THREE.CylinderGeometry(GR + 0.1, GR + 0.1, 0.025, 64, 1, true), globeBrass);
  horizonEdge.position.y = GY - 0.012; gb.group.add(horizonEdge);
  const tilt = new THREE.Group(); tilt.position.y = GY; tilt.rotation.x = 0.409; gb.group.add(tilt);   // the earth's 23.4° tilt
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(GR + 0.022, 0.009, 8, 72), globeBrass); meridian.rotation.y = Math.PI / 2; tilt.add(meridian);   // rings the globe as you face it
  [1, -1].forEach((s) => { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), globeBrass); cap.position.y = s * (GR + 0.012); tilt.add(cap); });
  tilt.add(gb.spin);
  // the map (Dan, 2026-11-15: "land in greens and browns, water in blues"): Natural Earth's cross-blended hypsometric
  // tints with shaded relief (public domain; scripts/build-globe-atlas.py) — green lowlands, tan deserts, brown
  // mountains, white ice, blue seas paler in the shallows. A plain sea-blue until the picture arrives. Tap the globe
  // for the close-up (src/scripts/globe-closeup.js), which adds borders, states and cities as you zoom.
  const touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;   // (IS_TOUCH is declared further down)
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x6f9cc6, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0 });
  new THREE.TextureLoader().load(touchy || renderer.capabilities.maxTextureSize < 4096 ? '/data/globe/atlas-2k.webp' : '/data/globe/atlas-4k.webp', (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // a little of the picture glows on its own, so the colours read true in a candle-lit room
    sphereMat.map = t; sphereMat.emissiveMap = t; sphereMat.emissiveIntensity = 0.32; sphereMat.color.set(0xffffff); sphereMat.needsUpdate = true;
  });
  gb.sphere = new THREE.Mesh(new THREE.SphereGeometry(GR, 64, 32), sphereMat);
  gb.sphere.userData = { kind: 'globe', label: "The Keeper's globe · tap to look closer, drag to spin" };
  gb.spin.add(gb.sphere);
  // the brass plaque on the front of the horizon ring
  const pcv = document.createElement('canvas'); pcv.width = 512; pcv.height = 128;
  { const g = pcv.getContext('2d'); g.fillStyle = '#9a7434'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#5a3e14'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#2a1a06'; g.textAlign = 'center';
    if (BOOK_ROOM) { g.font = 'bold 32px Georgia, serif'; g.fillText('From every corner they come', 256, 56); g.font = 'italic 26px Georgia, serif'; g.fillText('a pin for every visitor’s home', 256, 98); }
    else { g.font = 'bold 34px Georgia, serif'; g.fillText('3.4 million active geocaches', 256, 56); g.font = 'italic 26px Georgia, serif'; g.fillText('in 191 countries  ·  Geocaching HQ, 2026', 256, 98); } }
  const ptex = new THREE.CanvasTexture(pcv); ptex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: ptex, metalness: 0.4, roughness: 0.45, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0.18 }));
  plaque.position.set(GR + 0.11, GY - 0.012, 0); plaque.rotation.y = Math.PI / 2; gb.group.add(plaque);
  plaque.userData = { kind: 'globePlaque', label: 'A brass plaque' };
  contact(0.95, 0.95, 0, 0, 0, gb.group);
  scene.add(gb.group);
  guestProps.push(gb.sphere, plaque);
  guestObstacles.push({ x: 2.85, z: 3.0, r: 0.55 });

  // THE DESK hides a piece underneath: panels close its front and left end (seen from the door, the
  // floor under it was in plain view), the right end stays open to peek in. The desk itself now takes
  // a tap — it means the logbook, exactly as the chair does — so a tap aimed through the top can't
  // reach the piece. Kept at or below y 0.815 so the gift, the notebook and the candle stay tappable.
  if (GUEST) {
  const deskHit = { kind: 'chair', label: "The Keeper's desk" };
  const front = box(1.72, 0.515, 0.03, M.woodDark, 0, 0.3175, 0.40, 0, desk); front.userData = deskHit;
  const endL = box(0.03, 0.515, 0.84, M.woodDark, -0.86, 0.3175, 0, 0, desk); endL.userData = deskHit;
  // invisible stand-ins for the top slab and the apron, exactly their size, so they block only what
  // they visibly hide (a full-depth block caught taps aimed under the overhang at the piece)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const topHit = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.115, 1.04), hitMat);
  topHit.position.set(0, 0.7575, 0); topHit.userData = deskHit; desk.add(topHit);
  const apronHit = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 0.8), hitMat);
  apronHit.position.set(0, 0.655, 0); apronHit.userData = deskHit; desk.add(apronHit);
  guestProps.push(front, endL, topHit, apronHit);
  }
  // THE BOOK ROOM'S VISITORS' BOOK: a small round table beside the globe with the book lying open on it (the desk
  // is the daily puzzle there). Tap → the same shared book as PinPoint's.
  if (BOOK_ROOM) {
    const tbl = new THREE.Group(); tbl.position.set(2.0, 0, 3.3); tbl.rotation.y = 2.6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 28), M.wood); top.position.y = 0.72; tbl.add(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 12), M.woodDark); stem.position.y = 0.36; tbl.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.04, 20), M.woodDark); base.position.y = 0.02; tbl.add(base);
    box(0.34, 0.025, 0.24, new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.7 }), 0, 0.752, 0, 0, tbl);   // the open book's cover
    box(0.16, 0.018, 0.22, M.candle, -0.08, 0.768, 0, 0.04, tbl); box(0.16, 0.018, 0.22, M.candle, 0.08, 0.768, 0, -0.04, tbl);   // its pages
    const quillB = makeQuill(0.62);
    quillB.position.set(0.02, 0.775, 0.06); quillB.rotation.set(-1.52, 0, 0.9); tbl.add(quillB);
    const hitB = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12), new THREE.MeshBasicMaterial({ visible: false })); hitB.position.y = 0.45; tbl.add(hitB);
    tbl.userData = { kind: 'vbookTable', label: "The Keeper's visitors' book" };
    contact(0.7, 0.7, 0, 0, 0, tbl);
    scene.add(tbl); guestProps.push(tbl);
    guestObstacles.push({ x: 2.0, z: 3.3, r: 0.35 });
  }
}

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

// wall sconce with flame (left wall). Sits in the bare stone between the two left
// bookcases (they span z -2.55..-0.65 and 0.45..2.35); at z 1.9 it was buried in the
// front case (Dan, 2026-10-19).
const sconce = new THREE.Group(); sconce.position.set(-3.88, 2.3, -0.1); scene.add(sconce);
box(0.1, 0.34, 0.1, M.iron, 0, -0.12, 0, 0, sconce);
const sconceCup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.1, 10), M.gold);
sconceCup.position.set(0.12, 0.02, 0); sconce.add(sconceCup);
const sflame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), M.flame);
sflame.position.set(0.12, 0.14, 0); sconce.add(sflame);
sprite(0.75, 0.12, 0.16, 0, sconce);
const sconceLight = new THREE.PointLight(0xff9a3a, 28, 9, 2);
sconceLight.position.set(0.25, 0.2, 0); sconce.add(sconceLight);
sconce.userData = { kind: 'say', say: 'sconce', found: 'sconce', label: 'A wall sconce' };
// its twin on the right wall, in the gap between those cases (z -0.25..0.75), for balance.
// Flame + glow only; the left sconce's light already reaches it.
const sconceR = new THREE.Group(); sconceR.position.set(3.88, 2.3, 0.25); sconceR.rotation.y = Math.PI; scene.add(sconceR);
box(0.1, 0.34, 0.1, M.iron, 0, -0.12, 0, 0, sconceR);
const sconceCupR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.1, 10), M.gold);
sconceCupR.position.set(0.12, 0.02, 0); sconceR.add(sconceCupR);
const sflameR = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), M.flame);
sflameR.position.set(0.12, 0.14, 0); sconceR.add(sflameR);
sprite(0.75, 0.12, 0.16, 0, sconceR);
sconceR.userData = { kind: 'say', say: 'sconce', found: 'sconce', label: 'A wall sconce' };

/* ---- THE SECRET BOOKCASE (hinged over the passage opening) ---- */
const hinge = new THREE.Group();
hinge.position.set(-2.35, 0, -3.85); scene.add(hinge);
const bookdoor = makeBookcase(1.74, 2.44, 0.34);
bookdoor.position.set(0.87, 0, 0); hinge.add(bookdoor);
bookdoor.traverse(o => { o.userData.kindParent = 'bookcase'; });
// Shut flush and labelled like every other case (Dan, 2026-09-03: the ajar bookcase gave the
// passage away). The only way in is ONE odd book, sitting a little proud of its row with the
// faintest glow — a small target that has to be found. Clicking it swings the case open;
// clicking the open case (or the book again) settles it back.
hinge.userData = { kind: 'bookcase', label: "The Keeper's shelves" };
let doorAmt = 0;                       // 0 closed → 1 open (rotY 0 → -1.62)
let doorAnim = null;                   // {from,to,start,dur}
hinge.rotation.y = 0;
const oddBookMat = new THREE.MeshStandardMaterial({ color: 0x8a4a26, emissive: 0xffb347, emissiveIntensity: 0.2, roughness: 0.7 });
const oddBook = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.30, 0.24), oddBookMat);
oddBook.position.set(0.52, 1.652, 0.05); bookdoor.add(oddBook);          // fourth row up, right of centre, 5 cm proud
const oddBand = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.025, 0.246), M.gold);
oddBand.position.set(0.52, 1.72, 0.05); bookdoor.add(oddBand);
const oddHit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.34),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
oddHit.position.set(0.52, 1.652, 0.08); bookdoor.add(oddHit);
oddHit.userData = { kind: 'oddbook', label: 'A book that sits proud of its row' };

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
});

/* ---- THE KEEPER'S ROUND: six things on scraps of red velvet, and a hooded lamp by the door.
   The shelves are full of look-alikes; only the six on velvet count. ---- */
const velvetMat = new THREE.MeshStandardMaterial({ color: 0x5a1212, roughness: 1 });
const ROUND_DEFS = [
  { id: 'discs',     name: 'the cipher discs',   make: propCipherDisc, x: AX - 2.62, z: -8.6,  y: 1.01, side: 'L', counter: true,  riddle: 'Two discs, one alphabet, and no honesty between them.' },
  { id: 'cryptex',   name: 'the cryptex',        make: propCryptex,    x: AX - 1.78, z: -8.6,  y: 1.01, side: 'L', counter: true,  riddle: 'Five rings that keep a secret in a tube.' },
  { id: 'puzzlebox', name: 'the puzzle box',     make: propPuzzleChest,x: AX + 1.78, z: -8.6,  y: 1.01, side: 'R', counter: true,  riddle: 'A box that will not open the way boxes do.' },
  { id: 'machine',   name: 'the cipher machine', make: propEnigma,     x: AX + 2.62, z: -8.6,  y: 1.01, side: 'R', counter: true,  riddle: 'It spoke in wheels, and lied for a living.' },
  { id: 'chess',     name: 'the chess set',      make: propChess,      x: AX - 3.55, z: -14.4, y: 0.86, side: 'L', counter: false, riddle: 'Thirty-two soldiers, and not one of them moves.' },
  { id: 'sphere',    name: 'the brass sphere',   make: propSphere,     x: AX + 3.55, z: -15.3, y: 0.96, side: 'R', counter: false, riddle: 'It holds the sky in a brass fist.' },
];
const roundHits = [];
ROUND_DEFS.forEach((d) => {
  if (!d.counter) {                                             // a side table / a plinth for the two at the back
    box(0.6, d.y - 0.03, 0.6, d.id === 'sphere' ? M.stonePed : M.woodDark, d.x, (d.y - 0.03) / 2, d.z);
  }
  box(0.5, 0.012, 0.5, velvetMat, d.x, d.y + 0.006, d.z);
  const p = d.make(); p.scale.setScalar(1.35); p.position.set(d.x, d.y + 0.012, d.z); p.rotation.y = (d.side === 'L' ? 1 : -1) * 0.5; scene.add(p);
  d.mats = [];
  p.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const cl = mats.map((m) => { const c = m.clone(); if (c.emissive) { c.emissive.set(0xffb347); c.emissiveIntensity = 0; d.mats.push(c); } return c; });
    o.material = Array.isArray(o.material) ? cl : cl[0];
  });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(d.x, d.y + 0.25, d.z); scene.add(hit);
  hit.userData = { kind: 'roundTarget', id: d.id, label: d.name.replace(/^the /, (m) => 'The ') + ', on red velvet' };
  roundHits.push(hit);
});
// the hooded lamp on its stand, just inside the library door, left
const HOOD = { x: AX - 3.7, z: -8.05 };
const hoodStand = new THREE.Group(); hoodStand.position.set(HOOD.x, 0, HOOD.z); scene.add(hoodStand);
box(0.3, 0.05, 0.3, M.iron, 0, 0.025, 0, 0, hoodStand);
box(0.05, 1.05, 0.05, M.iron, 0, 0.55, 0, 0, hoodStand);
box(0.2, 0.28, 0.2, M.iron, 0, 1.22, 0, 0, hoodStand);
box(0.24, 0.03, 0.24, M.iron, 0, 1.37, 0, 0, hoodStand);
const hoodSlit = box(0.03, 0.14, 0.022, M.flame, 0, 1.21, 0.105, 0, hoodStand);   // one slit of light in the hood
const hoodGlow = sprite(0.5, 0, 1.22, 0.1, hoodStand, 0.3);
const hoodHit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
hoodHit.position.set(0, 1.15, 0); hoodStand.add(hoodHit);
hoodStand.userData = { kind: 'hoodLamp', label: 'A hooded lamp. Not for light.' };
// the lights the Round needs exist from the start (adding a light later recompiles every material)
const roundSpot = new THREE.SpotLight(0xffc070, 0, 12, 0.30, 0.6, 2); scene.add(roundSpot); scene.add(roundSpot.target);
const roundFill = new THREE.PointLight(0xffc070, 0, 2.5, 2); scene.add(roundFill);

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

// aisle hungLamps (hanging) — the library's main light
const libLights = [], libLampSprites = [];
[-9.4, -12.2, -15].forEach((z) => {
  const lamp = new THREE.Group(); lamp.position.set(AX, LIB.H - 0.9, z); scene.add(lamp);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), M.iron);
  cable.position.y = 0.45; lamp.add(cable);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 12), M.brass);
  shade.position.y = -0.12; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.flame);
  bulb.position.y = -0.26; lamp.add(bulb);
  libLampSprites.push(sprite(0.85, 0, -0.3, 0, lamp, 0.7));
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
const pbChest = new THREE.Group(); pbChest.scale.setScalar(1.15); pbChest.position.y = 1.04; pedB.add(pbChest);
box(0.36, 0.2, 0.24, M.chestWood2, 0, 0.1, 0, 0, pbChest);
[-0.11, 0.11].forEach(x => box(0.045, 0.22, 0.26, M.gold, x, 0.11, 0, 0, pbChest));
const pbLid = new THREE.Group(); pbLid.position.set(0, 0.2, -0.12); pbChest.add(pbLid);      // hinged at the back edge
box(0.36, 0.09, 0.24, M.chestWood2, 0, 0.045, 0.12, 0, pbLid);
[-0.11, 0.11].forEach(x => box(0.045, 0.1, 0.26, M.gold, x, 0.05, 0.12, 0, pbLid));
const pbDial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), M.gold);
pbDial.rotation.x = Math.PI / 2; pbDial.position.set(0, 0.12, 0.13); pbChest.add(pbDial);
const pbInner = box(0.3, 0.02, 0.18, new THREE.MeshStandardMaterial({ color: 0xd9a940, emissive: 0xcf8a20, emissiveIntensity: 1.0, roughness: 0.5 }), 0, 0.19, 0, 0, pbChest);
pbInner.visible = false;
const pbGlow = sprite(0.55, 0, 0.32, 0, pbChest, 0);
const pbLight = new THREE.PointLight(0xffc25a, 0, 2, 2); pbLight.position.set(0, 0.45, 0); pbChest.add(pbLight);
const pbHit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
pbHit.position.set(0, 0.2, 0); pbChest.add(pbHit);
pbChest.userData = { kind: 'lockchest', label: 'A small chest, locked. It is ticking.' };

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

// the unlit unlitObj — the hidden fourth door's keyhole (Phase-2 payoff, wired to the word box)
const unlitObj = new THREE.Group(); unlitObj.position.set(V3.minX + 0.55, 0, -25.3); unlitObj.rotation.y = 0.7; scene.add(unlitObj);
unlitObj.userData = { kind: 'fourth', label: 'Something unlit… waiting' };
box(0.16, 0.02, 0.16, M.iron, 0, 0.01, 0, 0, unlitObj);
[[-0.065, -0.065], [0.065, -0.065], [-0.065, 0.065], [0.065, 0.065]].forEach(([x, z]) => box(0.016, 0.24, 0.016, M.iron, x, 0.14, z, 0, unlitObj));
box(0.17, 0.03, 0.17, M.iron, 0, 0.26, 0, 0, unlitObj);
const lringM = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), M.iron);
lringM.position.y = 0.3; unlitObj.add(lringM);
const lglass = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.11), new THREE.MeshStandardMaterial({ color: 0x18130c, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 }));
lglass.position.y = 0.14; unlitObj.add(lglass);
const unlitGlim = sprite(0.22, 0, 0.14, 0, unlitObj, 0.0); // dark until noticed… then the faintest breath of light

// Series Wall Gallery of original still pictures behind the chest in Vault III
if (!GUEST) makeFramedPicture('/art/door-v10.webp', 0.9, 1.3, AX - 2.1, 2.4, -25.35);
if (!GUEST) makeFramedPicture('/art/door-v2.webp', 0.9, 1.3, AX - 1.05, 2.4, -25.35);
if (!GUEST) makeFramedPicture('/art/og-door.jpg', 1.1, 1.5, AX, 2.5, -25.35);
if (!GUEST) makeFramedPicture('/art/door-v4.webp', 0.9, 1.3, AX + 1.05, 2.4, -25.35);
if (!GUEST) makeFramedPicture('/art/door-v5.webp', 0.9, 1.3, AX + 2.1, 2.4, -25.35);
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
// shut there is nothing to see -- the unlitObj is the only way to know it is there.
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
if (!GUEST) makeFramedPicture('/art/door-v10.webp', 3.8, 2.5, AX, 1.5, -31.05, 0, sanctumG);
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
   IS a unlitObj, hung above the reward, finally burning. The generic sanctum fill was
   dialled down (16 -> 6) so this reads as the true source of the room's warmth. */
sanctumLight.intensity = 6;
const hangL = new THREE.Group(); hangL.position.set(AX, 2.75, -28.5); sanctumG.add(hangL);
const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), M.iron);
chain.position.y = -0.31; hangL.add(chain);
const unlitBody = new THREE.Group(); unlitBody.position.y = -0.78; hangL.add(unlitBody);
box(0.19, 0.03, 0.19, M.iron, 0, 0.13, 0, 0, unlitBody);          // cap
box(0.17, 0.03, 0.17, M.iron, 0, -0.15, 0, 0, unlitBody);         // base
[[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]].forEach(([x, z]) =>
  box(0.016, 0.28, 0.016, M.iron, x, -0.01, z, 0, unlitBody));    // corner posts
const lantGlass = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.14),
  new THREE.MeshStandardMaterial({ color: 0xffcf82, emissive: 0xffb347, emissiveIntensity: 1.6, transparent: true, opacity: 0.82 }));
lantGlass.position.y = -0.01; unlitBody.add(lantGlass);
const lantFlame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), M.flame);
lantFlame.position.y = -0.03; unlitBody.add(lantFlame);
sprite(0.95, 0, -0.01, 0, unlitBody, 0.5);                        // soft halo
const lantLight = new THREE.PointLight(0xffc266, 22, 6.5, 2);
lantLight.position.y = -0.02; unlitBody.add(lantLight);
const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), M.iron);
ringM.position.y = 0.16; ringM.rotation.x = Math.PI / 2; unlitBody.add(ringM);

/* ---- THE KEEPER'S THREE LETTERS, with the gilded acrostic ----
   Post-solve reveal on the right wall: three framed letters, one gilded capital at the
   start of seven thoughts. Read down, they are the acrostic the P.S. promised. The
   capitals are stored as SEPARATE characters and drawn one at a time -- the answer word
   never exists as a string in this bundle. */
const LETTERS_KEY = 'ps_letters_v1';
function heldLetters() { try { const v = JSON.parse(localStorage.getItem(LETTERS_KEY) || 'null'); return Array.isArray(v) && v.length ? v : null; } catch (e) { return null; } }
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
  const lines = heldLetters();
  if (!lines) {                                               // dark until the word has been spoken in this browser
    g.textAlign = 'center';
    g.font = 'italic 27px "Cormorant Garamond", serif';
    g.fillStyle = 'rgba(60,44,20,0.55)';
    g.fillText('The letters are dark.', W / 2, H / 2 - 10);
    g.font = 'italic 21px "Cormorant Garamond", serif';
    g.fillText('Speak the word, and they will show.', W / 2, H / 2 + 26);
    lettersTex.needsUpdate = true;
    return;
  }
  const x0 = 70, top = 92, lh = (H - top - 46) / lines.length;
  lines.forEach((line, i) => {
    const y = top + i * lh + lh * 0.5, cap = line.charAt(0), rest = line.slice(1);
    g.font = '700 40px Cinzel, serif';
    g.fillStyle = '#b8860b';                                  // the gilded capital
    g.fillText(cap, x0, y + 6);
    const capW = g.measureText(cap).width;
    g.font = 'italic 27px "Cormorant Garamond", serif';
    g.fillStyle = 'rgba(60,44,20,0.78)';                      // the faded rest
    g.fillText(rest, x0 + capW + 2, y);
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
// In a guest room the study's three floor pages are left out: they glowed on the same floor as the
// four scraps and read as more pieces (2026-10-09). The deeper rooms keep theirs.
STORY_SPOTS.filter(([, , z]) => !(GUEST && z > -3.6)).forEach(([no, x, z, ry]) => {
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
const ambientLight = new THREE.AmbientLight(0x4a2e12, 1.15); scene.add(ambientLight);
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
  if (!audioReady || ambient || GALLERY) return;   // the front room is quiet; creaks and thuds still play
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
  if (m) stopVoice();
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
  first:   { file: '/audio/vo/vo_scene0_entry.wav',   text: 'Two hundred puzzles… and hidden among them, a single word. If you found my first, speak it now — the vault is listening.' },
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
let currentVO = null, voGen = 0, capTimer = null;
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
    // never pause a line the Keeper has since started for real (slow phones resolve this late)
    if (p && p.then) p.then(() => { if (currentVO !== a) { a.pause(); a.currentTime = 0; } a.muted = false; })
                      .catch(() => { a.muted = false; });
    else a.muted = false;
  });
}
renderer.domElement.addEventListener('pointerdown', unlockVO, { once: true });
/* ONE voice at a time. The newest line always wins: whatever the Keeper was saying stops the
   moment a new line starts, and the caption follows the voice. No queue. */
function stopVoice() {
  const a = currentVO; currentVO = null; voGen++;
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch (e) {}
}
function voiceHold(a, floor) {
  const d = a && isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 + 700 : 0;   // the caption outlives the voice by a beat
  return Math.max(floor || 6500, d);
}
function keeper(key) {
  const line = VO[key]; if (!line) return;
  stopVoice();
  const a = VO_PLAYERS[key];
  showCaption(line.text, voiceHold(a, 6500));
  if (muted || !a) return;
  const gen = voGen; currentVO = a;                       // tracked NOW, not after play() resolves
  a.muted = false;
  try { a.currentTime = 0; } catch (e) {}
  const p = a.play();
  if (p && p.catch) p.catch(() => { if (gen === voGen && currentVO === a) currentVO = null; });   // the caption carries it
}
Object.values(VO_PLAYERS).forEach((a) => a.addEventListener('ended', () => { if (currentVO === a) currentVO = null; }));
/* Run fn when the Keeper has finished the line he is saying now (or at once if he is silent).
   If a newer line cuts this one off, fn is dropped: the moment it was waiting for is gone. */
function afterVoice(fn, minMs = 0) {
  const a = currentVO, gen = voGen, t0 = performance.now();
  const go = () => { if (performance.now() - t0 < minMs) { setTimeout(go, minMs - (performance.now() - t0)); return; } fn(); };
  if (!a || a.paused) { go(); return; }
  const done = () => { a.removeEventListener('ended', done); if (gen === voGen) go(); };
  a.addEventListener('ended', done);
}
function silenceAll() {
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  stopVoice();
  try { if (actx && actx.state === 'running') actx.suspend(); } catch (e) {}
}
window.addEventListener('pagehide', silenceAll);
window.addEventListener('beforeunload', silenceAll);

/* ================= movement / interaction ================= */
const player = { pos: new THREE.Vector3(0, 0, 3.0), target: new THREE.Vector3(0, 0, 2.6) };
let yaw = 0, pitch = -0.02;
if (GUEST) pitch = -0.2;   // a guest's pieces are on the floor: arrive looking a little down
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
  ...guestObstacles,                                               // a guest room's props + its four pieces (empty otherwise)
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
  // A guest room's props stand near the walls, so a push out of one can land past the study's edge
  // (into the gap behind the cabinet, say). Pull back inside, then out of any circle once more.
  const S = ZONES[0];   // the study (its open back edge leads to the passage, so only the other three sides)
  if (guestObstacles.length && p.z > S.minZ && (p.x < S.minX || p.x > S.maxX || p.z > S.maxZ)) {
    p.x = THREE.MathUtils.clamp(p.x, S.minX, S.maxX); p.z = Math.min(p.z, S.maxZ);
    for (const o of guestObstacles) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      if (d < o.r && d > 1e-4) { p.x = o.x + dx / d * o.r; p.z = o.z + dz / d * o.r; }
    }
  }
  return p;
}
function moveTo(x, z, action = null) {
  player.target.set(x, 0, z); clampPos(player.target);
  pendingAction = action;
}
// a wheel step adds to where you were already heading (so many small trackpad events add up to a notch), but never
// more than one notch (0.4 m) ahead of where you stand, so steady scrolling glides at about a third of the old pace
function wheelStep(dist) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const ahead = player.target.clone().sub(player.pos); ahead.y = 0;
  const along = ahead.dot(dir) * Math.sign(dist) > 0 ? ahead.dot(dir) : 0;   // keep going only if already heading this way
  let d = along + dist;
  if (Math.abs(d) > 0.4) d = 0.4 * Math.sign(d);
  moveTo(player.pos.x + dir.x * d, player.pos.z + dir.z * d);
}
function stepForward(dist) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  moveTo(player.pos.x + dir.x * dist, player.pos.z + dir.z * dist);
}

/* ---- pointer: drag = look, tap = interact/walk ---- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const interactables = [stack, oddHit, exitHit, hinge, door2, door3, wall4, letters4, chart4, lectern, chestG, masterTome, sealsWall, unlitObj,
  hoodStand, pbChest, ...roundHits,
  candle, ink, quill, board, sconce, sconceR, chair, todayStand, notebook, easelS, ...rejects, ...wallCases, ...guestProps,
  ...storyPages,
  ...sealPulse.filter(o => o.isMesh)];
let down = null, dragging = false;
const overlayOpen = () => !rewardEl.hidden || !document.getElementById('wordbox').hidden
  || !document.getElementById('lockbox').hidden || !document.getElementById('tilecard').hidden || !document.getElementById('roundEnd').hidden
  || !document.getElementById('pageview').hidden || !document.getElementById('desk').hidden
  || !document.getElementById('notebook').hidden || !document.getElementById('draft').hidden
  || !(document.getElementById('farewell')?.hidden ?? true) || gvOpen || !!(galleryRoom && galleryRoom.overlayOpen());

const walkFloors = () => (GALLERY ? [floor] : [floor, corrFloor, libFloor, corr2Floor, v3Floor]);
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
// The Keeper's globe takes a drag before the camera does: a press that lands on the globe spins it,
// a press anywhere else looks around as before. A tap (no drag) still goes to the normal handlers.
function globeGrab(e) {
  if (!globe || overlayOpen()) return false;
  const hits = pick(e.clientX, e.clientY, interactables);
  const top = hits.length ? findKind(hits[0].object) : null;
  if (!top || top !== globe.sphere || hits[0].distance > 3.2) return false;
  globe.dragging = { x: e.clientX, t: performance.now(), lastX: e.clientX, lastT: performance.now(), moved: false };
  globe.vel = 0;
  renderer.domElement.setPointerCapture(e.pointerId);
  return true;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (globeGrab(e)) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw, pitch };
  dragging = false; holdWalk = false;
  renderer.domElement.setPointerCapture(e.pointerId);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {           // held still → start walking toward the finger
    if (down && !dragging) { holdWalk = true; walkToward(down.lastX ?? down.x, down.lastY ?? down.y); }
  }, 240);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  lastPtr.x = e.clientX; lastPtr.y = e.clientY;
  if (globe && globe.dragging) {
    const d = globe.dragging, now = performance.now(), dx = e.clientX - d.lastX;
    if (Math.abs(e.clientX - d.x) > 6) d.moved = true;
    const k = 2.2 / Math.max(240, Math.min(innerWidth, innerHeight));   // a full-width drag ≈ one turn
    globe.spin.rotation.y += dx * k;
    const dt = Math.max(1, now - d.lastT); globe.vel = globe.vel * 0.6 + (dx * k / dt * 1000) * 0.4;
    d.lastX = e.clientX; d.lastT = now;
    return;
  }
  if (down) {
    down.lastX = e.clientX; down.lastY = e.clientY;
    if (holdWalk) { walkToward(e.clientX, e.clientY); return; }  // finger steers the destination
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 9) dragging = true;
    if (dragging) {
      // A guest room drags like a map or Street View (pull the room toward you): PinPoint's
      // non-gamer tester found the gamer-style direction backwards (2026-10-08).
      const dir = GUEST ? -1 : 1;
      yaw = down.yaw - dir * dx * 0.0034;
      pitch = THREE.MathUtils.clamp(down.pitch - dir * dy * 0.0026, -0.75, 0.6);
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
  if (globe && globe.dragging) {
    const d = globe.dragging; globe.dragging = null;
    if (performance.now() - d.lastT > 120) globe.vel = 0;                // held still before letting go: no fling
    if (d.moved) { if (!globe.hinted) { globe.hinted = true; showCaption('Tap the globe to look closer.', 3800); } return; }
    globe.vel = 0;                                                        // a tap: a pin, or the globe itself
    const hits = pick(e.clientX, e.clientY, interactables);
    const hit = hits.length ? findKind(hits[0].object) : null;
    if (hit) activate(hit.userData.kind, hit);
    return;
  }
  clearTimeout(holdTimer);
  if (holdWalk) { holdWalk = false; walkRing.visible = false; down = null; dragging = false; return; }
  const wasDrag = dragging || !down || (performance.now() - down.t) > 500;
  down = null; dragging = false;
  if (wasDrag) return;
  // 1) interactables first
  const hits = pick(e.clientX, e.clientY, interactables);
  const hit = hits.length ? findKind(hits[0].object) : null;
  if (hit) { activate(hit.userData.kind, hit); return; }
  if (round.on) { const near = nearestTargetOnScreen(e.clientX, e.clientY); if (near) { roundHit(near.id); return; } }
  // 2) otherwise walk to the tapped floor point
  const fhits = pick(e.clientX, e.clientY, walkFloors());
  if (fhits.length) moveTo(fhits[0].point.x, fhits[0].point.z);
  else if (round.on) roundMiss();
});
// The mouse wheel walks about 70% less than it did (Dan, 2026-11-15: "drop that down almost 70%"): one notch is 0.4 m
// forward / 0.3 m back (was 1.3 / 1.0). Each step starts from where you stand, so steady scrolling glides at roughly
// a third of the old pace too. Trackpads and smooth-scroll mice send many small events, so each event's step is
// scaled by its size (a standard notch is ~100 px) and a flick can't sprint. Taps, W/S keys and the ▲ button unchanged.
addEventListener('wheel', (e) => {
  if (overlayOpen()) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;                 // a sideways trackpad swipe is not a step
  const px = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
  if (!px) return;
  const s = Math.min(1, px / 100);
  wheelStep(e.deltaY < 0 ? 0.4 * s : -0.3 * s);
}, { passive: true });
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
// A guest's hint names the one job in the room, and the GPSr that helps with it.
const GUEST_HINT = (IS_TOUCH ? 'Drag to look · hold the floor to walk · ' : 'Drag to look · click the floor to walk · ') + 'the GPSr at the top points the way';
if (GUEST) { hintEl.textContent = GUEST_HINT; if (IS_TOUCH) hintEl.style.display = 'block'; }
// glowing destination ring on the floor while holding
const walkRing = new THREE.Mesh(
  new THREE.RingGeometry(0.14, 0.2, 24),
  new THREE.MeshBasicMaterial({ color: 0xf6b23c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
);
walkRing.rotation.x = -Math.PI / 2; walkRing.position.y = 0.02; walkRing.visible = false;
scene.add(walkRing);
let holdWalk = false, holdTimer = null;
function walkToward(cx, cy) {
  const fhits = pick(cx, cy, walkFloors());
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
    text: "No name, no price. Fifty easy puzzles from the Keeper's own desk — the first door is open.",
    btn: 'Download the 50 puzzles (PDF)', vo: 'reward1',
  },
  II: {
    kicker: 'THE SECOND GIFT', title: 'ONE HUNDRED MORE',
    text: 'A hundred medium puzzles, bound for the readers of my letter. The library approves of you.',
    btn: 'Download the 100 puzzles (PDF)', vo: 'reward2',
  },
  III: {
    kicker: 'THE GRAND VAULT IS YOURS', title: 'TWO HUNDRED — AND THE HUNT GOES ON',
    text: 'Two hundred hard puzzles, the deepest hoard. And on the wall behind you… four seals, four secrets still to come.',
    btn: 'Download the 200 puzzles (PDF)', vo: 'finale',
  },
  G: {
    kicker: "THE GALLERY'S GIFT", title: 'FIFTY EASY ONES',
    text: 'Fifty easy ones, tied with string. For solving the cover. Take them. I have more string.',
    btn: 'Download the 50 puzzles (PDF)', vo: null,
  },
  IV: {
    kicker: "THE KEEPER'S SECRET SANCTUM", title: 'TWENTY MASTER PUZZLES',
    text: "You found what was never lit, and decoded what was never written. Twenty master puzzles from the Keeper's private collection.",
    btn: 'Download the 20 Master Puzzles (PDF)', vo: 'fourth',
  },
};
const rewardsGiven = {};
let sealFlareT = -99;
/* ---- The Keeper's Story: reading + progress ---------------------------------
   Progress lives in localStorage so a reload never costs you the hunt. Pages are
   pure lore: they gate nothing, and finding all nine earns the final letter. */
const STORY_KEY = 'ps_story_v1';
/* PAGE_WORDS, FINAL_LETTER and NUM_WORD come from ../lib/lore.js (shared with /the-keeper). */

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
  // Keeper story pages (p1/p4/p7 etc.) — same "read the notebook" signal Dan wants.
  psEventOnce(PS_EV.PAGE_NOTEBOOK);
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
    // the payoff: the last page, once he has finished reading this one (never over it)
    afterVoice(() => {
      if (pageviewEl.hidden) { pagesFound.push('final'); saveStory(pagesFound); return; }   // they set it down early: keep the record, skip the reading
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

/* the gifts' addresses — handed out by /api/unlock for a true word, kept in this browser only */
const REWARD_KEY = 'ps_rewards_v1';
function rewardsHeld() { try { const v = JSON.parse(localStorage.getItem(REWARD_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }
// A query is a destination, never proof. The entry page must already have banked
// the matching server-issued reward address before a later act can be restored.
function earnedArrivalAct() {
  const act = qs.get('act');
  if (!FROM_DOOR || GALLERY || !['II', 'III'].includes(act)) return null;
  const pass = rewardsHeld()[act];
  if (typeof pass !== 'string' || !pass.startsWith('/api/reward?')) return null;
  try {
    const u = new URL(pass, location.origin);
    return u.origin === location.origin && u.pathname === '/api/reward' &&
      u.searchParams.get('act') === act && /^[a-f0-9]{40}$/.test(u.searchParams.get('t') || '') ? act : null;
  } catch (e) { return null; }
}
const ARRIVAL_ACT = earnedArrivalAct();
function holdReward(act, url) { if (!url) return; try { const r = rewardsHeld(); r[act] = url; localStorage.setItem(REWARD_KEY, JSON.stringify(r)); } catch (e) {} }
const DOOR_FOR_ACT = { I: 'first', II: 'door2', III: 'door3', IV: 'fourth' };
let lastRewardAct = null;
function openReward(act) {
  lastRewardAct = act;
  const held = rewardsHeld()[act];
  if (!held) {   // no word spoken in this browser: the gift waits until it is
    showCaption(act === 'I' ? 'Speak my first word, and the gift is yours.' : 'Speak this vault’s word first — the gift is kept for those who did.', 5200);
    openWordbox(DOOR_FOR_ACT[act]);
    return;
  }
  const RW = REWARDS[act];
  document.getElementById('rwKicker').textContent = RW.kicker;
  document.getElementById('rwTitle').textContent = RW.title;
  document.getElementById('rwText').textContent = RW.text;
  const b = document.getElementById('rwBtn'); b.href = held; b.textContent = RW.btn;
  // Instrument the button so a click on the actual gift is a distinct signal from
  // "opened the card." Bind exactly once — repeated openReward calls are cheap because
  // the previous listener is a no-op on the new act.
  const logged = act !== 'G';   // the Gallery's card adds no new event type (privacy page unchanged)
  b.onclick = logged ? () => psBeacon(PS_EV['REWARD_CLICK_' + act], '') : null;   // beacon: iOS may open the PDF in-tab and abort a plain fetch
  if (logged) { psEvent(PS_EV['REWARD_OPEN_' + act]); psTouch('reward-' + act); }
  // No review ask on a gift card, ever (Dan 2026-11-09, Option B): the neutral ask lives only on the
  // front door, on a LATER visit, for a book-word holder (public/js/review-ask.js).
  if (window.psGuest) window.psGuest.fill(document.getElementById('rwGuest'), act === 'I' ? 'gift' : 'none');
  rewardEl.hidden = false;
  burstConfetti();
  playUnlock();
  if (!rewardsGiven[act]) { if (RW.vo) keeper(RW.vo); rewardsGiven[act] = true; }
  if (act === 'III') sealFlareT = simT; // the series wall flares with the finale
  if (act !== 'G') stampVault(act);   // the Gallery is never stamped as a vault
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
  else if (lastRewardAct === 'II' && !tilesHeld().II) setTimeout(() => showCaption('There is a hooded lamp by the door. It is not for light.', 5600), 400);
  else if (lastRewardAct === 'III' && !tilesHeld().III) setTimeout(() => showCaption('The small chest on the pedestal is not mine to open. Try your ear.', 5600), 400);
});

/* ---- sealed doors + the word box ---- */
const DOORS = {
  door2: { act: 'II', stand: { x: AX, z: -6.35 }, inside: { x: AX, z: -8.9 },
           kicker: 'THE SECOND DOOR', vo: 'door2', isOpen: () => door2Open, setOpen: () => { door2Open = true; }, obj: door2 },
  door3: { act: 'III', stand: { x: AX, z: -18.55 }, inside: { x: AX, z: -21.0 },
           kicker: 'THE THIRD DOOR', vo: 'door3', isOpen: () => door3Open, setOpen: () => { door3Open = true; }, obj: door3 },
  // The fourth secret has no door object any more -- unlitSuccess() opens the FLOOR.
  fourth: { act: 'IV', stand: { x: V3.minX + 1.2, z: -24.8 }, inside: { x: AX, z: -28.5 },
           kicker: 'THE FOURTH SECRET', vo: 'fourth', isOpen: () => door4Open, setOpen: () => { door4Open = true; }, obj: null },
  // the first word, asked for at the desk when a visitor arrived without speaking it at the door
  first:  { act: 'I', stand: { x: 0, z: 2.0 }, inside: { x: 0, z: 2.0 },
           kicker: 'THE FIRST WORD', vo: 'first', isOpen: () => false, setOpen: () => {}, obj: null },
};
const doorAnims = [];
function openVaultDoor(key) {
  const D = DOORS[key];
  D.setOpen();
  playBoom();
  doorAnims.push({ hg: D.obj, from: D.obj.rotation.y, to: 2.05, start: simT, dur: 2.3 }); // swings away, into the next room
  D.obj.userData.kind = null; // no longer interactable
  // Which door swung. First/fourth have no visual door object; here we care about door2/door3.
  const evName = D.act === 'II' ? PS_EV.DOOR_OPEN_II : D.act === 'III' ? PS_EV.DOOR_OPEN_III : null;
  if (evName) { psEvent(evName); psTouch('door-' + D.act); }
  setTimeout(() => moveTo(D.inside.x, D.inside.z), 900); // walk through as it swings
}

const wordboxEl = document.getElementById('wordbox');
const wbInput = document.getElementById('wbInput');
const wbMsg = document.getElementById('wbMsg');
const wbSubmit = document.getElementById('wbSubmit');
const WORD_LEN = 12;                     // hard cap on what can be typed
let wbTarget = null, wbWord = '', wbFails = 0, wbBusy = false;
let wbGeneration = 0, wbRequest = null, wordMicrophone = null;
function invalidateWordbox() {
  wbGeneration++;
  if (wbRequest) wbRequest.abort();
  wbRequest = null; wbBusy = false; wbSubmit.textContent = 'Open the door';
  if (wordMicrophone) wordMicrophone.stop();
}
let wbOpenFails = 0;                                  // misses since THIS box opened (wbFails drives the VO across the visit)
function openWordbox(key) {
  invalidateWordbox();
  wbTarget = key; wbWord = ''; wbBusy = false; wbOpenFails = 0;
  document.getElementById('wbKicker').textContent = DOORS[key].kicker;
  document.getElementById('wbLine').textContent = VO[DOORS[key].vo].text;
  wbMsg.textContent = '';
  wordboxEl.hidden = false;
  wbInput.value = ''; wbInput.style.pointerEvents = 'auto'; wbInput.focus();
  // Which door's word box this is (first/door2/door3/fourth) is high-signal — Dan wants
  // to see which doors people even try. Extra is the target key; server sanitizes.
  psEvent(PS_EV.WORDBOX_OPEN, key);
  psTouch('wordbox-' + key);
  if (GALLERY && (key === 'door2' || key === 'first')) { galleryDoorLine(); return; }
  if (GUEST && key === 'door2') { guestDoorLine(); return; }
  if (key === 'door2' && window.psGuest && window.psGuest.door2(document.getElementById('wbKicker'), document.getElementById('wbLine'))) { showCaption(window.psGuest.line('door2'), 9000); return; }
  keeper(DOORS[key].vo);
}
function closeWordbox() { invalidateWordbox(); wordboxEl.hidden = true; wbTarget = null; }
// The Gallery's far door: the door to Vault I, which only a word from inside a book opens.
// No buy link at this door (critics, 2026-11-24): the one link in the Gallery is on the Volume 1 picture.
function galleryDoorLine() {
  document.getElementById('wbKicker').textContent = 'THE DOOR TO VAULT I';
  document.getElementById('wbLine').textContent = 'My study is through here. It wants a word from inside a book, not off the back of one.';
}
function sayEntry() { if (GALLERY) showCaption(GALLERY_ENTRY, 10000); else if (GUEST) showCaption(GUEST.frags.length ? GUEST.entry : GUEST.retired, 8000); else if (ARRIVAL_ACT) showCaption('Vault ' + ARRIVAL_ACT + ' is open. Your gift is here.', 6500); else keeper('entry'); }
// Dismissed without a true word — the "gave up at this door" signal. Success paths call
// closeWordbox() directly and never reach this.
function dismissWordbox() {
  if (wbTarget) psEvent(PS_EV.WORDBOX_CLOSE, wbOpenFails ? wbTarget + ' after ' + wbOpenFails + (wbOpenFails === 1 ? ' miss' : ' misses') : wbTarget + ' without a guess');
  closeWordbox();
}
document.getElementById('wbCancel').addEventListener('click', dismissWordbox);
function wbSet(w) {
  wbWord = w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, WORD_LEN);
  wbInput.value = wbWord;
}
wbInput.addEventListener('input', () => { wbSet(wbInput.value); if (wbInput.value !== wbWord) wbInput.value = wbWord; });
addEventListener('keydown', (e) => {
  if (wordboxEl.hidden) return;
  if (e.key === 'Escape') { dismissWordbox(); e.preventDefault(); e.stopPropagation(); }
  else if (e.key === 'Enter' && e.target === wbInput) { submitWord(); e.preventDefault(); e.stopPropagation(); }
}, true);
async function submitWord() {
  if (wbBusy || !wbTarget || wordboxEl.hidden || document.hidden) return;
  if (wbWord.length < 4) {
    wbMsg.textContent = 'Enter one word of 4–12 letters from your book or cover.';
    wbInput.focus();
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
    return;
  }
  const key = wbTarget, word = wbWord, generation = wbGeneration;
  if (wordMicrophone) wordMicrophone.stop();
  const request = wbRequest = new AbortController();
  wbBusy = true; wbSubmit.textContent = 'The vault is listening…';
  let j = null;
  try {
    const r = await fetch('/api/unlock', {
      method: 'POST', signal: request.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word, vid: psVid(), at: '3d' }),
    });
    j = await r.json();
  } catch (e) { /* offline / static preview */ }
  if (generation !== wbGeneration || key !== wbTarget || wordboxEl.hidden || document.hidden) return;
  wbRequest = null; wbBusy = false; wbSubmit.textContent = 'Open the door';
  if (!j) { wbMsg.textContent = 'The vault cannot hear you right now — try again in a moment.'; return; }
  if (GALLERY) {
    // Outlet guest words (Pinterest, magazines, press pool) open Vault I from here too: Dan, 2026-11-24.
    if (j.ok && ['I', 'II', 'III', 'IV'].includes(j.act)) {
      // a true book word: bank its gift (this browser now holds a book word, so it is an ordinary
      // visitor from here on) and walk into the real Vault I
      holdReward(j.act, j.rewardUrl);
      if (window.psGuest) window.psGuest.note(j);
      try {   // an outlet's own room (PinPoint) travels with its word; a book word ends any old one
        if (j.room && j.room.id) sessionStorage.setItem('ps_guest_room_v1', JSON.stringify(j.room));
        else sessionStorage.removeItem('ps_guest_room_v1');
      } catch (e) {}
      closeWordbox(); playUnlock();
      showCaption(j.act === 'I' ? 'The word is true. Vault I opens.' : 'The word is true. The vaults open.', 4000);
      setTimeout(() => location.replace('/vault?from=door&act=' + j.act), 1400);
      return;
    }
    playThud();
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
    if (j.ok) { wbMsg.textContent = 'That is the cover’s word: it opened this Gallery. Vault I needs a word from inside a book.'; return; }
    wbFails++; wbOpenFails++;
    wbMsg.textContent = 'Not that one. The word is inside a book, not on it.';
    wbSet('');
    return;
  }
  const D = DOORS[key];
  if (j.ok) holdReward(j.act, j.rewardUrl);       // any true word banks its gift
  if (j.ok && window.psGuest) window.psGuest.note(j);   // a guest key vs a book word (public/js/guest-key.js)
  if (j.ok && !(j.room && j.room.id)) { try { sessionStorage.removeItem('ps_guest_room_v1'); } catch (e) {} }   // a book word ends any guest room for the next load
  if (j.ok && j.act === D.act) {
    if (key === 'first') {
      closeWordbox();
      if (j.room && j.room.id && !GUEST) { try { sessionStorage.setItem('ps_guest_room_v1', JSON.stringify(j.room)); } catch (e) {} location.replace('/vault?from=door&act=I'); return; }
      openReward('I'); return;
    }
    if (key === 'fourth') {
      fourthWord = word;                              // in-memory proof for this session
      try { if (Array.isArray(j.lines) && j.lines.length) { localStorage.setItem(LETTERS_KEY, JSON.stringify(j.lines)); drawLetters(); } } catch (e) {}
      try { if (j.carveToken) localStorage.setItem('ps_carve', j.carveToken); } catch (e) {}
    }
    closeWordbox();
    if (key === 'fourth') unlitSuccess();
    else openVaultDoor(key);
  } else if (j.ok) {
    playThud();
    wbMsg.textContent = 'A true word… but it belongs to a different door. Its gift is banked.';
    wordboxEl.classList.remove('shake'); void wordboxEl.offsetWidth; wordboxEl.classList.add('shake');
  } else {
    wbFails++; wbOpenFails++;
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
wordMicrophone = window.psWordMicrophone && window.psWordMicrophone({
  inputId: 'wbInput', buttonId: 'speakBtn', statusId: 'wbMicStatus',
  beforeStart: stopVoice,
  validateTranscript: (text) => /^(?:[a-z]{4,12}|(?:[a-z]\s+){3,11}[a-z])$/i.test(text.trim())
    || 'Say one word of 4–12 letters. Your word is unchanged. Try again, or type and edit it.',
  isBusy: () => wbBusy || wordboxEl.hidden || !wbTarget
});
document.addEventListener('visibilitychange', () => { if (document.hidden) invalidateWordbox(); });
addEventListener('pagehide', invalidateWordbox);
new MutationObserver(() => { if (wordboxEl.hidden) invalidateWordbox(); }).observe(wordboxEl, { attributes: true, attributeFilter: ['hidden'] });
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
  psEvent(PS_EV.CARVE_OPEN);
  psTouch('carve');
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
function unlitSuccess() {
  unlitGlim.material.opacity = 1.0;
  door4Open = true;
  stairG.visible = true; tunG.visible = true;
  slabAnim = { start: performance.now(), dur: 2600 };
  playBoom && playBoom();
  burstConfetti();
  fetchWall();
  // The moment the floor grinds aside \u2014 distinct from actually walking down. Both fire.
  psEvent(PS_EV.VAULT4_FLOOR_OPEN);
  psTouch('vault4-floor');
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
  if (galleryRoom && galleryRoom.activate(kind, hitObj)) return;   // the Keeper's Gallery handles its own things
  if (round.on) {                                   // in the dark, only the Round matters
    if (kind === 'roundTarget') roundHit(hitObj.userData.id);
    else if (kind !== 'hoodLamp') roundMiss();
    return;
  }
  if (kind === 'roundTarget') { showCaption('On velvet, where I can find it. Some things are mine to lose.', 4800); return; }
  if (kind === 'hoodLamp') {
    const again = !!tilesHeld().II;
    goThen(HOOD.x + 0.75, HOOD.z + 0.55, () => {
      if (again) showCaption('You have my tile already. Play again, for a better time?', 3200);
      setTimeout(() => startRound(false), again ? 2800 : 0);
    });
    return;
  }
  if (kind === 'lockchest') {
    if (tilesHeld().III) { showCaption('Open, and empty. Its tile is on your passport.', 4200); return; }
    goThen(AX + 1.15, -21.85, () => openLock());
    return;
  }
  if (kind === 'say') {
    const u = hitObj && hitObj.userData || {};
    if (GUEST && u.say === 'board') { goThen(1.9, -2.6, () => openScrapBoard()); return; }
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
  // a guest room's furniture: walk round to where you can see behind it, then the Keeper says his line
  if (kind === 'prop') { const u = hitObj.userData; goThen(u.stand[0], u.stand[1], () => showCaption(u.line, 5600)); return; }
  // the Keeper's globe (guest room): walk up to it; its pins and plaque speak
  if (kind === 'globe') { goThen(BOOK_ROOM ? 1.75 : 2.25, BOOK_ROOM ? 2.45 : 2.35, openGlobeView); return; }
  if (kind === 'globePlaque') { goThen(BOOK_ROOM ? 1.75 : 2.25, BOOK_ROOM ? 2.45 : 2.35, () => showCaption(BOOK_ROOM ? 'From every corner they come. A copper pin for every place my visitors call home, a brass one for each who signed my book.' : 'More than 3.4 million active geocaches, hidden in 191 countries. So says Geocaching HQ, 2026.', 6500)); return; }
  if (kind === 'vbookTable') { openVisitorsBook(); return; }
  if (kind === 'globePin') { showCaption(globePinLine(hitObj.userData), 7000); return; }
  if (kind === 'scrap') { const w = hitObj; goThen(w.position.x + (player.pos.x - w.position.x) * 0.35, w.position.z + (player.pos.z - w.position.z) * 0.35, () => openScrap(w.userData.idx)); return; }
  if (kind === 'notebook') { goThen(-0.2, -1.9, () => openNotebook()); return; }
  if (kind === 'chartStudy') { goThen(2.3, -2.3, () => { showCaption(STUDY_SAY.chart, 8000); markFound('chart'); }); return; }
  if (kind === 'chair') { if (GUEST) openGuestLog(); else sitAtDesk(); return; }
  if (kind === 'stack' && GUEST && !study.boardSolved) {
    showCaption('My own puzzles, and a gift for later. They are not part of the cache: find the note first.', 6000);
    return;
  }
  if (kind === 'stack') {
    markFound('stack');
    const sp = stackWorldPos();
    const d = Math.hypot(player.pos.x - sp.x, player.pos.z - sp.z);
    if (d > 2.4) {
      const dirx = (player.pos.x - sp.x) / d, dirz = (player.pos.z - sp.z) / d;
      moveTo(sp.x + dirx * 1.9, sp.z + dirz * 1.9, () => openReward(GALLERY ? 'G' : 'I'));
    } else openReward(GALLERY ? 'G' : 'I');
  } else if (kind === 'tome') {
    goThen(AX + 0.85, -11.3, () => openReward('II'));
  } else if (kind === 'chest') {
    goThen(AX, -23.4, () => openReward('III'));
  } else if (kind === 'masterTome') {
    goThen(AX, -27.6, () => openReward('IV'));
  } else if (kind === 'bookcase') {
    if (doorAnim) return;
    if (doorAmt > 0.5) { closeBookcase(); return; }
    showCaption(STUDY_SAY.shelf, 5600); markFound('shelf');      // shut, it is just another case
  } else if (kind === 'oddbook') {
    if (doorAnim) return;
    if (doorAmt > 0.5) { closeBookcase(); return; }
    playThud(); markFound('shelf');
    goThen(-1.6, -2.6, () => openBookcase());
  } else if (kind === 'exit') {
    goThen(0, 3.05, () => {
      // 2026-11-09: once per tab, a book visitor leaving by the door sees the optional farewell card (vault.astro)
      // with the email box and a "Continue" button that goes on to the landing. Guests never see it.
      if (!GUEST && !GALLERY && window.__vaultFarewell && window.__vaultFarewell('/')) return;   // the Gallery has no sign-up box
      showCaption('Back to the beginning. The door remembers you.', 2400);
      fadeEl.classList.remove('clear');
      setTimeout(() => { window.location.href = GUEST ? GUEST.home : '/'; }, 900);
    });
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
      unlitGlim.material.opacity = 0.5;
      goThen(V3.minX + 1.3, -24.8, () => openWordbox('fourth'));
    }
  }
}
function openBookcase() {
  if (doorAnim || doorAmt >= 1) return;
  doorAnim = { from: hinge.rotation.y, to: -1.62, start: performance.now(), dur: 1700 };
  playCreak();
  setTimeout(() => playBoom(0.5), 1400);
  showCaption(GUEST ? 'The shelves swing wide onto other vaults. They are not part of your cache, and none of your note lies beyond them.' : 'The shelves swing wide — a passage, kept from every map.', GUEST ? 9000 : 5600);
  hinge.userData.label = 'The way lies open · tap the shelves to close them';
  oddHit.userData.label = 'The odd book · tap to close the shelves';
  doorOpened = true;
  psEventOnce(PS_EV.BOOKCASE_OPEN);
  psTouch('bookcase');
}
function closeBookcase() {
  if (doorAnim || doorAmt <= 0) return;
  // never shut it on someone standing in the passage, or on the far side of it
  if (player.pos.z < -3.3) { showCaption('Step clear of the passage first.', 3200); return; }
  doorAnim = { from: hinge.rotation.y, to: 0, start: performance.now(), dur: 1500 };
  playCreak();
  setTimeout(() => playBoom(0.35), 1300);
  showCaption('The shelves settle back into the wall. Nobody would know.', 4800);
  hinge.userData.label = "The Keeper's shelves";
  oddHit.userData.label = 'A book that sits proud of its row';
  doorOpened = false;
}

/* ================= THE STUDY, ALIVE (2026-09-03) =================
   Object lines, the candle that stays snuffed, the Keeper's Notebook, three rejects that unfold
   into two-answer drafts, the discovery count, and the desk where today's page is played.
   Nothing here gates anything; no line may ever contain an answer word. */
const STUDY_KEY = GUEST ? 'ps_study_guest_v1' : GALLERY ? 'ps_gallery_study_v1' : 'ps_study_v1';   // the Gallery never touches Vault I's count
const STUDY_ITEMS = GUEST ? GUEST.items : ['stack', 'p1', 'p4', 'p7', 'candle', 'quill', 'board', 'reject0', 'reject1', 'reject2', 'shelf', 'sconce', 'notebook', 'chart', 'desk'];
let study = (() => { try { const v = JSON.parse(localStorage.getItem(STUDY_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } })();
if (!Array.isArray(study.found)) study.found = [];
// A guest's record belongs to one room and one note: a new outlet, or a re-kept position, starts clean.
// (A record without a stamp - older visits, or the painted vault - is adopted, never wiped.)
if (GUEST) {
  const stamp = GUEST.id + ':' + GUEST.frags.join('').replace(/\D/g, '').slice(-6);
  if (study.room && study.room !== stamp) study = { found: [] };
  study.room = stamp;
  try { localStorage.setItem(STUDY_KEY, JSON.stringify(study)); } catch (e) { /* private mode */ }
}
function saveStudy() { try { localStorage.setItem(STUDY_KEY, JSON.stringify(study)); } catch (e) { /* private mode */ } }
const studyCountEl = document.getElementById('studyCount');
function studyFound() {
  const s = new Set(study.found);
  pagesFound.forEach((p) => { if (p === 1 || p === 4 || p === 7) s.add('p' + p); });
  try { const v = JSON.parse(localStorage.getItem(VAULT_KEY) || '{}'); if (v && v.I) s.add('stack'); } catch (e) {}
  // A guest counts the four scraps and nothing else — the gift and the story pages were tipping the
  // count to "every piece found" with a scrap still missing (2026-10-01 desktop test).
  if (GUEST) return new Set([...s].filter((id) => GUEST.items.includes(id)));
  return s;
}
function renderStudyCount() {
  const n = studyFound().size, m = STUDY_ITEMS.length;
  if (GUEST) { renderGpsr(true); return; }
  studyCountEl.innerHTML = n >= m ? 'Every one of my things, found' : ('Found <b>' + n + '</b> of ' + m + ' in the study');
}
/* --- A GUEST's counter is a GPSr (2026-10-09, PinPoint's feedback: "I couldn't see the counter",
       and two of the four pieces sit beside and behind where you arrive). It says how many pieces
       are found and points, with a distance, at the nearest one still on the floor; then at the
       pinboard; then at the logbook on the desk. Built with DOM nodes, never innerHTML. --- */
const GPSR_BOARD = { x: 1.9, z: -3.2 }, GPSR_LOG = { x: 0.5, z: -0.4 };
let gpsrEls = null, gpsrLast = '';
function gpsrTarget() {
  const have = scrapsFound();
  if (have.length < 4) {
    let best = null;
    rejects.forEach((w, i) => {
      if (have.includes('scrap' + i)) return;
      const d = Math.hypot(w.position.x - player.pos.x, w.position.z - player.pos.z);
      if (!best || d < best.d) best = { x: w.position.x, z: w.position.z, d, what: 'nearest piece' };
    });
    return best;
  }
  const t = study.boardSolved ? (study.logged ? null : { ...GPSR_LOG, what: 'the logbook' }) : { ...GPSR_BOARD, what: 'the board' };
  if (t) t.d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
  return t;
}
function renderGpsr(force) {
  if (!GUEST) return;
  if (!gpsrEls) {
    studyCountEl.classList.add('gpsr');
    studyCountEl.textContent = '';
    const mk = (cls, tag) => { const e = document.createElement(tag || 'span'); e.className = cls; studyCountEl.appendChild(e); return e; };
    gpsrEls = { ttl: mk('g-ttl'), count: mk('g-count'), arr: mk('g-arr'), dist: mk('g-dist') };
    gpsrEls.ttl.textContent = 'GPSr';
    gpsrEls.arr.textContent = '▲';
    gpsrEls.arr.setAttribute('aria-hidden', 'true');
  }
  if (!GUEST.frags.length) { studyCountEl.style.display = 'none'; return; }   // a room no longer kept: nothing to point at
  const n = scrapsFound().length, t = gpsrTarget();
  const countTxt = n >= 4 ? 'All 4 pieces found' : ('Pieces found: ' + n + ' of 4');
  // angle of the target relative to where the camera faces: 0 = dead ahead, + = to the right
  let ang = 0;
  if (t) {
    const dx = t.x - player.pos.x, dz = t.z - player.pos.z;
    const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw), right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    ang = Math.atan2(right, fwd) * 180 / Math.PI;
  }
  let distTxt;
  if (!t) distTxt = 'Logged. Happy caching!';
  else if (t.d < 1.1) distTxt = t.what === 'nearest piece' ? 'right here, look down' : t.what + ', right here';
  else distTxt = t.what + ' · ' + t.d.toFixed(1) + ' m' + (Math.abs(ang) > 135 ? ', behind you' : '');
  const key = countTxt + '|' + distTxt;
  if (force || key !== gpsrLast) { gpsrLast = key; gpsrEls.count.textContent = countTxt; gpsrEls.dist.textContent = distTxt; }
  // style writes only when something changed (this runs every frame in the study)
  const vis = (t && t.d >= 1.1) ? 'visible' : 'hidden', rot = 'rotate(' + ang.toFixed(0) + 'deg)';
  if (gpsrEls.vis !== vis) { gpsrEls.vis = vis; gpsrEls.arr.style.visibility = vis; }
  if (gpsrEls.rot !== rot) { gpsrEls.rot = rot; gpsrEls.arr.style.transform = rot; }
}
function markFound(id) {
  if (!STUDY_ITEMS.includes(id) || study.found.includes(id)) { renderStudyCount(); return; }
  study.found.push(id); saveStudy(); renderStudyCount();
  if (studyFound().size >= STUDY_ITEMS.length) setTimeout(() => { showCaption(GUEST ? GUEST.allFound : 'Every one of my things, and you touched them all. The study is yours as much as mine now.', 7000); burstConfetti(); }, 900);
}
setCandle(study.candle !== 'out');
renderStudyCount();
if (GUEST) rejects.forEach((w, i) => { if (w.userData.glow && (study.found || []).includes('scrap' + i)) w.userData.glow.material.opacity = 0.10; });
const STUDY_SAY = {
  quill: 'Every puzzle I ever set began with that nib. Most of them ended in the fire.',
  board: 'Two hundred grids, pinned and re-pinned. Some were never quite what they seemed.',
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
/* --- the rejects: three full pages in the book's dress, each with exactly two answers.
       The grids live in /data/rejects.json (machine-verified: two solutions, unlike any book or
       arcade puzzle); the page borders are the book's own printed borders. --- */
const DRAFT_NOTES = [
  'Two answers. Burn it. A grid that cannot make up its mind is not a puzzle — it is a coin toss with numbers on it.',
  'I gave it too few clues, and it gave me two truths back. Every one of the two hundred in my book has exactly one. This one has a twin.',
  'The deadly rectangle: four cells, two digits, and no way to choose between them. Every setter falls into this hole once. Then never again.',
];
const DRAFT_BORDERS = ['/art/page-border-easy.webp', '/art/page-border-medium.webp', '/art/page-border-hard.webp'];
let DRAFTS = [];
function loadDrafts() { return fetch('/data/rejects.json').then((r) => r.json()).then((d) => { if (Array.isArray(d)) DRAFTS = d; }).catch(() => {}); }
if (!GALLERY) loadDrafts();
const draftEl = document.getElementById('draft'), draftGrid = document.getElementById('draftGrid');
let draftCur = 0, draftShow = null;
function drawDraft() {
  const D = DRAFTS[draftCur]; if (!D) return;
  draftGrid.innerHTML = '';
  const fill = draftShow ? D[draftShow] : null;
  const diff = new Set(D.diff || []);
  for (let i = 0; i < 81; i++) {
    const c = document.createElement('i');
    const given = D.g[i] !== '0';
    c.textContent = given ? D.g[i] : (fill ? fill[i] : '');
    if (!given && fill) c.classList.add('pen');
    if (diff.has(i) && fill) c.classList.add('hot');
    if (i % 9 === 2 || i % 9 === 5) c.classList.add('b3');
    const r = Math.floor(i / 9); if (r === 2 || r === 5) c.classList.add('r3');
    draftGrid.appendChild(c);
  }
  document.getElementById('draftSheet').style.backgroundImage = 'url(' + DRAFT_BORDERS[draftCur % 3] + ')';
  markDraftBtns();
  document.getElementById('draftHead').textContent = 'DRAFT No. ' + (draftCur + 1) + ' · ' + (D.givens || '') + ' CLUES · TWO ANSWERS';
  document.getElementById('draftNote').textContent = DRAFT_NOTES[draftCur % 3];
}
function openDraft(idx) {
  if (!DRAFTS.length) { loadDrafts().then(() => { if (DRAFTS.length) openDraft(idx); else showCaption('The page is stuck to itself. Try again in a moment.', 3000); }); return; }
  draftCur = idx % DRAFTS.length; draftShow = null; drawDraft(); draftEl.classList.remove('scrap', 'vbook'); draftEl.hidden = false;
  showCaption('A page I threw away. Look at it and tell me why.', 4800);
  markFound('reject' + idx);
  psEventOnce(PS_EV.PAGE_REJECTS);
  psTouch('rejects');
}
document.getElementById('draftA').addEventListener('click', () => { draftShow = 'a'; drawDraft(); });
document.getElementById('draftB').addEventListener('click', () => { draftShow = 'b'; drawDraft(); });
function markDraftBtns() { document.getElementById('draftA').setAttribute('aria-pressed', String(draftShow === 'a')); document.getElementById('draftB').setAttribute('aria-pressed', String(draftShow === 'b')); }
document.getElementById('draftClose').addEventListener('click', () => { draftEl.hidden = true; });

/* ================= THE GUEST ROOM (2026-09-24) =================
   Built only when GUEST is set (see the top of the file). Four scraps replace the three
   rejects; each unfolds into a piece of the note the Keeper tore; the pinboard holds the
   pieces in four fixed slots with the whole line and a copy button, because a caption that
   fades in six seconds is no use on a hillside. Every string here came from the server with
   the word; nothing is written with innerHTML. Door II is the way on, and for a guest it says
   plainly that it wants a word from the book. */
const scrapKick = document.getElementById('scrapKick'), scrapText = document.getElementById('scrapText'),
  scrapBoard = document.getElementById('scrapBoard'), scrapSlots = document.getElementById('scrapSlots'),
  scrapFull = document.getElementById('scrapFull'), scrapCopy = document.getElementById('scrapCopy'), scrapSay = document.getElementById('scrapSay');
const scrapLogPrompt = document.getElementById('scrapLogPrompt'), scrapLog = document.getElementById('scrapLog'),
  scrapLogHint = document.getElementById('scrapLogHint'), vbBackToPosition = document.getElementById('vbBackToPosition');
function updateScrapLogCopy() {
  scrapLog.textContent = study.signed ? 'View the Visitors’ Book' : 'Sign the Visitors’ Book';
  scrapLogHint.textContent = study.signed
    ? 'Read the same Visitors’ Book that’s on the desk.'
    : 'Optional. Leave your initials and general location in the same book as the one on the desk.';
}
const SLOT_HINTS = ['north, degrees', 'north, the rest', 'west, degrees', 'west, the rest'];
function scrapsFound() { return GUEST ? GUEST.items.filter((id) => study.found.includes(id)) : []; }
function fullPosition() { const f = GUEST.frags; return f.length === 4 ? (f[0] + f[1].replace(/^[NSEW]\s*…?/, '') + '  ' + f[2] + f[3].replace(/^[NSEW]\s*…?/, '')) : ''; }
function showScrapOverlay() {
  draftEl.classList.remove('vbook'); const vb = document.getElementById('vb'); if (vb) vb.hidden = true;   // only the visitors' book shows it
  draftEl.classList.add('scrap'); draftEl.hidden = false;
}
function openScrap(idx) {
  if (!GUEST) return;
  if (!GUEST.frags.length) { showCaption(GUEST.retired, 7000); return; }
  scrapBoard.hidden = true;
  const isNew = !study.found.includes('scrap' + idx);
  markFound('scrap' + idx);
  const k = scrapsFound().length, left = ['', 'One', 'Two', 'Three'][4 - k] || '';
  // the count, not the slot number: a first find used to read "3 OF 4" (2026-10-09)
  scrapKick.textContent = 'A PIECE OF THE NOTE · ' + k + ' OF 4 FOUND';
  scrapText.textContent = GUEST.frags[idx] || '';
  scrapSay.textContent = GUEST.scrapLine + ' ' + (k < 4
    ? left + (k === 3 ? ' piece still lies on the floor; the GPSr will point you to it.' : ' pieces still lie on the floor; the GPSr will point you to them.')
    : isNew ? 'That was the last of them. Go to the board: it holds the whole note now.' : 'All four are pinned on the board.');
  showScrapOverlay();
  const wq = rejects[idx]; if (wq && wq.userData.glow) wq.userData.glow.material.opacity = 0.10;   // found = quiet, still visible
  psEvent(PS_EV.GUEST_SCRAP, scrapsFound().length + ' of 4');   // every scrap, with the running count (2026-10-01)
  psTouch('rejects');
}
function openScrapBoard(fromLogbook = false) {
  if (!GUEST) return;
  const have = scrapsFound();
  scrapKick.textContent = 'THE PINBOARD';
  scrapText.textContent = '';
  scrapSlots.innerHTML = '';
  GUEST.items.forEach((id, i) => {
    const el = document.createElement('i');
    if (have.includes(id) && GUEST.frags[i]) { el.textContent = GUEST.frags[i]; }
    else { el.textContent = SLOT_HINTS[i]; el.classList.add('empty'); }
    scrapSlots.appendChild(el);
  });
  const all = have.length === 4 && GUEST.frags.length === 4;
  scrapFull.textContent = all ? fullPosition() : '';
  scrapCopy.hidden = !all;
  scrapLogPrompt.hidden = !all;
  if (all) updateScrapLogCopy();
  scrapBoard.hidden = false;
  scrapSay.textContent = all ? GUEST.allFound : (have.length ? 'Pinned. ' + (4 - have.length) + ' still to find.' : GUEST.boardEmpty);
  showScrapOverlay();
  markFound('board');
  if (!fromLogbook) psEvent(PS_EV.GUEST_BOARD, have.length + ' of 4 pinned');
  if (all) {
    psEventOnce(PS_EV.GUEST_SOLVED);
    if (!study.boardSolved) { study.boardSolved = true; saveStudy(); }
    setLogGlow();
  }
  renderGpsr(true);
}
/* --- The Keeper's logbook (guest rooms only): the desk's daily sudoku was being taken for a cache
       step (PinPoint, 2026-10-07/08), so in a guest room the desk holds a logbook instead. It does
       nothing until the note is whole; then a finder can sign it. Progress is local; signatures use the shared Visitors' Book. --- */
function setLogGlow() { if (logGlow) logGlow.material.opacity = (study.boardSolved && !study.logged) ? 0.6 : 0.0; }
setLogGlow();
/* ---- THE VISITORS' BOOK (Dan, 2026-11-14) — the desk's book, open to every visitor to read; a finder
   with all four pieces may sign it: initials + country + (state / province / county, required in the US,
   Canada and Australia) + optionally the nearest town of 15,000+, every part picked from a list.
   Optional and never part of the find (Groundspeak bans extra logging requirements), so every finder
   gets the thanks whether they sign or not. Everything is built with text nodes, never innerHTML. --- */
const vbEl = document.getElementById('vb'), vbForm = document.getElementById('vbForm'), vbIni = document.getElementById('vbIni');
const vbCc = document.getElementById('vbCc'), vbCity = document.getElementById('vbCity'), vbSug = document.getElementById('vbSug');
const vbReg = document.getElementById('vbReg'), vbRegWrap = document.getElementById('vbRegWrap'), vbRegL = document.getElementById('vbRegL');
const vbMsg = document.getElementById('vbMsg'), vbCount = document.getElementById('vbCount'), vbList = document.getElementById('vbList');
const vbPreview = document.getElementById('vbPreview');
const vbState = { pageEntries: null, pageTotal: 0, offset: 0, snapshot: '', nextCursor: null, prevCursor: null, loading: false, pageError: '', request: 0, entries: null, total: 0, you: '', place: '', data: {}, codes: null, sending: false, opts: [], active: -1 };
let ccName = (cc) => cc;
try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); ccName = (cc) => { try { return dn.of(cc) || cc; } catch (e) { return cc; } }; } catch (e) { /* old browser: codes */ }
const ccShort = (cc) => (cc === 'US' ? 'USA' : cc === 'GB' ? 'UK' : ccName(cc));
const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "near Hamburg, New York, USA" · "New York, USA" · "near Telford, UK" (older entries had no region) · "Germany"
function vbWhere(e) {
  const parts = [];
  if (e.p) parts.push('near ' + e.p);
  if (e.r && e.r !== e.p) parts.push(e.r);
  parts.push(ccShort(e.cc));
  return parts.join(', ');
}
const vbSame = (a, b) => !!(a && b && a.i === b.i && (a.p || '') === (b.p || '') && (a.r || '') === (b.r || '') && a.cc === b.cc && (a.rm || 'pinpoint') === (b.rm || 'pinpoint'));
// one shared book, read in both rooms: each line says where it was signed
const VB_ROOM_SAY = { book: 'Vault I', pinpoint: 'PinPoint' };
function vbRow(e, mine) {
  const li = document.createElement('li'); if (mine) li.className = 'you';
  const b = document.createElement('b'); b.textContent = e.i; li.appendChild(b);
  li.appendChild(document.createTextNode(vbWhere(e) + ' '));
  const m = document.createElement('i'); m.textContent = [VB_ROOM_SAY[e.rm || 'pinpoint'], e.m].filter(Boolean).map((x) => '· ' + x).join(' '); li.appendChild(m);
  return li;
}
const vbNewer = document.getElementById('vbNewer'), vbOlder = document.getElementById('vbOlder');
const vbPageStatus = document.getElementById('vbPageStatus'), vbRetry = document.getElementById('vbRetry');
function vbRender() {
  vbList.textContent = '';
  const mine = study.signed && study.signed.i ? study.signed : null;
  const rows = Array.isArray(vbState.pageEntries) ? vbState.pageEntries.slice(0, 10) : [];
  rows.forEach((e) => vbList.appendChild(vbRow(e, vbSame(e, mine))));
  vbList.start = vbState.offset + 1;
  const own = document.getElementById('vbOwn'), ownList = document.getElementById('vbOwnList');
  ownList.textContent = ''; own.hidden = !mine || rows.some((e) => vbSame(e, mine));
  if (!own.hidden) ownList.appendChild(vbRow(mine, true));
  vbCount.textContent = vbState.total ? vbState.total + ' visitors have signed' : 'The Visitors’ Book';
  vbList.setAttribute('aria-busy', String(vbState.loading));
  const n = vbState.pageTotal, first = rows.length ? vbState.offset + 1 : 0;
  const available = vbState.total > n ? ' latest available signatures (' + vbState.total + ' signed in all)' : ' signatures';
  vbPageStatus.textContent = vbState.loading ? 'Opening the page…' : vbState.pageError || (n
    ? first + '–' + (vbState.offset + rows.length) + ' of ' + n + available + ' · Page ' + (Math.floor(vbState.offset / 10) + 1) + ' of ' + Math.ceil(n / 10)
    : vbState.pageEntries === null ? 'Opening the book…' : vbState.total > 0 ? 'No signatures are currently available to read.' : 'Nobody has signed yet. Be the first.');
  vbNewer.disabled = vbState.loading || vbState.prevCursor === null;
  vbOlder.disabled = vbState.loading || vbState.nextCursor === null;
  vbRetry.hidden = !vbState.pageError;
}
async function vbLoadPage(cursor = 0, reset = false, notice = '') {
  const request = ++vbState.request;
  vbState.loading = true; vbState.pageError = ''; vbRender();
  const params = new URLSearchParams({ limit: '10' });
  if (!reset && vbState.snapshot) {
    params.set('snapshot', vbState.snapshot);
    if (cursor) params.set('cursor', String(cursor));
  }
  try {
    const r = await fetch('/api/visitors?' + params, { cache: 'no-store' }); const d = await r.json();
    if (request !== vbState.request) return;
    if (r.status === 409 && d.reason === 'page_changed') {
      vbState.snapshot = ''; return vbLoadPage(0, true, 'The book changed. Showing the newest page. ');
    }
    if (!r.ok || !d || !d.ok || !Array.isArray(d.entries)) throw new Error('page');
    vbState.pageEntries = d.entries.slice(0, 10); vbState.pageTotal = Number(d.availableTotal) || 0;
    vbState.total = Math.max(Number(d.total) || 0, vbState.pageTotal); vbState.offset = Number(d.offset) || 0;
    vbState.snapshot = d.snapshot || ''; vbState.nextCursor = d.nextCursor ?? null; vbState.prevCursor = d.prevCursor ?? null;
    vbState.pageError = ''; vbState.loading = false; vbRender();
    if (notice) vbPageStatus.textContent = notice + vbPageStatus.textContent;
  } catch (e) {
    if (request !== vbState.request) return;
    vbState.loading = false; vbState.pageError = 'This page could not be opened. Your place is kept. Try again when you have signal.';
    vbState.retryCursor = cursor; vbState.retryReset = reset; vbRender();
  }
}
vbNewer.addEventListener('click', () => { if (!vbState.loading && vbState.prevCursor !== null) vbLoadPage(vbState.prevCursor); });
vbOlder.addEventListener('click', () => { if (!vbState.loading && vbState.nextCursor !== null) vbLoadPage(vbState.nextCursor); });
vbRetry.addEventListener('click', () => vbLoadPage(vbState.retryCursor ?? 0, !!vbState.retryReset));
async function vbLoad() {
  try {
    // Keep the full legacy summary for globe pins; a ten-row reading page is never its data source.
    const r = await fetch('/api/visitors', { cache: 'no-store' }); const d = await r.json();
    if (d && /^[A-Z]{2}$/.test(d.you || '')) vbState.you = d.you;
    if (r.ok && d && d.ok && Array.isArray(d.entries)) { vbState.entries = d.entries; if (vbState.pageEntries === null) vbState.total = Number(d.total) || d.entries.length; vbState.visits = (d.visits && typeof d.visits === 'object') ? d.visits : {}; vbState.site = (d.site && typeof d.site === 'object') ? d.site : {}; }
    else vbState.entries = false;
  } catch (e) { vbState.entries = false; }
  if (vbState.pageEntries === null && !vbState.loading) await vbLoadPage(0, true); else vbRender();
  if (vbState.you && !vbCc.value && vbState.codes && vbState.codes.includes(vbState.you)) { vbCc.value = vbState.you; vbCcChanged(); }
}
let vbCodesLoading = null;
function vbCodes() {
  if (vbState.codes) return;
  if (vbCodesLoading) return vbCodesLoading;
  vbCodesLoading = (async () => {
    try {
      const c = await (await fetch('/data/places2/index.json')).json();
      if (!Array.isArray(c)) return;
      vbState.codes = [...new Set(c.filter((x) => /^[A-Z]{2}$/.test(x)))];
      vbState.codes.map((cc) => [cc, ccName(cc)]).sort((a, b) => a[1].localeCompare(b[1], 'en')).forEach(([cc, nm]) => {
        const o = document.createElement('option'); o.value = cc; o.textContent = nm; vbCc.appendChild(o);
      });
      if (!vbCc.value && vbState.you && vbState.codes.includes(vbState.you)) { vbCc.value = vbState.you; vbCcChanged(); }
    } catch (e) { /* A later opening can retry a failed country request. */ }
    finally { vbCodesLoading = null; }
  })();
  return vbCodesLoading;
}
async function vbCcChanged() {
  const cc = vbCc.value; vbState.place = ''; vbCity.value = ''; vbSugHide();
  vbReg.textContent = ''; vbRegWrap.hidden = true; vbCity.disabled = true; vbPreviewUpdate();
  if (!cc) return;
  if (!vbState.data[cc]) {
    try {
      const d = await (await fetch('/data/places2/' + cc + '.json')).json();
      if (d && d.towns && typeof d.towns === 'object') {
        // each town keeps the region it sits in, so picking a town can fill the region in
        const towns = [];
        for (const [reg, list] of Object.entries(d.towns)) if (Array.isArray(list)) list.forEach((t) => towns.push([t, fold(t), reg]));
        towns.sort((a, b) => a[0].localeCompare(b[0], 'en'));
        vbState.data[cc] = { label: String(d.label || ''), req: !!d.req, regions: Array.isArray(d.regions) ? d.regions : [], towns };
      }
    } catch (e) { vbMsg.textContent = 'The ink won’t take out here. Try again when you have signal.'; }
  }
  if (cc !== vbCc.value) return;              // the country changed again while that was loading
  const D = vbState.data[cc]; if (!D) return;
  if (D.regions.length) {
    vbRegL.textContent = D.label + (D.req ? '' : ' (optional)');
    const first = document.createElement('option'); first.value = '';
    first.textContent = D.req ? 'Choose your ' + D.label.toLowerCase().split(' ')[0] + '…' : 'Leave blank';
    vbReg.appendChild(first);
    let grp = null, grpName = null;
    D.regions.forEach(([name, group]) => {
      if (group && group !== grpName) { grp = document.createElement('optgroup'); grp.label = group; grpName = group; vbReg.appendChild(grp); }
      const o = document.createElement('option'); o.value = name; o.textContent = name; (group ? grp : vbReg).appendChild(o);
    });
    vbRegWrap.hidden = false;
  }
  vbCity.disabled = false; vbPreviewUpdate();
}
function vbTownsFor() {
  const D = vbState.data[vbCc.value]; if (!D) return [];
  const r = vbRegWrap.hidden ? '' : vbReg.value;
  return r ? D.towns.filter((t) => t[2] === r) : D.towns;
}
function vbSugHide() { vbSug.hidden = true; vbSug.textContent = ''; vbState.opts = []; vbState.active = -1; vbCity.setAttribute('aria-expanded', 'false'); }
function vbPick(t) {
  vbState.place = t[0]; vbCity.value = t[0]; vbSugHide();
  // a town picked before a region fills the region in (Telford -> Shropshire) when it sits in only one
  if (!vbRegWrap.hidden && !vbReg.value) {
    const regs = new Set(vbState.data[vbCc.value].towns.filter((x) => x[0] === t[0]).map((x) => x[2]).filter(Boolean));
    if (regs.size === 1) vbReg.value = [...regs][0];
  }
  vbMsg.textContent = ''; vbPreviewUpdate();
}
function vbSearch() {
  vbState.place = ''; vbPreviewUpdate();
  const list = vbTownsFor(), q = fold(vbCity.value.trim());
  if (!q) { vbSugHide(); return; }
  const starts = [], words = [];
  for (const t of list) {
    if (t[1].startsWith(q)) starts.push(t); else if (t[1].includes(' ' + q) || t[1].includes('-' + q)) words.push(t);
    if (starts.length >= 8) break;
  }
  const opts = starts.concat(words).slice(0, 8);
  const showReg = !vbReg.value && opts.some((t) => t[2]);
  vbSug.textContent = ''; vbState.opts = opts; vbState.active = -1;
  if (!opts.length) { const li = document.createElement('li'); li.textContent = 'No town of 15,000+ by that name here. Try the nearest bigger one, or leave it blank.'; li.setAttribute('aria-disabled', 'true'); vbSug.appendChild(li); }
  opts.forEach((t, k) => {
    const li = document.createElement('li'); li.textContent = showReg && t[2] ? t[0] + ', ' + t[2] : t[0]; li.id = 'vbOpt' + k; li.setAttribute('role', 'option');
    li.addEventListener('pointerdown', (e) => { e.preventDefault(); vbPick(t); });
    vbSug.appendChild(li);
  });
  vbSug.hidden = false; vbCity.setAttribute('aria-expanded', 'true');
}
function vbEntry() { return { i: vbIni.value, p: vbState.place, r: vbRegWrap.hidden ? '' : vbReg.value, cc: vbCc.value }; }
// what is still missing, in the Keeper's words ('' = ready). The button stays live, so a tap always explains.
function vbMissing() {
  if (!/^[A-Z]{2,3}$/.test(vbIni.value)) return 'Two or three letters for your initials, please.';
  if (!vbCc.value) return 'Choose your country.';
  const D = vbState.data[vbCc.value];
  if (!D) return 'One moment, the pages are turning.';
  if (D.req && D.regions.length && !vbReg.value) return 'Choose your ' + D.label.toLowerCase().split(' ')[0] + '.';
  if (vbCity.value.trim() && !vbState.place) return 'Pick your town from the list, or clear it.';
  return '';
}
function vbPreviewUpdate() {
  vbPreview.textContent = '';
  if (!/^[A-Z]{2,3}$/.test(vbIni.value) || !vbCc.value) return;
  vbPreview.appendChild(document.createTextNode('You’ll appear as: '));
  const b = document.createElement('b'); b.textContent = vbIni.value; vbPreview.appendChild(b);
  vbPreview.appendChild(document.createTextNode(' ' + vbWhere(vbEntry())));
}
vbIni.addEventListener('input', () => { const v = vbIni.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); if (v !== vbIni.value) vbIni.value = v; vbMsg.textContent = ''; vbPreviewUpdate(); });
vbCc.addEventListener('change', () => { vbMsg.textContent = ''; vbCcChanged(); });
vbReg.addEventListener('change', () => { vbMsg.textContent = ''; vbState.place = ''; vbCity.value = ''; vbSugHide(); vbPreviewUpdate(); });
vbCity.addEventListener('input', () => { vbMsg.textContent = ''; vbSearch(); });
vbCity.addEventListener('keydown', (e) => {
  const n = vbState.opts.length; if (!n || vbSug.hidden) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); vbState.active = (vbState.active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    [...vbSug.children].forEach((li, k) => li.setAttribute('aria-selected', k === vbState.active ? 'true' : 'false'));
    vbCity.setAttribute('aria-activedescendant', 'vbOpt' + vbState.active);
  } else if (e.key === 'Enter' && vbState.active >= 0) { e.preventDefault(); vbPick(vbState.opts[vbState.active]); }
});
// on a phone, lift the field to the top so the keyboard never hides the town suggestions under it
[vbIni, vbCc, vbReg, vbCity].forEach((el) => el.addEventListener('focus', () => { if (IS_TOUCH) setTimeout(() => el.scrollIntoView({ block: 'start' }), 300); }));
document.getElementById('vbSkip').addEventListener('click', () => { vbForm.hidden = true; scrapSay.textContent = VB_COPY.skip; });
vbForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (vbState.sending) return;
  const miss = vbMissing(); if (miss) { vbMsg.textContent = miss; return; }
  const entry = vbEntry();
  vbState.sending = true; vbMsg.textContent = 'Writing…';
  let d = null;
  try { const r = await fetch('/api/visitors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initials: entry.i, cc: entry.cc, region: entry.r, town: entry.p, room: BOOK_ROOM ? 'book' : 'pinpoint' }) }); d = await r.json(); } catch (err) { d = null; }
  vbState.sending = false;
  if (d && d.ok) {
    const now = new Date(); entry.m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getUTCMonth()] + ' ' + now.getUTCFullYear();
    entry.rm = BOOK_ROOM ? 'book' : 'pinpoint';
    study.signed = entry; saveStudy();
    vbForm.hidden = true; vbMsg.textContent = '';
    if (!draftEl.hidden && !vbEl.hidden && draftEl.classList.contains('vbook')) scrapSay.textContent = VB_COPY.done;
    if (GUEST && !draftEl.hidden && !scrapBoard.hidden) updateScrapLogCopy();
    if (!d.dup) vbState.total += 1;
    vbRender(); globePins();
    if (d.pending) setTimeout(() => { vbState.entries = null; vbState.pageEntries = null; vbState.snapshot = ''; vbLoad(); }, 4000);
    else vbLoadPage(0, true);
    return;
  }
  const why = d && d.reason;
  vbMsg.textContent = why === 'bad_initials' ? 'Those initials won’t go in my book. Try your own.'
    : why === 'need_region' ? (vbMissing() || 'Choose your state or province.')
    : why === 'bad_place' || why === 'bad_country' || why === 'bad_region' ? 'Pick your place from the lists.'
    : why === 'slow_down' || why === 'full' ? 'The book is resting. Try again in a while.'
    : 'The ink won’t take out here. Try again when you have signal.';
});
/* ---- the globe's pins (guest room): one brass pin per place the Visitors' Book was signed from — never finer
   than a town of 15,000+, never initials — and a red pin on Telford, GCBYBY3's home town. A pin's line invites
   the visitor to sign the book on the desk. Positions come from the same GeoNames lists the book uses. --- */
const GLOBE_R = 0.29, Y_UP = new THREE.Vector3(0, 1, 0);
const globePinGeo = { shaft: new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 6), head: new THREE.SphereGeometry(0.012, 12, 10), homeShaft: new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), homeHead: new THREE.SphereGeometry(0.015, 12, 10) };
const globePinMat = {
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.5, roughness: 0.35, emissive: 0x3a2608, emissiveIntensity: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0x9a1c14, roughness: 0.45, emissive: 0x3a0604, emissiveIntensity: 0.5 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x3a3028, metalness: 0.6, roughness: 0.5 }),
};
const globeCoords = {};
let globeCentroids = null;
// a visiting country's mark: a flat ink dot on the parchment (not a pin), a little larger for more visitors
const globeDotGeo = new THREE.CircleGeometry(1, 20);
const globeDotMat = new THREE.MeshBasicMaterial({ color: 0x5a1e10, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const CC_SAY = { GB: 'the UK', US: 'the US', NL: 'the Netherlands', AE: 'the UAE', PH: 'the Philippines', CZ: 'the Czech Republic', DO: 'the Dominican Republic', BS: 'the Bahamas' };
function globeAddDot(lat, lon, n, cc) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const nrm = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  const d = new THREE.Mesh(globeDotGeo, globeDotMat);
  const r = Math.min(0.02, 0.007 + 0.0025 * Math.log2(1 + n));
  d.scale.set(r, r, r); d.position.copy(nrm).multiplyScalar(0.2905);
  d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
  d.userData = { kind: 'globePin', label: 'Visitors from ' + (CC_SAY[cc] || ccName(cc)), visit: true, cc, n, lat, lon };
  globe.spin.add(d); globe.pins.push(d); interactables.push(d);
}
function globeAddPin(lat, lon, mat, data) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const n = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  const g = new THREE.Group(); g.position.copy(n).multiplyScalar(GLOBE_R); g.quaternion.setFromUnitVectors(Y_UP, n);
  // Telford's red pin stands taller than the brass ones, so it is never buried among them
  const tall = !!data.home;
  const shaft = new THREE.Mesh(tall ? globePinGeo.homeShaft : globePinGeo.shaft, globePinMat.iron); shaft.position.y = tall ? 0.025 : 0.015; g.add(shaft);
  const head = new THREE.Mesh(tall ? globePinGeo.homeHead : globePinGeo.head, mat); head.position.y = tall ? 0.052 : 0.032; g.add(head);
  g.userData = { kind: 'globePin', label: data.home ? 'A red pin' : 'A brass pin', ...data, lat, lon };
  globe.spin.add(g); globe.pins.push(g); interactables.push(g);
}
// each room's own wording for the visitors' book (Dan, 2026-11-14: one shared book, read in both rooms)
const VB_COPY = BOOK_ROOM ? {
  where: 'on the little table by the globe',
  note: 'Optional. Initials and your area only, never your name or address. Everyone who visits can read it. Under 13? Ask a grown-up first.',
  open: 'Sign my visitors’ book if you like. Everyone who visits my study, here and in PinPoint’s room, can read it.',
  signed: 'You have signed my visitors’ book. Thank you for visiting.',
  done: 'Signed, and in ink. Thank you for visiting my study.',
  skip: 'As you like. The book will keep.',
} : {
  where: 'on the desk',
  note: 'Optional, and not part of your find. Initials and your area only, never your name or address. Everyone who visits can read it.',
  done: 'Signed, and in ink. My thanks for the find. Now go and sign the real log, out where the note says.',
  skip: 'As you like. My thanks for the find. Now go and sign the real log, out where the note says.',
};
const STATE_SAY = { 'US-NY': 'New York State', 'US-WA': 'Washington State', 'US-DC': 'Washington, D.C.' };
let globeStateNames = null;
function globePlaceName(key) {
  const [cc, st] = key.split('-');
  if (!st) return CC_SAY[key] || ccName(key);
  if (key === 'US-DC') return 'Washington, D.C.';
  const nm = STATE_SAY[key] || (globeStateNames && globeStateNames[key]) || st;
  return nm + ', ' + (cc === 'US' ? 'USA' : cc === 'CA' ? 'Canada' : ccName(cc));
}
function globeInvite() {
  if (study.signed) return '';
  if (GUEST && scrapsFound().length < 4) return ' Find all four pieces, then sign my visitors’ book ' + VB_COPY.where + '.';
  return ' Sign my visitors’ book ' + VB_COPY.where + ' and add your own pin.';
}
function globePinLine(u) {
  if (u.home) return 'Telford, Shropshire, UK. GCBYBY3’s home town.';
  if (u.visit) {
    const place = globePlaceName(u.cc);
    const [cc, st] = u.cc.split('-');
    const stName = st && globeStateNames ? globeStateNames[u.cc] : '';
    const signed = (vbState.entries || []).filter((e) => e.cc === cc && (!st || (stName && e.r === stName))).length;
    // fewer than five reads "a few" (privacy: a lone pin must never point at one person)
    const head = (u.n < 5 ? 'A few visitors from ' : 'About ' + u.n + ' visitors from ') + place + ' so far';
    return head + (signed ? ' · ' + signed + ' signed my book.' : '.') + globeInvite();
  }
  const who = u.count === 1 ? 'One visitor' : u.count + ' visitors';
  return who + ' signed my book from ' + u.where + '.' + globeInvite();
}
async function globePins() {
  if (!globe) return;
  globe.pins.filter((p) => !p.userData.home).forEach((p) => { globe.spin.remove(p); const i = interactables.indexOf(p); if (i >= 0) interactables.splice(i, 1); });
  globe.pins = globe.pins.filter((p) => p.userData.home);
  const rows = (vbState.entries || []).slice(), mine = study.signed && study.signed.i ? study.signed : null;
  if (mine && !rows.some((e) => vbSame(e, mine))) rows.unshift(mine);
  const groups = new Map();
  for (const e of rows) { const k = e.cc + '|' + (e.r || '') + '|' + (e.p || ''); const g = groups.get(k) || { e, count: 0 }; g.count++; groups.set(k, g); }
  for (const cc of new Set(rows.map((e) => e.cc))) {
    if (globeCoords[cc] || !/^[A-Z]{2}$/.test(cc)) continue;
    try { globeCoords[cc] = await (await fetch('/data/places2/' + cc + '.json')).json(); } catch (err) { globeCoords[cc] = null; }
  }
  let n = 0;
  for (const { e, count } of groups.values()) {
    const d = globeCoords[e.cc]; if (!d || !d.c) continue;
    let at = null;
    if (e.p) {
      for (const [reg, list] of Object.entries(d.towns || {})) {
        if (e.r && reg !== e.r) continue;
        const i = list.indexOf(e.p); if (i >= 0 && d.tc && d.tc[reg]) { at = d.tc[reg][i]; break; }
      }
    }
    if (!at && e.r && d.rc) at = d.rc[e.r];
    if (!at) at = d.c;
    if (!at || (at[0] === 0 && at[1] === 0)) continue;
    globeAddPin(at[0], at[1], globePinMat.brass, { count, where: vbWhere(e) });
    if (++n >= 80) break;
  }
  // where visitors came from. PinPoint's room: arrivals at its door, by country (ink dots). The book's study:
  // every site visitor, by country or US/Canadian state, as copper pins whose heads grow a little with the count.
  const visits = Object.assign({}, (BOOK_ROOM ? vbState.site : vbState.visits) || {});
  if (GUEST && globe.freshVisit && vbState.you) visits[vbState.you] = (visits[vbState.you] || 0) + 1;   // the count is cached a minute; show your own now
  let keys = Object.keys(visits).filter((k) => /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(k) && visits[k] > 0);
  // a country shown state by state never also gets a country pin (its "state unknown" visitors stay in the count only)
  const byState = new Set(keys.filter((k) => k.includes('-')).map((k) => k.slice(0, 2)));
  keys = keys.filter((k) => k.includes('-') || !byState.has(k));
  if (keys.length) {
    if (!globeCentroids) { try { globeCentroids = await (await fetch('/data/places2/centroids.json')).json(); } catch (err) { globeCentroids = {}; } }
    if (BOOK_ROOM && !globeStateNames) { try { globeStateNames = await (await fetch('/data/places2/state-names.json')).json(); } catch (err) { globeStateNames = {}; } }
    keys.sort((a, b) => visits[b] - visits[a]).slice(0, 150).forEach((k) => {
      const at = globeCentroids[k] || (k === 'CA-NU' ? [63.75, -68.52] : null);
      if (!Array.isArray(at)) return;
      if (BOOK_ROOM) globeAddVisitPin(at[0], at[1], visits[k], k); else globeAddDot(at[0], at[1], visits[k], k);
    });
  }
}
// a copper pin for a place visitors came from (book study); shorter than a signer's brass pin
const globeCopper = new THREE.MeshStandardMaterial({ color: 0xa8582c, metalness: 0.5, roughness: 0.4, emissive: 0x2a1006, emissiveIntensity: 0.45 });
function globeAddVisitPin(lat, lon, n, key) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const nrm = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  const g = new THREE.Group(); g.position.copy(nrm).multiplyScalar(GLOBE_R); g.quaternion.setFromUnitVectors(Y_UP, nrm);
  const shaft = new THREE.Mesh(globePinGeo.shaft, globePinMat.iron); shaft.position.y = 0.012; shaft.scale.y = 0.8; g.add(shaft);
  const head = new THREE.Mesh(globePinGeo.head, globeCopper);
  head.scale.setScalar(Math.min(1.15, 0.55 + 0.12 * Math.log2(1 + n))); head.position.y = 0.025; g.add(head);
  g.userData = { kind: 'globePin', label: 'Visitors from ' + globePlaceName(key), visit: true, cc: key, n, lat, lon };
  globe.spin.add(g); globe.pins.push(g); interactables.push(g);
}
// a browser that reached the PinPoint room without passing its door page (e.g. "back into the study") counts here, once
function globeCountVisit() {
  try {
    if (!GUEST || navigator.webdriver || localStorage.getItem('ps_globe_counted_v1')) return Promise.resolve(false);
    return fetch('/api/visitors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"visit":true}' })
      .then((r) => r.json()).then((d) => { if (d && d.ok && d.final) localStorage.setItem('ps_globe_counted_v1', '1'); return !!(d && d.counted); }).catch(() => false);
  } catch (e) { return Promise.resolve(false); }
}
if (GALLERY) globe = null;   // the Gallery keeps no globe and no visitors' book: nothing to fetch
if (globe) {
  if (GUEST) globeAddPin(52.68, -2.45, globePinMat.red, { home: true });
  globeCountVisit().then((fresh) => { globe.freshVisit = fresh; return vbLoad(); }).then(globePins);
}
// ---- the close-up (Dan, 2026-11-15): loaded only on the first tap, torn down on close
let gvOpen = false;
function openGlobeView() {
  if (gvOpen || !globe) return;
  gvOpen = true; labelEl.style.display = 'none';
  const pins = globe.pins.filter((p) => isFinite(p.userData.lat)).map((p) => {
    const u = p.userData;
    return { lat: u.lat, lon: u.lon, n: u.n || u.count || 1, line: globePinLine(u),
      kind: u.home ? 'home' : u.visit ? (BOOK_ROOM ? 'visit' : 'dot') : 'signer' };
  });
  import('./globe-closeup.js').then((m) => m.openGlobeCloseup({
    pins, reduced: REDUCED,
    center: GUEST ? [48, -12] : [36, -40],
    title: 'The Keeper’s globe',
    hint: BOOK_ROOM ? 'Every pin is a place my visitors came from. Drag to turn it; scroll, pinch or + to look closer. Tap a pin.'
      : 'Drag to turn it; scroll, pinch or + to look closer. Tap a pin.',
    onClose: () => { gvOpen = false; },
  })).catch(() => { gvOpen = false; showCaption('The globe sticks on its axis. Try again in a moment.', 3500); });
}
function vbSetNote() { const el = document.querySelector('#vbForm .vb-note'); if (el) el.textContent = VB_COPY.note; }
// the book study's visitors' book, on the side table by the globe: anyone who reached Vault I may sign it
function openVisitorsBook() {
  goThen(1.9, 2.7, () => {
    vbBackToPosition.hidden = true;
    scrapBoard.hidden = true;
    scrapKick.textContent = "THE KEEPER'S VISITORS' BOOK";
    scrapText.textContent = '';
    scrapSay.textContent = study.signed ? VB_COPY.signed : VB_COPY.open;
    vbForm.hidden = !!study.signed; vbMsg.textContent = '';
    showScrapOverlay(); draftEl.classList.add('vbook'); vbEl.hidden = false; vbSetNote();
    vbRender(); vbLoad().then(globePins);
    if (!study.signed) { vbCodes(); vbPreviewUpdate(); }
  });
}
function openGuestLog() {
  if (!GUEST) return;
  goThen(0.2, -1.4, () => showGuestLog());
}
function showGuestLog(fromBoard = false) {
  if (!GUEST) return;
  if (!GUEST.frags.length) { showCaption(GUEST.retired, 7000); return; }
  const all = scrapsFound().length === 4 && GUEST.frags.length === 4;
  if (fromBoard && (!all || draftEl.hidden || scrapBoard.hidden)) return;
  vbBackToPosition.hidden = !fromBoard;
  const first = all && !study.logged;
  if (first) { study.logged = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); saveStudy(); }
  scrapBoard.hidden = true;
  scrapKick.textContent = "THE KEEPER'S VISITORS' BOOK";
  scrapText.textContent = all ? 'FOUND IT' : '';
  scrapSay.textContent = !all
    ? 'Finders may sign my visitors’ book once all four pieces are found. It is optional, and it is not your find.'
    : study.signed ? 'You have signed my visitors’ book. My thanks for the find. Now go and sign the real log, out where the note says.'
    : 'My thanks for the find. Leave your mark below if you like, then go and sign the real log, out where the note says.';
  vbForm.hidden = !(all && !study.signed); vbMsg.textContent = '';
  showScrapOverlay(); draftEl.classList.add('vbook'); vbEl.hidden = false; vbSetNote();
  vbRender(); vbLoad(); if (all && !study.signed) { vbCodes(); vbPreviewUpdate(); }
  if (first && !REDUCED) burstConfetti();
  setLogGlow(); renderGpsr(true);
  if (fromBoard) { draftEl.scrollTop = 0; scrapKick.focus({ preventScroll: true }); }
}
scrapLog.addEventListener('click', () => showGuestLog(true));
vbBackToPosition.addEventListener('click', () => {
  if (vbBackToPosition.hidden || draftEl.hidden || vbEl.hidden) return;
  openScrapBoard(true);
  scrapLog.focus();
});
scrapCopy.addEventListener('click', async () => {
  const s = scrapsFound().length === 4 ? fullPosition() : ''; if (!s) return;   // never copy before all four are found
  psEvent(PS_EV.GUEST_COPY);
  try { await navigator.clipboard.writeText(s); scrapCopy.textContent = 'Copied'; scrapCopy.dataset.done = '1'; }
  catch (e) { scrapCopy.textContent = 'Select and copy the line above'; }
  setTimeout(() => { scrapCopy.textContent = 'Copy the position'; delete scrapCopy.dataset.done; }, 2600);
});
document.getElementById('scrapClose').addEventListener('click', () => { draftEl.hidden = true; draftEl.classList.remove('scrap', 'vbook'); });
document.getElementById('draftClose').addEventListener('click', () => { draftEl.classList.remove('scrap'); });
function guestDoorLine() {
  document.getElementById('wbKicker').textContent = GUEST.door2Kicker;
  const line = document.getElementById('wbLine');
  line.textContent = GUEST.door2Line + ' ';
  const a = document.createElement('a'); a.href = GUEST.door2LinkHref; a.textContent = GUEST.door2LinkText; a.className = 'wb-book';
  line.appendChild(a);
  showCaption(GUEST.door2Line, 9000);
}
if (GUEST) {
  DOORS.door2.kicker = GUEST.door2Kicker;
  // a guest room's way out is its own door, never the book's homepage
  const bl = document.getElementById('backlink');
  if (bl && GUEST.home !== '/') { bl.href = GUEST.home; bl.textContent = '◄ back to the door'; }
  // A guest who arrived without the door and spoke the word at the desk: the room is rebuilt as theirs.
  // (submitWord stashes the room; here we only need the flag for the first-word box's wording.)
  DOORS.first.kicker = 'THE MAGAZINE\'S WORD';
}
/* --- the Keeper's Notebook: six pages --- */
/* NOTEBOOK comes from ../lib/lore.js. */
const nbEl = document.getElementById('notebook'), nbBody = document.getElementById('nbBody'), nbPrev = document.getElementById('nbPrev'), nbNext = document.getElementById('nbNext');
let nbPage = 0;
function drawNotebook() {
  nbBody.innerHTML = NOTEBOOK[nbPage];
  document.getElementById('nbNo').textContent = nbPage === 0 ? 'FROM THE DESK' : ('PAGE ' + NUM_WORD[nbPage] + ' OF FIVE');
  nbPrev.disabled = nbPage === 0; nbNext.disabled = nbPage === NOTEBOOK.length - 1;
  nbPrev.style.opacity = nbPage === 0 ? '.35' : ''; nbNext.style.opacity = nbPage === NOTEBOOK.length - 1 ? '.35' : '';
}
function openNotebook() { nbPage = 0; drawNotebook(); nbEl.hidden = false; markFound('notebook'); psEventOnce(PS_EV.PAGE_NOTEBOOK); psTouch('notebook'); showCaption(GUEST ? 'My notebook, for readers of my book. Nothing in it is part of the cache.' : 'My notebook. Read it, and the rest of my book will go easier.', 5200); }
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
  'The best puzzlers look twice before they write once.',
  'Today the grid is generous. Tomorrow, less so.',
  'I set this one twice. The first attempt had two answers, and went into the fire.',
  'You may sit as long as you like. The vault does not close.',
  'A page for the ones who look twice.',
];
const deskEl = document.getElementById('desk'), deskFrame = document.getElementById('deskFrame');
let seated = false, eyeTarget = 1.6;
function dailyPuzzleId() { return ((dayIndex() * 97 + 41) % 200) + 1; }   // the same formula /play uses
function renderDeskStamps() {
  const n = Object.keys(deskState.days).length, today = deskState.days[localDay()] === dailyPuzzleId();
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
    setTimeout(() => { if (deskEl.hidden) return; try { deskFrame.contentWindow.focus(); } catch (e) {} }, 400);
  }, 900);
}
function riseFromDesk() {
  deskEl.hidden = true; seated = false; eyeTarget = 1.6;
  player.target.set(0.1, 0, -2.3); pitch = -0.02;
  showCaption(STUDY_SAY.rise, 4200);
}
document.getElementById('deskRise').addEventListener('click', riseFromDesk);
document.getElementById('deskX').addEventListener('click', riseFromDesk);
addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'ps-desk-rise') { if (!deskEl.hidden) riseFromDesk(); return; }
  if (e.origin !== location.origin || !e.data || e.data.type !== 'ps-desk-solved') return;
  const d = localDay();
  if (e.data.id !== dailyPuzzleId()) return;          // only today's page earns the desk's stamp
  if (!deskState.days[d]) { deskState.days[d] = e.data.id; }
  if (e.data.secs && (!deskState.best || e.data.secs < deskState.best)) deskState.best = e.data.secs;
  saveDesk(); renderDeskStamps(); markFound('desk');
  psEvent(PS_EV.DESK_SOLVED, e.data.secs ? 'in ' + Math.floor(e.data.secs / 60) + 'm' + String(Math.round(e.data.secs) % 60).padStart(2, '0') + 's' : '');
  showCaption(STUDY_SAY.solved, 6000); burstConfetti(); playUnlock();
});
let exitSaid = false;

/* the Back button is handled by the page-level guard in vault.astro; it needs the desk's exit */
window.__vaultRise = riseFromDesk;

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

// Restore the earned destination after the scene and doors exist. Earlier passages
// are transit only: no earlier reward pass or passport stamp is manufactured.
function restoreEarnedArrival() {
  if (!ARRIVAL_ACT) return;
  hinge.rotation.y = -1.62; doorAmt = 1; doorOpened = true;
  door2Open = true; door2.rotation.y = 2.05; door2.userData.kind = null;
  if (ARRIVAL_ACT === 'III') { door3Open = true; door3.rotation.y = 2.05; door3.userData.kind = null; }
  const p = DOORS[ARRIVAL_ACT === 'II' ? 'door2' : 'door3'].inside;
  player.pos.set(p.x, 0, p.z); player.target.copy(player.pos);
  yaw = 0; pitch = -0.02;
  // Run after module initialization; openReward still checks the saved matching pass.
  setTimeout(() => openReward(ARRIVAL_ACT), 400);
}
restoreEarnedArrival();

/* ================= entry / gate ================= */
let entered = false;
function begin(withAudio) {
  entered = true;
  try {
    if (!sessionStorage.getItem('ps_visited_3d')) {       // per mode: switching to painted mid-visit gets its own door line
      sessionStorage.setItem('ps_visited_3d', '1');
      fetch('/api/visit', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vid: psVid(), mode: '3d' }) }).catch(() => {});
    }
  } catch (e) { /* private mode */ }
  gate.classList.add('gone');
  fadeEl.classList.add('clear');
  if (withAudio) {
    initAudio(); startAmbient(); playBoom();
    setTimeout(() => sayEntry(), 1300);
  } else {
    if (GALLERY) showCaption(GALLERY_ENTRY, 10000); else if (GUEST) showCaption(GUEST.frags.length ? GUEST.entry : GUEST.retired, 8000); else if (ARRIVAL_ACT) sayEntry(); else showCaption(VO.entry.text, 6500);
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
    hintEl.textContent = GUEST ? GUEST_HINT : IS_TOUCH ? 'Drag to look · hold the floor to walk · tap what glows' : 'Drag to look around · Tap the floor to walk · Click what glows';
    setTimeout(() => sayEntry(), 400);
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
if (devQ('d2') === '1') { door2Open = true; door2.rotation.y = 2.05; door2.userData.kind = null; }
if (devQ('d3') === '1') { door3Open = true; door3.rotation.y = 2.05; door3.userData.kind = null; }
if (FORCE_PANEL) rewardEl.hidden = false;
if (devQ('wb') === '1') openWordbox(qs.get('wbk') || 'door2');


/* ================= THE KEY-TILE GAMES (2026-09-03) =================
   Two small games that hand over the Keeper's key-tiles, the same two the painted vault
   awards: the Keeper's Round in the library (find five things in the dark, with a hooded
   lamp in your hand) and the Listening Lock in the treasure room (crack a small chest by
   ear and by eye). Tiles are keepsakes: they open nothing, they prove you were here. Both
   tiles = the Keeper's Mark on the certificate. Stored in ps_tiles_v1, read by /passport.
   Nothing here may ever contain an answer word or any sweepstakes-style wording. */
const TILE_KEY = 'ps_tiles_v1';
function tilesHeld() { try { const v = JSON.parse(localStorage.getItem(TILE_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; } }
const TILE_SAY = {
  II: 'A key-tile: one shaded square from the Keeper’s own set. One of two.',
  III: 'The second key-tile. Two of two.',
  both: 'Both tiles. The Keeper’s Mark now seals your certificate.',
  keep: 'A keepsake: it opens nothing, it proves you were here.',
};
const tilecardEl = document.getElementById('tilecard'), lockboxEl = document.getElementById('lockbox'), roundEndEl = document.getElementById('roundEnd');
const roundHudEl = document.getElementById('roundHud'), roundRetEl = document.getElementById('roundRet');
let lastFocus = null;
function openCard(el, focusEl) { lastFocus = document.activeElement; el.hidden = false; setTimeout(() => { try { focusEl && focusEl.focus(); } catch (e) {} }, 60); }
function closeCard(el) { el.hidden = true; try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {} lastFocus = null; }

/* ---- the tile, as a thing you take: a small ceramic plane that rises to your hand ---- */
function tileTexture(digit) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#dccfb3'); grd.addColorStop(1, '#bfb296');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.lineWidth = 14; g.strokeStyle = '#1a1206'; g.strokeRect(7, 7, 242, 242);
  g.lineWidth = 4; g.strokeStyle = '#f6b23c'; g.strokeRect(22, 22, 212, 212);
  g.fillStyle = '#1a1206'; g.font = '700 150px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(digit), 128, 140);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
const pickups = [];   // { mesh, from, t0, dur, done }
function pickupTile(digit, fromWorld, then) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tileTexture(digit), side: THREE.DoubleSide }));
  m.position.copy(fromWorld); scene.add(m);
  pickups.push({ mesh: m, from: fromWorld.clone(), t0: simT, dur: REDUCED ? 0.3 : 0.9, then });
}
function tickPickups() {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const k = Math.min(1, (simT - p.t0) / p.dur), e = 1 - Math.pow(1 - k, 3);
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const to = camera.position.clone().addScaledVector(fwd, 0.55).add(new THREE.Vector3(0, -0.06, 0));
    p.mesh.position.lerpVectors(p.from, to, e);
    p.mesh.position.y += Math.sin(k * Math.PI) * 0.18;         // a little lift on the way
    p.mesh.quaternion.copy(camera.quaternion);
    p.mesh.rotation.z = (1 - e) * 0.8;
    if (k >= 1) { scene.remove(p.mesh); pickups.splice(i, 1); setTimeout(p.then, 120); }
  }
}

/* ---- the card ---- */
function awardTile(act, note) {
  const held = tilesHeld(); const had = !!held[act];
  if (!had) {
    held[act] = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(TILE_KEY, JSON.stringify(held)); } catch (e) {}
    // First time this browser earns this tile → tell the Keeper. Once-per-tile-per-session
    // is enforced client-side; server has the real 5-min cooldown.
    psEvent(act === 'II' ? PS_EV.TILE_5 : PS_EV.TILE_7);
    psTouch('tile-' + act);
  }
  const both = !!(held.II && held.III);
  if (act === 'III') heldIII = true;
  document.getElementById('tcKicker').textContent = had ? 'THE KEEPER NODS' : 'A KEY-TILE';
  document.getElementById('tcArt').querySelector('span').textContent = act === 'II' ? '5' : '7';
  document.getElementById('tcText').textContent = (note ? note + ' ' : '') + (both && !had ? TILE_SAY.both : TILE_SAY[act]) + ' ' + TILE_SAY.keep;
  document.getElementById('tcPass').hidden = !both;
  openCard(tilecardEl, document.getElementById('tcClose'));
  burstConfetti();
}
document.getElementById('tcClose').addEventListener('click', () => closeCard(tilecardEl));

/* ---- sounds the games need ---- */
function playTick(vol = 0.3, freq = 1600) {
  if (!audioReady || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.22 * vol), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
}
function playChime(i = 0) {
  if (!audioReady || muted) return;
  const t = actx.currentTime, f = 523.25 * Math.pow(2, i / 5);
  [f, f * 1.5].forEach((fr, k) => {
    const o = actx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 / (k + 1), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
    o.connect(g).connect(master); o.start(t); o.stop(t + 1);
  });
}

/* ================= GAME 1 — THE KEEPER'S ROUND (library) ================= */
const FOUND_SAY = ['Yes.', 'Good.', 'Quick.', 'There.'];
const round = { on: false, list: [], i: 0, t0: 0, limit: 75, calm: false, helped: false, wrongs: 0, stuckT: 0, riddleT: 0, plainSaid: false, gutterT: -9, tenSaid: false, prevHint: '' };
let darkAmt = 0, darkTarget = 0, helpLampAmt = 0;
const aimDir = new THREE.Vector3(0, 0, -1), lastPtr = { x: innerWidth / 2, y: innerHeight / 2 };
const flares = [];  // { sprite, t0 }
const roundCallEl = document.getElementById('roundCall'), roundClockEl = document.getElementById('roundClock'), roundDotsEl = document.getElementById('roundDots'), roundSrEl = document.getElementById('roundSr');
function pickOrder() {
  const counters = ROUND_DEFS.filter((d) => d.counter), backs = ROUND_DEFS.filter((d) => !d.counter);
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  const first = shuffle(counters)[0];
  const pool = shuffle(ROUND_DEFS.filter((d) => d !== first));
  const list = [first]; let side = first.side;
  for (let k = 1; k < 4; k++) {                       // 2–4 alternate sides of the aisle
    side = side === 'L' ? 'R' : 'L';
    let pick = pool.find((d) => d.side === side && !list.includes(d)) || pool.find((d) => !list.includes(d));
    list.push(pick);
  }
  const last = shuffle(backs.filter((d) => !list.includes(d)))[0] || pool.find((d) => !list.includes(d));
  list.push(last);
  return list;
}
function startRound(calm = false) {
  if (round.on) return;
  psEvent(PS_EV.ROUND_START);
  psTouch('round');
  Object.assign(round, { on: true, list: pickOrder(), i: 0, calm, helped: false, wrongs: 0, plainSaid: false, tenSaid: false, gutterT: -9 });
  round.limit = 75; round.t0 = simT + 3.2; round.stuckT = round.t0;
  helpLampAmt = 0;
  roundDotsEl.querySelectorAll('i').forEach((d) => d.classList.remove('on'));
  roundClockEl.textContent = calm ? '—' : '75'; roundClockEl.classList.toggle('calm', calm); roundClockEl.classList.remove('low'); roundHudEl.classList.remove('pulse');
  roundCallEl.textContent = 'Listen…';
  roundHudEl.hidden = false; roundRetEl.hidden = !IS_TOUCH; document.body.classList.add('round');
  round.prevHint = hintEl.textContent;
  hintEl.textContent = IS_TOUCH ? 'Turn to sweep the light · tap what you find' : 'Move the mouse to sweep the light · click what you find';
  hintEl.style.display = 'block';
  showCaption('Care for a game? I will name five things, each on a scrap of red velvet. Find them in the dark. The lamp in your hand shows the way.', 6000);
  setTimeout(() => { if (round.on) darkTarget = 1; }, 2600);
  setTimeout(() => { if (round.on) nextCall(); }, 3400);
}
function nextCall() {
  if (!round.on) return;
  const d = round.list[round.i];
  round.stuckT = simT; round.wrongs = 0; round.plainSaid = false;
  if (round.i < 4) { showCaption('Find… ' + d.name + '.', 4500); roundCallEl.textContent = 'Find · ' + d.name; }
  else { showCaption('The last I will not name. ' + d.riddle, 9000); roundCallEl.textContent = 'Find · the last, unnamed'; round.riddleT = simT; }
}
function roundHit(id) {
  if (!round.on) return false;
  const want = round.list[round.i];
  if (!want || want.id !== id) { roundMiss(); return true; }
  playChime(round.i);
  const def = ROUND_DEFS.find((x) => x.id === id);
  const s = sprite(0.9, def.x, def.y + 0.25, def.z, scene, 0.95); flares.push({ sprite: s, t0: simT });
  roundDotsEl.querySelectorAll('i')[round.i].classList.add('on');
  round.i++;
  if (round.i >= 5) { finishRound(); return true; }
  showCaption(FOUND_SAY[(round.i - 1) % FOUND_SAY.length], 900);
  setTimeout(nextCall, 450);
  return true;
}
function roundMiss() {
  if (!round.on) return;
  playThud();
  round.wrongs++; round.gutterT = simT;
  if (round.wrongs >= 3) {
    const d = round.list[round.i];
    showCaption((d.side === 'L' ? 'Left of the aisle' : 'Right of the aisle') + (d.z < -12 ? ', and further back.' : ', near the door.'), 3600);
    round.wrongs = 0;
  } else showCaption('No. Look again.', 1800);
}
function nearestTargetOnScreen(cx, cy) {
  // phone fallback: a tap within 44 css px of a target's screen position counts as a tap on it
  let best = null, bd = 44;
  const v = new THREE.Vector3(), fwd = camera.getWorldDirection(new THREE.Vector3());
  ROUND_DEFS.forEach((d) => {
    v.set(d.x, d.y + 0.15, d.z);
    if (v.clone().sub(camera.position).dot(fwd) <= 0) return;
    v.project(camera);
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const dist = Math.hypot(sx - cx, sy - cy);
    if (dist < bd) { bd = dist; best = d; }
  });
  return best;
}
function finishRound() {
  const secs = Math.round((simT - round.t0) * 10) / 10;
  round.on = false;
  let best = null; try { best = Number(localStorage.getItem('ps_round3d_best')) || null; } catch (e) {}
  let note;
  if (round.calm) note = 'Five, at your own pace.';
  else if (round.helped) note = 'Five, with a little help. Next time, in the dark.';
  else {
    const isBest = !best || secs < best;
    if (isBest) { try { localStorage.setItem('ps_round3d_best', String(secs)); } catch (e) {} }
    note = 'Five in ' + secs.toFixed(1) + ' seconds' + (isBest ? ', your best.' : ' (best ' + best.toFixed(1) + 's).');
  }
  psEvent(PS_EV.ROUND_SOLVED, round.calm ? 'at their own pace' : round.helped ? 'with help' : 'Five in ' + secs.toFixed(1) + 's' + ((!best || secs <= best) ? ' · best' : ''));
  showCaption(secs < 35 && !round.helped && !round.calm ? 'Five, in the dark. You have a keeper’s eyes.' : 'Five. Steady hands.', 4200);
  leaveRoundHud();
  darkTarget = 0; playCreak(); setTimeout(playUnlock, 900);
  const had = !!tilesHeld().II;
  setTimeout(() => pickupTile(5, new THREE.Vector3(HOOD.x, 1.25, HOOD.z), () => awardTile('II', note)), had ? 300 : 1100);
}
function leaveRoundHud() {
  roundHudEl.hidden = true; roundRetEl.hidden = true; document.body.classList.remove('round');
  hintEl.textContent = round.prevHint || hintEl.textContent;
  if (!IS_TOUCH) hintEl.style.display = '';
}
function endRound(reason) {
  if (!round.on) return;
  round.on = false; darkTarget = 0; leaveRoundHud();
  if (reason === 'timeout') { psEvent(PS_EV.ROUND_FAIL); document.getElementById('reText').textContent = 'The dark kept them that time. Rest your eyes, then try again.'; openCard(roundEndEl, document.getElementById('reAgain')); }
  else showCaption('Another time, then.', 3000);
}
document.getElementById('roundQuit').addEventListener('click', () => endRound('quit'));
document.getElementById('reAgain').addEventListener('click', () => { closeCard(roundEndEl); startRound(false); });
document.getElementById('reCalm').addEventListener('click', () => { closeCard(roundEndEl); startRound(true); });
document.getElementById('reBack').addEventListener('click', () => closeCard(roundEndEl));

function tickRound(dt, t) {
  // the dark comes in over 0.8 s and leaves over 1.2 s
  const rate = darkTarget > darkAmt ? dt / 0.8 : dt / 1.2;
  darkAmt = darkTarget > darkAmt ? Math.min(darkTarget, darkAmt + rate) : Math.max(darkTarget, darkAmt - rate);
  const helpT = round.on && round.helped ? 0.4 : 0;
  helpLampAmt += (helpT - helpLampAmt) * Math.min(1, dt * 2);
  if (darkAmt > 0 || ambientLight.intensity !== 1.15) {
    const k = darkAmt;
    ambientLight.intensity = 1.15 - 0.93 * k;              // floor 0.22: never black on an OLED
    hemi.intensity = 0.62 - 0.50 * k;
    scene.fog.density = 0.052 + 0.048 * k;
    libLights.forEach((L, i) => { L.intensity *= (1 - k) + (i === 1 ? helpLampAmt * k : 0); });
    libLampSprites.forEach((s, i) => { s.material.opacity = 0.7 * ((1 - k) + (i === 1 ? helpLampAmt * k : 0)); });
    tomeLight.intensity *= 1 - 0.85 * k; tomeGlow.material.opacity = 0.9 - 0.75 * k;
    torch2Light.intensity *= 1 - k;
    M.glowStrip.emissiveIntensity = 1.6 - 1.5 * k;
    M.goldGlow.emissiveIntensity = 0.4 - 0.36 * k;
    M.flame.emissiveIntensity = 1.5 - 1.45 * k;
  }
  // the hooded lamp in your hand
  const gutter = round.on && simT - round.gutterT < 1.5 ? 0.4 : 1;
  const baseAngle = camera.aspect < 1 ? 0.26 : 0.32;
  roundSpot.angle = baseAngle * (gutter < 1 ? 0.56 : 1);
  roundSpot.intensity = 140 * darkAmt * gutter;
  roundFill.intensity = 3 * darkAmt;
  if (darkAmt > 0) {
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    let want;
    if (IS_TOUCH) want = fwd;
    else { ndc.set((lastPtr.x / innerWidth) * 2 - 1, -(lastPtr.y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); want = ray.ray.direction.clone(); }
    if (want.angleTo(fwd) > 0.61) want = want.lerp(fwd, 0.5).normalize();
    aimDir.lerp(want, REDUCED ? 1 : Math.min(1, dt * 9)).normalize();
    roundSpot.position.copy(camera.position);
    roundSpot.target.position.copy(camera.position).addScaledVector(aimDir, 6);
    roundFill.position.copy(camera.position);
    // things gleam when the beam finds them; the one you are stuck on gleams harder after 15 s
    const cosCone = Math.cos(roundSpot.angle);
    ROUND_DEFS.forEach((d) => {
      const to = new THREE.Vector3(d.x, d.y + 0.15, d.z).sub(camera.position); const dist = to.length(); to.divideScalar(dist);
      const inBeam = dist < 7 && to.dot(aimDir) > cosCone;
      const stuck = round.on && round.list[round.i] === d && simT - round.stuckT > 15;
      const want = inBeam ? (stuck ? 0.5 : 0.18) : 0;
      d.mats.forEach((m) => { m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 8); });
    });
  }
  // flares on found things
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i], k = (simT - f.t0) / 0.7;
    if (k >= 1) { scene.remove(f.sprite); flares.splice(i, 1); continue; }
    f.sprite.material.opacity = 0.95 * (1 - k); f.sprite.scale.setScalar(0.9 + k * 0.8);
  }
  if (!round.on) return;
  // the clock
  if (round.i < 5 && round.i === 4 && !round.plainSaid && simT - round.riddleT > 15) { round.plainSaid = true; showCaption('Very well: ' + round.list[4].name + '.', 4000); roundCallEl.textContent = 'Find · ' + round.list[4].name; }
  if (round.calm) return;
  const left = round.limit - (simT - round.t0);
  const shown = Math.max(0, Math.ceil(left));
  if (roundClockEl.textContent !== String(shown)) roundClockEl.textContent = String(shown);
  const low = left <= 10 && left > 0;
  roundClockEl.classList.toggle('low', low); roundHudEl.classList.toggle('pulse', low && !REDUCED);
  if (low && !round.tenSaid) { round.tenSaid = true; roundSrEl.textContent = 'Ten seconds.'; }
  if (low && Math.floor(left) !== Math.floor(left + dt)) playTick(0.25, 900);
  if (left <= 0) {
    if (!round.helped) { round.helped = true; round.limit += 30; round.tenSaid = false; showCaption('A little light. I am not cruel.', 3600); }
    else endRound('timeout');
  }
}

/* ================= GAME 2 — THE LISTENING LOCK (treasure room) ================= */
let heldIII = !!tilesHeld().III;
const lock = { on: false, targets: [], i: 0, pos: 0, lastMove: 0, dragging: false, lastAngle: 0, acc: 0, dir: 0, dir2: 0, band: '', fellAt: -9, step: null };
let lockGeneration = 0, lockWinTimer = null, lockPendingWin = false;
function bankLockTile() {
  const held = tilesHeld();
  if (!held.III) { held.III = new Date().toISOString().slice(0, 10); try { localStorage.setItem(TILE_KEY, JSON.stringify(held)); } catch (e) {} psEvent(PS_EV.TILE_7); psTouch('tile-III'); }
  heldIII = true;
}
function invalidateLock() {
  lockGeneration++; clearTimeout(lockWinTimer); lockWinTimer = null;
  if (lockPendingWin) { lockPendingWin = false; bankLockTile(); }
}
const lockDial = document.getElementById('lockDial'), lockShake = document.getElementById('lockShake'), lockNum = document.getElementById('lockNum'), lockHeat = document.getElementById('lockHeat'), lockMsg = document.getElementById('lockMsg');
function lockDist() { const t = lock.targets[lock.i]; const d = Math.abs(t - lock.pos); return Math.min(d, 40 - d); }
function lockRender() {
  lockDial.style.setProperty('--rot', (-lock.pos * 9) + 'deg'); lockNum.textContent = String(lock.pos); lockDial.setAttribute('aria-valuenow', String(lock.pos));
  const d = lockDist(); let near = Math.max(0, 1 - d / 10);
  const contrary = lock.i === 2 && lock.dir !== 0 && lock.dir === lock.dir2;   // the third is contrary: come at it the other way
  if (contrary) near = 0;
  const mix = (a, b) => Math.round(a + (b - a) * near);
  lockDial.style.borderColor = 'rgb(' + mix(74, 255) + ',' + mix(58, 211) + ',' + mix(34, 122) + ')';
  lockNum.style.textShadow = '0 0 ' + Math.round(6 + near * 22) + 'px rgba(246,178,60,' + (0.3 + near * 0.7) + ')';
  lockShake.style.setProperty('--shake', (!REDUCED && near > 0.55 ? ((near - 0.55) * 9).toFixed(1) : 0) + 'px');
  const band = contrary ? 'Dead. Try the other way' : d >= 10 ? 'Cold' : d >= 5 ? 'Warmer' : d >= 2 ? 'Close' : 'Right there. Hold still';
  if (band !== lock.band) { lock.band = band; lockHeat.textContent = band; lockHeat.classList.toggle('hot', d < 2 && !contrary); }
  return { d, near, contrary };
}
function lockStep(dir) {
  if (!lock.on) return;
  lock.pos = (lock.pos + dir + 40) % 40; lock.dir = dir; lock.lastMove = simT;
  const { near } = lockRender();
  playTick(0.12 + near * 0.88, 1300 + near * 1700);
  try { if (navigator.vibrate) navigator.vibrate(near > 0.7 ? 14 : 6); } catch (e) {}
}
lock.step = lockStep;
function lockFall() {
  playThud(); playChime(lock.i + 1);
  document.getElementById('lockTumblers').children[lock.i].classList.add('fell');
  if (lock.i === 1) lock.dir2 = lock.dir;
  lock.i++; lock.fellAt = simT; lock.band = '';
  lockMsg.textContent = ['One.', 'Two.', 'The last tumbler falls.'][lock.i - 1];
  if (lock.i >= 3) { lock.on = false; lockPendingWin = true; const generation = lockGeneration; lockWinTimer = setTimeout(() => { if (generation === lockGeneration) lockWon(); }, 800); }
  else if (lock.i === 2) { const generation = lockGeneration; setTimeout(() => { if (generation === lockGeneration && lock.on) showCaption('The last one is contrary. Come at it from the other side.', 4200); }, 600); }
  lockRender();
}
function openLock() {
  invalidateLock();
  lock.on = true; lock.i = 0; lock.pos = 0; lock.dir = 0; lock.dir2 = 0; lock.band = ''; lock.acc = 0; lock.lastMove = simT;
  lock.targets = [];
  while (lock.targets.length < 3) { const n = Math.floor(Math.random() * 40); if (n !== 0 && lock.targets.every((t) => Math.min(Math.abs(t - n), 40 - Math.abs(t - n)) > 6)) lock.targets.push(n); }
  document.querySelectorAll('#lockTumblers i').forEach((i) => i.classList.remove('fell'));
  lockMsg.textContent = ''; lockRender();
  openCard(lockboxEl, lockDial);
  psEvent(PS_EV.LOCK_START);
  psTouch('lock');
  showCaption('Three tumblers. Turn the dial and listen.', 4200);
}
function closeLock() { invalidateLock(); lock.on = false; lock.dragging = false; closeCard(lockboxEl); }
function lockWon() {
  if (lockboxEl.hidden) { invalidateLock(); return; }
  lockPendingWin = false;
  closeLock();
  const generation = lockGeneration;
  lidAnim = { from: pbLid.rotation.x, to: -1.6, t0: simT, dur: 0.7 };
  pbInner.visible = true; pbGlow.material.opacity = 0.6; pbLight.intensity = 6;
  playCreak(); setTimeout(playUnlock, 500);
  psEvent(PS_EV.LOCK_SOLVED);
  const had = !!tilesHeld().III;
  const from = new THREE.Vector3(); pbChest.getWorldPosition(from); from.y += 0.25;
  setTimeout(() => {
    if (generation !== lockGeneration) { bankLockTile(); return; }
    pickupTile(7, from, () => { if (generation === lockGeneration) awardTile('III', 'The chest gives up its secret.'); else bankLockTile(); });
  }, 900);
}
let lidAnim = null;
function tickLock(dt) {
  if (lidAnim) {
    const k = Math.min(1, (simT - lidAnim.t0) / lidAnim.dur), e = 1 - Math.pow(1 - k, 3);
    pbLid.rotation.x = lidAnim.from + (lidAnim.to - lidAnim.from) * e;
    if (k >= 1) lidAnim = null;
  }
  if ((lock.on || lockPendingWin) && lockboxEl.hidden) { invalidateLock(); lock.on = false; return; }   // the history guard shut it
  if (lock.on) {
    const { d, contrary } = lockRender();
    if (d === 0 && !contrary && simT - lock.lastMove > 0.7 && simT - lock.fellAt > 0.9) { lock.lastMove = simT; lockFall(); }
  }
  // the small chest ticks, faintly, when you are near it and it is still shut
  if (!heldIII && audioReady && !muted && simT - chestTickT > 1) {
    const cp = new THREE.Vector3(); pbChest.getWorldPosition(cp);
    const dd = Math.hypot(player.pos.x - cp.x, player.pos.z - cp.z);
    if (dd < 2.6) { chestTickT = simT; playTick(0.05 * (1 - dd / 2.6), 2100); }
  }
}
let chestTickT = 0;
(function wireLock() {
  const angleAt = (e) => { const r = lockDial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  lockDial.addEventListener('pointerdown', (e) => { lock.dragging = true; lock.lastAngle = angleAt(e); lock.acc = 0; try { lockDial.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
  lockDial.addEventListener('pointermove', (e) => {
    if (!lock.dragging) return;
    const a = angleAt(e); let da = a - lock.lastAngle; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    lock.lastAngle = a; lock.acc += da;
    const stepAngle = 2 * Math.PI / 40;
    while (Math.abs(lock.acc) >= stepAngle * 0.9) { lockStep(lock.acc > 0 ? -1 : 1); lock.acc -= Math.sign(lock.acc) * stepAngle; }
  });
  const up = () => { lock.dragging = false; lock.acc = 0; };
  lockDial.addEventListener('pointerup', up); lockDial.addEventListener('pointercancel', up);
  lockDial.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { lockStep(1); e.preventDefault(); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { lockStep(-1); e.preventDefault(); } });
  document.getElementById('lockUp').addEventListener('click', () => lockStep(1));
  document.getElementById('lockDown').addEventListener('click', () => lockStep(-1));
  document.getElementById('lockBack').addEventListener('click', closeLock);
})();
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!deskEl.hidden) riseFromDesk();
  else if (!draftEl.hidden && draftEl.classList.contains('scrap')) { draftEl.hidden = true; draftEl.classList.remove('scrap', 'vbook'); }
  else if (!lockboxEl.hidden) closeLock();
  else if (!tilecardEl.hidden) closeCard(tilecardEl);
  else if (!roundEndEl.hidden) closeCard(roundEndEl);
  else if (round.on) endRound('quit');
});
// a held tile leaves the small chest open on every visit
if (tilesHeld().III) { pbLid.rotation.x = -1.6; pbInner.visible = true; pbGlow.material.opacity = 0.6; pbLight.intensity = 6; pbChest.userData.label = 'The small chest, open. Its tile is yours.'; }

/* ================= THE KEEPER'S GALLERY (2026-11-24) =================
   A browser that holds only the Gift cover's gift sees the Keeper's front room, never Vault I. Vault I and the
   deeper vaults are built as usual above, then everything is taken out of the scene here before the first frame
   (hidden meshes would still catch taps and lights would still cost phones), and the front room is built instead
   by src/scripts/gallery-room.js. Only the floor (for walking), the exit doorway and the walk ring stay. */
if (GALLERY) {
  scene.updateMatrixWorld(true);
  for (const o of [...scene.children]) if (o !== floor && o !== exitHit && o !== walkRing && o !== camera) {
    scene.remove(o);
    o.traverse((m) => { if (m.geometry && m !== floor) m.geometry.dispose(); });   // geometry only: shared materials/textures stay usable
  }
  interactables.length = 0; OBSTACLES.length = 0;
  interactables.push(exitHit);
  psRoom = 'the gallery'; psRooms.clear(); psRooms.add('the gallery');
  renderer.toneMappingExposure = 1.05;
  try { galleryRoom = buildGallery({
    THREE, scene, box, sprite, canvasTex, texLoader, M, interactables, OBSTACLES, floor, player, exitHit,
    paperBall: paperBallFn, paperMat: paperBallMat, EV: PS_EV,
    goThen, moveTo, showCaption, playCreak, playThud, playUnlock, burstConfetti, openReward, openWordbox, psEvent, activate,
    setView: (y, p) => { yaw = y; pitch = p; }, getView: () => [yaw, pitch], setEye: (h) => { eyeTarget = h; },
    isEntered: () => entered, overlayOpen: () => overlayOpen(),
  }); } catch (e) { location.replace('/vault?flat=1'); throw e; }
  if (!DEBUG_CAM) { yaw = 0.2; pitch = -0.04; }   // the gold door in the first frame
}

/* ================= debug hooks (headless verification) ================= */
if (DEV_HOST) window.__vault = {
  scene, camera, renderer, get gallery() { return galleryRoom; },
  player, moveTo, openBookcase, closeBookcase, oddHit, exitHit, openReward, activate, openWordbox, submitWord,
  round, startRound, roundHit, endRound, ROUND_DEFS, lock, openLock, lockStep, pbLid, awardTile, tilesHeld, get darkAmt() { return darkAmt; },
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
  get pitch() { return pitch; }, set pitch(v) { pitch = v; },
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
  if (GUEST && simT < 12) { setTimeout(() => offerFlat(fps), (12 - simT) * 1000); return; }   // let a guest read the Keeper's first line
  psEvent(PS_EV.PERF_SLOW, fps + ' fps');           // the device, not the person, is what is stuck here
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
  // the Keeper's globe: a heavy spin that settles after a fling, then a slow idle drift
  if (globe && !globe.dragging) {
    if (Math.abs(globe.vel) > 0.01 && !REDUCED) { globe.spin.rotation.y += globe.vel * dt; globe.vel *= Math.exp(-2.2 * dt); }
    else { globe.vel = 0; if (!REDUCED) globe.spin.rotation.y += 0.025 * dt; }
  }

  // destination ring breathes while holding
  if (walkRing.visible) {
    const rs = 1 + 0.18 * Math.sin(t * 6);
    walkRing.scale.set(rs, rs, rs);
    walkRing.material.opacity = 0.65 + 0.25 * Math.sin(t * 6);
  }
  // glide toward target (tap / hold-to-walk)
  if (GUEST && !REDUCED) {
    // A guest room walks at half the old glide (Dan, 2026-11-14: "maybe 50% of the way it moves now"),
    // capped at a steady 2 m/s: the old glide's speed grew with the distance left, so a long tap or
    // hold-to-walk sprinted at 5-10 m/s. Every walk now takes about twice as long and never sprints.
    const d = player.pos.distanceTo(player.target);
    if (d > 1e-4) { const v = Math.min(2.0, 1.2 * d); player.pos.lerp(player.target, Math.min(1, v * dt / d)); }
  } else {
    const k = REDUCED ? 1 : Math.min(1, dt * 2.4);
    player.pos.lerp(player.target, k);
  }
  clampPos(player.pos);
  if (pendingAction && player.pos.distanceTo(player.target) < 0.18) {
    const a = pendingAction; pendingAction = null; a();
  }
  // eye height follows the ground; eased so the lip of the stair does not snap
  const groundY = floorYAt(player.pos.x, player.pos.z);
  eyeY += (groundY + eyeTarget - eyeY) * Math.min(1, dt * (seated ? 4 : 9));
  camera.position.set(player.pos.x, eyeY, player.pos.z);
  camera.rotation.set(pitch, yaw, 0);

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
  if (todayGlow) todayGlow.material.opacity = deskEl.hidden ? 0.45 + 0.22 * Math.sin(t * 1.8) : 0;
  sconceLight.intensity = 28 * (0.85 + 0.3 * Math.sin(t * 9.2 + 2));
  torchLight.intensity = 14 * (0.85 + 0.3 * Math.sin(t * 8.1 + 4));
  flame.scale.y = sflame.scale.y = sflameR.scale.y = tflame.scale.y = 0.9 + 0.2 * Math.sin(t * 13);
  const pulse = 0.75 + 0.45 * Math.sin(t * 2.2);
  M.stack.emissiveIntensity = pulse;
  oddBookMat.emissiveIntensity = doorAmt > 0.5 ? 0.08 : 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.6));
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
  tickRound(dt, t); tickLock(dt); tickPickups();
  // room label + first-entry lines
  const zp = player.pos.z;
  const label = player.pos.y < -0.4 || (door4Open && floorYAt(player.pos.x, zp) < -0.4)
    ? 'VAULT IV — THE SECRET SANCTUM'
    : zp > -7.2 ? (GALLERY ? "THE KEEPER'S GALLERY" : "VAULT I — THE WRITER'S STUDY")
    : zp > -19.4 ? 'VAULT II — THE LIBRARY OF PUZZLES'
    : 'VAULT III — THE GRAND TREASURE VAULT';
  if (roomNameEl.textContent !== label) roomNameEl.textContent = label;
  psRoom = PS_ROOM_SHORT[label] || psRoom; psRooms.add(psRoom);
  const inStudy = entered && zp > -3.6 && player.pos.y > -0.4;
  if (studyCountEl.hidden === inStudy) studyCountEl.hidden = !inStudy;
  if (GUEST && inStudy) renderGpsr(false);
  if (!exitSaid && entered && zp < -4.2 && zp > -7.0) {
    exitSaid = true;
    const left = STUDY_ITEMS.length - studyFound().size;
    if (left > 0) showCaption(GUEST ? GUEST.exit.replace('{n}', String(left)) : STUDY_SAY.exit(left), 5600);
  }
  if (!seenLib && zp < -8.0) { seenLib = true; keeper('libentry'); }
  if (!seenV3 && zp < -20.2) { seenV3 = true; keeper('v3entry'); }
  // Stair-crossing detector: fires on the FIRST descent and the FIRST ascent per session.
  // player.pos.y is < 0 in the sanctum, ≥ 0 up top. Once-shot: subsequent trips are silent.
  if (!stairSeen.down && player.pos.y < -0.4) { stairSeen.down = true; psEvent(PS_EV.STAIR_DESCEND); psEventOnce(PS_EV.VAULT4_ENTERED); psTouch('sanctum'); }
  if (stairSeen.down && !stairSeen.up && player.pos.y > -0.05) { stairSeen.up = true; psEvent(PS_EV.STAIR_ASCEND); }
  // the soundscape follows you room to room
  ambT += dt;
  if (ambient && ambT > 0.4) {
    ambT = 0;
    const rk = zp > -3.6 ? 'study' : zp > -8.0 ? 'corridor' : zp > -16.9 ? 'library' : zp > -20.3 ? 'corridor' : 'treasure';
    if (rk !== ambRoom) { ambRoom = rk; ambient.setRoom(rk); }
  }

  // dust drift
  if (dust && !GALLERY) {
    const a = dust.geometry.attributes.position;
    for (let i = 0; i < dustN; i++) {
      let y = a.getY(i) + dt * 0.05;
      if (y > 3.5) y = 0.2;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.02);
    }
    a.needsUpdate = true;
  }

  if (galleryRoom) galleryRoom.tick(dt, t);
  tickConfetti(dt);
  // a full-cover overlay is up: render every third frame, not every one (phones thank you)
  frameNo++;
  // the globe's close-up has its own renderer over the whole screen: the room needn't draw behind it
  if (!gvOpen && (!overlayOpen() || frameNo % 3 === 0)) renderer.render(scene, camera);
}
let frameNo = 0;
loop();
