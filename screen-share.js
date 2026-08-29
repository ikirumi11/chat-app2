/* =====================================================
   SCREEN SHARE
   One broadcaster at a time, WebRTC, 15 FPS, no audio.
===================================================== */

const SCREEN_SHARE_API = "/api/screen-share";
const SCREEN_SHARE_POLL_MS = 500;
const SCREEN_SHARE_HEARTBEAT_MS = 5000;

let screenShareSession = null;
let screenShareRole = null; // "host" | "viewer"
let screenShareStream = null;
let screenShareLocalVideo = null;
let screenShareRemoteVideo = null;
let screenSharePollTimer = null;
let screenShareHeartbeatTimer = null;
let screenShareUi = null;
let screenShareLastSessionId = null;
const screenSharePeers = new Map();
const screenShareSeenSignals = new Set();
const screenSharePendingIce = new Map();

function screenShareUsername() {
    return (window.settings && settings.username) || "Screen Share";
}

function screenShareDeviceId() {
    return window.deviceId || localStorage.getItem("chat_device_id") || "";
}

async function screenShareRequest(method, body = null, query = "") {
    const options = {
        method,
        cache: "no-store",
        headers: {}
    };
    if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }
    const response = await fetch(SCREEN_SHARE_API + query, options);
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!response.ok) throw new Error(data.error || "Screen share request failed.");
    return data;
}

function ensureScreenShareUi() {
    if (screenShareUi) return screenShareUi;

    const wrap = document.createElement("div");
    wrap.id = "screenShareWidget";
    wrap.className = "screen-share-widget";
    wrap.innerHTML = `
        <div class="screen-share-top">
            <div>
                <strong id="screenShareTitle">Screen Share</strong>
                <span id="screenShareStatus">Not active</span>
            </div>
            <button id="screenShareClose" class="screen-share-close" title="Close viewer">×</button>
        </div>
        <video id="screenShareVideo" class="screen-share-video" autoplay playsinline muted></video>
        <div class="screen-share-actions">
            <button id="screenShareStart" class="screen-share-main-btn">🖥️ Share screen</button>
            <button id="screenShareStop" class="screen-share-stop-btn">Stop sharing</button>
        </div>
    `;
    document.body.appendChild(wrap);

    screenShareUi = {
        wrap,
        title: wrap.querySelector("#screenShareTitle"),
        status: wrap.querySelector("#screenShareStatus"),
        video: wrap.querySelector("#screenShareVideo"),
        start: wrap.querySelector("#screenShareStart"),
        stop: wrap.querySelector("#screenShareStop"),
        close: wrap.querySelector("#screenShareClose")
    };

    screenShareUi.start.onclick = startScreenShare;
    screenShareUi.stop.onclick = stopScreenShare;
    screenShareUi.close.onclick = () => {
        if (screenShareRole === "host") return;
        screenShareUi.wrap.classList.remove("show");
    };

    return screenShareUi;
}

function updateScreenShareUi() {
    const ui = ensureScreenShareUi();
    const active = !!screenShareSession;
    const isHost = screenShareRole === "host";

    ui.wrap.classList.toggle("show", active || isHost);
    ui.start.style.display = active ? "none" : "inline-flex";
    ui.stop.style.display = isHost ? "inline-flex" : "none";
    ui.close.style.display = isHost ? "none" : "inline-flex";

    if (isHost) {
        ui.title.textContent = "Your screen";
        ui.status.textContent = "LIVE · 15 FPS · No audio";
        ui.video.muted = true;
    } else if (active) {
        ui.title.textContent = `${screenShareSession.host_username || "Someone"}'s screen`;
        ui.status.textContent = "LIVE · 15 FPS · No audio";
        ui.video.muted = true;
    } else {
        ui.title.textContent = "Screen Share";
        ui.status.textContent = "Not active";
    }
}

function addScreenShareButton() {
    const actions = document.querySelector(".header-actions");
    if (!actions || document.getElementById("screenShareHeaderBtn")) return;

    const button = document.createElement("button");
    button.id = "screenShareHeaderBtn";
    button.className = "icon-btn screen-share-header-btn";
    button.title = "Screen share";
    button.setAttribute("aria-label", "Screen share");
    button.textContent = "🖥️";
    button.onclick = async () => {
        try {
            if (screenShareRole === "host") await stopScreenShare();
            else await startScreenShare();
        } catch (error) {
            alert(error.message);
        }
    };
    actions.insertBefore(button, actions.firstChild);
}

async function startScreenShare() {
    ensureScreenShareUi();

    if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen sharing is not supported by this browser.");
    }

    if (screenShareRole === "host") return;

    // Ask the server first. The fixed primary key makes the one-host rule atomic.
    let result;
    try {
        result = await screenShareRequest("POST", {
            action: "start",
            device_id: screenShareDeviceId(),
            username: screenShareUsername()
        });
    } catch (error) {
        if (/already sharing/i.test(error.message)) {
            await screenSharePoll();
            throw error;
        }
        throw error;
    }

    try {
        screenShareStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: 15, max: 15 }
            },
            audio: false
        });

        const track = screenShareStream.getVideoTracks()[0];
        if (track?.applyConstraints) {
            try { await track.applyConstraints({ frameRate: { ideal: 15, max: 15 } }); } catch {}
        }

        screenShareSession = result.session;
        screenShareRole = "host";
        screenShareLastSessionId = screenShareSession.id;
        screenShareSeenSignals.clear();

        screenShareLocalVideo = ensureScreenShareUi().video;
        screenShareLocalVideo.srcObject = screenShareStream;
        screenShareLocalVideo.muted = true;
        await screenShareLocalVideo.play().catch(() => {});

        track.onended = () => stopScreenShare();
        updateScreenShareUi();
        startScreenShareTimers();
    } catch (error) {
        try {
            await screenShareRequest("POST", {
                action: "stop",
                device_id: screenShareDeviceId()
            });
        } catch {}
        throw error;
    }
}

async function stopScreenShare() {
    if (screenShareRole !== "host") return;

    const oldSession = screenShareSession;
    stopScreenShareTimers();

    for (const pc of screenSharePeers.values()) pc.close();
    screenSharePeers.clear();
    screenSharePendingIce.clear();

    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        screenShareStream = null;
    }

    if (screenShareLocalVideo) screenShareLocalVideo.srcObject = null;

    screenShareRole = null;
    screenShareSession = null;
    screenShareLastSessionId = oldSession?.id || null;
    updateScreenShareUi();

    try {
        await screenShareRequest("POST", {
            action: "stop",
            device_id: screenShareDeviceId()
        });
    } catch (error) {
        console.warn("Could not stop screen share on server:", error);
    }
}

function startScreenShareTimers() {
    stopScreenShareTimers();
    screenSharePollTimer = setInterval(screenSharePoll, SCREEN_SHARE_POLL_MS);
    screenShareHeartbeatTimer = setInterval(async () => {
        if (screenShareRole !== "host") return;
        try {
            await screenShareRequest("POST", {
                action: "heartbeat",
                device_id: screenShareDeviceId()
            });
        } catch {}
    }, SCREEN_SHARE_HEARTBEAT_MS);
}

function stopScreenShareTimers() {
    if (screenSharePollTimer) clearInterval(screenSharePollTimer);
    if (screenShareHeartbeatTimer) clearInterval(screenShareHeartbeatTimer);
    screenSharePollTimer = null;
    screenShareHeartbeatTimer = null;
}

async function sendScreenShareSignal(targetDeviceId, type, payload) {
    if (!screenShareSession) return;
    await screenShareRequest("POST", {
        action: "signal",
        device_id: screenShareDeviceId(),
        target_device_id: targetDeviceId,
        type,
        payload
    });
}

function makePeer(targetDeviceId, initiator) {
    const old = screenSharePeers.get(targetDeviceId);
    if (old) old.close();
    screenSharePendingIce.delete(targetDeviceId);

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    });

    screenSharePeers.set(targetDeviceId, pc);

    pc.onicecandidate = event => {
        if (!event.candidate) return;
        sendScreenShareSignal(targetDeviceId, "ice", event.candidate.toJSON()).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
            if (screenSharePeers.get(targetDeviceId) === pc) screenSharePeers.delete(targetDeviceId);
        }
    };

    if (screenShareRole === "host") {
        for (const track of screenShareStream?.getVideoTracks() || []) {
            pc.addTrack(track, screenShareStream);
        }
    } else {
        pc.ontrack = event => {
            const video = ensureScreenShareUi().video;
            const [stream] = event.streams;
            if (stream) {
                screenShareRemoteVideo = video;
                video.srcObject = stream;
                video.muted = true;
                video.play().catch(() => {});
            }
        };
    }

    if (initiator) {
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => sendScreenShareSignal(targetDeviceId, "offer", pc.localDescription.toJSON()))
            .catch(() => {});
    }

    return pc;
}

async function handleScreenShareSignal(signal) {
    if (!signal?.id || screenShareSeenSignals.has(signal.id)) return;
    screenShareSeenSignals.add(signal.id);

    const sender = signal.sender_device_id;
    const type = signal.type;
    const payload = signal.payload;

    if (screenShareRole === "host" && type === "join") {
        const pc = makePeer(sender, true);
        return;
    }

    if (screenShareRole === "viewer" && sender === screenShareSession.host_device_id && type === "offer") {
        const pc = screenSharePeers.get(sender) || makePeer(sender, false);
        await pc.setRemoteDescription(payload);
        const queued = screenSharePendingIce.get(sender) || [];
        for (const candidate of queued) {
            try { await pc.addIceCandidate(candidate); } catch {}
        }
        screenSharePendingIce.delete(sender);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendScreenShareSignal(sender, "answer", pc.localDescription.toJSON());
        return;
    }

    if (type === "answer" && screenShareRole === "host") {
        const pc = screenSharePeers.get(sender);
        if (pc) {
            await pc.setRemoteDescription(payload);
            const queued = screenSharePendingIce.get(sender) || [];
            for (const candidate of queued) {
                try { await pc.addIceCandidate(candidate); } catch {}
            }
            screenSharePendingIce.delete(sender);
        }
        return;
    }

    if (type === "ice") {
        const peerId = screenShareRole === "host" ? sender : screenShareSession.host_device_id;
        const pc = screenSharePeers.get(peerId);
        if (!pc) return;

        if (pc.remoteDescription) {
            try { await pc.addIceCandidate(payload); } catch {}
        } else {
            const queue = screenSharePendingIce.get(peerId) || [];
            queue.push(payload);
            screenSharePendingIce.set(peerId, queue);
        }
    }
}

async function screenSharePoll() {
    try {
        const data = await screenShareRequest("GET", null, "?device_id=" + encodeURIComponent(screenShareDeviceId()) + "&_=" + Date.now());
        const session = data.active ? data.session : null;

        if (!session) {
            if (screenShareRole === "viewer") {
                leaveScreenShareViewer();
            }
            return;
        }

        if (screenShareRole === "host") {
            // Ignore the state we are already hosting.
            return;
        }

        const sessionChanged = screenShareLastSessionId !== session.id;
        screenShareSession = session;
        screenShareRole = "viewer";
        screenShareLastSessionId = session.id;
        updateScreenShareUi();

        if (sessionChanged) {
            screenShareSeenSignals.clear();
            for (const pc of screenSharePeers.values()) pc.close();
            screenSharePeers.clear();
            screenSharePendingIce.clear();
            await sendScreenShareSignal(session.host_device_id, "join", { device_id: screenShareDeviceId() });
        }

        for (const signal of data.signals || []) {
            await handleScreenShareSignal(signal);
        }
    } catch (error) {
        console.warn("Screen share sync failed:", error);
    }
}

function leaveScreenShareViewer() {
    for (const pc of screenSharePeers.values()) pc.close();
    screenSharePeers.clear();
    screenSharePendingIce.clear();
    if (screenShareRemoteVideo) screenShareRemoteVideo.srcObject = null;
    screenShareRemoteVideo = null;
    screenShareRole = null;
    screenShareSession = null;
    screenShareLastSessionId = null;
    screenShareSeenSignals.clear();
    updateScreenShareUi();
}

window.addEventListener("pagehide", () => {
    if (screenShareRole === "host") {
        try {
            navigator.sendBeacon(
                SCREEN_SHARE_API,
                new Blob([JSON.stringify({
                    action: "stop",
                    device_id: screenShareDeviceId()
                })], { type: "application/json" })
            );
        } catch {}
    }
});

document.addEventListener("DOMContentLoaded", () => {
    addScreenShareButton();
    ensureScreenShareUi();
    updateScreenShareUi();
    screenSharePoll();
    screenSharePollTimer = setInterval(screenSharePoll, SCREEN_SHARE_POLL_MS);
});
