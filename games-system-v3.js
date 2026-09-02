(()=>{
'use strict';
if(window.__chatGamesV3)return;window.__chatGamesV3=true;

const C=[
 ['ttt3','❌','Tic-Tac-Toe 3×3','Tic-Tac-Toe','1–3 players'],
 ['ttt4','❌','Tic-Tac-Toe 4×4','Tic-Tac-Toe','1–3 players'],
 ['ttt5','❌','Tic-Tac-Toe 5×5','Tic-Tac-Toe','1–3 players']
];

const css=document.createElement('style');
css.textContent=`#gamesV3{position:fixed;inset:0;z-index:50000;background:#000b;display:none;align-items:center;justify-content:center;padding:12px}#gamesV3.on{display:flex}.g3-win{width:min(900px,100%);height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden;background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid #fff2;border-radius:18px;box-shadow:0 20px 80px #0008}.g3-top{display:flex;gap:8px;align-items:center;padding:14px;border-bottom:1px solid #fff2}.g3-top h2{margin:0;flex:1}.g3-btn,.g3-select{border:1px solid #fff2;border-radius:10px;background:#ffffff0b;color:inherit;padding:10px 12px}.g3-btn{cursor:pointer}.g3-games{padding:18px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.g3-card{text-align:left;border:1px solid #fff2;border-radius:14px;background:#ffffff08;color:inherit;padding:16px;cursor:pointer;transition:.15s}.g3-card:hover{background:#fff1;transform:translateY(-2px)}.g3-icon{font-size:34px}.g3-card b{display:block;margin:8px 0 4px;font-size:17px}.g3-card small{opacity:.7}.g3-pill{display:inline-block;margin-top:9px;padding:4px 9px;border-radius:99px;background:#fff1;font-size:11px}.g3-play{padding:18px;overflow:auto}.g3-head{text-align:center;font-size:20px;margin-bottom:10px}.g3-center{text-align:center;padding:10px}.g3-grid{display:grid;gap:6px;width:min(78vw,560px);margin:15px auto}.g3-cell{aspect-ratio:1;border:1px solid #fff2;border-radius:10px;background:#ffffff0b;color:inherit;font-size:clamp(22px,6vw,42px);font-weight:900;cursor:pointer}.g3-cell:hover{background:#fff2}.g3-cell:disabled{cursor:default;opacity:.95}.g3-status{font-size:17px;font-weight:700}.g3-sub{opacity:.7;font-size:13px}.g3-row{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:10px 0}@media(max-width:600px){.g3-games{grid-template-columns:1fr}.g3-play{padding:10px}}`;
document.head.appendChild(css);

const root=document.createElement('div');
root.id='gamesV3';
root.innerHTML='<div class="g3-win"><div class="g3-top"><button class="g3-btn" id="g3back" style="display:none">← Games</button><h2 id="g3title">🎮 Games</h2><button class="g3-btn" id="g3close">×</button></div><div id="g3body"></div></div>';
document.body.appendChild(root);
const body=root.querySelector('#g3body'),back=root.querySelector('#g3back'),title=root.querySelector('#g3title');
let cleanup=()=>{};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function open(){root.classList.add('on');list()}
function close(){cleanup();root.classList.remove('on')}
function list(){
 cleanup=()=>{};back.style.display='none';title.textContent='🎮 Tic-Tac-Toe';
 body.innerHTML='<div class="g3-games" id="g3games"></div>';
 const out=body.querySelector('#g3games');
 out.innerHTML=C.map(x=>`<button class="g3-card" data-id="${x[0]}"><span class="g3-icon">${x[1]}</span><b>${esc(x[2])}</b><small>Classic board game</small><br><span class="g3-pill">${x[4]}</span></button>`).join('');
 out.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>play(b.dataset.id));
}
function play(id){
 cleanup();
 const x=C.find(a=>a[0]===id);
 back.style.display='block';title.textContent=x[1]+' '+x[2];
 body.innerHTML='<div class="g3-play" id="g3play"></div>';
 cleanup=ttt(body.querySelector('#g3play'),x);
}

function ttt(el,x){
 let size=Number(x[0].slice(3));
 let mode=1;
 let board=[];
 let turn=0;
 let done=false;
 const symbols=['❌','⭕','🔺'];
 const names=['Player 1','Player 2','Player 3'];
 let cells=[];
 let aiTimer=0;

 el.innerHTML=`<div class="g3-head">${x[1]} ${x[2]}</div>
 <div class="g3-center">
   <div class="g3-row" id="modes">
     <button class="g3-btn" data-mode="1">1 Player</button>
     <button class="g3-btn" data-mode="2">2 Players</button>
     <button class="g3-btn" data-mode="3">3 Players</button>
   </div>
   <div class="g3-sub">${size}×${size} board · Get ${size} in a row to win</div>
 </div>
 <div class="g3-grid" id="g"></div>
 <div class="g3-center"><div class="g3-status" id="status"></div></div>
 <div class="g3-center"><button class="g3-btn" id="new">New Game</button></div>`;

 const g=el.querySelector('#g'),status=el.querySelector('#status');
 el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=Number(b.dataset.mode);reset()});
 el.querySelector('#new').onclick=reset;

 function reset(){
   if(aiTimer)clearTimeout(aiTimer);
   board=Array(size*size).fill(0);turn=0;done=false;
   g.style.gridTemplateColumns=`repeat(${size},1fr)`;
   draw();
 }
 function inside(r,c){return r>=0&&r<size&&c>=0&&c<size}
 function hasWin(index,player){
   const r=Math.floor(index/size),c=index%size;
   for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
     let count=1;
     for(const dir of [-1,1]){
       let rr=r+dr*dir,cc=c+dc*dir;
       while(inside(rr,cc)&&board[rr*size+cc]===player){count++;rr+=dr*dir;cc+=dc*dir}
     }
     if(count>=size)return true;
   }
   return false;
 }
 function draw(){
   g.innerHTML=board.map((v,i)=>`<button class="g3-cell" data-i="${i}" ${v||done?'disabled':''}>${v?symbols[v-1]:''}</button>`).join('');
   cells=g.querySelectorAll('[data-i]');
   cells.forEach(b=>b.onclick=()=>move(Number(b.dataset.i)));
   if(done)return;
   status.textContent=(mode===1&&turn===1)?'🤖 Computer turn':`${symbols[turn]} ${names[turn]} turn`;
   if(mode===1&&turn===1)aiTimer=setTimeout(aiMove,220);
 }
 function move(i){
   if(done||board[i]||!inside(Math.floor(i/size),i%size))return;
   if(mode===1&&turn===1)return;
   place(i,turn+1);
 }
 function place(i,player){
   if(done||board[i])return;
   board[i]=player;
   if(hasWin(i,player)){
     done=true;draw();
     status.textContent=mode===1&&player===2?'🤖 Computer wins!':`🏆 ${names[player-1]} wins!`;
     return;
   }
   if(board.every(Boolean)){
     done=true;draw();status.textContent='🤝 Draw!';return;
   }
   turn=(turn+1)%mode;
   draw();
 }
 function aiMove(){
   if(done||mode!==1||turn!==1)return;
   const empty=board.map((v,i)=>v?null:i).filter(i=>i!==null);
   if(!empty.length)return;
   let choice=findWinningMove(2);
   if(choice<0)choice=findWinningMove(1);
   if(choice<0){
     const center=Math.floor(size/2)*size+Math.floor(size/2);
     if(!board[center])choice=center;
   }
   if(choice<0){
     const corners=[0,size-1,size*(size-1),size*size-1].filter(i=>!board[i]);
     choice=corners.length?corners[Math.floor(Math.random()*corners.length)]:empty[Math.floor(Math.random()*empty.length)];
   }
   place(choice,2);
 }
 function findWinningMove(player){
   for(const i of board.map((v,i)=>v?null:i).filter(i=>i!==null)){
     board[i]=player;
     const win=hasWin(i,player);
     board[i]=0;
     if(win)return i;
   }
   return -1;
 }
 reset();
 return()=>{if(aiTimer)clearTimeout(aiTimer)};
}

back.onclick=list;
root.querySelector('#g3close').onclick=close;
root.onclick=e=>{if(e.target===root)close()};

function install(){
 document.querySelectorAll('.expanded-games-launch,.gb-launch').forEach(b=>b.style.display='none');
 let grid=document.querySelector('.game-grid');
 if(grid){
   grid.querySelectorAll('.games-v3-launch').forEach((b,i)=>{if(i>0)b.remove()});
   let b=grid.querySelector('.games-v3-launch');
   if(!b){
     b=document.createElement('button');b.className='game-choice game-choice-featured games-v3-launch';b.type='button';
     b.innerHTML='<strong>🎮 Tic-Tac-Toe</strong><span>3×3 • 4×4 • 5×5 · 1–3 players</span>';
     b.onclick=open;grid.insertBefore(b,grid.firstChild);
   }else{
     b.innerHTML='<strong>🎮 Tic-Tac-Toe</strong><span>3×3 • 4×4 • 5×5 · 1–3 players</span>';
     b.onclick=open;
   }
 }
}
install();setInterval(install,1000);
window.ChatGamesV3={open,close,catalog:C};
})();