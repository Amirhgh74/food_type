/* views/today.js — the default view: today's date, streak, progress and one wide day editor. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  var root = null;
  var editor = null;
  var dayKey = null;

  /* Consecutive days with at least one item, counting back from today.
     If today has nothing yet, counting starts at yesterday so the streak isn't lost early. */
  function streak() {
    var d = FT.dates.today();
    if (!FT.store.count(FT.dates.key(d))) d = FT.dates.addDays(d, -1);
    var n = 0;
    while (FT.store.count(FT.dates.key(d)) > 0 && n < 100000) {
      n++;
      d = FT.dates.addDays(d, -1);
    }
    return n;
  }

  function build(section) {
    root = section;
    dayKey = FT.dates.todayKey();
    section.innerHTML =
      '<header class="page-head">' +
        '<div class="page-head-main">' +
          '<span class="eyebrow">TODAY</span>' +
          '<h1 data-role="date"></h1>' +
        '</div>' +
        '<div class="page-head-side">' +
          '<span class="pill pill-streak" data-role="streak" hidden></span>' +
          '<div class="progress-block">' +
            '<span class="progress-label" data-role="progress-label"></span>' +
            '<div class="progress" role="progressbar" data-role="bar" aria-valuemin="0" ' +
              'aria-valuemax="' + FT.ITEMS.length + '" aria-valuenow="0" ' +
              'aria-label="Food groups logged today">' +
              '<span class="progress-fill" data-role="fill"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="card"><div data-role="editor"></div></div>';

    editor = FT.dayEditor(section.querySelector('[data-role="editor"]'), dayKey, { wide: true });
    FT.store.subscribe(function () { if (root) paint(); });
  }

  function paint() {
    var d = FT.dates.parse(dayKey);
    var count = FT.store.count(dayKey);
    var total = FT.ITEMS.length;

    root.querySelector('[data-role="date"]').textContent = FT.dates.longNoYear(d);

    var s = streak();
    var pill = root.querySelector('[data-role="streak"]');
    pill.hidden = s === 0;
    pill.innerHTML = FT.icon('flame', 16) + ' ' + s + '-day streak';

    root.querySelector('[data-role="progress-label"]').textContent =
      count + '/' + total + ' food groups';
    var bar = root.querySelector('[data-role="bar"]');
    bar.setAttribute('aria-valuenow', String(count));
    bar.setAttribute('aria-valuetext', count + ' of ' + total + ' food groups');
    root.querySelector('[data-role="fill"]').style.width = (count / total * 100).toFixed(2) + '%';
  }

  FT.views.today = {
    show: function (section) {
      if (!root) build(section);
      FT.views.today.refresh();
    },
    /* Called on visibilitychange so an app left open rolls over to the new day. */
    refresh: function () {
      if (!root) return;
      var now = FT.dates.todayKey();
      if (now !== dayKey) {
        dayKey = now;
        if (editor) editor.setDate(dayKey);
      }
      paint();
    }
  };
})();
