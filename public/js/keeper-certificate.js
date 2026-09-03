/* THE CERTIFICATE — "Cracked the Keeper's Vault" — a keepsake rendered on a canvas, entirely in
   the browser. Initials are typed here and drawn here; nothing is sent anywhere (no server call,
   no storage beyond the initials the solver may already have carved). No answer word, no
   win/prize language, no review ask — it is a record, not a toll.
   window.PSCert.open(opts) shows the panel; opts = { vaults:{I:date,…}, tiles:{II,III}, pages:n } */
(function () {
  'use strict';
  const W = 1200, H = 1500;
  const $ = (id) => document.getElementById(id);
  const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } } };
  function hashSerial(s) {   // looks like a code, decodes to nothing — people will try anyway
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return (h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)).replace(/^(.{3})(.{4})$/, '$1-$2');
  }
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  async function fonts(text) {
    if (!document.fonts || !document.fonts.load) return;
    try { await Promise.all([document.fonts.load('700 72px Cinzel', text), document.fonts.load('600 40px Cinzel', text), document.fonts.load('italic 500 34px "Cormorant Garamond"', text)]); } catch (e) { /* fallback fonts */ }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function seal(g, cx, cy, r, mark) {
    g.save();
    const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grd.addColorStop(0, '#ffe19a'); grd.addColorStop(0.55, '#d9a02e'); grd.addColorStop(1, '#8a5f12');
    g.beginPath();
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, rr = r * (i % 2 ? 0.93 : 1); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = grd; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 24; g.shadowOffsetY = 8; g.fill();
    g.shadowColor = 'transparent';
    g.beginPath(); g.arc(cx, cy, r * 0.74, 0, 7); g.strokeStyle = 'rgba(80,50,10,.55)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#4a3208'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + Math.round(r * 0.62) + 'px Cinzel, serif'; g.fillText(mark ? '✦' : 'I', cx, cy + r * 0.02);
    g.font = '600 ' + Math.round(r * 0.17) + 'px Cinzel, serif';
    g.fillText(mark ? "THE KEEPER'S MARK" : 'PUZZLESECRET', cx, cy + r * 0.5);
    g.restore();
  }
  async function render(o) {
    const initials = (o.initials || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || '· · ·';
    const date = o.date || new Date().toISOString().slice(0, 10);
    const vaults = ['I', 'II', 'III', 'IV'].filter((k) => o.vaults && o.vaults[k]);
    const both = !!(o.tiles && o.tiles.II && o.tiles.III);
    await fonts('CRACKED THE KEEPER’S VAULT ' + initials + date + 'Sudoku with a Secret');
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    // ground
    g.fillStyle = '#0b0a0d'; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H * 0.36, 40, W / 2, H * 0.36, 900); glow.addColorStop(0, 'rgba(255,170,60,.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // double gold border
    g.strokeStyle = '#d9a63a'; g.lineWidth = 6; roundRect(g, 48, 48, W - 96, H - 96, 18); g.stroke();
    g.strokeStyle = 'rgba(217,166,58,.45)'; g.lineWidth = 2; roundRect(g, 66, 66, W - 132, H - 132, 12); g.stroke();
    // cover art
    try { const im = await loadImg('/art/door-v10.webp'); const iw = 300, ih = iw * (2086 / 1400); g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 30; g.shadowOffsetY = 12; g.drawImage(im, (W - iw) / 2, 110, iw, ih); g.restore(); g.strokeStyle = 'rgba(217,166,58,.5)'; g.lineWidth = 2; g.strokeRect((W - iw) / 2, 110, iw, ih); } catch (e) { /* no art, still a certificate */ }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#9a927f'; g.font = '600 22px Cinzel, serif'; g.letterSpacing = '8px';
    g.fillText('PUZZLESECRET  ·  SUDOKU WITH A SECRET', W / 2, 620);
    g.fillStyle = '#f6b23c'; g.font = '700 56px Cinzel, serif'; g.letterSpacing = '4px';
    g.fillText('CRACKED THE KEEPER’S VAULT', W / 2, 700);
    g.fillStyle = '#e8d5ae'; g.font = 'italic 500 34px "Cormorant Garamond", serif'; g.letterSpacing = '0px';
    g.fillText('Volume I  ·  two hundred puzzles, twenty hidden keys, three sealed words', W / 2, 752);
    // initials
    g.fillStyle = '#ffd47a'; g.font = '700 150px Cinzel, serif'; g.letterSpacing = '18px';
    g.shadowColor = 'rgba(246,178,60,.55)'; g.shadowBlur = 40; g.fillText(initials, W / 2, 930); g.shadowColor = 'transparent';
    g.fillStyle = '#9a927f'; g.font = '600 20px Cinzel, serif'; g.letterSpacing = '6px';
    g.fillText('SOLVER', W / 2, 972);
    // the record
    const lines = [
      'Vaults opened:  ' + (vaults.length ? vaults.join('  ·  ') : '—'),
      'Keeper’s pages found:  ' + (o.pages || 0) + ' of 9',
      both ? 'Both key-tiles recovered — the Keeper’s Mark' : (o.tiles && (o.tiles.II || o.tiles.III) ? 'One key-tile recovered' : ''),
      'Recorded  ' + date,
    ].filter(Boolean);
    g.fillStyle = '#e8d5ae'; g.font = 'italic 500 32px "Cormorant Garamond", serif'; g.letterSpacing = '0px';
    lines.forEach((L, i) => g.fillText(L, W / 2, 1060 + i * 46));
    // the seal + serial
    seal(g, W / 2, 1330, 88, both);
    g.fillStyle = 'rgba(154,146,127,.8)'; g.font = '600 18px Cinzel, serif'; g.letterSpacing = '5px';
    g.fillText('No. ' + hashSerial(initials + '|' + date + '|' + vaults.join('')), W / 2, 1448);
    g.fillStyle = '#9a927f'; g.font = '600 20px Cinzel, serif'; g.letterSpacing = '6px';
    g.textAlign = 'left'; g.fillText('PUZZLESECRET.COM', 96, 1418);
    g.textAlign = 'right'; g.fillText('THE VAULTS ARE BONUS TREASURE', W - 96, 1418);
    return c;
  }
  let panel = null;
  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div'); panel.id = 'certPanel'; panel.hidden = true;
    panel.innerHTML = `
      <div class="cert-card" role="dialog" aria-label="Your certificate">
        <div class="cert-kicker">YOUR CERTIFICATE</div>
        <p class="cert-line">Two or three initials, drawn here and nowhere else. Then save it, share it, or print it.</p>
        <div class="cert-row"><input id="certInit" type="text" maxlength="3" autocapitalize="characters" spellcheck="false" placeholder="initials" aria-label="Your initials, two or three letters" /><button type="button" class="gold-btn" id="certMake">Draw it</button></div>
        <div class="cert-out" id="certOut" hidden><img id="certImg" alt="Your certificate" /><p class="cert-hint">On a phone, press and hold the picture to save it.</p></div>
        <div class="cert-actions" id="certActions" hidden><a class="gold-btn" id="certDl" download="PuzzleSecret-Certificate.png">Download PNG</a><button type="button" class="ghost-btn" id="certShare" hidden>Share</button></div>
        <button type="button" class="ghost-btn" id="certClose">Close</button>
      </div>`;
    document.body.appendChild(panel);
    $('certClose').addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });
    $('certInit').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); });
    $('certInit').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('certMake').click(); });
    return panel;
  }
  let lastBlob = null;
  async function open(opts) {
    ensurePanel(); panel.hidden = false;
    const init = $('certInit');
    let mine = ''; try { mine = localStorage.getItem('ps_mark_v1') || ''; } catch (e) {}
    if (mine && !init.value) init.value = mine;
    $('certMake').onclick = async () => {
      const initials = init.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      if (initials.length < 2) { init.focus(); init.classList.add('bad'); setTimeout(() => init.classList.remove('bad'), 600); return; }
      $('certMake').textContent = 'Drawing…';
      const c = await render(Object.assign({}, opts, { initials }));
      $('certMake').textContent = 'Draw it again';
      const url = c.toDataURL('image/png');
      $('certImg').src = url; $('certOut').hidden = false; $('certActions').hidden = false;
      $('certDl').href = url;
      c.toBlob((b) => {
        lastBlob = b;
        const sb = $('certShare');
        try {
          const f = new File([b], 'PuzzleSecret-Certificate.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) {
            sb.hidden = false;
            sb.onclick = () => { navigator.share({ files: [f], title: 'Cracked the Keeper’s Vault', text: 'I cracked the Keeper’s Vault — Sudoku with a Secret. puzzlesecret.com' }).catch(() => {}); };
          } else sb.hidden = true;
        } catch (e) { sb.hidden = true; }
      }, 'image/png');
    };
    setTimeout(() => init.focus(), 60);
  }
  function fromStorage() {
    return { vaults: store.get('ps_vaults_v1', {}) || {}, tiles: store.get('ps_tiles_v1', {}) || {}, pages: (store.get('ps_story_v1', []) || []).filter((n) => typeof n === 'number').length };
  }
  window.PSCert = { open, render, fromStorage };
})();
