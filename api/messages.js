(() => {
    "use strict";

    const GOOGLE_APPS_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
    const API_URL = GOOGLE_APPS_SCRIPT_URL;
    const ORIGINAL_FETCH = window.fetch.bind(window);

    let getInFlight = null;
    let lastGetResult = { success: true, messages: [] };

    function localId() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function localMessage(body) {
        return {
            id: body.id || localId(),
            username: body.username || "__GAME_SERVER__",
            channel: body.channel || "general",
            message: body.message || "",
            image: body.image || null,
            files: Array.isArray(body.files) ? body.files : [],
            device_id: body.device_id || "",
            edited: false,
            created_at: new Date().toISOString()
        };
    }

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" }
        });
    }

    function parseBody(options) {
        if (!options?.body) return {};
        if (typeof options.body === "string") {
            try { return JSON.parse(options.body); } catch {}
        }
        return {};
    }

    function jsonp(url) {
        if (getInFlight) return getInFlight;

        getInFlight = new Promise((resolve, reject) => {
            const callback = "__chatSheets_" + Date.now() + "_" + Math.random().toString(36).slice(2);
            const script = document.createElement("script");
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("Google Sheets request timed out."));
            }, 10000);

            function cleanup() {
                clearTimeout(timeout);
                delete window[callback];
                script.remove();
                getInFlight = null;
            }

            window[callback] = data => {
                lastGetResult = data || { success: true, messages: [] };
                cleanup();
                resolve(lastGetResult);
            };

            script.onerror = () => {
                cleanup();
                reject(new Error("Could not reach the Google Sheets Apps Script."));
            };

            const separator = url.includes("?") ? "&" : "?";
            script.src = url + separator + "callback=" + encodeURIComponent(callback) + "&_=" + Date.now();
            document.head.appendChild(script);
        });

        return getInFlight;
    }

    async function sendToSheets(body) {
        const payload = { ...body };
        if (!payload.id && payload.game_server !== true) payload.id = localId();
        if (payload.game_server === true && payload.message && !payload.id) payload.id = localId();

        const optimistic = payload.game_server === true
            ? { success: true, game: localMessage(payload) }
            : { success: true, message: localMessage(payload) };

        try {
            await ORIGINAL_FETCH(API_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (error) {
            throw new Error(error?.message || "Could not send to Google Sheets.");
        }

        return optimistic;
    }

    async function apiRequest(method, body, url) {
        if (!API_URL || API_URL.includes("PASTE_YOUR_")) {
            throw new Error("Google Apps Script URL is not configured in api/messages.js.");
        }

        if (method === "GET") {
            const channel = String(url.searchParams.get("channel") || "general").slice(0,32);
            const target = API_URL + (API_URL.includes("?") ? "&" : "?") +
                "channel=" + encodeURIComponent(channel);
            return jsonResponse(await jsonp(target));
        }

        if (method === "POST") {
            return jsonResponse(await sendToSheets(body));
        }

        if (method === "PATCH") {
            return jsonResponse(await sendToSheets({ ...body, _method: "PATCH" }));
        }

        if (method === "DELETE") {
            return jsonResponse(await sendToSheets({ ...body, _method: "DELETE" }));
        }

        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    window.fetch = async function(input, options = {}) {
        try {
            const rawUrl = typeof input === "string" ? input : input?.url || "";
            const url = new URL(rawUrl, window.location.href);
            const path = url.pathname.replace(/\/+$/, "") || "/";
            const method = String(options?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

            if (path === "/api/messages") {
                return await apiRequest(method, parseBody(options), url);
            }

            if (path === "/api/message-actions") {
                const body = parseBody(options);
                if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
                const actionMethod = body.action === "edit" ? "PATCH" : body.action === "delete" ? "DELETE" : "";
                if (!actionMethod) return jsonResponse({ error: "Unknown action." }, 400);
                return await apiRequest(actionMethod, {
                    ...body,
                    _method: actionMethod,
                    message: body.message,
                    id: body.id,
                    device_id: body.device_id
                }, url);
            }
        } catch (error) {
            return jsonResponse({ error: error?.message || "Chat API error." }, 500);
        }

        return ORIGINAL_FETCH(input, options);
    };

    window.ChatGoogleSheetsAPI = {
        url: API_URL,
        pollInterval: 500
    };
})();