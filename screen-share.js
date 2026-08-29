/* =====================================================
   SCREEN SHARE
   One broadcaster at a time, WebRTC, configurable up to
   450p / 35 FPS, no audio.
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

const SCREEN_SHARE_QUALITIES = {
    "240": { width: 426, height: 240 },
    "360": { width: 640, height: 360 },
    "450": { width: 800, height: 450 }
};

function screenShareUsername() {
    return (window.settings && settings.username) || "Screen Share";
}

function screenShareDeviceId() {
    return window.deviceId || localStorage.getItem("chat_device_id") || "";
}

async function screenShareRequest(method, body = null, query = "") {
    const options = { method, cache: "no-store", headers: {} };
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

function getSelectedShareSettings() {
    const quality = document.getElementById("screenShareQuality")?.value || "450";
    const fps = Math.min(35, Math.max(1, Number(document.getElementById("screenShareFps")?.value || 15)));
    return { quality, fps, ...SCREEN_SHARE_QUALITIES[quality] };
}

function describeDisplaySurface(track) {
    const settings = track?.getSettings?.() || {};
    const surface = settings.displaySurface;
    if (surface === "window") return "Window";
    if (surface === "browser") return "Browser tab";
    if (surface === "monitor") return "Entire screen";
    const label = (track?.label || "").toLowerCase();
    if (/tab|chrome|edge|opera|firefox/.test(label)) return "Browser tab";
    if (/window/.test(label)) return "Window";
    return "Screen / display";
}

function cleanShareLabel(track) {
    const label = String(track?.label || "Shared display").trim();
    return label.length > 100 ? label.slice(0, 100) + "…" : label;
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
        <div id="screenShareSourceInfo" class="screen-share-source-info"></div>
        <video id="screenShareVideo" class="screen-share-video" autoplay playsinline muted></video>
        <div class="screen-share-actions">
            <button id="screenShareStart" class="screen-share-main-btn">🖥️ Start sharing</button>
            <button id="screenShareStop" class="screen-share-stop-btn">Stop sharing</button>
        </div>
    `;
    document.body.appendChild(wrap);

    screenShareUi = {
        wrap,
        title: wrap.querySelector("#screenShareTitle"),
        status: wrap.querySelector("#screenShareStatus"),
        sourceInfo: wrap.querySelector("#screenShareSourceInfo"),
        video: wrap.querySelector("#screenShareVideo"),
        start: wrap.querySelector("#screenShareStart"),
        stop: wrap.querySelector("#screenShareStop"),
        close: wrap.querySelector("#screenShareClose")
    };

    screenShareUi.start.onclick = openScreenShareSettings;
    screenShareUi.stop.onclick = stopScreenShare;
    screenShareUi.close.onclick = () => {
        if (screenShareRole === "host") return;
        screenShareUi.wrap.classList.remove("show");
    };

    return screenShareUi;
}

function ensureScreenShareSettingsUi() {
    if (document.getElementById("screenShareSettingsOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "screenShareSettingsOverlay";
    overlay.className = "screen-share-settings-overlay";
    overlay.innerHTML = `
        <div class="screen-share-settings-panel" role="dialog" aria-modal="true" aria-labelledby="screenShareSettingsTitle">
            <div class="screen-share-settings-head">
                <div>
                    <h2 id="screenShareSettingsTitle">Start Screen Share</h2>
                    <p>Choose the stream quality before picking what to share.</p>
                </div>
                <button id="screenShareSettingsClose" class="screen-share-close" aria-label="Close">×</button>
            </div>

            <div class="screen-share-setting-row">
                <label for="screenShareQuality">Quality</label>
                <select id="screenShareQuality">
                    <option value="240">240p — low bandwidth</option>
                    <option value="360">360p — balanced</option>
                    <option value="450" selected>450p — maximum</option>
                </select>
            </div>

            <div class="screen-share-setting-row">
                <label for="screenShareFps">Frame rate <span id="screenShareFpsValue">15 FPS</span></label>
                <input id="screenShareFps" type="range" min="1" max="35" value="15" step="1">
            </div>

            <div class="screen-share-settings-preview">
                <div class="screen-share-preview-icon">🖥️</div>
                <div>
                    <strong>Audio: Off</strong>
                    <span>Maximum 450p · Maximum 35 FPS</span>
                </div>
            </div>

            <button id="screenShareConfirm" class="screen-share-confirm">Choose what to share</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const fps = overlay.querySelector("#screenShareFps");
    const fpsValue = overlay.querySelector("#screenShareFpsValue");
    fps.addEventListener("input", () => fpsValue.textContent = `${fps.value} FPS`);
    overlay.querySelector("#screenShareSettingsClose").onclick = closeScreenShareSettings;
    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeScreenShareSettings();
    });
    overlay.querySelector("#screenShareConfirm").onclick = () => startScreenShare();
}

function openScreenShareSettings() {
    ensureScreenShareSettingsUi();
    document.getElementById("screenShareSettingsOverlay").classList.add("show");
}

function closeScreenShareSettings() {
    document.getElementById("screenShareSettingsOverlay")?.classList.remove("show");
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
        ui.status.textContent = `LIVE · ${screenShareSession?.quality || "450"}p · ${screenShareSession?.fps || 15} FPS · No audio`;
        ui.sourceInfo.textContent = `${screenShareSession?.surface || "Screen / display"} · ${screenShareSession?.source_label || "Shared display"}`;
        ui.video.muted = true;
    } else if (active) {
        ui.title.textContent = `${screenShareSession.host_username || "Someone"}'s screen`;
        ui.status.textContent = `LIVE · ${screenShareSession.quality || "450"}p · ${screenShareSession.fps || 15} FPS · No audio`;
        ui.sourceInfo.textContent = `${screenShareSession.surface || "Screen / display"} · ${screenShareSession.source_label || "Shared display"}`;
        ui.video.muted = true;
    } else {
        ui.title.textContent = "Screen Share";
        ui.status.textContent = "Not active";
        ui.sourceInfo.textContent = "";
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
            else openScreenShareSettings();
        } catch (error) { alert(error.message); }
    };
    actions.insertBefore(button, actions.firstChild);
}

async function startScreenShare() {
    ensureScreenShareUi();
    ensureScreenShareSettingsUi();
    closeScreenShareSettings();

    if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen sharing is not supported by this browser.");
    }
    if (screenShareRole === "host") return;

    const selected = getSelectedShareSettings();

    // Reserve the single broadcaster slot before opening the picker.
    let result;
    try {
        result = await screenShareRequest("POST", {
            action: "start",
            device_id: screenShareDeviceId(),
            username: screenShareUsername(),
            quality: selected.quality,
            fps: selected.fps
        });
    } catch (error) {
        if (/already sharing/i.test(error.message)) await screenSharePoll();
        throw error;
    }

    try {
        screenShareStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: selected.width, max: selected.width },
                height: { ideal: selected.height, max: selected.height },
                frameRate: { ideal: selected.fps, max: selected.fps },
                resizeMode: "crop-and-scale"
            },
            audio: false
        });

        const track = screenShareStream.getVideoTracks()[0];
        if (!track) throw new Error("No screen video track was returned.");

        if (track.applyConstraints) {
            try {
                await track.applyConstraints({
                    width: { max: selected.width },
                    height: { max: selected.height },
                    frameRate: { max: selected.fps },
                    resizeMode: "crop-and-scale"
                });
            } catch {}
        }

        const actual = track.getSettings?.() || {};
        const actualWidth = actual.width || selected.width;
        const actualHeight = actual.height || selected.height;
        const actualFps = Math.min(selected.fps, Math.round(actual.frameRate || selected.fps));
        const surface = describeDisplaySurface(track);
        const sourceLabel = cleanShareLabel(track);
        const actualQuality = Math.min(450, Math.round(actualHeight));

        screenShareSession = {
            ...result.session,
            quality: actualQuality || selected.quality,
            fps: actualFps || selected.fps,
            width: actualWidth,
            height: actualHeight,
            surface,
            source_label: sourceLabel
        };
        screenShareRole = "host";
        screenShareLastSessionId = screenShareSession.id;
        screenShareSeenSignals.clear();

        // Apply a sender-side frame-rate cap as well. This keeps renegotiation
        // from accidentally exceeding the selected maximum.
        screenShareLocalVideo = ensureScreenShareUi().video;
        screenShareLocalVideo.srcObject = screenShareStream;
        screenShareLocalVideo.muted = true;
        await screenShareLocalVideo.play().catch(() => {});

        track.onended = () => stopScreenShare();
        updateScreenShareUi();
        startScreenShareTimers();
        await updateScreenShareSessionMetadata(screenShareSession);
    } catch (error) {
        screenShareStream?.getTracks?.().forEach(track => track.stop());
        screenShareStream = null;
        try {
            await screenShareRequest("POST", { action: "stop", device_id: screenShareDeviceId() });
        } catch {}
        throw error;
    }
}

async function updateScreenShareSessionMetadata(session) {
    try {
        await screenShareRequest("POST", {
            action: "metadata",
            device_id: screenShareDeviceId(),
            quality: session.quality,
            fps: session.fps,
            width: session.width,
            height: session.height,
            surface: session.surface,
            source_label: session.source_label
        });
    } catch (error) {
        console.warn("Could not publish screen share metadata:", error);
    }
}

async function stopScreenShare() {
    if (screenShareRole !== "host") return;

    const oldSession = screenShareSession;
    stopScreenShareTimers();
    for (const pc of screenSharePeers.values()) pc.close();
    screenSharePeers.clear();
    screenSharePendingIce.clear();

    screenShareStream?.getTracks?.().forEach(track => track.stop());
    screenShareStream = null;
    if (screenShareLocalVideo) screenShareLocalVideo.srcObject = null;

    screenShareRole = null;
    screenShareSession = null;
    screenShareLastSessionId = oldSession?.id || null;
    updateScreenShareUi();

    try {
        await screenShareRequest("POST", { action: "stop", device_id: screenShareDeviceId() });
    } catch (error) { console.warn("Could not stop screen share on server:", error); }
}

function startScreenShareTimers() {
    stopScreenShareTimers();
    screenSharePollTimer = setInterval(screenSharePoll, SCREEN_SHARE_POLL_MS);
    screenShareHeartbeatTimer = setInterval(async () => {
        if (screenShareRole !== "host") return;
        try { await screenShareRequest("POST", { action: "heartbeat", device_id: screenShareDeviceId() }); } catch {}
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
        if (event.candidate) sendScreenShareSignal(targetDeviceId, "ice", event.candidate.toJSON()).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
            if (screenSharePeers.get(targetDeviceId) === pc) screenSharePeers.delete(targetDeviceId);
        }
    };

    if (screenShareRole === "host") {
        for (const track of screenShareStream?.getVideoTracks() || []) pc.addTrack(track, screenShareStream);
        const sender = pc.getSenders().find(x => x.track?.kind === "video");
        if (sender) {
            sender.getParameters().then(parameters => {
                parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
                parameters.encodings[0].maxFramerate = Number(screenShareSession?.fps || 15);
                const height = Number(screenShareSession?.height || 450);
                parameters.encodings[0].scaleResolutionDownBy = Math.max(1, height / 450);
                return sender.setParameters(parameters);
            }).catch(() => {});
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

    if (screenShareRole === "host" && type === "join") { makePeer(sender, true); return; }

    if (screenShareRole === "viewer" && sender === screenShareSession.host_device_id && type === "offer") {
        const pc = screenSharePeers.get(sender) || makePeer(sender, false);
        await pc.setRemoteDescription(payload);
        const queued = screenSharePendingIce.get(sender) || [];
        for (const candidate of queued) { try { await pc.addIceCandidate(candidate); } catch {} }
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
            for (const candidate of queued) { try { await pc.addIceCandidate(candidate); } catch {} }
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
            if (screenShareRole === "viewer") leaveScreenShareViewer();
            return;
        }
        if (screenShareRole === "host") return;

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
        for (const signal of data.signals || []) await handleScreenShareSignal(signal);
    } catch (error) { console.warn("Screen share sync failed:", error); }
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
            navigator.sendBeacon(SCREEN_SHARE_API, new Blob([JSON.stringify({ action: "stop", device_id: screenShareDeviceId() })], { type: "application/json" }));
        } catch {}
    }
});

document.addEventListener("DOMContentLoaded", () => {
    addScreenShareButton();
    ensureScreenShareUi();
    ensureScreenShareSettingsUi();
    updateScreenShareUi();
    screenSharePoll();
    screenSharePollTimer = setInterval(screenSharePoll, SCREEN_SHARE_POLL_MS);
});
