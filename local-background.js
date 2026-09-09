/* Global Chat Background — newest Google Apps Script backend */
(() => {
  'use strict';

  const SERVER = 'https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec';
  const MAX_DIM = 900;
  const MAX_BYTES = 30000;

  function applyBackground(url) {
    let style = document.getElementById('global-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'global-chat-background-style';
      document.head.appendChild(style);
    }
    const safe = String(url || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '%3C');
    style.textContent = safe ? `html,body{min-height:100%;}body{background-image:linear-gradient(rgba(7,10,15,.42),rgba(7,10,15,.42)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}.app{background:transparent !important;}.app>.header,.app>.messages,.app>.composer{background-color:rgba(7,10,15,.30) !important;}.app>.messages{background-image:none !important;}` : '';
  }

  async function request(action, body = {}) {
    const method = action === 'background' ? 'GET' : 'POST';
    const url = method === 'GET' ? SERVER + '?action=background' : SERVER;
    const response = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      body: method === 'POST' ? JSON.stringify({ action, ...body }) : undefined,
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || `Background request failed (${response.status})`);
    return data;
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode that image.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_DIM / img.width, MAX_DIM / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas is unavailable.'));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let quality = 0.72;
          let data = canvas.toDataURL('image/jpeg', quality);
          while (data.length > MAX_BYTES && quality > 0.25) { quality -= 0.06; data = canvas.toDataURL('image/jpeg', quality); }
          if (data.length > MAX_BYTES) return reject(new Error('Image is still too large. Choose a smaller image.'));
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadServerBackground() {
    try { const data = await request('background'); applyBackground(data.url || ''); }
    catch (error) { console.warn('Global background could not be loaded:', error); }
  }

  function setup() {
    const category = document.getElementById('globalBackgroundSetting');
    if (!category || category.dataset.gsBackgroundReady === '1') return;
    category.dataset.gsBackgroundReady = '1';
    const input = category.querySelector('#globalBackgroundFile');
    const preview = category.querySelector('#globalBackgroundPreview');
    const saveBtn = category.querySelector('#saveGlobalBackground');
    const clearBtn = category.querySelector('#clearGlobalBackground');
    const status = category.querySelector('#globalBackgroundStatus');
    if (!input || !preview || !saveBtn || !clearBtn || !status) return;
    let selected = null;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { status.textContent = '✕ Please choose an image file.'; return; }
      status.textContent = 'Preparing image…';
      try { selected = await resizeImage(file); preview.src = selected; preview.style.display = 'block'; saveBtn.disabled = false; status.textContent = 'Ready to save for everyone.'; }
      catch (error) { selected = null; saveBtn.disabled = true; status.textContent = '✕ ' + error.message; }
    };
    saveBtn.onclick = async () => {
      if (!selected) return;
      saveBtn.disabled = true; status.textContent = 'Saving…';
      try { const data = await request('background', { url: selected }); applyBackground(data.url || selected); status.textContent = '✓ Global background saved for everyone.'; }
      catch (error) { status.textContent = '✕ ' + error.message; }
      finally { saveBtn.disabled = false; }
    };
    clearBtn.onclick = async () => {
      status.textContent = 'Removing…';
      try { await request('clear_background'); applyBackground(''); preview.style.display = 'none'; selected = null; saveBtn.disabled = true; status.textContent = '✓ Global background removed for everyone.'; }
      catch (error) { status.textContent = '✕ ' + error.message; }
    };
  }

  function boot() {
    loadServerBackground();
    setup();
    new MutationObserver(setup).observe(document.documentElement, { childList: true, subtree: true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
