export default async function handler(req, res) {

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {

        // ==========================================
        // VERCEL ENVIRONMENT VARIABLES
        // ==========================================

        const supabaseUrl =
            process.env.https://wlvbkdzcueqkknysisfw.supabase.co;

        const supabaseKey =
            process.env.sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL;


        // ==========================================
        // CHECK URL
        // ==========================================

        if (!supabaseUrl) {

            return res.status(500).json({
                error: "SUPABASE_URL is missing.",
                fix: "Go to Vercel → Project → Settings → Environment Variables and add SUPABASE_URL."
            });

        }


        // ==========================================
        // CHECK SECRET KEY
        // ==========================================

        if (!supabaseKey) {

            return res.status(500).json({
                error: "SUPABASE_SECRET_KEY is missing.",
                fix: "Go to Vercel → Project → Settings → Environment Variables and add SUPABASE_SECRET_KEY."
            });

        }


        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");


        // ==========================================
        // GET
        // ==========================================

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
                "?select=id,username,channel,message,image_data,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";


            const response =
                await fetch(url, {
                    method: "GET",

                    headers: {
                        "apikey": supabaseKey,
                        "Authorization":
                            "Bearer " + supabaseKey,
                        "Accept":
                            "application/json"
                    }
                });


            const text =
                await response.text();


            let data;

            try {

                data = JSON.parse(text);

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase did not return JSON.",

                    httpStatus:
                        response.status,

                    rawResponse:
                        text.substring(0, 2000)

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
                        "Supabase GET request failed.",

                    supabase:
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
        // POST
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


            const message =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            const imageData =
                typeof body.image_data === "string"
                    ? body.image_data
                    : null;


            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required."

                });

            }


            if (!message && !imageData) {

                return res.status(400).json({

                    error:
                        "Message or image is required."

                });

            }


            // ==========================================
            // IMAGE CHECK
            // ==========================================

            if (imageData) {

                if (
                    !imageData.startsWith("data:image/")
                ) {

                    return res.status(400).json({

                        error:
                            "Invalid image data."

                    });

                }


                if (
                    imageData.length >
                    3 * 1024 * 1024
                ) {

                    return res.status(413).json({

                        error:
                            "Image is too large.",

                        fix:
                            "Maximum image size is approximately 2 MB."

                    });

                }

            }


            // ==========================================
            // DATA
            // ==========================================

            const messageData = {

                username: username,

                channel: "general",

                message: message,

                image_data: imageData

            };


            // ==========================================
            // SEND TO SUPABASE
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
                        "Supabase did not return JSON.",

                    httpStatus:
                        response.status,

                    rawResponse:
                        text.substring(0, 2000)

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
                        "Supabase rejected the message.",

                    supabase:
                        data,

                    fix:
                        "Check the messages table, image_data column, and INSERT policy."

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        // ==========================================
        // UNKNOWN METHOD
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
                error?.message ||
                String(error) ||
                "Unknown server error.",

            type:
                error?.name ||
                "Error",

            stack:
                error?.stack
                    ? error.stack.substring(0, 2000)
                    : null

        });

    }

}