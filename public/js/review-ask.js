/* THE QUIET REVIEW NOTE on the front door (Dan, 2026-11-09 — "Option B", marketing/ADS-AND-REVIEWS-2026-10-16.md §5).
   Rules it keeps:
   - Only for a browser that has spoken one of the BOOK's own words (guest-key.js sets ps_book_v1 = when, in ms;
     a guest key never does). No word, or a guest key only → never shown.
   - Only on a LATER visit: at least a day after that first book word, and never in the tab session that spoke it.
   - Never next to a gift: it lives on the homepage only, where no download or reward is on screen, and its wording
     never mentions a vault, a gift or a discount. Neutral (asks for positive or negative), never "if you enjoyed it".
   - Dismissed (×) or clicked → never again in this browser (ps_review_ask_v1 = 'done').
   Storage failures simply keep it hidden. */
(function (root) {
  'use strict';
  var WAIT_MS = 24 * 60 * 60 * 1000;   // "a later visit": a day after the first book word

  function get(store, k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function set(store, k, v) { try { if (store) store.setItem(k, v); } catch (e) {} }

  /* Pure decision, so it can be tested without a page. `ls` / `ss` look like localStorage / sessionStorage. */
  function eligible(ls, ss, now) {
    if (get(ls, 'ps_review_ask_v1') === 'done') return false;
    var first = parseInt(get(ls, 'ps_book_v1'), 10);
    // A browser that owned a book word before ps_book_v1 existed: start its clock today, so it waits a day too.
    if (!first && get(ls, 'ps_owner_v1') === '1') { first = now; set(ls, 'ps_book_v1', String(now)); }
    if (!first || !(first > 0)) return false;
    if (get(ss, 'ps_book_sess') === '1') return false;    // the visit that spoke the word
    return now - first >= WAIT_MS;
  }

  function done() { set(root.localStorage, 'ps_review_ask_v1', 'done'); }
  function ev(extra) { try { if (root.psBeacon) root.psBeacon('review.ask', extra); } catch (e) {} }

  function init() {
    var box = document.getElementById('reviewAsk');
    if (!box) return;
    var ls = null, ss = null;
    try { ls = root.localStorage; } catch (e) {}
    try { ss = root.sessionStorage; } catch (e) {}
    if (!eligible(ls, ss, Date.now())) return;
    box.hidden = false;
    // once per tab session, so a reload does not log it twice
    if (get(ss, 'ps_review_ask_seen') !== '1') { set(ss, 'ps_review_ask_seen', '1'); ev('shown'); }
    var link = box.querySelector('.ra-link'), x = box.querySelector('.ra-x');
    if (link) link.addEventListener('click', function () { done(); ev('clicked'); box.hidden = true; });
    if (x) x.addEventListener('click', function () { done(); ev('dismissed'); box.hidden = true; });
  }

  root.psReviewAsk = { eligible: eligible, WAIT_MS: WAIT_MS };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
