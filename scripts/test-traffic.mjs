#!/usr/bin/env node
// Fixture tests for the Keeper's arrival lines: the browser's referrer naming, the FULL delivery path
// (browser cut → server character filter → grammar), and the guess line. Every case here is a real
// mistake a reviewer found on 2026-09-28.
//   node scripts/test-traffic.mjs          (exits 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validExtra, EXTRA_ALLOWED } from '../src/lib/events.js';
import { safeExtra } from '../src/lib/keeper-telegram.js';
import { guessSource, returningNote } from '../src/lib/traffic-guess.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = fs.readFileSync(path.join(here, '..', 'public', 'js', 'events.js'), 'utf8');
// Lift the browser's naming functions out of the IIFE and run them against fake pages.
const chunk = pub.slice(pub.indexOf('  var SOURCES'), pub.indexOf('  function device()'));
const load = (ref, search = '', lang = 'en-US', store = {}) => new Function('document', 'location', 'URLSearchParams', 'localStorage', 'sessionStorage', 'navigator',
  chunk + '; return { referrerName, language, visitLabel, sinceLast, vaultsOpened, keeperMark };')(
  { referrer: ref }, { search, hostname: 'puzzlesecret.com' }, URLSearchParams,
  { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  { getItem: () => null, setItem() {}, removeItem() {} }, { language: lang });

let fail = 0;
const eq = (label, got, want) => { if (got !== want) { fail++; console.log(`✗ ${label}\n    got:  ${got}\n    want: ${want}`); } else console.log(`✓ ${label}`); };
const has = (label, got, frag, not = false) => { const ok = not ? !got.includes(frag) : got.includes(frag); if (!ok) { fail++; console.log(`✗ ${label}\n    got: ${got}\n    ${not ? 'must NOT contain' : 'must contain'}: ${frag}`); } else console.log(`✓ ${label}`); };

// ── referrer naming ──
const R = (ref) => load(ref).referrerName();
eq('miowandmolly.com → outlet id', R('https://www.miowandmolly.com/10-gift/'), 'miowandmolly');
eq('look-alike miowandmolly.com.evil.io is not her', R('https://miowandmolly.com.evil.io/'), 'another site .io');
eq('Gmail app → email', R('android-app://com.google.android.gm/'), 'email');
eq('Google app → google', R('android-app://com.google.android.googlequicksearchbox/'), 'google');
eq('Telegram app → telegram', R('android-app://org.telegram.messenger/'), 'telegram');
eq('Outlook safe links → email', R('https://eur01.safelinks.protection.outlook.com/?url=x'), 'email');
eq('google.co.uk → google', R('https://www.google.co.uk/'), 'google');
eq('gemini.google.com → gemini', R('https://gemini.google.com/'), 'gemini');
eq('plumbingsupply.co.uk is not bing', R('https://plumbingsupply.co.uk/'), 'another site .uk');
eq('us.mensa.org is not Magazín Mensa', R('https://us.mensa.org/'), 'another site');
eq('mensa.cz → mensa', R('https://www.mensa.cz/'), 'mensa');
eq('dailymessenger.com is not messenger', R('https://dailymessenger.com/'), 'another site');
eq('no referrer → direct', R(''), 'direct');
eq('our own page → inside', R('https://puzzlesecret.com/play'), 'inside');
eq('utm wins', load('https://x.com/', '?utm_source=MiowAndMolly').referrerName(), 'utm miowandmolly');

// ── language ──
eq('en-GB', load('', '', 'en-GB').language(), 'en-GB');
eq('fil-PH is not Finnish', load('', '', 'fil-PH').language(), '');
eq('zh-Hans-CN → zh-CN', load('', '', 'zh-Hans-CN').language(), 'zh-CN');

// ── visits ──
eq('fresh browser → first visit', load('', '', 'en', {}).visitLabel(), 'first visit');
eq('tagged before the counter → returning', load('', '', 'en', { ps_vid: 'abcd1234' }).visitLabel(), 'visit 2');
eq('many visits → 10 or more', load('', '', 'en', { ps_visits: '41' }).visitLabel(), 'visit 10 or more');
eq('?keeper=me marks the browser', load('', '?keeper=me').keeperMark(), true);

// ── grammar: composed lines pass, hostile ones do not ──
for (const x of ['home from miowandmolly · desktop · first visit · en-GB', 'play from another site .uk · phone · visit 3 · 1 vault opened · en-GB',
  'home from direct · desktop · visit 10 or more · 3 vaults opened · en-US · keeper', 'home · desktop', 'home from another site · desktop'])
  eq(`grammar accepts: ${x}`, validExtra('arrive', x), x);
for (const x of ['home from example.com · desktop', 'home from another site .co.uk · desktop', 'home from another site .com · desktop', 'home · desktop · visit 12345', 'home · desktop · visit 10+'])
  eq(`grammar drops: ${x}`, validExtra('arrive', x), '');

// ── the full delivery path ──
// 2026-09-28: a 64-char browser cut and a "+" the server strips had been silently dropping the
// richest lines. Every line the browser can compose must come out of all three steps intact.
{
  const cap = Number((pub.match(/slice\(0, ev === CLIENT_EV\.ARRIVE \? (\d+) : 64\)/) || [])[1]);
  eq('browser arrive cap matches the server', cap, EXTRA_ALLOWED.arrive);
  const pages = ['home', 'escape-room-sudoku-book', 'how-to-play-sudoku'];
  const srcs = ['', ' from utm abcdefghijklmnop', ' from another site .uk', ' from roomescapeartist', ' from mysteriouswritings', ' from direct'];
  const devs = [' · phone', ' · desktop'];
  const visits = ['', ' · first visit', ' · visit 9 · back same day', ' · visit 10 or more · back after 365 days', ' · visit 2 · back after 1 day'];
  const vaults = ['', ' · 1 vault opened', ' · 4 vaults opened'];
  const langs = ['', ' · en-GB'];
  const me = ['', ' · keeper'];
  let n = 0, bad = '';
  for (const a of pages) for (const b of srcs) for (const c of devs) for (const d of visits) for (const e of vaults) for (const f of langs) for (const g of me) {
    const line = a + b + c + d + e + f + g; n++;
    const got = validExtra('arrive', safeExtra(line.slice(0, cap), EXTRA_ALLOWED.arrive));
    if (got !== line && !bad) bad = line;
  }
  if (bad) { fail++; console.log(`✗ full path drops a line the browser can send: ${bad} (${bad.length} chars)`); }
  else console.log(`✓ full path keeps all ${n} composable arrive lines intact`);
}

// ── the guess ──
const T = Date.parse('2026-09-29T12:00:00Z');
has('tagged outlet link is named', guessSource('home from utm miowandmolly · desktop · first visit', 'GB', T), 'link from Miow and Molly');
has('unknown .uk site is NOT guessed as Miow and Molly (new format)', guessSource('home from another site .uk · desktop · first visit · en-GB', 'GB', T), 'Miow', true);
has('old-format line may still guess a published outlet', guessSource('home from another site · desktop', 'GB', T), 'maybe Miow and Molly');
has('forged utm "constructor" names nothing', guessSource('home from utm constructor · desktop', 'US · NY', T), 'not on file');
// ── the returning-visitor line (Dan, 2026-09-28) ──
has('one vault is not proof of the book (guest keys)', returningNote('home from direct · desktop · visit 2 · 1 vault opened'), 'has the book', true);
has('vaults read as history, not now', returningNote('home from direct · desktop · visit 2 · 1 vault opened'), 'so far');
has('two vaults is', returningNote('home from direct · desktop · visit 4 · 2 vaults opened'), 'has the book');
has('a repeat visitor is flagged', returningNote('home from google · phone · visit 2'), '🔁 RETURNING VISITOR: visit 2');
has('the gap since last visit shows', returningNote('home from direct · desktop · visit 5 · back after 3 days'), 'last here 3 days ago');
has('same-day return reads as earlier today', returningNote('home from direct · desktop · visit 3 · back same day'), 'earlier today');
eq('a first visit gets no returning line', returningNote('home from direct · desktop · first visit'), '');
eq('an old-format line gets no returning line', returningNote('home from direct · desktop'), '');
eq('your own device gets no returning line', returningNote('home from direct · desktop · visit 10 or more · keeper'), '');
eq('sinceLast: first time → nothing', load('', '', 'en', {}).sinceLast(), '');
eq('sinceLast: same day', load('', '', 'en', { ps_last_day: String(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) }).sinceLast(), 'back same day');
has('unpublished outlet tag reads as them testing', guessSource('home from utm bigpinekey · desktop · first visit', 'US · NY', T), 'them testing');
has('a pitched outlet\'s own SITE sending someone reads as possible new coverage', guessSource('home from bookriot · desktop · first visit', 'US · CA', T), 'new coverage');
has('keeper device reads as you', guessSource('home from direct · desktop · visit 10 or more · 3 vaults opened · en-US · keeper', 'US · NY', T), '🏠 you');
has('direct to a non-home page says saved or shared', guessSource('shop from direct · desktop · first visit', 'US · TX', T), 'saved or shared');
has('back-page first visit reads as a crawler', guessSource('privacy from direct · desktop · first visit', 'CN', T), 'crawler');
has('a burst names the email possibility', guessSource('home from direct · desktop · first visit', 'US · IA', T, 2), 'email just went out');
has('same-country pair from an unreached country reads as bots', guessSource('escape-room-sudoku-book from direct · desktop · first visit', 'CN', T, 0, 1), 'likely bots');
has('same-country pair from a reached country does not', guessSource('home from direct · desktop · first visit', 'GB', T, 0, 1), 'bots', true);
has('google says Gmail is possible', guessSource('home from google · desktop · first visit', 'GB', T), 'Gmail');
has('Mysterious Writings is not guessed without evidence it names the site', guessSource('home from direct · desktop', 'US · CA', Date.parse('2026-09-26T12:00:00Z')), 'Mysterious', true);
has('before an outlet published, it is never guessed', guessSource('home from another site · desktop', 'GB', Date.parse('2026-09-27T00:00:00Z')), 'Miow', true);

// Every guess, worst case (longest outlet, unpublished, returning, vaults held), must fit a phone.
{
  const heads = ['home from utm sarcasticallyyou', 'escape-room-sudoku-book from another site .uk', 'how-to-play-sudoku from direct', 'home from utm geocachingpodcast', 'home from mysteriouswritings', 'home from email', 'home from google', 'privacy from direct'];
  const tails = [' · desktop · first visit', ' · phone · visit 9 · 1 vault opened', ' · desktop · visit 10 or more · 4 vaults opened', ' · desktop'];
  let worst = '';
  for (const h of heads) for (const t of tails) for (const p of ['GB', 'US · NY', 'CN']) for (const [b, k] of [[0, 0], [3, 0], [0, 2]]) {
    const g = guessSource(h + t, p, T, b, k); if (g.length > worst.length) worst = g;
  }
  if (worst.length > 90) { fail++; console.log(`✗ longest guess is ${worst.length} chars: ${worst}`); }
  else console.log(`✓ longest guess fits a phone (${worst.length}): ${worst}`);
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
