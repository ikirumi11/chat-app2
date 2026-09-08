/* Supabase-backed shared Public Chat.
   Uses the browser-safe publishable key only. The service_role key must never be put here.
*/
(() => {
  'use strict';

  const SUPABASE_URL = 'https://iecpzrqvvuyghybchpva.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vess5sv1LAkxmZuxXZHa5Q_Vf6Qs-Se';
  const CHANNEL = 'general';
  const TABLE = 'messages';
  const PUBLIC_CHANNEL = 'public';
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
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
      ? s : crypto.randomUUID();
  };

  const normalize = row => ({
    ...row,
    id: String(row.id),
    channel: row.channel || PUBLIC_CHANNEL,
    username: String(row.username || 'Anonymous').slice(0, 24),
    message: String(row.message || ''),
    files: Array.isArray(row.files) ? row.files : [],
    edited: !!row.edited,
    created_at: row.created_at || new Date().toISOString(),
    device_id: String(row.device_id || '')
  });

  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  async function saveLocal(message) {
    try {
      if (typeof window.p2pCacheSave === 'function') await window.p2pCacheSave(message);
      else emit('chat:p2p-message', message);
    } catch {}
  }

  async function loadMessages(limit = 500) {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('channel', CHANNEL)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).reverse().map(normalize);
  }

  async function insertMessage(body) {
    const message = {
      id: uuid(body.id),
      channel: CHANNEL,
      device_id: String(body.device_id || localStorage.getItem('chat_device_id') || ''),
      username: String(body.username || localStorage.getItem('chat_username') || 'Anonymous').slice(0, 24),
      pfp_url: body.pfp_url || body.profile_picture || null,
      message: String(body.message || '').slice(0, 20000),
      image: body.image || null,
      files: Array.isArray(body.files) ? body.files : [],
      edited: false,
      game_message: body.game_message === true,
      created_at: body.created_at || new Date().toISOString()
    };

    if (!message.username || (!message.message && !message.image && !message.files.length)) {
      return json({ error: 'Message, image, or files are required.' }, 400);
    }

    const { data, error } = await client.from(TABLE).insert(message).select('*').single();
    if (error) {
      console.error('[Supabase] insert failed:', error);
      return json({ error: error.message }, 400);
    }

    const saved = normalize(data);
    emit('chat:p2p-message', saved);
    return json({ success: true, message: saved });
  }

  async function patchMessage(body) {
    if (!body?.id) return json({ error: 'Message ID required.' }, 400);
    const id = uuid(body.id);
    const changes = {
      message: String(body.message || '').slice(0, 20000),
      image: body.image || null,
      files: Array.isArray(body.files) ? body.files : [],
      edited: true,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from(TABLE).update(changes).eq('id', id).select('*').single();
    if (error) return json({ error: error.message }, 400);
    const message = normalize(data);
    emit('chat:p2p-edit', message);
    return json({ success: true, message });
  }

  async function deleteMessage(body) {
    if (body?.delete_all) {
      const { error } = await client.from(TABLE).delete().eq('channel', CHANNEL);
      if (error) return json({ error: error.message }, 400);
      emit('chat:p2p-clear');
      return json({ success: true });
    }
    if (!body?.id) return json({ error: 'Message ID required.' }, 400);
    const id = uuid(body.id);
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) return json({ error: error.message }, 400);
    emit('chat:p2p-delete', { id });
    return json({ success: true });
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (!url.includes('/api/messages')) return originalFetch(input, init);

    let body = {};
    if (init.body) {
      try { body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; } catch {}
    }

    // Game-server state is still handled by the existing game/P2P layer.
    if (body?.game_server) return originalFetch(input, init);

    const method = String(init.method || input?.method || 'GET').toUpperCase();
    try {
      if (method === 'GET') return json({ messages: await loadMessages(500) });
      if (method === 'POST') return insertMessage(body);
      if (method === 'PATCH') return patchMessage(body);
      if (method === 'DELETE') return deleteMessage(body);
      return originalFetch(input, init);
    } catch (error) {
      console.error('[Supabase] request failed:', error);
      return json({ error: error?.message || 'Supabase request failed.' }, 500);
    }
  };

  const realtimeChannel = client
    .channel('public-chat-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => {
      const message = normalize(payload.new);
      emit('chat:p2p-message', message);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => {
      emit('chat:p2p-edit', normalize(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE, filter: `channel=eq.${CHANNEL}` }, payload => {
      emit('chat:p2p-delete', { id: payload.old?.id });
    })
    .subscribe(status => {
      window.dispatchEvent(new CustomEvent('chat:supabase-status', { detail: { status } }));
      if (status === 'SUBSCRIBED') console.log('[Supabase] Public Chat realtime connected.');
    });

  window.chatSupabaseRealtime = realtimeChannel;

  // Keep the existing local-cache/UI event system working while Supabase is authoritative.
  loadMessages().then(messages => {
    messages.forEach(message => emit('chat:p2p-message', message));
    window.dispatchEvent(new CustomEvent('chat:supabase-history', { detail: { messages } }));
  }).catch(error => {
    console.error('[Supabase] Could not load Public Chat history:', error);
    window.dispatchEvent(new CustomEvent('chat:supabase-status', { detail: { status: 'ERROR', error } }));
  });

  // Expose small helpers for profile integrations and debugging.
  window.chatSupabaseApi = {
    client,
    loadMessages,
    upsertProfile: async profile => {
      const row = {
        id: uuid(profile?.id),
        device_id: String(profile?.device_id || localStorage.getItem('chat_device_id') || ''),
        username: String(profile?.username || 'Anonymous').slice(0, 24),
        pfp_url: profile?.pfp_url || null,
        updated_at: new Date().toISOString()
      };
      return client.from('profiles').upsert(row, { onConflict: 'device_id' }).select('*').single();
    }
  };
})();
