/*
 * SCREEN SHARE CLIENT
 *
 * Design:
 * 1. The host creates exactly one server-side screen-share message.
 * 2. Captured frames are timestamped and appended to that session.
 * 3. A viewer chooses 0/1/3/5/10 seconds of delay.
 * 4. Frames older than the chosen delay are downloaded ahead of playback.
 * 5. Playback is local and follows capture timestamps, so network timing does not control FPS.
 * 6. Played frames are removed from the viewer's memory immediately.
 */
(() => {
  "use strict";

  const button = document.getElementById("screenShareHeaderBtn");
  if (!button) return;

  const API = "/api/screen-share";
  const QUALITY = [150, 300, 450, 600, 750, 900, 1050];
  const FPS = [5, 10, 15, 20, 25, 30, 45, 60];
  const DELAYS = [0, 1000, 3000, 5000, 10000];
  const POLL_MS = 100;

  let quality = Number(localStorage.getItem("screen_share_quality")) || 450;
  let fps = Number(localStorage.getItem("screen_share_fps")) || 25;
  let defaultDelay = Number(localStorage.getItem("screen_share_delay"));
  if (!QUALITY.includes(quality)) quality = 450;
  if (!FPS.includes(fps)) fps = 25;
  if (!DELAYS.includes(defaultDelay)) defaultDelay = 5000;

  let stream = null;
  let shareId = "";
  let sharing = false;
  let frozen = false;
  let watching = false;
  let delay = defaultDelay;
  let lastDownloaded = 0;
  let downloadedCount = 0;
  let playQueue = [];
  let playbackTimer = null;
  let polling = false;
  let promptShareKey = "";
  let serverFrames = 0;
  let readyFrames = 0;
  let sending = false;
  let sentFrames = 0;
  let displayedAt = 0;
  let displayedCapture = 0;

  function deviceId() {
    let id = localStorage.getItem("chat_device_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : "ss-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem("chat_device_id", id);
    }
    return id;
  }

  function username() {
    return window.settings?.username || localStorage.getItem("chat_username") || "User";
  }

  function channel() {
    return window.CHANNEL || "general";
  }

  const style = document.createElement("style");
  style.textContent = `
    .ss2-overlay{position:fixed;inset:0;z-index:20000;display:none;align-items:flex-start;justify-content:flex-end;padding:70px 18px;background:#0004}
    .ss2-overlay.show{display:flex}.ss2-box{width:min(410px,calc(100vw - 36px));background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #ffffff18;border-radius:12px;box-shadow:0 20px 60px #0009;overflow:hidden}.ss2-head{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid #ffffff14}.ss2-head strong{flex:1}.ss2-x{border:0;background:none;color:inherit;font-size:22px;cursor:pointer}.ss2-body{display:grid;gap:12px;padding:15px}.ss2-field{display:grid;gap:6px}.ss2-field label,.ss2-note{font-size:12px;opacity:.7}.ss2-select,.ss2-btn{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #ffffff1c;background:#ffffff0c;color:inherit}.ss2-btn{cursor:pointer;font-weight:600}.ss2-view{position:fixed;right:18px;bottom:85px;z-index:19000;width:min(820px,calc(100vw - 36px));display:none;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px #0009}.ss2-view.show{display:block}.ss2-vhead{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--panel,#20242b);color:var(--text,#fff)}.ss2-vhost{flex:1}.ss2-img{display:block;width:100%;max-height:600px;object-fit:contain;background:#000}.ss2-wait{padding:55px 15px;text-align:center;color:#fff}.ss2-controls{display:flex;gap:8px;padding:9px;background:var(--panel,#20242b)}.ss2-controls button{flex:1}.ss2-danger{background:#8d303055}.ss2-stats{position:fixed;right:18px;top:70px;z-index:21000;width:min(350px,calc(100vw - 36px));display:none;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #ffffff18;border-radius:12px;box-shadow:0 20px 60px #0009}.ss2-stats.show{display:block}.ss2-stat{display:flex;justify-content:space-between;gap:15px;padding:5px 13px;font-size:13px}.ss2-stat b{font-variant-numeric:tabular-nums}.ss2-stat:first-of-type{padding-top:13px}.ss2-stat:last-of-type{padding-bottom:13px}.ss2-small{padding:10px 13px;border-top:1px solid #ffffff12;font-size:11px;opacity:.6}
  `;
  document.head.appendChild(style);

  const menu = document.createElement("div");
  menu.className = "ss2-overlay";
  menu.innerHTML = `<div class="ss2-box"><div class="ss2-head"><strong>🖥️ Screen Share</strong><button class="ss2-x" data-close>×</button></div><div class="ss2-body"><div class="ss2-field"><label>Quality</label><select class="ss2-select" id="ss2Quality">${QUALITY.map(x => `<option value="${x}">${x}p</option>`).join("")}</select></div><div class="ss2-field"><label>FPS</label><select class="ss2-select" id="ss2Fps">${FPS.map(x => `<option value="${x}">${x} FPS</option>`).join("")}</select></div><div class="ss2-field"><label>Viewer delay</label><select class="ss2-select" id="ss2Delay">${DELAYS.map(x => `<option value="${x}">${x === 0 ? "0 sec — as live as possible" : (x / 1000) + " sec"}</option>`).join("")}</select></div><div class="ss2-note">Frames are downloaded ahead of playback. A longer delay gives the viewer more time to prepare the frames.</div><button class="ss2-btn" id="ss2Start">Start screen share</button></div></div>`;
  document.body.appendChild(menu);

  const prompt = document.createElement("div");
  prompt.className = "ss2-overlay";
  prompt.innerHTML = `<div class="ss2-box"><div class="ss2-head"><strong>🖥️ Screen share available</strong><button class="ss2-x" data-close>×</button></div><div class="ss2-body"><div>Someone is sharing their screen.</div><div class="ss2-field"><label>Viewer delay</label><select class="ss2-select" id="ss2WatchDelay">${DELAYS.map(x => `<option value="${x}">${x === 0 ? "0 sec — as live as possible" : (x / 1000) + " sec"}</option>`).join("")}</select></div><div class="ss2-note">The selected amount of time is used to download and prepare frames before they are shown.</div><button class="ss2-btn" id="ss2Watch">Watch</button><button class="ss2-btn" id="ss2No">Not now</button></div></div>`;
  document.body.appendChild(prompt);

  const viewer = document.createElement("div");
  viewer.className = "ss2-view";
  viewer.innerHTML = `<div class="ss2-vhead"><span class="ss2-vhost" id="ss2Host">🖥️ Screen Share</span><span id="ss2State">Buffering…</span><button class="ss2-x" id="ss2ViewerClose">×</button></div><div class="ss2-wait" id="ss2Wait">Preparing playback…</div><img class="ss2-img" id="ss2Image" style="display:none" alt="Screen share"><div class="ss2-controls" id="ss2Controls" style="display:none"><button class="ss2-btn" id="ss2Freeze">Freeze</button><button class="ss2-btn ss2-danger" id="ss2Stop">Stop</button></div>`;
  document.body.appendChild(viewer);

  const stats = document.createElement("div");
  stats.className = "ss2-stats";
  stats.innerHTML = `<div class="ss2-head"><strong>📊 Screen Share Diagnostics</strong><button class="ss2-x" id="ss2StatsClose">×</button></div><div class="ss2-stat"><span>Frames on server</span><b id="ss2Server">0</b></div><div class="ss2-stat"><span>Frames ready to download</span><b id="ss2Ready">0</b></div><div class="ss2-stat"><span>Frames downloaded here</span><b id="ss2Downloaded">0</b></div><div class="ss2-stat"><span>Frames waiting to play</span><b id="ss2Queue">0</b></div><div class="ss2-stat"><span>Frames sent by host</span><b id="ss2Sent">0</b></div><div class="ss2-stat"><span>Selected delay</span><b id="ss2DelayStat">5 sec</b></div><div class="ss2-stat"><span>Current playback position</span><b id="ss2Behind">—</b></div><div class="ss2-small">Server counts are shared-session statistics. Downloaded and queued counts are for this browser only.</div>`;
  document.body.appendChild(stats);

  const qualitySelect = menu.querySelector("#ss2Quality");
  const fpsSelect = menu.querySelector("#ss2Fps");
  const delaySelect = menu.querySelector("#ss2Delay");
  const watchDelay = prompt.querySelector("#ss2WatchDelay");
  const image = viewer.querySelector("#ss2Image");
  const waitBox = viewer.querySelector("#ss2Wait");
  const hostLabel = viewer.querySelector("#ss2Host");
  const stateLabel = viewer.querySelector("#ss2State");
  const controls = viewer.querySelector("#ss2Controls");
  const freezeButton = viewer.querySelector("#ss2Freeze");
  qualitySelect.value = quality;
  fpsSelect.value = fps;
  delaySelect.value = defaultDelay;
  watchDelay.value = defaultDelay;

  function close(el) { el.classList.remove("show"); }
  function show(el) { el.classList.add("show"); }
  function stat(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

  function updateStats() {
    stat("ss2Server", serverFrames);
    stat("ss2Ready", readyFrames);
    stat("ss2Downloaded", downloadedCount);
    stat("ss2Queue", playQueue.length);
    stat("ss2Sent", sentFrames);
    stat("ss2DelayStat", `${delay / 1000} sec`);
    const behind = displayedCapture ? Math.max(0, (Date.now() - displayedCapture) / 1000) : 0;
    stat("ss2Behind", displayedCapture ? `${behind.toFixed(2)} sec` : "—");
  }

  async function api(action, extra = {}) {
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action, channel: channel(), device_id: deviceId(), username: username(), share_id: shareId, quality, fps, ...extra })
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Screen share request failed (${response.status})`);
    return data;
  }

  async function startShare() {
    quality = Number(qualitySelect.value);
    fps = Number(fpsSelect.value);
    delay = Number(delaySelect.value);
    localStorage.setItem("screen_share_quality", quality);
    localStorage.setItem("screen_share_fps", fps);
    localStorage.setItem("screen_share_delay", delay);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("This browser does not support screen sharing.");
      return;
    }

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: fps, max: fps } },
        audio: false
      });

      const result = await api("start");
      if (!result.shareId) throw new Error("The server did not create a screen-share session.");
      shareId = String(result.shareId);
      sharing = true;
      frozen = false;
      sentFrames = 0;
      lastDownloaded = 0;
      show(viewer);
      hostLabel.textContent = "🖥️ You are hosting";
      stateLabel.textContent = "Starting…";
      controls.style.display = "flex";
      show(stats);
      beginCapture();
      stream.getVideoTracks()[0].addEventListener("ended", () => stopShare(true), { once: true });
    } catch (error) {
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = null;
      shareId = "";
      if (error?.name !== "NotAllowedError") alert(error?.message || "Could not start screen sharing.");
    }
  }

  function beginCapture() {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});

    let lastCapture = 0;
    async function captureFrame(now = performance.now()) {
      if (!sharing || frozen || sending || !stream || !shareId) return;
      const minInterval = 1000 / fps;
      if (now - lastCapture < minInterval - 1) return;
      if (!video.videoWidth || !video.videoHeight) return;
      lastCapture = now;

      const scale = Math.min(1, quality / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg", 0.28);
      const capturedAt = Date.now();

      sending = true;
      try {
        await api("frame", { image: imageData, capturedAt });
        sentFrames++;
      } catch (error) {
        // Keep capture alive. A temporary network failure should not kill the share.
      } finally {
        sending = false;
      }
    }

    if ("requestVideoFrameCallback" in video) {
      const loop = (_time, metadata) => {
        if (!sharing) return;
        captureFrame(metadata?.expectedDisplayTime || performance.now());
        video.requestVideoFrameCallback(loop);
      };
      video.requestVideoFrameCallback(loop);
    } else {
      const loop = () => {
        if (!sharing) return;
        captureFrame(performance.now());
        setTimeout(loop, Math.max(10, Math.floor(1000 / fps)));
      };
      loop();
    }
  }

  async function freezeShare() {
    frozen = !frozen;
    freezeButton.textContent = frozen ? "Resume" : "Freeze";
    stateLabel.textContent = frozen ? "Frozen" : "Sending";
    try { await api("freeze", { frozen }); } catch {}
  }

  async function stopShare(fromBrowser = false) {
    if (!sharing && !shareId) return;
    const oldId = shareId;
    sharing = false;
    frozen = false;
    shareId = oldId;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    try { await api("stop", { share_id: oldId }); } catch {}
    shareId = "";
    watching = false;
    playQueue = [];
    clearTimeout(playbackTimer);
    playbackTimer = null;
    close(viewer);
    close(stats);
    if (!fromBrowser) stateLabel.textContent = "Stopped";
  }

  function renderShare(share) {
    if (!share) return;
    show(viewer);
    const mine = share.deviceId === deviceId();
    hostLabel.textContent = mine ? "🖥️ You are hosting" : `🖥️ Screen shared by ${share.host || "User"}`;
    stateLabel.textContent = share.frozen ? "Frozen" : (delay === 0 ? "As live as possible" : `${delay / 1000} sec behind`);
    controls.style.display = mine ? "flex" : "none";
    if (mine) show(stats);
  }

  function enqueueFrames(frames) {
    if (!Array.isArray(frames)) return;
    let added = 0;
    for (const frame of frames) {
      if (!frame || typeof frame.i !== "string") continue;
      const t = Number(frame.t) || 0;
      if (!t || t <= lastDownloaded) continue;
      lastDownloaded = t;
      playQueue.push({ t, i: frame.i });
      downloadedCount++;
      added++;
    }
    if (added) {
      playQueue.sort((a, b) => a.t - b.t);
      if (!playbackTimer) startPlayback();
    }
    updateStats();
  }

  function startPlayback() {
    if (!watching || !playQueue.length) {
      playbackTimer = null;
      return;
    }
    const first = playQueue[0];
    const wallStart = performance.now();
    const captureStart = first.t;

    function next() {
      if (!watching) { playbackTimer = null; return; }
      if (!playQueue.length) {
        playbackTimer = setTimeout(() => { playbackTimer = null; startPlayback(); }, 20);
        return;
      }
      const frame = playQueue.shift();
      const target = wallStart + (frame.t - captureStart);
      const wait = Math.max(0, target - performance.now());
      playbackTimer = setTimeout(() => {
        image.src = frame.i;
        image.style.display = "block";
        waitBox.style.display = "none";
        displayedCapture = frame.t;
        displayedAt = Date.now();
        stateLabel.textContent = delay === 0 ? "As live as possible" : `${delay / 1000} sec behind`;
        updateStats();
        next();
      }, wait);
    }
    next();
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const url = `${API}?channel=${encodeURIComponent(channel())}&watch=${watching ? "1" : "0"}&after=${encodeURIComponent(lastDownloaded)}&delay=${delay}&_=${Date.now()}`;
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      const share = data.share;

      if (!share) {
        promptShareKey = "";
        if (!sharing) {
          close(viewer);
          close(stats);
          playQueue = [];
          clearTimeout(playbackTimer);
          playbackTimer = null;
        }
        return;
      }

      serverFrames = Number(data.stats?.serverFrames) || 0;
      readyFrames = Number(data.stats?.readyFrames) || 0;
      updateStats();

      if (share.deviceId === deviceId()) {
        renderShare(share);
        if (watching) enqueueFrames(data.frames);
      } else if (watching) {
        renderShare(share);
        enqueueFrames(data.frames);
      } else {
        const key = `${share.id}:${share.deviceId}`;
        if (promptShareKey !== key) {
          promptShareKey = key;
          show(prompt);
        }
      }
    } catch {
      // Polling failures are transient; keep the next poll alive.
    } finally {
      polling = false;
      setTimeout(poll, POLL_MS);
    }
  }

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    show(menu);
  });
  menu.querySelector("[data-close]").onclick = () => close(menu);
  prompt.querySelector("[data-close]").onclick = () => close(prompt);
  prompt.querySelector("#ss2No").onclick = () => { close(prompt); };
  prompt.querySelector("#ss2Watch").onclick = () => {
    delay = Number(watchDelay.value);
    localStorage.setItem("screen_share_delay", delay);
    watching = true;
    lastDownloaded = 0;
    downloadedCount = 0;
    playQueue = [];
    clearTimeout(playbackTimer);
    playbackTimer = null;
    close(prompt);
    waitBox.style.display = "block";
    image.style.display = "none";
    poll();
  };
  menu.querySelector("#ss2Start").onclick = startShare;
  viewer.querySelector("#ss2ViewerClose").onclick = () => {
    watching = false;
    playQueue = [];
    clearTimeout(playbackTimer);
    playbackTimer = null;
    close(viewer);
  };
  freezeButton.onclick = freezeShare;
  viewer.querySelector("#ss2Stop").onclick = () => stopShare(false);
  stats.querySelector("#ss2StatsClose").onclick = () => close(stats);

  setTimeout(poll, 100);
})();
