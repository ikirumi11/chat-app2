export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const supabaseUrl = "https://wlvbkdzcueqkknysisfw.supabase.co";
    const supabaseKey = "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
    const base = supabaseUrl.replace(/\/+$/, "");
    const headers = {
        apikey: supabaseKey,
        Authorization: "Bearer " + supabaseKey,
        "Content-Type": "application/json",
        Accept: "application/json"
    };

    try {
        await cleanupExpired(base, headers);

        if (req.method === "GET") {
            const deviceId = String(req.query.device_id || "").trim().substring(0, 100);
            const session = await getSession(base, headers);

            if (!session) {
                return res.status(200).json({ active: false });
            }

            const signals = deviceId
                ? await getSignals(base, headers, session.id, deviceId)
                : [];

            return res.status(200).json({
                active: true,
                session,
                signals
            });
        }

        const body = req.body || {};
        const deviceId = String(body.device_id || "").trim().substring(0, 100);
        const username = String(body.username || "Screen Share").trim().substring(0, 24);
        const quality = Math.min(450, Math.max(1, Number(body.quality || 450)));
        const fps = Math.min(35, Math.max(1, Number(body.fps || 15)));
        const action = String(body.action || "").trim();

        if (!deviceId) {
            return res.status(400).json({ error: "Device ID is required." });
        }

        if (action === "start") {
            const existing = await getSession(base, headers);
            if (existing) {
                return res.status(409).json({
                    error: "Someone is already sharing their screen.",
                    session: existing
                });
            }

            const response = await fetch(base + "/rest/v1/screen_share_sessions", {
                method: "POST",
                headers: { ...headers, Prefer: "return=representation" },
                body: JSON.stringify({
                    id: "global",
                    host_device_id: deviceId,
                    host_username: username,
                    started_at: new Date().toISOString(),
                    heartbeat_at: new Date().toISOString(),
                    quality,
                    fps
                })
            });
            const data = await readJson(response);

            if (!response.ok) {
                // A concurrent starter can win between GET and INSERT.
                if (response.status === 409 || response.status === 23505 || response.status === 400) {
                    const current = await getSession(base, headers);
                    if (current) {
                        return res.status(409).json({ error: "Someone is already sharing their screen.", session: current });
                    }
                }
                return supabaseError(res, response, data);
            }

            const session = Array.isArray(data) ? data[0] : data;
            return res.status(200).json({ active: true, session });
        }

        if (action === "metadata") {
            const response = await fetch(
                base + "/rest/v1/screen_share_sessions?id=eq.global&host_device_id=eq." + encodeURIComponent(deviceId),
                {
                    method: "PATCH",
                    headers: { ...headers, Prefer: "return=representation" },
                    body: JSON.stringify({
                        quality: Math.min(450, Math.max(1, Number(body.quality || 450))),
                        fps: Math.min(35, Math.max(1, Number(body.fps || 15))),
                        width: Math.max(1, Number(body.width || 800)),
                        height: Math.min(450, Math.max(1, Number(body.height || 450))),
                        surface: String(body.surface || "Screen / display").substring(0, 40),
                        source_label: String(body.source_label || "Shared display").substring(0, 100)
                    })
                }
            );
            const data = await readJson(response);
            if (!response.ok) return supabaseError(res, response, data);
            return res.status(200).json({ active: Array.isArray(data) && data.length > 0, session: data?.[0] || null });
        }

        if (action === "heartbeat") {
            const response = await fetch(
                base + "/rest/v1/screen_share_sessions?id=eq.global&host_device_id=eq." + encodeURIComponent(deviceId),
                {
                    method: "PATCH",
                    headers: { ...headers, Prefer: "return=representation" },
                    body: JSON.stringify({ heartbeat_at: new Date().toISOString() })
                }
            );
            const data = await readJson(response);
            if (!response.ok) return supabaseError(res, response, data);
            return res.status(200).json({ active: Array.isArray(data) && data.length > 0, session: data?.[0] || null });
        }

        if (action === "signal") {
            const session = await getSession(base, headers);
            if (!session) return res.status(409).json({ error: "No active screen share." });

            const targetDeviceId = String(body.target_device_id || "").trim().substring(0, 100);
            const type = String(body.type || "").trim().substring(0, 32);
            const payload = body.payload;

            if (!targetDeviceId || !type || payload === undefined) {
                return res.status(400).json({ error: "Signal target, type, and payload are required." });
            }

            const response = await fetch(base + "/rest/v1/screen_share_signals", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    session_id: session.id,
                    sender_device_id: deviceId,
                    target_device_id: targetDeviceId,
                    type,
                    payload
                })
            });
            const data = await readJson(response);
            if (!response.ok) return supabaseError(res, response, data);
            return res.status(200).json({ success: true });
        }

        if (action === "stop") {
            const response = await fetch(
                base + "/rest/v1/screen_share_sessions?id=eq.global&host_device_id=eq." + encodeURIComponent(deviceId),
                {
                    method: "DELETE",
                    headers: { ...headers, Prefer: "return=representation" }
                }
            );
            const data = await readJson(response);
            if (!response.ok) return supabaseError(res, response, data);

            await fetch(
                base + "/rest/v1/screen_share_signals?session_id=eq.global",
                { method: "DELETE", headers }
            );

            return res.status(200).json({ active: false, stopped: true });
        }

        return res.status(400).json({ error: "Unknown screen share action." });
    } catch (error) {
        return res.status(500).json({ error: error?.message || "Screen share request failed." });
    }
}

async function getSession(base, headers) {
    const response = await fetch(
        base + "/rest/v1/screen_share_sessions?id=eq.global&select=id,host_device_id,host_username,started_at,heartbeat_at,quality,fps,width,height,surface,source_label&limit=1",
        { method: "GET", headers }
    );
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || data.error || "Could not read screen share state.");
    return Array.isArray(data) && data.length ? data[0] : null;
}

async function getSignals(base, headers, sessionId, targetDeviceId) {
    const url = base + "/rest/v1/screen_share_signals" +
        "?session_id=eq." + encodeURIComponent(sessionId) +
        "&target_device_id=eq." + encodeURIComponent(targetDeviceId) +
        "&select=id,sender_device_id,target_device_id,type,payload,created_at" +
        "&order=id.asc&limit=100";
    const response = await fetch(url, { method: "GET", headers });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.message || data.error || "Could not read screen share signals.");

    if (Array.isArray(data) && data.length) {
        const ids = data.map(x => x.id).filter(Boolean);
        if (ids.length) {
            await fetch(
                base + "/rest/v1/screen_share_signals?id=in.(" + ids.map(encodeURIComponent).join(",") + ")&target_device_id=eq." + encodeURIComponent(targetDeviceId),
                { method: "DELETE", headers }
            );
        }
    }
    return Array.isArray(data) ? data : [];
}

async function cleanupExpired(base, headers) {
    const cutoff = new Date(Date.now() - 20000).toISOString();
    await fetch(
        base + "/rest/v1/screen_share_sessions?id=eq.global&heartbeat_at=lt." + encodeURIComponent(cutoff),
        { method: "DELETE", headers }
    );
}

async function readJson(response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { message: text }; }
}

function supabaseError(res, response, data) {
    return res.status(response.status).json({
        error: data.message || data.error || "Supabase request failed.",
        details: data
    });
}
