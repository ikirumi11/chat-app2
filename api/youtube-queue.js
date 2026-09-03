export default async function handler(req,res){
  res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  try{
    const base='https://wlvbkdzcueqkknysisfw.supabase.co',key='sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL';const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'};
    const channel=String((req.query||{}).channel||'general').trim().substring(0,32);
    const qUrl=base+'/rest/v1/messages?select=id,message,device_id,created_at&channel=eq.'+encodeURIComponent(channel)+'&username=eq.__YOUTUBE_QUEUE__&order=created_at.asc';
    if(req.method==='GET'){const r=await fetch(qUrl,{headers}),data=await r.json();if(!r.ok)return res.status(500).json({error:'Could not load queue.'});return res.status(200).json({success:true,items:(Array.isArray(data)?data:[]).map(x=>{try{return{...JSON.parse(x.message),rowId:x.id,deviceId:x.device_id,createdAt:x.created_at}}catch(e){return null}}).filter(Boolean)})}
    const b=req.body||{},deviceId=String(b.device_id||'').trim();if(!deviceId)return res.status(400).json({error:'Device ID required.'});
    if(req.method==='POST'){const videoId=String(b.video_id||'').trim(),url=String(b.url||'').trim(),by=String(b.by||'Guest').trim().substring(0,24);if(!videoId||!url)return res.status(400).json({error:'Video is required.'});const payload={username:'__YOUTUBE_QUEUE__',channel,message:JSON.stringify({videoId,url,by}),image:null,files:[],device_id:deviceId,edited:false};const r=await fetch(base+'/rest/v1/messages',{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(payload)}),data=await r.json();if(!r.ok)return res.status(500).json({error:'Could not add video.'});return res.status(200).json({success:true,item:Array.isArray(data)?data[0]:data})}
    if(req.method==='DELETE'){
      const id=String(b.id||'').trim();if(!id)return res.status(400).json({error:'Queue item ID required.'});
      const activeR=await fetch(base+'/rest/v1/messages?select=message&channel=eq.'+encodeURIComponent(channel)+'&username=eq.__GAME_SERVER__&order=created_at.desc&limit=20',{headers}),active=await activeR.json();
      let host='';for(const row of(Array.isArray(active)?active:[])){try{const s=JSON.parse(String(row.message).replace('__YOUTUBE_TOGETHER__:',''));if(s&&s.hostDeviceId){host=s.hostDeviceId;break}}catch(e){}}
      if(!host||host!==deviceId)return res.status(403).json({error:'Only the YouTube Together host can remove or play queue items.'});
      const r=await fetch(base+'/rest/v1/messages?id=eq.'+encodeURIComponent(id)+'&username=eq.__YOUTUBE_QUEUE__',{method:'DELETE',headers});if(!r.ok)return res.status(500).json({error:'Could not remove queue item.'});return res.status(200).json({success:true,deleted:true})
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){return res.status(500).json({error:e.message||'Server error.'})}
}
