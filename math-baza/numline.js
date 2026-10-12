(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var MINUS = '\u2212';
  var W = 700, H = 150, PAD = 30, AXIS_Y = 100;

  function clampInt(v, lo, hi) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return lo;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function fmt(n) {
    return (n < 0 ? MINUS + String(-n) : String(n));
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }

  function makeSelect(id, options, value) {
    var s = el('select', { name: id });
    for (var i = 0; i < options.length; i++) {
      var o = el('option', { value: String(options[i].value) });
      o.textContent = options[i].label;
      s.appendChild(o);
    }
    s.value = String(value);
    return s;
  }

  function buildControls(root, state, redraw) {
    var ctl = el('div', { 'class': 'nl-ctl' });

    var startOpts = [];
    for (var n = -8; n <= 8; n++) startOpts.push({ value: n, label: fmt(n) });
    var opOpts = [
      { value: '+', label: 'прибавить (шаги вправо)' },
      { value: '-', label: 'вычесть (шаги влево)' }
    ];
    var stepOpts = [];
    for (var s = 1; s <= 8; s++) stepOpts.push({ value: s, label: String(s) });

    var l1 = el('label'); l1.textContent = 'Стою на числе';
    var sel1 = makeSelect('nl-start', startOpts, state.start);
    l1.appendChild(sel1);

    var l2 = el('label'); l2.textContent = 'Действие';
    var sel2 = makeSelect('nl-op', opOpts, state.op);
    l2.appendChild(sel2);

    var l3 = el('label'); l3.textContent = 'Шагов';
    var sel3 = makeSelect('nl-steps', stepOpts, state.steps);
    l3.appendChild(sel3);

    var btn = el('button', { type: 'button', 'class': 'btn' });
    btn.textContent = 'Показать шаги';

    sel1.addEventListener('change', function () { state.start = parseInt(sel1.value, 10); redraw(); });
    sel2.addEventListener('change', function () { state.op = sel2.value; redraw(); });
    sel3.addEventListener('change', function () { state.steps = parseInt(sel3.value, 10); redraw(); });
    btn.addEventListener('click', function () { redraw(); });

    ctl.appendChild(l1);
    ctl.appendChild(l2);
    ctl.appendChild(l3);
    ctl.appendChild(btn);
    return ctl;
  }

  function buildSvg(state) {
    var start = state.start;
    var steps = state.steps;
    var dir = state.op === '+' ? 1 : -1;
    var end = start + dir * steps;

    var lo = Math.min(start, end, 0) - 1;
    var hi = Math.max(start, end, 0) + 1;
    var u = (W - 2 * PAD) / (hi - lo);
    function x(n) { return PAD + (n - lo) * u; }

    var svg = svgEl('svg', {
      'class': 'nl-svg',
      role: 'img',
      'aria-label': fmt(start) + ' ' + (state.op === '+' ? '+' : MINUS) + ' ' + steps + ' = ' + fmt(end),
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%'
    });

    var axis = svgEl('line', { 'class': 'nl-axis', x1: x(lo), y1: AXIS_Y, x2: x(hi), y2: AXIS_Y });
    svg.appendChild(axis);

    var ah = 9;
    svg.appendChild(svgEl('line', { 'class': 'nl-axis', x1: x(hi), y1: AXIS_Y, x2: x(hi) - ah, y2: AXIS_Y - ah * 0.6 }));
    svg.appendChild(svgEl('line', { 'class': 'nl-axis', x1: x(hi), y1: AXIS_Y, x2: x(hi) - ah, y2: AXIS_Y + ah * 0.6 }));

    for (var n = lo; n <= hi; n++) {
      svg.appendChild(svgEl('line', { 'class': 'nl-tick', x1: x(n), y1: 94, x2: x(n), y2: 106 }));
      var keep = (n % 2 === 0 && Math.abs(n - start) !== 1 && Math.abs(n - end) !== 1) || n === start || n === end || n === 0;
      if (u < 48 && !keep) continue; // длинная ось: подписи через одну, чтобы не слипались
      var cls = 'nl-num' + (n === 0 ? ' nl-zero' : '');
      var t = svgEl('text', { 'class': cls, x: x(n), y: 130, 'text-anchor': 'middle' });
      t.textContent = fmt(n);
      svg.appendChild(t);
    }

    for (var i = 0; i < steps; i++) {
      var a = start + dir * i;
      var x1 = x(a), x2 = x(a + dir), xm = (x1 + x2) / 2;
      svg.appendChild(svgEl('path', { 'class': 'nl-arc', d: 'M ' + x1 + ' ' + AXIS_Y + ' Q ' + xm + ' 66 ' + x2 + ' ' + AXIS_Y }));
    }

    var lastX = x(end);
    var ah2 = 9;
    svg.appendChild(svgEl('line', { 'class': 'nl-arc', x1: lastX, y1: AXIS_Y, x2: lastX - dir * ah2, y2: AXIS_Y - ah2 * 0.6 }));
    svg.appendChild(svgEl('line', { 'class': 'nl-arc', x1: lastX, y1: AXIS_Y, x2: lastX - dir * ah2, y2: AXIS_Y + ah2 * 0.6 }));

    svg.appendChild(svgEl('circle', { 'class': 'nl-start', cx: x(start), cy: AXIS_Y, r: 7 }));
    svg.appendChild(svgEl('circle', { 'class': 'nl-dot', cx: x(end), cy: AXIS_Y, r: 7 }));

    return svg;
  }

  function buildOut(state) {
    var start = state.start;
    var steps = state.steps;
    var end = start + (state.op === '+' ? steps : -steps);
    var p = el('p', { 'class': 'nl-out', 'aria-live': 'polite' });
    p.textContent = fmt(start) + ' ' + (state.op === '+' ? '+' : MINUS) + ' ' + steps + ' = ' + fmt(end);
    return p;
  }

  function init(root) {
    var state = {
      start: clampInt(root.getAttribute('data-start'), -8, 8),
      op: root.getAttribute('data-op') === '-' ? '-' : '+',
      steps: clampInt(root.getAttribute('data-steps'), 1, 8)
    };

    var wrap = el('div', { 'class': 'nl-wrap' });
    var out = el('p', { 'class': 'nl-out', 'aria-live': 'polite' });

    function redraw() {
      wrap.textContent = '';
      wrap.appendChild(buildSvg(state));
      out.textContent = fmt(state.start) + ' ' + (state.op === '+' ? '+' : MINUS) + ' ' + state.steps + ' = ' + fmt(state.start + (state.op === '+' ? state.steps : -state.steps));
    }

    root.appendChild(buildControls(root, state, redraw));
    root.appendChild(wrap);
    root.appendChild(out);
    redraw();
  }

  function ready() {
    var roots = document.querySelectorAll('.numline');
    for (var i = 0; i < roots.length; i++) {
      try { init(roots[i]); } catch (e) { /* без ошибок в консоли */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
