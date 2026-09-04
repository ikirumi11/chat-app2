/*
 * Ensures normal chat writes contain an immutable profile snapshot and are
 * compatible with the local parent storage bridge.
 */
(() => {
  'use strict';

  const API_PATH = '/api/messages';
  const originalFetch = window.fetch.bind(window);

  function addProfileSnapshot(body) {
    if (!body || body.game_server === true || body.profile_snapshot) return body;

    const deviceId = String(
      body.device_id || localStorage.getItem('chat_device_id') || ''
    );

    let snapshot = null;

    try {
      const profiles = window.__chatProfiles?.get?.() || {};
      const profile = profiles[deviceId];
      if (profile) {
        snapshot = {
          name: String(profile.name || body.username || 'User').slice(0, 24),
          pfp: typeof profile.pfp === 'string' ? profile.pfp : '',
          updatedAt: Number(profile.updatedAt || Date.now())
        };
      }
    } catch (_) {}

    if (!snapshot) {
      snapshot = {
        name: String(body.username || 'User').slice(0, 24),
        pfp: '',
        updatedAt: Date.now()
      };
    }

    return {
      ...body,
      profile_snapshot: snapshot,
      profile_name: snapshot.name,
      profile_pfp: snapshot.pfp
    };
  }

  async function restoreSnapshotIntoLocalMessage(response, prepared) {
    if (!prepared?.profile_snapshot || !window.__chatP2P?.putMessage) return;

    let data = null;
    try { data = await response.clone().json(); } catch (_) {}

    const saved = data?.message;
    if (!saved?.id) return;

    const withSnapshot = {
      ...saved,
      profile_snapshot: prepared.profile_snapshot,
      profile_name: prepared.profile_snapshot.name,
      profile_pfp: prepared.profile_snapshot.pfp
    };

    await window.__chatP2P.putMessage(withSnapshot);
  }

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = String(
      init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET'
    ).toUpperCase();

    if (!url.includes(API_PATH) || method !== 'POST') {
      return originalFetch(input, init);
    }

    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch (_) {}
    }

    if (body.game_server === true) return originalFetch(input, init);

    const prepared = addProfileSnapshot(body);
    const response = await originalFetch(input, {
      ...init,
      body: JSON.stringify(prepared)
    });

    if (response.ok) {
      try {
        await restoreSnapshotIntoLocalMessage(response, prepared);
      } catch (error) {
        console.warn('[Chat2] Could not attach immutable profile snapshot:', error);
      }
    }

    return response;
  };

  // Public helper for code that wants to explicitly store a normal app value.
  // The parent bridge is preferred; localStorage remains the fallback.
  window.__chat2LocalSave = async (key, value) => {
    if (window.__googleSitesStorage?.available?.()) {
      try {
        await window.__googleSitesStorage.set(key, value);
        return { ok: true, backend: 'parent-local' };
      } catch (error) {
        console.warn('[Chat2] Parent local save failed, using localStorage:', error);
      }
    }

    localStorage.setItem(String(key), typeof value === 'string' ? value : JSON.stringify(value));
    return { ok: true, backend: 'localStorage' };
  };
})();
