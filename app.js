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

        const mimeTypes=[
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg;codecs=opus"
        ];

        const mime=mimeTypes.find(
            t=>MediaRecorder.isTypeSupported(t)
        ) || "";

        mediaRecorder=new MediaRecorder(
            voiceStream,
            mime ? {mimeType:mime} : undefined
        );

        voiceChunks=[];
        voiceStartedAt=Date.now();

        voiceBtn.classList.add("recording");
        voiceStatus.classList.add("show");

        voiceStatusText.textContent=
            "Recording 0:00 — tap 🎙️ to stop";

        voiceTimer=setInterval(()=>{
            voiceStatusText.textContent=
                `Recording ${formatVoiceTime(
                    Math.floor(
                        (Date.now()-voiceStartedAt)/1000
                    )
                )} — tap 🎙️ to stop`;
        },500);

        mediaRecorder.ondataavailable=e=>{
            if(e.data && e.data.size){
                voiceChunks.push(e.data);
            }
        };

        mediaRecorder.onstop=async()=>{
            const type=
                mediaRecorder.mimeType || "audio/webm";

            const blob=
                new Blob(
                    voiceChunks,
                    {type}
                );

            mediaRecorder=null;

            stopVoiceStream();

            if(blob.size>MAX_VOICE_BYTES){
                alert(
                    "Voice message is too large. Please record a shorter message."
                );
                return;
            }

            if(blob.size<1000){
                return;
            }

            const ext=
                type.includes("mp4")
                    ? "m4a"
                    : type.includes("ogg")
                        ? "ogg"
                        : "webm";

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

        alert(
            "Microphone permission is required to record a voice message."
        );
    }
}

function stopVoiceRecording(){
    if(
        mediaRecorder &&
        mediaRecorder.state!=="inactive"
    ){
        mediaRecorder.stop();
    }
}

voiceBtn.addEventListener(
    "click",
    ()=>{
        mediaRecorder
            ? stopVoiceRecording()
            : startVoiceRecording();
    }
);

let deviceId=
    localStorage.getItem("chat_device_id");

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

// Local stop tombstones prevent stale UI/game callbacks
// from creating new invisible state messages.
const stoppedGames = new Set();

let syncing=false;
let confirmCallback=null;
let renderedElements=new Map();
let renderedData=new Map();
let seenMessageIds=new Set();
let seenGameIds=new Set();

// File state - array of
// {name, data, size, type}
let pendingFiles=[];


/* =====================================================
   GAME HELPERS
===================================================== */

async function joinGame(game){

    if(
        !game?.id ||
        stoppedGames.has(game.id)
    ){
        return;
    }

    if(game.status!=="lobby"){
        return;
    }

    if(
        game.players.some(
            p=>p.deviceId===deviceId
        )
    ){
        return;
    }

    if(
        game.players.length>=game.maxPlayers
    ){
        return;
    }

    const copy=
        JSON.parse(
            JSON.stringify(game)
        );

    copy.players.push({
        deviceId,
        username:
            getDisplayName(
                deviceId,
                settings.username
            )
    });

    await writeGameState(copy);
    await loadMessages();
}


async function leaveGame(game){

    if(
        !game?.id ||
        stoppedGames.has(game.id)
    ){
        return;
    }

    stoppedGames.add(game.id);
    hideGameImmediately(game);

    try{

        await apiPost({
            game_server:true,
            game_action:"leave",
            game_id:game.id,
            channel:CHANNEL,
            device_id:deviceId
        });

    }catch(error){

        console.warn(
            "Could not leave game on server:",
            error
        );
    }

    await loadMessages();
}


async function startGame(game){

    if(
        !game?.id ||
        stoppedGames.has(game.id)
    ){
        return;
    }

    if(game.hostDeviceId!==deviceId){
        return;
    }

    if(
        game.players.length <
        (game.minPlayers || 2)
    ){
        return;
    }

    const copy=
        JSON.parse(
            JSON.stringify(game)
        );

    copy.status="playing";
    copy.turnIndex=0;

    const settings=
        copy.data.settings || {};


    /* =================================================
       HANGMAN
    ================================================= */

    if(copy.gameType==="hangman"){

        const word=
            String(
                settings.word || ""
            )
            .trim()
            .toUpperCase()
            .replace(
                /[^A-ZÆØÅ]/g,
                ""
            );

        if(word.length<2){

            alert(
                "Choose a word before starting Hangman."
            );

            return;
        }

        copy.data.word=word;
        copy.data.guessed=[];
        copy.data.attempts=6;
        copy.data.maxAttempts=6;
        copy.data.status="playing";
        copy.data.winnerDeviceId=null;
        copy.data.winnerName=null;
    }


    /* =================================================
       BATTLESHIP
    ================================================= */

    if(copy.gameType==="battleship"){

        copy.data.phase="placement";

        copy.data.placements={};

        copy.data.ships=[
            {
                name:"Carrier",
                icon:"🚢",
                size:5
            },
            {
                name:"Battleship",
                icon:"🚢",
                size:4
            },
            {
                name:"Destroyer",
                icon:"🚤",
                size:3
            },
            {
                name:"Submarine",
                icon:"🚤",
                size:3
            },
            {
                name:"Patrol Boat",
                icon:"🚤",
                size:2
            }
        ];

        copy.data.turnIndex=0;
        copy.data.winnerDeviceId=null;
        copy.data.lastAction=null;
    }


    /* =================================================
       TIC TAC TOE
    ================================================= */

    if(
        copy.gameType==="ttt3" ||
        copy.gameType==="ttt4" ||
        copy.gameType==="ttt5" ||
        copy.gameType==="ttt6"
    ){

        const size=
            settings.boardSize || 3;

        copy.data.board=
            Array(
                size*size
            ).fill("");
    }


    /* =================================================
       MEMORY
    ================================================= */

    if(copy.gameType==="memory"){

        const gridSize=
            settings.gridSize || 4;

        const emojis=[
            "🍎","🍊","🍋","🍇",
            "🍉","🍓","🍑","🍒",
            "🥝","🍍","🥭","🍌",
            "🍈","🫐","🍐","🥥",
            "🧸","🎈","🎀","🎁",
            "🌟","🌈","🦄","🐉",
            "🐱","🐶","🐰","🦊",
            "🐼","🐨"
        ];

        const pairs=
            (gridSize*gridSize)/2;

        let cards=[
            ...emojis.slice(
                0,
                pairs
            ),
            ...emojis.slice(
                0,
                pairs
            )
        ];

        for(
            let i=cards.length-1;
            i>0;
            i--
        ){

            const j=
                Math.floor(
                    Math.random()*(i+1)
                );

            [
                cards[i],
                cards[j]
            ]=[
                cards[j],
                cards[i]
            ];
        }

        copy.data.cards=cards;
        copy.data.flipped=[];
        copy.data.matched=[];
        copy.data.scores={};
    }


    /* =================================================
       QUICK DRAW
    ================================================= */

    if(copy.gameType==="quickdraw"){

        copy.data.state="waiting";
        copy.data.round=0;
        copy.data.results={};
        copy.data.startTime=0;
        copy.data.drawTime=0;
    }


    /* =================================================
       COIN FLIP
    ================================================= */

    if(copy.gameType==="coinflip"){

        copy.data.state="waiting";
        copy.data.choices={};
        copy.data.scores={};
        copy.data.coinResult=null;
    }


    /* =================================================
       NUMBER GUESS
    ================================================= */

    if(copy.gameType==="numberguess"){

        const maxNum=
            settings.maxNumber || 100;

        copy.data.secretNumber=
            Math.floor(
                Math.random()*maxNum
            )+1;

        copy.data.guesses=[];

        copy.data.hint=
            "🔢 Guess a number between 1 and "+
            maxNum;
    }


    /* =================================================
       TARGET
    ================================================= */

    if(copy.gameType==="target"){

        copy.data.state="waiting";
        copy.data.hits=0;
        copy.data.total=0;
        copy.data.startTime=0;
        copy.data.results={};
        copy.data.targets=[];
        copy.data.targetIndex=0;
        copy.data.totalTargets=
            settings.targets || 5;
    }


    /* =================================================
       REACTION
    ================================================= */

    if(copy.gameType==="reaction"){

        copy.data.state="waiting";
        copy.data.startTime=0;
        copy.data.results={};
        copy.data.goTime=0;
    }


    /* =================================================
       TYPE
    ================================================= */

    if(copy.gameType==="type"){

        const sentences=[

            "The quick brown fox jumps over the lazy dog.",

            "Pack my box with five dozen liquor jugs.",

            "How vexingly quick daft zebras jump.",

            "The five boxing wizards jump quickly.",

            "Jazz and swing fans like fast music.",

            "Crazy Fredericka bought many very exquisite opal jewels.",

            "We promptly judged antique ivory buckles for the next prize."
        ];

        copy.data.sentence=
            sentences[
                Math.floor(
                    Math.random()*sentences.length
                )
            ];

        copy.data.startTime=0;
        copy.data.results={};
        copy.data.done=false;
    }


    /* =================================================
       BOSS
    ================================================= */

    if(copy.gameType==="boss"){

        const maxHealth=
            settings.bossHealth ||
            100000000;

        copy.data.bossHealth=maxHealth;
        copy.data.maxHealth=maxHealth;
        copy.data.damage=1;
        copy.data.upgrades={};
        copy.data.totalDamageDealt={};
        copy.data.bossDefeated=false;
        copy.data.critChance=0;
        copy.data.multiHit=1;

        const names=[
            "Cthulhu",
            "Mega Dragon",
            "Shadow Lord",
            "Void Beast",
            "Eldritch Horror",
            "Demon King"
        ];

        copy.data.monsterName=
            names[
                Math.floor(
                    Math.random()*names.length
                )
            ];
    }


    /* =================================================
       TRIVIA
    ================================================= */

    if(copy.gameType==="trivia"){

        const questions=[

            {
                q:"What is the capital of France?",
                options:[
                    "London",
                    "Paris",
                    "Berlin",
                    "Madrid"
                ],
                answer:1
            },

            {
                q:"What is 2 + 2?",
                options:[
                    "3",
                    "4",
                    "5",
                    "6"
                ],
                answer:1
            },

            {
                q:"What color is the sky on a clear day?",
                options:[
                    "Green",
                    "Red",
                    "Blue",
                    "Yellow"
                ],
                answer:2
            },

            {
                q:"What is the largest planet?",
                options:[
                    "Earth",
                    "Mars",
                    "Jupiter",
                    "Saturn"
                ],
                answer:2
            },

            {
                q:"What is the fastest land animal?",
                options:[
                    "Lion",
                    "Cheetah",
                    "Horse",
                    "Dog"
                ],
                answer:1
            },

            {
                q:"How many continents?",
                options:[
                    "5",
                    "6",
                    "7",
                    "8"
                ],
                answer:2
            },

            {
                q:"Boiling point of water?",
                options:[
                    "90°C",
                    "100°C",
                    "110°C",
                    "120°C"
                ],
                answer:1
            },

            {
                q:"Square root of 144?",
                options:[
                    "10",
                    "11",
                    "12",
                    "13"
                ],
                answer:2
            }
        ];

        const shuffled=
            [...questions]
            .sort(
                ()=>Math.random()-0.5
            );

        const count=
            settings.questions || 5;

        copy.data.questions=
            shuffled.slice(
                0,
                Math.min(
                    count,
                    shuffled.length
                )
            );

        copy.data.currentQuestion=0;
        copy.data.scores={};
        copy.data.answered={};
    }


    /* =================================================
       WORD SCRAMBLE
    ================================================= */

    if(copy.gameType==="wordscramble"){

        const words=[
            "apple",
            "banana",
            "cherry",
            "dragon",
            "eagle",
            "forest",
            "garden",
            "honey",
            "island",
            "joker",
            "kingdom",
            "lunar",
            "magic",
            "nature",
            "ocean",
            "planet",
            "queen",
            "rabbit",
            "spirit",
            "tiger",
            "unique",
            "vortex",
            "whale",
            "yellow",
            "zebra"
        ];

        const shuffled=
            [...words]
            .sort(
                ()=>Math.random()-0.5
            );

        const count=
            settings.rounds || 5;

        copy.data.words=
            shuffled.slice(
                0,
                Math.min(
                    count,
                    shuffled.length
                )
            );

        copy.data.currentRound=0;
        copy.data.scores={};
        copy.data.answered={};
    }


    /* =================================================
       MATH RACE
    ================================================= */

    if(copy.gameType==="mathrace"){

        const problems=[];

        const count=
            settings.problems || 5;

        for(
            let i=0;
            i<count;
            i++
        ){

            const a=
                Math.floor(
                    Math.random()*20
                )+1;

            const b=
                Math.floor(
                    Math.random()*20
                )+1;

            const ops=[
                "+",
                "-",
                "*"
            ];

            const op=
                ops[
                    Math.floor(
                        Math.random()*ops.length
                    )
                ];

            let answer;

            if(op==="+"){
                answer=a+b;
            }else if(op==="-"){
                answer=a-b;
            }else{
                answer=a*b;
            }

            problems.push({
                a,
                b,
                op,
                answer
            });
        }

        copy.data.problems=problems;
        copy.data.currentProblem=0;
        copy.data.scores={};
        copy.data.answered={};
    }


    /* =================================================
       TIC TAC TOE TOURNAMENT
    ================================================= */

    if(copy.gameType==="ttttournament"){

        const matches=[];
        const players=copy.players;
        const rounds=
            settings.rounds || 3;

        for(
            let round=0;
            round<rounds;
            round++
        ){

            const shuffled=
                [...players]
                .sort(
                    ()=>Math.random()-0.5
                );

            for(
                let i=0;
                i<shuffled.length-1;
                i+=2
            ){

                matches.push({

                    player1:
                        shuffled[i].deviceId,

                    player2:
                        shuffled[i+1].deviceId,

                    winner:null,

                    round,

                    board:
                        Array(9).fill(""),

                    turn:0
                });
            }
        }

        copy.data.matches=matches;
        copy.data.currentMatch=0;
        copy.data.scores={};
    }


    /* =================================================
       RPS TOURNAMENT
    ================================================= */

    if(copy.gameType==="rpstournament"){

        const matches=[];
        const players=copy.players;
        const rounds=
            settings.rounds || 3;

        for(
            let round=0;
            round<rounds;
            round++
        ){

            const shuffled=
                [...players]
                .sort(
                    ()=>Math.random()-0.5
                );

            for(
                let i=0;
                i<shuffled.length-1;
                i+=2
            ){

                matches.push({

                    player1:
                        shuffled[i].deviceId,

                    player2:
                        shuffled[i+1].deviceId,

                    winner:null,

                    round,

                    choices:{},

                    result:null
                });
            }
        }

        copy.data.matches=matches;
        copy.data.currentMatch=0;
        copy.data.scores={};
    }


    await publishGameAndCleanup(
        game,
        copy
    );
}


function hideGameImmediately(game){

    const gameId=game?.id;

    if(!gameId){
        return;
    }

    currentMessages=
        currentMessages.filter(
            message=>{

                if(!isGameMessage(message)){
                    return true;
                }

                const state=
                    parseGameMessage(message);

                return !state ||
                    state.id!==gameId;
            }
        );

    games=
        games.filter(
            g=>g.id!==gameId
        );

    const element=
        document.querySelector(
            '[data-id="game_' +
            CSS.escape(gameId) +
            '"]'
        );

    if(element){
        element.remove();
    }

    renderedElements.delete(
        "game_"+gameId
    );

    renderedData.delete(
        "game_"+gameId
    );

    seenGameIds.delete(gameId);

    renderMessages(false);
}


/*
 * Hard game cleanup.
 *
 * There is no SQL here. Cleanup uses the existing API DELETE endpoint.
 * The game is blocked locally before deletion starts, so refreshes cannot
 * recreate it while cleanup is running.
 *
 * Multiple cleanup passes cover the case where an old state message arrives
 * again shortly after the first DELETE request.
 */

async function forceEndGame(
    game,
    options={}
){

    if(!game?.id){
        return;
    }

    const gameId=game.id;

    const hostDeviceId=
        game.hostDeviceId ||
        deviceId;

    stoppedGames.add(gameId);

    hideGameImmediately(game);


    const cleanup=async(
        keepalive=false
    )=>{

        try{

            await fetch(
                API_URL,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            game_server:true,
                            game_action:"stop",
                            game_id:gameId,
                            channel:CHANNEL,
                            device_id:hostDeviceId
                        }),

                    keepalive
                }
            );

        }catch{}


        try{

            await fetch(
                API_URL,
                {
                    method:"DELETE",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            game_server:true,
                            game_id:gameId,
                            channel:CHANNEL,
                            device_id:hostDeviceId
                        }),

                    keepalive
                }
            );

        }catch{}


        hideGameImmediately({
            id:gameId
        });
    };


    // Immediate pass.
    await cleanup(
        Boolean(options.keepalive)
    );


    // Repeated passes during the first second.
    const delays=[
        100,
        250,
        500,
        1000
    ];

    for(
        const delay of delays
    ){

        setTimeout(
            ()=>{
                if(
                    !stoppedGames.has(gameId)
                ){
                    return;
                }

                cleanup(false);
            },
            delay
        );
    }


    // Refresh once after cleanup window.
    setTimeout(
        ()=>{
            if(
                !stoppedGames.has(gameId)
            ){
                return;
            }

            loadMessages()
                .catch(()=>{});
        },
        1100
    );
}


async function forceQuitGame(game){

    if(
        !game?.id ||
        game.hostDeviceId!==deviceId
    ){
        return;
    }

    await forceEndGame(game);
}


async function stopGameOnExit(game){

    if(!game?.id){
        return;
    }


    // Host leaving ends the entire game.

    if(game.hostDeviceId===deviceId){

        stoppedGames.add(
            game.id
        );

        hideGameImmediately(
            game
        );

        try{

            await fetch(
                API_URL,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            game_server:true,
                            game_action:"stop",
                            game_id:game.id,
                            channel:CHANNEL,
                            device_id:deviceId
                        }),

                    keepalive:true
                }
            );

        }catch{}


        try{

            await fetch(
                API_URL,
                {
                    method:"DELETE",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            game_server:true,
                            game_id:game.id,
                            channel:CHANNEL,
                            device_id:deviceId
                        }),

                    keepalive:true
                }
            );

        }catch{}

        return;
    }


    // Normal player leaving.

    stoppedGames.add(
        game.id
    );

    try{

        await fetch(
            API_URL,
            {
                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        game_server:true,
                        game_action:"leave",
                        game_id:game.id,
                        channel:CHANNEL,
                        device_id:deviceId
                    }),

                keepalive:true
            }
        );

    }catch{}
}


async function publishGameAndCleanup(
    oldGame,
    newGame
){

    if(
        !oldGame?.id ||
        stoppedGames.has(oldGame.id)
    ){
        return;
    }

    if(
        newGame.status==="finished" ||
        newGame.status==="forcequit"
    ){

        await forceEndGame(
            oldGame
        );

        return;
    }


    // Never publish a new state after game stopped.

    if(
        stoppedGames.has(
            oldGame.id
        )
    ){
        return;
    }

    await writeGameState(
        newGame
    );


    if(
        oldGame.messageId &&
        !stoppedGames.has(oldGame.id)
    ){

        try{

            await apiDelete({
                game_server:true,
                id:oldGame.messageId,
                device_id:oldGame.hostDeviceId
            });

        }catch{}
    }

    await loadMessages();
}


async function removeGameMessages(game){

    if(!game?.id){
        return;
    }

    stoppedGames.add(
        game.id
    );

    hideGameImmediately(
        game
    );

    try{

        await apiDelete({
            game_server:true,
            game_id:game.id,
            device_id:game.hostDeviceId
        });

    }catch{}
}


async function deleteStateMessage(game){

    if(!game?.messageId){
        return;
    }

    try{

        await apiDelete({
            game_server:true,
            id:game.messageId,
            device_id:game.hostDeviceId
        });

    }catch{}
}


/*
 * Leaving the site removes the current player from every game.
 * If the player is the host, the whole game is stopped.
 */

window.addEventListener(
    "pagehide",
    ()=>{
        for(
            const game of [...games]
        ){

            if(
                game.players?.some(
                    p=>p.deviceId===deviceId
                )
            ){

                stopGameOnExit(
                    game
                );
            }
        }
    }
);


/* =====================================================
   REFRESH
===================================================== */

function restartRefresh(){

    if(refreshTimer){
        clearInterval(
            refreshTimer
        );
    }

    refreshTimer=
        setInterval(
            loadMessages,
            500
        );
}


/* =====================================================
   CONFIRM
===================================================== */

function openConfirm(
    title,
    text,
    callback
){

    confirmTitle.textContent=
        title;

    confirmText.textContent=
        text;

    confirmCallback=
        callback;

    confirmOverlay.classList.add(
        "show"
    );
}


confirmCancel.onclick=()=>{

    confirmOverlay.classList.remove(
        "show"
    );

    confirmCallback=null;
};


confirmYes.onclick=async()=>{

    const callback=
        confirmCallback;

    confirmOverlay.classList.remove(
        "show"
    );

    confirmCallback=null;

    if(callback){

        try{

            await callback();

        }catch(error){

            alert(
                error.message
            );
        }
    }
};


/* =====================================================
   REMOVE EVERYTHING
===================================================== */

removeEverything.onclick=()=>{

    openConfirm(
        "Remove everything?",
        "This permanently removes every message from the chat.",
        async()=>{

            try{

                await apiDelete({
                    delete_all:true
                });

                currentMessages=[];
                games=[];

                renderedElements.clear();
                renderedData.clear();

                seenMessageIds.clear();
                seenGameIds.clear();

                renderMessages();

            }catch(error){

                alert(
                    "Failed to wipe chat:\n\n"+
                    error.message
                );
            }
        }
    );
};


/* =====================================================
   HELPERS
===================================================== */

function formatTime(date){

    if(!date){
        return "";
    }

    return new Date(
        date
    ).toLocaleTimeString(
        [],
        {
            hour:"2-digit",
            minute:"2-digit"
        }
    );
}


function escapeHtml(value){

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =====================================================
   STARTUP ANIMATION
===================================================== */

function playStartupAnimation(){

    const screen=
        document.getElementById(
            "startupScreen"
        );

    if(!screen){
        return;
    }

    screen.classList.remove(
        "hide"
    );

    clearTimeout(
        window.__startupTimer
    );

    window.__startupTimer=
        setTimeout(
            ()=>{
                screen.classList.add(
                    "hide"
                );
            },
            1150
        );
}

window.addEventListener(
    "pageshow",
    playStartupAnimation
);

playStartupAnimation();


/* =====================================================
   START
===================================================== */

loadSettingsUI();
applySettings();
loadMessages();
