export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    const base = "https://wlvbkdzcueqkknysisfw.supabase.co";
    const key = "sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
    const headers = { apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json", Accept:"application/json" };
    const MARKER = "__SCREEN_SHARE__";
    const body = req.body || {};
    const channel = String(body.channel || req.query?.channel || "general").trim().substring(0,32);
    const deviceId = String(body.device_id || "").trim().substring(0,100);
    const read = async r => { try { return await r.json(); } catch { return null; } };

    async function current() {
        const url = base+"/rest/v1/messages?select=id,message,device_id,created_at&channel=eq."+encodeURIComponent(channel)+"&username=eq."+encodeURIComponent(MARKER)+"&order=created_at.desc&limit=1";
        const r=await fetch(url,{headers}); const d=await read(r);
        if(!r.ok) throw new Error(JSON.stringify(d));
        return Array.isArray(d)&&d.length?d[0]:null;
    }
    function state(row){ try { return row ? {...JSON.parse(row.message||"{}"),id:row.id,deviceId:row.device_id}:null; } catch{return null;} }

    try {
        if(req.method==="GET") return res.status(200).json({success:true,share:state(await current())});
        if(!deviceId) return res.status(400).json({error:"Device ID is required."});
        if(req.method!=="POST") return res.status(405).json({error:"Method not allowed."});

        const action=String(body.action||"");
        const row=await current();

        if(action==="start") {
            if(row && row.device_id!==deviceId) return res.status(409).json({success:false,error:"Someone is already sharing their screen.",share:state(row)});
            if(row) return res.status(200).json({success:true,share:state(row),alreadyHost:true});
            const s={state:"sharing",deviceId,username:String(body.username||"User").substring(0,24),quality:Number(body.quality)||450,fps:Number(body.fps)||25,frozen:false,image:null,updatedAt:Date.now()};
            const r=await fetch(base+"/rest/v1/messages",{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({username:MARKER,channel,message:JSON.stringify(s),image:null,files:[],device_id:deviceId,edited:false})});
            const d=await read(r); if(!r.ok)return res.status(r.status).json({error:d});
            return res.status(200).json({success:true,share:state(Array.isArray(d)?d[0]:d)});
        }

        if(!row || row.device_id!==deviceId) return res.status(409).json({success:false,error:"You are not the screen-share host."});
        const s=state(row);

        if(action==="frame") {
            if(!s.frozen && typeof body.image==="string") s.image=body.image;
        } else if(action==="freeze") {
            s.frozen=Boolean(body.frozen);
        } else if(action==="stop") {
            const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id)+"&device_id=eq."+encodeURIComponent(deviceId),{method:"DELETE",headers});
            if(!r.ok)return res.status(r.status).json({error:await read(r)});
            return res.status(200).json({success:true,stopped:true});
        } else return res.status(400).json({error:"Unknown screen-share action."});

        s.updatedAt=Date.now();
        const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id)+"&device_id=eq."+encodeURIComponent(deviceId),{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({message:JSON.stringify(s)})});
        const d=await read(r); if(!r.ok)return res.status(r.status).json({error:d});
        return res.status(200).json({success:true,share:state(Array.isArray(d)?d[0]:row)});
    } catch(e) { return res.status(500).json({error:String(e.message||e)}); }
}
