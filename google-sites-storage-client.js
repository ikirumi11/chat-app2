/* Google Sites <-> Chat App storage bridge client.
 * The parent HTML loader owns persistence. The app can request get/set/remove/list/clear
 * without depending on the loader's own IndexedDB implementation.
 */
(() => {
  'use strict';

  const PREFIX = '__CHAT2_STORAGE__';
  const TIMEOUT = 10000;
  let seq = 0;
  const pending = new Map();

  function request(op, key, value) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Google Sites storage request timed out: ${op}`));
      }, TIMEOUT);
      pending.set(id, { resolve, reject, timer });
      try {
        window.parent.postMessage({
          source: PREFIX,
          kind: 'request',
          id,
          op,
          key: key == null ? null : String(key),
          value
        }, '*');
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.source !== PREFIX || data.kind !== 'response') return;
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    clearTimeout(item.timer);
    if (data.ok) item.resolve(data.value);
    else item.reject(Object.assign(new Error(data.error?.message || 'Google Sites storage request failed'), {
      name: data.error?.name || 'GoogleSitesStorageError',
      code: data.error?.code || 'GS-STORAGE'
    }));
  });

  const api = {
    available: () => window.parent !== window,
    get: key => request('get', key),
    set: (key, value) => request('set', key, value),
    remove: key => request('remove', key),
    list: () => request('list', null),
    clear: () => request('clear', null),
    getMessages: () => request('getMessages'),
    putMessage: message => request('putMessage', message?.id || '', message),
    deleteMessage: id => request('deleteMessage', id),
    clearMessages: () => request('clearMessages')
  };

  window.__googleSitesStorage = api;

  // Mirror Chat App message writes to the Google Sites loader. This is intentionally
  // separate from the normal local IndexedDB journal, so the app still works if the
  // parent loader is unavailable.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    if (!url.includes('/api/messages') || !window.__googleSitesStorage.available()) {
      return originalFetch(input, init);
    }

    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch {}
    }

    try {
      if (method === 'GET') {
        const localResponse = await originalFetch(input, init);
        let localData = {};
        try { localData = await localResponse.clone().json(); } catch {}
        const cloud = await api.getMessages();
        const serverMessages = Array.isArray(localData.messages)
          ? localData.messages.filter(m => m?.username === '__GAME_SERVER__' || m?.game_state === true || (typeof m?.message === 'string' && m.message.startsWith('__CHAT_GAME_STATE__:')))
          : [];
        const merged = [...serverMessages, ...(Array.isArray(cloud) ? cloud : [])]
          .filter((m, i, arr) => m?.id ? arr.findIndex(x => x?.id === m.id) === i : true)
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        return new Response(JSON.stringify({ ...(localData || {}), success: true, messages: merged }), {
          status: localResponse.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (method === 'POST' || method === 'PATCH') {
        const response = await originalFetch(input, init);
        if (response.ok && body.game_server !== true) {
          let data = null;
          try { data = await response.clone().json(); } catch {}
          const message = data?.message || body;
          if (message?.id) await api.putMessage(message);
        }
        return response;
      }

      if (method === 'DELETE') {
        const response = await originalFetch(input, init);
        if (response.ok) {
          if (body.delete_all) await api.clearMessages();
          else if (body.id) await api.deleteMessage(body.id);
        }
        return response;
      }
    } catch (error) {
      console.warn('[Chat2] Google Sites storage bridge unavailable:', error);
    }

    return originalFetch(input, init);
  };

  window.addEventListener('chat:p2p-message', event => {
    const message = event.detail;
    if (!message?.id) return;
    api.putMessage(message).catch(error => console.warn('[Chat2] Google Sites message mirror failed:', error));
  });
})();
