(()=>{
'use strict';
if(window.__gamesUIRemake)return; window.__gamesUIRemake=true;

const SOLO=[
 {id:'snake',icon:'🐍',name:'Snake',cat:'Solo Arcade',desc:'Classic snake with increasing speed.'},
 {id:'2048',icon:'🔢',name:'2048',cat:'Solo Arcade',desc:'Merge tiles and chase 2048.'},
 {id:'mines',icon:'💣',name:'Minesweeper',cat:'Solo Arcade',desc:'Clear the board without hitting mines.'},
 {id:'breakout',icon:'🧱',name:'Breakout',cat:'Solo Arcade',desc:'Bounce the ball and clear every brick.'},
 {id:'flappy',icon:'🐦',name:'Flappy',cat:'Solo Arcade',desc:'Fly through the gaps.'},
 {id:'dodger',icon:'☄️',name:'Space Dodger',cat:'Solo Arcade',desc:'Survive the falling asteroids.'},
 {id:'tttai',icon:'❌',name:'Tic-Tac-Toe AI',cat:'Solo Arcade',desc:'Beat the computer.'},
 {id:'connectai',icon:'🔴',name:'Connect Four AI',cat:'Solo Arcade',desc:'Get four in a row.'},
 {id:'reaction',icon:'⚡',name:'Reaction Test',cat:'Solo Arcade',desc:'React as quickly as possible.'},
 {id:'memory1',icon:'🧠',name:'Memory',cat:'Solo Arcade',desc:'Match all pairs.'},
 {id:'typing',icon:'⌨️',name:'Typing Sprint',cat:'Solo Arcade',desc:'Type the sentence accurately.'},
 {id:'number',icon:'🎯',name:'Number Hunt',cat:'Solo Arcade',desc:'Find the hidden number.'},
 {id:'clicker',icon:'🖱️',name:'Clicker',cat:'Solo Arcade',desc:'Click as fast as you can.'},
 {id:'mathRush',icon:'➗',name:'Math Rush',cat:'Solo Arcade',desc:'Solve quick maths questions.'},
 {id:'colorMatch',icon:'🎨',name:'Color Match',cat:'Solo Arcade',desc:'Choose the matching color.'},
 {id:'maze',icon:'🧩',name:'Maze Escape',cat:'Solo Arcade',desc:'Reach the goal.'}
];
const PARTY=[
 {id:'ttt3',icon:'❌',name:'Tic-Tac-Toe',cat:'Multiplayer',players:'3',desc:'3-player Tic-Tac-Toe. Map size is configurable; always 3 in a row.'},
 {id:'ttt4',icon:'❌',name:'Tic-Tac-Toe 4×4',cat:'Multiplayer',players:'3',desc:'3-player map preset. Always 3 in a row.'},
 {id:'ttt5',icon:'❌',name:'Tic-Tac-Toe 5×5',cat:'Multiplayer',players:'3',desc:'3-player map preset. Always 3 in a row.'},
 {id:'ttt6',icon:'❌',name:'Tic-Tac-Toe 6×6',cat:'Multiplayer',players:'3',desc:'3-player map preset. Always 3 in a row.'},
 {id:'hangman',icon:'🔤',name:'Hangman',cat:'Multiplayer',players:'2',desc:'Guess the hidden word.'},
 {id:'battleship',icon:'🚢',name:'Battleship',cat:'Multiplayer',players:'2',desc:'Destroy the enemy fleet.'},
 {id:'memory',icon:'🧠',name:'Memory Match',cat:'Multiplayer',players:'2–6',desc:'Flip cards and match pairs.'},
 {id:'quickdraw',icon:'🏁',name:'Quick Draw',cat:'Multiplayer',players:'2–6',desc:'Click when DRAW appears.'},
 {id:'coinflip',icon:'🪙',name:'Coin Flip Battle',cat:'Multiplayer',players:'2–6',desc:'Guess heads or tails.'},
 {id:'numberguess',icon:'🔢',name:'Number Guess',cat:'Multiplayer',players:'2–6',desc:'Guess the hidden number.'},
 {id:'target',icon:'🎯',name:'Target Click',cat:'Multiplayer',players:'2–6',desc:'Click the target fast.'},
 {id:'reaction',icon:'⚡',name:'Reaction Time',cat:'Multiplayer',players:'2–6',desc:'Click when the screen turns green.'},
 {id:'type',icon:'⌨️',name:'Type Sentence',cat:'Multiplayer',players:'2–6',desc:'Type the sentence fastest.'},
 {id:'boss',icon:'👹',name:'Boss Battle',cat:'Multiplayer',players:'2–6',desc:'Defeat the boss.'},
 {id:'trivia',icon:'🧠',name:'Trivia Quiz',cat:'Multiplayer',players:'2–6',desc:'Answer questions correctly.'},
 {id:'wordscramble',icon:'🔤',name:'Word Scramble',cat:'Multiplayer',players:'2–6',desc:'Unscramble the letters.'},
 {id:'mathrace',icon:'➗',name:'Math Race',cat:'Multiplayer',players:'2–6',desc:'Solve maths problems fast.'},
 {id:'ttttournament',icon:'🏆',name:'Tic-Tac-Toe Tournament',cat:'Multiplayer',players:'3',desc:'3-player Tic-Tac-Toe tournament.'},
 {id:'rpstournament',icon:'🏆',name:'RPS Tournament',cat:'Multiplayer',players:'2–6',desc:'Rock Paper Scissors tournament.'}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');style.id='games-ui-remake-style';style.textContent=`.gur-overlay{position:fixed;inset:0;z-index:50000;background:#000b;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box}.gur-overlay.on{display:flex}.gur-box{width:min(1100px,100%);height:min(900px,95vh);display:flex;flex-direction:column;overflow:hidden;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #fff2;border-radius:18px;box-shadow:0 25px 100px #000c}.gur-head{display:flex;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid #fff2}.gur-head h2{margin:0;flex:1;font-size:21px}.gur-btn{border:0;border-radius:10px;padding:9px 12px;background:#fff1;color:inherit;cursor:pointer}.gur-tools{display:grid;grid-template-columns:minmax(180px,1fr) 180px 180px;gap:8px;padding:12px;border-bottom:1px solid #fff2}.gur-input,.gur-select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #fff2;border-radius:10px;background:#ffffff08;color:inherit;outline:none}.gur-list{padding:14px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;align-content:start}.gur-section{grid-column:1/-1;font-size:13px;font-weight:800;opacity:.7;margin:8px 2px -2px;text-transform:uppercase;letter-spacing:.06em}.gur-card{border:1px solid #fff2;border-radius:13px;background:#ffffff07;color:inherit;padding:15px;text-align:left;cursor:pointer}.gur-card:hover{background:#ffffff12;transform:translateY(-1px)}.gur-card .gur-icon{font-size:30px}.gur-card b{display:block;margin-top:7px}.gur-card small{display:block;opacity:.62;line-height:1.35;margin-top:5px}.gur-tag{display:inline-block;margin-top:9px;padding:4px 8px;border-radius:99px;background:#fff1;font-size:11px}.gur-empty{grid-column:1/-1;text-align:center;opacity:.65;padding:45px}.gur-chat-launch{margin:8px 0;width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #fff2;border-radius:12px;background:#ffffff08;color:inherit;text-align:left;cursor:pointer}@media(max-width:700px){.gur-tools{grid-template-columns:1fr 1fr}.gur-input{grid-column:1/-1}.gur-list{grid-template-columns:1fr 1fr}}@media(max-width:430px){.gur-list{grid-template-columns:1fr}}`;document.head.appendChild(style);
const all=[...PARTY,...SOLO];
const overlay=document.createElement('div');overlay.className='gur-overlay';overlay.innerHTML=`<div class="gur-box"><div class="gur-head"><button class="gur-btn" id="gurBack" style="display:none">← Games</button><h2 id="gurTitle">🎮 Games</h2><button class="gur-btn" id="gurClose">×</button></div><div class="gur-tools"><input class="gur-input" id="gurSearch" placeholder="🔎 Search games..."><select class="gur-select" id="gurCategory"><option value="all">All categories</option><option value="Solo Arcade">Solo Arcade</option><option value="Multiplayer">Multiplayer</option></select><select class="gur-select" id="gurPlayers"><option value="all">Any players</option><option value="1">1 player</option><option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option><option value="6">6 players</option></select></div><div class="gur-list" id="gurList"></div></div>`;document.body.appendChild(overlay);
const listEl=overlay.querySelector('#gurList'),search=overlay.querySelector('#gurSearch'),category=overlay.querySelector('#gurCategory'),players=overlay.querySelector('#gurPlayers'),back=overlay.querySelector('#gurBack'),title=overlay.querySelector('#gurTitle');
function show(){overlay.classList.add('on');back.style.display='none';title.textContent='🎮 Games';render()};function close(){overlay.classList.remove('on')}
function render(){const q=search.value.trim().toLowerCase(),pc=players.value;let data=all.filter(g=>{if(category.value!=='all'&&g.cat!==category.value)return false;if(q&&!(`${g.name} ${g.desc} ${g.cat}`).toLowerCase().includes(q))return false;if(pc!=='all'&&g.cat==='Solo Arcade'&&pc!=='1')return false;if(pc!=='all'&&g.cat==='Multiplayer'){const nums=(g.players||'').match(/\d+/g)||[];if(!nums.some(n=>+n===+pc))return false}return true});data.sort((a,b)=>a.cat.localeCompare(b.cat)||a.name.localeCompare(b.name));let html='',last='';for(const g of data){if(g.cat!==last){last=g.cat;html+=`<div class="gur-section">${g.cat}</div>`}html+=`<button class="gur-card" data-game="${esc(g.id)}" data-solo="${g.cat==='Solo Arcade'}"><span class="gur-icon">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.desc)}</small><span class="gur-tag">${g.cat==='Solo Arcade'?'1 player':esc(g.players)+' players'}</span></button>`}listEl.innerHTML=html||'<div class="gur-empty">No games match your search or filters.</div>';listEl.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>choose(b.dataset.game,b.dataset.solo==='true'))}
function choose(id,solo){if(solo){openSolo(id);return}close();const old=document.querySelector(`.game-choice[data-game="${CSS.escape(id)}"]`);if(old){old.click();return}const launch=document.querySelector('.expanded-games-launch');if(launch){launch.click();setTimeout(()=>{const x=document.querySelector(`.gbcard[data-id="${CSS.escape(id)}"]`);if(x)x.click()},350)}}
function openSolo(id){
  // Use the new unified V3 game engine directly. Do not depend on the old
  // games-plus launcher, which could leave the UI stuck on "Solo Arcade is Loading".
  if(window.ChatGamesV3&&typeof window.ChatGamesV3.open==='function'){
    window.ChatGamesV3.open();
    let tries=0;
    const timer=setInterval(()=>{
      const card=document.querySelector(`#gamesV3 .g3-card[data-id="${CSS.escape(id)}"]`);
      if(card){clearInterval(timer);card.click();return}
      if(++tries>40){clearInterval(timer)}
    },75);
    return;
  }
  // Fallback for older cached deployments.
  const launch=document.querySelector('.gp-launch');
  if(!launch){alert('Games are still loading. Please refresh once.');return}
  launch.click();
  let tries=0;
  const timer=setInterval(()=>{
    const card=document.querySelector(`.gp-card[data-gp="${CSS.escape(id)}"]`);
    if(card){clearInterval(timer);card.click();return}
    if(++tries>40){clearInterval(timer);alert('Game could not be loaded. Please refresh once.')}
  },75);
}
search.oninput=render;category.onchange=render;players.onchange=render;overlay.querySelector('#gurClose').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};window.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('on'))close()});window.__openGamesUI=show;
function hookButtons(){document.querySelectorAll('#gamesBtn,#gamesComposerBtn').forEach(btn=>{if(btn.dataset.gurHook)return;btn.dataset.gurHook='1';btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();show()},{capture:true})})}
function addChatLauncher(){const messages=document.querySelector('#messages');if(!messages||document.querySelector('.gur-chat-launch'))return;const b=document.createElement('button');b.className='gur-chat-launch';b.innerHTML='<b>🎮 Games</b><small>Solo Arcade + multiplayer games · Search, categories and player filters</small>';b.onclick=show;messages.appendChild(b)}
const ready=setInterval(()=>{hookButtons();addChatLauncher();if(document.querySelector('.gp-launch'))clearInterval(ready)},250);setTimeout(()=>clearInterval(ready),12000);
})();