(()=>{
'use strict';
const kit=window.MPKit;
const register=window.ChatMultiplayerGames?.register;
if(!register)return;

function makeGame(id,name,size){
 register({
  id,
  name,
  icon:'❌',
  minPlayers:1,
  maxPlayers:3,
  render(el,a){
   const g=a.game;
   let aiTimer=0;

   if(g.status==='lobby'){
    const currentMode=Number(g.settings?.players||1);
    el.innerHTML=`<div class="g3-center">
      <h2>❌ ${name}</h2>
      <p>${size}×${size} · get ${size} in a row</p>
      <div class="g3-row">
        <button class="g3-btn" id="one">1 Player</button>
        <button class="g3-btn" id="two">2 Players</button>
        <button class="g3-btn" id="three">3 Players</button>
      </div>
      <p id="players">${g.players.length}/${currentMode} players required</p>
      <button class="g3-btn" id="start">Start game</button>
      <button class="g3-btn" id="leave">Leave</button>
    </div>`;
    const setMode=n=>{
      if(!a.isHost)return;
      g.settings={...(g.settings||{}),players:n};
      el.querySelector('#players').textContent=`${g.players.length}/${n} players required`;
      el.querySelector('#start').disabled=g.players.length<n;
    };
    el.querySelector('#one').onclick=()=>setMode(1);
    el.querySelector('#two').onclick=()=>setMode(2);
    el.querySelector('#three').onclick=()=>setMode(3);
    const start=el.querySelector('#start');
    start.disabled=!a.isHost||g.players.length<currentMode;
    start.onclick=async()=>{
      if(!a.isHost)return;
      const needed=Number(g.settings?.players||1);
      if(g.players.length<needed)return;
      g.status='playing';
      g.data={size,board:Array(size*size).fill(''),turn:0,winner:null,mode:needed};
      await a.publish(g);
    };
    el.querySelector('#leave').onclick=a.leave;
    return()=>{if(aiTimer)clearTimeout(aiTimer)};
   }

   const d=g.data||{};
   const board=d.board||Array(size*size).fill('');
   const mode=Number(d.mode||g.players.length||2);
   const solo=mode===1;
   const symbols=['❌','⭕','🔺'];
   const names=['Player 1','Player 2','Player 3'];
   const humanTurn=solo?(d.turn===0):(g.players[d.turn%g.players.length]?.deviceId===a.me);
   const turnName=solo?(d.turn===0?'Your turn':'Computer turn'):(g.players[d.turn%g.players.length]?.username||names[d.turn%3])+'\'s turn';

   el.innerHTML=`<div class="g3-center"><h2>❌ ${name}</h2><p>${size}×${size} · get ${size} in a row · ${turnName}</p></div>
   <div class="g3-grid" style="grid-template-columns:repeat(${size},1fr)">${board.map((v,i)=>`<button class="g3-cell" data-i="${i}" ${v||d.winner?'disabled':''}>${v||''}</button>`).join('')}</div>
   <div class="g3-center"><b id="status">${d.winner==='draw'?'🤝 Draw!':d.winner?'🏆 Game over':turnName}</b></div>
   <div class="g3-center"><button class="g3-btn" id="leave">Leave</button></div>`;

   function inside(r,c){return r>=0&&r<size&&c>=0&&c<size}
   function win(i,v){
    const r=Math.floor(i/size),c=i%size;
    for(const[dr,dc]of[[1,0],[0,1],[1,1],[1,-1]]){
     let count=1;
     for(const dir of[-1,1]){
      let rr=r+dr*dir,cc=c+dc*dir;
      while(inside(rr,cc)&&board[rr*size+cc]===v){count++;rr+=dr*dir;cc+=dc*dir}
     }
     if(count>=size)return true;
    }
    return false;
   }
   function empty(){return board.map((v,i)=>v?null:i).filter(i=>i!==null)}
   function winningMove(v){
    for(const i of empty()){
     board[i]=v;
     const ok=win(i,v);
     board[i]='';
     if(ok)return i;
    }
    return -1;
   }
   function aiPick(){
    let i=winningMove('O');
    if(i>=0)return i;
    i=winningMove('X');
    if(i>=0)return i;
    const center=Math.floor(size/2)*size+Math.floor(size/2);
    if(!board[center])return center;
    const corners=[0,size-1,size*(size-1),size*size-1].filter(i=>!board[i]);
    if(corners.length)return corners[Math.floor(Math.random()*corners.length)];
    const e=empty();return e.length?e[Math.floor(Math.random()*e.length)]:-1;
   }
   async function move(i,v,turn){
    if(g.status!=='playing'||d.winner||board[i]||d.turn!==turn)return;
    board[i]=v;
    if(win(i,v))d.winner=v;
    else if(board.every(Boolean))d.winner='draw';
    else d.turn=solo?(turn===0?1:0):(turn+1)%g.players.length;
    g.data=d;
    await a.publish(g);
   }
   el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.i);
    if(!humanTurn||board[i]||d.winner)return;
    move(i,solo?'X':symbols[d.turn%3],d.turn);
   });
   el.querySelector('#leave').onclick=a.leave;

   if(solo&&d.turn===1&&!d.winner){
    aiTimer=setTimeout(()=>{
      const i=aiPick();
      if(i>=0)move(i,'O',1);
    },280);
   }
   return()=>{if(aiTimer)clearTimeout(aiTimer)};
  }
 });
}

makeGame('tictac','Tic-Tac-Toe 3×3',3);
makeGame('ttt4','Tic-Tac-Toe 4×4',4);
makeGame('ttt5','Tic-Tac-Toe 5×5',5);
})();