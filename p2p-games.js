/* WebRTC P2P game transport
   Server is used only for lobby discovery/signaling. Once peers connect,
   game-state updates travel directly between browsers. */
(() => {
  'use strict';

  const GAME_PREFIX = '__CHAT_GAME_STATE__:';
  const SIGNAL_PREFIX = '__CHAT_P2P_SIGNAL__:';
  const API_URL = '/api/messages';
  const CHANNEL = 'general';
  const DEVICE_KEY = 'chat_device_id';
  const POLL_MS = 900;

  const myId = localStorage.getItem(DEVICE_KEY) || '';
  const peerGames = new Map();
  const p2pStates = new Map();
  const seenSignals = new Set();
  const sentOffers = new Set();
  let lastServerMessages = [];

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ]
  };

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
  }

  function parseMessageState(message) {
    if (!message || typeof message.message !== 'string') return null;
    if (!message.message.startsWith(GAME_PREFIX)) return null;
    try { return JSON.parse(message.message.slice(GAME_PREFIX.length)); } catch (_) { return null; }
  }

  async function sendSignal(signal) {
    if (!myId || !signal?.to) return;
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '__P2P_SIGNAL__',
          channel: CHANNEL,
          message: SIGNAL_PREFIX + JSON.stringify({ ...signal, from: myId, createdAt: Date.now() }),
          device_id: myId
        })
      });
    } catch (error) {
      console.warn('P2P signaling failed:', error);
    }
  }

  function gamePeers(gameId) {
    if (!peerGames.has(gameId)) peerGames.set(gameId, new Map());
    return peerGames.get(gameId);
  }

  function closePeer(gameId, peerId) {
    const peers = peerGames.get(gameId);
    const pc = peers?.get(peerId);
    if (pc) {
      try { pc.onicecandidate = null; pc.ondatachannel = null; pc.onconnectionstatechange = null; pc.close(); } catch (_) {}
      peers.delete(peerId);
    }
  }

  function attachDataChannel(gameId, peerId, channel) {
    setChannelReference(gameId, peerId, channel);
    channel.onopen = () => {
      channel.__p2pOpen = true;
      const state = p2pStates.get(gameId);
      if (state) {
        try { channel.send(JSON.stringify({ kind: 'state', game: state })); } catch (_) {}
      }
    };

    channel.onclose = () => { channel.__p2pOpen = false; };
    channel.onerror = () => {};

    channel.onmessage = event => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.kind === 'state' && packet.game?.id) {
          const state = clone(packet.game);
          p2pStates.set(state.id, state);
          refreshGameUI();
          broadcastStateToPeers(state.id, state, peerId);
        }
        if (packet.kind === 'state-request') {
          const state = p2pStates.get(gameId);
          if (state && channel.readyState === 'open') {
            channel.send(JSON.stringify({ kind: 'state', game: state }));
          }
        }
      } catch (_) {}
    };
  }

  function makePeer(game, peerId, initiator) {
    if (!game?.id || !peerId || peerId === myId) return null;
    const peers = gamePeers(game.id);
    const existing = peers.get(peerId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') return existing;

    closePeer(game.id, peerId);
    const pc = new RTCPeerConnection(rtcConfig);
    peers.set(peerId, pc);

    pc.onicecandidate = event => {
      if (event.candidate) {
        sendSignal({ kind: 'ice', gameId: game.id, to: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        setTimeout(() => {
          if (pc.connectionState !== 'connected') closePeer(game.id, peerId);
        }, 3000);
      }
    };

    if (initiator) {
      const channel = pc.createDataChannel('game-state', { ordered: true });
      attachDataChannel(game.id, peerId, channel);
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => sendSignal({ kind: 'offer', gameId: game.id, to: peerId, description: pc.localDescription }))
        .catch(error => console.warn('P2P offer failed:', error));
    } else {
      pc.ondatachannel = event => attachDataChannel(game.id, peerId, event.channel);
    }

    return pc;
  }

  async function handleSignal(signal) {
    if (!signal || signal.to !== myId || !signal.from || !signal.gameId) return;
    const key = `${signal.gameId}:${signal.from}:${signal.kind}:${signal.createdAt || ''}`;
    if (seenSignals.has(key)) return;
    seenSignals.add(key);

    const game = findServerGame(signal.gameId);
    if (!game) return;

    if (signal.kind === 'offer') {
      const pc = makePeer(game, signal.from, false);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(signal.description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ kind: 'answer', gameId: game.id, to: signal.from, description: pc.localDescription });
      } catch (error) {
        console.warn('P2P answer failed:', error);
      }
    } else if (signal.kind === 'answer') {
      const pc = gamePeers(game.id).get(signal.from);
      if (!pc) return;
      try { await pc.setRemoteDescription(signal.description); }
      catch (error) { console.warn('P2P remote answer failed:', error); }
    } else if (signal.kind === 'ice') {
      const pc = gamePeers(game.id).get(signal.from);
      if (!pc) return;
      try { await pc.addIceCandidate(signal.candidate); } catch (_) {}
    }
  }

  function findServerGame(gameId) {
    for (const message of lastServerMessages) {
      const state = parseMessageState(message);
      if (state?.id === gameId) return state;
    }
    return null;
  }

  function ensureConnections(game) {
    if (!game?.id || !Array.isArray(game.players) || !myId) return;
    if (game.hostDeviceId === myId) {
      for (const player of game.players) {
        const peerId = player?.deviceId;
        if (!peerId || peerId === myId) continue;
        const key = `${game.id}:${peerId}`;
        const peers = gamePeers(game.id);
        if (!peers.get(peerId) && !sentOffers.has(key)) {
          sentOffers.add(key);
          makePeer(game, peerId, true);
        }
      }
    }
  }

  function broadcastStateToPeers(gameId, game, exceptPeerId) {
    const peers = peerGames(gameId);
    for (const [peerId, pc] of peers) {
      if (peerId === exceptPeerId) continue;
      const channel = pc.__gameChannel;
      if (channel?.readyState === 'open') {
        try { channel.send(JSON.stringify({ kind: 'state', game })); } catch (_) {}
      }
    }
  }

  function setChannelReference(gameId, peerId, channel) {
    const pc = gamePeers(gameId).get(peerId);
    if (pc) pc.__gameChannel = channel;
  }

  function refreshGameUI() {
    try { if (typeof window.renderMessages === 'function') window.renderMessages(false); } catch (_) {}
  }

  async function poll() {
    try {
      const response = await fetch(API_URL + '?channel=' + encodeURIComponent(CHANNEL) + '&_=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const messages = Array.isArray(data.messages) ? data.messages : [];
      lastServerMessages = messages;

      for (const message of messages) {
        if (typeof message.message === 'string' && message.message.startsWith(SIGNAL_PREFIX)) {
          try { await handleSignal(JSON.parse(message.message.slice(SIGNAL_PREFIX.length))); } catch (_) {}
        }
      }

      for (const message of messages) {
        const game = parseMessageState(message);
        if (!game || !game.id || game.status === 'finished' || game.status === 'forcequit') continue;
        ensureConnections(game);
        if (!p2pStates.has(game.id)) p2pStates.set(game.id, clone(game));
      }
    } catch (_) {}
  }

  function broadcast(game) {
    if (!game?.id) return false;
    const peers = peerGames(game.id);
    let sent = 0;
    const state = clone(game);
    p2pStates.set(game.id, state);

    for (const pc of peers.values()) {
      const channel = pc.__gameChannel;
      if (channel?.readyState === 'open') {
        try { channel.send(JSON.stringify({ kind: 'state', game: state })); sent++; } catch (_) {}
      }
    }

    refreshGameUI();
    return sent > 0;
  }

  function isReady(gameId) {
    for (const pc of peerGames(gameId).values()) {
      if (pc.__gameChannel?.readyState === 'open') return true;
    }
    return false;
  }

  function installHooks() {
    const originalWrite = window.writeGameState;
    if (typeof originalWrite === 'function' && !originalWrite.__p2pWrapped) {
      const wrapped = async function(game) {
        if (game?.id && isReady(game.id)) {
          broadcast(game);
          return true;
        }
        return originalWrite.apply(this, arguments);
      };
      wrapped.__p2pWrapped = true;
      window.writeGameState = wrapped;
    }

    const originalCreate = window.createGameElement;
    if (typeof originalCreate === 'function' && !originalCreate.__p2pWrapped) {
      const wrappedCreate = function(game) {
        const state = game?.id ? p2pStates.get(game.id) : null;
        return originalCreate(state || game);
      };
      wrappedCreate.__p2pWrapped = true;
      window.createGameElement = wrappedCreate;
    }

    const originalEquivalent = window.gameDataEquivalent;
    if (typeof originalEquivalent === 'function' && !originalEquivalent.__p2pWrapped) {
      const wrappedEquivalent = function(a, b) {
        if (a?.id && p2pStates.has(a.id)) return false;
        return originalEquivalent.apply(this, arguments);
      };
      wrappedEquivalent.__p2pWrapped = true;
      window.gameDataEquivalent = wrappedEquivalent;
    }
  }

  const nativeCreate = RTCPeerConnection.prototype.createDataChannel;
  if (nativeCreate && !RTCPeerConnection.prototype.__chatP2PPatched) {
    RTCPeerConnection.prototype.createDataChannel = function(label, options) {
      const channel = nativeCreate.call(this, label, options);
      if (label === 'game-state') this.__gameChannel = channel;
      return channel;
    };
    Object.defineProperty(RTCPeerConnection.prototype, '__chatP2PPatched', { value: true });
  }

  function boot() {
    installHooks();
    poll();
    setInterval(() => { installHooks(); poll(); }, POLL_MS);
  }

  if (window.RTCPeerConnection) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  window.chatP2PGames = { broadcast, isReady, states: p2pStates };
})();
