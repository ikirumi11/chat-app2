/*
 * Chat App 2 <-> parent/local-loader storage bridge.
 *
 * The normal Chat App code can keep using /api/messages. When the app is
 * running inside the local GitHub-copy HTML loader, this file transparently
 * sends storage/message requests to the parent. The parent stores the data
 * locally on that device and can return it to the app later.
 *
 * Protocol:
 *   source: __CHAT2_STORAGE__
 *   kind: request | response
 *
 * If there is no compatible parent, the normal network API is left alone.
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
      return Promise.reject(Object.assign(new Error('Local parent bridge is not available'), {
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

        // Game/server state remains server-backed when a backend is configured.
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

  // P2P code can mirror messages directly without going through /api/messages.
  window.addEventListener('chat:p2p-message', event => {
    const message = event.detail;
    if (!message?.id || !available()) return;
    api.putMessage(message).catch(error =>
      console.warn('[Chat2] Local message mirror failed:', error)
    );
  });

  // Let the parent know the app bridge is alive. No data is sent here.
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
