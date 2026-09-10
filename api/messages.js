/* Chat App 2 - Supabase Realtime live chat + Supabase database history */
(() => {
    "use strict";

    const SUPABASE_URL = "https://wlvbkdzcueqkknysisfw.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
    const CHANNEL = "general";
    const MAX_MESSAGES = 500;
    const REQUEST_TIMEOUT_MS = 10000;
    const SAVE_RETRY_MS = 1000;
    const P2P_RETRY_MS = 1000;
    const DEVICE_KEY = "chat_device_id";
    const CACHE_KEY = "chat_messages_supabase_" + CHANNEL;

    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    let supabase = null;
    let realtimeChannel = null;
    let realtimeReady = false;
    let realtimeLoading = null;
    let localMessages = [];
    let loaded = false;
    let loading = null;
    let pendingLive = [];
    let pendingSave = new Map();
    let saveBusy = false;
    let sheetLikeStatus = "Supabase: connecting…";
    let statusTimer = null;
    let retryTimer = null;

    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem(DEVICE_KEY, deviceId);
    }

    const newId = () => crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);

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

    function normalize(message) {
        if (!message || typeof message !== "object") return null;

        let files = message.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); } catch (_) { files = []; }
        }

        return {
            ...message,
            id: String(message.id || message.messageId || newId()),
            timestamp: message.timestamp || message.created_at || new Date().toISOString(),
            username: String(message.username || message.name || localUsername()).trim().substring(0, 24),
            message: String(message.message ?? ""),
            image: message.image || null,
            files: Array.isArray(files) ? files : [],
            channel: String(message.channel || CHANNEL),
            device_id: String(message.device_id || "")
        };
    }

    const idOf = m => String(m?.id || m?.messageId || "");
    const timeOf = m => new Date(m?.timestamp || m?.created_at || 0).getTime() || 0;

    function usable(message) {
        if (!message || !idOf(message) || message.channel !== CHANNEL) return false;
        return Boolean(
            String(message.message || "").trim() ||
            message.image ||
            (Array.isArray(message.files) && message.files.length) ||
            message.type === "game"
        );
    }

    function localUsername() {
        for (const key of ["chat_username", "chat_name", "username", "chat_user"]) {
            const value = String(localStorage.getItem(key) || "").trim();
            if (value) return value.substring(0, 24);
        }
        const input = document.getElementById("usernameInput");
        if (input?.value?.trim()) return input.value.trim().substring(0, 24);
        return "Anonymous";
    }

    function cacheWrite() {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(localMessages.slice(-MAX_MESSAGES))); } catch (_) {}
    }

    function cacheRead() {
        try {
            const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
            return Array.isArray(value) ? value.map(normalize).filter(usable) : [];
        } catch (_) { return []; }
    }

    function merge(messages) {
        const map = new Map(localMessages.map(m => [idOf(m), m]));
        let changed = false;
        for (const raw of messages || []) {
            const message = normalize(raw);
            if (!usable(message)) continue;
            if (!map.has(idOf(message))) {
                map.set(idOf(message), message);
                changed = true;
            } else {
                map.set(idOf(message), { ...map.get(idOf(message)), ...message });
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
    // STATUS
    // ------------------------------------------------------------

    function statusBox() {
        let box = document.getElementById("chat-connection-status");
        if (box) return box;
        box = document.createElement("div");
        box.id = "chat-connection-status";
        box.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;font:12px Arial,sans-serif;pointer-events:none";
        document.documentElement.appendChild(box);
        return box;
    }

    function badge(id, text) {
        const box = statusBox();
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.style.cssText = "padding:7px 10px;border-radius:8px;background:rgba(20,20,20,.92);border:1px solid rgba(255,255,255,.15);color:#fff;box-shadow:0 3px 14px rgba(0,0,0,.25);white-space:nowrap";
            box.appendChild(el);
        }
        el.textContent = text;
    }

    function updateStatus() {
        if (realtimeReady) {
            badge("chat-p2p-status", "P2P: connected");
        } else {
            badge("chat-p2p-status", "P2P: not connected — retrying…");
        }

        if (pendingSave.size > 0) {
            badge("chat-sheet-status", `Database: saving (${pendingSave.size})…`);
        } else {
            badge("chat-sheet-status", sheetLikeStatus);
        }
    }

    function startStatus() {
        updateStatus();
        if (statusTimer) clearInterval(statusTimer);
        statusTimer = ORIGINAL_SET_INTERVAL(updateStatus, 250);
    }

    // ------------------------------------------------------------
    // SUPABASE LOADING
    // ------------------------------------------------------------

    function loadSupabaseLibrary() {
        if (window.supabase?.createClient) return Promise.resolve(window.supabase);
        if (realtimeLoading) return realtimeLoading;

        realtimeLoading = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-chat-supabase="1"]');
            if (existing) {
                existing.addEventListener("load", () => resolve(window.supabase));
                existing.addEventListener("error", reject);
                return;
            }

            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
            script.async = true;
            script.dataset.chatSupabase = "1";
            script.onload = () => window.supabase?.createClient
                ? resolve(window.supabase)
                : reject(new Error("Supabase library did not load"));
            script.onerror = () => reject(new Error("Could not load Supabase"));
            document.head.appendChild(script);
        });

        return realtimeLoading;
    }

    async function initSupabase() {
        if (supabase) return supabase;

        const lib = await loadSupabaseLibrary();
        supabase = lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
            realtime: {
                params: { eventsPerSecond: 10 },
                reconnectAfterMs: tries => [1000, 2000, 5000, 10000][Math.min(tries, 3)]
            }
        });

        subscribeRealtime();
        return supabase;
    }

    function subscribeRealtime() {
        if (!supabase) return;

        if (realtimeChannel) {
            try { supabase.removeChannel(realtimeChannel); } catch (_) {}
        }

        realtimeReady = false;
        updateStatus();

        realtimeChannel = supabase.channel("chat:" + CHANNEL, {
            config: {
                broadcast: {
                    self: false,
                    ack: true
                }
            }
        });

        realtimeChannel.on(
            "broadcast",
            { event: "chat-message" },
            payload => {
                const message = normalize(payload?.payload?.message);
                if (!usable(message)) return;
                merge([message]);
                window.dispatchEvent(new CustomEvent("chat-live-message", { detail: message }));
            }
        );

        realtimeChannel.subscribe(status => {
            if (status === "SUBSCRIBED") {
                realtimeReady = true;
                sheetLikeStatus = "Database: saved";
                flushLiveQueue();
            } else {
                realtimeReady = false;
                sheetLikeStatus = "Database: reconnecting…";
            }
            updateStatus();
        });
    }

    // ------------------------------------------------------------
    // SUPABASE DATABASE
    // ------------------------------------------------------------

    async function dbFetch(path, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            return await ORIGINAL_FETCH(SUPABASE_URL + path, {
                ...options,
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: "Bearer " + SUPABASE_KEY,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            });
        } finally {
            clearTimeout(timer);
        }
    }

    async function readJsonResponse(response) {
        const text = await response.text();
        try { return text ? JSON.parse(text) : {}; } catch (_) { return { error: text }; }
    }

    async function loadHistory() {
        if (loaded) return localMessages;
        if (loading) return loading;

        loading = (async () => {
            try {
                await initSupabase();
                const query = `/rest/v1/messages?select=id,username,channel,message,image,files,device_id,edited,created_at&channel=eq.${encodeURIComponent(CHANNEL)}&order=created_at.asc&limit=${MAX_MESSAGES}`;
                const response = await dbFetch(query);
                const data = await readJsonResponse(response);

                if (!response.ok) throw new Error(data?.message || data?.error || "History load failed");
                localMessages = [];
                merge(Array.isArray(data) ? data : []);
                sheetLikeStatus = "Database: saved";
            } catch (_) {
                localMessages = cacheRead().slice(-MAX_MESSAGES);
                sheetLikeStatus = "Database: retrying…";
                initSupabase().catch(() => {});
            }

            loaded = true;
            cacheWrite();
            updateStatus();
            return localMessages;
        })();

        return loading;
    }

    async function persistMessage(message) {
        const item = normalize(message);
        if (!usable(item)) return;
        const id = idOf(item);
        pendingSave.set(id, item);
        sheetLikeStatus = "Database: saving…";
        updateStatus();

        try {
            const response = await dbFetch("/rest/v1/messages", {
                method: "POST",
                headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                body: JSON.stringify({
                    id: item.id,
                    username: item.username,
                    channel: CHANNEL,
                    message: item.message,
                    image: item.image,
                    files: item.files,
                    device_id: item.device_id || deviceId,
                    edited: Boolean(item.edited)
                })
            });

            const data = await readJsonResponse(response);
            if (!response.ok) throw new Error(data?.message || data?.error || "Database save failed");

            pendingSave.delete(id);
            sheetLikeStatus = "Database: saved";
        } catch (_) {
            sheetLikeStatus = "Database: retrying…";
            // The message remains queued and is retried below.
        }
        updateStatus();
    }

    async function retrySaves() {
        if (saveBusy || pendingSave.size === 0) return;
        saveBusy = true;
        try {
            const batch = Array.from(pendingSave.values()).slice(0, 25);
            for (const item of batch) await persistMessage(item);
        } finally {
            saveBusy = false;
            updateStatus();
        }
    }

    ORIGINAL_SET_INTERVAL(retrySaves, SAVE_RETRY_MS);

    // ------------------------------------------------------------
    // REALTIME LIVE MESSAGE QUEUE
    // ------------------------------------------------------------

    async function broadcastMessage(message) {
        const packet = {
            type: "broadcast",
            event: "chat-message",
            payload: { message }
        };

        if (realtimeReady && realtimeChannel) {
            try {
                const result = await realtimeChannel.send(packet);
                if (result === "ok") return true;
            } catch (_) {}
        }

        pendingLive.push(message);
        if (pendingLive.length > 100) pendingLive.splice(0, pendingLive.length - 100);
        return false;
    }

    async function flushLiveQueue() {
        if (!realtimeReady || !realtimeChannel || pendingLive.length === 0) return;

        while (pendingLive.length && realtimeReady) {
            const message = pendingLive[0];
            try {
                const result = await realtimeChannel.send({
                    type: "broadcast",
                    event: "chat-message",
                    payload: { message }
                });
                if (result !== "ok") throw new Error("broadcast failed");
                pendingLive.shift();
            } catch (_) {
                break;
            }
        }
        updateStatus();
    }

    if (retryTimer) clearInterval(retryTimer);
    retryTimer = ORIGINAL_SET_INTERVAL(() => {
        initSupabase().catch(() => {});
        flushLiveQueue();
        retrySaves();
    }, P2P_RETRY_MS);

    // ------------------------------------------------------------
    // CHAT APP API
    // ------------------------------------------------------------

    async function getMessages() {
        await loadHistory();
        return {
            success: true,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: realtimeReady,
            historySource: "supabase"
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
            return { success: false, error: "Message is empty.", messages: localMessages.slice(-MAX_MESSAGES) };
        }

        // Instant local display.
        merge([message]);

        // Live P2P-style Supabase Realtime delivery.
        // If disconnected, the message stays queued until SUBSCRIBED again.
        broadcastMessage(message);

        // Permanent database save happens immediately in parallel.
        persistMessage(message);

        return {
            success: true,
            message,
            messages: localMessages.slice(-MAX_MESSAGES),
            p2p: realtimeReady,
            saving: true
        };
    }

    async function databaseAction(method, body) {
        const id = String(body?.id || "").trim();
        if (!id) return { ok: false, error: "Message ID is required." };

        if (method === "PATCH") {
            const updates = {};
            if (body.message !== undefined) updates.message = String(body.message).substring(0, 20000);
            if (body.image !== undefined) updates.image = body.image;
            if (body.files !== undefined) updates.files = Array.isArray(body.files) ? body.files : [];
            updates.edited = true;

            const response = await dbFetch(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}&device_id=eq.${encodeURIComponent(deviceId)}`, {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify(updates)
            });
            const data = await readJsonResponse(response);
            if (!response.ok) return { ok: false, error: data?.message || data?.error || "Edit failed." };
            merge(data);
            return { success: true, message: data?.[0] || null };
        }

        const response = await dbFetch(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}&device_id=eq.${encodeURIComponent(deviceId)}`, {
            method: "DELETE",
            headers: { Prefer: "return=representation" }
        });
        const data = await readJsonResponse(response);
        if (!response.ok) return { ok: false, error: data?.message || data?.error || "Delete failed." };
        localMessages = localMessages.filter(m => idOf(m) !== id);
        cacheWrite();
        return { success: true, deleted: true };
    }

    async function messagesApi(method, options) {
        const body = await readBody(options);

        if (method === "GET") return jsonResponse(await getMessages());

        if (method === "POST") {
            if (body.game_server || body.game_action || body.action === "edit" || body.action === "delete") {
                return jsonResponse(await gameOrAction(body));
            }
            return jsonResponse(await sendMessage(body));
        }

        if (method === "PATCH" || method === "DELETE") {
            return jsonResponse(await databaseAction(method, body));
        }

        return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    }

    async function gameOrAction(body) {
        // Keep the existing game API compatible with the Supabase messages table.
        if (body.action === "edit") return databaseAction("PATCH", body);
        if (body.action === "delete") return databaseAction("DELETE", body);

        const text = String(body.message || body.game_state || "").trim();
        const channel = String(body.channel || CHANNEL).trim().substring(0, 32);
        const gameDevice = String(body.device_id || deviceId).trim();

        if (!text) return { ok: false, error: "Game state is required." };

        const response = await dbFetch("/rest/v1/messages", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                username: "__GAME_SERVER__",
                channel,
                message: text,
                image: null,
                files: [],
                device_id: gameDevice,
                edited: false
            })
        });
        const data = await readJsonResponse(response);
        if (!response.ok) return { ok: false, error: data?.message || data?.error || "Game request failed." };
        return { success: true, game: Array.isArray(data) ? data[0] : data };
    }

    async function actionsApi(method, options) {
        if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
        const body = await readBody(options);
        if (body.action === "edit") return jsonResponse(await databaseAction("PATCH", body));
        if (body.action === "delete") return jsonResponse(await databaseAction("DELETE", body));
        return jsonResponse(await gameOrAction(body));
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
        connected: realtimeReady,
        queuedLiveMessages: pendingLive.length,
        pendingDatabaseSaves: pendingSave.size
    });

    startStatus();
    loadHistory().catch(() => updateStatus());

    window.addEventListener("beforeunload", () => {
        // Saves are already continuously retried. Try one final background save pass.
        retrySaves();
        if (supabase && realtimeChannel) {
            try { supabase.removeChannel(realtimeChannel); } catch (_) {}
        }
    });
})();
