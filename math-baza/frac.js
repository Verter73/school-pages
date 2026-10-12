(function () {
  'use strict';

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  function norm(raw) {
    return String(raw)
      .replace(/\u00a0/g, ' ')
      .replace(/[−–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseFrac(s) {
    var m = s.match(/^(-?\d+) ?\/ ?(\d+)$/);
    if (!m) return null;
    var n = parseInt(m[1], 10);
    var d = parseInt(m[2], 10);
    if (d === 0) return null;
    return { n: n, d: d };
  }

  function parseMixed(s) {
    var m = s.match(/^(\d+) (\d+) ?\/ ?(\d+)$/);
    if (m) {
      var w = parseInt(m[1], 10);
      var n = parseInt(m[2], 10);
      var d = parseInt(m[3], 10);
      if (d === 0) return null;
      return { w: w, n: n, d: d };
    }
    var m2 = s.match(/^\d+$/);
    if (m2) {
      return { w: parseInt(s, 10), n: 0, d: 1 };
    }
    return null;
  }

  function same(a, b) {
    return a.n * b.d === b.n * a.d;
  }

  function toImproper(m) {
    return { n: m.w * m.d + m.n, d: m.d };
  }

  function check(type, raw, ans) {
    var s = norm(raw);

    if (type === 'num') {
      var t = s.replace(',', '.');
      if (!/^-?\d+$/.test(t)) {
        return { ok: false, invalid: true, msg: 'Введи целое число.' };
      }
      if (Number(t) === Number(ans)) {
        return { ok: true, invalid: false, msg: '' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'frac') {
      var p = parseFrac(s);
      if (!p) {
        return { ok: false, invalid: true, msg: 'Введи дробь через черту, например 3/4.' };
      }
      var e = parseFrac(String(ans));
      if (p.n === e.n && p.d === e.d) {
        return { ok: true, invalid: false, msg: '' };
      }
      if (same(p, e)) {
        return { ok: false, invalid: false, msg: 'Значение верное, но дробь ещё сокращается. Сократи до конца.' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'mixed') {
      var m = parseMixed(s);
      if (!m) {
        var pf = parseFrac(s);
        if (pf) {
          var em = parseMixed(String(ans));
          var ei = toImproper(em);
          if (same(pf, ei)) {
            return { ok: false, invalid: false, msg: 'Нужно смешанное число: выдели целую часть, например 2 3/4.' };
          }
          return { ok: false, invalid: false, msg: '' };
        }
        return { ok: false, invalid: true, msg: 'Введи смешанное число, например 2 3/4, или целое число.' };
      }
      var am = parseMixed(String(ans));
      if (m.w === am.w && m.n === am.n && m.d === am.d) {
        return { ok: true, invalid: false, msg: '' };
      }
      if (same(toImproper(m), toImproper(am))) {
        return { ok: false, invalid: false, msg: 'Значение верное, но запись не доведена: сократи дробную часть и выдели целую до конца.' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'raw') {
      var pr = parseFrac(s);
      if (!pr) {
        return { ok: false, invalid: true, msg: 'Введи дробь через черту, например 25/30.' };
      }
      var er = parseFrac(String(ans));
      if (pr.n === er.n && pr.d === er.d) {
        return { ok: true, invalid: false, msg: '' };
      }
      if (same(pr, er)) {
        return { ok: false, invalid: false, msg: 'Значение то же, но нужен знаменатель, который просят в задании.' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'sign') {
      var sg = s.replace(/\s+/g, '');
      if (sg !== '<' && sg !== '>' && sg !== '=') {
        return { ok: false, invalid: true, msg: 'Поставь знак: <, > или =.' };
      }
      if (sg === String(ans)) {
        return { ok: true, invalid: false, msg: '' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'yn') {
      var y = s.toLowerCase();
      if (y !== 'да' && y !== 'нет') {
        return { ok: false, invalid: true, msg: 'Ответь «да» или «нет».' };
      }
      if (y === String(ans).toLowerCase()) {
        return { ok: true, invalid: false, msg: '' };
      }
      return { ok: false, invalid: false, msg: '' };
    }

    if (type === 'list') {
      var parts = s.split(/\s*[,;]\s*/);
      var list = [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part === '') continue;
        var f = parseFrac(part);
        if (!f) {
          return { ok: false, invalid: true, msg: 'Введи дроби через запятую, например 1/2, 3/4.' };
        }
        list.push(f);
      }
      if (list.length === 0) {
        return { ok: false, invalid: true, msg: 'Введи дроби через запятую, например 1/2, 3/4.' };
      }
      var alist = [];
      var aparts = String(ans).split(/\s*[,;]\s*/);
      for (var j = 0; j < aparts.length; j++) {
        var ap = aparts[j];
        if (ap === '') continue;
        var af = parseFrac(ap);
        if (!af) {
          return { ok: false, invalid: true, msg: 'Введи дроби через запятую, например 1/2, 3/4.' };
        }
        alist.push(af);
      }
      if (list.length === alist.length) {
        var allSame = true;
        for (var k = 0; k < list.length; k++) {
          if (!same(list[k], alist[k])) {
            allSame = false;
            break;
          }
        }
        if (allSame) {
          return { ok: true, invalid: false, msg: '' };
        }
      }
      var sl = list.slice().sort(function (a, b) { return a.n / a.d - b.n / b.d; });
      var sa = alist.slice().sort(function (a, b) { return a.n / a.d - b.n / b.d; });
      if (sl.length === sa.length) {
        var sortedSame = true;
        for (var q = 0; q < sl.length; q++) {
          if (!same(sl[q], sa[q])) {
            sortedSame = false;
            break;
          }
        }
        if (sortedSame) {
          return { ok: false, invalid: false, msg: 'Дроби те же, но порядок другой.' };
        }
      }
      return { ok: false, invalid: false, msg: '' };
    }

    return { ok: false, invalid: true, msg: 'Неизвестный тип ответа.' };
  }

  function placeholder(type) {
    if (type === 'num') return '';
    if (type === 'frac') return '3/4';
    if (type === 'mixed') return '2 3/4';
    if (type === 'raw') return '6/8';
    if (type === 'sign') return '< > =';
    if (type === 'yn') return 'да / нет';
    if (type === 'list') return '1/2, 3/4';
    return '';
  }

  window.FracAns = { check: check, placeholder: placeholder };
})();
