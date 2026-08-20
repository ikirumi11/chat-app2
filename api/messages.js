export default async function handler(req, res) {

    // ==================================================
    // SERVER SETTINGS
    // ==================================================

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


    // ==================================================
    // OPTIONS / CORS
    // ==================================================

    if (req.method === "OPTIONS") {

        return res
            .status(200)
            .end();

    }


    try {

        // ==================================================
        // SUPABASE SETTINGS
        // ==================================================

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";


        // YOUR PUBLISHABLE SUPABASE KEY
        //
        // This is the sb_publishable_ key.
        //
        // Do NOT put your sb_secret_ key here.
        //

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";


        // ==================================================
        // CHECK SETTINGS
        // ==================================================

        if (!supabaseUrl) {

            return res.status(500).json({

                error:
                    "SUPABASE URL is missing.",

                fix:
                    "Put your Supabase project URL in supabaseUrl."

            });

        }


        if (!supabaseKey) {

            return res.status(500).json({

                error:
                    "SUPABASE publishable key is missing.",

                fix:
                    "Put your sb_publishable_ key in supabaseKey."

            });

        }


        const cleanUrl =
            supabaseUrl.replace(
                /\/+$/,
                ""
            );


        // ==================================================
        // GET MESSAGES
        // ==================================================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .substring(
                    0,
                    32
                );


            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,created_at" +
                "&channel=eq." +
                encodeURIComponent(
                    channel
                ) +
                "&order=created_at.asc";


            const response =
                await fetch(
                    query,
                    {

                        method:
                            "GET",

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


            // ==================================================
            // PARSE RESPONSE
            // ==================================================

            try {

                data =
                    JSON.parse(
                        text
                    );

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON.",

                    httpStatus:
                        response.status,

                    response:
                        text.substring(
                            0,
                            2000
                        ),

                    fix:
                        "Check your Supabase URL and publishable key."

                });

            }


            // ==================================================
            // SUPABASE ERROR
            // ==================================================

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Supabase GET request failed.",

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

                });

            }


            // ==================================================
            // SUCCESS
            // ==================================================

            return res.status(200).json({

                success:
                    true,

                messages:
                    Array.isArray(
                        data
                    )
                    ? data
                    : []

            });

        }


        // ==================================================
        // POST MESSAGE
        // ==================================================

        if (req.method === "POST") {

            const body =
                req.body ||
                {};


            // ==================================================
            // USERNAME
            // ==================================================

            const username =
                String(
                    body.username ||
                    ""
                )
                .trim()
                .substring(
                    0,
                    24
                );


            // ==================================================
            // CHANNEL
            // ==================================================

            const channel =
                String(
                    body.channel ||
                    "general"
                )
                .trim()
                .substring(
                    0,
                    32
                );


            // ==================================================
            // MESSAGE
            // ==================================================

            const message =
                String(
                    body.message ||
                    ""
                )
                .trim()
                .substring(
                    0,
                    2000
                );


            // ==================================================
            // IMAGE
            // ==================================================

            let image =
                null;


            if (
                body.image &&
                typeof body.image ===
                    "string"
            ) {

                image =
                    body.image;

            }


            // ==================================================
            // VALIDATION
            // ==================================================

            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required.",

                    fix:
                        "Enter a username before sending a message."

                });

            }


            if (
                !message &&
                !image
            ) {

                return res.status(400).json({

                    error:
                        "Message or image is required.",

                    fix:
                        "Type a message or choose an image."

                });

            }


            // ==================================================
            // IMAGE SIZE PROTECTION
            // ==================================================

            if (
                image &&
                image.length >
                    5_000_000
            ) {

                return res.status(413).json({

                    error:
                        "Image is too large.",

                    fix:
                        "Choose a smaller image. The server allows approximately 5 MB of Base64 data."

                });

            }


            // ==================================================
            // IMAGE FORMAT CHECK
            // ==================================================

            if (image) {

                const validImage =
                    image.startsWith(
                        "data:image/"
                    );


                if (!validImage) {

                    return res.status(400).json({

                        error:
                            "Invalid image data.",

                        fix:
                            "The image must be sent as a Base64 data URL."

                    });

                }

            }


            // ==================================================
            // DATA TO SUPABASE
            // ==================================================

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


            // ==================================================
            // SEND TO SUPABASE
            // ==================================================

            const response =
                await fetch(
                    cleanUrl +
                    "/rest/v1/messages",
                    {

                        method:
                            "POST",

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


            // ==================================================
            // PARSE RESPONSE
            // ==================================================

            try {

                data =
                    JSON.parse(
                        text
                    );

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON.",

                    httpStatus:
                        response.status,

                    response:
                        text.substring(
                            0,
                            2000
                        ),

                    fix:
                        "Check your Supabase URL, key, and database."

                });

            }


            // ==================================================
            // SUPABASE ERROR
            // ==================================================

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
                        getSupabaseFix(
                            response.status,
                            data
                        )

                });

            }


            // ==================================================
            // SUCCESS
            // ==================================================

            return res.status(200).json({

                success:
                    true,

                message:
                    Array.isArray(
                        data
                    )
                    ? data[0]
                    : data

            });

        }


        // ==================================================
        // METHOD NOT ALLOWED
        // ==================================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method,

            fix:
                "Use GET to read messages or POST to send messages."

        });


    } catch (error) {

        // ==================================================
        // SERVER ERROR
        // ==================================================

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
                "Check your Vercel deployment and Supabase configuration. Do not send your secret key."

        });

    }

}


// ======================================================
// SUPABASE ERROR HELPER
// ======================================================

function getSupabaseFix(
    status,
    data
) {

    const message =
        String(
            data.message ||
            data.error ||
            data.hint ||
            ""
        )
        .toLowerCase();


    // --------------------------------------------------
    // RLS
    // --------------------------------------------------

    if (
        message.includes(
            "row-level security"
        )
    ) {

        return (
            "Supabase RLS is blocking this operation.\n\n" +

            "For sending messages, your INSERT policy " +
            "must allow public inserts.\n\n" +

            "The INSERT policy can use:\n" +

            "with check (true)"
        );

    }


    // --------------------------------------------------
    // API KEY
    // --------------------------------------------------

    if (
        status === 401 ||
        message.includes(
            "api key"
        ) ||
        message.includes(
            "unregistered api key"
        )
    ) {

        return (
            "Supabase rejected the API key.\n\n" +

            "Check that supabaseKey contains your current " +
            "sb_publishable_ key.\n\n" +

            "Do NOT use the sb_secret_ key in this file."
        );

    }


    // --------------------------------------------------
    // TABLE
    // --------------------------------------------------

    if (
        message.includes(
            "relation"
        ) ||
        message.includes(
            "messages"
        )
    ) {

        return (
            "Check that the public.messages table exists " +
            "and contains these columns:\n\n" +

            "id\n" +
            "username\n" +
            "channel\n" +
            "message\n" +
            "image\n" +
            "created_at"
        );

    }


    // --------------------------------------------------
    // DEFAULT
    // --------------------------------------------------

    return (
        "Check your Supabase URL, publishable key, " +
        "messages table, and RLS policies."
    );

}