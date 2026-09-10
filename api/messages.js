/* Chat App 2 - Google Sheets history + live P2P chat */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    const CHANNEL = "general";
    const MAX_MESSAGES = 500;
    const PEER_REFRESH_MS = 750;
    const SHEET_FALLBACK_MS = 1000;
    const REQUEST_TIMEOUT_MS = 8000;
    const CACHE_KEY = "chat_messages_persistent_v4_" + CHANNEL;
    const DEVICE_KEY = "chat_device_id";

    const peers = new Map();
    const pendingSave = new Map();
    const sheetKnownIds = new Set();

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
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
        }

        const url = SERVER_URL + (params.toString() ? "?" + params : "");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const options = {
                method,
                cache: "no-store",
                redirect: "follow",
                credentials: "omit",
                signal: controller.signal
            };

            if (method !== "GET") {
                options.headers = { "Content-Type": "text/plain;charset=utf-8" };
                options.body = JSON.stringify(payload);
            }

            const res = await ORIGINAL_FETCH(url, options);
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; }
            catch (_) { data = { ok: false, error: text }; }
            return { res, data };
        } finally {
            clearTimeout(timer);
        }
    }

    function localUsername() {
        const keys = ["chat_username", "chat_name", "username", "chat_user"];
        for (const key of keys) {
            const value = String(localStorage.getItem(key) || "").trim();
            if (value) return value.substring(0, 24);
        }

        const input = document.getElementById("usernameInput");
        if (input && String(input.value || "").trim()) {
            return String(input.value).trim().substring(0, 24);
        }

        return "Anonymous";
    }

    function normalize(m) {
        if (!m || typeof m !== "object") return null;

        let files = m.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); } catch (_) { files = []; }
        }

        const message = String(m.message ?? "");
        const username = String(m.username || m.name || "").trim() || localUsername();

        return {
            ...m,
            id: String(m.id || m.messageId || newId()),
            channel: String(m.channel || CHANNEL),
            username: username.substring(0, 24),
            message,
            files: Array.isArray(files) ? files : []
        };
    }

    const idOf = m => String(m?.id || m?.messageId || "");
    const timeOf = m => new Date(m?.timestamp || m?.time || m?.createdAt || 0).getTime() || 0;

    function isUsableMessage(m) {
        if (!m || !idOf(m) || m.channel !== CHANNEL) return false;
        return Boolean(String(m.message || "").trim() || m.image || (Array.isArray(m.files) && m.files.length) || m.type === "game");
    }

    function cacheWrite() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(localMessages.slice(-MAX_MESSAGES)));
        } catch (_) {}
    }

    function cacheRead() {
        try {
            const list = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
            return Array.isArray(list)
                ? list.map(normalize).filter(m => m && m.channel === CHANNEL && isUsableMessage(m))
                : [];
        } catch (_) {
            return [];
        }
    }

    function merge(list) {
        const map = new Map(localMessages.map(m => [idOf(m), m]));
        let changed = false;

        for (const raw of list || []) {
            const m = normalize(raw);
            if (!isUsableMessage(m)) continue;

            if (!map.has(idOf(m))) {
                map.set(idOf(m), m);
                changed = true;
            }
        }

        if (changed) {
            localMessages = Array.from(map.values())
                .sort((a, b) => timeOf(a) - timeOf(b))
                .slice(-MAX_MESSAGES);
            cacheWrite();
        }

        return changed;
    }

    // ------------------------------------------------------------
    // GOOGLE SHEETS PERSISTENCE
    // The client NEVER clears the sheet during normal chat syncing.
    // Old Sheet messages are read-only history here.
    // New messages are saved in the background.
    // ------------------------------------------------------------
    async function saveNow(message) {
        const m = normalize(message);
        if (!isUsableMessage(m)) return;

        const id = idOf(m);
        pendingSave.set(id, m);

        try {
            const { res, data } = await server("POST", {
                action: "save_batch",
                channel: CHANNEL,
                device_id: deviceId,
                messages: [m]
            });

            if (!res.ok || data?.ok === false) throw new Error(data?.error || "save failed");

            pendingSave.delete(id);
            sheetKnownIds.add(id);
        } catch (_) {
            // retrySaves() keeps the message until it is successfully saved
        }
    }

    async function retrySaves() {
        if (!pendingSave.size) return;

        const batch = Array.from(pendingSave.values()).slice(0, 25);
        try {
            const { res, data } = await server("POST", {
                action: "save_batch",
                channel: CHANNEL,
                device_id: deviceId,
                messages: batch
            });

            if (!res.ok || data?.ok === false) throw new Error("save failed");

            for (const m of batch) {
                pendingSave.delete(idOf(m));
                sheetKnownIds.add(idOf(m));
            }
        } catch (_) {}
    }

    ORIGINAL_SET_INTERVAL(retrySaves, 1500);

    // ------------------------------------------------------------
    // WEBRTC P2P LIVE CHAT
    // Google Apps Script is only used for discovery/signaling/persistence.
    // The actual live message packet travels over RTCDataChannel.
    // ------------------------------------------------------------
    function send(peer, packet) {
        if (!peer?.channel || peer.channel.readyState !== "open") return false;
        try {
            peer.channel.send(JSON.stringify(packet));
            return true;
        } catch (_) {
            return false;
        }
    }

    function broadcast(packet, except = "") {
        for (const [id, peer] of peers) {
            if (id !== except) send(peer, packet);
        }
    }

    function setupChannel(peerId, channel) {
        const peer = peers.get(peerId);
        if (!peer) return;

        peer.channel = channel;

        channel.onopen = () => {
            // Sync local state for live P2P. This does NOT automatically re-save
            // Sheet history because sheetKnownIds already contains loaded history.
            send(peer, {
                type: "hello",
                from: deviceId,
                messages: localMessages.slice(-MAX_MESSAGES)
            });
        };

        channel.onmessage = event => {
            try {
                const packet = JSON.parse(event.data);

                if (packet.type === "message") {
                    const m = normalize(packet.message);
                    if (!isUsableMessage(m)) return;

                    const wasKnown = sheetKnownIds.has(idOf(m));
                    if (merge([m])) {
                        broadcast(packet, peerId);
                    }

                    // Only newly-created/not-yet-persisted messages are saved.
                    if (!wasKnown) saveNow(m);
                    return;
                }

                if (packet.type === "hello" || packet.type === "sync") {
                    const incoming = Array.isArray(packet.messages) ? packet.messages : [];
                    const newMessages = [];

                    for (const raw of incoming) {
                        const m = normalize(raw);
                        if (!isUsableMessage(m)) continue;

                        const id = idOf(m);
                        const existed = localMessages.some(x => idOf(x) === id);
                        const wasInSheet = sheetKnownIds.has(id);

                        if (merge([m]) && !existed) newMessages.push(m);
                        if (!wasInSheet && !pendingSave.has(id)) saveNow(m);
                    }

                    if (newMessages.length) {
                        broadcast({
                            type: "sync",
                            from: deviceId,
                            messages: newMessages
                        }, peerId);
                    }

                    if (packet.type === "hello") {
                        send(peer, {
                            type: "sync",
                            from: deviceId,
                            messages: localMessages.slice(-MAX_MESSAGES)
                        });
                    }
                }
            } catch (_) {}
        };

        channel.onclose = () => {
            if (peer.channel === channel) peer.channel = null;
        };
    }

    function makePeer(id) {
        let peer = peers.get(id);
        if (peer?.pc) return peer;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        peer = {
            id,
            pc,
            channel: null,
            remoteSet: false,
            ice: [],
            offering: false
        };

        peers.set(id, peer);

        pc.ondatachannel = event => setupChannel(id, event.channel);

        pc.onicecandidate = event => {
            if (!event.candidate) return;
            server("POST", {
                action: "signal_push",
                to: id,
                from: deviceId,
                signal: { type: "ice", candidate: event.candidate }
            }).catch(() => {});
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
            const offerDescription = await peer.pc.createOffer();
            await peer.pc.setLocalDescription(offerDescription);

            await server("POST", {
                action: "signal_push",
                to: id,
                from: deviceId,
                signal: { type: "offer", sdp: peer.pc.localDescription }
            });
        } catch (_) {
            try { peer.pc.close(); } catch (_) {}
            peers.delete(id);
        } finally {
            peer.offering = false;
        }
    }

    async function flushIce(peer) {
        const list = peer.ice.splice(0);
        for (const candidate of list) {
            try { await peer.pc.addIceCandidate(candidate); } catch (_) {}
        }
    }

    async function signal(item) {
        const from = String(item?.from || "");
        const signalData = item?.signal;
        if (!from || from === deviceId || !signalData) return;

        const peer = makePeer(from);

        if (signalData.type === "ice") {
            if (peer.remoteSet) {
                try { await peer.pc.addIceCandidate(signalData.candidate); } catch (_) {}
            } else {
                peer.ice.push(signalData.candidate);
            }
            return;
        }

        if (signalData.type === "offer") {
            try {
                await peer.pc.setRemoteDescription(signalData.sdp);
                peer.remoteSet = true;
                await flushIce(peer);

                const answer = await peer.pc.createAnswer();
                await peer.pc.setLocalDescription(answer);

                await server("POST", {
                    action: "signal_push",
                    to: from,
                    from: deviceId,
                    signal: { type: "answer", sdp: peer.pc.localDescription }
                });
            } catch (_) {}
            return;
        }

        if (signalData.type === "answer" && peer.pc.signalingState === "have-local-offer") {
            try {
                await peer.pc.setRemoteDescription(signalData.sdp);
                peer.remoteSet = true;
                await flushIce(peer);
            } catch (_) {}
        }
    }

    async function signalingTick() {
        if (!loaded || signalingBusy || document.hidden) return;

        signalingBusy = true;
        try {
            await server("POST", {
                action: "register_peer",
                peer_id: deviceId,
                channel: CHANNEL
            });

            const result = await server("GET", {}, {
                action: "get_peers",
                channel: CHANNEL,
                peer_id: deviceId
            });

            for (const item of result.data?.peers || []) {
                const id = String(item.peer_id || "");
                if (id && id !== deviceId && deviceId < id && !peers.has(id)) {
                    offer(id).catch(() => {});
                }
            }

            const signals = await server("GET", {}, {
                action: "signal_pull",
                peer_id: deviceId
            });

            for (const item of signals.data?.signals || []) {
                signal(item).catch(() => {});
            }
        } catch (_) {
            // P2P keeps retrying on the next tick.
        } finally {
            signalingBusy = false;
        }
    }

    function startP2P() {
        if (!loaded) return;
        signalingTick();
        if (peerTimer) clearInterval(peerTimer);
        peerTimer = ORIGINAL_SET_INTERVAL(signalingTick, PEER_REFRESH_MS);
    }

    // ------------------------------------------------------------
    // GOOGLE SHEETS STARTUP HISTORY
    // This always happens BEFORE P2P is started.
    // Cache is only a fallback if the Sheet is temporarily unavailable.
    // ------------------------------------------------------------
    async function loadOld() {
        if (loaded) return localMessages;
        if (loading) return loading;

        loading = (async () => {
            let sheetLoaded = false;

            // First source of truth: Google Sheets.
            try {
                const result = await server("GET", {}, {
                    channel: CHANNEL,
                    limit: MAX_MESSAGES
                });

                if (result.res.ok && result.data?.ok !== false && Array.isArray(result.data.messages)) {
                    const sheetMessages = result.data.messages.map(normalize).filter(isUsableMessage);

                    // Mark every message already in the Sheet so old history is never
                    // treated as a brand-new message and re-saved by P2P sync.
                    for (const m of sheetMessages) sheetKnownIds.add(idOf(m));

                    localMessages = [];
                    merge(sheetMessages);
                    sheetLoaded = true;
                }
            } catch (_) {}

            // Only use local cache if the Sheet could not be read.
            if (!sheetLoaded) {
                localMessages = cacheRead().slice(-MAX_MESSAGES);
            }

            localMessages = localMessages
                .sort((a, b) => timeOf(a) - timeOf(b))
                .slice(-MAX_MESSAGES);

            cacheWrite();
            newestSheetId = idOf(localMessages[localMessages.length - 1]);
            loaded = true;

            // Now P2P starts, after Sheet history has been loaded.
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
            const latest = await server("GET", {}, {
                channel: CHANNEL,
                limit: 1
            });

            const newest = latest.data?.messages?.[0];
            const newestId = idOf(newest);

            if (newestId && newestId !== newestSheetId) {
                const full = await server("GET", {}, {
                    channel: CHANNEL,
                    limit: MAX_MESSAGES
                });

                if (full.res.ok && full.data?.ok !== false && Array.isArray(full.data.messages)) {
                    const messages = full.data.messages.map(normalize).filter(isUsableMessage);
                    for (const m of messages) sheetKnownIds.add(idOf(m));
                    merge(messages);
                    newestSheetId = newestId;
                }
            }
        } catch (_) {}
        finally {
            sheetBusy = false;
        }
    }

    function startSheetFallback() {
        if (sheetTimer) clearInterval(sheetTimer);
        sheetTimer = ORIGINAL_SET_INTERVAL(sheetFallback, SHEET_FALLBACK_MS);
    }

    // ------------------------------------------------------------
    // Existing Chat App API
    // ------------------------------------------------------------
    async function getMessages() {
        await loadOld();
        return {
            success: true,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: true,
            historySource: "google-sheets"
        };
    }

    async function sendMessage(body) {
        await loadOld();

        const suppliedName = String(
            body?.username || body?.name || body?.displayName || ""
        ).trim();

        const username = (suppliedName || localUsername()).substring(0, 24);
        const text = String(body?.message ?? "").trim().substring(0, 20000);
        const files = Array.isArray(body?.files) ? body.files : [];
        const image = body?.image || null;

        const m = normalize({
            id: newId(),
            timestamp: new Date().toISOString(),
            username,
            message: text,
            image,
            files,
            channel: CHANNEL,
            device_id: deviceId,
            type: body?.type || "message"
        });

        if (!isUsableMessage(m)) {
            return {
                success: false,
                error: "Message is empty.",
                messages: localMessages.slice(-MAX_MESSAGES),
                p2p: true
            };
        }

        // Show immediately.
        merge([m]);

        // Live delivery is P2P and is NOT blocked by Google Sheets.
        broadcast({ type: "message", from: deviceId, message: m });

        // Save in the background. The UI never waits for this request.
        saveNow(m);

        return {
            success: true,
            message: m,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: true,
            savedInBackground: true
        };
    }

    async function messagesApi(method, options) {
        const body = await bodyOf(options);

        if (method === "GET") {
            return response(await getMessages());
        }

        if (method === "POST") {
            if (body.game_server || body.game_action || body.action === "edit" || body.action === "delete") {
                try {
                    const result = await server("POST", body);
                    return response(result.data, result.res.status || 200);
                } catch (error) {
                    return response({ ok: false, error: error?.message || "Server request failed." });
                }
            }
            return response(await sendMessage(body));
        }

        if (method === "PATCH" || method === "DELETE") {
            try {
                const result = await server("POST", {
                    action: method === "PATCH" ? "edit" : "delete",
                    ...body
                });
                return response(result.data, result.res.status || 200);
            } catch (error) {
                return response({ ok: false, error: error?.message || "Server request failed." });
            }
        }

        return response({ ok: false, error: "Method not allowed." }, 405);
    }

    async function actionsApi(method, options) {
        if (method !== "POST") return response({ error: "Method not allowed." }, 405);
        try {
            const result = await server("POST", await bodyOf(options));
            return response(result.data, result.res.status || 200);
        } catch (error) {
            return response({ ok: false, error: error?.message || "Server request failed." });
        }
    }

    window.fetch = async function(input, options = {}) {
        let url;
        try {
            url = new URL(
                typeof input === "string" ? input : input?.url || "",
                window.location.href
            );
        } catch (_) {
            return ORIGINAL_FETCH(input, options);
        }

        const method = String(options.method || input?.method || "GET").toUpperCase();
        const path = url.pathname.replace(/\/+$/, "") || "/";

        if (path === "/api/messages") return messagesApi(method, options);
        if (path === "/api/message-actions") return actionsApi(method, options);

        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_P2P_ENABLED = true;
    window.CHAT_APP_FAST_MODE = true;
    window.CHAT_APP_HISTORY_PERSISTENT = true;

    window.addEventListener("beforeunload", () => {
        retrySaves();
        server("POST", {
            action: "unregister_peer",
            peer_id: deviceId,
            channel: CHANNEL
        }).catch(() => {});
    });

    // Load Google Sheets first. P2P starts automatically after that finishes.
    loadOld().catch(() => {});
})();