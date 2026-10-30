/* views/settings.js — FT.views.preferences (hash #preferences, because the Artifact viewer
   reserves "settings"). Appearance, backup/restore, reset and the storage format reference.
   Also defines FT.loadSampleData(). */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var root = null;

  /* ---------- sample data ---------- */

  var ODDS = {
    milk: 0.5, yogurt: 0.35, vegetables: 0.82, fruit: 0.7, red_meat: 0.22,
    chicken: 0.38, chicken_wings: 0.14, fish: 0.2, beans: 0.3, sugar: 0.42,
    bread: 0.55, complex_carbs: 0.5, processed_food: 0.3
  };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  FT.loadSampleData = function () {
    var rand = mulberry32(20261029);
    var today = FT.dates.today();
    var add = {};
    var filled = 0;
    /* yesterday back 120 days: today is left alone and future days can't be logged at all */
    for (var back = 1; back <= 120; back++) {
      var d = FT.dates.addDays(today, -back);
      var key = FT.dates.key(d);
      var skip = rand() < 0.14;                 /* leave gaps */
      if (FT.store.count(key) > 0) { continue; }
      if (skip) continue;
      var ids = FT.ITEM_IDS.filter(function (id) { return rand() < (ODDS[id] || 0.3); });
      if (!ids.length) continue;
      add[key] = ids;
      filled++;
    }
    if (!filled) {
      FT.toast('Those days already have entries.');
      return 0;
    }
    FT.store.merge(add);
    FT.toast('Added example entries to ' + filled + (filled === 1 ? ' day' : ' days'));
    return filled;
  };

  /* ---------- export ---------- */

  function stamp() { return FT.dates.todayKey(); }

  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      FT.toast('Saved ' + filename);
    } catch (err) {
      FT.toast('Download was blocked here. Use Copy JSON instead.');
    }
  }

  function entriesJson() { return JSON.stringify(FT.store.all(), null, 2); }

  function entriesCsv() {
    var head = ['date'].concat(FT.ITEM_IDS).join(',');
    var rows = FT.store.keys().map(function (k) {
      var ids = FT.store.get(k);
      return [k].concat(FT.ITEM_IDS.map(function (id) {
        return ids.indexOf(id) > -1 ? '1' : '0';
      })).join(',');
    });
    return [head].concat(rows).join('\n') + '\n';
  }

  function copyJson() {
    var text = entriesJson();
    function fallback() {
      FT.modal.open({
        content: '<div class="modal-head"><h2 class="modal-title">Copy your data</h2></div>' +
          '<div class="modal-body"><p class="modal-text">Clipboard access was blocked. ' +
          'The JSON below is selected — copy it with ⌘C or Ctrl+C.</p>' +
          '<textarea class="json-box" readonly rows="10" autofocus>' + FT.esc(text) + '</textarea></div>' +
          '<div class="modal-foot"><button type="button" class="btn btn-primary" data-close="">Done</button></div>',
        label: 'Copy your data',
        onClose: function () {}
      });
      var box = document.querySelector('.modal .json-box');
      if (box) { box.focus(); box.select(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        FT.toast('Copied ' + FT.store.size() + ' days to the clipboard');
      }, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- import ---------- */

  function parseCsv(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return {};
    var header = lines[0].split(',').map(function (h) { return h.trim(); });
    var out = {};
    var truthy = /^(1|true|yes|x|y)$/i;

    var dateCol = 0;
    var longCol = -1;
    header.forEach(function (h, i) {
      var low = h.toLowerCase();
      if (low === 'date' || low === 'day') dateCol = i;
      if (low === 'items' || low === 'item' || low === 'groups') longCol = i;
    });

    var cols = header.map(function (h, i) {
      if (i === dateCol || i === longCol) return null;
      return FT.normalizeItem(h);
    });

    for (var r = 1; r < lines.length; r++) {
      var cells = lines[r].split(',').map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
      var key = cells[dateCol];
      if (!FT.dates.isKey(key)) continue;        /* rows with an invalid date are skipped */
      var ids = [];
      if (longCol > -1 && cells[longCol]) {
        cells[longCol].split(/[;|]/).forEach(function (part) {
          var id = FT.normalizeItem(part);
          if (id) ids.push(id);
        });
      }
      cols.forEach(function (id, i) {
        if (id && truthy.test(cells[i] || '')) ids.push(id);
      });
      if (ids.length) out[key] = ids;
    }
    return out;
  }

  function parseImport(text, name, type) {
    var isCsv = /\.csv$/i.test(name || '') || /csv/i.test(type || '');
    if (!isCsv) {
      try {
        var data = JSON.parse(text);
        if (data && typeof data === 'object' && data.entries && typeof data.entries === 'object') {
          data = data.entries;
        }
        return FT.store.sanitize(data);
      } catch (err) {
        /* a .json that isn't JSON — try CSV before giving up */
        return parseCsv(text);
      }
    }
    return FT.store.sanitize(parseCsv(text));
  }

  function handleFile(file, input) {
    var reader = new FileReader();
    reader.onload = function () {
      var clean = parseImport(String(reader.result || ''), file.name, file.type);
      var days = Object.keys(clean).length;
      input.value = '';                 /* reset, so the same file can be imported again */
      if (!days) {
        FT.toast('No entries found in that file.');
        return;
      }
      if (!FT.store.size()) {
        FT.store.replaceAll(clean);
        FT.toast('Imported ' + days + (days === 1 ? ' day' : ' days'));
        return;
      }
      FT.modal.choose({
        title: 'Import ' + days + (days === 1 ? ' day?' : ' days?'),
        message: '<p class="modal-text">You already have ' + FT.store.size() +
          ' logged days. <b>Merge</b> keeps them and adds what the file has. ' +
          '<b>Replace all</b> throws your current data away.</p>',
        options: [
          { label: 'Cancel', value: 'cancel' },
          { label: 'Replace all', value: 'replace', kind: 'danger' },
          { label: 'Merge', value: 'merge', kind: 'primary', autofocus: true }
        ]
      }).then(function (choice) {
        if (choice === 'replace') {
          FT.store.replaceAll(clean);
          FT.toast('Replaced everything with ' + days + (days === 1 ? ' day' : ' days'));
        } else if (choice === 'merge') {
          FT.store.merge(clean);
          FT.toast('Merged ' + days + (days === 1 ? ' day' : ' days'));
        }
      });
    };
    reader.onerror = function () { FT.toast('That file could not be read.'); input.value = ''; };
    reader.readAsText(file);
  }

  /* ---------- view ---------- */

  function build(section) {
    root = section;
    section.innerHTML =
      '<header class="page-head">' +
        '<div class="page-head-main">' +
          '<span class="eyebrow">PREFERENCES</span>' +
          '<h1>Preferences and data</h1>' +
          '<p class="page-sub">Everything stays in this browser. There is no account and nothing is sent anywhere.</p>' +
        '</div>' +
      '</header>' +
      '<div class="pref-grid">' +
        '<div class="card">' +
          '<div class="card-head"><h2><span class="card-ico">' + FT.icon('palette', 18) + '</span> Appearance</h2></div>' +
          '<div class="pref-row">' +
            '<span class="pref-label" id="lbl-theme">Theme</span>' +
            '<div class="seg" role="group" aria-labelledby="lbl-theme" data-role="theme">' +
              '<button type="button" data-value="system" aria-pressed="false">' +
                '<span data-icon="monitor" data-size="16"></span> System</button>' +
              '<button type="button" data-value="light" aria-pressed="false">' +
                '<span data-icon="sun" data-size="16"></span> Light</button>' +
              '<button type="button" data-value="dark" aria-pressed="false">' +
                '<span data-icon="moon" data-size="16"></span> Dark</button>' +
            '</div>' +
          '</div>' +
          '<div class="pref-row">' +
            '<span class="pref-label" id="lbl-week">Week starts on</span>' +
            '<div class="seg" role="group" aria-labelledby="lbl-week" data-role="week">' +
              '<button type="button" data-value="0" aria-pressed="false">Sunday</button>' +
              '<button type="button" data-value="1" aria-pressed="false">Monday</button>' +
            '</div>' +
          '</div>' +
          '<p class="hint">The week start changes the calendar headers and grid.</p>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><h2><span class="card-ico">' + FT.icon('database', 18) + '</span> Your data</h2></div>' +
          '<p class="data-stats" data-role="stats"></p>' +
          '<div class="pref-group">' +
            '<h3>Back up</h3>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm" data-role="json">' +
                '<span data-icon="download" data-size="16"></span> Export JSON</button>' +
              '<button type="button" class="btn btn-sm" data-role="csv">' +
                '<span data-icon="table" data-size="16"></span> Export CSV</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-role="copy">' +
                '<span data-icon="copy" data-size="16"></span> Copy JSON</button>' +
            '</div>' +
          '</div>' +
          '<div class="pref-group">' +
            '<h3>Restore</h3>' +
            '<div class="row-actions">' +
              '<label class="btn btn-sm" for="import-file">' +
                '<span data-icon="upload" data-size="16"></span> Import file</label>' +
              '<input id="import-file" class="sr-only" type="file" accept=".json,.csv" data-role="file">' +
            '</div>' +
            '<p class="hint">JSON or CSV. Importing offers Merge or Replace all when you already have data.</p>' +
          '</div>' +
          '<div class="pref-group">' +
            '<h3>Try it out</h3>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-sm" data-role="sample">' +
                '<span data-icon="sparkles" data-size="16"></span> Load sample data</button>' +
            '</div>' +
            '<p class="hint">Fills empty days in the last 120 days. Today and future days are untouched.</p>' +
          '</div>' +
        '</div>' +

        '<div class="card card-danger">' +
          '<div class="card-head"><h2><span class="card-ico">' + FT.icon('trash', 18) + '</span> Reset</h2></div>' +
          '<p class="muted">Deletes every logged day from this browser. Export a backup first if you might want it back.</p>' +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-danger" data-role="reset">' +
              '<span data-icon="trash" data-size="16"></span> Reset all data</button>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><h2><span class="card-ico">' + FT.icon('braces', 18) + '</span> Storage format</h2></div>' +
          '<p class="muted">localStorage key <code>' + FT.esc(FT.store.ENTRIES_KEY) + '</code></p>' +
          '<pre class="code-box">{\n  "' + FT.dates.todayKey() + '": ["milk", "fruit", "chicken"]\n}</pre>' +
          '<p class="muted">Item ids, in order:</p>' +
          '<p class="id-list">' + FT.ITEM_IDS.map(function (id) {
            return '<code>' + id + '</code>';
          }).join(' ') + '</p>' +
        '</div>' +
      '</div>';

    FT.hydrateIcons(section);

    section.querySelector('[data-role="theme"]').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-value]');
      if (btn) FT.store.setSetting('theme', btn.getAttribute('data-value'));
    });
    section.querySelector('[data-role="week"]').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-value]');
      if (btn) FT.store.setSetting('weekStart', +btn.getAttribute('data-value'));
    });

    section.querySelector('[data-role="json"]').addEventListener('click', function () {
      download('food-group-log-' + stamp() + '.json', entriesJson(), 'application/json');
    });
    section.querySelector('[data-role="csv"]').addEventListener('click', function () {
      download('food-group-log-' + stamp() + '.csv', entriesCsv(), 'text/csv');
    });
    section.querySelector('[data-role="copy"]').addEventListener('click', copyJson);
    section.querySelector('[data-role="sample"]').addEventListener('click', function () {
      FT.loadSampleData();
    });

    var fileInput = section.querySelector('[data-role="file"]');
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0], fileInput);
    });

    section.querySelector('[data-role="reset"]').addEventListener('click', function () {
      var n = FT.store.size();
      if (!n) return;
      FT.modal.choose({
        title: 'Reset all data?',
        message: '<p class="modal-text">This permanently deletes ' + n +
          (n === 1 ? ' logged day' : ' logged days') + ' from this browser. This can’t be undone.</p>',
        options: [
          { label: 'Cancel', value: false, autofocus: true },
          { label: 'Delete everything', value: true, kind: 'danger' }
        ]
      }).then(function (yes) {
        if (yes === true) {
          FT.store.clear();
          FT.toast('All data deleted');
        }
      });
    });

    FT.store.subscribe(function () { if (root) paint(); });
    FT.bus.on('settings', function () { if (root) paint(); });
  }

  function paint() {
    var settings = FT.store.settings();
    root.querySelectorAll('[data-role="theme"] button').forEach(function (b) {
      var on = b.getAttribute('data-value') === settings.theme;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });
    root.querySelectorAll('[data-role="week"] button').forEach(function (b) {
      var on = +b.getAttribute('data-value') === settings.weekStart;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });

    var keys = FT.store.keys();
    var bytes = FT.store.bytes();
    var size = bytes < 1024 ? bytes + ' bytes' : (bytes / 1024).toFixed(1) + ' KB';
    root.querySelector('[data-role="stats"]').textContent = keys.length
      ? keys.length + (keys.length === 1 ? ' day logged, ' : ' days logged, ') +
        'from ' + FT.dates.medium(FT.dates.parse(keys[0])) + ' to ' +
        FT.dates.medium(FT.dates.parse(keys[keys.length - 1])) + ' · ' + size
      : 'No entries yet.';

    var reset = root.querySelector('[data-role="reset"]');
    reset.disabled = keys.length === 0;
  }

  FT.views.preferences = {
    show: function (section) {
      if (!root) build(section);
      paint();
    }
  };
})();
