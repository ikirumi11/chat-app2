export default async function handler(req, res) {

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

    if(req.method === "OPTIONS"){
        return res.status(200).end();
    }

    try {

        /*
         * SUPABASE
         *
         * Only the publishable key is used.
         *
         * Do NOT put your sb_secret key here.
         */

        const supabaseUrl =
            "https://wlvbkdzcueqkknysisfw.supabase.co";

        const supabaseKey =
            "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";

        const cleanUrl =
            supabaseUrl.replace(/\/+$/, "");


        /*
         * GET
         */

        if(req.method === "GET"){

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .substring(0,32);

            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,device_id,edited,created_at" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response =
                await fetch(
                    query,
                    {
                        method:"GET",

                        headers:{
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

            try{

                data =
                    JSON.parse(text);

            }
            catch{

                return res.status(500).json({
                    error:
                        "Supabase returned invalid JSON.",

                    response:
                        text.substring(0,2000)
                });

            }

            if(!response.ok){

                return res.status(
                    response.status
                ).json({
                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Supabase GET failed.",

                    details:data
                });

            }

            return res.status(200).json({

                success:true,

                messages:
                    Array.isArray(data)
                        ? data
                        : []

            });

        }


        /*
         * POST
         */

        if(req.method === "POST"){

            const body =
                req.body || {};

            const username =
                String(
                    body.username ||
                    "User"
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

            const device_id =
                String(
                    body.device_id ||
                    ""
                )
                .trim()
                .substring(0,100);

            let image = null;

            if(
                body.image &&
                typeof body.image === "string"
            ){

                image =
                    body.image;

            }

            if(!device_id){

                return res.status(400).json({
                    error:
                        "Device ID is required."
                });

            }

            if(!message && !image){

                return res.status(400).json({
                    error:
                        "Message or image is required."
                });

            }

            if(
                image &&
                image.length > 5000000
            ){

                return res.status(413).json({
                    error:
                        "Image is too large."
                });

            }

            if(
                image &&
                !image.startsWith("data:image/")
            ){

                return res.status(400).json({
                    error:
                        "Invalid image data."
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
                    device_id,

                edited:
                    false

            };

            const response =
                await fetch(
                    cleanUrl +
                    "/rest/v1/messages",
                    {

                        method:"POST",

                        headers:{
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

            try{

                data =
                    JSON.parse(text);

            }
            catch{

                return res.status(500).json({
                    error:
                        "Supabase returned invalid JSON.",

                    response:
                        text.substring(0,2000)
                });

            }

            if(!response.ok){

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Supabase rejected the message.",

                    details:data

                });

            }

            return res.status(200).json({

                success:true,

                message:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        /*
         * PATCH
         *
         * Edit is protected by BOTH:
         *
         * id
         * device_id
         *
         * Username is NOT used.
         */

        if(req.method === "PATCH"){

            const body =
                req.body || {};

            const id =
                String(
                    body.id ||
                    ""
                ).trim();

            const device_id =
                String(
                    body.device_id ||
                    ""
                ).trim();

            const message =
                String(
                    body.message ||
                    ""
                )
                .trim()
                .substring(0,2000);

            if(!id){

                return res.status(400).json({
                    error:
                        "Message ID is required."
                });

            }

            if(!device_id){

                return res.status(400).json({
                    error:
                        "Device ID is required."
                });

            }

            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(device_id);

            const response =
                await fetch(
                    query,
                    {

                        method:"PATCH",

                        headers:{
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

            const text =
                await response.text();

            let data;

            try{

                data =
                    text
                        ? JSON.parse(text)
                        : [];

            }
            catch{

                data = [];

            }

            if(!response.ok){

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Failed to edit message.",

                    details:data

                });

            }

            if(
                Array.isArray(data) &&
                data.length === 0
            ){

                return res.status(404).json({
                    error:
                        "Message not found or it does not belong to this device."
                });

            }

            return res.status(200).json({

                success:true,

                message:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        /*
         * DELETE ONE MESSAGE
         *
         * Protected by:
         *
         * id
         * device_id
         */

        if(req.method === "DELETE"){

            const body =
                req.body || {};

            if(body.delete_all){

                return res.status(403).json({

                    error:
                        "Deleting every message is disabled when using a public API key.",

                    fix:
                        "Use secure server-side authentication for global deletion."

                });

            }

            const id =
                String(
                    body.id ||
                    ""
                ).trim();

            const device_id =
                String(
                    body.device_id ||
                    ""
                ).trim();

            if(!id){

                return res.status(400).json({
                    error:
                        "Message ID is required."
                });

            }

            if(!device_id){

                return res.status(400).json({
                    error:
                        "Device ID is required."
                });

            }

            const query =
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(device_id);

            const response =
                await fetch(
                    query,
                    {

                        method:"DELETE",

                        headers:{
                            "apikey":
                                supabaseKey,

                            "Authorization":
                                "Bearer " +
                                supabaseKey,

                            "Accept":
                                "application/json",

                            "Prefer":
                                "return=representation"
                        }

                    }
                );

            const text =
                await response.text();

            let data;

            try{

                data =
                    text
                        ? JSON.parse(text)
                        : [];

            }
            catch{

                data = [];

            }

            if(!response.ok){

                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        data.error ||
                        data.hint ||
                        "Failed to delete message.",

                    details:data

                });

            }

            if(
                Array.isArray(data) &&
                data.length === 0
            ){

                return res.status(404).json({
                    error:
                        "Message not found or it does not belong to this device."
                });

            }

            return res.status(200).json({

                success:true,

                deleted:
                    Array.isArray(data)
                        ? data[0]
                        : data

            });

        }


        return res.status(405).json({

            error:
                "Method not allowed."

        });

    }
    catch(error){

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
                "Error"

        });

    }

}