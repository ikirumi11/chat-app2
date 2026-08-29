/*
 * SCREEN SHARE TRANSPORT
 *
 * Purpose:
 * - Exactly ONE database message represents an active screen share.
 * - Frames live inside that message; no chat-message spam.
 * - The server keeps enough timestamped frames for the largest selectable delay.
 * - Viewers download frames ahead of playback and play them locally.
 * - Frames are removed from a viewer's browser as soon as they are played.
 * - Only one host may own a channel share at a time.
 */

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const SUPABASE_URL = "https://wlvbkdzcueqkknysisfw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  const MARKER = "__SCREEN_SHARE_V2__";
  const MAX_DELAY = 10000;
  const KEEP_AFTER_LIVE = 1500;
  const body = req.body || {};
  const channel = String(body.channel || req.query?.channel || "general").trim().slice(0, 64);
  const deviceId = String(body.device_id || req.query?.device_id || "").trim().slice(0, 120);

  const json = async r => {
    try { return await r.json(); } catch { return null; }
  };

  async function getMessage() {
    const url = `${SUPABASE_URL}/rest/v1/messages?select=id,message,device_id,created_at&channel=eq.${encodeURIComponent(channel)}&username=eq.${encodeURIComponent(MARKER)}&order=created_at.desc&limit=1`;
    const r = await fetch(url, { headers });
    const d = await json(r);
    if (!r.ok) throw new Error(JSON.stringify(d));
    return Array.isArray(d) && d[0] ? d[0] : null;
  }

  function parse(row) {
    if (!row) return null;
    try {
      const x = JSON.parse(row.message || "{}");
      return { ...x, id: row.id, createdAt: row.created_at, rowDeviceId: row.device_id };
    } catch { return null; }
  }

  async function createMessage(payload) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        username: MARKER,
        channel,
        message: JSON.stringify(payload),
        image: null,
        files: [],
        device_id: deviceId,
        edited: false
      })
    });
    const d = await json(r);
    if (!r.ok) throw new Error(JSON.stringify(d));
    return Array.isArray(d) ? d[0] : d;
  }

  async function patchMessage(id, payload) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${encodeURIComponent(id)}&username=eq.${encodeURIComponent(MARKER)}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ message: JSON.stringify(payload), edited: false })
    });
    if (!r.ok) throw new Error(JSON.stringify(await json(r)));
  }

  async function deleteMessage(row) {
    if (!row) return;
    await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${encodeURIComponent(row.id)}&username=eq.${encodeURIComponent(MARKER)}`, { method: "DELETE", headers });
  }

  function cleanFrames(frames, now) {
    const list = Array.isArray(frames) ? frames : [];
    // Keep the maximum delay plus a small amount of runway. The active share row itself never expires.
    return list
      .filter(f => Number.isFinite(Number(f.t)) && typeof f.i === "string" && Number(f.t) >= now - MAX_DELAY - KEEP_AFTER_LIVE)
      .sort((a, b) => a.t - b.t);
  }

  try {
    const row = await getMessage();
    const share = parse(row);

    if (req.method === "GET") {
      if (!share || share.type !== "screen-share") {
        return res.status(200).json({ ok: true, share: null, frames: [], stats: { serverFrames: 0, readyFrames: 0 } });
      }

      const now = Date.now();
      const requestedDelay = Number(req.query?.delay);
      const delay = [0, 1000, 3000, 5000, 10000].includes(requestedDelay) ? requestedDelay : 5000;
      const after = Number(req.query?.after) || 0;
      const watching = req.query?.watch === "1";
      const frames = cleanFrames(share.frames, now);
      const ready = frames.filter(f => f.t <= now - delay && f.t > after);

      // Do not send the entire giant message back to viewers. Only metadata + frames they have not downloaded.
      return res.status(200).json({
        ok: true,
        share: {
          id: share.id,
          type: share.type,
          state: share.state,
          host: share.host,
          deviceId: share.deviceId,
          quality: share.quality,
          fps: share.fps,
          frozen: !!share.frozen,
          startedAt: share.startedAt,
          updatedAt: share.updatedAt
        },
        frames: watching ? ready : [],
        delayMs: delay,
        stats: {
          serverFrames: frames.length,
          readyFrames: frames.filter(f => f.t <= now - delay).length,
          waitingFrames: frames.filter(f => f.t > now - delay).length,
          oldest: frames[0]?.t || 0,
          newest: frames[frames.length - 1]?.t || 0
        }
      });
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed." });
    if (!deviceId) return res.status(400).json({ ok: false, error: "Missing device ID." });

    const action = String(body.action || "");

    if (action === "start") {
      // A dead share is reclaimable. A healthy share is exclusive to its host.
      if (share && share.type === "screen-share") {
        const alive = Date.now() - Number(share.updatedAt || 0) < 15000;
        if (alive && share.deviceId !== deviceId) {
          return res.status(409).json({ ok: false, error: "Someone is already sharing their screen." });
        }
        await deleteMessage(row);
      }

      const quality = Math.min(1050, Math.max(150, Number(body.quality) || 450));
      const fps = Math.min(60, Math.max(5, Number(body.fps) || 25));
      const now = Date.now();
      const payload = {
        type: "screen-share",
        state: "sharing",
        deviceId,
        host: String(body.username || "User").slice(0, 40),
        quality,
        fps,
        frozen: false,
        startedAt: now,
        updatedAt: now,
        frames: []
      };
      const created = await createMessage(payload);
      return res.status(200).json({ ok: true, shareId: created?.id });
    }

    if (!row || !share || share.type !== "screen-share" || share.deviceId !== deviceId || String(row.id) !== String(body.share_id || "")) {
      return res.status(409).json({ ok: false, error: "Screen-share session is no longer owned by you." });
    }

    if (action === "frame") {
      if (share.frozen) return res.status(204).end();
      if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
        return res.status(400).json({ ok: false, error: "Invalid frame." });
      }
      const t = Number(body.capturedAt) || Date.now();
      const now = Date.now();
      const frames = cleanFrames(share.frames, now);
      frames.push({ t, i: body.image });
      share.frames = cleanFrames(frames, now);
      share.updatedAt = now;
      await patchMessage(row.id, share);
      return res.status(204).end();
    }

    if (action === "freeze") {
      share.frozen = !!body.frozen;
      share.updatedAt = Date.now();
      await patchMessage(row.id, share);
      return res.status(204).end();
    }

    if (action === "heartbeat") {
      share.updatedAt = Date.now();
      await patchMessage(row.id, share);
      return res.status(204).end();
    }

    if (action === "stop") {
      await deleteMessage(row);
      return res.status(200).json({ ok: true, stopped: true });
    }

    return res.status(400).json({ ok: false, error: "Unknown screen-share action." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
