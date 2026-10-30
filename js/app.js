/* app.js — routing between tabs, theme handling and initialization. Must load last. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var VIEWS = ['today', 'calendar', 'analytics', 'preferences'];
  var current = null;
  var themeSetByApp = false;

  /* ---------- theme ---------- */

  function prefersDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (err) { return false; }
  }

  function applyTheme() {
    var theme = FT.store.settings().theme;
    var html = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      html.setAttribute('data-theme', theme);
      themeSetByApp = true;
    } else if (themeSetByApp || html.getAttribute('data-theme')) {
      html.removeAttribute('data-theme');
      themeSetByApp = false;
    }
    var isDark = theme === 'dark' || (theme === 'system' && prefersDark());

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.innerHTML = FT.icon(isDark ? 'sun' : 'moon', 20);
      var next = isDark ? 'light' : 'dark';
      toggle.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      toggle.setAttribute('title', 'Switch to ' + next + ' mode');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#000E00' : '#001A00');

    FT.bus.emit('theme', isDark);
    return isDark;
  }

  /* ---------- routing ---------- */

  function go(name) {
    var view = VIEWS.indexOf(name) > -1 ? name : 'today';
    try { history.replaceState(null, '', '#' + view); }
    catch (err) { /* sandboxed iframes can refuse history writes */ }
    if (location.hash !== '#' + view) {
      try { location.hash = view; } catch (err) {}
    }
    show(view);
  }

  function show(view) {
    VIEWS.forEach(function (name) {
      var section = document.getElementById('view-' + name);
      if (!section) return;
      var active = name === view;
      section.hidden = !active;
      if (active) {
        section.classList.remove('is-in');
        if (FT.views[name] && typeof FT.views[name].show === 'function') {
          FT.views[name].show(section);
        }
        /* transform-only entrance: opacity is never animated */
        requestAnimationFrame(function () { section.classList.add('is-in'); });
      }
    });

    document.querySelectorAll('[data-tab]').forEach(function (link) {
      var active = link.getAttribute('data-tab') === view;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    current = view;
    window.scrollTo(0, 0);
  }

  function fromHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    return VIEWS.indexOf(raw) > -1 ? raw : 'today';
  }

  /* ---------- init ---------- */

  function init() {
    FT.hydrateIcons(document);

    document.addEventListener('click', function (ev) {
      var link = ev.target.closest('a[href^="#"]');
      if (!link) return;
      var name = link.getAttribute('href').slice(1);
      if (VIEWS.indexOf(name) === -1) return;
      ev.preventDefault();
      go(name);
    });

    window.addEventListener('hashchange', function () { show(fromHash()); });

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
          (!document.documentElement.getAttribute('data-theme') && prefersDark());
        FT.store.setSetting('theme', isDark ? 'light' : 'dark');
      });
    }

    FT.bus.on('settings', applyTheme);
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (FT.store.settings().theme === 'system') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (err) {}

    applyTheme();
    show(fromHash());

    /* an app left open overnight moves on to the new day */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (FT.views.today && FT.views.today.refresh) FT.views.today.refresh();
      if (current && FT.views[current] && FT.views[current].show) {
        FT.views[current].show(document.getElementById('view-' + current));
      }
    });

    /* Offline support for the installed app.
       While editing, set localStorage.foodGroupLog.noSW = "1" to keep the worker out of
       the way; otherwise it keeps serving the last cached copy of changed files. */
    var swOff = false;
    try { swOff = window.localStorage.getItem('foodGroupLog.noSW') === '1'; } catch (err) {}
    if ('serviceWorker' in navigator && !swOff && location.protocol.indexOf('http') === 0) {
      var register = function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* fine without it */ });
      };
      /* 'load' may already have fired by the time this runs */
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
    }
  }

  FT.app = { go: go, views: VIEWS, applyTheme: applyTheme, get current() { return current; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
