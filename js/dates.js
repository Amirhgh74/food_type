/* dates.js — every Date here is local midnight. Keys are always built with FT.dates.key(),
   never with toISOString(), so days never shift across time zones. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var LOCALE = 'en-US';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function key(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isKey(k) {
    if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
    var y = +k.slice(0, 4), m = +k.slice(5, 7), day = +k.slice(8, 10);
    if (m < 1 || m > 12 || day < 1 || day > 31) return false;
    var d = new Date(y, m - 1, day);
    /* round-trips only for real calendar dates (Feb 30 does not) */
    return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
  }

  function parse(k) {
    if (!isKey(k)) return null;
    return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n, day = d.getDate();
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  }

  function startOfWeek(d, weekStart) {
    var ws = weekStart === 1 ? 1 : 0;
    var shift = (d.getDay() - ws + 7) % 7;
    return addDays(d, -shift);
  }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

  /* Rounded, so a DST shift inside the range can never produce 0.96 of a day. */
  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function eachDay(a, b) {
    var out = [], d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var guard = 0;
    while (d <= b && guard++ < 20000) { out.push(d); d = addDays(d, 1); }
    return out;
  }

  function format(d, opts) {
    try { return d.toLocaleDateString(LOCALE, opts); }
    catch (err) { return key(d); }
  }

  var dates = {
    LOCALE: LOCALE,
    MONTHS: MONTHS,
    key: key,
    isKey: isKey,
    parse: parse,
    today: today,
    todayKey: function () { return key(today()); },
    addDays: addDays,
    addMonths: addMonths,
    startOfWeek: startOfWeek,
    startOfMonth: startOfMonth,
    endOfMonth: endOfMonth,
    diffDays: diffDays,
    eachDay: eachDay,
    format: format,

    /* "Thursday, October 29, 2026" */
    long: function (d) {
      return format(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    },
    /* "Oct 29, 2026" */
    medium: function (d) {
      return format(d, { month: 'short', day: 'numeric', year: 'numeric' });
    },
    /* "Thursday, October 29" (no year) — the Today heading */
    longNoYear: function (d) {
      return format(d, { weekday: 'long', month: 'long', day: 'numeric' });
    },
    /* "October 29, 2026" — the day modal heading */
    monthDayYear: function (d) {
      return format(d, { month: 'long', day: 'numeric', year: 'numeric' });
    },
    monthYear: function (d) {
      return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    },
    weekdayNames: function (weekStart, style) {
      var ws = weekStart === 1 ? 1 : 0;
      var names = [];
      /* 2024-01-07 was a Sunday */
      for (var i = 0; i < 7; i++) {
        var d = new Date(2024, 0, 7 + ((ws + i) % 7));
        names.push(format(d, { weekday: style === 'long' ? 'long' : 'short' }));
      }
      return names;
    },
    /* "Today" | "Yesterday" | "Tomorrow" | weekday name */
    relative: function (d) {
      var delta = diffDays(today(), d);
      if (delta === 0) return 'Today';
      if (delta === -1) return 'Yesterday';
      if (delta === 1) return 'Tomorrow';
      return format(d, { weekday: 'long' });
    },
    /* future-date rule: nothing can be logged after today */
    isFutureKey: function (k) {
      return isKey(k) && k > key(today());
    },
    isTodayKey: function (k) { return k === key(today()); }
  };

  FT.dates = dates;
})();
