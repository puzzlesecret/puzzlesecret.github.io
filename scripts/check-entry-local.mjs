// Execution uses synthetic fixtures. Source inspection reads the production API
// and Gift registration file for collision checks; no .env or private answer
// datasets are read. Production registrations are replaced before execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { entryContext, assertUniqueRegistrations } from '../src/lib/entry-context.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const salt = 'synthetic-entry-test-salt';
const fixtures = [
  ['TESTALPHA', { act: 'I' }], ['TESTBRAVO', { act: 'II' }], ['TESTCHARLIE', { act: 'III' }],
  ['TESTGIFTONE', { act: 'I', edition: 'gift' }], ['TESTGIFTTWO', { act: 'II', edition: 'gift' }],
  ['TESTGIFTEND', { act: 'III', edition: 'gift' }],
  ['TESTCOVER', { act: 'I', edition: 'gift-cover', guest: 'Gift cover' }],
  ['TESTGUEST', { act: 'I', guest: 'Synthetic outlet' }],
  ['TESTPIN', { act: 'I', guest: 'Synthetic PinPoint', room: 'pinpoint' }],
  ['TESTWEEK', { act: 'I', guest: 'Pinterest synthetic-week' }],
  ['TESTHIDDEN', { act: 'IV', hidden: true }],
  ['TESTUNKNOWN', { act: 'I', bookId: 'unknown' }],
  ['TESTFUTURE', { act: 'I', bookId: 'v2-original' }],
  ['TESTEDITION', { act: 'I', edition: 'unknown' }],
].map(([word, hit]) => [word, { reward: 'Fixture reward', tier: 'easy', discount: 10, ...hit }]);
const hashes = Object.fromEntries(fixtures.map(([word, hit]) => [createHash('sha256').update(salt + '|' + word).digest('hex'), hit]));
const ledger = { notifications: 0, rewards: 0, network: 0 };
globalThis.__entryTestLedger = ledger;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { ledger.network++; throw new Error('Network forbidden in entry tests'); };
let checks = 0;
function verify(condition, message) { assert(condition, message); checks++; }

async function loadApi(configured = true) {
  let source = fs.readFileSync(path.join(root, 'src/pages/api/unlock.js'), 'utf8');
  source = source.replace(/import \{ GIFT_HASHES \} from [^;]+;/, '');
  source = source.replace(/import \{ entryContext \} from [^;]+;/,
    `import { entryContext } from ${JSON.stringify(pathToFileURL(path.join(root, 'src/lib/entry-context.js')).href)};`);
  source = source.replace(/import \{ notify, solverTag, place, isBot, quietPlace \} from [^;]+;/,
    "const notify=async()=>{globalThis.__entryTestLedger.notifications++;}; const solverTag=()=> 'test'; const place=()=> 'test'; const isBot=()=>true; const quietPlace=()=>true;");
  source = source.replace(/import \{ rewardUrl \} from [^;]+;/,
    "const rewardUrl=(act)=>{globalThis.__entryTestLedger.rewards++;return '/mock-reward/'+act;};");
  source = source.replace(/^const SALT = .*$/m, `const SALT = ${JSON.stringify(configured ? salt : '')};`);
  source = source.replace(/import\.meta\.env\.GUEST_ROOM_PINPOINT \?\? process\.env\.GUEST_ROOM_PINPOINT/g, "'fixture-a|fixture-b|fixture-c|fixture-d'");
  const start = source.indexOf('const HASHES = {');
  const end = source.indexOf('\n};', start);
  assert(start >= 0 && end > start, 'Synthetic hash boundary not found');
  source = source.slice(0, start) + 'const HASHES = ' + JSON.stringify(hashes) + ';' + source.slice(end + 3);
  return import('data:text/javascript;base64,' + Buffer.from(source + `\n// configured:${configured}`).toString('base64'));
}

try {
  // Inspect literal keys before JavaScript object construction can discard a
  // duplicate. This covers original, hidden, outlet, weekly, Gift, and cover keys.
  const registryKeys = ['src/pages/api/unlock.js', 'src/lib/gift-unlocks.js'].map((file) =>
    [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/['"]([a-f0-9]{64})['"]\s*:/g)].map((match) => match[1]));
  verify(registryKeys.every((keys) => keys.length > 0), 'All registries must be inspected');
  verify(assertUniqueRegistrations(registryKeys), 'Global registrations must be unique');
  const collision = createHash('sha256').update('synthetic-conflicting-registration').digest('hex');
  assert.throws(() => assertUniqueRegistrations([[collision], [collision]]), /activation blocked/); checks++;
  assert.throws(() => assertUniqueRegistrations([[collision, collision]]), /activation blocked/); checks++;
  const api = await loadApi();
  let ip = 0;
  const post = async (word, at = 'entry-hub', extra = {}, clientAddress = 'fixture-' + (++ip), target = api) => {
    const response = await target.POST({ request: new Request('http://localhost/api/unlock', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ word, at, vid: 'fixture', ...extra }),
    }), clientAddress });
    return { status: response.status, data: await response.json() };
  };
  for (const [word, hit] of fixtures.slice(0, 10)) {
    const hub = (await post(word)).data;
    // The Gift cover's word opens the Keeper's Gallery (act 'G', Dan 2026-11-24); its gift is still the first fifty.
    const expectedAct = hit.edition === 'gift-cover' ? 'G' : hit.act;
    verify(hub.ok && hub.act === expectedAct, 'Hub must preserve recognized act');
    if (hit.edition === 'gift-cover') verify(hub.rewardUrl === '/mock-reward/G', 'Gallery gift rides its own pass, not Vault I pass');
    const isGift = hit.edition === 'gift' || hit.edition === 'gift-cover';
    verify(hub.entry.bookId === (isGift ? 'v1-gift-01' : 'v1-original'), 'Correct book family');
    verify(hub.entry.volumeId === 'v1' && hub.entry.roomSetId === 'v1' && hub.entry.destination === '/vault', 'Allowlisted shared rooms');
    const expectedSource = hit.edition === 'gift-cover' ? 'gift-cover' : hit.guest ? 'guest' : isGift ? 'gift-book' : 'original-book';
    verify(hub.entry.source === expectedSource, 'Correct source');
    verify(Object.keys(hub.entry).sort().join() === 'bookId,bookTitle,destination,roomSetId,source,volumeId', 'Only safe entry metadata');
    const legacy = (await post(word, 'door')).data;
    const { entry, ...unchanged } = hub;
    assert.deepEqual(unchanged, legacy); checks++;
    if (hit.room) verify(hub.room?.id === 'pinpoint' || (hub.room && Object.keys(hub.room).length > 0), 'PinPoint story retained');
    if (hit.guest) verify(hub.guest === (hit.guest.startsWith('Pinterest ') ? 'pinterest' : 'outlet'), 'Guest state retained');
  }
  for (const at of ['door', '3d', 'painted', 'pinpoint', 'daily', 'gift-book', 'constructor', '__proto__', '']) {
    verify((await post('TESTALPHA', at)).data.ok, 'Legacy at route must still unlock');
    verify(!(await post('TESTALPHA', at)).data.entry, 'No added metadata on legacy routes');
  }
  verify((await post('TESTCOVER', 'gift-cover')).data.ok && (await post('TESTCOVER', 'gift-cover')).data.act === 'G', 'Cover route opens the Gallery');
  verify(!(await post('TESTGIFTEND', 'gift-cover')).data.ok, 'Legacy cover route rejects book');
  const beforeRejects = { ...ledger };
  for (const word of ['TESTHIDDEN', 'TESTUNKNOWN', 'TESTFUTURE', 'TESTEDITION', 'WRONGWORD', 'A']) {
    assert.deepEqual((await post(word)).data, { ok: false }); checks++;
  }
  assert.deepEqual(ledger, beforeRejects); checks++;
  verify((await post('TESTALPHA', 'entry-hub', { bookId: 'v2-original' })).data.entry.bookId === 'v1-original', 'Client cannot override server recognition');
  const hiddenLegacy = (await post('TESTHIDDEN', '3d')).data;
  verify(hiddenLegacy.ok && hiddenLegacy.hidden && hiddenLegacy.act === 'IV' && hiddenLegacy.lines?.length && hiddenLegacy.carveToken, 'Legacy hidden response preserved');
  for (let n = 0; n < 25; n++) verify((await post('WRONGWORD', 'entry-hub', {}, 'rate-fixture')).status === 200, 'Rate window allowance');
  verify((await post('TESTALPHA', 'entry-hub', {}, 'rate-fixture')).status === 429, 'Rate limit still applies');
  const offline = await loadApi(false);
  const beforeOffline = { ...ledger };
  const response = await post('TESTALPHA', 'entry-hub', {}, undefined, offline);
  verify(response.status === 503 && response.data.error === 'vault_offline', 'Missing config fails closed');
  assert.deepEqual(ledger, beforeOffline); checks++;
  // Activation invariants are exercised independently of current catalog contents.
  for (const book of [null, { entryReady: false, roomSetId: 'v1' }, { entryReady: true, roomSetId: 'v2' }, { entryReady: true, roomSetId: '__proto__' }]) {
    verify(entryContext({ act: 'I', bookId: 'future' }, () => book) === null, 'Future/unknown routes fail closed');
  }
  const original = { id: 'v1-original', volumeId: 'v1', editionType: 'original', entryReady: true, roomSetId: 'v1', title: 'Fixture' };
  for (const mutation of [{ id: 'v1-gift-01' }, { volumeId: 'v2' }, { editionType: 'gift' }, { roomSetId: 'v2' }]) {
    verify(entryContext({ act: 'I' }, () => ({ ...original, ...mutation })) === null, 'Catalog cannot alter server route tuple');
  }
  for (const hit of [
    { act: 'I', edition: 'gift', bookId: 'v1-original' },
    { act: 'I', bookId: 'v1-gift-01' }, { act: 'I', volumeId: 'v2' }, { act: 'I', roomSetId: 'v2' },
    { act: 'II', guest: 'Fixture outlet' }, { act: 'II', edition: 'gift-cover' },
    { act: 'I', edition: 'gift', guest: 'Fixture outlet' },
    { act: 'I', room: 'pinpoint' }, { act: 'I', guest: 'Fixture outlet', room: 'unknown' },
  ]) verify(entryContext(hit) === null, 'Invalid registration tuple fails closed');
  // Server-only policy injection models five parents with five independently
  // registered Gift editions each. Nothing here activates public products.
  const fixtureBooks = new Map();
  const fixturePolicy = { books: {}, parents: {} };
  for (let volume = 1; volume <= 5; volume++) {
    const volumeId = 'v' + volume;
    fixturePolicy.parents[volumeId] = { roomSetId: volumeId, destination: '/fixture/' + volumeId, acts: ['I', 'II', 'III'] };
    for (let edition = 0; edition <= 5; edition++) {
      const id = volumeId + (edition ? '-gift-0' + edition : '-original');
      const editionType = edition ? 'gift' : 'original';
      fixtureBooks.set(id, { id, volumeId, title: 'Synthetic catalog book', editionType, roomSetId: volumeId, entryReady: true });
      fixturePolicy.books[id] = { volumeId, editionType };
    }
  }
  const lookupFixture = (id) => fixtureBooks.get(id);
  for (const book of fixtureBooks.values()) {
    for (const act of ['I', 'II', 'III']) {
      const result = entryContext({ bookId: book.id, act, ...(book.editionType === 'gift' ? { edition: 'gift' } : {}) }, lookupFixture, fixturePolicy);
      verify(result?.bookId === book.id && result.volumeId === book.volumeId && result.roomSetId === book.volumeId && result.destination === '/fixture/' + book.volumeId, 'Each registered book shares only its parent rooms');
    }
    if (book.editionType === 'gift') {
      const cover = { bookId: book.id, act: 'I', edition: 'gift-cover', guest: 'Synthetic cover' };
      verify(entryContext(cover, lookupFixture, fixturePolicy)?.source === 'gift-cover', 'Every registered Gift cover selects its own book');
      verify(entryContext({ ...cover, act: 'II' }, lookupFixture, fixturePolicy) === null, 'Every Gift cover remains act I only');
      verify(entryContext({ bookId: book.id, act: 'I' }, lookupFixture, fixturePolicy) === null, 'Original word source cannot select a Gift policy');
    }
  }
  verify(fixtureBooks.size === 30, 'Five parent catalogs with original plus five Gifts each');
  verify(entryContext({ bookId: 'v1-gift-02', act: 'I', edition: 'gift' }, lookupFixture) === null, 'Fixture catalog cannot activate unregistered default books');
  const disabledParent = { ...fixturePolicy, parents: {} };
  verify(entryContext({ bookId: 'v1-gift-02', act: 'I', edition: 'gift' }, lookupFixture, disabledParent) === null, 'Explicit parent route activation required');
  const invalidDestination = { ...fixturePolicy, parents: { ...fixturePolicy.parents, v1: { ...fixturePolicy.parents.v1, destination: '//external.example' } } };
  verify(entryContext({ bookId: 'v1-gift-02', act: 'I', edition: 'gift' }, lookupFixture, invalidDestination) === null, 'Even registered parent policies reject external destinations');
  verify(ledger.network === 0, 'No external calls');
  console.log(JSON.stringify({ ok: true, checks, fixtureWordsOnly: true, notifications: 'mocked', rewards: 'mocked', network: 'blocked', serverSourcesInspected: true, environmentFilesRead: false, privateAnswerDatasetsRead: false }));
} catch (error) {
  // A data-URL stack embeds the full server module. Never print that stack.
  console.error(JSON.stringify({ ok: false, error: String(error.message).slice(0, 500) }));
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__entryTestLedger;
}
