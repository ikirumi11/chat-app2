import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sendJSON(res, status, data) {

    res.status(status);

    res.setHeader(
        "Content-Type",
        "application/json"
    );

    return res.json(data);
}


export default async function handler(
    req,
    res
) {

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


    if(req.method === "OPTIONS") {

        return res
            .status(200)
            .end();

    }


    try {

        if(!url) {

            return sendJSON(
                res,
                500,
                {
                    error:
                        "SUPABASE_URL is missing in Vercel Environment Variables."
                }
            );

        }


        if(!key) {

            return sendJSON(
                res,
                500,
                {
                    error:
                        "SUPABASE_SERVICE_ROLE_KEY is missing in Vercel Environment Variables."
                }
            );

        }


        const supabase =
            createClient(
                url,
                key
            );


        /* GET */

        if(req.method === "GET") {

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .slice(0,32);


            const {
                data,
                error
            } =
                await supabase
                    .from("messages")
                    .select(
                        "id,username,channel,message,created_at"
                    )
                    .eq(
                        "channel",
                        channel
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .limit(200);


            if(error) {

                return sendJSON(
                    res,
                    500,
                    {
                        error:
                            error.message
                    }
                );

            }


            return sendJSON(
                res,
                200,
                {
                    messages:
                        data || []
                }
            );

        }


        /* POST */

        if(req.method === "POST") {

            const body =
                req.body || {};


            const username =
                String(
                    body.username || ""
                )
                .trim()
                .slice(0,24);


            const channel =
                String(
                    body.channel ||
                    "general"
                )
                .trim()
                .slice(0,32);


            const message =
                String(
                    body.message || ""
                )
                .trim()
                .slice(0,2000);


            if(!username) {

                return sendJSON(
                    res,
                    400,
                    {
                        error:
                            "Username is required."
                    }
                );

            }


            if(!message) {

                return sendJSON(
                    res,
                    400,
                    {
                        error:
                            "Message is empty."
                    }
                );

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("messages")
                    .insert({
                        username:
                            username,

                        channel:
                            channel,

                        message:
                            message
                    })
                    .select(
                        "id,username,channel,message,created_at"
                    )
                    .single();


            if(error) {

                return sendJSON(
                    res,
                    500,
                    {
                        error:
                            error.message
                    }
                );

            }


            return sendJSON(
                res,
                200,
                {
                    success: true,
                    message: data
                }
            );

        }


        return sendJSON(
            res,
            405,
            {
                error:
                    "Method not allowed."
            }
        );


    } catch(error) {

        console.error(
            "API ERROR:",
            error
        );


        return sendJSON(
            res,
            500,
            {
                error:
                    error.message ||
                    "Unknown server error."
            }
        );

    }

}