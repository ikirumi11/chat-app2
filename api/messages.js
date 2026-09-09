/* Chat App 2 - instant P2P chat + Google Sheets persistence */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    const CHANNEL = "general";
    const MAX_MESSAGES = 100;
    const PEER_REFRESH_MS = 750;
    const SHEET_FALLBACK_MS = 750;
    const REQUEST_TIMEOUT_MS = 8000;
    const CACHE_KEY = "chat_messages_fast_v3_" + CHANNEL;
    const DEVICE_KEY = "chat_device_id";

    const peers = new Map();
    const pendingSave = new Map();
    let localMessages = [];
    let loaded = false;
    let loading = null;
    let peerTimer = null;
    let sheetTimer = null;
    let signalingBusy = false;
    let sheetBusy = false;
    let newestSheetId = "";

    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_KEY, deviceId);
    }

    const newId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

    function response(body, status = 200) {
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }

    async function bodyOf(options) {
        if (!options?.body || typeof options.body !== "string") return {};
        try { return JSON.parse(options.body); } catch (_) { return {}; }
    }

    async function server(method, payload = {}, query = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) params.set(k, String(v));
        const url = SERVER_URL + (params.toString() ? "?" + params : "");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const options = { method, cache: "no-store", redirect: "follow", credentials: "omit", signal: controller.signal };
            if (method !== "GET") {
                options.headers = { "Content-Type": "text/plain;charset=utf-8" };
                options.body = JSON.stringify(payload);
            }
            const res = await ORIGINAL_FETCH(url, options);
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { ok: false, error: text }; }
            return { res, data };
        } finally { clearTimeout(timer); }
    }

    function normalize(m) {
        if (!m || typeof m !== "object") return null;
        let files = m.files;
        if (typeof files === "string") { try { files = JSON.parse(files); } catch (_) { files = []; } }
        return {
            ...m,
            id: String(m.id || m.messageId || newId()),
            channel: String(m.channel || CHANNEL),
            username: String(m.username || "Anonymous"),
            message: String(m.message || ""),
            files: Array.isArray(files) ? files : []
        };
    }

    const idOf = m => String(m?.id || m?.messageId || "");
    const timeOf = m => new Date(m?.timestamp || m?.time || m?.createdAt || 0).getTime() || 0;

    function cacheWrite() {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(localMessages.slice(-MAX_MESSAGES))); } catch (_) {}
    }

    function cacheRead() {
        try {
            const a = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
            return Array.isArray(a) ? a.map(normalize).filter(m => m && m.channel === CHANNEL) : [];
        } catch (_) { return []; }
    }

    function merge(list, queueForSave = false) {
        const map = new Map(localMessages.map(m => [idOf(m), m]));
        let changed = false;
        for (const raw of list || []) {
            const m = normalize(raw);
            if (!m || m.channel !== CHANNEL || !idOf(m)) continue;
            if (!map.has(idOf(m))) {
                map.set(idOf(m), m);
                changed = true;
                if (queueForSave) pendingSave.set(idOf(m), m);
            }
        }
        if (changed) {
            localMessages = Array.from(map.values()).sort((a, b) => timeOf(a) - timeOf(b)).slice(-MAX_MESSAGES);
            cacheWrite();
        }
        return changed;
    }

    // ------------------------------------------------------------
    // GOOGLE SHEETS: save immediately, never block the UI
    // ------------------------------------------------------------
    async function saveNow(m) {
        if (!m) return;
        const id = idOf(m);
        if (!id) return;
        pendingSave.set(id, m);
        try {
            const { res, data } = await server("POST", { action: "save_batch", channel: CHANNEL, device_id: deviceId, messages: [m] });
            if (!res.ok || data?.ok === false) throw new Error(data?.error || "save failed");
            pendingSave.delete(id);
        } catch (_) {}
    }

    async function retrySaves() {
        if (!pendingSave.size) return;
        const batch = Array.from(pendingSave.values()).slice(0, 25);
        try {
            const { res, data } = await server("POST", { action: "save_batch", channel: CHANNEL, device_id: deviceId, messages: batch });
            if (!res.ok || data?.ok === false) throw new Error();
            for (const m of batch) pendingSave.delete(idOf(m));
        } catch (_) {}
    }
    ORIGINAL_SET_INTERVAL(retrySaves, 1500);

    // ------------------------------------------------------------
    // WebRTC P2P: live messages travel directly between browsers
    // ------------------------------------------------------------
    function send(peer, packet) {
        if (!peer?.channel || peer.channel.readyState !== "open") return false;
        try { peer.channel.send(JSON.stringify(packet)); return true; } catch (_) { return false; }
    }

    function broadcast(packet, except = "") {
        for (const [id, peer] of peers) if (id !== except) send(peer, packet);
    }

    function setupChannel(peerId, channel) {
        const peer = peers.get(peerId);
        if (!peer) return;
        peer.channel = channel;
        channel.onopen = () => send(peer, { type: "hello", from: deviceId, messages: localMessages.slice(-MAX_MESSAGES) });
        channel.onmessage = event => {
            try {
                const p = JSON.parse(event.data);
                if (p.type === "message") {
                    const m = normalize(p.message);
                    if (!m) return;
                    if (merge([m], true)) {
                        broadcast(p, peerId);
                        saveNow(m);
                    }
                } else if (p.type === "hello" || p.type === "sync") {
                    const before = new Set(localMessages.map(idOf));
                    const changed = merge(p.messages || [], true);
                    if (changed) {
                        broadcast({ type: "sync", from: deviceId, messages: localMessages.slice(-MAX_MESSAGES) }, peerId);
                        for (const raw of p.messages || []) {
                            const m = normalize(raw);
                            if (m && !before.has(idOf(m))) saveNow(m);
                        }
                    } else if (p.type === "hello") {
                        send(peer, { type: "sync", from: deviceId, messages: localMessages.slice(-MAX_MESSAGES) });
                    }
                }
            } catch (_) {}
        };
        channel.onclose = () => { if (peer.channel === channel) peer.channel = null; };
    }

    function makePeer(id) {
        let peer = peers.get(id);
        if (peer?.pc) return peer;
        const pc = new RTCPeerConnection({ iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ] });
        peer = { id, pc, channel: null, remoteSet: false, ice: [], offering: false };
        peers.set(id, peer);

        pc.ondatachannel = e => setupChannel(id, e.channel);
        pc.onicecandidate = e => {
            if (!e.candidate) return;
            server("POST", { action: "signal_push", to: id, from: deviceId, signal: { type: "ice", candidate: e.candidate } }).catch(() => {});
        };
        pc.onconnectionstatechange = () => {
            if (["failed", "closed"].includes(pc.connectionState)) {
                try { pc.close(); } catch (_) {}
                if (peers.get(id)?.pc === pc) peers.delete(id);
            }
        };
        return peer;
    }

    async function offer(id) {
        const peer = makePeer(id);
        if (peer.channel?.readyState === "open" || peer.offering) return;
        peer.offering = true;
        try {
            setupChannel(id, peer.pc.createDataChannel("chat", { ordered: true }));
            await peer.pc.setLocalDescription(await peer.pc.createOffer());
            await server("POST", { action: "signal_push", to: id, from: deviceId, signal: { type: "offer", sdp: peer.pc.localDescription } });
        } catch (_) {
            try { peer.pc.close(); } catch (_) {}
            peers.delete(id);
        } finally { peer.offering = false; }
    }

    async function flushIce(peer) {
        const list = peer.ice.splice(0);
        for (const c of list) try { await peer.pc.addIceCandidate(c); } catch (_) {}
    }

    async function signal(s) {
        const from = String(s?.from || "");
        const p = s?.signal;
        if (!from || from === deviceId || !p) return;
        const peer = makePeer(from);
        if (p.type === "ice") {
            if (peer.remoteSet) { try { await peer.pc.addIceCandidate(p.candidate); } catch (_) {} }
            else peer.ice.push(p.candidate);
            return;
        }
        if (p.type === "offer") {
            try {
                await peer.pc.setRemoteDescription(p.sdp);
                peer.remoteSet = true;
                await flushIce(peer);
                await peer.pc.setLocalDescription(await peer.pc.createAnswer());
                await server("POST", { action: "signal_push", to: from, from: deviceId, signal: { type: "answer", sdp: peer.pc.localDescription } });
            } catch (_) {}
            return;
        }
        if (p.type === "answer" && peer.pc.signalingState === "have-local-offer") {
            try { await peer.pc.setRemoteDescription(p.sdp); peer.remoteSet = true; await flushIce(peer); } catch (_) {}
        }
    }

    async function signalingTick() {
        if (signalingBusy || document.hidden) return;
        signalingBusy = true;
        try {
            await server("POST", { action: "register_peer", peer_id: deviceId, channel: CHANNEL });
            const r = await server("GET", {}, { action: "get_peers", channel: CHANNEL, peer_id: deviceId });
            for (const p of r.data?.peers || []) {
                const id = String(p.peer_id || "");
                if (id && id !== deviceId && deviceId < id && !peers.has(id)) offer(id).catch(() => {});
            }
            const s = await server("GET", {}, { action: "signal_pull", peer_id: deviceId });
            for (const item of s.data?.signals || []) signal(item).catch(() => {});
        } catch (_) {}
        finally { signalingBusy = false; }
    }

    function startP2P() {
        signalingTick();
        if (peerTimer) clearInterval(peerTimer);
        peerTimer = ORIGINAL_SET_INTERVAL(signalingTick, PEER_REFRESH_MS);
    }

    // ------------------------------------------------------------
    // Old messages + fast fallback from Google Sheets
    // ------------------------------------------------------------
    async function loadOld() {
        if (loaded) return localMessages;
        if (loading) return loading;
        loading = (async () => {
            localMessages = cacheRead().slice(-MAX_MESSAGES);
            try {
                const r = await server("GET", {}, { channel: CHANNEL, limit: MAX_MESSAGES });
                if (r.res.ok && r.data?.ok !== false && Array.isArray(r.data.messages)) merge(r.data.messages, false);
            } catch (_) {}
            localMessages = localMessages.sort((a, b) => timeOf(a) - timeOf(b)).slice(-MAX_MESSAGES);
            cacheWrite();
            newestSheetId = idOf(localMessages[localMessages.length - 1]);
            loaded = true;
            startP2P();
            startSheetFallback();
            return localMessages;
        })();
        return loading;
    }

    async function sheetFallback() {
        if (!loaded || sheetBusy || document.hidden) return;
        sheetBusy = true;
        try {
            const latest = await server("GET", {}, { channel: CHANNEL, limit: 1 });
            const m = latest.data?.messages?.[0];
            const id = idOf(m);
            if (id && id !== newestSheetId) {
                const full = await server("GET", {}, { channel: CHANNEL, limit: MAX_MESSAGES });
                if (full.res.ok && full.data?.ok !== false) merge(full.data.messages || [], false);
                newestSheetId = id;
            }
        } catch (_) {}
        finally { sheetBusy = false; }
    }

    function startSheetFallback() {
        if (sheetTimer) clearInterval(sheetTimer);
        sheetTimer = ORIGINAL_SET_INTERVAL(sheetFallback, SHEET_FALLBACK_MS);
    }

    // ------------------------------------------------------------
    // API used by the existing chat UI
    // ------------------------------------------------------------
    async function getMessages() {
        await loadOld();
        return { success: true, messages: localMessages.slice(-MAX_MESSAGES), p2p: true };
    }

    async function sendMessage(body) {
        const m = normalize({
            id: newId(),
            timestamp: new Date().toISOString(),
            username: String(body.username || "Anonymous").trim().substring(0, 24),
            message: String(body.message || "").trim().substring(0, 20000),
            image: body.image || null,
            files: Array.isArray(body.files) ? body.files : [],
            channel: CHANNEL,
            device_id: deviceId,
            type: body.type || "message"
        });

        // Instant local display.
        merge([m], false);
        cacheWrite();

        // Instant P2P delivery. No Sheet request is awaited.
        broadcast({ type: "message", from: deviceId, message: m });

        // Persist immediately in parallel.
        saveNow(m);

        return { success: true, message: m, messages: localMessages.slice(-MAX_MESSAGES), p2p: true };
    }

    async function messagesApi(method, options) {
        const body = await bodyOf(options);
        if (method === "GET") return response(await getMessages());
        if (method === "POST") {
            if (body.game_server || body.game_action || body.action === "edit" || body.action === "delete") {
                try { const r = await server("POST", body); return response(r.data, r.res.status || 200); }
                catch (e) { return response({ ok: false, error: e?.message || "Server request failed." }); }
            }
            return response(await sendMessage(body));
        }
        if (method === "PATCH" || method === "DELETE") {
            try { const r = await server("POST", { action: method === "PATCH" ? "edit" : "delete", ...body }); return response(r.data, r.res.status || 200); }
            catch (e) { return response({ ok: false, error: e?.message || "Server request failed." }); }
        }
        return response({ ok: false, error: "Method not allowed." }, 405);
    }

    async function actionsApi(method, options) {
        if (method !== "POST") return response({ error: "Method not allowed." }, 405);
        try { const r = await server("POST", await bodyOf(options)); return response(r.data, r.res.status || 200); }
        catch (e) { return response({ ok: false, error: e?.message || "Server request failed." }); }
    }

    window.fetch = async function(input, options = {}) {
        let url;
        try { url = new URL(typeof input === "string" ? input : input?.url || "", window.location.href); }
        catch (_) { return ORIGINAL_FETCH(input, options); }
        const method = String(options.method || input?.method || "GET").toUpperCase();
        const path = url.pathname.replace(/\/+$/, "") || "/";
        if (path === "/api/messages") return messagesApi(method, options);
        if (path === "/api/message-actions") return actionsApi(method, options);
        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_P2P_ENABLED = true;
    window.CHAT_APP_FAST_MODE = true;

    window.addEventListener("beforeunload", () => {
        retrySaves();
        server("POST", { action: "unregister_peer", peer_id: deviceId, channel: CHANNEL }).catch(() => {});
    });

    // Start immediately; loading old messages and P2P setup happen as early as possible.
    startP2P();
})();