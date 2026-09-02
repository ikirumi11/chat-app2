(()=>{'use strict';
const REMOVED=new Set(['Trivia Quiz','Word Scramble','Math Race','Tic-Tac-Toe Tournament','RPS Tournament','trivia','wordscramble','mathrace','ttttournament','rpstournament']);
function clean(root=document){
 root.querySelectorAll('[data-id]').forEach(el=>{const id=el.getAttribute('data-id');if(id&&REMOVED.has(id))el.remove()});
 root.querySelectorAll('.gbcard,.gb-launch,[data-game-id]').forEach(el=>{const id=el.dataset.id||el.dataset.gameId||'';const text=el.textContent||'';if(REMOVED.has(id)||[...REMOVED].some(x=>text.includes(x)))el.remove()});
}
clean();new MutationObserver(()=>clean()).observe(document.body,{childList:true,subtree:true});
window.ChatGamesOriginalOnly={clean};
})();