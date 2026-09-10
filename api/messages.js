/* Chat App 2 - Google Sheets history + real live P2P chat */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    const CHANNEL = "general";
    const MAX_MESSAGES = 500;
    const SIGNAL_MS = 500;
    const SAVE_RETRY_MS = 1000;
    const PEER_RETRY_MS = 1000;
    const PEER_RECREATE_MS = 4000;
    const REQUEST_TIMEOUT_MS = 8000;
    const CACHE_KEY = "chat_messages_persistent_v6_" + CHANNEL;
    const DEVICE_KEY = "chat_device_id";

    const peers = new Map();
    const pendingSave = new Map();
    const sheetKnownIds = new Set();

    let localMessages = [];
    let loaded = false;
    let loading = null;
    let signalBusy = false;
    let sheetBusy = false;
    let newestSheetId = "";
    let signalTimer = null;
    let sheetTimer = null;
    let statusTimer = null;
    let sheetReady = false;
    let sheetLastError = false;

    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_KEY, deviceId);
    }

    const newId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" }
        });
    }

    async function readBody(options) {
        if (!options?.body || typeof options.body !== "string") return {};
        try { return JSON.parse(options.body); } catch (_) { return {}; }
    }

    async function server(method, payload = {}, query = {}) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null) params.set(key, String(value));
        }

        const url = SERVER_URL + (params.toString() ? "?" + params.toString() : "");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
            clearTimeout(timeout);
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

    function normalize(message) {
        if (!message || typeof message !== "object") return null;

        let files = message.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); } catch (_) { files = []; }
        }

        const username = String(message.username || message.name || "").trim() || localUsername();

        return {
            ...message,
            id: String(message.id || message.messageId || newId()),
            timestamp: message.timestamp || new Date().toISOString(),
            channel: String(message.channel || CHANNEL),
            username: username.substring(0, 24),
            message: String(message.message ?? ""),
            files: Array.isArray(files) ? files : []
        };
    }

    const idOf = message => String(message?.id || message?.messageId || "");
    const timeOf = message => new Date(message?.timestamp || message?.time || 0).getTime() || 0;

    function usable(message) {
        if (!message || !idOf(message) || message.channel !== CHANNEL) return false;
        return Boolean(
            String(message.message || "").trim() ||
            message.image ||
            (Array.isArray(message.files) && message.files.length) ||
            message.type === "game"
        );
    }

    function cacheWrite() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(localMessages.slice(-MAX_MESSAGES)));
        } catch (_) {}
    }

    function cacheRead() {
        try {
            const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
            return Array.isArray(value) ? value.map(normalize).filter(usable) : [];
        } catch (_) {
            return [];
        }
    }

    function merge(messages) {
        const map = new Map(localMessages.map(message => [idOf(message), message]));
        let changed = false;

        for (const raw of messages || []) {
            const message = normalize(raw);
            if (!usable(message)) continue;
            if (!map.has(idOf(message))) {
                map.set(idOf(message), message);
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

    // ============================================================
    // STATUS INDICATORS
    // ============================================================

    function getStatusBox() {
        let box = document.getElementById("chat-connection-status");
        if (box) return box;

        box = document.createElement("div");
        box.id = "chat-connection-status";
        box.style.cssText = [
            "position:fixed",
            "right:12px",
            "bottom:12px",
            "z-index:2147483647",
            "display:flex",
            "flex-direction:column",
            "gap:6px",
            "font:12px Arial,sans-serif",
            "pointer-events:none"
        ].join(";");

        document.documentElement.appendChild(box);
        return box;
    }

    function setBadge(id, text, state) {
        const box = getStatusBox();
        let badge = document.getElementById(id);
        if (!badge) {
            badge = document.createElement("div");
            badge.id = id;
            badge.style.cssText = [
                "padding:7px 10px",
                "border-radius:8px",
                "background:rgba(20,20,20,.92)",
                "border:1px solid rgba(255,255,255,.15)",
                "color:#fff",
                "box-shadow:0 3px 14px rgba(0,0,0,.25)",
                "white-space:nowrap"
            ].join(";");
            box.appendChild(badge);
        }

        badge.textContent = text;
        badge.dataset.state = state;
    }

    function updateStatus() {
        const connected = Array.from(peers.values()).filter(peer => peer.channel?.readyState === "open").length;
        const connecting = Array.from(peers.values()).filter(peer => {
            const state = peer.pc?.connectionState;
            return !peer.channel || peer.channel.readyState !== "open" || state === "connecting" || state === "new";
        }).length;

        if (connected > 0) {
            setBadge("chat-p2p-status", `P2P: connected (${connected})`, "connected");
        } else if (connecting > 0) {
            setBadge("chat-p2p-status", "P2P: connecting… retrying", "connecting");
        } else {
            setBadge("chat-p2p-status", "P2P: not connected — retrying", "retrying");
        }

        if (pendingSave.size > 0) {
            setBadge("chat-sheet-status", `Google Sheets: saving (${pendingSave.size})…`, "saving");
        } else if (sheetReady && !sheetLastError) {
            setBadge("chat-sheet-status", "Google Sheets: saved", "saved");
        } else {
            setBadge("chat-sheet-status", "Google Sheets: retrying…", "retrying");
        }
    }

    function startStatus() {
        updateStatus();
        if (statusTimer) clearInterval(statusTimer);
        statusTimer = ORIGINAL_SET_INTERVAL(updateStatus, 250);
    }

    // ============================================================
    // GOOGLE SHEETS = PERMANENT HISTORY + BACKGROUND SAVE ONLY
    // ============================================================

    async function saveInBackground(message) {
        const item = normalize(message);
        if (!usable(item)) return;

        const id = idOf(item);
        if (sheetKnownIds.has(id)) return;
        pendingSave.set(id, item);
        sheetLastError = false;
        updateStatus();

        try {
            const result = await server("POST", {
                action: "save_batch",
                channel: CHANNEL,
                device_id: deviceId,
                messages: [item]
            });

            if (!result.res.ok || result.data?.ok === false) throw new Error("save failed");
            pendingSave.delete(id);
            sheetKnownIds.add(id);
            sheetReady = true;
            sheetLastError = false;
        } catch (_) {
            sheetLastError = true;
            // Kept in pendingSave and retried automatically every second.
        }
        updateStatus();
    }

    async function retrySaves() {
        if (!pendingSave.size) {
            updateStatus();
            return;
        }

        const batch = Array.from(pendingSave.values()).slice(0, 25);
        try {
            const result = await server("POST", {
                action: "save_batch",
                channel: CHANNEL,
                device_id: deviceId,
                messages: batch
            });

            if (!result.res.ok || result.data?.ok === false) throw new Error("save failed");

            for (const item of batch) {
                pendingSave.delete(idOf(item));
                sheetKnownIds.add(idOf(item));
            }
            sheetReady = true;
            sheetLastError = false;
        } catch (_) {
            sheetLastError = true;
        }
        updateStatus();
    }

    ORIGINAL_SET_INTERVAL(retrySaves, SAVE_RETRY_MS);

    // ============================================================
    // REAL P2P LIVE CHAT
    // Google Sheets is ONLY history/signaling/persistence.
    // Messages themselves travel over RTCDataChannel when connected.
    // ============================================================

    function sendPacket(peer, packet) {
        if (!peer) return false;

        const text = JSON.stringify(packet);
        if (peer.channel?.readyState === "open") {
            try {
                peer.channel.send(text);
                return true;
            } catch (_) {}
        }

        peer.outbox.push(text);
        if (peer.outbox.length > 100) peer.outbox.splice(0, peer.outbox.length - 100);
        return false;
    }

    function flushOutbox(peer) {
        if (!peer?.channel || peer.channel.readyState !== "open") return;
        while (peer.outbox.length) {
            try {
                peer.channel.send(peer.outbox.shift());
            } catch (_) {
                break;
            }
        }
    }

    function broadcast(packet, exceptId = "") {
        for (const [id, peer] of peers) {
            if (id !== exceptId) sendPacket(peer, packet);
        }
    }

    function receiveLiveMessage(peerId, rawMessage) {
        const message = normalize(rawMessage);
        if (!usable(message)) return;

        const existed = localMessages.some(item => idOf(item) === idOf(message));
        const changed = merge([message]);

        if (!existed && changed) {
            broadcast({
                type: "message",
                from: deviceId,
                message
            }, peerId);
        }

        if (!sheetKnownIds.has(idOf(message))) saveInBackground(message);
    }

    function attachChannel(peerId, channel) {
        const peer = peers.get(peerId);
        if (!peer) return;

        peer.channel = channel;
        peer.lastStateChange = Date.now();
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
            peer.connectedAt = Date.now();
            peer.lastStateChange = Date.now();
            peer.retries = 0;
            flushOutbox(peer);
            window.dispatchEvent(new CustomEvent("chat-p2p-connected", { detail: { peerId } }));
            updateStatus();
        };

        channel.onmessage = event => {
            try {
                const packet = JSON.parse(event.data);
                if (packet?.type === "message") receiveLiveMessage(peerId, packet.message);
            } catch (_) {}
        };

        channel.onerror = () => {
            peer.lastStateChange = Date.now();
            updateStatus();
        };

        channel.onclose = () => {
            if (peer.channel === channel) peer.channel = null;
            peer.lastStateChange = Date.now();
            updateStatus();
        };
    }

    function createPeer(peerId, force = false) {
        let peer = peers.get(peerId);

        if (!force && peer?.pc && !["closed", "failed"].includes(peer.pc.connectionState)) {
            return peer;
        }

        if (peer?.pc) {
            try { peer.pc.close(); } catch (_) {}
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        peer = {
            id: peerId,
            pc,
            channel: null,
            outbox: peer?.outbox || [],
            remoteDescriptionSet: false,
            pendingIce: [],
            makingOffer: false,
            lastStateChange: Date.now(),
            retries: peer?.retries || 0
        };

        peers.set(peerId, peer);

        pc.ondatachannel = event => attachChannel(peerId, event.channel);

        pc.onicecandidate = event => {
            if (!event.candidate) return;
            server("POST", {
                action: "signal_push",
                to: peerId,
                from: deviceId,
                signal: { type: "ice", candidate: event.candidate }
            }).catch(() => {});
        };

        pc.onicecandidateerror = () => {};

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            peer.lastStateChange = Date.now();

            if (state === "connected") {
                peer.retries = 0;
                window.dispatchEvent(new CustomEvent("chat-p2p-connected", { detail: { peerId } }));
            }

            if (state === "failed" || state === "closed") {
                try { pc.close(); } catch (_) {}
                if (peers.get(peerId)?.pc === pc) peers.delete(peerId);
            }
            updateStatus();
        };

        pc.oniceconnectionstatechange = () => {
            peer.lastStateChange = Date.now();
            if (pc.iceConnectionState === "failed") {
                try { pc.restartIce(); } catch (_) {}
            }
        };

        return peer;
    }

    async function makeOffer(peerId, force = false) {
        const peer = createPeer(peerId, force);
        if (peer.channel?.readyState === "open" || peer.makingOffer) return;

        peer.makingOffer = true;
        peer.retries++;
        try {
            if (!peer.channel) {
                attachChannel(peerId, peer.pc.createDataChannel("chat", { ordered: true }));
            }

            const offer = await peer.pc.createOffer();
            await peer.pc.setLocalDescription(offer);

            await server("POST", {
                action: "signal_push",
                to: peerId,
                from: deviceId,
                signal: { type: "offer", sdp: peer.pc.localDescription }
            });
        } catch (_) {
            try { peer.pc.close(); } catch (_) {}
            if (peers.get(peerId)?.pc === peer.pc) peers.delete(peerId);
        } finally {
            peer.makingOffer = false;
        }
    }

    async function addPendingIce(peer) {
        const candidates = peer.pendingIce.splice(0);
        for (const candidate of candidates) {
            try { await peer.pc.addIceCandidate(candidate); } catch (_) {}
        }
    }

    async function handleSignal(item) {
        const from = String(item?.from || "");
        const signal = item?.signal;
        if (!from || from === deviceId || !signal) return;

        const peer = createPeer(from);

        if (signal.type === "ice") {
            if (peer.remoteDescriptionSet) {
                try { await peer.pc.addIceCandidate(signal.candidate); } catch (_) {}
            } else {
                peer.pendingIce.push(signal.candidate);
            }
            return;
        }

        if (signal.type === "offer") {
            try {
                await peer.pc.setRemoteDescription(signal.sdp);
                peer.remoteDescriptionSet = true;
                await addPendingIce(peer);

                const answer = await peer.pc.createAnswer();
                await peer.pc.setLocalDescription(answer);

                await server("POST", {
                    action: "signal_push",
                    to: from,
                    from: deviceId,
                    signal: { type: "answer", sdp: peer.pc.localDescription }
                });
            } catch (_) {
                if (peers.get(from)?.pc === peer.pc) peers.delete(from);
            }
            return;
        }

        if (signal.type === "answer") {
            if (peer.pc.signalingState !== "have-local-offer") return;
            try {
                await peer.pc.setRemoteDescription(signal.sdp);
                peer.remoteDescriptionSet = true;
                await addPendingIce(peer);
            } catch (_) {}
        }
    }

    async function ensurePeerConnections(peerList) {
        const now = Date.now();

        for (const item of peerList || []) {
            const id = String(item.peer_id || "");
            if (!id || id === deviceId) continue;

            let peer = peers.get(id);
            const state = peer?.pc?.connectionState || "none";
            const channelOpen = peer?.channel?.readyState === "open";

            if (channelOpen) continue;

            // A connection that has been stuck/disconnected is destroyed and rebuilt.
            if (peer && (state === "disconnected" || state === "connecting" || state === "new") && now - (peer.lastStateChange || now) > PEER_RECREATE_MS) {
                peer = createPeer(id, true);
            }

            const active = peer?.pc && !["closed", "failed"].includes(peer.pc.connectionState);

            // Deterministic offerer: only the lower device ID creates offers.
            // It retries every second until the data channel actually opens.
            if (deviceId < id && !active) {
                makeOffer(id, true).catch(() => {});
            } else if (deviceId < id && active && !peer.makingOffer) {
                if (now - (peer.lastOfferAttempt || 0) >= PEER_RETRY_MS) {
                    peer.lastOfferAttempt = now;
                    makeOffer(id, true).catch(() => {});
                }
            }
        }
    }

    async function signalingTick() {
        if (!loaded || signalBusy || document.hidden) return;
        signalBusy = true;

        try {
            const register = await server("POST", {
                action: "register_peer",
                peer_id: deviceId,
                channel: CHANNEL
            });

            if (!register.res.ok || register.data?.ok === false) throw new Error("peer registration failed");

            const peersResult = await server("GET", {}, {
                action: "get_peers",
                channel: CHANNEL,
                peer_id: deviceId
            });

            const peerList = Array.isArray(peersResult.data?.peers) ? peersResult.data.peers : [];
            await ensurePeerConnections(peerList);

            const signalResult = await server("GET", {}, {
                action: "signal_pull",
                peer_id: deviceId
            });

            const signals = Array.isArray(signalResult.data?.signals)
                ? signalResult.data.signals
                : [];

            signals.sort((a, b) => {
                const at = Number(a.timestamp || a.time || 0);
                const bt = Number(b.timestamp || b.time || 0);
                return at - bt;
            });

            for (const item of signals) await handleSignal(item);
        } catch (_) {
            // Never stop. The next tick retries discovery, signaling and P2P connection.
        } finally {
            signalBusy = false;
            updateStatus();
        }
    }

    function startP2P() {
        if (!loaded) return;
        signalingTick();
        if (signalTimer) clearInterval(signalTimer);
        signalTimer = ORIGINAL_SET_INTERVAL(signalingTick, SIGNAL_MS);
    }

    // ============================================================
    // STARTUP: SHEET FIRST, THEN P2P
    // ============================================================

    async function loadHistory() {
        if (loaded) return localMessages;
        if (loading) return loading;

        loading = (async () => {
            let sheetWorked = false;
            sheetLastError = false;

            try {
                const result = await server("GET", {}, {
                    channel: CHANNEL,
                    limit: MAX_MESSAGES
                });

                if (result.res.ok && result.data?.ok !== false && Array.isArray(result.data.messages)) {
                    const history = result.data.messages.map(normalize).filter(usable);

                    for (const message of history) sheetKnownIds.add(idOf(message));

                    localMessages = [];
                    merge(history);
                    sheetWorked = true;
                    sheetReady = true;
                }
            } catch (_) {
                sheetLastError = true;
            }

            if (!sheetWorked) {
                localMessages = cacheRead().slice(-MAX_MESSAGES);
            }

            localMessages = localMessages.sort((a, b) => timeOf(a) - timeOf(b)).slice(-MAX_MESSAGES);
            cacheWrite();
            newestSheetId = idOf(localMessages[localMessages.length - 1]);
            loaded = true;

            startP2P();
            startSheetWatch();
            updateStatus();

            return localMessages;
        })();

        return loading;
    }

    async function sheetWatch() {
        if (!loaded || sheetBusy || document.hidden) return;
        sheetBusy = true;

        try {
            const latest = await server("GET", {}, { channel: CHANNEL, limit: 1 });
            const newest = latest.data?.messages?.[0];
            const newestId = idOf(newest);

            if (newestId && newestId !== newestSheetId) {
                const result = await server("GET", {}, { channel: CHANNEL, limit: MAX_MESSAGES });
                if (result.res.ok && result.data?.ok !== false && Array.isArray(result.data.messages)) {
                    const history = result.data.messages.map(normalize).filter(usable);
                    for (const message of history) sheetKnownIds.add(idOf(message));
                    merge(history);
                    newestSheetId = newestId;
                    sheetReady = true;
                    sheetLastError = false;
                }
            } else if (latest.res.ok) {
                sheetReady = true;
                sheetLastError = false;
            }
        } catch (_) {
            sheetLastError = true;
        } finally {
            sheetBusy = false;
            updateStatus();
        }
    }

    function startSheetWatch() {
        if (sheetTimer) clearInterval(sheetTimer);
        sheetTimer = ORIGINAL_SET_INTERVAL(sheetWatch, 1500);
    }

    // ============================================================
    // EXISTING CHAT APP API
    // ============================================================

    async function getMessages() {
        await loadHistory();
        return {
            success: true,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: true,
            historySource: "google-sheets"
        };
    }

    async function sendMessage(body) {
        await loadHistory();

        const username = String(body?.username || body?.name || body?.displayName || localUsername()).trim().substring(0, 24) || "Anonymous";
        const text = String(body?.message ?? "").trim().substring(0, 20000);
        const files = Array.isArray(body?.files) ? body.files : [];
        const image = body?.image || null;

        const message = normalize({
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

        if (!usable(message)) {
            return { success: false, error: "Message is empty.", messages: localMessages.slice(-MAX_MESSAGES), p2p: true };
        }

        // 1. Show locally immediately.
        merge([message]);

        // 2. LIVE P2P first. Never wait for Google Sheets.
        broadcast({ type: "message", from: deviceId, message });

        // 3. Google Sheets persistence happens in the background.
        saveInBackground(message);

        return {
            success: true,
            message,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: true,
            savedInBackground: true
        };
    }

    async function messagesApi(method, options) {
        const body = await readBody(options);

        if (method === "GET") return jsonResponse(await getMessages());

        if (method === "POST") {
            if (body.game_server || body.game_action || body.action === "edit" || body.action === "delete") {
                try {
                    const result = await server("POST", body);
                    return jsonResponse(result.data, result.res.status || 200);
                } catch (error) {
                    return jsonResponse({ ok: false, error: error?.message || "Server request failed." });
                }
            }
            return jsonResponse(await sendMessage(body));
        }

        if (method === "PATCH" || method === "DELETE") {
            try {
                const result = await server("POST", {
                    action: method === "PATCH" ? "edit" : "delete",
                    ...body
                });
                return jsonResponse(result.data, result.res.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Server request failed." });
            }
        }

        return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    }

    async function actionsApi(method, options) {
        if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
        try {
            const result = await server("POST", await readBody(options));
            return jsonResponse(result.data, result.res.status || 200);
        } catch (error) {
            return jsonResponse({ ok: false, error: error?.message || "Server request failed." });
        }
    }

    window.fetch = async function(input, options = {}) {
        let url;
        try {
            url = new URL(typeof input === "string" ? input : input?.url || "", window.location.href);
        } catch (_) {
            return ORIGINAL_FETCH(input, options);
        }

        const method = String(options.method || input?.method || "GET").toUpperCase();
        const path = url.pathname.replace(/\/+$/, "") || "/";

        if (path === "/api/messages") return messagesApi(method, options);
        if (path === "/api/message-actions") return actionsApi(method, options);
        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_P2P_ENABLED = true;
    window.CHAT_APP_FAST_MODE = true;
    window.CHAT_APP_HISTORY_PERSISTENT = true;
    window.CHAT_APP_P2P_DEVICE_ID = deviceId;
    window.CHAT_APP_P2P_GET_STATUS = () => ({
        connectedPeers: Array.from(peers.values()).filter(p => p.channel?.readyState === "open").length,
        totalPeers: peers.size,
        pendingGoogleSheetSaves: pendingSave.size,
        googleSheetReady: sheetReady
    });

    startStatus();
    loadHistory().catch(() => updateStatus());

    window.addEventListener("beforeunload", () => {
        // Best-effort final persistence; normal saving already happens continuously.
        retrySaves();
        for (const peer of peers.values()) {
            try { peer.pc.close(); } catch (_) {}
        }
        try {
            navigator.sendBeacon(
                SERVER_URL,
                JSON.stringify({ action: "unregister_peer", peer_id: deviceId, channel: CHANNEL })
            );
        } catch (_) {}
    });
})();
