/* P2P CHAT LAYER — one shared Public Chat, normal messages are local + WebRTC only. */
(() => {
  'use strict';
  const DB_NAME = 'chat-app2-local';
  const STORE = 'messages';
  const FALLBACK_KEY = 'chat-app2-local-message-journal-v2';
  const MAX_LOCAL_MESSAGES = 2000;
  const MAX_FALLBACK_MESSAGES = 300;
  const PUBLIC_CHANNEL = 'public';
  const PUBLIC_PEER_ID = 'chat2-public';
  const GAME_PREFIX = '__CHAT_GAME_STATE__:';
  const originalFetch = window.fetch.bind(window);
  const connections = new Map();
  const localDeleted = new Set(JSON.parse(localStorage.getItem('chat-p2p-deleted:public') || '[]'));
  let dbPromise = null;
  let peer = null;
  let isHost = false;
  let hostPeerId = PUBLIC_PEER_ID;

  function jsonResponse(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
  function reportLocalSave(ok, error = null, message = null) {
    window.dispatchEvent(new CustomEvent('chat:local-save-status', { detail: { ok, error, message } }));
  }
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, 2); } catch (error) { reject(error); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('room', 'room', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDB could not be opened.'));
      req.onblocked = () => reject(new Error('IndexedDB is blocked by another page.'));
    });
    return dbPromise;
  }
  function readFallback() {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function writeFallback(messages) {
    try {
      const clean = messages.filter(m => m && m.id && !localDeleted.has(m.id)).slice(-MAX_FALLBACK_MESSAGES);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(clean));
      return true;
    } catch { return false; }
  }
  function fallbackPut(message) {
    const list = readFallback();
    const index = list.findIndex(m => m.id === message.id);
    if (index >= 0) list[index] = message;
    else list.push(message);
    return writeFallback(list);
  }
  async function putMessage(message) {
    const value = { ...message, room: PUBLIC_CHANNEL, channel: PUBLIC_CHANNEL, p2p: true };
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed.'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
      });
      trimMessages().catch(() => {});
      reportLocalSave(true, null, value);
      return true;
    } catch (error) {
      const fallbackOk = fallbackPut(value);
      reportLocalSave(fallbackOk, fallbackOk ? null : error, value);
      if (!fallbackOk) throw error;
      return true;
    }
  }
  async function deleteMessage(id) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed.'));
      });
    } catch {}
    const list = readFallback().filter(m => m.id !== id);
    writeFallback(list);
  }
  async function getMessages() {
    let indexed = [];
    try {
      const db = await openDb();
      indexed = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error('IndexedDB read failed.'));
      });
    } catch {}

    const fallback = readFallback();
    const merged = new Map();
    for (const m of [...fallback, ...indexed]) {
      if (m?.id && !localDeleted.has(m.id)) merged.set(m.id, m);
    }
    return [...merged.values()]
      .filter(m => m.room === PUBLIC_CHANNEL || m.channel === PUBLIC_CHANNEL)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  async function trimMessages() {
    const all = await getMessages();
    if (all.length <= MAX_LOCAL_MESSAGES) return;
    for (const m of all.slice(0, all.length - MAX_LOCAL_MESSAGES)) await deleteMessage(m.id);
  }
  function saveDeleted() { localStorage.setItem('chat-p2p-deleted:public', JSON.stringify([...localDeleted].slice(-5000))); }
  function broadcast(packet, exceptPeer = null) {
    for (const [id, conn] of connections) {
      if (id === exceptPeer || !conn.open) continue;
      try { conn.send(packet); } catch {}
    }
  }
  async function receiveMessage(message, exceptPeer = null) {
    if (!message || !message.id || localDeleted.has(message.id)) return;
    await putMessage(message);
    broadcast({ type: 'message', channel: PUBLIC_CHANNEL, message }, exceptPeer);
    window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
  }
  async function receivePacket(packet, fromPeer) {
    if (!packet || packet.channel !== PUBLIC_CHANNEL) return;
    if (typeof packet.type === 'string' && packet.type.startsWith('screen:')) {
      window.dispatchEvent(new CustomEvent('chat:screen-signal', { detail: { packet, fromPeer } }));
      return;
    }
    if (packet.type === 'hello') {
      try { connections.get(fromPeer)?.send({ type: 'hello-ack', channel: PUBLIC_CHANNEL }); } catch {}
      return;
    }
    if (packet.type === 'message') return receiveMessage(packet.message, fromPeer);
    if (packet.type === 'delete' && packet.id) {
      localDeleted.add(packet.id); saveDeleted(); await deleteMessage(packet.id);
      window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: packet.id } }));
      return;
    }
    if (packet.type === 'edit' && packet.message) {
      await putMessage(packet.message);
      window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: packet.message }));
    }
    if (packet.type === 'sheet:election' && packet.selectedPeerId) {
      window.dispatchEvent(new CustomEvent('chat:sheet-election', { detail: { selectedPeerId: packet.selectedPeerId, round: packet.round || 0, fromPeer } }));
      return;
    }
  }
  function setupConnection(conn) {
    if (!conn) return;
    connections.set(conn.peer, conn);
    conn.on('open', () => {
      try { conn.send({ type: 'hello', channel: PUBLIC_CHANNEL }); } catch {}
      updateStatus();
      window.dispatchEvent(new CustomEvent('chat:p2p-connection', { detail: { peer: conn.peer, connection: conn, open: true } }));
    });
    conn.on('data', packet => receivePacket(packet, conn.peer).catch(console.error));
    conn.on('close', () => { connections.delete(conn.peer); updateStatus(); window.dispatchEvent(new CustomEvent('chat:p2p-connection', { detail: { peer: conn.peer, connection: conn, open: false } })); });
    conn.on('error', () => { connections.delete(conn.peer); updateStatus(); window.dispatchEvent(new CustomEvent('chat:p2p-connection', { detail: { peer: conn.peer, connection: conn, open: false, error: true } })); });
  }
  function connectToPublicHost() {
    if (!peer || isHost || !hostPeerId) return;
    const conn = peer.connect(hostPeerId, { reliable: true, serialization: 'json' });
    setupConnection(conn);
  }
  function startAsGuest() {
    try { if (peer && !peer.destroyed) peer.destroy(); } catch {}
    isHost = false;
    hostPeerId = PUBLIC_PEER_ID;
    peer = new Peer({ debug: 0 });
    peer.on('open', () => { updateStatus(); connectToPublicHost(); });
    peer.on('connection', setupConnection);
    peer.on('error', error => updateStatus(error?.type === 'peer-unavailable' ? 'Public Chat host is offline' : 'P2P error'));
  }
  function startPeer() {
    if (!window.Peer) { setTimeout(startPeer, 100); return; }
    peer = new Peer(PUBLIC_PEER_ID, { debug: 0 });
    peer.on('open', id => { isHost = true; hostPeerId = id; updateStatus(); });
    peer.on('connection', setupConnection);
    peer.on('error', error => { if (error?.type === 'unavailable-id') startAsGuest(); else updateStatus('Signaling unavailable'); });
  }
  function updateStatus(error = '') {
    const el = document.getElementById('p2pStatus');
    if (!el) return;
    const hasOpenPeer = [...connections.values()].some(conn => conn.open);
    const state = error || (hasOpenPeer ? 'Connected' : (peer ? 'Not connected' : 'Loading…'));
    el.innerHTML = `<b>Public Chat</b><span>${escapeHtml(state)} · ${connections.size} peer${connections.size === 1 ? '' : 's'}</span>`;
  }
  function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function injectUi() {
    const header = document.querySelector('.header');
    if (!header || document.getElementById('p2pStatus')) return;
    const actions = header.querySelector('.header-actions');
    const box = document.createElement('div');
    box.id = 'p2pStatus'; box.className = 'p2p-status';
    if (actions) actions.prepend(box); else header.appendChild(box);
    const style = document.createElement('style');
    style.textContent = `.p2p-status{display:flex;align-items:center;gap:8px;font-size:12px;color:#aeb7c3;margin-right:8px}.p2p-status b{color:inherit}.p2p-status span{white-space:nowrap}@media(max-width:700px){.p2p-status span{max-width:150px;overflow:hidden;text-overflow:ellipsis}}`;
    document.head.appendChild(style); updateStatus();
  }
  async function localPost(body) {
    const message = { id: body.id || ('p2p-' + crypto.randomUUID()), username: String(body.username || '').slice(0, 24), channel: PUBLIC_CHANNEL, message: String(body.message || '').slice(0, 20000), image: body.image || null, files: Array.isArray(body.files) ? body.files : [], device_id: String(body.device_id || localStorage.getItem('chat_device_id') || ''), edited: false, created_at: body.created_at || new Date().toISOString(), invisible_to_others: body.invisible_to_others === true, game_message: body.game_message === true };
    if (!message.username || (!message.message && !message.image && !message.files.length)) return jsonResponse({ error: 'Message, image, or files are required.' }, 400);
    try {
      await putMessage(message);
    } catch (error) {
      const code = 'LOCAL-' + Math.random().toString(36).slice(2, 9).toUpperCase();
      reportLocalSave(false, { code, name: error?.name, message: error?.message }, message);
      return jsonResponse({ error: `Could not save message locally. Error code: ${code}` }, 500);
    }
    if (!message.invisible_to_others) broadcast({ type: 'message', channel: PUBLIC_CHANNEL, message });
    window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
    return jsonResponse({ success: true, message });
  }
  async function localDelete(body) {
    if (body.delete_all) { const all = await getMessages(); for (const m of all) { localDeleted.add(m.id); await deleteMessage(m.id); } saveDeleted(); window.dispatchEvent(new CustomEvent('chat:p2p-clear')); return jsonResponse({ success: true }); }
    if (!body.id) return jsonResponse({ success: true });
    localDeleted.add(body.id); saveDeleted(); await deleteMessage(body.id); broadcast({ type: 'delete', channel: PUBLIC_CHANNEL, id: body.id }); window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: body.id } })); return jsonResponse({ success: true });
  }
  async function localPatch(body) {
    if (!body.id) return jsonResponse({ error: 'Message ID required.' }, 400);
    const all = await getMessages(); const old = all.find(m => m.id === body.id);
    if (!old) return jsonResponse({ error: 'Message not found.' }, 404);
    const updated = { ...old, channel: PUBLIC_CHANNEL, room: PUBLIC_CHANNEL, message: body.message !== undefined ? String(body.message).slice(0, 20000) : old.message, image: body.image !== undefined ? body.image : old.image, files: body.files !== undefined ? body.files : old.files, edited: true };
    await putMessage(updated); broadcast({ type: 'edit', channel: PUBLIC_CHANNEL, message: updated }); window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: updated })); return jsonResponse({ success: true, message: updated });
  }
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = (init.method || input?.method || 'GET').toUpperCase();
    if (!url.includes('/api/messages')) return originalFetch(input, init);
    let body = {}; if (init.body) { try { body = JSON.parse(init.body); } catch {} }
    if (method === 'GET') {
      const u = new URL(url, location.href); u.searchParams.set('channel', PUBLIC_CHANNEL); let gameMessages = [];
      try { const serverResponse = await originalFetch(u.toString(), init); const data = await serverResponse.clone().json(); gameMessages = (data.messages || []).filter(m => m.username === '__GAME_SERVER__' || m.game_state === true || (typeof m.message === 'string' && m.message.startsWith(GAME_PREFIX))); } catch {}
      const localMessages = await getMessages(); return jsonResponse({ success: true, messages: [...gameMessages, ...localMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) });
    }
    if (body.game_server === true) { body.channel = PUBLIC_CHANNEL; return originalFetch(input, { ...init, body: JSON.stringify(body) }); }
    if (method === 'POST') return localPost(body);
    if (method === 'DELETE') return localDelete(body);
    if (method === 'PATCH') return localPatch(body);
    return originalFetch(input, init);
  };
  window.__chatP2P = {
    channel: PUBLIC_CHANNEL,
    peerId: PUBLIC_PEER_ID,
    connections,
    getMessages,
    putMessage,
    deleteMessage,
    broadcast,
    getSelfPeerId: () => peer?.id || '',
    getConnectedPeerIds: () => [...connections.entries()].filter(([, conn]) => conn.open).map(([id]) => id),
    isHost: () => isHost,
    sendPacket: (packet, peerId = null) => {
      const p = { ...packet, channel: PUBLIC_CHANNEL };
      if (peerId) { const conn = connections.get(peerId); if (conn?.open) { try { conn.send(p); return true; } catch {} } return false; }
      broadcast(p); return true;
    }
  };
  document.addEventListener('DOMContentLoaded', () => { if (!localStorage.getItem('chat_device_id')) localStorage.setItem('chat_device_id', crypto.randomUUID()); localStorage.removeItem('chat_p2p_room'); injectUi(); startPeer(); });
})();
