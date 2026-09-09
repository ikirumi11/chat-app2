/*
 * Chat App 2 - Google Apps Script API adapter
 * Near-instant Google Sheets chat sync.
 *
 * Strategy:
 *  - First load gets the full recent message list once.
 *  - After that, the client checks ONLY the newest message very frequently.
 *  - If the newest message changed, it downloads the full recent list.
 *  - Cached data is returned immediately so the UI never waits for Sheets.
 *  - Chat refresh interval is reduced from 500ms to 100ms without changing
 *    other 500ms timers such as voice-recording timers.
 *  - Sending refreshes the local cache immediately when the server returns data.
 */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const ORIGINAL_SET_INTERVAL = window.setInterval.bind(window);

    const RETRY_MS = 750;
    const REQUEST_TIMEOUT_MS = 10000;

    // 100ms UI refresh. The server probe is slightly slower so we do not
    // hammer Google Apps Script unnecessarily.
    const APP_REFRESH_MS = 100;
    const LATEST_CHECK_MS = 150;

    const CACHE_KEY_PREFIX = "chat_messages_cache_v3_";
    const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

    const inflightGets = new Map();
    const inflightLatest = new Map();
    const lastFullRefresh = new Map();
    const latestWatchers = new Map();

    function installFastRefreshTimer() {
        // app.js uses setInterval(loadMessages, 500). Replace ONLY that timer.
        // This avoids changing unrelated 500ms timers in the application.
        if (window.__CHAT_FAST_INTERVAL_PATCHED__) return;
        window.__CHAT_FAST_INTERVAL_PATCHED__ = true;

        window.setInterval = function(callback, delay, ...args) {
            let actualDelay = delay;

            if (
                delay === 500 &&
                typeof callback === "function" &&
                callback.name === "loadMessages"
            ) {
                actualDelay = APP_REFRESH_MS;
            }

            return ORIGINAL_SET_INTERVAL(callback, actualDelay, ...args);
        };
    }

    function installConnectionUI() {
        if (!document.body || document.getElementById("chatConnectionLoader")) return;

        if (!document.getElementById("chatConnectionLoaderStyle")) {
            const style = document.createElement("style");
            style.id = "chatConnectionLoaderStyle";
            style.textContent = `
                #chatConnectionLoader{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .15s ease}
                #chatConnectionLoader.show{opacity:1}
                #chatConnectionLoader .chat-loader-box{display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:14px;background:rgba(20,20,20,.94);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 35px rgba(0,0,0,.35);color:#fff;font:14px Arial,sans-serif}
                #chatConnectionLoader .chat-spinner{width:20px;height:20px;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:chatConnectionSpin .7s linear infinite}
                @keyframes chatConnectionSpin{to{transform:rotate(360deg)}}
            `;
            document.head.appendChild(style);
        }

        const loader = document.createElement("div");
        loader.id = "chatConnectionLoader";
        loader.innerHTML = '<div class="chat-loader-box"><div class="chat-spinner"></div><span id="chatConnectionText">Connecting...</span></div>';
        document.body.appendChild(loader);
    }

    function setConnecting(visible, text) {
        installConnectionUI();
        const loader = document.getElementById("chatConnectionLoader");
        const label = document.getElementById("chatConnectionText");
        if (!loader) return;
        if (label) label.textContent = text || "Connecting...";
        loader.classList.toggle("show", visible);
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

    async function fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            return await ORIGINAL_FETCH(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async function serverRequest(method, payload = {}, query = {}) {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) params.set(key, String(value));
        });

        const url = SERVER_URL + (params.toString() ? "?" + params.toString() : "");
        const options = {
            method,
            cache: "no-store",
            redirect: "follow",
            credentials: "omit"
        };

        if (method !== "GET") {
            options.headers = { "Content-Type": "text/plain;charset=utf-8" };
            options.body = JSON.stringify(payload);
        }

        const response = await fetchWithTimeout(url, options);
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch { data = { ok: false, error: text || "Invalid server response." }; }
        return { response, data };
    }

    function normalizeMessage(message) {
        if (!message || typeof message !== "object") return message;
        let files = message.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); } catch { files = []; }
        }
        return { ...message, files: Array.isArray(files) ? files : [] };
    }

    function cacheKey(channel) {
        return CACHE_KEY_PREFIX + encodeURIComponent(channel);
    }

    function readCachedMessages(channel) {
        try {
            const raw = localStorage.getItem(cacheKey(channel));
            if (!raw) return null;

            const cached = JSON.parse(raw);
            if (!cached || !Array.isArray(cached.messages)) return null;

            if (Date.now() - Number(cached.time || 0) > CACHE_MAX_AGE_MS) return null;

            return cached.messages.map(normalizeMessage);
        } catch (_) {
            return null;
        }
    }

    function writeCachedMessages(channel, messages) {
        try {
            localStorage.setItem(cacheKey(channel), JSON.stringify({
                time: Date.now(),
                messages
            }));
        } catch (_) {}
    }

    function getMessageSignature(message) {
        if (!message || typeof message !== "object") return "";

        return String(
            message.id ??
            message.messageId ??
            message.timestamp ??
            message.time ??
            message.createdAt ??
            message.created_at ??
            JSON.stringify(message)
        );
    }

    function getNewestCachedMessage(channel) {
        const messages = readCachedMessages(channel);
        if (!messages || !messages.length) return null;
        return messages[messages.length - 1];
    }

    async function fetchFreshMessages(channel, showLoader) {
        if (inflightGets.has(channel)) return inflightGets.get(channel);

        const request = (async () => {
            let firstAttempt = true;

            while (true) {
                if (showLoader) {
                    setConnecting(true, firstAttempt ? "Connecting..." : "Reconnecting...");
                }

                try {
                    const { response, data } = await serverRequest("GET", {}, {
                        channel,
                        limit: 100
                    });

                    if (!response.ok || data?.ok === false || data?.success === false) {
                        throw new Error(data?.error || data?.message || "Server did not return a valid response.");
                    }

                    const messages = Array.isArray(data.messages)
                        ? data.messages.map(normalizeMessage)
                        : [];

                    writeCachedMessages(channel, messages);
                    lastFullRefresh.set(channel, Date.now());

                    if (showLoader) setConnecting(false);

                    return {
                        success: true,
                        messages
                    };
                } catch (_) {
                    if (!showLoader) return null;

                    setConnecting(true, "Reconnecting...");
                    await new Promise(resolve => setTimeout(resolve, RETRY_MS));
                    firstAttempt = false;
                }
            }
        })();

        inflightGets.set(channel, request);

        try {
            return await request;
        } finally {
            if (inflightGets.get(channel) === request) inflightGets.delete(channel);
        }
    }

    async function probeNewest(channel) {
        if (inflightLatest.has(channel)) return inflightLatest.get(channel);

        const request = (async () => {
            try {
                // IMPORTANT: only ask Google Sheets for ONE row during normal polling.
                // The Apps Script backend already supports limit=1.
                const { response, data } = await serverRequest("GET", {}, {
                    channel,
                    limit: 1
                });

                if (!response.ok || data?.ok === false || data?.success === false) {
                    return false;
                }

                const newest = Array.isArray(data.messages) && data.messages.length
                    ? normalizeMessage(data.messages[data.messages.length - 1])
                    : null;

                const cachedNewest = getNewestCachedMessage(channel);
                const serverSignature = getMessageSignature(newest);
                const cachedSignature = getMessageSignature(cachedNewest);

                // If the newest message changed, download the full recent list once.
                if (serverSignature !== cachedSignature) {
                    await fetchFreshMessages(channel, false);
                    return true;
                }

                return false;
            } catch (_) {
                // Normal background probes must never make the UI say "Connecting".
                return false;
            }
        })();

        inflightLatest.set(channel, request);

        try {
            return await request;
        } finally {
            if (inflightLatest.get(channel) === request) inflightLatest.delete(channel);
        }
    }

    function startLatestWatcher(channel) {
        if (latestWatchers.has(channel)) return;

        const timer = ORIGINAL_SET_INTERVAL(() => {
            // Do not spend requests while the page is hidden.
            if (document.hidden) return;
            probeNewest(channel).catch(() => {});
        }, LATEST_CHECK_MS);

        latestWatchers.set(channel, timer);
    }

    async function getMessagesFast(channel) {
        channel = String(channel || "general").trim().substring(0, 32) || "general";

        const cached = readCachedMessages(channel);

        // Existing chat: return instantly. The newest-message watcher updates the
        // local cache in the background whenever another user sends something.
        if (cached) {
            startLatestWatcher(channel);
            return {
                success: true,
                messages: cached
            };
        }

        // First load: get the complete recent history. Keep retrying forever if
        // the backend is temporarily unavailable.
        const result = await fetchFreshMessages(channel, true);
        startLatestWatcher(channel);
        return result;
    }

    function updateLocalCacheFromPost(channel, data) {
        try {
            if (Array.isArray(data?.messages)) {
                writeCachedMessages(channel, data.messages.map(normalizeMessage));
                return;
            }

            const possible = data?.message || data?.newMessage || data?.createdMessage;
            if (!possible || typeof possible !== "object") return;

            const current = readCachedMessages(channel) || [];
            const message = normalizeMessage(possible);
            const id = getMessageSignature(message);

            if (id && current.some(item => getMessageSignature(item) === id)) return;

            current.push(message);
            current.sort((a, b) => {
                const at = new Date(a?.timestamp || a?.time || a?.createdAt || 0).getTime() || 0;
                const bt = new Date(b?.timestamp || b?.time || b?.createdAt || 0).getTime() || 0;
                return at - bt;
            });

            writeCachedMessages(channel, current.slice(-100));
        } catch (_) {}
    }

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") {
            const channel = url.searchParams.get("channel") || "general";
            return jsonResponse(await getMessagesFast(channel));
        }

        if (method === "POST") {
            try {
                const { response, data } = await serverRequest("POST", {
                    ...body,
                    username: String(body.username || "Anonymous").trim().substring(0, 24),
                    channel: String(body.channel || "general").trim().substring(0, 32),
                    message: String(body.message || "").trim().substring(0, 20000),
                    image: body.image || null,
                    files: Array.isArray(body.files) ? body.files : [],
                    device_id: String(body.device_id || "").trim().substring(0, 100)
                });

                const channel = String(body.channel || "general").trim().substring(0, 32) || "general";

                // Make the just-sent data available to the UI immediately when
                // the server includes the created message in its response.
                updateLocalCacheFromPost(channel, data);
                lastFullRefresh.delete(channel);

                // Also start a non-blocking full refresh so the cache becomes
                // authoritative immediately after the write completes.
                fetchFreshMessages(channel, false).catch(() => {});

                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not send message." }, 200);
            }
        }

        if (method === "PATCH") {
            try {
                const { response, data } = await serverRequest("POST", { action: "edit", ...body });
                lastFullRefresh.delete(String(body.channel || "general"));
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not edit message." }, 200);
            }
        }

        if (method === "DELETE") {
            try {
                const { response, data } = await serverRequest("POST", { action: "delete", ...body });
                lastFullRefresh.delete(String(body.channel || "general"));
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not delete message." }, 200);
            }
        }

        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    async function handleMessageActions(method, options) {
        if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
        try {
            const body = await readBody(options);
            const { response, data } = await serverRequest("POST", body);
            lastFullRefresh.delete(String(body.channel || "general"));
            return jsonResponse(data, response.status || 200);
        } catch (error) {
            return jsonResponse({ ok: false, error: error?.message || "Could not connect to the chat server." }, 200);
        }
    }

    window.fetch = async function(input, options = {}) {
        const requestUrl = typeof input === "string" ? input : input?.url || "";
        let url;
        try { url = new URL(requestUrl, window.location.href); }
        catch { return ORIGINAL_FETCH(input, options); }

        const method = String(options.method || input?.method || "GET").toUpperCase();
        const path = url.pathname.replace(/\/+$/, "") || "/";

        if (path === "/api/messages") return await handleMessages(method, options, url);
        if (path === "/api/message-actions") return await handleMessageActions(method, options);
        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_FAST_REFRESH_MS = APP_REFRESH_MS;
    window.CHAT_APP_LATEST_CHECK_MS = LATEST_CHECK_MS;

    installFastRefreshTimer();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installConnectionUI, { once: true });
    } else {
        installConnectionUI();
    }
})();