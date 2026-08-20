export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const supabaseUrl = process.env.https://wlvbkdzcueqkknysisfw.supabase.co;
        const supabaseKey = process.env.sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL;

        if (!supabaseUrl) {
            return res.status(500).json({
                error: "SUPABASE_URL is missing.",
                fix: "Add SUPABASE_URL in Vercel Environment Variables and redeploy."
            });
        }

        if (!supabaseKey) {
            return res.status(500).json({
                error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
                fix: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables and redeploy."
            });
        }

        const baseUrl = supabaseUrl.replace(/\/+$/, "");

        // =========================
        // GET
        // =========================

        if (req.method === "GET") {
            const channel = String(
                req.query?.channel || "general"
            )
                .trim()
                .substring(0, 32);

            const url =
                baseUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "apikey": supabaseKey,
                    "Authorization": "Bearer " + supabaseKey,
                    "Accept": "application/json"
                }
            });

            const text = await response.text();

            let data;

            try {
                data = text ? JSON.parse(text) : [];
            } catch {
                return res.status(502).json({
                    error: "Supabase returned invalid JSON.",
                    status: response.status,
                    response: text.substring(0, 1000)
                });
            }

            if (!response.ok) {
                return res.status(response.status).json({
                    error:
                        data?.message ||
                        data?.error ||
                        data?.hint ||
                        "Supabase request failed.",
                    details: data
                });
            }

            return res.status(200).json({
                success: true,
                messages: Array.isArray(data) ? data : []
            });
        }

        // =========================
        // POST
        // =========================

        if (req.method === "POST") {
            let body = req.body;

            if (typeof body === "string") {
                try {
                    body = JSON.parse(body);
                } catch {
                    return res.status(400).json({
                        error: "Request body is not valid JSON."
                    });
                }
            }

            body = body || {};

            const username = String(body.username || "")
                .trim()
                .substring(0, 24);

            const channel = String(body.channel || "general")
                .trim()
                .substring(0, 32);

            const message = String(body.message || "")
                .trim()
                .substring(0, 2000);

            if (!username) {
                return res.status(400).json({
                    error: "Username is required."
                });
            }

            if (!message) {
                return res.status(400).json({
                    error: "Message is required."
                });
            }

            const response = await fetch(
                baseUrl + "/rest/v1/messages",
                {
                    method: "POST",
                    headers: {
                        "apikey": supabaseKey,
                        "Authorization": "Bearer " + supabaseKey,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify({
                        username,
                        channel,
                        message
                    })
                }
            );

            const text = await response.text();

            let data;

            try {
                data = text ? JSON.parse(text) : [];
            } catch {
                return res.status(502).json({
                    error: "Supabase returned invalid JSON.",
                    status: response.status,
                    response: text.substring(0, 1000)
                });
            }

            if (!response.ok) {
                return res.status(response.status).json({
                    error:
                        data?.message ||
                        data?.error ||
                        data?.hint ||
                        "Supabase rejected the message.",
                    details: data
                });
            }

            return res.status(200).json({
                success: true,
                message: Array.isArray(data)
                    ? data[0]
                    : data
            });
        }

        return res.status(405).json({
            error: "Method not allowed."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Server function crashed.",
            message: error?.message || "Unknown error",
            type: error?.name || "Error",
            fix: "Check the Vercel Function Logs."
        });
    }
}