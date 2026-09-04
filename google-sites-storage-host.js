/* Host side of the Google Sites <-> Chat App storage bridge.
 * Put this script in the Google Sites loader page (the parent of the Chat App iframe).
 * It persists bridge data in the loader's own IndexedDB and answers child requests.
 */
(() => {
  'use strict';

  const PREFIX = '__CHAT2_STORAGE__';
  const DB_NAME = 'chat-app2-google-sites-host';
  const STORE_NAME = 'kv';
  const MESSAGE_STORE = 'messages';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(Object.assign(new Error('IndexedDB is unavailable in this Google Sites embed.'), { name: 'StorageUnavailable', code: 'GS-IDB-001' }));
        return;
      }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open Google Sites storage.'));
      req.onblocked = () => reject(Object.assign(new Error('Google Sites storage is blocked by another tab.'), { code: 'GS-IDB-002' }));
    });
    return dbPromise;
  }

  async function kvGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(String(key));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Storage read failed.'));
    });
  }

  async function kvSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, String(key));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Storage write failed.'));
      tx.onabort = () => reject(tx.error || new Error('Storage write aborted.'));
    });
  }

  async function kvRemove(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(String(key));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Storage delete failed.'));
    });
  }

  async function kvList() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('Storage key listing failed.'));
    });
  }

  async function kvClear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Storage clear failed.'));
    });
  }

  async function messageGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, 'readonly');
      const req = tx.objectStore(MESSAGE_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)));
      req.onerror = () => reject(req.error || new Error('Message storage read failed.'));
    });
  }

  async function messagePut(message) {
    if (!message?.id) throw Object.assign(new Error('Message has no id.'), { code: 'GS-MSG-001' });
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, 'readwrite');
      tx.objectStore(MESSAGE_STORE).put({ ...message, google_sites_saved: true });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Message write failed.'));
      tx.onabort = () => reject(tx.error || new Error('Message write aborted.'));
    });
    const found = (await messageGetAll()).find(m => m.id === message.id);
    if (!found) throw Object.assign(new Error('Message write could not be verified by read-back.'), { code: 'GS-MSG-VERIFY' });
    return found;
  }

  async function messageDelete(id) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, 'readwrite');
      tx.objectStore(MESSAGE_STORE).delete(String(id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Message delete failed.'));
    });
  }

  async function messageClear() {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, 'readwrite');
      tx.objectStore(MESSAGE_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Message clear failed.'));
    });
  }

  async function handle(data) {
    switch (data.op) {
      case 'get': return kvGet(data.key);
      case 'set': return kvSet(data.key, data.value).then(() => data.value);
      case 'remove': return kvRemove(data.key).then(() => true);
      case 'list': return kvList();
      case 'clear': return kvClear().then(() => true);
      case 'getMessages': return messageGetAll();
      case 'putMessage': return messagePut(data.value);
      case 'deleteMessage': return messageDelete(data.key).then(() => true);
      case 'clearMessages': return messageClear().then(() => true);
      default: throw Object.assign(new Error(`Unknown storage operation: ${data.op}`), { code: 'GS-OP-001' });
    }
  }

  window.addEventListener('message', async event => {
    const data = event.data;
    if (!data || data.source !== PREFIX || data.kind !== 'request') return;
    try {
      const value = await handle(data);
      event.source?.postMessage({ source: PREFIX, kind: 'response', id: data.id, ok: true, value }, '*');
    } catch (error) {
      event.source?.postMessage({
        source: PREFIX,
        kind: 'response',
        id: data.id,
        ok: false,
        error: { name: error?.name || 'GoogleSitesStorageError', message: error?.message || String(error), code: error?.code || 'GS-STORAGE' }
      }, '*');
    }
  });

  window.__googleSitesStorageHost = {
    database: DB_NAME,
    messageStore: MESSAGE_STORE,
    test: async () => {
      const key = `__test__${Date.now()}`;
      await kvSet(key, 'ok');
      const value = await kvGet(key);
      await kvRemove(key);
      if (value !== 'ok') throw new Error('Google Sites host storage read-back failed.');
      return true;
    }
  };
})();
