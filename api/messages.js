const API_URL="/api/messages";
const CHANNEL="general";

const GAME_SERVER_NAME="__GAME_SERVER__";

let deviceId=localStorage.getItem("chat_device_id");

if(!deviceId){
    deviceId=crypto.randomUUID();
    localStorage.setItem("chat_device_id",deviceId);
}


/* =========================================================
SETTINGS
========================================================= */

const defaults={
    username:"",
    theme:"dark",
    refreshRate:1000,
    showTimestamps:true,
    compactMessages:false,
    textSize:16,
    wordSpacing:0,
    lineSpacing:1.45,
    cornerRadius:12,
    enterToSend:true,
    autoScroll:true,
    confirmDelete:true
};

function getSetting(key){

    const value=localStorage.getItem("chat_"+key);

    if(value===null)
        return defaults[key];

    if(value==="true")
        return true;

    if(value==="false")
        return false;

    const n=Number(value);

    return Number.isNaN(n)
        ?value
        :n;
}

let settings={};

for(const key of Object.keys(defaults)){
    settings[key]=getSetting(key);
}


/* =========================================================
ELEMENTS
========================================================= */

const messagesEl=document.getElementById("messages");
const messageInput=document.getElementById("messageInput");
const sendBtn=document.getElementById("sendBtn");
const imageInput=document.getElementById("imageInput");
const attachBtn=document.getElementById("attachBtn");

const gamesBtn=document.getElementById("gamesBtn");
const gamesWindow=document.getElementById("gamesWindow");
const closeGames=document.getElementById("closeGames");

const settingsBtn=document.getElementById("settingsBtn");
const settingsWindow=document.getElementById("settingsWindow");
const closeSettings=document.getElementById("closeSettings");

const gameHome=document.getElementById("gameHome");
const gameSetup=document.getElementById("gameSetup");
const gamePlay=document.getElementById("gamePlay");
const gamePlayContent=document.getElementById("gamePlayContent");
const activeGames=document.getElementById("activeGames");

const selectedGameName=document.getElementById("selectedGameName");
const maxPlayers=document.getElementById("maxPlayers");
const cancelGameSetup=document.getElementById("cancelGameSetup");
const createGame=document.getElementById("createGame");
const backToGames=document.getElementById("backToGames");
const leaveCurrentGame=document.getElementById("leaveCurrentGame");

const usernameInput=document.getElementById("usernameInput");
const deviceIdInput=document.getElementById("deviceIdInput");
const textSize=document.getElementById("textSize");
const wordSpacing=document.getElementById("wordSpacing");
const lineSpacing=document.getElementById("lineSpacing");
const textSizeValue=document.getElementById("textSizeValue");
const wordSpacingValue=document.getElementById("wordSpacingValue");
const lineSpacingValue=document.getElementById("lineSpacingValue");
const cornerRadius=document.getElementById("cornerRadius");
const cornerRadiusValue=document.getElementById("cornerRadiusValue");
const themeSelect=document.getElementById("themeSelect");
const refreshRate=document.getElementById("refreshRate");
const showTimestamps=document.getElementById("showTimestamps");
const compactMessages=document.getElementById("compactMessages");
const enterToSend=document.getElementById("enterToSend");
const autoScroll=document.getElementById("autoScroll");
const confirmDelete=document.getElementById("confirmDelete");
const saveSettings=document.getElementById("saveSettings");
const removeEverything=document.getElementById("removeEverything");

const contextMenu=document.getElementById("contextMenu");
const editMessageBtn=document.getElementById("editMessage");
const deleteMessageBtn=document.getElementById("deleteMessage");

const imageViewer=document.getElementById("imageViewer");
const fullImage=document.getElementById("fullImage");
const backImage=document.getElementById("backImage");

const dialogOverlay=document.getElementById("dialogOverlay");
const dialogTitle=document.getElementById("dialogTitle");
const dialogText=document.getElementById("dialogText");
const dialogCancel=document.getElementById("dialogCancel");
const dialogConfirm=document.getElementById("dialogConfirm");


let currentMessages=[];
let selectedMessage=null;
let selectedGameType=null;
let currentGameId=null;
let refreshTimer=null;
let confirmCallback=null;


/* =========================================================
GAME DATA
========================================================= */

const GAME_INFO={

    tictactoe:{
        name:"Tic Tac Toe",
        icon:"❌",
        min:2,
        max:2
    },

    connect4:{
        name:"Connect Four",
        icon:"🔴",
        min:2,
        max:2
    },

    dice:{
        name:"Dice Duel",
        icon:"🎲",
        min:2,
        max:8
    },

    reaction:{
        name:"Reaction",
        icon:"⚡",
        min:2,
        max:8
    },

    board:{
        name:"Board Race",
        icon:"♟️",
        min:2,
        max:8
    }

};


/* =========================================================
API
========================================================= */

async function apiRequest(method,body=null){

    const options={
        method,
        headers:{
            "Content-Type":"application/json"
        }
    };

    if(body!==null)
        options.body=JSON.stringify(body);

    const response=await fetch(API_URL,options);

    const text=await response.text();

    let data={};

    try{
        data=text?JSON.parse(text):{};
    }catch{
        data={error:text};
    }

    if(!response.ok){
        throw new Error(
            data.error||
            data.message||
            "Request failed."
        );
    }

    return data;
}


/* =========================================================
CHAT
========================================================= */

async function loadMessages(){

    try{

        const data=await apiRequest(
            "GET"
        );

        currentMessages=
            Array.isArray(data.messages)
                ?data.messages
                :[];

        renderMessages();

        refreshGames();

    }catch(error){

        console.error(error);

        if(!currentMessages.length){

            messagesEl.innerHTML=`
                <div class="empty">
                    <div>
                        <strong>Unable to load chat</strong>
                        ${escapeHtml(error.message)}
                    </div>
                </div>
            `;

        }

    }

}


function isGameMessage(message){

    return message &&
        message.username===GAME_SERVER_NAME;
}


function renderMessages(){

    const normalMessages=
        currentMessages.filter(
            message=>!isGameMessage(message)
        );

    if(!normalMessages.length){

        messagesEl.innerHTML=`
            <div class="empty">
                <div>
                    <strong>No messages yet</strong>
                    Start the conversation.
                </div>
            </div>
        `;

        return;
    }

    const shouldScroll=
        settings.autoScroll &&
        (
            messagesEl.scrollHeight-
            messagesEl.scrollTop-
            messagesEl.clientHeight
        )<120;

    messagesEl.innerHTML="";

    for(const message of normalMessages){

        const el=createMessageElement(
            message
        );

        messagesEl.appendChild(el);
    }

    if(shouldScroll){
        messagesEl.scrollTop=
            messagesEl.scrollHeight;
    }

}


function createMessageElement(message){

    const wrapper=document.createElement("div");

    wrapper.className="message";

    const avatar=document.createElement("div");

    avatar.className="avatar";

    avatar.textContent=
        (message.username||"?")
        .charAt(0)
        .toUpperCase();

    const content=document.createElement("div");

    content.className="message-content";

    const top=document.createElement("div");

    top.className="message-top";

    const username=document.createElement("span");

    username.className="username";

    username.textContent=
        message.username||"Unknown";

    top.appendChild(username);

    if(settings.showTimestamps){

        const time=document.createElement("span");

        time.className="time";

        time.textContent=
            formatTime(message.created_at);

        top.appendChild(time);

    }

    if(message.edited){

        const edited=document.createElement("span");

        edited.className="edited";

        edited.textContent="edited";

        top.appendChild(edited);

    }

    content.appendChild(top);

    if(message.message){

        const text=document.createElement("div");

        text.className="message-text";

        appendMessageText(
            text,
            message.message
        );

        content.appendChild(text);
    }

    if(message.image){

        const image=document.createElement("img");

        image.className="message-image";

        image.src=message.image;

        image.onclick=()=>{
            fullImage.src=message.image;
            imageViewer.classList.add("show");
        };

        content.appendChild(image);
    }

    wrapper.appendChild(avatar);
    wrapper.appendChild(content);

    wrapper.oncontextmenu=e=>{

        e.preventDefault();

        if(
            message.device_id!==deviceId
        )
            return;

        selectedMessage=message;

        contextMenu.style.left=
            Math.min(
                e.clientX,
                window.innerWidth-170
            )+"px";

        contextMenu.style.top=
            Math.min(
                e.clientY,
                window.innerHeight-100
            )+"px";

        contextMenu.classList.add("show");
    };

    return wrapper;
}


function appendMessageText(element,text){

    const urlRegex=
        /(https?:\/\/[^\s]+)/g;

    const parts=text.split(urlRegex);

    for(const part of parts){

        if(/^https?:\/\//i.test(part)){

            const link=document.createElement("a");

            link.className="message-link";

            link.href=part;
            link.target="_blank";
            link.rel="noopener noreferrer";

            link.textContent=part;

            element.appendChild(link);

        }else{

            element.appendChild(
                document.createTextNode(part)
            );

        }

    }

}


function formatTime(date){

    if(!date)
        return "";

    try{

        return new Date(date)
            .toLocaleTimeString(
                [],
                {
                    hour:"2-digit",
                    minute:"2-digit"
                }
            );

    }catch{
        return "";
    }

}


/* =========================================================
SEND CHAT
========================================================= */

async function sendMessage(){

    const text=
        messageInput.value.trim();

    if(!text && !imageInput.files.length)
        return;

    if(!settings.username){

        openSettings();

        alert(
            "Set your name before sending messages."
        );

        return;
    }

    sendBtn.disabled=true;

    try{

        let image=null;

        if(imageInput.files.length){

            image=
                await fileToDataURL(
                    imageInput.files[0]
                );

        }

        await apiRequest(
            "POST",
            {
                username:settings.username,
                channel:CHANNEL,
                message:text,
                image,
                device_id:deviceId
            }
        );

        messageInput.value="";
        imageInput.value="";

        await loadMessages();

    }catch(error){

        alert(
            "Could not send message:\n\n"+
            error.message
        );

    }finally{

        sendBtn.disabled=false;

    }

}


function fileToDataURL(file){

    return new Promise(
        (resolve,reject)=>{

            const reader=
                new FileReader();

            reader.onload=()=>{
                resolve(reader.result);
            };

            reader.onerror=reject;

            reader.readAsDataURL(file);

        }
    );

}


sendBtn.onclick=sendMessage;

messageInput.addEventListener(
    "keydown",
    e=>{

        if(
            e.key==="Enter" &&
            !e.shiftKey &&
            settings.enterToSend
        ){

            e.preventDefault();

            sendMessage();
        }

    }
);

attachBtn.onclick=()=>{
    imageInput.click();
};


/* =========================================================
MESSAGE EDIT / DELETE
========================================================= */

document.addEventListener(
    "click",
    ()=>{
        contextMenu.classList.remove("show");
    }
);


editMessageBtn.onclick=async e=>{

    e.stopPropagation();

    contextMenu.classList.remove("show");

    if(!selectedMessage)
        return;

    const newText=
        prompt(
            "Edit message:",
            selectedMessage.message||""
        );

    if(newText===null)
        return;

    try{

        await apiRequest(
            "PATCH",
            {
                id:selectedMessage.id,
                device_id:deviceId,
                message:newText
            }
        );

        await loadMessages();

    }catch(error){

        alert(error.message);
    }

};


deleteMessageBtn.onclick=async e=>{

    e.stopPropagation();

    contextMenu.classList.remove("show");

    if(!selectedMessage)
        return;

    const doDelete=()=>deleteSelectedMessage();

    if(settings.confirmDelete){

        showConfirm(
            "Delete message",
            "Are you sure you want to delete this message?",
            doDelete
        );

    }else{

        doDelete();

    }

};


async function deleteSelectedMessage(){

    if(!selectedMessage)
        return;

    try{

        await apiRequest(
            "DELETE",
            {
                id:selectedMessage.id,
                device_id:deviceId
            }
        );

        selectedMessage=null;

        await loadMessages();

    }catch(error){

        alert(error.message);
    }

}


/* =========================================================
WINDOWS
========================================================= */

function openWindow(windowElement){

    windowElement.classList.add("show");

}


function closeWindow(windowElement){

    windowElement.classList.remove("show");

}


gamesBtn.onclick=()=>{

    openWindow(gamesWindow);

    showGameHome();

    refreshGames();

};


closeGames.onclick=()=>{
    closeWindow(gamesWindow);
};


settingsBtn.onclick=()=>{
    openSettings();
};


closeSettings.onclick=()=>{
    closeWindow(settingsWindow);
};


function openSettings(){

    loadSettingsUI();

    openWindow(settingsWindow);

}


/* =========================================================
GAME WINDOW
========================================================= */

function showGameHome(){

    gameHome.style.display="block";
    gameSetup.style.display="none";
    gamePlay.style.display="none";

    currentGameId=null;
}


backToGames.onclick=()=>{
    showGameHome();
    refreshGames();
};


document.querySelectorAll(".game-choice")
.forEach(button=>{

    button.onclick=()=>{

        if(!settings.username){

            openSettings();

            alert(
                "Set your name before hosting a game."
            );

            return;
        }

        selectedGameType=
            button.dataset.game;

        const info=
            GAME_INFO[selectedGameType];

        selectedGameName.value=
            info.icon+" "+info.name;

        maxPlayers.innerHTML="";

        for(
            let i=info.min;
            i<=info.max;
            i++
        ){

            const option=
                document.createElement("option");

            option.value=i;

            option.textContent=
                i+" players";

            maxPlayers.appendChild(option);

        }

        gameHome.style.display="none";
        gameSetup.style.display="block";

    };

});


cancelGameSetup.onclick=()=>{
    showGameHome();
};


/* =========================================================
GAME STATE FORMAT
========================================================= */

function encodeGameState(state){

    return JSON.stringify(state);

}


function decodeGameState(message){

    if(!message)
        return null;

    if(
        message.username!==GAME_SERVER_NAME
    )
        return null;

    try{

        return JSON.parse(
            message.message
        );

    }catch{

        return null;
    }

}


/* =========================================================
HOST GAME
========================================================= */

createGame.onclick=async()=>{

    if(!settings.username){

        openSettings();

        alert(
            "Set your name before hosting a game."
        );

        return;
    }

    const existing=
        getActiveGames()
        .find(
            game=>
                game.host_device_id===deviceId
        );

    if(existing){

        alert(
            "You are already hosting a game."
        );

        showGame(existing);

        return;
    }

    if(!selectedGameType)
        return;

    const info=
        GAME_INFO[selectedGameType];

    const max=
        Number(maxPlayers.value);

    const gameId=
        crypto.randomUUID();

    const state={
        game_id:gameId,
        game_type:selectedGameType,
        host_device_id:deviceId,
        host_name:settings.username,
        max_players:max,

        players:[
            {
                device_id:deviceId,
                username:settings.username
            }
        ],

        started:false,
        finished:false,
        turn_index:0,

        board:
            createInitialBoard(
                selectedGameType
            ),

        values:{},

        created_at:Date.now(),
        updated_at:Date.now()
    };

    createGame.disabled=true;

    try{

        /*
        THIS IS THE IMPORTANT PART.

        Your API requires:
        game_server:true
        */

        const data=
            await apiRequest(
                "POST",
                {
                    username:GAME_SERVER_NAME,
                    channel:CHANNEL,
                    message:encodeGameState(state),
                    device_id:gameId,
                    game_server:true
                }
            );

        console.log(
            "GAME HOSTED:",
            data
        );

        showGameHome();

        await loadMessages();

        const hosted=
            getActiveGames()
            .find(
                game=>
                    game.game_id===gameId
            );

        if(hosted)
            showGame(hosted);

    }catch(error){

        console.error(error);

        alert(
            "Could not host game:\n\n"+
            error.message
        );

    }finally{

        createGame.disabled=false;

    }

};


/* =========================================================
GET GAMES
========================================================= */

function getActiveGames(){

    const map=new Map();

    for(const message of currentMessages){

        const state=
            decodeGameState(message);

        if(!state)
            continue;

        if(state.finished)
            continue;

        /*
        Newer server message replaces older state.
        */

        map.set(
            state.game_id,
            {
                ...state,
                message_id:message.id
            }
        );

    }

    return Array.from(map.values());

}


function refreshGames(){

    const games=
        getActiveGames();

    renderActiveGames(games);

    if(currentGameId){

        const current=
            games.find(
                game=>
                    game.game_id===currentGameId
            );

        if(current){

            renderGame(current);

        }else{

            showGameHome();

        }

    }

}


function renderActiveGames(games){

    if(!games.length){

        activeGames.innerHTML=`
            <div class="game-message">
                No active games.
            </div>
        `;

        return;
    }

    activeGames.innerHTML="";

    for(const game of games){

        const card=
            document.createElement("div");

        card.className="join-card";

        const info=
            GAME_INFO[game.game_type];

        const isPlayer=
            game.players?.some(
                p=>p.device_id===deviceId
            );

        const full=
            game.players.length>=
            game.max_players;

        card.innerHTML=`
            <div class="join-top">
                <div>
                    <div class="join-name">
                        ${info.icon}
                        ${escapeHtml(info.name)}
                    </div>

                    <div class="join-meta">
                        Hosted by
                        ${escapeHtml(game.host_name)}
                        ·
                        ${game.players.length}/${game.max_players}
                    </div>
                </div>

                <div class="join-meta">
                    ${game.started?"Playing":"Waiting"}
                </div>
            </div>
        `;

        const actions=
            document.createElement("div");

        actions.className="game-actions";

        if(isPlayer){

            const openBtn=
                document.createElement("button");

            openBtn.className="game-btn blue";

            openBtn.textContent=
                game.started
                    ?"Open game"
                    :"View lobby";

            openBtn.onclick=()=>{
                showGame(game);
            };

            actions.appendChild(openBtn);

        }else if(!game.started && !full){

            const joinBtn=
                document.createElement("button");

            joinBtn.className="game-btn success";

            joinBtn.textContent="Join";

            joinBtn.onclick=()=>{
                joinGame(game);
            };

            actions.appendChild(joinBtn);

        }else{

            const fullText=
                document.createElement("span");

            fullText.className="join-meta";

            fullText.textContent=
                game.started
                    ?"Game already started"
                    :"Game full";

            actions.appendChild(fullText);

        }

        card.appendChild(actions);

        activeGames.appendChild(card);

    }

}


/* =========================================================
JOIN GAME
========================================================= */

async function joinGame(game){

    if(!settings.username){

        openSettings();

        alert(
            "Set your name before joining."
        );

        return;
    }

    if(game.started){

        alert(
            "This game has already started."
        );

        return;
    }

    if(
        game.players.some(
            p=>p.device_id===deviceId
        )
    ){

        showGame(game);

        return;
    }

    if(
        game.players.length>=
        game.max_players
    ){

        alert("This game is full.");

        return;
    }

    const players=[
        ...game.players,
        {
            device_id:deviceId,
            username:settings.username
        }
    ];

    try{

        await updateGame(
            game,
            {
                players
            }
        );

        await loadMessages();

        const updated=
            getActiveGames()
            .find(
                g=>g.game_id===game.game_id
            );

        if(updated)
            showGame(updated);

    }catch(error){

        alert(
            "Could not join game:\n\n"+
            error.message
        );

    }

}


/* =========================================================
UPDATE GAME

Because the API PATCH endpoint updates the original
game-server row, we use the original message ID and
the game's device_id.
========================================================= */

async function updateGame(game,changes){

    const state={
        ...game,
        ...changes,
        updated_at:Date.now()
    };

    delete state.message_id;

    await apiRequest(
        "PATCH",
        {
            id:game.message_id,
            device_id:game.game_id,
            game_server:true,
            game_state:encodeGameState(state)
        }
    );

    await loadMessages();

}


async function deleteGame(game){

    if(!game)
        return;

    await apiRequest(
        "DELETE",
        {
            id:game.message_id,
            device_id:game.game_id,
            game_server:true
        }
    );

    currentGameId=null;

    await loadMessages();

    showGameHome();

}


/* =========================================================
START GAME
========================================================= */

async function startGame(game){

    if(game.host_device_id!==deviceId){

        alert(
            "Only the host can start the game."
        );

        return;
    }

    const min=
        GAME_INFO[game.game_type].min;

    if(game.players.length<min){

        alert(
            "You need at least "+
            min+
            " players."
        );

        return;
    }

    await updateGame(
        game,
        {
            started:true,
            turn_index:0,
            winner:null
        }
    );

}


/* =========================================================
LEAVE GAME
========================================================= */

async function leaveGame(game){

    if(!game)
        return;

    if(
        game.host_device_id===deviceId
    ){

        if(game.players.length>1){

            showConfirm(
                "Close game",
                "You are the host. Closing the game will remove it for everyone.",
                async()=>{
                    try{
                        await deleteGame(game);
                    }catch(error){
                        alert(error.message);
                    }
                }
            );

        }else{

            try{
                await deleteGame(game);
            }catch(error){
                alert(error.message);
            }

        }

        return;
    }

    const players=
        game.players.filter(
            p=>p.device_id!==deviceId
        );

    try{

        await updateGame(
            game,
            {
                players
            }
        );

        currentGameId=null;

        await loadMessages();

        showGameHome();

    }catch(error){

        alert(error.message);

    }

}


leaveCurrentGame.onclick=()=>{

    if(!currentGameId)
        return;

    const game=
        getActiveGames()
        .find(
            g=>g.game_id===currentGameId
        );

    if(game)
        leaveGame(game);

};


/* =========================================================
SHOW GAME
========================================================= */

function showGame(game){

    currentGameId=game.game_id;

    gameHome.style.display="none";
    gameSetup.style.display="none";
    gamePlay.style.display="block";

    renderGame(game);

}


function renderGame(game){

    if(!game)
        return;

    if(!game.started){

        renderLobby(game);

        return;
    }

    if(game.game_type==="tictactoe"){
        renderTicTacToe(game);
        return;
    }

    if(game.game_type==="connect4"){
        renderConnect4(game);
        return;
    }

    if(game.game_type==="dice"){
        renderDice(game);
        return;
    }

    if(game.game_type==="reaction"){
        renderReaction(game);
        return;
    }

    if(game.game_type==="board"){
        renderBoard(game);
        return;
    }

}


/* =========================================================
LOBBY
========================================================= */

function renderLobby(game){

    const info=
        GAME_INFO[game.game_type];

    const isHost=
        game.host_device_id===deviceId;

    gamePlayContent.innerHTML="";

    const box=
        document.createElement("div");

    box.className="hosted-game";

    box.innerHTML=`
        <div class="hosted-top">

            <div>
                <div class="hosted-name">
                    ${info.icon}
                    ${escapeHtml(info.name)}
                </div>

                <div class="join-meta">
                    Hosted by
                    ${escapeHtml(game.host_name)}
                </div>
            </div>

            <div class="hosted-status">
                Waiting
            </div>

        </div>

        <div class="players"></div>

        <div class="game-actions"></div>
    `;

    const players=
        box.querySelector(".players");

    for(const player of game.players){

        const p=
            document.createElement("div");

        p.className="player";

        p.textContent=
            player.username+
            (
                player.device_id===
                game.host_device_id
                    ?" 👑"
                    :""
            );

        players.appendChild(p);

    }

    const actions=
        box.querySelector(".game-actions");

    if(isHost){

        const enough=
            game.players.length>=info.min;

        const start=
            document.createElement("button");

        start.className=
            enough
                ?"game-btn success"
                :"game-btn";

        start.textContent=
            enough
                ?"Start game"
                :"Waiting for players...";

        start.disabled=!enough;

        start.onclick=()=>{
            startGame(game);
        };

        actions.appendChild(start);

    }else{

        const text=
            document.createElement("div");

        text.className="game-message";

        text.textContent=
            "Waiting for the host to start the game.";

        actions.appendChild(text);

    }

    gamePlayContent.appendChild(box);

}


/* =========================================================
TIC TAC TOE
========================================================= */

function createInitialBoard(type){

    if(type==="tictactoe")
        return Array(9).fill("");

    if(type==="connect4")
        return Array(42).fill("");

    if(type==="board")
        return Array(25).fill(0);

    return [];
}


function getCurrentPlayer(game){

    if(
        !game.players||
        !game.players.length
    )
        return null;

    return game.players[
        game.turn_index%
        game.players.length
    ];
}


function isMyTurn(game){

    const player=
        getCurrentPlayer(game);

    return !!player &&
        player.device_id===deviceId;
}


function nextTurn(game){

    return(
        game.turn_index+1
    )%game.players.length;
}


function renderTicTacToe(game){

    const current=
        getCurrentPlayer(game);

    gamePlayContent.innerHTML=`

        <div class="game-board">

            <div class="game-info">
                <strong>${escapeHtml(
                    GAME_INFO.tictactoe.name
                )}</strong>
                <br>
                ${
                    game.winner
                        ?(
                            game.winner==="draw"
                                ?"Draw!"
                                :"Winner: "+
                                escapeHtml(
                                    game.winner
                                )
                        )
                        :(
                            isMyTurn(game)
                                ?"Your turn"
                                :"Waiting for "+
                                escapeHtml(
                                    current?.username||
                                    "player"
                                )
                        )
                }
            </div>

            <div class="board ttt-board"></div>

        </div>
    `;

    const board=
        gamePlayContent.querySelector(
            ".board"
        );

    game.board.forEach(
        (value,index)=>{

            const cell=
                document.createElement("button");

            cell.className="cell";

            cell.textContent=value;

            cell.disabled=
                !!value||
                !isMyTurn(game)||
                !!game.winner;

            cell.onclick=()=>{
                playTicTacToe(
                    game,
                    index
                );
            };

            board.appendChild(cell);

        }
    );

}


async function playTicTacToe(game,index){

    if(!isMyTurn(game))
        return;

    if(game.board[index])
        return;

    const board=[
        ...game.board
    ];

    board[index]=
        game.turn_index%2===0
            ?"X"
            :"O";

    const winner=
        checkTicTacToe(board);

    if(winner){

        await updateGame(
            game,
            {
                board,
                winner,
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    if(board.every(Boolean)){

        await updateGame(
            game,
            {
                board,
                winner:"draw",
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    await updateGame(
        game,
        {
            board,
            turn_index:nextTurn(game)
        }
    );

}


function checkTicTacToe(board){

    const lines=[
        [0,1,2],
        [3,4,5],
        [6,7,8],
        [0,3,6],
        [1,4,7],
        [2,5,8],
        [0,4,8],
        [2,4,6]
    ];

    for(const line of lines){

        const [a,b,c]=line;

        if(
            board[a] &&
            board[a]===board[b] &&
            board[a]===board[c]
        ){

            return board[a];

        }

    }

    return null;

}


/* =========================================================
CONNECT FOUR
========================================================= */

function renderConnect4(game){

    const current=
        getCurrentPlayer(game);

    gamePlayContent.innerHTML=`

        <div class="game-board">

            <div class="game-info">
                <strong>🔴 Connect Four</strong>
                <br>
                ${
                    isMyTurn(game)
                        ?"Your turn"
                        :"Waiting for "+
                        escapeHtml(
                            current?.username||
                            "player"
                        )
                }
            </div>

            <div class="board connect-board"></div>

        </div>
    `;

    const board=
        gamePlayContent.querySelector(
            ".board"
        );

    game.board.forEach(
        (value,index)=>{

            const cell=
                document.createElement("button");

            cell.className="cell";

            cell.textContent=
                value==="R"
                    ?"🔴"
                    :value==="Y"
                        ?"🟡"
                        :"";

            cell.disabled=
                !isMyTurn(game)||
                !!game.winner;

            cell.onclick=()=>{

                const column=
                    index%7;

                playConnect4(
                    game,
                    column
                );

            };

            board.appendChild(cell);

        }
    );

}


async function playConnect4(game,column){

    if(!isMyTurn(game))
        return;

    const board=[
        ...game.board
    ];

    let row=-1;

    for(let r=5;r>=0;r--){

        const index=
            r*7+column;

        if(!board[index]){

            row=r;

            break;

        }

    }

    if(row<0)
        return;

    const symbol=
        game.turn_index%2===0
            ?"R"
            :"Y";

    board[
        row*7+column
    ]=symbol;

    const winner=
        checkConnect4(
            board,
            row,
            column,
            symbol
        );

    if(winner){

        await updateGame(
            game,
            {
                board,
                winner:
                    symbol==="R"
                        ?"Red"
                        :"Yellow",
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    if(board.every(Boolean)){

        await updateGame(
            game,
            {
                board,
                winner:"draw",
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    await updateGame(
        game,
        {
            board,
            turn_index:nextTurn(game)
        }
    );

}


function checkConnect4(
    board,
    row,
    column,
    symbol
){

    const directions=[
        [1,0],
        [0,1],
        [1,1],
        [1,-1]
    ];

    for(const [dr,dc] of directions){

        let count=1;

        for(const sign of [-1,1]){

            let r=row+dr*sign;
            let c=column+dc*sign;

            while(
                r>=0&&
                r<6&&
                c>=0&&
                c<7&&
                board[r*7+c]===symbol
            ){

                count++;

                r+=dr*sign;
                c+=dc*sign;

            }

        }

        if(count>=4)
            return true;

    }

    return false;

}


/* =========================================================
DICE
========================================================= */

function renderDice(game){

    const current=
        getCurrentPlayer(game);

    const values=
        game.values||{};

    gamePlayContent.innerHTML=`

        <div class="game-board">

            <div class="game-info">
                <strong>🎲 Dice Duel</strong>
                <br>
                ${
                    game.winner
                        ?"Winner: "+
                        escapeHtml(game.winner)
                        :(
                            isMyTurn(game)
                                ?"Your turn"
                                :"Waiting for "+
                                escapeHtml(
                                    current?.username||
                                    "player"
                                )
                        )
                }
            </div>

            <div class="dice-result">
                ${
                    values[deviceId]||
                    "🎲"
                }
            </div>

            <div class="game-actions">
                <button
                    class="game-btn primary"
                    id="rollDice"
                    ${!isMyTurn(game)?"disabled":""}
                >
                    Roll dice
                </button>
            </div>

            <div class="game-message">
                ${
                    Object.entries(values)
                    .map(
                        ([id,value])=>{
                            const p=
                                game.players.find(
                                    x=>x.device_id===id
                                );

                            return escapeHtml(
                                p?.username||"Player"
                            )+
                            ": "+
                            value;
                        }
                    )
                    .join(" · ")
                }
            </div>

        </div>
    `;

    const roll=
        document.getElementById(
            "rollDice"
        );

    roll.onclick=()=>{
        rollDice(game);
    };

}


async function rollDice(game){

    if(!isMyTurn(game))
        return;

    const values={
        ...(game.values||{})
    };

    values[deviceId]=
        Math.floor(
            Math.random()*6
        )+1;

    const next=
        nextTurn(game);

    const allRolled=
        Object.keys(values).length>=
        game.players.length;

    if(allRolled){

        let winnerId=null;
        let best=-1;

        for(const p of game.players){

            const value=
                values[p.device_id]||0;

            if(value>best){

                best=value;
                winnerId=
                    p.device_id;

            }

        }

        const winner=
            game.players.find(
                p=>p.device_id===winnerId
            );

        await updateGame(
            game,
            {
                values,
                winner:
                    winner?.username||"Player",
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    await updateGame(
        game,
        {
            values,
            turn_index:next
        }
    );

}


/* =========================================================
REACTION
========================================================= */

function renderReaction(game){

    const current=
        getCurrentPlayer(game);

    const reaction=
        game.values?.reaction||"waiting";

    gamePlayContent.innerHTML=`

        <div class="game-board">

            <div class="game-info">
                <strong>⚡ Reaction</strong>
                <br>
                ${
                    game.winner
                        ?"Winner: "+
                        escapeHtml(game.winner)
                        :(
                            isMyTurn(game)
                                ?"Your turn"
                                :"Waiting for "+
                                escapeHtml(
                                    current?.username||
                                    "player"
                                )
                        )
                }
            </div>

            <div
                class="reaction-box ${
                    reaction==="go"
                        ?"go"
                        :""
                }"
                id="reactionBox"
            >

                ${
                    reaction==="go"
                        ?"CLICK!"
                        :"Get ready..."
                }

            </div>

        </div>
    `;

    const box=
        document.getElementById(
            "reactionBox"
        );

    if(
        isMyTurn(game) &&
        reaction!=="go"
    ){

        box.onclick=()=>{
            reactionClick(game);
        };

        setTimeout(
            async()=>{

                const latest=
                    getActiveGames()
                    .find(
                        g=>
                            g.game_id===
                            game.game_id
                    );

                if(
                    latest &&
                    isMyTurn(latest)
                ){

                    await updateGame(
                        latest,
                        {
                            values:{
                                ...(latest.values||{}),
                                reaction:"go",
                                reactionStarted:
                                    Date.now()
                            }
                        }
                    );

                }

            },
            1200+
            Math.random()*2500
        );

    }

}


async function reactionClick(game){

    if(!isMyTurn(game))
        return;

    if(
        game.values?.reaction!=="go"
    )
        return;

    const elapsed=
        Date.now()-
        (
            game.values.reactionStarted||
            Date.now()
        );

    await updateGame(
        game,
        {
            values:{
                ...(game.values||{}),
                reactionTime:elapsed
            },
            winner:settings.username,
            finished:true
        }
    );

    setTimeout(
        ()=>deleteFinishedGame(game.game_id),
        1200
    );

}


/* =========================================================
BOARD RACE
========================================================= */

function renderBoard(game){

    const current=
        getCurrentPlayer(game);

    const positions=
        game.values?.positions||
        {};

    gamePlayContent.innerHTML=`

        <div class="game-board">

            <div class="game-info">
                <strong>♟️ Board Race</strong>
                <br>
                ${
                    game.winner
                        ?"Winner: "+
                        escapeHtml(game.winner)
                        :(
                            isMyTurn(game)
                                ?"Your turn"
                                :"Waiting for "+
                                escapeHtml(
                                    current?.username||
                                    "player"
                                )
                        )
                }
            </div>

            <div class="board-race"></div>

        </div>
    `;

    const board=
        gamePlayContent.querySelector(
            ".board-race"
        );

    for(let i=0;i<25;i++){

        const cell=
            document.createElement("button");

        cell.className="cell";

        const players=
            game.players.filter(
                p=>
                    (
                        positions[p.device_id]||0
                    )===i
            );

        cell.textContent=
            players.length
                ?players.map(
                    p=>
                        p.device_id===deviceId
                            ?"🙂"
                            :"♟️"
                ).join("")
                :"";

        board.appendChild(cell);

    }

    const actions=
        document.createElement("div");

    actions.className="game-actions";

    const roll=
        document.createElement("button");

    roll.className="game-btn primary";

    roll.textContent=
        isMyTurn(game)
            ?"Roll dice"
            :"Waiting...";

    roll.disabled=
        !isMyTurn(game);

    roll.onclick=()=>{
        boardRaceMove(game);
    };

    actions.appendChild(roll);

    gamePlayContent
        .querySelector(".game-board")
        .appendChild(actions);

}


async function boardRaceMove(game){

    if(!isMyTurn(game))
        return;

    const positions={
        ...(game.values?.positions||{})
    };

    const old=
        positions[deviceId]||0;

    const roll=
        Math.floor(
            Math.random()*6
        )+1;

    const next=
        Math.min(
            24,
            old+roll
        );

    positions[deviceId]=next;

    if(next>=24){

        await updateGame(
            game,
            {
                values:{
                    ...(game.values||{}),
                    positions
                },
                winner:settings.username,
                finished:true
            }
        );

        setTimeout(
            ()=>deleteFinishedGame(game.game_id),
            1200
        );

        return;
    }

    await updateGame(
        game,
        {
            values:{
                ...(game.values||{}),
                positions
            },
            turn_index:nextTurn(game)
        }
    );

}


/* =========================================================
FINISHED GAME CLEANUP
========================================================= */

async function deleteFinishedGame(gameId){

    const game=
        getActiveGames()
        .find(
            g=>g.game_id===gameId
        );

    if(!game)
        return;

    /*
    Only the host deletes the game so multiple
    clients don't race each other.
    */

    if(game.host_device_id!==deviceId)
        return;

    try{

        await apiRequest(
            "DELETE",
            {
                id:game.message_id,
                device_id:game.game_id,
                game_server:true
            }
        );

        await loadMessages();

    }catch(error){

        console.warn(
            "Could not remove finished game:",
            error
        );

    }

}


/* =========================================================
SETTINGS UI
========================================================= */

function loadSettingsUI(){

    usernameInput.value=settings.username;

    deviceIdInput.value=deviceId;

    textSize.value=settings.textSize;
    wordSpacing.value=settings.wordSpacing;
    lineSpacing.value=settings.lineSpacing;

    cornerRadius.value=settings.cornerRadius;

    themeSelect.value=settings.theme;

    refreshRate.value=settings.refreshRate;

    showTimestamps.value=
        String(settings.showTimestamps);

    compactMessages.value=
        String(settings.compactMessages);

    enterToSend.value=
        String(settings.enterToSend);

    autoScroll.value=
        String(settings.autoScroll);

    confirmDelete.value=
        String(settings.confirmDelete);

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

}


function applyTheme(name){

    const themes={

        dark:["#090b0e","#111419"],
        midnight:["#080b14","#101522"],
        slate:["#101418","#171d22"],
        black:["#000","#090909"],
        blue:["#091018","#101c29"],
        purple:["#100b17","#191021"],
        green:["#09120d","#101b15"],
        red:["#140b0b","#1e1111"],
        gray:["#151515","#202020"],
        light:["#eeeeee","#fff"],
        oled:["#000","#000"]

    };

    const t=
        themes[name]||
        themes.dark;

    document.documentElement.style
        .setProperty(
            "--bg",
            t[0]
        );

    document.documentElement.style
        .setProperty(
            "--panel",
            t[1]
        );

}


function applySettings(){

    document.documentElement.style
        .setProperty(
            "--text-size",
            settings.textSize+"px"
        );

    document.documentElement.style
        .setProperty(
            "--word-spacing",
            settings.wordSpacing+"px"
        );

    document.documentElement.style
        .setProperty(
            "--line-spacing",
            settings.lineSpacing
        );

    document.documentElement.style
        .setProperty(
            "--radius",
            settings.cornerRadius+"px"
        );

    applyTheme(settings.theme);

    renderMessages();

    startRefreshTimer();

}


saveSettings.onclick=()=>{

    settings.username=
        usernameInput.value
        .trim()
        .substring(0,24);

    settings.textSize=
        Number(textSize.value);

    settings.wordSpacing=
        Number(wordSpacing.value);

    settings.lineSpacing=
        Number(lineSpacing.value);

    settings.cornerRadius=
        Number(cornerRadius.value);

    settings.theme=
        themeSelect.value;

    settings.refreshRate=
        Number(refreshRate.value);

    settings.showTimestamps=
        showTimestamps.value==="true";

    settings.compactMessages=
        compactMessages.value==="true";

    settings.enterToSend=
        enterToSend.value==="true";

    settings.autoScroll=
        autoScroll.value==="true";

    settings.confirmDelete=
        confirmDelete.value==="true";

    for(const key of Object.keys(settings)){

        localStorage.setItem(
            "chat_"+key,
            settings[key]
        );

    }

    applySettings();

    closeWindow(settingsWindow);

};


[
    textSize,
    wordSpacing,
    lineSpacing,
    cornerRadius
].forEach(
    element=>{
        element.oninput=
            updateRangeLabels;
    }
);


document.querySelectorAll(
    ".category-title"
).forEach(button=>{

    button.onclick=()=>{

        button.parentElement
            .classList
            .toggle("open");

    };

});


/* =========================================================
DELETE EVERYTHING
========================================================= */

removeEverything.onclick=()=>{

    showConfirm(
        "Remove everything",
        "This will permanently remove every chat message. Continue?",
        async()=>{

            try{

                await apiRequest(
                    "DELETE",
                    {
                        delete_all:true
                    }
                );

                await loadMessages();

            }catch(error){

                alert(error.message);

            }

        }
    );

};


/* =========================================================
DIALOG
========================================================= */

function showConfirm(
    title,
    text,
    callback
){

    dialogTitle.textContent=title;

    dialogText.textContent=text;

    confirmCallback=callback;

    dialogOverlay.classList.add("show");

}


dialogCancel.onclick=()=>{

    dialogOverlay.classList.remove(
        "show"
    );

    confirmCallback=null;

};


dialogConfirm.onclick=async()=>{

    const callback=
        confirmCallback;

    dialogOverlay.classList.remove(
        "show"
    );

    confirmCallback=null;

    if(callback)
        await callback();

};


/* =========================================================
IMAGE VIEWER
========================================================= */

backImage.onclick=()=>{
    imageViewer.classList.remove("show");
    fullImage.src="";
};

imageViewer.onclick=e=>{

    if(e.target===imageViewer){

        imageViewer.classList.remove(
            "show"
        );

        fullImage.src="";

    }

};


/* =========================================================
REFRESH
========================================================= */

function startRefreshTimer(){

    if(refreshTimer)
        clearInterval(refreshTimer);

    refreshTimer=
        setInterval(
            loadMessages,
            Math.max(
                100,
                Number(settings.refreshRate)||1000
            )
        );

}


document.addEventListener(
    "visibilitychange",
    ()=>{

        if(
            document.visibilityState===
            "visible"
        ){

            loadMessages();

        }

    }
);


/* =========================================================
HELPERS
========================================================= */

function escapeHtml(value){

    return String(value??"")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


/* =========================================================
INITIALIZE
========================================================= */

loadSettingsUI();
applySettings();
loadMessages();
startRefreshTimer();