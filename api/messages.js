export default async function handler(req, res) {

    res.setHeader(
        "Content-Type",
        "application/json"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {

        const supabaseUrl =
            process.env.https://wlvbkdzcueqkknysisfw.supabase.co/rest/v1/;

        const supabaseKey =
            process.env.sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL;

        if (!supabaseUrl) {
            return res.status(500).json({
                error: "SUPABASE_URL is not configured"
            });
        }

        if (!supabaseKey) {
            return res.status(500).json({
                error: "SUPABASE_SERVICE_ROLE_KEY is not configured"
            });
        }

        /* GET MESSAGES */

        if (req.method === "GET") {

            const channel =
                String(
                    req.query.channel || "general"
                );

            const url =
                supabaseUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response =
                await fetch(url, {
                    method: "GET",
                    headers: {
                        "apikey": supabaseKey,
                        "Authorization":
                            "Bearer " +
                            supabaseKey
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
                        "Supabase returned invalid JSON",
                    raw:
                        text.substring(0, 500)
                });
            }

            if (!response.ok) {
                return res.status(response.status).json({
                    error:
                        data.message ||
                        data.error ||
                        "Supabase error"
                });
            }

            return res.status(200).json({
                messages: data
            });
        }


        /* SEND MESSAGE */

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

            if (!username) {
                return res.status(400).json({
                    error:
                        "Username is required"
                });
            }

            if (!message) {
                return res.status(400).json({
                    error:
                        "Message is required"
                });
            }

            const response =
                await fetch(
                    supabaseUrl +
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
                    JSON.parse(text);
            } catch {
                return res.status(500).json({
                    error:
                        "Supabase returned invalid JSON",
                    raw:
                        text.substring(0, 500)
                });
            }

            if (!response.ok) {
                return res.status(response.status).json({
                    error:
                        data.message ||
                        data.error ||
                        "Supabase error"
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


        return res.status(405).json({
            error:
                "Method not allowed"
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error:
                error.message ||
                "Server error"
        });
    }
}