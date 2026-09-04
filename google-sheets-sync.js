/* GOOGLE SHEETS CHAT BACKUP
   Every 3 seconds the P2P host randomly elects one connected user.
   Only that elected browser uploads the shared local message set to Google Sheets.
   Local IndexedDB remains the fast source of truth for the UI.
*/
(() => {
  'use strict';

  const API = '/api/google-sheets';
  const INTERVAL = 3000;
  const state = { lastRound: 0, busy: false, started: false };
  let timer = null;

  function p2p() { return window.__chatP2P; }
  function selfId() { return p2p()?.getSelfPeerId?.() || localStorage.getItem('chat_device_id') || ''; }
  function setStatus(text, ok = true) {
    let el = document.getElementById('googleSheetsStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'googleSheetsStatus';
      el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;padding:8px 11px;border-radius:10px;background:rgba(20,24,30,.94);border:1px solid rgba(255,255,255,.1);font:12px system-ui;color:#b8c0cb;box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .25s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = (ok ? '☁️ ' : '⚠️ ') + text;
    el.style.opacity = '1';
    clearTimeout(el.__hide);
    el.__hide = setTimeout(() => { el.style.opacity = '.55'; }, 5000);
  }

  async function pullAndMerge() {
    try {
      const response = await fetch(`${API}?channel=public`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      const local = p2p();
      if (!local?.putMessage) return;
      let added = 0;
      for (const message of (data.messages || [])) {
        if (!message?.id) continue;
        await local.putMessage({ ...message, channel: 'public', room: 'public' });
        added++;
      }
      window.dispatchEvent(new CustomEvent('chat:google-sheets-pulled', { detail: { count: added } }));
      setStatus(`Google Sheets loaded ${added} saved message${added === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(`Google Sheets load failed: ${error.message}`, false);
    }
  }

  async function uploadAll() {
    if (state.busy) return;
    const local = p2p();
    if (!local?.getMessages) return;
    state.busy = true;
    try {
      const messages = await local.getMessages();
      const safeMessages = messages.filter(m => m && m.id && m.username && !m.invisible_to_others);
      if (!safeMessages.length) {
        setStatus('Google Sheets: nothing to save.');
        return;
      }
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: safeMessages })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      setStatus(`Saved ${data.saved || 0} new message${data.saved === 1 ? '' : 's'} to Google Sheets.`);
      window.dispatchEvent(new CustomEvent('chat:google-sheets-saved', { detail: data }));
    } catch (error) {
      setStatus(`Google Sheets save failed: ${error.message}`, false);
    } finally {
      state.busy = false;
    }
  }

  function electRandomUser() {
    const api = p2p();
    if (!api) return;

    // The public host is the election coordinator. This prevents every browser
    // from uploading the same messages at the same time.
    if (!api.isHost?.()) return;

    const users = [selfId(), ...(api.getConnectedPeerIds?.() || [])].filter(Boolean);
    if (!users.length) return;

    const selectedPeerId = users[Math.floor(Math.random() * users.length)];
    const round = Date.now();
    state.lastRound = round;

    window.dispatchEvent(new CustomEvent('chat:sheet-election', { detail: { selectedPeerId, round, fromPeer: selfId() } }));
    api.sendPacket?.({ type: 'sheet:election', selectedPeerId, round });
  }

  function onElection(event) {
    const detail = event.detail || {};
    if (!detail.round || detail.round <= state.lastRound) return;
    state.lastRound = detail.round;
    if (detail.selectedPeerId === selfId()) uploadAll();
  }

  function start() {
    if (state.started) return;
    state.started = true;
    window.addEventListener('chat:sheet-election', onElection);

    // Pull once immediately so refreshes recover messages from the Sheet.
    setTimeout(pullAndMerge, 1200);

    // Election every 3 seconds. A newly elected user writes the whole local
    // set; the API deduplicates by message_id, so repeated elections are safe.
    timer = setInterval(electRandomUser, INTERVAL);
    setTimeout(electRandomUser, 1800);

    window.addEventListener('chat:p2p-connection', () => {
      // If the host has just gained a peer, the next 3-second election will include it.
      setTimeout(electRandomUser, 250);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
