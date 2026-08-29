export default async function handler(req,res){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  const URL='https://wlvbkdzcueqkknysisfw.supabase.co',KEY='sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL',MARK='__SCREEN_SHARE_V2__';
  const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Accept:'application/json'};
  const b=req.body||{},channel=String(b.channel||req.query?.channel||'general').slice(0,64),device=String(b.device_id||req.query?.device_id||'').slice(0,120);
  const json=async r=>{try{return await r.json()}catch{return null}};
  async function get(){const r=await fetch(`${URL}/rest/v1/messages?select=id,message,device_id,created_at&channel=eq.${encodeURIComponent(channel)}&username=eq.${encodeURIComponent(MARK)}&order=created_at.desc&limit=1`,{headers:H});const d=await json(r);if(!r.ok)throw Error(JSON.stringify(d));return d?.[0]||null}
  const parse=r=>{try{return r?JSON.parse(r.message||'{}'):null}catch{return null}};
  async function patch(id,p){const r=await fetch(`${URL}/rest/v1/messages?id=eq.${encodeURIComponent(id)}&username=eq.${encodeURIComponent(MARK)}`,{method:'PATCH',headers:{...H,Prefer:'return=minimal'},body:JSON.stringify({message:JSON.stringify(p),edited:true})});if(!r.ok)throw Error(JSON.stringify(await json(r)))}
  async function remove(r){if(r)await fetch(`${URL}/rest/v1/messages?id=eq.${encodeURIComponent(r.id)}&username=eq.${MARK}`,{method:'DELETE',headers:H})}
  try{
    const row=await get(),share=parse(row);
    if(req.method==='GET'){
      if(!share||share.type!=='screen-share')return res.status(200).json({ok:true,share:null});
      return res.status(200).json({ok:true,share:{id:row.id,type:share.type,state:share.state,host:share.host,deviceId:share.deviceId,peerId:share.peerId,viewerPeers:Array.isArray(share.viewerPeers)?share.viewerPeers:[],quality:share.quality,fps:share.fps,frozen:!!share.frozen,updatedAt:share.updatedAt,edited:!!row.edited}});
    }
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed.'});
    if(!device)return res.status(400).json({ok:false,error:'Missing device ID.'});
    const action=String(b.action||'');
    if(action==='start'){
      if(share&&share.type==='screen-share'&&Date.now()-Number(share.updatedAt||0)<15000&&share.deviceId!==device)return res.status(409).json({ok:false,error:'Someone is already sharing their screen.'});
      if(row)await remove(row);
      const now=Date.now(),quality=Math.min(750,Math.max(150,Number(b.quality)||750)),fps=Math.min(30,Math.max(5,Number(b.fps)||30));
      const p={type:'screen-share',state:'sharing',deviceId:device,peerId:String(b.peer_id||''),host:String(b.username||'User').slice(0,40),quality,fps,frozen:false,startedAt:now,updatedAt:now,viewerPeers:[]};
      const r=await fetch(`${URL}/rest/v1/messages`,{method:'POST',headers:{...H,Prefer:'return=representation'},body:JSON.stringify({username:MARK,channel,message:JSON.stringify(p),image:null,files:[],device_id:device,edited:false})}),d=await json(r);if(!r.ok)return res.status(r.status).json({ok:false,error:d});return res.status(200).json({ok:true,shareId:d?.[0]?.id});
    }
    if(action==='join'){
      if(!row||!share||share.type!=='screen-share')return res.status(404).json({ok:false,error:'No active screen share.'});
      const peerId=String(b.peer_id||'').slice(0,200);if(!peerId)return res.status(400).json({ok:false,error:'Missing viewer peer ID.'});
      if(share.deviceId===device)return res.status(200).json({ok:true,joined:false});
      share.viewerPeers=Array.isArray(share.viewerPeers)?share.viewerPeers.filter(x=>x&&x!==peerId):[];share.viewerPeers.push(peerId);share.updatedAt=Date.now();await patch(row.id,share);return res.status(200).json({ok:true,joined:true});
    }
    if(!row||!share||share.type!=='screen-share'||share.deviceId!==device||String(row.id)!==String(b.share_id||''))return res.status(409).json({ok:false,error:'Screen-share session is no longer owned by you.'});
    if(action==='heartbeat'){share.updatedAt=Date.now();await patch(row.id,share);return res.status(204).end()}
    if(action==='freeze'){share.frozen=!!b.frozen;share.updatedAt=Date.now();await patch(row.id,share);return res.status(204).end()}
    if(action==='stop'){await remove(row);return res.status(200).json({ok:true,stopped:true})}
    return res.status(400).json({ok:false,error:'Unknown screen-share action.'});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)})}
}