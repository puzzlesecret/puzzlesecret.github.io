import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('src/scripts/vault3d.js', 'utf8');
class Element {
  constructor() { this.children = []; this.hidden = false; this.disabled = false; this.value = ''; this.listeners = {}; }
  set textContent(value) { this.text = value; this.children = []; } get textContent() { return this.text || ''; }
  appendChild(child) { this.children.push(child); } setAttribute() {} addEventListener(type, cb) { this.listeners[type] = cb; }
}
const elements = new Map();
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); } };
const responses = [], requests = [];
const state = { pageEntries: null, pageTotal: 0, offset: 0, snapshot: '', nextCursor: null, prevCursor: null, loading: false, pageError: '', request: 0, total: 100, entries: [{ i: 'GLOBE' }] };
const mine = { i: 'ME' };
const context = vm.createContext({ document, URLSearchParams, vbState: state, study: { signed: mine },
  vbList: document.getElementById('vbList'), vbCount: document.getElementById('vbCount'),
  vbRow: (e, own) => ({ e, own }), vbSame: (a, b) => a?.i === b?.i,
  fetch: async (url) => { requests.push(url); const next = responses.shift(); if (next instanceof Error) throw next; return next; },
});
vm.runInContext(source.slice(source.indexOf('const vbNewer ='), source.indexOf('async function vbLoad()')), context);
const page = (offset, extra = {}) => ({ ok: true, status: 200, json: async () => ({ ok: true, entries: Array.from({ length: 10 }, (_, i) => ({ i: String(offset + i) })), total: 100, availableTotal: 53, offset, snapshot: 'stable', nextCursor: 'v1.' + (offset + 10), prevCursor: offset ? 'v1.' + (offset - 10) : null, ...extra }) });
responses.push(page(0)); await vm.runInContext('vbLoadPage(0, true)', context);
assert.equal(requests[0], '/api/visitors?limit=10');
assert.equal(elements.get('vbList').children.length, 10);
assert.match(elements.get('vbPageStatus').textContent, /1–10 of 53 latest available signatures \(100 signed in all\).*Page 1 of 6/);
assert.equal(elements.get('vbOwn').hidden, false);
assert.equal(elements.get('vbOwnList').children.length, 1);
assert.equal(state.entries[0].i, 'GLOBE');
responses.push(page(10)); await vm.runInContext("vbLoadPage('v1.10')", context);
assert.match(requests.at(-1), /snapshot=stable&cursor=v1.10/);
assert.match(elements.get('vbPageStatus').textContent, /11–20.*Page 2 of 6/);
responses.push(new Error('offline')); await vm.runInContext("vbLoadPage('v1.20')", context);
assert.equal(state.offset, 10); assert.equal(elements.get('vbRetry').hidden, false);
assert.equal(elements.get('vbList').children.length, 10);
responses.push({ ok: false, status: 409, json: async () => ({ reason: 'page_changed' }) }, page(0));
await vm.runInContext("vbLoadPage('v1.20')", context);
assert.equal(requests.at(-1), '/api/visitors?limit=10'); assert.match(elements.get('vbPageStatus').textContent, /book changed/);
responses.push(page(50, { entries: [{ i: 'ME' }, { i: '51' }, { i: '52' }], nextCursor: null }));
await vm.runInContext("vbLoadPage('v1.50')", context);
assert.match(elements.get('vbPageStatus').textContent, /51–53.*Page 6 of 6/);
assert.equal(elements.get('vbOlder').disabled, true); assert.equal(elements.get('vbOwn').hidden, true);
responses.push(page(0, { entries: [], total: 0, availableTotal: 0, nextCursor: null }));
await vm.runInContext('vbLoadPage(0, true)', context);
assert.match(elements.get('vbPageStatus').textContent, /Nobody has signed/);
const astro = fs.readFileSync('src/pages/vault.astro', 'utf8');
for (const id of ['notebook', 'draft', 'reward', 'pageview', 'wordbox', 'carvebox', 'roundEnd', 'lockbox', 'tilecard', 'farewell', 'certPanel', 'pvGame']) assert.match(astro, new RegExp(id + ": 'Close|" + id + ": 'Stay"));
assert.match(astro, /window\.__roomDismiss\(id\)/); assert.match(astro, /min-width: 44px; min-height: 44px/);
console.log('Room UI mocks passed: bounded pages, all-time vs available counts, stable cursors, stale reset, error/retry, own entry, empty/final pages, preserved globe summary and close-route inventory.');
// Exercise the real focus-restoration helper with nonfocusable and hidden origins.
const focusSource = astro.slice(astro.indexOf('      function restoreFocus(panel)'), astro.indexOf('      function dismiss(id)'));
let active;
const room = { getClientRects: () => [1], setAttribute: (name, value) => { assert.equal(name, 'tabindex'); assert.equal(value, '-1'); }, focus: () => { active = room; } };
const body = { classList: { contains: () => false } };
const focusBefore = new WeakMap(), panel = { contains: (el) => el === panel };
const focusContext = vm.createContext({ focusBefore, document: { body, get activeElement() { return active; }, getElementById: () => room } });
vm.runInContext(focusSource, focusContext); focusContext.panel = panel;
for (const origin of [body, { isConnected: true, getClientRects: () => [1], focus() {} }, { isConnected: true, getClientRects: () => [], focus() { throw new Error('hidden origin'); } }]) {
  focusBefore.set(panel, origin); active = panel; vm.runInContext('restoreFocus(panel)', focusContext); assert.equal(active, room);
}
const button = { isConnected: true, getClientRects: () => [1], focus() { active = button; } };
focusBefore.set(panel, button); vm.runInContext('restoreFocus(panel)', focusContext); assert.equal(active, button);
assert.match(astro, /backdrop-filter: none !important/);
assert.match(astro, /document.getElementById\('desk'\).prepend\(deskX\)/);
console.log('Close regression mocks passed: visible focus restoration, body/nonfocusable/hidden origin fallbacks, root fixed-containing-block reset, original desk exit reused.');

// A superseded request must not replace a newer page or its loading/error state.
let finishOld;
responses.push(new Promise((resolve) => { finishOld = resolve; }));
const oldRequest = vm.runInContext("vbLoadPage('v1.10')", context);
assert.equal(state.loading, true);
responses.push(page(20, { total: 105 }));
await vm.runInContext("vbLoadPage('v1.20')", context);
finishOld(page(10, { total: 99 })); await oldRequest;
assert.equal(state.offset, 20); assert.equal(state.total, 105); assert.equal(state.loading, false); assert.equal(state.pageError, '');

// A late globe-summary response must retain the paginated count while updating pins.
context.vbCc = { value: 'US' }; context.vbCcChanged = () => {};
vm.runInContext(source.slice(source.indexOf('async function vbLoad()'), source.indexOf('let vbCodesLoading = null;')), context);
let finishSummary;
responses.push(new Promise((resolve) => { finishSummary = resolve; }));
const summaryRequest = vm.runInContext('vbLoad()', context);
responses.push(page(30, { total: 110 })); await vm.runInContext("vbLoadPage('v1.30')", context);
finishSummary(page(0, { total: 100, entries: [{ i: 'SUMMARY' }] })); await summaryRequest;
assert.equal(state.total, 110); assert.equal(state.offset, 30); assert.equal(state.entries[0].i, 'SUMMARY');
responses.push(page(0, { entries: [], total: 100, availableTotal: 0, nextCursor: null }));
await vm.runInContext('vbLoadPage(0, true)', context);
assert.match(elements.get('vbPageStatus').textContent, /No signatures are currently available/);
assert.doesNotMatch(elements.get('vbPageStatus').textContent, /Nobody has signed/);
assert.doesNotMatch(astro, /max-height: 34vh/);
assert.match(astro, /\.room-panel\[id\].*top: max\(66px/);
assert.match(astro, /id="wbMicStatus".*role="status"/);
assert.ok(astro.indexOf('src="/js/word-microphone.js"') < astro.indexOf('<FlatVault />'));
console.log('Deferred-request regressions passed: newest page wins, late globe summary preserves count, unavailable archive copy, reserved header scroll lane, and shared room microphone wiring.');
