(() => {
"use strict";

const GOOGLE_APPS_SCRIPT_URL = window.CHAT_GOOGLE_APPS_SCRIPT_URL || localStorage.getItem("chat_google_apps_script_url") || "https://script.google.com/macros/s/AKfycbygvXPJ1c1qAcTTCfakM7LHK1DnCYUxP7f73DF6mk04GjvQtvP4_iSL2u1x2pzgAyh8/exec";
const API_URL = GOOGLE_APPS_SCRIPT_URL;
const ORIGINAL_FETCH = window.fetch.bind(window);

let getInFlight = null;
let lastGetResult = {success:true,messages:[]};
const p2pInbox = new Map();
const p2pPeers = new Map();
const p2pConnections = new Map();
const p2pSeenSignals = new Set();
let p2pSignalSince = "";
let p2pStarted = false;
let p2pPeerTimer = null;
let p2pSignalTimer = null;
let p2pHeartbeatTimer = null;

function localId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function deviceId() {
    let id = localStorage.getItem("chat_device_id");
    if (!id) {
        id = localId();
        localStorage.setItem("chat_device_id", id);
    }
    return id;
}

const P2P_DEVICE_ID = deviceId();

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
        created_at: body.created_at || new Date().toISOString()
    };
}

function jsonResponse(body,status=200) {
    return new Response(JSON.stringify(body),{
        status,
        headers:{"Content-Type":"application/json"}
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

    getInFlight = new Promise((resolve,reject) => {
        const callback = "__chatSheets_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const script = document.createElement("script");
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Google Sheets request timed out."));
        },10000);

        function cleanup() {
            clearTimeout(timeout);
            delete window[callback];
            script.remove();
            getInFlight = null;
        }

        window[callback] = data => {
            lastGetResult = data || {success:true,messages:[]};
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

function p2pJsonp(params) {
    return new Promise((resolve,reject) => {
        const callback = "__chatP2P_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const script = document.createElement("script");
        const query = Object.entries(params)
            .map(([k,v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
            .join("&");
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("P2P signaling timeout"));
        },8000);

        function cleanup() {
            clearTimeout(timeout);
            delete window[callback];
            script.remove();
        }

        window[callback] = data => {
            cleanup();
            resolve(data || {});
        };

        script.onerror = () => {
            cleanup();
            reject(new Error("P2P signaling unavailable"));
        };

        script.src = API_URL + (API_URL.includes("?") ? "&" : "?") + query + "&callback=" + encodeURIComponent(callback) + "&_=" + Date.now();
        document.head.appendChild(script);
    });
}

async function p2pPost(payload) {
    if (!API_URL || API_URL.includes("PASTE_YOUR_")) return;

    try {
        await ORIGINAL_FETCH(API_URL,{
            method:"POST",
            mode:"no-cors",
            headers:{"Content-Type":"text/plain;charset=utf-8"},
            body:JSON.stringify(payload),
            keepalive:true
        });
    } catch {}
}

function addInbox(message) {
    if (!message || !message.id) return;
    if (!p2pInbox.has(message.id)) p2pInbox.set(message.id,message);
    window.dispatchEvent(new CustomEvent("chat-p2p-message",{detail:message}));
}

function getInboxMessages(channel) {
    return [...p2pInbox.values()].filter(m => m.channel === channel);
}

function cleanupInbox(messages) {
    const ids = new Set(messages.map(m => m.id));
    for (const id of p2pInbox.keys()) {
        if (ids.has(id)) p2pInbox.delete(id);
    }
}

async function waitForIce(pc) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise(resolve => {
        const timeout = setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange",check);
            resolve();
        },5000);

        function check() {
            if (pc.iceGatheringState === "complete") {
                clearTimeout(timeout);
                pc.removeEventListener("icegatheringstatechange",check);
                resolve();
            }
        }

        pc.addEventListener("icegatheringstatechange",check);
    });
}

function closePeer(peerId) {
    const entry = p2pConnections.get(peerId);
    if (!entry) return;
    try { entry.channel?.close(); } catch {}
    try { entry.pc?.close(); } catch {}
    p2pConnections.delete(peerId);
}

function setupChannel(peerId,channel) {
    const entry = p2pConnections.get(peerId);
    if (!entry) return;

    entry.channel = channel;

    channel.onopen = () => {
        entry.open = true;
        try {
            channel.send(JSON.stringify({
                type:"hello",
                device_id:P2P_DEVICE_ID
            }));
        } catch {}
    };

    channel.onmessage = event => {
        try {
            const packet = JSON.parse(event.data);
            if (packet.type === "chat" && packet.message) {
                addInbox(packet.message);
            }
        } catch {}
    };

    channel.onclose = () => {
        entry.open = false;
    };

    channel.onerror = () => {
        entry.open = false;
    };
}

async function createPeer(peerId,offerer) {
    if (!peerId || peerId === P2P_DEVICE_ID) return null;

    const existing = p2pConnections.get(peerId);
    if (existing && (existing.open || existing.pc.connectionState === "connected")) return existing;

    closePeer(peerId);

    const pc = new RTCPeerConnection({
        iceServers:[
            {urls:"stun:stun.l.google.com:19302"},
            {urls:"stun:stun.cloudflare.com:3478"}
        ]
    });

    const entry = {pc,channel:null,open:false};
    p2pConnections.set(peerId,entry);

    pc.ondatachannel = event => setupChannel(peerId,event.channel);

    pc.onconnectionstatechange = () => {
        if (["failed","closed"].includes(pc.connectionState)) {
            closePeer(peerId);
        }
    };

    if (offerer) {
        setupChannel(peerId,pc.createDataChannel("chat",{ordered:true}));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc);

        await p2pPost({
            _method:"P2P_SIGNAL",
            from:P2P_DEVICE_ID,
            to:peerId,
            type:"offer",
            data:JSON.stringify(pc.localDescription)
        });
    }

    return entry;
}

async function handleSignal(signal) {
    if (!signal || !signal.id || p2pSeenSignals.has(signal.id)) return;
    p2pSeenSignals.add(signal.id);

    if (signal.type === "offer") {
        const entry = await createPeer(signal.from,false);
        if (!entry) return;

        await entry.pc.setRemoteDescription(JSON.parse(signal.data));
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        await waitForIce(entry.pc);

        await p2pPost({
            _method:"P2P_SIGNAL",
            from:P2P_DEVICE_ID,
            to:signal.from,
            type:"answer",
            data:JSON.stringify(entry.pc.localDescription)
        });
        return;
    }

    if (signal.type === "answer") {
        const entry = p2pConnections.get(signal.from);
        if (!entry) return;
        if (entry.pc.signalingState !== "have-local-offer") return;
        await entry.pc.setRemoteDescription(JSON.parse(signal.data));
    }
}

async function discoverPeers() {
    if (!API_URL || API_URL.includes("PASTE_YOUR_") || !window.RTCPeerConnection) return;

    try {
        await p2pPost({
            _method:"P2P_HEARTBEAT",
            device_id:P2P_DEVICE_ID
        });

        const result = await p2pJsonp({p2p:"peers"});
        const peers = Array.isArray(result.peers) ? result.peers : [];

        for (const peer of peers) {
            const id = String(peer.device_id || "");
            if (!id || id === P2P_DEVICE_ID) continue;

            p2pPeers.set(id,Date.now());

            if (!p2pConnections.has(id)) {
                const offerer = P2P_DEVICE_ID < id;
                await createPeer(id,offerer);
            }
        }

        for (const [id] of p2pConnections) {
            if (!p2pPeers.has(id)) closePeer(id);
        }
    } catch {}
}

async function pollSignals() {
    if (!API_URL || API_URL.includes("PASTE_YOUR_")) return;

    try {
        const result = await p2pJsonp({
            p2p:"signals",
            device_id:P2P_DEVICE_ID,
            since:p2pSignalSince
        });

        const signals = Array.isArray(result.signals) ? result.signals : [];

        for (const signal of signals) {
            if (signal.created_at > p2pSignalSince) p2pSignalSince = signal.created_at;
            await handleSignal(signal);
        }
    } catch {}
}

function broadcastP2P(message) {
    if (!message || message.username === "__GAME_SERVER__") return false;

    let sent = false;
    const payload = JSON.stringify({
        type:"chat",
        message
    });

    for (const [,entry] of p2pConnections) {
        if (entry.open && entry.channel?.readyState === "open") {
            try {
                entry.channel.send(payload);
                sent = true;
            } catch {}
        }
    }

    return sent;
}

async function startP2P() {
    if (p2pStarted || !window.RTCPeerConnection) return;
    if (!API_URL || API_URL.includes("PASTE_YOUR_")) return;

    p2pStarted = true;

    await discoverPeers();

    p2pHeartbeatTimer = setInterval(() => {
        p2pPost({
            _method:"P2P_HEARTBEAT",
            device_id:P2P_DEVICE_ID
        });
    },5000);

    p2pPeerTimer = setInterval(discoverPeers,5000);
    p2pSignalTimer = setInterval(pollSignals,500);

    pollSignals();
}

async function sendToSheets(body) {
    const payload = {...body};

    if (!payload.id) payload.id = localId();

    const optimistic = payload.game_server === true
        ? {success:true,game:localMessage(payload)}
        : {success:true,message:localMessage(payload)};

    const directSent = payload.game_server !== true && broadcastP2P(optimistic.message);

    try {
        await ORIGINAL_FETCH(API_URL,{
            method:"POST",
            mode:"no-cors",
            headers:{"Content-Type":"text/plain;charset=utf-8"},
            body:JSON.stringify(payload),
            keepalive:true
        });
    } catch (error) {
        if (!directSent) throw new Error(error?.message || "Could not send to Google Sheets.");
    }

    return optimistic;
}

async function apiRequest(method,body,url) {
    if (!API_URL || API_URL.includes("PASTE_YOUR_")) {
        throw new Error("Google Apps Script URL is not configured. Set chat_google_apps_script_url in localStorage or edit api/messages.js.");
    }

    if (method === "GET") {
        const channel = String(url.searchParams.get("channel") || "general").slice(0,32);
        const target = API_URL +
            (API_URL.includes("?") ? "&" : "?") +
            "channel=" + encodeURIComponent(channel);

        const result = await jsonp(target);
        const backupMessages = Array.isArray(result.messages) ? result.messages : [];
        const p2pMessages = getInboxMessages(channel);
        const merged = new Map();

        for (const message of backupMessages) merged.set(message.id,message);
        for (const message of p2pMessages) {
            if (!merged.has(message.id) || new Date(message.created_at) > new Date(merged.get(message.id).created_at)) {
                merged.set(message.id,message);
            }
        }

        const messages = [...merged.values()].sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
        cleanupInbox(messages);

        return jsonResponse({
            ...result,
            messages
        });
    }

    if (method === "POST") return jsonResponse(await sendToSheets(body));

    if (method === "PATCH") return jsonResponse(await sendToSheets({...body,_method:"PATCH"}));

    if (method === "DELETE") return jsonResponse(await sendToSheets({...body,_method:"DELETE"}));

    return jsonResponse({error:"Method not allowed."},405);
}

window.fetch = async function(input,options={}) {
    try {
        const rawUrl = typeof input === "string" ? input : input?.url || "";
        const url = new URL(rawUrl,window.location.href);
        const path = url.pathname.replace(/\/+$/,"") || "/";
        const method = String(options?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();

        if (path === "/api/messages") {
            return await apiRequest(method,parseBody(options),url);
        }

        if (path === "/api/message-actions") {
            const body = parseBody(options);

            if (method !== "POST") return jsonResponse({error:"Method not allowed."},405);

            const actionMethod =
                body.action === "edit" ? "PATCH" :
                body.action === "delete" ? "DELETE" : "";

            if (!actionMethod) return jsonResponse({error:"Unknown action."},400);

            return await apiRequest(actionMethod,{
                ...body,
                _method:actionMethod,
                message:body.message,
                id:body.id,
                device_id:body.device_id
            },url);
        }
    } catch (error) {
        return jsonResponse({error:error?.message || "Chat API error."},500);
    }

    return ORIGINAL_FETCH(input,options);
};

window.ChatGoogleSheetsAPI = {
    url:API_URL,
    pollInterval:500,
    p2p:true,
    p2pDeviceId:P2P_DEVICE_ID
};

window.ChatP2P = {
    send:broadcastP2P,
    isConnected:() => [...p2pConnections.values()].some(x => x.open),
    peers:() => [...p2pConnections.entries()].filter(([,x]) => x.open).map(([id]) => id)
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",startP2P,{once:true});
} else {
    startP2P();
}

})();