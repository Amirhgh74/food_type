/* core.js — global namespace, event bus, helpers. Loads first. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});

  FT.views = FT.views || {};

  /* ---------- event bus ---------- */
  var handlers = Object.create(null);
  FT.bus = {
    on: function (name, fn) {
      (handlers[name] || (handlers[name] = [])).push(fn);
      return function off() { FT.bus.off(name, fn); };
    },
    off: function (name, fn) {
      var list = handlers[name];
      if (!list) return;
      var i = list.indexOf(fn);
      if (i > -1) list.splice(i, 1);
    },
    emit: function (name, payload) {
      var list = handlers[name];
      if (!list) return;
      list.slice().forEach(function (fn) {
        try { fn(payload); } catch (err) { console.error('bus handler failed for "' + name + '"', err); }
      });
    }
  };

  /* ---------- html escaping ---------- */
  FT.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ---------- toast ---------- */
  var TOAST_MS = 2600;
  FT.toast = function (message) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = String(message == null ? '' : message);
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, TOAST_MS);
  };

  /* ---------- design token reader ---------- */
  FT.token = function (name) {
    var key = name.charAt(0) === '-' ? name : '--' + name;
    var value = getComputedStyle(document.documentElement).getPropertyValue(key);
    return (value || '').trim();
  };

  /* ---------- misc ---------- */
  FT.clamp = function (n, min, max) { return n < min ? min : (n > max ? max : n); };

  FT.pct = function (part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  };

  /* Lighten a hex color toward white by amount 0..1 (used for dark-mode icons via --lift). */
  FT.lighten = function (hex, amount) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m || !amount) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var a = FT.clamp(amount, 0, 1);
    r = Math.round(r + (255 - r) * a);
    g = Math.round(g + (255 - g) * a);
    b = Math.round(b + (255 - b) * a);
    return '#' + [r, g, b].map(function (v) {
      var s = v.toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  };

  /* Item color adjusted for the current theme (dark mode lifts it toward white). */
  FT.itemColor = function (hex) {
    var lift = parseFloat(FT.token('lift')) || 0;
    return lift ? FT.lighten(hex, lift / 100) : hex;
  };
})();
