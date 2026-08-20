export default async function handler(req, res) {

    // ==========================================
    // CORS
    // ==========================================

    res.setHeader("Content-Type", "application/json");

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
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    // ==========================================
    // SUPABASE SETTINGS
    // ==========================================

    const SUPABASE_URL =
        "https://wlvbkdzcueqkknysisfw.supabase.co";

    // PUBLIC / ANON KEY
    const SUPABASE_KEY =
        "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";


    try {

        // ==========================================
        // CHECK CONFIG
        // ==========================================

        if (!SUPABASE_URL) {

            return res.status(500).json({
                error: "Supabase URL is missing."
            });

        }

        if (!SUPABASE_KEY) {

            return res.status(500).json({
                error: "Supabase public key is missing."
            });

        }


        const baseURL =
            SUPABASE_URL.replace(/\/+$/, "");

        const apiURL =
            baseURL + "/rest/v1/messages";


        // ==========================================
        // GET MESSAGES
        // ==========================================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query?.channel || "general"
                )
                .trim()
                .substring(0, 32);


            const url =
                apiURL +
                "?select=id,username,channel,message,image,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";


            const response =
                await fetch(url, {

                    method: "GET",

                    headers: {

                        "apikey":
                            SUPABASE_KEY,

                        "Authorization":
                            "Bearer " + SUPABASE_KEY,

                        "Accept":
                            "application/json"

                    }

                });


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

                    status:
                        response.status,

                    response:
                        text.substring(0, 1000)

                });

            }


            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        "Supabase GET request failed.",

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
                    body.username || "Anonymous"
                )
                .trim()
                .substring(0, 24);


            const channel =
                String(
                    body.channel || "general"
                )
                .trim()
                .substring(0, 32);


            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            const image =
                typeof body.image === "string"
                    ? body.image.substring(0, 10000000)
                    : null;


            // ==========================================
            // VALIDATION
            // ==========================================

            if (!message && !image) {

                return res.status(400).json({

                    error:
                        "Message or image is required."

                });

            }


            // ==========================================
            // DATA
            // ==========================================

            const messageData = {

                username:
                    username,

                channel:
                    channel,

                message:
                    message,

                image:
                    image

            };


            // ==========================================
            // SEND TO SUPABASE
            // ==========================================

            const response =
                await fetch(
                    apiURL,
                    {

                        method: "POST",

                        headers: {

                            "apikey":
                                SUPABASE_KEY,

                            "Authorization":
                                "Bearer " +
                                SUPABASE_KEY,

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

                    status:
                        response.status,

                    response:
                        text.substring(0, 1500)

                });

            }


            // ==========================================
            // ERROR
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
        // OTHER METHODS
        // ==========================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method

        });


    } catch (error) {

        console.error(
            "MESSAGE API ERROR:",
            error
        );


        return res.status(500).json({

            error:
                error.message ||
                "Unknown server error.",

            type:
                error.name ||
                "Error"

        });

    }

}