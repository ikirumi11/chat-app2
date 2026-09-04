/* Clear local-save feedback. Google Sheets failures never change this status. */
(() => {
  'use strict';
  function show(detail) {
    let el = document.getElementById('localSaveStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'localSaveStatus';
      el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:100000;max-width:min(420px,calc(100vw - 28px));padding:10px 13px;border-radius:12px;background:rgba(20,24,30,.96);border:1px solid rgba(255,255,255,.12);font:13px system-ui;color:#dce3eb;box-shadow:0 10px 35px rgba(0,0,0,.3);transition:opacity .25s;';
      document.body.appendChild(el);
    }
    clearTimeout(el.__timer);
    if (detail?.ok) {
      el.textContent = '✓ Saved locally on this device';
      el.style.borderColor = 'rgba(80,200,120,.35)';
    } else {
      const e = detail?.error || {};
      const code = e.code || ('LOCAL-' + Math.random().toString(36).slice(2, 9).toUpperCase());
      el.textContent = `✕ Failed to save locally · ${code}`;
      el.title = [e.name, e.message].filter(Boolean).join(': ') || 'Local storage error';
      el.style.borderColor = 'rgba(255,90,90,.45)';
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'help';
    }
    el.style.opacity = '1';
    el.__timer = setTimeout(() => { el.style.opacity = '.55'; }, 5000);
  }
  window.addEventListener('chat:local-save-status', e => show(e.detail || {}));
})();
