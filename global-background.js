/* Global Chat Background — shared file upload + image URL */
(() => {
  'use strict';

  const API = '/api/global-background';
  const KEY = 'chatGlobalBackground';
  const MAX_DIM = 1600;
  const MAX_BYTES = 900 * 1024;

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

    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(10,12,16,.4),rgba(10,12,16,.4)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`
      : '.messages{background-image:none !important;}';
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.url) {
          localStorage.setItem(KEY, d.url);
          applyBackground(d.url);
          return;
        }
      }
    } catch (e) {}

    applyBackground(localStorage.getItem(KEY) || '');
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, MAX_DIM / img.width, MAX_DIM / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);

          let q = 0.82;
          let data = c.toDataURL('image/jpeg', q);
          while (data.length > MAX_BYTES * 1.37 && q > 0.45) {
            q -= 0.07;
            data = c.toDataURL('image/jpeg', q);
          }
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function isValidImageUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (e) {
      return false;
    }
  }

  async function save(value, status) {
    status.textContent = 'Saving background…';

    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value })
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) throw Error(d.error || 'Could not save background');

      localStorage.setItem(KEY, d.url || value);
      applyBackground(d.url || value);
      status.textContent = '✓ Global background updated for everyone.';
    } catch (e) {
      status.textContent = '✕ ' + e.message;
    }
  }

  async function clear(status) {
    status.textContent = 'Removing background…';
    try {
      const r = await fetch(API, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(d.error || 'Could not remove background');

      localStorage.removeItem(KEY);
      applyBackground('');
      status.textContent = '✓ Global background removed.';
    } catch (e) {
      status.textContent = '✕ ' + e.message;
    }
  }

  function setup() {
    const panel = document.querySelector('#settingsOverlay .panel-body');
    if (!panel || document.getElementById('globalBackgroundSetting')) return;

    const category = document.createElement('div');
    category.className = 'category';
    category.id = 'globalBackgroundSetting';
    category.innerHTML = `
      <button class="category-title"><span>🌄 Global Chat Background</span><span>⌄</span></button>
      <div class="category-body">
        <div class="setting">
          <label>Image URL</label>
          <input id="globalBackgroundUrl" type="url" placeholder="https://example.com/background.jpg" autocomplete="off">
          <small style="color:#89919d;display:block;margin-top:6px">Paste a direct image URL, or upload an image below.</small>
        </div>

        <div class="setting">
          <label>Or upload an image file</label>
          <input id="globalBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <small style="color:#89919d;display:block;margin-top:6px">Uploaded images are stored in the shared Supabase background storage.</small>
          <img id="globalBackgroundPreview" style="display:none;width:100%;height:130px;object-fit:cover;border-radius:10px;margin-top:10px;border:1px solid #343a44" alt="Background preview">
        </div>

        <div class="setting">
          <button class="save-btn" id="saveGlobalBackground" disabled>Set global background</button>
          <button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Clear background</button>
          <div id="globalBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div>
        </div>
      </div>`;

    const appearance = [...panel.querySelectorAll('.category')]
      .find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));
    if (appearance) appearance.after(category);
    else panel.prepend(category);

    category.querySelector('.category-title').onclick = () => category.classList.toggle('open');

    let selected = null;
    const urlInput = category.querySelector('#globalBackgroundUrl');
    const input = category.querySelector('#globalBackgroundFile');
    const preview = category.querySelector('#globalBackgroundPreview');
    const saveBtn = category.querySelector('#saveGlobalBackground');
    const status = category.querySelector('#globalBackgroundStatus');

    function updateButton() {
      const url = urlInput.value.trim();
      saveBtn.disabled = !selected && !isValidImageUrl(url);
      if (url && !isValidImageUrl(url)) status.textContent = 'Enter a valid http:// or https:// image URL.';
      else if (!selected && !url) status.textContent = '';
      else if (!selected) status.textContent = 'Ready to save URL.';
    }

    urlInput.oninput = () => {
      if (urlInput.value.trim()) {
        selected = null;
        input.value = '';
        preview.style.display = 'none';
      }
      updateButton();
    };

    urlInput.onchange = () => {
      const url = urlInput.value.trim();
      if (!isValidImageUrl(url)) return updateButton();
      preview.src = url;
      preview.style.display = 'block';
      preview.onerror = () => {
        preview.style.display = 'none';
        status.textContent = 'The URL could not be previewed. It may not be a direct image URL.';
      };
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      urlInput.value = '';
      status.textContent = 'Preparing image…';
      try {
        selected = await resizeImage(file);
        preview.src = selected;
        preview.style.display = 'block';
        saveBtn.disabled = false;
        status.textContent = 'Ready to save uploaded image.';
      } catch (e) {
        selected = null;
        saveBtn.disabled = true;
        status.textContent = 'Could not read that image.';
      }
    };

    saveBtn.onclick = () => {
      const value = selected || urlInput.value.trim();
      if (value) save(value, status);
    };

    category.querySelector('#clearGlobalBackground').onclick = () => clear(status);
  }

  function boot() {
    load();
    setup();
    new MutationObserver(setup).observe(document.documentElement, { childList: true, subtree: true });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
