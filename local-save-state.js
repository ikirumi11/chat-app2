/* Permanent device-local chat journal + small persistent save-state indicator. */
(() => {
  'use strict';

  const DB_NAME = 'chat-app2-permanent-local';
  const STORE_NAME = 'messages';
  const LEGACY_DB_NAME = 'chat-app2-local';
  const CHECK_INTERVAL = 1000;
  const originalFetch = window.fetch.bind(window);

  let dbPromise = null;
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
    el.style.cssText = 'position:fixed;top:7px;left:8px;z-index:100000;font:600 11px/1.2 system-ui,sans-serif;color:#aeb7c3;opacity:.92;background:transparent;border:0;padding:0;margin:0;cursor:pointer;white-space:nowrap;max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis';
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
    setStatus('Save state: Saving…', '#cbd3dc', 'Writing and verifying this message in permanent device storage.');
  }

  function setChecking() {
    setStatus('Save state: Checking…', '#aeb7c3', 'Checking the permanent device-local chat journal.');
  }

  function setSaved(count) {
    setStatus(`Save state: ✓ Saved on device · ${count} saved`, '#9fddb4', 'Verified from permanent device storage. Press this text to see exactly where it is stored.');
  }

  function setFailed(error) {
    const code = error?.code || errorCode();
    const details = [error?.name, error?.message].filter(Boolean).join(': ') || 'Local save verification failed.';
    setStatus(`Save state: ✕ Failed · ${code}`, '#ff9fa9', `${details}\nError code: ${code}`);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('Permanent IndexedDB could not be opened.'));
      req.onblocked = () => reject(new Error('Permanent IndexedDB is blocked by another page.'));
    });
    return dbPromise;
  }

  async function putPermanent(message) {
    if (!message?.id) return false;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...message, permanent_local: true });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Permanent local write failed.'));
      tx.onabort = () => reject(tx.error || new Error('Permanent local write aborted.'));
    });
    return true;
  }

  async function getPermanent() {
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('Permanent local read failed.'));
    });
    return rows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  async function deletePermanent(id) {
    if (!id) return;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Permanent local delete failed.'));
    });
  }

  async function clearPermanent() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Permanent local clear failed.'));
    });
  }

  async function migrateLegacy() {
    if (!window.__chatP2P?.getMessages) return;
    const existing = await getPermanent();
    const known = new Set(existing.map(m => m.id));
    const legacy = await window.__chatP2P.getMessages();
    for (const message of legacy) {
      if (message?.id && !known.has(message.id)) await putPermanent(message);
    }
  }

  async function readLocalMessages() {
    return await getPermanent();
  }

  async function verifyMessage(message) {
    if (!message?.id) return false;
    const messages = await readLocalMessages();
    return messages.some(m => m?.id === message.id);
  }

  async function getCounts() {
    const messages = await getPermanent();
    return { messages, count: messages.length };
  }

  async function storageDetails() {
    const d = await getCounts();
    let legacyExists = false;
    try {
      const req = indexedDB.open(LEGACY_DB_NAME);
      const legacyDb = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Legacy storage lookup failed.'));
      });
      legacyExists = !!legacyDb;
      try { legacyDb.close(); } catch {}
    } catch {}

    return {
      count: d.count,
      database: DB_NAME,
      store: STORE_NAME,
      legacyDatabase: LEGACY_DB_NAME,
      legacyExists,
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
        panel.style.cssText = 'position:fixed;top:30px;left:8px;z-index:100001;width:min(390px,calc(100vw - 16px));box-sizing:border-box;padding:12px;border-radius:12px;background:#151a21;border:1px solid #343d49;box-shadow:0 12px 40px rgba(0,0,0,.35);color:#dce3eb;font:12px/1.45 system-ui,sans-serif';
        document.body.appendChild(panel);
      }
      panel.innerHTML = `<div style="font-weight:800;font-size:13px;margin-bottom:7px">Local save details</div><div><b>Status:</b> Verified</div><div><b>Primary storage:</b> IndexedDB</div><div><b>Database:</b> ${DB_NAME}</div><div><b>Object store:</b> ${STORE_NAME}</div><div><b>Saved messages:</b> ${d.count}</div><div><b>Old local database detected:</b> ${d.legacyExists ? 'Yes' : 'No'}</div><div><b>Last verified message:</b> ${String(d.lastVerifiedId).replaceAll('&','&amp;').replaceAll('<','&lt;')}</div><div><b>Last 1-second check:</b> ${String(d.lastCheck).replaceAll('&','&amp;').replaceAll('<','&lt;')}</div><div style="margin-top:8px;color:#9fddb4">Messages remain here until you delete them or the browser/site storage is cleared. Refreshing the site does not delete this journal.</div><button id="localSaveInfoTest" style="margin-top:10px;padding:6px 9px;border-radius:8px;border:1px solid #3a4553;background:#202733;color:#e8edf3;cursor:pointer">Run storage test</button><button id="localSaveInfoClose" style="margin-top:10px;margin-left:6px;padding:6px 9px;border-radius:8px;border:1px solid #3a4553;background:#202733;color:#e8edf3;cursor:pointer">Close</button>`;
      panel.querySelector('#localSaveInfoClose').onclick = () => panel.remove();
      panel.querySelector('#localSaveInfoTest').onclick = async () => {
        const b = panel.querySelector('#localSaveInfoTest');
        b.disabled = true;
        try { await runStorageSelfTest(); b.textContent = 'Test passed ✓'; } catch (error) { b.textContent = `Test failed · ${errorCode('TEST')}`; console.error(error); }
        setTimeout(() => { if (b) b.disabled = false; }, 1200);
      };
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
      if (!Array.isArray(messages)) throw new Error('Permanent device storage returned an invalid message list.');
      if (lastVerifiedMessage?.id && !messages.some(m => m?.id === lastVerifiedMessage.id)) {
        throw new Error(`Previously verified message ${lastVerifiedMessage.id} is missing from permanent storage.`);
      }
      if (messages.length) {
        lastVerifiedMessage = messages[messages.length - 1];
        setSaved(messages.length);
      } else {
        setStatus('Save state: ✓ Device storage ready · 0 saved', '#9fddb4', 'Permanent device storage is working.');
      }
    } catch (error) {
      setFailed({ code: errorCode(), name: error?.name || 'StorageCheckError', message: error?.message || 'Could not read permanent device storage.' });
    } finally {
      checkRunning = false;
    }
  }

  async function runStorageSelfTest() {
    const testId = `__local_save_test__${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await putPermanent({ id: testId, room: 'public', channel: 'public', storage_test: true, created_at: new Date().toISOString() });
    const found = (await getPermanent()).find(m => m.id === testId);
    await deletePermanent(testId);
    if (!found?.storage_test || found.id !== testId) throw new Error('Permanent storage self-test read-back did not match.');
    return true;
  }

  async function verifyAndShow(message) {
    if (!message?.id) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await verifyMessage(message)) {
        lastVerifiedMessage = message;
        const count = (await getCounts()).count;
        setSaved(count);
        return true;
      }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
    setFailed({ code: errorCode(), name: 'VerificationError', message: 'The message was not readable from permanent device storage after repeated 1-second checks.' });
    return false;
  }

  async function mirrorResponse(response, method, body) {
    if (!response.ok) return;
    let data = null;
    try { data = await response.clone().json(); } catch {}
    const message = data?.message;
    if (message?.id) await putPermanent(message);
    if (method === 'DELETE') {
      if (body.delete_all) await clearPermanent();
      else if (body.id) await deletePermanent(body.id);
    }
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();

    if (!url.includes('/api/messages')) return originalFetch(input, init);

    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch {} }
    if (body.game_server === true) return originalFetch(input, init);

    if (method === 'GET') {
      try {
        const response = await originalFetch(input, init);
        let data = null;
        try { data = await response.clone().json(); } catch {}
        const permanent = await getPermanent();
        const serverMessages = Array.isArray(data?.messages) ? data.messages.filter(m => m?.username === '__GAME_SERVER__' || m?.game_state === true || (typeof m?.message === 'string' && m.message.startsWith('__CHAT_GAME_STATE__:'))) : [];
        const merged = [...serverMessages, ...permanent].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        return new Response(JSON.stringify({ ...(data || {}), success: true, messages: merged }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        setFailed({ code: errorCode('GET'), name: error?.name, message: error?.message });
        return originalFetch(input, init);
      }
    }

    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      if (method === 'POST' || method === 'PATCH') setSaving();
      try {
        const response = await originalFetch(input, init);
        await mirrorResponse(response, method, body);
        if (!response.ok) {
          if (method !== 'DELETE') setFailed({ code: errorCode(), name: `HTTP ${response.status}`, message: response.statusText || 'Local save request failed.' });
          return response;
        }
        if (method === 'POST' || method === 'PATCH') {
          let data = null;
          try { data = await response.clone().json(); } catch {}
          const message = data?.message || body;
          await verifyAndShow(message);
        } else {
          await auditStorage();
        }
        return response;
      } catch (error) {
        if (method !== 'DELETE') setFailed({ code: errorCode(), name: error?.name || 'LocalSaveError', message: error?.message || 'Could not save locally.' });
        throw error;
      }
    }

    return originalFetch(input, init);
  };

  window.addEventListener('chat:p2p-message', event => {
    putPermanent(event.detail).then(() => verifyAndShow(event.detail)).catch(error => setFailed({ code: errorCode(), name: error?.name, message: error?.message }));
  });

  async function start() {
    ensureStatus();
    setChecking();
    try {
      await migrateLegacy();
      await runStorageSelfTest();
      await auditStorage();
    } catch (error) {
      setFailed({ code: errorCode('SELFTEST'), name: error?.name || 'StorageSelfTestError', message: error?.message || 'Permanent device storage self-test failed.' });
    }
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(auditStorage, CHECK_INTERVAL);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
