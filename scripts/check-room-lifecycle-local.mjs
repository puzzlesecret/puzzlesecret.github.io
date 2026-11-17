// Isolated controller races: synthetic text only; no network, browser, or microphone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function element() {
  return { hidden: false, textContent: '', value: '', style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, appendChild() {}, get offsetWidth() { return 1; } };
}
for (const file of ['src/scripts/vault3d.js', 'public/js/painted-vault.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const painted = file.includes('painted');
  const start = source.indexOf(painted ? '  const WORD_LEN = 12;' : 'let wbTarget = null');
  const end = source.indexOf(painted ? '  /* ---- the sanctum' : 'function psVid()', start);
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const deferred = [];
  let micStops = 0, voiceStops = 0, microphoneOptions;
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout,
    window: { psWordMicrophone: options => { microphoneOptions = options; return { stop() { micStops++; } }; } },
    document: { hidden: false, getElementById: node, addEventListener() {}, createElement: element },
    MutationObserver: class { observe() {} }, addEventListener() {},
    $: node, wordboxEl: node('wordbox'), tilesEl: node('tiles'), wbInput: node('wbInput'), wbMsg: node('wbMsg'), wbSubmit: node('wbSubmit'),
    DOORS: { first: { act: 'I' }, door2: { act: 'II' } }, DOOR_LEN: { first: 6, door2: 7 },
    fetch: (_url, options) => new Promise(resolve => deferred.push({ options, resolve })),
    psVid: () => 'synthetic',
    stopVoice: () => { voiceStops++; },
  });
  vm.runInContext(source.slice(start, end), context);
  microphoneOptions.beforeStart(); assert.equal(voiceStops, 1, 'microphone stops Keeper narration before capture');
  vm.runInContext("wbTarget = 'first';", context);
  assert.equal(microphoneOptions.validateTranscript('A B C D E F'), true);
  assert.equal(typeof microphoneOptions.validateTranscript('ABCDEFG'), 'string', 'overlong transcript is rejected before tile truncation');
  vm.runInContext("wbTarget = 'first'; wbSet('ABCD'); globalThis.pending = submitWord();", context);
  assert.equal(deferred.length, 1);
  vm.runInContext("closeWordbox(); wordboxEl.hidden = false; wbTarget = 'door2'; wbSet('EFGH'); wbMsg.textContent = 'fresh panel';", context);
  assert.equal(deferred[0].options.signal.aborted, true, `${file}: closing aborts pending fetch`);
  // Even a transport that ignores abort must not touch a new target or reward path.
  deferred[0].resolve({ json: async () => ({ ok: true, act: 'I' }) });
  await context.pending;
  assert.equal(node('wbMsg').textContent, 'fresh panel');
  assert.equal(vm.runInContext('wbTarget', context), 'door2');
  assert.equal(vm.runInContext('wbWord', context), 'EFGH');
  assert.ok(micStops >= 2);
  vm.runInContext('wordboxEl.hidden = true; submitWord();', context);
  assert.equal(deferred.length, 1, `${file}: hidden panel cannot submit`);
  assert.ok(!source.slice(start, end).includes('rec.onresult'), `${file}: shared mic owns editable transcription`);
  console.log(`PASS ${painted ? 'painted' : '3D'} stale request, captured target, hidden submission, microphone cancellation`);
}

// Drive the actual 3D final-tumbler timer through close/reopen, including a cancelled callback.
{
  const source = fs.readFileSync('src/scripts/vault3d.js', 'utf8');
  const start = source.indexOf('let heldIII =');
  const end = source.indexOf('let lidAnim =', start);
  const timers = [];
  let cardCloses = 0, saved = {};
  const dial = { ...element(), setAttribute() {}, style: { setProperty() {} } };
  const context = vm.createContext({
    tilesHeld: () => ({ ...saved }), localStorage: { setItem(_key, value) { saved = JSON.parse(value); } }, TILE_KEY: 'synthetic',
    document: { getElementById: () => ({ ...dial, children: [element(), element(), element()] }) },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    playThud() {}, playChime() {}, psEvent() {}, psTouch() {}, PS_EV: {}, simT: 0, lockboxEl: element(), closeCard() { cardCloses++; },
  });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('lockRender = () => {}; lock.i = 2; lockFall(); closeLock(); lockGeneration++; lockboxEl.hidden = false;', context);
  assert.ok(saved.III, 'closing after the winning tumbler preserves earned tile');
  const closesBefore = cardCloses;
  timers[0]();
  assert.equal(cardCloses, closesBefore, 'stale win callback cannot close reopened lock');
  console.log('PASS 3D final-tumbler close/reopen preserves award without stale UI');
}

{
  const source = fs.readFileSync('public/js/painted-vault.js', 'utf8');
  const start = source.indexOf('  const lock = { on: false');
  const end = source.indexOf('  /* ---- key-tiles:', start);
  const timers = [], cards = new Map(), tiles = {};
  const node = id => {
    if (!cards.has(id)) cards.set(id, { ...element(), handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; }, setAttribute() {}, style: { setProperty() {} }, children: [element(), element(), element()] });
    return cards.get(id);
  };
  let awards = 0;
  const game = { ...element(), querySelector: selector => node(selector.slice(1)), contains: target => [...cards.values()].includes(target) };
  const context = vm.createContext({
    window: {}, tiles, TILE_KEY: 'synthetic', store: { set() {} }, els: { pvGame: game },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
    caption() {}, say() {}, playTick() {}, playThud() {}, playChime() {}, playUnlock() {}, burstConfetti() {}, awardTile() { awards++; },
  });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('openLock(); lock.i = 2; lock.pos = (lock.targets[2] + 39) % 40;', context);
  node('lockDial').handlers.keydown({ key: 'ArrowRight', preventDefault() {} });
  timers.at(-1)(); // final tumbler falls, scheduling the delayed win
  const win = timers.at(-1);
  node('lockBack').handlers.click();
  assert.ok(tiles.III, 'painted close after solve preserves earned tile');
  vm.runInContext('openLock();', context);
  win(); // cancelled timer still arriving must remain inert
  assert.equal(game.hidden, false);
  assert.equal(awards, 0, 'stale painted win cannot replace new lock with award panel');
  console.log('PASS painted final-tumbler close/reopen preserves award without stale UI');
}
