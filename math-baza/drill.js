(function () {
  'use strict';

  function fmt(n) {
    return String(n).replace(/-/g, '\u2212').replace(/\./g, ',');
  }

  function norm(s) {
    return String(s)
      .replace(/\s+/g, '')
      .replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/,/g, '.');
  }

  function buildTask(li, rec) {
    var ans = rec.ans || [];
    var hints = rec.hints || [];
    var sol = rec.sol;
    var labels = rec.labels || [];

    var qrow = document.createElement('div');
    qrow.className = 'qrow';

    var inputs = [];
    for (var i = 0; i < ans.length; i++) {
      var label = document.createElement('label');
      var lab = labels[i];
      if (lab) label.textContent = lab;
      var input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('inputmode', 'text');
      input.autocomplete = 'off';
      input.setAttribute('aria-label', lab || 'Ответ');
      label.appendChild(input);
      qrow.appendChild(label);
      inputs.push(input);
    }

    var checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'btn main';
    checkBtn.textContent = 'Проверить ответ';
    qrow.appendChild(checkBtn);

    var hintBtn = null;
    if (hints.length > 0) {
      hintBtn = document.createElement('button');
      hintBtn.type = 'button';
      hintBtn.className = 'btn';
      hintBtn.textContent = 'Показать подсказку 1';
      qrow.appendChild(hintBtn);
    }

    var verdict = document.createElement('div');
    verdict.className = 'verdict';
    verdict.setAttribute('aria-live', 'polite');

    var extra = document.createElement('div');
    extra.className = 'extra';

    var expr = li.querySelector('.expr');
    if (expr && expr.nextSibling) {
      li.insertBefore(qrow, expr.nextSibling);
      li.insertBefore(verdict, qrow.nextSibling);
      li.insertBefore(extra, verdict.nextSibling);
    } else {
      li.appendChild(qrow);
      li.appendChild(verdict);
      li.appendChild(extra);
    }

    var state = {
      attempts: 0,
      hintShown: 0,
      solBtn: null,
      solAdded: false
    };

    // Рисунки-подсказки лежат вне li и скрыты, пока ученик не дошёл до нужного шага.
    function reveal(kind) {
      var figs = document.querySelectorAll('figure[data-task="' + li.getAttribute('data-id') + '"][data-reveal]');
      for (var f = 0; f < figs.length; f++) {
        var when = figs[f].getAttribute('data-reveal');
        if (kind === 'done' || when === kind) figs[f].hidden = false;
      }
    }

    function setVerdict(text, cls) {
      verdict.textContent = text;
      verdict.className = 'verdict' + (cls ? ' ' + cls : '');
    }

    function check() {
      var vals = [];
      for (var i = 0; i < inputs.length; i++) {
        var raw = inputs[i].value;
        var n = norm(raw);
        if (n === '' || !/^-?\d+(\.\d+)?$/.test(n)) {
          setVerdict('Введи число в каждое поле.', '');
          return;
        }
        vals.push(Number(n));
      }

      var ok = true;
      for (var j = 0; j < ans.length; j++) {
        if (vals[j] !== ans[j]) { ok = false; break; }
      }

      if (ok) {
        setVerdict('Верно.', 'ok');
        li.classList.add('done');
        reveal('done');
        updateScore(li);
      } else {
        state.attempts++;
        setVerdict('Не сошлось, найди шаг, где разошлось.', 'bad');
        if (state.attempts >= 2 && !state.solBtn) {
          var sb = document.createElement('button');
          sb.type = 'button';
          sb.className = 'btn';
          sb.textContent = 'Показать решение';
          sb.addEventListener('click', showSol);
          qrow.appendChild(sb);
          state.solBtn = sb;
        }
      }
    }

    function showSol() {
      if (state.solAdded) return;
      state.solAdded = true;
      var block = document.createElement('div');
      block.className = 'sol';
      var b = document.createElement('b');
      b.textContent = 'Решение. ';
      block.appendChild(b);
      if (sol) {
        block.appendChild(document.createTextNode(sol + ' '));
      }
      var parts = [];
      for (var i = 0; i < ans.length; i++) {
        var lab = labels[i];
        parts.push(lab ? lab + ' ' + fmt(ans[i]) : fmt(ans[i]));
      }
      block.appendChild(document.createTextNode('Ответ: ' + parts.join('; ')));
      extra.appendChild(block);
      if (state.solBtn) state.solBtn.hidden = true;
      reveal('done');
    }

    checkBtn.addEventListener('click', check);

    for (var k = 0; k < inputs.length; k++) {
      inputs[k].addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); check(); }
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener('click', function () {
        var idx = state.hintShown;
        if (idx >= hints.length) return;
        var block = document.createElement('div');
        block.className = 'hint';
        var b = document.createElement('b');
        b.textContent = 'Подсказка ' + (idx + 1) + '. ';
        block.appendChild(b);
        block.appendChild(document.createTextNode(hints[idx]));
        extra.appendChild(block);
        state.hintShown++;
        if (state.hintShown >= 2) reveal('hint2');
        if (state.hintShown < hints.length) {
          hintBtn.textContent = 'Показать подсказку ' + (state.hintShown + 1);
        } else {
          hintBtn.hidden = true;
        }
      });
    }
  }

  function updateScore(li) {
    var sec = li.closest('section');
    if (!sec) return;
    var id = sec.id;
    if (!id) return;
    var total = sec.querySelectorAll('li.task').length;
    var done = sec.querySelectorAll('li.task.done').length;
    var els = document.querySelectorAll('.score[data-for="' + id + '"]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = 'Верно: ' + done + ' из ' + total;
    }
  }

  function init() {
    var dataEl = document.getElementById('data');
    if (!dataEl) return;
    var data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }
    if (!data || typeof data !== 'object') return;

    var tasks = document.querySelectorAll('li.task[data-id]');
    for (var i = 0; i < tasks.length; i++) {
      var li = tasks[i];
      var id = li.getAttribute('data-id');
      if (data[id]) buildTask(li, data[id]);
    }

    var secs = document.querySelectorAll('section[id]');
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (sec.querySelectorAll('li.task').length === 0) continue;
      var id = sec.id;
      var total = sec.querySelectorAll('li.task').length;
      var done = sec.querySelectorAll('li.task.done').length;
      var els = document.querySelectorAll('.score[data-for="' + id + '"]');
      for (var j = 0; j < els.length; j++) {
        els[j].textContent = 'Верно: ' + done + ' из ' + total;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
