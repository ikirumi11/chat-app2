/* Verified local-save state + immutable profile snapshots for historical messages. */
(() => {
  'use strict';
  const API_PATH = '/api/messages';
  const originalFetch = window.fetch.bind(window);

  function errorCode(prefix = 'LOCAL') {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function status(state, extra = {}) {
    window.dispatchEvent(new CustomEvent('chat:local-save-status', {
      detail: { state, ...extra }
    }));
  }

  function addProfileSnapshot(body) {
    if (!body || body.game_server === true || body.profile_snapshot) return body;
    const deviceId = String(body.device_id || localStorage.getItem('chat_device_id') || '');
    let snapshot = null;
    try {
      const profiles = window.__chatProfiles?.get?.() || {};
      const p = profiles[deviceId];
      if (p) snapshot = {
        name: String(p.name || body.username || 'User').slice(0, 24),
        pfp: typeof p.pfp === 'string' ? p.pfp : '',
        updatedAt: Number(p.updatedAt || Date.now())
      };
    } catch {}
    if (!snapshot) {
      snapshot = {
        name: String(body.username || 'User').slice(0, 24),
        pfp: '',
        updatedAt: Date.now()
      };
    }
    return { ...body, profile_snapshot: snapshot, profile_name: snapshot.name, profile_pfp: snapshot.pfp };
  }

  async function verifySavedMessage(message) {
    if (!message?.id || !window.__chatP2P?.getMessages) return false;
    const messages = await window.__chatP2P.getMessages();
    const found = messages.find(m => m?.id === message.id);
    return !!found && found.id === message.id;
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    if (!url.includes(API_PATH) || (method !== 'POST' && method !== 'PATCH')) {
      return originalFetch(input, init);
    }

    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch {}
    }
    if (body.game_server === true) return originalFetch(input, init);

    const prepared = method === 'POST' ? addProfileSnapshot(body) : body;
    status('saving');

    try {
      const response = await originalFetch(input, { ...init, body: JSON.stringify(prepared) });
      if (!response.ok) {
        status('failed', { error: { code: errorCode(), name: `HTTP ${response.status}`, message: response.statusText || 'Local save request failed.' } });
        return response;
      }

      let data = null;
      try { data = await response.clone().json(); } catch {}
      const message = data?.message || prepared;
      const verified = await verifySavedMessage(message);
      if (verified) status('saved', { message });
      else status('failed', { error: { code: errorCode(), name: 'VerificationError', message: 'The save completed but the message could not be read back from device storage.' }, message });
      return response;
    } catch (error) {
      status('failed', { error: { code: errorCode(), name: error?.name || 'LocalSaveError', message: error?.message || 'Could not save locally.' }, message: prepared });
      throw error;
    }
  };

  window.addEventListener('chat:p2p-message', async event => {
    const message = event.detail;
    if (!message?.id || !window.__chatP2P?.getMessages) return;
    try {
      const verified = await verifySavedMessage(message);
      status(verified ? 'saved' : 'failed', verified ? { message } : {
        error: { code: errorCode(), name: 'VerificationError', message: 'Received message was not found in device storage after save.' },
        message
      });
    } catch (error) {
      status('failed', { error: { code: errorCode(), name: error?.name || 'VerificationError', message: error?.message || 'Could not verify device storage.' }, message });
    }
  });
})();
