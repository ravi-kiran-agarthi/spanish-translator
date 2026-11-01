(function (root) {
  'use strict';
  var BASE = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
  var VOW = { a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo' };
  var DIPH = { ai: 'eye', ei: 'ay', oi: 'oy', au: 'ow', eu: 'eh-oo', ou: 'oh-oo' };
  var CLUSTER = /^(pl|pr|bl|br|fl|fr|cl|cr|gl|gr|tr|dr|tl|kl|kr)$/;
  var SIMPLE = { b: 'b', v: 'b', d: 'd', f: 'f', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', s: 's', t: 't', w: 'w',
    'ñ': 'ny', j: 'h', z: 's', h: '', y: 'y' };

  function isVowel(c) { return 'aeiouáéíóúü'.indexOf(c) >= 0; }
  function isStrong(c) { return 'aeoáéó'.indexOf(c) >= 0; }
  function isAccWeak(c) { return c === 'í' || c === 'ú'; }
  function isWeak(c) { return c === 'i' || c === 'u' || c === 'ü'; }
  function base(c) { return BASE[c] || c; }

  function parse(w) {
    var items = [], n = w.length, i = 0, mex = /^m[eé]xi/.test(w);
    while (i < n) {
      var c = w[i], nx = w[i + 1] || '', nn = w[i + 2] || '', front = 'eiéí'.indexOf(nx) >= 0 && nx;
      if (c === 'y' && i === n - 1) { items.push({ v: 1, c: 'i' }); i++; }
      else if (isVowel(c)) { items.push({ v: 1, c: c }); i++; }
      else if (c === 'q' && nx === 'u' && nn && 'eiéí'.indexOf(nn) >= 0) { items.push({ s: 'qu', p: 'k' }); i += 2; }
      else if (c === 'g' && nx === 'u' && nn && 'eiéí'.indexOf(nn) >= 0) { items.push({ s: 'gu', p: 'g' }); i += 2; }
      else if (c === 'c' && nx === 'h') { items.push({ s: 'ch', p: 'ch' }); i += 2; }
      else if (c === 'l' && nx === 'l') { items.push({ s: 'll', p: 'y' }); i += 2; }
      else if (c === 'r' && nx === 'r') { items.push({ s: 'rr', p: 'rr' }); i += 2; }
      else {
        var p;
        if (c === 'c') p = front ? 's' : 'k';
        else if (c === 'g') p = front ? 'h' : 'g';
        else if (c === 'q') p = 'k';
        else if (c === 'x') p = mex ? 'h' : 'ks';
        else if (c === 'r') {
          var prev = items[items.length - 1];
          p = !prev || (!prev.v && 'nls'.indexOf(prev.s) >= 0 && prev.s.length === 1) ? 'rr' : 'r';
        } else p = SIMPLE.hasOwnProperty(c) ? SIMPLE[c] : c;
        items.push({ s: c, p: p });
        i++;
      }
    }
    return items;
  }

  function nucleusPhon(n) {
    if (n.length === 1) return VOW[base(n[0])] || n[0];
    var pre = '', start = 0;
    if (isWeak(n[0])) { pre = n[0] === 'i' ? 'y' : 'w'; start = 1; }
    var rem = n.slice(start).map(base);
    if (rem.length === 1) return pre + VOW[rem[0]];
    if (rem.length === 2 && DIPH[rem.join('')]) return pre + DIPH[rem.join('')];
    return pre + rem.map(function (c) { return VOW[c]; }).join('');
  }

  function word(w) {
    var items = parse(w), nuclei = [], runs = [[]], i, j;
    // runs[0] precedes nucleus 0; runs[m + 1] follows nucleus m
    for (i = 0; i < items.length;) {
      if (!items[i].v) { runs[runs.length - 1].push(items[i]); i++; continue; }
      var cur = null;
      for (j = i; j < items.length && items[j].v; j++) {
        var c = items[j].c, pc = cur && cur[cur.length - 1];
        if (cur && !(isStrong(pc) && isStrong(c)) && !isAccWeak(pc) && !isAccWeak(c)) cur.push(c);
        else { if (cur) runs.push([]); cur = [c]; nuclei.push(cur); }
      }
      runs.push([]);
      i = j;
    }
    if (!nuclei.length) return w;
    var syl = [], onset = runs[0], k;
    for (k = 0; k < nuclei.length; k++) {
      var cs = runs[k + 1], coda = cs;
      if (k < nuclei.length - 1) {
        var on = cs.length >= 2 && CLUSTER.test(cs[cs.length - 2].s + cs[cs.length - 1].s) ? 2 : Math.min(1, cs.length);
        coda = cs.slice(0, cs.length - on);
      }
      syl.push({ on: onset, nu: nuclei[k], co: coda });
      onset = cs.slice(coda.length);
    }
    var stress = -1;
    for (k = 0; k < syl.length; k++) {
      if (syl[k].nu.some(function (c) { return base(c) !== c && c !== 'ü'; })) { stress = k; break; }
    }
    if (stress < 0) {
      stress = syl.length > 1 && 'aeiouáéíóúüns'.indexOf(w[w.length - 1]) >= 0 ? syl.length - 2 : syl.length - 1;
    }
    var join = function (a) { return a.map(function (x) { return x.p; }).join(''); };
    var out = syl.map(function (s) { return join(s.on) + nucleusPhon(s.nu) + join(s.co); });
    if (out.length > 1) out[stress] = out[stress].toUpperCase();
    return out.join('-');
  }

  function phonetic(text) {
    return String(text).replace(/[a-záéíóúüñ]+/gi, function (w) { return word(w.toLowerCase()); });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = phonetic;
  else root.phonetic = phonetic;
})(typeof window !== 'undefined' ? window : this);
