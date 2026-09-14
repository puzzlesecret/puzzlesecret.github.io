/* Mirror of site/src/lib/events.js — public/ files are served as-is (not bundled),
   so painted-vault.js and the plain pages can pick this up with a <script> tag.
   `scripts/verify-events.js` diffs the two on demand. If you edit one, edit the other.

   Loaded on every page (Layout.astro, index.astro, vault.astro). On load it does two
   things by itself, so no page has to remember:
     1. sends `arrive` once per session (entry page, referring site, phone/desktop);
     2. wires the site-wide Amazon click-through ping. */
(function (root) {
  var CLIENT_EV = Object.freeze({
    ARRIVE:           'arrive',
    PAGE_VIEW:        'page.view',
    BOOKCASE_OPEN:    'bookcase.open',
    WORDBOX_OPEN:     'wordbox.open',
    WORDBOX_CLOSE:    'wordbox.close',
    DOOR_OPEN_I:      'door.open.I',
    DOOR_OPEN_II:     'door.open.II',
    DOOR_OPEN_III:    'door.open.III',
    STAIR_DESCEND:    'stair.descend',
    STAIR_ASCEND:     'stair.ascend',
    PAGE_NOTEBOOK:    'page.notebook',
    PAGE_REJECTS:     'page.rejects',
    STUDY_COMPLETE:   'study.complete',
    DESK_SOLVED:      'desk.solved',
    ROUND_START:      'round.start',
    ROUND_SOLVED:     'round.solved',
    ROUND_FAIL:       'round.fail',
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
    HINT_VIEW:        'hint.view',
    HINT_REVEAL:      'hint.reveal',
    IDLE:             'idle',
    PERF_SLOW:        'perf.slow',
    PLAY_START:       'play.start',
    PLAY_SOLVED:      'play.solved',
    PLAY_OFFER:       'play.offer',
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

  function payload(ev, extra) {
    var body = { vid: psVid(), ev: ev };
    if (extra != null) body.extra = String(extra).slice(0, 64);
    return JSON.stringify(body);
  }

  // Client → /api/event. Non-blocking, silent on any failure. Never awaited by callers.
  function psEvent(ev, extra) {
    try {
      fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload(ev, extra) })
        .catch(function () {});
    } catch (e) { /* best-effort */ }
  }

  // Same, but survives the page going away (link click, tab close, iOS backgrounding).
  function psBeacon(ev, extra) {
    try {
      var body = payload(ev, extra);
      if (navigator.sendBeacon) { navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' })); return; }
      fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
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

  // The story's last line. Fired each time the tab hides (a phone backgrounding, a tab
  // switch) and on pagehide (close, navigate away) — re-armed when the tab comes back, so
  // a mid-visit glance at a text message does not end the story early. The server's
  // per-(ip, event, extra) cooldown collapses identical repeats; the last one is the exit.
  function psSessionDepth(extra) { psBeacon(CLIENT_EV.SESSION_DEPTH, extra); }
  function psOnLeave(fn) {
    var armed = true;
    function go() { if (!armed) return; armed = false; try { fn(); } catch (e) {} }
    document.addEventListener('visibilitychange', function () { if (document.hidden) go(); else armed = true; });
    addEventListener('pagehide', go);
  }

  // Minutes since the module loaded — the session clock every "leaves" line uses.
  var t0 = Date.now();
  function psMinutes() { return Math.max(1, Math.round((Date.now() - t0) / 60000)); }

  // "Lingers in <room> — 4 minutes without progress." Call once with a function that
  // returns the current room's short name; fires at most once per room per session.
  function psIdleWatch(getRoom) {
    var IDLE_MS = 4 * 60 * 1000, last = Date.now(), said = {};
    function bump() { last = Date.now(); }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (n) { addEventListener(n, bump, { passive: true, capture: true }); });
    setInterval(function () {
      if (document.hidden) { last = Date.now(); return; }         // a hidden tab is not "stuck"
      var room = ''; try { room = String(getRoom() || ''); } catch (e) {}
      if (!room || said[room]) return;
      if (Date.now() - last > IDLE_MS) { said[room] = true; psEvent(CLIENT_EV.IDLE, room); }
    }, 20000);
    return bump;
  }

  // ── automatic: `arrive` once per session ──────────────────────────────────
  function pageName() {
    var p = (location.pathname || '/').replace(/^\/+|\/+$/g, '').split('/')[0];
    return p ? p.slice(0, 32) : 'home';
  }
  // The referring SITE, as one word from a fixed list — never a hostname. (The server
  // enforces the same list; a raw domain would be dropped there, and Telegram would
  // otherwise turn it into a tappable link.)
  var SOURCES = ['pinterest', 'youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'reddit', 'linkedin', 'google', 'bing', 'duckduckgo', 'yahoo', 'brave', 'ecosia', 'chatgpt', 'perplexity', 'claude', 'gemini', 'amazon', 'mensa'];
  function sourceOf(host) {
    if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(host)) return 'x';
    if (/(^|\.)fb\.com$/.test(host) || /^lm?\.facebook\.com$/.test(host)) return 'facebook';
    for (var i = 0; i < SOURCES.length; i++) if (host.indexOf(SOURCES[i]) !== -1) return SOURCES[i];
    return 'another site';
  }
  function referrerName() {
    try {
      var utm = new URLSearchParams(location.search).get('utm_source');
      if (utm) return 'utm ' + utm.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
      if (!document.referrer) return 'direct';
      var h = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase();
      if (h === location.hostname.replace(/^www\./, '')) return 'inside';
      return sourceOf(h);
    } catch (e) { return 'direct'; }
  }
  function device() {
    try { return (matchMedia('(pointer: coarse)').matches && innerWidth < 900) ? 'phone' : 'desktop'; } catch (e) { return 'desktop'; }
  }
  // First page of the visit → `arrive` (with where they came from). Every page after
  // that → `page.view`, so home → shop → Amazon reads as three lines, not two.
  function arrive() {
    try { if (navigator.webdriver) return; } catch (e) {}
    var first = true;
    try {
      if (sessionStorage.getItem('ps_arrived')) first = false;
      else sessionStorage.setItem('ps_arrived', '1');
    } catch (e) { /* private mode: treat every load as a first page */ }
    if (!first) { psEvent(CLIENT_EV.PAGE_VIEW, pageName()); return; }
    var from = referrerName();
    psEvent(CLIENT_EV.ARRIVE, pageName() + (from === 'inside' ? '' : ' from ' + from) + ' · ' + device());
  }

  // ── automatic: Amazon click-through, any page ─────────────────────────────
  function wireAmazon() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (/amazon\./i.test(href) || /amzn\.to/i.test(href)) psBeacon(CLIENT_EV.OUTBOUND_AMAZON, pageName());
    }, true);
  }

  root.PS_EV = CLIENT_EV;
  root.psVid = root.psVid || psVid;
  root.psEvent = psEvent;
  root.psBeacon = psBeacon;
  root.psEventOnce = psEventOnce;
  root.psSessionDepth = psSessionDepth;
  root.psOnLeave = psOnLeave;
  root.psMinutes = psMinutes;
  root.psIdleWatch = psIdleWatch;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { arrive(); wireAmazon(); });
  else { arrive(); wireAmazon(); }
})(window);
