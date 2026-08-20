export default async function handler(req, res) {

    // =====================================================
    // CORS
    // =====================================================

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

        // =====================================================
        // SUPABASE
        // =====================================================

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";


        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";


        const cleanUrl =
            supabaseUrl.replace(
                /\/+$/,
                ""
            );


        const tableUrl =
            cleanUrl +
            "/rest/v1/messages";


        const headers = {

            "apikey":
                supabaseKey,

            "Authorization":
                "Bearer " +
                supabaseKey,

            "Accept":
                "application/json"

        };


        // =====================================================
        // GET
        // =====================================================

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .substring(0,32);


            const query =
                tableUrl +
                "?select=id,username,channel,message,image,created_at,edited,device_id" +
                "&channel=eq." +
                encodeURIComponent(
                    channel
                ) +
                "&order=created_at.asc";


            const response =
                await fetch(
                    query,
                    {
                        method:"GET",
                        headers:headers
                    }
                );


            return await sendSupabaseResponse(
                res,
                response,
                "Could not load messages."
            );

        }


        // =====================================================
        // POST
        // =====================================================

        if (req.method === "POST") {

            const body =
                req.body || {};


            const username =
                String(
                    body.username ||
                    ""
                )
                .trim()
                .substring(0,24);


            const channel =
                String(
                    body.channel ||
                    "general"
                )
                .trim()
                .substring(0,32);


            const message =
                String(
                    body.message ||
                    ""
                )
                .trim()
                .substring(0,2000);


            const deviceId =
                String(
                    body.device_id ||
                    ""
                )
                .trim()
                .substring(0,128);


            let image =
                null;


            if (
                typeof body.image ===
                "string" &&
                body.image.length > 0
            ) {

                image =
                    body.image;

            }


            if (!username) {

                return res.status(400).json({

                    error:
                        "Username is required.",

                    fix:
                        "Enter a username."

                });

            }


            if (!deviceId) {

                return res.status(400).json({

                    error:
                        "Device ID is required.",

                    fix:
                        "Refresh the page so the browser can create a device ID."

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


            if (image) {

                if (
                    !image.startsWith(
                        "data:image/"
                    )
                ) {

                    return res.status(400).json({

                        error:
                            "Invalid image.",

                        fix:
                            "The image must be a Base64 image."

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
                            "The HTML should resize images to 1500×1500 before sending."

                    });

                }

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

                edited:
                    false

            };


            const response =
                await fetch(
                    tableUrl,
                    {

                        method:"POST",

                        headers:{

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


            return await sendSupabaseResponse(
                res,
                response,
                "Supabase rejected the message."
            );

        }


        // =====================================================
        // PATCH / EDIT
        // =====================================================

        if (req.method === "PATCH") {

            const body =
                req.body || {};


            const id =
                String(
                    body.id ||
                    ""
                )
                .trim();


            const deviceId =
                String(
                    body.device_id ||
                    ""
                )
                .trim();


            const message =
                String(
                    body.message ||
                    ""
                )
                .trim()
                .substring(0,2000);


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


            // =================================================
            // FIND MESSAGE FIRST
            // =================================================

            const findUrl =
                tableUrl +
                "?select=id,device_id" +
                "&id=eq." +
                encodeURIComponent(id);


            const findResponse =
                await fetch(
                    findUrl,
                    {
                        method:"GET",
                        headers:headers
                    }
                );


            const findText =
                await findResponse.text();


            let found;


            try {

                found =
                    JSON.parse(
                        findText
                    );

            } catch {

                return res.status(500).json({

                    error:
                        "Could not read the existing message."

                });

            }


            if (!findResponse.ok) {

                return res.status(
                    findResponse.status
                ).json({

                    error:
                        found.message ||
                        found.error ||
                        "Could not find message."

                });

            }


            if (
                !Array.isArray(found) ||
                !found.length
            ) {

                return res.status(404).json({

                    error:
                        "Message not found."

                });

            }


            // =================================================
            // DEVICE CHECK
            // =================================================

            if (
                found[0].device_id !==
                deviceId
            ) {

                return res.status(403).json({

                    error:
                        "You cannot edit this message.",

                    fix:
                        "Only the device that created the message can edit it."

                });

            }


            // =================================================
            // UPDATE
            // =================================================

            const updateUrl =
                tableUrl +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);


            const response =
                await fetch(
                    updateUrl,
                    {

                        method:"PATCH",

                        headers:{

                            ...headers,

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


            return await sendSupabaseResponse(
                res,
                response,
                "Could not edit message."
            );

        }


        // =====================================================
        // DELETE
        // =====================================================

        if (req.method === "DELETE") {

            const body =
                req.body || {};


            const deviceId =
                String(
                    body.device_id ||
                    ""
                )
                .trim();


            if (!deviceId) {

                return res.status(400).json({

                    error:
                        "Device ID is required."

                });

            }


            // =================================================
            // DELETE ALL FROM THIS DEVICE
            // =================================================

            if (
                body.deleteAll === true
            ) {

                const deleteUrl =
                    tableUrl +
                    "?device_id=eq." +
                    encodeURIComponent(
                        deviceId
                    );


                const response =
                    await fetch(
                        deleteUrl,
                        {

                            method:"DELETE",

                            headers:{

                                ...headers,

                                "Prefer":
                                    "return=representation"

                            }

                        }
                    );


                const text =
                    await response.text();


                let data = [];


                try {

                    if (text) {

                        data =
                            JSON.parse(
                                text
                            );

                    }

                } catch {

                    return res.status(500).json({

                        error:
                            "Supabase returned invalid JSON.",

                        response:
                            text.substring(
                                0,
                                2000
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
                            "Could not remove your messages.",

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

                    deleted:
                        Array.isArray(data)
                            ? data.length
                            : 0

                });

            }


            // =================================================
            // DELETE ONE MESSAGE
            // =================================================

            const id =
                String(
                    body.id ||
                    ""
                )
                .trim();


            if (!id) {

                return res.status(400).json({

                    error:
                        "Message ID is required."

                });

            }


            const deleteUrl =
                tableUrl +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(deviceId);


            const response =
                await fetch(
                    deleteUrl,
                    {

                        method:"DELETE",

                        headers:{

                            ...headers,

                            "Prefer":
                                "return=representation"

                        }

                    }
                );


            const text =
                await response.text();


            let data = [];


            try {

                if (text) {

                    data =
                        JSON.parse(
                            text
                        );

                }

            } catch {

                return res.status(500).json({

                    error:
                        "Supabase returned invalid JSON."

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
                        "Could not delete message.",

                    details:
                        data,

                    fix:
                        getSupabaseFix(
                            response.status,
                            data
                        )

                });

            }


            if (
                Array.isArray(data) &&
                data.length === 0
            ) {

                return res.status(403).json({

                    error:
                        "You cannot delete this message.",

                    fix:
                        "Only the device that created the message can delete it."

                });

            }


            return res.status(200).json({

                success:
                    true,

                deleted:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        // =====================================================
        // INVALID METHOD
        // =====================================================

        return res.status(405).json({

            error:
                "Method not allowed.",

            method:
                req.method,

            fix:
                "GET reads, POST sends, PATCH edits, DELETE removes."

        });


    } catch(error) {

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
                "Check your Vercel deployment and Supabase configuration."

        });

    }

}


/* =========================================================
   SUPABASE RESPONSE HELPER
========================================================= */

async function sendSupabaseResponse(
    res,
    response,
    defaultError
) {

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
                text.substring(
                    0,
                    2000
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
                defaultError,

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

        message:
            Array.isArray(data)
                ? data[0]
                : data,

        messages:
            Array.isArray(data)
                ? data
                : []

    });

}


/* =========================================================
   ERROR HELPER
========================================================= */

function getSupabaseFix(
    status,
    data
) {

    const text =
        String(
            data?.message ||
            data?.error ||
            data?.hint ||
            ""
        )
        .toLowerCase();


    if (
        text.includes(
            "row-level security"
        )
    ) {

        return (
            "RLS blocked the operation. " +
            "Check the SELECT, INSERT, UPDATE and DELETE policies."
        );

    }


    if (
        status === 401 ||
        text.includes("api key") ||
        text.includes("unregistered")
    ) {

        return (
            "Supabase rejected the publishable key. " +
            "Check that the current sb_publishable_ key is being used."
        );

    }


    if (
        text.includes("column") ||
        text.includes("relation") ||
        text.includes("messages")
    ) {

        return (
            "Check that public.messages contains: " +
            "id, username, channel, message, image, " +
            "created_at, edited and device_id."
        );

    }


    return (
        "Check your Supabase URL, publishable key, " +
        "messages table and RLS policies."
    );

}