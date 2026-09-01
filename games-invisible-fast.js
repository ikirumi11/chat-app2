(()=>{'use strict';
const PREFIX='__CHAT_GAME_STATE__:';
const hide=()=>{const root=document.getElementById('messages');if(!root)return;root.querySelectorAll('*').forEach(n=>{if(n.childElementCount===0&&String(n.textContent||'').includes(PREFIX)){const row=n.closest('[data-id],.message,.chat-message,.message-row')||n;row.style.display='none';row.setAttribute('aria-hidden','true')}})};
const mo=new MutationObserver(hide);const start=()=>{const m=document.getElementById('messages');if(m)mo.observe(m,{childList:true,subtree:true,characterData:true});hide()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.ChatGameTransport={pollMs:75,hide};
})();