/* day-modal.js — FT.openDay(dateKey): a modal holding a day editor, with prev/next day arrows.
   Emits 'dayfocus' on open and on every move, so the calendar follows along.
   The next arrow stops at today, because future days can't be logged. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  FT.openDay = function (dateKey) {
    var key = FT.dates.isKey(dateKey) ? dateKey : FT.dates.todayKey();
    var titleId = 'day-modal-title';

    var html =
      '<div class="modal-head day-modal-head">' +
        '<div class="day-modal-heading">' +
          '<span class="eyebrow" data-role="eyebrow"></span>' +
          '<h2 class="modal-title" id="' + titleId + '" data-role="title"></h2>' +
        '</div>' +
        '<div class="day-modal-nav">' +
          '<button type="button" class="icon-btn" data-role="prev" aria-label="Previous day">' +
            '<span data-icon="chevron-left"></span></button>' +
          '<button type="button" class="icon-btn" data-role="next" aria-label="Next day">' +
            '<span data-icon="chevron-right"></span></button>' +
          '<button type="button" class="icon-btn" data-close="" aria-label="Close">' +
            '<span data-icon="x"></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="modal-body" data-role="body"></div>';

    var editor = null;
    var instance = FT.modal.open({
      content: html,
      labelledBy: titleId,
      onClose: function () {
        if (editor) editor.destroy();
        /* the calendar re-renders behind the modal, so the cell that opened it is gone:
           tell the calendar to put focus back on the day it is now showing */
        FT.bus.emit('dayclose', key);
      }
    });

    var root = instance.el;
    root.classList.add('day-modal');
    var eyebrow = root.querySelector('[data-role="eyebrow"]');
    var title = root.querySelector('[data-role="title"]');
    var prev = root.querySelector('[data-role="prev"]');
    var next = root.querySelector('[data-role="next"]');
    var body = root.querySelector('[data-role="body"]');

    editor = FT.dayEditor(body, key, {});

    function paint() {
      var d = FT.dates.parse(key);
      eyebrow.textContent = FT.dates.relative(d).toUpperCase();
      title.textContent = FT.dates.monthDayYear(d);
      next.disabled = key >= FT.dates.todayKey();
      FT.bus.emit('dayfocus', key);
    }

    function move(delta) {
      var d = FT.dates.addDays(FT.dates.parse(key), delta);
      key = FT.dates.key(d);
      editor.setDate(key);
      paint();
    }

    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { if (!next.disabled) move(1); });

    root.addEventListener('keydown', function (ev) {
      if (ev.target.closest('input,select,textarea')) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
      else if (ev.key === 'ArrowRight' && !next.disabled) { ev.preventDefault(); move(1); }
    });

    paint();
    return instance;
  };
})();
