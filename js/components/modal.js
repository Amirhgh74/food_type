/* modal.js — in-page dialogs. Native alert/confirm/prompt are never used, so everything
   works inside sandboxed iframes too. Centered on desktop, a bottom sheet on phones. */
(function () {
  'use strict';

  var FT = window.FT || (window.FT = {});
  var openStack = [];

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  function open(opts) {
    var options = opts || {};
    var opener = document.activeElement;

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var dialog = document.createElement('div');
    dialog.className = 'modal' + (options.size === 'sm' ? ' modal-sm' : '');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (options.label) dialog.setAttribute('aria-label', options.label);
    if (options.labelledBy) dialog.setAttribute('aria-labelledby', options.labelledBy);

    if (typeof options.content === 'string') dialog.innerHTML = options.content;
    else if (options.content) dialog.appendChild(options.content);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    FT.hydrateIcons(dialog);

    var instance = { el: dialog, backdrop: backdrop, close: close };
    openStack.push(instance);

    requestAnimationFrame(function () { backdrop.classList.add('is-in'); });

    var first = dialog.querySelector('[autofocus]') || focusables(dialog)[0] || dialog;
    if (first === dialog) dialog.setAttribute('tabindex', '-1');
    try { first.focus({ preventScroll: true }); } catch (err) { try { first.focus(); } catch (e) {} }

    function onKeydown(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close(null);
        return;
      }
      if (ev.key !== 'Tab') return;
      var items = focusables(dialog);
      if (!items.length) { ev.preventDefault(); return; }
      var firstEl = items[0], lastEl = items[items.length - 1];
      if (ev.shiftKey && (document.activeElement === firstEl || !dialog.contains(document.activeElement))) {
        ev.preventDefault(); lastEl.focus();
      } else if (!ev.shiftKey && document.activeElement === lastEl) {
        ev.preventDefault(); firstEl.focus();
      }
    }

    function onBackdrop(ev) { if (ev.target === backdrop) close(null); }

    dialog.addEventListener('keydown', onKeydown);
    backdrop.addEventListener('mousedown', onBackdrop);

    var closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      dialog.removeEventListener('keydown', onKeydown);
      backdrop.removeEventListener('mousedown', onBackdrop);
      var i = openStack.indexOf(instance);
      if (i > -1) openStack.splice(i, 1);
      if (!openStack.length) document.body.classList.remove('modal-open');
      backdrop.classList.remove('is-in');
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, 200);
      if (opener && opener.focus && document.contains(opener)) {
        try { opener.focus({ preventScroll: true }); } catch (err) { try { opener.focus(); } catch (e) {} }
      }
      if (typeof options.onClose === 'function') options.onClose(result);
    }

    /* [data-close] inside the content closes with its value */
    dialog.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('[data-close]');
      if (btn && dialog.contains(btn)) {
        var value = btn.getAttribute('data-close');
        close(value === '' ? null : value);
      }
    });

    return instance;
  }

  /* A titled dialog with a row of option buttons. Resolves with the chosen value, or null. */
  function choose(opts) {
    var options = opts || {};
    var list = options.options || [];
    var id = 'modal-title-' + Math.random().toString(36).slice(2, 8);

    var html = '<div class="modal-head">' +
      '<h2 class="modal-title" id="' + id + '">' + FT.esc(options.title || '') + '</h2>' +
      '</div>' +
      (options.message ? '<div class="modal-body">' + options.message + '</div>' : '') +
      '<div class="modal-foot">' +
      list.map(function (o, i) {
        var kind = o.kind === 'primary' ? ' btn-primary' : (o.kind === 'danger' ? ' btn-danger' : '');
        return '<button type="button" class="btn' + kind + '" data-index="' + i + '"' +
          (o.autofocus ? ' autofocus' : '') + '>' + FT.esc(o.label) + '</button>';
      }).join('') +
      '</div>';

    return new Promise(function (resolve) {
      var settled = false;
      var instance = open({
        content: html,
        size: options.size || 'sm',
        labelledBy: id,
        onClose: function () { if (!settled) { settled = true; resolve(null); } }
      });
      instance.el.querySelectorAll('.modal-foot .btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var o = list[+btn.getAttribute('data-index')];
          settled = true;
          instance.close(null);
          resolve(o ? o.value : null);
        });
      });
    });
  }

  function confirm(opts) {
    var options = opts || {};
    return choose({
      title: options.title || 'Are you sure?',
      message: options.message ? '<p class="modal-text">' + FT.esc(options.message) + '</p>' : '',
      options: [
        { label: options.cancelText || 'Cancel', value: false, autofocus: true },
        { label: options.confirmText || 'Confirm', value: true, kind: options.danger ? 'danger' : 'primary' }
      ]
    }).then(function (value) { return value === true; });
  }

  FT.modal = { open: open, choose: choose, confirm: confirm, stack: openStack };
})();
