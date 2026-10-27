/* GUEST KEYS in this browser (Dan, 2026-10-27; plan marketing/pinterest/VAULT-KEY-PINS-PLAN.md §3.5).
   A guest key (a Pinterest week's word, or an outlet's) opens Vault I only. /api/unlock says which kind of guest a
   word makes its speaker (`guest: 'pinterest' | 'outlet'`); a book word says nothing. This file remembers that, so the
   vault, the gift card and the passport can tell a guest — and only a guest — that the other words are in the book.
   - ps_guest_v1  = 'pinterest' | 'outlet'   (set by a guest word)
   - ps_owner_v1  = '1'                      (set by any book word; once set, the guest card never shows again)
   Loaded as a plain script on /, /vault, /daily/* and /passport. Never a gate; storage failures just hide the card. */
(function (root) {
  'use strict';
  var BOOK = 'https://www.amazon.com/dp/B0HB9K8PXC';
  // Pinterest guests get Pinterest's own tracked link (Amazon Attribution, tag=maas — not Associates). Outlet guests get
  // the plain book link (some hold free copies; they must never see an Associates tag).
  var LINKS = {
    pinterest: 'https://www.amazon.com/dp/B0HB9K8PXC?maas=maas_adg_DDFF158127EFE7545C81D95321E44E01_afap_abs&ref_=aa_maas&tag=maas',
    outlet: BOOK,
  };
  var LINES = {
    daily: 'You found a vault word. The words for the other vaults are hidden in the book.',
    gift: 'This was a guest key, and it opens the first door only. The words for the other vaults are hidden in the book.',
    door2: 'A guest key opens only the first door. The word for this one is hidden in the book.',
    passport: 'Your first stamp came from a guest key. The words for the other vaults are hidden in the book.',
  };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var api = {
    /* call with every /api/unlock response */
    note: function (resp) {
      if (!resp || !resp.ok) return;
      if (resp.guest === 'pinterest' || resp.guest === 'outlet') { if (get('ps_owner_v1') !== '1') set('ps_guest_v1', resp.guest); }
      else { set('ps_owner_v1', '1'); del('ps_guest_v1'); }
    },
    /* 'pinterest' | 'outlet' | null */
    kind: function () {
      if (get('ps_owner_v1') === '1') return null;
      var g = get('ps_guest_v1');
      return g === 'pinterest' || g === 'outlet' ? g : null;
    },
    link: function () { return LINKS[api.kind()] || BOOK; },
    line: function (placement) { return LINES[placement] || LINES.gift; },
    /* the book card as a DOM node, or null for a non-guest. placement: daily | gift | door2 | passport */
    card: function (placement, opts) {
      var k = (opts && opts.force) || api.kind();
      if (!k) return null;
      style();
      var box = document.createElement('div'); box.className = 'ps-guest-card';
      var p = document.createElement('p'); p.textContent = LINES[placement] || LINES.gift;
      var a = document.createElement('a'); a.href = LINKS[k] || BOOK; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'ps-guest-buy'; a.textContent = 'Sudoku with a Secret, Volume 1 on Amazon ↗';
      box.appendChild(p); box.appendChild(a);
      if (root.psEvent) root.psEvent('guest.card', placement);
      return box;
    },
    /* empty `el`, then put the card in it for a guest (and nothing for anyone else) */
    fill: function (el, placement) {
      if (!el) return;
      while (el.firstChild) el.removeChild(el.firstChild);
      if (!LINES[placement]) return;              // e.g. the gift of a later vault: just clear
      var c = api.card(placement); if (c) el.appendChild(c);
    },
    /* the second door's word box, for a plain guest: the line + a link to the book. Returns true if it took over. */
    door2: function (kickerEl, lineEl) {
      var k = api.kind(); if (!k || !lineEl) return false;
      style();
      if (kickerEl) kickerEl.textContent = 'THE SECOND DOOR';
      lineEl.textContent = LINES.door2 + ' ';
      var a = document.createElement('a'); a.href = LINKS[k] || BOOK; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'wb-book'; a.textContent = 'See the book ↗';
      lineEl.appendChild(a);
      if (root.psEvent) root.psEvent('guest.card', 'door2');
      return true;
    },
  };
  var styled = false;
  function style() {   // one small stylesheet, so the card looks the same on every page that shows it
    if (styled || typeof document === 'undefined') return; styled = true;
    var s = document.createElement('style');
    s.textContent = '.ps-guest-card{margin:14px auto 0;max-width:520px;padding:14px 16px;border:1px solid rgba(185,143,82,.45);border-radius:10px;background:rgba(14,12,18,.6);text-align:center}' +
      '.ps-guest-card p{margin:0 0 10px;color:#efe3c6;line-height:1.5}' +
      '.ps-guest-buy{display:inline-block;padding:10px 16px;font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1a1206;background:linear-gradient(180deg,#f6c766,#c9973f);border-radius:6px;text-decoration:none}';
    document.head.appendChild(s);
  }
  root.psGuest = api;
})(typeof window !== 'undefined' ? window : this);
