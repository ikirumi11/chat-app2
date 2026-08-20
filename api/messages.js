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

    const SUPABASE_URL =
        process.env.SUPABASE_URL ||
        "https://wlvbkdzcueqkknysisfw.supabase.co";

    /*
     * Keep this as your PUBLIC/publishable key.
     *
     * For production, preferably put it in an environment variable:
     * SUPABASE_PUBLISHABLE_KEY
     */
    const SUPABASE_KEY =
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        "prj_IMlCG1QDEBoeaSRuGvuEMS0t3Ifv";

    const cleanUrl =
        SUPABASE_URL.replace(/\/+$/, "");

    const headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    try {

        /* =====================================================
           GET
        ===================================================== */

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel || "general"
                )
                .trim()
                .substring(0, 32);

            const games =
                req.query.games === "true";

            if (games) {

                const url =
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?select=id,username,channel,message,device_id,created_at" +
                    "&channel=eq." +
                    encodeURIComponent(channel) +
                    "&message=like." +
                    encodeURIComponent("__GAME_STATE__%") +
                    "&order=created_at.asc";

                const response =
                    await fetch(url, {
                        method: "GET",
                        headers
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

                const gamesList = [];

                if (Array.isArray(data)) {

                    for (const row of data) {

                        try {

                            const raw =
                                String(row.message || "")
                                    .substring(
                                        "__GAME_STATE__".length
                                    );

                            const state =
                                JSON.parse(raw);

                            state._messageId = row.id;

                            gamesList.push(state);

                        } catch {
                            /*
                             * Ignore broken temporary game rows.
                             */
                        }
                    }
                }

                return res.status(200).json({
                    success: true,
                    games: gamesList
                });
            }

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response =
                await fetch(url, {
                    method: "GET",
                    headers
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

            const messages =
                Array.isArray(data)
                    ? data.filter(
                        m =>
                            !String(m.message || "")
                                .startsWith("__GAME_STATE__")
                    )
                    : [];

            return res.status(200).json({
                success: true,
                messages
            });
        }


        /* =====================================================
           POST
        ===================================================== */

        if (req.method === "POST") {

            const body = req.body || {};

            /*
             * GAME CREATE
             */

            if (body.game_action === "create") {

                const game =
                    cleanGameState(body.game);

                if (!game) {
                    return res.status(400).json({
                        error: "Invalid game state."
                    });
                }

                if (!game.gameId ||
                    !game.hostDeviceId ||
                    !game.hostName) {

                    return res.status(400).json({
                        error: "Missing game host information."
                    });
                }

                /*
                 * One host may only have one active game.
                 */

                const existing =
                    await findHostGames(
                        cleanUrl,
                        headers,
                        game.hostDeviceId,
                        game.channel
                    );

                if (existing.length > 0) {

                    return res.status(409).json({
                        error:
                            "You are already hosting a game."
                    });
                }

                const row = {
                    username: game.hostName,
                    channel: game.channel,
                    message:
                        "__GAME_STATE__" +
                        JSON.stringify(game),
                    image: null,
                    device_id: game.hostDeviceId,
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

                return res.status(200).json({
                    success: true,
                    game: game,
                    messageId:
                        Array.isArray(data)
                            ? data[0]?.id
                            : data?.id
                });
            }


            /*
             * NORMAL MESSAGE
             */

            const username =
                String(body.username || "")
                    .trim()
                    .substring(0, 24);

            const channel =
                String(
                    body.channel || "general"
                )
                .trim()
                .substring(0, 32);

            const message =
                String(body.message || "")
                    .trim()
                    .substring(0, 2000);

            const deviceId =
                String(body.device_id || "")
                    .trim()
                    .substring(0, 100);

            let image = null;

            if (
                body.image &&
                typeof body.image === "string"
            ) {
                image = body.image;
            }

            if (!username) {
                return res.status(400).json({
                    error: "Username is required."
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
                    error: "Image is too large."
                });
            }

            if (
                image &&
                !image.startsWith("data:image/")
            ) {
                return res.status(400).json({
                    error: "Invalid image data."
                });
            }

            const messageData = {
                username,
                channel,
                message,
                image,
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
                            JSON.stringify(messageData)
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


        /* =====================================================
           PATCH
        ===================================================== */

        if (req.method === "PATCH") {

            const body = req.body || {};

            /*
             * GAME UPDATE
             */

            if (body.game_action === "update") {

                const game =
                    cleanGameState(body.game);

                if (!game) {
                    return res.status(400).json({
                        error: "Invalid game."
                    });
                }

                const id =
                    String(
                        body.message_id || ""
                    ).trim();

                const deviceId =
                    String(
                        body.device_id || ""
                    ).trim();

                if (!id || !deviceId) {
                    return res.status(400).json({
                        error:
                            "Game message ID and device ID are required."
                    });
                }

                if (
                    game.hostDeviceId !==
                    deviceId
                ) {
                    return res.status(403).json({
                        error:
                            "Only the host can update the game."
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
                    await fetch(
                        url,
                        {
                            method: "PATCH",
                            headers: {
                                ...headers,
                                "Prefer":
                                    "return=representation"
                            },
                            body:
                                JSON.stringify({
                                    username:
                                        game.hostName,
                                    channel:
                                        game.channel,
                                    message:
                                        "__GAME_STATE__" +
                                        JSON.stringify(game),
                                    edited: true
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

                if (
                    !Array.isArray(data) ||
                    !data.length
                ) {
                    return res.status(403).json({
                        error:
                            "Game no longer exists or you are not the host."
                    });
                }

                return res.status(200).json({
                    success: true,
                    game
                });
            }


            /*
             * NORMAL EDIT
             */

            const id =
                String(body.id || "")
                    .trim();

            const deviceId =
                String(body.device_id || "")
                    .trim();

            const message =
                String(body.message || "")
                    .trim()
                    .substring(0, 2000);

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
                await fetch(
                    url,
                    {
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


        /* =====================================================
           DELETE
        ===================================================== */

        if (req.method === "DELETE") {

            const body = req.body || {};


            /*
             * GAME DELETE
             */

            if (
                body.game_action === "delete"
            ) {

                const id =
                    String(
                        body.message_id || ""
                    ).trim();

                const deviceId =
                    String(
                        body.device_id || ""
                    ).trim();

                if (!id || !deviceId) {
                    return res.status(400).json({
                        error:
                            "Game ID and device ID are required."
                    });
                }

                /*
                 * First verify that this device
                 * is actually the host.
                 */

                const verifyUrl =
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?select=id,device_id,message" +
                    "&id=eq." +
                    encodeURIComponent(id) +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId);

                const verifyResponse =
                    await fetch(
                        verifyUrl,
                        {
                            method: "GET",
                            headers
                        }
                    );

                const verifyData =
                    await readJson(
                        verifyResponse
                    );

                if (
                    !verifyResponse.ok ||
                    !Array.isArray(verifyData) ||
                    !verifyData.length
                ) {
                    return res.status(403).json({
                        error:
                            "Only the game host can remove this game."
                    });
                }

                const raw =
                    String(
                        verifyData[0].message || ""
                    );

                if (
                    !raw.startsWith(
                        "__GAME_STATE__"
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "This is not a game state."
                    });
                }

                const deleteUrl =
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?id=eq." +
                    encodeURIComponent(id);

                const response =
                    await fetch(
                        deleteUrl,
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
                    success: true
                });
            }


            /*
             * FULL CHAT WIPE
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
                        "All messages were deleted."
                });
            }


            /*
             * NORMAL MESSAGE DELETE
             */

            const id =
                String(body.id || "")
                    .trim();

            const deviceId =
                String(body.device_id || "")
                    .trim();

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
                await fetch(
                    url,
                    {
                        method: "DELETE",
                        headers: {
                            ...headers,
                            "Prefer":
                                "return=representation"
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
            error: "Method not allowed."
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


/* =========================================================
   GAME HELPERS
========================================================= */

function cleanGameState(game) {

    if (
        !game ||
        typeof game !== "object"
    ) {
        return null;
    }

    const result = {
        gameId:
            String(game.gameId || "")
                .substring(0, 80),

        gameType:
            String(game.gameType || "")
                .substring(0, 30),

        title:
            String(game.title || "")
                .substring(0, 80),

        channel:
            String(
                game.channel || "general"
            )
            .substring(0, 32),

        hostDeviceId:
            String(
                game.hostDeviceId || ""
            )
            .substring(0, 100),

        hostName:
            String(
                game.hostName || "Host"
            )
            .substring(0, 24),

        status:
            game.status === "playing"
                ? "playing"
                : "lobby",

        maxPlayers:
            Math.max(
                2,
                Math.min(
                    12,
                    Number(game.maxPlayers) || 2
                )
            ),

        players:
            Array.isArray(game.players)
                ? game.players
                    .slice(0, 12)
                    .map(p => ({
                        deviceId:
                            String(
                                p.deviceId || ""
                            ).substring(0, 100),

                        name:
                            String(
                                p.name || "Player"
                            ).substring(0, 24)
                    }))
                    .filter(p => p.deviceId)
                : [],

        turnIndex:
            Math.max(
                0,
                Number(game.turnIndex) || 0
            ),

        state:
            game.state &&
            typeof game.state === "object"
                ? game.state
                : {},

        version:
            Number(game.version) || 1,

        updatedAt:
            Date.now()
    };

    if (!result.gameId ||
        !result.hostDeviceId) {
        return null;
    }

    /*
     * Prevent enormous arbitrary game payloads.
     */

    const encoded =
        JSON.stringify(result);

    if (encoded.length > 500000) {
        return null;
    }

    return result;
}


async function findHostGames(
    cleanUrl,
    headers,
    deviceId,
    channel
) {

    const url =
        cleanUrl +
        "/rest/v1/messages" +
        "?select=id,message" +
        "&channel=eq." +
        encodeURIComponent(channel || "general") +
        "&device_id=eq." +
        encodeURIComponent(deviceId) +
        "&message=like." +
        encodeURIComponent("__GAME_STATE__%");

    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers
            }
        );

    const data =
        await readJson(response);

    if (
        !response.ok ||
        !Array.isArray(data)
    ) {
        return [];
    }

    return data;
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
        response.status || 500
    ).json({
        error:
            data.message ||
            data.error ||
            "Supabase request failed.",
        details: data
    });
}