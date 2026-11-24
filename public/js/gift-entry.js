/* Gift entry forms. Words are checked only by the server; no answers are embedded here. */
(function () {
  'use strict';
  function visitor() {
    try {
      var id = localStorage.getItem('ps_vid');
      if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(4)), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); localStorage.setItem('ps_vid', id); }
      return id;
    } catch (_) { return ''; }
  }
  function keep(data) {
    try {
      var rewards = JSON.parse(localStorage.getItem('ps_rewards_v1') || '{}');
      if (data.rewardUrl) { rewards[data.act] = data.rewardUrl; localStorage.setItem('ps_rewards_v1', JSON.stringify(rewards)); }
      sessionStorage.removeItem('ps_guest_room_v1');
    } catch (_) { /* Storage restrictions must not strand the reader. */ }
    if (window.psGuest) window.psGuest.note(data);
  }
  document.querySelectorAll('form[data-gift-form]').forEach(function (form) {
    var input = form.querySelector('input'), button = form.querySelector('button'), message = form.querySelector('.message');
    var cover = form.dataset.giftForm === 'cover', busy = false;
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); if (busy) return;
      var word = input.value.toUpperCase().replace(/[^A-Z]/g, '');
      input.value = word; message.classList.remove('error'); input.removeAttribute('aria-invalid');
      if ((cover && word.length !== 6) || (!cover && (word.length < 4 || word.length > 12))) {
        message.textContent = cover ? 'Please enter the six letters from the cover.' : 'Please enter the complete word you decoded.';
        message.classList.add('error'); input.setAttribute('aria-invalid', 'true'); input.focus(); return;
      }
      busy = true; button.disabled = true; message.textContent = 'Checking the door…';
      try {
        var response = await fetch('/api/unlock', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({word:word,vid:visitor(),at:cover?'gift-cover':'gift-book'})});
        var data = await response.json();
        if (!data.ok) {
          message.textContent = response.status === 429 ? 'Please wait a few seconds before trying again.' : response.status === 503 ? 'The online door is temporarily unavailable. Your printed book still works; please return later.' : cover ? 'That code did not open this door. Check A1–A6 and the cover letter strip.' : 'That word did not open a door. Check the act instructions and your recorded digits.';
          message.classList.add('error'); input.setAttribute('aria-invalid', 'true'); return;
        }
        keep(data); message.textContent = data.act === 'G' ? 'The Keeper’s Gallery is open. Taking you inside…' : 'Vault ' + data.act + ' is open. Taking you inside…';
        window.location.assign('/vault?from=door&act=' + encodeURIComponent(data.act));
      } catch (_) {
        message.textContent = 'The door could not connect. Check your connection and try again later.'; message.classList.add('error');
      } finally {busy = false;button.disabled = false;}
    });
  });
})();
