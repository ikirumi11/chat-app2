export default async function handler(req,res){
  res.setHeader("Content-Type","application/json");res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(204).end();
  const base="https://wlvbkdzcueqkknysisfw.supabase.co",key="sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL",headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},marker="__SCREEN_SHARE__",body=req.body||{},channel=String(body.channel||req.query?.channel||"general").trim().substring(0,32),deviceId=String(body.device_id||"").trim().substring(0,100),read=async r=>{try{return await r.json()}catch{return null}};
  async function current(){const r=await fetch(base+"/rest/v1/messages?select=id,message,device_id,created_at&channel=eq."+encodeURIComponent(channel)+"&username=eq."+encodeURIComponent(marker)+"&order=created_at.desc&limit=1",{headers});const d=await read(r);if(!r.ok)throw Error(JSON.stringify(d));return Array.isArray(d)&&d.length?d[0]:null}
  const parse=row=>{try{return row?{...JSON.parse(row.message||"{}"),id:row.id,deviceId:row.device_id,createdAt:row.created_at}:null}catch{return null}};
  const remove=async row=>{if(row)await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id),{method:"DELETE",headers})};
  const delays=[0,1000,3000,5000,10000];
  try{
    const row=await current(),s=parse(row);
    if(req.method==="GET"){
      if(!s)return res.status(200).json({success:true,share:null,frames:[],stats:{serverFrames:0,downloadableFrames:0}});
      const watch=String(req.query?.watch||"")==="1",after=Number(req.query?.after)||0,requested=Number(req.query?.delay)||5000,delay=delays.includes(requested)?requested:5000,now=Date.now();
      const frames=Array.isArray(s.frames)?s.frames:[];
      const eligible=frames.filter(x=>{const t=Number(x.capturedAt)||0;return t>after&&t<=now-delay}).sort((a,b)=>a.capturedAt-b.capturedAt);
      return res.status(200).json({success:true,share:{...s,frames:undefined},frames:watch?eligible:[],delayMs:delay,stats:{serverFrames:frames.length,downloadableFrames:frames.filter(x=>(Number(x.capturedAt)||0)<=now-delay).length,waitingFrames:frames.filter(x=>(Number(x.capturedAt)||0)>now-delay).length,oldestCapturedAt:frames[0]?.capturedAt||0,newestCapturedAt:frames.at(-1)?.capturedAt||0}})
    }
    if(!deviceId)return res.status(400).json({error:"Device ID is required."});
    if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
    const action=String(body.action||"");
    if(action==="start"){
      if(row&&s&&s.deviceId!==deviceId)return res.status(409).json({success:false,error:"Someone is already sharing their screen."});
      if(row&&s)return res.status(200).json({success:true,share_id:row.id});
      const q=Math.min(1050,Math.max(150,Number(body.quality)||450)),f=Math.min(60,Math.max(5,Number(body.fps)||25));
      const obj={type:"share",state:"sharing",deviceId,username:String(body.username||"User").substring(0,24),quality:q,fps:f,frozen:false,frames:[],updatedAt:Date.now()};
      const r=await fetch(base+"/rest/v1/messages",{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({username:marker,channel,message:JSON.stringify(obj),image:null,files:[],device_id:deviceId,edited:false})}),d=await read(r),created=Array.isArray(d)?d[0]:d;if(!r.ok)return res.status(r.status).json({error:d});return res.status(200).json({success:true,share_id:created?.id})
    }
    const shareId=String(body.share_id||"").trim();if(!shareId||!row||String(row.id)!==shareId||!s||s.deviceId!==deviceId)return res.status(409).json({success:false,error:"You are not the screen-share host."});
    if(action==="frame"){
      if(s.frozen)return res.status(204).end();
      if(typeof body.image!=="string")return res.status(400).json({error:"Frame is missing."});
      const capturedAt=Number(body.capturedAt)||Date.now(),now=Date.now(),frames=Array.isArray(s.frames)?s.frames:[];
      frames.push({image:body.image,capturedAt});
      // Keep enough history for the maximum 10-second viewer delay plus a small safety margin.
      const keepMs=11500; s.frames=frames.filter(x=>(Number(x.capturedAt)||0)>=now-keepMs);s.updatedAt=now;
      const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id)+"&device_id=eq."+encodeURIComponent(deviceId)+"&username=eq."+encodeURIComponent(marker),{method:"PATCH",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({message:JSON.stringify(s)})});if(!r.ok)return res.status(r.status).json({error:await read(r)});return res.status(204).end();
    }
    if(action==="heartbeat"||action==="freeze"){
      s.updatedAt=Date.now();if(action==="freeze")s.frozen=Boolean(body.frozen);
      const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id)+"&device_id=eq."+encodeURIComponent(deviceId),{method:"PATCH",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({message:JSON.stringify(s)})});if(!r.ok)return res.status(r.status).json({error:await read(r)});return res.status(204).end();
    }
    if(action==="stop"){await remove(row);return res.status(200).json({success:true,stopped:true})}
    return res.status(400).json({error:"Unknown screen-share action."});
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}