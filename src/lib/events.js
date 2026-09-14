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
//   4. If you add an event, add a Keeper-voice line for it in `FORMAT` below.

// ── Client events (browser may POST /api/event with these) ─────────────────
export const CLIENT_EV = Object.freeze({
  // arrival / navigation
  BOOKCASE_OPEN:    'bookcase.open',       // the odd book opens the passage to Vault I
  WORDBOX_OPEN:     'wordbox.open',        // the word box is presented (any door)
  DOOR_OPEN_I:      'door.open.I',
  DOOR_OPEN_II:     'door.open.II',
  DOOR_OPEN_III:    'door.open.III',
  STAIR_DESCEND:    'stair.descend',       // crossed the sanctum stair going down
  STAIR_ASCEND:     'stair.ascend',        // came back up

  // reading / looking
  PAGE_NOTEBOOK:    'page.notebook',       // opened the Keeper's notebook
  PAGE_REJECTS:     'page.rejects',        // opened a discarded draft page
  STUDY_COMPLETE:   'study.complete',      // marked every study item

  // the two mini-games
  ROUND_START:      'round.start',         // Keeper's Round begins
  ROUND_SOLVED:     'round.solved',        // five found
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

  // passport, sharing, off-site
  PASSPORT_VIEW:    'passport.view',       // /passport loaded
  SHARE_COPY:       'share.copy',
  OUTBOUND_AMAZON:  'outbound.amazon',     // clicked any Amazon/buy link

  // once per session as the tab hides — the story-length ping
  SESSION_DEPTH:    'session.depth',
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

// Keeper-voice lines for every event. `extra` is a small, already-sanitized string.
// The lines are the ONLY text sent to Telegram — no template strings, no client interpolation.
export function line(ev, extra) {
  const e = extra ? ' — ' + extra : '';
  switch (ev) {
    // arrival / navigation
    case CLIENT_EV.BOOKCASE_OPEN:    return '📕 opens the bookcase to Vault I';
    case CLIENT_EV.WORDBOX_OPEN:     return '🔤 the word box appears' + e;
    case CLIENT_EV.DOOR_OPEN_I:      return '🚪 walks through the first door';
    case CLIENT_EV.DOOR_OPEN_II:     return '🚪 walks through the second door';
    case CLIENT_EV.DOOR_OPEN_III:    return '🚪 walks through the third door';
    case CLIENT_EV.STAIR_DESCEND:    return '⬇️ walks down into the sanctum';
    case CLIENT_EV.STAIR_ASCEND:     return '⬆️ climbs back out of the sanctum';

    // reading
    case CLIENT_EV.PAGE_NOTEBOOK:    return '📖 opens the Keeper\'s notebook';
    case CLIENT_EV.PAGE_REJECTS:     return '📝 reads a discarded draft page';
    case CLIENT_EV.STUDY_COMPLETE:   return '🕯 has found every study item';

    // games
    case CLIENT_EV.ROUND_START:      return '🕯 begins the Keeper\'s Round';
    case CLIENT_EV.ROUND_SOLVED:     return '✨ solves the Keeper\'s Round' + e;
    case CLIENT_EV.LOCK_START:       return '🔒 begins the Listening Lock';
    case CLIENT_EV.LOCK_SOLVED:      return '🔓 solves the Listening Lock';

    // tiles
    case CLIENT_EV.TILE_5:           return '🪙 picks up tile "5" (the library)';
    case CLIENT_EV.TILE_7:           return '🪙 picks up tile "7" (the treasure room)';

    // rewards
    case CLIENT_EV.REWARD_OPEN_I:    return '🎁 opens the Vault I reward card';
    case CLIENT_EV.REWARD_OPEN_II:   return '🎁 opens the Vault II reward card';
    case CLIENT_EV.REWARD_OPEN_III:  return '🎁 opens the Vault III reward card';
    case CLIENT_EV.REWARD_OPEN_IV:   return '🎁 opens the Vault IV reward card';
    case CLIENT_EV.REWARD_CLICK_I:   return '📥 clicks the Vault I gift';
    case CLIENT_EV.REWARD_CLICK_II:  return '📥 clicks the Vault II gift';
    case CLIENT_EV.REWARD_CLICK_III: return '📥 clicks the Vault III gift';
    case CLIENT_EV.REWARD_CLICK_IV:  return '📥 clicks the Vault IV gift';

    // Vault IV
    case CLIENT_EV.VAULT4_FLOOR_OPEN:return '🕯 the floor grinds open beneath them';
    case CLIENT_EV.VAULT4_ENTERED:   return '🌘 enters the sanctum';
    case CLIENT_EV.CARVE_OPEN:       return '🪨 opens the carve panel';

    // passport / share / off-site
    case CLIENT_EV.PASSPORT_VIEW:    return '📜 looks at the passport';
    case CLIENT_EV.SHARE_COPY:       return '🔗 copies a share link';
    case CLIENT_EV.OUTBOUND_AMAZON:  return '🛒 clicks through to Amazon';

    // session
    case CLIENT_EV.SESSION_DEPTH:    return '👣 leaves' + e;

    // server-emitted
    case SERVER_EV.REWARD_SERVED_I:  return '✅ Vault I reward downloaded';
    case SERVER_EV.REWARD_SERVED_II: return '✅ Vault II reward downloaded';
    case SERVER_EV.REWARD_SERVED_III:return '✅ Vault III reward downloaded';
    case SERVER_EV.REWARD_SERVED_IV: return '✅ Vault IV reward downloaded';

    default: return '· ' + ev + e;
  }
}

// Which events accept an `extra` string, and the schema for it. Extras are ALWAYS server-
// sanitized to a whitelist of characters (A-Z a-z 0-9 space . _ - · ×) and length-capped
// before they ever reach a Telegram message. If an event is not listed here, its extra is
// dropped entirely.
export const EXTRA_ALLOWED = Object.freeze({
  [CLIENT_EV.WORDBOX_OPEN]:  32,   // e.g. "first" / "door2" / "door3" / "fourth"
  [CLIENT_EV.ROUND_SOLVED]:  32,   // e.g. "5 in 23.4s"
  [CLIENT_EV.SESSION_DEPTH]: 32,   // e.g. "6 rooms · 12m"
  [CLIENT_EV.OUTBOUND_AMAZON]: 32, // e.g. "listing" or "a-plus"
});
