export default async function handler(req,res){
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const b=req.body||{}, id=String(b.id||'').trim(), deviceId=String(b.device_id||'').trim(), action=String(b.action||'').trim();
    if(!id||!deviceId||!['edit','delete'].includes(action))return res.status(400).json({error:'Invalid message action.'});
    const base='https://wlvbkdzcueqkknysisfw.supabase.co',key='sb_publishable_mIC-G8R_uNChoa27DJj1Vg_aekYL2KL';
    const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'};
    const ownerR=await fetch(base+'/rest/v1/messages?select=id,device_id,username&limit=1&id=eq.'+encodeURIComponent(id),{headers}),owner=await ownerR.json();
    if(!ownerR.ok)return res.status(500).json({error:'Could not verify message.'});
    if(!Array.isArray(owner)||!owner[0])return res.status(404).json({error:'Message not found.'});
    if(owner[0].device_id!==deviceId)return res.status(403).json({error:'You can only change your own messages.'});
    const rowUrl=base+'/rest/v1/messages?id=eq.'+encodeURIComponent(id)+'&device_id=eq.'+encodeURIComponent(deviceId);
    if(action==='delete'){const r=await fetch(rowUrl,{method:'DELETE',headers});if(!r.ok)return res.status(500).json({error:'Could not delete message.'});return res.status(200).json({success:true,deleted:true});}
    const message=String(b.message||'').trim().substring(0,20000);if(!message)return res.status(400).json({error:'Message cannot be empty.'});
    const r=await fetch(rowUrl,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({message,edited:true})}),data=await r.json();
    if(!r.ok)return res.status(500).json({error:'Could not edit message.'});return res.status(200).json({success:true,message:Array.isArray(data)?data[0]:data});
  }catch(e){return res.status(500).json({error:e.message||'Server error.'})}
}
