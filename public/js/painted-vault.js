/* THE PAINTED VAULT — puzzlesecret.com/vault (default mode, 2026-09-02)
   A point-and-click vault built on Dan's approved concept paintings (study / library /
   treasure) plus a dark HTML sanctum for the fourth secret. Plain script, no three.js, no
   bundler: it is loaded on demand by FlatVault.astro and shares the page's overlays
   (#reward, #pageview, #wordbox, #carvebox, #confetti) with the 3D crawl.

   Laws (CLAUDE.md): no answer word may appear in this file or in any caption; rewards are
   never gated on reviews or email; no "win / prize" language; no new personal data. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const VAULT_KEY = 'ps_vaults_v1', STORY_KEY = 'ps_story_v1', TILE_KEY = 'ps_tiles_v1', ROOM_KEY = 'ps_room_state_v1';

  /* ================= the rooms ================= */
  // Coordinates are percentages of the 900x503 paintings (public/art/rooms/*.webp).
  const ROOMS = {
    I: {
      name: "VAULT I — THE WRITER'S STUDY", art: '/art/rooms/study.webp', amb: 'study', entry: 'entry',
      lights: [
        { x: 65, y: 43, r: 26, c: '255,186,84', a: 0.55, k: 1 },     // the candle
        { x: 53, y: 46, r: 20, c: '255,214,130', a: 0.5, k: 2 },     // the glowing stack
        { x: 31, y: 21, r: 14, c: '255,160,70', a: 0.45, k: 3 },     // the sconce
        { x: 46, y: 26, r: 16, c: '255,150,60', a: 0.35, k: 4 },     // the passage torch
      ],
      hots: [
        { id: 'stack', x: 53, y: 47, w: 13, h: 15, label: "Take the Keeper's gift", act: 'reward', arg: 'I' },
        { id: 'candle', x: 65, y: 44, w: 6, h: 13, label: 'A candle', act: 'candle' },
        { id: 'quill', x: 37, y: 47, w: 6, h: 11, label: 'Quill and ink', act: 'say', arg: 'quill' },
        { id: 'board', x: 60, y: 24, w: 17, h: 22, label: 'A pinboard of grids', act: 'say', arg: 'board' },
        { id: 'reject0', x: 27, y: 73, w: 5, h: 6, label: 'A crumpled page', act: 'draft', arg: 0 },
        { id: 'reject1', x: 60, y: 84, w: 6, h: 6, label: 'A crumpled page', act: 'draft', arg: 1 },
        { id: 'reject2', x: 17, y: 88, w: 6, h: 6, label: 'A crumpled page', act: 'draft', arg: 2 },
        { id: 'shelf', x: 85, y: 33, w: 10, h: 30, label: "The Keeper's shelves", act: 'say', arg: 'shelf' },
        { id: 'passage', x: 46, y: 26, w: 9, h: 24, label: 'A passage, deeper in', act: 'door', arg: 'door2' },
        { id: 'p1', page: 1, x: 31, y: 80, w: 6, h: 7 },
        { id: 'p4', page: 4, x: 36, y: 90, w: 7, h: 6 },
        { id: 'p7', page: 7, x: 84, y: 52, w: 6, h: 7 },
      ],
    },
    II: {
      name: 'VAULT II — THE LIBRARY OF PUZZLES', art: '/art/rooms/library.webp', amb: 'library', entry: 'libentry',
      lights: [
        { x: 24, y: 8, r: 16, c: '255,200,110', a: 0.5, k: 1 }, { x: 75, y: 8, r: 16, c: '255,200,110', a: 0.5, k: 2 },
        { x: 38, y: 27, r: 12, c: '255,190,100', a: 0.4, k: 3 }, { x: 62, y: 27, r: 12, c: '255,190,100', a: 0.4, k: 4 },
        { x: 50, y: 46, r: 14, c: '255,170,80', a: 0.5, k: 5 },   // the doorway beyond
      ],
      hots: [
        { id: 'lectern', x: 68, y: 55, w: 13, h: 18, label: "The Keeper's second gift", act: 'reward', arg: 'II' },
        { id: 'discs', x: 25, y: 25, w: 12, h: 12, label: 'Cipher discs', act: 'say', arg: 'discs' },
        { id: 'cryptex', x: 25, y: 43, w: 12, h: 10, label: 'A cryptex', act: 'say', arg: 'cryptex' },
        { id: 'enigma', x: 78, y: 42, w: 14, h: 10, label: 'Cipher machines', act: 'say', arg: 'enigma' },
        { id: 'boxes', x: 80, y: 25, w: 12, h: 11, label: 'Puzzle boxes', act: 'say', arg: 'boxes' },
        { id: 'shelves', x: 52, y: 18, w: 16, h: 16, label: "The Keeper's Round — a game in the dark", act: 'game', arg: 'round' },
        { id: 'doorway', x: 50, y: 45, w: 8, h: 20, label: 'The doorway beyond', act: 'door', arg: 'door3' },
        { id: 'p2', page: 2, x: 20, y: 64, w: 8, h: 7 },
        { id: 'p5', page: 5, x: 85, y: 64, w: 8, h: 7 },
        { id: 'p8', page: 8, x: 60, y: 88, w: 7, h: 7 },
      ],
    },
    III: {
      name: 'VAULT III — THE GRAND TREASURE VAULT', art: '/art/rooms/treasure.webp', amb: 'treasure', entry: 'v3entry',
      lights: [
        { x: 33, y: 33, r: 15, c: '255,160,60', a: 0.5, k: 1 }, { x: 79, y: 34, r: 15, c: '255,160,60', a: 0.5, k: 2 },
        { x: 72, y: 63, r: 16, c: '255,200,110', a: 0.45, k: 3 }, { x: 36, y: 66, r: 14, c: '255,200,110', a: 0.35, k: 4 },
        { x: 59, y: 32, r: 22, c: '200,190,255', a: 0.18, k: 5 },  // the seals
      ],
      hots: [
        { id: 'chestR', x: 72, y: 62, w: 15, h: 18, label: 'The Grand Vault — claim it all', act: 'reward', arg: 'III' },
        { id: 'chestL', x: 36, y: 65, w: 15, h: 18, label: 'A locked chest — listen to it', act: 'game', arg: 'lock' },
        { id: 'seals', x: 59, y: 32, w: 32, h: 16, label: 'Four seals — the hunt continues', act: 'say', arg: 'seals' },
        { id: 'ledgers', x: 44, y: 49, w: 10, h: 8, label: 'Ledgers on a pedestal', act: 'say', arg: 'ledgers' },
        { id: 'smallchest', x: 64, y: 47, w: 9, h: 9, label: 'A small chest, open', act: 'say', arg: 'smallchest' },
        { id: 'cryptex3', x: 68, y: 80, w: 10, h: 7, label: 'A fallen cryptex', act: 'say', arg: 'cryptex3' },
        { id: 'gems', x: 39, y: 82, w: 8, h: 6, label: 'Gems in four colours', act: 'say', arg: 'gems' },
        { id: 'unlit', x: 29, y: 62, w: 5, h: 8, label: 'Something unlit… waiting', act: 'fourth', draw: 'unlit' },
        { id: 'p3', page: 3, x: 30, y: 87, w: 7, h: 6 },
        { id: 'p6', page: 6, x: 56, y: 85, w: 7, h: 6 },
        { id: 'p9', page: 9, x: 20, y: 85, w: 7, h: 6 },
      ],
    },
    IV: {
      name: 'VAULT IV — THE SECRET SANCTUM', art: '/art/rooms/sanctum.webp', amb: 'sanctum', entry: 'sanctum',
      lights: [
        { x: 50, y: 33, r: 24, c: '255,190,90', a: 0.6, k: 1 },      // the lamp, lit
        { x: 50, y: 57, r: 11, c: '255,214,130', a: 0.45, k: 2 },    // the tome
      ],
      hots: [
        { id: 'tome', x: 50, y: 57, w: 11, h: 11, label: 'The master reward', act: 'reward', arg: 'IV' },
        { id: 'lamp', x: 50, y: 33, w: 8, h: 16, label: 'The lamp, lit', act: 'say', arg: 'lamp' },
        { id: 'plaque', x: 19, y: 41, w: 17, h: 40, label: "The Keeper's register", act: 'register' },
        { id: 'parch', x: 81, y: 40, w: 15, h: 42, label: "The Keeper's three letters", act: 'letters' },
        { id: 'easel', x: 33, y: 63, w: 20, h: 38, label: 'Something half-covered on an easel', act: 'say', arg: 'chart' },
        { id: 'stair4', x: 65, y: 55, w: 12, h: 34, label: 'The stair, back up', act: 'stair' },
      ],
    },
  };
  const ORDER = ['I', 'II', 'III', 'IV'];
  const DOORS = { first: { act: 'I', kicker: 'THE FIRST WORD', vo: 'first' }, door2: { act: 'II', kicker: 'THE SECOND DOOR', vo: 'door2' }, door3: { act: 'III', kicker: 'THE THIRD DOOR', vo: 'door3' }, fourth: { act: 'IV', kicker: 'THE FOURTH SECRET', vo: 'fourth' } };
  const DOOR_FOR_ACT = { I: 'first', II: 'door2', III: 'door3', IV: 'fourth' };
  const REWARD_KEY = 'ps_rewards_v1';
  function rewardsHeld() { return store.get(REWARD_KEY, {}) || {}; }
  function holdReward(act, url) { if (!url) return; const r = rewardsHeld(); r[act] = url; store.set(REWARD_KEY, r); }

  // The Keeper's spoken lines (recorded) — same map the 3D crawl uses. Captions ship in page
  // source, so none of them may ever contain an answer word.
  const VO = {
    entry:    { file: '/audio/vo/vo_vault1_entry.wav',   text: 'So… you found my first word. Take what the first door guarded.' },
    first:    { file: '/audio/vo/vo_scene0_entry.wav',   text: 'Two hundred puzzles… and hidden among them, a single word. If you found my first, speak it now — the vault is listening.' },
    reward1:  { file: '/audio/vo/vo_vault1_reward.wav',  text: 'Fifty puzzles, yours — no word, no name, no price. The first door is open.' },
    door2:    { file: '/audio/vo/vo_vault2_door.wav',    text: "The fire took my second plate. But you read my letter anyway… didn't you? Say the word." },
    libentry: { file: '/audio/vo/vo_lib_entry.wav',      text: 'My library. Every puzzle I ever loved… and a hundred more, waiting at the stand.' },
    reward2:  { file: '/audio/vo/vo_vault2_reward.wav',  text: 'One hundred more. My letter chose its reader well.' },
    door3:    { file: '/audio/vo/vo_vault3_door.wav',    text: 'Step back three… and step inside.' },
    v3entry:  { file: '/audio/vo/vo_v3_entry.wav',       text: 'The heart of my vault. Everything here was locked by a puzzle… and opened by one.' },
    finale:   { file: '/audio/vo/vo_vault3_finale.wav',  text: 'Three words, three doors — and you spoke them all. The vault is yours… but a Keeper always keeps one secret more.' },
    fourth:   { file: '/audio/vo/vo_fourth.wav',         text: 'What flickers at the start of every thought?' },
    sanctum:  { file: '/audio/vo/vo_landing_success4.wav', text: 'So — you heard the whole of it.' },
    fail1:    { file: '/audio/vo/vo_fail_1.wav',         text: 'That is not the word I sealed it with.' },
    fail2:    { file: '/audio/vo/vo_fail_2.wav',         text: 'Close… or not close at all. I will never tell.' },
    fail3:    { file: '/audio/vo/vo_fail_3.wav',         text: 'Stubborn. Good — but perhaps you need my hints.' },
    page1: { file: '/audio/vo/vo_page1.wav', text: 'I was not always a keeper of vaults. I was a maker of puzzles, and a poor one, in a room exactly this size.' },
    page2: { file: '/audio/vo/vo_page2.wav', text: 'My first hundred were rubbish. I burned them. My second hundred were worse, so I kept those — a man should remember what bad work looks like.' },
    page3: { file: '/audio/vo/vo_page3.wav', text: 'The trouble with a good puzzle is that it ends. You solve it, you set it down, and the solving is gone forever. I wanted one that kept going.' },
    page4: { file: '/audio/vo/vo_page4.wav', text: 'So I began hiding a second puzzle inside the first. A number here. A shaded square there. Nothing a solver would notice — until they noticed everything.' },
    page5: { file: '/audio/vo/vo_page5.wav', text: 'They told me no one would look. They were right, mostly. But “mostly” is a wonderful word. It leaves a door open.' },
    page6: { file: '/audio/vo/vo_page6.wav', text: 'I built this vault for the ones who look twice. Everything in it was locked by a puzzle, and every lock was made to be opened — eventually, by somebody stubborn.' },
    page7: { file: '/audio/vo/vo_page7.wav', text: 'A confession: I hid one more thing than I ever announced. Not in the grids. In the letters. In the way a sentence begins.' },
    page8: { file: '/audio/vo/vo_page8.wav', text: 'Read the openings. That is all the help I will give, and it is more than I gave anyone else.' },
    page9: { file: '/audio/vo/vo_page9.wav', text: 'If you are reading this, you did not simply solve my book. You searched it. That is the rarer thing, and this vault knows the difference.' },
    pagefinal: { file: '/audio/vo/vo_pagefinal.wav', text: 'Nine pages, and you found every one. Most never look up from the grid. So here is the truth of it: the puzzles were never the secret. The looking was.' },
  };
  // Silent lines (no recording exists; the caption carries them — never browser TTS).
  const SAY = {
    quill: 'Every puzzle I ever set began with that nib. Most of them ended in the fire.',
    board: 'Two hundred grids, pinned and re-pinned. Twenty were never quite what they seemed.',
    reject: 'A second attempt. I keep my failures where I can see them.',
    shelf: 'Books I solved, and books I never will. A keeper collects both.',
    candleOut: 'Snuffed. The dark is patient.',
    candleOn: 'Lit again. Better.',
    discs: 'Cipher discs. Older than I am, and every bit as stubborn.',
    cryptex: 'A cryptex. Five rings, one word, and no forgiveness for a wrong letter.',
    enigma: 'Machines that kept secrets for a living. I learned from the best of them.',
    boxes: 'Puzzle boxes. Every one of them opens. Not every one opens for you.',
    seals: 'Four seals. Four secrets still to come — the hunt continues beyond this vault.',
    ledgers: 'The ledgers of every vault I ever sealed. Yours is the newest entry.',
    smallchest: 'Empty. Whoever was here before you was quick.',
    cryptex3: 'Dropped by someone in a hurry. I never did learn what it said.',
    gems: 'Gems in four colours. You will understand why, in time.',
    doorShut: 'That way is sealed. Speak its word, and it will open.',
    stair: 'A stair, cut long before this vault was sealed. Go down — and come back up when you please.',
    chart: "Under the cloth, a chart still being drawn — The Corsair's Chart. Volume II. The hunt is not over.",
    letters: 'The secret you cracked, laid bare: one gilded letter at the start of every thought. Read them down.',
    lamp: 'What was never lit, burning. You did that.',
    registerMine: 'Your mark is on this wall.',
    tileII: "A key-tile — one shaded square from the Keeper's own set. One of two.",
    tileIII: 'The second key-tile. Two of two — the Keeper’s Mark is yours, on your certificate.',
    cert: 'Your certificate is ready. You will find it on your passport.',
  };
  const PAGE_WORDS = {};
  for (let i = 1; i <= 9; i++) PAGE_WORDS[i] = VO['page' + i].text;
  const FINAL_LETTER = VO.pagefinal.text + ' Keep the habit. I have hidden another chart, another seam, another door. The Corsair’s Chart is already being drawn, and it will not be kinder than this one. — The Keeper';
  const NUM_WORD = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const REWARDS = {
    I:   { kicker: "THE KEEPER'S FIRST GIFT", title: 'FIFTY PUZZLES, YOURS', text: "No name, no price. Fifty easy puzzles from the Keeper's own desk — the first door is open.", btn: 'Download the 50 puzzles (PDF)', vo: 'reward1' },
    II:  { kicker: 'THE SECOND GIFT', title: 'ONE HUNDRED MORE', text: 'A hundred medium puzzles, bound for the readers of my letter. The library approves of you.', btn: 'Download the 100 puzzles (PDF)', vo: 'reward2' },
    III: { kicker: 'THE GRAND VAULT IS YOURS', title: 'TWO HUNDRED — AND THE HUNT GOES ON', text: 'Two hundred hard puzzles, the deepest hoard. And on the wall behind you… four seals, four secrets still to come.', btn: 'Download the 200 puzzles (PDF)', vo: 'finale', ask: true },
    IV:  { kicker: "THE KEEPER'S SECRET SANCTUM", title: 'TWENTY MASTER PUZZLES', text: "You found what was never lit, and decoded what was never written. Twenty master puzzles from the Keeper's private collection.", btn: 'Download the 20 Master Puzzles (PDF)', vo: 'sanctum', ask: true },
  };
  // The acrostic, as SEPARATE capitals — the answer never exists as a string in this file.
  const ACROSTIC = [
    ['L', 'ong before this vault was ever sealed,'], ['A', ' puzzle, I always believed, should not end.'],
    ['N', 'ever did I make an easy thing look hard.'], ['T', 'hose who look twice will always find more.'],
    ['E', 'very shaded square was a choice, not chance.'], ['R', 'emember this: the looking was the secret.'],
    ['N', 'ow you hold what almost no one ever will.'],
  ];

  /* ================= state ================= */
  let room = null, opened = store.get(VAULT_KEY, {}) || {};
  let pagesFound = store.get(STORY_KEY, []) || [];
  let tiles = store.get(TILE_KEY, {}) || {};
  let roomState = store.get(ROOM_KEY, {}) || {};
  const sessionDoors = (() => { try { return JSON.parse(sessionStorage.getItem('ps_doors_ok') || '{}'); } catch (e) { return {}; } })();
  function doorOpen(act) { return act === 'I' || !!opened[act] || !!sessionDoors[act]; }
  function markDoor(act) { sessionDoors[act] = 1; try { sessionStorage.setItem('ps_doors_ok', JSON.stringify(sessionDoors)); } catch (e) {} }
  function stampVault(act) { if (!opened[act]) { opened[act] = new Date().toISOString().slice(0, 10); store.set(VAULT_KEY, opened); } }
  function psVid() {
    try {
      let v = localStorage.getItem('ps_vid');
      if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('ps_vid', v); }
      return v;
    } catch (e) { return ''; }
  }

  /* ================= audio: ambience + the door's voice (ported from the crawl) ================= */
  let actx = null, master = null, ambient = null, audioReady = false, muted = false, ambRoom = 'study';
  function initAudio() {
    if (audioReady) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    actx = new AC(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(actx.destination); audioReady = true;
  }
  function noiseSrc(ctx) { const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }
  function buildAmbience(ctx, dest) {
    const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(dest);
    const noise = noiseSrc(ctx);
    const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 145; bp1.Q.value = 5.5;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 410; bp2.Q.value = 9;
    const roomG = ctx.createGain(); roomG.gain.value = 0.05;
    noise.connect(bp1); bp1.connect(roomG); noise.connect(bp2); bp2.connect(roomG); roomG.connect(bus);
    const wander = ctx.createOscillator(); wander.type = 'sine'; wander.frequency.value = 0.045;
    const wG = ctx.createGain(); wG.gain.value = 60; wander.connect(wG); wG.connect(bp2.frequency);
    const noise2 = noiseSrc(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
    const airG = ctx.createGain(); airG.gain.value = 0.012; noise2.connect(lp); lp.connect(airG); airG.connect(bus);
    const breath = ctx.createOscillator(); breath.type = 'sine'; breath.frequency.value = 0.07;
    const bG = ctx.createGain(); bG.gain.value = 0.008; breath.connect(bG); bG.connect(airG.gain);
    const rum = ctx.createOscillator(); rum.type = 'sine'; rum.frequency.value = 33;
    const rumG = ctx.createGain(); rumG.gain.value = 0.025; rum.connect(rumG); rumG.connect(bus);
    const dripBus = ctx.createGain(); dripBus.gain.value = 0.3; dripBus.connect(bus);
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.34;
    const dlLp = ctx.createBiquadFilter(); dlLp.type = 'lowpass'; dlLp.frequency.value = 1300;
    const fb = ctx.createGain(); fb.gain.value = 0.4;
    dripBus.connect(dl); dl.connect(dlLp); dlLp.connect(fb); fb.connect(dl); dlLp.connect(bus);
    function spawnDrip(t) {
      const p = 480 + Math.random() * 1300;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(p * 2.7, t); o.frequency.exponentialRampToValueAtTime(p, t + 0.05);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24 + Math.random() * 0.16, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      o.connect(g);
      if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(dripBus); } else g.connect(dripBus);
      o.start(t); o.stop(t + 0.25);
    }
    const crackG = ctx.createGain(); crackG.gain.value = 0; crackG.connect(bus);
    function spawnCrack(t) {
      const len = Math.floor(ctx.sampleRate * 0.025), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
      const s = ctx.createBufferSource(); s.buffer = b;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 2500;
      const g = ctx.createGain(); g.gain.value = 0.25 + Math.random() * 0.5;
      s.connect(hp); hp.connect(g); g.connect(crackG); s.start(t);
    }
    const shimG = ctx.createGain(); shimG.gain.value = 0; shimG.connect(bus);
    function spawnShimmer(t) {
      [2600, 3920].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + Math.random() * 0.01);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(shimG); o.start(t); o.stop(t + 1.2);
      });
    }
    noise.start(); noise2.start(); wander.start(); breath.start(); rum.start();
    const PROFILES = {
      study:    { room: 0.045, air: 0.008, drip: 0.2, rum: 0.018, crack: 0.05, shim: 0 },
      library:  { room: 0.035, air: 0.01, drip: 0.2, rum: 0.022, crack: 0, shim: 0 },
      treasure: { room: 0.05, air: 0.012, drip: 0.5, rum: 0.04, crack: 0, shim: 0.9 },
      sanctum:  { room: 0.03, air: 0.006, drip: 0.35, rum: 0.05, crack: 0.03, shim: 0.4 },
    };
    function setRoom(key, tc = 1.6) {
      const p = PROFILES[key] || PROFILES.study, t = ctx.currentTime;
      roomG.gain.setTargetAtTime(p.room, t, tc); airG.gain.setTargetAtTime(p.air, t, tc); dripBus.gain.setTargetAtTime(p.drip, t, tc);
      rumG.gain.setTargetAtTime(p.rum, t, tc); crackG.gain.setTargetAtTime(p.crack, t, tc); shimG.gain.setTargetAtTime(p.shim, t, tc);
    }
    return { bus, setRoom, spawnDrip, spawnCrack, spawnShimmer };
  }
  function startAmbient() {
    if (!audioReady || ambient) return;
    ambient = buildAmbience(actx, master);
    ambient.setRoom(ambRoom, 0.4);
    ambient.bus.gain.linearRampToValueAtTime(0.85, actx.currentTime + 3);
    (function dripLoop() { if (!ambient) return; if (actx.state === 'running') ambient.spawnDrip(actx.currentTime + 0.05); setTimeout(dripLoop, 2200 + Math.random() * 5600); })();
    (function crackLoop() { if (!ambient) return; if (actx.state === 'running' && (ambRoom === 'study' || ambRoom === 'sanctum')) ambient.spawnCrack(actx.currentTime + 0.02); setTimeout(crackLoop, 90 + Math.random() * 480); })();
    (function shimLoop() { if (!ambient) return; if (actx.state === 'running' && ambRoom === 'treasure') ambient.spawnShimmer(actx.currentTime + 0.05); setTimeout(shimLoop, 14000 + Math.random() * 18000); })();
  }
  function setAmbRoom(k) { ambRoom = k; if (ambient) ambient.setRoom(k); }
  function playBoom(gain = 1) {
    if (!audioReady || muted) return;
    const t = actx.currentTime;
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const og = actx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.7 * gain, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0006, t + 0.9);
    o.connect(og).connect(master); o.start(t); o.stop(t + 1.0);
    const n = actx.sampleRate * 0.25, cb = actx.createBuffer(1, n, actx.sampleRate), cd = cb.getChannelData(0);
    for (let i = 0; i < n; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const cs = actx.createBufferSource(); cs.buffer = cb;
    const cf = actx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 900; cf.Q.value = 0.9;
    const cg = actx.createGain(); cg.gain.setValueAtTime(0.5 * gain, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    cs.connect(cf).connect(cg).connect(master); cs.start(t);
    [740, 1180, 1980].forEach((f, i) => {
      const ro = actx.createOscillator(); ro.type = 'triangle'; ro.frequency.value = f;
      const rg = actx.createGain(); rg.gain.setValueAtTime(0.0001, t + 0.01); rg.gain.exponentialRampToValueAtTime(0.06 * gain / (i + 1), t + 0.03); rg.gain.exponentialRampToValueAtTime(0.0005, t + 0.5 + i * 0.08);
      ro.connect(rg).connect(master); ro.start(t + 0.01); ro.stop(t + 0.7);
    });
  }
  function playUnlock() {
    if (!audioReady || muted) return;
    const t = actx.currentTime;
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.5);
    const og = actx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0008, t + 1.3);
    o.connect(og).connect(master); o.start(t); o.stop(t + 1.4);
    [130.81, 196.0, 261.63].forEach((f) => {
      const osc = actx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
      const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(0.07, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.3);
      osc.connect(g).connect(master); osc.start(t + 0.05); osc.stop(t + 2.4);
    });
  }
  function playThud(f0 = 90, f1 = 50, vol = 0.4, dur = 0.4) {
    if (!audioReady || muted) return;
    const t = actx.currentTime;
    const o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function playTick(strength = 0.3, pitch = 1800) {   // the lock's tick — sharper and louder as you near the number
    if (!audioReady || muted) return;
    const t = actx.currentTime;
    const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = pitch;
    const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = pitch * 1.4; f.Q.value = 4;
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02 + 0.12 * strength, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035 + 0.04 * strength);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.1);
  }
  function playChime(n = 0) {
    if (!audioReady || muted) return;
    const t = actx.currentTime, base = [523.25, 659.25, 783.99, 1046.5, 1318.5][n % 5];
    [1, 1.5].forEach((m, i) => {
      const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = base * m;
      const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1);
    });
  }
  function playCreak(L = 1.6) {
    if (!audioReady || muted) return;
    const t = actx.currentTime, noise = noiseSrc(actx);
    const bf = actx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 6; bf.frequency.setValueAtTime(160, t); bf.frequency.linearRampToValueAtTime(90, t + L);
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.15); g.gain.linearRampToValueAtTime(0.1, t + L * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + L);
    noise.connect(bf).connect(g).connect(master); noise.start(t); noise.stop(t + L + 0.1);
  }
  function setMuted(m) {
    muted = m;
    if (currentVO) { try { currentVO.pause(); } catch (e) {} }
    if (master && actx) master.gain.setTargetAtTime(m ? 0 : 0.9, actx.currentTime, 0.03);
    if (actx) { if (m) actx.suspend(); else actx.resume(); }
    const b = $('pvMute'); if (b) { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(m)); }
  }

  /* ---- the Keeper: one recorded voice; captions always ---- */
  const VO_PLAYERS = {}; let voUnlocked = false, currentVO = null, capTimer = null;
  for (const [k, line] of Object.entries(VO)) { const a = new Audio(line.file + '?v=3'); a.preload = 'auto'; a.volume = 0.95; VO_PLAYERS[k] = a; }
  function unlockVO() {
    if (voUnlocked) return; voUnlocked = true;
    Object.values(VO_PLAYERS).forEach((a) => { a.muted = true; const p = a.play(); if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); else a.muted = false; });
  }
  function caption(text, holdMs = 6000) {
    const c = $('pvCap'), t = $('pvCapText'); if (!c || !t) return;
    t.textContent = text; c.classList.add('show'); clearTimeout(capTimer);
    capTimer = setTimeout(() => c.classList.remove('show'), holdMs);
  }
  function keeper(key, hold = 6500) {
    const line = VO[key]; if (!line) return;
    caption(line.text, hold);
    if (muted) return;
    if (currentVO) { try { currentVO.pause(); } catch (e) {} }
    const a = VO_PLAYERS[key]; try { a.currentTime = 0; } catch (e) {}
    a.play().then(() => { currentVO = a; }).catch(() => { /* the caption carries it */ });
  }
  function say(key, hold = 5600) { const t = SAY[key]; if (t) caption(t, hold); }
  function silenceAll() { try { if (currentVO) currentVO.pause(); } catch (e) {} try { if (actx && actx.state === 'running') actx.suspend(); } catch (e) {} }
  addEventListener('pagehide', silenceAll); addEventListener('beforeunload', silenceAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) silenceAll(); else if (!muted && actx && actx.state === 'suspended') actx.resume(); });

  /* ================= the stage ================= */
  const AR = 900 / 503;
  const els = {};
  function grab() { ['pv', 'pvStage', 'pvRoom', 'pvArt', 'pvWarm', 'pvLights', 'pvMotes', 'pvHots', 'pvSanctum', 'pvGlow', 'pvDark', 'pvTitle', 'pvStrip', 'pvVerb', 'pvGate', 'pvGame', 'pvMute', 'pvReveal', 'pvHint'].forEach((k) => { els[k] = $(k); }); }
  let pan = 0, panMax = 0, panTarget = 0, autoPan = 1;
  function sizeRoom() {
    const st = els.pvStage; if (!st) return;
    const W = st.clientWidth, H = st.clientHeight;
    let w = W, h = W / AR;
    if (h < H) { h = H; w = H * AR; }           // cover
    const r = els.pvRoom; r.style.width = w + 'px'; r.style.height = h + 'px';
    r.style.top = ((H - h) / 2) + 'px';
    panMax = Math.max(0, (w - W) / 2);
    pan = Math.max(-panMax, Math.min(panMax, pan));
    r.style.left = ((W - w) / 2 + pan) + 'px';
    els.pv.classList.toggle('pannable', panMax > 8);
  }
  function setPan(p) { pan = Math.max(-panMax, Math.min(panMax, p)); const st = els.pvStage; const W = st.clientWidth, w = els.pvRoom.clientWidth; els.pvRoom.style.left = ((W - w) / 2 + pan) + 'px'; }

  /* ---- living light: pools that breathe (two incommensurate sines + a rare gutter) ---- */
  let lightEls = [], gutter = 0, gutterT = 0;
  function buildLights(R) {
    els.pvLights.innerHTML = ''; lightEls = [];
    (R.lights || []).forEach((L) => {
      const d = document.createElement('i'); d.className = 'pv-pool';
      d.style.left = L.x + '%'; d.style.top = L.y + '%'; d.style.width = (L.r * 2) + '%'; d.style.height = (L.r * 2 * AR) + '%';
      d.style.background = `radial-gradient(closest-side, rgba(${L.c},${L.a}), rgba(${L.c},${L.a * 0.45}) 35%, transparent 72%)`;
      els.pvLights.appendChild(d); lightEls.push({ el: d, k: L.k, a: L.a });
    });
    // motes live in the strongest light
    els.pvMotes.innerHTML = '';
    if (!REDUCED && R.lights && R.lights[0]) {
      const L = R.lights[0];
      els.pvMotes.style.left = (L.x - L.r) + '%'; els.pvMotes.style.top = (L.y - L.r * AR) + '%';
      els.pvMotes.style.width = (L.r * 2) + '%'; els.pvMotes.style.height = (L.r * 2 * AR) + '%';
      for (let i = 0; i < 14; i++) { const m = document.createElement('i'); m.style.setProperty('--m', i); m.style.left = (5 + Math.random() * 90) + '%'; els.pvMotes.appendChild(m); }
    }
  }
  let rafOn = false, t0 = performance.now();
  function tickLights(now) {
    if (!rafOn) return;
    const t = (now - t0) / 1000;
    if (t > gutterT) { gutter = 1; gutterT = t + 6 + Math.random() * 14; }
    gutter *= 0.94;
    let sum = 0;
    lightEls.forEach((L) => {
      const f = 0.86 + 0.09 * Math.sin(t * 3.1 + L.k * 1.7) + 0.05 * Math.sin(t * 7.7 + L.k * 0.9) - 0.35 * gutter * (L.k === 1 ? 1 : 0.3);
      L.el.style.opacity = String(Math.max(0.15, f));
      sum += f;
    });
    if (els.pvWarm && lightEls.length) els.pvWarm.style.opacity = String(0.18 + 0.05 * (sum / lightEls.length - 0.86));
    requestAnimationFrame(tickLights);
  }
  function startLights() { if (rafOn || REDUCED) { if (REDUCED) lightEls.forEach((L) => { L.el.style.opacity = '0.9'; }); return; } rafOn = true; requestAnimationFrame(tickLights); }

  /* ---- parallax + the cursor light (fine pointers only) ---- */
  let px = 0, py = 0;
  function onMove(e) {
    const st = els.pvStage, r = st.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width * 2 - 1; py = (e.clientY - r.top) / r.height * 2 - 1;
    if (!REDUCED) { els.pvArt.style.transform = `translate(${-px * 1.1}%, ${-py * 0.8}%)`; els.pvLights.style.transform = `translate(${-px * 0.5}%, ${-py * 0.35}%)`; }
    els.pvGlow.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    if (round.on) { els.pvDark.style.setProperty('--lx', (e.clientX - r.left) + 'px'); els.pvDark.style.setProperty('--ly', (e.clientY - r.top) + 'px'); }
    // proximity: the nearest object wakes up
    let best = null, bd = 1e9;
    hotEls.forEach((h) => {
      const b = h.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(b.width, b.height) / 2;
      if (d < bd) { bd = d; best = h; }
    });
    hotEls.forEach((h) => h.classList.toggle('near', h === best && bd < 110));
  }

  /* ---- hotspots ---- */
  let hotEls = [];
  function buildHots(R, key) {
    els.pvHots.innerHTML = ''; hotEls = [];
    (R.hots || []).forEach((h) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pv-hot' + (h.page ? ' page' : '') + (h.draw ? ' draw-' + h.draw : '');
      const w = h.w || 6, hh = h.h || 7;
      b.style.left = (h.x - w / 2) + '%'; b.style.top = (h.y - hh / 2) + '%'; b.style.width = w + '%'; b.style.height = hh + '%';
      const label = h.page ? 'A page in the Keeper’s hand' : h.label;
      b.setAttribute('aria-label', label); b.dataset.label = label; b.dataset.id = h.id;
      if (h.page && pagesFound.includes(h.page)) b.classList.add('read');
      if (h.id === 'candle' && roomState.candle === 'out') b.classList.add('out');
      if (h.act === 'door') b.classList.toggle('sealed', !doorOpen(DOORS[h.arg].act));
      if (h.act === 'game' && tiles[h.arg === 'round' ? 'II' : 'III']) b.classList.add('done');
      b.addEventListener('click', (e) => { e.stopPropagation(); activate(h, b); });
      b.addEventListener('mouseenter', () => { els.pvVerb.textContent = label; els.pv.classList.add('hold'); });
      b.addEventListener('mouseleave', () => { els.pvVerb.textContent = ''; els.pv.classList.remove('hold'); });
      b.addEventListener('focus', () => { els.pvVerb.textContent = label; });
      b.addEventListener('blur', () => { els.pvVerb.textContent = ''; });
      els.pvHots.appendChild(b); hotEls.push(b);
    });
  }

  /* ---- entering a room ---- */
  let travelling = false;
  function enterRoom(key, opts = {}) {
    if (travelling) return; travelling = true;
    const R = ROOMS[key], first = !room;
    els.pvStage.classList.add('fade');
    setTimeout(() => {
      room = key;
      els.pvTitle.textContent = R.name;
      els.pvArt.src = R.art;
      buildLights(R); buildHots(R, key); renderStrip();
      pan = 0; sizeRoom();
      setAmbRoom(key === 'IV' ? 'sanctum' : R.amb);
      els.pvStage.classList.remove('fade');
      travelling = false;
      if (!opts.quiet) setTimeout(() => keeper(R.entry), first ? 900 : 500);
      startLights();
      if (key === 'IV') fetchWall();
    }, first ? 60 : 650);
  }
  function renderStrip() {
    const s = els.pvStrip; s.innerHTML = '';
    ORDER.forEach((k) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pv-rn' + (k === room ? ' here' : '') + (doorOpen(k) ? ' open' : ' sealed');
      if (k === 'IV' && !doorOpen('IV')) { b.classList.add('hidden4'); b.setAttribute('aria-hidden', 'true'); b.tabIndex = -1; }
      b.textContent = k; b.title = doorOpen(k) ? ROOMS[k].name : 'Sealed — speak its word';
      b.addEventListener('click', () => {
        if (k === room) return;
        if (doorOpen(k)) enterRoom(k);
        else openWordbox(k === 'II' ? 'door2' : k === 'III' ? 'door3' : 'fourth');
      });
      s.appendChild(b);
    });
    const pp = document.createElement('a'); pp.href = '/passport'; pp.className = 'pv-pass'; pp.textContent = '✦ passport'; s.appendChild(pp);
  }

  /* ---- what clicking things does ---- */
  function activate(h, b) {
    if (h.page) { openPage(h.page, b); return; }
    switch (h.act) {
      case 'reward': openReward(h.arg); break;
      case 'say': say(h.arg); playThud(70, 45, 0.12, 0.2); break;
      case 'candle': {
        const out = !b.classList.contains('out'); b.classList.toggle('out', out);
        roomState.candle = out ? 'out' : 'on'; store.set(ROOM_KEY, roomState);
        const L = lightEls[0]; if (L) { L.a = out ? 0.06 : 0.55; L.el.style.display = out ? 'none' : ''; }
        say(out ? 'candleOut' : 'candleOn'); playThud(120, 60, out ? 0.15 : 0.25, 0.15);
        break;
      }
      case 'door': {
        const D = DOORS[h.arg];
        if (doorOpen(D.act)) { playCreak(1.2); setTimeout(() => enterRoom(D.act), 250); }
        else openWordbox(h.arg);
        break;
      }
      case 'fourth': if (doorOpen('IV')) { enterRoom('IV'); } else openWordbox('fourth'); break;
      case 'game': if (h.arg === 'round') startRound(); else openLock(); break;
      case 'register': openRegister(); break;
      case 'draft': openDraft(h.arg); break;
      case 'letters': openLetters(); break;
      case 'stair': say('stair', 4000); playCreak(1.2); setTimeout(() => enterRoom('III'), 700); break;
    }
  }

  /* ---- rewards (shared #reward panel) ---- */
  const rewardsGiven = {};
  function openReward(act) {
    const held = rewardsHeld()[act];
    if (!held) { caption(act === 'I' ? 'Speak my first word, and the gift is yours.' : 'Speak this vault’s word first — the gift is kept for those who did.', 5200); openWordbox(DOOR_FOR_ACT[act]); return; }
    const RW = REWARDS[act];
    $('rwKicker').textContent = RW.kicker; $('rwTitle').textContent = RW.title; $('rwText').textContent = RW.text;
    const btn = $('rwBtn'); btn.href = held; btn.textContent = RW.btn;
    const ask = $('rwAsk'); if (ask) ask.hidden = !RW.ask;
    $('reward').hidden = false;
    burstConfetti(); playUnlock();
    if (!rewardsGiven[act]) { keeper(RW.vo); rewardsGiven[act] = true; }
    stampVault(act); markDoor(act); renderStrip();
  }
  $('rewardClose').addEventListener('click', () => {
    $('reward').hidden = true;
    if (room === 'III' || room === 'IV') setTimeout(() => say('cert', 7000), 600);
    else if (room === 'I' && !doorOpen('II')) setTimeout(() => caption('The passage at the back is not quite dark. Something waits beyond it.', 5600), 500);
  });

  /* ---- the Keeper's story pages (shared #pageview) ---- */
  function openPage(no, b) {
    if (!pagesFound.includes(no)) { pagesFound.push(no); store.set(STORY_KEY, pagesFound); }
    const n = pagesFound.filter((x) => typeof x === 'number').length;
    $('pgNo').textContent = 'PAGE ' + (NUM_WORD[no] || no); $('pgBody').textContent = PAGE_WORDS[no];
    const roomOf = [[1, 4, 7], [2, 5, 8], [3, 6, 9]].find((r) => r.includes(no)) || [];
    const inRoom = roomOf.filter((p) => pagesFound.includes(p)).length;
    $('pgFound').textContent = n >= 9 ? 'All nine pages found' : ('Found in this room: ' + inRoom + ' of 3 · nine pages lie across the vaults');
    $('pageview').hidden = false; if (b) b.classList.add('read');
    keeper('page' + no, 9000);
    if (n >= 9 && !pagesFound.includes('final')) {
      setTimeout(() => {
        $('pgNo').textContent = 'THE KEEPER’S LAST PAGE'; $('pgBody').textContent = FINAL_LETTER; $('pgFound').textContent = 'The story is complete';
        keeper('pagefinal', 12000); burstConfetti(); pagesFound.push('final'); store.set(STORY_KEY, pagesFound);
      }, 2600);
    }
  }
  $('pageClose').addEventListener('click', () => { $('pageview').hidden = true; });

  /* ---- the word box (shared #wordbox; the server decides) ---- */
  const wordboxEl = $('wordbox'), tilesEl = $('tiles'), wbInput = $('wbInput'), wbMsg = $('wbMsg'), wbSubmit = $('wbSubmit');
  const WORD_LEN = 12; let wbTarget = null, wbWord = '', wbFails = 0, wbBusy = false, fourthWord = '';
  function renderTiles() { tilesEl.innerHTML = ''; const shown = Math.min(WORD_LEN, Math.max(5, wbWord.length + 1)); for (let i = 0; i < shown; i++) { const t = document.createElement('div'); t.className = 'tile' + (wbWord[i] ? ' filled' : ''); t.textContent = wbWord[i] || ''; tilesEl.appendChild(t); } }
  function openWordbox(key) {
    wbTarget = key; wbWord = ''; wbBusy = false;
    $('wbKicker').textContent = DOORS[key].kicker; $('wbLine').textContent = VO[DOORS[key].vo].text;
    wbMsg.textContent = ''; renderTiles(); wordboxEl.hidden = false;
    wbInput.value = ''; wbInput.style.pointerEvents = 'auto'; try { wbInput.focus({ preventScroll: true }); } catch (err) {}
    keeper(DOORS[key].vo);
  }
  function closeWordbox() { wordboxEl.hidden = true; wbTarget = null; }
  $('wbCancel').addEventListener('click', closeWordbox);
  function wbSet(w) { wbWord = w.toUpperCase().replace(/[^A-Z]/g, '').slice(0, WORD_LEN); renderTiles(); }
  wbInput.addEventListener('input', () => { wbSet(wbInput.value); if (wbInput.value !== wbWord) wbInput.value = wbWord; });
  addEventListener('keydown', (e) => {
    if (wordboxEl.hidden) return;
    if (e.key === 'Enter') { submitWord(); e.preventDefault(); }
    else if (e.key === 'Escape') closeWordbox();
    else if (e.target !== wbInput) {   // typed with the box open but the field unfocused: still counts
      if (e.key === 'Backspace') { wbSet(wbWord.slice(0, -1)); wbInput.value = wbWord; e.preventDefault(); }
      else if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { wbSet(wbWord + e.key); wbInput.value = wbWord; e.preventDefault(); try { wbInput.focus({ preventScroll: true }); wbInput.setSelectionRange(wbWord.length, wbWord.length); } catch (err) {} }
    }
    e.stopPropagation();
  }, true);
  async function submitWord() {
    if (wbBusy || !wbTarget) return;
    if (wbWord.length < 4) { shake(wordboxEl); return; }
    wbBusy = true; wbSubmit.textContent = 'The vault is listening…';
    let j = null;
    try { const r = await fetch('/api/unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ word: wbWord, vid: psVid() }) }); j = await r.json(); } catch (e) { /* offline */ }
    wbBusy = false; wbSubmit.textContent = 'Open the door';
    if (!j) { wbMsg.textContent = 'The vault cannot hear you right now — try again in a moment.'; return; }
    if (j.error === 'slow_down') { wbMsg.textContent = 'Too many tries at once. Take a breath, then speak again.'; return; }
    if (j.ok) {
      const act = j.act;
      holdReward(act, j.rewardUrl);
      if (act === 'IV') { fourthWord = wbWord; try { if (j.carveToken) localStorage.setItem('ps_carve', j.carveToken); } catch (e) {} }
      if (act !== DOORS[wbTarget].act) wbMsg.textContent = 'A true word — but for another door. I will open that one.';
      closeWordbox(); markDoor(act); stampVault(act); renderStrip();
      playBoom(); burstConfetti();
      if (act === 'I') { setTimeout(() => openReward('I'), 500); }
      else if (act === 'IV') { caption('The floor answers. A stair, cut long before this vault was sealed — go down.', 6000); setTimeout(() => enterRoom('IV'), 1400); }
      else { playCreak(1.6); setTimeout(() => enterRoom(act), 900); }
    } else {
      wbFails++; playThud();
      const fk = 'fail' + Math.min(wbFails, 3); keeper(fk);
      wbMsg.innerHTML = wbFails >= 3 ? 'Perhaps you need <a href="/hints" style="color:var(--gold)">the Keeper’s hints</a>.' : VO[fk].text;
      wbSet(''); wbInput.value = ''; shake(wordboxEl);
    }
  }
  wbSubmit.addEventListener('click', submitWord);
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, speakBtn = $('speakBtn');
  if (!SR) speakBtn.style.display = 'none';
  else speakBtn.addEventListener('click', () => {
    try {
      const rec = new SR(); rec.lang = 'en-US'; rec.maxAlternatives = 1;
      speakBtn.classList.add('listening'); speakBtn.textContent = '🎙  Listening…';
      rec.onresult = (e) => { wbSet(e.results[0][0].transcript || ''); if (wbWord.length >= 4) submitWord(); };
      rec.onend = () => { speakBtn.classList.remove('listening'); speakBtn.textContent = '🎙  Speak the word'; };
      rec.onerror = rec.onend; rec.start();
    } catch (e) { /* ignore */ }
  });

  /* ---- the sanctum (Vault IV): a dark room, built in HTML ---- */
  let wallMarks = [], wallCount = 0, wallFetched = false;
  function openRegister() {
    let mine = null; try { mine = localStorage.getItem('ps_mark_v1'); } catch (e) {}
    const G = els.pvGame;
    G.innerHTML = `
      <div class="pv-card" role="dialog" aria-label="The Keeper's register">
        <div class="plaque"><h3>THE KEEPER’S REGISTER</h3><p class="sub">those who found what was never lit</p><div class="marks" id="scMarks"></div><p class="count" id="scCount"></p></div>
        ${mine ? '<p class="reg-mine">Your mark — <b>' + mine + '</b> — is cut into the stone.</p>' : '<button type="button" class="gold-btn" id="regCarve">Carve your mark</button>'}
        <button type="button" class="ghost-btn" id="regClose">Step back</button>
      </div>`;
    G.hidden = false; drawRegister(); fetchWall();
    $('regClose').addEventListener('click', () => { G.hidden = true; });
    const c = $('regCarve'); if (c) c.addEventListener('click', () => { G.hidden = true; openCarvebox(); });
  }
  function openLetters() {
    const G = els.pvGame;
    G.innerHTML = `
      <div class="pv-card" role="dialog" aria-label="The Keeper's three letters">
        <div class="parch"><p class="from">From the Keeper’s three letters</p>${ACROSTIC.map(([c, r]) => `<p><b>${c}</b>${r}</p>`).join('')}<p class="foot">one letter, hidden at the start of every thought</p></div>
        <button type="button" class="ghost-btn" id="letClose">Set it back</button>
      </div>`;
    G.hidden = false; say('letters', 8000);
    $('letClose').addEventListener('click', () => { G.hidden = true; });
  }
  function buildSanctumUnused() {
    const S = els.pvSanctum;
    if (S.dataset.built) { drawRegister(); return; }
    S.dataset.built = '1';
    S.innerHTML = `
      <div class="sc-lamp" aria-hidden="true"><i class="chain"></i><i class="body"><b></b></i><i class="halo"></i></div>
      <div class="sc-floor" aria-hidden="true"></div>
      <button type="button" class="sc-hot sc-tome" aria-label="The Secret Sanctum — the master reward"><i class="book"></i><span>The master reward</span></button>
      <button type="button" class="sc-hot sc-wall" aria-label="The Keeper's register"><div class="plaque"><h3>THE KEEPER’S REGISTER</h3><p class="sub">those who found what was never lit</p><div class="marks" id="scMarks"></div><p class="count" id="scCount"></p></div></button>
      <button type="button" class="sc-hot sc-letters" aria-label="The Keeper's three letters"><div class="parch"><p class="from">From the Keeper’s three letters</p>${ACROSTIC.map(([c, r]) => `<p><b>${c}</b>${r}</p>`).join('')}<p class="foot">one letter, hidden at the start of every thought</p></div></button>
      <button type="button" class="sc-hot sc-chart" aria-label="Something half-covered on an easel"><i class="easel"></i><i class="cloth"></i><span>Something half-covered</span></button>
      <button type="button" class="sc-hot sc-stair" aria-label="The stair back up"><i></i><span>The stair, back up</span></button>`;
    S.querySelector('.sc-tome').addEventListener('click', () => openReward('IV'));
    S.querySelector('.sc-letters').addEventListener('click', () => say('letters', 8000));
    S.querySelector('.sc-chart').addEventListener('click', () => say('chart', 8000));
    S.querySelector('.sc-stair').addEventListener('click', () => { say('stair', 4000); setTimeout(() => enterRoom('III'), 600); });
    S.querySelector('.sc-wall').addEventListener('click', () => {
      let mine = null; try { mine = localStorage.getItem('ps_mark_v1'); } catch (e) {}
      if (mine) caption('Your mark — ' + mine + ' — is on this wall' + (wallCount > 1 ? ', one of ' + wallCount + '.' : '. The first.'), 6200);
      else openCarvebox();
    });
    drawRegister();
  }
  function drawRegister() {
    const m = $('scMarks'), c = $('scCount'); if (!m) return;
    m.innerHTML = wallMarks.slice(-160).map((x, i) => `<span style="--j:${(i * 37) % 11 - 5}">${x}</span>`).join('');
    c.textContent = wallCount > 0 ? (wallCount === 1 ? 'one mark, cut into the stone' : wallCount + ' marks, cut into the stone') : 'the stone is bare — be the first';
  }
  function fetchWall() {
    if (wallFetched) return; wallFetched = true;
    fetch('/api/carve').then((r) => r.json()).then((d) => { if (d && d.ok) { wallMarks = d.marks || []; wallCount = d.count || 0; drawRegister(); } }).catch(() => {});
  }
  const carveboxEl = $('carvebox'), cbInput = $('cbInput'), cbMsg = $('cbMsg'), cbSubmit = $('cbSubmit'); let cbBusy = false;
  function openCarvebox() { cbMsg.textContent = ''; cbInput.value = ''; carveboxEl.hidden = false; setTimeout(() => { try { cbInput.focus(); } catch (e) {} }, 60); }
  cbInput.addEventListener('input', () => { cbInput.value = cbInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); });
  $('cbCancel').addEventListener('click', () => { carveboxEl.hidden = true; });
  cbInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') cbSubmit.click(); });
  cbSubmit.addEventListener('click', async () => {
    if (cbBusy) return;
    const initials = cbInput.value;
    if (initials.length < 2) { cbMsg.textContent = 'Two or three letters — no more, no less.'; return; }
    const age = $('cbAge'); if (!age || !age.checked) { cbMsg.textContent = 'Confirm you are 13 or older before you carve.'; return; }
    cbBusy = true; cbSubmit.textContent = 'The chisel bites…';
    let j = null;
    try {
      const r = await fetch('/api/carve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initials, word: fourthWord, token: (function () { try { return localStorage.getItem('ps_carve') || ''; } catch (e) { return ''; } })(), vid: psVid() }) });
      j = await r.json();
    } catch (e) { /* offline */ }
    cbBusy = false; cbSubmit.textContent = 'Carve it';
    if (!j) { cbMsg.textContent = 'The stone will not take the mark right now. Try again shortly.'; return; }
    if (!j.ok) {
      cbMsg.textContent = j.reason === 'bad_initials' ? 'The stone refuses those letters.' : j.reason === 'no_proof' ? 'Only those who spoke the fourth word may carve. Find what was never lit, and say it.' : j.reason === 'slow_down' ? 'The chisel needs a rest. A moment, please.' : 'The stone will not take the mark right now. Try again shortly.';
      return;
    }
    try { localStorage.setItem('ps_mark_v1', initials); } catch (e) {}
    wallMarks.push(initials); wallCount = j.count || wallCount + 1; drawRegister();
    carveboxEl.hidden = true; burstConfetti(); playChime(3);
    caption('Stone remembers what paper forgets. Yours is mark ' + wallCount + '.', 7000);
  });

  /* ================= MINI-GAME 1 — THE KEEPER'S ROUND (library, lights out) ================= */
  const round = { on: false, list: [], i: 0, t0: 0, timer: null, best: store.get('ps_round_best', null) };
  function startRound() {
    if (round.on) return;
    const pool = ROOMS.II.hots.filter((h) => !h.page && h.act !== 'game' && h.act !== 'door');
    round.list = pool.sort(() => Math.random() - 0.5).slice(0, 5); round.i = 0; round.on = true; round.t0 = performance.now();
    els.pv.classList.add('lights-out'); els.pvDark.hidden = false;
    if (COARSE) { const r = els.pvStage.getBoundingClientRect(); els.pvDark.style.setProperty('--lx', (r.width / 2) + 'px'); els.pvDark.style.setProperty('--ly', (r.height / 2) + 'px'); }
    caption('The Keeper’s Round. I will name five things. Find them in the dark — ' + (COARSE ? 'drag your finger to carry the light.' : 'your cursor carries the light.'), 5000);
    setTimeout(nextTarget, 2600);
    round.timer = setInterval(() => {
      if (!round.on) return;
      const left = Math.max(0, 60 - (performance.now() - round.t0) / 1000);
      els.pvVerb.textContent = (round.i < round.list.length ? 'Find: ' + round.list[round.i].label : '') + '   ·   ' + left.toFixed(0) + 's';
      if (left <= 0) endRound(false);
    }, 250);
  }
  function nextTarget() {
    if (!round.on) return;
    if (round.i >= round.list.length) { endRound(true); return; }
    caption('Find… ' + round.list[round.i].label.toLowerCase() + '.', 4000);
  }
  function roundPick(id) {
    if (!round.on) return false;
    const want = round.list[round.i];
    if (want && want.id === id) { playChime(round.i); round.i++; setTimeout(nextTarget, 300); }
    else { playThud(80, 45, 0.2, 0.2); caption('No. Look again.', 1800); }
    return true;
  }
  function endRound(won) {
    round.on = false; clearInterval(round.timer);
    els.pv.classList.remove('lights-out'); els.pvDark.hidden = true; els.pvVerb.textContent = '';
    if (won) {
      const secs = Math.round((performance.now() - round.t0) / 10) / 100;
      if (!round.best || secs < round.best) { round.best = secs; store.set('ps_round_best', secs); }
      awardTile('II', 'Five in ' + secs + ' seconds' + (round.best === secs ? ' — your best.' : ' (best ' + round.best + 's).'));
    } else caption('The dark won that one. Try again when your eyes have rested.', 5000);
  }

  /* ================= MINI-GAME 2 — THE LISTENING LOCK (treasure, the locked chest) ================= */
  const lock = { on: false, targets: [], i: 0, pos: 0, holdT: null, dragging: false, lastAngle: 0 };
  function openLock() {
    if (tiles.III) { say('smallchest'); }
    const G = els.pvGame;
    G.innerHTML = `
      <div class="pv-card lock-card" role="dialog" aria-label="The Listening Lock">
        <div class="reward-kicker">THE LISTENING LOCK</div>
        <p class="word-line">Three tumblers. Turn the dial and <em>listen</em> — the lock tells you when you are close. Hold still on the number and it will fall.</p>
        <div class="lock-dial-wrap">
          <div class="lock-dial" id="lockDial" tabindex="0" role="slider" aria-label="Combination dial, 0 to 39" aria-valuemin="0" aria-valuemax="39" aria-valuenow="0">
            <div class="ticks"></div><div class="num" id="lockNum">0</div><div class="mark"></div>
          </div>
          <div class="lock-tumblers" id="lockTumblers"><i></i><i></i><i></i></div>
        </div>
        <p class="lock-help">Drag the dial, or use the arrow keys.</p>
        <p class="lock-msg" id="lockMsg"></p>
        <button type="button" class="ghost-btn" id="lockBack">Step back</button>
      </div>`;
    G.hidden = false;
    lock.on = true; lock.i = 0; lock.pos = 0;
    lock.targets = [];
    while (lock.targets.length < 3) { const n = Math.floor(Math.random() * 40); if (lock.targets.every((t) => Math.min(Math.abs(t - n), 40 - Math.abs(t - n)) > 6)) lock.targets.push(n); }
    const dial = $('lockDial');
    const render = () => { dial.style.setProperty('--rot', (-lock.pos * 9) + 'deg'); $('lockNum').textContent = lock.pos; dial.setAttribute('aria-valuenow', lock.pos); };
    const dist = () => { const t = lock.targets[lock.i]; const d = Math.abs(t - lock.pos); return Math.min(d, 40 - d); };
    const step = (dir) => {
      lock.pos = (lock.pos + dir + 40) % 40; render();
      const d = dist(), near = Math.max(0, 1 - d / 10);
      playTick(0.15 + near * 0.85, 1400 + near * 1600);
      dial.style.setProperty('--shake', (near > 0.55 ? (near - 0.55) * 8 : 0) + 'px');
      clearTimeout(lock.holdT);
      if (d === 0) lock.holdT = setTimeout(fall, 700);
    };
    const fall = () => {
      if (!lock.on) return;
      playThud(120, 45, 0.6, 0.5); playChime(lock.i + 1);
      $('lockTumblers').children[lock.i].classList.add('fell');
      lock.i++;
      $('lockMsg').textContent = ['One.', 'Two.', ''][lock.i - 1] || '';
      if (lock.i >= 3) {
        lock.on = false; $('lockMsg').textContent = 'The last tumbler falls.';
        setTimeout(() => { G.hidden = true; burstConfetti(); playUnlock(); awardTile('III', 'The chest gives up its secret.'); }, 900);
      }
    };
    // drag: angle around the dial's centre
    const angleAt = (e) => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    dial.addEventListener('pointerdown', (e) => { lock.dragging = true; lock.lastAngle = angleAt(e); dial.setPointerCapture(e.pointerId); e.preventDefault(); });
    dial.addEventListener('pointermove', (e) => {
      if (!lock.dragging) return;
      const a = angleAt(e); let da = a - lock.lastAngle; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      const stepAngle = 2 * Math.PI / 40;
      while (Math.abs(da) >= stepAngle) { step(da > 0 ? -1 : 1); da -= Math.sign(da) * stepAngle; lock.lastAngle += Math.sign(a - lock.lastAngle) * stepAngle; }
    });
    const up = () => { lock.dragging = false; };
    dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
    dial.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { step(1); e.preventDefault(); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { step(-1); e.preventDefault(); } });
    $('lockBack').addEventListener('click', () => { lock.on = false; G.hidden = true; });
    render(); setTimeout(() => dial.focus(), 80);
    caption('Three tumblers. Turn the dial and listen.', 5000);
  }

  /* ---- key-tiles: the Keeper's own shaded squares ---- */
  function awardTile(act, note) {
    const had = !!tiles[act];
    if (!had) { tiles[act] = new Date().toISOString().slice(0, 10); store.set(TILE_KEY, tiles); }
    const both = tiles.II && tiles.III;
    const G = els.pvGame;
    G.innerHTML = `
      <div class="pv-card" role="dialog" aria-label="A key-tile">
        <div class="reward-kicker">${had ? 'THE KEEPER NODS' : 'A KEY-TILE'}</div>
        <div class="tile-art"><span>${act === 'II' ? '5' : '7'}</span></div>
        <h2>${both ? 'THE KEEPER’S MARK' : 'ONE OF TWO'}</h2>
        <p>${note ? note + ' ' : ''}${both ? SAY.tileIII : SAY.tileII}</p>
        ${both ? '<a class="gold-btn" href="/passport">See it on your passport</a>' : ''}
        <button type="button" class="ghost-btn" id="tileClose">Keep exploring →</button>
      </div>`;
    G.hidden = false; playChime(4);
    $('tileClose').addEventListener('click', () => { G.hidden = true; });
    hotEls.forEach((h) => { if ((act === 'II' && h.dataset.id === 'shelves') || (act === 'III' && h.dataset.id === 'chestL')) h.classList.add('done'); });
  }

  /* ---- the rejects: the same three two-answer pages the 3D study shows (shared #draft overlay) ---- */
  const DRAFT_NOTES = [
    'Two answers. Burn it. A grid that cannot make up its mind is not a puzzle — it is a coin toss with numbers on it.',
    'I gave it too few clues, and it gave me two truths back. Every one of the two hundred in my book has exactly one. This one has a twin.',
    'The deadly rectangle: four cells, two digits, and no way to choose between them. Every setter falls into this hole once. Then never again.',
  ];
  const DRAFT_BORDERS = ['/art/page-border-easy.webp', '/art/page-border-medium.webp', '/art/page-border-hard.webp'];
  let DRAFTS = [], draftCur = 0, draftShow = null;
  function loadDrafts() { return fetch('/data/rejects.json').then((r) => r.json()).then((d) => { if (Array.isArray(d)) DRAFTS = d; }).catch(() => {}); }
  loadDrafts();
  function drawDraft() {
    const D = DRAFTS[draftCur]; if (!D) return;
    const grid = $('draftGrid'); grid.innerHTML = '';
    const fill = draftShow ? D[draftShow] : null, diff = new Set(D.diff || []);
    for (let i = 0; i < 81; i++) {
      const c = document.createElement('i'); const given = D.g[i] !== '0';
      c.textContent = given ? D.g[i] : (fill ? fill[i] : '');
      if (!given && fill) c.classList.add('pen'); if (diff.has(i) && fill) c.classList.add('hot');
      if (i % 9 === 2 || i % 9 === 5) c.classList.add('b3'); const r = Math.floor(i / 9); if (r === 2 || r === 5) c.classList.add('r3');
      grid.appendChild(c);
    }
    $('draftSheet').style.backgroundImage = 'url(' + DRAFT_BORDERS[draftCur % 3] + ')';
    $('draftHead').textContent = 'DRAFT No. ' + (draftCur + 1) + ' · ' + (D.givens || '') + ' CLUES · TWO ANSWERS';
    $('draftNote').textContent = DRAFT_NOTES[draftCur % 3];
    $('draftA').setAttribute('aria-pressed', String(draftShow === 'a')); $('draftB').setAttribute('aria-pressed', String(draftShow === 'b'));
  }
  function openDraft(idx) {
    if (!DRAFTS.length) { loadDrafts().then(() => { if (DRAFTS.length) openDraft(idx); else caption('The page is stuck to itself. Try again in a moment.', 3000); }); return; }
    draftCur = idx % DRAFTS.length; draftShow = null; drawDraft(); $('draft').hidden = false;
    caption('A page I threw away. Look at it and tell me why.', 4800); playThud(70, 45, 0.12, 0.2);
  }
  $('draftA').addEventListener('click', () => { draftShow = 'a'; drawDraft(); });
  $('draftB').addEventListener('click', () => { draftShow = 'b'; drawDraft(); });
  $('draftClose').addEventListener('click', () => { $('draft').hidden = true; });

  /* ---- confetti (shared canvas) ---- */
  const conf = $('confetti'); const cg = conf.getContext('2d'); let confParts = [], confRaf = false;
  function burstConfetti() {
    if (REDUCED) return;
    conf.width = innerWidth; conf.height = innerHeight; confParts = [];
    for (let i = 0; i < 130; i++) confParts.push({ x: innerWidth / 2, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 13, vy: -4 - Math.random() * 9, s: 3 + Math.random() * 5, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.3, c: ['#f6b23c', '#ffd37a', '#c9973f', '#fff1cf'][(Math.random() * 4) | 0], life: 1 });
    if (!confRaf) { confRaf = true; let last = performance.now(); (function loop(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; tickConfetti(dt); if (confParts.length) requestAnimationFrame(loop); else confRaf = false; })(last); }
  }
  function tickConfetti(dt) {
    cg.clearRect(0, 0, conf.width, conf.height);
    confParts.forEach((p) => { p.vy += 18 * dt; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= dt * 0.4; cg.save(); cg.translate(p.x, p.y); cg.rotate(p.r); cg.globalAlpha = Math.max(0, p.life); cg.fillStyle = p.c; cg.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); cg.restore(); });
    confParts = confParts.filter((p) => p.life > 0 && p.y < conf.height + 30);
    if (!confParts.length) cg.clearRect(0, 0, conf.width, conf.height);
  }

  /* the Back button is handled by the page-level guard in vault.astro */
  function guardHistory() {}

  /* ================= boot ================= */
  function boot(reason) {
    grab();
    els.pv.hidden = false;
    document.body.classList.add('painted');
    guardHistory();
    ['gate', 'fade', 'hud'].forEach((id) => { const e = $(id); if (e) e.style.display = 'none'; });
    // the arriving act (from the landing's door) opens that door for this session
    const act = qs.get('act'); if (act && ROOMS[act] && act !== 'IV') markDoor(act);
    if (COARSE) els.pv.classList.add('reveal');
    // the gate: the study painting, one button
    const fromDoor = qs.get('from') === 'door' || Object.keys(opened).length > 0;
    $('pvGateKicker').textContent = fromDoor ? 'THE WORD WAS TRUE' : 'THE KEEPER’S VAULTS';
    $('pvGateLine').textContent = fromDoor ? 'The first door stands open. Two more wait in the dark — each sealed with a word.' : 'Step in. The first room is open to anyone who knocks; the doors beyond are sealed with the book’s words.';
    $('pvEnter').addEventListener('click', () => {
      unlockVO(); initAudio(); if (actx && actx.state === 'suspended') actx.resume();
      startAmbient();
      els.pvGate.classList.add('gone');
      try {
        if (!sessionStorage.getItem('ps_visited')) { sessionStorage.setItem('ps_visited', '1'); fetch('/api/visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vid: psVid(), mode: 'painted' }) }).catch(() => {}); }
      } catch (e) {}
      enterRoom(act && ROOMS[act] && act !== 'IV' && doorOpen(act) ? act : 'I');
      setTimeout(() => { els.pvHint.classList.add('show'); setTimeout(() => els.pvHint.classList.remove('show'), 7000); }, 2400);
    });
    els.pvMute.addEventListener('click', () => { initAudio(); setMuted(!muted); if (!muted) startAmbient(); });
    els.pvReveal.addEventListener('click', () => { const on = els.pv.classList.toggle('reveal'); els.pvReveal.setAttribute('aria-pressed', String(on)); });
    // pointer: parallax + cursor light (fine), pan (coarse or narrow), and the Round's light
    els.pvStage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') onMove(e); else if (round.on) { const r = els.pvStage.getBoundingClientRect(); els.pvDark.style.setProperty('--lx', (e.clientX - r.left) + 'px'); els.pvDark.style.setProperty('--ly', (e.clientY - r.top) + 'px'); } });
    els.pvStage.addEventListener('pointerleave', () => { hotEls.forEach((h) => h.classList.remove('near')); });
    let drag = null;
    els.pvStage.addEventListener('pointerdown', (e) => { if (panMax > 8 && !round.on) { drag = { x: e.clientX, pan }; } });
    els.pvStage.addEventListener('pointermove', (e) => { if (drag) { setPan(drag.pan + (e.clientX - drag.x)); } });
    const endDrag = () => { drag = null; };
    els.pvStage.addEventListener('pointerup', endDrag); els.pvStage.addEventListener('pointercancel', endDrag);
    // hotspot clicks during the Round are picks, not actions
    els.pvHots.addEventListener('click', (e) => { const b = e.target.closest('.pv-hot'); if (b && round.on) { e.stopImmediatePropagation(); roundPick(b.dataset.id); } }, true);
    addEventListener('resize', sizeRoom);
    addEventListener('keydown', (e) => { if (e.key === 'h' || e.key === 'H') { if (!wordboxEl.hidden || !carveboxEl.hidden) return; els.pvReveal.click(); } });
    sizeRoom();
    // slow idle pan on portrait screens, so the room breathes even untouched
    if (!REDUCED) (function idle() { if (panMax > 8 && !drag) { autoPan = Math.sin(performance.now() / 9000) * panMax * 0.7; setPan(autoPan); } requestAnimationFrame(idle); })();
    window.__painted = { enterRoom, openReward, openWordbox, startRound, openLock, awardTile, get room() { return room; }, ROOMS,
      get lock() { return lock; }, get round() { return round; }, endRound };   // QA hooks + the page guard's hook
  }
  window.PSPaintedBoot = boot;
  if (window.__flatMode) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(window.__flatReason)); else boot(window.__flatReason); }
})();
