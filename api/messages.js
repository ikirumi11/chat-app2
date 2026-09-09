/*
 * Chat App 2 - Google Apps Script API adapter
 * Stable Google Sheets backend connection.
 * Never permanently gives up connecting.
 */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const RETRY_MS = 1000;
    const REQUEST_TIMEOUT_MS = 15000;
    const inflightGets = new Map();

    function installConnectionUI() {
        if (!document.body || document.getElementById("chatConnectionLoader")) return;

        if (!document.getElementById("chatConnectionLoaderStyle")) {
            const style = document.createElement("style");
            style.id = "chatConnectionLoaderStyle";
            style.textContent = `
                #chatConnectionLoader{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .2s ease}
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

    async function getMessagesForever(channel) {
        channel = String(channel || "general").trim().substring(0, 32) || "general";

        if (inflightGets.has(channel)) return inflightGets.get(channel);

        const request = (async () => {
            let firstAttempt = true;

            while (true) {
                setConnecting(true, firstAttempt ? "Connecting..." : "Reconnecting...");

                try {
                    const { response, data } = await serverRequest("GET", {}, { channel });

                    if (!response.ok || data?.ok === false || data?.success === false) {
                        throw new Error(data?.error || data?.message || "Server did not return a valid response.");
                    }

                    setConnecting(false);

                    return {
                        success: true,
                        messages: Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : []
                    };
                } catch (_) {
                    // Keep trying forever. A temporary network/server failure never ends startup.
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

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") {
            const channel = url.searchParams.get("channel") || "general";
            return jsonResponse(await getMessagesForever(channel));
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
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not send message." }, 200);
            }
        }

        if (method === "PATCH") {
            try {
                const { response, data } = await serverRequest("POST", { action: "edit", ...body });
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not edit message." }, 200);
            }
        }

        if (method === "DELETE") {
            try {
                const { response, data } = await serverRequest("POST", { action: "delete", ...body });
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
    window.CHAT_APP_FAST_REFRESH_MS = RETRY_MS;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installConnectionUI, { once: true });
    } else {
        installConnectionUI();
    }
})();