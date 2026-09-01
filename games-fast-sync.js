(()=>{'use strict';
/* Game transport is independent from the normal chat message interval. */
const INTERVAL=75;let busy=false;
async function fastGameRefresh(){if(busy)return;const active=document.getElementById('gamesV3')?.classList.contains('on')||document.getElementById('gamesOverlay')?.classList.contains('show');if(!active||typeof window.loadMessages!=='function')return;busy=true;try{await window.loadMessages()}catch(e){}finally{busy=false}}
setInterval(fastGameRefresh,INTERVAL);window.GameFastSync={refresh:fastGameRefresh,interval:INTERVAL};
})();