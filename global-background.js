/* Global Chat Background — Google Apps Script + Google Doc backend */
(() => {
  'use strict';

  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxYU_En6P2Ltdatm0wt3ZKcXvifQB6SBk9W_4QZ8sdYCM7XV4HSzroyMIlbgo5xQIJK/exec';
  const CACHE_KEY = 'chatGlobalBackground.cache.v5';
  const MAX_DIM = 750;
  const MAX_BASE64_CHARS = 1_500_000;
  const DATA_PREFIX = 'data:image/jpeg;base64,';

  let selectedBackground = '';

  function getStyleElement() {
    let style = document.getElementById('global-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'global-chat-background-style';
      document.head.appendChild(style);
    }
    return style;
  }

  function cleanRawBase64(value) {
    if (!value) return '';

    let text = String(value);

    // Never send or store the old marker strings.
    text = text.split('BACKGROUND_BASE64_START').join('');
    text = text.split('BACKGROUND_BASE64_END').join('');

    // Remove a data-image prefix if one exists.
    const comma = text.indexOf(',');
    if (text.trim().startsWith('data:image/') && comma !== -1) {
      text = text.slice(comma + 1);
    }

    // Base64 itself must be the only content.
    return text.trim();
  }

  function toDataUrl(rawBase64) {
    const value = cleanRawBase64(rawBase64);
    if (!value) return '';
    return DATA_PREFIX + value;
  }

  function toRawBase64(dataUrl) {
    return cleanRawBase64(dataUrl);
  }

  function applyBackground(rawBase64) {
    const style = getStyleElement();
    const dataUrl = toDataUrl(rawBase64);
    const safe = dataUrl
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/</g, '%3C');

    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(7,10,15,.34),rgba(7,10,15,.34)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`
      : '.messages{background-image:none !important;}';
  }

  function cacheBackground(rawBase64) {
    try {
      const clean = cleanRawBase64(rawBase64);
      if (clean) localStorage.setItem(CACHE_KEY, clean);
      else localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
  }

  function getCachedBackground() {
    try {
      return cleanRawBase64(localStorage.getItem(CACHE_KEY) || '');
    } catch (_) {
      return '';
    }
  }

  async function readServerResponse(response, operation) {
    const text = await response.text();
    const trimmed = text.trim();

    if (!trimmed) {
      throw new Error(`The background server returned an empty response while trying to ${operation}.`);
    }

    let result;
    try {
      result = JSON.parse(trimmed);
    } catch (_) {
      const preview = trimmed.replace(/\s+/g, ' ').slice(0, 180);
      if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed) || trimmed.includes('<!DOCTYPE')) {
        throw new Error(`The Apps Script deployment returned HTML instead of JSON. Response: ${preview}`);
      }
      throw new Error(`The background server returned invalid JSON. Response: ${preview}`);
    }

    if (!result || result.success !== true) {
      throw new Error(result?.error || `The server could not ${operation}.`);
    }

    return result;
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
          if (!ctx) {
            reject(new Error('Canvas is unavailable.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.82;
          let data = canvas.toDataURL('image/jpeg', quality);
          let rawBase64 = toRawBase64(data);

          while (rawBase64.length > MAX_BASE64_CHARS && quality > 0.42) {
            quality -= 0.06;
            data = canvas.toDataURL('image/jpeg', quality);
            rawBase64 = toRawBase64(data);
          }

          if (rawBase64.length > MAX_BASE64_CHARS) {
            reject(new Error('Image is still too large after compression. Choose a smaller image.'));
            return;
          }

          resolve(rawBase64);
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  async function loadGlobalBackground(statusElement) {
    const cached = getCachedBackground();
    if (cached) applyBackground(cached);

    try {
      if (statusElement) statusElement.textContent = 'Laster global bakgrunn…';

      const response = await fetch(`${BACKEND_URL}?action=getBackground&_=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}.`);
      }

      const result = await readServerResponse(response, 'load the background');
      const background = cleanRawBase64(result.background || '');

      cacheBackground(background);
      applyBackground(background);
      updatePreview(background);

      if (statusElement) {
        statusElement.textContent = background
          ? '✓ Global bakgrunn lastet.'
          : 'Ingen global bakgrunn er satt.';
      }

      return background;
    } catch (error) {
      if (statusElement) {
        statusElement.textContent = '⚠ ' + error.message + (cached ? ' Bruker sist lagrede bakgrunn.' : '');
      }
      return cached;
    }
  }

  async function saveGlobalBackground(rawBase64, statusElement) {
    const cleanBase64 = cleanRawBase64(rawBase64);
    if (!cleanBase64) return false;

    try {
      if (statusElement) statusElement.textContent = 'Sender global bakgrunn…';

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          // The Apps Script uses only "save".
          action: 'save',
          // This value is raw Base64 and NOTHING else.
          background: cleanBase64
        }),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}.`);
      }

      await readServerResponse(response, 'save the background');

      cacheBackground(cleanBase64);
      applyBackground(cleanBase64);
      updatePreview(cleanBase64);

      if (statusElement) statusElement.textContent = '✓ Global bakgrunn lagret og aktivert.';
      return true;
    } catch (error) {
      if (statusElement) statusElement.textContent = '✕ Kunne ikke lagre global bakgrunn: ' + error.message;
      return false;
    }
  }

  async function clearGlobalBackground(statusElement) {
    try {
      if (statusElement) statusElement.textContent = 'Fjerner global bakgrunn…';

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          // The Apps Script uses only "clear".
          action: 'clear'
        }),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}.`);
      }

      await readServerResponse(response, 'remove the background');

      cacheBackground('');
      applyBackground('');
      selectedBackground = '';
      updatePreview('');

      if (statusElement) statusElement.textContent = '✓ Global bakgrunn fjernet.';
      return true;
    } catch (error) {
      if (statusElement) statusElement.textContent = '✕ Kunne ikke fjerne global bakgrunn: ' + error.message;
      return false;
    }
  }

  function updatePreview(rawBase64) {
    const preview = document.getElementById('globalBackgroundPreview');
    if (!preview) return;

    const dataUrl = toDataUrl(rawBase64);

    if (dataUrl) {
      preview.src = dataUrl;
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
          <div id="globalBackgroundCurrent" style="color:#929aa5;font-size:12px;margin-top:8px">Laster…</div>
        </div>

        <div class="setting">
          <label>Choose a new background</label>
          <input id="globalBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <small style="color:#89919d;display:block;margin-top:6px">Bakgrunnen skaleres ned til maks 750px og lagres som ren Base64.</small>
        </div>

        <div class="setting">
          <button class="save-btn" id="sendGlobalBackground" disabled>Send New Global Background</button>
          <button class="game-btn" id="reloadGlobalBackground" style="margin-top:8px;width:100%">Reload Current Global Background</button>
          <button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Remove Global Background</button>
          <div id="globalBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div>
        </div>
      </div>`;

    const appearance = [...panel.querySelectorAll('.category')]
      .find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));

    if (appearance) appearance.after(category);
    else panel.prepend(category);

    category.querySelector('.category-title').onclick = () => {
      category.classList.toggle('open');
    };

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
        status.textContent = '✕ Velg en bildefil.';
        send.disabled = true;
        return;
      }

      send.disabled = true;
      status.textContent = 'Forbereder bakgrunn…';

      try {
        selectedBackground = await resizeImage(file);
        updatePreview(selectedBackground);
        send.disabled = false;
        status.textContent = '✓ Klar til å sende. Maks 750px.';
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
        current.textContent = '✓ Denne bakgrunnen er nå lagret globalt.';
      }
    };

    reload.onclick = async () => {
      reload.disabled = true;
      const data = await loadGlobalBackground(status);
      current.textContent = data ? '✓ Global bakgrunn lastet.' : 'Ingen global bakgrunn er satt.';
      reload.disabled = false;
    };

    clear.onclick = async () => {
      clear.disabled = true;
      const ok = await clearGlobalBackground(status);
      if (ok) current.textContent = 'Ingen global bakgrunn er satt.';
      clear.disabled = false;
    };

    loadGlobalBackground(status).then(data => {
      current.textContent = data ? '✓ Global bakgrunn lastet.' : 'Ingen global bakgrunn er satt.';
    });
  }

  function boot() {
    const cached = getCachedBackground();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
