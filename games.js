/* =========================================================
   MINIGAMES CLIENT
   Uses the existing /api/message endpoint.
========================================================= */

const GAME_API = "/api/message";
const GAME_CHANNEL = "general";
const GAME_PREFIX = "__CHAT_GAME__";

let gameMessages = [];
let activeGames = {};
let currentGame = null;

const gameInfo = {
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

function getDeviceId() {
    return localStorage.getItem(
        "chat_device_id"
    );
}

function getUsername() {
    return localStorage.getItem(
        "chat_username"
    ) || "";
}

function parseGameMessage(message) {

    if (
        !message ||
        message.username !==
            "__GAME_SERVER__"
    ) {
        return null;
    }

    try {

        const text =
            message.message || "";

        if (
            !text.startsWith(
                GAME_PREFIX
            )
        ) {
            return null;
        }

        return {
            state: JSON.parse(
                text.substring(
                    GAME_PREFIX.length
                )
            ),

            message
        };

    } catch {
        return null;
    }
}

function updateGamesFromMessages(messages) {

    gameMessages = Array.isArray(messages)
        ? messages
        : [];

    const newest = {};

    for (
        const message of gameMessages
    ) {

        const parsed =
            parseGameMessage(message);

        if (!parsed)
            continue;

        const state =
            parsed.state;

        if (
            !state.game_id
        )
            continue;

        if (
            state.finished
        ) {
            delete newest[
                state.game_id
            ];

            continue;
        }

        newest[state.game_id] = {
            ...state,
            message_id:
                parsed.message.id
        };
    }

    activeGames = newest;

    renderGameWindow();
}

window.updateGamesFromMessages =
    updateGamesFromMessages;


/* =========================================================
   GAME SERVER
========================================================= */

async function createGame(
    type,
    maxPlayers
) {

    const deviceId =
        getDeviceId();

    const username =
        getUsername();

    if (!deviceId) {
        throw new Error(
            "Device ID is missing."
        );
    }

    if (!username) {
        throw new Error(
            "Set your username first."
        );
    }

    const info =
        gameInfo[type];

    if (!info) {
        throw new Error(
            "Unknown game."
        );
    }

    const existing =
        Object.values(
            activeGames
        ).find(
            game =>
                game.host_device_id ===
                deviceId
        );

    if (existing) {
        currentGame =
            existing;

        renderGameWindow();

        throw new Error(
            "You are already hosting a game."
        );
    }

    const gameId =
        crypto.randomUUID();

    const state = {
        type: "game",

        action: "create",

        game_id: gameId,

        game_type: type,

        host_device_id:
            deviceId,

        host_name:
            username,

        max_players:
            maxPlayers,

        players: [
            {
                device_id:
                    deviceId,

                username:
                    username
            }
        ],

        started: false,

        finished: false,

        turn_index: 0,

        board:
            initialBoard(type),

        positions: {},

        values: {},

        created_at:
            Date.now(),

        updated_at:
            Date.now()
    };

    const response =
        await fetch(
            GAME_API,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    game_server: true,

                    channel:
                        GAME_CHANNEL,

                    message:
                        GAME_PREFIX +
                        JSON.stringify(state),

                    device_id:
                        gameId
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Could not host game."
        );
    }

    currentGame = state;

    await reloadGames();

    return state;
}

async function updateGame(
    game,
    changes,
    action = "update"
) {

    if (!game)
        return;

    const state = {
        ...game,
        ...changes,

        action,

        updated_at:
            Date.now()
    };

    /*
     * PATCH requires the original
     * game-server database message ID.
     */
    if (!game.message_id) {

        await reloadGames();

        game =
            activeGames[
                game.game_id
            ];

        if (!game?.message_id) {
            throw new Error(
                "Game server message was not found."
            );
        }

        state.message_id =
            game.message_id;
    }

    const response =
        await fetch(
            GAME_API,
            {
                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    game_server: true,

                    id:
                        game.message_id,

                    device_id:
                        game.game_id,

                    game_state:
                        GAME_PREFIX +
                        JSON.stringify(state)
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Could not update game."
        );
    }

    currentGame = {
        ...state,
        message_id:
            game.message_id
    };

    await reloadGames();
}

async function reloadGames() {

    try {

        const response =
            await fetch(
                `${GAME_API}?channel=${encodeURIComponent(
                    GAME_CHANNEL
                )}`,
                {
                    cache: "no-store"
                }
            );

        const data =
            await response.json();

        if (!response.ok)
            return;

        updateGamesFromMessages(
            data.messages || []
        );

    } catch (error) {

        console.error(
            "Game refresh failed:",
            error
        );
    }
}


/* =========================================================
   JOIN / LEAVE
========================================================= */

async function joinGame(game) {

    const deviceId =
        getDeviceId();

    const username =
        getUsername();

    if (!username) {
        alert(
            "Set your username first."
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
            p =>
                p.device_id ===
                deviceId
        )
    ) {

        currentGame =
            game;

        renderGameWindow();

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
                username
        }
    ];

    currentGame = {
        ...game,
        players
    };

    await updateGame(
        game,
        {
            players
        },
        "join"
    );
}

async function leaveGame(game) {

    if (!game)
        return;

    const deviceId =
        getDeviceId();

    if (
        game.host_device_id ===
        deviceId
    ) {

        await finishGame(
            game,
            "force_quit"
        );

        return;
    }

    const players =
        game.players.filter(
            player =>
                player.device_id !==
                deviceId
        );

    await updateGame(
        game,
        {
            players
        },
        "leave"
    );

    currentGame = null;

    renderGameWindow();
}


/* =========================================================
   START / FINISH
========================================================= */

async function startGame(game) {

    const deviceId =
        getDeviceId();

    if (
        game.host_device_id !==
        deviceId
    ) {

        alert(
            "Only the host can start the game."
        );

        return;
    }

    const info =
        gameInfo[
            game.game_type
        ];

    if (
        game.players.length <
        info.min
    ) {

        alert(
            `You need at least ${info.min} players.`
        );

        return;
    }

    await updateGame(
        game,
        {
            started: true,
            turn_index: 0
        },
        "start"
    );
}

async function finishGame(
    game,
    reason = "finished"
) {

    if (!game)
        return;

    const deviceId =
        getDeviceId();

    if (
        reason === "force_quit" &&
        game.host_device_id !==
            deviceId
    ) {

        alert(
            "Only the host can close the game."
        );

        return;
    }

    if (!game.message_id) {
        await reloadGames();

        game =
            activeGames[
                game.game_id
            ];
    }

    if (!game?.message_id)
        return;

    try {

        const response =
            await fetch(
                GAME_API,
                {
                    method: "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        game_server: true,

                        id:
                            game.message_id,

                        device_id:
                            game.game_id
                    })
                }
            );

        if (!response.ok) {

            const data =
                await response.json();

            throw new Error(
                data.error ||
                "Could not close game."
            );
        }

    } catch (error) {

        console.error(error);

        alert(error.message);

        return;
    }

    delete activeGames[
        game.game_id
    ];

    if (
        currentGame?.game_id ===
        game.game_id
    ) {
        currentGame = null;
    }

    await reloadGames();
}


/* =========================================================
   BOARDS
========================================================= */

function initialBoard(type) {

    if (type === "tictactoe")
        return Array(9).fill("");

    if (type === "connect4")
        return Array(42).fill("");

    if (type === "board")
        return Array(25).fill("");

    return [];
}

function currentPlayer(game) {

    if (
        !game ||
        !game.players?.length
    )
        return null;

    return game.players[
        game.turn_index %
        game.players.length
    ];
}

function myTurn(game) {

    const player =
        currentPlayer(game);

    return (
        player &&
        player.device_id ===
            getDeviceId()
    );
}

function nextTurn(game) {

    return (
        game.turn_index + 1
    ) % game.players.length;
}


/* =========================================================
   TIC TAC TOE
========================================================= */

async function ticTacToeMove(
    game,
    index
) {

    if (!game.started)
        return;

    if (!myTurn(game))
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

    board[index] =
        symbol;

    const winner =
        checkTicTacToe(board);

    if (winner) {

        await updateGame(
            game,
            {
                board,
                winner,
                finished: true
            },
            "finish"
        );

        setTimeout(
            () => finishGame(
                {
                    ...game,
                    board,
                    winner,
                    finished: true,
                    message_id:
                        game.message_id
                }
            ),
            1500
        );

        return;
    }

    if (
        board.every(
            cell => cell !== ""
        )
    ) {

        await updateGame(
            game,
            {
                board,
                winner: "draw",
                finished: true
            },
            "finish"
        );

        setTimeout(
            () => finishGame(
                game
            ),
            1500
        );

        return;
    }

    await updateGame(
        game,
        {
            board,
            turn_index:
                nextTurn(game)
        },
        "move"
    );
}

function checkTicTacToe(
    board
) {

    const lines = [
        [0,1,2],
        [3,4,5],
        [6,7,8],
        [0,3,6],
        [1,4,7],
        [2,5,8],
        [0,4,8],
        [2,4,6]
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
        ) {
            return board[a];
        }
    }

    return null;
}


/* =========================================================
   CONNECT FOUR
========================================================= */

async function connectFourMove(
    game,
    column
) {

    if (!game.started)
        return;

    if (!myTurn(game))
        return;

    const board = [
        ...game.board
    ];

    const rows = 6;
    const cols = 7;

    let index = -1;

    for (
        let row = rows - 1;
        row >= 0;
        row--
    ) {

        const test =
            row * cols +
            column;

        if (!board[test]) {

            index = test;

            break;
        }
    }

    if (index === -1)
        return;

    const player =
        game.turn_index %
        2 === 0
            ? "R"
            : "Y";

    board[index] =
        player;

    const winner =
        checkConnectFour(
            board,
            index,
            player
        );

    if (winner) {

        await updateGame(
            game,
            {
                board,
                winner,
                finished: true
            },
            "finish"
        );

        return;
    }

    if (
        board.every(
            cell => cell
        )
    ) {

        await updateGame(
            game,
            {
                board,
                winner: "draw",
                finished: true
            },
            "finish"
        );

        return;
    }

    await updateGame(
        game,
        {
            board,
            turn_index:
                nextTurn(game)
        },
        "move"
    );
}

function checkConnectFour(
    board,
    index,
    player
) {

    const cols = 7;
    const row =
        Math.floor(
            index / cols
        );

    const col =
        index % cols;

    const directions = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
    ];

    for (
        const [
            dr,
            dc
        ] of directions
    ) {

        let count = 1;

        count += countDirection(
            board,
            row,
            col,
            dr,
            dc,
            player
        );

        count += countDirection(
            board,
            row,
            col,
            -dr,
            -dc,
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
    dr,
    dc,
    player
) {

    let count = 0;

    let r =
        row + dr;

    let c =
        col + dc;

    while (
        r >= 0 &&
        r < 6 &&
        c >= 0 &&
        c < 7 &&
        board[
            r * 7 + c
        ] === player
    ) {

        count++;

        r += dr;
        c += dc;
    }

    return count;
}


/* =========================================================
   RENDER GAME WINDOW
========================================================= */

function renderGameWindow() {

    const windowEl =
        document.getElementById(
            "gameWindow"
        );

    if (!windowEl)
        return;

    const listEl =
        document.getElementById(
            "gameList"
        );

    if (!listEl)
        return;

    const games =
        Object.values(
            activeGames
        );

    if (
        currentGame &&
        activeGames[
            currentGame.game_id
        ]
    ) {

        currentGame =
            activeGames[
                currentGame.game_id
            ];
    }

    listEl.innerHTML = "";

    games.forEach(game => {

        const info =
            gameInfo[
                game.game_type
            ];

        const joined =
            game.players.some(
                p =>
                    p.device_id ===
                    getDeviceId()
            );

        const mine =
            game.host_device_id ===
            getDeviceId();

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "game-list-card";

        card.innerHTML = `
            <div class="game-list-icon">
                ${info.icon}
            </div>

            <div class="game-list-info">

                <strong>
                    ${escapeGameHTML(
                        info.name
                    )}
                </strong>

                <small>
                    Hosted by
                    ${escapeGameHTML(
                        game.host_name
                    )}
                </small>

                <small>
                    ${game.players.length}
                    /
                    ${game.max_players}
                    players
                </small>

            </div>

            <button class="game-list-button">
                ${
                    joined
                    ? "Open"
                    : game.players.length >=
                      game.max_players
                        ? "Full"
                        : "Join"
                }
            </button>
        `;

        const button =
            card.querySelector(
                "button"
            );

        button.disabled =
            !joined &&
            game.players.length >=
                game.max_players;

        button.onclick = () => {

            if (joined) {

                currentGame =
                    game;

                renderCurrentGame();

            } else {

                joinGame(game);
            }
        };

        listEl.appendChild(card);
    });

    renderCurrentGame();
}

function renderCurrentGame() {

    const area =
        document.getElementById(
            "currentGame"
        );

    if (!area)
        return;

    if (!currentGame) {

        area.innerHTML = `
            <div class="game-no-selection">
                Select or join a game.
            </div>
        `;

        return;
    }

    const game =
        activeGames[
            currentGame.game_id
        ] || currentGame;

    currentGame =
        game;

    const info =
        gameInfo[
            game.game_type
        ];

    const me =
        getDeviceId();

    const joined =
        game.players.some(
            p =>
                p.device_id === me
        );

    const host =
        game.host_device_id === me;

    let html = `
        <div class="game-header-row">

            <div>
                <strong>
                    ${info.icon}
                    ${escapeGameHTML(
                        info.name
                    )}
                </strong>

                <div class="game-subtitle">
                    Hosted by
                    ${escapeGameHTML(
                        game.host_name
                    )}
                </div>
            </div>

            <button
                id="gameLeaveButton"
                class="game-window-button danger"
            >
                ${
                    host
                    ? "Close"
                    : "Leave"
                }
            </button>

        </div>

        <div class="game-player-list">
    `;

    game.players.forEach(
        (player, index) => {

            const active =
                game.started &&
                index ===
                    game.turn_index %
                    game.players.length;

            html += `
                <div class="game-player ${
                    active
                    ? "active"
                    : ""
                }">

                    <span>
                        ${escapeGameHTML(
                            player.username
                        )}
                    </span>

                    ${
                        player.device_id ===
                        game.host_device_id
                        ? "<small>HOST</small>"
                        : ""
                    }

                </div>
            `;
        }
    );

    html += `
        </div>

        <div
            id="gameBoardArea"
            class="game-board-area"
        ></div>
    `;

    area.innerHTML = html;

    document.getElementById(
        "gameLeaveButton"
    ).onclick = () =>
        leaveGame(game);

    const boardArea =
        document.getElementById(
            "gameBoardArea"
        );

    if (!game.started) {

        boardArea.innerHTML = `
            <div class="game-waiting">

                <h3>
                    Waiting for players
                </h3>

                <p>
                    ${game.players.length}
                    /
                    ${game.max_players}
                    players
                </p>

                ${
                    host
                    ? `
                        <button
                            id="startGameButton"
                            class="game-window-button primary"
                            ${
                                game.players.length <
                                info.min
                                ? "disabled"
                                : ""
                            }
                        >
                            Start Game
                        </button>
                    `
                    : `
                        <div class="game-wait-text">
                            Waiting for the host
                            to start the game.
                        </div>
                    `
                }

            </div>
        `;

        const start =
            document.getElementById(
                "startGameButton"
            );

        if (start) {
            start.onclick = () =>
                startGame(game);
        }

        return;
    }

    if (
        game.game_type ===
        "tictactoe"
    ) {
        renderTicTacToe(
            game,
            boardArea
        );

    } else if (
        game.game_type ===
        "connect4"
    ) {
        renderConnectFour(
            game,
            boardArea
        );

    } else {

        boardArea.innerHTML = `
            <div class="game-waiting">
                ${info.icon}
                ${info.name}
                is ready.
            </div>
        `;
    }
}


/* =========================================================
   TTT UI
========================================================= */

function renderTicTacToe(
    game,
    area
) {

    const player =
        currentPlayer(game);

    area.innerHTML = `
        <div class="game-turn">
            ${
                myTurn(game)
                ? "Your turn"
                : `${escapeGameHTML(
                    player?.username ||
                    "Player"
                )}'s turn`
            }
        </div>

        <div class="ttt-board">
            ${game.board.map(
                (cell, index) => `
                    <button
                        class="ttt-cell"
                        data-index="${index}"
                        ${
                            cell ||
                            !myTurn(game)
                            ? "disabled"
                            : ""
                        }
                    >
                        ${cell}
                    </button>
                `
            ).join("")}
        </div>

        ${
            game.winner
            ? `
                <div class="game-result">
                    ${
                        game.winner === "draw"
                        ? "Draw!"
                        : `${game.winner} wins!`
                    }
                </div>
            `
            : ""
        }
    `;

    area
        .querySelectorAll(
            ".ttt-cell"
        )
        .forEach(button => {

            button.onclick = () =>
                ticTacToeMove(
                    game,
                    Number(
                        button.dataset.index
                    )
                );
        });
}


/* =========================================================
   CONNECT FOUR UI
========================================================= */

function renderConnectFour(
    game,
    area
) {

    const player =
        currentPlayer(game);

    let html = `
        <div class="game-turn">
            ${
                myTurn(game)
                ? "Your turn"
                : `${escapeGameHTML(
                    player?.username ||
                    "Player"
                )}'s turn`
            }
        </div>

        <div class="connect4-columns">
    `;

    for (
        let col = 0;
        col < 7;
        col++
    ) {

        html += `
            <button
                class="connect4-column"
                data-column="${col}"
                ${
                    !myTurn(game)
                    ? "disabled"
                    : ""
                }
            >
                ↓
            </button>
        `;
    }

    html += `
        </div>

        <div class="connect4-board">
    `;

    game.board.forEach(
        cell => {

            html += `
                <div class="
                    connect4-cell
                    ${
                        cell === "R"
                        ? "red"
                        : cell === "Y"
                        ? "yellow"
                        : ""
                    }
                ">
                    ${
                        cell
                        ? cell
                        : ""
                    }
                </div>
            `;
        }
    );

    html += `
        </div>
    `;

    if (game.winner) {

        html += `
            <div class="game-result">
                ${
                    game.winner ===
                    "draw"
                    ? "Draw!"
                    : `${game.winner} wins!`
                }
            </div>
        `;
    }

    area.innerHTML =
        html;

    area
        .querySelectorAll(
            ".connect4-column"
        )
        .forEach(button => {

            button.onclick = () =>
                connectFourMove(
                    game,
                    Number(
                        button.dataset.column
                    )
                );
        });
}


/* =========================================================
   GAME WINDOW CREATOR
========================================================= */

function createGameWindow() {

    if (
        document.getElementById(
            "gameWindow"
        )
    ) {
        return;
    }

    const windowEl =
        document.createElement(
            "div"
        );

    windowEl.id =
        "gameWindow";

    windowEl.className =
        "game-window";

    windowEl.innerHTML = `
        <div class="game-window-header">

            <div class="game-window-title">
                🎮 Minigames
            </div>

            <div class="game-window-actions">

                <button
                    id="gameNewButton"
                    class="game-window-button"
                >
                    + New Game
                </button>

                <button
                    id="gameCloseButton"
                    class="game-window-close"
                >
                    ×
                </button>

            </div>

        </div>

        <div class="game-window-content">

            <div class="game-sidebar">

                <div class="game-sidebar-title">
                    Active Games
                </div>

                <div
                    id="gameList"
                    class="game-list"
                ></div>

            </div>

            <div
                id="currentGame"
                class="current-game"
            >
                <div class="game-no-selection">
                    Select or join a game.
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(
        windowEl
    );

    document.getElementById(
        "gameCloseButton"
    ).onclick = () => {

        windowEl.classList.remove(
            "open"
        );
    };

    document.getElementById(
        "gameNewButton"
    ).onclick =
        showCreateGame;

    addGameStyles();

    renderGameWindow();
}

function showCreateGame() {

    let modal =
        document.getElementById(
            "gameCreateModal"
        );

    if (!modal) {

        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "gameCreateModal";

        modal.className =
            "game-create-modal";

        modal.innerHTML = `
            <div class="game-create-box">

                <div class="game-create-header">
                    <strong>
                        Create Minigame
                    </strong>

                    <button
                        id="gameCreateClose"
                        class="game-window-close"
                    >
                        ×
                    </button>
                </div>

                <div
                    id="gameCreateChoices"
                    class="game-create-choices"
                ></div>

            </div>
        `;

        document.body.appendChild(
            modal
        );

        document.getElementById(
            "gameCreateClose"
        ).onclick = () =>
            modal.classList.remove(
                "show"
            );

        const choices =
            document.getElementById(
                "gameCreateChoices"
            );

        Object.entries(
            gameInfo
        ).forEach(
            ([type, info]) => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.className =
                    "game-choice-button";

                button.innerHTML = `
                    <span>
                        ${info.icon}
                    </span>

                    <strong>
                        ${escapeGameHTML(
                            info.name
                        )}
                    </strong>

                    <small>
                        ${info.min}
                        -
                        ${info.max}
                        players
                    </small>
                `;

                button.onclick =
                    async () => {

                        try {

                            const game =
                                await createGame(
                                    type,
                                    info.max
                                );

                            currentGame =
                                game;

                            modal.classList
                                .remove(
                                    "show"
                                );

                            const windowEl =
                                document.getElementById(
                                    "gameWindow"
                                );

                            windowEl.classList
                                .add(
                                    "open"
                                );

                            renderGameWindow();

                        } catch (error) {

                            alert(
                                error.message
                            );
                        }
                    };

                choices.appendChild(
                    button
                );
            }
        );
    }

    modal.classList.add(
        "show"
    );
}

function escapeGameHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   STYLES FOR SEPARATE GAME WINDOW
========================================================= */

function addGameStyles() {

    if (
        document.getElementById(
            "gameClientStyles"
        )
    )
        return;

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "gameClientStyles";

    style.textContent = `
        .game-window{
            position:fixed;
            right:20px;
            bottom:20px;
            width:min(850px,calc(100vw - 40px));
            height:min(650px,calc(100vh - 40px));
            display:none;
            flex-direction:column;
            background:#111419;
            border:1px solid #303640;
            border-radius:15px;
            box-shadow:0 25px 80px #000b;
            z-index:500;
            overflow:hidden;
        }

        .game-window.open{
            display:flex;
        }

        .game-window-header{
            height:58px;
            min-height:58px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:0 14px;
            border-bottom:1px solid #292f38;
            background:#151920;
        }

        .game-window-title{
            font-weight:800;
        }

        .game-window-actions{
            display:flex;
            gap:7px;
            align-items:center;
        }

        .game-window-button,
        .game-window-close{
            border:1px solid #363d48;
            background:#202630;
            color:white;
            border-radius:8px;
            padding:8px 12px;
            cursor:pointer;
        }

        .game-window-button.primary{
            background:#e8eaed;
            color:#111;
        }

        .game-window-button.danger{
            background:#32191c;
            border-color:#6e3035;
            color:#ff8585;
        }

        .game-window-button:disabled{
            opacity:.4;
            cursor:not-allowed;
        }

        .game-window-close{
            width:36px;
            height:36px;
            padding:0;
            font-size:20px;
        }

        .game-window-content{
            flex:1;
            min-height:0;
            display:flex;
        }

        .game-sidebar{
            width:245px;
            min-width:245px;
            padding:12px;
            overflow-y:auto;
            border-right:1px solid #292f38;
            background:#0d1014;
        }

        .game-sidebar-title{
            color:#8b94a0;
            font-size:12px;
            text-transform:uppercase;
            margin-bottom:9px;
            font-weight:700;
        }

        .game-list{
            display:flex;
            flex-direction:column;
            gap:7px;
        }

        .game-list-card{
            display:flex;
            align-items:center;
            gap:9px;
            padding:9px;
            border:1px solid #292f38;
            border-radius:10px;
            background:#151a20;
        }

        .game-list-icon{
            width:35px;
            height:35px;
            display:grid;
            place-items:center;
            border-radius:8px;
            background:#202630;
            font-size:18px;
        }

        .game-list-info{
            flex:1;
            min-width:0;
        }

        .game-list-info strong,
        .game-list-info small{
            display:block;
        }

        .game-list-info strong{
            font-size:13px;
        }

        .game-list-info small{
            color:#78818d;
            font-size:10px;
            margin-top:2px;
        }

        .game-list-button{
            border:1px solid #363d48;
            background:#202630;
            color:white;
            border-radius:7px;
            padding:6px 8px;
            cursor:pointer;
        }

        .game-list-button:disabled{
            opacity:.4;
            cursor:not-allowed;
        }

        .current-game{
            flex:1;
            min-width:0;
            overflow:auto;
            padding:18px;
        }

        .game-no-selection{
            height:100%;
            display:grid;
            place-items:center;
            color:#68717c;
        }

        .game-header-row{
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            margin-bottom:15px;
        }

        .game-header-row strong{
            font-size:19px;
        }

        .game-subtitle{
            color:#77818d;
            font-size:12px;
            margin-top:4px;
        }

        .game-player-list{
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin-bottom:18px;
        }

        .game-player{
            padding:7px 10px;
            border-radius:8px;
            border:1px solid #292f38;
            background:#171c22;
            font-size:12px;
        }

        .game-player.active{
            border-color:#727b87;
            background:#242a32;
        }

        .game-player small{
            margin-left:5px;
            color:#858e9a;
            font-size:8px;
        }

        .game-waiting{
            text-align:center;
            padding:50px 15px;
            color:#9da6b2;
        }

        .game-waiting h3{
            margin:0 0 8px;
            color:white;
        }

        .game-waiting p{
            color:#707a86;
        }

        .game-wait-text{
            margin-top:15px;
        }

        .game-turn{
            text-align:center;
            margin-bottom:12px;
            padding:9px;
            border-radius:8px;
            background:#171d25;
            color:#cbd2dc;
        }

        .ttt-board{
            display:grid;
            grid-template-columns:repeat(3,70px);
            gap:6px;
            justify-content:center;
        }

        .ttt-cell{
            width:70px;
            height:70px;
            border:1px solid #363d48;
            background:#171c22;
            color:white;
            border-radius:9px;
            font-size:28px;
            font-weight:800;
            cursor:pointer;
        }

        .ttt-cell:hover:not(:disabled){
            background:#242a32;
        }

        .ttt-cell:disabled{
            cursor:not-allowed;
            opacity:.8;
        }

        .connect4-columns{
            display:grid;
            grid-template-columns:repeat(7,42px);
            gap:4px;
            justify-content:center;
            margin-bottom:5px;
        }

        .connect4-column{
            border:1px solid #363d48;
            background:#202630;
            color:white;
            border-radius:6px;
            height:30px;
            cursor:pointer;
        }

        .connect4-column:disabled{
            opacity:.4;
        }

        .connect4-board{
            display:grid;
            grid-template-columns:repeat(7,42px);
            gap:4px;
            justify-content:center;
            padding:8px;
            background:#11161c;
            border:1px solid #303742;
            border-radius:10px;
        }

        .connect4-cell{
            width:42px;
            height:42px;
            display:grid;
            place-items:center;
            border-radius:50%;
            background:#252b33;
            color:transparent;
            font-size:0;
        }

        .connect4-cell.red{
            background:#d95353;
        }

        .connect4-cell.yellow{
            background:#d8c957;
        }

        .game-result{
            text-align:center;
            margin-top:15px;
            padding:10px;
            border-radius:8px;
            background:#1b2720;
            color:#79db98;
            font-weight:700;
        }

        .game-create-modal{
            position:fixed;
            inset:0;
            display:none;
            align-items:center;
            justify-content:center;
            background:#000b;
            z-index:700;
        }

        .game-create-modal.show{
            display:flex;
        }

        .game-create-box{
            width:min(500px,calc(100vw - 30px));
            background:#111419;
            border:1px solid #303640;
            border-radius:14px;
            box-shadow:0 25px 80px #000b;
            overflow:hidden;
        }

        .game-create-header{
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:15px;
            border-bottom:1px solid #292f38;
        }

        .game-create-choices{
            display:grid;
            grid-template-columns:repeat(
                auto-fit,
                minmax(150px,1fr)
            );
            gap:8px;
            padding:14px;
        }

        .game-choice-button{
            display:flex;
            flex-direction:column;
            align-items:flex-start;
            gap:5px;
            padding:14px;
            border:1px solid #292f38;
            border-radius:10px;
            background:#171c22;
            color:white;
            text-align:left;
            cursor:pointer;
        }

        .game-choice-button:hover{
            background:#222830;
        }

        .game-choice-button span{
            font-size:25px;
        }

        .game-choice-button small{
            color:#7b8490;
        }

        @media(max-width:700px){

            .game-window{
                right:8px;
                bottom:8px;
                width:calc(100vw - 16px);
                height:calc(100vh - 16px);
            }

            .game-sidebar{
                width:170px;
                min-width:170px;
            }

            .ttt-board{
                grid-template-columns:repeat(3,58px);
            }

            .ttt-cell{
                width:58px;
                height:58px;
            }

            .connect4-columns,
            .connect4-board{
                grid-template-columns:repeat(7,32px);
            }

            .connect4-cell{
                width:32px;
                height:32px;
            }
        }
    `;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   OPEN GAME WINDOW
========================================================= */

function openGames() {

    createGameWindow();

    const windowEl =
        document.getElementById(
            "gameWindow"
        );

    windowEl.classList.add(
        "open"
    );

    reloadGames();
}

window.openGames =
    openGames;


/* =========================================================
   AUTO START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createGameWindow();

        const gamesButton =
            document.getElementById(
                "gamesBtn"
            );

        if (gamesButton) {

            gamesButton.onclick =
                openGames;
        }

        setInterval(
            reloadGames,
            1000
        );
    }
);