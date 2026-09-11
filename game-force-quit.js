(()=>{'use strict';
const PREFIX='__CHAT_GAME_STATE__:',POLL=900,missLimit=3;
let deviceId=localStorage.getItem('chat_device_id')||'',lastStateId=null,misses=0,button=null,currentState=null;
function dev(){if(!deviceId){deviceId=crypto.randomUUID?crypto.randomUUID():'game-'+Date.now()+'-'+Math.random();localStorage.setItem('chat_device_id',deviceId)}return deviceId}
function channel(){return window.CHANNEL||'general'}
async function getMessages(){try{const r=await fetch(`/api/messages?channel=${encodeURIComponent(channel())}&_game_force_quit=${Date.now()}`,{cache:'no-store'});if(!r.ok)return[];const d=await r.json();return Array.isArray(d.messages)?d.messages:[]}catch{return[]}}
function parse(row){if(!row||row.username!=='__GAME_SERVER__'||typeof row.message!=='string'||!row.message.startsWith(PREFIX))return null;try{return JSON.parse(row.message.slice(PREFIX.length))}catch{return null}}
function stateId(s,row){return String(s?.id||s?.gameId||s?.gameID||s?.game_id||row?.id||'').trim()}
function isHost(s){const h=String(s?.hostDeviceId||s?.hostDeviceID||s?.host_device_id||'');return !!h&&h===dev()}
function closeGameUI(){
  document.querySelectorAll('.game-play-overlay,.game-overlay,.game-modal,[data-game-overlay]').forEach(el=>{try{el.remove()}catch{}});
  document.querySelectorAll('.game-actions button,.game-toolbar button').forEach(b=>{const t=(b.textContent||'').toLowerCase();if(/leave|close|exit|stop|cancel/.test(t)){try{b.click()}catch{}}});
  window.dispatchEvent(new CustomEvent('chat-game-force-quit'));
}
function ensureStyle(){if(document.getElementById('game-force-quit-style'))return;const s=document.createElement('style');s.id='game-force-quit-style';s.textContent='.game-force-quit{position:fixed;right:18px;bottom:18px;z-index:25000;border:1px solid #8e3947;background:#a63f4b;color:#fff;border-radius:10px;padding:11px 15px;font-weight:800;cursor:pointer;box-shadow:0 12px 35px rgba(0,0,0,.35)}.game-force-quit:hover{filter:brightness(1.08)}';document.head.appendChild(s)}
function removeButton(){if(button){button.remove();button=null}}
async function forceQuit(){if(!currentState)return;const id=stateId(currentState,currentState.__row);if(!id)return;button&&(button.disabled=true,button.textContent='Stopping…');try{const r=await fetch('/api/messages',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({game_server:true,game_action:'stop',channel:channel(),device_id:dev(),game_id:id})});if(!r.ok){let d={};try{d=await r.json()}catch{}throw Error(d.error||'Could not stop the game.')}closeGameUI();removeButton();}catch(e){if(button){button.disabled=false;button.textContent='⏹ Force quit for everyone'}alert(e.message||'Could not stop the game.')}}
function showButton(s,row){if(isHost(s)){removeButton();return}ensureStyle();if(!button){button=document.createElement('button');button.type='button';button.className='game-force-quit';button.textContent='⏹ Force quit for everyone';button.onclick=forceQuit;document.body.appendChild(button)}currentState=s;s.__row=row;button.disabled=false;button.title=`Stop ${s.name||s.gameType||'this game'} for everyone`}
function tick(){getMessages().then(ms=>{let found=null;for(let i=ms.length-1;i>=0;i--){const s=parse(ms[i]);if(s){found={s,row:ms[i]};break}}
 if(found){misses=0;const id=stateId(found.s,found.row);currentState=found.s;currentState.__row=found.row;if(id!==lastStateId){lastStateId=id}showButton(found.s,found.row);return}
 if(lastStateId){misses++;if(misses>=missLimit){lastStateId=null;currentState=null;removeButton();closeGameUI();misses=0}}
 }).catch(()=>{});}
ensureStyle();dev();tick();setInterval(tick,POLL);
})();