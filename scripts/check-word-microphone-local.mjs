import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('public/js/word-microphone.js', 'utf8');
let checks = 0;
const verify = (value) => { assert(value); checks++; };
function setup(Recognition = null, secure = true, extra = {}) {
  const listeners = {}, elements = new Map();
  for (const id of ['input', 'button', 'status']) elements.set(id, {
    dataset: {}, value: '', textContent: '', disabled: true,
    querySelector() { return this; }, setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; },
    addEventListener(k, fn) { this[k] = fn; }, dispatchEvent() { this.inputDispatched = true; }, focus() { this.focused = true; },
  });
  const window = { isSecureContext: secure, SpeechRecognition: Recognition, addEventListener(k, fn) { listeners[k] = fn; } };
  const document = { hidden: false, getElementById: (id) => elements.get(id), addEventListener(k, fn) { listeners[k] = fn; } };
  const context = vm.createContext({ window, document, Event, setTimeout, clearTimeout }); vm.runInContext(source, context);
  let starts = 0;
  const control = window.psWordMicrophone({ inputId: 'input', buttonId: 'button', statusId: 'status', beforeStart() { starts++; }, ...extra });
  return { window, document, elements, listeners, control, get starts() { return starts; } };
}
const instances = [];
class FakeRecognition { constructor() { instances.push(this); } start() { this.started = true; } abort() { this.aborted = true; } }
const s = setup(FakeRecognition), button = s.elements.get('button'), status = s.elements.get('status'), input = s.elements.get('input');
verify(!button.disabled && !s.control.active && instances.length === 0);
button.click(); const rec = instances.at(-1);
verify(s.starts === 1 && rec.started && button.dataset.micState === 'starting');
verify(!status.textContent.includes('Listening'));
rec.onstart(); verify(button.dataset.micState === 'listening');
rec.onaudiostart(); verify(status.textContent.includes('capturing audio'));
rec.onresult({ results: [[{ transcript: 'S Y N T H E T I C' }]] });
verify(input.value === 'S Y N T H E T I C' && input.focused && input.inputDispatched);
verify(!s.control.active && rec.aborted && button.dataset.micState === 'idle');
rec.onresult({ results: [[{ transcript: 'STALE' }]] }); verify(input.value === 'S Y N T H E T I C');
for (const [code, text] of [['not-allowed', 'blocked'], ['service-not-allowed', 'unavailable'], ['network', 'connect'], ['audio-capture', 'working microphone'], ['language-not-supported', 'English']]) {
  button.click(); instances.at(-1).onerror({ error: code }); verify(!s.control.active && status.textContent.includes(text));
}
button.click(); button.click(); verify(!s.control.active && status.textContent.includes('off'));
button.click(); s.document.hidden = true; s.listeners.visibilitychange(); verify(!s.control.active);
s.document.hidden = false; button.click(); s.listeners.pagehide(); verify(!s.control.active);
button.click(); s.control.stop('Audio playback requested.'); verify(!s.control.active && status.textContent.includes('Audio'));
const unsupported = setup(); verify(unsupported.elements.get('button').disabled && unsupported.elements.get('status').textContent.includes('does not offer'));
const insecure = setup(FakeRecognition, false); verify(insecure.elements.get('button').disabled);
class Throwing { constructor() { throw new Error('fixture'); } }
const broken = setup(Throwing); broken.elements.get('button').click(); verify(!broken.control.active && broken.elements.get('status').textContent.includes('could not start'));
verify(!/fetch\(|XMLHttpRequest|\.submit\(|requestSubmit|localStorage|sessionStorage/.test(source));
const strict = setup(FakeRecognition, true, { validateTranscript: () => 'Say one complete word.' });
strict.elements.get('input').value = 'KEEP'; strict.elements.get('button').click();
instances.at(-1).onresult({ results: [[{ transcript: 'OVERLONG WORD' }]] });
verify(strict.elements.get('input').value === 'KEEP' && strict.elements.get('status').textContent.includes('complete word') && !strict.control.active);
console.log(JSON.stringify({ ok: true, checks, microphone: 'mocked', network: 'none', uploads: 'none', autoSubmit: false }));

// Automatic entry is finite, cancellable, and never starts from programmatic focus.
const queued = setup(FakeRecognition);
let count = instances.length;
verify(queued.control.arm() && queued.control.active && instances.length === count);
queued.elements.get('button').click(); queued.control.start({ automatic: true });
verify(!queued.control.active && instances.length === count && !queued.control.arm());
const automatic = setup(FakeRecognition);
automatic.control.arm(); automatic.control.start({ automatic: true });
verify(instances.length === count + 1 && automatic.control.active);
instances.at(-1).onend(); automatic.control.arm(); automatic.control.start({ automatic: true });
verify(instances.length === count + 1 && !automatic.control.active);
const typing = setup(FakeRecognition); typing.control.arm();
typing.elements.get('input').input({ isTrusted: true }); typing.control.start({ automatic: true });
verify(!typing.control.active && !typing.control.arm());
const focused = setup(FakeRecognition, true, { autoOnFocus: true });
count = instances.length; focused.elements.get('input').focus();
verify(instances.length === count);
focused.elements.get('input').pointerdown({ isTrusted: true });
verify(instances.length === count + 1 && focused.control.active); focused.control.stop();
const tabbed = setup(FakeRecognition, true, { autoOnFocus: true });
count = instances.length; tabbed.listeners.keydown({ isTrusted: true, key: 'Tab' });
tabbed.elements.get('input').focus(); verify(instances.length === count + 1); tabbed.control.stop();
const delayed = setup(FakeRecognition);
let resolvePermission;
delayed.window.navigator = { permissions: { query: () => new Promise(r => { resolvePermission = r; }) } };
const pending = delayed.control.autoStartIfGranted(); delayed.control.stop();
resolvePermission({ state: 'granted' }); count = instances.length;
verify(await pending === false && instances.length === count);
for (const permission of ['prompt', 'denied', 'granted']) {
  const state = setup(FakeRecognition); count = instances.length;
  state.window.navigator = { permissions: { query: async () => ({ state: permission }) } };
  verify(await state.control.autoStartIfGranted() === (permission === 'granted'));
  verify(instances.length === count + (permission === 'granted' ? 1 : 0)); state.control.stop();
}
const hidden = setup(FakeRecognition); hidden.control.arm(); hidden.document.hidden = true;
hidden.listeners.visibilitychange(); hidden.document.hidden = false; hidden.control.start({ automatic: true });
verify(!hidden.control.active);
unsupported.control.start(); verify(!unsupported.control.active);
console.log(JSON.stringify({ ok: true, totalChecks: checks, automaticLifecycle: 'mocked', hardwareMicrophone: 'not tested' }));
// Independent-review regressions: cancellation of a pending permission lookup.
for (const action of ['typing-clear', 'hidden-return', 'pagehide']) {
  const pendingState = setup(FakeRecognition);
  let finish;
  pendingState.window.navigator = { permissions: { query: () => new Promise(r => { finish = r; }) } };
  const promise = pendingState.control.autoStartIfGranted();
  if (action === 'typing-clear') {
    pendingState.elements.get('input').value = 'EXAMPLE';
    pendingState.elements.get('input').input({ isTrusted: true });
    pendingState.elements.get('input').value = '';
  } else if (action === 'hidden-return') {
    pendingState.document.hidden = true; pendingState.listeners.visibilitychange(); pendingState.document.hidden = false;
  } else pendingState.listeners.pagehide();
  count = instances.length; finish({ state: 'granted' });
  verify(await promise === false && instances.length === count && !pendingState.control.active);
}
const armedBroken = setup(Throwing); armedBroken.control.arm(); armedBroken.control.start({ automatic: true });
verify(!armedBroken.control.active && armedBroken.elements.get('button').dataset.micState === 'idle');
verify(armedBroken.elements.get('button')['aria-pressed'] === 'false' && armedBroken.elements.get('button')['aria-label'] === 'Turn microphone on');
console.log(JSON.stringify({ ok: true, totalChecks: checks, criticRegressions: 5, hardwareMicrophone: 'not tested' }));
