export default async function handler(req, res) {

    // ==========================================
    // SETTINGS
    // ==========================================

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


    // ==========================================
    // CORS PREFLIGHT
    // ==========================================

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    try {

        // ==========================================
        // SUPABASE URL
        // ==========================================

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";


        // ==========================================
        // SUPABASE PUBLISHABLE KEY
        // ==========================================

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";


        // ==========================================
        // CHECK SETTINGS
        // ==========================================

        if (!supabaseUrl) {

            return res.status(500).json({

                error:
                    "Supabase URL is missing."

            });

        }


        if (!supabaseKey) {

            return res.status(500).json({

                error:
                    "Supabase publishable key is missing."

            });

        }


        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");


        // ==========================================
        // GET MESSAGES
        // ==========================================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query?.channel ||
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
                        )

                });

            }


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
                        data

                });

            }


            return res.status(200).json({

                success: true,

                messages:
                    Array.isArray(data)
                        ? data
                        : []

            });

        }


        // ==========================================
        // SEND MESSAGE
        // ==========================================

        if (req.method === "POST") {

            const body =
                req.body || {};


            const username =
                String(
                    body.username || ""
                )
                .trim()
                .substring(0, 24);


            // Only one channel
            const channel =
                "general";


            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            // ==========================================
            // VALIDATION
            // ==========================================

            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required.",

                    fix:
                        "Enter a username before sending a message."

                });

            }


            if (!message) {

                return res.status(400).json({

                    error:
                        "Message is required.",

                    fix:
                        "Type a message before pressing Send."

                });

            }


            // ==========================================
            // MESSAGE DATA
            // ==========================================

            const messageData = {

                username:
                    username,

                channel:
                    channel,

                message:
                    message

            };


            // ==========================================
            // INSERT INTO SUPABASE
            // ==========================================

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
                        )

                });

            }


            // ==========================================
            // SUPABASE ERROR
            // ==========================================

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
                        "Check your messages table and RLS INSERT policy."

                });

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.status(200).json({

                success: true,

                message:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        // ==========================================
        // METHOD NOT ALLOWED
        // ==========================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method

        });


    } catch (error) {

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
                "Check the Vercel function logs."

        });

    }

}