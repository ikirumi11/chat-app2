/*
 * Chat App 2 - browser Supabase API adapter
 * This file does not use Vercel, Node, Express, or serverless functions.
 * It runs in the browser and translates the existing /api/messages and
 * /api/message-actions calls into direct Supabase REST requests.
 */
(() => {
    "use strict";
    const SUPABASE_URL = "https://iecpzrqvvuyghybchpva.supabase.co";
    const SUPABASE_KEY = "sb_publishable_Vess5sv1LAkxmZuxXZHa5Q_Vf6Qs-Se";
    const REST_URL = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1";
    const ORIGINAL_FETCH = window.fetch.bind(window);

    const baseHeaders = () => ({
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Accept: "application/json"
    });

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

    async function readSupabase(response) {
        const text = await response.text();
        if (!text) return {};
        try { return JSON.parse(text); } catch { return { message: text }; }
    }

    function errorFrom(data, fallback) {
        return data?.message || data?.error || data?.hint || fallback;
    }

    async function supabase(method, path, body, extraHeaders = {}) {
        const options = {
            method,
            headers: { ...baseHeaders(), ...extraHeaders },
            cache: "no-store"
        };
        if (body !== undefined) options.body = JSON.stringify(body);
        const response = await ORIGINAL_FETCH(REST_URL + path, options);
        const data = await readSupabase(response);
        return { response, data };
    }

    async function getGameMessages(channel, gameId) {
        const path = "/messages?select=id,username,channel,message,image,files,device_id,edited,created_at" +
            "&channel=eq." + encodeURIComponent(channel) +
            "&username=eq.__GAME_SERVER__" +
            "&message=like.*" + encodeURIComponent(gameId) + "*" +
            "&order=created_at.desc";
        const { response, data } = await supabase("GET", path);
        if (!response.ok) throw new Error(errorFrom(data, "Could not find game messages."));
        return Array.isArray(data) ? data : [];
    }

    async function deleteGameMessages(messages) {
        let removed = 0;
        for (const message of messages) {
            if (!message?.id) continue;
            const path = "/messages?id=eq." + encodeURIComponent(message.id) +
                "&username=eq.__GAME_SERVER__&device_id=eq." + encodeURIComponent(message.device_id || "");
            const { response, data } = await supabase("DELETE", path, undefined, { Prefer: "return=representation" });
            if (!response.ok) throw new Error(errorFrom(data, "Could not delete game message."));
            if (Array.isArray(data)) removed += data.length;
        }
        return removed;
    }

    function parseGameState(message) {
        const prefix = "__CHAT_GAME_STATE__:";
        if (typeof message !== "string" || !message.startsWith(prefix)) return null;
        try { return JSON.parse(message.substring(prefix.length)); } catch { return null; }
    }

    async function insertGameState(channel, state) {
        const row = {
            username: "__GAME_SERVER__",
            channel,
            message: "__CHAT_GAME_STATE__:" + JSON.stringify(state),
            image: null,
            files: [],
            device_id: state.hostDeviceId,
            edited: false
        };
        const { response, data } = await supabase("POST", "/messages", row, { Prefer: "return=representation" });
        if (!response.ok) throw new Error(errorFrom(data, "Could not write game state."));
        return Array.isArray(data) ? data[0] : data;
    }

    async function handleMessages(method, options, url) {
        const body = await readBody(options);

        if (method === "GET") {
            const channel = String(url.searchParams.get("channel") || "general").trim().substring(0, 32);
            const path = "/messages?select=id,username,channel,message,image,files,device_id,edited,created_at" +
                "&channel=eq." + encodeURIComponent(channel) + "&order=created_at.asc";
            const { response, data } = await supabase("GET", path);
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
            return jsonResponse({ success: true, messages: Array.isArray(data) ? data : [] });
        }

        if (method === "POST") {
            const username = String(body.username || "").trim().substring(0, 24);
            const channel = String(body.channel || "general").trim().substring(0, 32);
            const message = String(body.message || "").trim().substring(0, 20000);
            const deviceId = String(body.device_id || "").trim().substring(0, 100);

            if (body.game_server === true) {
                if (!deviceId) return jsonResponse({ error: "Device ID is required for a game server." }, 400);

                if (body.game_action === "stop") {
                    const gameId = String(body.game_id || "").trim().substring(0, 120);
                    if (!gameId) return jsonResponse({ error: "Game ID is required." }, 400);
                    const messages = await getGameMessages(channel, gameId);
                    const removed = await deleteGameMessages(messages);
                    return jsonResponse({ success: true, stopped: true, removed });
                }

                if (body.game_action === "leave") {
                    const gameId = String(body.game_id || "").trim().substring(0, 120);
                    if (!gameId) return jsonResponse({ error: "Game ID is required." }, 400);
                    const messages = await getGameMessages(channel, gameId);
                    if (!messages.length) return jsonResponse({ success: true, stopped: true, removed: 0 });
                    const state = parseGameState(messages[0].message);
                    if (!state) {
                        const removed = await deleteGameMessages(messages);
                        return jsonResponse({ success: true, stopped: true, removed });
                    }
                    if (state.hostDeviceId === deviceId) {
                        const removed = await deleteGameMessages(messages);
                        return jsonResponse({ success: true, stopped: true, hostLeft: true, removed });
                    }
                    state.players = Array.isArray(state.players)
                        ? state.players.filter(player => player && player.deviceId !== deviceId)
                        : [];
                    if (!state.players.length) {
                        const removed = await deleteGameMessages(messages);
                        return jsonResponse({ success: true, stopped: true, removed });
                    }
                    await deleteGameMessages(messages);
                    const inserted = await insertGameState(channel, state);
                    return jsonResponse({ success: true, stopped: false, left: true, game: inserted });
                }

                if (!message) return jsonResponse({ error: "Game state is required." }, 400);
                const row = { username: "__GAME_SERVER__", channel, message, image: null, files: [], device_id: deviceId, edited: false };
                const { response, data } = await supabase("POST", "/messages", row, { Prefer: "return=representation" });
                if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
                return jsonResponse({ success: true, game: Array.isArray(data) ? data[0] : data });
            }

            let image = null;
            if (body.image && typeof body.image === "string") image = body.image;
            const files = [];
            if (Array.isArray(body.files)) {
                const MAX_FILES = 5;
                const MAX_FILE_SIZE = 5 * 1024 * 1024;
                for (const file of body.files) {
                    if (files.length >= MAX_FILES) break;
                    if (!file?.data || typeof file.data !== "string" || !file.name || typeof file.name !== "string") continue;
                    const base64Data = file.data.split(",")[1] || "";
                    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
                    if (sizeInBytes > MAX_FILE_SIZE || file.data.length > 5000000) continue;
                    files.push({ name: file.name.substring(0, 255), data: file.data, size: file.size || sizeInBytes, type: file.type || "application/octet-stream" });
                }
            }
            if (!username) return jsonResponse({ error: "Username is required." }, 400);
            if (!message && !image && files.length === 0) return jsonResponse({ error: "Message, image, or files are required." }, 400);
            if (image && image.length > 5000000) return jsonResponse({ error: "Image is too large." }, 413);
            if (image && !image.startsWith("data:image/")) return jsonResponse({ error: "Invalid image data." }, 400);

            const row = { username, channel, message, image, files, device_id: deviceId, edited: false };
            const { response, data } = await supabase("POST", "/messages", row, { Prefer: "return=representation" });
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
            return jsonResponse({ success: true, message: Array.isArray(data) ? data[0] : data });
        }

        if (method === "PATCH") {
            const id = String(body.id || "").trim();
            const deviceId = String(body.device_id || "").trim();
            if (!id || !deviceId) return jsonResponse({ error: "Message ID and device ID are required." }, 400);

            if (body.game_server === true) {
                const gameState = String(body.game_state || "").trim().substring(0, 20000);
                if (!gameState) return jsonResponse({ error: "Game state is required." }, 400);
                const path = "/messages?id=eq." + encodeURIComponent(id) + "&username=eq.__GAME_SERVER__&device_id=eq." + encodeURIComponent(deviceId);
                const { response, data } = await supabase("PATCH", path, { message: gameState, edited: true }, { Prefer: "return=representation" });
                if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
                if (!Array.isArray(data) || !data.length) return jsonResponse({ error: "You are not the game host." }, 403);
                return jsonResponse({ success: true, game: data[0] });
            }

            const message = String(body.message || "").trim().substring(0, 2000);
            const path = "/messages?id=eq." + encodeURIComponent(id) + "&device_id=eq." + encodeURIComponent(deviceId) + "&username=neq.__GAME_SERVER__";
            const { response, data } = await supabase("PATCH", path, { message, edited: true }, { Prefer: "return=representation" });
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
            if (!Array.isArray(data) || !data.length) return jsonResponse({ error: "You cannot edit this message." }, 403);
            return jsonResponse({ success: true, message: data[0] });
        }

        if (method === "DELETE") {
            if (body.delete_all === true) {
                const { response, data } = await supabase("DELETE", "/messages?id=not.is.null", undefined, { Prefer: "return=minimal" });
                if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
                return jsonResponse({ success: true, message: "Everything was deleted." });
            }

            if (body.game_server === true) {
                const deviceId = String(body.device_id || "").trim();
                const id = String(body.id || "").trim();
                const gameId = String(body.game_id || "").trim().substring(0, 120);
                if (!deviceId) return jsonResponse({ error: "Device ID is required." }, 400);
                if (gameId) {
                    const channel = String(body.channel || "general").trim().substring(0, 32);
                    const messages = await getGameMessages(channel, gameId);
                    const removed = await deleteGameMessages(messages);
                    return jsonResponse({ success: true, message: "Game server messages removed.", removed });
                }
                if (!id) return jsonResponse({ error: "Game ID/message ID is required." }, 400);
                const path = "/messages?id=eq." + encodeURIComponent(id) + "&username=eq.__GAME_SERVER__&device_id=eq." + encodeURIComponent(deviceId);
                const { response, data } = await supabase("DELETE", path, undefined, { Prefer: "return=representation" });
                if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
                return jsonResponse({ success: true, message: "Game server removed." });
            }

            const id = String(body.id || "").trim();
            const deviceId = String(body.device_id || "").trim();
            if (!id || !deviceId) return jsonResponse({ error: "Message ID and device ID are required." }, 400);
            const path = "/messages?id=eq." + encodeURIComponent(id) + "&device_id=eq." + encodeURIComponent(deviceId) + "&username=neq.__GAME_SERVER__";
            const { response, data } = await supabase("DELETE", path, undefined, { Prefer: "return=representation" });
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Supabase request failed."), details: data }, response.status);
            if (!Array.isArray(data) || !data.length) return jsonResponse({ error: "You cannot delete this message." }, 403);
            return jsonResponse({ success: true, message: "Message deleted." });
        }

        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    async function handleMessageActions(method, options) {
        if (method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
        const body = await readBody(options);
        const deviceId = String(body.device_id || localStorage.getItem("chat_device_id") || "").trim();
        const id = String(body.id || "").trim();
        const action = String(body.action || "").trim().toLowerCase();
        if (!id || !deviceId) return jsonResponse({ error: "Message ID and device ID are required." }, 400);

        const path = "/messages?id=eq." + encodeURIComponent(id) + "&device_id=eq." + encodeURIComponent(deviceId) + "&username=neq.__GAME_SERVER__";
        if (action === "edit") {
            const message = String(body.message || "").trim().substring(0, 2000);
            if (!message) return jsonResponse({ error: "Message cannot be empty." }, 400);
            const { response, data } = await supabase("PATCH", path, { message, edited: true }, { Prefer: "return=representation" });
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Could not edit message."), details: data }, response.status);
            if (!Array.isArray(data) || !data.length) return jsonResponse({ error: "You cannot edit this message." }, 403);
            return jsonResponse({ success: true, message: data[0] });
        }
        if (action === "delete") {
            const { response, data } = await supabase("DELETE", path, undefined, { Prefer: "return=representation" });
            if (!response.ok) return jsonResponse({ error: errorFrom(data, "Could not delete message."), details: data }, response.status);
            if (!Array.isArray(data) || !data.length) return jsonResponse({ error: "You cannot delete this message." }, 403);
            return jsonResponse({ success: true, message: "Message deleted." });
        }
        return jsonResponse({ error: "Unknown action." }, 400);
    }

    window.fetch = async function(input, options = {}) {
        try {
            const rawUrl = typeof input === "string" ? input : input?.url || "";
            const url = new URL(rawUrl, window.location.href);
            const path = url.pathname.replace(/\/+$/, "") || "/";
            const method = String(options?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
            if (path === "/api/messages") return await handleMessages(method, options, url);
            if (path === "/api/message-actions") return await handleMessageActions(method, options);
        } catch (error) {
            return jsonResponse({ error: error?.message || "Chat API error." }, 500);
        }
        return ORIGINAL_FETCH(input, options);
    };

    window.ChatSupabaseAPI = { url: SUPABASE_URL, restUrl: REST_URL };
})();
