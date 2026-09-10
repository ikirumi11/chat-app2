/* Local Chat Background — stored only on this device/browser */
(() => {
  'use strict';

  const KEY = 'chatLocalBackground.v2';
  const MAX_DIM = 1800;
  const MAX_BYTES = 1400 * 1024;

  function applyBackground(url) {
    let style = document.getElementById('local-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'local-chat-background-style';
      document.head.appendChild(style);
    }
    const safe = String(url || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/</g, '%3C');
    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(7,10,15,.34),rgba(7,10,15,.34)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`
      : '.messages{background-image:none !important;}';
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
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas is unavailable.'));
          ctx.drawImage(img, 0, 0, w, h);
          let quality = 0.84;
          let data = canvas.toDataURL('image/jpeg', quality);
          while (data.length > MAX_BYTES * 1.37 && quality > 0.42) {
            quality -= 0.06;
            data = canvas.toDataURL('image/jpeg', quality);
          }
          if (data.length > MAX_BYTES * 1.37) {
            reject(new Error('Image is too large even after compression.'));
          } else {
            resolve(data);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function load() {
    try { applyBackground(localStorage.getItem(KEY) || ''); }
    catch (_) { applyBackground(''); }
  }

  function save(data, status) {
    try {
      localStorage.setItem(KEY, data);
      applyBackground(data);
      status.textContent = '✓ Local background saved on this device.';
    } catch (_) {
      status.textContent = '✕ Browser storage is full. Try a smaller image.';
    }
  }

  function clear(status) {
    try { localStorage.removeItem(KEY); } catch (_) {}
    applyBackground('');
    status.textContent = '✓ Local background removed from this device.';
  }

  function setup() {
    const panel = document.querySelector('#settingsOverlay .panel-body');
    if (!panel || document.getElementById('localBackgroundSetting')) return;

    const category = document.createElement('div');
    category.className = 'category';
    category.id = 'localBackgroundSetting';
    category.innerHTML = `
      <button class="category-title" type="button"><span>🌄 Local Chat Background</span><span>⌄</span></button>
      <div class="category-body">
        <div class="setting">
          <label>Background image file</label>
          <input id="localBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          <small style="color:#89919d;display:block;margin-top:6px">This background is private to this browser/device. It is never uploaded.</small>
          <img id="localBackgroundPreview" style="display:none;width:100%;height:140px;object-fit:cover;border-radius:12px;margin-top:10px;border:1px solid #343a44" alt="Local background preview">
        </div>
        <div class="setting">
          <button class="save-btn" id="saveLocalBackground" disabled>Save Local Background</button>
          <button class="game-btn" id="clearLocalBackground" style="margin-top:8px;width:100%">Remove Local Background</button>
          <div id="localBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div>
        </div>
      </div>`;

    const appearance = [...panel.querySelectorAll('.category')]
      .find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));
    if (appearance) appearance.after(category); else panel.prepend(category);

    category.querySelector('.category-title').onclick = () => category.classList.toggle('open');
    let selected = null;
    const input = category.querySelector('#localBackgroundFile');
    const preview = category.querySelector('#localBackgroundPreview');
    const saveBtn = category.querySelector('#saveLocalBackground');
    const status = category.querySelector('#localBackgroundStatus');

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        status.textContent = '✕ Please choose an image file.';
        return;
      }
      status.textContent = 'Preparing local image…';
      try {
        selected = await resizeImage(file);
        preview.src = selected;
        preview.style.display = 'block';
        saveBtn.disabled = false;
        status.textContent = 'Ready — nothing has been uploaded.';
      } catch (error) {
        selected = null;
        saveBtn.disabled = true;
        status.textContent = '✕ ' + error.message;
      }
    };

    saveBtn.onclick = () => { if (selected) save(selected, status); };
    category.querySelector('#clearLocalBackground').onclick = () => clear(status);
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
