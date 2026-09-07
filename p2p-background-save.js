/* P2P background cache — messages are delivered P2P first, then saved locally in the background. */
(() => {
  'use strict';

  const DB_NAME = 'chat-app2-p2p-cache';
  const STORE = 'messages';
  const VERSION = 1;
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(message) {
    if (!message?.id) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(message);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('P2P background save failed:', e);
    }
  }

  async function remove(id) {
    if (!id) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }

  async function clearAll() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {}
  }

  async function all() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  // Save only after the UI has had a chance to render the message.
  window.addEventListener('chat:p2p-message', e => {
    const message = e.detail;
    setTimeout(() => put(message), 0);
  });

  window.addEventListener('chat:p2p-edit', e => {
    const message = e.detail;
    setTimeout(() => put(message), 0);
  });

  window.addEventListener('chat:p2p-delete', e => {
    const id = e.detail?.id;
    setTimeout(() => remove(id), 0);
  });

  window.addEventListener('chat:p2p-clear', () => {
    setTimeout(clearAll, 0);
  });

  // Replace only GET /api/messages. POST/PATCH/DELETE remain P2P-only.
  const baseFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();

    if (!url.includes('/api/messages') || method !== 'GET') {
      return baseFetch(input, init);
    }

    const messages = (await all()).sort((a, b) =>
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    return new Response(JSON.stringify({ success: true, messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
})();
