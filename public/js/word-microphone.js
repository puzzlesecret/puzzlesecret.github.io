/* Shared optional voice input. No audio/word uploads to PuzzleSecret and no auto-submit. */
(function () {
  'use strict';
  window.psWordMicrophone = function (options) {
    var input = document.getElementById(options.inputId);
    var button = document.getElementById(options.buttonId);
    var status = document.getElementById(options.statusId);
    if (!input || !button || !status) return null;
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var session = null, timer = null, received = false;
    var start = function () {};
    var armed = false, optedOut = false, automaticAttempted = false, revision = 0;
    var label = button.querySelector('[data-mic-label]') || button;
    function say(text) { status.textContent = text; }
    function state(value, text) {
      button.dataset.micState = value; label.textContent = text;
      button.setAttribute('aria-pressed', String(value === 'armed' || value === 'starting' || value === 'listening'));
      var accessible = value === 'armed' ? 'Turn automatic microphone off' : value === 'starting' ? 'Cancel microphone startup' : value === 'listening' ? 'Turn microphone off' : value === 'unavailable' ? 'Microphone unavailable' : 'Turn microphone on';
      button.setAttribute('aria-label', accessible); button.title = accessible;
    }
    function stop(message) {
      revision++; armed = false;
      clearTimeout(timer); timer = null;
      var old = session; session = null;
      if (old) { try { old.abort(); } catch (_) {} }
      state('idle', 'Use microphone');
      if (message) say(message);
    }
    function failure(error) {
      if (error === 'not-allowed') return 'Microphone access was blocked. In Chrome, open the site controls beside the address bar, allow Microphone, then choose Use microphone again. You can still type.';
      if (error === 'service-not-allowed') return 'Your browser’s speech service is unavailable. You can type, or use your device keyboard’s microphone if it has one.';
      if (error === 'network') return 'The speech service could not connect. Your word is still here. Try again later, or use your keyboard’s microphone if available.';
      if (error === 'audio-capture') return 'No working microphone was found. Check your computer’s input device, or type your word.';
      if (error === 'language-not-supported') return 'English voice input is unavailable in this browser. You can still type your word.';
      return 'No clear word was captured. Speak one word or spell its letters, then review the text. You can also type.';
    }
    if (!Recognition || !window.isSecureContext) {
      button.disabled = true; state('unavailable', 'Microphone unavailable');
      say(!window.isSecureContext ? 'Voice input needs a secure HTTPS page. You can still type.' : 'This browser does not offer voice transcription here. Your device keyboard’s microphone may still work, or type your word.');
    } else {
      button.disabled = false; state('idle', 'Use microphone');
      start = function (settings) {
        var automatic = !!(settings && settings.automatic);
        if (automatic && (!armed || optedOut || automaticAttempted)) return;
        if (session) return;
        if (document.hidden || (options.isBusy && options.isBusy()) || (automatic && input.value.trim())) { stop(); return; }
        armed = false; revision++;
        if (automatic) automaticAttempted = true;
        if (options.beforeStart) options.beforeStart();
        var rec;
        try { rec = new Recognition(); } catch (_) { stop('The microphone could not start in this browser. You can still type.'); return; }
        session = rec; received = false;
        rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
        state('starting', 'Starting…');
        say('Starting the microphone. If Chrome asks, choose Allow while visiting this site.');
        rec.onstart = function () {
          if (session !== rec || document.hidden) return;
          state('listening', 'Stop microphone'); say('Listening. Say your word, or spell its letters.');
        };
        rec.onaudiostart = function () {
          if (session !== rec || document.hidden) return;
          state('listening', 'Stop microphone'); say('Microphone is capturing audio. Say your word, or spell its letters.');
        };
        rec.onspeechstart = function () { if (session === rec) say('Hearing your voice…'); };
        rec.onresult = function (event) {
          if (session !== rec || document.hidden) return;
          var result = event.results && event.results[event.resultIndex || 0];
          var text = result && result[0] && result[0].transcript;
          if (!text || !text.trim()) { stop(failure('no-speech')); return; }
          if (options.validateTranscript) {
            var accepted = options.validateTranscript(text.trim());
            if (accepted !== true) { stop(typeof accepted === 'string' ? accepted : 'Please say just the word, or edit it by typing.'); input.focus(); return; }
          }
          received = true; input.value = text.trim(); input.removeAttribute('aria-invalid');
          stop('Your voice became text. Check or edit it, then submit the word when ready.');
          input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
        };
        rec.onerror = function (event) { if (session === rec) stop(failure(event.error)); };
        rec.onend = function () { if (session === rec) stop(received ? '' : failure('no-speech')); };
        try {
          rec.start();
          timer = setTimeout(function () { if (session === rec) stop('The microphone timed out. Check microphone permission and your input device, then try again or type.'); }, 25000);
        } catch (_) { stop('The microphone could not start. Check browser permission, or type your word.'); }
      };
      button.addEventListener('click', function () {
        if (session || armed) { optedOut = true; stop('Microphone off. You can type your word.'); return; }
        optedOut = false; start();
      });
      input.addEventListener('input', function (event) {
        // Real typing wins over both queued listening and recognition. The
        // synthetic transcript event must not cancel or restart its own session.
        if (event.isTrusted) { optedOut = true; stop('Microphone off while you type.'); }
      });
      if (options.autoOnFocus) {
        var keyboardFocus = false;
        input.addEventListener('pointerdown', function (event) { if (event.isTrusted) fromIntent(); });
        document.addEventListener('keydown', function (event) { keyboardFocus = event.isTrusted && event.key === 'Tab'; setTimeout(function () { keyboardFocus = false; }, 0); }, true);
        input.addEventListener('focus', function () { if (keyboardFocus) { keyboardFocus = false; fromIntent(); } });
      }
    }
    function arm() {
      if (!Recognition || !window.isSecureContext || optedOut || automaticAttempted || document.hidden || input.value.trim() || (options.isBusy && options.isBusy())) return false;
      armed = true; revision++; state('armed', 'Microphone ready');
      say(options.waitingMessage || 'Voice is ready. Tap the microphone to switch it off, or type.');
      return true;
    }
    function fromIntent() { if (!arm()) return false; start({ automatic: true }); return true; }
    function autoStartIfGranted() {
      var version = revision;
      if (!Recognition || !window.isSecureContext || !window.navigator || !window.navigator.permissions) return Promise.resolve(false);
      return window.navigator.permissions.query({ name: 'microphone' }).then(function (permission) {
        if (revision !== version || optedOut || automaticAttempted || document.hidden || input.value.trim()) return false;
        if (permission.state === 'denied') { optedOut = true; say('Microphone is blocked. You can type, or enable it in your browser’s site controls.'); return false; }
        if (permission.state === 'granted') return fromIntent();
        return false; // A new permission prompt waits for the visitor's input action.
      }).catch(function () { return false; });
    }
    function leave() { stop('Microphone stopped when you left the page. Your text is still here.'); }
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', function () { if (document.hidden) leave(); });
    return { stop: stop, arm: arm, start: start, autoStartIfGranted: autoStartIfGranted, get active() { return !!session || armed; } };
  };
})();
