import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

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


    if(req.method === "OPTIONS"){

        return res
            .status(200)
            .end();

    }


    try{

        /* GET */

        if(req.method === "GET"){

            const channel =
                String(
                    req.query.channel ||
                    "general"
                ).slice(0,32);


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
                        ascending:true
                    }
                )
                .limit(200);


            if(error){

                console.error(error);

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });

            }


            return res
                .status(200)
                .json({
                    messages:
                        data || []
                });

        }


        /* POST */

        if(req.method === "POST"){

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


            if(
                !username ||
                !message
            ){

                return res
                    .status(400)
                    .json({
                        error:
                            "Username and message are required."
                    });

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


            if(error){

                console.error(error);

                return res
                    .status(500)
                    .json({
                        error:
                            error.message
                    });

            }


            return res
                .status(200)
                .json({

                    success:true,

                    message:data

                });

        }


        return res
            .status(405)
            .json({
                error:
                    "Method not allowed."
            });


    }catch(error){

        console.error(error);

        return res
            .status(500)
            .json({
                error:
                    "Server error."
            });

    }

}