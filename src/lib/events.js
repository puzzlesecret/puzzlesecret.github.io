// The vault's event vocabulary — the single source of truth shared by /api/event and both
// vault client modules. When a new event appears the same string lands in three places
// (server allowlist, 3D vault, painted vault) — this file is one of them, and
// `public/js/events.js` mirrors it (a static file for the painted vault, which is served
// as-is). `scripts/verify-events.js` diffs the two on demand.
//
// Rules of the road:
//   1. Never add an event whose name would be legible to a book reader (no secret words).
//   2. Client events (CLIENT_EV) are things the browser can emit. SERVER_EV is emitted only
//      by API routes and MUST NOT appear in the client-accepted allowlist below.
//   3. Every event is silent in production if TELEGRAM env vars are missing (fail-safe).
//   4. If you add an event, add a Keeper-voice line for it in `line()` below, and a row in
//      `_content/keeper-telegram-events.md`.
//
// v4 (2026-09-14): the feed is meant to read as one person's story — where they came in,
// what they tried, where they hesitated, where they stopped. So the shape of every line is
// now uniform and tag-first:
//
//     <icon> <tag> · <place> · <what happened>
//
// which lets Dan search Telegram for a tag and read a visit top to bottom.

// ── Client events (browser may POST /api/event with these) ─────────────────
export const CLIENT_EV = Object.freeze({
  // arrival — the very first line of a story
  ARRIVE:           'arrive',              // once per session; extra = "<page> from <site> · phone"
  PAGE_VIEW:        'page.view',           // every page after the first; extra = page

  // arrival / navigation inside the vault
  BOOKCASE_OPEN:    'bookcase.open',       // the odd book opens the passage to Vault I
  WORDBOX_OPEN:     'wordbox.open',        // the word box is presented (any door)
  WORDBOX_CLOSE:    'wordbox.close',       // the word box is dismissed WITHOUT a true word
  DOOR_OPEN_I:      'door.open.I',
  DOOR_OPEN_II:     'door.open.II',
  DOOR_OPEN_III:    'door.open.III',
  STAIR_DESCEND:    'stair.descend',       // crossed the sanctum stair going down
  STAIR_ASCEND:     'stair.ascend',        // came back up

  // reading / looking
  PAGE_NOTEBOOK:    'page.notebook',       // opened the Keeper's notebook
  PAGE_REJECTS:     'page.rejects',        // opened a discarded draft page
  STUDY_COMPLETE:   'study.complete',      // marked every study item
  DESK_SOLVED:      'desk.solved',         // solved today's page at the writer's desk

  // the two mini-games
  ROUND_START:      'round.start',         // Keeper's Round begins
  ROUND_SOLVED:     'round.solved',        // five found
  ROUND_FAIL:       'round.fail',          // the dark kept them (timed out)
  LOCK_START:       'lock.start',          // Listening Lock begins
  LOCK_SOLVED:      'lock.solved',         // chest opens

  // tiles
  TILE_5:           'tile.5',
  TILE_7:           'tile.7',

  // rewards (client sees a card, may click through to the PDF)
  REWARD_OPEN_I:    'reward.open.I',
  REWARD_OPEN_II:   'reward.open.II',
  REWARD_OPEN_III:  'reward.open.III',
  REWARD_OPEN_IV:   'reward.open.IV',
  REWARD_CLICK_I:   'reward.click.I',
  REWARD_CLICK_II:  'reward.click.II',
  REWARD_CLICK_III: 'reward.click.III',
  REWARD_CLICK_IV:  'reward.click.IV',

  // Vault IV
  VAULT4_FLOOR_OPEN:'vault4.floor_open',   // the slab grinds aside
  VAULT4_ENTERED:   'vault4.entered',      // player crosses down into the sanctum
  CARVE_OPEN:       'carve.open',          // opens the carve panel

  // friction — the signals that say "stuck"
  HINT_VIEW:        'hint.view',           // /hints loaded (once/session)
  HINT_REVEAL:      'hint.reveal',         // a word revealed on /hints; extra = act (I..IV)
  IDLE:             'idle',                // ~4 minutes in a vault room with no input; extra = room
  PERF_SLOW:        'perf.slow',           // the low-frame-rate bar appeared; extra = "12 fps"

  // the free puzzles on /play
  PLAY_START:       'play.start',          // first puzzle opened (once/session)
  PLAY_SOLVED:      'play.solved',         // a puzzle solved; extra = "easy · 3m12s"
  PLAY_OFFER:       'play.offer',          // the one-time book nudge appeared

  // the guided first puzzle on /how-to-play-sudoku (each once/session, no extra)
  LEARN_START:      'learn.start',         // first move of the guided puzzle taken
  LEARN_MID:        'learn.mid',           // reached the point where the book card appears
  LEARN_DONE:       'learn.done',          // guided puzzle finished

  // passport, sharing, off-site
  PASSPORT_VIEW:    'passport.view',       // /passport loaded
  SHARE_COPY:       'share.copy',
  OUTBOUND_AMAZON:  'outbound.amazon',     // clicked any Amazon/buy link; extra = page

  // each time the tab hides — the last one is the story's last line
  SESSION_DEPTH:    'session.depth',       // extra = "3D · 4 rooms · 12m · last the library"
});

// ── Server-emitted events (never accepted from a client) ──────────────────
export const SERVER_EV = Object.freeze({
  REWARD_SERVED_I:   'reward.served.I',
  REWARD_SERVED_II:  'reward.served.II',
  REWARD_SERVED_III: 'reward.served.III',
  REWARD_SERVED_IV:  'reward.served.IV',
});

// Fast lookup — the /api/event allowlist. Client-only.
export const ALLOW = Object.freeze(new Set(Object.values(CLIENT_EV)));

// Keeper-voice lines for every event: [icon, text]. `extra` is a small, already-sanitized
// string. These are the ONLY words sent to Telegram — no template strings from the client.
const DOOR_NAME = { first: 'the first door', door2: 'the second door', door3: 'the third door', fourth: 'the fourth door' };
// "door2 after 2 misses" → "at the second door after 2 misses"
const doorPhrase = (x) => x ? ' at ' + x.replace(/^(first|door2|door3|fourth)/, (k) => DOOR_NAME[k]) : '';

export function parts(ev, extra) {
  const e = extra ? ' — ' + extra : '';
  switch (ev) {
    // arrival
    case CLIENT_EV.ARRIVE:           return ['🚶', 'arrives' + (extra ? ' at ' + extra : '')];
    case CLIENT_EV.PAGE_VIEW:        return ['👉', 'moves to ' + (extra || 'another page')];

    // navigation
    case CLIENT_EV.BOOKCASE_OPEN:    return ['📕', 'opens the bookcase to Vault I'];
    case CLIENT_EV.WORDBOX_OPEN:     return ['🔤', 'the word box appears' + doorPhrase(extra)];
    case CLIENT_EV.WORDBOX_CLOSE:    return ['🚫', 'closes the word box' + doorPhrase(extra)];
    case CLIENT_EV.DOOR_OPEN_I:      return ['🚪', 'walks through the first door'];
    case CLIENT_EV.DOOR_OPEN_II:     return ['🚪', 'walks through the second door'];
    case CLIENT_EV.DOOR_OPEN_III:    return ['🚪', 'walks through the third door'];
    case CLIENT_EV.STAIR_DESCEND:    return ['⬇️', 'walks down into the sanctum'];
    case CLIENT_EV.STAIR_ASCEND:     return ['⬆️', 'climbs back out of the sanctum'];

    // reading
    case CLIENT_EV.PAGE_NOTEBOOK:    return ['📖', "opens the Keeper's notebook"];
    case CLIENT_EV.PAGE_REJECTS:     return ['📝', 'reads a discarded draft page'];
    case CLIENT_EV.STUDY_COMPLETE:   return ['🕯', 'has found every study item'];
    case CLIENT_EV.DESK_SOLVED:      return ['🖋', "solves today's page at the writer's desk" + e];

    // games
    case CLIENT_EV.ROUND_START:      return ['🕯', "begins the Keeper's Round"];
    case CLIENT_EV.ROUND_SOLVED:     return ['✨', "solves the Keeper's Round" + e];
    case CLIENT_EV.ROUND_FAIL:       return ['🌑', "the dark kept them — the Keeper's Round timed out"];
    case CLIENT_EV.LOCK_START:       return ['🔒', 'begins the Listening Lock'];
    case CLIENT_EV.LOCK_SOLVED:      return ['🔓', 'solves the Listening Lock'];

    // tiles
    case CLIENT_EV.TILE_5:           return ['🪙', 'picks up tile "5" (the library)'];
    case CLIENT_EV.TILE_7:           return ['🪙', 'picks up tile "7" (the treasure room)'];

    // rewards
    case CLIENT_EV.REWARD_OPEN_I:    return ['🎁', 'opens the Vault I reward card'];
    case CLIENT_EV.REWARD_OPEN_II:   return ['🎁', 'opens the Vault II reward card'];
    case CLIENT_EV.REWARD_OPEN_III:  return ['🎁', 'opens the Vault III reward card'];
    case CLIENT_EV.REWARD_OPEN_IV:   return ['🎁', 'opens the Vault IV reward card'];
    case CLIENT_EV.REWARD_CLICK_I:   return ['📥', 'clicks the Vault I gift'];
    case CLIENT_EV.REWARD_CLICK_II:  return ['📥', 'clicks the Vault II gift'];
    case CLIENT_EV.REWARD_CLICK_III: return ['📥', 'clicks the Vault III gift'];
    case CLIENT_EV.REWARD_CLICK_IV:  return ['📥', 'clicks the Vault IV gift'];

    // Vault IV
    case CLIENT_EV.VAULT4_FLOOR_OPEN:return ['🕯', 'the floor grinds open beneath them'];
    case CLIENT_EV.VAULT4_ENTERED:   return ['🌘', 'enters the sanctum'];
    case CLIENT_EV.CARVE_OPEN:       return ['🪨', 'opens the carve panel'];

    // friction
    case CLIENT_EV.HINT_VIEW:        return ['🆘', 'opens the Hint Chamber'];
    case CLIENT_EV.HINT_REVEAL:      return ['👀', 'reveals the ' + actName(extra) + ' word on /hints'];
    case CLIENT_EV.IDLE:             return ['🧭', 'lingers in ' + (extra || 'the vault') + ' — 4 minutes without progress'];
    case CLIENT_EV.PERF_SLOW:        return ['🐢', 'the 3D vault is crawling' + e];

    // free puzzles
    case CLIENT_EV.PLAY_START:       return ['🎮', 'starts the free puzzles on /play'];
    case CLIENT_EV.PLAY_SOLVED:      return ['✅', 'solves a free puzzle' + e];
    case CLIENT_EV.PLAY_OFFER:       return ['📘', 'sees the book offer on /play'];

    // the guided first puzzle
    case CLIENT_EV.LEARN_START:      return ['🎓', 'starts the guided first puzzle on /how-to-play-sudoku'];
    case CLIENT_EV.LEARN_MID:        return ['🎓', 'is a third of the way through the guided puzzle, sees the book card'];
    case CLIENT_EV.LEARN_DONE:       return ['🎓', 'finishes the guided first puzzle'];

    // passport / share / off-site
    case CLIENT_EV.PASSPORT_VIEW:    return ['📜', 'looks at the passport'];
    case CLIENT_EV.SHARE_COPY:       return ['🔗', 'copies a share link'];
    case CLIENT_EV.OUTBOUND_AMAZON:  return ['🛒', 'clicks through to Amazon' + (extra ? ' from ' + extra : '')];

    // session
    case CLIENT_EV.SESSION_DEPTH:    return ['👣', 'steps away' + e];   // sent on every tab-hide; the last one is the exit

    // server-emitted
    case SERVER_EV.REWARD_SERVED_I:  return ['📄', 'Vault I reward downloaded'];
    case SERVER_EV.REWARD_SERVED_II: return ['📄', 'Vault II reward downloaded'];
    case SERVER_EV.REWARD_SERVED_III:return ['📄', 'Vault III reward downloaded'];
    case SERVER_EV.REWARD_SERVED_IV: return ['📄', 'Vault IV reward downloaded'];

    default: return ['·', ev + e];
  }
}

function actName(a) {
  switch (String(a || '').toUpperCase()) {
    case 'I': return 'first'; case 'II': return 'second'; case 'III': return 'third'; case 'IV': return 'fourth';
    default: return 'a';
  }
}

// Back-compat: a few call sites used `line(ev, extra)` → "<icon> <text>".
export function line(ev, extra) { const [i, t] = parts(ev, extra); return i + ' ' + t; }

// The one shape every Telegram line takes. `tag` and `place` come from keeper-telegram.js.
export function keeperLine(ev, extra, tag, place) {
  const [icon, text] = parts(ev, extra);
  return `${icon} ${tag} · ${place} · ${text}`;
}

// ── Extras: a grammar per event, not a character whitelist ────────────────
// Anyone can POST to /api/event, so an `extra` is attacker-controlled text. A character
// whitelist is not enough: Telegram turns a bare `example.com` into a tappable link even
// with no parse_mode, and free text inside a whitelist still lets a stranger write the
// narrative ("GUEST KEY came in from…"). So every extra must match the exact shape our
// own clients produce — fixed vocabularies and digits — or it is dropped (the event still
// goes through, just without its extra). Nothing here can spell a hostname.
const PAGES = '(home|vault|play|hints|passport|shop|faq|privacy|terms|newsletter|the-keeper|escape-room-sudoku-book|how-to-play-sudoku|sudoku-cheat-sheet|daily|unsubscribed|404)';
const SOURCES = '(pinterest|youtube|tiktok|instagram|facebook|threads|reddit|x|linkedin|google|bing|duckduckgo|yahoo|brave|ecosia|chatgpt|perplexity|claude|gemini|amazon|mensa|another site)';
const ROOMS = '(the study|the library|the treasure room|the sanctum)';
const DOORS = '(first|door2|door3|fourth)';
export const EXTRA_RULES = Object.freeze({
  [CLIENT_EV.ARRIVE]:          new RegExp('^' + PAGES + '( from (utm [a-z0-9_]{1,16}|direct|' + SOURCES + '))? · (phone|desktop)$'),
  [CLIENT_EV.PAGE_VIEW]:       new RegExp('^' + PAGES + '$'),
  [CLIENT_EV.WORDBOX_OPEN]:    new RegExp('^' + DOORS + '$'),
  [CLIENT_EV.WORDBOX_CLOSE]:   new RegExp('^' + DOORS + ' (without a guess|after \\d{1,2} miss(es)?)$'),
  [CLIENT_EV.DESK_SOLVED]:     /^in \d{1,3}m\d{2}s$/,
  [CLIENT_EV.ROUND_SOLVED]:    /^(at their own pace|with help|Five in \d{1,4}(\.\d{1,2})?s( · best)?)$/,
  [CLIENT_EV.HINT_REVEAL]:     /^(I|II|III|IV)$/,
  [CLIENT_EV.IDLE]:            new RegExp('^' + ROOMS + '$'),
  [CLIENT_EV.PERF_SLOW]:       /^\d{1,3} fps$/,
  [CLIENT_EV.PLAY_SOLVED]:     /^(easy|medium|hard) · \d{1,3}m\d{2}s · \d{1,4} total$/,
  [CLIENT_EV.OUTBOUND_AMAZON]: new RegExp('^' + PAGES + '$'),
  [CLIENT_EV.SESSION_DEPTH]:   new RegExp('^(3D|painted) · \\d{1,3} rooms · \\d{1,4}m · last ' + ROOMS + '$'),
});
// Length caps — a pre-slice before the grammar, so a 10 KB body never reaches a regex.
export const EXTRA_ALLOWED = Object.freeze(Object.fromEntries(Object.keys(EXTRA_RULES).map((k) => [k, 64])));

// The only way an extra gets into a line. Returns '' for any event without a rule, any
// extra that fails its rule, or any non-string.
export function validExtra(ev, raw) {
  const rule = EXTRA_RULES[ev];
  if (!rule || typeof raw !== 'string') return '';
  const s = raw.slice(0, 64);
  return rule.test(s) ? s : '';
}
