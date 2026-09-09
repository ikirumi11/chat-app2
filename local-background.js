/* Global Chat Background — stored on the server for everyone */
(() => {
  'use strict';

  const API = '/api/global-background';
  const MAX_DIM = 1800;
  const MAX_BYTES = 1400 * 1024;

  function applyBackground(url) {
    let style = document.getElementById('global-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'global-chat-background-style';
      document.head.appendChild(style);
    }

    const safe = String(url || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/</g, '%3C');

    style.textContent = safe ? `
      html, body { min-height:100%; }
      body {
        background-image:linear-gradient(rgba(7,10,15,.42),rgba(7,10,15,.42)),url("${safe}") !important;
        background-size:cover !important;
        background-position:center !important;
        background-repeat:no-repeat !important;
        background-attachment:fixed !important;
      }
      body > .app { background:transparent !important; }
      .app > .header,
      .app > .messages,
      .app > .composer { background-color:rgba(7,10,15,.30) !important; }
      .app > .messages { background-image:none !important; background-attachment:initial !important; }
    ` : '';
  }

  async function request(method, body) {
    const response = await fetch(API, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || `Background request failed (${response.status})`);
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
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas is unavailable.'));
          ctx.drawImage(img, 0, 0, w, h);
          let quality = 0.84;
          let data = canvas.toDataURL('image/jpeg', quality);
          while (data.length > MAX_BYTES * 1.37 && quality > 0.42) {
            quality -= 0.06;
            data = canvas.toDataURL('image/jpeg', quality);
          }
          if (data.length > MAX_BYTES * 1.37) reject(new Error('Image is too large after compression.'));
          else resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadServerBackground() {
    try {
      const data = await request('GET');
      applyBackground(data.url || '');
    } catch (error) {
      console.warn('Global background could not be loaded:', error);
    }
  }

  function setup() {
    const panel = document.querySelector('#settingsOverlay .panel-body');
    if (!panel || document.getElementById('globalBackgroundSetting')) return;

    const category = document.createElement('div');
    category.className = 'category';
    category.id = 'globalBackgroundSetting';
    category.innerHTML = `
      <button class="category-title" type="button"><span>🌄 Global Chat Background</span><span>⌄</span></button>
      <div class="category-body">
        <div class="setting">
          <label>Background image for everyone</label>
          <input id="globalBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <small style="color:#89919d;display:block;margin-top:6px">Saved on the server. Everyone who opens the chat will see the current background.</small>
          <img id="globalBackgroundPreview" style="display:none;width:100%;height:140px;object-fit:cover;border-radius:12px;margin-top:10px;border:1px solid #343a44" alt="Global background preview">
        </div>
        <div class="setting">
          <button class="save-btn" id="saveGlobalBackground" disabled>Save for Everyone</button>
          <button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Remove Global Background</button>
          <div id="globalBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div>
        </div>
      </div>`;

    const appearance = [...panel.querySelectorAll('.category')]
      .find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));
    if (appearance) appearance.after(category); else panel.prepend(category);

    category.querySelector('.category-title').onclick = () => category.classList.toggle('open');
    const input = category.querySelector('#globalBackgroundFile');
    const preview = category.querySelector('#globalBackgroundPreview');
    const saveBtn = category.querySelector('#saveGlobalBackground');
    const status = category.querySelector('#globalBackgroundStatus');
    let selected = null;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { status.textContent = '✕ Please choose an image file.'; return; }
      status.textContent = 'Preparing image…';
      try {
        selected = await resizeImage(file);
        preview.src = selected;
        preview.style.display = 'block';
        saveBtn.disabled = false;
        status.textContent = 'Ready to save for everyone.';
      } catch (error) {
        selected = null;
        saveBtn.disabled = true;
        status.textContent = '✕ ' + error.message;
      }
    };

    saveBtn.onclick = async () => {
      if (!selected) return;
      saveBtn.disabled = true;
      status.textContent = 'Uploading and saving…';
      try {
        const data = await request('POST', { url: selected });
        applyBackground(data.url || selected);
        status.textContent = '✓ Global background saved for everyone.';
      } catch (error) {
        status.textContent = '✕ ' + error.message;
      } finally {
        saveBtn.disabled = false;
      }
    };

    category.querySelector('#clearGlobalBackground').onclick = async () => {
      status.textContent = 'Removing…';
      try {
        await request('DELETE');
        applyBackground('');
        preview.style.display = 'none';
        selected = null;
        saveBtn.disabled = true;
        status.textContent = '✓ Global background removed for everyone.';
      } catch (error) {
        status.textContent = '✕ ' + error.message;
      }
    };
  }

  function boot() {
    loadServerBackground();
    setup();
    new MutationObserver(setup).observe(document.documentElement, { childList:true, subtree:true });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
