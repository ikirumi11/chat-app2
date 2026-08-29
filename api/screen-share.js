export default async function handler(req,res){
  res.setHeader("Content-Type","application/json");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  const base="https://wlvbkdzcueqkknysisfw.supabase.co",key="sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL";
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"};
  const marker="__SCREEN_SHARE__",body=req.body||{},channel=String(body.channel||req.query?.channel||"general").trim().substring(0,32),deviceId=String(body.device_id||"").trim().substring(0,100);
  const read=async r=>{try{return await r.json()}catch{return null}};
  async function current(){const u=base+"/rest/v1/messages?select=id,message,device_id,created_at&channel=eq."+encodeURIComponent(channel)+"&username=eq."+encodeURIComponent(marker)+"&order=created_at.desc&limit=1",r=await fetch(u,{headers}),d=await read(r);if(!r.ok)throw Error(JSON.stringify(d));return Array.isArray(d)&&d.length?d[0]:null}
  const state=row=>{try{return row?{...JSON.parse(row.message||"{}"),id:row.id,deviceId:row.device_id}:null}catch{return null}};
  async function remove(row){if(!row)return;await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id),{method:"DELETE",headers})}
  try{
    let row=await current(),s=state(row);
    // A frame/share record is disposable: if nobody has refreshed it for 1 second, remove it.
    if(row&&s&&Date.now()-(Number(s.updatedAt)||new Date(row.created_at).getTime())>1000){await remove(row);row=null;s=null}
    if(req.method==="GET")return res.status(200).json({success:true,share:s});
    if(!deviceId)return res.status(400).json({error:"Device ID is required."});
    if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
    const action=String(body.action||"");
    if(action==="start"){
      if(row&&row.device_id!==deviceId)return res.status(409).json({success:false,error:"Someone is already sharing their screen."});
      if(row)return res.status(200).json({success:true,share:s,alreadyHost:true});
      const q=Math.min(1050,Math.max(150,Number(body.quality)||450)),f=Math.min(60,Math.max(5,Number(body.fps)||25));
      const obj={state:"sharing",deviceId,username:String(body.username||"User").substring(0,24),quality:q,fps:f,frozen:false,image:null,updatedAt:Date.now()};
      const r=await fetch(base+"/rest/v1/messages",{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({username:marker,channel,message:JSON.stringify(obj),image:null,files:[],device_id:deviceId,edited:false})}),d=await read(r);if(!r.ok)return res.status(r.status).json({error:d});return res.status(200).json({success:true,share:state(Array.isArray(d)?d[0]:d)})
    }
    if(!row||row.device_id!==deviceId)return res.status(409).json({success:false,error:"You are not the screen-share host."});
    s=state(row);
    if(action==="frame"){if(!s.frozen&&typeof body.image==="string"){s.image=body.image;s.updatedAt=Date.now()}}
    else if(action==="freeze"){s.frozen=Boolean(body.frozen);s.updatedAt=Date.now()}
    else if(action==="stop"){await remove(row);return res.status(200).json({success:true,stopped:true})}
    else return res.status(400).json({error:"Unknown screen-share action."});
    const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id)+"&device_id=eq."+encodeURIComponent(deviceId),{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({message:JSON.stringify(s)})}),d=await read(r);if(!r.ok)return res.status(r.status).json({error:d});return res.status(200).json({success:true,share:state(Array.isArray(d)?d[0]:row)})
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}