/* Persistent local-save state. It is a small status indicator, not a notification. */
(() => {
  'use strict';

  const DB_NAME = 'chat-app2-local';
  const STORE_NAME = 'messages';
  const FALLBACK_KEY = 'chat-app2-local-message-journal-v2';
  const CHECK_INTERVAL = 1000;
  const originalFetch = window.fetch.bind(window);

  let lastVerifiedMessage = null;
  let lastCheck = 0;
  let checkRunning = false;
  let checkTimer = null;

  function errorCode(prefix = 'LOCAL') {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function ensureStatus() {
    let el = document.getElementById('localSaveStatus');
    if (el) return el;

    el = document.createElement('button');
    el.id = 'localSaveStatus';
    el.type = 'button';
    el.setAttribute('aria-live', 'polite');
    el.title = 'Open local save information';
    el.style.cssText = [
      'position:fixed', 'top:7px', 'left:8px', 'z-index:100000',
      'font:600 11px/1.2 system-ui,sans-serif', 'color:#aeb7c3',
      'opacity:.92', 'background:transparent', 'border:0', 'padding:0',
      'margin:0', 'cursor:pointer', 'white-space:nowrap',
      'max-width:calc(100vw - 16px)', 'overflow:hidden', 'text-overflow:ellipsis'
    ].join(';');
    document.body.appendChild(el);
    el.addEventListener('click', openInfo);
    return el;
  }

  function setStatus(text, color, title = '') {
    const el = ensureStatus();
    el.textContent = text;
    el.style.color = color || '#aeb7c3';
    if (title) el.title = title;
  }

  function setSaving() {
    setStatus('Save state: Saving…', '#cbd3dc', 'Writing the message to device storage.');
  }

  function setChecking() {
    setStatus('Save state: Checking…', '#aeb7c3', 'Verifying that saved chat data can be read from device storage.');
  }

  function setSaved(count = null) {
    const suffix = Number.isFinite(count) ? ` · ${count} saved` : '';
    setStatus(`Save state: ✓ Saved on device${suffix}`, '#9fddb4', 'Verified from device storage. Press this text to see exactly where it is stored.');
  }

  function setFailed(error) {
    const code = error?.code || errorCode();
    const details = [error?.name, error?.message].filter(Boolean).join(': ') || 'Local save verification failed.';
    setStatus(`Save state: ✕ Failed · ${code}`, '#ff9fa9', `${details}\nError code: ${code}`);
  }

  async function readLocalMessages() {
    if (window.__chatP2P?.getMessages) return await window.__chatP2P.getMessages();
    return [];
  }

  async function verifyMessage(message) {
    if (!message?.id) return false;
    const messages = await readLocalMessages();
    return messages.some(m => m?.id === message.id);
  }

  function fallbackCount() {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.length : 0;
    } catch { return 0; }
  }

  async function storageDetails() {
    const messages = await readLocalMessages();
    let dbAvailable = false;
    let dbCount = 0;

    try {
      if (indexedDB) {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('IndexedDB open failed.'));
          req.onupgradeneeded = () => resolve(req.result);
        });
        dbAvailable = !!db;
        if (db?.objectStoreNames?.contains(STORE_NAME)) {
          dbCount = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => reject(req.error || new Error('IndexedDB count failed.'));
          });
        }
        try { db.close(); } catch {}
      }
    } catch {}

    return {
      messages,
      dbAvailable,
      dbCount,
      fallbackCount: fallbackCount(),
      database: DB_NAME,
      store: STORE_NAME,
      fallback: FALLBACK_KEY,
      lastVerifiedId: lastVerifiedMessage?.id || 'None yet',
      lastCheck: lastCheck ? new Date(lastCheck).toLocaleString() : 'Not checked yet'
    };
  }

  async function openInfo() {
    try {
      const d = await storageDetails();
      let panel = document.getElementById('localSaveInfo');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'localSaveInfo';
        panel.style.cssText = [
          'position:fixed', 'top:30px', 'left:8px', 'z-index:100001',
          'width:min(390px,calc(100vw - 16px))', 'box-sizing:border-box',
          'padding:12px', 'border-radius:12px', 'background:#151a21',
          'border:1px solid #343d49', 'box-shadow:0 12px 40px rgba(0,0,0,.35)',
          'color:#dce3eb', 'font:12px/1.45 system-ui,sans-serif'
        ].join(';');
        document.body.appendChild(panel);
      }
      panel.innerHTML = `
        <div style="font-weight:800;font-size:13px;margin-bottom:7px">Local save details</div>
        <div><b>Status:</b> Verified</div>
        <div><b>Primary:</b> IndexedDB → ${DB_NAME} → ${STORE_NAME}</div>
        <div><b>IndexedDB records:</b> ${d.dbCount}</div>
        <div><b>Read-back records:</b> ${d.messages.length}</div>
        <div><b>Fallback:</b> localStorage → ${FALLBACK_KEY}</div>
        <div><b>Fallback records:</b> ${d.fallbackCount}</div>
        <div><b>Last verified message:</b> ${String(d.lastVerifiedId).replaceAll('&','&amp;').replaceAll('<','&lt;')}</div>
        <div><b>Last check:</b> ${String(d.lastCheck).replaceAll('&','&amp;').replaceAll('<','&lt;')}</div>
        <div style="margin-top:8px;color:#9fddb4">Messages stay on this device until you delete them or the browser/site storage is cleared.</div>
        <button id="localSaveInfoClose" style="margin-top:10px;padding:6px 9px;border-radius:8px;border:1px solid #3a4553;background:#202733;color:#e8edf3;cursor:pointer">Close</button>
      `;
      panel.querySelector('#localSaveInfoClose').onclick = () => panel.remove();
    } catch (error) {
      setFailed({ code: errorCode('INFO'), name: error?.name, message: error?.message });
    }
  }

  async function auditStorage() {
    if (checkRunning) return;
    checkRunning = true;
    try {
      setChecking();
      const messages = await readLocalMessages();
      lastCheck = Date.now();

      // Reading the complete local store is itself the persistence check: the
      // exact records used to rebuild Old Chat must be returned after refresh.
      if (!Array.isArray(messages)) throw new Error('Device storage returned an invalid message list.');

      if (lastVerifiedMessage?.id) {
        const found = messages.find(m => m?.id === lastVerifiedMessage.id);
        if (!found) throw new Error(`Previously verified message ${lastVerifiedMessage.id} is missing.`);
      }

      if (messages.length) {
        lastVerifiedMessage = messages[messages.length - 1];
        setSaved(messages.length);
      } else {
        setStatus('Save state: ✓ Device storage ready · 0 saved', '#9fddb4', 'No chat messages are currently saved on this device.');
      }
    } catch (error) {
      setFailed({ code: errorCode(), name: error?.name || 'StorageCheckError', message: error?.message || 'Could not read device storage.' });
    } finally {
      checkRunning = false;
    }
  }

  async function runStorageSelfTest() {
    const testId = `__local_save_test__${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      if (!indexedDB) throw new Error('IndexedDB is not available.');
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB test open failed.'));
      });
      if (!db.objectStoreNames.contains(STORE_NAME)) throw new Error(`Object store ${STORE_NAME} is missing.`);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id: testId, room: 'public', channel: 'public', storage_test: true, created_at: new Date().toISOString() });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Storage self-test write failed.'));
        tx.onabort = () => reject(tx.error || new Error('Storage self-test aborted.'));
      });
      const found = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(testId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Storage self-test read failed.'));
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(testId);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Storage self-test cleanup failed.'));
      });
      try { db.close(); } catch {}
      if (!found?.storage_test || found.id !== testId) throw new Error('Storage self-test read-back did not match.');
      return true;
    } catch (error) {
      throw error;
    }
  }

  async function verifyAndShow(message) {
    if (!message?.id) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await verifyMessage(message)) {
        lastVerifiedMessage = message;
        setSaved((await readLocalMessages()).length);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setFailed({ code: errorCode(), name: 'VerificationError', message: 'The message was not readable from device storage after repeated 1-second checks.' });
    return false;
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    if (!url.includes('/api/messages') || (method !== 'POST' && method !== 'PATCH')) return originalFetch(input, init);

    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch {} }
    if (body.game_server === true) return originalFetch(input, init);

    setSaving();
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) {
        setFailed({ code: errorCode(), name: `HTTP ${response.status}`, message: response.statusText || 'Local save request failed.' });
        return response;
      }
      let data = null;
      try { data = await response.clone().json(); } catch {}
      const message = data?.message || body;
      await verifyAndShow(message);
      return response;
    } catch (error) {
      setFailed({ code: errorCode(), name: error?.name || 'LocalSaveError', message: error?.message || 'Could not save locally.' });
      throw error;
    }
  };

  window.addEventListener('chat:p2p-message', event => {
    verifyAndShow(event.detail).catch(error => setFailed({ code: errorCode(), name: error?.name, message: error?.message }));
  });

  async function start() {
    ensureStatus();
    setChecking();
    try {
      await runStorageSelfTest();
      await auditStorage();
    } catch (error) {
      setFailed({ code: errorCode('SELFTEST'), name: error?.name || 'StorageSelfTestError', message: error?.message || 'Device storage self-test failed.' });
    }
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(auditStorage, CHECK_INTERVAL);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
