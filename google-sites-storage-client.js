/*
 * Chat App 2 local-device storage bridge.
 *
 * The GitHub site remains the real app. When it is loaded by the local-copy
 * HTML loader, ChatLocal.save/load talks to the parent loader and the parent
 * stores the data only on this device.
 *
 * Existing __googleSitesStorage methods are kept for compatibility with the
 * chat/P2P code. Normal /api/messages calls are redirected to the same local
 * device store while game-server messages may still use the real backend.
 */
(() => {
  'use strict';

  const PREFIX = '__CHAT2_STORAGE__';
  const PROTOCOL = 2;
  const TIMEOUT = 12000;
  let seq = 0;
  const pending = new Map();

  function available() {
    try {
      return window.parent && window.parent !== window &&
        typeof window.parent.postMessage === 'function';
    } catch (_) {
      return false;
    }
  }

  function request(op, key = null, value = undefined) {
    if (!available()) {
      return Promise.reject(Object.assign(new Error('Local Save/Load parent is not available'), {
        name: 'Chat2BridgeUnavailable',
        code: 'GS-NO-PARENT'
      }));
    }

    return new Promise((resolve, reject) => {
      const id = `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Object.assign(new Error(`Local storage request timed out: ${op}`), {
          name: 'Chat2BridgeTimeout',
          code: 'GS-TIMEOUT'
        }));
      }, TIMEOUT);

      pending.set(id, { resolve, reject, timer });

      try {
        const message = {
          source: PREFIX,
          protocol: PROTOCOL,
          kind: 'request',
          id,
          op,
          key: key == null ? null : String(key)
        };
        if (value !== undefined) message.value = value;
        window.parent.postMessage(message, '*');
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.source !== PREFIX || data.kind !== 'response' || !data.id) return;

    const item = pending.get(data.id);
    if (!item) return;

    pending.delete(data.id);
    clearTimeout(item.timer);

    if (data.ok) {
      item.resolve(data.value);
    } else {
      const err = Object.assign(
        new Error(data.error?.message || 'Local storage request failed'),
        {
          name: data.error?.name || 'Chat2BridgeError',
          code: data.error?.code || 'GS-STORAGE'
        }
      );
      item.reject(err);
    }
  });

  const api = {
    protocol: PROTOCOL,
    available,
    request,
    get: key => request('get', key),
    set: (key, value) => request('set', key, value),
    remove: key => request('remove', key),
    list: () => request('list'),
    clear: () => request('clear'),
    getMessages: () => request('getMessages'),
    putMessage: message => request('putMessage', message?.id || '', message),
    deleteMessage: id => request('deleteMessage', id),
    clearMessages: () => request('clearMessages'),
    getState: () => request('getState'),
    setState: value => request('setState', null, value)
  };

  window.__googleSitesStorage = api;
  window.__chat2LocalBridge = api;

  // Simple API requested by the local-copy HTML loader.
  // Example: await ChatLocal.save('myKey', { hello: 'world' });
  //          const value = await ChatLocal.load('myKey');
  window.ChatLocal = {
    save: async (key, value) => api.set(String(key), value),
    load: async key => api.get(String(key)),
    remove: async key => api.remove(String(key))
  };
  window.__chat2LocalSave = window.ChatLocal.save;
  window.__chat2LocalLoad = window.ChatLocal.load;

  const originalFetch = window.fetch.bind(window);

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function isMessagesAPI(url) {
    return typeof url === 'string' && /(?:^|\/)api\/messages(?:[/?#]|$)/.test(url);
  }

  function parseBody(init, input) {
    const raw = init?.body ?? (typeof input !== 'string' ? input?.body : null);
    if (typeof raw !== 'string') return raw && typeof raw === 'object' ? raw : {};
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(
      init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET'
    ).toUpperCase();

    if (!isMessagesAPI(url) || !available()) {
      return originalFetch(input, init);
    }

    const body = parseBody(init, input);
    const isGameServerWrite = body?.game_server === true;

    try {
      if (method === 'GET') {
        let serverMessages = [];

        try {
          const serverResponse = await originalFetch(input, init);
          if (serverResponse.ok) {
            const serverData = await serverResponse.clone().json();
            serverMessages = Array.isArray(serverData?.messages)
              ? serverData.messages.filter(m =>
                  m?.username === '__GAME_SERVER__' ||
                  m?.game_state === true ||
                  (typeof m?.message === 'string' && m.message.startsWith('__CHAT_GAME_STATE__:'))
                )
              : [];
          }
        } catch (_) {}

        const localMessages = await api.getMessages();
        const merged = [
          ...serverMessages,
          ...(Array.isArray(localMessages) ? localMessages : [])
        ]
          .filter((m, i, arr) => m?.id ? arr.findIndex(x => x?.id === m.id) === i : true)
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        return jsonResponse({ success: true, messages: merged, source: 'local-bridge' });
      }

      if (method === 'POST' || method === 'PATCH') {
        if (isGameServerWrite) return originalFetch(input, init);

        const message = body?.message && typeof body.message === 'object'
          ? body.message
          : body;

        if (!message?.id) return originalFetch(input, init);

        const saved = await api.putMessage(message);
        return jsonResponse({ success: true, message: saved, source: 'local-bridge' });
      }

      if (method === 'DELETE') {
        if (body?.delete_all) {
          await api.clearMessages();
          return jsonResponse({ success: true, source: 'local-bridge' });
        }

        if (body?.id) {
          await api.deleteMessage(body.id);
          return jsonResponse({ success: true, source: 'local-bridge' });
        }
      }
    } catch (error) {
      console.warn('[Chat2] Local parent bridge failed; falling back to normal API:', error);
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };

  window.addEventListener('chat:p2p-message', event => {
    const message = event.detail;
    if (!message?.id || !available()) return;
    api.putMessage(message).catch(error =>
      console.warn('[Chat2] Local message mirror failed:', error)
    );
  });

  if (available()) {
    try {
      window.parent.postMessage({
        source: PREFIX,
        protocol: PROTOCOL,
        kind: 'hello'
      }, '*');
    } catch (_) {}
  }
})();
