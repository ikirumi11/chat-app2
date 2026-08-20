export default async function handler(req, res) {

    // ==============================
    // SERVER SETTINGS
    // ==============================

    res.setHeader(
        "Content-Type",
        "application/json"
    );

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    // ==============================
    // OPTIONS
    // ==============================

    if (req.method === "OPTIONS") {

        return res
            .status(200)
            .end();

    }


    try {

        // ==============================
        // SUPABASE URL
        // ==============================
        //
        // Example:
        // https://abcdefghijklmnop.supabase.co
        //

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";


        // ==============================
        // SUPABASE KEY
        // ==============================
        //
        // Put your Supabase server key here.
        //
        // IMPORTANT:
        // Do NOT send this key to anyone.
        //

        const supabaseKey =
            "sb_secret_xpHldC-hJLcLaZDUd-x1BA_OB9JiEkk";


        // ==============================
        // CHECK SETTINGS
        // ==============================

        if (
            !supabaseUrl ||
            supabaseUrl ===
                "PLACE SUPABASE URL HERE"
        ) {

            return res.status(500).json({

                error:
                    "Supabase URL has not been added.",

                fix:
                    "Open api/messages.js and replace PLACE SUPABASE URL HERE with your Supabase Project URL."

            });

        }


        if (
            !supabaseKey ||
            supabaseKey ===
                "PLACE SUPABASE KEY HERE"
        ) {

            return res.status(500).json({

                error:
                    "Supabase key has not been added.",

                fix:
                    "Open api/messages.js and replace PLACE SUPABASE KEY HERE with your Supabase key."

            });

        }


        // Remove accidental slash

        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");


        // ==============================
        // GET MESSAGES
        // ==============================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .substring(0, 32);


            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";


            const response =
                await fetch(
                    query,
                    {

                        method: "GET",

                        headers: {

                            "apikey":
                                supabaseKey,

                            "Authorization":
                                "Bearer " +
                                supabaseKey,

                            "Accept":
                                "application/json"

                        }

                    }
                );


            const text =
                await response.text();


            let data;


            // ==============================
            // READ SUPABASE RESPONSE
            // ==============================

            try {

                data =
                    JSON.parse(text);

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON.",

                    httpStatus:
                        response.status,

                    response:
                        text.substring(
                            0,
                            1500
                        ),

                    fix:
                        "Check that your Supabase URL and key are correct."

                });

            }


            // ==============================
            // SUPABASE ERROR
            // ==============================

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Supabase request failed.",

                    details:
                        data,

                    fix:
                        "Check your Supabase key, URL, and messages table."

                });

            }


            // ==============================
            // SUCCESS
            // ==============================

            return res.status(200).json({

                success: true,

                messages:
                    Array.isArray(data)
                        ? data
                        : []

            });

        }


        // ==============================
        // SEND MESSAGE
        // ==============================

        if (req.method === "POST") {

            const body =
                req.body || {};


            // ==============================
            // USERNAME
            // ==============================

            const username =
                String(
                    body.username || ""
                )
                .trim()
                .substring(0, 24);


            // ==============================
            // CHANNEL
            // ==============================

            const channel =
                String(
                    body.channel ||
                    "general"
                )
                .trim()
                .substring(0, 32);


            // ==============================
            // MESSAGE
            // ==============================

            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            // ==============================
            // VALIDATE USERNAME
            // ==============================

            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required.",

                    fix:
                        "Enter a username before sending a message."

                });

            }


            // ==============================
            // VALIDATE MESSAGE
            // ==============================

            if (!message) {

                return res.status(400).json({

                    error:
                        "Message is required.",

                    fix:
                        "Type a message before pressing Send."

                });

            }


            // ==============================
            // DATA TO SUPABASE
            // ==============================

            const messageData = {

                username:
                    username,

                channel:
                    channel,

                message:
                    message

            };


            // ==============================
            // SEND TO SUPABASE
            // ==============================

            const response =
                await fetch(
                    cleanUrl +
                    "/rest/v1/messages",
                    {

                        method: "POST",

                        headers: {

                            "apikey":
                                supabaseKey,

                            "Authorization":
                                "Bearer " +
                                supabaseKey,

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json",

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify(
                                messageData
                            )

                    }
                );


            // ==============================
            // READ RESPONSE
            // ==============================

            const text =
                await response.text();


            let data;


            try {

                data =
                    JSON.parse(text);

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON.",

                    httpStatus:
                        response.status,

                    response:
                        text.substring(
                            0,
                            1500
                        ),

                    fix:
                        "Check your Supabase URL, key, and database."

                });

            }


            // ==============================
            // SUPABASE ERROR
            // ==============================

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Supabase rejected the message.",

                    details:
                        data,

                    fix:
                        "Check that your messages table exists and contains username, channel and message columns."

                });

            }


            // ==============================
            // SUCCESS
            // ==============================

            return res.status(200).json({

                success: true,

                message:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        // ==============================
        // UNKNOWN METHOD
        // ==============================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method

        });


    } catch (error) {

        // ==============================
        // UNEXPECTED SERVER ERROR
        // ==============================

        console.error(
            "SERVER ERROR:",
            error
        );


        return res.status(500).json({

            error:
                error.message ||
                "Unknown server error.",

            type:
                error.name ||
                "Error",

            fix:
                "Copy this error and send it to me. Do not send your Supabase key."

        });

    }

}