(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var src = $('src'), out = $('out'), pron = $('pron'), msg = $('msg'), mic = $('mic'), speak = $('speak');
  var root = document.documentElement;
  function setMsg(t) { msg.textContent = t || ''; }

  // Theme (same localStorage "theme" + data-theme scheme as live-score-cards)
  var themeBtn = $('theme');
  function applyTheme(t) {
    root.dataset.theme = t;
    themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = t === 'dark' ? '#0e1116' : '#ffffff';
  }
  applyTheme(root.dataset.theme || 'light');
  themeBtn.onclick = function () {
    var t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    try { localStorage.setItem('theme', t); } catch (e) {}
  };

  // Translation: debounce, cache, abort stale
  var cache = new Map(), ctrl = null, timer = null;
  function show(t) {
    var d = document.createElement('textarea'); d.innerHTML = t;
    out.textContent = d.value; pron.textContent = window.phonetic ? window.phonetic(d.value) : ''; setMsg('');
  }
  function translate(text) {
    text = text.trim();
    if (ctrl) ctrl.abort();
    if (!text) { out.textContent = ''; pron.textContent = ''; setMsg(''); return; }
    if (cache.has(text)) { show(cache.get(text)); return; }
    ctrl = new AbortController();
    setMsg('Translating…');
    var sig = { signal: ctrl.signal };
    fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=' + encodeURIComponent(text), sig)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j[0].map(function (p) { return p[0]; }).join(''); })
      .catch(function (e) {
        if (e.name === 'AbortError') throw e;
        return fetch('https://api.mymemory.translated.net/get?langpair=en|es&q=' + encodeURIComponent(text), sig)
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (j) {
            var t = j && j.responseData && j.responseData.translatedText;
            if (!t || (j.responseStatus && +j.responseStatus !== 200)) throw new Error('bad');
            return t;
          });
      })
      .then(function (t) {
        cache.set(text, t);
        if (cache.size > 100) cache.delete(cache.keys().next().value);
        show(t);
      })
      .catch(function (e) { if (e.name !== 'AbortError') setMsg('Translation failed. Check connection.'); });
  }
  src.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { translate(src.value); }, 400);
  });
  $('clear').onclick = function () { clearTimeout(timer); src.value = ''; translate(''); src.focus(); };
  $('copy').onclick = function () {
    if (!out.textContent) return;
    (navigator.clipboard ? navigator.clipboard.writeText(out.textContent) : Promise.reject())
      .then(function () { setMsg('Copied'); }, function () { setMsg('Copy not supported'); });
  };

  // Spanish readout
  var synth = window.speechSynthesis;
  if (!synth) { speak.disabled = true; speak.title = 'Speech output not supported'; }
  speak.onclick = function () {
    var t = out.textContent;
    if (!synth || !t) return;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(t), vs = synth.getVoices();
    var v = vs.filter(function (x) { return /^es[-_](ES|MX|US)/i.test(x.lang); })[0] ||
            vs.filter(function (x) { return /^es/i.test(x.lang); })[0];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
    synth.speak(u);
  };

  // Mic input
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { mic.disabled = true; mic.title = 'Speech input not supported in this browser'; }
  else {
    var rec = new SR(), on = false;
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    var setOn = function (v) { on = v; mic.setAttribute('aria-pressed', v); mic.textContent = v ? '⏹ Listening…' : '🎤 Speak'; };
    rec.onresult = function (e) {
      var s = '';
      for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      src.value = s;
      clearTimeout(timer);
      if (e.results[e.results.length - 1].isFinal) translate(s);
    };
    rec.onend = function () { setOn(false); };
    rec.onerror = function (e) {
      setOn(false);
      setMsg(e.error === 'not-allowed' ? 'Microphone permission denied.' : e.error === 'no-speech' ? 'No speech heard.' : 'Mic error: ' + e.error);
    };
    mic.onclick = function () {
      if (on) { rec.stop(); return; }
      setMsg('');
      try { rec.start(); setOn(true); } catch (e) {}
    };
  }

  // New-version detection: compare page's build stamp to deployed version.json
  var build = (document.querySelector('meta[name=build]') || {}).content;
  $('reload').onclick = function () { location.reload(); };
  function check() {
    if (!build || build.indexOf('__') === 0) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.build && j.build !== build) $('update').hidden = false; })
      .catch(function () {});
  }
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  check();
})();
