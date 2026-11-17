// Isolated API fixtures: never imports environment-backed modules or makes network requests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/pages/api/visitors.js', import.meta.url), 'utf8');
const places = JSON.parse(readFileSync(new URL('../src/data/visitor-places2.json', import.meta.url), 'utf8'));
const executable = source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '') + '\n;globalThis.endpoint = { GET };';
const rows = Array.from({ length: 203 }, (_, n) => ({
  i: `A${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + n % 26)}`,
  cc: 'GB', r: '', p: '', t: '2026-11-17T12:34:56Z', room: n % 2 ? 'book' : 'pinpoint',
  privateEmail: 'private@example.invalid', ip: '192.0.2.1',
}));
function harness(initial, hook = 'https://fixture.invalid/read-only') {
  let payload = initial, fails = false, calls = 0, now = 1000000;
  class Clock extends Date { static now() { return now; } }
  const sandbox = {
    createHash, PLACES: places, HOOK: hook, AUTH: '', RE_VISIT_KEY: /^(?:[A-Z]{2}|(?:US|CA)-[A-Z]{2})$/,
    Response, URL, AbortSignal, Date: Clock,
    notify() { throw Error('Notification forbidden in fixture'); }, isBot() { return false; }, quietPlace() { return false; },
    async fetch(url, options) {
      calls++;
      assert.equal(new URL(url).hostname, 'fixture.invalid');
      assert.equal(new URL(url).searchParams.get('tab'), 'visitors');
      assert.equal(options.method, undefined, 'Only the existing GET may be used');
      if (fails) throw Error('Fixture offline');
      return { json: async () => payload };
    },
  };
  vm.runInNewContext(executable, sandbox, { filename: 'visitors.fixture.js' });
  return {
    async get(query = '', country = 'GB') {
      const request = new Request(`https://local.invalid/api/visitors${query}`, { headers: { 'x-vercel-ip-country': country } });
      const response = await sandbox.endpoint.GET({ request });
      return { status: response.status, data: await response.json() };
    },
    update(next) { payload = next; now += 61000; },
    offline() { fails = true; now += 61000; },
    get calls() { return calls; },
  };
}
const payload = { ok: true, rows, total: 250, visits: { GB: 9, XX: 5 }, site: { GB: 8, 'GB-private': 1 } };
const h = harness(payload);
const legacy = await h.get();
assert.equal(legacy.status, 200);
assert.equal(legacy.data.entries.length, 150);
assert.equal(legacy.data.availableTotal, 203);
assert.equal(legacy.data.total, 250, 'Reported total must remain distinct from available rows');
const first = (await h.get('?limit=10')).data;
assert.equal(first.entries.length, 10);
assert.equal(first.nextCursor, 'v1.10');
assert.equal(first.prevCursor, null);
assert.equal(first.offset, 0);
assert.match(first.snapshot, /^[a-f0-9]{64}$/);
assert.equal(h.calls, 1, 'All pages use the cached full sanitized collection');
let page = first, collected = [...first.entries];
while (page.nextCursor) {
  const result = await h.get(`?limit=10&cursor=${page.nextCursor}&snapshot=${first.snapshot}`);
  assert.equal(result.status, 200);
  page = result.data;
  collected.push(...page.entries);
}
assert.equal(collected.length, 203);
assert.deepEqual(collected.map(e => e.i), rows.map(e => e.i), 'Stable upstream order extends past row 150');
assert.equal(page.offset, 200);
assert.equal(page.entries.length, 3);
assert.equal(page.nextCursor, null);
assert.equal(page.prevCursor, 'v1.190');
assert.equal(page.hasMore, false);
const prior = (await h.get(`?limit=10&cursor=${page.prevCursor}&snapshot=${first.snapshot}`)).data;
assert.equal(prior.entries[0].i, rows[190].i);
assert.equal((await h.get(`?cursor=v1.203&snapshot=${first.snapshot}`)).data.entries.length, 0);
for (const query of ['?limit=0', '?limit=26', '?limit=2.5', '?limit=1e1', '?limit=', '?cursor=-1', '?cursor=v1.01', '?cursor=v1.10', '?snapshot=no', '?limit=10&limit=20', `?cursor=v1.204&snapshot=${first.snapshot}`]) {
  const result = await h.get(query);
  assert.equal(result.status, 400, query);
  assert.equal(result.data.reason, 'bad_page');
}
assert.equal((await h.get('?limit=25')).data.entries.length, 25);
const encoded = JSON.stringify(first);
for (const privateText of ['12:34:56', 'privateEmail', 'private@example.invalid', '192.0.2.1', 'GB-private']) assert.ok(!encoded.includes(privateText));
assert.deepEqual(Object.keys(first.entries[0]).sort(), ['cc', 'i', 'm', 'p', 'r', 'rm']);
assert.deepEqual(first.visits, { GB: 9 });
assert.deepEqual(first.site, { GB: 8 });
assert.equal((await h.get('?limit=10', 'XX')).data.you, '');
// Changing private timestamps inside the same public month does not change the public snapshot.
h.update({ ...payload, rows: rows.map(row => ({ ...row, t: '2026-11-19T01:02:03Z' })) });
assert.equal((await h.get('?limit=10')).data.snapshot, first.snapshot);
h.update({ ...payload, rows: [{ ...rows[0], i: 'ZZZ' }, ...rows.slice(1)] });
const stale = await h.get(`?limit=10&cursor=v1.10&snapshot=${first.snapshot}`);
assert.equal(stale.status, 409);
assert.equal(stale.data.reason, 'page_changed');
h.offline();
assert.equal((await h.get('?limit=10')).status, 200, 'An upstream failure may serve the existing coherent snapshot');
const dirty = harness({ ok: true, rows: [null, { i: 'FU', cc: 'GB' }, { i: 'AB', cc: 'XX' }, { i: 'AB', cc: 'GB', p: 'Unlisted private village' }, ...rows], total: -1 });
const sanitized = (await dirty.get('?limit=10')).data;
assert.equal(sanitized.availableTotal, 203);
assert.equal(sanitized.total, 203);
const empty = (await harness({ ok: true, rows: [], total: 0 }).get('?limit=10')).data;
assert.equal(empty.entries.length, 0);
assert.equal(empty.availableTotal, 0);
assert.equal(empty.nextCursor, null);
assert.equal(empty.prevCursor, null);
const unavailable = harness(payload); unavailable.offline();
assert.equal((await unavailable.get('?limit=10')).status, 502);
assert.equal((await harness({ ok: false }).get('?limit=10')).data.reason, 'book_unreachable');
assert.equal((await harness(payload, '').get('?limit=10')).status, 503);
console.log('PASS: isolated Visitors API paging, 203 rows, legacy 150, bounds, stable/stale snapshots, privacy, empty and error fixtures. No network or environment access.');
