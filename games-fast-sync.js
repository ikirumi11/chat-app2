(()=>{'use strict';
/* Games get their own fast state refresh instead of waiting for the normal chat refresh timer. */
const INTERVAL=100;
let busy=false,last=0;
async function fastGameRefresh(){
  if(busy)return;
  const overlay=document.getElementById('gamesOverlay');
  const active=!!overlay&&(overlay.classList.contains('show')||overlay.classList.contains('open')||getComputedStyle(overlay).display!=='none');
  if(!active)return;
  if(typeof window.loadMessages!=='function')return;
  busy=true;
  try{await window.loadMessages();last=performance.now()}catch(e){console.warn('Fast game sync:',e)}finally{busy=false}
}
setInterval(fastGameRefresh,INTERVAL);
window.GameFastSync={refresh:fastGameRefresh,interval:INTERVAL};
})();