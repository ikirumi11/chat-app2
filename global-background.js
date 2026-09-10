/* Global Chat Background — Google Apps Script + Google Doc */
(() => {
  'use strict';

  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbziB6VM28VGG9xWpsKhOte-HmUN2Uu54fLSVf1KwiTyy81VxZ6NwlsBzklFN1cjIU1o/exec';
  const CACHE_KEY = 'chatGlobalBackground.cache.v1';
  const MAX_DIM = 1800;
  const MAX_BASE64_CHARS = 2_500_000;

  let selectedBackground = '';
  let previewObjectUrl = '';

  function applyBackground(data) {
    let style = document.getElementById('global-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'global-chat-background-style';
      document.head.appendChild(style);
    }

    const safe = String(data || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/</g, '%3C');

    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(7,10,15,.34),rgba(7,10,15,.34)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`
      : '.messages{background-image:none !important;}';
  }

  function cacheBackground(data) {
    try {
      if (data) localStorage.setItem(CACHE_KEY, data);
      else localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
  }

  function readCachedBackground() {
    try { return localStorage.getItem(CACHE_KEY) || ''; }
    catch (_) { return ''; }
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
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas is unavailable.'));
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.84;
          let data = canvas.toDataURL('image/jpeg', quality);
          while (data.length > MAX_BASE64_CHARS && quality > 0.40) {
            quality -= 0.06;
            data = canvas.toDataURL('image/jpeg', quality);
          }

          if (data.length > MAX_BASE64_CHARS) {
            reject(new Error('Image is too large after compression. Try a smaller image.'));
          } else {
            resolve(data);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadGlobalBackground(statusElement) {
    const cached = readCachedBackground();
    if (cached) applyBackground(cached);

    try {
      if (statusElement) statusElement.textContent = 'Loading current global background…';

      const response = await fetch(`${BACKEND_URL}?action=getBackground&_=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}.`);

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not load background.');

      const background = result.background || '';
      cacheBackground(background);
      applyBackground(background);

      if (statusElement) {
        statusElement.textContent = background
          ? '✓ Current global background loaded.'
          : 'No global background has been set yet.';
      }

      updatePreview(background);
      return background;
    } catch (error) {
      if (statusElement) statusElement.textContent = '⚠ Could not reach the global background server. Using the last cached version.';
      return cached;
    }
  }

  async function saveGlobalBackground(data, statusElement) {
    if (!data) return false;

    try {
      if (statusElement) statusElement.textContent = 'Uploading global background…';

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveBackground',
          background: data
        })
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}.`);

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not save background.');

      cacheBackground(data);
      applyBackground(data);
      updatePreview(data);

      if (statusElement) statusElement.textContent = '✓ Global background saved and applied for everyone.';
      return true;
    } catch (error) {
      if (statusElement) statusElement.textContent = '✕ Could not save global background: ' + error.message;
      return false;
    }
  }

  async function clearGlobalBackground(statusElement) {
    try {
      if (statusElement) statusElement.textContent = 'Removing global background…';

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'clearBackground' })
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}.`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not clear background.');

      cacheBackground('');
      applyBackground('');
      selectedBackground = '';
      updatePreview('');

      if (statusElement) statusElement.textContent = '✓ Global background removed.';
      return true;
    } catch (error) {
      if (statusElement) statusElement.textContent = '✕ Could not remove global background: ' + error.message;
      return false;
    }
  }

  function updatePreview(data) {
    const preview = document.getElementById('globalBackgroundPreview');
    if (!preview) return;

    if (data) {
      preview.src = data;
      preview.style.display = 'block';
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
    }
  }

  function setupSettings() {
    const panel = document.querySelector('#settingsOverlay .panel-body');
    if (!panel || document.getElementById('globalBackgroundSetting')) return;

    const category = document.createElement('div');
    category.className = 'category';
    category.id = 'globalBackgroundSetting';
    category.innerHTML = `
      <button class="category-title" type="button">
        <span>🌄 Global Background</span><span>⌄</span>
      </button>
      <div class="category-body">
        <div class="setting">
          <label>Current global background</label>
          <img id="globalBackgroundPreview" style="display:none;width:100%;height:150px;object-fit:cover;border-radius:12px;margin-top:8px;border:1px solid #343a44;background:#111" alt="Current global background">
          <div id="globalBackgroundCurrent" style="color:#929aa5;font-size:12px;margin-top:8px">Loading…</div>
        </div>
        <div class="setting">
          <label>Choose a new background</label>
          <input id="globalBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <small style="color:#89919d;display:block;margin-top:6px">The selected image is compressed and sent to the shared Google Docs background server.</small>
        </div>
        <div class="setting">
          <button class="save-btn" id="sendGlobalBackground" disabled>Send New Global Background</button>
          <button class="game-btn" id="reloadGlobalBackground" style="margin-top:8px;width:100%">Reload Current Background</button>
          <button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Remove Global Background</button>
          <div id="globalBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div>
        </div>
      </div>`;

    const appearance = [...panel.querySelectorAll('.category')]
      .find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));
    if (appearance) appearance.after(category); else panel.prepend(category);

    category.querySelector('.category-title').onclick = () => category.classList.toggle('open');

    const input = category.querySelector('#globalBackgroundFile');
    const send = category.querySelector('#sendGlobalBackground');
    const reload = category.querySelector('#reloadGlobalBackground');
    const clear = category.querySelector('#clearGlobalBackground');
    const status = category.querySelector('#globalBackgroundStatus');
    const current = category.querySelector('#globalBackgroundCurrent');

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        status.textContent = '✕ Please choose an image file.';
        send.disabled = true;
        return;
      }

      send.disabled = true;
      status.textContent = 'Preparing background…';

      try {
        selectedBackground = await resizeImage(file);
        updatePreview(selectedBackground);
        send.disabled = false;
        status.textContent = 'Ready to send.';
      } catch (error) {
        selectedBackground = '';
        send.disabled = true;
        status.textContent = '✕ ' + error.message;
      }
    };

    send.onclick = async () => {
      if (!selectedBackground) return;
      send.disabled = true;
      const ok = await saveGlobalBackground(selectedBackground, status);
      send.disabled = false;
      if (ok) {
        input.value = '';
        selectedBackground = '';
        current.textContent = '✓ Current global background is the image shown above.';
      }
    };

    reload.onclick = async () => {
      reload.disabled = true;
      const data = await loadGlobalBackground(status);
      current.textContent = data ? '✓ Current global background loaded.' : 'No global background is set.';
      reload.disabled = false;
    };

    clear.onclick = async () => {
      clear.disabled = true;
      const ok = await clearGlobalBackground(status);
      if (ok) current.textContent = 'No global background is set.';
      clear.disabled = false;
    };

    loadGlobalBackground(status).then(data => {
      current.textContent = data ? '✓ Current global background loaded.' : 'No global background is set.';
    });
  }

  function boot() {
    const cached = readCachedBackground();
    if (cached) applyBackground(cached);

    setupSettings();
    loadGlobalBackground();

    new MutationObserver(setupSettings).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.ChatGlobalBackground = {
    load: loadGlobalBackground,
    save: saveGlobalBackground,
    clear: clearGlobalBackground
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
