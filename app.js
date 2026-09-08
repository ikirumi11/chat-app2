/* =====================================================
   CONFIG
===================================================== */

const API_URL="/api/messages";
const CHANNEL="general";

const GAME_PREFIX="__CHAT_GAME_STATE__:";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/* =====================================================
   STARTUP SYNC
===================================================== */

// Supabase-backed startup: wait one second after the page loads before asking
// the server for messages/profile data. This prevents the UI from briefly
// using the default/old local name before the server profile arrives.
const chatStartupReady = new Promise(resolve => {
    setTimeout(resolve, 1000);
});

/* =====================================================
   DEVICE
===================================================== */

let mediaRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceStartedAt = 0;
let voiceTimer = null;

const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");
const voiceStatusText = document.getElementById("voiceStatusText");

function formatVoiceTime(seconds){
    const m=Math.floor(seconds/60);
    const sec=String(seconds%60).padStart(2,"0");
    return `${m}:${sec}`;
}

function stopVoiceStream(){
    if(voiceTimer){clearInterval(voiceTimer);voiceTimer=null;}
    if(voiceStream){voiceStream.getTracks().forEach(t=>t.stop());voiceStream=null;}
    voiceBtn.classList.remove("recording");
    voiceStatus.classList.remove("show");
}

async function startVoiceRecording(){
    if(mediaRecorder) return;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        alert("Voice recording is not supported by this browser.");
        return;
    }
    try{
        voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
        const mimeTypes=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"];
        const mime=mimeTypes.find(t=>MediaRecorder.isTypeSupported(t)) || "";
        mediaRecorder=new MediaRecorder(voiceStream,mime?{mimeType:mime}:undefined);
        voiceChunks=[];
        voiceStartedAt=Date.now();
        voiceBtn.classList.add("recording");
        voiceStatus.classList.add("show");
        voiceStatusText.textContent="Recording 0:00 — tap 🎙️ to stop";
        voiceTimer=setInterval(()=>{
            voiceStatusText.textContent=`Recording ${formatVoiceTime(Math.floor((Date.now()-voiceStartedAt)/1000))} — tap 🎙️ to stop`;
        },500);
        mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size)voiceChunks.push(e.data);};
        mediaRecorder.onstop=async()=>{
            const type=mediaRecorder.mimeType || "audio/webm";
            const blob=new Blob(voiceChunks,{type});
            mediaRecorder=null;
            stopVoiceStream();
            if(blob.size>MAX_VOICE_BYTES){
                alert("Voice message is too large. Please record a shorter message.");
                return;
            }
            if(blob.size<1000)return;
            const ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";
            pendingFiles.push({name:`Voice message.${ext}`,data:await blobToDataURL(blob),size:blob.size,type,audio:true,base64:true});
            renderFilePreview();
        };
        mediaRecorder.start(250);
    }catch(error){
        stopVoiceStream();
        mediaRecorder=null;
        alert("Microphone permission is required to record a voice message.");
    }
}

function stopVoiceRecording(){
    if(mediaRecorder && mediaRecorder.state!=="inactive") mediaRecorder.stop();
}

voiceBtn.addEventListener("click",()=>mediaRecorder?stopVoiceRecording():startVoiceRecording());

let deviceId=localStorage.getItem("chat_device_id");
if(!deviceId){
    if(window.crypto && crypto.randomUUID){deviceId=crypto.randomUUID();}
    else{deviceId=Date.now().toString(36)+Math.random().toString(36).slice(2);}
    localStorage.setItem("chat_device_id",deviceId);
}

/* =====================================================
   SETTINGS
===================================================== */

const defaults={username:"",refreshRate:500,showTimestamps:true,textSize:16,wordSpacing:0,lineSpacing:1.45,cornerRadius:12,uiScale:1,theme:"dark",enterToSend:true,autoScroll:true};
function getSetting(key){
    const value=localStorage.getItem("chat_"+key);
    if(value===null)return defaults[key];
    if(value==="true"||value==="false")return value==="true";
    const number=Number(value);
    return Number.isNaN(number)?value:number;
}
let settings={};
Object.keys(defaults).forEach(key=>{settings[key]=getSetting(key);});

/* =====================================================
   ELEMENTS
===================================================== */

const messagesEl=document.getElementById("messages");
const messageInput=document.getElementById("messageInput");
const sendBtn=document.getElementById("sendBtn");
const attachBtn=document.getElementById("attachBtn");
const fileInput=document.getElementById("fileInput");
const filePreview=document.getElementById("filePreview");
const gamesBtn=document.getElementById("gamesBtn");
const gamesOverlay=document.getElementById("gamesOverlay");
const closeGames=document.getElementById("closeGames");
const settingsBtn=document.getElementById("settingsBtn");
const settingsOverlay=document.getElementById("settingsOverlay");
const closeSettings=document.getElementById("closeSettings");
const saveSettings=document.getElementById("saveSettings");
const usernameInput=document.getElementById("usernameInput");
const deviceIdInput=document.getElementById("deviceIdInput");
const profilePictureInput=document.getElementById("profilePictureInput");
const profilePicturePreview=document.getElementById("profilePicturePreview");
const refreshRate=document.getElementById("refreshRate");
const showTimestamps=document.getElementById("showTimestamps");
const themeSelect=document.getElementById("themeSelect");
const textSize=document.getElementById("textSize");
const wordSpacing=document.getElementById("wordSpacing");
const lineSpacing=document.getElementById("lineSpacing");
const cornerRadius=document.getElementById("cornerRadius");
const uiScale=document.getElementById("uiScale");
const enterToSend=document.getElementById("enterToSend");
const autoScroll=document.getElementById("autoScroll");
const textSizeValue=document.getElementById("textSizeValue");
const wordSpacingValue=document.getElementById("wordSpacingValue");
const lineSpacingValue=document.getElementById("lineSpacingValue");
const cornerRadiusValue=document.getElementById("cornerRadiusValue");
const uiScaleValue=document.getElementById("uiScaleValue");
const confirmOverlay=document.getElementById("confirmOverlay");
const confirmTitle=document.getElementById("confirmTitle");
const confirmText=document.getElementById("confirmText");
const confirmCancel=document.getElementById("confirmCancel");
const confirmYes=document.getElementById("confirmYes");
const removeEverything=document.getElementById("removeEverything");

/* =====================================================
   LOCAL STATE
===================================================== */

let currentMessages=[];
let games=[];
let refreshTimer=null;
const stoppedGames = new Set();
let syncing=false;
let confirmCallback=null;
let renderedElements=new Map();
let renderedData=new Map();
let seenMessageIds=new Set();
let seenGameIds=new Set();
let profiles={};
let pendingProfilePicture="";
let pendingFiles=[];

/* =====================================================
   SERVER STARTUP
===================================================== */

async function startChatAfterServerDelay(){
    await chatStartupReady;

    // The Supabase wrapper waits for this event before its initial history
    // request. Calling loadMessages here guarantees the UI also refreshes
    // after the device profile has had time to load.
    try{
        if(window.chatSupabaseReady) await window.chatSupabaseReady;
        await loadMessages();
    }catch(error){
        console.error("Chat startup sync failed:",error);
    }
}

/* =====================================================
   EXISTING APP CODE
===================================================== */

