export default async function handler(req, res) {

    // ==================================================
    // CORS
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
        "GET,POST,PATCH,DELETE,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    if (req.method === "OPTIONS") {

        return res
            .status(200)
            .end();

    }


    try {

        // ==================================================
        // SUPABASE
        // ==================================================

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";


        // PUBLISHABLE KEY ONLY

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";


        const cleanUrl =
            supabaseUrl.replace(
                /\/+$/,
                ""
            );


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


        // ==================================================
        // GET
        // ==================================================

        if (
            req.method === "GET"
        ) {

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
                "?select=id,username,channel,message,image,created_at,edited,device_id,author_device_id" +
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


            return await supabaseResponse(
                res,
                response,
                "Could not load messages."
            );

        }


        // ==================================================
        // POST
        // ==================================================

        if (
            req.method === "POST"
        ) {

            const body =
                req.body ||
                {};


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


            const image =
                typeof body.image === "string" &&
                body.image.startsWith(
                    "data:image/"
                )
                    ? body.image
                    : null;


            const deviceId =
                String(
                    body.device_id ||
                    ""
                )
                .trim()
                .substring(
                    0,
                    128
                );


            if (!deviceId) {

                return res.status(400).json({

                    error:
                        "Device ID is required.",

                    fix:
                        "The browser did not provide a device ID."

                });

            }


            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required."

                });

            }


            if (
                !message &&
                !image
            ) {

                return res.status(400).json({

                    error:
                        "Message or image is required."

                });

            }


            if (
                image &&
                image.length >
                5000000
            ) {

                return res.status(413).json({

                    error:
                        "Image is too large.",

                    fix:
                        "The image must be reduced before sending."

                });

            }


            const messageData = {

                username:
                    username,

                channel:
                    channel,

                message:
                    message,

                image:
                    image,

                device_id:
                    deviceId,

                author_device_id:
                    deviceId,

                edited:
                    false

            };


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


            return await supabaseResponse(
                res,
                response,
                "Supabase rejected the message."
            );

        }


        // ==================================================
        // PATCH / EDIT
        // ==================================================

        if (
            req.method === "PATCH"
        ) {

            const body =
                req.body ||
                {};


            const id =
                String(
                    body.id ||
                    ""
                );


            const deviceId =
                String(
                    body.device_id ||
                    ""
                );


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


            if (!id) {

                return res.status(400).json({

                    error:
                        "Message ID is required."

                });

            }


            if (!deviceId) {

                return res.status(400).json({

                    error:
                        "Device ID is required."

                });

            }


            if (!message) {

                return res.status(400).json({

                    error:
                        "Message cannot be empty."

                });

            }


            /*
             * IMPORTANT:
             *
             * The UPDATE query only targets a message
             * belonging to this device.
             */

            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);


            const response =
                await fetch(
                    query,
                    {

                        method:
                            "PATCH",

                        headers: {

                            "apikey":
                                supabaseKey,

                            "Authorization":
                                "Bearer " +
                                supabaseKey,

                            "Content-Type":
                                "application/json",

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify({

                                message:
                                    message,

                                edited:
                                    true

                            })

                    }
                );


            return await supabaseResponse(
                res,
                response,
                "Could not edit message."
            );

        }


        // ==================================================
        // DELETE
        // ==================================================

        if (
            req.method === "DELETE"
        ) {

            const id =
                String(
                    req.query.id ||
                    ""
                );


            const deviceId =
                String(
                    req.query.device_id ||
                    ""
                );


            if (!id) {

                return res.status(400).json({

                    error:
                        "Message ID is required."

                });

            }


            if (!deviceId) {

                return res.status(400).json({

                    error:
                        "Device ID is required."

                });

            }


            /*
             * Only delete the message if
             * its device_id matches.
             */

            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);


            const response =
                await fetch(
                    query,
                    {

                        method:
                            "DELETE",

                        headers: {

                            "apikey":
                                supabaseKey,

                            "Authorization":
                                "Bearer " +
                                supabaseKey,

                            "Prefer":
                                "return=representation"

                        }

                    }
                );


            return await supabaseResponse(
                res,
                response,
                "Could not delete message."
            );

        }


        // ==================================================
        // METHOD NOT ALLOWED
        // ==================================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            fix:
                "Use GET, POST, PATCH or DELETE."

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
                "Check the Vercel function and Supabase configuration."

        });

    }

}


/* ======================================================
   SUPABASE RESPONSE HELPER
====================================================== */

async function supabaseResponse(
    res,
    response,
    fallback
) {

    const text =
        await response.text();


    let data;


    try {

        data =
            text
                ? JSON.parse(text)
                : {};

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
                "Check your Supabase URL, publishable key and database."

        });

    }


    if (!response.ok) {

        const message =
            data.message ||
            data.error ||
            data.hint ||
            fallback;


        return res.status(
            response.status
        ).json({

            error:
                message,

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

        success:
            true,

        data:
            data

    });

}


/* ======================================================
   ERROR HELPER
====================================================== */

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


    if (
        message.includes(
            "row-level security"
        )
    ) {

        return (
            "RLS is blocking this operation. " +
            "Check your SELECT, INSERT, UPDATE and DELETE " +
            "policies for the public.messages table."
        );

    }


    if (
        status === 401 ||
        message.includes(
            "api key"
        ) ||
        message.includes(
            "unregistered"
        )
    ) {

        return (
            "Supabase rejected the publishable API key. " +
            "Check that the sb_publishable_ key in messages.js " +
            "is your current Supabase publishable key."
        );

    }


    if (
        message.includes(
            "column"
        ) ||
        message.includes(
            "does not exist"
        )
    ) {

        return (
            "Your messages table is missing a required column. " +
            "Run the SQL setup below."
        );

    }


    return (
        "Check your Supabase URL, publishable key, " +
        "messages table and RLS policies."
    );

}