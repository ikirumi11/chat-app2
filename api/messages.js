export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        const supabaseUrl = "https://wlvbkdzcueqkknysisfw.supabase.co";
        const supabaseKey = "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
        const cleanUrl = supabaseUrl.replace(/\/+$/, "");

        const headers = {
            "apikey": supabaseKey,
            "Authorization": "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        if (req.method === "GET") {
            const channel = String(req.query.channel || "general")
                .trim()
                .substring(0, 32);

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,files,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response = await fetch(url, {
                method: "GET",
                headers
            });

            const data = await readJson(response);

            if (!response.ok) {
                return supabaseError(res, response, data);
            }

            return res.status(200).json({
                success: true,
                messages: Array.isArray(data) ? data : []
            });
        }

        if (req.method === "POST") {
            const body = req.body || {};

            const username = String(body.username || "")
                .trim()
                .substring(0, 24);

            const channel = String(body.channel || "general")
                .trim()
                .substring(0, 32);

            const message = String(body.message || "")
                .trim()
                .substring(0, 20000);

            const deviceId = String(body.device_id || "")
                .trim()
                .substring(0, 100);

            const gameServer = body.game_server === true;

            if (gameServer) {
                if (!deviceId) {
                    return res.status(400).json({
                        error: "Device ID is required for a game server."
                    });
                }

                // Server-side lifecycle commands.
                // These never become visible chat messages.
                if (
                    body.game_action === "stop" ||
                    body.game_action === "leave"
                ) {
                    const gameId = String(body.game_id || "")
                        .trim()
                        .substring(0, 120);

                    if (!gameId) {
                        return res.status(400).json({
                            error: "Game ID is required."
                        });
                    }

                    const gameMessages = await getGameMessages(
                        cleanUrl,
                        headers,
                        channel,
                        gameId
                    );

                    if (!gameMessages.length) {
                        return res.status(200).json({
                            success: true,
                            stopped: true,
                            removed: 0
                        });
                    }

                    // STOP:
                    // Delete every invisible state message for the game.
                    if (body.game_action === "stop") {
                        const removed = await deleteGameMessages(
                            cleanUrl,
                            headers,
                            gameMessages
                        );

                        return res.status(200).json({
                            success: true,
                            stopped: true,
                            removed
                        });
                    }

                    // LEAVE:
                    // Remove the leaving player from the latest state.
                    const latest = gameMessages[0];

                    let state = parseGameState(latest.message);

                    if (!state || state.type !== "game") {
                        const removed = await deleteGameMessages(
                            cleanUrl,
                            headers,
                            gameMessages
                        );

                        return res.status(200).json({
                            success: true,
                            stopped: true,
                            removed
                        });
                    }

                    state.players = Array.isArray(state.players)
                        ? state.players.filter(
                            p => p && p.deviceId !== deviceId
                        )
                        : [];

                    // No players left = remove the entire game.
                    if (!state.players.length) {
                        const removed = await deleteGameMessages(
                            cleanUrl,
                            headers,
                            gameMessages
                        );

                        return res.status(200).json({
                            success: true,
                            stopped: true,
                            removed
                        });
                    }

                    // If the host leaves, transfer hosting.
                    if (state.hostDeviceId === deviceId) {
                        const nextHost = state.players[0];

                        state.hostDeviceId = nextHost.deviceId;
                        state.host = nextHost.username;
                    }

                    if (
                        state.status === "playing" &&
                        state.turnIndex >= state.players.length
                    ) {
                        state.turnIndex = 0;
                    }

                    // Remove all old invisible copies before creating
                    // the one authoritative state.
                    await deleteGameMessages(
                        cleanUrl,
                        headers,
                        gameMessages
                    );

                    const inserted = await insertGameState(
                        cleanUrl,
                        headers,
                        channel,
                        state
                    );

                    return res.status(200).json({
                        success: true,
                        stopped: false,
                        left: true,
                        game: inserted
                    });
                }

                if (!message) {
                    return res.status(400).json({
                        error: "Game state is required."
                    });
                }

                const gameData = {
                    username: "__GAME_SERVER__",
                    channel,
                    message,
                    image: null,
                    files: [],
                    device_id: deviceId,
                    edited: false
                };

                const response = await fetch(
                    cleanUrl + "/rest/v1/messages",
                    {
                        method: "POST",
                        headers: {
                            ...headers,
                            "Prefer": "return=representation"
                        },
                        body: JSON.stringify(gameData)
                    }
                );

                const data = await readJson(response);

                if (!response.ok) {
                    return supabaseError(res, response, data);
                }

                return res.status(200).json({
                    success: true,
                    game: Array.isArray(data)
                        ? data[0]
                        : data
                });
            }

            let image = null;

            if (
                body.image &&
                typeof body.image === "string"
            ) {
                image = body.image;
            }

            let files = [];

            if (
                Array.isArray(body.files) &&
                body.files.length
            ) {
                const MAX_FILES = 5;
                const MAX_FILE_SIZE = 5 * 1024 * 1024;

                for (const file of body.files) {
                    if (files.length >= MAX_FILES) break;

                    if (
                        !file.data ||
                        typeof file.data !== "string"
                    ) {
                        continue;
                    }

                    if (
                        !file.name ||
                        typeof file.name !== "string"
                    ) {
                        continue;
                    }

                    const base64Data =
                        file.data.split(",")[1] || "";

                    const sizeInBytes =
                        Math.ceil(
                            (base64Data.length * 3) / 4
                        );

                    if (
                        sizeInBytes > MAX_FILE_SIZE ||
                        file.data.length > 5000000
                    ) {
                        continue;
                    }

                    files.push({
                        name: file.name.substring(0, 255),
                        data: file.data,
                        size: file.size || sizeInBytes,
                        type:
                            file.type ||
                            "application/octet-stream"
                    });
                }
            }

            if (!username) {
                return res.status(400).json({
                    error: "Username is required."
                });
            }

            if (
                !message &&
                !image &&
                files.length === 0
            ) {
                return res.status(400).json({
                    error:
                        "Message, image, or files are required."
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
                files,
                device_id: deviceId,
                edited: false
            };

            const response = await fetch(
                cleanUrl + "/rest/v1/messages",
                {
                    method: "POST",
                    headers: {
                        ...headers,
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify(messageData)
                }
            );

            const data = await readJson(response);

            if (!response.ok) {
                return supabaseError(res, response, data);
            }

            return res.status(200).json({
                success: true,
                message: Array.isArray(data)
                    ? data[0]
                    : data
            });
        }

        if (req.method === "PATCH") {
            const body = req.body || {};

            const id = String(body.id || "").trim();
            const deviceId = String(body.device_id || "").trim();

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            if (body.game_server === true) {
                const gameState = String(body.game_state || "")
                    .trim()
                    .substring(0, 20000);

                if (!gameState) {
                    return res.status(400).json({
                        error: "Game state is required."
                    });
                }

                const url =
                    cleanUrl +
                    "/rest/v1/messages?id=eq." +
                    encodeURIComponent(id) +
                    "&username=eq.__GAME_SERVER__" +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId);

                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        ...headers,
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        message: gameState,
                        edited: true
                    })
                });

                const data = await readJson(response);

                if (!response.ok) {
                    return supabaseError(res, response, data);
                }

                if (
                    !Array.isArray(data) ||
                    !data.length
                ) {
                    return res.status(403).json({
                        error:
                            "You are not the game host."
                    });
                }

                return res.status(200).json({
                    success: true,
                    game: data[0]
                });
            }

            const message = String(body.message || "")
                .trim()
                .substring(0, 2000);

            const url =
                cleanUrl +
                "/rest/v1/messages?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId) +
                "&username=neq.__GAME_SERVER__";

            const response = await fetch(url, {
                method: "PATCH",
                headers: {
                    ...headers,
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    message,
                    edited: true
                })
            });

            const data = await readJson(response);

            if (!response.ok) {
                return supabaseError(res, response, data);
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

        if (req.method === "DELETE") {
            const body = req.body || {};

            // FULL CHAT WIPE
            if (body.delete_all === true) {
                const response = await fetch(
                    cleanUrl +
                    "/rest/v1/messages?id=not.is.null",
                    {
                        method: "DELETE",
                        headers: {
                            ...headers,
                            "Prefer": "return=minimal"
                        }
                    }
                );

                const data = await readJson(response);

                if (!response.ok) {
                    return supabaseError(
                        res,
                        response,
                        data
                    );
                }

                return res.status(200).json({
                    success: true,
                    message: "Everything was deleted."
                });
            }

            // DELETE GAME SERVER
            if (body.game_server === true) {
                const deviceId =
                    String(body.device_id || "").trim();

                const id =
                    String(body.id || "").trim();

                const gameId =
                    String(body.game_id || "")
                        .trim()
                        .substring(0, 120);

                if (!deviceId) {
                    return res.status(400).json({
                        error: "Device ID is required."
                    });
                }

                // Delete every invisible message belonging
                // to the specified game.
                if (gameId) {
                    const gameMessages =
                        await getGameMessages(
                            cleanUrl,
                            headers,
                            String(
                                body.channel ||
                                "general"
                            )
                                .trim()
                                .substring(0, 32),
                            gameId
                        );

                    const removed =
                        await deleteGameMessages(
                            cleanUrl,
                            headers,
                            gameMessages
                        );

                    return res.status(200).json({
                        success: true,
                        message:
                            "Game server messages removed.",
                        removed
                    });
                }

                // Delete one invisible game-server message.
                if (!id) {
                    return res.status(400).json({
                        error:
                            "Game ID/message ID is required."
                    });
                }

                const url =
                    cleanUrl +
                    "/rest/v1/messages?id=eq." +
                    encodeURIComponent(id) +
                    "&username=eq.__GAME_SERVER__" +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId);

                const response = await fetch(url, {
                    method: "DELETE",
                    headers: {
                        ...headers,
                        "Prefer": "return=representation"
                    }
                });

                const data = await readJson(response);

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
                        "Game server removed."
                });
            }

            // NORMAL MESSAGE DELETE
            const id =
                String(body.id || "").trim();

            const deviceId =
                String(body.device_id || "").trim();

            if (!id || !deviceId) {
                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });
            }

            const url =
                cleanUrl +
                "/rest/v1/messages?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId) +
                "&username=neq.__GAME_SERVER__";

            const response = await fetch(url, {
                method: "DELETE",
                headers: {
                    ...headers,
                    "Prefer": "return=representation"
                }
            });

            const data = await readJson(response);

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
                success: true,
                message: "Message deleted."
            });
        }

        return res.status(405).json({
            error: "Method not allowed."
        });

    } catch (error) {
        console.error(
            "MESSAGE/GAME API ERROR:",
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

async function getGameMessages(
    baseUrl,
    headers,
    channel,
    gameId
) {
    const url =
        baseUrl +
        "/rest/v1/messages" +
        "?select=id,username,channel,message,image,files,device_id,edited,created_at" +
        "&channel=eq." +
        encodeURIComponent(channel) +
        "&username=eq.__GAME_SERVER__" +
        "&message=like.*" +
        encodeURIComponent(gameId) +
        "*" +
        "&order=created_at.desc";

    const response = await fetch(url, {
        method: "GET",
        headers
    });

    const data = await readJson(response);

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Could not find game messages."
        );
    }

    return Array.isArray(data)
        ? data
        : [];
}


async function deleteGameMessages(
    baseUrl,
    headers,
    messages
) {
    let removed = 0;

    for (const message of messages) {
        if (!message?.id) continue;

        const url =
            baseUrl +
            "/rest/v1/messages?id=eq." +
            encodeURIComponent(message.id) +
            "&username=eq.__GAME_SERVER__" +
            "&device_id=eq." +
            encodeURIComponent(
                message.device_id || ""
            );

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                ...headers,
                "Prefer": "return=representation"
            }
        });

        const data = await readJson(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Could not delete game message."
            );
        }

        if (Array.isArray(data)) {
            removed += data.length;
        }
    }

    return removed;
}


async function insertGameState(
    baseUrl,
    headers,
    channel,
    state
) {
    const row = {
        username: "__GAME_SERVER__",
        channel,
        message:
            "__CHAT_GAME_STATE__:" +
            JSON.stringify(state),
        image: null,
        files: [],
        device_id: state.hostDeviceId,
        edited: false
    };

    const response = await fetch(
        baseUrl + "/rest/v1/messages",
        {
            method: "POST",
            headers: {
                ...headers,
                "Prefer": "return=representation"
            },
            body: JSON.stringify(row)
        }
    );

    const data = await readJson(response);

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Could not write game state."
        );
    }

    return Array.isArray(data)
        ? data[0]
        : data;
}


function parseGameState(message) {
    const prefix =
        "__CHAT_GAME_STATE__:";

    if (
        typeof message !== "string" ||
        !message.startsWith(prefix)
    ) {
        return null;
    }

    try {
        return JSON.parse(
            message.substring(prefix.length)
        );
    } catch {
        return null;
    }
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

async function readJson(response) {
    const text =
        await response.text();

    if (!text) return {};

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
