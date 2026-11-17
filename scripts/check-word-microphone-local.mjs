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
button.click(); button.click(); verify(!s.control.active && status.textContent.includes('stopped'));
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
