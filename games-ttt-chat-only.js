(()=>{
'use strict';
const IDS=new Set(['ttt3','ttt4','ttt5','tictac','ttt4','ttt5']);
function route(e){
 const b=e.target.closest?.('.g3-card[data-id]');
 if(!b||!IDS.has(b.dataset.id)||!window.ChatMP?.mods?.[b.dataset.id])return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 window.ChatMP.show(b.dataset.id);
}
document.addEventListener('click',route,true);
function clean(){
 document.querySelectorAll('.g3-card[data-id]').forEach(b=>{
  if(!IDS.has(b.dataset.id))b.remove();
 });
 document.querySelectorAll('.game-choice').forEach(b=>{
  if(!b.classList.contains('games-v3-launch'))b.style.display='none';
 });
}
clean();
new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
window.ChatGamesTTTOnly={clean};
})();