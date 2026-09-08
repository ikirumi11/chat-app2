/* Supabase-backed shared Public Chat.
   The server connection is started explicitly by Log In / Save Settings.
   Account lookup is never performed before the connection is confirmed.
*/
(() => {
  'use strict';

  const SUPABASE_URL = 'https://iecpzrqvvuyghybchpva.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vess5sv1LAkxmZuxXZHa5Q_Vf6Qs-Se';
  const CHANNEL = 'general';
  const TABLE = 'messages';
  const PUBLIC_CHANNEL = 'public';
  const PROFILE_BUCKET = 'profile-pictures';
  const originalFetch = window.fetch.bind(window);

  if (!window.supabase?.createClient) {
    console.error('[Supabase] Supabase JS client was not loaded.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    realtime: { params: { eventsPerSecond: 20 } }
  });
  window.chatSupabase = client;

  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

  const uuid = value => {
    if (!value) return crypto.randomUUID();
    const s = String(value);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : crypto.randomUUID();
  };

  const getDeviceId = () => String(localStorage.getItem('chat_device_id') || '').trim();
  const normalize = row => ({ ...row, id: String(row.id), channel: row.channel || PUBLIC_CHANNEL, username: String(row.username || 'Anonymous').slice(0, 24), message: String(row.message || ''), files: Array.isArray(row.files) ? row.files : [], edited: !!row.edited, created_at: row.created_at || new Date().toISOString(), device_id: String(row.device_id || '') });
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  async function loadMessages(limit = 500) {
    const { data, error } = await client.from(TABLE).select('*').eq('channel', CHANNEL).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).reverse().map(normalize);
  }

  async function loadAndEmitMessages() {
    const messages = await loadMessages(500);
    messages.forEach(message => emit('chat:message', message));
    emit('chat:supabase-history', { messages });
    return messages;
  }

  async function insertMessage(body) {
    const profile = window.chatSupabaseProfile || {};
    const deviceId = String(body.device_id || getDeviceId()).trim();
    const message = {
      id: uuid(body.id), channel: CHANNEL, device_id: deviceId,
      username: String(body.username || profile.username || localStorage.getItem('chat_username') || 'Anonymous').slice(0, 24),
      pfp_url: body.pfp_url || body.profile_picture || profile.pfp_url || null,
      message: String(body.message || '').slice(0, 20000), image: body.image || null,
      files: Array.isArray(body.files) ? body.files : [], edited: false,
      game_message: body.game_message === true, created_at: body.created_at || new Date().toISOString()
    };
    if (!message.username || (!message.message && !message.image && !message.files.length)) return json({ error: 'Message, image, or files are required.' }, 400);
    const { data, error } = await client.from(TABLE).insert(message).select('*').single();
    if (error) return json({ error: error.message }, 400);
    const saved = normalize(data); emit('chat:message', saved); return json({ success: true, message: saved });
  }

  async function patchMessage(body) {
    if (!body?.id) return json({ error: 'Message ID required.' }, 400);
    const deviceId = String(body.device_id || getDeviceId()).trim();
    if (!deviceId) return json({ error: 'Device ID required.' }, 400);
    const { data, error } = await client.from(TABLE).update({ message: String(body.message || '').slice(0, 20000), image: body.image || null, files: Array.isArray(body.files) ? body.files : [], edited: true, updated_at: new Date().toISOString() }).eq('id', uuid(body.id)).eq('device_id', deviceId).select('*').single();
    if (error) return json({ error: error.message }, 400);
    const message = normalize(data); emit('chat:message-edit', message); return json({ success: true, message });
  }

  async function deleteMessage(body) {
    if (body?.delete_all) {
      const { error } = await client.from(TABLE).delete().eq('channel', CHANNEL);
      if (error) return json({ error: error.message }, 400);
      emit('chat:messages-clear'); return json({ success: true });
    }
    if (!body?.id) return json({ error: 'Message ID required.' }, 400);
    const deviceId = String(body.device_id || getDeviceId()).trim();
    if (!deviceId) return json({ error: 'Device ID required.' }, 400);
    const { error } = await client.from(TABLE).delete().eq('id', uuid(body.id)).eq('device_id', deviceId);
    if (error) return json({ error: error.message }, 400);
    emit('chat:message-delete', { id: body.id }); return json({ success: true });
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!url.includes('/api/messages')) return originalFetch(input, init);
    let body = {};
    if (init.body) { try { body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; } catch {} }
    if (body?.game_server) return originalFetch(input, init);
    const method = String(init.method || input?.method || 'GET').toUpperCase();
    try {
      if (!supabaseConnected) return json({ error: 'Supabase is not connected yet.' }, 503);
      if (method === 'GET') return json({ messages: await loadMessages(500) });
      if (method === 'POST') return insertMessage(body);
      if (method === 'PATCH') return patchMessage(body);
      if (method === 'DELETE') return deleteMessage(body);
      return originalFetch(input, init);
    } catch (error) { console.error('[Supabase] request failed:', error); return json({ error: error?.message || 'Supabase request failed.' }, 500); }
  };

  async function loadProfileForDevice(deviceId) {
    const id = String(deviceId || getDeviceId()).trim();
    if (!id) return null;
    const { data, error } = await client.from('profiles').select('id,device_id,username,pfp_url,created_at,updated_at').eq('device_id', id).maybeSingle();
    if (error) { console.error('[Supabase] profile load failed:', error); throw error; }
    if (data) {
      window.chatSupabaseProfile = data;
      if (data.username != null) localStorage.setItem('chat_username', data.username);
      if (data.pfp_url) localStorage.setItem('chat_profile_picture_url', data.pfp_url); else localStorage.removeItem('chat_profile_picture_url');
      emit('chat:profile-loaded', data);
    }
    return data || null;
  }

  async function uploadProfilePicture(file, deviceId) {
    if (!file || !deviceId) return null;
    const safeExt = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png';
    const path = `${deviceId}/${crypto.randomUUID()}.${safeExt}`;
    const { error: uploadError } = await client.storage.from(PROFILE_BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined, cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { data } = client.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function saveProfileForDevice(profile = {}) {
    const deviceId = String(profile.device_id || getDeviceId()).trim();
    if (!deviceId) throw new Error('Device ID is missing.');
    const existing = window.chatSupabaseProfile || {};
    const username = String(profile.username ?? localStorage.getItem('chat_username') ?? existing.username ?? 'Anonymous').trim().slice(0, 24) || 'Anonymous';
    let pfpUrl = profile.pfp_url !== undefined ? profile.pfp_url : (existing.pfp_url || localStorage.getItem('chat_profile_picture_url') || null);
    if (profile.file instanceof File) pfpUrl = await uploadProfilePicture(profile.file, deviceId);
    const row = { id: existing.id || uuid(), device_id: deviceId, username, pfp_url: pfpUrl || null, updated_at: new Date().toISOString() };
    const { data, error } = await client.from('profiles').upsert(row, { onConflict: 'device_id' }).select('*').single();
    if (error) throw error;
    window.chatSupabaseProfile = data;
    localStorage.setItem('chat_username', data.username || 'Anonymous');
    if (data.pfp_url) localStorage.setItem('chat_profile_picture_url', data.pfp_url); else localStorage.removeItem('chat_profile_picture_url');
    emit('chat:profile-saved', data); return data;
  }

  function applyProfileToUI(profile) {
    if (!profile) return;
    const usernameInput = document.getElementById('usernameInput');
    const preview = document.getElementById('profilePicturePreview');
    const deviceInput = document.getElementById('deviceIdInput');
    if (usernameInput && profile.username != null) usernameInput.value = profile.username;
    if (preview) { preview.src = profile.pfp_url || ''; preview.style.display = profile.pfp_url ? '' : 'none'; }
    if (deviceInput) deviceInput.value = profile.device_id || getDeviceId();
  }

  let supabaseConnected = false;
  let connectionPromise = null;
  let resolveConnection = null;
  let realtimeChannel = null;
  let historyLoaded = false;
  let connecting = false;

  function resetConnectionPromise() {
    connectionPromise = new Promise(resolve => { resolveConnection = resolve; });
  }
  resetConnectionPromise();

  async function waitForConfirmedConnection(timeout = 15000) {
    if (supabaseConnected) return true;
    if (!connectionPromise) resetConnectionPromise();
    return Promise.race([
      connectionPromise.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), timeout))
    ]);
  }

  function createRealtimeChannel() {
    if (realtimeChannel) {
      try { client.removeChannel(realtimeChannel); } catch {}
    }
    realtimeChannel = client.channel('public-chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => emit('chat:message', normalize(payload.new)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => emit('chat:message-edit', normalize(payload.new)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => emit('chat:message-delete', { id: payload.old?.id }))
      .subscribe(status => {
        emit('chat:supabase-status', { status });
        if (status === 'SUBSCRIBED') {
          supabaseConnected = true;
          connecting = false;
          resolveConnection?.(true);
          console.log('[Supabase] Confirmed connected.');
          if (!historyLoaded) {
            loadAndEmitMessages().then(() => { historyLoaded = true; }).catch(error => {
              console.error('[Supabase] Could not load Public Chat history:', error);
              emit('chat:supabase-status', { status: 'ERROR', error });
            });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          supabaseConnected = false;
          connecting = false;
          historyLoaded = false;
          resetConnectionPromise();
          realtimeChannel = null;
          setTimeout(() => { if (!supabaseConnected) connectToSupabase().catch(() => {}); }, 1000);
        }
      });
    window.chatSupabaseRealtime = realtimeChannel;
  }

  async function connectToSupabase(timeout = 15000) {
    if (supabaseConnected) return true;
    if (connecting) return waitForConfirmedConnection(timeout);
    connecting = true;
    resetConnectionPromise();
    createRealtimeChannel();
    emit('chat:supabase-status', { status: 'CONNECTING' });
    return waitForConfirmedConnection(timeout);
  }

  window.chatSupabaseApi = {
    client,
    connectToSupabase,
    waitForConfirmedConnection,
    loadMessages,
    loadProfileForDevice,
    saveProfileForDevice,
    uploadProfilePicture,
    upsertProfile: profile => saveProfileForDevice(profile),
    getDeviceId,
    applyProfileToUI
  };

  // Creating the client does not connect to the server. Log In / Save Settings calls connectToSupabase().
  emit('chat:supabase-status', { status: 'IDLE' });
})();