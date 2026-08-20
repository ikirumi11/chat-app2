export default async function handler(req, res) {

    // =====================================================
    // SERVER / CORS
    // =====================================================

    res.setHeader("Content-Type", "application/json");

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
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }


    try {

        // =====================================================
        // SUPABASE SETTINGS
        // =====================================================

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";

        // YOUR PUBLISHABLE KEY
        const supabaseKey =
            "YOUR_SB_PUBLISHABLE_KEY_HERE";


        // =====================================================
        // CHECK SETTINGS
        // =====================================================

        if (!supabaseUrl) {

            return res.status(500).json({
                error: "Supabase URL is missing.",
                fix: "Add your Supabase project URL."
            });

        }


        if (!supabaseKey) {

            return res.status(500).json({
                error: "Supabase publishable key is missing.",
                fix: "Add your sb_publishable_ key."
            });

        }


        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");


        const tableUrl =
            cleanUrl + "/rest/v1/messages";


        // =====================================================
        // COMMON SUPABASE HEADERS
        // =====================================================

        const headers = {

            "apikey":
                supabaseKey,

            "Authorization":
                "Bearer " + supabaseKey,

            "Accept":
                "application/json"

        };


        // =====================================================
        // GET
        // =====================================================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel || "general"
                )
                .trim()
                .substring(0, 32);


            const query =
                tableUrl +
                "?select=id,username,channel,message,image,created_at,edited" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";


            const response =
                await fetch(
                    query,
                    {
                        method: "GET",
                        headers: headers
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
                        text.substring(0, 2000),

                    fix:
                        "Check your Supabase URL and publishable key."

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

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

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


        // =====================================================
        // POST
        // SEND NEW MESSAGE
        // =====================================================

        if (req.method === "POST") {

            const body =
                req.body || {};


            const username =
                String(
                    body.username || ""
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


            let image = null;


            if (
                body.image &&
                typeof body.image === "string"
            ) {

                image =
                    body.image;

            }


            // =================================================
            // VALIDATION
            // =================================================

            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required.",

                    fix:
                        "Enter a username before sending."

                });

            }


            if (!message && !image) {

                return res.status(400).json({

                    error:
                        "Message or image is required.",

                    fix:
                        "Type a message or choose an image."

                });

            }


            // =================================================
            // IMAGE CHECK
            // =================================================

            if (image) {

                if (
                    !image.startsWith(
                        "data:image/"
                    )
                ) {

                    return res.status(400).json({

                        error:
                            "Invalid image data.",

                        fix:
                            "The image must be a Base64 image data URL."

                    });

                }


                if (
                    image.length >
                    5_000_000
                ) {

                    return res.status(413).json({

                        error:
                            "Image is too large.",

                        fix:
                            "The HTML should resize the image before sending it."

                    });

                }

            }


            // =================================================
            // INSERT
            // =================================================

            const messageData = {

                username:
                    username,

                channel:
                    channel,

                message:
                    message,

                image:
                    image,

                edited:
                    false

            };


            const response =
                await fetch(
                    tableUrl,
                    {

                        method: "POST",

                        headers: {

                            ...headers,

                            "Content-Type":
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
                        text.substring(0, 2000),

                    fix:
                        "Check your Supabase database and policies."

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

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

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


        // =====================================================
        // PATCH
        // EDIT MESSAGE
        // =====================================================

        if (req.method === "PATCH") {

            const body =
                req.body || {};


            const id =
                String(
                    body.id || ""
                )
                .trim();


            const username =
                String(
                    body.username || ""
                )
                .trim()
                .substring(0, 24);


            const newMessage =
                String(
                    body.message || ""
                )
                .trim()
                .substring(0, 2000);


            if (!id) {

                return res.status(400).json({

                    error:
                        "Message ID is required.",

                    fix:
                        "Send the ID of the message you want to edit."

                });

            }


            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required."

                });

            }


            if (!newMessage) {

                return res.status(400).json({

                    error:
                        "Message cannot be empty."

                });

            }


            // =================================================
            // UPDATE
            // =================================================

            const query =
                tableUrl +
                "?id=eq." +
                encodeURIComponent(id);


            const response =
                await fetch(
                    query,
                    {

                        method: "PATCH",

                        headers: {

                            ...headers,

                            "Content-Type":
                                "application/json",

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify({

                                message:
                                    newMessage,

                                edited:
                                    true

                            })

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
                        "Supabase rejected the edit.",

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

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


        // =====================================================
        // DELETE ONE MESSAGE
        // =====================================================

        if (req.method === "DELETE") {

            const body =
                req.body || {};


            // =================================================
            // DELETE EVERYTHING
            // =================================================

            if (
                body.deleteAll === true
            ) {

                const response =
                    await fetch(
                        tableUrl +
                        "?id=not.is.null",
                        {

                            method: "DELETE",

                            headers: {

                                ...headers,

                                "Prefer":
                                    "return=representation"

                            }

                        }
                    );


                const text =
                    await response.text();


                let data;

                try {

                    data =
                        text
                            ? JSON.parse(text)
                            : [];

                } catch {

                    return res.status(500).json({

                        error:
                            "Supabase returned invalid JSON.",

                        httpStatus:
                            response.status,

                        response:
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
                            "Supabase could not delete the messages.",

                        details:
                            data,

                        fix:
                            getSupabaseFix(
                                response.status,
                                data
                            )

                    });

                }


                return res.status(200).json({

                    success: true,

                    deleted:
                        Array.isArray(data)
                            ? data.length
                            : 0

                });

            }


            // =================================================
            // DELETE ONE
            // =================================================

            const id =
                String(
                    body.id || ""
                )
                .trim();


            if (!id) {

                return res.status(400).json({

                    error:
                        "Message ID is required.",

                    fix:
                        "Send the ID of the message you want to delete."

                });

            }


            const query =
                tableUrl +
                "?id=eq." +
                encodeURIComponent(id);


            const response =
                await fetch(
                    query,
                    {

                        method: "DELETE",

                        headers: {

                            ...headers,

                            "Prefer":
                                "return=representation"

                        }

                    }
                );


            const text =
                await response.text();


            let data;

            try {

                data =
                    text
                        ? JSON.parse(text)
                        : [];

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON.",

                    httpStatus:
                        response.status,

                    response:
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
                        "Supabase rejected the deletion.",

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

                });

            }


            return res.status(200).json({

                success: true,

                deleted:
                    Array.isArray(data)
                        ? data[0] || null
                        : data

            });

        }


        // =====================================================
        // METHOD NOT ALLOWED
        // =====================================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method,

            fix:
                "GET = read, POST = send, PATCH = edit, DELETE = remove."

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
                "Copy this error and send it to me. Never send your secret key."

        });

    }

}


// =========================================================
// SUPABASE ERROR HELPER
// =========================================================

function getSupabaseFix(
    status,
    data
) {

    const message =
        String(
            data?.message ||
            data?.error ||
            data?.hint ||
            ""
        )
        .toLowerCase();


    // =====================================================
    // RLS
    // =====================================================

    if (
        message.includes(
            "row-level security"
        )
    ) {

        return (

            "Supabase Row Level Security blocked the operation.\n\n" +

            "Check the policy for the operation you are trying to use.\n\n" +

            "INSERT needs a WITH CHECK policy.\n" +

            "SELECT needs a USING policy.\n" +

            "UPDATE needs an appropriate USING / WITH CHECK policy.\n" +

            "DELETE needs a USING policy."

        );

    }


    // =====================================================
    // API KEY
    // =====================================================

    if (
        status === 401 ||
        message.includes("api key") ||
        message.includes("unregistered")
    ) {

        return (

            "Supabase rejected the API key.\n\n" +

            "Make sure supabaseKey contains your current " +

            "sb_publishable_ key.\n\n" +

            "Do NOT put your sb_secret_ key in this file."

        );

    }


    // =====================================================
    // COLUMN / TABLE
    // =====================================================

    if (
        message.includes("column") ||
        message.includes("relation") ||
        message.includes("messages")
    ) {

        return (

            "Check the public.messages table.\n\n" +

            "It should contain:\n\n" +

            "id\n" +

            "username\n" +

            "channel\n" +

            "message\n" +

            "image\n" +

            "created_at\n" +

            "edited"

        );

    }


    // =====================================================
    // DEFAULT
    // =====================================================

    return (

        "Check your Supabase URL, publishable key, " +

        "messages table and RLS policies."

    );

}