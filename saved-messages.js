/* Saved messages UI — local-only cache, with an Edge Collections shortcut. */
(() => {
  'use strict';

  const DB_NAME = 'chat-app2-p2p-cache';
  const STORE = 'messages';
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
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

  async function getSaved() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)));
        req.onerror = () => reject(req.error);
      });
    } catch { return []; }
  }

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function addUi() {
    if (document.getElementById('savedMessagesBtn')) return;
    const actions = document.querySelector('.header-actions');
    if (!actions) return;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'savedMessagesBtn';
    btn.title = 'Saved';
    btn.setAttribute('aria-label','Saved');
    btn.textContent = '🔖';
    actions.insertBefore(btn, actions.firstChild);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'savedMessagesOverlay';
    overlay.innerHTML = `<div class="panel"><div class="panel-header"><h2>🔖 Saved</h2><button class="icon-btn" id="closeSavedMessages">×</button></div><div class="panel-body"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="save-btn" id="openEdgeSave">Open Save</button><button class="game-btn" id="refreshSaved">Refresh saved</button></div><p id="savedInfo" style="color:#929aa5">Messages are saved locally on this device.</p><div id="savedList"></div></div></div>`;
    document.body.appendChild(overlay);

    const style = document.createElement('style');
    style.textContent = `#savedList{display:flex;flex-direction:column;gap:8px}.saved-item{padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.03)}.saved-meta{font-size:12px;color:#8e98a5;margin-bottom:4px}.saved-text{white-space:pre-wrap;word-break:break-word;color:#e8edf3}.saved-media{max-width:100%;max-height:220px;border-radius:8px;margin-top:7px}`;
    document.head.appendChild(style);

    btn.onclick = () => { overlay.classList.add('open'); render(); };
    document.getElementById('closeSavedMessages').onclick = () => overlay.classList.remove('open');
    document.getElementById('refreshSaved').onclick = render;
    document.getElementById('openEdgeSave').onclick = () => {
      const w = window.open('edge://collections/', '_blank');
      if (!w) window.location.href = 'edge://collections/';
    };

    async function render() {
      const list = document.getElementById('savedList');
      const info = document.getElementById('savedInfo');
      list.innerHTML = '<p style="color:#929aa5">Loading saved messages…</p>';
      const messages = await getSaved();
      info.textContent = `${messages.length} saved message${messages.length === 1 ? '' : 's'} on this device.`;
      if (!messages.length) {
        list.innerHTML = '<p style="color:#929aa5">No saved messages yet. Messages sent or received in Public Chat are saved automatically after appearing on screen.</p>';
        return;
      }
      list.innerHTML = messages.map(m => {
        const files = Array.isArray(m.files) ? m.files : [];
        const image = m.image ? `<img class="saved-media" src="${esc(m.image)}" alt="Saved image">` : '';
        return `<div class="saved-item"><div class="saved-meta"><b>${esc(m.username || 'Unknown')}</b> · ${esc(new Date(m.created_at || Date.now()).toLocaleString())}</div><div class="saved-text">${esc(m.message || '(attachment)')}</div>${image}${files.map(f => f?.data ? `<img class="saved-media" src="${esc(f.data)}" alt="Saved attachment">` : '').join('')}</div>`;
      }).join('');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addUi, { once: true });
  else addUi();
})();
