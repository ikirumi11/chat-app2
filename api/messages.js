export default async function handler(req, res) {

    // =====================================================
    // CORS / SERVER SETTINGS
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
        "GET,POST,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );


    // =====================================================
    // OPTIONS
    // =====================================================

    if (req.method === "OPTIONS") {

        return res
            .status(200)
            .end();

    }


    try {

        // =================================================
        // ENVIRONMENT VARIABLES
        // =================================================

        const supabaseUrl =
            process.env.https://wlvbkdzcueqkknysisfw.supabase.co;

        const supabaseKey =
            process.env.sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL;


        // =================================================
        // CHECK ENVIRONMENT
        // =================================================

        if (!supabaseUrl) {

            return res.status(500).json({

                error:
                    "SUPABASE_URL is missing.",

                fix:
                    "Add SUPABASE_URL to Vercel Environment Variables."

            });

        }


        if (!supabaseKey) {

            return res.status(500).json({

                error:
                    "SUPABASE_SERVICE_ROLE_KEY is missing.",

                fix:
                    "Add SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables."

            });

        }


        const cleanUrl =
            supabaseUrl.replace(
                /\/+$/,
                ""
            );


        // =================================================
        // SUPABASE REQUEST HELPER
        // =================================================

        async function supabaseFetch(
            path,
            options = {}
        ) {

            return await fetch(
                cleanUrl + path,
                {

                    ...options,

                    headers: {

                        "apikey":
                            supabaseKey,

                        "Authorization":
                            "Bearer " +
                            supabaseKey,

                        ...(options.headers || {})

                    }

                }
            );

        }


        // =================================================
        // GET
        // =================================================

        if (req.method === "GET") {

            const action =
                String(
                    req.query.action ||
                    "messages"
                );


            // =============================================
            // GET MESSAGES
            // =============================================

            if (
                action === "messages"
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
                    "/rest/v1/messages" +
                    "?select=id,username,channel,message,created_at" +
                    "&channel=eq." +
                    encodeURIComponent(
                        channel
                    ) +
                    "&order=created_at.asc" +
                    "&limit=500";


                const response =
                    await supabaseFetch(
                        query,
                        {

                            method:
                                "GET",

                            headers: {

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
                        JSON.parse(
                            text
                        );

                }
                catch {

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
                            "Supabase request failed.",

                        details:
                            data,

                        fix:
                            "Check your Supabase URL, key and messages table."

                    });

                }


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


            // =============================================
            // GET ONLINE USERS
            // =============================================

            if (
                action === "players"
            ) {

                /*
                    Users that have not sent a heartbeat
                    for 20 seconds are considered offline.
                */

                const cutoff =
                    new Date(
                        Date.now() -
                        20000
                    ).toISOString();


                const query =
                    "/rest/v1/online_users" +
                    "?select=id,username,last_seen" +
                    "&last_seen=gte." +
                    encodeURIComponent(
                        cutoff
                    ) +
                    "&order=username.asc";


                const response =
                    await supabaseFetch(
                        query,
                        {

                            method:
                                "GET",

                            headers: {

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
                        JSON.parse(
                            text
                        );

                }
                catch {

                    return res.status(500).json({

                        error:
                            "Invalid JSON from Supabase.",

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
                            "Could not get online players.",

                        details:
                            data

                    });

                }


                return res.status(200).json({

                    success:
                        true,

                    players:
                        Array.isArray(
                            data
                        )
                            ? data
                            : []

                });

            }


            return res.status(400).json({

                error:
                    "Unknown GET action."

            });

        }


        // =================================================
        // POST
        // =================================================

        if (req.method === "POST") {

            const body =
                req.body ||
                {};


            const action =
                String(
                    body.action ||
                    "message"
                );


            // =============================================
            // SEND MESSAGE
            // =============================================

            if (
                action === "message"
            ) {

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
                        5000000
                    );


                if (!username) {

                    return res.status(400).json({

                        error:
                            "Username is required.",

                        fix:
                            "Enter a username."

                    });

                }


                if (!message) {

                    return res.status(400).json({

                        error:
                            "Message is required.",

                        fix:
                            "Type something before sending."

                    });

                }


                const response =
                    await supabaseFetch(
                        "/rest/v1/messages",
                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json",

                                "Prefer":
                                    "return=representation"

                            },

                            body:
                                JSON.stringify({

                                    username:
                                        username,

                                    channel:
                                        channel,

                                    message:
                                        message

                                })

                        }
                    );


                const text =
                    await response.text();


                let data;


                try {

                    data =
                        JSON.parse(
                            text
                        );

                }
                catch {

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
                            "Supabase rejected the message.",

                        details:
                            data,

                        fix:
                            "Check the messages table and RLS policies."

                    });

                }


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


            // =============================================
            // HEARTBEAT
            // =============================================

            if (
                action === "heartbeat"
            ) {

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


                if (!username) {

                    return res.status(400).json({

                        error:
                            "Username is required."

                    });

                }


                // Look for existing username

                const searchResponse =
                    await supabaseFetch(
                        "/rest/v1/online_users" +
                        "?select=id" +
                        "&username=eq." +
                        encodeURIComponent(
                            username
                        ),
                        {

                            method:
                                "GET",

                            headers: {

                                "Accept":
                                    "application/json"

                            }

                        }
                    );


                const searchText =
                    await searchResponse.text();


                let existing = [];


                try {

                    existing =
                        JSON.parse(
                            searchText
                        );

                }
                catch {

                    existing =
                        [];

                }


                // Update existing user

                if (
                    Array.isArray(
                        existing
                    ) &&
                    existing.length > 0
                ) {

                    const id =
                        existing[0].id;


                    const response =
                        await supabaseFetch(
                            "/rest/v1/online_users" +
                            "?id=eq." +
                            encodeURIComponent(
                                id
                            ),
                            {

                                method:
                                    "PATCH",

                                headers: {

                                    "Content-Type":
                                        "application/json",

                                    "Prefer":
                                        "return=minimal"

                                },

                                body:
                                    JSON.stringify({

                                        username:
                                            username,

                                        last_seen:
                                            new Date()
                                                .toISOString()

                                    })

                            }
                        );


                    if (!response.ok) {

                        const errorText =
                            await response.text();


                        return res.status(
                            response.status
                        ).json({

                            error:
                                "Could not update online status.",

                            details:
                                errorText

                        });

                    }

                }

                // Create new user

                else {

                    const response =
                        await supabaseFetch(
                            "/rest/v1/online_users",
                            {

                                method:
                                    "POST",

                                headers: {

                                    "Content-Type":
                                        "application/json",

                                    "Prefer":
                                        "return=minimal"

                                },

                                body:
                                    JSON.stringify({

                                        username:
                                            username,

                                        last_seen:
                                            new Date()
                                                .toISOString()

                                    })

                            }
                        );


                    if (!response.ok) {

                        const errorText =
                            await response.text();


                        return res.status(
                            response.status
                        ).json({

                            error:
                                "Could not create online status.",

                            details:
                                errorText

                        });

                    }

                }


                return res.status(200).json({

                    success:
                        true

                });

            }


            // =============================================
            // UNKNOWN POST
            // =============================================

            return res.status(400).json({

                error:
                    "Unknown POST action."

            });

        }


        // =================================================
        // METHOD NOT ALLOWED
        // =================================================

        return res.status(405).json({

            error:
                "Method not allowed."

        });

    }
    catch (error) {

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
                "Check your Vercel logs. Never send your secret key."

        });

    }

}