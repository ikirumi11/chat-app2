/* Persistent device profile login.
   Log In connects first, waits one second, confirms the chat/messages area is visible,
   then gets the device ID and restores/saves the server profile.
*/
(() => {
  'use strict';

  const DEVICE_KEY = 'chat_device_id';
  const NAME_KEY = 'chat_username';
  const PFP_KEY = 'chat_profile_picture_url';
  const LOGGED_IN_KEY = 'chat_profile_logged_in';

  const getDeviceId = () => String(localStorage.getItem(DEVICE_KEY) || '').trim();

  function ensureDeviceId() {
    let id = getDeviceId();
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function saveLocalProfile(profile) {
    if (!profile) return;
    localStorage.setItem(NAME_KEY, String(profile.username || 'Anonymous').slice(0, 24));
    if (profile.pfp_url) localStorage.setItem(PFP_KEY, profile.pfp_url);
    else localStorage.removeItem(PFP_KEY);
    localStorage.setItem(LOGGED_IN_KEY, 'true');
  }

  function applyProfile(profile) {
    if (!profile) return;
    window.chatSupabaseProfile = profile;
    saveLocalProfile(profile);

    const name = document.getElementById('usernameInput');
    const preview = document.getElementById('profilePicturePreview');
    const device = document.getElementById('deviceIdInput');

    if (name && profile.username != null) name.value = profile.username;
    if (preview) {
      preview.src = profile.pfp_url || '';
      preview.style.display = profile.pfp_url ? '' : 'none';
    }
    if (device) device.value = profile.device_id || getDeviceId();

    window.dispatchEvent(new CustomEvent('chat:profile-updated', { detail: profile }));
  }

  function finish(profile) {
    applyProfile(profile);
    document.getElementById('profileLoginGate')?.remove();
    window.dispatchEvent(new CustomEvent('chat:profile-login', { detail: profile }));
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
      .pl-login{width:100%;margin-top:20px;padding:13px;border:0;border-radius:12px;background:#6654e8;color:#fff;font-weight:800;font-size:15px;cursor:pointer}.pl-login:disabled{opacity:.55;cursor:wait}
      .pl-status{min-height:18px;margin-top:10px;text-align:center;color:#929aa5;font-size:12px}
    `;
    document.head.appendChild(style);
  }

  function buildGate() {
    const gate = document.createElement('div');
    gate.id = 'profileLoginGate';
    gate.innerHTML = `
      <div class="pl-card">
        <h1>Your Profile</h1>
        <p>Enter your current profile information, then press Log In.</p>
        <img class="pl-preview" id="plPreview" alt="Profile picture preview">
        <label class="pl-label">Name</label>
        <input class="pl-input" id="plName" maxlength="24" placeholder="Your name">
        <label class="pl-label">Device ID</label>
        <div class="pl-device" id="plDevice">Created after Log In is pressed</div>
        <label class="pl-label">Profile picture</label>
        <input class="pl-input" id="plPfp" type="file" accept="image/*">
        <button class="pl-login" id="plLogin" type="button">Log In</button>
        <div class="pl-status" id="plStatus">Ready — press Log In to connect.</div>
      </div>`;

    document.body.appendChild(gate);

    const name = gate.querySelector('#plName');
    const file = gate.querySelector('#plPfp');
    const preview = gate.querySelector('#plPreview');
    const device = gate.querySelector('#plDevice');
    const login = gate.querySelector('#plLogin');
    const status = gate.querySelector('#plStatus');

    name.value = localStorage.getItem(NAME_KEY) || '';
    preview.src = localStorage.getItem(PFP_KEY) || '';
    preview.style.display = preview.src ? '' : 'none';

    file.addEventListener('change', () => {
      const selected = file.files?.[0];
      if (!selected) return;
      preview.src = URL.createObjectURL(selected);
      preview.style.display = '';
    });

    return { name, file, preview, device, login, status };
  }

  async function waitForApi(timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const api = window.chatSupabaseApi;
      if (api?.connectToSupabase && api?.loadProfileForDevice && api?.saveProfileForDevice) return api;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Supabase code was not loaded.');
  }

  function messagesAreaIsVisible() {
    const messages = document.getElementById('messages');
    if (!messages) return false;
    const style = getComputedStyle(messages);
    const rect = messages.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  async function waitForMessagesVisible(timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (messagesAreaIsVisible()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async function connectThenWaitAndFindProfile(ui) {
    const api = await waitForApi();
    ui.status.textContent = 'Connecting to server…';

    const connected = await api.connectToSupabase(20000);
    if (!connected) throw new Error('Supabase did not reach a confirmed connection.');

    // Exact requested timing: Log In -> wait 1 second -> check that the messages area is visible.
    ui.status.textContent = 'Connected. Waiting 1 second…';
    await new Promise(resolve => setTimeout(resolve, 1000));

    ui.status.textContent = 'Checking Public Chat…';
    const visible = await waitForMessagesVisible(10000);
    if (!visible) throw new Error('Public Chat messages area is not visible yet.');

    ui.status.textContent = 'Public Chat is visible. Finding your saved account…';

    // Only after the requested one-second wait and visible-chat check do we obtain/use the device ID.
    const deviceId = ensureDeviceId();
    ui.device.textContent = deviceId;

    const saved = await api.loadProfileForDevice(deviceId);
    return { api, deviceId, saved };
  }

  async function login(ui) {
    const currentUsername = ui.name.value.trim().slice(0, 24);
    if (!currentUsername) {
      ui.status.textContent = 'Enter a name first.';
      ui.name.focus();
      return;
    }

    ui.login.disabled = true;
    ui.name.value = currentUsername;
    ui.status.textContent = 'Starting server connection…';

    try {
      const provisionalPfpFile = ui.file.files?.[0] || null;
      const { api, deviceId, saved } = await connectThenWaitAndFindProfile(ui);

      let finalProfile;
      if (saved) {
        // Existing server account is authoritative. Replace the current name/PFP with the saved values.
        applyProfile(saved);
        ui.status.textContent = 'Saved account found. Restoring it…';

        // Save the restored server profile again so server/local state is synchronized.
        finalProfile = await api.saveProfileForDevice({
          device_id: deviceId,
          username: saved.username,
          pfp_url: saved.pfp_url || null
        });
      } else {
        // New device: save the current login-page values to the server.
        ui.status.textContent = 'No saved account found. Saving this profile…';
        finalProfile = await api.saveProfileForDevice({
          device_id: deviceId,
          username: currentUsername,
          file: provisionalPfpFile
        });
      }

      // Final server response is authoritative and is also persisted locally.
      applyProfile(finalProfile);
      saveLocalProfile(finalProfile);
      finish(finalProfile);
    } catch (error) {
      console.error('[Profile] Login failed:', error);
      ui.status.textContent = `Login failed: ${error?.message || 'Could not connect to Supabase.'}`;
      ui.login.disabled = false;
    }
  }

  function bindSettingsSave() {
    const saveButton = document.getElementById('saveSettings');
    if (!saveButton || saveButton.dataset.supabaseProfileBound === '1') return;
    saveButton.dataset.supabaseProfileBound = '1';

    saveButton.addEventListener('click', async () => {
      const api = window.chatSupabaseApi;
      const deviceId = getDeviceId();
      const name = document.getElementById('usernameInput')?.value?.trim() || localStorage.getItem(NAME_KEY) || 'Anonymous';
      const pfpInput = document.getElementById('profilePictureInput');
      const file = pfpInput?.files?.[0] || null;
      if (!api?.connectToSupabase || !deviceId) return;

      try {
        const connected = await api.connectToSupabase(20000);
        if (!connected) throw new Error('Supabase is not connected.');
        const saved = await api.saveProfileForDevice({ device_id: deviceId, username: name, file });
        applyProfile(saved);
        saveLocalProfile(saved);
      } catch (error) {
        console.error('[Profile] Settings save failed:', error);
      }
    }, true);
  }

  function init() {
    addStyle();
    bindSettingsSave();

    // No Supabase connection or account lookup occurs automatically here.
    // The cached profile may be displayed locally, but Log In performs the server lookup.
    const id = getDeviceId();
    if (id) {
      const cachedName = localStorage.getItem(NAME_KEY);
      if (cachedName) {
        applyProfile({
          device_id: id,
          username: cachedName,
          pfp_url: localStorage.getItem(PFP_KEY) || null,
          local_cache: true
        });
      }
    }

    const ui = buildGate();
    ui.login.addEventListener('click', () => login(ui));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();