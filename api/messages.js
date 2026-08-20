export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    /*
    =========================================================
    SUPABASE
    =========================================================

    Put these in Vercel Environment Variables:

    SUPABASE_URL
    SUPABASE_KEY

    Do NOT put your private Supabase service-role key in HTML.
    */

    const supabaseUrl =
        process.env.SUPABASE_URL;

    const supabaseKey =
        process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({
            error:
                "SUPABASE_URL and SUPABASE_KEY are not configured."
        });
    }

    const cleanUrl =
        supabaseUrl.replace(/\/+$/, "");

    const headers = {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const GAME_CHANNEL = "__games__";
    const GAME_PREFIX = "__CHAT_GAME_STATE__:";

    try {

        /*
        =========================================================
        GET
        =========================================================
        */

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                    .trim()
                    .substring(0, 32);

            /*
            Get normal chat messages.
            */

            const chatUrl =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const chatResponse =
                await fetch(chatUrl, {
                    method: "GET",
                    headers
                });

            const chatData =
                await readJson(chatResponse);

            if (!chatResponse.ok) {
                return supabaseError(
                    res,
                    chatResponse,
                    chatData
                );
            }

            /*
            Get temporary games.
            */

            const gamesUrl =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,message,device_id,created_at" +
                "&channel=eq." +
                encodeURIComponent(GAME_CHANNEL) +
                "&order=created_at.asc";

            const gamesResponse =
                await fetch(gamesUrl, {
                    method: "GET",
                    headers
                });

            const gamesData =
                await readJson(gamesResponse);

            if (!gamesResponse.ok) {
                return supabaseError(
                    res,
                    gamesResponse,
                    gamesData
                );
            }

            const games = [];

            if (Array.isArray(gamesData)) {

                for (const row of gamesData) {

                    if (
                        typeof row.message !== "string" ||
                        !row.message.startsWith(GAME_PREFIX)
                    ) {
                        continue;
                    }

                    try {

                        const json =
                            row.message.substring(
                                GAME_PREFIX.length
                            );

                        const game =
                            JSON.parse(json);

                        game._dbId = row.id;
                        game._createdAt =
                            row.created_at;

                        games.push(game);

                    } catch {
                        /*
                        Bad temporary game row.
                        Remove it so it doesn't stay forever.
                        */

                        await deleteGameRow(
                            cleanUrl,
                            headers,
                            row.id
                        );
                    }
                }
            }

            return res.status(200).json({
                success: true,
                messages:
                    Array.isArray(chatData)
                        ? chatData
                        : [],
                games
            });
        }


        /*
        =========================================================
        POST
        =========================================================
        */

        if (req.method === "POST") {

            const body = req.body || {};

            /*
            =====================================================
            CREATE NORMAL MESSAGE
            =====================================================
            */

            if (body.action === "send_message") {

                const username =
                    cleanString(
                        body.username,
                        24
                    );

                const channel =
                    cleanString(
                        body.channel || "general",
                        32
                    );

                const message =
                    cleanString(
                        body.message,
                        2000
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                let image = null;

                if (
                    body.image &&
                    typeof body.image === "string"
                ) {
                    image = body.image;
                }

                if (!username) {
                    return res.status(400).json({
                        error:
                            "Username is required."
                    });
                }

                if (!message && !image) {
                    return res.status(400).json({
                        error:
                            "Message or image is required."
                    });
                }

                if (
                    image &&
                    image.length > 5000000
                ) {
                    return res.status(413).json({
                        error:
                            "Image is too large."
                    });
                }

                if (
                    image &&
                    !image.startsWith("data:image/")
                ) {
                    return res.status(400).json({
                        error:
                            "Invalid image data."
                    });
                }

                const response =
                    await fetch(
                        cleanUrl +
                        "/rest/v1/messages",
                        {
                            method: "POST",
                            headers: {
                                ...headers,
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    username,
                                    channel,
                                    message,
                                    image,
                                    device_id: deviceId,
                                    edited: false
                                })
                        }
                    );

                const data =
                    await readJson(response);

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true,
                    message:
                        Array.isArray(data)
                            ? data[0]
                            : data
                });
            }


            /*
            =====================================================
            CREATE GAME
            =====================================================
            */

            if (body.action === "create_game") {

                const username =
                    cleanString(
                        body.username,
                        24
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const type =
                    cleanString(
                        body.game_type,
                        40
                    );

                if (!username || !deviceId || !type) {
                    return res.status(400).json({
                        error:
                            "Username, device ID and game type are required."
                    });
                }

                /*
                Only one active hosted game per device.
                */

                const existing =
                    await getGames(
                        cleanUrl,
                        headers
                    );

                const alreadyHosting =
                    existing.some(game =>
                        game.hostDeviceId === deviceId
                    );

                if (alreadyHosting) {
                    return res.status(409).json({
                        error:
                            "You already host an active game."
                    });
                }

                const game =
                    createInitialGame(
                        type,
                        username,
                        deviceId
                    );

                if (!game) {
                    return res.status(400).json({
                        error:
                            "Unknown game."
                    });
                }

                const row = {
                    username: username,
                    channel: GAME_CHANNEL,
                    message:
                        GAME_PREFIX +
                        JSON.stringify(game),
                    image: null,
                    device_id: deviceId,
                    edited: false
                };

                const response =
                    await fetch(
                        cleanUrl +
                        "/rest/v1/messages",
                        {
                            method: "POST",
                            headers: {
                                ...headers,
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify(row)
                        }
                    );

                const data =
                    await readJson(response);

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                game._dbId =
                    Array.isArray(data)
                        ? data[0]?.id
                        : data?.id;

                return res.status(200).json({
                    success: true,
                    game
                });
            }


            /*
            =====================================================
            GAME ACTION
            =====================================================
            */

            if (body.action === "game_action") {

                const gameId =
                    cleanString(
                        body.game_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const gameAction =
                    cleanString(
                        body.game_action,
                        40
                    );

                const actionData =
                    body.data || {};

                if (
                    !gameId ||
                    !deviceId ||
                    !gameAction
                ) {
                    return res.status(400).json({
                        error:
                            "Missing game information."
                    });
                }

                const gameRow =
                    await getGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!gameRow) {
                    return res.status(404).json({
                        error:
                            "Game no longer exists."
                    });
                }

                let game;

                try {
                    game = JSON.parse(
                        gameRow.message.substring(
                            GAME_PREFIX.length
                        )
                    );
                } catch {
                    await deleteGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                    return res.status(410).json({
                        error:
                            "Game state was corrupted and has been removed."
                    });
                }

                /*
                HOST-ONLY ACTIONS
                */

                if (
                    gameAction === "start" ||
                    gameAction === "force_quit"
                ) {

                    if (
                        game.hostDeviceId !== deviceId
                    ) {
                        return res.status(403).json({
                            error:
                                "Only the host can do that."
                        });
                    }
                }

                /*
                JOIN
                */

                if (gameAction === "join") {

                    if (game.started) {
                        return res.status(400).json({
                            error:
                                "The game has already started."
                        });
                    }

                    const already =
                        game.players.some(
                            p =>
                                p.deviceId === deviceId
                        );

                    if (!already) {

                        if (
                            game.players.length >=
                            game.maxPlayers
                        ) {
                            return res.status(400).json({
                                error:
                                    "The game is full."
                            });
                        }

                        game.players.push({
                            deviceId,
                            username:
                                cleanString(
                                    actionData.username ||
                                    "Player",
                                    24
                                ),
                            joinedAt:
                                Date.now()
                        });
                    }
                }


                /*
                LEAVE
                */

                else if (gameAction === "leave") {

                    game.players =
                        game.players.filter(
                            p =>
                                p.deviceId !== deviceId
                        );

                    /*
                    If nobody is in the game,
                    delete the game completely.
                    */

                    if (
                        game.players.length === 0
                    ) {

                        await deleteGameRow(
                            cleanUrl,
                            headers,
                            gameId
                        );

                        return res.status(200).json({
                            success: true,
                            removed: true
                        });
                    }

                    /*
                    If host leaves before start,
                    host is kicked and the game closes.
                    */

                    if (
                        game.hostDeviceId === deviceId
                    ) {

                        await deleteGameRow(
                            cleanUrl,
                            headers,
                            gameId
                        );

                        return res.status(200).json({
                            success: true,
                            removed: true
                        });
                    }
                }


                /*
                START
                */

                else if (gameAction === "start") {

                    if (game.started) {
                        return res.status(400).json({
                            error:
                                "Game already started."
                        });
                    }

                    if (
                        game.players.length < 1
                    ) {
                        return res.status(400).json({
                            error:
                                "At least one player must join."
                        });
                    }

                    game.started = true;
                    game.startedAt = Date.now();

                    initializeGameStart(game);
                }


                /*
                FORCE QUIT
                */

                else if (
                    gameAction === "force_quit"
                ) {

                    await deleteGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                    return res.status(200).json({
                        success: true,
                        removed: true
                    });
                }


                /*
                ACTUAL GAME MOVE
                */

                else if (
                    gameAction === "move"
                ) {

                    if (!game.started) {
                        return res.status(400).json({
                            error:
                                "Game has not started."
                        });
                    }

                    const player =
                        game.players.find(
                            p =>
                                p.deviceId === deviceId
                        );

                    if (!player) {
                        return res.status(403).json({
                            error:
                                "You are spectating this game."
                        });
                    }

                    const result =
                        applyMove(
                            game,
                            deviceId,
                            actionData
                        );

                    if (!result.ok) {
                        return res.status(400).json({
                            error: result.error
                        });
                    }

                    if (result.finished) {

                        /*
                        Send the final state once,
                        then remove the game shortly after.
                        */

                        await updateGameRow(
                            cleanUrl,
                            headers,
                            gameId,
                            game
                        );

                        setTimeout(() => {
                            deleteGameRow(
                                cleanUrl,
                                headers,
                                gameId
                            ).catch(() => {});
                        }, 1200);

                        return res.status(200).json({
                            success: true,
                            game,
                            finished: true
                        });
                    }
                }

                else {
                    return res.status(400).json({
                        error:
                            "Unknown game action."
                    });
                }

                /*
                EMPTY GAME CLEANUP
                */

                if (
                    !game.players ||
                    game.players.length === 0
                ) {

                    await deleteGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                    return res.status(200).json({
                        success: true,
                        removed: true
                    });
                }

                await updateGameRow(
                    cleanUrl,
                    headers,
                    gameId,
                    game
                );

                return res.status(200).json({
                    success: true,
                    game
                });
            }


            return res.status(400).json({
                error:
                    "Unknown POST action."
            });
        }


        /*
        =========================================================
        PATCH NORMAL MESSAGE
        =========================================================
        */

        if (req.method === "PATCH") {

            const body = req.body || {};

            const id =
                cleanString(body.id, 100);

            const deviceId =
                cleanString(
                    body.device_id,
                    100
                );

            const message =
                cleanString(
                    body.message,
                    2000
                );

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);

            const response =
                await fetch(url, {
                    method: "PATCH",
                    headers: {
                        ...headers,
                        "Prefer":
                            "return=representation"
                    },
                    body:
                        JSON.stringify({
                            message,
                            edited: true
                        })
                });

            const data =
                await readJson(response);

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            if (
                !Array.isArray(data) ||
                !data.length
            ) {
                return res.status(403).json({
                    error:
                        "You cannot edit this message."
                });
            }

            return res.status(200).json({
                success: true,
                message: data[0]
            });
        }


        /*
        =========================================================
        DELETE
        =========================================================
        */

        if (req.method === "DELETE") {

            const body = req.body || {};

            /*
            FULL CHAT WIPE
            */

            if (body.delete_all === true) {

                const response =
                    await fetch(
                        cleanUrl +
                        "/rest/v1/messages?id=not.is.null",
                        {
                            method: "DELETE",
                            headers: {
                                ...headers,
                                "Prefer":
                                    "return=minimal"
                            }
                        }
                    );

                const data =
                    await readJson(response);

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true,
                    message:
                        "Everything was deleted."
                });
            }


            /*
            DELETE GAME
            */

            if (body.game_id) {

                const gameId =
                    cleanString(
                        body.game_id,
                        100
                    );

                const deviceId =
                    cleanString(
                        body.device_id,
                        100
                    );

                const game =
                    await getGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!game) {
                    return res.status(404).json({
                        error:
                            "Game not found."
                    });
                }

                let state;

                try {
                    state =
                        JSON.parse(
                            game.message.substring(
                                GAME_PREFIX.length
                            )
                        );
                } catch {
                    await deleteGameRow(
                        cleanUrl,
                        headers,
                        gameId
                    );

                    return res.status(200).json({
                        success: true,
                        removed: true
                    });
                }

                if (
                    state.hostDeviceId !== deviceId
                ) {
                    return res.status(403).json({
                        error:
                            "Only the host can remove this game."
                    });
                }

                await deleteGameRow(
                    cleanUrl,
                    headers,
                    gameId
                );

                return res.status(200).json({
                    success: true,
                    removed: true
                });
            }


            /*
            NORMAL MESSAGE DELETE
            */

            const id =
                cleanString(
                    body.id,
                    100
                );

            const deviceId =
                cleanString(
                    body.device_id,
                    100
                );

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);

            const response =
                await fetch(url, {
                    method: "DELETE",
                    headers: {
                        ...headers,
                        "Prefer":
                            "return=representation"
                    }
                });

            const data =
                await readJson(response);

            if (!response.ok) {
                return supabaseError(
                    res,
                    response,
                    data
                );
            }

            if (
                !Array.isArray(data) ||
                !data.length
            ) {
                return res.status(403).json({
                    error:
                        "You cannot delete this message."
                });
            }

            return res.status(200).json({
                success: true
            });
        }


        return res.status(405).json({
            error:
                "Method not allowed."
        });

    } catch (error) {

        console.error(
            "MESSAGE API ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });
    }
}


/*
=========================================================
GAME HELPERS
=========================================================
*/

function cleanString(value, max) {
    return String(value || "")
        .trim()
        .substring(0, max);
}


async function readJson(response) {

    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            message: text
        };
    }
}


function supabaseError(
    res,
    response,
    data
) {

    return res.status(
        response.status
    ).json({
        error:
            data.message ||
            data.error ||
            "Supabase request failed.",
        details: data
    });
}


async function getGames(
    base,
    headers
) {

    const url =
        base +
        "/rest/v1/messages" +
        "?select=id,message" +
        "&channel=eq.__games__";

    const response =
        await fetch(url, {
            method: "GET",
            headers
        });

    const data =
        await readJson(response);

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to get games."
        );
    }

    const games = [];

    if (Array.isArray(data)) {

        for (const row of data) {

            if (
                typeof row.message !== "string" ||
                !row.message.startsWith(
                    "__CHAT_GAME_STATE__:"
                )
            ) {
                continue;
            }

            try {

                const game =
                    JSON.parse(
                        row.message.substring(
                            "__CHAT_GAME_STATE__:".length
                        )
                    );

                game._dbId = row.id;

                games.push(game);

            } catch {}
        }
    }

    return games;
}


async function getGameRow(
    base,
    headers,
    id
) {

    const url =
        base +
        "/rest/v1/messages" +
        "?select=id,message" +
        "&id=eq." +
        encodeURIComponent(id) +
        "&channel=eq.__games__";

    const response =
        await fetch(url, {
            method: "GET",
            headers
        });

    const data =
        await readJson(response);

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to find game."
        );
    }

    if (
        !Array.isArray(data) ||
        !data.length
    ) {
        return null;
    }

    return data[0];
}


async function updateGameRow(
    base,
    headers,
    id,
    game
) {

    const url =
        base +
        "/rest/v1/messages" +
        "?id=eq." +
        encodeURIComponent(id) +
        "&channel=eq.__games__";

    const response =
        await fetch(url, {
            method: "PATCH",
            headers: {
                ...headers,
                "Prefer":
                    "return=minimal"
            },
            body:
                JSON.stringify({
                    message:
                        "__CHAT_GAME_STATE__:" +
                        JSON.stringify(game)
                })
        });

    if (!response.ok) {

        const data =
            await readJson(response);

        throw new Error(
            data.message ||
            "Unable to update game."
        );
    }
}


async function deleteGameRow(
    base,
    headers,
    id
) {

    const url =
        base +
        "/rest/v1/messages" +
        "?id=eq." +
        encodeURIComponent(id) +
        "&channel=eq.__games__";

    await fetch(url, {
        method: "DELETE",
        headers: {
            ...headers,
            "Prefer":
                "return=minimal"
        }
    });
}


/*
=========================================================
CREATE GAME
=========================================================
*/

function createInitialGame(
    type,
    username,
    deviceId
) {

    const names = {
        tictactoe:
            "Tic-Tac-Toe",

        connectfour:
            "Connect Four",

        dice:
            "High Roll Dice",

        reversi:
            "Reversi",

        rps:
            "Rock Paper Scissors"
    };

    if (!names[type]) {
        return null;
    }

    const maxPlayers =
        type === "dice"
            ? 6
            : type === "rps"
                ? 8
                : 2;

    return {
        id:
            cryptoRandomId(),

        type,

        name:
            names[type],

        host:
            username,

        hostDeviceId:
            deviceId,

        maxPlayers,

        players: [
            {
                deviceId,
                username,
                joinedAt: Date.now()
            }
        ],

        started: false,

        startedAt: null,

        turnIndex: 0,

        winner: null,

        finished: false,

        board:
            null,

        gameData:
            {},

        version: 1,

        createdAt:
            Date.now()
    };
}


function cryptoRandomId() {

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 12)
    );
}


/*
=========================================================
GAME INITIALIZATION
=========================================================
*/

function initializeGameStart(game) {

    if (game.type === "tictactoe") {

        game.board =
            Array(9).fill("");

        game.gameData.symbols = {};

        game.players.forEach(
            (player, index) => {
                game.gameData.symbols[
                    player.deviceId
                ] =
                    index === 0
                        ? "X"
                        : "O";
            }
        );
    }


    if (game.type === "connectfour") {

        game.board =
            Array(42).fill("");

        game.gameData.symbols = {};

        game.players.forEach(
            (player, index) => {
                game.gameData.symbols[
                    player.deviceId
                ] =
                    index === 0
                        ? "R"
                        : "Y";
            }
        );
    }


    if (game.type === "dice") {

        game.gameData.rolls = {};

        game.gameData.round = 1;

        game.gameData.maxRounds = 3;
    }


    if (game.type === "reversi") {

        game.board =
            Array(64).fill("");

        game.board[27] = "W";
        game.board[28] = "B";
        game.board[35] = "B";
        game.board[36] = "W";

        game.gameData.symbols = {};

        game.players.forEach(
            (player, index) => {
                game.gameData.symbols[
                    player.deviceId
                ] =
                    index === 0
                        ? "B"
                        : "W";
            }
        );
    }


    if (game.type === "rps") {

        game.gameData.choices = {};

        game.gameData.round = 1;

        game.gameData.maxRounds = 3;
    }
}


/*
=========================================================
MOVE ENGINE
=========================================================
*/

function applyMove(
    game,
    deviceId,
    data
) {

    const playerIndex =
        game.players.findIndex(
            p =>
                p.deviceId === deviceId
        );

    if (playerIndex < 0) {
        return {
            ok: false,
            error:
                "You are not a player."
        };
    }

    if (
        game.type === "tictactoe"
    ) {
        return moveTicTacToe(
            game,
            deviceId,
            data
        );
    }

    if (
        game.type === "connectfour"
    ) {
        return moveConnectFour(
            game,
            deviceId,
            data
        );
    }

    if (
        game.type === "dice"
    ) {
        return moveDice(
            game,
            deviceId
        );
    }

    if (
        game.type === "reversi"
    ) {
        return moveReversi(
            game,
            deviceId,
            data
        );
    }

    if (
        game.type === "rps"
    ) {
        return moveRPS(
            game,
            deviceId,
            data
        );
    }

    return {
        ok: false,
        error:
            "Unknown game."
    };
}


/*
=========================================================
TIC TAC TOE
=========================================================
*/

function moveTicTacToe(
    game,
    deviceId,
    data
) {

    if (
        game.players[
            game.turnIndex
        ]?.deviceId !== deviceId
    ) {
        return {
            ok: false,
            error:
                "It is not your turn."
        };
    }

    const index =
        Number(data.index);

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index > 8
    ) {
        return {
            ok: false,
            error:
                "Invalid square."
        };
    }

    if (game.board[index]) {
        return {
            ok: false,
            error:
                "That square is already taken."
        };
    }

    const symbol =
        game.gameData.symbols[
            deviceId
        ];

    game.board[index] =
        symbol;

    const winner =
        checkTicTacToe(
            game.board
        );

    if (winner) {

        game.winner =
            game.players.find(
                p =>
                    game.gameData.symbols[
                        p.deviceId
                    ] === winner
            )?.username || winner;

        game.finished = true;

        return {
            ok: true,
            finished: true
        };
    }

    if (
        game.board.every(Boolean)
    ) {

        game.winner =
            "Draw";

        game.finished = true;

        return {
            ok: true,
            finished: true
        };
    }

    game.turnIndex =
        game.turnIndex === 0
            ? 1
            : 0;

    game.version++;

    return {
        ok: true,
        finished: false
    };
}


function checkTicTacToe(board) {

    const wins = [
        [0,1,2],
        [3,4,5],
        [6,7,8],
        [0,3,6],
        [1,4,7],
        [2,5,8],
        [0,4,8],
        [2,4,6]
    ];

    for (const win of wins) {

        const [a,b,c] = win;

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


/*
=========================================================
CONNECT FOUR
=========================================================
*/

function moveConnectFour(
    game,
    deviceId,
    data
) {

    if (
        game.players[
            game.turnIndex
        ]?.deviceId !== deviceId
    ) {
        return {
            ok: false,
            error:
                "It is not your turn."
        };
    }

    const column =
        Number(data.column);

    if (
        !Number.isInteger(column) ||
        column < 0 ||
        column > 6
    ) {
        return {
            ok: false,
            error:
                "Invalid column."
        };
    }

    let placed = -1;

    for (
        let row = 5;
        row >= 0;
        row--
    ) {

        const index =
            row * 7 + column;

        if (!game.board[index]) {

            game.board[index] =
                game.gameData.symbols[
                    deviceId
                ];

            placed = index;

            break;
        }
    }

    if (placed < 0) {
        return {
            ok: false,
            error:
                "That column is full."
        };
    }

    const symbol =
        game.board[placed];

    if (
        connectFourWinner(
            game.board,
            placed,
            symbol
        )
    ) {

        game.winner =
            game.players.find(
                p =>
                    game.gameData.symbols[
                        p.deviceId
                    ] === symbol
            )?.username || symbol;

        game.finished = true;

        return {
            ok: true,
            finished: true
        };
    }

    if (
        game.board.every(Boolean)
    ) {

        game.winner =
            "Draw";

        game.finished = true;

        return {
            ok: true,
            finished: true
        };
    }

    game.turnIndex =
        game.turnIndex === 0
            ? 1
            : 0;

    game.version++;

    return {
        ok: true,
        finished: false
    };
}


function connectFourWinner(
    board,
    index,
    symbol
) {

    const row =
        Math.floor(index / 7);

    const col =
        index % 7;

    const directions = [
        [1,0],
        [0,1],
        [1,1],
        [1,-1]
    ];

    for (
        const [dr,dc]
        of directions
    ) {

        let count = 1;

        count += countDirection(
            board,
            row,
            col,
            dr,
            dc,
            symbol
        );

        count += countDirection(
            board,
            row,
            col,
            -dr,
            -dc,
            symbol
        );

        if (count >= 4) {
            return true;
        }
    }

    return false;
}


function countDirection(
    board,
    row,
    col,
    dr,
    dc,
    symbol
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
        c < 7
    ) {

        if (
            board[r * 7 + c] !==
            symbol
        ) {
            break;
        }

        count++;

        r += dr;
        c += dc;
    }

    return count;
}


/*
=========================================================
DICE
=========================================================
*/

function moveDice(
    game,
    deviceId
) {

    if (
        game.players[
            game.turnIndex
        ]?.deviceId !== deviceId
    ) {
        return {
            ok: false,
            error:
                "It is not your turn."
        };
    }

    if (
        game.gameData.rolls[
            deviceId
        ]
    ) {
        return {
            ok: false,
            error:
                "You already rolled this round."
        };
    }

    const roll =
        Math.floor(
            Math.random() * 6
        ) + 1;

    game.gameData.rolls[
        deviceId
    ] = roll;

    if (
        Object.keys(
            game.gameData.rolls
        ).length >=
        game.players.length
    ) {

        const results =
            game.players.map(
                p => ({
                    username:
                        p.username,
                    roll:
                        game.gameData.rolls[
                            p.deviceId
                        ] || 0
                })
            );

        results.sort(
            (a,b) =>
                b.roll - a.roll
        );

        game.gameData.lastResults =
            results;

        const winner =
            results[0];

        game.gameData.round++;

        if (
            game.gameData.round >
            game.gameData.maxRounds
        ) {

            game.winner =
                winner.username;

            game.finished = true;

            return {
                ok: true,
                finished: true
            };
        }

        game.gameData.rolls = {};
    }

    game.turnIndex =
        (
            game.turnIndex + 1
        ) %
        game.players.length;

    game.version++;

    return {
        ok: true,
        finished: false
    };
}


/*
=========================================================
REVERSI
=========================================================
*/

function moveReversi(
    game,
    deviceId,
    data
) {

    if (
        game.players[
            game.turnIndex
        ]?.deviceId !== deviceId
    ) {
        return {
            ok: false,
            error:
                "It is not your turn."
        };
    }

    const index =
        Number(data.index);

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= 64
    ) {
        return {
            ok: false,
            error:
                "Invalid square."
        };
    }

    if (game.board[index]) {
        return {
            ok: false,
            error:
                "That square is occupied."
        };
    }

    const mySymbol =
        game.gameData.symbols[
            deviceId
        ];

    const other =
        mySymbol === "B"
            ? "W"
            : "B";

    const row =
        Math.floor(index / 8);

    const col =
        index % 8;

    const directions = [
        [-1,-1],
        [-1,0],
        [-1,1],
        [0,-1],
        [0,1],
        [1,-1],
        [1,0],
        [1,1]
    ];

    const flip = [];

    for (
        const [dr,dc]
        of directions
    ) {

        const line = [];

        let r =
            row + dr;

        let c =
            col + dc;

        while (
            r >= 0 &&
            r < 8 &&
            c >= 0 &&
            c < 8 &&
            game.board[
                r * 8 + c
            ] === other
        ) {

            line.push(
                r * 8 + c
            );

            r += dr;
            c += dc;
        }

        if (
            line.length &&
            r >= 0 &&
            r < 8 &&
            c >= 0 &&
            c < 8 &&
            game.board[
                r * 8 + c
            ] === mySymbol
        ) {

            flip.push(...line);
        }
    }

    if (!flip.length) {
        return {
            ok: false,
            error:
                "That is not a valid Reversi move."
        };
    }

    game.board[index] =
        mySymbol;

    flip.forEach(
        i =>
            game.board[i] =
                mySymbol
    );

    const empty =
        game.board.filter(
            x => !x
        ).length;

    if (!empty) {

        const black =
            game.board.filter(
                x => x === "B"
            ).length;

        const white =
            game.board.filter(
                x => x === "W"
            ).length;

        game.winner =
            black === white
                ? "Draw"
                : black > white
                    ? game.players[0].username
                    : game.players[1].username;

        game.finished = true;

        return {
            ok: true,
            finished: true
        };
    }

    game.turnIndex =
        game.turnIndex === 0
            ? 1
            : 0;

    game.version++;

    return {
        ok: true,
        finished: false
    };
}


/*
=========================================================
ROCK PAPER SCISSORS
=========================================================
*/

function moveRPS(
    game,
    deviceId,
    data
) {

    if (
        game.players[
            game.turnIndex
        ]?.deviceId !== deviceId
    ) {
        return {
            ok: false,
            error:
                "It is not your turn."
        };
    }

    const choice =
        cleanString(
            data.choice,
            10
        );

    if (
        ![
            "rock",
            "paper",
            "scissors"
        ].includes(choice)
    ) {
        return {
            ok: false,
            error:
                "Invalid choice."
        };
    }

    game.gameData.choices[
        deviceId
    ] = choice;

    if (
        Object.keys(
            game.gameData.choices
        ).length >=
        game.players.length
    ) {

        const choices =
            game.players.map(
                p => ({
                    player: p,
                    choice:
                        game.gameData.choices[
                            p.deviceId
                        ]
                })
            );

        game.gameData.lastChoices =
            choices.map(
                x => ({
                    username:
                        x.player.username,
                    choice:
                        x.choice
                })
            );

        game.gameData.choices = {};

        game.gameData.round++;

        if (
            game.gameData.round >
            game.gameData.maxRounds
        ) {

            game.winner =
                calculateRPSWinner(
                    choices
                );

            game.finished = true;

            return {
                ok: true,
                finished: true
            };
        }
    }

    game.turnIndex =
        (
            game.turnIndex + 1
        ) %
        game.players.length;

    game.version++;

    return {
        ok: true,
        finished: false
    };
}


function calculateRPSWinner(
    choices
) {

    const counts = {
        rock: 0,
        paper: 0,
        scissors: 0
    };

    choices.forEach(
        x =>
            counts[x.choice]++
    );

    /*
    With more than two players,
    if all three choices are present,
    it is a draw.
    */

    const present =
        Object.keys(counts)
            .filter(
                key =>
                    counts[key] > 0
            );

    if (present.length !== 2) {
        return "Draw";
    }

    let winningChoice;

    if (
        present.includes("rock") &&
        present.includes("scissors")
    ) {
        winningChoice = "rock";
    }

    if (
        present.includes("paper") &&
        present.includes("rock")
    ) {
        winningChoice = "paper";
    }

    if (
        present.includes("scissors") &&
        present.includes("paper")
    ) {
        winningChoice = "scissors";
    }

    const winner =
        choices.find(
            x =>
                x.choice ===
                winningChoice
        );

    return winner
        ? winner.player.username
        : "Draw";
}