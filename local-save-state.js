/* Small persistent local save-state indicator. Status only, never a notification. */
(() => {
  'use strict';
  const oldFetch = window.fetch.bind(window);

  function ensure() {
    let el = document.getElementById('localSaveStatus');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'localSaveStatus';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;top:7px;left:8px;z-index:100000;font:600 11px/1.2 system-ui,sans-serif;color:#aeb7c3;opacity:.9;pointer-events:none;white-space:nowrap;max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(el);
    return el;
  }

  function show(state, error) {
    const el = ensure();
    if (state === 'saving') {
      el.textContent = 'Save state: Saving…';
      el.style.color = '#cbd3dc';
    } else if (state === 'saved') {
      el.textContent = 'Save state: ✓ Saved on device';
      el.style.color = '#9fddb4';
      el.title = 'Verified: the saved chat data can be read back from device storage.';
    } else if (state === 'failed') {
      const code = error?.code || 'LOCAL-UNKNOWN';
      el.textContent = `Save state: ✕ Failed · ${code}`;
      el.style.color = '#ff9fa9';
      el.title = [error?.name, error?.message].filter(Boolean).join(': ') || 'Local save verification failed.';
    } else {
      el.textContent = 'Save state: Checking device storage…';
      el.style.color = '#aeb7c3';
    }
  }

  async function verify(message) {
    if (!message?.id || !window.__chatP2P?.getMessages) return false;
    const list = await window.__chatP2P.getMessages();
    return list.some(m => m?.id === message.id);
  }

  function code() {
    return 'LOCAL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    if (!url.includes('/api/messages') || (method !== 'POST' && method !== 'PATCH')) return oldFetch(input, init);

    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch {} }
    if (body.game_server === true) return oldFetch(input, init);

    show('saving');
    try {
      const response = await oldFetch(input, init);
      if (!response.ok) {
        show('failed', { code: code(), name: `HTTP ${response.status}`, message: response.statusText });
        return response;
      }
      let data = null;
      try { data = await response.clone().json(); } catch {}
      const message = data?.message || body;
      if (await verify(message)) show('saved');
      else show('failed', { code: code(), name: 'VerificationError', message: 'Saved data could not be read back from device storage.' });
      return response;
    } catch (error) {
      show('failed', { code: code(), name: error?.name, message: error?.message });
      throw error;
    }
  };

  window.addEventListener('chat:p2p-message', async e => {
    try {
      if (await verify(e.detail)) show('saved');
      else show('failed', { code: code(), name: 'VerificationError', message: 'Message was not found in device storage.' });
    } catch (error) {
      show('failed', { code: code(), name: error?.name, message: error?.message });
    }
  });

  function initialCheck() {
    show('checking');
    if (window.__chatP2P?.getMessages) window.__chatP2P.getMessages().then(() => show('saved')).catch(error => show('failed', { code: code(), name: error?.name, message: error?.message }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialCheck);
  else initialCheck();
})();
