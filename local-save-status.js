/* Persistent local save state indicator. Shows whether chat data was saved on this device. */
(() => {
  'use strict';

  function show(detail) {
    let el = document.getElementById('localSaveStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'localSaveStatus';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = [
        'position:fixed',
        'top:8px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:100000',
        'max-width:calc(100vw - 24px)',
        'box-sizing:border-box',
        'padding:7px 12px',
        'border-radius:999px',
        'background:rgba(20,24,30,.96)',
        'border:1px solid rgba(255,255,255,.14)',
        'font:600 12px system-ui,sans-serif',
        'color:#dce3eb',
        'box-shadow:0 6px 24px rgba(0,0,0,.28)',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(el);
    }

    if (detail?.ok) {
      el.textContent = 'Save state: ✓ Saved on this device';
      el.style.borderColor = 'rgba(80,200,120,.45)';
      el.style.color = '#dff7e6';
      el.title = 'Your chat data was saved locally on this device.';
    } else {
      const e = detail?.error || {};
      const code = e.code || ('LOCAL-' + Math.random().toString(36).slice(2, 9).toUpperCase());
      el.textContent = `Save state: ✕ Failed to save · ${code}`;
      el.style.borderColor = 'rgba(255,90,90,.55)';
      el.style.color = '#ffdede';
      el.title = [e.name, e.message].filter(Boolean).join(': ') || 'Local save error';
    }

    el.style.opacity = '1';
  }

  // Start with an explicit state instead of leaving the user guessing.
  window.addEventListener('DOMContentLoaded', () => show({ ok: true }));
  window.addEventListener('chat:local-save-status', e => show(e.detail || {}));
})();
