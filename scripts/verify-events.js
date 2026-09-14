#!/usr/bin/env node
// Diff the three places an event name lives, and fail if any drift.
//   1. site/src/lib/events.js         → the server allowlist + Keeper-voice formatter
//   2. site/public/js/events.js       → the browser mirror the painted vault uses
//   3. site/src/scripts/vault3d.js    → the inline PS_EV table the 3D crawl uses
//
// Run: node site/scripts/verify-events.js
// CI-ready: exits 0 on match, 1 on any missing/extra name. Prints a Keeper-voice diff.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_EV, SERVER_EV } from '../src/lib/events.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootSite = path.resolve(here, '..');

const pub = fs.readFileSync(path.join(rootSite, 'public', 'js', 'events.js'), 'utf8');
const v3d = fs.readFileSync(path.join(rootSite, 'src', 'scripts', 'vault3d.js'), 'utf8');

function extractPairs(source, marker) {
  // Grabs `KEY: 'value'` pairs out of the first Object.freeze({...}) block after `marker`.
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  const close = source.indexOf('});', open);
  if (open < 0 || close < 0) return null;
  const body = source.slice(open + 1, close);
  const pairs = {};
  const re = /(\w+)\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(body))) pairs[m[1]] = m[2];
  return pairs;
}

const pubPairs = extractPairs(pub, 'CLIENT_EV');
const v3dPairs = extractPairs(v3d, 'PS_EV = Object.freeze');
const serverPairs = { ...CLIENT_EV };

if (!pubPairs || !v3dPairs) {
  console.error('verify-events: could not parse one of the client mirrors.');
  process.exit(1);
}

const problems = [];
const serverKeys = Object.keys(serverPairs).sort();

for (const key of serverKeys) {
  const want = serverPairs[key];
  if (pubPairs[key] !== want) problems.push(`public/js/events.js  is missing or mismatched: ${key} → expected "${want}", got "${pubPairs[key]}"`);
  if (v3dPairs[key]  !== want) problems.push(`src/scripts/vault3d.js is missing or mismatched: ${key} → expected "${want}", got "${v3dPairs[key]}"`);
}

// Extras (present in a client but not on the server) are still a problem — a stray event
// would 204 silently and Dan would wonder why he never sees a line.
for (const key of Object.keys(pubPairs)) if (!(key in serverPairs)) problems.push(`public/js/events.js has an unknown key: ${key} (add to src/lib/events.js first)`);
for (const key of Object.keys(v3dPairs)) if (!(key in serverPairs)) problems.push(`src/scripts/vault3d.js has an unknown key: ${key} (add to src/lib/events.js first)`);

if (problems.length) {
  console.error('The Keeper counts, and the totals do not match.');
  problems.forEach((p) => console.error('  · ' + p));
  process.exit(1);
}

console.log(`✓ ${serverKeys.length} client events aligned across server + both browser modules.`);
console.log(`  Server-only events (not accepted from browsers): ${Object.keys(SERVER_EV).join(', ')}`);
process.exit(0);
