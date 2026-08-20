export default async function handler(req, res) {

    /* =====================================================
       CORS / RESPONSE
    ===================================================== */

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    /*
     * VERY IMPORTANT:
     * Prevent browsers / proxies from showing an old chat.
     */
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader(
        "Pragma",
        "no-cache"
    );

    res.setHeader(
        "Expires",
        "0"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    /* =====================================================
       SUPABASE
    ===================================================== */

    const supabaseUrl =
        "https://wlvbkdzcueqkknysisfw.supabase.co";

    const supabaseKey =
        "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";

    const baseUrl =
        supabaseUrl.replace(/\/+$/, "");

    const supabaseHeaders = {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };


    try {

        /* =================================================
           GET MESSAGES
        ================================================= */

        if (req.method === "GET") {

            let channel =
                String(
                    req.query?.channel || "general"
                )
                .trim()
                .substring(0, 32);

            if (!channel) {
                channel = "general";
            }


            /*
             * Fetch messages from Supabase.
             *
             * created_at is used for ordering.
             *
             * id is also included so the frontend has
             * a unique identifier even when timestamps
             * are identical.
             */

            const params =
                new URLSearchParams();

            params.set(
                "select",
                "id,username,channel,message,image,device_id,edited,created_at"
            );

            params.set(
                "channel",
                `eq.${channel}`
            );

            params.set(
                "username",
                "neq.__GAME_SERVER__"
            );

            params.set(
                "order",
                "created_at.asc,id.asc"
            );

            /*
             * Don't let a broken client request millions
             * of messages.
             */

            params.set(
                "limit",
                "500"
            );


            const url =
                `${baseUrl}/rest/v1/messages?${params.toString()}`;


            const response =
                await fetch(
                    url,
                    {
                        method: "GET",
                        headers: supabaseHeaders,
                        cache: "no-store"
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


            const messages =
                Array.isArray(data)
                    ? data
                    : [];


            /*
             * Always return the same structure.
             */

            return res.status(200).json({

                success: true,

                channel,

                count:
                    messages.length,

                messages

            });
        }


        /* =================================================
           POST
        ================================================= */

        if (req.method === "POST") {

            const body =
                req.body || {};


            const username =
                String(
                    body.username || ""
                )
                .trim()
                .substring(0, 24);


            let channel =
                String(
                    body.channel || "general"
                )
                .trim()
                .substring(0, 32);


            if (!channel) {
                channel = "general";
            }


            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 20000);


            const deviceId =
                String(
                    body.device_id || ""
                )
                .trim()
                .substring(0, 100);


            const gameServer =
                body.game_server === true;


            let image = null;


            if (
                typeof body.image === "string" &&
                body.image.length > 0
            ) {

                image =
                    body.image;

            }


            /* =================================================
               GAME SERVER MESSAGE
            ================================================= */

            if (gameServer) {

                if (!deviceId) {

                    return res.status(400).json({
                        success: false,
                        error:
                            "Device ID is required."
                    });

                }


                if (!message) {

                    return res.status(400).json({
                        success: false,
                        error:
                            "Game state is required."
                    });

                }


                const gameData = {

                    username:
                        "__GAME_SERVER__",

                    channel,

                    message,

                    image: null,

                    device_id:
                        deviceId,

                    edited: false

                };


                const response =
                    await fetch(
                        `${baseUrl}/rest/v1/messages`,
                        {
                            method: "POST",

                            headers: {
                                ...supabaseHeaders,

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


                const game =
                    Array.isArray(data)
                        ? data[0]
                        : data;


                return res.status(200).json({

                    success: true,

                    game

                });

            }


            /* =================================================
               NORMAL MESSAGE
            ================================================= */

            if (!username) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Username is required."

                });

            }


            if (!message && !image) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Message or image is required."

                });

            }


            if (
                image &&
                image.length > 5000000
            ) {

                return res.status(413).json({

                    success: false,

                    error:
                        "Image is too large."

                });

            }


            if (
                image &&
                !image.startsWith(
                    "data:image/"
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid image data."

                });

            }


            const messageData = {

                username,

                channel,

                message,

                image,

                device_id:
                    deviceId || null,

                edited: false

            };


            const response =
                await fetch(
                    `${baseUrl}/rest/v1/messages`,
                    {

                        method: "POST",

                        headers: {

                            ...supabaseHeaders,

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify(
                                messageData
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


            const createdMessage =
                Array.isArray(data)
                    ? data[0]
                    : data;


            return res.status(201).json({

                success: true,

                message:
                    createdMessage

            });

        }


        /* =================================================
           PATCH
        ================================================= */

        if (req.method === "PATCH") {

            const body =
                req.body || {};


            const id =
                String(
                    body.id || ""
                )
                .trim();


            const deviceId =
                String(
                    body.device_id || ""
                )
                .trim();


            if (!id || !deviceId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Message ID and device ID are required."

                });

            }


            /* =============================================
               GAME STATE
            ============================================= */

            if (body.game_server === true) {

                const gameState =
                    String(
                        body.game_state || ""
                    )
                    .trim()
                    .substring(0, 20000);


                if (!gameState) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Game state is required."

                    });

                }


                const params =
                    new URLSearchParams();

                params.set(
                    "id",
                    `eq.${id}`
                );

                params.set(
                    "username",
                    "eq.__GAME_SERVER__"
                );

                params.set(
                    "device_id",
                    `eq.${deviceId}`
                );


                const response =
                    await fetch(
                        `${baseUrl}/rest/v1/messages?${params.toString()}`,
                        {

                            method: "PATCH",

                            headers: {

                                ...supabaseHeaders,

                                "Prefer":
                                    "return=representation"

                            },

                            body:
                                JSON.stringify({

                                    message:
                                        gameState,

                                    edited:
                                        true

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
                    data.length === 0
                ) {

                    return res.status(403).json({

                        success: false,

                        error:
                            "You are not the game host."

                    });

                }


                return res.status(200).json({

                    success: true,

                    game:
                        data[0]

                });

            }


            /* =============================================
               NORMAL EDIT
            ============================================= */

            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            if (!message) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Message cannot be empty."

                });

            }


            const params =
                new URLSearchParams();

            params.set(
                "id",
                `eq.${id}`
            );

            params.set(
                "device_id",
                `eq.${deviceId}`
            );

            params.set(
                "username",
                "neq.__GAME_SERVER__"
            );


            const response =
                await fetch(
                    `${baseUrl}/rest/v1/messages?${params.toString()}`,
                    {

                        method: "PATCH",

                        headers: {

                            ...supabaseHeaders,

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
                data.length === 0
            ) {

                return res.status(403).json({

                    success: false,

                    error:
                        "You cannot edit this message."

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    data[0]

            });

        }


        /* =================================================
           DELETE
        ================================================= */

        if (req.method === "DELETE") {

            const body =
                req.body || {};


            /* =============================================
               DELETE EVERYTHING
            ============================================= */

            if (body.delete_all === true) {

                const response =
                    await fetch(
                        `${baseUrl}/rest/v1/messages?id=not.is.null`,
                        {

                            method: "DELETE",

                            headers: {

                                ...supabaseHeaders,

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


            const id =
                String(
                    body.id || ""
                )
                .trim();


            const deviceId =
                String(
                    body.device_id || ""
                )
                .trim();


            if (!id || !deviceId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Message ID and device ID are required."

                });

            }


            /* =============================================
               DELETE GAME
            ============================================= */

            if (body.game_server === true) {

                const params =
                    new URLSearchParams();

                params.set(
                    "id",
                    `eq.${id}`
                );

                params.set(
                    "username",
                    "eq.__GAME_SERVER__"
                );

                params.set(
                    "device_id",
                    `eq.${deviceId}`
                );


                const response =
                    await fetch(
                        `${baseUrl}/rest/v1/messages?${params.toString()}`,
                        {

                            method: "DELETE",

                            headers: {

                                ...supabaseHeaders,

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


            /* =============================================
               DELETE NORMAL MESSAGE
            ============================================= */

            const params =
                new URLSearchParams();

            params.set(
                "id",
                `eq.${id}`
            );

            params.set(
                "device_id",
                `eq.${deviceId}`
            );

            params.set(
                "username",
                "neq.__GAME_SERVER__"
            );


            const response =
                await fetch(
                    `${baseUrl}/rest/v1/messages?${params.toString()}`,
                    {

                        method: "DELETE",

                        headers: {

                            ...supabaseHeaders,

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
                data.length === 0
            ) {

                return res.status(403).json({

                    success: false,

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


        /* =================================================
           METHOD NOT ALLOWED
        ================================================= */

        return res.status(405).json({

            success: false,

            error:
                "Method not allowed."

        });


    } catch (error) {

        console.error(
            "MESSAGE API ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error?.message ||
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
        response.status || 500
    ).json({

        success: false,

        error:
            data?.message ||
            data?.error ||
            data?.hint ||
            "Supabase request failed.",

        details:
            data

    });

}