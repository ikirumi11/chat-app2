/* Google Sites <-> Chat App storage bridge client.
 * When Chat App 2 is running inside the supplied Google Sites loader,
 * the parent loader owns device persistence. The app can request get/set/remove/list/clear
 * and message operations through postMessage. If the loader is unavailable, normal
 * Chat App storage/API behavior is preserved.
 */
(() => {
  'use strict';

  const PREFIX = '__CHAT2_STORAGE__';
  const TIMEOUT = 10000;
  let seq = 0;
  const pending = new Map();

  function available() {
    return window.parent !== window && window.parent && window.parent !== window;
  }

  function request(op, key, value) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Object.assign(new Error(`Google Sites storage request timed out: ${op}`), {
          name: 'GoogleSitesStorageTimeout',
          code: 'GS-TIMEOUT'
        }));
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
    available,
    request,
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

  const originalFetch = window.fetch.bind(window);

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function isMessagesAPI(url) {
    return typeof url === 'string' && /(?:^|\/)api\/messages(?:[/?#]|$)/.test(url);
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();

    if (!isMessagesAPI(url) || !available()) {
      return originalFetch(input, init);
    }

    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch {}
    }

    /*
      GAME SERVER requests still go to the configured server. The parent
      loader stores normal user/P2P chat messages locally on the device.
    */
    const isGameServerWrite = body?.game_server === true;

    try {
      if (method === 'GET') {
        let serverMessages = [];

        // Keep game/server messages from the real API when that backend exists.
        try {
          const serverResponse = await originalFetch(input, init);
          const serverData = await serverResponse.clone().json();
          serverMessages = Array.isArray(serverData?.messages)
            ? serverData.messages.filter(m =>
                m?.username === '__GAME_SERVER__' ||
                m?.game_state === true ||
                (typeof m?.message === 'string' && m.message.startsWith('__CHAT_GAME_STATE__:'))
              )
            : [];
        } catch (_) {
          // The local Google Sites bridge can still serve the chat.
        }

        const localMessages = await api.getMessages();
        const merged = [...serverMessages, ...(Array.isArray(localMessages) ? localMessages : [])]
          .filter((m, i, arr) => m?.id ? arr.findIndex(x => x?.id === m.id) === i : true)
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        return jsonResponse({ success: true, messages: merged });
      }

      if (method === 'POST') {
        if (isGameServerWrite) {
          return originalFetch(input, init);
        }

        const message = body?.message && typeof body.message === 'object'
          ? body.message
          : body;

        if (!message?.id) {
          // Some app versions let the server create an id. Preserve the request
          // if there is no id available for the local store.
          return originalFetch(input, init);
        }

        const saved = await api.putMessage(message);
        return jsonResponse({ success: true, message: saved });
      }

      if (method === 'PATCH') {
        if (isGameServerWrite) {
          return originalFetch(input, init);
        }

        const message = body?.message && typeof body.message === 'object'
          ? body.message
          : body;

        if (!message?.id) return originalFetch(input, init);

        const saved = await api.putMessage(message);
        return jsonResponse({ success: true, message: saved });
      }

      if (method === 'DELETE') {
        if (body?.delete_all) {
          await api.clearMessages();
          return jsonResponse({ success: true });
        }

        if (body?.id) {
          await api.deleteMessage(body.id);
          return jsonResponse({ success: true });
        }

        return originalFetch(input, init);
      }
    } catch (error) {
      console.warn('[Chat2] Google Sites storage bridge unavailable; using normal API:', error);
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };

  window.addEventListener('chat:p2p-message', event => {
    const message = event.detail;
    if (!message?.id || !available()) return;
    api.putMessage(message).catch(error =>
      console.warn('[Chat2] Google Sites message mirror failed:', error)
    );
  });
})();
