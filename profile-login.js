/* Persistent device profile login.
   One browser keeps one device ID in localStorage and uses that ID to find the same Supabase profile.
*/
(() => {
  'use strict';

  const DEVICE_KEY = 'chat_device_id';
  const NAME_KEY = 'chat_username';
  const PFP_KEY = 'chat_profile_picture_url';
  const LOGGED_IN_KEY = 'chat_profile_logged_in';

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function addStyle() {
    if (document.getElementById('profile-login-style')) return;
    const style = document.createElement('style');
    style.id = 'profile-login-style';
    style.textContent = `
      #profileLoginGate{position:fixed;inset:0;z-index:50000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,10,14,.98);font-family:Inter,Arial,sans-serif}
      #profileLoginGate .pl-card{width:min(440px,94vw);padding:30px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:#181b22;box-shadow:0 25px 90px rgba(0,0,0,.55)}
      #profileLoginGate h1{margin:0 0 8px;color:#fff;font-size:29px}
      #profileLoginGate p{margin:0 0 20px;color:#9da5b0;line-height:1.5}
      .pl-preview{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#303641;border:2px solid rgba(255,255,255,.12);display:block;margin:0 auto 20px}
      .pl-label{display:block;margin:14px 0 7px;color:#c8ced7;font-size:13px;font-weight:700}
      .pl-input{width:100%;padding:12px 13px;border:1px solid #3a414c;border-radius:11px;background:#15181d;color:#fff;outline:none;font:inherit}
      .pl-device{font:11px ui-monospace,Consolas,monospace;color:#8f98a5;word-break:break-all;background:#111419;border:1px solid #292e36;border-radius:10px;padding:10px}
      .pl-login{width:100%;margin-top:20px;padding:13px;border:0;border-radius:12px;background:#6654e8;color:#fff;font-weight:800;font-size:15px;cursor:pointer}
      .pl-login:disabled{opacity:.55;cursor:wait}
      .pl-status{min-height:18px;margin-top:10px;text-align:center;color:#929aa5;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function avatar() {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#303641"/><text x="50%" y="57%" text-anchor="middle" font-size="42" fill="#9da5b0">?</text></svg>'
    );
  }

  function finish(profile) {
    if (profile?.username) localStorage.setItem(NAME_KEY, profile.username);
    if (profile?.pfp_url) localStorage.setItem(PFP_KEY, profile.pfp_url);
    else localStorage.removeItem(PFP_KEY);
    localStorage.setItem(LOGGED_IN_KEY, 'true');
    window.chatSupabaseProfile = profile;
    document.getElementById('profileLoginGate')?.remove();
    window.dispatchEvent(new CustomEvent('chat:profile-login', { detail: profile }));
  }

  function waitForApi(timeout = 10000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        if (window.chatSupabaseApi?.loadProfileForDevice && window.chatSupabaseApi?.saveProfileForDevice) {
          resolve(window.chatSupabaseApi);
          return;
        }
        if (Date.now() - start >= timeout) {
          reject(new Error('Supabase client did not become ready.'));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  function buildGate(deviceId) {
    const gate = document.createElement('div');
    gate.id = 'profileLoginGate';
    gate.innerHTML = `
      <div class="pl-card">
        <h1>Your Profile</h1>
        <p>This browser has its own persistent Device ID. Your profile and messages are linked to it, so reopening or refreshing this page keeps you as the same user.</p>
        <img class="pl-preview" id="plPreview" alt="Profile picture preview">
        <label class="pl-label">Name</label>
        <input class="pl-input" id="plName" maxlength="24" placeholder="Your name" autocomplete="nickname">
        <label class="pl-label">Device ID</label>
        <div class="pl-device" id="plDevice"></div>
        <label class="pl-label">Profile picture</label>
        <input class="pl-input" id="plPfp" type="file" accept="image/*">
        <button class="pl-login" id="plLogin" type="button">Log In</button>
        <div class="pl-status" id="plStatus">Connecting to server…</div>
      </div>
    `;
    document.body.appendChild(gate);

    const name = gate.querySelector('#plName');
    const file = gate.querySelector('#plPfp');
    const preview = gate.querySelector('#plPreview');
    const device = gate.querySelector('#plDevice');
    const login = gate.querySelector('#plLogin');
    const status = gate.querySelector('#plStatus');

    name.value = localStorage.getItem(NAME_KEY) || '';
    preview.src = localStorage.getItem(PFP_KEY) || avatar();
    device.textContent = deviceId;

    file.addEventListener('change', () => {
      const selected = file.files?.[0];
      if (selected) preview.src = URL.createObjectURL(selected);
    });

    return { gate, name, file, login, status };
  }

  async function init() {
    addStyle();
    const deviceId = getDeviceId();
    let api;

    try {
      if (window.chatServerStartupReady) await window.chatServerStartupReady;
      api = await waitForApi();
      const profile = await api.loadProfileForDevice(deviceId);
      if (profile?.username) {
        finish(profile);
        return;
      }
    } catch (error) {
      console.warn('[Profile] Automatic profile lookup failed:', error);
    }

    const ui = buildGate(deviceId);
    const { name, file, login, status } = ui;

    try {
      api = api || await waitForApi();
      status.textContent = 'Connected — log in to enter Public Chat.';
      login.disabled = false;
    } catch (error) {
      status.textContent = 'Server connection is unavailable. Retrying…';
      login.disabled = true;
      setTimeout(async () => {
        try {
          api = await waitForApi();
          status.textContent = 'Connected — log in to enter Public Chat.';
          login.disabled = false;
        } catch {}
      }, 1500);
    }

    login.addEventListener('click', async () => {
      const username = name.value.trim().slice(0, 24);
      if (!username) {
        status.textContent = 'Enter a name first.';
        name.focus();
        return;
      }

      login.disabled = true;
      status.textContent = 'Saving your profile…';

      try {
        api = api || await waitForApi();
        const saved = await api.saveProfileForDevice({
          device_id: deviceId,
          username,
          file: file.files?.[0] || null
        });
        finish(saved);
      } catch (error) {
        console.error('[Profile] Login failed:', error);
        status.textContent = 'Could not save the profile. Check the server connection and try again.';
        login.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
