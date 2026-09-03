/* YouTube Together lifecycle cleanup. */
(()=>{'use strict';
const API='/api/messages',PREFIX='__YOUTUBE_TOGETHER__:',SYS='__YT_SYSTEM__:',STALE=4000;
const dev=()=>localStorage.getItem('chat_device_id')||'';
const channel=()=>window.CHANNEL||'general';
async function get(){try{const r=await fetch(`${API}?channel=${encodeURIComponent(channel())}&_yt_cleanup=${Date.now()}`,{cache:'no-store'});const d=await r.json();return Array.isArray(d.messages)?d.messages:[]}catch{return[]}}
async function del(id,owner){if(!id||!owner)return;try{await fetch(API,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,device_id:owner})})}catch{}}
async function cleanup(){const ms=await get();let session=null;for(let i=ms.length-1;i>=0;i--){const m=ms[i];if(typeof m.message==='string'&&m.message.startsWith(PREFIX)){try{session={row:m,state:JSON.parse(m.message.slice(PREFIX.length))};break}catch{}}}if(!session)return;if(Number(session.state?.sentAt||0)>0&&Date.now()-Number(session.state.sentAt)>STALE){await del(session.row.id,session.row.device_id||'');for(const m of ms){if(m.username==='__SYSTEM__'&&typeof m.message==='string'&&m.message.startsWith(SYS))await del(m.id,m.device_id||'')}location.reload()}}
async function unload(){const ms=await get();for(let i=ms.length-1;i>=0;i--){const m=ms[i];if(typeof m.message!=='string'||!m.message.startsWith(PREFIX))continue;try{const s=JSON.parse(m.message.slice(PREFIX.length));if(s.hostDeviceId===dev()){fetch(API,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({game_server:true,game_action:'stop',channel:channel(),device_id:dev(),game_id:m.id})}).catch(()=>{});for(const x of ms){if(x.username==='__SYSTEM__'&&typeof x.message==='string'&&x.message.startsWith(SYS))fetch(API,{method:'DELETE',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id,device_id:x.device_id||dev()})}).catch(()=>{})}break}catch{}}}
function boot(){cleanup();setInterval(cleanup,1500);window.addEventListener('pagehide',unload);window.addEventListener('beforeunload',unload)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
