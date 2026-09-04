/* P2P CHAT LAYER — normal chat messages are local + WebRTC only. */
(() => {
  'use strict';
  const DB_NAME = 'chat-app2-local';
  const STORE = 'messages';
  const MAX_LOCAL_MESSAGES = 2000;
  const originalFetch = window.fetch.bind(window);
  const params = new URLSearchParams(location.search);
  const suppliedRoom = params.get('room');
  const savedRoom = localStorage.getItem('chat_p2p_room');
  const room = sanitizeRoom(suppliedRoom || savedRoom || randomRoom());
  localStorage.setItem('chat_p2p_room', room);
  const deletedKey = 'chat-p2p-deleted:' + room;
  const localDeleted = new Set(JSON.parse(localStorage.getItem(deletedKey) || '[]'));
  let dbPromise = null;
  let peer = null;
  let isHost = false;
  let hostPeerId = null;
  const connections = new Map();

  function randomRoom() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
  function sanitizeRoom(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || randomRoom(); }
  function peerIdForRoom(r) { return 'chat2-' + r.toLowerCase(); }
  function jsonResponse(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
  function esc(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('room', 'room', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function putMessage(message) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...message, room, p2p: true });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    trimMessages().catch(() => {});
  }

  async function deleteMessage(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getMessages() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.filter(m => m.room === room && !localDeleted.has(m.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      req.onerror = () => reject(req.error);
    });
  }

  async function trimMessages() {
    const all = await getMessages();
    if (all.length <= MAX_LOCAL_MESSAGES) return;
    for (const m of all.slice(0, all.length - MAX_LOCAL_MESSAGES)) await deleteMessage(m.id);
  }

  function saveDeleted() { localStorage.setItem(deletedKey, JSON.stringify([...localDeleted].slice(-5000))); }
  function broadcast(packet, exceptPeer = null) {
    for (const [id, conn] of connections) {
      if (id === exceptPeer || !conn.open) continue;
      try { conn.send(packet); } catch {}
    }
  }

  async function receiveMessage(message, exceptPeer = null) {
    if (!message || !message.id || localDeleted.has(message.id)) return;
    await putMessage(message);
    broadcast({ type: 'message', room, message }, exceptPeer);
    window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
  }

  async function receivePacket(packet, fromPeer) {
    if (!packet || packet.room !== room) return;
    if (packet.type === 'hello') {
      try { connections.get(fromPeer)?.send({ type: 'hello-ack', room }); } catch {}
      return;
    }
    if (packet.type === 'message') return receiveMessage(packet.message, fromPeer);
    if (packet.type === 'delete' && packet.id) {
      localDeleted.add(packet.id); saveDeleted(); await deleteMessage(packet.id);
      window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: packet.id } }));
      return;
    }
    if (packet.type === 'delete-all') {
      const all = await getMessages();
      for (const m of all) { localDeleted.add(m.id); await deleteMessage(m.id); }
      saveDeleted();
      window.dispatchEvent(new CustomEvent('chat:p2p-clear'));
      return;
    }
    if (packet.type === 'edit' && packet.message) {
      await putMessage(packet.message);
      window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: packet.message }));
    }
  }

  function setupConnection(conn) {
    if (!conn) return;
    connections.set(conn.peer, conn);
    conn.on('open', () => {
      try { conn.send({ type: 'hello', room }); } catch {}
      updateStatus();
    });
    conn.on('data', packet => receivePacket(packet, conn.peer).catch(console.error));
    conn.on('close', () => { connections.delete(conn.peer); updateStatus(); });
    conn.on('error', () => { connections.delete(conn.peer); updateStatus(); });
  }

  function connectToHost() {
    if (!peer || isHost || !hostPeerId) return;
    const conn = peer.connect(hostPeerId, { reliable: true, serialization: 'json' });
    setupConnection(conn);
  }

  function startAsGuest(hostId) {
    try { if (peer && !peer.destroyed) peer.destroy(); } catch {}
    isHost = false;
    hostPeerId = hostId;
    peer = new Peer({ debug: 0 });
    peer.on('open', () => { updateStatus(); connectToHost(); });
    peer.on('connection', setupConnection);
    peer.on('error', error => updateStatus(error?.type === 'peer-unavailable' ? 'Lobby host is offline' : 'P2P error'));
  }

  function startPeer() {
    if (!window.Peer) { setTimeout(startPeer, 100); return; }
    const wantedId = peerIdForRoom(room);
    peer = new Peer(wantedId, { debug: 0 });
    peer.on('open', id => {
      isHost = true;
      hostPeerId = id;
      updateStatus();
    });
    peer.on('connection', setupConnection);
    peer.on('error', error => {
      if (error?.type === 'unavailable-id') startAsGuest(wantedId);
      else updateStatus('Signaling unavailable');
    });
  }

  function shareUrl() { return location.origin + location.pathname + '?room=' + encodeURIComponent(room); }

  function updateStatus(error = '') {
    const el = document.getElementById('p2pStatus');
    if (!el) return;
    el.innerHTML = `<b>P2P Lobby</b><span>Room: <code>${esc(room)}</code></span><span>${esc(error || (isHost ? 'Hosting' : 'Connected'))} · ${connections.size} peer${connections.size === 1 ? '' : 's'}</span><button id="p2pCopy">Copy lobby link</button>`;
    const copy = document.getElementById('p2pCopy');
    if (copy) copy.onclick = async () => {
      try { await navigator.clipboard.writeText(shareUrl()); copy.textContent = 'Copied!'; }
      catch { prompt('Copy lobby link:', shareUrl()); }
      setTimeout(() => { if (copy) copy.textContent = 'Copy lobby link'; }, 1200);
    };
  }

  function injectUi() {
    const header = document.querySelector('.header');
    if (!header || document.getElementById('p2pStatus')) return;
    const actions = header.querySelector('.header-actions');
    const box = document.createElement('div');
    box.id = 'p2pStatus';
    box.className = 'p2p-status';
    if (actions) actions.prepend(box); else header.appendChild(box);
    const style = document.createElement('style');
    style.textContent = `.p2p-status{display:flex;align-items:center;gap:8px;font-size:12px;color:#aeb7c3;margin-right:8px}.p2p-status code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:6px}.p2p-status button{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;border-radius:7px;padding:5px 8px;cursor:pointer}@media(max-width:700px){.p2p-status span:nth-child(2){display:none}.p2p-status{max-width:145px;overflow:hidden}.p2p-status button{font-size:11px}}`;
    document.head.appendChild(style);
    updateStatus();
  }

  async function localPost(body) {
    const message = {
      id: body.id || ('p2p-' + crypto.randomUUID()),
      username: String(body.username || '').slice(0, 24),
      channel: room,
      message: String(body.message || '').slice(0, 20000),
      image: body.image || null,
      files: Array.isArray(body.files) ? body.files : [],
      device_id: String(body.device_id || localStorage.getItem('chat_device_id') || ''),
      edited: false,
      created_at: body.created_at || new Date().toISOString()
    };
    if (!message.username || (!message.message && !message.image && !message.files.length)) return jsonResponse({ error: 'Message, image, or files are required.' }, 400);
    await putMessage(message);
    broadcast({ type: 'message', room, message });
    window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
    return jsonResponse({ success: true, message });
  }

  async function localDelete(body) {
    if (body.delete_all) {
      const all = await getMessages();
      for (const m of all) { localDeleted.add(m.id); await deleteMessage(m.id); }
      saveDeleted();
      broadcast({ type: 'delete-all', room });
      window.dispatchEvent(new CustomEvent('chat:p2p-clear'));
      return jsonResponse({ success: true });
    }
    if (!body.id) return jsonResponse({ success: true });
    localDeleted.add(body.id); saveDeleted(); await deleteMessage(body.id);
    broadcast({ type: 'delete', room, id: body.id });
    window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: body.id } }));
    return jsonResponse({ success: true });
  }

  async function localPatch(body) {
    if (!body.id) return jsonResponse({ error: 'Message ID required.' }, 400);
    const all = await getMessages();
    const old = all.find(m => m.id === body.id);
    if (!old) return jsonResponse({ error: 'Message not found.' }, 404);
    const updated = { ...old, message: body.message !== undefined ? String(body.message).slice(0, 20000) : old.message, image: body.image !== undefined ? body.image : old.image, files: body.files !== undefined ? body.files : old.files, edited: true };
    await putMessage(updated);
    broadcast({ type: 'edit', room, message: updated });
    window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: updated }));
    return jsonResponse({ success: true, message: updated });
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = (init.method || input?.method || 'GET').toUpperCase();
    if (!url.includes('/api/messages')) return originalFetch(input, init);
    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch {} }

    if (method === 'GET') {
      const u = new URL(url, location.href);
      u.searchParams.set('channel', room);
      let gameMessages = [];
      try {
        const serverResponse = await originalFetch(u.toString(), init);
        const data = await serverResponse.clone().json();
        gameMessages = (data.messages || []).filter(m => m.username === '__GAME_SERVER__');
      } catch {}
      const localMessages = await getMessages();
      return jsonResponse({ success: true, messages: [...gameMessages, ...localMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) });
    }

    if (body.game_server === true) {
      body.channel = room;
      return originalFetch(input, { ...init, body: JSON.stringify(body) });
    }
    if (method === 'POST') return localPost(body);
    if (method === 'DELETE') return localDelete(body);
    if (method === 'PATCH') return localPatch(body);
    return originalFetch(input, init);
  };

  window.__chatP2P = { room, getShareUrl: shareUrl, connections };

  document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('chat_device_id')) localStorage.setItem('chat_device_id', crypto.randomUUID());
    injectUi();
    startPeer();
  });
})();
