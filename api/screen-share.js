export default async function handler(req,res){
  res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return res.status(204).end();
  const URL='https://wlvbkdzcueqkknysisfw.supabase.co',KEY='sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL',MARK='__SCREEN_SHARE_V2__';const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Accept:'application/json'};
  const b=req.body||{},channel=String(b.channel||req.query?.channel||'general').slice(0,64),device=String(b.device_id||req.query?.device_id||'').slice(0,120),json=async r=>{try{return await r.json()}catch{return null}};
  async function get(){const r=await fetch(`${URL}/rest/v1/messages?select=id,message,device_id,created_at,edited&channel=eq.${encodeURIComponent(channel)}&username=eq.${encodeURIComponent(MARK)}&order=created_at.desc&limit=1`,{headers:H});const d=await json(r);if(!r.ok)throw Error(JSON.stringify(d));return d?.[0]||null}
  const parse=r=>{try{return r?JSON.parse(r.message||'{}'):null}catch{return null}};
  async function patch(id,p){const r=await fetch(`${URL}/rest/v1/messages?id=eq.${encodeURIComponent(id)}&username=eq.${encodeURIComponent(MARK)}`,{method:'PATCH',headers:{...H,Prefer:'return=minimal'},body:JSON.stringify({message:JSON.stringify(p),edited:true})});if(!r.ok)throw Error(JSON.stringify(await json(r)))}
  async function remove(r){if(r)await fetch(`${URL}/rest/v1/messages?id=eq.${encodeURIComponent(r.id)}&username=eq.${encodeURIComponent(MARK)}`,{method:'DELETE',headers:H})}
  try{
    const row=await get(),state=parse(row),active=state&&(state.type==='screen-share'||state.type==='camera-share')&&Date.now()-Number(state.updatedAt||0)<15000;
    if(req.method==='GET'){
      if(!row||!active)return res.status(200).json({ok:true,share:null});
      if(state.type==='screen-share')return res.status(200).json({ok:true,share:{id:row.id,type:state.type,state:state.state,host:state.host,deviceId:state.deviceId,peerId:state.peerId,viewerPeers:Array.isArray(state.viewerPeers)?state.viewerPeers:[],quality:state.quality,fps:state.fps,audio:!!state.audio,frozen:!!state.frozen,startedAt:state.startedAt,updatedAt:state.updatedAt,edited:!!row.edited}});
      return res.status(200).json({ok:true,share:{id:row.id,type:state.type,state:state.state,host:state.host,startedAt:state.startedAt,updatedAt:state.updatedAt,participants:Array.isArray(state.participants)?state.participants:[],audio:!!state.audio}});
    }
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed.'});if(!device)return res.status(400).json({ok:false,error:'Missing device ID.'});const action=String(b.action||'');
    if(action==='start'){
      if(active&&state.deviceId===device)return res.status(200).json({ok:true,shareId:row.id,already:true});
      if(active)return res.status(409).json({ok:false,error:state.type==='camera-share'?'Camera sharing is already active.':'Someone is already sharing their screen.'});
      if(row)await remove(row);const now=Date.now(),mode=String(b.mode||'screen-share'),audio=!!b.audio;
      if(mode==='camera-share'){
        const p={type:'camera-share',state:'sharing',host:String(b.username||'User').slice(0,40),startedAt:now,updatedAt:now,audio,participants:[{deviceId:device,peerId:String(b.peer_id||''),username:String(b.username||'User').slice(0,40),audio}]};
        const r=await fetch(`${URL}/rest/v1/messages`,{method:'POST',headers:{...H,Prefer:'return=representation'},body:JSON.stringify({username:MARK,channel,message:JSON.stringify(p),image:null,files:[],device_id:device,edited:false})}),d=await json(r);if(!r.ok)return res.status(r.status).json({ok:false,error:d});return res.status(200).json({ok:true,shareId:d?.[0]?.id,slot:0});
      }
      const quality=Math.min(2160,Math.max(150,Number(b.quality)||2160)),fps=Math.min(144,Math.max(5,Number(b.fps)||60));const p={type:'screen-share',state:'sharing',deviceId:device,peerId:String(b.peer_id||''),host:String(b.username||'User').slice(0,40),quality,fps,audio, frozen:false,startedAt:now,updatedAt:now,viewerPeers:[]};
      const r=await fetch(`${URL}/rest/v1/messages`,{method:'POST',headers:{...H,Prefer:'return=representation'},body:JSON.stringify({username:MARK,channel,message:JSON.stringify(p),image:null,files:[],device_id:device,edited:false})}),d=await json(r);if(!r.ok)return res.status(r.status).json({ok:false,error:d});return res.status(200).json({ok:true,shareId:d?.[0]?.id});
    }
    if(!row||!active)return res.status(404).json({ok:false,error:'No active share.'});
    if(action==='join'){
      if(state.type==='screen-share'){
        const peerId=String(b.peer_id||'').slice(0,200);if(!peerId)return res.status(400).json({ok:false,error:'Missing viewer peer ID.'});if(state.deviceId===device)return res.status(200).json({ok:true,joined:false});state.viewerPeers=Array.isArray(state.viewerPeers)?state.viewerPeers.filter(x=>x&&x!==peerId):[];state.viewerPeers.push(peerId);state.updatedAt=Date.now();await patch(row.id,state);return res.status(200).json({ok:true,joined:true});
      }
      const peerId=String(b.peer_id||'').slice(0,200);if(!peerId)return res.status(400).json({ok:false,error:'Missing camera peer ID.'});let ps=Array.isArray(state.participants)?state.participants.filter(p=>p&&p.deviceId!==device):[];if(ps.length>=4)return res.status(409).json({ok:false,error:'All 4 camera slots are full.'});const p={deviceId:device,peerId,username:String(b.username||'User').slice(0,40),audio:!!b.audio};ps.push(p);state.participants=ps;state.updatedAt=Date.now();await patch(row.id,state);return res.status(200).json({ok:true,joined:true,slot:ps.length-1,participants:ps});
    }
    if(state.type==='screen-share'&&state.deviceId===device&&String(row.id)===String(b.share_id||'')){
      if(action==='heartbeat'){state.updatedAt=Date.now();await patch(row.id,state);return res.status(204).end()}
      if(action==='freeze'){state.frozen=!!b.frozen;state.updatedAt=Date.now();await patch(row.id,state);return res.status(204).end()}
      if(action==='stop'){await remove(row);return res.status(200).json({ok:true,stopped:true})}
    }
    if(state.type==='camera-share'){
      let ps=Array.isArray(state.participants)?state.participants:[],i=ps.findIndex(p=>p.deviceId===device);
      if(action==='heartbeat'&&i>=0){state.updatedAt=Date.now();await patch(row.id,state);return res.status(204).end()}
      if(action==='leave-camera'&&i>=0){ps.splice(i,1);state.participants=ps;state.updatedAt=Date.now();if(!ps.length){await remove(row);return res.status(200).json({ok:true,stopped:true})}await patch(row.id,state);return res.status(200).json({ok:true,left:true,participants:ps})}
      if(action==='stop'&&i>=0){ps.splice(i,1);state.participants=ps;state.updatedAt=Date.now();if(!ps.length){await remove(row);return res.status(200).json({ok:true,stopped:true})}await patch(row.id,state);return res.status(200).json({ok:true,left:true,participants:ps})}
    }
    return res.status(400).json({ok:false,error:'Unknown share action.'});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)})}
}
