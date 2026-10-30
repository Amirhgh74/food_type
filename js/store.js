/* store.js — localStorage persistence.
   Entries:  foodGroupLog.entries  -> { "2026-10-29": ["milk","fruit"], ... }
   Settings: foodGroupLog.settings -> { theme: 'system'|'light'|'dark', weekStart: 0|1 }
   Every read and write is wrapped in try/catch, so a blocked or full storage never
   breaks the app. Future dates can be read and displayed but never written: see setGuard(). */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  var ENTRIES_KEY = 'foodGroupLog.entries';
  var SETTINGS_KEY = 'foodGroupLog.settings';
  var DEFAULT_SETTINGS = { theme: 'system', weekStart: 0 };
  var WRITE_FAIL = 'Could not save. Browser storage may be full or blocked.';
  var FUTURE_BLOCKED = "You can't log a future date.";

  var entries = {};
  var settings = Object.assign({}, DEFAULT_SETTINGS);
  var subscribers = [];
  var keyCache = null;

  /* ---------- cleaning ---------- */

  function cleanIds(list) {
    if (!Array.isArray(list)) {
      if (typeof list === 'string') list = list.split(/[;,|]/);
      else return [];
    }
    var seen = Object.create(null);
    var ids = [];
    for (var i = 0; i < list.length; i++) {
      var id = FT.normalizeItem(list[i]);
      if (!id || seen[id]) continue;
      seen[id] = true;
      ids.push(id);
    }
    /* canonical FT.ITEMS order */
    ids.sort(function (a, b) { return FT.itemById(a).index - FT.itemById(b).index; });
    return ids;
  }

  function sanitize(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (k) {
      if (!FT.dates.isKey(k)) return;
      var ids = cleanIds(obj[k]);
      if (ids.length) out[k] = ids;   /* empty days are deleted, never stored as [] */
    });
    return out;
  }

  /* ---------- raw storage ---------- */

  function readRaw(key) {
    try { return window.localStorage.getItem(key); }
    catch (err) { return null; }
  }

  function writeRaw(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (err) { return false; }
  }

  function loadEntries() {
    var raw = readRaw(ENTRIES_KEY);
    if (!raw) { entries = {}; return; }
    try { entries = sanitize(JSON.parse(raw)); }
    catch (err) { entries = {}; }
  }

  function loadSettings() {
    var raw = readRaw(SETTINGS_KEY);
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (err) { parsed = null; } }
    settings = Object.assign({}, DEFAULT_SETTINGS);
    if (parsed && typeof parsed === 'object') {
      if (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system') {
        settings.theme = parsed.theme;
      }
      settings.weekStart = parsed.weekStart === 1 || parsed.weekStart === '1' ? 1 : 0;
    }
  }

  function persistEntries() {
    var ok = writeRaw(ENTRIES_KEY, JSON.stringify(entries));
    if (!ok) FT.toast(WRITE_FAIL);
    return ok;
  }

  function persistSettings() {
    var ok = writeRaw(SETTINGS_KEY, JSON.stringify(settings));
    if (!ok) FT.toast(WRITE_FAIL);
    return ok;
  }

  function notify() {
    keyCache = null;
    subscribers.slice().forEach(function (fn) {
      try { fn(); } catch (err) { console.error('store subscriber failed', err); }
    });
  }

  /* Future dates are read-only: today is the last day that can be written. */
  function setGuard(key, quiet) {
    if (!FT.dates.isKey(key)) return false;
    if (FT.dates.isFutureKey(key)) {
      if (!quiet) FT.toast(FUTURE_BLOCKED);
      return false;
    }
    return true;
  }

  loadEntries();
  loadSettings();

  /* ---------- public API ---------- */

  var store = {
    ENTRIES_KEY: ENTRIES_KEY,
    SETTINGS_KEY: SETTINGS_KEY,

    get: function (key) { return (entries[key] || []).slice(); },

    count: function (key) { return (entries[key] || []).length; },

    has: function (key, id) { return (entries[key] || []).indexOf(id) > -1; },

    all: function () {
      var copy = {};
      store.keys().forEach(function (k) { copy[k] = entries[k].slice(); });   /* sorted by date */
      return copy;
    },

    keys: function () {
      if (!keyCache) keyCache = Object.keys(entries).sort();
      return keyCache.slice();
    },

    size: function () { return Object.keys(entries).length; },

    /* Returns false when the write was refused (future date) or failed. */
    set: function (key, ids) {
      if (!setGuard(key)) return false;
      var clean = cleanIds(ids);
      if (clean.length) entries[key] = clean;
      else delete entries[key];
      var ok = persistEntries();
      notify();
      return ok;
    },

    toggle: function (key, id) {
      if (!setGuard(key)) return false;
      var norm = FT.normalizeItem(id);
      if (!norm) return false;
      var list = (entries[key] || []).slice();
      var i = list.indexOf(norm);
      if (i > -1) list.splice(i, 1); else list.push(norm);
      return store.set(key, list);
    },

    replaceAll: function (obj) {
      entries = sanitize(obj);
      var ok = persistEntries();
      notify();
      return ok;
    },

    /* per-day union: nothing already logged is removed */
    merge: function (obj) {
      var incoming = sanitize(obj);
      Object.keys(incoming).forEach(function (k) {
        entries[k] = cleanIds((entries[k] || []).concat(incoming[k]));
      });
      var ok = persistEntries();
      notify();
      return ok;
    },

    clear: function () {
      entries = {};
      var ok = persistEntries();
      notify();
      return ok;
    },

    sanitize: sanitize,
    cleanIds: cleanIds,

    subscribe: function (fn) {
      subscribers.push(fn);
      return function unsubscribe() {
        var i = subscribers.indexOf(fn);
        if (i > -1) subscribers.splice(i, 1);
      };
    },

    settings: function () { return Object.assign({}, settings); },

    setSetting: function (k, v) {
      if (k === 'theme') {
        if (v !== 'light' && v !== 'dark' && v !== 'system') return false;
      } else if (k === 'weekStart') {
        v = v === 1 || v === '1' ? 1 : 0;
      } else {
        return false;
      }
      settings[k] = v;
      var ok = persistSettings();
      FT.bus.emit('settings', store.settings());
      return ok;
    },

    bytes: function () {
      try { return JSON.stringify(entries).length; }
      catch (err) { return 0; }
    }
  };

  /* ---------- cross-tab sync ---------- */
  window.addEventListener('storage', function (ev) {
    if (ev.key === ENTRIES_KEY) {
      loadEntries();
      notify();
    } else if (ev.key === SETTINGS_KEY) {
      loadSettings();
      FT.bus.emit('settings', store.settings());
    } else if (ev.key === null) {
      /* whole storage cleared elsewhere */
      loadEntries();
      loadSettings();
      notify();
      FT.bus.emit('settings', store.settings());
    }
  });

  FT.store = store;
})();
