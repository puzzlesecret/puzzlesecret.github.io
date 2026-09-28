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
    LEARN_START:      'learn.start',
    LEARN_MID:        'learn.mid',
    LEARN_DONE:       'learn.done',
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
    // The server caps `arrive` at 120 and everything else at 64 (src/lib/events.js EXTRA_ALLOWED). A cut
    // mid-word fails the grammar and loses the whole extra, so the two caps must match.
    if (extra != null) body.extra = String(extra).slice(0, ev === CLIENT_EV.ARRIVE ? 120 : 64);
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
  // otherwise turn it into a tappable link.) Every rule matches the real domain, never a
  // fragment of a name, so plumbingsupply.co.uk is not "bing" and us.mensa.org is not our Mensa.
  var SOURCES = ['pinterest', 'youtube', 'tiktok', 'instagram', 'facebook', 'threads', 'reddit', 'linkedin', 'whatsapp', 'messenger', 'telegram', 'google', 'bing', 'duckduckgo', 'yahoo', 'brave', 'ecosia', 'chatgpt', 'perplexity', 'claude', 'gemini', 'amazon', 'mensa', 'goodreads', 'librarything', 'bookbub', 'substack', 'x', 'email'];
  var DOMAIN_RULES = [
    ['email',        /^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.aol\.com|mail\.proton\.me|mail\.zoho\.com|webmail\..+|.+\.safelinks\.protection\.outlook\.com)$/],
    ['gemini',       /(^|\.)gemini\.google\.com$/],
    ['google',       /(^|\.)google\.[a-z.]{2,6}$/],
    ['bing',         /(^|\.)bing\.com$/],
    ['duckduckgo',   /(^|\.)duckduckgo\.com$/],
    ['yahoo',        /(^|\.)yahoo\.[a-z.]{2,6}$/],
    ['brave',        /(^|\.)search\.brave\.com$/],
    ['ecosia',       /(^|\.)ecosia\.org$/],
    ['chatgpt',      /(^|\.)(chatgpt\.com|chat\.openai\.com)$/],
    ['perplexity',   /(^|\.)perplexity\.ai$/],
    ['claude',       /(^|\.)claude\.ai$/],
    ['pinterest',    /(^|\.)(pinterest\.[a-z.]{2,6}|pin\.it)$/],
    ['youtube',      /(^|\.)(youtube\.com|youtu\.be)$/],
    ['tiktok',       /(^|\.)tiktok\.com$/],
    ['instagram',    /(^|\.)instagram\.com$/],
    ['facebook',     /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
    ['messenger',    /(^|\.)messenger\.com$/],
    ['threads',      /(^|\.)threads\.(net|com)$/],
    ['reddit',       /(^|\.)(reddit\.com|redd\.it)$/],
    ['x',            /(^|\.)(x\.com|twitter\.com|t\.co)$/],
    ['linkedin',     /(^|\.)(linkedin\.com|lnkd\.in)$/],
    ['whatsapp',     /(^|\.)(whatsapp\.com|wa\.me)$/],
    ['telegram',     /(^|\.)(telegram\.org|t\.me)$/],
    ['amazon',       /(^|\.)(amazon\.[a-z.]{2,6}|amzn\.to)$/],
    ['mensa',        /(^|\.)mensa\.cz$/],
    ['goodreads',    /(^|\.)goodreads\.com$/],
    ['librarything', /(^|\.)librarything\.com$/],
    ['bookbub',      /(^|\.)bookbub\.com$/],
    ['substack',     /(^|\.)substack\.com$/],
  ];
  // Mirror of src/lib/placements.js (host → id). scripts/verify-events.js fails if they drift.
  var PLACEMENT_HOSTS = Object.freeze({
    'miowandmolly.com': 'miowandmolly',
    'mysteriouswritings.com': 'mysteriouswritings',
    'wordsandpeace.com': 'wordsandpeace',
    'sarcasticallyyoursjen.com': 'sarcasticallyyours',
    'pinpointmag.co.uk': 'pinpoint',
    'thegeocachingpodcast.com': 'geocachingpodcast',
    'bigpinekey.com': 'bigpinekey',
    'thedailynewsonline.com': 'batavianews',
    'livingstonnews.com': 'batavianews',
    'thelcn.com': 'batavianews',
    'treasureclub.net': 'treasureclub',
    'roomescapeartist.com': 'roomescapeartist',
    'theescapeeffect.com': 'escapeeffect',
    'escapetheroomers.com': 'escapetheroomers',
    'cluedinmystery.substack.com': 'cluedinmystery',
    'cluedinmystery.com': 'cluedinmystery',
    'readersfavorite.com': 'readersfavorite',
    'escapepuzzler.com': 'escapepuzzler',
    'escapethereview.co.uk': 'escapethereview',
    'crimefictionlover.com': 'crimefictionlover',
    'theescaperoomer.com': 'escaperoomer',
    'artisanalsudoku.substack.com': 'artisanalsudoku',
    'escapeauthority.com': 'escapeauthority',
    'geekdad.com': 'geekdad',
    'geekyhobbies.com': 'geekyhobbies',
    'virtualbrainhealthcenter.com': 'brainhealth',
    'dailycaring.com': 'dailycaring',
    'buffalospree.com': 'buffalospree',
    'geeksofdoom.com': 'geeksofdoom',
    'cinelinx.com': 'cinelinx',
    'thrivinghomeblog.com': 'thrivinghome',
    'beenews.com': 'beenews',
    'katherinemartinko.ca': 'analogfamily',
    'everyday-reading.com': 'everydayreading',
    'modernmrsdarcy.com': 'modernmrsdarcy',
    'dannypettry.com': 'rectherapy',
    'chalkdustmagazine.com': 'chalkdust',
    'aperiodical.com': 'aperiodical',
    'seniorsafetyadvice.com': 'seniorsafety',
    'btpm.org': 'btpm',
    'atlantaparent.com': 'atlantaparent',
    'bookgirlsguide.com': 'bookgirlsguide',
    'ncoa.org': 'ncoa',
    'bookreporter.com': 'bookreporter',
    'thesenior.com': 'thesenior',
    'thesenior.com.au': 'thesenior',
    'hoppier.com': 'hoppier',
    'adventuregamespodcast.com': 'adventuregames',
    'wheniwork.com': 'wheniwork',
    'pbfingers.com': 'pbfingers',
    'booksofbrilliance.com': 'booksofbrilliance',
    'homecenteredlearning.com': 'homecentered',
    'bookriot.com': 'bookriot',
    'witwhimsy.com': 'witwhimsy',
    'ptoanswers.com': 'ptoanswers',
    'weareteachers.com': 'weareteachers',
  });
  function sourceOf(host) {
    for (var h in PLACEMENT_HOSTS) if (host === h || host.slice(-(h.length + 1)) === '.' + h) return PLACEMENT_HOSTS[h];
    for (var i = 0; i < DOMAIN_RULES.length; i++) if (DOMAIN_RULES[i][1].test(host)) return DOMAIN_RULES[i][0];
    // An unknown site keeps only its country ending (".uk", ".au") — never the name.
    var tld = host.split('.').pop();
    return /^[a-z]{2}$/.test(tld) ? 'another site .' + tld : 'another site';
  }
  // Android apps announce themselves as android-app://<package>. The Gmail app's package holds
  // "google", so mail apps are caught before anything reads it as a Google search.
  var APP_RULES = [
    ['email',     /^(com\.google\.android\.gm|com\.microsoft\.office\.outlook|com\.yahoo\.mobile\.client\.android\.mail)$|mail/],
    ['google',    /^com\.google\.android\.googlequicksearchbox$/],
    ['telegram',  /telegram/],
    ['messenger', /^com\.facebook\.orca$/],
    ['facebook',  /^com\.facebook\.katana$/],
    ['instagram', /^com\.instagram\.android$/],
    ['pinterest', /^com\.pinterest$/],
    ['reddit',    /^com\.reddit\.frontpage$/],
    ['whatsapp',  /^com\.whatsapp$/],
    ['linkedin',  /^com\.linkedin\.android$/],
    ['youtube',   /^com\.google\.android\.youtube$/],
    ['x',         /^com\.twitter\.android$/],
  ];
  function referrerName() {
    try {
      var utm = new URLSearchParams(location.search).get('utm_source');
      if (utm) return 'utm ' + utm.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
      // The vault's lock sends word-less visitors to the front door; it saves where they really came from.
      var ref = document.referrer;
      try { var kept = sessionStorage.getItem('ps_ref'); if (kept !== null) { ref = kept; sessionStorage.removeItem('ps_ref'); } } catch (e) {}
      if (!ref) return 'direct';
      var app = ref.match(/^android-app:\/\/([a-z0-9_.]+)/i);
      if (app) {
        var pkg = app[1].toLowerCase();
        for (var j = 0; j < APP_RULES.length; j++) if (APP_RULES[j][1].test(pkg)) return APP_RULES[j][0];
        return 'another site';
      }
      var h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
      if (h === location.hostname.replace(/^www\./, '')) return 'inside';
      return sourceOf(h);
    } catch (e) { return 'direct'; }
  }
  // How many visits this browser has made (counted per session, kept on the device). A browser that
  // already carries a solver tag from before the counter existed is "returning", not "first".
  function visitLabel() {
    try {
      var n = parseInt(localStorage.getItem('ps_visits'), 10);
      if (!n) n = localStorage.getItem('ps_vid') ? 1 : 0;   // seen before the counter shipped
      n += 1;
      localStorage.setItem('ps_visits', String(n));
      return n === 1 ? 'first visit' : n >= 10 ? 'visit 10 or more' : 'visit ' + n;
    } catch (e) { return ''; }
  }
  // How many vaults this browser has opened (the passport's own record) — a count, never the words.
  // Guest keys open Vault I only, so the Keeper reads "owns the book" into two or more, never one.
  function vaultsOpened() {
    try {
      var held = {}, a = JSON.parse(localStorage.getItem('ps_vaults_v1') || '{}') || {}, b = JSON.parse(localStorage.getItem('ps_rewards_v1') || '{}') || {};
      ['I', 'II', 'III', 'IV'].forEach(function (k) { if (a[k] || b[k]) held[k] = 1; });
      return Object.keys(held).length;
    } catch (e) { return 0; }
  }
  // The browser's language setting, e.g. "en-GB". Two letters, then an optional two-letter region.
  function language() {
    try {
      var parts = String(navigator.language || '').split('-');
      if (!/^[a-z]{2}$/i.test(parts[0] || '')) return '';
      var region = '';
      for (var i = 1; i < parts.length; i++) if (/^[a-z]{2}$/i.test(parts[i])) { region = parts[i].toUpperCase(); break; }
      return parts[0].toLowerCase() + (region ? '-' + region : '');
    } catch (e) { return ''; }
  }
  // Dan's own devices: open any page once with ?keeper=me and this browser is marked "you" for good
  // (?keeper=off removes it). It only changes how the Keeper labels this browser's own visits.
  function keeperMark() {
    try {
      var k = new URLSearchParams(location.search).get('keeper');
      if (k === 'me') localStorage.setItem('ps_keeper', '1');
      if (k === 'off') localStorage.removeItem('ps_keeper');
      return localStorage.getItem('ps_keeper') === '1';
    } catch (e) { return false; }
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
    var visit = visitLabel(), v = vaultsOpened(), lang = language(), me = keeperMark();
    psEvent(CLIENT_EV.ARRIVE, pageName() + (from === 'inside' ? '' : ' from ' + from) + ' · ' + device()
      + (visit ? ' · ' + visit : '')
      + (v ? ' · ' + v + (v > 1 ? ' vaults opened' : ' vault opened') : '')
      + (lang ? ' · ' + lang : '')
      + (me ? ' · keeper' : ''));
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
