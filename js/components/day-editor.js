/* day-editor.js — FT.dayEditor(container, dateKey, { wide })
   The toolbar plus the 13 selectable item tiles for one date.
   Future dates are read-only: tiles and both bulk buttons are disabled and a note explains why. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var SAVED_MS = 1400;

  FT.dayEditor = function (container, dateKey, opts) {
    var options = opts || {};
    var key = FT.dates.isKey(dateKey) ? dateKey : FT.dates.todayKey();
    var savedTimer = null;
    var destroyed = false;

    container.classList.add('day-editor');
    if (options.wide) container.classList.add('day-editor-wide');

    container.innerHTML =
      '<div class="editor-bar">' +
        '<div class="editor-bar-left">' +
          '<span class="editor-count" data-role="count"></span>' +
          '<span class="editor-saved" data-role="saved" aria-live="polite"></span>' +
        '</div>' +
        '<div class="editor-bar-right">' +
          '<button type="button" class="btn btn-sm" data-role="all">' +
            '<span data-icon="check-check" data-size="16"></span> Select all</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-role="none">' +
            '<span data-icon="eraser" data-size="16"></span> Clear all</button>' +
        '</div>' +
      '</div>' +
      '<p class="editor-locked" data-role="locked" hidden>' +
        '<span data-icon="lock" data-size="16"></span> ' +
        'Future dates can’t be logged. Come back on the day — past days stay editable.' +
      '</p>' +
      '<div class="tile-grid" role="group" aria-label="Food groups" data-role="grid">' +
        FT.ITEMS.map(function (item) {
          return '<button type="button" class="tile" data-id="' + item.id + '" ' +
            'style="--c:' + item.color + '" aria-pressed="false">' +
            '<span class="tile-check" aria-hidden="true">' + FT.icon('check', 14) + '</span>' +
            '<span class="tile-icon">' + FT.icon(item.icon, 24) + '</span>' +
            '<span class="tile-name">' + FT.esc(item.name) + '</span>' +
          '</button>';
        }).join('') +
      '</div>';

    FT.hydrateIcons(container);

    var grid = container.querySelector('[data-role="grid"]');
    var countEl = container.querySelector('[data-role="count"]');
    var savedEl = container.querySelector('[data-role="saved"]');
    var lockedEl = container.querySelector('[data-role="locked"]');
    var allBtn = container.querySelector('[data-role="all"]');
    var noneBtn = container.querySelector('[data-role="none"]');
    var tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile'));

    function isLocked() { return FT.dates.isFutureKey(key); }

    function render() {
      if (destroyed) return;
      var ids = FT.store.get(key);
      var total = FT.ITEMS.length;
      var locked = isLocked();

      tiles.forEach(function (tile) {
        var on = ids.indexOf(tile.getAttribute('data-id')) > -1;
        tile.setAttribute('aria-pressed', on ? 'true' : 'false');
        tile.classList.toggle('is-on', on);
        tile.disabled = locked;
      });

      countEl.textContent = ids.length + ' of ' + total + ' selected';
      allBtn.disabled = locked || ids.length === total;
      noneBtn.disabled = locked || ids.length === 0;
      lockedEl.hidden = !locked;
      container.classList.toggle('is-locked', locked);
    }

    function flashSaved() {
      savedEl.innerHTML = FT.icon('check', 14) + ' Saved';
      savedEl.classList.add('is-in');
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(function () {
        savedEl.classList.remove('is-in');
        savedEl.textContent = '';
      }, SAVED_MS);
    }

    grid.addEventListener('click', function (ev) {
      var tile = ev.target.closest('.tile');
      if (!tile || !grid.contains(tile) || tile.disabled) return;
      if (FT.store.toggle(key, tile.getAttribute('data-id'))) flashSaved();
    });

    allBtn.addEventListener('click', function () {
      if (allBtn.disabled) return;
      if (FT.store.set(key, FT.ITEM_IDS.slice())) flashSaved();
    });

    noneBtn.addEventListener('click', function () {
      if (noneBtn.disabled) return;
      if (FT.store.set(key, [])) flashSaved();
    });

    var unsubscribe = FT.store.subscribe(render);
    render();

    return {
      get date() { return key; },
      setDate: function (nextKey) {
        if (!FT.dates.isKey(nextKey)) return;
        key = nextKey;
        savedEl.textContent = '';
        savedEl.classList.remove('is-in');
        render();
      },
      refresh: render,
      destroy: function () {
        destroyed = true;
        if (savedTimer) clearTimeout(savedTimer);
        unsubscribe();
      }
    };
  };
})();
