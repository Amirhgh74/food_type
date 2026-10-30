/* views/analytics.js — range filter, four summary cards, bar chart, donut and history table.
   The old "Trend over time" line chart and "Daily heatmap" were removed on request; don't add them back. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var PAGE = 25;
  /* Chart.js is vendored locally (vendor/chart.umd.js), so this only shows if that file
     is missing or blocked — no internet connection is needed. */
  var CHART_FAIL = 'Charts could not load. Reload the page to try again.';

  var root = null;
  var charts = { bar: null, donut: null };
  var state = {
    range: 'last30',
    from: null,              /* custom range keys */
    to: null,
    limit: PAGE,
    query: '',
    sortKey: 'date',         /* 'date' | 'count' */
    sortDir: 'desc'
  };

  var RANGES = [
    { id: 'last7', label: 'Last 7 days' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'month', label: 'This month' },
    { id: 'year', label: 'This year' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' }
  ];

  /* ---------- range ---------- */

  function resolveRange() {
    var today = FT.dates.today();
    var start, end;
    switch (state.range) {
      case 'last7': start = FT.dates.addDays(today, -6); end = today; break;
      case 'month': start = FT.dates.startOfMonth(today); end = today; break;
      case 'year': start = new Date(today.getFullYear(), 0, 1); end = today; break;
      case 'all':
        var keys = FT.store.keys();
        if (!keys.length) { start = today; end = today; break; }
        start = FT.dates.parse(keys[0]);
        var last = FT.dates.parse(keys[keys.length - 1]);
        end = last > today ? last : today;
        break;
      case 'custom':
        var a = FT.dates.parse(state.from) || FT.dates.addDays(today, -29);
        var b = FT.dates.parse(state.to) || today;
        if (a > b) { var tmp = a; a = b; b = tmp; }   /* swapped if From is after To */
        start = a; end = b;
        break;
      default: start = FT.dates.addDays(today, -29); end = today;
    }
    return { start: start, end: end, startKey: FT.dates.key(start), endKey: FT.dates.key(end) };
  }

  function rangeStats(range) {
    var days = FT.dates.diffDays(range.start, range.end) + 1;
    var keys = FT.store.keys().filter(function (k) {
      return k >= range.startKey && k <= range.endKey;
    });
    var counts = {};
    FT.ITEM_IDS.forEach(function (id) { counts[id] = 0; });
    var totalItems = 0;
    keys.forEach(function (k) {
      FT.store.get(k).forEach(function (id) {
        if (counts[id] != null) { counts[id]++; totalItems++; }
      });
    });
    return { days: days, keys: keys, counts: counts, totalItems: totalItems };
  }

  function streakFrom(startDate) {
    var d = startDate, n = 0;
    while (FT.store.count(FT.dates.key(d)) > 0 && n < 100000) { n++; d = FT.dates.addDays(d, -1); }
    return n;
  }

  function currentStreak() {
    var d = FT.dates.today();
    if (!FT.store.count(FT.dates.key(d))) d = FT.dates.addDays(d, -1);
    return streakFrom(d);
  }

  function longestStreak() {
    var keys = FT.store.keys();
    if (!keys.length) return 0;
    var best = 1, run = 1;
    for (var i = 1; i < keys.length; i++) {
      var prev = FT.dates.parse(keys[i - 1]), cur = FT.dates.parse(keys[i]);
      run = FT.dates.diffDays(prev, cur) === 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  /* ---------- build ---------- */

  function build(section) {
    root = section;
    section.innerHTML =
      '<header class="page-head">' +
        '<div class="page-head-main">' +
          '<span class="eyebrow">ANALYTICS</span>' +
          '<h1>Your eating patterns</h1>' +
          '<p class="page-sub" data-role="rangeline"></p>' +
        '</div>' +
      '</header>' +
      '<div class="chips" role="group" aria-label="Date range" data-role="chips">' +
        RANGES.map(function (r) {
          return '<button type="button" class="chip" data-range="' + r.id + '" aria-pressed="false">' +
            FT.esc(r.label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="custom-range" data-role="custom" hidden>' +
        '<label class="field"><span>From</span><input type="date" data-role="from"></label>' +
        '<label class="field"><span>To</span><input type="date" data-role="to"></label>' +
      '</div>' +
      '<div class="card empty-card" data-role="empty" hidden>' +
        '<h2>No entries in this range</h2>' +
        '<p class="muted">Log a day to see your patterns here, or load example entries to try it out.</p>' +
        '<div class="row-actions">' +
          '<a class="btn btn-primary" href="#today">Log today</a>' +
          '<button type="button" class="btn" data-role="sample">' +
            '<span data-icon="sparkles" data-size="16"></span> Load sample data</button>' +
        '</div>' +
      '</div>' +
      '<div class="stat-grid" data-role="cards"></div>' +
      '<div class="chart-row">' +
        '<div class="card chart-card">' +
          '<h2>Times eaten per item</h2>' +
          '<div class="chart-box chart-box-bar"><canvas data-role="bar"></canvas>' +
            '<p class="chart-fail" data-role="bar-fail" hidden>' + FT.esc(CHART_FAIL) + '</p></div>' +
        '</div>' +
        '<div class="card chart-card">' +
          '<h2>Share of intake</h2>' +
          '<div class="donut-wrap">' +
            '<div class="chart-box chart-box-donut">' +
              '<canvas data-role="donut"></canvas>' +
              '<div class="donut-center" data-role="donut-center"></div>' +
              '<p class="chart-fail" data-role="donut-fail" hidden>' + FT.esc(CHART_FAIL) + '</p>' +
            '</div>' +
            '<ul class="donut-legend" data-role="legend"></ul>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card history-card">' +
        '<div class="card-head">' +
          '<h2>History</h2>' +
          '<label class="search"><span class="sr-only">Search items or dates</span>' +
            '<span data-icon="search" data-size="16"></span>' +
            '<input type="search" data-role="search" placeholder="Search items or dates">' +
          '</label>' +
        '</div>' +
        '<div class="history" data-role="history"></div>' +
        '<div class="history-foot">' +
          '<span class="muted" data-role="showing"></span>' +
          '<button type="button" class="btn btn-sm" data-role="more" hidden>Show more</button>' +
        '</div>' +
      '</div>';

    FT.hydrateIcons(section);

    section.querySelector('[data-role="chips"]').addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip');
      if (!chip) return;
      state.range = chip.getAttribute('data-range');
      state.limit = PAGE;                 /* changing the range resets the history list */
      if (state.range === 'custom' && (!state.from || !state.to)) {
        var today = FT.dates.today();
        state.from = FT.dates.key(FT.dates.addDays(today, -29));
        state.to = FT.dates.key(today);
      }
      render();
    });

    ['from', 'to'].forEach(function (which) {
      section.querySelector('[data-role="' + which + '"]').addEventListener('change', function (ev) {
        var v = ev.target.value;
        if (FT.dates.isKey(v)) state[which] = v;
        state.limit = PAGE;
        render();
      });
    });

    section.querySelector('[data-role="sample"]').addEventListener('click', function () {
      FT.loadSampleData();
    });

    var search = section.querySelector('[data-role="search"]');
    search.addEventListener('input', function () {
      state.query = search.value.trim().toLowerCase();
      state.limit = PAGE;
      renderHistory(resolveRange());
    });

    section.querySelector('[data-role="more"]').addEventListener('click', function () {
      state.limit += PAGE;
      renderHistory(resolveRange());
    });

    section.querySelector('[data-role="history"]').addEventListener('click', function (ev) {
      var sortBtn = ev.target.closest('[data-sort]');
      if (sortBtn) {
        var key = sortBtn.getAttribute('data-sort');
        if (state.sortKey === key) state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
        else { state.sortKey = key; state.sortDir = 'desc'; }
        renderHistory(resolveRange());
        return;
      }
      var jump = ev.target.closest('[data-jump]');
      if (jump) FT.views.calendar.jumpTo(jump.getAttribute('data-jump'), { open: false });
    });

    function maybeRender() { if (root && !root.hidden) render(); }
    FT.store.subscribe(maybeRender);
    FT.bus.on('settings', maybeRender);
    FT.bus.on('theme', maybeRender);
  }

  /* ---------- render ---------- */

  function render() {
    if (!root) return;
    var range = resolveRange();
    var stats = rangeStats(range);

    root.querySelectorAll('.chip').forEach(function (chip) {
      var on = chip.getAttribute('data-range') === state.range;
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      chip.classList.toggle('is-on', on);
    });

    var custom = root.querySelector('[data-role="custom"]');
    custom.hidden = state.range !== 'custom';
    if (!custom.hidden) {
      var todayKey = FT.dates.todayKey();
      var fromEl = root.querySelector('[data-role="from"]');
      var toEl = root.querySelector('[data-role="to"]');
      fromEl.max = todayKey;              /* no future days to analyse */
      toEl.max = todayKey;
      fromEl.value = state.from || '';
      toEl.value = state.to || '';
    }

    root.querySelector('[data-role="rangeline"]').textContent =
      FT.dates.medium(range.start) + ' to ' + FT.dates.medium(range.end) +
      ' · ' + stats.days + (stats.days === 1 ? ' day' : ' days');

    root.querySelector('[data-role="empty"]').hidden = stats.keys.length > 0;

    renderStats(range, stats);
    renderBar(stats);
    renderDonut(stats);
    renderHistory(range);
  }

  function statCard(label, icon, value, sub) {
    return '<div class="card stat-card">' +
      '<div class="stat-top"><span class="stat-icon">' + FT.icon(icon, 18) + '</span>' +
        '<span class="stat-label">' + FT.esc(label) + '</span></div>' +
      '<div class="stat-value">' + value + '</div>' +
      '<div class="stat-sub">' + sub + '</div></div>';
  }

  function tieNote(list, count) {
    var tied = list.filter(function (x) { return x.count === count; }).length - 1;
    if (tied <= 0) return '';
    return ' · tied with ' + tied + (tied === 1 ? ' other' : ' others');
  }

  function renderStats(range, stats) {
    var ranked = FT.ITEMS.map(function (it, i) {
      return { id: it.id, name: it.name, icon: it.icon, color: it.color, count: stats.counts[it.id], index: i };
    }).slice().sort(function (a, b) {
      return b.count - a.count || a.index - b.index;    /* stable: earlier item in FT.ITEMS wins */
    });

    var most = ranked[0];
    var least = ranked[ranked.length - 1];
    var logged = stats.keys.length;
    var cur = currentStreak();
    var longest = longestStreak();
    var todayEmpty = FT.store.count(FT.dates.todayKey()) === 0;

    function itemValue(item) {
      return '<span class="stat-item"><span class="stat-item-icon" style="color:' +
        FT.itemColor(item.color) + '">' + FT.icon(item.icon, 20) + '</span>' +
        FT.esc(item.name) + '</span>';
    }

    root.querySelector('[data-role="cards"]').innerHTML =
      statCard('Days logged', 'calendar', String(logged),
        'of ' + stats.days + (stats.days === 1 ? ' day' : ' days') +
        ' · ' + FT.pct(logged, stats.days) + '%') +
      statCard('Eaten most', 'trend-up', logged ? itemValue(most) : '—',
        logged
          ? most.count + (most.count === 1 ? ' time' : ' times') + ' · ' +
            FT.pct(most.count, logged) + '% of logged days' + tieNote(ranked, most.count)
          : 'Nothing logged in this range') +
      statCard('Eaten least', 'trend-down', logged ? itemValue(least) : '—',
        logged
          ? least.count + (least.count === 1 ? ' time' : ' times') + tieNote(ranked, least.count)
          : 'Nothing logged in this range') +
      statCard('Current streak', 'flame', cur + (cur === 1 ? ' day' : ' days'),
        cur > 0 && todayEmpty ? 'Log today to keep it going' : 'Longest: ' + longest +
          (longest === 1 ? ' day' : ' days'));
  }

  /* ---------- charts ---------- */

  function chartTokens() {
    return {
      muted: FT.token('muted') || '#586C58',
      border: FT.token('border') || '#E2ECE2',
      ink: FT.token('ink') || '#001A00',
      surface: FT.token('surface') || '#FFFFFF',
      tipBg: FT.token('tooltip-bg') || '#001A00',
      tipFg: FT.token('tooltip-fg') || '#FFFFFF',
      font: "Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    };
  }

  function haveChart() { return typeof window.Chart === 'function'; }

  function setFail(which, failed) {
    var fail = root.querySelector('[data-role="' + which + '-fail"]');
    if (fail) fail.hidden = !failed;
    var canvas = root.querySelector('[data-role="' + which + '"]');
    if (canvas) canvas.style.display = failed ? 'none' : '';
  }

  function renderBar(stats) {
    if (!haveChart()) { setFail('bar', true); return; }
    setFail('bar', false);
    var t = chartTokens();
    var data = FT.ITEMS.map(function (it, i) {
      return { name: it.name, color: FT.itemColor(it.color), count: stats.counts[it.id], index: i };
    }).sort(function (a, b) { return b.count - a.count || a.index - b.index; });

    if (charts.bar) { charts.bar.destroy(); charts.bar = null; }
    charts.bar = new window.Chart(root.querySelector('[data-role="bar"]'), {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d.name; }),
        datasets: [{
          data: data.map(function (d) { return d.count; }),
          backgroundColor: data.map(function (d) { return d.color; }),
          borderRadius: 6,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tipBg, titleColor: t.tipFg, bodyColor: t.tipFg,
            displayColors: false, padding: 10, cornerRadius: 8,
            titleFont: { family: t.font, weight: '700' }, bodyFont: { family: t.font },
            callbacks: {
              label: function (ctx) {
                var v = ctx.parsed.x || 0;
                return ' ' + v + (v === 1 ? ' time' : ' times');
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: t.muted, font: { family: t.font } },
            grid: { color: t.border, drawBorder: false }
          },
          y: {
            ticks: { color: t.ink, font: { family: t.font, weight: '700' } },
            grid: { display: false, drawBorder: false }
          }
        }
      }
    });
  }

  function renderDonut(stats) {
    var total = stats.totalItems;
    var center = root.querySelector('[data-role="donut-center"]');
    center.innerHTML = '<b>' + total + '</b><span>items logged</span>';

    root.querySelector('[data-role="legend"]').innerHTML = FT.ITEMS.map(function (it) {
      var c = stats.counts[it.id];
      var share = total ? Math.round(c / total * 100) : 0;
      return '<li class="' + (c ? '' : 'is-zero') + '">' +
        '<span class="dot" style="background:' + FT.itemColor(it.color) + '"></span>' +
        '<span class="legend-name">' + FT.esc(it.name) + '</span>' +
        '<span class="legend-pct">' + share + '%</span></li>';
    }).join('');

    if (!haveChart()) { setFail('donut', true); return; }
    setFail('donut', false);
    var t = chartTokens();
    var parts = FT.ITEMS.map(function (it, i) {
      return { name: it.name, color: FT.itemColor(it.color), count: stats.counts[it.id], index: i };
    }).filter(function (d) { return d.count > 0; })
      .sort(function (a, b) { return b.count - a.count || a.index - b.index; });

    var empty = parts.length === 0;
    if (charts.donut) { charts.donut.destroy(); charts.donut = null; }
    charts.donut = new window.Chart(root.querySelector('[data-role="donut"]'), {
      type: 'doughnut',
      data: {
        labels: empty ? ['No data'] : parts.map(function (d) { return d.name; }),
        datasets: [{
          data: empty ? [1] : parts.map(function (d) { return d.count; }),
          backgroundColor: empty ? [t.border] : parts.map(function (d) { return d.color; }),
          borderColor: t.surface,
          borderWidth: 2,
          hoverOffset: empty ? 0 : 6
        }]
      },
      options: {
        cutout: '64%',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !empty,
            backgroundColor: t.tipBg, titleColor: t.tipFg, bodyColor: t.tipFg,
            padding: 10, cornerRadius: 8,
            titleFont: { family: t.font, weight: '700' }, bodyFont: { family: t.font },
            callbacks: {
              label: function (ctx) {
                var v = ctx.parsed || 0;
                var pct = total ? Math.round(v / total * 100) : 0;
                return ' ' + v + (v === 1 ? ' time' : ' times') + ' · ' + pct + '%';
              }
            }
          }
        }
      }
    });
  }

  /* ---------- history ---------- */

  function renderHistory(range) {
    var keys = FT.store.keys().filter(function (k) {
      return k >= range.startKey && k <= range.endKey;
    });

    var rows = keys.map(function (k) {
      var d = FT.dates.parse(k);
      var ids = FT.store.get(k);
      return {
        key: k, date: d, ids: ids, count: ids.length,
        haystack: (k + ' ' + FT.dates.long(d) + ' ' +
          ids.map(function (id) { return FT.itemName(id); }).join(' ')).toLowerCase()
      };
    });

    if (state.query) {
      rows = rows.filter(function (r) { return r.haystack.indexOf(state.query) > -1; });
    }

    var dir = state.sortDir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      if (state.sortKey === 'count' && a.count !== b.count) return (a.count - b.count) * dir;
      if (state.sortKey === 'count') return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
      return (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)) * dir;
    });

    var shown = rows.slice(0, state.limit);
    var host = root.querySelector('[data-role="history"]');

    function sortIcon(key) {
      if (state.sortKey !== key) return FT.icon('arrow-up-down', 14);
      return FT.icon(state.sortDir === 'asc' ? 'arrow-up' : 'arrow-down', 14);
    }
    function ariaSort(key) {
      if (state.sortKey !== key) return 'none';
      return state.sortDir === 'asc' ? 'ascending' : 'descending';
    }

    var head =
      '<div class="history-head" role="row">' +
        '<div role="columnheader" aria-sort="' + ariaSort('date') + '">' +
          '<button type="button" class="sort-btn" data-sort="date">Date ' + sortIcon('date') + '</button></div>' +
        '<div role="columnheader">Items</div>' +
        '<div role="columnheader" aria-sort="' + ariaSort('count') + '">' +
          '<button type="button" class="sort-btn" data-sort="count">Count ' + sortIcon('count') + '</button></div>' +
        '<div role="columnheader"><span class="sr-only">Open in calendar</span></div>' +
      '</div>';

    var body = shown.map(function (r) {
      var chips = r.ids.map(function (id) {
        var it = FT.itemById(id);
        if (!it) return '';
        return '<span class="item-chip"><span class="item-chip-icon" style="color:' +
          FT.itemColor(it.color) + '">' + FT.icon(it.icon, 14) + '</span>' + FT.esc(it.name) + '</span>';
      }).join('');
      return '<div class="history-row" role="row">' +
        '<div class="h-date" role="cell"><b>' + FT.esc(FT.dates.medium(r.date)) + '</b>' +
          '<span>' + FT.esc(FT.dates.format(r.date, { weekday: 'long' })) + '</span></div>' +
        '<div class="h-items" role="cell">' + chips + '</div>' +
        '<div class="h-count" role="cell"><span class="count-pill" data-level="' +
          FT.level(r.count) + '">' + r.count + '/' + FT.ITEMS.length + '</span></div>' +
        '<div class="h-link" role="cell"><button type="button" class="link-btn" data-jump="' +
          r.key + '">View in calendar ' + FT.icon('arrow-right', 14) + '</button></div>' +
      '</div>';
    }).join('');

    host.innerHTML = head + (shown.length
      ? '<div class="history-body" role="rowgroup">' + body + '</div>'
      : '<p class="muted history-empty">' +
        (state.query ? 'Nothing matches “' + FT.esc(state.query) + '”.' : 'No logged days in this range.') +
        '</p>');

    root.querySelector('[data-role="showing"]').textContent =
      'Showing ' + shown.length + ' of ' + rows.length + (rows.length === 1 ? ' day' : ' days');
    root.querySelector('[data-role="more"]').hidden = shown.length >= rows.length;
  }

  FT.views.analytics = {
    show: function (section) {
      if (!root) build(section);
      render();
    }
  };
})();
