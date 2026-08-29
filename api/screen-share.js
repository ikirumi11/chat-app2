export default async function handler(req,res){
  res.setHeader("Content-Type","application/json");res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(204).end();
  const base="https://wlvbkdzcueqkknysisfw.supabase.co",key="sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL",headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},marker="__SCREEN_SHARE__",body=req.body||{},channel=String(body.channel||req.query?.channel||"general").trim().substring(0,32),deviceId=String(body.device_id||"").trim().substring(0,100),read=async r=>{try{return await r.json()}catch{return null}};
  async function rows(){const r=await fetch(base+"/rest/v1/messages?select=id,message,device_id,created_at&channel=eq."+encodeURIComponent(channel)+"&username=eq."+encodeURIComponent(marker)+"&order=created_at.desc&limit=105",{headers}),d=await read(r);if(!r.ok)throw Error(JSON.stringify(d));return Array.isArray(d)?d:[]}
  const parse=row=>{try{return {...JSON.parse(row.message||"{}"),id:row.id,deviceId:row.device_id,createdAt:row.created_at}}catch{return null}};
  const remove=async row=>{if(row)await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(row.id),{method:"DELETE",headers})};
  const trim=async all=>{const frames=all.filter(r=>parse(r)?.type==="frame").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));if(frames.length<=100)return;await Promise.all(frames.slice(100).map(remove))};
  try{
    let all=await rows(),parsed=all.map(parse).filter(Boolean),control=parsed.find(x=>x.type==="control");
    if(req.method==="GET"){
      if(control&&Date.now()-(Number(control.updatedAt)||new Date(control.createdAt).getTime())>5000){await Promise.all(all.map(remove));return res.status(200).json({success:true,share:null,frame:null,bufferedFrames:0})}
      const frames=parsed.filter(x=>x.type==="frame").sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
      // Return only the oldest buffered frame. With 100 frames stored, viewers are roughly
      // 100 frames behind the host while receiving a small response every 100ms.
      const delayed=frames.length>=100?frames[0]:null;
      return res.status(200).json({success:true,share:control||null,frame:delayed,bufferedFrames:frames.length})
    }
    if(!deviceId)return res.status(400).json({error:"Device ID is required."});
    if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
    const action=String(body.action||"");
    if(action==="start"){
      if(control&&control.deviceId!==deviceId)return res.status(409).json({success:false,error:"Someone is already sharing their screen."});
      if(control)return res.status(200).json({success:true,share_id:control.id});
      const q=Math.min(1050,Math.max(150,Number(body.quality)||450)),f=Math.min(60,Math.max(5,Number(body.fps)||25));
      const obj={type:"control",state:"sharing",deviceId,username:String(body.username||"User").substring(0,24),quality:q,fps:f,frozen:false,updatedAt:Date.now()};
      const r=await fetch(base+"/rest/v1/messages",{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({username:marker,channel,message:JSON.stringify(obj),image:null,files:[],device_id:deviceId,edited:false})}),d=await read(r),created=Array.isArray(d)?d[0]:d;if(!r.ok)return res.status(r.status).json({error:d});return res.status(200).json({success:true,share_id:created?.id})
    }
    const shareId=String(body.share_id||"").trim();if(!shareId)return res.status(400).json({error:"Screen-share ID is required."});
    const liveControl=control&&String(control.id)===shareId?control:null;
    if(!liveControl||liveControl.deviceId!==deviceId)return res.status(409).json({success:false,error:"You are not the screen-share host."});
    if(action==="frame"){
      if(liveControl.frozen)return res.status(204).end();
      if(typeof body.image!=="string")return res.status(400).json({error:"Frame is missing."});
      const frame={type:"frame",state:"sharing",deviceId,username:liveControl.username,quality:liveControl.quality,fps:liveControl.fps,image:body.image,updatedAt:Date.now()};
      const r=await fetch(base+"/rest/v1/messages",{method:"POST",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({username:marker,channel,message:JSON.stringify(frame),image:null,files:[],device_id:deviceId,edited:false})});if(!r.ok)return res.status(r.status).json({error:await read(r)});
      const after=await rows();await trim(after);return res.status(204).end();
    }
    if(action==="heartbeat"||action==="freeze"){
      const next={...liveControl,updatedAt:Date.now()};if(action==="freeze")next.frozen=Boolean(body.frozen);delete next.id;delete next.deviceId;delete next.createdAt;
      const r=await fetch(base+"/rest/v1/messages?id=eq."+encodeURIComponent(shareId)+"&device_id=eq."+encodeURIComponent(deviceId),{method:"PATCH",headers:{...headers,Prefer:"return=minimal"},body:JSON.stringify({message:JSON.stringify(next)})});if(!r.ok)return res.status(r.status).json({error:await read(r)});return res.status(204).end();
    }
    if(action==="stop"){await Promise.all(all.map(r=>remove(r)));return res.status(200).json({success:true,stopped:true})}
    return res.status(400).json({error:"Unknown screen-share action."});
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}