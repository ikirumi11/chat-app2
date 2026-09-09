/*
 * Chat App 2 - P2P chat adapter
 *
 * Live chat messages travel over WebRTC RTCDataChannels between users.
 * Google Apps Script / Sheets is used only for:
 *   1. loading old saved messages when the chat starts
 *   2. WebRTC signaling (finding peers / exchanging offers)
 *   3. periodically saving unsaved messages to Sheets
 *
 * The normal chat POST path never sends a chat message to Google Sheets.
 */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    const CHANNEL = "general";
    const SAVE_INTERVAL_MS = 10000;
    const PEER_REFRESH_MS = 2500;
    const REQUEST_TIMEOUT_MS = 10000;
    const CACHE_KEY = "chat_messages_p2p_v1_" + CHANNEL;
    const DEVICE_KEY = "chat_device_id";
    const MAX_MESSAGES = 100;

    const peers = new Map();
    let pendingSave = new Map();
    let localMessages = [];
    let loadedOldMessages = false;
    let initialLoadPromise = null;
    let saveTimer = null;
    let countdownTimer = null;
    let nextSaveAt = 0;
    let sheetConnected = false;
    let peerTimer = null;
    let signalingBusy = false;

    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_KEY, deviceId);
    }

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" }
        });
    }

    async function readBody(options) {
        if (!options?.body || typeof options.body !== "string") return {};
        try { return JSON.parse(options.body); } catch { return {}; }
    }

    async function serverRequest(method, payload = {}, query = {}) {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) params.set(key, String(value));
        });

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

            const response = await ORIGINAL_FETCH(url, options);
            const text = await response.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; }
            catch { data = { ok: false, error: text || "Invalid server response." }; }
            return { response, data };
        } finally {
            clearTimeout(timeout);
        }
    }

    function normalizeMessage(message) {
        if (!message || typeof message !== "object") return null;
        let files = message.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); } catch { files = []; }
        }
        return {
            ...message,
            id: String(message.id || message.messageId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))),
            channel: String(message.channel || CHANNEL),
            username: String(message.username || "Anonymous"),
            message: String(message.message || ""),
            files: Array.isArray(files) ? files : []
        };
    }

    function messageId(message) {
        return String(message?.id || message?.messageId || "");
    }

    function sortMessages(messages) {
        return messages.sort((a, b) => {
            const at = new Date(a?.timestamp || a?.time || a?.createdAt || 0).getTime() || 0;
            const bt = new Date(b?.timestamp || b?.time || b?.createdAt || 0).getTime() || 0;
            return at - bt;
        });
    }

    function writeLocalCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                time: Date.now(),
                messages: localMessages.slice(-MAX_MESSAGES)
            }));
        } catch (_) {}
    }

    function readLocalCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!Array.isArray(data?.messages)) return null;
            return data.messages.map(normalizeMessage).filter(Boolean);
        } catch (_) {
            return null;
        }
    }

    function mergeMessages(messages, markForSave = false) {
        let changed = false;
        const byId = new Map(localMessages.map(m => [messageId(m), m]));

        for (const raw of messages || []) {
            const message = normalizeMessage(raw);
            if (!message || message.channel !== CHANNEL || !messageId(message)) continue;
            const id = messageId(message);
            if (!byId.has(id)) {
                byId.set(id, message);
                changed = true;
                if (markForSave) pendingSave.set(id, message);
            }
        }

        if (changed) {
            localMessages = sortMessages(Array.from(byId.values())).slice(-MAX_MESSAGES);
            writeLocalCache();
        }
        return changed;
    }

    function makeMessage(body) {
        return normalizeMessage({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
            timestamp: new Date().toISOString(),
            username: String(body.username || "Anonymous").trim().substring(0, 24),
            message: String(body.message || "").trim().substring(0, 20000),
            image: body.image || null,
            files: Array.isArray(body.files) ? body.files : [],
            channel: CHANNEL,
            device_id: deviceId
        });
    }

    function ensureSaveUI() {
        if (document.getElementById("chatSaveCountdown")) return;

        const style = document.createElement("style");
        style.id = "chatSaveCountdownStyle";
        style.textContent = `
            #chatSaveCountdown{display:inline-flex;align-items:center;margin-left:10px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);color:#aeb7c3;font:12px Arial,sans-serif;white-space:nowrap}
            #chatSaveCountdown.saving{color:#fff;background:rgba(255,255,255,.13)}
        `;
        document.head.appendChild(style);

        const channel = document.querySelector(".header .channel");
        if (channel) {
            const badge = document.createElement("span");
            badge.id = "chatSaveCountdown";
            badge.textContent = "Connecting to messages...";
            channel.appendChild(badge);
        }
    }

    function updateSaveCountdown(text, saving = false) {
        ensureSaveUI();
        const el = document.getElementById("chatSaveCountdown");
        if (!el) return;
        el.textContent = text;
        el.classList.toggle("saving", saving);
    }

    function getNextGlobalSaveTime() {
        const now = Date.now();
        return Math.ceil((now + 1) / SAVE_INTERVAL_MS) * SAVE_INTERVAL_MS;
    }

    function startSaveCountdown() {
        if (!sheetConnected) return;

        nextSaveAt = getNextGlobalSaveTime();

        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = ORIGINAL_SET_INTERVAL(() => {
            if (!sheetConnected) {
                updateSaveCountdown("Connecting to messages...");
                return;
            }

            const remaining = Math.max(0, nextSaveAt - Date.now());
            const seconds = Math.ceil(remaining / 1000);
            updateSaveCountdown(remaining <= 0 ? "Saving..." : `Saving in ${seconds}s`, remaining <= 0);
        }, 250);

        const remaining = Math.max(0, nextSaveAt - Date.now());
        updateSaveCountdown(`Saving in ${Math.ceil(remaining / 1000)}s`);
    }

    async function savePendingMessages() {
        if (!sheetConnected) return;

        if (!pendingSave.size) {
            startSaveCountdown();
            return;
        }

        const batch = Array.from(pendingSave.values()).slice(0, 100);
        if (!batch.length) return;

        updateSaveCountdown("Saving...", true);

        try {
            const { response, data } = await serverRequest("POST", {
                action: "save_batch",
                channel: CHANNEL,
                device_id: deviceId,
                messages: batch
            });

            if (!response.ok || data?.ok === false) throw new Error(data?.error || "Save failed");

            for (const message of batch) {
                const id = messageId(message);
                if (id) pendingSave.delete(id);
            }
        } catch (error) {
            console.warn("P2P chat cloud save failed; will retry:", error);
        }

        startSaveCountdown();
    }

    function startSaveLoop() {
        if (!sheetConnected) return;
        if (saveTimer) clearInterval(saveTimer);
        startSaveCountdown();
        saveTimer = ORIGINAL_SET_INTERVAL(() => {
            if (Date.now() >= nextSaveAt) savePendingMessages();
        }, 250);
    }

    function broadcast(packet, exceptPeerId = "") {
        const text = JSON.stringify(packet);
        for (const [id, peer] of peers) {
            if (id === exceptPeerId) continue;
            if (peer.channel?.readyState === "open") {
                try { peer.channel.send(text); } catch (_) {}
            }
        }
    }

    function setupDataChannel(peerId, channel) {
        const peer = peers.get(peerId);
        if (!peer) return;
        peer.channel = channel;

        channel.onopen = () => {
            channel.send(JSON.stringify({
                type: "hello",
                from: deviceId,
                messages: localMessages.slice(-MAX_MESSAGES)
            }));
        };

        channel.onmessage = event => {
            try {
                const packet = JSON.parse(event.data);
                if (packet.type === "chat_message") {
                    const changed = mergeMessages([packet.message], true);
                    if (changed) broadcast(packet, peerId);
                } else if (packet.type === "chat_sync") {
                    const changed = mergeMessages(packet.messages || [], true);
                    if (changed) broadcast(packet, peerId);
                } else if (packet.type === "hello") {
                    const changed = mergeMessages(packet.messages || [], true);
                    if (changed) {
                        try {
                            channel.send(JSON.stringify({
                                type: "chat_sync",
                                from: deviceId,
                                messages: localMessages.slice(-MAX_MESSAGES)
                            }));
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        };

        channel.onclose = () => {
            if (peer.channel === channel) peer.channel = null;
        };
    }

    function createPeer(peerId) {
        let peer = peers.get(peerId);
        if (peer?.pc) return peer;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        });

        peer = { id: peerId, pc, channel: null, createdAt: Date.now() };
        peers.set(peerId, peer);

        pc.ondatachannel = event => setupDataChannel(peerId, event.channel);
        pc.onconnectionstatechange = () => {
            if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
                setTimeout(() => {
                    const current = peers.get(peerId);
                    if (current?.pc === pc) {
                        try { pc.close(); } catch (_) {}
                        peers.delete(peerId);
                    }
                }, 5000);
            }
        };

        return peer;
    }

    async function createOffer(peerId) {
        if (peerId === deviceId) return;
        const peer = createPeer(peerId);
        if (peer.channel) return;

        const channel = peer.pc.createDataChannel("chat", { ordered: true });
        setupDataChannel(peerId, channel);

        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        await waitForIceComplete(peer.pc);

        await serverRequest("POST", {
            action: "signal_push",
            to: peerId,
            from: deviceId,
            signal: { type: "offer", sdp: peer.pc.localDescription }
        });
    }

    async function handleSignal(signal) {
        const from = String(signal?.from || "");
        const payload = signal?.signal;
        if (!from || from === deviceId || !payload) return;

        const peer = createPeer(from);

        if (payload.type === "offer") {
            await peer.pc.setRemoteDescription(payload.sdp);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            await waitForIceComplete(peer.pc);

            await serverRequest("POST", {
                action: "signal_push",
                to: from,
                from: deviceId,
                signal: { type: "answer", sdp: peer.pc.localDescription }
            });
        } else if (payload.type === "answer") {
            if (peer.pc.signalingState === "have-local-offer") {
                await peer.pc.setRemoteDescription(payload.sdp);
            }
        }
    }

    function waitForIceComplete(pc) {
        if (pc.iceGatheringState === "complete") return Promise.resolve();
        return new Promise(resolve => {
            const timeout = setTimeout(resolve, 5000);
            const done = () => {
                if (pc.iceGatheringState === "complete") {
                    clearTimeout(timeout);
                    pc.removeEventListener("icegatheringstatechange", done);
                    resolve();
                }
            };
            pc.addEventListener("icegatheringstatechange", done);
        });
    }

    async function signalingTick() {
        if (signalingBusy || document.hidden) return;
        signalingBusy = true;
        try {
            await serverRequest("POST", { action: "register_peer", peer_id: deviceId, channel: CHANNEL });

            const peersResult = await serverRequest("GET", {}, {
                action: "get_peers",
                channel: CHANNEL,
                peer_id: deviceId
            });

            if (peersResult.data?.peers) {
                for (const remote of peersResult.data.peers) {
                    const remoteId = String(remote.peer_id || "");
                    if (!remoteId || remoteId === deviceId) continue;
                    if (!peers.has(remoteId) && deviceId < remoteId) createOffer(remoteId).catch(() => {});
                }
            }

            const signals = await serverRequest("GET", {}, { action: "signal_pull", peer_id: deviceId });
            for (const signal of (signals.data?.signals || [])) handleSignal(signal).catch(() => {});
        } catch (_) {
            // Silent background reconnect.
        } finally {
            signalingBusy = false;
        }
    }

    function startSignaling() {
        if (peerTimer) clearInterval(peerTimer);
        signalingTick();
        peerTimer = ORIGINAL_SET_INTERVAL(signalingTick, PEER_REFRESH_MS);
    }

    async function loadOldMessages() {
        if (loadedOldMessages) return localMessages;
        if (initialLoadPromise) return initialLoadPromise;

        initialLoadPromise = (async () => {
            const cached = readLocalCache();
            if (cached?.length) localMessages = sortMessages(cached).slice(-MAX_MESSAGES);

            try {
                const { response, data } = await serverRequest("GET", {}, { channel: CHANNEL, limit: 100 });
                if (response.ok && data?.ok !== false && Array.isArray(data.messages)) {
                    sheetConnected = true;
                    mergeMessages(data.messages, false);
                    localMessages = sortMessages(localMessages).slice(-MAX_MESSAGES);
                    writeLocalCache();
                    loadedOldMessages = true;
                    startSaveLoop();
                }
            } catch (_) {
                sheetConnected = false;
            }

            if (!sheetConnected) {
                updateSaveCountdown("Waiting for messages...");
            }

            return localMessages;
        })();

        try {
            return await initialLoadPromise;
        } finally {
            initialLoadPromise = null;
        }
    }

    async function getMessages() {
        await loadOldMessages();
        startSignaling();
        return { success: true, messages: localMessages.slice(-MAX_MESSAGES) };
    }

    async function sendP2PMessage(body) {
        const message = makeMessage(body);
        mergeMessages([message], false);
        pendingSave.set(messageId(message), message);
        writeLocalCache();

        broadcast({ type: "chat_message", from: deviceId, message });

        return {
            success: true,
            message,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: true
        };
    }

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") return jsonResponse(await getMessages());

        if (method === "POST") {
            // Game state/actions continue using Apps Script. Ordinary chat does not.
            if (body.game_server || body.game_action || body.action === "edit" || body.action === "delete") {
                try {
                    const { response, data } = await serverRequest("POST", body);
                    return jsonResponse(data, response.status || 200);
                } catch (error) {
                    return jsonResponse({ ok: false, error: error?.message || "Server request failed." }, 200);
                }
            }
            return jsonResponse(await sendP2PMessage(body));
        }

        if (method === "PATCH" || method === "DELETE") {
            try {
                const { response, data } = await serverRequest("POST", {
                    action: method === "PATCH" ? "edit" : "delete",
                    ...body
                });
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Server request failed." }, 200);
            }
        }

        return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    }

    async function handleMessageActions(method, options) {
        if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
        try {
            const body = await readBody(options);
            const { response, data } = await serverRequest("POST", body);
            return jsonResponse(data, response.status || 200);
        } catch (error) {
            return jsonResponse({ ok: false, error: error?.message || "Could not connect to the server." }, 200);
        }
    }

    window.fetch = async function(input, options = {}) {
        const requestUrl = typeof input === "string" ? input : input?.url || "";
        let url;
        try { url = new URL(requestUrl, window.location.href); }
        catch { return ORIGINAL_FETCH(input, options); }

        const method = String(options.method || input?.method || "GET").toUpperCase();
        const path = url.pathname.replace(/\/+$/, "") || "/";

        if (path === "/api/messages") return handleMessages(method, options, url);
        if (path === "/api/message-actions") return handleMessageActions(method, options);
        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_P2P_ENABLED = true;
    window.CHAT_APP_P2P_SAVE_INTERVAL = SAVE_INTERVAL_MS;

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSaveUI, { once: true });
    else ensureSaveUI();

    window.addEventListener("beforeunload", () => {
        if (pendingSave.size && sheetConnected) savePendingMessages();
        serverRequest("POST", { action: "unregister_peer", peer_id: deviceId, channel: CHANNEL }).catch(() => {});
    });
})();