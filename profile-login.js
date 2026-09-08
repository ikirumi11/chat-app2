/* Profile login gate: users choose their profile before entering Public Chat. */
(() => {
  'use strict';
  const DEVICE_KEY = 'chat_device_id';
  const NAME_KEY = 'chat_username';
  const PFP_KEY = 'chat_profile_picture_url';

  function ensureDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'device-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function addStyle() {
    if (document.getElementById('profile-login-style')) return;
    const s = document.createElement('style');
    s.id = 'profile-login-style';
    s.textContent = `
      #profileLoginGate{position:fixed;inset:0;z-index:50000;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 15%,rgba(102,84,232,.24),transparent 45%),rgba(8,10,14,.98);font-family:Inter,Arial,sans-serif}
      #profileLoginGate .pl-card{width:min(440px,94vw);padding:30px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(24,27,34,.98);box-shadow:0 25px 90px rgba(0,0,0,.55)}
      #profileLoginGate h1{margin:0 0 8px;color:#fff;font-size:29px}#profileLoginGate p{margin:0 0 22px;color:#9da5b0;line-height:1.5}
      .pl-preview{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#303641;border:2px solid rgba(255,255,255,.12);display:block;margin:0 auto 20px}
      .pl-label{display:block;margin:14px 0 7px;color:#c8ced7;font-size:13px;font-weight:700}.pl-input{width:100%;padding:12px 13px;border:1px solid #3a414c;border-radius:11px;background:#15181d;color:#fff;outline:none;font:inherit}.pl-input:focus{border-color:#7464ed}
      .pl-login{width:100%;margin-top:20px;padding:13px 16px;border:0;border-radius:12px;background:#6654e8;color:#fff;font-weight:800;font-size:15px;cursor:pointer}.pl-login:hover{filter:brightness(1.08)}.pl-login:disabled{opacity:.55;cursor:wait}.pl-status{min-height:18px;margin-top:10px;text-align:center;color:#929aa5;font-size:12px}
    `;
    document.head.appendChild(s);
  }

  function fallbackAvatar() {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#303641"/><text x="50%" y="57%" text-anchor="middle" font-size="42" fill="#9da5b0">?</text></svg>');
  }

  async function init() {
    addStyle();
    const deviceId = ensureDeviceId();
    let profile = null;
    try {
      if (window.chatSupabaseApi?.loadProfileForDevice) profile = await window.chatSupabaseApi.loadProfileForDevice(deviceId);
    } catch (e) { console.warn('[Profile] Load failed:', e); }

    const gate = document.createElement('div');
    gate.id = 'profileLoginGate';
    gate.innerHTML = `
      <div class="pl-card">
        <h1>Your Profile</h1>
        <p>Set your name and profile picture, then press <b>Log In</b> to enter Public Chat.</p>
        <img class="pl-preview" id="plPreview" alt="Profile picture preview">
        <label class="pl-label" for="plName">Name</label>
        <input class="pl-input" id="plName" maxlength="24" autocomplete="nickname" placeholder="Your name">
        <label class="pl-label" for="plPfp">Profile picture</label>
        <input class="pl-input" id="plPfp" type="file" accept="image/*">
        <button class="pl-login" id="plLogin" type="button">Log In</button>
        <div class="pl-status" id="plStatus"></div>
      </div>`;
    document.body.appendChild(gate);

    const name = gate.querySelector('#plName');
    const pfp = gate.querySelector('#plPfp');
    const preview = gate.querySelector('#plPreview');
    const login = gate.querySelector('#plLogin');
    const status = gate.querySelector('#plStatus');
    name.value = profile?.username || localStorage.getItem(NAME_KEY) || '';
    const savedPfp = profile?.pfp_url || localStorage.getItem(PFP_KEY) || '';
    preview.src = savedPfp || fallbackAvatar();
    pfp.onchange = () => { const file = pfp.files?.[0]; if (file) preview.src = URL.createObjectURL(file); };

    login.onclick = async () => {
      const username = name.value.trim().slice(0,24);
      if (!username) { status.textContent = 'Enter a name first.'; name.focus(); return; }
      login.disabled = true; status.textContent = 'Logging in…';
      try {
        if (!window.chatSupabaseApi?.saveProfileForDevice) throw new Error('Server connection is not ready.');
        const saved = await window.chatSupabaseApi.saveProfileForDevice({device_id:deviceId,username,file:pfp.files?.[0] || null});
        localStorage.setItem(NAME_KEY, saved.username || username);
        if (saved.pfp_url) localStorage.setItem(PFP_KEY, saved.pfp_url);
        window.chatSupabaseProfile = saved;
        const settingsName = document.getElementById('usernameInput');
        if (settingsName) settingsName.value = saved.username || username;
        const settingsPfp = document.getElementById('profilePicturePreview');
        if (settingsPfp && saved.pfp_url) { settingsPfp.src = saved.pfp_url; settingsPfp.style.display = ''; }
        gate.remove();
        window.dispatchEvent(new CustomEvent('chat:profile-login',{detail:saved}));
      } catch (e) {
        console.error('[Profile] Login failed:', e);
        status.textContent = 'Could not log in: ' + (e?.message || 'Unknown error');
        login.disabled = false;
      }
    };
    setTimeout(() => name.focus(), 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
