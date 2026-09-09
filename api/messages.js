/*
 * Chat App 2 - Google Apps Script API adapter
 * Fast polling + optimized requests to the newest Apps Script backend.
 */
(() => {
    "use strict";

    const SERVER_URL = "https://script.google.com/macros/s/AKfycbzIQrF4QfSh6MVdSEFNMpINunLXIbOFtxFfbWm7_h8NwOWj-DYFqtKDMqwRuBEXHWZb/exec";
    const ORIGINAL_FETCH = window.fetch.bind(window);
    const FAST_REFRESH_MS = 250;
    const inflightGets = new Map();

    // app.js reads this setting when it starts. Set it here because this file
    // loads before app.js and therefore controls the polling interval.
    try {
        const current = Number(localStorage.getItem("chat_refreshRate"));
        if (!Number.isFinite(current) || current > FAST_REFRESH_MS) {
            localStorage.setItem("chat_refreshRate", String(FAST_REFRESH_MS));
        }
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
            credentials: "omit",
            priority: "high"
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
            data = { message: text };
        }

        return { response, data };
    }

    function normalizeMessage(message) {
        if (!message || typeof message !== "object") return message;

        let files = message.files;

        if (typeof files === "string") {
            try {
                files = JSON.parse(files);
            } catch {
                files = [];
            }
        }

        return {
            ...message,
            files: Array.isArray(files) ? files : []
        };
    }

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") {
            const channel = String(
                url.searchParams.get("channel") || "general"
            ).trim().substring(0, 32);

            // Prevent duplicate overlapping reads from hammering the Sheet.
            // If two UI systems ask for the same channel simultaneously,
            // they share the same Apps Script request.
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
                    return jsonResponse({
                        error:
                            data?.error ||
                            data?.message ||
                            "Server request failed.",
                        details: data
                    }, response.status || 500);
                }

                return jsonResponse({
                    success: true,
                    messages: Array.isArray(data.messages)
                        ? data.messages.map(normalizeMessage)
                        : []
                });
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

        if (method === "POST") {
            const { response, data } = await serverRequest("POST", {
                ...body,
                username: String(body.username || "")
                    .trim()
                    .substring(0, 24),
                channel: String(body.channel || "general")
                    .trim()
                    .substring(0, 32),
                message: String(body.message || "")
                    .trim()
                    .substring(0, 20000),
                image: body.image || null,
                files: Array.isArray(body.files) ? body.files : [],
                device_id: String(body.device_id || "")
                    .trim()
                    .substring(0, 100)
            });

            return jsonResponse(data, response.status || 200);
        }

        if (method === "PATCH") {
            const { response, data } = await serverRequest(
                "POST",
                { action: "edit", ...body }
            );
            return jsonResponse(data, response.status || 200);
        }

        if (method === "DELETE") {
            const { response, data } = await serverRequest(
                "POST",
                { action: "delete", ...body }
            );
            return jsonResponse(data, response.status || 200);
        }

        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    async function handleMessageActions(method, options) {
        if (method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        const body = await readBody(options);
        const { response, data } = await serverRequest("POST", body);
        return jsonResponse(data, response.status || 200);
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
                    error:
                        error?.message ||
                        "Could not connect to the chat server."
                }, 500);
            }
        }

        if (path === "/api/message-actions") {
            try {
                return await handleMessageActions(method, options);
            } catch (error) {
                return jsonResponse({
                    error:
                        error?.message ||
                        "Could not connect to the chat server."
                }, 500);
            }
        }

        return ORIGINAL_FETCH(input, options);
    };

    window.CHAT_APP_SERVER_URL = SERVER_URL;
    window.CHAT_APP_FAST_REFRESH_MS = FAST_REFRESH_MS;
})();