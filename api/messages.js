<script>
/* =========================================================
   CHAT + CONNECTED MINIGAMES
   ========================================================= */

const API_URL = "/api/messages";
const CHANNEL = "general";
const GAME_PREFIX = "__CHAT_GAME__";

/* =========================================================
   DEVICE ID
   ========================================================= */

let deviceId = localStorage.getItem("chat_device_id");

if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("chat_device_id", deviceId);
}

/* =========================================================
   SETTINGS
   ========================================================= */

const defaults = {
    username: "",
    theme: "dark",
    refreshRate: 500,
    showTimestamps: true,
    compactMessages: false,
    textSize: 16,
    wordSpacing: 0,
    lineSpacing: 1.45,
    cornerRadius: 12,
    uiScale: 1,
    enterToSend: true,
    autoScroll: true,
    confirmDelete: true
};

function getSetting(key) {
    const value = localStorage.getItem("chat_" + key);

    if (value === null)
        return defaults[key];

    if (value === "true")
        return true;

    if (value === "false")
        return false;

    const number = Number(value);

    return Number.isNaN(number) ? value : number;
}

let settings = {};

Object.keys(defaults).forEach(key => {
    settings[key] = getSetting(key);
});

/* =========================================================
   ELEMENTS
   ========================================================= */

const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const attachBtn = document.getElementById("attachBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const closeSettings = document.getElementById("closeSettings");
const saveSettings = document.getElementById("saveSettings");

const usernameInput = document.getElementById("usernameInput");
const deviceIdInput = document.getElementById("deviceIdInput");

const textSize = document.getElementById("textSize");
const wordSpacing = document.getElementById("wordSpacing");
const lineSpacing = document.getElementById("lineSpacing");

const textSizeValue = document.getElementById("textSizeValue");
const wordSpacingValue = document.getElementById("wordSpacingValue");
const lineSpacingValue = document.getElementById("lineSpacingValue");

const cornerRadius = document.getElementById("cornerRadius");
const cornerRadiusValue = document.getElementById("cornerRadiusValue");

const uiScale = document.getElementById("uiScale");
const uiScaleValue = document.getElementById("uiScaleValue");

const themeSelect = document.getElementById("themeSelect");
const refreshRate = document.getElementById("refreshRate");
const showTimestamps = document.getElementById("showTimestamps");
const compactMessages = document.getElementById("compactMessages");
const enterToSend = document.getElementById("enterToSend");
const autoScroll = document.getElementById("autoScroll");
const confirmDelete = document.getElementById("confirmDelete");

const contextMenu = document.getElementById("contextMenu");
const editMessageBtn = document.getElementById("editMessage");
const deleteMessageBtn = document.getElementById("deleteMessage");

const imageViewer = document.getElementById("imageViewer");
const fullImage = document.getElementById("fullImage");
const backImage = document.getElementById("backImage");

const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogText = document.getElementById("dialogText");
const dialogCancel = document.getElementById("dialogCancel");
const dialogConfirm = document.getElementById("dialogConfirm");

const removeEverything = document.getElementById("removeEverything");

const gamesBtn = document.getElementById("gamesBtn");
const gamesOverlay = document.getElementById("gamesOverlay");
const closeGames = document.getElementById("closeGames");

const gameCreator = document.getElementById("gameCreator");
const gameSetup = document.getElementById("gameSetup");

const selectedGameName = document.getElementById("selectedGameName");
const maxPlayers = document.getElementById("maxPlayers");

const cancelGameSetup = document.getElementById("cancelGameSetup");
const createGame = document.getElementById("createGame");

/* =========================================================
   VARIABLES
   ========================================================= */

let selectedGameType = null;
let selectedMessage = null;
let selectedFile = null;

let currentMessages = [];
let refreshTimer = null;
let confirmCallback = null;

let games = {};
let myJoinedGames = new Set();
let myHostedGame = null;

/* =========================================================
   GAME INFO
   ========================================================= */

const GAME_INFO = {

    tictactoe: {
        name: "Tic Tac Toe",
        icon: "❌",
        min: 2,
        max: 2
    },

    connect4: {
        name: "Connect Four",
        icon: "🔴",
        min: 2,
        max: 2
    },

    dice: {
        name: "Dice Duel",
        icon: "🎲",
        min: 2,
        max: 8
    },

    reaction: {
        name: "Reaction",
        icon: "⚡",
        min: 2,
        max: 8
    },

    board: {
        name: "Board Race",
        icon: "♟️",
        min: 2,
        max: 8
    }
};

/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettingsUI() {

    usernameInput.value = settings.username;
    deviceIdInput.value = deviceId;

    textSize.value = settings.textSize;
    wordSpacing.value = settings.wordSpacing;
    lineSpacing.value = settings.lineSpacing;

    cornerRadius.value = settings.cornerRadius;
    uiScale.value = settings.uiScale;

    themeSelect.value = settings.theme;
    refreshRate.value = settings.refreshRate;

    showTimestamps.value =
        String(settings.showTimestamps);

    compactMessages.value =
        String(settings.compactMessages);

    enterToSend.value =
        String(settings.enterToSend);

    autoScroll.value =
        String(settings.autoScroll);

    confirmDelete.value =
        String(settings.confirmDelete);

    updateRangeLabels();
}

function updateRangeLabels() {

    textSizeValue.textContent =
        textSize.value + "px";

    wordSpacingValue.textContent =
        wordSpacing.value + "px";

    lineSpacingValue.textContent =
        lineSpacing.value;

    cornerRadiusValue.textContent =
        cornerRadius.value + "px";

    uiScaleValue.textContent =
        Math.round(
            Number(uiScale.value) * 100
        ) + "%";
}

function applyTheme(name) {

    const themes = {

        dark: ["#0b0d10", "#111419"],
        midnight: ["#080b14", "#101522"],
        slate: ["#101418", "#171d22"],
        black: ["#000000", "#090909"],
        blue: ["#091018", "#101c29"],
        purple: ["#100b17", "#191021"],
        green: ["#09120d", "#101b15"],
        red: ["#140b0b", "#1e1111"],
        gray: ["#151515", "#202020"],
        light: ["#eeeeee", "#ffffff"],
        oled: ["#000000", "#000000"]
    };

    const theme =
        themes[name] || themes.dark;

    document.documentElement.style
        .setProperty("--bg", theme[0]);

    document.documentElement.style
        .setProperty("--panel", theme[1]);

    document.body.style.background =
        theme[0];
}

function applySettings() {

    document.documentElement.style
        .setProperty(
            "--text-size",
            settings.textSize + "px"
        );

    document.documentElement.style
        .setProperty(
            "--word-spacing",
            settings.wordSpacing + "px"
        );

    document.documentElement.style
        .setProperty(
            "--line-spacing",
            settings.lineSpacing
        );

    document.documentElement.style
        .setProperty(
            "--radius",
            settings.cornerRadius + "px"
        );

    document.documentElement.style
        .setProperty(
            "--ui-scale",
            settings.uiScale
        );

    applyTheme(settings.theme);

    renderMessages();
    startRefreshTimer();
}

/* =========================================================
   SETTINGS EVENTS
   ========================================================= */

settingsBtn.onclick = () => {

    loadSettingsUI();

    settingsOverlay.classList.add("show");
};

closeSettings.onclick = () => {
    settingsOverlay.classList.remove("show");
};

saveSettings.onclick = () => {

    settings.username =
        usernameInput.value
            .trim()
            .substring(0, 24);

    settings.textSize =
        Number(textSize.value);

    settings.wordSpacing =
        Number(wordSpacing.value);

    settings.lineSpacing =
        Number(lineSpacing.value);

    settings.cornerRadius =
        Number(cornerRadius.value);

    settings.uiScale =
        Number(uiScale.value);

    settings.theme =
        themeSelect.value;

    settings.refreshRate =
        Number(refreshRate.value);

    settings.showTimestamps =
        showTimestamps.value === "true";

    settings.compactMessages =
        compactMessages.value === "true";

    settings.enterToSend =
        enterToSend.value === "true";

    settings.autoScroll =
        autoScroll.value === "true";

    settings.confirmDelete =
        confirmDelete.value === "true";

    Object.keys(settings).forEach(key => {

        localStorage.setItem(
            "chat_" + key,
            settings[key]
        );

    });

    applySettings();

    settingsOverlay.classList.remove("show");
};

[
    textSize,
    wordSpacing,
    lineSpacing,
    cornerRadius,
    uiScale
].forEach(element => {

    element.oninput =
        updateRangeLabels;

});

/* =========================================================
   CATEGORY BUTTONS
   ========================================================= */

document.querySelectorAll(".category-title")
.forEach(button => {

    button.onclick = () => {

        button.parentElement
            .classList
            .toggle("open");

    };

});

/* =========================================================
   API
   ========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            options
        );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            data.message ||
            "Server request failed."
        );
    }

    return data;
}

/* =========================================================
   SEND NORMAL MESSAGE
   ========================================================= */

async function sendMessage() {

    const text =
        messageInput.value.trim();

    if (!text && !selectedFile)
        return;

    const username =
        settings.username ||
        "Anonymous";

    sendBtn.disabled = true;

    try {

        let image = null;

        /*
         If your API accepts a URL/string for image,
         this sends the selected image as a data URL.
        */

        if (selectedFile) {

            image =
                await fileToDataURL(
                    selectedFile
                );
        }

        await apiRequest(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username,

                    channel: CHANNEL,

                    message: text,

                    image,

                    device_id: deviceId

                })
            }
        );

        messageInput.value = "";

        selectedFile = null;
        imageInput.value = "";

        await loadMessages();

    } catch (error) {

        console.error(error);

        alert(
            "Could not send message:\n\n" +
            error.message
        );

    } finally {

        sendBtn.disabled = false;

    }
}

sendBtn.onclick = sendMessage;

messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            settings.enterToSend
        ) {

            event.preventDefault();

            sendMessage();
        }

    }
);

messageInput.addEventListener(
    "input",
    () => {

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                150
            ) + "px";

    }
);

/* =========================================================
   IMAGE
   ========================================================= */

attachBtn.onclick = () => {
    imageInput.click();
};

imageInput.onchange = () => {

    if (imageInput.files.length) {

        selectedFile =
            imageInput.files[0];

    }

};

function fileToDataURL(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload = () =>
                resolve(reader.result);

            reader.onerror =
                reject;

            reader.readAsDataURL(file);

        }
    );
}

/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages() {

    try {

        const data =
            await apiRequest(
                API_URL +
                "?channel=" +
                encodeURIComponent(CHANNEL)
            );

        let messages = [];

        if (Array.isArray(data))
            messages = data;

        else if (Array.isArray(data.messages))
            messages = data.messages;

        else if (Array.isArray(data.data))
            messages = data.data;

        currentMessages =
            messages.sort(
                (a, b) =>
                    new Date(a.created_at || a.createdAt || 0) -
                    new Date(b.created_at || b.createdAt || 0)
            );

        refreshGameData();

        renderMessages();

    } catch (error) {

        console.error(
            "Could not load messages:",
            error
        );

    }

}

/* =========================================================
   GAME STATE PARSER
   ========================================================= */

function parseGameMessage(message) {

    if (
        !message ||
        typeof message.message !== "string"
    )
        return null;

    if (
        !message.message.startsWith(
            GAME_PREFIX
        )
    )
        return null;

    try {

        return JSON.parse(
            message.message.substring(
                GAME_PREFIX.length
            )
        );

    } catch {

        return null;
    }
}

/* =========================================================
   GAME DATA
   ========================================================= */

function refreshGameData() {

    const oldGames = games;

    games = {};

    currentMessages.forEach(message => {

        const state =
            parseGameMessage(message);

        if (!state)
            return;

        if (!state.game_id)
            return;

        /*
         Every game state is stored as a chat
         message. The newest state wins.
        */

        games[state.game_id] = {

            ...state,

            message_id: message.id,

            source_message: message

        };

    });

    /*
     Remove games explicitly finished.
    */

    Object.keys(games).forEach(id => {

        if (games[id].finished) {

            delete games[id];

            return;
        }

        if (
            !games[id].players ||
            games[id].players.length === 0
        ) {

            delete games[id];

        }

    });

    myHostedGame = null;

    Object.values(games).forEach(game => {

        if (
            game.host_device_id ===
            deviceId
        ) {

            myHostedGame =
                game.game_id;

            myJoinedGames.add(
                game.game_id
            );

        }

    });

    /*
     Remember games that disappeared.
    */

    Object.keys(oldGames).forEach(id => {

        if (!games[id]) {

            myJoinedGames.delete(id);

        }

    });
}

/* =========================================================
   WRITE GAME STATE
   ========================================================= */

async function writeGameState(state) {

    const encoded =
        GAME_PREFIX +
        JSON.stringify(state);

    const data =
        await apiRequest(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    username:
                        "🎮 " +
                        (state.host_name ||
                            settings.username ||
                            "Game"),

                    channel: CHANNEL,

                    message: encoded,

                    image: null,

                    /*
                     IMPORTANT:
                     Use the real host device ID here.
                     This makes the game behave like a
                     normal chat-connected object.
                    */

                    device_id:
                        state.host_device_id

                })
            }
        );

    return data;
}

/* =========================================================
   CREATE GAME
   ========================================================= */

createGame.onclick = async () => {

    if (!settings.username) {

        gamesOverlay.classList.remove(
            "show"
        );

        settingsBtn.click();

        alert(
            "Set your name before hosting a game."
        );

        return;
    }

    if (!selectedGameType)
        return;

    /*
     Make absolutely sure we don't host two games.
    */

    refreshGameData();

    const existingGame =
        Object.values(games).find(
            game =>
                game.host_device_id ===
                    deviceId &&
                !game.finished
        );

    if (existingGame) {

        myHostedGame =
            existingGame.game_id;

        alert(
            "You are already hosting a game."
        );

        gamesOverlay.classList.remove(
            "show"
        );

        return;
    }

    const info =
        GAME_INFO[selectedGameType];

    const max =
        Number(maxPlayers.value);

    if (
        !Number.isFinite(max) ||
        max < info.min ||
        max > info.max
    ) {

        alert(
            "Invalid player count."
        );

        return;
    }

    const gameId =
        crypto.randomUUID();

    const state = {

        type: "game",

        action: "create",

        game_id: gameId,

        game_type:
            selectedGameType,

        host_device_id:
            deviceId,

        host_name:
            settings.username,

        max_players:
            max,

        players: [

            {
                device_id:
                    deviceId,

                username:
                    settings.username
            }

        ],

        started: false,

        finished: false,

        turn_index: 0,

        board:
            createInitialBoard(
                selectedGameType
            ),

        values: {},

        winner: null,

        created_at:
            Date.now(),

        updated_at:
            Date.now()

    };

    try {

        /*
         Write the game directly into chat.
        */

        await writeGameState(state);

        myHostedGame = gameId;

        myJoinedGames.add(
            gameId
        );

        /*
         Close creator.
        */

        gameSetup.style.display =
            "none";

        gameCreator.style.display =
            "block";

        gamesOverlay.classList.remove(
            "show"
        );

        /*
         Immediately reload chat so the
         game card appears.
        */

        await loadMessages();

        /*
         Scroll to the new game.
        */

        messagesEl.scrollTop =
            messagesEl.scrollHeight;

    } catch (error) {

        console.error(
            "HOST GAME ERROR:",
            error
        );

        myHostedGame = null;

        alert(
            "Could not host game:\n\n" +
            error.message
        );

    }

};

/* =========================================================
   GAME MENU
   ========================================================= */

gamesBtn.onclick = () => {

    refreshGameData();

    gamesOverlay.classList.add(
        "show"
    );

};

closeGames.onclick = () => {

    gamesOverlay.classList.remove(
        "show"
    );

};

document.querySelectorAll(
    ".game-choice"
).forEach(button => {

    button.onclick = () => {

        const type =
            button.dataset.game;

        selectedGameType = type;

        const info =
            GAME_INFO[type];

        selectedGameName.value =
            info.icon +
            " " +
            info.name;

        maxPlayers.innerHTML = "";

        for (
            let i = info.min;
            i <= info.max;
            i++
        ) {

            const option =
                document.createElement(
                    "option"
                );

            option.value = i;

            option.textContent =
                i + " players";

            maxPlayers.appendChild(
                option
            );
        }

        gameCreator.style.display =
            "none";

        gameSetup.style.display =
            "block";

    };

});

cancelGameSetup.onclick = () => {

    gameSetup.style.display =
        "none";

    gameCreator.style.display =
        "block";

};

/* =========================================================
   GENERIC GAME ACTION
   ========================================================= */

async function gameAction(
    game,
    action,
    extra = {}
) {

    if (!game)
        return;

    const state = {

        ...game,

        ...extra,

        action,

        previous_message_id:
            game.message_id,

        updated_at:
            Date.now()

    };

    delete state.message_id;
    delete state.source_message;

    if (
        action === "start" &&
        state.players.length <
            GAME_INFO[
                state.game_type
            ].min
    ) {

        alert(
            "You need at least " +
            GAME_INFO[
                state.game_type
            ].min +
            " players."
        );

        return;
    }

    try {

        await writeGameState(
            state
        );

        await loadMessages();

    } catch (error) {

        console.error(error);

        alert(
            "Game update failed:\n\n" +
            error.message
        );

    }

}

/* =========================================================
   JOIN GAME
   ========================================================= */

async function joinGame(game) {

    if (!settings.username) {

        settingsOverlay.classList.add(
            "show"
        );

        alert(
            "Set your name before joining a game."
        );

        return;
    }

    if (game.started) {

        alert(
            "This game has already started."
        );

        return;
    }

    if (
        game.players.some(
            player =>
                player.device_id ===
                deviceId
        )
    ) {

        myJoinedGames.add(
            game.game_id
        );

        return;
    }

    if (
        game.players.length >=
        game.max_players
    ) {

        alert(
            "This game is full."
        );

        return;
    }

    const players = [
        ...game.players,

        {
            device_id:
                deviceId,

            username:
                settings.username
        }

    ];

    try {

        myJoinedGames.add(
            game.game_id
        );

        await gameAction(
            game,
            "join",
            {
                players
            }
        );

    } catch {

        myJoinedGames.delete(
            game.game_id
        );

    }

}

/* =========================================================
   LEAVE GAME
   ========================================================= */

async function leaveGame(game) {

    if (!game)
        return;

    if (
        game.host_device_id ===
        deviceId
    ) {

        await forceQuitGame(
            game
        );

        return;
    }

    const players =
        game.players.filter(
            player =>
                player.device_id !==
                deviceId
        );

    if (!players.length) {

        await forceQuitGame(
            game
        );

        return;
    }

    await gameAction(
        game,
        "leave",
        {
            players
        }
    );

    myJoinedGames.delete(
        game.game_id
    );

}

/* =========================================================
   START GAME
   ========================================================= */

async function startGame(game) {

    if (
        game.host_device_id !==
        deviceId
    ) {

        alert(
            "Only the host can start the game."
        );

        return;
    }

    const min =
        GAME_INFO[
            game.game_type
        ].min;

    if (
        game.players.length <
        min
    ) {

        alert(
            "You need at least " +
            min +
            " players."
        );

        return;
    }

    await gameAction(
        game,
        "start",
        {
            started: true,
            turn_index: 0,
            started_at: Date.now()
        }
    );

}

/* =========================================================
   FORCE QUIT
   ========================================================= */

async function forceQuitGame(game) {

    if (!game)
        return;

    if (
        game.host_device_id !==
        deviceId
    ) {

        alert(
            "Only the host can force quit this game."
        );

        return;
    }

    try {

        /*
         Send a finished state first.
         Every client immediately hides it.
        */

        const finished = {

            ...game,

            finished: true,

            action:
                "force_quit",

            players: [],

            updated_at:
                Date.now()

        };

        delete finished.message_id;
        delete finished.source_message;

        await writeGameState(
            finished
        );

        myHostedGame = null;

        myJoinedGames.delete(
            game.game_id
        );

        delete games[
            game.game_id
        ];

        await loadMessages();

    } catch (error) {

        alert(
            "Could not close game:\n\n" +
            error.message
        );

    }

}

/* =========================================================
   INITIAL BOARDS
   ========================================================= */

function createInitialBoard(type) {

    if (type === "tictactoe")
        return Array(9).fill("");

    if (type === "connect4")
        return Array(42).fill("");

    if (type === "board")
        return Array(25).fill("");

    return [];
}

/* =========================================================
   TURN
   ========================================================= */

function getCurrentPlayer(game) {

    if (
        !game.players ||
        !game.players.length
    )
        return null;

    return game.players[
        game.turn_index %
        game.players.length
    ];
}

function isMyTurn(game) {

    const player =
        getCurrentPlayer(game);

    return !!player &&
        player.device_id ===
            deviceId;
}

function nextTurn(game) {

    return (
        game.turn_index + 1
    ) % game.players.length;
}

/* =========================================================
   TIC TAC TOE
   ========================================================= */

async function playTicTacToe(
    game,
    index
) {

    if (!game.started)
        return;

    if (!isMyTurn(game))
        return;

    if (game.board[index])
        return;

    const board = [
        ...game.board
    ];

    const symbol =
        game.turn_index % 2 === 0
            ? "X"
            : "O";

    board[index] = symbol;

    const winner =
        checkTicTacToe(
            board
        );

    if (winner) {

        await gameAction(
            game,
            "finish",
            {
                board,
                finished: true,
                winner
            }
        );

        return;
    }

    if (
        board.every(
            cell => cell
        )
    ) {

        await gameAction(
            game,
            "finish",
            {
                board,
                finished: true,
                winner: "draw"
            }
        );

        return;
    }

    await gameAction(
        game,
        "move",
        {
            board,

            turn_index:
                nextTurn(game)
        }
    );

}

function checkTicTacToe(
    board
) {

    const lines = [

        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]

    ];

    for (
        const line of lines
    ) {

        const [
            a,
            b,
            c
        ] = line;

        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        )
            return board[a];

    }

    return null;
}

/* =========================================================
   CONNECT FOUR
   ========================================================= */

async function playConnect4(
    game,
    column
) {

    if (!game.started)
        return;

    if (!isMyTurn(game))
        return;

    const board = [
        ...game.board
    ];

    const rows = 6;
    const columns = 7;

    let placed = -1;

    for (
        let row = rows - 1;
        row >= 0;
        row--
    ) {

        const index =
            row * columns +
            column;

        if (!board[index]) {

            placed = index;

            break;
        }
    }

    if (placed === -1)
        return;

    const symbol =
        game.turn_index % 2 === 0
            ? "🔴"
            : "🟡";

    board[placed] = symbol;

    const winner =
        checkConnect4(
            board,
            placed
        );

    if (winner) {

        await gameAction(
            game,
            "finish",
            {
                board,
                finished: true,
                winner
            }
        );

        return;
    }

    if (
        board.every(
            cell => cell
        )
    ) {

        await gameAction(
            game,
            "finish",
            {
                board,
                finished: true,
                winner: "draw"
            }
        );

        return;
    }

    await gameAction(
        game,
        "move",
        {
            board,
            turn_index:
                nextTurn(game)
        }
    );
}

function checkConnect4(
    board,
    index
) {

    const cols = 7;

    const row =
        Math.floor(
            index / cols
        );

    const col =
        index % cols;

    const player =
        board[index];

    if (!player)
        return null;

    const directions = [

        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]

    ];

    for (
        const [
            dx,
            dy
        ] of directions
    ) {

        let count = 1;

        count +=
            countDirection(
                board,
                row,
                col,
                dx,
                dy,
                player
            );

        count +=
            countDirection(
                board,
                row,
                col,
                -dx,
                -dy,
                player
            );

        if (count >= 4)
            return player;
    }

    return null;
}

function countDirection(
    board,
    row,
    col,
    dx,
    dy,
    player
) {

    let count = 0;

    let r =
        row + dy;

    let c =
        col + dx;

    while (
        r >= 0 &&
        r < 6 &&
        c >= 0 &&
        c < 7
    ) {

        const value =
            board[
                r * 7 + c
            ];

        if (value !== player)
            break;

        count++;

        r += dy;
        c += dx;
    }

    return count;
}

/* =========================================================
   DICE
   ========================================================= */

async function rollDice(game) {

    if (!game.started)
        return;

    if (!isMyTurn(game))
        return;

    const roll =
        Math.floor(
            Math.random() * 6
        ) + 1;

    const values = {
        ...(game.values || {})
    };

    values[deviceId] = roll;

    const allPlayersRolled =
        game.players.every(
            player =>
                values[
                    player.device_id
                ]
        );

    if (allPlayersRolled) {

        let winner = null;
        let highest = -1;

        game.players.forEach(
            player => {

                const value =
                    values[
                        player.device_id
                    ];

                if (value > highest) {

                    highest = value;

                    winner =
                        player.username;
                }

            }
        );

        await gameAction(
            game,
            "finish",
            {
                values,
                finished: true,
                winner
            }
        );

        return;
    }

    await gameAction(
        game,
        "roll",
        {
            values,
            turn_index:
                nextTurn(game)
        }
    );
}

/* =========================================================
   REACTION GAME
   ========================================================= */

async function reactionReady(
    game
) {

    if (!game.started)
        return;

    if (
        game.reactionWinner
    )
        return;

    const values = {
        ...(game.values || {})
    };

    values.ready = true;

    await gameAction(
        game,
        "reaction_ready",
        {
            values,
            reactionStart:
                Date.now() +
                1500 +
                Math.floor(
                    Math.random() *
                    2500
                )
        }
    );
}

async function reactionClick(
    game
) {

    if (!game.started)
        return;

    if (
        game.reactionWinner
    )
        return;

    if (
        !game.reactionStart
    )
        return;

    const now = Date.now();

    if (
        now <
        game.reactionStart
    ) {

        alert(
            "Too early!"
        );

        return;
    }

    const reactionTime =
        now -
        game.reactionStart;

    await gameAction(
        game,
        "reaction_win",
        {
            reactionWinner:
                settings.username,

            reactionDevice:
                deviceId,

            reactionTime,

            finished: true,

            winner:
                settings.username
        }
    );
}

/* =========================================================
   BOARD RACE
   ========================================================= */

async function boardMove(
    game
) {

    if (!game.started)
        return;

    if (!isMyTurn(game))
        return;

    const positions = {
        ...(game.values || {})
    };

    const oldPosition =
        Number(
            positions[
                deviceId
            ] || 0
        );

    const roll =
        Math.floor(
            Math.random() * 6
        ) + 1;

    const newPosition =
        Math.min(
            24,
            oldPosition + roll
        );

    positions[deviceId] =
        newPosition;

    const player =
        game.players.find(
            p =>
                p.device_id ===
                deviceId
        );

    if (
        newPosition >= 24
    ) {

        await gameAction(
            game,
            "finish",
            {
                values: positions,

                finished: true,

                winner:
                    player
                        ? player.username
                        : settings.username
            }
        );

        return;
    }

    await gameAction(
        game,
        "move",
        {
            values: positions,

            turn_index:
                nextTurn(game)
        }
    );
}

/* =========================================================
   RENDER CHAT
   ========================================================= */

function renderMessages() {

    const wasAtBottom =
        messagesEl.scrollHeight -
        messagesEl.scrollTop -
        messagesEl.clientHeight <
        100;

    messagesEl.innerHTML = "";

    if (!currentMessages.length) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty";

        empty.innerHTML =
            "<div>" +
            "<strong>No messages yet</strong>" +
            "Start the conversation." +
            "</div>";

        messagesEl.appendChild(
            empty
        );

        return;
    }

    currentMessages.forEach(
        message => {

            const game =
                parseGameMessage(
                    message
                );

            /*
             Game messages are rendered
             directly inside the chat.
            */

            if (game) {

                if (!game.finished)
                    renderGameCard(
                        game
                    );

                return;
            }

            renderNormalMessage(
                message
            );

        }
    );

    if (
        settings.autoScroll &&
        wasAtBottom
    ) {

        messagesEl.scrollTop =
            messagesEl.scrollHeight;
    }
}

/* =========================================================
   NORMAL MESSAGE
   ========================================================= */

function renderNormalMessage(
    message
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message";

    if (settings.compactMessages)
        wrapper.style.marginBottom =
            "7px";

    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "avatar";

    const username =
        message.username ||
        "Unknown";

    avatar.textContent =
        username
            .charAt(0)
            .toUpperCase();

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "message-content";

    const top =
        document.createElement(
            "div"
        );

    top.className =
        "message-top";

    const name =
        document.createElement(
            "span"
        );

    name.className =
        "username";

    name.textContent =
        username;

    top.appendChild(name);

    if (
        settings.showTimestamps
    ) {

        const time =
            document.createElement(
                "span"
            );

        time.className =
            "time";

        time.textContent =
            formatTime(
                message.created_at
            );

        top.appendChild(time);

    }

    if (message.edited) {

        const edited =
            document.createElement(
                "span"
            );

        edited.className =
            "edited";

        edited.textContent =
            "(edited)";

        top.appendChild(
            edited
        );
    }

    content.appendChild(
        top
    );

    if (message.message) {

        const text =
            document.createElement(
                "div"
            );

        text.className =
            "message-text";

        renderTextWithLinks(
            text,
            message.message
        );

        content.appendChild(
            text
        );

    }

    if (message.image) {

        const image =
            document.createElement(
                "img"
            );

        image.className =
            "message-image";

        image.src =
            message.image;

        image.loading =
            "lazy";

        image.onclick = () => {

            fullImage.src =
                image.src;

            imageViewer.classList.add(
                "show"
            );

        };

        content.appendChild(
            image
        );
    }

    wrapper.appendChild(
        avatar
    );

    wrapper.appendChild(
        content
    );

    /*
     Right-click your own messages
     for edit/delete.
    */

    if (
        message.device_id ===
        deviceId
    ) {

        wrapper.addEventListener(
            "contextmenu",
            event => {

                event.preventDefault();

                selectedMessage =
                    message;

                showContextMenu(
                    event.clientX,
                    event.clientY
                );

            }
        );

    }

    messagesEl.appendChild(
        wrapper
    );
}

/* =========================================================
   LINKS
   ========================================================= */

function renderTextWithLinks(
    element,
    text
) {

    const urlRegex =
        /(https?:\/\/[^\s]+)/g;

    const parts =
        text.split(urlRegex);

    parts.forEach(
        part => {

            if (
                /^https?:\/\//i
                .test(part)
            ) {

                const link =
                    document.createElement(
                        "a"
                    );

                link.className =
                    "message-link";

                link.href =
                    part;

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

                link.textContent =
                    part;

                element.appendChild(
                    link
                );

            } else {

                element.appendChild(
                    document.createTextNode(
                        part
                    )
                );

            }

        }
    );
}

/* =========================================================
   GAME CARD
   ========================================================= */

function renderGameCard(
    game
) {

    const info =
        GAME_INFO[
            game.game_type
        ];

    if (!info)
        return;

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message";

    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "avatar";

    avatar.textContent =
        info.icon;

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "message-content";

    const top =
        document.createElement(
            "div"
        );

    top.className =
        "message-top";

    const username =
        document.createElement(
            "span"
        );

    username.className =
        "username";

    username.textContent =
        game.host_name +
        " started a game";

    top.appendChild(
        username
    );

    if (settings.showTimestamps) {

        const time =
            document.createElement(
                "span"
            );

        time.className =
            "time";

        time.textContent =
            formatTime(
                game.created_at
            );

        top.appendChild(
            time
        );
    }

    content.appendChild(
        top
    );

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "game-card";

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "game-card-header";

    const title =
        document.createElement(
            "div"
        );

    title.className =
        "game-title";

    title.innerHTML =
        `<div class="game-icon">${info.icon}</div>` +
        `<div>${escapeHTML(info.name)}</div>`;

    const status =
        document.createElement(
            "div"
        );

    status.className =
        "game-status";

    status.textContent =
        game.started
            ? "In progress"
            : "Waiting for players";

    header.appendChild(
        title
    );

    header.appendChild(
        status
    );

    card.appendChild(
        header
    );

    const body =
        document.createElement(
            "div"
        );

    body.className =
        "game-body";

    const description =
        document.createElement(
            "div"
        );

    description.className =
        "game-description";

    description.textContent =
        game.started
            ? "Play directly from the chat."
            : "Join the game below.";

    body.appendChild(
        description
    );

    const players =
        document.createElement(
            "div"
        );

    players.className =
        "game-players";

    const playerText =
        document.createElement(
            "span"
        );

    playerText.textContent =
        "👥 " +
        game.players.length +
        "/" +
        game.max_players +
        " players";

    players.appendChild(
        playerText
    );

    body.appendChild(
        players
    );

    const buttons =
        document.createElement(
            "div"
        );

    buttons.className =
        "game-buttons";

    const alreadyJoined =
        game.players.some(
            player =>
                player.device_id ===
                deviceId
        );

    if (!game.started) {

        if (!alreadyJoined) {

            const join =
                createGameButton(
                    "Join",
                    "primary"
                );

            join.onclick = () =>
                joinGame(game);

            buttons.appendChild(
                join
            );

        } else {

            const joined =
                createGameButton(
                    "Joined",
                    "success"
                );

            joined.disabled = true;

            buttons.appendChild(
                joined
            );

        }

        if (
            game.host_device_id ===
            deviceId
        ) {

            const start =
                createGameButton(
                    "Start game",
                    "primary"
                );

            start.onclick = () =>
                startGame(game);

            buttons.appendChild(
                start
            );

        }

    } else {

        renderGameBoard(
            body,
            game
        );

        if (alreadyJoined) {

            const leave =
                createGameButton(
                    "Leave",
                    "danger"
                );

            leave.onclick = () =>
                leaveGame(game);

            buttons.appendChild(
                leave
            );

        }

    }

    if (
        game.host_device_id ===
        deviceId
    ) {

        const quit =
            createGameButton(
                "End game",
                "danger"
            );

        quit.onclick = () =>
            forceQuitGame(game);

        buttons.appendChild(
            quit
        );

    }

    body.appendChild(
        buttons
    );

    card.appendChild(
        body
    );

    content.appendChild(
        card
    );

    wrapper.appendChild(
        avatar
    );

    wrapper.appendChild(
        content
    );

    messagesEl.appendChild(
        wrapper
    );
}

/* =========================================================
   GAME BUTTON
   ========================================================= */

function createGameButton(
    text,
    type = ""
) {

    const button =
        document.createElement(
            "button"
        );

    button.className =
        "game-btn";

    if (type)
        button.classList.add(
            type
        );

    button.textContent =
        text;

    return button;
}

/* =========================================================
   GAME BOARD RENDERER
   ========================================================= */

function renderGameBoard(
    body,
    game
) {

    const board =
        document.createElement(
            "div"
        );

    board.className =
        "game-board";

    const turn =
        document.createElement(
            "div"
        );

    turn.className =
        "turn-bar";

    const current =
        getCurrentPlayer(game);

    if (current) {

        if (
            current.device_id ===
            deviceId
        ) {

            turn.innerHTML =
                "<strong>Your turn</strong>";

        } else {

            turn.innerHTML =
                "<strong>" +
                escapeHTML(
                    current.username
                ) +
                "</strong>'s turn";

        }

    }

    board.appendChild(
        turn
    );

    if (
        game.game_type ===
        "tictactoe"
    ) {

        renderTicTacToeBoard(
            board,
            game
        );

    } else if (
        game.game_type ===
        "connect4"
    ) {

        renderConnect4Board(
            board,
            game
        );

    } else if (
        game.game_type ===
        "dice"
    ) {

        renderDiceBoard(
            board,
            game
        );

    } else if (
        game.game_type ===
        "reaction"
    ) {

        renderReactionBoard(
            board,
            game
        );

    } else if (
        game.game_type ===
        "board"
    ) {

        renderBoardRace(
            board,
            game
        );

    }

    body.appendChild(
        board
    );
}

/* =========================================================
   TIC TAC TOE UI
   ========================================================= */

function renderTicTacToeBoard(
    container,
    game
) {

    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "board";

    grid.style.gridTemplateColumns =
        "repeat(3,58px)";

    for (
        let i = 0;
        i < 9;
        i++
    ) {

        const cell =
            document.createElement(
                "button"
            );

        cell.className =
            "cell";

        cell.textContent =
            game.board[i] || "";

        cell.disabled =
            !isMyTurn(game) ||
            !!game.board[i];

        cell.onclick = () =>
            playTicTacToe(
                game,
                i
            );

        grid.appendChild(
            cell
        );
    }

    container.appendChild(
        grid
    );

}

/* =========================================================
   CONNECT FOUR UI
   ========================================================= */

function renderConnect4Board(
    container,
    game
) {

    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "board-grid";

    grid.style.gridTemplateColumns =
        "repeat(7,40px)";

    grid.style.gridTemplateRows =
        "repeat(6,40px)";

    for (
        let i = 0;
        i < 42;
        i++
    ) {

        const cell =
            document.createElement(
                "button"
            );

        cell.className =
            "board-cell";

        cell.textContent =
            game.board[i] || "";

        const column =
            i % 7;

        cell.onclick = () =>
            playConnect4(
                game,
                column
            );

        cell.disabled =
            !isMyTurn(game);

        grid.appendChild(
            cell
        );
    }

    container.appendChild(
        grid
    );
}

/* =========================================================
   DICE UI
   ========================================================= */

function renderDiceBoard(
    container,
    game
) {

    const result =
        document.createElement(
            "div"
        );

    result.className =
        "dice-result";

    const myRoll =
        game.values &&
        game.values[deviceId];

    result.textContent =
        myRoll ||
        "🎲";

    container.appendChild(
        result
    );

    const info =
        document.createElement(
            "div"
        );

    info.className =
        "game-small";

    info.textContent =
        Object.entries(
            game.values || {}
        )
        .filter(
            ([key]) =>
                key !== "ready"
        )
        .map(
            ([key, value]) => {

                const player =
                    game.players.find(
                        p =>
                            p.device_id ===
                            key
                    );

                return (
                    (player
                        ? player.username
                        : "Player") +
                    ": " +
                    value
                );

            }
        )
        .join(" • ");

    container.appendChild(
        info
    );

    const roll =
        createGameButton(
            "Roll 🎲",
            "primary"
        );

    roll.disabled =
        !isMyTurn(game);

    roll.onclick = () =>
        rollDice(game);

    container.appendChild(
        roll
    );
}

/* =========================================================
   REACTION UI
   ========================================================= */

function renderReactionBoard(
    container,
    game
) {

    const area =
        document.createElement(
            "button"
        );

    area.style.width =
        "100%";

    area.style.minHeight =
        "120px";

    area.style.borderRadius =
        "12px";

    area.style.border =
        "1px solid #343b46";

    area.style.background =
        "#151a20";

    area.style.color =
        "white";

    if (!game.values?.ready) {

        area.textContent =
            "⚡ Get ready";

        area.onclick = () =>
            reactionReady(game);

    } else if (
        Date.now() <
        game.reactionStart
    ) {

        area.textContent =
            "WAIT...";

        area.disabled = true;

    } else {

        area.textContent =
            "CLICK! ⚡";

        area.onclick = () =>
            reactionClick(game);

    }

    container.appendChild(
        area
    );

    const small =
        document.createElement(
            "div"
        );

    small.className =
        "game-small";

    small.textContent =
        "Be the first to click.";

    container.appendChild(
        small
    );
}

/* =========================================================
   BOARD RACE UI
   ========================================================= */

function renderBoardRace(
    container,
    game
) {

    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "board-grid";

    for (
        let i = 0;
        i < 25;
        i++
    ) {

        const cell =
            document.createElement(
                "div"
            );

        cell.className =
            "board-cell";

        const player =
            game.players.find(
                p =>
                    Number(
                        game.values?.[
                            p.device_id
                        ] || 0
                    ) === i
            );

        if (i === 24)
            cell.textContent = "🏁";

        if (player)
            cell.textContent =
                player.device_id ===
                deviceId
                    ? "🟢"
                    : "🔵";

        grid.appendChild(
            cell
        );
    }

    container.appendChild(
        grid
    );

    const roll =
        createGameButton(
            "Roll 🎲",
            "primary"
        );

    roll.disabled =
        !isMyTurn(game);

    roll.onclick = () =>
        boardMove(game);

    container.appendChild(
        roll
    );
}

/* =========================================================
   CONTEXT MENU
   ========================================================= */

function showContextMenu(
    x,
    y
) {

    contextMenu.style.left =
        x + "px";

    contextMenu.style.top =
        y + "px";

    contextMenu.classList.add(
        "show"
    );
}

document.addEventListener(
    "click",
    () => {

        contextMenu.classList.remove(
            "show"
        );

    }
);

editMessageBtn.onclick = () => {

    if (!selectedMessage)
        return;

    const newText =
        prompt(
            "Edit message:",
            selectedMessage.message || ""
        );

    if (
        newText === null ||
        !newText.trim()
    )
        return;

    editMessage(
        selectedMessage,
        newText.trim()
    );

};

deleteMessageBtn.onclick = () => {

    if (!selectedMessage)
        return;

    if (
        settings.confirmDelete
    ) {

        openConfirm(
            "Delete message",
            "Are you sure you want to delete this message?",
            () =>
                deleteMessage(
                    selectedMessage
                )
        );

    } else {

        deleteMessage(
            selectedMessage
        );

    }

};

/* =========================================================
   EDIT
   ========================================================= */

async function editMessage(
    message,
    newText
) {

    try {

        await apiRequest(
            API_URL,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    id: message.id,

                    message: newText,

                    device_id:
                        deviceId

                })
            }
        );

        await loadMessages();

    } catch (error) {

        alert(
            "Could not edit message:\n\n" +
            error.message
        );

    }

}

/* =========================================================
   DELETE
   ========================================================= */

async function deleteMessage(
    message
) {

    try {

        await apiRequest(
            API_URL,
            {
                method: "DELETE",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    id: message.id,

                    device_id:
                        deviceId

                })
            }
        );

        await loadMessages();

    } catch (error) {

        alert(
            "Could not delete message:\n\n" +
            error.message
        );

    }

}

/* =========================================================
   REMOVE EVERYTHING
   ========================================================= */

removeEverything.onclick = () => {

    openConfirm(
        "Remove everything",
        "This will remove every message from the chat. Continue?",
        removeAllMessages
    );

};

async function removeAllMessages() {

    try {

        for (
            const message
            of currentMessages
        ) {

            try {

                await apiRequest(
                    API_URL,
                    {
                        method:
                            "DELETE",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                id:
                                    message.id,

                                device_id:
                                    message.device_id ===
                                    deviceId
                                        ? deviceId
                                        : undefined

                            })
                    }
                );

            } catch {}

        }

        await loadMessages();

    } catch (error) {

        alert(
            "Could not remove messages:\n\n" +
            error.message
        );

    }

}

/* =========================================================
   CONFIRM DIALOG
   ========================================================= */

function openConfirm(
    title,
    text,
    callback
) {

    dialogTitle.textContent =
        title;

    dialogText.textContent =
        text;

    confirmCallback =
        callback;

    dialogOverlay.classList.add(
        "show"
    );
}

dialogCancel.onclick = () => {

    confirmCallback = null;

    dialogOverlay.classList.remove(
        "show"
    );

};

dialogConfirm.onclick = async () => {

    const callback =
        confirmCallback;

    confirmCallback = null;

    dialogOverlay.classList.remove(
        "show"
    );

    if (callback)
        await callback();

};

/* =========================================================
   IMAGE VIEWER
   ========================================================= */

backImage.onclick = () => {

    imageViewer.classList.remove(
        "show"
    );

    fullImage.src = "";

};

imageViewer.onclick = event => {

    if (
        event.target ===
        imageViewer
    ) {

        imageViewer.classList.remove(
            "show"
        );

        fullImage.src = "";

    }

};

/* =========================================================
   HELPERS
   ========================================================= */

function formatTime(date) {

    if (!date)
        return "";

    const d =
        new Date(date);

    if (Number.isNaN(d.getTime()))
        return "";

    return d.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function escapeHTML(text) {

    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* =========================================================
   REFRESH
   ========================================================= */

function startRefreshTimer() {

    if (refreshTimer)
        clearInterval(
            refreshTimer
        );

    refreshTimer =
        setInterval(
            loadMessages,
            Math.max(
                100,
                Number(
                    settings.refreshRate
                ) || 500
            )
        );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

    loadSettingsUI();

    applySettings();

    loadMessages();

}

/*
 Start immediately.
*/

initialize();

</script>