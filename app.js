/* =====================================================
   CONFIG
===================================================== */

const API_URL="/api/messages";
const CHANNEL="general";

const GAME_PREFIX="__CHAT_GAME_STATE__:";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_VOICE_BYTES = 5 * 1024 * 1024;


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
            const recorder=mediaRecorder;
            mediaRecorder=null;
            stopVoiceStream();
            if(blob.size>MAX_VOICE_BYTES){
                alert("Voice message is too large. Please record a shorter message.");
                return;
            }
            if(blob.size<1000)return;
            const ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";
            pendingFiles.push({
                name:`Voice message.${ext}`,
                data:await blobToDataURL(blob),
                size:blob.size,
                type,
                audio:true,
                base64:true
            });
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

    if(window.crypto && crypto.randomUUID){
        deviceId=crypto.randomUUID();
    }else{
        deviceId=
            Date.now().toString(36)+
            Math.random().toString(36).slice(2);
    }

    localStorage.setItem(
        "chat_device_id",
        deviceId
    );
}


/* =====================================================
   SETTINGS
===================================================== */

const defaults={

    username:"",
    refreshRate:500,

    showTimestamps:true,

    textSize:16,
    wordSpacing:0,
    lineSpacing:1.45,

    cornerRadius:12,
    uiScale:1,

    theme:"dark",

    enterToSend:true,
    autoScroll:true
};

function getSetting(key){

    const value=
        localStorage.getItem(
            "chat_"+key
        );

    if(value===null){
        return defaults[key];
    }

    if(
        value==="true" ||
        value==="false"
    ){
        return value==="true";
    }

    const number=Number(value);

    return Number.isNaN(number)
        ?value
        :number;
}

let settings={};

Object.keys(defaults).forEach(key=>{
    settings[key]=getSetting(key);
});


/* =====================================================
   ELEMENTS
===================================================== */

const messagesEl=
    document.getElementById("messages");

const messageInput=
    document.getElementById("messageInput");

const sendBtn=
    document.getElementById("sendBtn");

const attachBtn=
    document.getElementById("attachBtn");

const fileInput=
    document.getElementById("fileInput");

const filePreview=
    document.getElementById("filePreview");

const gamesBtn=
    document.getElementById("gamesBtn");

const gamesOverlay=
    document.getElementById("gamesOverlay");

const closeGames=
    document.getElementById("closeGames");

const settingsBtn=
    document.getElementById("settingsBtn");

const settingsOverlay=
    document.getElementById("settingsOverlay");

const closeSettings=
    document.getElementById("closeSettings");

const saveSettings=
    document.getElementById("saveSettings");

const usernameInput=
    document.getElementById("usernameInput");

const deviceIdInput=
    document.getElementById("deviceIdInput");

const refreshRate=
    document.getElementById("refreshRate");

const showTimestamps=
    document.getElementById("showTimestamps");

const themeSelect=
    document.getElementById("themeSelect");

const textSize=
    document.getElementById("textSize");

const wordSpacing=
    document.getElementById("wordSpacing");

const lineSpacing=
    document.getElementById("lineSpacing");

const cornerRadius=
    document.getElementById("cornerRadius");

const uiScale=
    document.getElementById("uiScale");

const enterToSend=
    document.getElementById("enterToSend");

const autoScroll=
    document.getElementById("autoScroll");

const textSizeValue=
    document.getElementById("textSizeValue");

const wordSpacingValue=
    document.getElementById("wordSpacingValue");

const lineSpacingValue=
    document.getElementById("lineSpacingValue");

const cornerRadiusValue=
    document.getElementById("cornerRadiusValue");

const uiScaleValue=
    document.getElementById("uiScaleValue");

const confirmOverlay=
    document.getElementById("confirmOverlay");

const confirmTitle=
    document.getElementById("confirmTitle");

const confirmText=
    document.getElementById("confirmText");

const confirmCancel=
    document.getElementById("confirmCancel");

const confirmYes=
    document.getElementById("confirmYes");

const removeEverything=
    document.getElementById("removeEverything");


/* =====================================================
   LOCAL STATE
===================================================== */

let currentMessages=[];
let games=[];
let refreshTimer=null;
// Local stop tombstones prevent stale UI/game callbacks from creating new invisible state messages.
const stoppedGames = new Set();
let syncing=false;
let confirmCallback=null;
let renderedElements=new Map();
let renderedData=new Map();
let seenMessageIds=new Set();
let seenGameIds=new Set();
let profiles={};

// File state - array of {name, data, size, type}
let pendingFiles=[];


/* =====================================================
   GAME HELPERS
===================================================== */

async function joinGame(game){
    if (!game?.id || stoppedGames.has(game.id)) return;
    if (game.status !== "lobby") return;
    if (game.players.some(p => p.deviceId === deviceId)) return;
    if (game.players.length >= game.maxPlayers) return;

    const copy = JSON.parse(JSON.stringify(game));
    copy.players.push({ deviceId, username: getDisplayName(deviceId, settings.username) });
    await writeGameState(copy);
    await loadMessages();
}

async function leaveGame(game){
    if (!game?.id || stoppedGames.has(game.id)) return;
    stoppedGames.add(game.id);
    hideGameImmediately(game);

    try {
        await apiPost({
            game_server: true,
            game_action: "leave",
            game_id: game.id,
            channel: CHANNEL,
            device_id: deviceId
        });
    } catch (error) {
        console.warn("Could not leave game on server:", error);
    }

    await loadMessages();
}

async function startGame(game){
    if (!game?.id || stoppedGames.has(game.id)) return;
    if (game.hostDeviceId !== deviceId) return;
    if (game.players.length < (game.minPlayers || 2)) return;

    const copy = JSON.parse(JSON.stringify(game));
    copy.status = "playing";
    copy.turnIndex = 0;
    
    const settings = copy.data.settings || {};

    if (copy.gameType === "hangman") {
        const word = String(settings.word || "").trim().toUpperCase().replace(/[^A-ZÆØÅ]/g, "");
        if (word.length < 2) {
            alert("Choose a word before starting Hangman.");
            return;
        }
        copy.data.word = word;
        copy.data.guessed = [];
        copy.data.attempts = 6;
        copy.data.maxAttempts = 6;
        copy.data.status = "playing";
        copy.data.winnerDeviceId = null;
        copy.data.winnerName = null;
    }
    
    // Initialize Battleship
    if (copy.gameType === "battleship") {
        copy.data.phase = "placement";
        copy.data.placements = {};
        copy.data.ships = [
            { name:"Carrier", icon:"🚢", size:5 },
            { name:"Battleship", icon:"🚢", size:4 },
            { name:"Destroyer", icon:"🚤", size:3 },
            { name:"Submarine", icon:"🚤", size:3 },
            { name:"Patrol Boat", icon:"🚤", size:2 }
        ];
        copy.data.turnIndex = 0;
        copy.data.winnerDeviceId = null;
        copy.data.lastAction = null;
    }

    // Initialize game data
    if (copy.gameType === "ttt3" || copy.gameType === "ttt4" || copy.gameType === "ttt5" || copy.gameType === "ttt6") {
        const size = settings.boardSize || 3;
        copy.data.board = Array(size * size).fill("");
    }
    if (copy.gameType === "memory") {
        const gridSize = settings.gridSize || 4;
        const emojis = ["🍎","🍊","🍋","🍇","🍉","🍓","🍑","🍒","🥝","🍍","🥭","🍌","🍈","🫐","🍐","🥥","🧸","🎈","🎀","🎁","🌟","🌈","🦄","🐉","🐱","🐶","🐰","🦊","🐼","🐨"];
        const pairs = (gridSize * gridSize) / 2;
        let cards = [...emojis.slice(0, pairs), ...emojis.slice(0, pairs)];
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        copy.data.cards = cards;
        copy.data.flipped = [];
        copy.data.matched = [];
        copy.data.scores = {};
    }
    if (copy.gameType === "quickdraw") {
        copy.data.state = "waiting";
        copy.data.round = 0;
        copy.data.results = {};
        copy.data.startTime = 0;
        copy.data.drawTime = 0;
    }
    if (copy.gameType === "coinflip") {
        copy.data.state = "waiting";
        copy.data.choices = {};
        copy.data.scores = {};
        copy.data.coinResult = null;
    }
    if (copy.gameType === "numberguess") {
        const maxNum = settings.maxNumber || 100;
        copy.data.secretNumber = Math.floor(Math.random() * maxNum) + 1;
        copy.data.guesses = [];
        copy.data.hint = "🔢 Guess a number between 1 and " + maxNum;
    }
    if (copy.gameType === "target") {
        copy.data.state = "waiting";
        copy.data.hits = 0;
        copy.data.total = 0;
        copy.data.startTime = 0;
        copy.data.results = {};
        copy.data.targets = [];
        copy.data.targetIndex = 0;
        copy.data.totalTargets = settings.targets || 5;
    }
    if (copy.gameType === "reaction") {
        copy.data.state = "waiting";
        copy.data.startTime = 0;
        copy.data.results = {};
        copy.data.goTime = 0;
    }
    if (copy.gameType === "type") {
        const sentences = [
            "The quick brown fox jumps over the lazy dog.",
            "Pack my box with five dozen liquor jugs.",
            "How vexingly quick daft zebras jump.",
            "The five boxing wizards jump quickly.",
            "Jazz and swing fans like fast music.",
            "Crazy Fredericka bought many very exquisite opal jewels.",
            "We promptly judged antique ivory buckles for the next prize."
        ];
        copy.data.sentence = sentences[Math.floor(Math.random() * sentences.length)];
        copy.data.startTime = 0;
        copy.data.results = {};
        copy.data.done = false;
    }
    if (copy.gameType === "boss") {
        const maxHealth = settings.bossHealth || 100000000;
        copy.data.bossHealth = maxHealth;
        copy.data.maxHealth = maxHealth;
        copy.data.damage = 1;
        copy.data.upgrades = {};
        copy.data.totalDamageDealt = {};
        copy.data.bossDefeated = false;
        copy.data.critChance = 0;
        copy.data.multiHit = 1;
        const names = ["Cthulhu", "Mega Dragon", "Shadow Lord", "Void Beast", "Eldritch Horror", "Demon King"];
        copy.data.monsterName = names[Math.floor(Math.random() * names.length)];
    }
    if (copy.gameType === "trivia") {
        const questions = [
            { q: "What is the capital of France?", options: ["London", "Paris", "Berlin", "Madrid"], answer: 1 },
            { q: "What is 2 + 2?", options: ["3", "4", "5", "6"], answer: 1 },
            { q: "What color is the sky on a clear day?", options: ["Green", "Red", "Blue", "Yellow"], answer: 2 },
            { q: "What is the largest planet?", options: ["Earth", "Mars", "Jupiter", "Saturn"], answer: 2 },
            { q: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Horse", "Dog"], answer: 1 },
            { q: "How many continents?", options: ["5", "6", "7", "8"], answer: 2 },
            { q: "Boiling point of water?", options: ["90°C", "100°C", "110°C", "120°C"], answer: 1 },
            { q: "Square root of 144?", options: ["10", "11", "12", "13"], answer: 2 }
        ];
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        const count = settings.questions || 5;
        copy.data.questions = shuffled.slice(0, Math.min(count, shuffled.length));
        copy.data.currentQuestion = 0;
        copy.data.scores = {};
        copy.data.answered = {};
    }
    if (copy.gameType === "wordscramble") {
        const words = ["apple", "banana", "cherry", "dragon", "eagle", "forest", "garden", "honey", "island", "joker", "kingdom", "lunar", "magic", "nature", "ocean", "planet", "queen", "rabbit", "spirit", "tiger", "unique", "vortex", "whale", "yellow", "zebra"];
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const count = settings.rounds || 5;
        copy.data.words = shuffled.slice(0, Math.min(count, shuffled.length));
        copy.data.currentRound = 0;
        copy.data.scores = {};
        copy.data.answered = {};
    }
    if (copy.gameType === "mathrace") {
        const problems = [];
        const count = settings.problems || 5;
        for (let i = 0; i < count; i++) {
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
        copy.data.problems = problems;
        copy.data.currentProblem = 0;
        copy.data.scores = {};
        copy.data.answered = {};
    }
    if (copy.gameType === "ttttournament") {
        const matches = [];
        const players = copy.players;
        const rounds = settings.rounds || 3;
        for (let round = 0; round < rounds; round++) {
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
        copy.data.matches = matches;
        copy.data.currentMatch = 0;
        copy.data.scores = {};
    }
    if (copy.gameType === "rpstournament") {
        const matches = [];
        const players = copy.players;
        const rounds = settings.rounds || 3;
        for (let round = 0; round < rounds; round++) {
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
        copy.data.matches = matches;
        copy.data.currentMatch = 0;
        copy.data.scores = {};
    }
    
    await publishGameAndCleanup(game, copy);
}

function hideGameImmediately(game){
    const gameId = game?.id;
    if (!gameId) return;

    currentMessages = currentMessages.filter(message => {
        if (!isGameMessage(message)) return true;
        const state = parseGameMessage(message);
        return !state || state.id !== gameId;
    });

    games = games.filter(g => g.id !== gameId);

    const element = document.querySelector(
        '[data-id="game_' + CSS.escape(gameId) + '"]'
    );

    if (element) element.remove();

    renderedElements.delete('game_' + gameId);
    renderedData.delete('game_' + gameId);
    seenGameIds.delete(gameId);
    renderMessages(false);
}

async function forceEndGame(game, options = {}){
    if (!game?.id) return;

    const gameId = game.id;
    const hostDeviceId = game.hostDeviceId || deviceId;

    stoppedGames.add(gameId);
    hideGameImmediately(game);

    const cleanup = async (keepalive = false) => {
        try {
            await fetch(API_URL, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({
                    game_server: true,
                    game_action: "stop",
                    game_id: gameId,
                    channel: CHANNEL,
                    device_id: hostDeviceId
                }),
                keepalive
            });
        } catch {}

        try {
            await fetch(API_URL, {
                method: "DELETE",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({
                    game_server: true,
                    game_id: gameId,
                    channel: CHANNEL,
                    device_id: hostDeviceId
                }),
                keepalive
            });
        } catch {}

        hideGameImmediately({id: gameId});
    };

    await cleanup(Boolean(options.keepalive));

    const delays = [100, 250, 500, 1000];

    for (const delay of delays) {
        setTimeout(() => {
            if (!stoppedGames.has(gameId)) return;
            cleanup(false);
        }, delay);
    }

    setTimeout(() => {
        if (!stoppedGames.has(gameId)) return;
        loadMessages().catch(() => {});
    }, 1100);
}

async function forceQuitGame(game){
    if (!game?.id || game.hostDeviceId !== deviceId) return;
    await forceEndGame(game);
}

async function stopGameOnExit(game){
    if (!game?.id) return;

    if (game.hostDeviceId === deviceId) {
        stoppedGames.add(game.id);
        hideGameImmediately(game);

        try {
            await fetch(API_URL, {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({
                    game_server:true,
                    game_action:"stop",
                    game_id:game.id,
                    channel:CHANNEL,
                    device_id:deviceId
                }),
                keepalive:true
            });
        } catch {}

        try {
            await fetch(API_URL, {
                method: "DELETE",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({
                    game_server:true,
                    game_id:game.id,
                    channel:CHANNEL,
                    device_id:deviceId
                }),
                keepalive:true
            });
        } catch {}

        return;
    }

    stoppedGames.add(game.id);

    try {
        await fetch(API_URL, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
                game_server:true,
                game_action:"leave",
                game_id:game.id,
                channel:CHANNEL,
                device_id:deviceId
            }),
            keepalive:true
        });
    } catch {}
}

async function publishGameAndCleanup(oldGame, newGame){
    if (!oldGame?.id || stoppedGames.has(oldGame.id)) return;

    if (newGame.status === "finished" || newGame.status === "forcequit") {
        await forceEndGame(oldGame);
        return;
    }

    if (stoppedGames.has(oldGame.id)) return;

    await writeGameState(newGame);

    if (oldGame.messageId && !stoppedGames.has(oldGame.id)) {
        try {
            await apiDelete({
                game_server:true,
                id:oldGame.messageId,
                device_id:oldGame.hostDeviceId
            });
        } catch {}
    }

    await loadMessages();
}

window.addEventListener("pagehide", () => {
    for (const game of [...games]) {
        if (game.players?.some(p => p.deviceId === deviceId)) {
            stopGameOnExit(game);
        }
    }
});

function restartRefresh(){
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadMessages, 500);
}

function openConfirm(title, text, callback){
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmCallback = callback;
    confirmOverlay.classList.add("show");
}

confirmCancel.onclick = () => {
    confirmOverlay.classList.remove("show");
    confirmCallback = null;
};

confirmYes.onclick = async () => {
    const callback = confirmCallback;
    confirmOverlay.classList.remove("show");
    confirmCallback = null;
    if (callback) {
        try { await callback(); } 
        catch(error) { alert(error.message); }
    }
};

removeEverything.onclick = () => {
    openConfirm("Remove everything?", "This permanently removes every message from the chat.", async () => {
        try {
            await apiDelete({ delete_all: true });
            currentMessages = [];
            games = [];
            renderedElements.clear();
            renderedData.clear();
            seenMessageIds.clear();
            seenGameIds.clear();
            renderMessages();
        } catch(error) {
            alert("Failed to wipe chat:\n\n" + error.message);
        }
    });
};

function formatTime(date){
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value){
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function playStartupAnimation(){
    const screen = document.getElementById("startupScreen");
    if (!screen) return;

    screen.classList.remove("hide");
    clearTimeout(window.__startupTimer);

    window.__startupTimer = setTimeout(() => {
        screen.classList.add("hide");
    }, 1150);
}

window.addEventListener("pageshow", playStartupAnimation);
playStartupAnimation();

processProfiles();
loadSettingsUI();
applySettings();
loadMessages();

function loadSettingsUI(){
    usernameInput.value = settings.username;
    deviceIdInput.value = deviceId;
    refreshRate.value = settings.refreshRate;
    showTimestamps.value = String(settings.showTimestamps);
    themeSelect.value = settings.theme;
    textSize.value = settings.textSize;
    wordSpacing.value = settings.wordSpacing;
    lineSpacing.value = settings.lineSpacing;
    cornerRadius.value = settings.cornerRadius;
    uiScale.value = settings.uiScale;
    enterToSend.value = String(settings.enterToSend);
    autoScroll.value = String(settings.autoScroll);
    updateRangeLabels();
}

function updateRangeLabels(){
    textSizeValue.textContent = textSize.value + "px";
    wordSpacingValue.textContent = wordSpacing.value + "px";
    lineSpacingValue.textContent = lineSpacing.value;
    cornerRadiusValue.textContent = cornerRadius.value + "px";
    uiScaleValue.textContent = Math.round(Number(uiScale.value) * 100) + "%";
}

function applySettings(){
    document.documentElement.style.setProperty("--text-size", settings.textSize + "px");
    document.documentElement.style.setProperty("--word-spacing", settings.wordSpacing + "px");
    document.documentElement.style.setProperty("--line-spacing", settings.lineSpacing);
    document.documentElement.style.setProperty("--radius", settings.cornerRadius + "px");
    document.documentElement.style.setProperty("--ui-scale", settings.uiScale);
    applyTheme(settings.theme);
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
    const t = themes[name] || themes.dark;
    document.documentElement.style.setProperty("--bg", t[0]);
    document.documentElement.style.setProperty("--panel", t[1]);
    document.body.style.background = t[0];
}

settingsBtn.onclick = () => {
    loadSettingsUI();
    settingsOverlay.classList.add("show");
};

closeSettings.onclick = () => {
    settingsOverlay.classList.remove("show");
};

gamesBtn.onclick = () => {
    gamesOverlay.classList.add("show");
};

const gamesComposerBtn = document.getElementById("gamesComposerBtn");
if (gamesComposerBtn) {
    gamesComposerBtn.onclick = () => {
        gamesOverlay.classList.add("show");
    };
}

closeGames.onclick = () => {
    gamesOverlay.classList.remove("show");
};

saveSettings.onclick = () => {
    settings.username = usernameInput.value.trim().substring(0, 24);
    settings.refreshRate = Number(refreshRate.value);
    settings.showTimestamps = showTimestamps.value === "true";
    settings.theme = themeSelect.value;
    settings.textSize = Number(textSize.value);
    settings.wordSpacing = Number(wordSpacing.value);
    settings.lineSpacing = Number(lineSpacing.value);
    settings.cornerRadius = Number(cornerRadius.value);
    settings.uiScale = Number(uiScale.value);
    settings.enterToSend = enterToSend.value === "true";
    settings.autoScroll = autoScroll.value === "true";

    Object.keys(settings).forEach(key => {
        localStorage.setItem("chat_" + key, settings[key]);
    });

    publishProfile().catch(error => console.warn("Profile update failed:", error));
    applySettings();
    settingsOverlay.classList.remove("show");
};

document.querySelectorAll(".category-title").forEach(button => {
    button.onclick = () => {
        button.parentElement.classList.toggle("open");
    };
});

[textSize, wordSpacing, lineSpacing, cornerRadius, uiScale].forEach(input => {
    input.addEventListener("input", updateRangeLabels);
});

function isProfileMessage(message){
    return message && message.username === "__PROFILE__";
}

function parseProfileMessage(message){
    if(!isProfileMessage(message)) return null;
    try{ return JSON.parse(message.message || "{}"); }catch{ return null; }
}

function processProfiles(){
    const map={};
    for(const message of currentMessages){
        const profile = parseProfileMessage(message);
        if(!profile || !profile.deviceId) continue;

        const updatedAt = Number(profile.updatedAt || message.created_at || 0);
        const previous = map[profile.deviceId];

        if(!previous || updatedAt >= Number(previous.updatedAt || 0)){
            map[profile.deviceId]={
                name: String(profile.name || "User").slice(0, 24),
                updatedAt
            };
        }
    }
    profiles = map;
    renderedElements.clear();
    renderedData.clear();
}

function getDisplayName(id, fallback="User"){
    return profiles[id]?.name || fallback || "User";
}

async function publishProfile(){
    const profile = {
        type: "profile",
        deviceId,
        name: settings.username || "User",
        updatedAt: Date.now()
    };

    await apiPost({
        username: "__PROFILE__",
        channel: CHANNEL,
        message: JSON.stringify(profile),
        image: null,
        files: [],
        device_id: deviceId
    });

    profiles[deviceId] = {
        name: profile.name,
        updatedAt: profile.updatedAt
    };

    renderMessages(false);
}

sendBtn.onclick = sendChatMessage;

messageInput.addEventListener("keydown", event => {
    if(event.key === "Enter" && !event.shiftKey && settings.enterToSend){
        event.preventDefault();
        sendChatMessage();
    }
});

messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
});

async function sendChatMessage(){
    const text = messageInput.value.trim();
    const files = pendingFiles.length ? [...pendingFiles] : [];

    if(!text && !files.length) return;

    if(!settings.username){
        settingsBtn.click();
        alert("Set your name in Settings first.");
        return;
    }

    sendBtn.disabled = true;

    try{
        await apiPost({
            username: "__USER__",
            channel: CHANNEL,
            message: text || '',
            image: null,
            files: files,
            device_id: deviceId
        });

        messageInput.value = "";
        messageInput.style.height = "auto";
        pendingFiles = [];
        renderFilePreview();

        await loadMessages();
    }catch(error){
        alert("Failed to send:\n\n" + error.message);
    }finally{
        sendBtn.disabled = false;
    }
}

async function apiPost(body){
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await safeJson(response);
    if(!response.ok){
        throw new Error(data.error || "Request failed.");
    }
    return data;
}

async function apiDelete(body){
    const response = await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await safeJson(response);
    if(!response.ok){
        throw new Error(data.error || "Delete failed.");
    }
    return data;
}

async function apiPatch(body){
    const response = await fetch(API_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await safeJson(response);
    if(!response.ok){
        throw new Error(data.error || "Update failed.");
    }
    return data;
}

async function safeJson(response){
    const text = await response.text();
    if(!text) return {};
    try{
        return JSON.parse(text);
    }catch{
        return { error: text };
    }
}

async function loadMessages(){
    if(syncing) return;
    syncing = true;

    try{
        const response = await fetch(
            API_URL + "?channel=" + encodeURIComponent(CHANNEL) + "&_=" + Date.now(),
            { cache: "no-store" }
        );
        const data = await safeJson(response);

        if(!response.ok){
            throw new Error(data.error || "Failed to load messages.");
        }

        const newMessages = Array.isArray(data.messages) ? data.messages : [];
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
        if(!currentMessages.length){
            messagesEl.innerHTML=`
                <div class="empty">
                    <div>
                        <strong>Unable to load messages</strong>
                        ${escapeHtml(error.message)}
                    </div>
                </div>
            `;
        }
    }finally{
        syncing = false;
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

function isGameMessage(message){
    return (
        message &&
        typeof message.message==="string" &&
        message.message.startsWith(GAME_PREFIX)
    );
}

function parseGameMessage(message){
    if(!isGameMessage(message)){
        return null;
    }
    try{
        return JSON.parse(message.message.substring(GAME_PREFIX.length));
    }catch{
        return null;
    }
}

function processGameMessages(){
    const map=new Map();

    for(const message of currentMessages){
        if(!isGameMessage(message)) continue;

        const state = parseGameMessage(message);
        if(!state) continue;
        if(state.type !== "game") continue;

        if (stoppedGames.has(state.id)) continue;

        map.set(
            state.id,
            {
                ...state,
                messageId: message.id,
                hostDeviceId: state.hostDeviceId || message.device_id || ""
            }
        );
    }

    games = [...map.values()];
}

function renderMessages(shouldAutoScroll){
    const normal = currentMessages.filter(message => !isGameMessage(message) && !isProfileMessage(message));
    const activeGames = games.filter(game => game.status !== "finished" && game.status !== "forcequit");

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

function createMessageElement(message) {
    const item = document.createElement("div");
    item.className = "message";
    item.dataset.id = 'msg_' + message.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    const profileName = getDisplayName(message.device_id, message.username === "__USER__" ? "User" : message.username);
    avatar.textContent = profileName.charAt(0).toUpperCase();

    const content = document.createElement("div");
    content.className = "message-content";

    const top = document.createElement("div");
    top.className = "message-top";

    const name = document.createElement("span");
    name.className = "username";
    name.textContent = profileName;

    top.appendChild(name);

    if (settings.showTimestamps) {
        const time = document.createElement("span");
        time.className = "time";
        time.textContent = formatTime(message.created_at);
        top.appendChild(time);
    }

    if (message.edited) {
        const edited = document.createElement("span");
        edited.className = "edited";
        edited.textContent = "(edited)";
        top.appendChild(edited);
    }

    content.appendChild(top);

    if (message.message) {
        const text = document.createElement("div");
        text.className = "message-text";
        text.textContent = message.message;
        content.appendChild(text);
    }

    if (message.image) {
        const img = document.createElement("img");
        img.className = "message-image";
        img.src = message.image;
        img.alt = "Image";
        img.onclick = () => { window.open(message.image, '_blank'); };
        content.appendChild(img);
    }

    if (message.files && Array.isArray(message.files) && message.files.length) {
        const fileList = document.createElement("div");
        fileList.className = "file-list";

        message.files.forEach(file => {
            const type = file.type || '';
            const isImage = file.image === true || type.startsWith('image/') || (typeof file.data === 'string' && file.data.startsWith('data:image/'));

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
                            <head><title>${escapeHtml(file.name || 'Image')}</title></head>
                            <body style="margin:0;min-height:100vh;background:#111;display:grid;place-items:center;">
                                <img src="${file.data}" style="max-width:100vw;max-height:100vh;object-fit:contain;">
                            </body>
                            </html>
                        `);
                        viewer.document.close();
                    }
                };
                content.appendChild(img);
                return;
            }

            const isAudio = file.audio === true || type.startsWith('audio/') || (typeof file.data === 'string' && file.data.startsWith('data:audio/'));
            if (isAudio && file.data) {
                const audioWrap = document.createElement("div");
                audioWrap.className = "message-audio";
                const audio = document.createElement("audio");
                audio.src = file.data;
                audio.controls = true;
                audio.preload = "metadata";
                audioWrap.appendChild(audio);
                content.appendChild(audioWrap);
                return;
            }

            const isVideo = file.video === true || type.startsWith('video/') || (typeof file.data === 'string' && file.data.startsWith('data:video/'));
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

            const fileEl = document.createElement("div");
            fileEl.className = "message-file";

            const icon = document.createElement("span");
            icon.className = "file-icon";
            icon.textContent = getFileIcon(type, file.name || 'file');

            const info = document.createElement("div");
            info.className = "file-info";

            const nameEl = document.createElement("div");
            nameEl.className = "file-name";
            nameEl.textContent = file.name || 'Unknown file';

            const sizeEl = document.createElement("div");
            sizeEl.className = "file-size";
            sizeEl.textContent = file.size ? formatFileSize(file.size) : '';

            info.appendChild(nameEl);
            info.appendChild(sizeEl);

            fileEl.appendChild(icon);
            fileEl.appendChild(info);

            fileEl.onclick = () => {
                if (file.data) {
                    const a = document.createElement('a');
                    a.href = file.data;
                    a.download = file.name || 'download';
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

document.querySelectorAll(".game-choice").forEach(button => {
    button.onclick = () => {
        createGame(button.dataset.game);
    };
});

async function createGame(gameType){
    if(!settings.username){
        settingsBtn.click();
        alert("Set your name before creating a game.");
        return;
    }

    const existing = games.find(
        game => game.hostDeviceId === deviceId && game.status !== "finished" && game.status !== "forcequit"
    );

    if(existing){
        alert("You are already hosting a game.");
        gamesOverlay.classList.remove("show");
        return;
    }

    const info = GAME_TYPES[gameType];
    if(!info) return;

    const game = {
        type: "game",
        id: "game_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8),
        gameType,
        name: info.name,
        icon: info.icon,
        host: getDisplayName(deviceId, settings.username),
        hostDeviceId: deviceId,
        status: "lobby",
        players: [{ deviceId, username: getDisplayName(deviceId, settings.username) }],
        maxPlayers: info.max,
        minPlayers: info.min,
        turnIndex: 0,
        createdAt: Date.now(),
        board: [],
        winner: null,
        data: { settings: getDefaultSettings(gameType) }
    };

    if (info.size) {
        game.data.settings.boardSize = info.size;
    }

    try{
        await writeGameState(game);
        gamesOverlay.classList.remove("show");
        await loadMessages();
    }catch(error){
        alert("Could not create game:\n\n" + error.message);
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

async function writeGameState(game){
    if (!game?.id || stoppedGames.has(game.id)) {
        return false;
    }

    const payload = GAME_PREFIX + JSON.stringify(game);

    await apiPost({
        game_server: true,
        username: "__GAME_SERVER__",
        channel: CHANNEL,
        message: payload,
        device_id: game.hostDeviceId
    });

    return true;
}

function createGameElement(game){
    const wrapper = document.createElement("div");
    wrapper.className = "game-message";
    wrapper.dataset.id = 'game_' + game.id;

    const card = document.createElement("div");
    card.className = "game-card";

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

    const body = document.createElement("div");
    body.className = "game-body";

    const info = document.createElement("div");
    info.className = "game-info";
    info.innerHTML = `
        <div class="game-pill">Host: <strong>${escapeHtml(getDisplayName(game.hostDeviceId, game.host))}</strong></div>
        <div class="game-pill">Players: <strong>${game.players.length}/${game.maxPlayers}</strong></div>
        <div class="game-pill">Min Players: <strong>${game.minPlayers || 2}</strong></div>
    `;
    body.appendChild(info);

    const desc = document.createElement("div");
    desc.className = "game-description";
    desc.textContent = game.status === "lobby" ? "Join before the host starts. Everyone else can spectate." : getGameDescription(game);
    body.appendChild(desc);

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

    if (game.status === "lobby" && game.hostDeviceId === deviceId) {
        const settingsDiv = document.createElement("div");
        settingsDiv.className = "game-settings";
        settingsDiv.innerHTML = `<h4>⚙️ Game Settings (Host only)</h4>`;
        settingsDiv.appendChild(createSettingsUI(game));
        body.appendChild(settingsDiv);
    }

    if (game.status === "playing") {
        const turn = document.createElement("div");
        turn.className = "turn-banner";
        const current = game.players[game.turnIndex % Math.max(game.players.length, 1)];
        if (current) {
            turn.innerHTML = "Current turn: <strong>" + escapeHtml(getDisplayName(current.deviceId, current.username)) + "</strong>";
        }
        body.appendChild(turn);
    }

    const board = createGameBoard(game);
    if (board) body.appendChild(board);

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
