/* Public entry UI. Answer recognition and book routing belong to the server. */
(function () {
  'use strict';
  var form = document.getElementById('entry-form');
  if (!form) return;
  var input = document.getElementById('entry-word');
  var button = form.querySelector('button[type="submit"]');
  var message = document.getElementById('entry-message');
  var picker = document.getElementById('book-picker');
  var recovery = document.getElementById('book-recovery');
  var panels = Array.from(document.querySelectorAll('[data-book-help]'));
  var choices = Array.from(document.querySelectorAll('[data-book-choice]'));
  var busy = false;
  input.disabled = false; button.disabled = false;
  var voiceInput = window.psWordMicrophone({ inputId: 'entry-word', buttonId: 'entry-mic', statusId: 'entry-mic-status', autoOnFocus: true, isBusy: function () { return busy; } });
  if (voiceInput) voiceInput.autoStartIfGranted();
  // Add a new room-set route here once its parent family is activated. Editions
  // sharing a room set need no per-book client changes. Unknown sets fail closed.
  var ROOM_ROUTES = { v1: { volumeId: 'v1', destination: '/vault', acts: ['I', 'II', 'III'] } };
  try {
    var earned = JSON.parse(sessionStorage.getItem('ps_daily_word_v1') || 'null');
    if (earned && /^[A-Z]{4,6}$/.test(earned.w || '') && /^[EMH]-?\d{3}$/.test(earned.s || '')) {
      var reminder = document.getElementById('daily-reminder');
      reminder.textContent = 'Your word from game ' + earned.s.replace('-', '') + ': ' + earned.w.split('').join(' ') + '. Type it below to open your door.';
      reminder.hidden = false;
    }
  } catch (_) { /* The normal word box remains usable without session storage. */ }

  function selectBook() {
    var query = new URLSearchParams(location.search);
    var id = query.has('book') ? query.get('book') : document.body.dataset.defaultBook;
    var known = panels.some(function (panel) { return panel.dataset.bookHelp === id; });
    panels.forEach(function (panel) { panel.hidden = panel.dataset.bookHelp !== id || !known; });
    choices.forEach(function (choice) {
      if (known && choice.dataset.bookChoice === id) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
    recovery.hidden = !query.has('book') || known;
    if (id || query.has('book')) picker.open = true;
  }
  selectBook();
  window.addEventListener('popstate', selectBook);
  // Links deliberately retain native navigation and browser history.

  function visitor() {
    try {
      var id = localStorage.getItem('ps_vid');
      if (!id) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(4)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem('ps_vid', id);
      }
      return id;
    } catch (_) { return ''; }
  }
  function keep(data) {
    try {
      var rewards = JSON.parse(localStorage.getItem('ps_rewards_v1') || '{}');
      if (!rewards || typeof rewards !== 'object' || Array.isArray(rewards)) rewards = {};
      if (data.rewardUrl) { rewards[data.act] = data.rewardUrl; localStorage.setItem('ps_rewards_v1', JSON.stringify(rewards)); }
    } catch (_) { /* Storage restrictions must not strand the reader. */ }
    try {
      if (data.room && data.room.id) sessionStorage.setItem('ps_guest_room_v1', JSON.stringify(data.room));
      else sessionStorage.removeItem('ps_guest_room_v1');
      sessionStorage.removeItem('ps_daily_word_v1');
    } catch (_) { /* Session storage can be independently unavailable. */ }
    if (window.psGuest && typeof window.psGuest.note === 'function') window.psGuest.note(data);
  }
  function say(text, error) {
    message.textContent = text;
    message.classList.toggle('error', !!error);
  }
  // Back/forward-cache restores preserve the outgoing document's busy state.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    busy = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
    input.removeAttribute('aria-invalid');
    say('', false);
    try {
      if (!sessionStorage.getItem('ps_daily_word_v1')) document.getElementById('daily-reminder').hidden = true;
    } catch (_) { /* Storage restrictions do not prevent another entry. */ }
  });
  function safeDestination(data) {
    var roomSetId = data.entry ? data.entry.roomSetId : 'v1';
    if (!Object.prototype.hasOwnProperty.call(ROOM_ROUTES, roomSetId)) return null;
    var route = ROOM_ROUTES[roomSetId];
    if (!route || route.acts.indexOf(data.act) < 0) return null;
    if (data.entry && (data.entry.destination !== route.destination || data.entry.volumeId !== route.volumeId)) return null;
    return route.destination + '?from=door&act=' + encodeURIComponent(data.act);
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy) return;
    if (voiceInput) voiceInput.stop();
    var raw = input.value.trim().toUpperCase();
    var word = raw.replace(/[\s-]/g, '');
    input.removeAttribute('aria-invalid');
    if (/\d/.test(raw)) {
      say('This box takes a decoded word. For a printed game code such as M013, use Find a game on the Play page.', true);
      var playLink = document.createElement('a'); playLink.href = '/play'; playLink.textContent = ' Go to Play'; message.appendChild(playLink);
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    if (!/^[A-Z]{4,12}$/.test(word)) {
      say('Please enter your complete decoded word: 4–12 letters. Spaces and hyphens are optional.', true);
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    input.value = word;
    busy = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
    say('Checking the door…', false);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    var leaving = false;
    try {
      var response = await fetch('/api/unlock', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word: word, vid: visitor(), at: 'entry-hub' }), signal: controller.signal,
      });
      if (response.status === 429) { say('Please wait a few seconds before trying again.', true); return; }
      if (response.status === 503) { say('The online door is temporarily unavailable. Your printed book still works; please return later.', true); return; }
      var data = await response.json();
      if (!response.ok || !data.ok) {
        say('That word didn’t open a door. Check your act instructions and letter order, or choose your book below for help.', true);
        input.setAttribute('aria-invalid', 'true'); return;
      }
      var destination = safeDestination(data);
      if (!destination) { say('This door isn’t available here yet. Please return later or use your book’s help below.', true); return; }
      keep(data);
      var recognized = data.entry && data.entry.bookTitle;
      var source = data.entry && data.entry.source;
      var origin = recognized ? recognized + (source === 'gift-cover' ? ' · cover puzzle' : source === 'guest' ? ' · guest puzzle' : '') : '';
      var selected = new URLSearchParams(location.search).get('book') || document.body.dataset.defaultBook;
      var differs = data.entry && selected && data.entry.bookId !== selected;
      say((origin ? origin + ' recognized. ' : '') + 'Vault ' + data.act + ' is open.' + (differs ? ' Your word found its matching book; your help selection stays the same.' : '') + ' Taking you inside…', false);
      input.value = '';
      window.location.assign(destination);
      leaving = true;
    } catch (_) {
      say('The door could not connect. Check your connection and try again. Your word is still here.', true);
    } finally {
      clearTimeout(timer);
      if (!leaving) { busy = false; button.disabled = false; form.removeAttribute('aria-busy'); }
    }
  });
})();

