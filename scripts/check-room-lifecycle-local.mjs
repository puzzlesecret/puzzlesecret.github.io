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
  const keyboard = {};
  let micStops = 0, voiceStops = 0, microphoneOptions;
  const context = vm.createContext({
    console, AbortController, setTimeout, clearTimeout,
    window: { psWordMicrophone: options => { microphoneOptions = options; return { stop() { micStops++; } }; } },
    document: { hidden: false, getElementById: node, addEventListener() {}, createElement: element },
    MutationObserver: class { observe() {} }, addEventListener(type, handler) { keyboard[type] = handler; },
    $: node, wordboxEl: node('wordbox'), tilesEl: node('tiles'), wbInput: node('wbInput'), wbMsg: node('wbMsg'), wbSubmit: node('wbSubmit'),
    DOORS: { first: { act: 'I' }, door2: { act: 'II' } }, WORD_LEN: 12,
    fetch: (_url, options) => new Promise(resolve => deferred.push({ options, resolve })),
    psVid: () => 'synthetic',
    stopVoice: () => { voiceStops++; },
  });
  vm.runInContext(source.slice(start, end), context);
  microphoneOptions.beforeStart(); assert.equal(voiceStops, 1, 'microphone stops Keeper narration before capture');
  vm.runInContext("wbTarget = 'first';", context);
  for (const target of ['first', 'door2', 'door3', 'fourth']) {
    vm.runInContext(`wbTarget = ${JSON.stringify(target)};`, context);
    for (const word of ['ABCD', 'ABCDEF', 'ABCDEFG', 'ABCDEFGHI', 'ABCDEFGHIJKL']) {
      assert.equal(microphoneOptions.validateTranscript(word), true, `${file}: speech supports every valid length`);
      vm.runInContext(`wbSet(${JSON.stringify(word)});`, context);
      assert.equal(node('wbInput').value, word, `${file}: typing never truncates to a door-specific length`);
    }
  }
  assert.equal(typeof microphoneOptions.validateTranscript('ABC'), 'string');
  assert.equal(typeof microphoneOptions.validateTranscript('ABCDEFGHIJKLM'), 'string');
  assert.equal(typeof microphoneOptions.validateTranscript('TWO WORDS'), 'string');
  assert.equal(microphoneOptions.validateTranscript('A B C D'), true, 'spoken single-letter spelling is accepted');
  assert.equal(microphoneOptions.validateTranscript('A B C D E F G H I J K L'), true);
  let prevented = 0, stopped = 0;
  for (const key of ['Enter', 'Tab']) for (const id of ['speakBtn', 'wbCancel', 'closeButton']) {
    keyboard.keydown({key, target: node(id), preventDefault() { prevented++; }, stopPropagation() { stopped++; }});
  }
  assert.equal(prevented, 0, 'native buttons and Tab focus trap remain available');
  assert.equal(stopped, 0);
  assert.equal(deferred.length, 0, 'button Enter never submits a word');
  vm.runInContext("wbTarget = 'first'; wbSet('');", context);
  keyboard.keydown({key: 'Enter', target: node('wbInput'), preventDefault() {}, stopPropagation() {}});
  assert.match(node('wbMsg').textContent, /4–12 letters/, 'short entry has a live explanation');
  vm.runInContext("wbTarget = 'fourth'; wbSet(''); submitWord();", context);
  assert.match(node('wbMsg').textContent, /original Volume 1/, 'fourth short entry keeps the edition restriction');
  vm.runInContext("wbSet(' ab-cd ');", context);
  assert.equal(node('wbInput').value, 'ABCD', 'paste normalizes whitespace and punctuation');
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

// Fourth-lock edition guidance must be set before focus and reset on every other door.
const vaultMarkup = fs.readFileSync('src/pages/vault.astro', 'utf8');
const defaultHint = vaultMarkup.match(/data-default-hint="([^"]+)"/)[1];
const fourthHint = vaultMarkup.match(/data-fourth-hint="([^"]+)"/)[1];
const fourthBookLabel = vaultMarkup.match(/data-fourth-book-label="([^"]+)"/)[1];
const fourthBookUrl = vaultMarkup.match(/data-fourth-book-url="([^"]+)"/)[1];
assert.match(fourthHint, /only in the original Volume 1/);
assert.match(fourthHint, /not included in the Large Print Gift Edition/);
for (const file of ['src/scripts/vault3d.js', 'public/js/painted-vault.js']) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('function setWordboxHint(');
  const end = text.indexOf('function closeWordbox(', start);
  const nodes = new Map(), focusedHints = [], focusedLinkCounts = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const hint = node('wbHint');
  hint.children = []; let hintText = '';
  Object.defineProperty(hint,'textContent',{get(){ return hintText + this.children.map(c=>c.textContent).join(''); },set(v){ hintText = v; this.children = []; }});
  hint.appendChild = child => { hint.children.push(child); };
  hint.dataset = { defaultHint, fourthHint, fourthBookLabel, fourthBookUrl };
  node('wbInput').focus = () => { focusedHints.push(hint.textContent); focusedLinkCounts.push(hint.children.filter(c=>c.className === 'wb-book').length); };
  const context = vm.createContext({
    document: { getElementById: node, createElement: element, createTextNode: text => ({textContent:text}) }, $: node, window: {},
    wbMsg: node('wbMsg'), wordboxEl: node('wordbox'), wbInput: node('wbInput'),
    DOORS: Object.fromEntries(['first','door2','door3','fourth'].map(k => [k,{kicker:k,vo:k}])),
    VO: Object.fromEntries(['first','door2','door3','fourth'].map(k => [k,{text:'unchanged clue '+k}])),
    invalidateWordbox() {}, psEvent() {}, psTouch() {}, keeper() {},
    PS_EV: { WORDBOX_OPEN: 'wordbox.open' }, GALLERY:false, GUEST:null,
  });
  vm.runInContext("let wbTarget=null,wbWord='',wbBusy=false;" + text.slice(start,end),context);
  for (const key of ['fourth','fourth','first','fourth','door2','fourth','door3']) {
    vm.runInContext('openWordbox('+JSON.stringify(key)+')',context);
    const expected = key === 'fourth' ? fourthHint : defaultHint;
    assert.equal(node('wbHint').textContent,expected,file+': correct door guidance');
    assert.equal(focusedHints.at(-1),expected,file+': guidance exists before input focus');
    assert.equal(node('wbLine').textContent,'unchanged clue '+key,file+': original clue preserved');
    const links = hint.children.filter(c=>c.className === 'wb-book');
    assert.equal(links.length,key === 'fourth'?1:0,file+': one fourth-book link, none at other doors');
    assert.equal(focusedLinkCounts.at(-1),key === 'fourth'?1:0,file+': link state exists before focus');
    if (key === 'fourth') {
      assert.equal(links[0].textContent,fourthBookLabel); assert.equal(links[0].href,'https://www.amazon.com/dp/B0HB9K8PXC');
      assert.equal(links[0].target,'_blank'); assert.equal(links[0].rel,'noopener noreferrer');
    }
  }
  console.log('PASS '+(file.includes('painted')?'painted':'3D')+' fourth-lock book note, all other doors reset, focus order, original clues');
}
