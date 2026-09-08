/* Persistent device profile login.
   The browser keeps one Device ID and uses it to find the same Supabase profile.
   Server profile data is authoritative; localStorage is a persistent local cache.
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

  function saveLocalProfile(profile) {
    if (!profile) return;
    if (profile.username) localStorage.setItem(NAME_KEY, String(profile.username).slice(0, 24));
    if (profile.pfp_url) localStorage.setItem(PFP_KEY, profile.pfp_url);
    else localStorage.removeItem(PFP_KEY);
    localStorage.setItem(LOGGED_IN_KEY, 'true');
  }

  function applyProfile(profile) {
    if (!profile) return;
    window.chatSupabaseProfile = profile;
    saveLocalProfile(profile);

    const usernameInput = document.getElementById('usernameInput');
    const preview = document.getElementById('profilePicturePreview');
    const deviceInput = document.getElementById('deviceIdInput');
    if (usernameInput && profile.username != null) usernameInput.value = profile.username;
    if (preview) {
      preview.src = profile.pfp_url || avatar();
      preview.style.display = '';
    }
    if (deviceInput) deviceInput.value = profile.device_id || getDeviceId();

    window.dispatchEvent(new CustomEvent('chat:profile-updated', { detail: profile }));
  }

  function finish(profile) {
    applyProfile(profile);
    document.getElementById('profileLoginGate')?.remove();
    window.dispatchEvent(new CustomEvent('chat:profile-login', { detail: profile }));
  }

  function localProfile(deviceId) {
    const username = String(localStorage.getItem(NAME_KEY) || '').trim();
    if (!username) return null;
    return {
      device_id: deviceId,
      username,
      pfp_url: localStorage.getItem(PFP_KEY) || null,
      local_cache: true
    };
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
        <p>Log in once. This browser keeps your Device ID and profile locally, while the server stores the same profile for future connections.</p>
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

  async function refreshFromServer(api, deviceId) {
    try {
      const serverProfile = await api.loadProfileForDevice(deviceId);
      if (serverProfile?.username) {
        // Server is authoritative. Replace the local cached name/PFP with server values.
        applyProfile(serverProfile);
        return serverProfile;
      }
    } catch (error) {
      console.warn('[Profile] Server profile refresh failed:', error);
    }
    return null;
  }

  async function init() {
    addStyle();
    const deviceId = getDeviceId();
    const cached = localProfile(deviceId);

    let api;
    try {
      if (window.chatServerStartupReady) await window.chatServerStartupReady;
      api = await waitForApi();
    } catch (error) {
      console.warn('[Profile] Supabase API startup wait failed:', error);
    }

    // Existing local profile means the user is already logged in on this browser.
    // Do not make them enter the profile again just because the server is temporarily slow.
    if (cached) {
      finish(cached);
      if (api) {
        refreshFromServer(api, deviceId).catch(() => {});
      }
      return;
    }

    // First login: the server must be checked before asking for a new profile.
    if (api) {
      const serverProfile = await refreshFromServer(api, deviceId);
      if (serverProfile?.username) {
        finish(serverProfile);
        return;
      }
    }

    const ui = buildGate(deviceId);
    const { name, file, login, status } = ui;

    if (api) {
      status.textContent = 'Connected — create your profile and log in.';
      login.disabled = false;
    } else {
      status.textContent = 'Server connection is unavailable. Retrying…';
      login.disabled = true;
      setTimeout(async () => {
        try {
          api = await waitForApi();
          const serverProfile = await refreshFromServer(api, deviceId);
          if (serverProfile?.username) {
            finish(serverProfile);
            return;
          }
          status.textContent = 'Connected — create your profile and log in.';
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
      status.textContent = 'Saving profile to server…';

      try {
        api = api || await waitForApi();
        const saved = await api.saveProfileForDevice({
          device_id: deviceId,
          username,
          file: file.files?.[0] || null
        });

        // The profile returned by Supabase is the profile we use everywhere.
        // Save it locally immediately so the next startup does not ask again.
        finish(saved);
      } catch (error) {
        console.error('[Profile] Login failed:', error);
        status.textContent = 'Could not save the profile to the server. Nothing was logged in.';
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
