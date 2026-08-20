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
           GET
        ===================================================== */

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel || "general"
                )
                .trim()
                .substring(0, 32);

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response = await fetch(
                url,
                {
                    method: "GET",
                    headers
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
                messages:
                    Array.isArray(data)
                        ? data
                        : []
            });
        }


        /* =====================================================
           POST
           Normal chat OR hidden game-server message
        ===================================================== */

        if (req.method === "POST") {

            const body = req.body || {};

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
                    .substring(0, 20000);

            const deviceId =
                String(body.device_id || "")
                    .trim()
                    .substring(0, 100);

            const gameServer =
                body.game_server === true;

            let image = null;

            if (
                body.image &&
                typeof body.image === "string"
            ) {
                image = body.image;
            }


            /* GAME SERVER */

            if (gameServer) {

                if (!deviceId) {
                    return res.status(400).json({
                        error:
                            "Device ID is required for a game server."
                    });
                }

                if (!message) {
                    return res.status(400).json({
                        error:
                            "Game state is required."
                    });
                }

                /*
                 * Hidden game messages are marked with
                 * this special username.
                 */

                const gameData = {
                    username: "__GAME_SERVER__",
                    channel,
                    message,
                    image: null,
                    device_id: deviceId,
                    edited: false
                };

                const response = await fetch(
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
                            JSON.stringify(gameData)
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
                    game:
                        Array.isArray(data)
                            ? data[0]
                            : data
                });
            }


            /* NORMAL MESSAGE */

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

            const messageData = {
                username,
                channel,
                message,
                image,
                device_id: deviceId,
                edited: false
            };

            const response = await fetch(
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
           Normal message editing OR game-state update
        ===================================================== */

        if (req.method === "PATCH") {

            const body = req.body || {};

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


            /* GAME STATE UPDATE */

            if (body.game_server === true) {

                const gameState =
                    String(body.game_state || "")
                        .trim()
                        .substring(0, 20000);

                if (!gameState) {
                    return res.status(400).json({
                        error:
                            "Game state is required."
                    });
                }

                const url =
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?id=eq." +
                    encodeURIComponent(id) +
                    "&username=eq.__GAME_SERVER__" +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId);

                const response = await fetch(
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
                                message: gameState,
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
                            "You are not the game host."
                    });
                }

                return res.status(200).json({
                    success: true,
                    game: data[0]
                });
            }


            /* NORMAL EDIT */

            const message =
                String(body.message || "")
                    .trim()
                    .substring(0, 2000);

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId) +
                "&username=neq.__GAME_SERVER__";

            const response = await fetch(
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


            /* FULL CHAT WIPE */

            if (body.delete_all === true) {

                const response = await fetch(
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


            /* DELETE GAME SERVER */

            if (body.game_server === true) {

                const id =
                    String(body.id || "")
                        .trim();

                const deviceId =
                    String(body.device_id || "")
                        .trim();

                if (!id || !deviceId) {
                    return res.status(400).json({
                        error:
                            "Game ID and device ID are required."
                    });
                }

                const url =
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?id=eq." +
                    encodeURIComponent(id) +
                    "&username=eq.__GAME_SERVER__" +
                    "&device_id=eq." +
                    encodeURIComponent(deviceId);

                const response = await fetch(
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

                return res.status(200).json({
                    success: true,
                    message:
                        "Game server removed."
                });
            }


            /* NORMAL MESSAGE DELETE */

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
                encodeURIComponent(deviceId) +
                "&username=neq.__GAME_SERVER__";

            const response = await fetch(
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
                success: true,
                message:
                    "Message deleted."
            });
        }


        return res.status(405).json({
            error:
                "Method not allowed."
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
   HELPERS
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