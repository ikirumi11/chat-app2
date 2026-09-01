(()=>{'use strict';
window.ChatSoloGames=window.ChatSoloGames||{};
const files=['snake','flappy-bird','2048','minesweeper','breakout','space-dodger','ttt-ai','connect-four-ai','reaction-test','memory','typing-sprint','number-hunt'];
const load=(name)=>{if(document.querySelector(`script[data-solo="${name}"]`))return;const s=document.createElement('script');s.src=`/games/solo/${name}.js?v=20260901`;s.dataset.solo=name;s.async=false;document.body.appendChild(s)};
files.forEach(load);
window.ChatSoloGamesReady=()=>files.every(n=>{const id=n==='flappy-bird'?'flappy':n==='2048'?'2048':n==='minesweeper'?'mines':n==='space-dodger'?'dodger':n==='ttt-ai'?'tttai':n==='connect-four-ai'?'connectai':n==='reaction-test'?'reaction':n==='typing-sprint'?'typing':n==='number-hunt'?'number':n;return !!window.ChatSoloGames[id]});
})();