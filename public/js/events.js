/* Mirror of site/src/lib/events.js — public/ files are served as-is (not bundled),
   so painted-vault.js can pick this up with a plain <script> tag. `scripts/verify-events.js`
   diffs the two on demand. If you edit one, edit the other. */
(function (root) {
  var CLIENT_EV = Object.freeze({
    BOOKCASE_OPEN:    'bookcase.open',
    WORDBOX_OPEN:     'wordbox.open',
    DOOR_OPEN_I:      'door.open.I',
    DOOR_OPEN_II:     'door.open.II',
    DOOR_OPEN_III:    'door.open.III',
    STAIR_DESCEND:    'stair.descend',
    STAIR_ASCEND:     'stair.ascend',
    PAGE_NOTEBOOK:    'page.notebook',
    PAGE_REJECTS:     'page.rejects',
    STUDY_COMPLETE:   'study.complete',
    ROUND_START:      'round.start',
    ROUND_SOLVED:     'round.solved',
    LOCK_START:       'lock.start',
    LOCK_SOLVED:      'lock.solved',
    TILE_5:           'tile.5',
    TILE_7:           'tile.7',
    REWARD_OPEN_I:    'reward.open.I',
    REWARD_OPEN_II:   'reward.open.II',
    REWARD_OPEN_III:  'reward.open.III',
    REWARD_OPEN_IV:   'reward.open.IV',
    REWARD_CLICK_I:   'reward.click.I',
    REWARD_CLICK_II:  'reward.click.II',
    REWARD_CLICK_III: 'reward.click.III',
    REWARD_CLICK_IV:  'reward.click.IV',
    VAULT4_FLOOR_OPEN:'vault4.floor_open',
    VAULT4_ENTERED:   'vault4.entered',
    CARVE_OPEN:       'carve.open',
    PASSPORT_VIEW:    'passport.view',
    SHARE_COPY:       'share.copy',
    OUTBOUND_AMAZON:  'outbound.amazon',
    SESSION_DEPTH:    'session.depth',
  });

  // Small vid helper reused where the calling module doesn't already own one.
  function psVid() {
    try {
      var v = localStorage.getItem('ps_vid');
      if (!v) {
        var a = new Uint8Array(4); (crypto || {}).getRandomValues && crypto.getRandomValues(a);
        v = Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem('ps_vid', v);
      }
      return v;
    } catch (e) { return ''; }
  }

  // Client → /api/event. Non-blocking, silent on any failure. Never awaited by callers.
  function psEvent(ev, extra) {
    try {
      var body = { vid: psVid(), ev: ev };
      if (extra != null) body.extra = String(extra).slice(0, 40);
      fetch('/api/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  // One-shot per name-per-session guard so a helper like psEventOnce('page.notebook')
  // never spams even if the client-side cooldown-per-tab is naive. Server has the real
  // cooldown; this is a courtesy so an "opened notebook, flipped 20 pages" reads as one line.
  function psEventOnce(ev, extra) {
    try {
      var k = 'ps_ev_once_' + ev;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch (e) { /* private mode — best-effort still */ }
    psEvent(ev, extra);
  }

  // A session-end ping. Uses sendBeacon so it survives the tab hiding on Safari/iOS.
  function psSessionDepth(extra) {
    try {
      var body = JSON.stringify({ vid: psVid(), ev: CLIENT_EV.SESSION_DEPTH, extra: String(extra || '').slice(0, 40) });
      var blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/event', blob);
      else fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  root.PS_EV = CLIENT_EV;
  root.psEvent = psEvent;
  root.psEventOnce = psEventOnce;
  root.psSessionDepth = psSessionDepth;
})(window);
