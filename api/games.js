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

    try {
        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";

        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");

        const headers = {
            "apikey": supabaseKey,
            "Authorization": "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        /* =====================================================
           GET GAMES
        ===================================================== */

        if (req.method === "GET") {

            const action =
                String(req.query.action || "list");

            /* GET ONE GAME */

            if (action === "get") {

                const gameId =
                    String(req.query.game_id || "").trim();

                if (!gameId) {
                    return res.status(400).json({
                        error: "Game ID is required."
                    });
                }

                const response = await fetch(
                    cleanUrl +
                    "/rest/v1/games" +
                    "?id=eq." +
                    encodeURIComponent(gameId) +
                    "&select=*",
                    {
                        method: "GET",
                        headers
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

                if (!Array.isArray(data) || !data.length) {
                    return res.status(404).json({
                        error: "Game not found."
                    });
                }

                return res.status(200).json({
                    success: true,
                    game: data[0]
                });
            }

            /* LIST ACTIVE GAMES */

            const response = await fetch(
                cleanUrl +
                "/rest/v1/games" +
                "?status=neq.finished" +
                "&status=neq.stopped" +
                "&select=*" +
                "&order=created_at.desc",
                {
                    method: "GET",
                    headers
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
                games:
                    Array.isArray(data)
                        ? data
                        : []
            });
        }


        /* =====================================================
           CREATE GAME
        ===================================================== */

        if (req.method === "POST") {

            const body = req.body || {};

            const action =
                String(body.action || "create");

            /* =================================================
               CREATE
            ================================================= */

            if (action === "create") {

                const hostId =
                    String(
                        body.host_id || ""
                    ).trim();

                const hostName =
                    String(
                        body.host_name || ""
                    )
                    .trim()
                    .substring(0, 24);

                const gameType =
                    String(
                        body.game_type || "tictactoe"
                    )
                    .trim()
                    .substring(0, 32);

                const maxPlayers =
                    Math.max(
                        2,
                        Math.min(
                            16,
                            Number(body.max_players) || 2
                        )
                    );

                if (!hostId || !hostName) {
                    return res.status(400).json({
                        error:
                            "Host ID and host name are required."
                    });
                }

                /*
                 * One person can only host one active game.
                 */

                const existingResponse =
                    await fetch(
                        cleanUrl +
                        "/rest/v1/games" +
                        "?host_id=eq." +
                        encodeURIComponent(hostId) +
                        "&status=in.(waiting,playing)" +
                        "&select=id",
                        {
                            method: "GET",
                            headers
                        }
                    );

                const existing =
                    await readJson(
                        existingResponse
                    );

                if (
                    existingResponse.ok &&
                    Array.isArray(existing) &&
                    existing.length
                ) {

                    return res.status(409).json({
                        error:
                            "You are already hosting a game."
                    });
                }

                const gameId =
                    crypto.randomUUID();

                const players = [
                    {
                        id: hostId,
                        name: hostName,
                        joined: true,
                        is_host: true
                    }
                ];

                const initialState = {
                    turn: hostId,
                    board: [],
                    winner: null,
                    move_count: 0
                };

                const gameData = {
                    id: gameId,
                    game_type: gameType,
                    host_id: hostId,
                    host_name: hostName,
                    max_players: maxPlayers,
                    status: "waiting",
                    players: players,
                    game_state: initialState
                };

                const response =
                    await fetch(
                        cleanUrl +
                        "/rest/v1/games",
                        {
                            method: "POST",
                            headers: {
                                ...headers,
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify(
                                    gameData
                                )
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

                return res.status(201).json({
                    success: true,
                    game:
                        Array.isArray(data)
                            ? data[0]
                            : data
                });
            }


            /* =================================================
               JOIN
            ================================================= */

            if (action === "join") {

                const gameId =
                    String(
                        body.game_id || ""
                    ).trim();

                const playerId =
                    String(
                        body.player_id || ""
                    ).trim();

                const playerName =
                    String(
                        body.player_name || ""
                    )
                    .trim()
                    .substring(0, 24);

                if (
                    !gameId ||
                    !playerId ||
                    !playerName
                ) {
                    return res.status(400).json({
                        error:
                            "Game ID, player ID and player name are required."
                    });
                }

                const game =
                    await getGame(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!game) {
                    return res.status(404).json({
                        error: "Game not found."
                    });
                }

                if (game.status !== "waiting") {
                    return res.status(409).json({
                        error:
                            "This game has already started."
                    });
                }

                let players =
                    Array.isArray(game.players)
                        ? [...game.players]
                        : [];

                if (
                    players.some(
                        p => p.id === playerId
                    )
                ) {

                    return res.status(200).json({
                        success: true,
                        game
                    });
                }

                if (
                    players.length >=
                    Number(game.max_players)
                ) {
                    return res.status(409).json({
                        error: "Game is full."
                    });
                }

                players.push({
                    id: playerId,
                    name: playerName,
                    joined: true,
                    is_host: false
                });

                const updated =
                    await updateGame(
                        cleanUrl,
                        headers,
                        gameId,
                        {
                            players
                        }
                    );

                return res.status(200).json({
                    success: true,
                    game: updated
                });
            }


            /* =================================================
               LEAVE
            ================================================= */

            if (action === "leave") {

                const gameId =
                    String(
                        body.game_id || ""
                    ).trim();

                const playerId =
                    String(
                        body.player_id || ""
                    ).trim();

                if (!gameId || !playerId) {
                    return res.status(400).json({
                        error:
                            "Game ID and player ID are required."
                    });
                }

                const game =
                    await getGame(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!game) {
                    return res.status(404).json({
                        error: "Game not found."
                    });
                }

                let players =
                    Array.isArray(game.players)
                        ? [...game.players]
                        : [];

                players =
                    players.filter(
                        p => p.id !== playerId
                    );

                /*
                 * If nobody remains,
                 * automatically remove the game.
                 */

                if (!players.length) {

                    await deleteGame(
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
                 * If the host leaves while waiting,
                 * stop the game.
                 */

                if (
                    game.host_id === playerId
                ) {

                    await deleteGame(
                        cleanUrl,
                        headers,
                        gameId
                    );

                    return res.status(200).json({
                        success: true,
                        removed: true
                    });
                }

                const updated =
                    await updateGame(
                        cleanUrl,
                        headers,
                        gameId,
                        {
                            players
                        }
                    );

                return res.status(200).json({
                    success: true,
                    game: updated
                });
            }


            /* =================================================
               START
            ================================================= */

            if (action === "start") {

                const gameId =
                    String(
                        body.game_id || ""
                    ).trim();

                const playerId =
                    String(
                        body.player_id || ""
                    ).trim();

                if (!gameId || !playerId) {
                    return res.status(400).json({
                        error:
                            "Game ID and player ID are required."
                    });
                }

                const game =
                    await getGame(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!game) {
                    return res.status(404).json({
                        error: "Game not found."
                    });
                }

                if (
                    game.host_id !== playerId
                ) {
                    return res.status(403).json({
                        error:
                            "Only the host can start the game."
                    });
                }

                if (game.status !== "waiting") {
                    return res.status(409).json({
                        error:
                            "Game has already started."
                    });
                }

                const players =
                    Array.isArray(game.players)
                        ? game.players
                        : [];

                if (players.length < 1) {
                    return res.status(400).json({
                        error:
                            "At least one player is required."
                    });
                }

                const firstPlayer =
                    players[0];

                const state = {
                    turn: firstPlayer.id,
                    board: [],
                    winner: null,
                    move_count: 0
                };

                const updated =
                    await updateGame(
                        cleanUrl,
                        headers,
                        gameId,
                        {
                            status: "playing",
                            game_state: state
                        }
                    );

                return res.status(200).json({
                    success: true,
                    game: updated
                });
            }


            /* =================================================
               MOVE
            ================================================= */

            if (action === "move") {

                const gameId =
                    String(
                        body.game_id || ""
                    ).trim();

                const playerId =
                    String(
                        body.player_id || ""
                    ).trim();

                if (!gameId || !playerId) {
                    return res.status(400).json({
                        error:
                            "Game ID and player ID are required."
                    });
                }

                const game =
                    await getGame(
                        cleanUrl,
                        headers,
                        gameId
                    );

                if (!game) {
                    return res.status(404).json({
                        error: "Game not found."
                    });
                }

                if (game.status !== "playing") {
                    return res.status(409).json({
                        error:
                            "The game is not currently playing."
                    });
                }

                const players =
                    Array.isArray(game.players)
                        ? game.players
                        : [];

                if (
                    !players.some(
                        p => p.id === playerId
                    )
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a player in this game."
                    });
                }

                const state =
                    game.game_state || {};

                if (
                    state.turn &&
                    state.turn !== playerId
                ) {
                    return res.status(409).json({
                        error:
                            "It is not your turn."
                    });
                }

                /*
                 * The actual game-specific move
                 * is supplied by the HTML game.
                 */

                const newState =
                    body.game_state;

                if (
                    !newState ||
                    typeof newState !== "object"
                ) {
                    return res.status(400).json({
                        error:
                            "Game state is required."
                    });
                }

                const updated =
                    await updateGame(
                        cleanUrl,
                        headers,
                        gameId,
                        {
                            game_state: newState
                        }
                    );

                return res.status(200).json({
                    success: true,
                    game: updated
                });
            }


            return res.status(400).json({
                error: "Unknown game action."
            });
        }


        /* =====================================================
           DELETE
        ===================================================== */

        if (req.method === "DELETE") {

            const body =
                req.body || {};

            const gameId =
                String(
                    body.game_id || ""
                ).trim();

            const playerId =
                String(
                    body.player_id || ""
                ).trim();

            const force =
                body.force === true;

            if (!gameId || !playerId) {
                return res.status(400).json({
                    error:
                        "Game ID and player ID are required."
                });
            }

            const game =
                await getGame(
                    cleanUrl,
                    headers,
                    gameId
                );

            if (!game) {
                return res.status(404).json({
                    error: "Game not found."
                });
            }

            /*
             * Only the host can force-stop.
             */

            if (
                force &&
                game.host_id !== playerId
            ) {
                return res.status(403).json({
                    error:
                        "Only the host can force-stop the game."
                });
            }

            /*
             * Normal delete is also allowed
             * for the host.
             */

            if (
                game.host_id !== playerId
            ) {
                return res.status(403).json({
                    error:
                        "Only the host can remove this game."
                });
            }

            await deleteGame(
                cleanUrl,
                headers,
                gameId
            );

            return res.status(200).json({
                success: true,
                removed: true,
                message:
                    force
                        ? "Game force-stopped."
                        : "Game removed."
            });
        }


        return res.status(405).json({
            error: "Method not allowed."
        });

    } catch (error) {

        console.error(
            "GAME API ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Game server error."
        });
    }
}


/* =========================================================
   GET GAME
========================================================= */

async function getGame(
    baseUrl,
    headers,
    gameId
) {

    const response =
        await fetch(
            baseUrl +
            "/rest/v1/games" +
            "?id=eq." +
            encodeURIComponent(gameId) +
            "&select=*",
            {
                method: "GET",
                headers
            }
        );

    const data =
        await readJson(response);

    if (
        !response.ok ||
        !Array.isArray(data) ||
        !data.length
    ) {
        return null;
    }

    return data[0];
}


/* =========================================================
   UPDATE GAME
========================================================= */

async function updateGame(
    baseUrl,
    headers,
    gameId,
    changes
) {

    const response =
        await fetch(
            baseUrl +
            "/rest/v1/games" +
            "?id=eq." +
            encodeURIComponent(gameId),
            {
                method: "PATCH",
                headers: {
                    ...headers,
                    "Prefer":
                        "return=representation"
                },
                body:
                    JSON.stringify(changes)
            }
        );

    const data =
        await readJson(response);

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Failed to update game."
        );
    }

    return Array.isArray(data)
        ? data[0]
        : data;
}


/* =========================================================
   DELETE GAME
========================================================= */

async function deleteGame(
    baseUrl,
    headers,
    gameId
) {

    const response =
        await fetch(
            baseUrl +
            "/rest/v1/games" +
            "?id=eq." +
            encodeURIComponent(gameId),
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
        throw new Error(
            data.message ||
            data.error ||
            "Failed to delete game."
        );
    }

    return true;
}


/* =========================================================
   JSON
========================================================= */

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


/* =========================================================
   SUPABASE ERROR
========================================================= */

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