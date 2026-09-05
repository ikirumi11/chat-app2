/* FAST P2P CHAT — no local message storage and no chat server persistence. Refresh = empty chat. */
(() => {
  'use strict';

  const PUBLIC_CHANNEL = 'public';
  const PUBLIC_PEER_ID = 'chat2-public';
  const connections = new Map();
  let peer = null;
  let isHost = false;
  let hostPeerId = PUBLIC_PEER_ID;
  let retryTimer = null;
  let migrationTimer = null;
  let migrating = false;

  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function broadcast(packet, exceptPeer = null) {
    for (const [id, conn] of connections) {
      if (id === exceptPeer || !conn.open) continue;
      try { conn.send(packet); } catch {}
    }
  }

  function updateStatus(error = '') {
    const el = document.getElementById('p2pStatus');
    if (!el) return;
    const connected = [...connections.values()].some(c => c.open);
    const state = error || (isHost
      ? 'Host · Public Chat'
      : (connected ? 'Connected' : (peer ? 'Not connected' : 'Loading…')));
    el.innerHTML = `<b>Public Chat</b><span>${escapeHtml(state)} · ${connections.size} peer${connections.size === 1 ? '' : 's'}</span>`;
  }

  function announcePeers() {
    if (!isHost) return;
    const peerIds = [peer?.id, ...connections.keys()]
      .filter(Boolean)
      .filter((id, i, a) => a.indexOf(id) === i);
    broadcast({ type: 'host:peer-list', channel: PUBLIC_CHANNEL, peerIds });
  }

  function connectToPeer(peerId) {
    if (!peer || !peerId || peerId === peer.id || peerId === PUBLIC_PEER_ID) return;
    const old = connections.get(peerId);
    if (old && !old.destroyed) return;
    try { setupConnection(peer.connect(peerId, { reliable: true, serialization: 'json' })); } catch {}
  }

  function setupConnection(conn) {
    if (!conn) return;
    const old = connections.get(conn.peer);
    if (old && old !== conn && !old.destroyed) return;
    connections.set(conn.peer, conn);

    conn.on('open', () => {
      try { conn.send({ type: 'hello', channel: PUBLIC_CHANNEL }); } catch {}
      if (isHost) announcePeers();
      updateStatus();
      window.dispatchEvent(new CustomEvent('chat:p2p-connection', {
        detail: { peer: conn.peer, connection: conn, open: true }
      }));
    });

    conn.on('data', packet => receivePacket(packet, conn.peer));

    const lost = () => {
      if (connections.get(conn.peer) === conn) connections.delete(conn.peer);
      updateStatus();
      window.dispatchEvent(new CustomEvent('chat:p2p-connection', {
        detail: { peer: conn.peer, connection: conn, open: false }
      }));
      if (isHost) announcePeers();
      if (!isHost && conn.peer === PUBLIC_PEER_ID) scheduleMigration('Public host disconnected');
    };

    conn.on('close', lost);
    conn.on('error', lost);
  }

  function connectToPublicHost() {
    if (!peer || isHost || migrating) return;
    if ([...connections.values()].some(c => c.open || !c.destroyed)) return;
    try { setupConnection(peer.connect(hostPeerId, { reliable: true, serialization: 'json' })); } catch {}
  }

  function startRetry(interval = 350) {
    clearInterval(retryTimer);
    retryTimer = setInterval(() => {
      if (isHost || migrating) return;
      if ([...connections.values()].some(c => c.open)) {
        updateStatus();
        return;
      }
      connectToPublicHost();
      updateStatus('Connecting…');
    }, interval);
    connectToPublicHost();
  }

  function becomeGuest() {
    try { if (peer && !peer.destroyed) peer.destroy(); } catch {}
    isHost = false;
    hostPeerId = PUBLIC_PEER_ID;
    migrating = false;
    peer = new Peer({ debug: 0 });
    peer.on('open', () => { updateStatus(); startRetry(); });
    peer.on('connection', setupConnection);
    peer.on('error', error => {
      if (error?.type === 'peer-unavailable') updateStatus('Public Chat host is offline');
      else updateStatus('P2P error');
    });
  }

  function scheduleMigration(reason) {
    if (isHost || migrating) return;
    clearTimeout(migrationTimer);
    migrationTimer = setTimeout(() => migrateHost(reason), 200 + Math.floor(Math.random() * 400));
  }

  function migrateHost(reason) {
    if (isHost || migrating || !peer || peer.destroyed) return;
    const connectedIds = [...connections.values()]
      .filter(c => c.open && c.peer && c.peer !== PUBLIC_PEER_ID)
      .map(c => c.peer);
    const candidates = [...new Set([peer.id, ...connectedIds].filter(Boolean))].sort();
    if (!candidates.length) return;
    const selected = candidates[0];

    if (peer.id === selected) {
      migrating = true;
      clearInterval(retryTimer);
      updateStatus('Becoming host…');
      try { peer.destroy(); } catch {}
      setTimeout(() => {
        try {
          peer = new Peer(PUBLIC_PEER_ID, { debug: 0 });
          peer.on('open', id => {
            isHost = true;
            migrating = false;
            hostPeerId = id;
            updateStatus('Host · Public Chat');
            window.dispatchEvent(new CustomEvent('chat:p2p-host-changed', { detail: { host: true, reason } }));
            announcePeers();
          });
          peer.on('connection', setupConnection);
          peer.on('error', error => {
            migrating = false;
            if (error?.type === 'unavailable-id') becomeGuest();
            else scheduleMigration('Host migration retry');
          });
        } catch { migrating = false; becomeGuest(); }
      }, 250);
    } else {
      updateStatus('Host disconnected · waiting for new host…');
      startRetry(350);
    }
  }

  function receivePacket(packet, fromPeer) {
    if (!packet || packet.channel !== PUBLIC_CHANNEL) return;

    if (typeof packet.type === 'string' && packet.type.startsWith('screen:')) {
      window.dispatchEvent(new CustomEvent('chat:screen-signal', { detail: { packet, fromPeer } }));
      return;
    }

    if (packet.type === 'hello') {
      try { connections.get(fromPeer)?.send({ type: 'hello-ack', channel: PUBLIC_CHANNEL }); } catch {}
      if (isHost) announcePeers();
      return;
    }
    if (packet.type === 'hello-ack') return;
    if (packet.type === 'host:peer-list' && Array.isArray(packet.peerIds)) {
      packet.peerIds.forEach(connectToPeer);
      return;
    }
    if (packet.type === 'host:migrate') {
      scheduleMigration('Host migration requested');
      return;
    }
    if (packet.type === 'message' && packet.message?.id) {
      window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: packet.message }));
      broadcast(packet, fromPeer);
      return;
    }
    if (packet.type === 'delete' && packet.id) {
      window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: packet.id } }));
      broadcast(packet, fromPeer);
      return;
    }
    if (packet.type === 'delete-all') {
      window.dispatchEvent(new CustomEvent('chat:p2p-clear'));
      broadcast(packet, fromPeer);
      return;
    }
    if (packet.type === 'edit' && packet.message) {
      window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: packet.message }));
      broadcast(packet, fromPeer);
      return;
    }
    if (packet.type === 'sheet:election' && packet.selectedPeerId) {
      window.dispatchEvent(new CustomEvent('chat:sheet-election', {
        detail: { selectedPeerId: packet.selectedPeerId, round: packet.round || 0, fromPeer }
      }));
    }
  }

  async function localPost(body) {
    const message = {
      id: body.id || ('p2p-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random())),
      username: String(body.username || '').slice(0, 24),
      channel: PUBLIC_CHANNEL,
      message: String(body.message || '').slice(0, 20000),
      image: body.image || null,
      files: Array.isArray(body.files) ? body.files : [],
      device_id: String(body.device_id || ''),
      edited: false,
      created_at: body.created_at || new Date().toISOString(),
      invisible_to_others: body.invisible_to_others === true,
      game_message: body.game_message === true
    };

    if (!message.username || (!message.message && !message.image && !message.files.length)) {
      return json({ error: 'Message, image, or files are required.' }, 400);
    }

    window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
    if (!message.invisible_to_others) broadcast({ type: 'message', channel: PUBLIC_CHANNEL, message });
    return json({ success: true, message });
  }

  function localDelete(body) {
    if (body.delete_all) {
      window.dispatchEvent(new CustomEvent('chat:p2p-clear'));
      broadcast({ type: 'delete-all', channel: PUBLIC_CHANNEL });
      return json({ success: true });
    }
    if (body.id) {
      window.dispatchEvent(new CustomEvent('chat:p2p-delete', { detail: { id: body.id } }));
      broadcast({ type: 'delete', channel: PUBLIC_CHANNEL, id: body.id });
    }
    return json({ success: true });
  }

  function localPatch(body) {
    if (!body.id) return json({ error: 'Message ID required.' }, 400);
    const message = { ...body, channel: PUBLIC_CHANNEL, edited: true };
    window.dispatchEvent(new CustomEvent('chat:p2p-edit', { detail: message }));
    broadcast({ type: 'edit', channel: PUBLIC_CHANNEL, message });
    return json({ success: true, message });
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
    style.textContent = `.p2p-status{display:flex;align-items:center;gap:8px;font-size:12px;color:#aeb7c3;margin-right:8px}.p2p-status b{color:inherit}.p2p-status span{white-space:nowrap}@media(max-width:700px){.p2p-status span{max-width:150px;overflow:hidden;text-overflow:ellipsis}}`;
    document.head.appendChild(style);
    updateStatus();
  }

  function startPeer() {
    if (!window.Peer) { setTimeout(startPeer, 100); return; }
    peer = new Peer(PUBLIC_PEER_ID, { debug: 0 });
    peer.on('open', id => {
      isHost = true;
      hostPeerId = id;
      clearInterval(retryTimer);
      updateStatus();
      announcePeers();
    });
    peer.on('connection', setupConnection);
    peer.on('error', error => {
      if (error?.type === 'unavailable-id') becomeGuest();
      else updateStatus('Signaling unavailable');
    });
    peer.on('disconnected', () => {
      if (isHost) updateStatus('P2P signaling disconnected');
      else scheduleMigration('Host signaling disconnected');
    });
    peer.on('close', () => { if (!isHost) scheduleMigration('Host connection closed'); });
  }

  // Keep the app's existing /api/messages interface, but make it memory/network-only.
  // Nothing is written to localStorage, IndexedDB, ShareAllFiles, Google Sites, or any chat server.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!url.includes('/api/messages')) return originalFetch(input, init);
    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch {} }
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    if (method === 'GET') return json({ success: true, messages: [] });
    if (method === 'POST') return localPost(body);
    if (method === 'PATCH') return localPatch(body);
    if (method === 'DELETE') return localDelete(body);
    return json({ success: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectUi(); startPeer(); }, { once: true });
  } else {
    injectUi();
    startPeer();
  }
})();