/* =====================================================
   GAME TYPES
===================================================== */

const GAME_TYPES={

    // Tic Tac Toe Games (2-3 players)
    ttt3:{
        name:"Tic-Tac-Toe 3x3",
        icon:"❌",
        min:2,
        max:3,
        desc:"Get 3 in a row",
        size:3
    },
    ttt4:{
        name:"Tic-Tac-Toe 4x4",
        icon:"❌",
        min:2,
        max:3,
        desc:"Get 4 in a row",
        size:4
    },
    ttt5:{
        name:"Tic-Tac-Toe 5x5",
        icon:"❌",
        min:2,
        max:3,
        desc:"Get 5 in a row",
        size:5
    },
    ttt6:{
        name:"Tic-Tac-Toe 6x6",
        icon:"❌",
        min:2,
        max:3,
        desc:"Get 6 in a row",
        size:6
    },
    
    hangman:{
        name:"Hangman",
        icon:"🔤",
        min:2,
        max:2,
        desc:"One player chooses a word. The other guesses letters. 6 attempts.",
        size:null
    },
    battleship:{
        name:"Battleship",
        icon:"🚢",
        min:2,
        max:2,
        desc:"Place your fleet on a hidden 10x10 grid and destroy your opponent's ships.",
        size:10
    },
    // Original Games
    memory:{
        name:"Memory Match",
        icon:"🧠",
        min:2,
        max:6,
        desc:"Flip cards and match pairs"
    },
    quickdraw:{
        name:"Quick Draw",
        icon:"🏁",
        min:2,
        max:6,
        desc:"Click when DRAW! appears"
    },
    coinflip:{
        name:"Coin Flip Battle",
        icon:"🪙",
        min:2,
        max:6,
        desc:"Guess heads or tails"
    },
    numberguess:{
        name:"Number Guess",
        icon:"🔢",
        min:2,
        max:6,
        desc:"Guess the hidden number"
    },
    target:{
        name:"Target Click",
        icon:"🎯",
        min:2,
        max:6,
        desc:"Click the target as fast as you can"
    },
    reaction:{
        name:"Reaction Time",
        icon:"⚡",
        min:2,
        max:6,
        desc:"Click when the screen turns green"
    },
    type:{
        name:"Type Sentence",
        icon:"⌨️",
        min:2,
        max:6,
        desc:"Type the sentence as fast as you can"
    },
    boss:{
        name:"Boss Battle",
        icon:"👹",
        min:2,
        max:6,
        desc:"Defeat the monster with 100M HP!"
    },
    
    // 5 NEW GAMES
    trivia:{
        name:"Trivia Quiz",
        icon:"🧠",
        min:2,
        max:6,
        desc:"Answer questions correctly"
    },
    wordscramble:{
        name:"Word Scramble",
        icon:"🔤",
        min:2,
        max:6,
        desc:"Unscramble the letters"
    },
    mathrace:{
        name:"Math Race",
        icon:"➗",
        min:2,
        max:6,
        desc:"Solve math problems fast"
    },
    ttttournament:{
        name:"Tic-Tac-Toe Tournament",
        icon:"🏆",
        min:2,
        max:6,
        desc:"Round-robin Tic-Tac-Toe"
    },
    rpstournament:{
        name:"RPS Tournament",
        icon:"🏆",
        min:2,
        max:6,
        desc:"Rock Paper Scissors tournament"
    }
};



/* =====================================================
   FILE HANDLING / BASE64 MEDIA
===================================================== */

const MAX_IMAGE_DIMENSION = 1500;
const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60 * 60;

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(mimeType, fileName) {
    const type = (mimeType || '').toLowerCase();
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
    if (type.includes('text')) return '📝';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📙';
    if (type.includes('json') || type.includes('xml')) return '📋';
    if (type.includes('javascript') || type.includes('python') || type.includes('html')) return '💻';
    return '📎';
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
    });
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`"${file.name}" could not be read as an image.`));
        };
        img.src = url;
    });
}

function canvasToDataURL(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Could not convert image.'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not encode image.'));
            reader.readAsDataURL(blob);
        }, type, quality);
    });
}

async function imageToBase64(file) {
    const img = await loadImageFromFile(file);
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    const scale = Math.min(
        1,
        MAX_IMAGE_DIMENSION / originalWidth,
        MAX_IMAGE_DIMENSION / originalHeight
    );

    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Your browser does not support image conversion.');

    const inputType = (file.type || '').toLowerCase();
    const outputType = inputType === 'image/png' ? 'image/png' : 'image/jpeg';

    if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const data = await canvasToDataURL(
        canvas,
        outputType,
        outputType === 'image/png' ? undefined : 0.88
    );

    return {
        name: file.name.replace(/\.[^.]+$/, '') + (outputType === 'image/png' ? '.png' : '.jpg'),
        data,
        size: Math.round((data.length - data.indexOf(',') - 1) * 0.75),
        type: outputType,
        base64: true,
        image: true,
        width,
        height,
        originalSize: file.size
    };
}

function getVideoMetadata(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            const result = {
                width: video.videoWidth || 1280,
                height: video.videoHeight || 720,
                duration: Number.isFinite(video.duration) ? video.duration : 0
            };
            URL.revokeObjectURL(url);
            resolve(result);
        };
        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`"${file.name}" could not be read as a video.`));
        };
        video.src = url;
    });
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not encode video.'));
        reader.readAsDataURL(blob);
    });
}

function chooseVideoMimeType() {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    return types.find(type =>
        window.MediaRecorder && MediaRecorder.isTypeSupported(type)
    ) || '';
}

async function encodeVideo(file, width, height, bitrate) {
    const mimeType = chooseVideoMimeType();
    if (!mimeType) return null;

    const sourceURL = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = sourceURL;
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Could not load video.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        URL.revokeObjectURL(sourceURL);
        throw new Error('Canvas video encoding is not supported.');
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate
    });
    const chunks = [];

    const finished = new Promise((resolve, reject) => {
        recorder.ondataavailable = e => {
            if (e.data && e.data.size) chunks.push(e.data);
        };
        recorder.onerror = () => reject(new Error('Video encoding failed.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    let drawing = true;
    const draw = () => {
        if (!drawing) return;
        if (!video.paused && !video.ended) {
            ctx.drawImage(video, 0, 0, width, height);
        }
        requestAnimationFrame(draw);
    };

    recorder.start(250);
    try {
        await video.play();
    } catch (error) {
        drawing = false;
        if (recorder.state !== 'inactive') recorder.stop();
        URL.revokeObjectURL(sourceURL);
        throw new Error('This video could not be played for compression.');
    }

    draw();

    await new Promise(resolve => {
        video.onended = resolve;
    });

    drawing = false;
    if (recorder.state !== 'inactive') recorder.stop();
    const blob = await finished;
    URL.revokeObjectURL(sourceURL);
    return blob;
}

async function compressVideoToBase64(file) {
    const meta = await getVideoMetadata(file);

    if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error('Video is too long. Maximum video length is 60 minutes.');
    }

    // Files already under the 5 MB file limit do not need re-encoding.
    if (file.size <= MAX_VIDEO_BYTES) {
        return {
            name: file.name,
            data: await readFileAsDataURL(file),
            size: file.size,
            type: file.type || 'video/mp4',
            base64: true,
            image: false,
            video: true
        };
    }

    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
        throw new Error('This browser cannot compress this video. Please choose a video under 5 MB.');
    }

    // Keep enough room for the Base64 string in the request while targeting
    // a real binary file size of <= 5 MB.
    const duration = Math.max(meta.duration, 1);
    const targetTotalBitrate = Math.max(
        160000,
        Math.floor((MAX_VIDEO_BYTES * 8 * 0.90) / duration)
    );

    const presets = [
        { scale: 1.00, bitrate: Math.min(2800000, targetTotalBitrate) },
        { scale: 0.85, bitrate: Math.min(2000000, targetTotalBitrate) },
        { scale: 0.70, bitrate: Math.min(1400000, targetTotalBitrate) },
        { scale: 0.55, bitrate: Math.min(900000, targetTotalBitrate) },
        { scale: 0.40, bitrate: Math.min(550000, targetTotalBitrate) },
        { scale: 0.30, bitrate: Math.min(350000, targetTotalBitrate) }
    ];

    for (const preset of presets) {
        const width = Math.max(2, Math.floor(meta.width * preset.scale / 2) * 2);
        const height = Math.max(2, Math.floor(meta.height * preset.scale / 2) * 2);
        const bitrate = Math.max(120000, preset.bitrate);

        try {
            const blob = await encodeVideo(file, width, height, bitrate);
            if (!blob) continue;

            if (blob.size <= MAX_VIDEO_BYTES) {
                return {
                    name: file.name.replace(/\.[^.]+$/, '') + '.webm',
                    data: await blobToDataURL(blob),
                    size: blob.size,
                    type: 'video/webm',
                    base64: true,
                    image: false,
                    video: true,
                    width,
                    height,
                    originalSize: file.size
                };
            }
        } catch (error) {
            // Try the next, smaller preset.
        }
    }

    throw new Error('This video could not be compressed below 5 MB. Try a shorter video.');
}

attachBtn.onclick = () => fileInput.click();

fileInput.onchange = async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    for (const file of files) {
        if (pendingFiles.length >= MAX_FILES) {
            alert(`Maximum ${MAX_FILES} files per message.`);
            break;
        }

        const type = (file.type || '').toLowerCase();
        const isImage = type.startsWith('image/');
        const isVideo = type.startsWith('video/');

        // Images and videos have their own processing rules.
        if (!isImage && !isVideo && file.size > MAX_FILE_SIZE) {
            alert(
                `File "${file.name}" is too large ` +
                `(${formatFileSize(file.size)}). ` +
                `Max ${formatFileSize(MAX_FILE_SIZE)}.`
            );
            continue;
        }

        try {
            let processed;

            if (isImage) {
                processed = await imageToBase64(file);
            } else if (isVideo) {
                processed = await compressVideoToBase64(file);
            } else {
                processed = {
                    name: file.name,
                    data: await readFileAsDataURL(file),
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    base64: true,
                    image: false,
                    video: false
                };
            }

            pendingFiles.push(processed);
        } catch (error) {
            alert(`Could not process "${file.name}":\n\n${error.message}`);
        }
    }

    renderFilePreview();
    fileInput.value = '';
};

function renderFilePreview() {
    filePreview.innerHTML = '';
    if (!pendingFiles.length) return;

    pendingFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';

        const icon = document.createElement('span');
        icon.textContent = getFileIcon(file.type, file.name);

        const name = document.createElement('span');
        name.textContent = file.name;

        const remove = document.createElement('span');
        remove.className = 'remove-file';
        remove.dataset.index = index;
        remove.textContent = '✕';

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(remove);
        filePreview.appendChild(item);
    });

    filePreview.querySelectorAll('.remove-file').forEach(el => {
        el.onclick = () => {
            pendingFiles.splice(Number(el.dataset.index), 1);
            renderFilePreview();
        };
    });
}

/* =====================================================
   SETTINGS UI
===================================================== */

function loadSettingsUI(){

    usernameInput.value=
        settings.username;

    deviceIdInput.value=
        deviceId;

    pendingProfilePicture = profiles[deviceId]?.pfp || localStorage.getItem("chat_profile_pfp") || "";
    profilePicturePreview.src = pendingProfilePicture || defaultAvatarData(settings.username || "?");

    refreshRate.value=
        settings.refreshRate;

    showTimestamps.value=
        String(settings.showTimestamps);

    themeSelect.value=
        settings.theme;

    textSize.value=
        settings.textSize;

    wordSpacing.value=
        settings.wordSpacing;

    lineSpacing.value=
        settings.lineSpacing;

    cornerRadius.value=
        settings.cornerRadius;

    uiScale.value=
        settings.uiScale;

    enterToSend.value=
        String(settings.enterToSend);

    autoScroll.value=
        String(settings.autoScroll);

    updateRangeLabels();
}


function updateRangeLabels(){

    textSizeValue.textContent=
        textSize.value+"px";

    wordSpacingValue.textContent=
        wordSpacing.value+"px";

    lineSpacingValue.textContent=
        lineSpacing.value;

    cornerRadiusValue.textContent=
        cornerRadius.value+"px";

    uiScaleValue.textContent=
        Math.round(
            Number(uiScale.value)*100
        )+"%";
}


function applySettings(){

    document.documentElement.style.setProperty(
        "--text-size",
        settings.textSize+"px"
    );

    document.documentElement.style.setProperty(
        "--word-spacing",
        settings.wordSpacing+"px"
    );

    document.documentElement.style.setProperty(
        "--line-spacing",
        settings.lineSpacing
    );

    document.documentElement.style.setProperty(
        "--radius",
        settings.cornerRadius+"px"
    );

    document.documentElement.style.setProperty(
        "--ui-scale",
        settings.uiScale
    );

    applyTheme(
        settings.theme
    );

    renderedElements.clear();
    renderedData.clear();
    seenMessageIds.clear();
    seenGameIds.clear();
    renderMessages();
    restartRefresh();
}


function applyTheme(name){

    const themes={

        dark:["#0b0d10","#111419"],
        midnight:["#080b14","#101522"],
        slate:["#101418","#171d22"],
        black:["#000","#090909"],
        blue:["#091018","#101c29"],
        purple:["#100b17","#191021"],
        green:["#09120d","#101b15"],
        red:["#140b0b","#1e1111"],
        gray:["#151515","#202020"],
        light:["#eeeeee","#ffffff"],
        oled:["#000","#000"]
    };

    const t=
        themes[name] ||
        themes.dark;

    document.documentElement.style.setProperty(
        "--bg",
        t[0]
    );

    document.documentElement.style.setProperty(
        "--panel",
        t[1]
    );

    document.body.style.background=
        t[0];
}


/* =====================================================
   SETTINGS EVENTS
===================================================== */

settingsBtn.onclick=()=>{

    loadSettingsUI();

    settingsOverlay.classList.add(
        "show"
    );
};

closeSettings.onclick=()=>{

    settingsOverlay.classList.remove(
        "show"
    );
};

gamesBtn.onclick=()=>{

    gamesOverlay.classList.add(
        "show"
    );
};


const gamesComposerBtn = document.getElementById("gamesComposerBtn");
if (gamesComposerBtn) {
    gamesComposerBtn.onclick = () => {
        gamesOverlay.classList.add("show");
    };
}

closeGames.onclick=()=>{

    gamesOverlay.classList.remove(
        "show"
    );
};


saveSettings.onclick=()=>{

    settings.username=
        usernameInput.value
            .trim()
            .substring(0,24);

    settings.refreshRate=
        Number(refreshRate.value);

    settings.showTimestamps=
        showTimestamps.value==="true";

    settings.theme=
        themeSelect.value;

    settings.textSize=
        Number(textSize.value);

    settings.wordSpacing=
        Number(wordSpacing.value);

    settings.lineSpacing=
        Number(lineSpacing.value);

    settings.cornerRadius=
        Number(cornerRadius.value);

    settings.uiScale=
        Number(uiScale.value);

    settings.enterToSend=
        enterToSend.value==="true";

    settings.autoScroll=
        autoScroll.value==="true";

    Object.keys(settings).forEach(key=>{

        localStorage.setItem(
            "chat_"+key,
            settings[key]
        );
    });

    localStorage.setItem("chat_profile_pfp", pendingProfilePicture || "");
    publishProfile().catch(error => console.warn("Profile update failed:", error));

    applySettings();

    settingsOverlay.classList.remove(
        "show"
    );
};


document.querySelectorAll(
    ".category-title"
).forEach(button=>{

    button.onclick=()=>{

        button.parentElement
            .classList.toggle("open");

    };
});


[
    textSize,
    wordSpacing,
    lineSpacing,
    cornerRadius,
    uiScale
].forEach(input=>{

    input.addEventListener(
        "input",
        updateRangeLabels
    );

});


async function compressProfilePicture(file){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>{
            const img=new Image();
            img.onload=()=>{
                const size=128;
                const canvas=document.createElement("canvas");
                canvas.width=size; canvas.height=size;
                const ctx=canvas.getContext("2d");
                const scale=Math.max(size/img.width,size/img.height);
                const w=img.width*scale,h=img.height*scale;
                ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
                resolve(canvas.toDataURL("image/jpeg",0.55));
            };
            img.onerror=reject; img.src=reader.result;
        };
        reader.onerror=reject; reader.readAsDataURL(file);
    });
}

profilePictureInput.addEventListener("change",async()=>{
    const file=profilePictureInput.files?.[0];
    if(!file)return;
    try{
        pendingProfilePicture=await compressProfilePicture(file);
        profilePicturePreview.src=pendingProfilePicture;
    }catch{ alert("Could not load that profile picture."); }
});

function defaultAvatarData(name){
    const letter=String(name||"?").charAt(0).toUpperCase();
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#20252d"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#edf0f4" font-size="58" font-family="Arial">${letter}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}

function isProfileMessage(message){
    return message && message.username === "__PROFILE__";
}

function parseProfileMessage(message){
    if(!isProfileMessage(message))return null;
    try{ return JSON.parse(message.message || "{}"); }catch{return null;}
}

function processProfiles(){
    const map={};
    for(const message of currentMessages){
        const profile=parseProfileMessage(message);
        if(!profile || !profile.deviceId) continue;

        const updatedAt=Number(profile.updatedAt || message.created_at || 0);
        const previous=map[profile.deviceId];

        // Always keep the newest profile for this Device ID.
        if(!previous || updatedAt >= Number(previous.updatedAt || 0)){
            map[profile.deviceId]={
                name:String(profile.name||"User").slice(0,24),
                pfp:typeof profile.pfp === "string" ? profile.pfp : "",
                updatedAt
            };
        }
    }
    profiles=map;
    renderedElements.clear();
    renderedData.clear();
}

function getDisplayName(id,fallback="User"){
    return profiles[id]?.name || fallback || "User";
}

function getDisplayPfp(id,fallbackName="?"){
    return profiles[id]?.pfp || defaultAvatarData(getDisplayName(id,fallbackName));
}

async function publishProfile(){
    const profile={
        type:"profile",
        deviceId,
        name:settings.username||"User",
        pfp:pendingProfilePicture||"",
        updatedAt:Date.now()
    };

    await apiPost({
        username:"__PROFILE__",
        channel:CHANNEL,
        message:JSON.stringify(profile),
        image:null,
        files:[],
        device_id:deviceId
    });

    // Normal messages only store the Device ID. Their displayed name/PFP
    // always comes from this current profile.
    profiles[deviceId]={
        name:profile.name,
        pfp:profile.pfp,
        updatedAt:profile.updatedAt
    };

    // Immediately update old messages and game player cards on screen.
    renderMessages(false);
}

/* =====================================================
   CHAT SEND
===================================================== */

sendBtn.onclick=
    sendChatMessage;


messageInput.addEventListener(
    "keydown",
    event=>{

        if(
            event.key==="Enter" &&
            !event.shiftKey &&
            settings.enterToSend
        ){

            event.preventDefault();

            sendChatMessage();
        }

    }
);


messageInput.addEventListener(
    "input",
    ()=>{

        messageInput.style.height=
            "auto";

        messageInput.style.height=
            Math.min(
                messageInput.scrollHeight,
                150
            )+"px";
    }
);


async function sendChatMessage(){

    const text=
        messageInput.value
            .trim();

    const files = pendingFiles.length ? [...pendingFiles] : [];

    if(!text && !files.length)return;

    if(!settings.username){

        settingsBtn.click();

        alert(
            "Set your name in Settings first."
        );

        return;
    }

    sendBtn.disabled=true;

    try{

        await apiPost({

            username:
                "__USER__",

            channel:
                CHANNEL,

            message:
                text || '',

            image: null,

            files: files,

            device_id:
                deviceId
        });

        messageInput.value="";
        messageInput.style.height=
            "auto";
        
        pendingFiles = [];
        renderFilePreview();

        await loadMessages();

    }catch(error){

        alert(
            "Failed to send:\n\n"+
            error.message
        );

    }finally{

        sendBtn.disabled=false;

    }
}


/* =====================================================
   API
===================================================== */

async function apiPost(body){

    const response=
        await fetch(
            API_URL,
            {
                method:"POST",
                headers:{
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(body)
            }
        );

    const data=
        await safeJson(response);

    if(!response.ok){

        throw new Error(
            data.error ||
            "Request failed."
        );
    }

    return data;
}


async function apiDelete(body){

    const response=
        await fetch(
            API_URL,
            {
                method:"DELETE",
                headers:{
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(body)
            }
        );

    const data=
        await safeJson(response);

    if(!response.ok){

        throw new Error(
            data.error ||
            "Delete failed."
        );
    }

    return data;
}


async function apiPatch(body){

    const response=
        await fetch(
            API_URL,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(body)
            }
        );

    const data=
        await safeJson(response);

    if(!response.ok){

        throw new Error(
            data.error ||
            "Update failed."
        );
    }

    return data;
}


async function safeJson(response){

    const text=
        await response.text();

    if(!text)return {};

    try{
        return JSON.parse(text);
    }catch{
        return {
            error:text
        };
    }
}


/* =====================================================
   LOAD MESSAGES
===================================================== */

async function loadMessages(){

    if(syncing)return;

    syncing=true;

    try{

        const response=
            await fetch(
                API_URL+
                "?channel="+
                encodeURIComponent(
                    CHANNEL
                )+
                "&_="+
                Date.now(),
                {
                    cache:"no-store"
                }
            );

        const data=
            await safeJson(response);

        if(!response.ok){

            throw new Error(
                data.error ||
                "Failed to load messages."
            );
        }

        const newMessages=
            Array.isArray(
                data.messages
            )
            ?data.messages
            :[];

        const changeInfo = getMessageChanges(currentMessages, newMessages);
        
        if (changeInfo.changed) {
            let hasNewMessages = false;
            let hasNewGames = false;
            
            for (const msg of newMessages) {
                if (!seenMessageIds.has(msg.id)) {
                    if (!isGameMessage(msg) && !isProfileMessage(msg)) {
                        hasNewMessages = true;
                    }
                    seenMessageIds.add(msg.id);
                }
            }
            
            const oldGames = [...games];
            currentMessages = newMessages;
            processProfiles();
            processGameMessages();
            
            for (const game of games) {
                if (!seenGameIds.has(game.id)) {
                    hasNewGames = true;
                    seenGameIds.add(game.id);
                }
            }
            
            const oldGameIds = new Set(oldGames.map(g => g.id));
            const newGameIds = new Set(games.map(g => g.id));
            for (const id of oldGameIds) {
                if (!newGameIds.has(id)) {
                    seenGameIds.delete(id);
                }
            }
            
            const shouldScroll = settings.autoScroll && (hasNewMessages || hasNewGames);
            const wasNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
            
            renderMessages(shouldScroll || (wasNearBottom && settings.autoScroll));
        }

    }catch(error){

        if(
            !currentMessages.length
        ){

            messagesEl.innerHTML=`
                <div class="empty">
                    <div>
                        <strong>Unable to load messages</strong>
                        ${escapeHtml(
                            error.message
                        )}
                    </div>
                </div>
            `;
        }

    }finally{

        syncing=false;
    }
}

function filesEquivalent(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return a == null && b == null;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const x = a[i] || {};
        const y = b[i] || {};
        if (x.name !== y.name || x.type !== y.type || x.size !== y.size ||
            x.image !== y.image || x.video !== y.video || x.data !== y.data) {
            return false;
        }
    }
    return true;
}

function messagesEquivalent(a, b) {
    if (!a || !b) return false;
    return a.id === b.id &&
        a.message === b.message &&
        a.username === b.username &&
        a.edited === b.edited &&
        a.created_at === b.created_at &&
        a.image === b.image &&
        filesEquivalent(a.files, b.files);
}

function gameDataEquivalent(a, b) {
    if (!a || !b) return false;
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
}

function getMessageChanges(oldMessages, newMessages) {
    if (oldMessages.length !== newMessages.length) {
        return { changed: true };
    }

    for (let i = 0; i < oldMessages.length; i++) {
        if (!messagesEquivalent(oldMessages[i], newMessages[i])) {
            return { changed: true };
        }
    }

    return { changed: false };
}


/* =====================================================
   GAME MESSAGE PARSING
===================================================== */

function isGameMessage(message){

    return (
        message &&
        typeof message.message==="string" &&
        message.message.startsWith(
            GAME_PREFIX
        )
    );
}


function parseGameMessage(message){

    if(!isGameMessage(message)){
        return null;
    }

    try{

        return JSON.parse(
            message.message.substring(
                GAME_PREFIX.length
            )
        );

    }catch{

        return null;
    }
}


function processGameMessages(){

    const map=new Map();

    for(const message of currentMessages){

        if(!isGameMessage(message)){
            continue;
        }

        const state=
            parseGameMessage(message);

        if(!state){
            continue;
        }

        if(
            state.type!=="game"
        ){
            continue;
        }

        // A force-ended game stays blocked locally. If an old message
        // arrives again during refresh, do not resurrect the game.
        if (stoppedGames.has(state.id)) {
            continue;
        }

        map.set(
            state.id,
            {
                ...state,
                messageId:
                    message.id,
                hostDeviceId:
                    state.hostDeviceId ||
                    message.device_id ||
                    ""
            }
        );
    }

    games=[
        ...map.values()
    ];
}


/* =====================================================
   RENDER MESSAGES
===================================================== */

function renderMessages(shouldAutoScroll){
    const normal = currentMessages.filter(message => !isGameMessage(message) && !isProfileMessage(message));
    // Finished/force-quit games are never rendered, including Hangman/Battleship.
    const activeGames = games.filter(game =>
        game.status !== "finished" && game.status !== "forcequit"
    );

    if (!normal.length && !activeGames.length) {
        messagesEl.innerHTML = `
            <div class="empty">
                <div>
                    <strong>No messages yet</strong>
                    Be the first to send something.
                </div>
            </div>
        `;
        renderedElements.clear();
        renderedData.clear();
        return;
    }

    const desired = [];
    const desiredIds = [];

    for (const message of normal) {
        const id = "msg_" + message.id;
        const oldEl = renderedElements.get(id);
        const oldData = renderedData.get(id);
        const el = oldEl && oldData && messagesEquivalent(oldData, message)
            ? oldEl
            : createMessageElement(message);
        desired.push(el);
        desiredIds.push(id);
    }

    for (const game of activeGames) {
        const id = "game_" + game.id;
        const oldEl = renderedElements.get(id);
        const oldData = renderedData.get(id);
        const el = oldEl && oldData && gameDataEquivalent(oldData, game)
            ? oldEl
            : createGameElement(game);
        desired.push(el);
        desiredIds.push(id);
    }

    const currentIds = Array.from(messagesEl.children).map(
        child => child.dataset && child.dataset.id ? child.dataset.id : ""
    );

    if (currentIds.length !== desiredIds.length ||
        currentIds.some((id, index) => id !== desiredIds[index])) {
        const fragment = document.createDocumentFragment();
        desired.forEach(el => fragment.appendChild(el));
        messagesEl.replaceChildren(fragment);
    } else {
        for (let i = 0; i < desired.length; i++) {
            if (messagesEl.children[i] !== desired[i]) {
                messagesEl.children[i].replaceWith(desired[i]);
            }
        }
    }

    renderedElements.clear();
    renderedData.clear();

    for (let i = 0; i < desired.length; i++) {
        const id = desiredIds[i];
        renderedElements.set(id, desired[i]);
        renderedData.set(id, id.startsWith("msg_") ? normal[i] : activeGames[i - normal.length]);
    }

    if (shouldAutoScroll && settings.autoScroll) {
        requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }
}


/* =====================================================
   CREATE MESSAGE ELEMENT
===================================================== */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createMessageElement(message) {

    const item =
        document.createElement("div");

    item.className = "message";
    item.dataset.id = 'msg_' + message.id;

    const avatar =
        document.createElement("div");

    avatar.className = "avatar";

    const profileName = getDisplayName(message.device_id, message.username === "__USER__" ? "User" : message.username);
    const profilePfp = getDisplayPfp(message.device_id, profileName);
    avatar.textContent = profileName.charAt(0).toUpperCase();
    if (profilePfp) {
        avatar.innerHTML = "";
        const avatarImg=document.createElement("img");
        avatarImg.className="profile-avatar";
        avatarImg.src=profilePfp;
        avatarImg.alt=profileName;
        avatar.appendChild(avatarImg);
    }

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    const top =
        document.createElement("div");

    top.className =
        "message-top";

    const name =
        document.createElement("span");

    name.className =
        "username";

    name.textContent =
        profileName;

    top.appendChild(name);

    if (settings.showTimestamps) {

        const time =
            document.createElement("span");

        time.className = "time";

        time.textContent =
            formatTime(
                message.created_at
            );

        top.appendChild(time);
    }

    if (message.edited) {

        const edited =
            document.createElement("span");

        edited.className =
            "edited";

        edited.textContent =
            "(edited)";

        top.appendChild(edited);
    }

    content.appendChild(top);

    if (message.message) {

        const text =
            document.createElement("div");

        text.className =
            "message-text";

        text.textContent =
            message.message;

        content.appendChild(text);
    }

    // Image (legacy single image support)
    if (message.image) {
        const img = document.createElement("img");
        img.className = "message-image";
        img.src = message.image;
        img.alt = "Image";
        img.onclick = () => {
            window.open(message.image, '_blank');
        };
        content.appendChild(img);
    }

    // Files / Images
    // Images are stored by the server as Base64 data URLs.
    if (message.files && Array.isArray(message.files) && message.files.length) {
        const fileList = document.createElement("div");
        fileList.className = "file-list";

        message.files.forEach(file => {
            const type = file.type || '';
            const isImage =
                file.image === true ||
                type.startsWith('image/') ||
                (
                    typeof file.data === 'string' &&
                    file.data.startsWith('data:image/')
                );

            if (isImage && file.data) {
                const img = document.createElement("img");
                img.className = "message-image";
                img.src = file.data;
                img.alt = file.name || "Image";
                img.loading = "lazy";
                img.decoding = "async";

                img.onclick = () => {
                    const viewer = window.open('', '_blank');
                    if (viewer) {
                        viewer.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>${escapeHtml(file.name || 'Image')}</title>
                                <style>
                                    html,body{
                                        margin:0;
                                        min-height:100%;
                                        background:#111;
                                        display:grid;
                                        place-items:center;
                                    }
                                    img{
                                        max-width:100vw;
                                        max-height:100vh;
                                        object-fit:contain;
                                    }
                                </style>
                            </head>
                            <body>
                                <img src="${file.data}" alt="">
                            </body>
                            </html>
                        `);
                        viewer.document.close();
                    }
                };

                content.appendChild(img);
                return;
            }

            const isAudio =
                file.audio === true ||
                type.startsWith('audio/') ||
                (typeof file.data === 'string' && file.data.startsWith('data:audio/'));

            if (isAudio && file.data) {
                const audioWrap=document.createElement("div");
                audioWrap.className="message-audio";
                const audio=document.createElement("audio");
                audio.src=file.data;
                audio.controls=true;
                audio.preload="metadata";
                audioWrap.appendChild(audio);
                content.appendChild(audioWrap);
                return;
            }

            // Videos are shown as previews with controls. They never autoplay.
            const isVideo =
                file.video === true ||
                type.startsWith('video/') ||
                (typeof file.data === 'string' && file.data.startsWith('data:video/'));

            if (isVideo && file.data) {
                const video = document.createElement('video');
                video.className = 'message-video';
                video.src = file.data;
                video.controls = true;
                video.autoplay = false;
                video.preload = 'metadata';
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                content.appendChild(video);
                return;
            }

            // Non-image files remain downloadable Base64 data URLs.
            const fileEl = document.createElement("div");
            fileEl.className = "message-file";

            const icon = document.createElement("span");
            icon.className = "file-icon";
            icon.textContent =
                getFileIcon(type, file.name || 'file');

            const info = document.createElement("div");
            info.className = "file-info";

            const nameEl = document.createElement("div");
            nameEl.className = "file-name";
            nameEl.textContent =
                file.name || 'Unknown file';

            const sizeEl = document.createElement("div");
            sizeEl.className = "file-size";
            sizeEl.textContent =
                file.size ? formatFileSize(file.size) : '';

            info.appendChild(nameEl);
            info.appendChild(sizeEl);

            fileEl.appendChild(icon);
            fileEl.appendChild(info);

            fileEl.onclick = () => {
                if (file.data) {
                    const a =
                        document.createElement('a');

                    a.href = file.data;
                    a.download =
                        file.name || 'download';
                    a.target = '_blank';
                    a.click();
                }
            };

            fileList.appendChild(fileEl);
        });

        if (fileList.children.length) {
            content.appendChild(fileList);
        }
    }

    item.appendChild(avatar);
    item.appendChild(content);

    return item;
}


/* =====================================================
   GAME CREATION
===================================================== */

document.querySelectorAll(
    ".game-choice"
).forEach(button=>{

    button.onclick=()=>{

        createGame(
            button.dataset.game
        );
    };
});


async function createGame(gameType){

    if(!settings.username){

        settingsBtn.click();

        alert(
            "Set your name before creating a game."
        );

        return;
    }

    const existing=
        games.find(
            game=>
                game.hostDeviceId===
                    deviceId &&
                game.status!=="finished" &&
                game.status!=="forcequit"
        );

    if(existing){

        alert(
            "You are already hosting a game."
        );

        gamesOverlay.classList.remove(
            "show"
        );

        return;
    }

    const info=
        GAME_TYPES[gameType];

    if(!info)return;

    const game={

        type:"game",

        id:
            "game_"+

            Date.now().toString(36)+

            "_"+

            Math.random()
                .toString(36)
                .slice(2,8),

        gameType,

        name:
            info.name,

        icon:
            info.icon,

        host:
            getDisplayName(deviceId, settings.username),

        hostDeviceId:
            deviceId,

        status:
            "lobby",

        players:[

            {
                deviceId,
                username:
                    getDisplayName(deviceId, settings.username)
            }

        ],

        maxPlayers:
            info.max,

        minPlayers:
            info.min,

        turnIndex:0,

        createdAt:
            Date.now(),

        board:[],

        winner:null,

        data:{
            settings: getDefaultSettings(gameType)
        }
    };

    // Set game-specific size
    if (info.size) {
        game.data.settings.boardSize = info.size;
    }

    try{

        await writeGameState(
            game
        );

        gamesOverlay.classList.remove(
            "show"
        );

        await loadMessages();

    }catch(error){

        alert(
            "Could not create game:\n\n"+
            error.message
        );
    }
}

function getDefaultSettings(gameType){
    const settings = {
        hangman: { word: "" },
        battleship: { size: 10 },
        ttt3: { boardSize: 3 },
        ttt4: { boardSize: 4 },
        ttt5: { boardSize: 5 },
        ttt6: { boardSize: 6 },
        memory: { gridSize: 4 },
        quickdraw: { rounds: 3 },
        coinflip: { targetScore: 3 },
        numberguess: { maxNumber: 100 },
        target: { targets: 5 },
        reaction: { rounds: 1 },
        type: { sentenceCount: 1 },
        boss: { bossHealth: 100000000 },
        trivia: { questions: 5 },
        wordscramble: { rounds: 5 },
        mathrace: { problems: 5 },
        ttttournament: { rounds: 3 },
        rpstournament: { rounds: 3 }
    };
    return settings[gameType] || {};
}


/* =====================================================
   WRITE GAME STATE
===================================================== */

async function writeGameState(game){
    if (!game?.id || stoppedGames.has(game.id)) {
        return false;
    }

    const payload =
        GAME_PREFIX +
        JSON.stringify(game);

    await apiPost({
        game_server: true,
        username: "__GAME_SERVER__",
        channel: CHANNEL,
        message: payload,
        device_id: game.hostDeviceId
    });

    return true;
}


/* =====================================================
   CREATE GAME ELEMENT - DISPATCHER
===================================================== */

function createGameElement(game){
    const wrapper = document.createElement("div");
    wrapper.className = "game-message";
    wrapper.dataset.id = 'game_' + game.id;

    const card = document.createElement("div");
    card.className = "game-card";

    // Header
    const header = document.createElement("div");
    header.className = "game-header";

    const title = document.createElement("div");
    title.className = "game-title";
    title.textContent = game.icon + " " + game.name;

    const status = document.createElement("div");
    status.className = "game-status";
    status.textContent = game.status === "lobby" ? "WAITING" : game.status === "finished" ? "FINISHED" : "PLAYING";

    header.appendChild(title);
    header.appendChild(status);

    // Body
    const body = document.createElement("div");
    body.className = "game-body";

    // Info
    const info = document.createElement("div");
    info.className = "game-info";
    info.innerHTML = `
        <div class="game-pill">
            Host: <strong>${escapeHtml(getDisplayName(game.hostDeviceId, game.host))}</strong>
        </div>
        <div class="game-pill">
            Players: <strong>${game.players.length}/${game.maxPlayers}</strong>
        </div>
        <div class="game-pill">
            Min Players: <strong>${game.minPlayers || 2}</strong>
        </div>
    `;
    body.appendChild(info);

    // Description
    const desc = document.createElement("div");
    desc.className = "game-description";
    desc.textContent = game.status === "lobby" 
        ? "Join before the host starts. Everyone else can spectate."
        : getGameDescription(game);
    body.appendChild(desc);

    // Players
    const players = document.createElement("div");
    players.className = "players-list";
    game.players.forEach(player => {
        const chip = document.createElement("div");
        chip.className = "player-chip";
        if (player.deviceId === game.hostDeviceId) chip.classList.add("host");
        chip.textContent = getDisplayName(player.deviceId, player.username) + (player.deviceId === game.hostDeviceId ? " 👑" : "");
        players.appendChild(chip);
    });
    body.appendChild(players);

    // GAME SETTINGS - Only show in lobby to host
    if (game.status === "lobby" && game.hostDeviceId === deviceId) {
        const settingsDiv = document.createElement("div");
        settingsDiv.className = "game-settings";
        settingsDiv.innerHTML = `<h4>⚙️ Game Settings (Host only)</h4>`;
        settingsDiv.appendChild(createSettingsUI(game));
        body.appendChild(settingsDiv);
    }

    // Turn banner
    if (game.status === "playing") {
        const turn = document.createElement("div");
        turn.className = "turn-banner";
        const current = game.players[game.turnIndex % Math.max(game.players.length, 1)];
        if (current) {
            turn.innerHTML = "Current turn: <strong>" + escapeHtml(getDisplayName(current.deviceId, current.username)) + "</strong>";
        }
        body.appendChild(turn);
    }

    // Game board
    const board = createGameBoard(game);
    if (board) body.appendChild(board);

    // Actions
    const actions = document.createElement("div");
    actions.className = "game-actions";

    if (game.status === "lobby") {
        const joined = game.players.some(p => p.deviceId === deviceId);
        
        if (!joined && game.players.length < game.maxPlayers) {
            const join = document.createElement("button");
            join.className = "game-btn green";
            join.textContent = "Join game";
            join.onclick = async () => await joinGame(game);
            actions.appendChild(join);
        } else if (joined) {
            const leave = document.createElement("button");
            leave.className = "game-btn";
            leave.textContent = "Leave";
            leave.onclick = async () => await leaveGame(game);
            actions.appendChild(leave);
        }

        if (game.hostDeviceId === deviceId) {
            const start = document.createElement("button");
            start.className = "game-btn primary";
            start.textContent = "Start game";
            start.disabled = game.players.length < (game.minPlayers || 2);
            start.onclick = async () => await startGame(game);
            actions.appendChild(start);

            const quit = document.createElement("button");
            quit.className = "game-btn danger";
            quit.textContent = "Force quit";
            quit.onclick = () => openConfirm("Force quit game?", "Everyone will be removed from this game.", () => forceQuitGame(game));
            actions.appendChild(quit);
        }
    } else if (game.status === "playing") {
        const mine = game.players.some(p => p.deviceId === deviceId);
        
        if (mine) {
            const leave = document.createElement("button");
            leave.className = "game-btn";
            leave.textContent = "Leave game";
            leave.onclick = async () => await leaveGame(game);
            actions.appendChild(leave);
        }

        if (game.hostDeviceId === deviceId) {
            const quit = document.createElement("button");
            quit.className = "game-btn danger";
            quit.textContent = "Force quit";
            quit.onclick = () => openConfirm("Force quit game?", "Everyone will be removed.", () => forceQuitGame(game));
            actions.appendChild(quit);
        }
    }

    body.appendChild(actions);
    card.appendChild(header);
    card.appendChild(body);
    wrapper.appendChild(card);

    return wrapper;
}


/* =====================================================
   CREATE SETTINGS UI
===================================================== */

function createSettingsUI(game){
    const container = document.createElement("div");
    const gameType = game.gameType;
    const settings = game.data.settings || {};

    // Tic Tac Toe settings (2-3 players)
    if (gameType === "ttt3" || gameType === "ttt4" || gameType === "ttt5" || gameType === "ttt6") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        const size = settings.boardSize || 3;
        const playerCount = game.players.length;
        const maxPlayers = game.maxPlayers || 3;
        row.innerHTML = `
            <label>Board:</label>
            <span style="color:white;font-weight:600;">${size}x${size}</span>
            <span style="color:#6a7a8a;font-size:11px;margin-left:5px;">(get ${size} in a row)</span>
        `;
        container.appendChild(row);
        
        const playersRow = document.createElement("div");
        playersRow.className = "game-settings-row";
        playersRow.innerHTML = `
            <label>Players:</label>
            <span style="color:white;font-weight:600;">${playerCount}/${maxPlayers}</span>
            <span style="color:#6a7a8a;font-size:11px;margin-left:5px;">(2-3 players supported)</span>
        `;
        container.appendChild(playersRow);
        
        const symbolsRow = document.createElement("div");
        symbolsRow.className = "game-settings-row";
        symbolsRow.innerHTML = `
            <label>Symbols:</label>
            <span style="color:#ff6b6b;">❌ Player 1</span>
            <span style="color:#4ecdc4;">⭕ Player 2</span>
            ${playerCount >= 3 ? `<span style="color:#ffd93d;">🔺 Player 3</span>` : ''}
        `;
        container.appendChild(symbolsRow);
    }

    // Hangman settings
    if (gameType === "hangman") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Secret word:</label>
            <input id="hangmanWord" type="text" maxlength="24" autocomplete="off" placeholder="Enter a word">
        `;
        const input = row.querySelector("#hangmanWord");
        input.value = settings.word || "";
        container.appendChild(row);

        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Save word";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const word = input.value.trim().replace(/[^A-Za-zÆØÅæøå]/g, "").toUpperCase();
            if (word.length < 2) { alert("Enter a word with at least 2 letters."); return; }
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.word = word;
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Memory settings
    if (gameType === "memory") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Grid Size:</label>
            <select id="memorySize">
                <option value="3" ${settings.gridSize === 3 ? 'selected' : ''}>3x3 (9 pairs)</option>
                <option value="4" ${settings.gridSize === 4 ? 'selected' : ''}>4x4 (16 pairs)</option>
                <option value="5" ${settings.gridSize === 5 ? 'selected' : ''}>5x5 (25 pairs)</option>
            </select>
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const size = parseInt(document.getElementById("memorySize").value);
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.gridSize = size;
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Quick Draw settings
    if (gameType === "quickdraw") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Rounds:</label>
            <input type="number" id="quickdrawRounds" value="${settings.rounds || 3}" min="1" max="10">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const rounds = parseInt(document.getElementById("quickdrawRounds").value) || 3;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.rounds = Math.max(1, Math.min(10, rounds));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Coin Flip settings
    if (gameType === "coinflip") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Target Score:</label>
            <input type="number" id="coinflipTarget" value="${settings.targetScore || 3}" min="1" max="10">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const target = parseInt(document.getElementById("coinflipTarget").value) || 3;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.targetScore = Math.max(1, Math.min(10, target));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Number Guess settings
    if (gameType === "numberguess") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Max Number:</label>
            <select id="numberguessMax">
                <option value="50" ${settings.maxNumber === 50 ? 'selected' : ''}>1-50</option>
                <option value="100" ${settings.maxNumber === 100 ? 'selected' : ''}>1-100</option>
                <option value="200" ${settings.maxNumber === 200 ? 'selected' : ''}>1-200</option>
                <option value="500" ${settings.maxNumber === 500 ? 'selected' : ''}>1-500</option>
            </select>
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const max = parseInt(document.getElementById("numberguessMax").value);
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.maxNumber = max;
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Target Click settings
    if (gameType === "target") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Targets:</label>
            <input type="number" id="targetCount" value="${settings.targets || 5}" min="3" max="20">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const count = parseInt(document.getElementById("targetCount").value) || 5;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.targets = Math.max(3, Math.min(20, count));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Trivia settings
    if (gameType === "trivia") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Questions:</label>
            <input type="number" id="triviaQuestions" value="${settings.questions || 5}" min="3" max="15">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const count = parseInt(document.getElementById("triviaQuestions").value) || 5;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.questions = Math.max(3, Math.min(15, count));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Word Scramble settings
    if (gameType === "wordscramble") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Rounds:</label>
            <input type="number" id="wordscrambleRounds" value="${settings.rounds || 5}" min="3" max="15">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const rounds = parseInt(document.getElementById("wordscrambleRounds").value) || 5;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.rounds = Math.max(3, Math.min(15, rounds));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Math Race settings
    if (gameType === "mathrace") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Problems:</label>
            <input type="number" id="mathraceProblems" value="${settings.problems || 5}" min="3" max="15">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const count = parseInt(document.getElementById("mathraceProblems").value) || 5;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.problems = Math.max(3, Math.min(15, count));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // Tic-Tac-Toe Tournament settings
    if (gameType === "ttttournament") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Rounds:</label>
            <input type="number" id="ttttRounds" value="${settings.rounds || 3}" min="1" max="5">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const rounds = parseInt(document.getElementById("ttttRounds").value) || 3;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.rounds = Math.max(1, Math.min(5, rounds));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    // RPS Tournament settings
    if (gameType === "rpstournament") {
        const row = document.createElement("div");
        row.className = "game-settings-row";
        row.innerHTML = `
            <label>Rounds:</label>
            <input type="number" id="rpstRounds" value="${settings.rounds || 3}" min="1" max="5">
        `;
        container.appendChild(row);
        
        const saveBtn = document.createElement("button");
        saveBtn.className = "game-btn";
        saveBtn.textContent = "Apply Settings";
        saveBtn.style.marginTop = "8px";
        saveBtn.onclick = async () => {
            const rounds = parseInt(document.getElementById("rpstRounds").value) || 3;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.settings.rounds = Math.max(1, Math.min(5, rounds));
            await writeGameState(copy);
            await loadMessages();
        };
        container.appendChild(saveBtn);
    }

    return container;
}


/* =====================================================
   GAME DESCRIPTIONS
===================================================== */

function getGameDescription(game){
    const descs = {
        hangman: "A 2-player word guessing game played directly inside the chat. One player creates the game and chooses the word. The other player guesses letters using the on-screen keyboard. Correct letters are revealed, incorrect guesses reduce the remaining attempts, and each letter can only be guessed once. Guess the entire word to win; run out of attempts and the word is revealed.",
        battleship: "A 2-player strategy game played directly inside the chat. Each player gets a hidden 10×10 grid and places Carrier (5), Battleship (4), Destroyer (3), Submarine (3), and Patrol Boat (2). Ships can be horizontal or vertical. Players take turns selecting coordinates. Hits, misses, and sunk ships update live. Destroy the entire enemy fleet to win.",
        ttt3: "Classic Tic-Tac-Toe on a 3x3 board. Get 3 in a row to win! Supports 2-3 players.",
        ttt4: "4x4 Tic-Tac-Toe. Get 4 in a row to win! Supports 2-3 players.",
        ttt5: "5x5 Tic-Tac-Toe. Get 5 in a row to win! Supports 2-3 players.",
        ttt6: "6x6 Tic-Tac-Toe. Get 6 in a row to win! Supports 2-3 players.",
        memory: "Flip cards and find matching pairs. Most pairs at the end wins!",
        quickdraw: "Wait for the countdown, then click when DRAW! appears. Fastest wins!",
        coinflip: "Choose Heads or Tails. Correct guesses earn points. First to reach the target score wins!",
        numberguess: "The server picks a secret number. Guess it with higher/lower hints. First correct wins!",
        target: "Click the target that appears on screen. Most hits and accuracy wins!",
        reaction: "Click when the screen turns green. Fastest reaction time wins!",
        type: "Type the displayed sentence as fast as you can. Fastest wins!",
        boss: "Work together to defeat the boss! Upgrade your weapons for more damage.",
        trivia: "Answer trivia questions correctly. Most correct answers wins!",
        wordscramble: "Unscramble the letters to form a word. Fastest correct answer wins!",
        mathrace: "Solve math problems as fast as you can. Most correct wins!",
        ttttournament: "Round-robin Tic-Tac-Toe tournament. Most points wins!",
        rpstournament: "Rock Paper Scissors tournament. Most wins takes the crown!"
    };
    return descs[game.gameType] || "Game in progress.";
}


/* =====================================================
   GAME BOARD - DISPATCHER
===================================================== */

function createGameBoard(game){
    if (game.status !== "playing") return null;
    
    const boards = {
        hangman: createHangman,
        battleship: createBattleship,
        ttt3: createTTT,
        ttt4: createTTT,
        ttt5: createTTT,
        ttt6: createTTT,
        memory: createMemory,
        quickdraw: createQuickDraw,
        coinflip: createCoinFlip,
        numberguess: createNumberGuess,
        target: createTarget,
        reaction: createReaction,
        type: createTypeSentence,
        boss: createBossBattle,
        trivia: createTrivia,
        wordscramble: createWordScramble,
        mathrace: createMathRace,
        ttttournament: createTTTTournament,
        rpstournament: createRPSTournament
    };
    
    return boards[game.gameType] ? boards[game.gameType](game) : null;
}


/* =====================================================
   HANGMAN (2 Players)
===================================================== */
function createHangman(game){
    const data=game.data||{};
    const word=String(data.word||"").toUpperCase();
    const guessed=Array.isArray(data.guessed)?data.guessed:[];
    const attempts=Number(data.attempts ?? 6);
    const maxAttempts=Number(data.maxAttempts ?? 6);
    const board=document.createElement("div");
    board.className="hangman-board";

    const players=document.createElement("div");
    players.className="hangman-players";
    players.textContent=`👤 ${getDisplayName(game.players[0]?.deviceId,game.players[0]?.username)} vs ${getDisplayName(game.players[1]?.deviceId,game.players[1]?.username)}`;
    board.appendChild(players);

    const wordEl=document.createElement("div");
    wordEl.className="hangman-word";
    wordEl.textContent=word.split("").map(ch=>guessed.includes(ch)||data.status==="won"||data.status==="lost"?ch:"_").join(" ");
    board.appendChild(wordEl);

    const used=document.createElement("div");
    used.className="hangman-used";
    used.textContent="❌ Used letters: "+(guessed.length?guessed.join(", "):"None");
    board.appendChild(used);

    const att=document.createElement("div");
    att.className="hangman-attempts";
    att.textContent=`❤️ Attempts: ${Math.max(0,attempts)}/${maxAttempts}`;
    board.appendChild(att);

    if(data.status==="won" || data.status==="lost" || game.status==="finished") {
        const result=document.createElement("div");
        result.className="hangman-result";
        result.textContent=data.status==="won"?`🎉 ${getDisplayName(data.winnerDeviceId,"Player")} won!`:`💀 ${getDisplayName(data.loserDeviceId,"Player")} lost!`;
        board.appendChild(result);
        const wordResult=document.createElement("div");
        wordResult.textContent=`The word was ${word}`;
        wordResult.style.textAlign="center";
        board.appendChild(wordResult);
        return board;
    }

    const canGuess=game.status==="playing" && game.players[1]?.deviceId===deviceId;
    const letters=document.createElement("div");
    letters.className="hangman-letters";
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ";
    [...alphabet].forEach(letter=>{
        const btn=document.createElement("button");
        btn.className="hangman-letter";
        btn.textContent=letter;
        btn.disabled=!canGuess || guessed.includes(letter) || attempts<=0;
        btn.onclick=()=>guessHangman(game,letter);
        letters.appendChild(btn);
    });
    board.appendChild(letters);
    return board;
}

async function guessHangman(game,letter){
    if(game.gameType!=="hangman" || game.status!=="playing")return;
    if(game.players[1]?.deviceId!==deviceId)return;
    if(game.data.guessed?.includes(letter))return;
    const copy=JSON.parse(JSON.stringify(game));
    copy.data.guessed=Array.isArray(copy.data.guessed)?copy.data.guessed:[];
    copy.data.guessed.push(letter);
    if(!copy.data.word.includes(letter)) copy.data.attempts=Math.max(0,(copy.data.attempts??6)-1);
    const won=copy.data.word.split("").every(ch=>copy.data.guessed.includes(ch));
    if(won){
        copy.data.status="won"; copy.data.winnerDeviceId=deviceId; copy.data.loserDeviceId=copy.players[0]?.deviceId; copy.status="finished";
    } else if(copy.data.attempts<=0){
        copy.data.status="lost"; copy.data.loserDeviceId=deviceId; copy.data.winnerDeviceId=copy.players[0]?.deviceId; copy.status="finished";
    }
    await publishGameAndCleanup(game,copy);
}


/* =====================================================
   BATTLESHIP (2 Players)
===================================================== */
const BS_SHIPS = [
    {name:"Carrier", icon:"🚢", size:5},
    {name:"Battleship", icon:"🚢", size:4},
    {name:"Destroyer", icon:"🚤", size:3},
    {name:"Submarine", icon:"🚤", size:3},
    {name:"Patrol Boat", icon:"🚤", size:2}
];
const BS_COLS = "ABCDEFGHIJ";

function bsKey(r,c){ return r + ":" + c; }
function bsInside(r,c){ return r>=0 && r<10 && c>=0 && c<10; }
function bsCellsFor(r,c,size,vertical){
    const cells=[];
    for(let i=0;i<size;i++) cells.push({r:r+(vertical?i:0),c:c+(vertical?0:i)});
    return cells;
}
function bsCanPlace(ships,r,c,size,vertical){
    const cells=bsCellsFor(r,c,size,vertical);
    if(cells.some(x=>!bsInside(x.r,x.c))) return false;
    const occupied=new Set((ships||[]).flatMap(s=>s.cells||[]).map(x=>bsKey(x.r,x.c)));
    return !cells.some(x=>occupied.has(bsKey(x.r,x.c)));
}
function bsFleetReady(placement){ return Array.isArray(placement?.ships) && placement.ships.length===BS_SHIPS.length; }
function bsFleetCells(placement){ return new Set((placement?.ships||[]).flatMap(s=>s.cells||[]).map(x=>bsKey(x.r,x.c))); }

function createBattleship(game){
    const board=document.createElement("div"); board.className="battleship-board";
    const data=game.data||{};
    const me=game.players.find(p=>p.deviceId===deviceId);
    const opp=game.players.find(p=>p.deviceId!==deviceId);
    const myPlacement=data.placements?.[deviceId] || {ships:[],shots:[]};
    const phase=data.phase||"placement";

    const status=document.createElement("div"); status.className="battleship-status";
    if(phase==="placement") status.textContent=bsFleetReady(myPlacement)?"✅ Fleet placed — waiting for the other player.":"📍 Place your fleet on your hidden 10×10 grid.";
    else if(game.status==="finished") status.textContent=data.winnerDeviceId===deviceId?"🏆 You destroyed the enemy fleet!":"💀 Your fleet was destroyed!";
    else status.textContent=data.turnIndex===game.players.findIndex(p=>p.deviceId===deviceId)?"⚔️ Your turn — attack the enemy grid.":"⏳ Opponent's turn.";
    board.appendChild(status);

    if(phase==="placement" && me){
        const controls=document.createElement("div"); controls.className="battleship-toolbar";
        let vertical=false;
        const rotate=document.createElement("button"); rotate.className="game-btn"; rotate.textContent="↕ Rotate: Horizontal";
        rotate.onclick=()=>{vertical=!vertical; rotate.textContent=vertical?"↔ Rotate: Vertical":"↕ Rotate: Horizontal";};
        controls.appendChild(rotate);
        const shipInfo=document.createElement("div"); shipInfo.className="battleship-ships";
        const placedNames=new Set((myPlacement.ships||[]).map(s=>s.name));
        BS_SHIPS.forEach(s=>{const chip=document.createElement("div");chip.className="bs-ship-chip"+(placedNames.has(s.name)?" done":"");chip.textContent=`${s.icon} ${s.name} — ${s.size}`;shipInfo.appendChild(chip);});
        board.appendChild(controls); board.appendChild(shipInfo);
        board.appendChild(bsMakeGrid(game,deviceId,true,vertical));
    } else if(phase==="placement") {
        board.appendChild(bsMakeGrid(game,deviceId,false,false));
    } else {
        const mine=bsMakeGrid(game,deviceId,false,false);
        const target=opp?bsMakeGrid(game,opp.deviceId,true,false):null;
        const title1=document.createElement("div"); title1.textContent="🛡️ Your fleet"; title1.style.fontWeight="800";
        board.appendChild(title1); board.appendChild(mine);
        if(target){ const title2=document.createElement("div"); title2.textContent="🎯 Enemy grid"; title2.style.fontWeight="800"; title2.style.marginTop="8px"; board.appendChild(title2); board.appendChild(target); }
    }
    if(game.status==="finished"){
        const result=document.createElement("div"); result.className="battleship-result";
        result.textContent=data.winnerDeviceId===deviceId?"🏆 YOU WIN!":"💀 YOU LOSE!"; board.appendChild(result);
    }
    return board;
}

function bsMakeGrid(game,ownerId,attackGrid,vertical){
    const wrap=document.createElement("div"); wrap.className="battleship-grid-wrap";
    const grid=document.createElement("div"); grid.className="battleship-grid";
    grid.appendChild(document.createElement("div"));
    for(let c=0;c<10;c++){const l=document.createElement("div");l.className="bs-label";l.textContent=BS_COLS[c];grid.appendChild(l);}
    const placement=game.data.placements?.[ownerId] || {ships:[],shots:[]};
    const shipMap=new Map(); (placement.ships||[]).forEach(s=>(s.cells||[]).forEach(x=>shipMap.set(bsKey(x.r,x.c),s.name)));
    const shots=placement.shots||[];
    const shotMap=new Map(shots.map(x=>[bsKey(x.r,x.c),x]));
    const isMe=ownerId===deviceId;
    const currentPlayer=game.players[game.turnIndex]?.deviceId;
    for(let r=0;r<10;r++){
        const rl=document.createElement("div");rl.className="bs-label";rl.textContent=r+1;grid.appendChild(rl);
        for(let c=0;c<10;c++){
            const key=bsKey(r,c), btn=document.createElement("button"); btn.className="bs-cell";
            const ship=shipMap.get(key), shot=shotMap.get(key);
            if(isMe && ship) btn.classList.add("ship");
            if(shot){btn.classList.add(shot.hit?"hit":"miss");btn.textContent=shot.hit?"💥":"•";}
            if(attackGrid && !isMe && game.status==="playing" && game.data.phase==="battle" && currentPlayer===deviceId && !shot){
                btn.classList.add("targetable"); btn.onclick=()=>bsAttack(game,ownerId,r,c);
            } else if(!attackGrid && isMe && game.data.phase==="placement" && game.status==="playing" && !bsFleetReady(placement)){
                btn.onclick=()=>bsPlace(game,r,c,vertical);
            } else btn.disabled=true;
            grid.appendChild(btn);
        }
    }
    wrap.appendChild(grid); return wrap;
}

async function bsPlace(game,r,c,vertical){
    if(game.data.phase!=="placement" || game.status!=="playing")return;
    const copy=JSON.parse(JSON.stringify(game));
    copy.data.placements=copy.data.placements||{};
    const mine=copy.data.placements[deviceId]||{ships:[],shots:[]};
    const shipDef=BS_SHIPS[mine.ships.length]; if(!shipDef)return;
    if(!bsCanPlace(mine.ships,r,c,shipDef.size,vertical)){alert("That ship does not fit there or overlaps another ship.");return;}
    mine.ships.push({name:shipDef.name,size:shipDef.size,cells:bsCellsFor(r,c,shipDef.size,vertical)});
    copy.data.placements[deviceId]=mine;
    if(bsFleetReady(mine) && copy.players.every(p=>bsFleetReady(copy.data.placements?.[p.deviceId]))){
        copy.data.phase="battle"; copy.turnIndex=0; copy.data.lastAction=null;
    }
    await publishGameAndCleanup(game,copy);
}

async function bsAttack(game,targetId,r,c){
    if(game.data.phase!=="battle" || game.status!=="playing")return;
    if(game.players[game.turnIndex]?.deviceId!==deviceId)return;
    const target=game.data.placements?.[targetId]; if(!target)return;
    const existing=(target.shots||[]).find(x=>x.r===r&&x.c===c); if(existing)return;
    const copy=JSON.parse(JSON.stringify(game));
    const t=copy.data.placements[targetId]; t.shots=t.shots||[];
    const key=bsKey(r,c), fleet=bsFleetCells(t); const hit=fleet.has(key);
    let sunk=null;
    t.shots.push({r,c,hit});
    if(hit){
        const ship=t.ships.find(s=>(s.cells||[]).some(x=>bsKey(x.r,x.c)===key));
        if(ship){const shipKeys=new Set(ship.cells.map(x=>bsKey(x.r,x.c))); const hitKeys=new Set(t.shots.filter(x=>x.hit).map(x=>bsKey(x.r,x.c))); if([...shipKeys].every(k=>hitKeys.has(k))) sunk=ship.name;}
    }
    const allSunk=(t.ships||[]).length>0 && t.ships.every(s=>s.cells.every(x=>t.shots.some(q=>q.hit&&q.r===x.r&&q.c===x.c)));
    copy.data.lastAction={attacker:deviceId,target:targetId,r,c,hit,sunk};
    if(allSunk){copy.status="finished";copy.data.phase="finished";copy.data.winnerDeviceId=deviceId;}
    else copy.turnIndex=(copy.turnIndex+1)%copy.players.length;
    await publishGameAndCleanup(game,copy);
}

/* =====================================================
   TIC TAC TOE (2-3 Players)
===================================================== */

function createTTT(game){
    const size = game.data.settings?.boardSize || 3;
    const total = size * size;
    const winCount = size;
    const playerCount = game.players.length;
    
    if (!game.data.board || game.data.board.length !== total) {
        game.data.board = Array(total).fill("");
    }

    const board = document.createElement("div");
    board.className = "ttt";
    const cellSize = size <= 3 ? 80 : size <= 4 ? 70 : size <= 5 ? 60 : 50;
    const responsiveCell = `min(${cellSize}px, calc((100vw - 112px) / ${size}))`;
    board.style.gridTemplateColumns = `repeat(${size}, minmax(0, ${responsiveCell}))`;
    board.style.gridTemplateRows = `repeat(${size}, minmax(0, ${responsiveCell}))`;

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const symbols = ["❌", "⭕", "🔺"];
    const symbolClasses = ["symbol-X", "symbol-O", "symbol-triangle"];

    for (let i = 0; i < total; i++) {
        const button = document.createElement("button");
        const value = game.data.board[i];
        button.textContent = value || "";
        if (value) {
            const idx = symbols.indexOf(value);
            if (idx !== -1) button.className = symbolClasses[idx];
        }
        button.style.fontSize = `clamp(${size >= 6 ? 16 : 18}px, ${Math.max(2.2, 7 / size)}vw, ${size <= 3 ? 32 : size <= 4 ? 28 : size <= 5 ? 24 : 20}px)`;
        button.disabled = !myTurn || !!game.data.board[i] || !!game.winner;
        button.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            const idx = copy.turnIndex % copy.players.length;
            const symbol = symbols[idx];
            copy.data.board[i] = symbol;
            
            if (checkTTTWin(copy.data.board, size, i, symbol, winCount)) {
                copy.winner = current.username;
                copy.status = "finished";
            } else if (copy.data.board.every(c => c)) {
                copy.winner = "draw";
                copy.status = "finished";
            } else {
                copy.turnIndex++;
            }
            await publishGameAndCleanup(game, copy);
        };
        board.appendChild(button);
    }
    return board;
}

function checkTTTWin(board, size, pos, symbol, winCount){
    const row = Math.floor(pos / size);
    const col = pos % size;
    
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
        let count = 1;
        for (const dir of [-1,1]) {
            let r = row + dr * dir, c = col + dc * dir;
            while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === symbol) {
                count++;
                r += dr * dir;
                c += dc * dir;
            }
        }
        if (count >= winCount) return true;
    }
    return false;
}


/* =====================================================
   MEMORY MATCH
===================================================== */

function createMemory(game){
    const area = document.createElement("div");
    const emojis = ["🍎","🍊","🍋","🍇","🍉","🍓","🍑","🍒","🥝","🍍","🥭","🍌","🍈","🫐","🍐","🥥","🧸","🎈","🎀","🎁","🌟","🌈","🦄","🐉","🐱","🐶","🐰","🦊","🐼","🐨"];
    
    const gridSize = game.data.settings?.gridSize || 4;
    const totalCards = gridSize * gridSize;
    const pairs = totalCards / 2;
    const usedEmojis = emojis.slice(0, pairs);
    let cards = [...usedEmojis, ...usedEmojis];
    
    if (!game.data.cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        game.data.cards = cards;
        game.data.flipped = [];
        game.data.matched = [];
        game.data.scores = {};
    }

    const grid = document.createElement("div");
    grid.className = "memory-grid";
    const memoryCell = gridSize <= 4 ? 70 : 60;
    grid.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0, min(${memoryCell}px, calc((100vw - 118px) / ${gridSize}))))`;

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const flipped = game.data.flipped || [];
    const matched = game.data.matched || [];

    for (let i = 0; i < game.data.cards.length; i++) {
        const card = document.createElement("div");
        card.className = "memory-card";
        if (matched.includes(i)) {
            card.classList.add("matched");
            card.textContent = game.data.cards[i];
        } else if (flipped.includes(i)) {
            card.classList.add("flipped");
            card.textContent = game.data.cards[i];
        }
        
        if (!matched.includes(i) && myTurn && !flipped.includes(i) && flipped.length < 2) {
            card.onclick = async () => {
                const copy = JSON.parse(JSON.stringify(game));
                const flips = copy.data.flipped || [];
                if (flips.includes(i) || flips.length >= 2) return;
                flips.push(i);
                copy.data.flipped = flips;
                
                if (flips.length === 2) {
                    const cardsData = copy.data.cards;
                    if (cardsData[flips[0]] === cardsData[flips[1]]) {
                        copy.data.matched = (copy.data.matched || []).concat(flips);
                        copy.data.flipped = [];
                        copy.data.scores = copy.data.scores || {};
                        copy.data.scores[current.deviceId] = (copy.data.scores[current.deviceId] || 0) + 1;
                        if (copy.data.matched.length === copy.data.cards.length) {
                            let winner = null;
                            let max = -1;
                            for (const [id, score] of Object.entries(copy.data.scores)) {
                                if (score > max) {
                                    max = score;
                                    winner = copy.players.find(p => p.deviceId === id)?.username;
                                }
                            }
                            copy.winner = winner || "draw";
                            copy.status = "finished";
                        }
                    } else {
                        copy.turnIndex++;
                        setTimeout(async () => {
                            const resetCopy = JSON.parse(JSON.stringify(copy));
                            resetCopy.data.flipped = [];
                            await publishGameAndCleanup(game, resetCopy);
                        }, 800);
                        await publishGameAndCleanup(game, copy);
                        return;
                    }
                }
                await publishGameAndCleanup(game, copy);
            };
        }
        grid.appendChild(card);
    }
    area.appendChild(grid);

    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "text-align:center;margin-top:10px;color:#9da5b0;";
    const scores = game.data.scores || {};
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (scores[p.deviceId] || 0)
    ).join(" · ");
    area.appendChild(scoreDiv);

    return area;
}


/* =====================================================
   QUICK DRAW
===================================================== */

function createQuickDraw(game){
    const area = document.createElement("div");
    area.className = "quickdraw-area";

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const state = game.data.state || "waiting";
    const round = game.data.round || 0;
    const results = game.data.results || {};
    const totalRounds = game.data.settings?.rounds || 3;

    const box = document.createElement("div");
    box.className = "quickdraw-box " + state;

    if (state === "waiting") {
        box.textContent = "⏳ Round " + (round + 1) + "/" + totalRounds + "\nWaiting for " + (myTurn ? "you" : current.username);
        if (myTurn) {
            box.onclick = async () => {
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.state = "countdown";
                copy.data.startTime = Date.now() + 1000 + Math.random() * 3000;
                copy.data.round = round;
                await publishGameAndCleanup(game, copy);
            };
        }
    } else if (state === "countdown") {
        const remaining = Math.max(0, (game.data.startTime - Date.now()) / 1000);
        box.textContent = "⏳ " + Math.ceil(remaining);
        if (remaining < 0.5 && myTurn) {
            setTimeout(async () => {
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.state = "draw";
                copy.data.drawTime = Date.now();
                await publishGameAndCleanup(game, copy);
            }, Math.max(0, game.data.startTime - Date.now() + 100));
        }
    } else if (state === "draw") {
        box.textContent = "🟢 DRAW! CLICK!";
        box.style.cursor = "pointer";
        if (myTurn) {
            box.onclick = async () => {
                const reactionTime = Date.now() - game.data.drawTime;
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.results = copy.data.results || {};
                copy.data.results[deviceId] = reactionTime;
                copy.turnIndex++;
                copy.data.round = (round + 1);
                
                if (copy.data.round >= totalRounds) {
                    let winner = null;
                    let best = Infinity;
                    const averages = {};
                    for (const player of copy.players) {
                        const times = [];
                        for (const [id, time] of Object.entries(copy.data.results || {})) {
                            if (id === player.deviceId) times.push(time);
                        }
                        if (times.length > 0) {
                            averages[player.deviceId] = times.reduce((a,b) => a+b, 0) / times.length;
                        }
                    }
                    for (const [id, avg] of Object.entries(averages)) {
                        if (avg < best) {
                            best = avg;
                            winner = copy.players.find(p => p.deviceId === id)?.username;
                        }
                    }
                    copy.winner = winner + " (" + Math.round(best) + "ms avg)";
                    copy.status = "finished";
                } else {
                    copy.data.state = "waiting";
                }
                await publishGameAndCleanup(game, copy);
            };
        } else {
            box.textContent = "🟢 Waiting for " + current.username + "...";
        }
    } else if (state === "punish") {
        box.textContent = "❌ Too early! Punished!";
        box.classList.add("punish");
        setTimeout(async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.state = "waiting";
            copy.turnIndex++;
            await publishGameAndCleanup(game, copy);
        }, 1000);
    }

    area.appendChild(box);

    if (Object.keys(results).length > 0) {
        const resultsDiv = document.createElement("div");
        resultsDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:13px;";
        const sorted = Object.entries(results).sort((a,b) => a[1] - b[1]);
        resultsDiv.innerHTML = sorted.map(([id, time]) => {
            const name = game.players.find(p => p.deviceId === id)?.username || "Unknown";
            return `<span style="margin:0 8px;">${escapeHtml(name)}: ${time}ms</span>`;
        }).join("");
        area.appendChild(resultsDiv);
    }

    return area;
}


/* =====================================================
   COIN FLIP BATTLE
===================================================== */

function createCoinFlip(game){
    const area = document.createElement("div");
    area.className = "coin-area";

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const targetScore = game.data.settings?.targetScore || 3;
    const scores = game.data.scores || {};
    const state = game.data.state || "waiting";
    const coinResult = game.data.coinResult || null;

    if (!game.data.choices) {
        game.data.choices = {};
    }

    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-bottom:10px;font-size:16px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (scores[p.deviceId] || 0) + "/" + targetScore
    ).join(" | ");
    area.appendChild(scoreDiv);

    const coinDisplay = document.createElement("div");
    coinDisplay.className = "coin-display";
    if (coinResult === "heads") coinDisplay.textContent = "🪙 Heads";
    else if (coinResult === "tails") coinDisplay.textContent = "🪙 Tails";
    else coinDisplay.textContent = "🪙";
    area.appendChild(coinDisplay);

    if (game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        win.textContent = "🏆 " + game.winner + " wins!";
        area.appendChild(win);
        return area;
    }

    if (!myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    const choiceDiv = document.createElement("div");
    choiceDiv.className = "coin-buttons";
    
    ["heads", "tails"].forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "coin-btn";
        if (game.data.choices[deviceId] === choice) btn.classList.add("selected");
        btn.textContent = choice === "heads" ? "🪙 Heads" : "🪙 Tails";
        btn.disabled = state === "flipping";
        btn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.choices = copy.data.choices || {};
            copy.data.choices[deviceId] = choice;
            
            const allChosen = copy.players.every(p => copy.data.choices[p.deviceId]);
            if (allChosen && copy.data.state !== "flipping") {
                copy.data.state = "flipping";
                const result = Math.random() < 0.5 ? "heads" : "tails";
                copy.data.coinResult = result;
                
                for (const player of copy.players) {
                    if (copy.data.choices[player.deviceId] === result) {
                        copy.data.scores = copy.data.scores || {};
                        copy.data.scores[player.deviceId] = (copy.data.scores[player.deviceId] || 0) + 1;
                    }
                }
                
                let winner = null;
                for (const player of copy.players) {
                    if ((copy.data.scores[player.deviceId] || 0) >= targetScore) {
                        winner = player.username;
                        break;
                    }
                }
                
                if (winner) {
                    copy.winner = winner;
                    copy.status = "finished";
                } else {
                    copy.data.choices = {};
                    copy.data.coinResult = null;
                    copy.data.state = "waiting";
                    copy.turnIndex++;
                }
            }
            await publishGameAndCleanup(game, copy);
        };
        choiceDiv.appendChild(btn);
    });
    area.appendChild(choiceDiv);

    if (game.hostDeviceId === deviceId && state !== "flipping") {
        const flipBtn = document.createElement("button");
        flipBtn.className = "game-btn primary";
        flipBtn.textContent = "🪙 Flip Coin";
        flipBtn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            const result = Math.random() < 0.5 ? "heads" : "tails";
            copy.data.coinResult = result;
            copy.data.state = "flipping";
            
            for (const player of copy.players) {
                if (copy.data.choices[player.deviceId] === result) {
                    copy.data.scores = copy.data.scores || {};
                    copy.data.scores[player.deviceId] = (copy.data.scores[player.deviceId] || 0) + 1;
                }
            }
            
            let winner = null;
            for (const player of copy.players) {
                if ((copy.data.scores[player.deviceId] || 0) >= targetScore) {
                    winner = player.username;
                    break;
                }
            }
            
            if (winner) {
                copy.winner = winner;
                copy.status = "finished";
            } else {
                copy.data.choices = {};
                copy.data.coinResult = null;
                copy.data.state = "waiting";
                copy.turnIndex++;
            }
            await publishGameAndCleanup(game, copy);
        };
        area.appendChild(flipBtn);
    }

    return area;
}


/* =====================================================
   NUMBER GUESS
===================================================== */

function createNumberGuess(game){
    const area = document.createElement("div");
    area.className = "numberguess-area";

    const maxNumber = game.data.settings?.maxNumber || 100;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.secretNumber) {
        game.data.secretNumber = Math.floor(Math.random() * maxNumber) + 1;
        game.data.guesses = [];
        game.data.hint = "🔢 Guess a number between 1 and " + maxNumber;
    }

    if (game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        win.textContent = "🎉 " + game.winner + " guessed it! The number was " + game.data.secretNumber;
        area.appendChild(win);
        return area;
    }

    if (!myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    const hint = document.createElement("div");
    hint.className = "numberguess-hint";
    hint.textContent = game.data.hint || "🔢 Guess a number";
    area.appendChild(hint);

    const input = document.createElement("input");
    input.className = "numberguess-input";
    input.type = "number";
    input.min = 1;
    input.max = maxNumber;
    input.placeholder = "Guess...";
    input.autofocus = true;

    input.onkeydown = async (e) => {
        if (e.key === "Enter") {
            const guess = parseInt(input.value);
            if (isNaN(guess) || guess < 1 || guess > maxNumber) return;
            
            const copy = JSON.parse(JSON.stringify(game));
            const secret = copy.data.secretNumber;
            
            if (guess === secret) {
                copy.winner = current.username;
                copy.status = "finished";
            } else {
                copy.data.hint = guess < secret ? "⬆ Higher! (" + guess + ")" : "⬇ Lower! (" + guess + ")";
                copy.data.guesses = copy.data.guesses || [];
                copy.data.guesses.push({ player: current.username, guess });
                copy.turnIndex++;
            }
            input.value = "";
            await publishGameAndCleanup(game, copy);
        }
    };

    area.appendChild(input);

    if (game.data.guesses && game.data.guesses.length > 0) {
        const guessesDiv = document.createElement("div");
        guessesDiv.style.cssText = "color:#6a7a8a;font-size:12px;margin-top:10px;";
        const lastGuesses = game.data.guesses.slice(-5);
        guessesDiv.textContent = "Recent: " + lastGuesses.map(g => g.player + "→" + g.guess).join(", ");
        area.appendChild(guessesDiv);
    }

    return area;
}


/* =====================================================
   TARGET CLICK
===================================================== */

function createTarget(game){
    const area = document.createElement("div");
    area.className = "target-area";

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const totalTargets = game.data.settings?.targets || 5;
    const state = game.data.state || "waiting";
    const hits = game.data.hits || 0;
    const total = game.data.total || 0;
    const startTime = game.data.startTime || 0;
    const results = game.data.results || {};

    const box = document.createElement("div");
    box.className = "target-box";

    if (state === "waiting" && myTurn) {
        box.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.state = "playing";
            copy.data.hits = 0;
            copy.data.total = 0;
            copy.data.startTime = Date.now();
            copy.data.targets = [];
            copy.data.targetIndex = 0;
            copy.data.totalTargets = totalTargets;
            spawnTarget(copy);
            await publishGameAndCleanup(game, copy);
        };
        box.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:#6a7a8a;font-size:20px;">👆 Click to start (${totalTargets} targets)</div>`;
    } else if (state === "playing") {
        const targetPos = game.data.targets || [];
        const targetIndex = game.data.targetIndex || 0;
        
        if (targetIndex < totalTargets) {
            const pos = targetPos[targetIndex] || { x: 50, y: 50 };
            const dot = document.createElement("div");
            dot.className = "target-dot";
            dot.style.left = pos.x + "%";
            dot.style.top = pos.y + "%";
            
            if (myTurn) {
                dot.onclick = async () => {
                    const copy = JSON.parse(JSON.stringify(game));
                    copy.data.hits = (copy.data.hits || 0) + 1;
                    copy.data.total = (copy.data.total || 0) + 1;
                    copy.data.targetIndex = (copy.data.targetIndex || 0) + 1;
                    
                    if (copy.data.targetIndex >= totalTargets) {
                        const time = Date.now() - copy.data.startTime;
                        copy.data.results = copy.data.results || {};
                        copy.data.results[deviceId] = {
                            hits: copy.data.hits,
                            total: copy.data.total,
                            time: time,
                            accuracy: Math.round((copy.data.hits / copy.data.total) * 100)
                        };
                        copy.data.state = "done";
                        copy.turnIndex++;
                        
                        if (copy.turnIndex >= copy.players.length) {
                            let winner = null;
                            let bestScore = -1;
                            for (const [id, res] of Object.entries(copy.data.results)) {
                                const score = res.hits * 100 + (100 - res.time / 10);
                                if (score > bestScore) {
                                    bestScore = score;
                                    winner = copy.players.find(p => p.deviceId === id)?.username;
                                }
                            }
                            copy.winner = winner;
                            copy.status = "finished";
                        } else {
                            copy.data.state = "waiting";
                        }
                    } else {
                        spawnTarget(copy);
                    }
                    await publishGameAndCleanup(game, copy);
                };
            }
            box.appendChild(dot);
        }
    } else if (state === "done") {
        const res = results[deviceId];
        if (res) {
            box.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:#7affb0;font-size:20px;">✅ Done!<br>Hits: ${res.hits}/${res.total}<br>Accuracy: ${res.accuracy}%<br>Time: ${(res.time/1000).toFixed(1)}s</div>`;
        } else {
            box.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:#6a7a8a;font-size:20px;">⏳ Waiting for others...</div>`;
        }
    }

    area.appendChild(box);

    const stats = document.createElement("div");
    stats.className = "target-stats";
    const res = results[deviceId];
    stats.innerHTML = `
        <div>Hits: <strong>${hits}</strong></div>
        <div>Total: <strong>${total}</strong></div>
        <div>Accuracy: <strong>${total > 0 ? Math.round((hits/total)*100) : 0}%</strong></div>
    `;
    area.appendChild(stats);

    return area;
}

function spawnTarget(game) {
    const x = 10 + Math.random() * 80;
    const y = 10 + Math.random() * 80;
    game.data.targets = game.data.targets || [];
    game.data.targets.push({ x, y });
}


/* =====================================================
   REACTION TIME
===================================================== */

function createReaction(game){
    const area = document.createElement("div");
    area.className = "reaction-area";

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    const state = game.data.state || "waiting";
    const startTime = game.data.startTime || 0;
    const results = game.data.results || {};

    const box = document.createElement("div");
    box.className = "reaction-box " + state;

    if (state === "waiting") {
        box.textContent = "⏳ Waiting for " + (myTurn ? "you" : current.username) + "...";
        if (myTurn) {
            box.onclick = async () => {
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.state = "ready";
                copy.data.startTime = Date.now() + 1000 + Math.random() * 3000;
                await publishGameAndCleanup(game, copy);
            };
        }
    } else if (state === "ready") {
        const remaining = Math.max(0, (startTime - Date.now()) / 1000);
        box.textContent = "🟢 Get ready... " + remaining.toFixed(1) + "s";
        if (remaining < 0.5 && myTurn) {
            setTimeout(async () => {
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.state = "go";
                copy.data.goTime = Date.now();
                await publishGameAndCleanup(game, copy);
            }, Math.max(0, startTime - Date.now() + 100));
        }
    } else if (state === "go") {
        box.textContent = "🟢 CLICK NOW!";
        box.style.cursor = "pointer";
        if (myTurn) {
            box.onclick = async () => {
                const reactionTime = Date.now() - game.data.goTime;
                const copy = JSON.parse(JSON.stringify(game));
                copy.data.results = copy.data.results || {};
                copy.data.results[deviceId] = reactionTime;
                copy.turnIndex++;
                if (copy.turnIndex >= copy.players.length) {
                    let winner = null;
                    let best = Infinity;
                    for (const [id, time] of Object.entries(copy.data.results)) {
                        if (time < best) {
                            best = time;
                            winner = copy.players.find(p => p.deviceId === id)?.username;
                        }
                    }
                    copy.winner = winner + " (" + best + "ms)";
                    copy.status = "finished";
                } else {
                    copy.data.state = "waiting";
                }
                await publishGameAndCleanup(game, copy);
            };
        } else {
            box.textContent = "🟢 Waiting for " + current.username + "...";
        }
    } else if (state === "done") {
        box.textContent = "✅ Done!";
        box.classList.add("done");
    }

    area.appendChild(box);

    if (Object.keys(results).length > 0) {
        const resultsDiv = document.createElement("div");
        resultsDiv.style.cssText = "color:#9da5b0;margin-top:10px;";
        const sorted = Object.entries(results).sort((a,b) => a[1] - b[1]);
        resultsDiv.innerHTML = sorted.map(([id, time]) => {
            const name = game.players.find(p => p.deviceId === id)?.username || "Unknown";
            return `<div>${escapeHtml(name)}: ${time}ms</div>`;
        }).join("");
        area.appendChild(resultsDiv);
    }

    return area;
}


/* =====================================================
   TYPE SENTENCE
===================================================== */

function createTypeSentence(game){
    const area = document.createElement("div");
    area.className = "type-area";

    const sentences = [
        "The quick brown fox jumps over the lazy dog.",
        "Pack my box with five dozen liquor jugs.",
        "How vexingly quick daft zebras jump.",
        "The five boxing wizards jump quickly.",
        "Jazz and swing fans like fast music.",
        "Crazy Fredericka bought many very exquisite opal jewels.",
        "We promptly judged antique ivory buckles for the next prize.",
        "A quacking duck flew over the busy highway.",
        "The amazing spider web sparkled in the morning dew.",
        "Bright vixens jump; dozy fowl quack."
    ];

    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.sentence) {
        game.data.sentence = sentences[Math.floor(Math.random() * sentences.length)];
        game.data.startTime = 0;
        game.data.results = {};
        game.data.done = false;
    }

    const sentence = game.data.sentence;
    const results = game.data.results || {};

    const sentDisplay = document.createElement("div");
    sentDisplay.className = "type-sentence";
    sentDisplay.textContent = sentence;
    area.appendChild(sentDisplay);

    if (game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        win.textContent = "🏆 Winner: " + game.winner;
        area.appendChild(win);
        return area;
    }

    if (!myTurn && !game.data.done) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    if (game.data.done) {
        const done = document.createElement("div");
        done.className = "turn-banner";
        done.textContent = "All players finished!";
        area.appendChild(done);
        return area;
    }

    const input = document.createElement("input");
    input.className = "type-input";
    input.placeholder = "Type the sentence here...";
    input.autofocus = true;

    let started = false;

    input.oninput = async () => {
        if (!started && input.value.length > 0) {
            started = true;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.startTime = Date.now();
            await publishGameAndCleanup(game, copy);
        }

        if (input.value === sentence) {
            const time = Date.now() - game.data.startTime;
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.results = copy.data.results || {};
            copy.data.results[deviceId] = time;
            copy.turnIndex++;
            
            if (copy.turnIndex >= copy.players.length) {
                copy.data.done = true;
                let winner = null;
                let best = Infinity;
                for (const [id, t] of Object.entries(copy.data.results)) {
                    if (t < best) {
                        best = t;
                        winner = copy.players.find(p => p.deviceId === id)?.username;
                    }
                }
                copy.winner = winner + " (" + (best/1000).toFixed(2) + "s)";
                copy.status = "finished";
            }
            await publishGameAndCleanup(game, copy);
        }
    };

    area.appendChild(input);

    const stats = document.createElement("div");
    stats.className = "type-stats";
    const completed = Object.keys(results).length;
    stats.innerHTML = `
        <div>Completed: <strong>${completed}/${game.players.length}</strong></div>
        <div>Your time: <strong>${results[deviceId] ? (results[deviceId]/1000).toFixed(2) + 's' : '—'}</strong></div>
    `;
    area.appendChild(stats);

    return area;
}


/* =====================================================
   BOSS BATTLE
===================================================== */

function createBossBattle(game){
    const area = document.createElement("div");
    area.className = "boss-area";

    const BOSS_MAX_HEALTH = game.data.settings?.bossHealth || 100000000;

    if (!game.data.bossHealth) {
        game.data.bossHealth = BOSS_MAX_HEALTH;
        game.data.maxHealth = BOSS_MAX_HEALTH;
        game.data.damage = 1;
        game.data.upgrades = {};
        game.data.totalDamageDealt = {};
        game.data.bossDefeated = false;
        game.data.critChance = 0;
        game.data.multiHit = 1;
    }

    const mine = game.players.some(p => p.deviceId === deviceId);
    const health = game.data.bossHealth;
    const maxHealth = game.data.maxHealth;
    const damage = game.data.damage || 1;
    const upgrades = game.data.upgrades || {};
    const totalDamage = game.data.totalDamageDealt || {};
    const playerDamage = totalDamage[deviceId] || 0;

    const monsterName = document.createElement("div");
    monsterName.className = "boss-monster-name";
    const names = ["Cthulhu", "Mega Dragon", "Shadow Lord", "Void Beast", "Eldritch Horror", "Demon King"];
    if (!game.data.monsterName) {
        game.data.monsterName = names[Math.floor(Math.random() * names.length)];
    }
    monsterName.textContent = "👹 " + game.data.monsterName;
    area.appendChild(monsterName);

    const healthBar = document.createElement("div");
    healthBar.className = "boss-health-bar";
    
    const healthFill = document.createElement("div");
    healthFill.className = "boss-health-fill";
    const percent = Math.max(0, (health / maxHealth) * 100);
    healthFill.style.width = percent + "%";
    healthBar.appendChild(healthFill);

    const healthText = document.createElement("div");
    healthText.className = "boss-health-text";
    healthText.textContent = Math.floor(health).toLocaleString() + " / " + maxHealth.toLocaleString() + " HP";
    healthBar.appendChild(healthText);
    area.appendChild(healthBar);

    const stats = document.createElement("div");
    stats.className = "boss-stats";
    stats.innerHTML = `
        <div>⚔️ Damage: <strong>${damage.toLocaleString()}</strong></div>
        <div>💪 Your damage: <strong>${playerDamage.toLocaleString()}</strong></div>
        <div>👥 Players: <strong>${game.players.length}</strong></div>
        <div>💥 Crit: <strong>${Math.round((game.data.critChance || 0) * 100)}%</strong></div>
        <div>🌀 Multi: <strong>${game.data.multiHit || 1}x</strong></div>
    `;
    area.appendChild(stats);

    if (game.data.bossDefeated) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        win.style.cssText = "background:#1a3a2a;border-color:#2a6a4a;color:#7affb0;font-size:20px;padding:20px;";
        win.innerHTML = "🎉 BOSS DEFEATED! 🎉<br><span style='font-size:14px;color:#9da5b0;'>The " + game.data.monsterName + " has been slain!</span>";
        area.appendChild(win);
        return area;
    }

    const attackBtn = document.createElement("button");
    attackBtn.className = "game-btn boss";
    
    let displayDamage = damage;
    if (Math.random() < (game.data.critChance || 0)) {
        displayDamage = Math.floor(damage * 2);
    }
    const multiHits = game.data.multiHit || 1;
    const totalDisplayDamage = displayDamage * multiHits;
    
    attackBtn.textContent = `⚔️ ATTACK! (${totalDisplayDamage.toLocaleString()} dmg)`;
    
    attackBtn.onclick = async () => {
        const copy = JSON.parse(JSON.stringify(game));
        let dmg = copy.data.damage || 1;
        
        let crit = 1;
        if (Math.random() < (copy.data.critChance || 0)) {
            crit = 2;
        }
        
        const multi = copy.data.multiHit || 1;
        const totalDmg = Math.floor(dmg * crit * multi);
        
        copy.data.bossHealth = Math.max(0, copy.data.bossHealth - totalDmg);
        copy.data.totalDamageDealt = copy.data.totalDamageDealt || {};
        copy.data.totalDamageDealt[deviceId] = (copy.data.totalDamageDealt[deviceId] || 0) + totalDmg;
        
        if (copy.data.bossHealth <= 0) {
            copy.data.bossDefeated = true;
            copy.data.bossHealth = 0;
            let mvp = null;
            let maxDmg = -1;
            for (const [id, d] of Object.entries(copy.data.totalDamageDealt)) {
                if (d > maxDmg) {
                    maxDmg = d;
                    mvp = copy.players.find(p => p.deviceId === id)?.username;
                }
            }
            copy.winner = "🏆 MVP: " + (mvp || "Everyone!") + " 🏆";
            copy.status = "finished";
        }
        
        if (Math.random() < 0.2 && !copy.data.bossDefeated) {
            copy.data.upgrades = copy.data.upgrades || {};
            copy.data.upgrades[deviceId] = (copy.data.upgrades[deviceId] || 0) + 1;
        }
        
        await publishGameAndCleanup(game, copy);
    };
    area.appendChild(attackBtn);

    const dmgDisplay = document.createElement("div");
    dmgDisplay.className = "boss-damage-display";
    dmgDisplay.textContent = "⚔️ " + damage.toLocaleString() + " base damage";
    area.appendChild(dmgDisplay);

    const upgradesDiv = document.createElement("div");
    upgradesDiv.className = "boss-upgrades";
    
    const upgradeCosts = {
        damage: 5,
        crit: 10,
        multi: 20
    };
    
    const upgradePoints = upgrades[deviceId] || 0;
    
    const upgradeInfo = document.createElement("div");
    upgradeInfo.style.cssText = "width:100%;text-align:center;color:#9da5b0;font-size:12px;margin-bottom:5px;";
    upgradeInfo.textContent = "🔧 Upgrade points: " + upgradePoints;
    upgradesDiv.appendChild(upgradeInfo);

    const dmgUpgrade = document.createElement("button");
    dmgUpgrade.className = "boss-upgrade-btn";
    dmgUpgrade.innerHTML = `⚔️ +20% Damage <span class="cost">(${upgradeCosts.damage} pts)</span>`;
    dmgUpgrade.disabled = upgradePoints < upgradeCosts.damage;
    dmgUpgrade.onclick = async () => {
        const copy = JSON.parse(JSON.stringify(game));
        copy.data.upgrades = copy.data.upgrades || {};
        copy.data.upgrades[deviceId] = (copy.data.upgrades[deviceId] || 0) - upgradeCosts.damage;
        copy.data.damage = Math.floor((copy.data.damage || 1) * 1.2);
        await publishGameAndCleanup(game, copy);
    };
    upgradesDiv.appendChild(dmgUpgrade);

    const critUpgrade = document.createElement("button");
    critUpgrade.className = "boss-upgrade-btn";
    critUpgrade.innerHTML = `💥 +10% Crit Chance <span class="cost">(${upgradeCosts.crit} pts)</span>`;
    critUpgrade.disabled = upgradePoints < upgradeCosts.crit;
    critUpgrade.onclick = async () => {
        const copy = JSON.parse(JSON.stringify(game));
        copy.data.upgrades = copy.data.upgrades || {};
        copy.data.upgrades[deviceId] = (copy.data.upgrades[deviceId] || 0) - upgradeCosts.crit;
        copy.data.critChance = Math.min(1, (copy.data.critChance || 0) + 0.1);
        await publishGameAndCleanup(game, copy);
    };
    upgradesDiv.appendChild(critUpgrade);

    const multiUpgrade = document.createElement("button");
    multiUpgrade.className = "boss-upgrade-btn";
    multiUpgrade.innerHTML = `🌀 +1 Multi-hit <span class="cost">(${upgradeCosts.multi} pts)</span>`;
    multiUpgrade.disabled = upgradePoints < upgradeCosts.multi;
    multiUpgrade.onclick = async () => {
        const copy = JSON.parse(JSON.stringify(game));
        copy.data.upgrades = copy.data.upgrades || {};
        copy.data.upgrades[deviceId] = (copy.data.upgrades[deviceId] || 0) - upgradeCosts.multi;
        copy.data.multiHit = (copy.data.multiHit || 1) + 1;
        await publishGameAndCleanup(game, copy);
    };
    upgradesDiv.appendChild(multiUpgrade);

    area.appendChild(upgradesDiv);

    return area;
}


/* =====================================================
   TRIVIA QUIZ
===================================================== */

function createTrivia(game){
    const area = document.createElement("div");
    area.className = "trivia-area";

    const questions = [
        { q: "What is the capital of France?", options: ["London", "Paris", "Berlin", "Madrid"], answer: 1 },
        { q: "What is 2 + 2?", options: ["3", "4", "5", "6"], answer: 1 },
        { q: "What color is the sky on a clear day?", options: ["Green", "Red", "Blue", "Yellow"], answer: 2 },
        { q: "What is the largest planet in our solar system?", options: ["Earth", "Mars", "Jupiter", "Saturn"], answer: 2 },
        { q: "What is the fastest animal on land?", options: ["Lion", "Cheetah", "Horse", "Dog"], answer: 1 },
        { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
        { q: "What is the boiling point of water?", options: ["90°C", "100°C", "110°C", "120°C"], answer: 1 },
        { q: "What is the square root of 144?", options: ["10", "11", "12", "13"], answer: 2 },
        { q: "What is the tallest mountain in the world?", options: ["Everest", "K2", "Kilimanjaro", "Denali"], answer: 0 },
        { q: "How many days are in a leap year?", options: ["364", "365", "366", "367"], answer: 2 },
        { q: "What is the chemical symbol for water?", options: ["H2O", "CO2", "NaCl", "HCl"], answer: 0 },
        { q: "What is the smallest country in the world?", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], answer: 1 }
    ];

    const totalQuestions = game.data.settings?.questions || 5;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.questions) {
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        game.data.questions = shuffled.slice(0, totalQuestions);
        game.data.currentQuestion = 0;
        game.data.scores = {};
        game.data.answered = {};
    }

    if (game.data.currentQuestion >= game.data.questions.length || game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        let winner = null;
        let max = -1;
        for (const [id, score] of Object.entries(game.data.scores || {})) {
            if (score > max) {
                max = score;
                winner = game.players.find(p => p.deviceId === id)?.username;
            }
        }
        win.textContent = "🏆 " + (winner || "No one") + " wins with " + max + " correct!";
        area.appendChild(win);
        return area;
    }

    const qData = game.data.questions[game.data.currentQuestion];
    const answered = game.data.answered || {};

    const questionDiv = document.createElement("div");
    questionDiv.className = "trivia-question";
    questionDiv.textContent = `Q${game.data.currentQuestion + 1}. ${qData.q}`;
    area.appendChild(questionDiv);

    if (!myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "trivia-options";

    qData.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "trivia-option";
        btn.textContent = opt;
        btn.disabled = answered[deviceId] !== undefined;
        
        if (answered[deviceId] !== undefined) {
            if (idx === qData.answer) btn.classList.add("correct");
            else if (idx === answered[deviceId]) btn.classList.add("wrong");
        }
        
        btn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.answered = copy.data.answered || {};
            copy.data.answered[deviceId] = idx;
            
            if (idx === qData.answer) {
                copy.data.scores = copy.data.scores || {};
                copy.data.scores[deviceId] = (copy.data.scores[deviceId] || 0) + 1;
            }
            
            // Check if everyone answered
            const allAnswered = copy.players.every(p => copy.data.answered[p.deviceId] !== undefined);
            if (allAnswered) {
                copy.data.currentQuestion++;
                copy.data.answered = {};
                copy.turnIndex++;
                if (copy.data.currentQuestion >= copy.data.questions.length) {
                    let winner = null;
                    let max = -1;
                    for (const [id, score] of Object.entries(copy.data.scores || {})) {
                        if (score > max) {
                            max = score;
                            winner = copy.players.find(p => p.deviceId === id)?.username;
                        }
                    }
                    copy.winner = winner || "draw";
                    copy.status = "finished";
                }
            }
            await publishGameAndCleanup(game, copy);
        };
        optionsDiv.appendChild(btn);
    });
    area.appendChild(optionsDiv);

    // Score display
    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:14px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (game.data.scores?.[p.deviceId] || 0)
    ).join(" · ");
    area.appendChild(scoreDiv);

    return area;
}


/* =====================================================
   WORD SCRAMBLE
===================================================== */

function createWordScramble(game){
    const area = document.createElement("div");
    area.className = "wordscramble-area";

    const words = [
        "apple", "banana", "cherry", "dragon", "eagle", "forest", "garden", "honey",
        "island", "joker", "kingdom", "lunar", "magic", "nature", "ocean", "planet",
        "queen", "rabbit", "spirit", "tiger", "unique", "vortex", "whale", "xenon",
        "yellow", "zebra", "angel", "blaze", "cloud", "dream", "eagle", "flame"
    ];

    const totalRounds = game.data.settings?.rounds || 5;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.words) {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        game.data.words = shuffled.slice(0, totalRounds);
        game.data.currentRound = 0;
        game.data.scores = {};
        game.data.answered = {};
    }

    if (game.data.currentRound >= game.data.words.length || game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        let winner = null;
        let max = -1;
        for (const [id, score] of Object.entries(game.data.scores || {})) {
            if (score > max) {
                max = score;
                winner = game.players.find(p => p.deviceId === id)?.username;
            }
        }
        win.textContent = "🏆 " + (winner || "No one") + " wins with " + max + " points!";
        area.appendChild(win);
        return area;
    }

    const word = game.data.words[game.data.currentRound];
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    const answered = game.data.answered || {};

    const wordDiv = document.createElement("div");
    wordDiv.className = "wordscramble-word";
    wordDiv.textContent = scrambled;
    area.appendChild(wordDiv);

    if (!myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    const input = document.createElement("input");
    input.className = "wordscramble-input";
    input.placeholder = "Unscramble the word...";
    input.disabled = answered[deviceId] !== undefined;

    input.onkeydown = async (e) => {
        if (e.key === "Enter" && !input.disabled) {
            const guess = input.value.trim().toLowerCase();
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.answered = copy.data.answered || {};
            copy.data.answered[deviceId] = guess;
            
            if (guess === word) {
                copy.data.scores = copy.data.scores || {};
                copy.data.scores[deviceId] = (copy.data.scores[deviceId] || 0) + 1;
            }
            
            const allAnswered = copy.players.every(p => copy.data.answered[p.deviceId] !== undefined);
            if (allAnswered) {
                copy.data.currentRound++;
                copy.data.answered = {};
                copy.turnIndex++;
                if (copy.data.currentRound >= copy.data.words.length) {
                    let winner = null;
                    let max = -1;
                    for (const [id, score] of Object.entries(copy.data.scores || {})) {
                        if (score > max) {
                            max = score;
                            winner = copy.players.find(p => p.deviceId === id)?.username;
                        }
                    }
                    copy.winner = winner || "draw";
                    copy.status = "finished";
                }
            }
            await publishGameAndCleanup(game, copy);
        }
    };

    area.appendChild(input);

    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:14px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (game.data.scores?.[p.deviceId] || 0)
    ).join(" · ");
    area.appendChild(scoreDiv);

    return area;
}


/* =====================================================
   MATH RACE
===================================================== */

function createMathRace(game){
    const area = document.createElement("div");
    area.className = "mathrace-area";

    const totalProblems = game.data.settings?.problems || 5;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.problems) {
        const problems = [];
        for (let i = 0; i < totalProblems; i++) {
            const a = Math.floor(Math.random() * 20) + 1;
            const b = Math.floor(Math.random() * 20) + 1;
            const ops = ['+', '-', '*'];
            const op = ops[Math.floor(Math.random() * ops.length)];
            let answer;
            if (op === '+') answer = a + b;
            else if (op === '-') answer = a - b;
            else answer = a * b;
            problems.push({ a, b, op, answer });
        }
        game.data.problems = problems;
        game.data.currentProblem = 0;
        game.data.scores = {};
        game.data.answered = {};
    }

    if (game.data.currentProblem >= game.data.problems.length || game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        let winner = null;
        let max = -1;
        for (const [id, score] of Object.entries(game.data.scores || {})) {
            if (score > max) {
                max = score;
                winner = game.players.find(p => p.deviceId === id)?.username;
            }
        }
        win.textContent = "🏆 " + (winner || "No one") + " wins with " + max + " correct!";
        area.appendChild(win);
        return area;
    }

    const problem = game.data.problems[game.data.currentProblem];
    const answered = game.data.answered || {};

    const problemDiv = document.createElement("div");
    problemDiv.className = "mathrace-problem";
    problemDiv.textContent = `${problem.a} ${problem.op} ${problem.b} = ?`;
    area.appendChild(problemDiv);

    if (!myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for " + current.username + "...";
        area.appendChild(waiting);
        return area;
    }

    const input = document.createElement("input");
    input.className = "mathrace-input";
    input.type = "number";
    input.placeholder = "Answer";
    input.disabled = answered[deviceId] !== undefined;

    input.onkeydown = async (e) => {
        if (e.key === "Enter" && !input.disabled) {
            const guess = parseInt(input.value);
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.answered = copy.data.answered || {};
            copy.data.answered[deviceId] = guess;
            
            if (guess === problem.answer) {
                copy.data.scores = copy.data.scores || {};
                copy.data.scores[deviceId] = (copy.data.scores[deviceId] || 0) + 1;
            }
            
            const allAnswered = copy.players.every(p => copy.data.answered[p.deviceId] !== undefined);
            if (allAnswered) {
                copy.data.currentProblem++;
                copy.data.answered = {};
                copy.turnIndex++;
                if (copy.data.currentProblem >= copy.data.problems.length) {
                    let winner = null;
                    let max = -1;
                    for (const [id, score] of Object.entries(copy.data.scores || {})) {
                        if (score > max) {
                            max = score;
                            winner = copy.players.find(p => p.deviceId === id)?.username;
                        }
                    }
                    copy.winner = winner || "draw";
                    copy.status = "finished";
                }
            }
            await publishGameAndCleanup(game, copy);
        }
    };

    area.appendChild(input);

    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:14px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (game.data.scores?.[p.deviceId] || 0)
    ).join(" · ");
    area.appendChild(scoreDiv);

    return area;
}


/* =====================================================
   TIC-TAC-TOE TOURNAMENT
===================================================== */

function createTTTTournament(game){
    const area = document.createElement("div");
    area.className = "ttt-tournament-area";

    const totalRounds = game.data.settings?.rounds || 3;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.matches) {
        const matches = [];
        const players = game.players;
        for (let round = 0; round < totalRounds; round++) {
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffled.length - 1; i += 2) {
                matches.push({
                    player1: shuffled[i].deviceId,
                    player2: shuffled[i + 1].deviceId,
                    winner: null,
                    round: round,
                    board: Array(9).fill(""),
                    turn: 0
                });
            }
        }
        game.data.matches = matches;
        game.data.currentMatch = 0;
        game.data.scores = {};
    }

    if (game.data.currentMatch >= game.data.matches.length || game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        let winner = null;
        let max = -1;
        for (const [id, score] of Object.entries(game.data.scores || {})) {
            if (score > max) {
                max = score;
                winner = game.players.find(p => p.deviceId === id)?.username;
            }
        }
        win.textContent = "🏆 Tournament Winner: " + (winner || "No one") + " with " + max + " points!";
        area.appendChild(win);
        return area;
    }

    const match = game.data.matches[game.data.currentMatch];
    const p1 = game.players.find(p => p.deviceId === match.player1);
    const p2 = game.players.find(p => p.deviceId === match.player2);

    // Check if current player is in this match
    const inMatch = mine && (deviceId === match.player1 || deviceId === match.player2);
    const myTurnNow = inMatch && ((match.turn % 2 === 0 && deviceId === match.player1) || 
                                   (match.turn % 2 === 1 && deviceId === match.player2));

    // Bracket display
    const bracket = document.createElement("div");
    bracket.className = "ttt-tournament-bracket";
    
    const matchDiv = document.createElement("div");
    matchDiv.className = "ttt-match";
    const player1Name = p1 ? escapeHtml(p1.username) : "Unknown";
    const player2Name = p2 ? escapeHtml(p2.username) : "Unknown";
    const symbol1 = match.turn % 2 === 0 ? "❌" : "⭕";
    const symbol2 = match.turn % 2 === 0 ? "⭕" : "❌";
    
    matchDiv.innerHTML = `
        <div class="match-players">${player1Name} ${symbol1} vs ${symbol2} ${player2Name}</div>
        <div style="font-size:11px;color:#6a7a8a;">Match ${game.data.currentMatch + 1}/${game.data.matches.length}</div>
        <div class="match-result">${match.winner ? '🏆 Winner: ' + (game.players.find(p => p.deviceId === match.winner)?.username || 'Unknown') : '⚔️ In Progress'}</div>
    `;
    bracket.appendChild(matchDiv);
    area.appendChild(bracket);

    if (match.winner) {
        const next = document.createElement("div");
        next.className = "turn-banner";
        next.textContent = "Click to continue to next match";
        area.appendChild(next);
        
        const nextBtn = document.createElement("button");
        nextBtn.className = "game-btn primary";
        nextBtn.textContent = "Next Match →";
        nextBtn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.currentMatch++;
            await publishGameAndCleanup(game, copy);
        };
        area.appendChild(nextBtn);
        return area;
    }

    // Mini Tic-Tac-Toe board for the match
    const board = document.createElement("div");
    board.className = "ttt";
    board.style.gridTemplateColumns = "repeat(3, minmax(0, min(60px, calc((100vw - 118px) / 3))))";
    board.style.gridTemplateRows = "repeat(3, minmax(0, min(60px, calc((100vw - 118px) / 3))))";

    for (let i = 0; i < 9; i++) {
        const button = document.createElement("button");
        button.textContent = match.board[i] || "";
        button.style.fontSize = "clamp(18px, 6vw, 24px)";
        button.disabled = !myTurnNow || !!match.board[i];
        
        button.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            const m = copy.data.matches[copy.data.currentMatch];
            const symbol = m.turn % 2 === 0 ? "❌" : "⭕";
            m.board[i] = symbol;
            
            // Check win
            if (checkTTTWin(m.board, 3, i, symbol, 3)) {
                m.winner = copy.players[m.turn % 2].deviceId;
                copy.data.scores = copy.data.scores || {};
                copy.data.scores[m.winner] = (copy.data.scores[m.winner] || 0) + 3;
                // Check for draw
            } else if (m.board.every(c => c)) {
                // Draw - no points
                m.winner = "draw";
            } else {
                m.turn++;
            }
            await publishGameAndCleanup(game, copy);
        };
        board.appendChild(button);
    }
    area.appendChild(board);

    // Score display
    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:14px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (game.data.scores?.[p.deviceId] || 0) + " pts"
    ).join(" · ");
    area.appendChild(scoreDiv);

    if (!myTurnNow && inMatch) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = "Waiting for the other player...";
        area.appendChild(waiting);
    }

    return area;
}


/* =====================================================
   RPS TOURNAMENT
===================================================== */

function createRPSTournament(game){
    const area = document.createElement("div");
    area.className = "rps-tournament-area";

    const totalRounds = game.data.settings?.rounds || 3;
    const mine = game.players.some(p => p.deviceId === deviceId);
    const current = game.players[game.turnIndex % game.players.length];
    const myTurn = mine && current && current.deviceId === deviceId;

    if (!game.data.matches) {
        const matches = [];
        const players = game.players;
        for (let round = 0; round < totalRounds; round++) {
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffled.length - 1; i += 2) {
                matches.push({
                    player1: shuffled[i].deviceId,
                    player2: shuffled[i + 1].deviceId,
                    winner: null,
                    round: round,
                    choices: {},
                    result: null
                });
            }
        }
        game.data.matches = matches;
        game.data.currentMatch = 0;
        game.data.scores = {};
    }

    if (game.data.currentMatch >= game.data.matches.length || game.winner) {
        const win = document.createElement("div");
        win.className = "turn-banner";
        let winner = null;
        let max = -1;
        for (const [id, score] of Object.entries(game.data.scores || {})) {
            if (score > max) {
                max = score;
                winner = game.players.find(p => p.deviceId === id)?.username;
            }
        }
        win.textContent = "🏆 RPS Tournament Winner: " + (winner || "No one") + " with " + max + " wins!";
        area.appendChild(win);
        return area;
    }

    const match = game.data.matches[game.data.currentMatch];
    const p1 = game.players.find(p => p.deviceId === match.player1);
    const p2 = game.players.find(p => p.deviceId === match.player2);

    // Check if current player is in this match
    const inMatch = mine && (deviceId === match.player1 || deviceId === match.player2);

    // Bracket display
    const bracket = document.createElement("div");
    bracket.className = "rps-tournament-bracket";
    
    const matchDiv = document.createElement("div");
    matchDiv.className = "rps-match";
    const player1Name = p1 ? escapeHtml(p1.username) : "Unknown";
    const player2Name = p2 ? escapeHtml(p2.username) : "Unknown";
    
    matchDiv.innerHTML = `
        <div class="match-players">${player1Name} 🆚 ${player2Name}</div>
        <div style="font-size:11px;color:#6a7a8a;">Match ${game.data.currentMatch + 1}/${game.data.matches.length}</div>
        <div class="match-result">${match.winner ? '🏆 Winner: ' + (game.players.find(p => p.deviceId === match.winner)?.username || 'Unknown') : match.result || '⚔️ In Progress'}</div>
    `;
    bracket.appendChild(matchDiv);
    area.appendChild(bracket);

    if (match.winner) {
        const next = document.createElement("div");
        next.className = "turn-banner";
        next.textContent = "Click to continue to next match";
        area.appendChild(next);
        
        const nextBtn = document.createElement("button");
        nextBtn.className = "game-btn primary";
        nextBtn.textContent = "Next Match →";
        nextBtn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            copy.data.currentMatch++;
            await publishGameAndCleanup(game, copy);
        };
        area.appendChild(nextBtn);
        return area;
    }

    if (!inMatch || !myTurn) {
        const waiting = document.createElement("div");
        waiting.className = "turn-banner";
        waiting.textContent = inMatch ? "Waiting for the other player..." : "Spectating...";
        area.appendChild(waiting);
        return area;
    }

    // RPS choices
    const choices = ["✊ Rock", "✋ Paper", "✌️ Scissors"];
    const choiceValues = ["rock", "paper", "scissors"];
    
    const buttons = document.createElement("div");
    buttons.className = "rps-buttons";
    buttons.style.display = "flex";
    buttons.style.gap = "10px";
    buttons.style.justifyContent = "center";
    buttons.style.margin = "10px 0";

    choices.forEach((label, idx) => {
        const btn = document.createElement("button");
        btn.className = "rps-btn";
        btn.textContent = label;
        btn.style.width = "100px";
        btn.style.height = "60px";
        btn.style.borderRadius = "12px";
        btn.style.border = "1px solid var(--border)";
        btn.style.background = "#1a1f26";
        btn.style.color = "white";
        btn.style.fontSize = "16px";
        btn.style.fontWeight = "700";
        btn.disabled = match.choices[deviceId] !== undefined;
        
        btn.onclick = async () => {
            const copy = JSON.parse(JSON.stringify(game));
            const m = copy.data.matches[copy.data.currentMatch];
            m.choices = m.choices || {};
            m.choices[deviceId] = choiceValues[idx];
            
            // Check if both chose
            if (m.choices[m.player1] && m.choices[m.player2]) {
                const c1 = m.choices[m.player1];
                const c2 = m.choices[m.player2];
                let winner = null;
                
                if (c1 === c2) {
                    m.result = "Draw!";
                } else if (
                    (c1 === "rock" && c2 === "scissors") ||
                    (c1 === "paper" && c2 === "rock") ||
                    (c1 === "scissors" && c2 === "paper")
                ) {
                    m.winner = m.player1;
                    m.result = player1Name + " wins!";
                    copy.data.scores = copy.data.scores || {};
                    copy.data.scores[m.player1] = (copy.data.scores[m.player1] || 0) + 1;
                } else {
                    m.winner = m.player2;
                    m.result = player2Name + " wins!";
                    copy.data.scores = copy.data.scores || {};
                    copy.data.scores[m.player2] = (copy.data.scores[m.player2] || 0) + 1;
                }
            }
            await publishGameAndCleanup(game, copy);
        };
        buttons.appendChild(btn);
    });
    area.appendChild(buttons);

    // Score display
    const scoreDiv = document.createElement("div");
    scoreDiv.style.cssText = "color:#9da5b0;margin-top:10px;font-size:14px;";
    scoreDiv.textContent = game.players.map(p => 
        escapeHtml(p.username) + ": " + (game.data.scores?.[p.deviceId] || 0) + " wins"
    ).join(" · ");
    area.appendChild(scoreDiv);

    return area;
}


