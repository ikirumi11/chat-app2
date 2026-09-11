(() => {
    "use strict";

    const PREFIX = "__CHAT_P2P_SCREEN_SHARE__:";
    const PEERJS = "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js";
    const ICE = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" }
    ];

    let peer = null;
    let stream = null;
    let session = null;
    let hosting = false;
    let watching = false;
    let lastSignals = new Set();
    let viewers = new Map();
    let remoteCalls = new Map();
    let hiddenLive = false;
    let pollTimer = null;

    const id = () => typeof deviceId !== "undefined" ? deviceId : localStorage.getItem("chat_device_id") || "";
    const name = () => String(typeof settings !== "undefined" && settings.username ? settings.username : localStorage.getItem("chat_username") || "User").trim();
    const channel = () => typeof CHANNEL !== "undefined" ? CHANNEL : "general";

    function addStyles() {
        if (document.getElementById("p2pScreenShareStyles")) return;
        const s = document.createElement("style");
        s.id = "p2pScreenShareStyles";
        s.textContent = `
            #p2pScreenShareOverlay{position:fixed;inset:0;z-index:30000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);padding:20px;box-sizing:border-box}
            #p2pScreenShareOverlay.open{display:flex}
            .p2p-share-box{width:min(1050px,96vw);max-height:92vh;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;box-shadow:0 25px 90px #000b;display:flex;flex-direction:column}
            .p2p-share-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
            .p2p-share-head strong{flex:1}.p2p-share-close{border:0;background:none;color:inherit;font-size:25px;cursor:pointer}
            .p2p-share-body{padding:16px;display:grid;gap:12px;overflow:auto}.p2p-share-status{text-align:center;color:#aeb6c1;min-height:22px}
            .p2p-share-video{width:100%;max-height:68vh;background:#050608;border-radius:10px;object-fit:contain;display:none}.p2p-share-video.show{display:block}
            .p2p-share-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.p2p-share-actions button{padding:10px 16px;border:1px solid rgba(255,255,255,.13);border-radius:9px;background:#ffffff10;color:inherit;cursor:pointer}
            .p2p-share-actions button.danger{background:#a52b3b;color:#fff}.p2p-share-note{text-align:center;color:#8f98a4;font-size:13px;line-height:1.45}
            #p2pIncoming{position:fixed;right:18px;bottom:18px;z-index:30001;width:min(390px,calc(100vw - 36px));display:none;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid rgba(255,255,255,.13);border-radius:12px;box-shadow:0 18px 60px #000b;padding:15px;box-sizing:border-box}
            #p2pIncoming.show{display:block}.p2p-incoming-actions{display:flex;gap:8px;margin-top:12px}.p2p-incoming-actions button{flex:1;padding:10px;border-radius:8px;border:1px solid #ffffff18;background:#ffffff0d;color:inherit;cursor:pointer}.p2p-incoming-actions .accept{background:#267a50}
        `;
        document.head.appendChild(s);
    }

    function buildUI() {
        if (document.getElementById("p2pScreenShareOverlay")) return;
        const overlay = document.createElement("div");
        overlay.id = "p2pScreenShareOverlay";
        overlay.innerHTML = `
            <div class="p2p-share-box">
                <div class="p2p-share-head"><strong id="p2pTitle">🖥️ Screen Share</strong><button class="p2p-share-close" id="p2pClose">×</button></div>
                <div class="p2p-share-body">
                    <div id="p2pStatus" class="p2p-share-status">Not sharing</div>
                    <video id="p2pVideo" class="p2p-share-video" autoplay playsinline controls></video>
                    <div id="p2pActions" class="p2p-share-actions"></div>
                    <div class="p2p-share-note">Screen and optional system/tab audio are sent directly between browsers. The chat server is only used to coordinate the connection.</div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const incoming = document.createElement("div");
        incoming.id = "p2pIncoming";
        incoming.innerHTML = `<strong id="p2pIncomingTitle">🖥️ Incoming screen share</strong><div id="p2pIncomingText" style="margin-top:7px;color:#aeb6c1"></div><div class="p2p-incoming-actions"><button class="accept" id="p2pAccept">Watch</button><button id="p2pDecline">Not now</button></div>`;
        document.body.appendChild(incoming);

        document.getElementById("p2pClose").onclick = () => closeViewer(false);
        document.getElementById("p2pAccept").onclick = acceptIncoming;
        document.getElementById("p2pDecline").onclick = declineIncoming;
    }

    const overlay = () => document.getElementById("p2pScreenShareOverlay");
    const video = () => document.getElementById("p2pVideo");
    const status = text => { const e = document.getElementById("p2pStatus"); if (e) e.textContent = text; };
    const actions = html => { const e = document.getElementById("p2pActions"); if (e) e.innerHTML = html; };

    function open(title) {
        overlay().classList.add("open");
        document.getElementById("p2pTitle").textContent = title;
    }

    function close() {
        overlay().classList.remove("open");
    }

    function loadPeerJS() {
        return new Promise((resolve, reject) => {
            if (window.Peer) return resolve();
            const s = document.createElement("script");
            s.src = PEERJS;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Could not load the peer connection library."));
            document.head.appendChild(s);
        });
    }

    function createPeer() {
        return new Promise((resolve, reject) => {
            peer = new Peer({ debug: 0, config: { iceServers: ICE } });
            let done = false;
            const timer = setTimeout(() => { if (!done) { done = true; reject(new Error("Peer connection timed out.")); } }, 20000);
            peer.on("open", peerId => { if (!done) { done = true; clearTimeout(timer); resolve(peerId); } });
            peer.on("error", error => { if (!done) { done = true; clearTimeout(timer); reject(error); } });
            peer.on("disconnected", () => { try { peer.reconnect(); } catch (_) {} });
        });
    }

    async function signal(type, data = {}) {
        if (typeof apiPost !== "function") throw new Error("Chat server is not ready.");
        const payload = { type, session: session?.id || data.session, from: id(), fromName: name(), createdAt: Date.now(), ...data };
        await apiPost({
            game_server: true,
            username: "__GAME_SERVER__",
            channel: channel(),
            message: PREFIX + JSON.stringify(payload),
            device_id: id()
        });
    }

    function signals() {
        const result = [];
        let list = [];
        try { list = typeof currentMessages !== "undefined" && Array.isArray(currentMessages) ? currentMessages : []; } catch (_) {}
        for (const m of list) {
            if (!m || m.username !== "__GAME_SERVER__") continue;
            const raw = String(m.message || "");
            if (!raw.startsWith(PREFIX)) continue;
            try {
                const data = JSON.parse(raw.slice(PREFIX.length));
                if (!data?.type || !data?.createdAt) continue;
                if (Date.now() - Number(data.createdAt) > 120000) continue;
                const key = String(m.id || `${data.session}:${data.type}:${data.from}:${data.createdAt}`);
                if (lastSignals.has(key)) continue;
                lastSignals.add(key);
                result.push(data);
            } catch (_) {}
        }
        if (lastSignals.size > 500) lastSignals = new Set([...lastSignals].slice(-250));
        return result;
    }

    function addHeaderButton() {
        const host = document.querySelector(".header-actions");
        if (!host || document.getElementById("p2pScreenShareBtn")) return;
        const button = document.createElement("button");
        button.id = "p2pScreenShareBtn";
        button.className = "icon-btn";
        button.title = "Screen share with audio";
        button.setAttribute("aria-label", "Screen share with audio");
        button.textContent = "🖥️";
        button.onclick = startHosting;
        host.insertBefore(button, host.firstChild);
    }

    async function startHosting() {
        if (hosting) {
            open("🖥️ You are sharing");
            return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) {
            alert("Screen sharing is not supported by this browser.");
            return;
        }
        if (!name()) {
            alert("Set your username in Settings first.");
            return;
        }
        try {
            await loadPeerJS();
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
                systemAudio: "include",
                surfaceSwitching: "include",
                selfBrowserSurface: "exclude"
            });
            const peerId = await createPeer();
            session = { id: crypto.randomUUID(), peerId, hostId: id(), hostName: name() };
            hosting = true;
            stream.getVideoTracks()[0]?.addEventListener("ended", () => stopHosting());
            peer.on("call", call => {
                if (!hosting || !stream || call.metadata?.type !== "chat-screen-share" || call.metadata.session !== session.id) {
                    try { call.close(); } catch (_) {}
                    return;
                }
                try { call.answer(stream); viewers.set(call.peer, call); } catch (_) {}
                call.on("close", () => viewers.delete(call.peer));
            });
            open("🖥️ You are sharing");
            const audioOn = stream.getAudioTracks().length > 0;
            status(`Live in chat · ${audioOn ? "audio is included" : "no shared audio was provided by the browser"}`);
            actions(`<button class="danger" id="p2pStop">Stop sharing</button>`);
            document.getElementById("p2pStop").onclick = stopHosting;
            await signal("start", { session: session.id, peerId, hostId: id(), hostName: name(), audio: audioOn });
            video().srcObject = stream;
            video().muted = true;
            video().classList.add("show");
        } catch (error) {
            console.error(error);
            if (stream) stream.getTracks().forEach(t => t.stop());
            stream = null;
            if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
            if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") alert(error.message || "Could not start screen sharing.");
        }
    }

    let pendingIncoming = null;

    function showIncoming(data) {
        if (hosting || watching || pendingIncoming || data.hostId === id()) return;
        pendingIncoming = data;
        document.getElementById("p2pIncomingTitle").textContent = `🖥️ ${data.hostName || "Someone"} is sharing`;
        document.getElementById("p2pIncomingText").textContent = data.audio ? "Screen share with audio is available." : "Screen share is available.";
        document.getElementById("p2pIncoming").classList.add("show");
    }

    async function acceptIncoming() {
        const data = pendingIncoming;
        pendingIncoming = null;
        document.getElementById("p2pIncoming").classList.remove("show");
        if (!data) return;
        try {
            await loadPeerJS();
            const viewerPeerId = await createPeer();
            watching = true;
            session = { id: data.session, peerId: viewerPeerId, hostId: data.hostId, hostName: data.hostName };
            open(`🖥️ ${data.hostName || "Screen share"}`);
            status("Connecting…");
            actions(`<button class="danger" id="p2pLeave">Leave screen share</button>`);
            document.getElementById("p2pLeave").onclick = () => closeViewer(true);
            peer.on("call", call => {
                if (!watching || call.metadata?.type !== "chat-screen-share" || call.metadata.session !== data.session) {
                    try { call.close(); } catch (_) {}
                    return;
                }
                call.on("stream", remote => {
                    video().srcObject = remote;
                    video().muted = false;
                    video().classList.add("show");
                    status(remote.getAudioTracks().length ? "Live · audio connected" : "Live · no shared audio");
                    video().play().catch(() => {});
                });
                call.on("close", () => { if (watching) status("Host ended the share."); });
                call.on("error", () => { if (watching) status("Connection lost."); });
            });
            await signal("join", { session: data.session, hostId: data.hostId, hostPeerId: data.peerId, viewerPeerId });
        } catch (error) {
            console.error(error);
            watching = false;
            if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
            close();
            alert(error.message || "Could not join the screen share.");
        }
    }

    function declineIncoming() {
        const data = pendingIncoming;
        pendingIncoming = null;
        document.getElementById("p2pIncoming").classList.remove("show");
        if (data) signal("decline", { session: data.session, hostId: data.hostId }).catch(() => {});
    }

    async function handleJoin(data) {
        if (!hosting || !session || data.session !== session.id || data.hostId !== id() || !data.viewerPeerId) return;
        try {
            const call = peer.call(data.viewerPeerId, stream, { metadata: { type: "chat-screen-share", session: session.id } });
            if (!call) return;
            viewers.set(data.viewerPeerId, call);
            call.on("close", () => viewers.delete(data.viewerPeerId));
            call.on("error", () => viewers.delete(data.viewerPeerId));
        } catch (error) {
            console.warn("Could not connect viewer", error);
        }
    }

    async function handleSignal(data) {
        if (data.from === id()) return;
        if (data.type === "start") {
            showIncoming(data);
            return;
        }
        if (data.type === "join") {
            await handleJoin(data);
            return;
        }
        if (data.type === "stop" && watching && session?.id === data.session) {
            status("Screen share ended.");
            closeViewer(false);
            return;
        }
        if (data.type === "decline" && hosting && session?.id === data.session) {
            return;
        }
    }

    async function stopHosting() {
        if (!hosting) return;
        const old = session;
        hosting = false;
        if (old) signal("stop", { session: old.id, hostId: old.hostId }).catch(() => {});
        viewers.forEach(call => { try { call.close(); } catch (_) {} });
        viewers.clear();
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
        session = null;
        video().srcObject = null;
        video().classList.remove("show");
        close();
    }

    function closeViewer(sendLeave) {
        if (sendLeave && session) signal("leave", { session: session.id, hostId: session.hostId }).catch(() => {});
        watching = false;
        if (peer) { try { peer.destroy(); } catch (_) {} peer = null; }
        if (video()) { video().srcObject = null; video().classList.remove("show"); }
        session = null;
        close();
    }

    function poll() {
        for (const data of signals()) handleSignal(data).catch(console.error);
    }

    function init() {
        addStyles();
        buildUI();
        addHeaderButton();
        setInterval(addHeaderButton, 1000);
        pollTimer = setInterval(poll, 500);
    }

    window.addEventListener("load", init);
})();
