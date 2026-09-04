/* Adds immutable profile snapshots to every normal local chat message. */
(() => {
  'use strict';
  const API_PATH = '/api/messages';
  const originalFetch = window.fetch.bind(window);

  function addProfileSnapshot(body) {
    if (!body || body.game_server === true || body.profile_snapshot) return body;

    const deviceId = String(body.device_id || localStorage.getItem('chat_device_id') || '');
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
    } catch {}

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
    try { data = await response.clone().json(); } catch {}
    const saved = data?.message;
    if (!saved?.id) return;

    // p2p-chat intentionally builds a safe message object. Put the immutable
    // profile snapshot back onto that exact saved record so refreshes keep the
    // name/PFP that existed when the message was sent.
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
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();

    if (!url.includes(API_PATH) || method !== 'POST') {
      return originalFetch(input, init);
    }

    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch {}
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
        console.warn('Could not attach immutable profile snapshot:', error);
      }
    }

    return response;
  };
})();
