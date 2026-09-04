/* GOOGLE SHEETS CHAT PERSISTENCE
   Local IndexedDB stays the fast source of truth.
   New P2P messages are uploaded immediately, while periodic retries make
   messages survive temporary network/API failures. On startup the Sheet is
   pulled and merged back into local IndexedDB.
*/
(() => {
  'use strict';

  const API = '/api/google-sheets';
  const CHANNEL = 'public';
  const RETRY_INTERVAL = 5000;
  const state = { busy: false, started: false };

  function p2p() { return window.__chatP2P; }

  function setStatus(text, ok = true) {
    let el = document.getElementById('googleSheetsStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'googleSheetsStatus';
      el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99999;padding:8px 11px;border-radius:10px;background:rgba(20,24,30,.94);border:1px solid rgba(255,255,255,.1);font:12px system-ui;color:#b8c0cb;box-shadow:0 8px 30px rgba(0,0,0,.25);transition:opacity .25s;pointer-events:none;max-width:calc(100vw - 28px);';
      document.body.appendChild(el);
    }
    el.textContent = (ok ? '☁️ ' : '⚠️ ') + text;
    el.style.opacity = '1';
    clearTimeout(el.__hide);
    el.__hide = setTimeout(() => { el.style.opacity = '.55'; }, 5000);
  }

  async function pullAndMerge() {
    try {
      const response = await fetch(`${API}?channel=${encodeURIComponent(CHANNEL)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);

      const local = p2p();
      if (!local?.putMessage) return;

      let merged = 0;
      for (const message of (data.messages || [])) {
        if (!message?.id) continue;
        const existing = await local.getMessages();
        if (existing.some(m => m.id === message.id)) continue;
        await local.putMessage({ ...message, channel: CHANNEL, room: CHANNEL, p2p: true, fromGoogleSheets: true });
        merged++;
        window.dispatchEvent(new CustomEvent('chat:p2p-message', { detail: message }));
      }

      window.dispatchEvent(new CustomEvent('chat:google-sheets-pulled', { detail: { count: merged } }));
      setStatus(`Google Sheets loaded ${merged} new saved message${merged === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(`Google Sheets load failed: ${error.message}`, false);
    }
  }

  async function uploadMessages(messages) {
    if (!Array.isArray(messages) || !messages.length) return;
    const safe = messages.filter(m => m && m.id && m.username && !m.invisible_to_others && !m.fromGoogleSheets);
    if (!safe.length) return;

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: safe })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.saved > 0) setStatus(`Saved ${data.saved} new message${data.saved === 1 ? '' : 's'} to Google Sheets.`);
      window.dispatchEvent(new CustomEvent('chat:google-sheets-saved', { detail: data }));
    } catch (error) {
      setStatus(`Google Sheets save failed: ${error.message}`, false);
    }
  }

  async function retryLocalMessages() {
    if (state.busy) return;
    const local = p2p();
    if (!local?.getMessages) return;
    state.busy = true;
    try {
      const messages = await local.getMessages();
      await uploadMessages(messages);
    } finally {
      state.busy = false;
    }
  }

  function start() {
    if (state.started) return;
    state.started = true;

    // Recover messages from Google Sheets after every page refresh.
    setTimeout(pullAndMerge, 400);

    // Save every newly created or received P2P message immediately.
    window.addEventListener('chat:p2p-message', event => {
      uploadMessages([event.detail]).catch(() => {});
    });

    // Retry local messages in case Google or the network was temporarily down.
    setInterval(retryLocalMessages, RETRY_INTERVAL);

    // A second pull keeps devices reasonably fresh even if they joined later.
    setInterval(pullAndMerge, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
