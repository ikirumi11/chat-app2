(()=>{'use strict';
if(window.__gamesFirstMenu)return;window.__gamesFirstMenu=true;
function openGames(e){
  if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}
  const old=document.getElementById('gamesOverlay');
  if(old)old.classList.remove('show','open','active');
  const open=()=>{if(window.ChatGamesV3&&typeof window.ChatGamesV3.open==='function'){window.ChatGamesV3.open();return true}return false};
  if(open())return;
  let tries=0;const t=setInterval(()=>{if(open()||++tries>40)clearInterval(t)},50);
}
function install(){
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#gamesBtn,#gamesComposerBtn');
    if(b)openGames(e);
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
