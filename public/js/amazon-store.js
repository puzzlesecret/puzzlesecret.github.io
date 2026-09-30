/* Send every "buy the book" link to the visitor's own Amazon store.
   The book (ASIN B0HB9K8PXC) is live on amazon.com, .co.uk, .ca, .com.au and .de (checked 2026-09-29).
   A UK gift-guide reader who lands on amazon.com has to find the book again on amazon.co.uk,
   and most won't, so pick the store from the browser's own time zone. Nothing is sent anywhere:
   the time zone is read in the browser and never leaves it. The US Associates tag only works on
   amazon.com, so other stores get the plain link. events.js still counts the click (it matches any amazon.* host). */
(function () {
  var ASIN = 'B0HB9K8PXC';
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var host = null;
  if (/^Europe\/(London|Belfast|Jersey|Guernsey|Isle_of_Man|Dublin)$/.test(tz)) host = 'www.amazon.co.uk';
  else if (/^Australia\//.test(tz)) host = 'www.amazon.com.au';
  else if (/^Europe\/(Berlin|Busingen|Vienna|Zurich)$/.test(tz)) host = 'www.amazon.de';
  else if (/^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Blanc-Sablon|Glace_Bay|Moncton|Goose_Bay|St_Johns|Whitehorse|Dawson|Dawson_Creek|Fort_Nelson|Creston|Yellowknife|Inuvik|Cambridge_Bay|Rankin_Inlet|Iqaluit|Resolute|Atikokan|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung)$/.test(tz)) host = 'www.amazon.ca';
  if (!host) return; // US and everyone else keep amazon.com

  var BUY = new RegExp('^https?://(www\\.)?amazon\\.com/dp/' + ASIN + '(?:[/?#]|$)', 'i');
  function fix(a) {
    if (a && a.href && BUY.test(a.href)) a.href = 'https://' + host + '/dp/' + ASIN;
  }
  function fixAll() { var l = document.querySelectorAll('a[href*="' + ASIN + '"]'); for (var i = 0; i < l.length; i++) fix(l[i]); }
  // links that appear later (modals, the arcade nudge) are caught at click time
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest ? e.target.closest('a') : null; fix(a); }, true);
  var STORE = { 'www.amazon.co.uk': 'Amazon UK', 'www.amazon.ca': 'Amazon Canada', 'www.amazon.com.au': 'Amazon Australia', 'www.amazon.de': 'Amazon Germany' }[host];
  // outside the US, name the local store on the strip under the door
  function fixPrices() { var p = document.querySelectorAll('[data-ps-price]'); for (var i = 0; i < p.length; i++) p[i].textContent = '200 puzzles · on ' + STORE; }
  function run() { fixAll(); fixPrices(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
