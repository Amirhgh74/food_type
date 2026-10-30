/* views/calendar.js — month grid, shaded by how many groups were logged.
   Also defines FT.level(count), reused by the count pills in Analytics. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  /* 0 when nothing is logged, otherwise 1..4 */
  FT.level = function (count) {
    if (!count) return 0;
    return Math.min(4, Math.ceil(count / FT.ITEMS.length * 4));
  };

  var root = null;
  var shown = null;          /* Date: first of the displayed month */
  var selectedKey = null;
  var flashTimer = null;

  function build(section) {
    root = section;
    shown = FT.dates.startOfMonth(FT.dates.today());
    selectedKey = FT.dates.todayKey();

    section.innerHTML =
      '<header class="page-head">' +
        '<div class="page-head-main">' +
          '<span class="eyebrow">CALENDAR</span>' +
          '<h1 data-role="title"></h1>' +
          '<p class="page-sub" data-role="summary"></p>' +
        '</div>' +
      '</header>' +
      '<div class="card">' +
        '<div class="cal-bar">' +
          '<div class="cal-bar-left">' +
            '<button type="button" class="icon-btn" data-role="prev" aria-label="Previous month">' +
              '<span data-icon="chevron-left"></span></button>' +
            '<label class="select-wrap"><span class="sr-only">Month</span>' +
              '<select data-role="month">' +
                FT.dates.MONTHS.map(function (m, i) {
                  return '<option value="' + i + '">' + m + '</option>';
                }).join('') +
              '</select></label>' +
            '<label class="select-wrap"><span class="sr-only">Year</span>' +
              '<select data-role="year"></select></label>' +
            '<button type="button" class="icon-btn" data-role="next" aria-label="Next month">' +
              '<span data-icon="chevron-right"></span></button>' +
          '</div>' +
          '<div class="cal-bar-right">' +
            '<button type="button" class="btn btn-sm" data-role="today">Today</button>' +
          '</div>' +
        '</div>' +
        '<div class="cal-weekdays" data-role="weekdays" aria-hidden="true"></div>' +
        '<div class="cal-grid" data-role="grid"></div>' +
      '</div>';

    FT.hydrateIcons(section);

    section.querySelector('[data-role="prev"]').addEventListener('click', function () {
      shown = FT.dates.addMonths(shown, -1); render();
    });
    section.querySelector('[data-role="next"]').addEventListener('click', function () {
      shown = FT.dates.addMonths(shown, 1); render();
    });
    section.querySelector('[data-role="today"]').addEventListener('click', function () {
      jumpTo(FT.dates.todayKey(), { open: false });
    });
    section.querySelector('[data-role="month"]').addEventListener('change', function (ev) {
      shown = new Date(shown.getFullYear(), +ev.target.value, 1); render();
    });
    section.querySelector('[data-role="year"]').addEventListener('change', function (ev) {
      shown = new Date(+ev.target.value, shown.getMonth(), 1); render();
    });

    section.querySelector('[data-role="grid"]').addEventListener('click', function (ev) {
      var cell = ev.target.closest('.cal-day');
      if (!cell) return;
      var key = cell.getAttribute('data-key');
      selectedKey = key;
      var d = FT.dates.parse(key);
      if (d.getMonth() !== shown.getMonth() || d.getFullYear() !== shown.getFullYear()) {
        shown = FT.dates.startOfMonth(d);
      }
      render();
      FT.openDay(key);
    });

    FT.store.subscribe(function () { if (root) render(); });
    FT.bus.on('settings', function () { if (root) render(); });
    FT.bus.on('dayclose', function (key) {
      if (!root || root.hidden || !FT.dates.isKey(key)) return;
      var cell = root.querySelector('.cal-day[data-key="' + key + '"]');
      if (cell) { try { cell.focus({ preventScroll: true }); } catch (err) {} }
    });
    FT.bus.on('dayfocus', function (key) {
      if (!root || !FT.dates.isKey(key)) return;
      selectedKey = key;
      var d = FT.dates.parse(key);
      shown = FT.dates.startOfMonth(d);
      render();
    });
  }

  function yearOptions() {
    var current = FT.dates.today().getFullYear();
    var keys = FT.store.keys();
    var firstLogged = keys.length ? +keys[0].slice(0, 4) : current;
    var min = Math.min(current - 30, firstLogged, shown.getFullYear());
    var max = Math.max(current + 10, shown.getFullYear());
    var out = [];
    for (var y = max; y >= min; y--) out.push(y);   /* newest first */
    return out;
  }

  function render() {
    if (!root) return;
    var settings = FT.store.settings();
    var todayKey = FT.dates.todayKey();

    root.querySelector('[data-role="title"]').textContent = FT.dates.monthYear(shown);
    root.querySelector('[data-role="month"]').value = String(shown.getMonth());

    var yearSel = root.querySelector('[data-role="year"]');
    var years = yearOptions();
    yearSel.innerHTML = years.map(function (y) {
      return '<option value="' + y + '">' + y + '</option>';
    }).join('');
    yearSel.value = String(shown.getFullYear());

    /* month summary */
    var monthStart = FT.dates.startOfMonth(shown), monthEnd = FT.dates.endOfMonth(shown);
    var loggedDays = 0, totalItems = 0;
    FT.store.keys().forEach(function (k) {
      if (k.slice(0, 7) === FT.dates.key(monthStart).slice(0, 7)) {
        loggedDays++;
        totalItems += FT.store.count(k);
      }
    });
    root.querySelector('[data-role="summary"]').textContent = loggedDays
      ? loggedDays + (loggedDays === 1 ? ' day logged, ' : ' days logged, ') +
        totalItems + (totalItems === 1 ? ' item in total' : ' items in total')
      : 'Nothing logged this month yet. Select a date to add what you ate.';

    /* weekday headers */
    root.querySelector('[data-role="weekdays"]').innerHTML =
      FT.dates.weekdayNames(settings.weekStart, 'short').map(function (n) {
        return '<span>' + FT.esc(n) + '</span>';
      }).join('');

    /* grid */
    var start = FT.dates.startOfWeek(monthStart, settings.weekStart);
    var rows = Math.ceil((FT.dates.diffDays(start, monthEnd) + 1) / 7);
    var cells = [];
    for (var i = 0; i < rows * 7; i++) {
      var d = FT.dates.addDays(start, i);
      var key = FT.dates.key(d);
      var count = FT.store.count(key);
      var outside = d.getMonth() !== shown.getMonth() || d.getFullYear() !== shown.getFullYear();
      var isToday = key === todayKey;
      var isFuture = key > todayKey;
      var label = FT.dates.long(d) + (isToday ? ' (today)' : '') + ', ' +
        (count ? count + ' of ' + FT.ITEMS.length + ' items' : 'nothing logged') +
        (isFuture ? ', future date, read-only' : '');

      cells.push(
        '<button type="button" class="cal-day' +
          (outside ? ' is-outside' : '') +
          (isToday ? ' is-today' : '') +
          (isFuture ? ' is-future' : '') +
          (key === selectedKey ? ' is-selected' : '') +
        '" data-key="' + key + '" data-level="' + FT.level(count) + '"' +
        (isFuture ? ' aria-disabled="true"' : '') +
        ' aria-label="' + FT.esc(label) + '">' +
          '<span class="cal-num">' + d.getDate() + '</span>' +
          (count
            ? '<span class="cal-badge"><b>' + count + '</b><i>/' + FT.ITEMS.length + '</i></span>'
            : '<span class="cal-badge cal-badge-empty" aria-hidden="true"></span>') +
        '</button>'
      );
    }
    root.querySelector('[data-role="grid"]').innerHTML = cells.join('');
  }

  function jumpTo(key, opts) {
    if (!FT.dates.isKey(key)) return;
    var options = opts || {};
    selectedKey = key;
    shown = FT.dates.startOfMonth(FT.dates.parse(key));
    if (!root) FT.app.go('calendar');
    else FT.app.go('calendar');
    render();
    var cell = root && root.querySelector('.cal-day[data-key="' + key + '"]');
    if (cell) {
      try { cell.focus({ preventScroll: true }); } catch (err) {}
      try { cell.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {}
      cell.classList.add('is-flash');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { cell.classList.remove('is-flash'); }, 1200);
    }
    if (options.open) FT.openDay(key);
  }

  FT.views.calendar = {
    show: function (section) {
      if (!root) build(section);
      render();
    },
    jumpTo: jumpTo
  };
})();
