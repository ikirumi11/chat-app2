/*
 * Chat App 2 - Google Apps Script API adapter
 * Stable 1-second polling + startup-safe loading.
 */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const FAST_REFRESH_MS = 1000;
    const inflightGets = new Map();

    try {
        localStorage.setItem("chat_refreshRate", String(FAST_REFRESH_MS));
    } catch (_) {}

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
            if (value !== undefined && value !== null) {
                params.set(key, String(value));
            }
        });

        const url = SERVER_URL + (params.toString() ? "?" + params.toString() : "");
        const options = {
            method,
            cache: "no-store",
            redirect: "follow",
            credentials: "omit"
        };

        if (method !== "GET") {
            options.headers = {
                "Content-Type": "text/plain;charset=utf-8"
            };
            options.body = JSON.stringify(payload);
        }

        const response = await ORIGINAL_FETCH(url, options);
        const text = await response.text();
        let data = {};

        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = {
                ok: false,
                error: text || "Invalid server response."
            };
        }

        return { response, data };
    }

    function normalizeMessage(message) {
        if (!message || typeof message !== "object") return message;

        let files = message.files;
        if (typeof files === "string") {
            try { files = JSON.parse(files); }
            catch { files = []; }
        }

        return {
            ...message,
            files: Array.isArray(files) ? files : []
        };
    }

    async function getMessages(channel) {
        channel = String(channel || "general").trim().substring(0, 32) || "general";

        if (inflightGets.has(channel)) {
            return inflightGets.get(channel);
        }

        const request = (async () => {
            const { response, data } = await serverRequest(
                "GET",
                {},
                { channel }
            );

            if (!response.ok || data?.ok === false) {
                throw new Error(
                    data?.error ||
                    data?.message ||
                    "Could not connect to the chat server."
                );
            }

            return {
                success: true,
                messages: Array.isArray(data.messages)
                    ? data.messages.map(normalizeMessage)
                    : []
            };
        })();

        inflightGets.set(channel, request);

        try {
            return await request;
        } finally {
            if (inflightGets.get(channel) === request) {
                inflightGets.delete(channel);
            }
        }
    }

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") {
            const channel =
                url.searchParams.get("channel") || "general";

            try {
                return jsonResponse(await getMessages(channel));
            } catch (error) {
                // Do not make a failed first request permanently block startup.
                // app.js can retry on its next 1-second refresh.
                return jsonResponse({
                    success: false,
                    messages: [],
                    error: error?.message || "Could not connect to the chat server."
                }, 200);
            }
        }

        if (method === "POST") {
            try {
                const { response, data } = await serverRequest("POST", {
                    ...body,
                    username: String(body.username || "Anonymous")
                        .trim().substring(0, 24),
                    channel: String(body.channel || "general")
                        .trim().substring(0, 32),
                    message: String(body.message || "")
                        .trim().substring(0, 20000),
                    image: body.image || null,
                    files: Array.isArray(body.files) ? body.files : [],
                    device_id: String(body.device_id || "")
                        .trim().substring(0, 100)
                });

                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({
                    ok: false,
                    error: error?.message || "Could not send message."
                }, 200);
            }
        }

        if (method === "PATCH") {
            try {
                const { response, data } = await serverRequest(
                    "POST",
                    { action: "edit", ...body }
                );
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not edit message." }, 200);
            }
        }

        if (method === "DELETE") {
            try {
                const { response, data } = await serverRequest(
                    "POST",
                    { action: "delete", ...body }
                );
                return jsonResponse(data, response.status || 200);
            } catch (error) {
                return jsonResponse({ ok: false, error: error?.message || "Could not delete message." }, 200);
            }
        }

        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    async function handleMessageActions(method, options) {
        if (method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        try {
            const body = await readBody(options);
            const { response, data } = await serverRequest("POST", body);
            return jsonResponse(data, response.status || 200);
        } catch (error) {
            return jsonResponse({
                ok: false,
                error: error?.message || "Could not connect to the chat server."
            }, 200);
        }
    }

    window.fetch = async function(input, options = {}) {
        const requestUrl =
            typeof input === "string"
                ? input
                : input?.url || "";

        let url;
        try {
            url = new URL(requestUrl, window.location.href);
        } catch {
            return ORIGINAL_FETCH(input, options);
        }

        const method = String(
            options.method || input?.method || "GET"
        ).toUpperCase();

        const path =
            url.pathname.replace(/\/+$/, "") || "/";

        if (path === "/api/messages") {
            try {
                return await handleMessages(method, options, url);
            } catch (error) {
                return jsonResponse({
                    success: false,
                    messages: [],
                    error: error?.message || "Could not connect to the chat server."
                }, 200);
            }
        }

        if (path === "/api/message-actions") {
            try {
                return await handleMessageActions(method, options);
            } catch (error) {
                return jsonResponse({
                    ok: false,
                    error: error?.message || "Could not connect to the chat server."
                }, 200);
            }
        }

        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_FAST_REFRESH_MS = FAST_REFRESH_MS;
})();