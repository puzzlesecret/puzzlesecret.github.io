import { buildRockPassage } from './gallery-rock-passage.js';
import { buildCabin } from './gallery-cabin.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* THE KEEPER'S GALLERY — the front room (Dan, 2026-11-24).
   The Gift Edition's cover word opens this room instead of Vault I. It is the Keeper's bright front room on the
   snowy evening the Gift story ends: a couch, his copies of the shelf of four on the wall, the kettle, the chair
   he stood on to see the 75 grids, the clock and radio in the hall, and the gold door to his study (Vault I),
   which opens only with a word from inside a book. One small game, "A Quarter Slow": four scraps -> a 4x4 grid
   -> set the slow clock -> footprints on the path. Design: reference/keepers-gallery/GALLERY-DESIGN-2026-11-24.md.

   vault3d.js clears every Vault I object out of the scene first, then calls buildGallery(ctx). Everything here is
   Gallery-only; Vault I, the deeper vaults and guest rooms never run this file. No line may contain an answer word.
   Nothing is sent except the five gallery.* events (privacy.astro §2 + faq.astro list them). */

const STORE = 'ps_gallery_v1';
const AMAZON_V1 = 'https://www.amazon.com/dp/B0HB9K8PXC';   // plain link: the cover word marks this browser as a guest

// the little grid: four scraps, one row each. 0 = blank. Checked by computer: exactly one solution, grey square = 4.
const GIVENS = [1, 0, 0, 4, 0, 4, 0, 0, 0, 0, 0, 3, 0, 3, 2, 0];
const SOLUTION = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
const GREY = 10;   // row 3, column 3
const ROW_TEXT = (r) => GIVENS.slice(r * 4, r * 4 + 4).map((v, i) => (r * 4 + i === GREY ? '▒' : v || '·')).join('  ');

const SAY = {
  arrival: 'The front room. Your fifty are on the end table. I dropped something on the way in. My study is through that door. It wants a word from inside a book.',
  window: 'The snow has stopped. No prints on the path yet. I have looked more often than I need to.',
  windowAfter: 'There are prints on the path now. Yours, I expect.',
  kettle: 'Boiled. No tea again. The kettle does not mind.',
  couch: 'From here I can see all of them. One cushion sits higher than the other.',
  chair: 'Seventy-five grids, three rows. From up here they look like a field after snow. The chair creaked. It still does.',
  chairDown: 'The chair creaked.',
  clock: 'The clock in the hall. A quarter of an hour slow since I came here. I have never put it right. A house should have one thing in it that is wrong on purpose.',
  radio: 'It has never worked. I have never thrown it out. Those are two separate decisions.',
  shelf: 'Forty-one books. One is shelved upside down. I did not do that. I would like to think I did not do that.',
  pencils: 'Every one of these finished a puzzle. I keep the stubs. I do not know why either.',
  stove: 'Warm enough. Sit down if you like.',
  field: 'Paper, seventy-five sheets of it. You would see the whole floor from something higher.',
};
const SCRAPS = [   // where each row is, and what he says when you find it
  { id: 'floor', place: 'By the front door', line: 'Pencil, a row of a small grid, and a smudge. I drop these. Pick up the others for me.' },
  { id: 'kettle', place: 'In the kettle', line: 'There is paper in the kettle. That explains the taste.' },
  { id: 'couch', place: 'Under the high cushion', line: 'So that is why it sits higher.' },
  { id: 'chair', place: 'On the floor, seen from the chair', line: 'One sheet has a tick on it. Slow down here, this is the good part.' },
];
const HINTS = {
  floor: 'I dropped one by the front door. I usually do.',
  kettle: 'I keep losing things in the kettle.',
  couch: 'That cushion sits high for a reason.',
  chair: 'Have you tried the chair? It creaks.',
  grid: 'Four rows. Put them together: tap Scraps at the top.',
  clock: 'The clock is in the hall. Mind the house.',
};
const BOOKS = [   // the picture rail, south to north. Only Volume 1 carries a link.
  { key: 'gift', z: 2.65, img: '/art/cover-v1-gift-01.webp', mat: 0xb9c7d8, kicker: 'THE GIFT EDITION',
    text: 'The book with the stone on it. If you have it, you found the way in. If you know someone who looks twice, it is a good thing to leave on a step.' },
  { key: 'v1', z: 1.5, img: '/art/cover-v1-360.webp', mat: 0xd8b25a, kicker: 'VOLUME 1 · CRACK THE KEEPER’S VAULT', lit: true,
    text: 'Volume 1. The gold door I sealed, and the vault behind it. Two hundred puzzles, in three acts. If you would rather hold the whole of it, it is here.',
    link: AMAZON_V1, linkText: 'Volume 1 on Amazon' },
  { key: 'v2', z: 0.3, sketch: 'chart', mat: 0x6b7864, kicker: 'VOLUME 2 · THE CORSAIR’S CHART',
    text: 'My copy of something on the shelf above my desk: a sea chart in pieces. I copied it larger. One corner stays empty.' },
  { key: 'v3', z: -0.9, sketch: 'letters', mat: 0x937877, kicker: 'VOLUME 3 · THE LOST LOVE LETTERS',
    text: 'My copy of something on the shelf above my desk: letters tied with rose ribbon. Some still sealed. Some came back unopened. The replies are missing.' },
  { key: 'v4', z: -2.1, sketch: 'notebook', mat: 0x658285, kicker: 'VOLUME 4 · THE SILENT SIGNAL',
    text: 'My copy of something on the shelf above my desk: a notebook of numbers in my own young hand. I copied every digit and never the gaps. And the radio in the hall.' },
  { key: 'v5', z: -3.25, sketch: 'rubbing', mat: 0x998054, kicker: 'VOLUME 5 · THE HOLLOW OAK',
    text: 'My copy of something on the shelf above my desk: the oldest thing on it. A rubbing of notches cut along the edge of an old standing stone. I do not know where it stands.' },
];
const TAG_LINE = 'Planned, one shelf puzzle at a time.';

export function buildGallery(ctx) {
  const { THREE, scene, box, sprite, canvasTex, texLoader, M, interactables, OBSTACLES, floor, player } = ctx;
  const PI = Math.PI;

  /* ---------- saved progress (this browser only) ---------- */
  let st = {};
  try { st = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { st = {}; }
  if (!st || typeof st !== 'object' || Array.isArray(st)) st = {};
  if (!Array.isArray(st.found)) st.found = [];
  st.found = st.found.filter((id) => SCRAPS.some((s) => s.id === id));
  if (!Array.isArray(st.grid) || st.grid.length !== 16) st.grid = GIVENS.slice();
  st.grid = st.grid.map((v, i) => GIVENS[i] || ((v | 0) >= 0 && (v | 0) <= 4 ? v | 0 : 0));
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* private mode */ } };

  /* ---------- materials and textures ---------- */
  const R = (() => { let s = 20261124; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const B = (w, h, d, mat, x, y, z, ry = 0, parent = scene) => box(w, h, d, mat, x, y, z, ry, parent);
  const mats = {
    ...buildCabin(ctx, B),
    paper: new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2f2c2a, roughness: 0.6, metalness: 0.5 }),
    enamel: new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.35, metalness: 0.1 }),
    brownPaper: new THREE.MeshStandardMaterial({ color: 0xb48a5c, roughness: 0.9 }),
    string: new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.9 }),
  };
  floor.material = mats.boards;

  // the hit-box helper: everything you can tap gets a kind, a label and goes on the tap list
  const tap = (obj, kind, label, extra) => { obj.userData = Object.assign({ kind, label }, extra || {}); interactables.push(obj); return obj; };
  const H = 3.6;
  // the rug: five book colours, muted, between the chair and the couch
  const rugTex = canvasTex(256, 512, (g, w, h) => {
    // A flatwoven wool runner with stepped medallions and narrow selvedges.
    g.fillStyle = '#894f43'; g.fillRect(0, 0, w, h);
    for (const [margin, color, width] of [[6,'#564438',7],[14,'#c4a17a',4],[22,'#53635b',8],[30,'#d2b892',2]]) {
      g.strokeStyle = color; g.lineWidth = width; g.strokeRect(margin,margin,w-2*margin,h-2*margin);
    }
    const lozenge = (x,y,r,color) => {
      g.fillStyle = color;
      for(let k=-4;k<=4;k++) g.fillRect(x-(5-Math.abs(k))*r/5,y+k*r/5,(5-Math.abs(k))*r*2/5,r/5+1);
    };
    for (let y = 87; y < h-45; y += 112) {
      lozenge(128,y,49,'#4d5953'); lozenge(128,y,32,'#c7aa7b'); lozenge(128,y,18,'#865849');
      for (const x of [61,195]) lozenge(x,y,12,'#bf9869');
    }
    g.fillStyle='rgba(36,24,18,.11)'; for(let y=0;y<h;y+=3) g.fillRect(0,y,w,1);
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -PI / 2; rug.position.set(-0.55, 0.004, 0.3); rug.raycast = () => {}; scene.add(rug);

  /* ---------- light: cool window light, one warm stove ---------- */
  scene.add(new THREE.AmbientLight(0xf5e7d7, 0.76));
  scene.add(new THREE.HemisphereLight(0xefeae3, 0xaa9179, 1.16));
  const sun = new THREE.DirectionalLight(0xd7dfea, 1.42); sun.position.set(9, 3.2, -0.5); sun.target.position.set(0, 0.5, -0.5);
  scene.add(sun); scene.add(sun.target);
  const stoveLight = new THREE.PointLight(0xffa257, 10, 5.5, 2); stoveLight.position.set(3.02, 0.83, 2.82); scene.add(stoveLight);
  scene.background = new THREE.Color(0x1c2433);
  scene.fog = new THREE.FogExp2(0x493c35, 0.009);

  /* ---------- the gold door to the study (Vault I) — the only gold in the room ---------- */
  const door = new THREE.Group(); door.position.set(-1.5, 0, -3.93); scene.add(door);
  // a gold that reads in daylight (the vault's metal gold needs candlelight to show)
  const brassPatina = canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#e3dbc9';g.fillRect(0,0,w,h);
    for(let i=0;i<330;i++){
      const x=(i*97)%w,y=(i*133)%h,r=3+(i%19);
      const wash=g.createRadialGradient(x,y,0,x,y,r);
      wash.addColorStop(0,'rgba(93,90,63,.07)');wash.addColorStop(1,'rgba(93,90,63,0)');
      g.fillStyle=wash;g.fillRect(x-r,y-r,r*2,r*2);
    }
  });
  const goldDay = new THREE.MeshStandardMaterial({ map: brassPatina, color: 0xbba16a, metalness: 0.25, roughness: 0.4, emissive: 0x3a2606, emissiveIntensity: 0.5 });
  const oakPanel = mats.woodDark.clone(); oakPanel.color.set(0x937452);
  B(1.66, 2.46, 0.08, goldDay, 0, 1.23, 0, 0, door);
  const molding = new THREE.MeshStandardMaterial({map:brassPatina,color:0xb29860,metalness:0.28,roughness:0.58});
  for(const [x,y] of [[-0.38,1.75],[0.38,1.75],[-0.38,0.65],[0.38,0.65]]){
    const h=y>1?0.9:0.8;
    B(0.60,h+0.04,0.029,molding,x,y,0.055,0,door);
    const shape = new THREE.Shape();
    shape.moveTo(-0.26,-h/2+0.024);shape.lineTo(0.26,-h/2+0.024);
    shape.lineTo(0.26,h/2-0.024);shape.lineTo(-0.26,h/2-0.024);shape.closePath();
    const relief = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.012,bevelThickness:0.012,bevelSize:0.018,bevelSegments:1}),oakPanel);
    // Extruded face UVs follow the timber vertically inside the brass molding.
    const uv=relief.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i);uv.setXY(i,uv.getY(i),u);}
    relief.position.set(x,y,0.073);door.add(relief);
  }
  for (const y of [0.23,1.23,2.24]) {
    B(0.13,0.048,0.025,M.brass,-0.74,y,0.063,0,door);
  }
  B(0.083,0.23,0.02,M.brass,0.66,1.13,0.064,0,door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M.brass); knob.position.set(0.66, 1.15, 0.09); door.add(knob);
  const plateTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#3a2a10'; g.fillRect(0, 0, w, h); g.fillStyle = '#f3d68a'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VAULT  I', w / 2, h / 2 + 2); });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5, metalness: 0.4 }));
  plate.position.set(0, 2.28, 0.072); door.add(plate);
  const under = B(1.5, 0.02, 0.04, M.glowStrip, 0, 0.012, 0.06, 0, door);
  under.raycast = () => {};
  const doorGlow = sprite(1.2, -1.5, 0.15, -3.75, scene, 0.5); doorGlow.raycast = () => {};
  B(0.1, 2.6, 0.12, mats.trim, -2.39, 1.3, -3.88); B(0.1, 2.6, 0.12, mats.trim, -0.61, 1.3, -3.88); B(1.88, 0.1, 0.12, mats.trim, -1.5, 2.55, -3.88);
  const doorHit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  doorHit.position.set(-1.5, 1.25, -3.85); scene.add(doorHit);
  tap(doorHit, 'gdoor', 'The door to Vault I');

  /* ---------- the front door you came in by (the existing exit target sits just behind it) ---------- */
  B(2.3, 3.1, 0.08, mats.woodDark, 0, 1.55, 3.95);
  B(0.18, 0.05, 0.05, M.iron, 0.9, 1.15, 3.89);
  const mat = B(1.1, 0.02, 0.6, new THREE.MeshStandardMaterial({ color: 0x6d5236, roughness: 1 }), 0, 0.01, 3.5); mat.raycast = () => {};
  const passage = buildRockPassage(ctx, mats);
  const stoneHit = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.52), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  stoneHit.position.set(1.75, 1.24, 3.76); scene.add(stoneHit);
  tap(stoneHit, 'grock', 'The Rock');

  /* ---------- the window: snow, a path, and (after the game) footprints ---------- */
  function drawWindow(prints) {
    return canvasTex(400, 500, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, '#22324f'); sky.addColorStop(1, '#5d7395');
      g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.5);
      // Layered spruce silhouettes, a pale horizon and a sheltered snow bank.
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle = ['#586984','#45566e','#304357'][layer];
        for (let i = -1; i <= 29; i++) {
          const x = i*17 + Math.sin(i*7+layer)*12;
          const base = h*(0.48+layer*0.014);
          const height = (25+19*Math.cos(i*5.2+layer))*(0.65+layer*0.48);
          for (let tier=0; tier<4; tier++) {
            const half=height*(0.07+tier*0.038), y=base-height+tier*height*0.17;
            g.beginPath(); g.moveTo(x,y); g.lineTo(x+half,y+height*0.46);
            g.lineTo(x-half,y+height*0.46); g.fill();
          }
        }
      }
      const snow = g.createLinearGradient(0, h * 0.5, 0, h);
      snow.addColorStop(0, '#acbcd2'); snow.addColorStop(1, '#d1dbe9');
      g.fillStyle = snow; g.fillRect(0, h * 0.5, w, h * 0.5);
      // the path: from the step (bottom) to the gate
      g.fillStyle = 'rgba(170,186,206,0.55)';
      g.beginPath(); g.moveTo(w * 0.58, h); g.lineTo(w * 0.92, h); g.lineTo(w * 0.79, h * 0.52); g.lineTo(w * 0.73, h * 0.52); g.fill();
      g.fillStyle = '#3a3128'; g.fillRect(w * 0.7, h * 0.47, 6, h * 0.06); g.fillRect(w * 0.82, h * 0.47, 6, h * 0.06);
      g.fillRect(w * 0.7, h * 0.48, w * 0.12 + 6, 4);
      g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 60; i++) g.fillRect(((i*137)%397), ((i*71)%194), 1.2, 1.2);
      if (prints) {
        g.fillStyle = 'rgba(52,66,90,0.85)';
        for (let k = 0; k < 11; k++) {
          const t = k / 10, y = h * (0.96 - t * 0.42), cx = w * (0.75 + 0.01 * (1 - t)), sc = 1.2 - t * 0.8, off = (k % 2 ? 1 : -1) * 9 * sc;
          g.beginPath(); g.ellipse(cx + off, y, 6 * sc, 10 * sc, 0, 0, PI * 2); g.fill();
        }
      }
    });
  }
  const winTexA = drawWindow(false), winTexB = drawWindow(true);
  const winMat = new THREE.MeshBasicMaterial({ map: st.done ? winTexB : winTexA });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), winMat);
  win.rotation.y = -PI / 2; win.position.set(4.07, 1.9, -0.5); scene.add(win);
  tap(win, 'gwindow', 'The window', { stand: [2.7, -0.5], look: [4, 1.7, -0.5] });
  B(0.06, 2.0, 0.06, mats.trim, 4.0, 1.9, -0.5); B(0.06, 0.06, 1.6, mats.trim, 4.0, 2.25, -0.5);
  B(0.1, 2.1, 0.08, mats.trim, 4.0, 1.9, -1.32); B(0.1, 2.1, 0.08, mats.trim, 4.0, 1.9, 0.32);
  B(0.3, 0.06, 1.8, mats.trim, 3.92, 0.88, -0.5); B(0.1, 0.08, 1.8, mats.trim, 4.0, 2.93, -0.5);
  B(0.5, 0.45, 1.6, mats.wood, 3.72, 0.225, -0.5);
  B(0.46, 0.08, 1.5, mats.fabric2, 3.72, 0.49, -0.5);

  /* ---------- the couch and the end table (the kettle, the gift parcel) ---------- */
  const couch = new THREE.Group(); scene.add(couch);
  const cparts = [
    B(0.85, 0.36, 2.1, mats.fabric, 0.78, 0.22, 0.3, 0, couch),
    B(0.2, 0.62, 2.1, mats.fabric, 1.12, 0.47, 0.3, 0, couch),
    B(0.14, 0.34, 0.95, mats.fabric2, 1.0, 0.7, -0.22, 0, couch),
    B(0.14, 0.34, 0.95, mats.fabric2, 1.0, 0.7, 0.82, 0, couch),
    B(0.85, 0.62, 0.2, mats.fabric, 0.78, 0.31, -0.8, 0, couch),
    B(0.85, 0.62, 0.2, mats.fabric, 0.78, 0.31, 1.4, 0, couch),
    B(0.64, 0.12, 0.98, mats.fabric2, 0.66, 0.46, -0.22, 0, couch),
  ];
  const highCushion = B(0.64, 0.12, 0.98, mats.fabric2, 0.66, 0.53, 0.82, 0, couch);
  highCushion.rotation.z = 0.06; cparts.push(highCushion);
  // Preserve the interaction boxes and hinge animation while rounding the upholstery.
  const hiddenUpholstery = new THREE.MeshBasicMaterial({ visible: false });
  for (const part of cparts) {
    const { width, height, depth } = part.geometry.parameters;
    const pad = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, Math.min(height / 3, 0.065)), part.material);
    part.material = hiddenUpholstery; part.add(pad);
  }
  [[0.42, -0.72], [1.16, -0.72], [0.42, 1.32], [1.16, 1.32]].forEach(([x, z]) => B(0.06, 0.06, 0.06, mats.woodDark, x, 0.03, z, 0, couch));
  cparts.forEach((m) => tap(m, 'gcouch', 'The couch', { stand: [-0.15, 0.55], look: [0.7, 0.5, 0.6] }));
  // end table
  const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), mats.wood); tbl.position.set(0.78, 0.6, -1.42); scene.add(tbl);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.58, 10), mats.woodDark); leg.position.set(0.78, 0.29, -1.42); scene.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 18), mats.woodDark); foot.position.set(0.78, 0.015, -1.42); scene.add(foot);
  const kettle = new THREE.Group(); kettle.position.set(0.9, 0.62, -1.52); scene.add(kettle);
  const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.15, 18), mats.enamel); kb.position.y = 0.075; kettle.add(kb);
  const kl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.03, 14), mats.enamel); kl.position.y = 0.165; kettle.add(kl);
  const ks = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 8), mats.enamel); ks.position.set(-0.1, 0.1, 0); ks.rotation.z = 0.9; kettle.add(ks);
  const kh = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16, PI), M.iron); kh.position.y = 0.17; kettle.add(kh);
  const kettleHit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  kettleHit.position.set(0.9, 0.75, -1.52); scene.add(kettleHit);
  tap(kettleHit, 'gkettle', 'The kettle', { stand: [0.05, -1.75], look: [0.9, 0.7, -1.52] });
  const parcel = new THREE.Group(); parcel.position.set(0.66, 0.655, -1.34); parcel.rotation.y = 0.35; scene.add(parcel);
  B(0.26, 0.07, 0.2, mats.brownPaper, 0, 0, 0, 0, parcel);
  B(0.265, 0.074, 0.012, mats.string, 0, 0, 0, 0, parcel); B(0.012, 0.074, 0.205, mats.string, 0, 0, 0, 0, parcel);
  const parcelGlow = sprite(0.5, 0.66, 0.72, -1.34, scene, 0.35); parcelGlow.raycast = () => {};
  const parcelHit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.36), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  parcelHit.position.set(0.66, 0.68, -1.34); scene.add(parcelHit);
  tap(parcelHit, 'ggift', 'Your gift: fifty easy puzzles', { stand: [0.05, -1.75], look: [0.66, 0.65, -1.34] });

  /* ---------- the chair and the field of 75 blank sheets ---------- */
  const CHAIR = { x: -1.85, z: 0.2 };
  const chair = new THREE.Group(); chair.position.set(CHAIR.x, 0, CHAIR.z); chair.rotation.y = 0.4; scene.add(chair);
  const chParts = [B(0.44, 0.05, 0.42, mats.wood, 0, 0.46, 0, 0, chair)];
  [[-0.19, 0.18], [0.19, 0.18], [-0.19, -0.18], [0.19, -0.18]].forEach(([x, z]) => chParts.push(B(0.045, 0.46, 0.045, mats.woodDark, x, 0.23, z, 0, chair)));
  chParts.push(B(0.045, 0.55, 0.045, mats.woodDark, -0.19, 0.76, 0.19, 0, chair), B(0.045, 0.55, 0.045, mats.woodDark, 0.19, 0.76, 0.19, 0, chair), B(0.42, 0.08, 0.03, mats.wood, 0, 0.98, 0.19, 0, chair));
  chParts.forEach((m) => tap(m, 'gchair', 'The chair. It creaks.'));
  const sheetTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ded4bd'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 1;
    for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(6 + i * 52 / 9, 6); g.lineTo(6 + i * 52 / 9, 58); g.moveTo(6, 6 + i * 52 / 9); g.lineTo(58, 6 + i * 52 / 9); g.stroke(); }
    g.strokeStyle = 'rgba(80,70,60,0.6)'; g.strokeRect(6, 6, 52, 52);
  });
  const sheetGeo = new THREE.PlaneGeometry(0.17, 0.17);
  const sheets = new THREE.InstancedMesh(sheetGeo, new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.95 }), 75);
  const dummy = new THREE.Object3D(); let si = 0; let TICK = null;
  [-2.95, -2.68, -2.41].forEach((x, row) => {
    for (let k = 0; k < 25; k++) {
      const z = -2.55 + k * 0.205;
      if (row === 1 && k === 15) { TICK = { x, z }; }
      dummy.position.set(x + (R() - 0.5) * 0.02, 0.006, z); dummy.rotation.set(-PI / 2, 0, (R() - 0.5) * 0.12); dummy.updateMatrix();
      sheets.setMatrixAt(si++, dummy.matrix);
    }
  });
  sheets.instanceMatrix.needsUpdate = true; scene.add(sheets);
  tap(sheets, 'gfield', 'Seventy-five grids');
  const tickTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ded4bd'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 1;
    for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(6 + i * 52 / 9, 6); g.lineTo(6 + i * 52 / 9, 58); g.moveTo(6, 6 + i * 52 / 9); g.lineTo(58, 6 + i * 52 / 9); g.stroke(); }
    g.strokeStyle = 'rgba(80,70,60,0.6)'; g.strokeRect(6, 6, 52, 52);
    g.strokeStyle = '#2b2218'; g.lineWidth = 4; g.lineCap = 'round';
    g.lineWidth = 5; g.beginPath(); g.moveTo(16, 32); g.lineTo(27, 46); g.lineTo(49, 14); g.stroke();
  });
  const tickMat = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.95 });
  if (st.found.includes('chair')) tickMat.map = tickTex;   // once found, the mark stays
  const tickSheet = new THREE.Mesh(sheetGeo, tickMat);
  tickSheet.rotation.set(-PI / 2, 0, -PI / 2); tickSheet.position.set(TICK.x, 0.008, TICK.z); scene.add(tickSheet);
  tap(tickSheet, 'gtick', 'One sheet has a mark on it');

  /* ---------- the picture rail: his copies of the shelf, and the two books that are out ---------- */
  function sketchTex(kind) {
    return canvasTex(420, 540, (g, w, h) => {
      g.fillStyle = '#efe7d4'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(60,50,40,0.75)'; g.fillStyle = 'rgba(60,50,40,0.75)'; g.lineWidth = 2; g.lineCap = 'round';
      const wob = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); const n = 12; for (let i = 1; i <= n; i++) g.lineTo(x0 + (x1 - x0) * i / n + (R() - 0.5) * 3, y0 + (y1 - y0) * i / n + (R() - 0.5) * 3); g.stroke(); };
      if (kind === 'chart') {
        // a chart copied larger, one corner left empty (top right)
        g.globalAlpha = 0.35; for (let x = 40; x < w - 30; x += 40) wob(x, 40, x, h - 40); for (let y = 40; y < h - 30; y += 40) wob(30, y, w - 30, y); g.globalAlpha = 1;
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(40, 330);
        for (let x = 40; x < 300; x += 12) g.lineTo(x, 330 - Math.sin(x * 0.04) * 40 - (x > 160 ? (x - 160) * 0.5 : 0) + (R() - 0.5) * 8);
        g.stroke();
        g.beginPath(); g.arc(150, 420, 46, 0, PI * 2); g.stroke();
        for (let a = 0; a < 8; a++) wob(150, 420, 150 + Math.cos(a * PI / 4) * (a % 2 ? 30 : 60), 420 + Math.sin(a * PI / 4) * (a % 2 ? 30 : 60));
        g.fillStyle = '#efe7d4'; g.fillRect(w * 0.58, 0, w * 0.42, h * 0.36);
        g.setLineDash([6, 6]); g.strokeRect(w * 0.6, 14, w * 0.38 - 14, h * 0.34); g.setLineDash([]);
      } else if (kind === 'letters') {
        for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, h / 2 + i * 10 - 15); g.rotate((i - 1.5) * 0.05); g.strokeRect(-140, -90, 280, 180); g.restore(); }
        g.strokeStyle = 'rgba(176,92,120,0.95)'; g.lineWidth = 9;
        g.beginPath(); g.moveTo(w / 2, h / 2 - 115); g.lineTo(w / 2, h / 2 + 115); g.moveTo(w / 2 - 150, h / 2); g.lineTo(w / 2 + 150, h / 2); g.stroke();
        g.lineWidth = 7; g.beginPath(); g.ellipse(w / 2 - 28, h / 2 - 14, 30, 16, -0.4, 0, PI * 2); g.ellipse(w / 2 + 28, h / 2 - 14, 30, 16, 0.4, 0, PI * 2); g.stroke();
        g.strokeStyle = 'rgba(60,50,40,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2 + 95, h / 2 + 50, 16, 0, PI * 2); g.stroke();
      } else if (kind === 'notebook') {
        g.strokeStyle = 'rgba(80,110,150,0.35)'; for (let y = 70; y < h - 30; y += 30) wob(30, y, w - 30, y);
        g.strokeStyle = 'rgba(160,60,60,0.4)'; wob(70, 30, 70, h - 30);
        g.fillStyle = 'rgba(50,40,32,0.85)'; g.font = '22px "Courier New", monospace';
        for (let r = 0; r < 14; r++) {
          let x = 84;
          for (let c = 0; c < 9; c++) { if (R() < 0.72) g.fillText(String(Math.floor(R() * 10)), x, 64 + r * 30); x += 30 + (R() < 0.2 ? 24 : 0); }
        }
      } else {
        // a charcoal rubbing of notches along a stone edge
        g.fillStyle = 'rgba(40,36,32,0.85)';
        for (let i = 0; i < 2600; i++) { const x = 60 + R() * (w - 120), y = 40 + R() * (h - 80); g.globalAlpha = 0.12 + R() * 0.25; g.fillRect(x, y, 3, 2); }
        g.globalAlpha = 1; g.fillStyle = '#efe7d4';
        let y = 70; while (y < h - 70) { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) g.fillRect(w / 2 - 6, y + k * 9, 70 + R() * 30, 4); y += n * 9 + 22; }
        g.fillRect(w / 2 - 8, 40, 6, h - 80);
      }
    });
  }
  const frames = [];
  BOOKS.forEach((bk, i) => {
    const g = new THREE.Group(); g.position.set(-3.95, 1.62, bk.z); g.rotation.y = PI / 2; scene.add(g);
    const w = 0.7, h = 0.9;
    B(w + 0.18, h + 0.18, 0.04, mats.woodDark, 0, 0, -0.02, 0, g);
    const matP = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.12, h + 0.12), new THREE.MeshStandardMaterial({ color: bk.mat, roughness: 0.9 }));
    matP.position.z = 0.002; g.add(matP);
    let tex;
    if (bk.img) { tex = texLoader.load(bk.img); tex.colorSpace = THREE.SRGBColorSpace; } else tex = sketchTex(bk.sketch);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    pic.position.z = 0.004; g.add(pic);
    if (bk.sketch) {   // a paper tag on a string: "Being drawn."
      const tagTex = canvasTex(400, 96, (c, cw, ch) => { c.fillStyle = '#f4ecd8'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#3a2c1c'; c.font = 'italic 46px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Vol. ' + bk.key.slice(1) + ' · planned', cw / 2, ch / 2); });
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.9 }));
      tag.position.set(0, -h / 2 - 0.2, 0.006); tag.rotation.z = -0.05; g.add(tag);
    }
    if (bk.lit) {
      B(0.42, 0.04, 0.08, M.brass, 0, h / 2 + 0.16, 0.06, 0, g);
      const gl = sprite(1.1, 0, h / 2 - 0.05, 0.12, g, 0.25); gl.raycast = () => {};
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.5, 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.set(0, -0.1, 0.04); g.add(hit);
    tap(hit, 'gframe', bk.kicker.split(' · ')[0] === 'THE GIFT EDITION' ? 'The Gift Edition' : bk.kicker.replace(/ · .*/, ''), { idx: i, stand: [-2.05, bk.z], look: [-3.95, 1.6, bk.z] });
    frames.push(hit);
  });

  /* ---------- bookcases: the upside-down book, the pencil tin ---------- */
  const bc = new THREE.Group(); bc.position.set(2.5, 0, -3.72); scene.add(bc);
  const bcParts = [B(1.9, 2.2, 0.04, mats.woodDark, 0, 1.1, -0.17, 0, bc), B(0.05, 2.2, 0.38, mats.woodDark, -0.93, 1.1, 0, 0, bc), B(0.05, 2.2, 0.38, mats.woodDark, 0.93, 1.1, 0, 0, bc)];
  [0.05, 0.6, 1.15, 1.7, 2.2].forEach((y) => bcParts.push(B(1.86, 0.04, 0.36, mats.wood, 0, y, 0, 0, bc)));
  const spineCols = [0x7a3b2e, 0x3d5a45, 0x2f4466, 0x8a6a3a, 0x5c3d5a, 0x6b6f45, 0x40403f, 0x8b5a2b];
  let upside = null;
  [0.07, 0.62, 1.17, 1.72].forEach((y, shelf) => {
    let x = -0.86;
    while (x < 0.82) {
      const bw = 0.04 + R() * 0.04, bh = 0.36 + R() * 0.12;
      if (shelf === 1 && !upside && x > 0.1) {
        upside = B(0.05, 0.44, 0.26, new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.8 }), x + 0.025, y + 0.24, 0.02, 0, bc);
        const band = B(0.052, 0.05, 0.262, new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 }), x + 0.025, y + 0.07, 0.02, 0, bc);   // the title band sits at the bottom: upside down
        band.raycast = () => {};
        x += 0.06; continue;
      }
      bcParts.push(B(bw, bh, 0.26, new THREE.MeshStandardMaterial({ color: spineCols[Math.floor(R() * spineCols.length)], roughness: 0.8 }), x + bw / 2, y + bh / 2 + 0.02, 0.02, 0, bc));
      x += bw + 0.005;
    }
  });
  bcParts.forEach((m) => tap(m, 'gsay', 'A bookcase', { say: 'shelf', stand: [2.5, -2.75], look: [2.5, 1.2, -3.72] }));
  tap(upside, 'gupside', 'A book, shelved upside down', { stand: [2.5, -2.75], look: [2.5, 1.0, -3.72] });
  const lb = new THREE.Group(); lb.position.set(-3.15, 0, -3.74); scene.add(lb);
  const lbParts = [B(1.3, 1.0, 0.34, mats.woodDark, 0, 0.5, 0, 0, lb)];
  const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 14), M.iron); tin.position.set(0.3, 1.065, 0); lb.add(tin);
  for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06 + R() * 0.04, 6), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xd7a43a : 0x3b6a3a })); p.position.set(0.3 + (R() - 0.5) * 0.06, 1.15, (R() - 0.5) * 0.06); p.rotation.set((R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4); lb.add(p); }
  lbParts.push(tin);
  lbParts.forEach((m) => tap(m, 'gsay', 'A tin of pencil stubs', { say: 'pencils', stand: [-2.7, -2.85], look: [-2.85, 1.05, -3.74] }));

  /* ---------- the stove ---------- */
  const stove = new THREE.Group(); stove.position.set(3.15, 0.078, 3.15); scene.add(stove);
  const sParts = [B(0.6, 0.62, 0.5, M.iron, 0, 0.36, 0, 0, stove), B(0.66, 0.05, 0.56, M.iron, 0, 0.69, 0, 0, stove)];
  [[-0.24, -0.19], [0.24, -0.19], [-0.24, 0.19], [0.24, 0.19]].forEach(([x, z]) => sParts.push(B(0.05, 0.06, 0.05, M.iron, x, 0.03, z, 0, stove)));
  const fire = B(0.3, 0.12, 0.02, M.glowStrip, 0, 0.36, -0.26, 0, stove); fire.raycast = () => {};
  const embers = canvasTex(128,48,(g,w,h) => {
    const glow = g.createLinearGradient(0,0,0,h);
    glow.addColorStop(0,'#28160f'); glow.addColorStop(0.62,'#ad3e15'); glow.addColorStop(0.85,'#ffb448'); glow.addColorStop(1,'#693015');
    g.fillStyle=glow; g.fillRect(0,0,w,h);
    for(let k=0;k<9;k++){
      const x=k*15,tip=8+13*Math.sin(k*2.3);
      g.fillStyle=k%2?'#dd6325':'#f7a745'; g.beginPath(); g.moveTo(x-7,h-8);
      g.quadraticCurveTo(x+8,h-23,x+4,tip); g.quadraticCurveTo(x+16,h-19,x+9,h-5); g.fill();
    }
  });
  fire.material = new THREE.MeshBasicMaterial({map:embers});
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H - 0.7, 12), M.iron); flue.position.set(0, 0.7 + (H - 0.7) / 2, 0.05); stove.add(flue);
  const firebox = B(0.44,0.29,0.028,mats.iron,0,0.36,-0.255,0,stove);
  fire.position.z = -0.277;
  for (const x of [-0.09,0,0.09]) B(0.013,0.13,0.016,mats.iron,x,0.36,-0.293,0,stove);
  B(0.08,0.018,0.045,M.brass,0.16,0.36,-0.286,0,stove);
  sParts.push(flue,firebox);
  sParts.forEach((m) => tap(m, 'gsay', 'The stove', { say: 'stove', stand: [2.4, 2.55], look: [3.15, 0.4, 3.15] }));
  const stoveGlow = sprite(0.9, 3.15, 0.4, 2.85, scene, 0.4); stoveGlow.raycast = () => {};

  /* ---------- the hall, through the doorway: the slow clock and the radio ---------- */
  const hallF = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.6), mats.boards); hallF.rotation.x = -PI / 2; hallF.position.set(-3.15, 0.002, 4.85); hallF.raycast = () => {}; scene.add(hallF);
  const hallC = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.6), mats.ceil); hallC.rotation.x = PI / 2; hallC.position.set(-3.15, 2.6, 4.85); scene.add(hallC);
  B(1.9, H - 2.6, 1.6, mats.plaster, -3.15, 2.6 + (H - 2.6) / 2, 4.85);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3), new THREE.MeshStandardMaterial({ color: 0x8a5a4a, roughness: 1 }));
  runner.rotation.x = -PI / 2; runner.position.set(-3.15, 0.005, 4.85); runner.raycast = () => {}; scene.add(runner);
  B(0.5, 0.05, 0.06, mats.woodDark, -2.55, 1.75, 5.58); B(0.04, 0.1, 0.06, M.iron, -2.45, 1.7, 5.54);
  B(0.12, 0.7, 0.03, new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 1 }), -2.45, 1.32, 5.52);
  const hallLight = new THREE.PointLight(0xfff0d8, 1.2, 3, 2); hallLight.position.set(-3.15, 2.3, 4.85); scene.add(hallLight);
  // the clock: a tall case, a face that keeps the house's own time (a quarter of an hour slow), a pendulum door
  const clock = new THREE.Group(); clock.position.set(-3.6, 0, 5.4); clock.rotation.y = PI; scene.add(clock);
  const clockParts = [B(0.46, 1.95, 0.3, mats.woodDark, 0, 0.975, 0, 0, clock), B(0.52, 0.08, 0.34, mats.woodDark, 0, 1.99, 0, 0, clock)];
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 128;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace;
  function drawFace(hh, mm) {
    const g = faceCanvas.getContext('2d'), c = 64;
    g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(c, c, 62, 0, PI * 2); g.fill();
    g.strokeStyle = '#3a2c1c'; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(c + Math.sin(a) * 50, c - Math.cos(a) * 50); g.lineTo(c + Math.sin(a) * 58, c - Math.cos(a) * 58); g.stroke(); }
    const ha = ((hh % 12) + mm / 60) * PI / 6, ma = mm * PI / 30;
    g.lineWidth = 5; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(ha) * 30, c - Math.cos(ha) * 30); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(ma) * 46, c - Math.cos(ma) * 46); g.stroke();
    faceTex.needsUpdate = true;
  }
  const slowNow = () => { const d = new Date(Date.now() - 15 * 60000); return [d.getHours(), d.getMinutes()]; };
  drawFace(...(st.done ? [3, 45] : slowNow()));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.17, 28), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6 }));
  face.position.set(0, 1.65, 0.152); clock.add(face);
  const pendHinge = new THREE.Group(); pendHinge.position.set(-0.15, 0.9, 0.152); clock.add(pendHinge);
  const pendDoor = B(0.3, 0.6, 0.02, new THREE.MeshStandardMaterial({ color: 0xc9dbe6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35 }), 0.15, 0, 0.01, 0, pendHinge);
  const bob = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), M.brass); bob.position.set(0, 0.75, 0.145); clock.add(bob);
  clockParts.push(face, pendDoor);
  if (st.done) pendHinge.rotation.y = -1.3;
  clockParts.forEach((m) => tap(m, 'gclock', 'The clock in the hall', { stand: [-3.05, 3.3], look: [-3.6, 1.5, 5.4] }));
  // the radio, on a small table
  B(0.6, 0.8, 0.4, mats.wood, -2.75, 0.4, 5.4);
  const radioTex = canvasTex(128, 80, (g, w, h) => {
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9b89a'; g.fillRect(10, 10, 70, 60);
    g.strokeStyle = 'rgba(60,40,25,.6)'; for (let y = 16; y < 70; y += 6) { g.beginPath(); g.moveTo(12, y); g.lineTo(78, y); g.stroke(); }
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(102, 28, 10, 0, PI * 2); g.fill(); g.beginPath(); g.arc(102, 56, 10, 0, PI * 2); g.fill();
  });
  const radio = B(0.5, 0.32, 0.25, new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.6 }), -2.75, 0.96, 5.4);
  const rface = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3), new THREE.MeshStandardMaterial({ map: radioTex, roughness: 0.6 }));
  rface.rotation.y = PI; rface.position.set(-2.75, 0.96, 5.272); scene.add(rface);
  [radio, rface].forEach((m) => tap(m, 'gradio', 'The radio in the hall', { stand: [-2.9, 3.3], look: [-2.75, 1.0, 5.4] }));

  /* ---------- the four scraps ---------- */
  const ball = new THREE.Mesh(ctx.paperBall ? ctx.paperBall(0.075, 811) : new THREE.IcosahedronGeometry(0.07, 1), ctx.paperMat || mats.paper);
  if (!ball.geometry.boundingBox) ball.geometry.computeBoundingBox();
  ball.position.set(0.62, -ball.geometry.boundingBox.min.y - 0.004, 2.2); scene.add(ball);
  const ballHit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  ballHit.position.copy(ball.position); scene.add(ballHit);
  tap(ballHit, 'gscrap', 'A crumpled scrap of paper', { stand: [0.25, 2.75], look: [0.62, 0, 2.2] });
  if (st.found.includes('floor')) { ball.visible = false; ballHit.visible = false; ballHit.raycast = () => {}; }

  /* ---------- where you can't walk ---------- */
  OBSTACLES.push(
    { x: 0.78, z: -0.15, r: 0.7 }, { x: 0.78, z: 0.75, r: 0.7 },     // couch
    { x: 0.78, z: -1.42, r: 0.42 },                                    // end table
    { x: 2.0, z: -3.55, r: 0.35 }, { x: 3.0, z: -3.55, r: 0.35 },      // bookcase
    { x: -3.15, z: -3.55, r: 0.45 },                                   // low bookcase
    { x: 3.15, z: 3.15, r: 0.6 },                                      // stove
    { x: 3.62, z: -0.5, r: 0.5 },                                      // window seat
  );

  /* ================= the cards (DOM, built once; text only, never innerHTML) ================= */
  const css = document.createElement('style');
  css.textContent = `
    body.ps-gallery #studyCount { display: none !important; }
    #gHud[hidden] { display: none; }
    body.ps-rock-visit :is(#gHud,#brand,#fwdBtn,#caption,#hint,#slowBar) { visibility:hidden; }
    #gHud { position: fixed; top: 58px; left: 12px; z-index: 12; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    #gHud button { pointer-events: auto; font: 600 13px/1 Georgia, serif; letter-spacing: .04em; color: #f3e6c8; background: rgba(18,22,30,.72);
      border: 1px solid rgba(246,178,60,.55); border-radius: 999px; padding: 10px 14px; min-height: 40px; cursor: pointer; }
    #gHud button:hover, #gHud button:focus-visible { background: rgba(246,178,60,.22); outline: none; }
    #gHud #gScraps b { color: #f6b23c; }
    #gOverlay { position: fixed; inset: 0; z-index: 16; display: flex; align-items: center; justify-content: center; background: rgba(8,10,16,.55); padding: 14px; overflow-y: auto; }
    #gOverlay[hidden] { display: none; }
    .g-card { position: relative; width: min(560px, 94vw); margin: auto 0; padding: 26px 24px 20px; color: #2c2011; text-align: center;
      background: radial-gradient(120% 90% at 30% 20%, #f8f2e2 0%, #ece2c8 60%, #dccca6 100%); border-radius: 6px; box-shadow: 0 24px 60px rgba(0,0,0,.6);
      font: 19px/1.5 Georgia, serif; }
    .g-kick { font: 600 12px/1.3 Georgia, serif; letter-spacing: .24em; color: #6b4d1f; margin: 0 0 10px; }
    .g-title { font: 700 26px/1.2 Georgia, serif; margin: 0 0 10px; color: #1a1208; }
    .g-text { margin: 0 0 14px; }
    .g-row { font: 700 34px/1.2 "Courier New", monospace; letter-spacing: .1em; margin: 6px 0 12px; color: #1a1208; }
    .g-btns { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 8px; }
    .g-btn { font: 600 16px/1 Georgia, serif; min-height: 46px; padding: 12px 18px; border-radius: 6px; border: 1px solid #6b4d1f; background: transparent; color: #3a2a10; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
    .g-btn.gold { background: #e2b24c; border-color: #b8760c; color: #2a1a06; }
    .g-btn:focus-visible { outline: 3px solid #2c2011; outline-offset: 2px; }
    .g-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; width: min(300px, 78vw); margin: 6px auto 12px; border: 3px solid #2c2011; }
    .g-grid button { aspect-ratio: 1; font: 700 30px/1 Georgia, serif; border: 1px solid rgba(44,32,17,.35); background: rgba(255,252,244,.75); color: #6b4d1f; cursor: pointer; padding: 0; }
    .g-grid button.given { color: #1a1208; cursor: default; }
    .g-grid button.grey { background: rgba(120,120,120,.35); }
    .g-grid button.bad { color: #a33; background: rgba(200,120,120,.25); }
    .g-grid button:nth-child(4n+2) { border-right: 3px solid #2c2011; }
    .g-grid button:nth-child(n+5):nth-child(-n+8) { border-bottom: 3px solid #2c2011; }
    .g-clock { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 8px 0 12px; }
    .g-clock .t { font: 700 44px/1 Georgia, serif; min-width: 3.4em; }
    .g-clock .col { display: flex; flex-direction: column; gap: 6px; }
    .g-clock .col button { width: 52px; height: 44px; font: 700 22px/1 Georgia, serif; border-radius: 6px; border: 1px solid #6b4d1f; background: rgba(255,252,244,.7); cursor: pointer; }
    .g-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 12px; }
    .g-list button { min-height: 46px; font: 16px/1.2 Georgia, serif; text-align: left; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(107,77,31,.55); background: rgba(255,252,244,.6); color: #2c2011; cursor: pointer; }
    .g-note { font-style: italic; font-size: 16px; color: #4a3a20; margin: 8px 0 0; }
    .g-bm { display: block; width: min(150px, 34vw); margin: 4px auto 10px; border: 1px solid #b9a77f; }
    .g-msg { min-height: 1.4em; font-style: italic; font-size: 16px; color: #6b3a1a; margin: 4px 0 0; }
    @media (max-width: 600px) { #gHud { top: 96px; left: 8px; gap: 6px; } #gHud button { font-size: 15px; padding: 10px 13px; min-height: 44px; } .g-card { font-size: 18px; padding: 22px 16px 16px; } .g-list { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(css);
  document.body.classList.add('ps-gallery');

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hud = el('div'); hud.id = 'gHud';
  const bGift = el('button', null, 'Your gift'), bDoor = el('button', null, 'Door to Vault I'), bScraps = el('button'), bList = el('button', null, 'Room list');
  bScraps.id = 'gScraps';
  hud.append(bGift, bDoor, bScraps, bList); hud.hidden = true; document.body.appendChild(hud);
  const overlay = el('div'); overlay.id = 'gOverlay'; overlay.hidden = true; document.body.appendChild(overlay);
  let lastFocus = null, onClose = null;
  const close = () => { overlay.hidden = true; overlay.textContent = ''; const f = onClose; onClose = null; if (f) f(); if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {} lastFocus = null; };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  addEventListener('keydown', (e) => { if (!overlay.hidden && e.key === 'Escape') { close(); e.stopPropagation(); } }, true);
  function card(kicker, title, parts, buttons) {
    if (overlay.hidden) lastFocus = document.activeElement;
    onClose = null; overlay.textContent = '';
    const c = el('div', 'g-card'); c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', kicker);
    if (kicker) c.appendChild(el('p', 'g-kick', kicker));
    if (title) c.appendChild(el('h2', 'g-title', title));
    (parts || []).forEach((p) => c.appendChild(typeof p === 'string' ? el('p', 'g-text', p) : p));
    const row = el('div', 'g-btns');
    (buttons || [{ text: 'Close', fn: close }]).forEach((b) => {
      let n;
      if (b.href) { n = el('a', 'g-btn' + (b.gold ? ' gold' : ''), b.text); n.href = b.href; if (b.blank) { n.target = '_blank'; n.rel = 'noopener'; } if (b.download) n.download = b.download; if (b.fn) n.addEventListener('click', b.fn); }
      else { n = el('button', 'g-btn' + (b.gold ? ' gold' : ''), b.text); n.type = 'button'; n.addEventListener('click', b.fn); }
      row.appendChild(n);
    });
    c.appendChild(row);
    overlay.appendChild(c); overlay.hidden = false;
    const f = c.querySelector('button, a'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
    return c;
  }

  /* ---------- helpers ---------- */
  const look = (x, y, z) => {
    const p = player.pos, dx = x - p.x, dz = z - p.z, dy = y - 1.6;
    ctx.setView(Math.atan2(-dx, -dz), Math.max(-0.8, Math.min(0.5, Math.atan2(dy, Math.hypot(dx, dz)))));
  };
  const go = (u, fn) => { if (u && u.stand) ctx.goThen(u.stand[0], u.stand[1], () => { if (u.look) look(...u.look); fn(); }); else fn(); };
  let lastProgress = Date.now();
  const renderScraps = () => {
    bScraps.textContent = '';
    bScraps.append('Scraps ', el('b', null, String(st.found.length)), ' of 4');
    if (st.gridSolved) { bScraps.textContent = st.done ? 'The path ✓' : 'The grid ✓ · now the clock'; }
  };
  renderScraps();

  function foundScrap(id) {
    const s = SCRAPS.find((x) => x.id === id); if (!s) return;
    const isNew = !st.found.includes(id);
    if (isNew) { st.found.push(id); save(); lastProgress = Date.now(); ctx.psEvent(ctx.EV.GALLERY_SCRAP, st.found.length + ' of 4'); }
    renderScraps();
    const r = SCRAPS.indexOf(s);
    const n = st.found.length;
    const btns = n === 4 ? [{ text: 'Put them together', gold: true, fn: openGrid }, { text: 'Later', fn: close }] : [{ text: 'Keep looking', fn: close }];
    card('A SCRAP · ' + n + ' OF 4 FOUND', null, [el('p', 'g-row', ROW_TEXT(r)), s.line, ...(n < 4 ? [el('p', 'g-note', (4 - n) + (4 - n === 1 ? ' more is' : ' more are') + ' somewhere in this room.')] : [])], btns);
    if (id === 'floor') { ball.visible = false; ballHit.raycast = () => {}; }
  }
  function openScrapsCard() {
    if (st.found.length === 4) { openGrid(); return; }
    const rows = [0, 1, 2, 3].map((r) => el('p', 'g-row', st.found.includes(SCRAPS[r].id) ? ROW_TEXT(r) : '?  ?  ?  ?'));
    card('YOUR SCRAPS · ' + st.found.length + ' OF 4', null, [...rows, el('p', 'g-note', 'Four rows of a small grid. The Keeper drops things. Look around the room.')]);
  }

  /* ---------- the grid ---------- */
  function openGrid() {
    if (st.found.length < 4) { openScrapsCard(); return; }
    const grid = el('div', 'g-grid'); const cells = [];
    const msg = el('p', 'g-msg', '');
    GIVENS.forEach((v, i) => {
      const b = el('button', (v ? 'given' : '') + (i === GREY ? ' grey' : ''), String(st.grid[i] || ''));
      b.type = 'button'; b.setAttribute('aria-label', 'Row ' + (Math.floor(i / 4) + 1) + ', column ' + (i % 4 + 1) + (i === GREY ? ', the grey square' : ''));
      if (!v && !st.gridSolved) b.addEventListener('click', () => {
        if (st.gridSolved) return;
        st.grid[i] = ((st.grid[i] || 0) + 1) % 5; b.textContent = st.grid[i] ? String(st.grid[i]) : ''; b.classList.remove('bad'); msg.textContent = ''; save(); checkSolved();
      });
      cells.push(b); grid.appendChild(b);
    });
    const note = el('p', 'g-text', st.gridSolved ? GRID_NOTE : 'Each row, column and corner box holds 1, 2, 3 and 4 once. Tap a square to change it.');
    function checkSolved() {
      if (st.gridSolved || !st.grid.every((v, i) => v === SOLUTION[i])) return;
      st.gridSolved = true; save(); lastProgress = Date.now(); renderScraps(); ctx.psEvent(ctx.EV.GALLERY_GRID);
      ctx.playUnlock(); note.textContent = GRID_NOTE; cells.forEach((c) => c.classList.add('given'));
      btns.querySelector('button').textContent = 'Go to the clock';
    }
    const c = card('THE LITTLE GRID', null, [grid, note, msg], st.gridSolved
      ? [{ text: 'Go to the clock', gold: true, fn: () => { close(); act('gclock', clockParts[0]); } }, { text: 'Close', fn: close }]
      : [{ text: 'Check', gold: true, fn: () => {
          if (st.gridSolved) { close(); act('gclock', clockParts[0]); return; }
          let bad = 0; st.grid.forEach((v, i) => { if (v && v !== SOLUTION[i]) { cells[i].classList.add('bad'); bad++; } });
          msg.textContent = bad ? 'Not those. Try again.' : (st.grid.includes(0) ? 'So far, so good. Fill the rest.' : '');
        } }, { text: 'Close', fn: close }]);
    const btns = c.querySelector('.g-btns');
  }
  const GRID_NOTE = 'The kettle goes on at the hour in the grey square. The clock in the hall runs a quarter of an hour slow. What does it say then?';

  /* ---------- the clock ---------- */
  function openClock() {
    let hh = 12, mm = 0, misses = 0;
    const t = el('div', 't', ''); const msg = el('p', 'g-msg', '');
    const show = () => { t.textContent = hh + ':' + String(mm).padStart(2, '0'); drawFace(hh, mm); };
    const col = (up, dn) => { const c = el('div', 'col'); const a = el('button', null, '+'), b = el('button', null, '−'); a.type = b.type = 'button'; a.addEventListener('click', up); b.addEventListener('click', dn); c.append(a, b); return c; };
    const wrap = el('div', 'g-clock');
    wrap.append(col(() => { hh = hh % 12 + 1; show(); }, () => { hh = (hh + 10) % 12 + 1; show(); }), t,
      col(() => { mm = (mm + 15) % 60; show(); }, () => { mm = (mm + 45) % 60; show(); }));
    show();
    card('THE CLOCK IN THE HALL', null, [GRID_NOTE, wrap, msg], [{ text: 'Set the clock', gold: true, fn: () => {
      if (hh === 3 && mm === 45) { ctx.psEvent(ctx.EV.GALLERY_CLOCK, 'right'); close(); finish(); return; }
      ctx.psEvent(ctx.EV.GALLERY_CLOCK, 'wrong'); ctx.playThud();
      misses++;
      msg.textContent = (hh === 4 && mm === 0) ? 'Right time. Wrong house.' : misses >= 2 ? 'A quarter of an hour slow: take fifteen minutes from the hour in the grey square.' : 'Not that. The kettle goes on at the hour in the grey square.';
    } }, { text: 'Close', fn: close }]);
    onClose = () => { if (!st.done) drawFace(...slowNow()); };
  }

  /* ---------- the ending: the pendulum door, the prints on the path, the bookmark ---------- */
  let pendAnim = null, turnAnim = null;
  function finish() {
    st.done = true; save(); renderScraps(); lastProgress = Date.now();
    ctx.psEvent(ctx.EV.GALLERY_DONE);
    ctx.playCreak(); pendAnim = { t: 0 };
    setTimeout(() => {
      winMat.map = winTexB; winMat.needsUpdate = true;
      // From the hall, follow the aisle past the end of the couch before turning to the window.
      ctx.moveTo(2.25, 2.15, () => {
        ctx.moveTo(2.6, -0.5, () => {
          turnAnim = { from: ctx.getView(), to: [-PI / 2, -0.05], t: 0, then: endCard };
        });
      });
    }, 1400);
  }
  let bookmarkURL = null, bookmarkCanvas = null, endShown = false;
  function bookmark() {
    if (bookmarkURL) return bookmarkURL;
    const c = document.createElement('canvas'); c.width = 600; c.height = 1800; const g = c.getContext('2d');
    g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, 600, 1800);
    g.strokeStyle = '#b8935a'; g.lineWidth = 10; g.strokeRect(30, 30, 540, 1740);
    g.fillStyle = '#8f8676'; g.beginPath(); g.ellipse(300, 420, 150, 90, -0.2, 0, PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(260, 390, 60, 26, -0.3, 0, PI * 2); g.fill();
    g.save(); g.translate(300, 700); g.rotate(-0.5); g.fillStyle = '#d7a43a'; g.fillRect(-180, -18, 330, 36); g.fillStyle = '#e9cfa2'; g.beginPath(); g.moveTo(150, -18); g.lineTo(210, 0); g.lineTo(150, 18); g.fill(); g.fillStyle = '#2b2218'; g.beginPath(); g.moveTo(195, -5); g.lineTo(210, 0); g.lineTo(195, 5); g.fill(); g.restore();
    g.strokeStyle = '#2b2218'; g.lineWidth = 18; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(200, 980); g.lineTo(270, 1060); g.lineTo(410, 870); g.stroke();
    g.fillStyle = '#2b2218'; g.textAlign = 'center'; g.font = 'italic 46px Georgia, serif';
    g.fillText('Slow down here.', 300, 1230); g.fillText('This is the good part.', 300, 1300);
    g.font = '30px Georgia, serif'; g.fillStyle = '#6b4d1f'; g.fillText('— the Keeper', 300, 1380);
    g.font = '28px Georgia, serif'; g.fillText('puzzlesecret.com', 300, 1700);
    bookmarkCanvas = c;
    try { bookmarkURL = c.toDataURL('image/png'); } catch (e) { bookmarkURL = ''; }
    return bookmarkURL;
  }
  function endCard() {
    const url = bookmark();
    const img = el('img', 'g-bm'); if (url) { img.src = url; img.alt = 'A bookmark: a stone, a pencil and a tick mark. Slow down here. This is the good part.'; }
    const saveBtn = url ? [{ text: 'Save the bookmark', gold: true, fn: () => {
      ctx.psEvent(ctx.EV.GALLERY_BOOKMARK);
      const fallback = () => { const a = document.createElement('a'); a.href = url; a.download = 'the-keepers-bookmark.png'; document.body.appendChild(a); a.click(); a.remove(); };
      if (!bookmarkCanvas || !bookmarkCanvas.toBlob) { fallback(); return; }
      bookmarkCanvas.toBlob((blob) => {
        if (!blob) { fallback(); return; }
        try {
          const file = new File([blob], 'the-keepers-bookmark.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'The Keeper’s bookmark' }).catch(() => {}); return; }
        } catch (e) { /* no File or share: download instead */ }
        const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'the-keepers-bookmark.png';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      }, 'image/png');
    } }] : [];
    const first = !endShown; endShown = true;
    card('THE PATH', 'You looked twice.', ['That is the whole trick. My study is through that door, when you have a word from inside a book.', ...(url ? [img, el('p', 'g-note', 'On an older phone, press and hold the bookmark to save it.')] : [])],
      [...saveBtn, { text: 'Close', fn: () => { close(); look(-1.5, 1.4, -3.9); } }]);
    if (first) ctx.burstConfetti();
  }

  /* ---------- the room list (walk to anything without steering) ---------- */
  const LIST = [
    ['Your gift', () => act('ggift', parcelHit)], ['Door to Vault I', () => act('gdoor', doorHit)],
    ['The window', () => act('gwindow', win)], ['The couch' + (st.found.includes('couch') ? ' ✓' : ''), () => act('gcouch', cparts[0])],
    ['The kettle' + (st.found.includes('kettle') ? ' ✓' : ''), () => act('gkettle', kettleHit)], ['The chair' + (st.found.includes('chair') ? ' ✓' : ''), () => act('gchair', chParts[0])],
    ['Volume 1', () => act('gframe', frames[1])], ['The shelf pictures', () => act('gframe', frames[2])],
    ['The clock (hall)', () => act('gclock', clockParts[0])], ['The radio (hall)', () => act('gradio', radio)],
    ['The Rock', () => act('grock', stoneHit)],
    ['By the front door', () => st.found.includes('floor') ? ctx.showCaption('You found the scrap by the front door.', 4500) : act('gscrap', ballHit)],
    ['The bookcase', () => act('gsay', bcParts[0])], ['The upside-down book', () => act('gupside', upside)],
    ['The pencil tin', () => act('gsay', lbParts[0])], ['The stove', () => act('gsay', sParts[0])],
    ['Leave the house', () => card('LEAVE THE HOUSE?', null, ['Back to the front page. Your scraps and the path stay as they are.'], [{ text: 'Leave', gold: true, fn: () => { close(); ctx.activate('exit', ctx.exitHit); } }, { text: 'Stay', fn: close }])],
  ];
  function openList() {
    const g = el('div', 'g-list');
    LIST.forEach(([label, fn]) => {
      const fixed = label.replace(/ ✓$/, '');
      const done = (fixed === 'The couch' && st.found.includes('couch')) || (fixed === 'The kettle' && st.found.includes('kettle')) || (fixed === 'The chair' && st.found.includes('chair')) || (fixed === 'By the front door' && st.found.includes('floor'));
      const b = el('button', null, fixed + (done ? ' ✓' : '')); b.type = 'button'; b.addEventListener('click', () => { close(); fn(); }); g.appendChild(b);
    });
    card('THE FRONT ROOM', null, [g]);
  }
  bGift.addEventListener('click', () => act('ggift', parcelHit));
  bDoor.addEventListener('click', () => act('gdoor', doorHit));
  bScraps.addEventListener('click', () => { if (st.gridSolved && !st.done) act('gclock', clockParts[0]); else if (st.done) endCard(); else openScrapsCard(); });
  bList.addEventListener('click', openList);

  /* ---------- what tapping things does ---------- */
  let onChair = false;
  function act(kind, obj) {
    const u = (obj && obj.userData) || {};
    switch (kind) {
      case 'grock': {
        if (!window.PSRock) { ctx.showCaption('The clock could not load. Please reload the Gallery.', 6000); return true; }
        // Inspecting the shelf from the list works even across the couch or the rug.
        onChair = false; ctx.setEye(1.6); ctx.moveTo(1.73, 3.08);
        player.pos.copy(player.target); look(1.75, 1.16, 3.76);
        document.body.classList.add('ps-rock-visit');
        window.PSRock.open({
          lift: passage.lift, openStairs: passage.openStairs, descend: passage.descend, walkTo: passage.walkTo, focusItem: passage.focusItem, returnToRoom: passage.returnToRoom,
          close: () => { passage.close(); document.body.classList.remove('ps-rock-visit'); bList.focus({ preventScroll: true }); }
        });
        return true;
      }
      case 'gdoor': ctx.goThen(-1.5, -2.95, () => { look(-1.5, 1.4, -3.9); ctx.openWordbox('first'); }); return true;
      case 'ggift': go(u, () => ctx.openReward('G')); return true;
      case 'gwindow': go(u, () => ctx.showCaption(st.done ? SAY.windowAfter : SAY.window, 6500)); return true;
      case 'gsay': go(u, () => ctx.showCaption(SAY[u.say] || '…', 6000)); return true;
      case 'gupside': go(u, () => { ctx.playThud(); card('INSIDE THE UPSIDE-DOWN BOOK', null, ['A slip of paper, in his hand:', el('p', 'g-title', nextHint() || 'Things in this house are not where they belong. Try the things I use every day.')]); }); return true;
      case 'gkettle': go(u, () => { if (st.found.includes('kettle')) ctx.showCaption(SAY.kettle, 5000); else { ctx.showCaption(SAY.kettle, 4000); foundScrap('kettle'); } }); return true;
      case 'gcouch': go(u, () => { if (st.found.includes('couch')) ctx.showCaption(SAY.couch, 5000); else { ctx.showCaption(SAY.couch, 4000); foundScrap('couch'); } }); return true;
      case 'gscrap': go(u, () => foundScrap('floor')); return true;
      case 'gchair':
        ctx.moveTo(CHAIR.x, CHAIR.z, () => {
          onChair = true; ctx.setEye(2.55); ctx.playCreak();
          ctx.setView(PI / 2 - 0.05, -0.75); tickMat.map = tickTex; tickMat.needsUpdate = true;
          ctx.showCaption(SAY.chair, 7000);
        });
        return true;
      case 'gfield': ctx.showCaption(onChair ? SAY.chair : SAY.field, 5000); return true;
      case 'gtick':
        if (!onChair) { ctx.showCaption(SAY.field, 5000); return true; }
        foundScrap('chair'); return true;
      case 'gframe': {
        const bk = BOOKS[u.idx]; if (!bk) return true;
        go(u, () => card(bk.kicker, null, [bk.text, ...(bk.sketch ? [el('p', 'g-note', TAG_LINE)] : [])],
          bk.link ? [{ text: bk.linkText, gold: true, href: bk.link, blank: true }, { text: 'Close', fn: close }] : undefined));
        return true;
      }
      case 'gclock': go(u, () => {
        if (st.gridSolved && !st.done) { ctx.showCaption(SAY.clock, 5000); openClock(); }
        else ctx.showCaption(st.done ? 'A quarter of an hour slow. Still. Thank you for not putting it right.' : SAY.clock, 7000);
      }); return true;
      case 'gradio': go(u, () => ctx.showCaption(SAY.radio, 6000)); return true;
    }
    return false;
  }

  function nextHint() {
    if (st.done) return '';
    const next = SCRAPS.find((s) => !st.found.includes(s.id));
    return next ? HINTS[next.id] : !st.gridSolved ? HINTS.grid : HINTS.clock;
  }

  /* ---------- per frame ---------- */
  let hintAt = 0;
  function tick(dt, t) {
    passage.tick();
    if (onChair && Math.hypot(player.pos.x - CHAIR.x, player.pos.z - CHAIR.z) > 0.35) { onChair = false; ctx.setEye(1.6); ctx.showCaption(SAY.chairDown, 2500); if (!st.found.includes('chair')) { tickMat.map = sheetTex; tickMat.needsUpdate = true; } }
    if (hud.hidden && ctx.isEntered && ctx.isEntered()) hud.hidden = false;
    parcelGlow.material.opacity = 0.25 + 0.15 * Math.sin(t * 2.2);
    doorGlow.material.opacity = 0.4 + 0.12 * Math.sin(t * 1.7);
    stoveLight.intensity = 10 * (0.9 + 0.12 * Math.sin(t * 7.1) + 0.06 * Math.sin(t * 13));
    if (pendAnim) { pendAnim.t += dt; pendHinge.rotation.y = -1.3 * Math.min(1, pendAnim.t / 1.2); if (pendAnim.t > 1.2) pendAnim = null; }
    if (turnAnim) {
      turnAnim.t += dt; const k = Math.min(1, turnAnim.t / 1.4), e = k * k * (3 - 2 * k);
      let dy = turnAnim.to[0] - turnAnim.from[0]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ctx.setView(turnAnim.from[0] + dy * e, turnAnim.from[1] + (turnAnim.to[1] - turnAnim.from[1]) * e);
      if (k >= 1) { const fn = turnAnim.then; turnAnim = null; setTimeout(fn, 1600); }
    }
    // a quiet hint after three minutes without progress, naming the next place
    const now = Date.now();
    if (!passage.below && !st.done && !(ctx.overlayOpen ? ctx.overlayOpen() : !overlay.hidden) && now - lastProgress > 180000 && now - hintAt > 180000) {
      hintAt = now;
      ctx.showCaption(nextHint(), 7000);
    }
  }

  return {
    get below(){return passage.below;},
    activate: (kind, obj) => act(kind, obj),
    tick,
    overlayOpen: () => !overlay.hidden || !!window.PSRock?.isOpen(),
    arrival: SAY.arrival,
  };
}
