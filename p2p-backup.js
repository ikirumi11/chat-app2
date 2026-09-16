(() => {
    "use strict";

    const ORIGINAL_FETCH = window.fetch.bind(window);
    const PEER_SCRIPT = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    const MAX_P2P_PAYLOAD = 700000;
    const peers = new Map();
    const p2pMessages = [];
    const p2pIds = new Set();
    const state = { serverDown: false, peer: null, peerId: "", ready: false };
    let statusEl = null;
    let peerIdEl = null;
    let connectInput = null;

    function makeId() {
        if (crypto.randomUUID) return "p2p-" + crypto.randomUUID();
        return "p2p-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function setStatus(serverDown) {
        state.serverDown = !!serverDown;
        if (!statusEl) return;
        statusEl.className = "p2p-status" + (state.serverDown ? " offline" : " online");
        statusEl.textContent = state.serverDown
            ? "Messages are not loading — the server might be down. P2P backup is active."
            : "Server connected — normal message mode is active.";
        statusEl.title = state.serverDown
            ? "Messages sent through connected P2P peers are not saved on the server."
            : "Normal server messaging is active.";
    }

    function addStyles() {
        if (document.getElementById("p2p-backup-style")) return;
        const style = document.createElement("style");
        style.id = "p2p-backup-style";
        style.textContent = `
.p2p-status{position:fixed;z-index:9999;left:50%;top:10px;transform:translateX(-50%);max-width:min(720px,calc(100vw - 24px));padding:9px 14px;border-radius:12px;background:rgba(35,40,48,.96);border:1px solid rgba(255,255,255,.12);color:#d9dee6;font:600 13px/1.35 system-ui,sans-serif;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px);pointer-events:none;transition:.2s}
.p2p-status.offline{border-color:#d8a84e;color:#ffe1a1}
.p2p-status.online{opacity:.82}
.p2p-panel{position:fixed;z-index:9998;right:14px;bottom:76px;width:min(360px,calc(100vw - 28px));padding:14px;border-radius:14px;background:rgba(18,21,27,.98);border:1px solid rgba(255,255,255,.12);color:#e7ebf0;font:14px/1.4 system-ui,sans-serif;box-shadow:0 15px 45px rgba(0,0,0,.4);display:none}
.p2p-panel.show{display:block}
.p2p-panel strong{display:block;margin-bottom:7px}
.p2p-panel small{display:block;color:#9ba4b0;margin:6px 0 10px}
.p2p-row{display:flex;gap:7px}
.p2p-row input{min-width:0;flex:1;background:#0d1015;color:#fff;border:1px solid #343b46;border-radius:9px;padding:9px}
.p2p-row button,.p2p-copy{border:0;border-radius:9px;padding:9px 11px;background:#303844;color:#fff;cursor:pointer}
.p2p-copy{width:100%;margin-top:8px}
.p2p-peer-count{margin-top:9px;color:#9ba4b0;font-size:12px}
`;
        document.head.appendChild(style);
    }

    function makeUi() {
        addStyles();
        statusEl = document.createElement("div");
        statusEl.className = "p2p-status";
        document.body.appendChild(statusEl);

        const panel = document.createElement("div");
        panel.className = "p2p-panel";
        panel.id = "p2pPanel";
        panel.innerHTML = `<strong>Direct P2P backup</strong><div>Your P2P ID: <code id="p2pId">connecting...</code></div><small>When the server is down, connected peers can exchange messages directly. P2P messages are kept only in memory and are not saved to the chat server.</small><div class="p2p-row"><input id="p2pConnectInput" placeholder="Paste peer ID"><button id="p2pConnectBtn">Connect</button></div><button class="p2p-copy" id="p2pCopyBtn">Copy invite link</button><div class="p2p-peer-count" id="p2pPeerCount">Peers: 0</div>`;
        document.body.appendChild(panel);
        peerIdEl = panel.querySelector("#p2pId");
        connectInput = panel.querySelector("#p2pConnectInput");

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = "P2P";
        toggle.title = "P2P backup settings";
        toggle.style.cssText = "position:fixed;z-index:9997;right:14px;bottom:14px;border:0;border-radius:11px;padding:9px 12px;background:#252c35;color:#fff;cursor:pointer;font:600 13px system-ui,sans-serif;box-shadow:0 8px 25px rgba(0,0,0,.3)";
        document.body.appendChild(toggle);
        toggle.onclick = () => panel.classList.toggle("show");

        panel.querySelector("#p2pConnectBtn").onclick = () => {
            const id = connectInput.value.trim();
            if (id) connectTo(id);
        };
        panel.querySelector("#p2pCopyBtn").onclick = async () => {
            if (!state.peerId) return;
            const url = location.href.split("#")[0].split("?")[0] + "?peer=" + encodeURIComponent(state.peerId);
            try { await navigator.clipboard.writeText(url); } catch { prompt("Copy this invite link:", url); }
        };
        setStatus(false);
        updatePeerUi();
    }

    function updatePeerUi() {
        if (peerIdEl) peerIdEl.textContent = state.peerId || "connecting...";
        const count = document.getElementById("p2pPeerCount");
        if (count) count.textContent = "Peers: " + peers.size;
    }

    function addMessage(data) {
        if (!data || !data.id || p2pIds.has(data.id)) return;
        p2pIds.add(data.id);
        p2pMessages.push(data);
        if (p2pMessages.length > 500) {
            const old = p2pMessages.shift();
            if (old) p2pIds.delete(old.id);
        }
    }

    function broadcast(message, exceptId = "") {
        for (const [id, conn] of peers) {
            if (id === exceptId || !conn.open) continue;
            try { conn.send({ type: "chat-message", message }); } catch (_) {}
        }
    }

    function handlePeerData(conn, packet) {
        if (!packet || packet.type !== "chat-message" || !packet.message) return;
        const message = packet.message;
        if (!message.id) message.id = makeId();
        addMessage(message);
        broadcast(message, conn.peer);
    }

    function attachConnection(conn) {
        if (!conn || !conn.peer) return;
        peers.set(conn.peer, conn);
        updatePeerUi();
        conn.on("data", data => handlePeerData(conn, data));
        conn.on("close", () => { peers.delete(conn.peer); updatePeerUi(); });
        conn.on("error", () => { peers.delete(conn.peer); updatePeerUi(); });
    }

    function connectTo(id) {
        if (!state.peer || !id || id === state.peerId) return;
        if (peers.has(id)) return;
        try { attachConnection(state.peer.connect(id, { reliable: true })); } catch (_) {}
    }

    function startPeer() {
        if (!window.Peer) return;
        try {
            state.peer = new window.Peer(undefined, { debug: 0 });
            state.peer.on("open", id => {
                state.peerId = id;
                state.ready = true;
                updatePeerUi();
                const invited = new URLSearchParams(location.search).get("peer");
                if (invited) connectTo(invited);
            });
            state.peer.on("connection", attachConnection);
            state.peer.on("error", () => updatePeerUi());
        } catch (_) {}
    }

    function loadPeerJs() {
        if (window.Peer) return startPeer();
        const script = document.createElement("script");
        script.src = PEER_SCRIPT;
        script.onload = startPeer;
        script.onerror = () => { if (statusEl) statusEl.textContent += " P2P library could not load."; };
        document.head.appendChild(script);
    }

    function localFallback(body) {
        const now = new Date().toISOString();
        const message = {
            id: makeId(),
            username: String(body.username || "Anonymous").trim().substring(0, 24) || "Anonymous",
            channel: String(body.channel || "general").trim().substring(0, 32) || "general",
            message: String(body.message || "").trim().substring(0, 20000),
            image: body.image || null,
            files: Array.isArray(body.files) ? body.files : [],
            device_id: String(body.device_id || "").substring(0, 100),
            edited: false,
            created_at: now,
            p2p: true
        };
        if (!message.message && !message.image && !message.files.length) return null;
        const encoded = JSON.stringify(message);
        if (encoded.length > MAX_P2P_PAYLOAD) throw new Error("This P2P backup message is too large. Send a smaller message or attachment.");
        addMessage(message);
        broadcast(message);
        return message;
    }

    async function patchedFetch(input, init) {
        const url = typeof input === "string" ? input : (input?.url || "");
        const method = String(init?.method || (typeof input !== "string" && input?.method) || "GET").toUpperCase();
        const isChatApi = String(url).includes("/api/messages");

        if (!isChatApi) return ORIGINAL_FETCH(input, init);

        let body = {};
        if (init?.body && typeof init.body === "string") {
            try { body = JSON.parse(init.body); } catch (_) {}
        }

        try {
            const response = await ORIGINAL_FETCH(input, init);
            if (response.ok) {
                if (state.serverDown) setStatus(false);
                return response;
            }
            if (method === "GET") {
                setStatus(true);
                return new Response(JSON.stringify({ success: true, messages: p2pMessages.slice() }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            if (method === "POST" && !body.game_server && body.delete_all !== true) {
                setStatus(true);
                try {
                    const message = localFallback(body);
                    if (!message) return new Response(JSON.stringify({ error: "Message is empty." }), { status: 400, headers: { "Content-Type": "application/json" } });
                    return new Response(JSON.stringify({ success: true, message }), { status: 200, headers: { "Content-Type": "application/json" } });
                } catch (error) {
                    return new Response(JSON.stringify({ error: error.message }), { status: 413, headers: { "Content-Type": "application/json" } });
                }
            }
            return response;
        } catch (error) {
            if (method === "GET") {
                setStatus(true);
                return new Response(JSON.stringify({ success: true, messages: p2pMessages.slice() }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            if (method === "POST" && !body.game_server && body.delete_all !== true) {
                setStatus(true);
                try {
                    const message = localFallback(body);
                    if (!message) return new Response(JSON.stringify({ error: "Message is empty." }), { status: 400, headers: { "Content-Type": "application/json" } });
                    return new Response(JSON.stringify({ success: true, message }), { status: 200, headers: { "Content-Type": "application/json" } });
                } catch (fallbackError) {
                    return new Response(JSON.stringify({ error: fallbackError.message }), { status: 413, headers: { "Content-Type": "application/json" } });
                }
            }
            throw error;
        }
    }

    function install() {
        makeUi();
        window.fetch = patchedFetch;
        loadPeerJs();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
})();
