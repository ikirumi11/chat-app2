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

    const supabaseUrl =
        "https://wlvbkdzcueqkknysisfw.supabase.co";

    const supabaseKey =
        "YOUR_SB_PUBLISHABLE_KEY_HERE";

    const cleanUrl =
        supabaseUrl.replace(/\/+$/,"");

    const headers = {

        "apikey":
            supabaseKey,

        "Authorization":
            "Bearer " + supabaseKey,

        "Content-Type":
            "application/json",

        "Accept":
            "application/json"

    };


    try {

        /* =========================
           GET
        ========================= */

        if(req.method === "GET"){

            const channel =
                String(
                    req.query.channel ||
                    "general"
                )
                .trim()
                .substring(0,32);

            const url =
                cleanUrl +
                "/rest/v1/messages" +
                "?select=id,username,channel,message,image,created_at,device_id,edited" +
                "&channel=eq." +
                encodeURIComponent(channel) +
                "&order=created_at.asc";

            const response =
                await fetch(
                    url,
                    {
                        method:"GET",
                        headers
                    }
                );

            const text =
                await response.text();

            let data;

            try{
                data=JSON.parse(text);
            }catch{
                return res.status(500).json({
                    error:"Supabase returned invalid JSON.",
                    response:text.substring(0,2000)
                });
            }

            if(!response.ok){

                return res.status(response.status).json({
                    error:
                        data.message ||
                        data.error ||
                        "Supabase GET failed.",
                    details:data
                });

            }

            return res.status(200).json({

                success:true,

                messages:
                    Array.isArray(data)
                    ?data
                    :[]

            });

        }


        /* =========================
           POST
        ========================= */

        if(req.method === "POST"){

            const body=req.body||{};

            const username=
                String(body.username||"")
                .trim()
                .substring(0,24);

            const channel=
                String(body.channel||"general")
                .trim()
                .substring(0,32);

            const message=
                String(body.message||"")
                .trim()
                .substring(0,2000);

            const device_id=
                String(body.device_id||"")
                .trim()
                .substring(0,100);

            let image=null;

            if(
                body.image &&
                typeof body.image==="string"
            ){

                image=body.image;

            }


            if(!username){

                return res.status(400).json({
                    error:"Username is required."
                });

            }

            if(!device_id){

                return res.status(400).json({
                    error:"Device ID is required."
                });

            }

            if(!message && !image){

                return res.status(400).json({
                    error:"Message or image is required."
                });

            }

            if(
                image &&
                image.length > 5000000
            ){

                return res.status(413).json({
                    error:"Image is too large."
                });

            }

            if(
                image &&
                !image.startsWith("data:image/")
            ){

                return res.status(400).json({
                    error:"Invalid image data."
                });

            }


            const messageData={

                username,
                channel,
                message,
                image,
                device_id,
                edited:false

            };


            const response=
                await fetch(
                    cleanUrl +
                    "/rest/v1/messages",
                    {

                        method:"POST",

                        headers:{
                            ...headers,

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify(
                                messageData
                            )

                    }
                );


            const text=
                await response.text();

            let data;

            try{
                data=JSON.parse(text);
            }catch{

                return res.status(500).json({
                    error:
                        "Supabase returned invalid JSON.",
                    response:
                        text.substring(0,2000)
                });

            }


            if(!response.ok){

                return res.status(response.status).json({

                    error:
                        data.message ||
                        data.error ||
                        "Supabase rejected the message.",

                    details:data

                });

            }


            return res.status(200).json({

                success:true,

                message:
                    Array.isArray(data)
                    ?data[0]
                    :data

            });

        }


        /* =========================
           PATCH / EDIT
        ========================= */

        if(req.method === "PATCH"){

            const body=req.body||{};

            const id=
                String(body.id||"").trim();

            const device_id=
                String(body.device_id||"").trim();

            const message=
                String(body.message||"")
                .trim()
                .substring(0,2000);


            if(!id || !device_id){

                return res.status(400).json({
                    error:
                        "Message ID and device ID are required."
                });

            }


            const url=
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(device_id);


            const response=
                await fetch(
                    url,
                    {

                        method:"PATCH",

                        headers:{
                            ...headers,

                            "Prefer":
                                "return=representation"

                        },

                        body:
                            JSON.stringify({

                                message,
                                edited:true

                            })

                    }
                );


            const text=
                await response.text();

            let data;

            try{
                data=JSON.parse(text);
            }catch{

                data=[];

            }


            if(!response.ok){

                return res.status(response.status).json({

                    error:
                        data.message ||
                        data.error ||
                        "Failed to edit message.",

                    details:data

                });

            }


            return res.status(200).json({

                success:true,

                message:
                    Array.isArray(data)
                    ?data[0]||null
                    :data

            });

        }


        /* =========================
           DELETE
        ========================= */

        if(req.method === "DELETE"){

            const body=req.body||{};


            /* =========================
               GLOBAL WIPE
            ========================= */

            if(body.delete_all === true){

                /*
                   IMPORTANT:

                   This URL deliberately matches
                   every row.

                   The filter:
                       id=not.is.null

                   means every message with an id
                   is selected.

                   The Supabase DELETE policy must
                   allow the public role to delete.
                */

                const url=
                    cleanUrl +
                    "/rest/v1/messages" +
                    "?id=not.is.null";


                const response=
                    await fetch(
                        url,
                        {

                            method:"DELETE",

                            headers:{
                                ...headers,

                                "Prefer":
                                    "return=representation"

                            }

                        }
                    );


                const text=
                    await response.text();

                let data;

                try{
                    data=JSON.parse(text);
                }catch{

                    data=[];

                }


                if(!response.ok){

                    return res.status(response.status).json({

                        error:
                            data.message ||
                            data.error ||
                            "Global wipe was rejected by Supabase.",

                        details:data,

                        fix:
                            "Your Supabase DELETE RLS policy must allow public deletes."

                    });

                }


                return res.status(200).json({

                    success:true,

                    deleted:
                        Array.isArray(data)
                        ?data.length
                        :0

                });

            }


            /* =========================
               DELETE ONE OWN MESSAGE
            ========================= */

            const id=
                String(body.id||"").trim();

            const device_id=
                String(body.device_id||"").trim();


            if(!id || !device_id){

                return res.status(400).json({

                    error:
                        "Message ID and device ID are required."

                });

            }


            const url=
                cleanUrl +
                "/rest/v1/messages" +
                "?id=eq." +
                encodeURIComponent(id) +
                "&device_id=eq." +
                encodeURIComponent(device_id);


            const response=
                await fetch(
                    url,
                    {

                        method:"DELETE",

                        headers:{
                            ...headers,

                            "Prefer":
                                "return=representation"

                        }

                    }
                );


            const text=
                await response.text();

            let data;

            try{
                data=JSON.parse(text);
            }catch{

                data=[];

            }


            if(!response.ok){

                return res.status(response.status).json({

                    error:
                        data.message ||
                        data.error ||
                        "Failed to delete message.",

                    details:data

                });

            }


            return res.status(200).json({

                success:true,

                deleted:
                    Array.isArray(data)
                    ?data.length
                    :0

            });

        }


        return res.status(405).json({

            error:"Method not allowed."

        });


    }catch(error){

        console.error(
            "MESSAGE API ERROR:",
            error
        );

        return res.status(500).json({

            error:
                error.message ||
                "Server error."

        });

    }

}