(() => {
  const KEY = 'chatGlobalBackground';
  const styleId = 'global-chat-background-style';

  function applyBackground(value) {
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    const safe = value ? String(value).replace(/</g, '%3C') : '';
    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(10,12,16,.45),rgba(10,12,16,.45)),url("${safe}");background-size:cover;background-position:center;background-attachment:fixed;}`
      : '.messages{background-image:none;}';
  }

  async function load() {
    try {
      const r = await fetch('/api/global-background', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        if (data && data.url) {
          localStorage.setItem(KEY, data.url);
          applyBackground(data.url);
          return;
        }
      }
    } catch (_) {}
    applyBackground(localStorage.getItem(KEY) || '');
  }

  function setup() {
    const panel = document.querySelector('#settingsOverlay .panel-body');
    if (!panel || document.getElementById('globalBackgroundSetting')) return;
    const category = document.createElement('div');
    category.className = 'category';
    category.id = 'globalBackgroundSetting';
    category.innerHTML = `<button class="category-title"><span>🌄 Global Chat Background</span><span>⌄</span></button><div class="category-body"><div class="setting"><label>Background image URL</label><input id="globalBackgroundUrl" type="url" placeholder="https://.../image.jpg"><small style="color:#89919d;display:block;margin-top:6px">This background is shared with everyone in this chat.</small></div><div class="setting"><button class="save-btn" id="saveGlobalBackground">Set global background</button><button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Clear background</button></div></div>`;
    const appearance = [...panel.querySelectorAll('.category')].find(x => x.querySelector('.category-title')?.textContent.includes('Appearance'));
    if (appearance) appearance.after(category); else panel.prepend(category);

    const input = category.querySelector('#globalBackgroundUrl');
    input.value = localStorage.getItem(KEY) || '';
    category.querySelector('#saveGlobalBackground').onclick = async () => {
      const url = input.value.trim();
      if (!url) return;
      const deviceId = localStorage.getItem('deviceId') || localStorage.getItem('device_id') || '';
      try {
        const r = await fetch('/api/global-background', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url,device_id:deviceId}) });
        if (!r.ok) throw new Error('save failed');
        localStorage.setItem(KEY, url); applyBackground(url);
        if (window.showToast) window.showToast('Global background updated');
      } catch (_) { alert('Could not update the global background.'); }
    };
    category.querySelector('#clearGlobalBackground').onclick = async () => {
      const deviceId = localStorage.getItem('deviceId') || localStorage.getItem('device_id') || '';
      try { await fetch('/api/global-background', {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id:deviceId})}); } catch (_) {}
      localStorage.removeItem(KEY); input.value=''; applyBackground('');
    };
    category.querySelector('.category-title').onclick = () => category.classList.toggle('open');
  }

  new MutationObserver(setup).observe(document.documentElement, {childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', () => { setup(); load(); });
})();
