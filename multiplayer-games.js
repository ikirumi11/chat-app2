(() => {
  'use strict';

  const EXTRA = {
    connect4:{name:'Connect Four',icon:'🔴',min:2,max:2,desc:'Drop four pieces in a row.'},
    reversi:{name:'Reversi',icon:'⚫',min:2,max:2,desc:'Flip your opponent’s pieces on an 8×8 board.'},
    dots:{name:'Dots & Boxes',icon:'⬛',min:2,max:2,desc:'Draw edges and claim the most boxes.'},
    reactionduel:{name:'Reaction Duel',icon:'⚡',min:2,max:2,desc:'Race through five reaction rounds.'},
    wordduel:{name:'Word Duel',icon:'🔤',min:2,max:2,desc:'Solve the same word challenge first.'},
    checkers:{name:'Checkers',icon:'🔴',min:2,max:2,desc:'Capture pieces and reach the other side.'},
    gomoku:{name:'Gomoku',icon:'⚪',min:2,max:2,desc:'Get five stones in a row on a 15×15 board.'},
    morris:{name:'Nine Men’s Morris',icon:'⭕',min:2,max:2,desc:'Place and move pieces to outplay your opponent.'},
    wordchain:{name:'Word Chain',icon:'🔗',min:2,max:2,desc:'Build a word chain one turn at a time.'},
    connect5:{name:'Connect Five',icon:'🟣',min:2,max:2,desc:'A bigger connect game on a 9×9 board.'}
  };

  const WORDS=['APPLE','RIVER','HOUSE','PLANT','TRAIN','MOUSE','LIGHT','STONE','WATER','CLOUD','TIGER','ROBOT','BEACH','PIZZA','MUSIC','BRICK','CHAIR','BREAD','SNAKE','SPACE'];
  const oldBoard=window.createGameBoard;
  const oldDesc=window.getGameDescription;
  const oldDefaults=window.getDefaultSettings;

  Object.keys(EXTRA).forEach(k=>{
    if(typeof GAME_TYPES!=='undefined'&&!GAME_TYPES[k]) GAME_TYPES[k]=EXTRA[k];
  });

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function me(){return deviceId;}
  function idx(g){return g.players.findIndex(p=>p.deviceId===me());}
  function mine(g){return idx(g)>=0;}
  function currentPlayer(g){return g.players[g.turnIndex%g.players.length];}
  function canMove(g){return g.status==='playing'&&mine(g)&&currentPlayer(g)?.deviceId===me()&&!g.winner;}
  function commit(oldGame,copy){return publishGameAndCleanup(oldGame,copy);}

  function addCard(type){
    const grid=document.querySelector('#gamesOverlay .game-grid');
    if(!grid||grid.querySelector(`[data-game="${type}"]`))return;
    const g=EXTRA[type],b=document.createElement('button');
    b.className='game-choice';b.dataset.game=type;b.type='button';
    b.innerHTML=`<strong>${g.icon} ${g.name}</strong><span>${g.desc}</span><div class="game-players">${g.min}-${g.max} players</div>`;
    b.onclick=()=>createGame(type);
    grid.appendChild(b);
  }

  function installCards(){Object.keys(EXTRA).forEach(addCard);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCards);else installCards();
  window.addEventListener('load',installCards);

  window.getDefaultSettings=function(type){
    const base=oldDefaults?oldDefaults(type):{};
    if(type==='connect4')return {...base,extra:{board:Array(42).fill(0)}};
    if(type==='reversi')return {...base,extra:{board:revInitial()}};
    if(type==='dots')return {...base,extra:{h:Array(20).fill(0),v:Array(20).fill(0),boxes:Array(16).fill(0),scores:[0,0]}};
    if(type==='reactionduel')return {...base,extra:{round:1,rounds:5,phase:'ready',goAt:0,results:{}}};
    if(type==='wordduel')return {...base,extra:{round:1,rounds:5,word:WORDS[Math.floor(Math.random()*WORDS.length)],answers:{},scores:[0,0]}};
    if(type==='checkers')return {...base,extra:{board:checkersInitial()}};
    if(type==='gomoku')return {...base,extra:{board:Array(225).fill(0)}};
    if(type==='morris')return {...base,extra:{board:Array(24).fill(0),phase:'place',placed:[0,0],scores:[0,0]}};
    if(type==='wordchain')return {...base,extra:{words:[],used:[]}};
    if(type==='connect5')return {...base,extra:{board:Array(81).fill(0)}};
    return base;
  };

  window.getGameDescription=function(game){
    if(game&&EXTRA[game.gameType])return EXTRA[game.gameType].desc+' Played directly in the chat.';
    return oldDesc?oldDesc(game):'Game in progress.';
  };

  window.createGameBoard=function(game){
    const f={connect4,reversi,dots,reactionduel,wordduel,checkers,gomoku,morris,wordchain,connect5};
    return f[game.gameType]?f[game.gameType](game):(oldBoard?oldBoard(game):null);
  };

  const style=document.createElement('style');
  style.textContent=`
    .game-message,.game-message *{animation:none!important;transition:none!important}
    .native-extra-board{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
    .native-grid{display:grid;gap:4px;justify-content:center}
    .native-grid button{border:1px solid #353b46;background:#20252d;color:#fff;border-radius:7px;cursor:pointer;font-size:20px;font-weight:800}
    .native-grid button:disabled{cursor:default;opacity:.82}
    .c4{grid-template-columns:repeat(7,46px);background:#244f9e;padding:9px;border-radius:14px}.c4 button{width:46px;height:46px;border-radius:50%;background:#11161d}.c4 button.r{background:#ef5265}.c4 button.y{background:#ffd34d}
    .rev{grid-template-columns:repeat(8,39px);background:#16603c;padding:5px}.rev button{width:39px;height:39px;background:#1e8653;border:0;border-radius:2px}.rev button.b::after,.rev button.w::after{content:'';display:block;width:27px;height:27px;border-radius:50%;margin:auto}.rev button.b::after{background:#111}.rev button.w::after{background:#eee}
    .dots{gap:0;background:#171b21;padding:4px}.dots button{border:0;border-radius:0;background:#20252d}.dots button.h:after{content:'';display:block;height:6px;background:#6d55ff;border-radius:4px}.dots button.v:after{content:'';display:block;width:6px;height:100%;background:#6d55ff;border-radius:4px;margin:auto}
    .checkers{grid-template-columns:repeat(8,42px)}.checkers button{width:42px;height:42px;border-radius:0}.checkers button.dark{background:#6c4b38}.checkers button.light{background:#d8c1a8}.checkers button.p1:after,.checkers button.p2:after{content:'';display:block;width:31px;height:31px;border-radius:50%;margin:auto;border:3px solid rgba(255,255,255,.2)}.checkers button.p1:after{background:#d84b57}.checkers button.p2:after{background:#ececec}.checkers button.king:after{box-shadow:inset 0 0 0 4px #ffd34d}
    .gomoku{grid-template-columns:repeat(15,27px);background:#b78b52;padding:5px;gap:1px}.gomoku button{width:27px;height:27px;background:#d1a56a;border:1px solid #9b703e;border-radius:2px;font-size:16px}.gomoku button.g1{color:#111}.gomoku button.g2{color:#fff}
    .morris{grid-template-columns:repeat(7,36px);grid-template-rows:repeat(7,36px);gap:0}.morris button{width:36px;height:36px;background:#1d2229;border:1px solid #343b46;border-radius:50%;font-size:18px}.morris button.m1{background:#d84b57}.morris button.m2{background:#eee;color:#111}
    .native-input{padding:11px;border:1px solid #414854;background:#11151a;color:#fff;border-radius:9px;text-align:center;font-size:17px}.native-status{text-align:center;color:#aeb6c1;min-height:22px}.native-big{font-size:28px;font-weight:900;text-align:center;padding:22px;border-radius:14px;background:#1b2027;cursor:pointer;user-select:none}.native-big.click{background:#1e8f55}.native-code{display:flex;gap:7px;justify-content:center}.native-code button{width:46px;height:46px;border:1px solid #444b56;border-radius:9px;background:#20252d;color:#fff;cursor:pointer;font-size:22px}
    @media(max-width:560px){.c4{grid-template-columns:repeat(7,36px)}.c4 button{width:36px;height:36px}.rev{grid-template-columns:repeat(8,31px)}.rev button{width:31px;height:31px}.gomoku{grid-template-columns:repeat(15,22px)}.gomoku button{width:22px;height:22px}.checkers{grid-template-columns:repeat(8,34px)}.checkers button{width:34px;height:34px}.morris{grid-template-columns:repeat(7,30px);grid-template-rows:repeat(7,30px)}.morris button{width:30px;height:30px}}
  `;
  document.head.appendChild(style);

  function box(){const e=document.createElement('div');e.className='native-extra-board';return e;}
  function status(text){const e=document.createElement('div');e.className='native-status';e.textContent=text;return e;}
  function finish(copy,winner){copy.winner=winner;copy.status='finished';}
  function names(g){return g.players.map(p=>getDisplayName(p.deviceId,p.username)).join(' vs ');}
  function turnText(g){const p=currentPlayer(g);return `Turn: ${getDisplayName(p?.deviceId,p?.username||'Player')}`;}

  function connect4(g){
    const a=box(),s=g.data.settings.extra,b=s.board,m=idx(g),my=canMove(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:turnText(g)+(my?' — your move':'')));const grid=document.createElement('div');grid.className='native-grid c4';
    for(let i=0;i<42;i++){const q=document.createElement('button');q.className=b[i]===1?'r':b[i]===2?'y':'';q.disabled=!my||!!b[i];q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra,v=m+1,col=i%7;let row=-1;for(let r=5;r>=0;r--)if(!e.board[r*7+col]){row=r;break}if(row<0)return;e.board[row*7+col]=v;if(c4win(e.board,v))finish(c,getDisplayName(deviceId,settings.username));else if(e.board.every(Boolean))finish(c,'Draw');else c.turnIndex++;await commit(g,c)};grid.append(q)}a.append(grid);return a;
  }
  function c4win(b,v){for(let r=0;r<6;r++)for(let c=0;c<7;c++){if(c<4&&[0,1,2,3].every(k=>b[r*7+c+k]===v))return true;if(r<3&&[0,1,2,3].every(k=>b[(r+k)*7+c]===v))return true;if(r<3&&c<4&&[0,1,2,3].every(k=>b[(r+k)*7+c+k]===v))return true;if(r<3&&c>2&&[0,1,2,3].every(k=>b[(r+k)*7+c-k]===v))return true}return false}

  function revInitial(){const b=Array(64).fill(0);b[27]=2;b[28]=1;b[35]=1;b[36]=2;return b}
  function revMoves(b,i,v){const out=[],r=Math.floor(i/8),c=i%8,e=v===1?2:1;for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){let rr=r+dr,cc=c+dc,line=[];while(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===e){line.push(rr*8+cc);rr+=dr;cc+=dc}if(line.length&&rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===v)out.push(...line)}return out}
  function reversi(g){const a=box(),s=g.data.settings.extra,b=s.board,m=idx(g),v=m+1,my=canMove(g),legal=[];if(my)for(let i=0;i<64;i++)if(!b[i]&&revMoves(b,i,v).length)legal.push(i);a.append(status(g.winner?`🏆 ${g.winner} wins!`:`${turnText(g)} · Black ${b.filter(x=>x===1).length} / White ${b.filter(x=>x===2).length}`));const grid=document.createElement('div');grid.className='native-grid rev';for(let i=0;i<64;i++){const q=document.createElement('button');q.className=b[i]===1?'b':b[i]===2?'w':'';q.disabled=!legal.includes(i);q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra,val=m+1,flips=revMoves(e.board,i,val);if(!flips.length)return;e.board[i]=val;flips.forEach(x=>e.board[x]=val);c.turnIndex++;const next=1-(m);if(!Array.from({length:64},(_,z)=>!e.board[z]&&revMoves(e.board,z,next+1).length).some(Boolean)){const one=e.board.filter(x=>x===1).length,two=e.board.filter(x=>x===2).length;finish(c,one===two?'Draw':getDisplayName(c.players[one>two?0:1]?.deviceId,'Player'));}await commit(g,c)};grid.append(q)}a.append(grid);return a}

  function claimDots(s,r,c,orientation,player){let scored=0;if(orientation==='h'){for(let br=r-1;br<=r;br++){if(br<0||br>=4)continue;const box=br*4+c;if(!s.boxes[box]&&s.h[br*4+c]&&s.h[(br+1)*4+c]&&s.v[br*4+c]&&s.v[br*4+c+1]){s.boxes[box]=player+1;scored++;}}}else{for(let bc=c-1;bc<=c;bc++){if(bc<0||bc>=4)continue;const box=r*4+bc;if(!s.boxes[box]&&s.h[r*4+bc]&&s.h[(r+1)*4+bc]&&s.v[r*4+bc]&&s.v[r*4+bc+1]){s.boxes[box]=player+1;scored++;}}}return scored}
  function dots(g){const a=box(),s=g.data.settings.extra,my=canMove(g),m=idx(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:turnText(g)+` · ${s.scores[0]}-${s.scores[1]}`));const grid=document.createElement('div');grid.className='native-grid dots';grid.style.gridTemplateColumns='repeat(9,24px)';grid.style.gridTemplateRows='repeat(9,24px)';for(let r=0;r<9;r++)for(let c=0;c<9;c++){const q=document.createElement('button');q.style.width='24px';q.style.height='24px';q.style.padding='0';if(r%2===0&&c%2===0){q.disabled=true;q.style.background='#dce1e8';q.style.borderRadius='50%';q.style.width='8px';q.style.height='8px';q.style.margin='8px';}else if(r%2===0){const id=(r/2)*4+(c-1)/2;q.className=s.h[id]?'h':'';q.disabled=!my||!!s.h[id];q.onclick=async()=>{const cpy=clone(g),e=cpy.data.settings.extra;e.h[id]=m+1;const scored=claimDots(e,r/2,(c-1)/2,'h',m);if(e.boxes.every(Boolean))finish(cpy,e.scores[0]===e.scores[1]?'Draw':getDisplayName(cpy.players[e.scores[0]>e.scores[1]?0:1]?.deviceId,'Player'));else if(scored)e.scores[m]+=scored;else cpy.turnIndex++;await commit(g,cpy)}}else if(c%2===0){const id=((r-1)/2)*4+c/2;q.className=s.v[id]?'v':'';q.disabled=!my||!!s.v[id];q.onclick=async()=>{const cpy=clone(g),e=cpy.data.settings.extra;e.v[id]=m+1;const scored=claimDots(e,(r-1)/2,c/2,'v',m);if(e.boxes.every(Boolean))finish(cpy,e.scores[0]===e.scores[1]?'Draw':getDisplayName(cpy.players[e.scores[0]>e.scores[1]?0:1]?.deviceId,'Player'));else if(scored)e.scores[m]+=scored;else cpy.turnIndex++;await commit(g,cpy)}}else{const boxIndex=((r-1)/2)*4+(c-1)/2;q.disabled=true;if(s.boxes[boxIndex])q.textContent=s.boxes[boxIndex]===1?'●':'○';}grid.append(q)}a.append(grid);return a}

  function reactionduel(g){const a=box(),s=g.data.settings.extra,m=idx(g),my=mine(g);if(s.phase==='go'&&s.goAt&&Date.now()>=s.goAt)s.phase='click';else if(s.phase==='go'&&s.goAt)setTimeout(()=>{if(typeof renderMessages==='function')renderMessages(false)},Math.max(20,s.goAt-Date.now()+20));a.append(status(g.winner?`🏆 ${g.winner} wins!`:`Round ${s.round}/${s.rounds} · ${names(g)}`));const q=document.createElement('div');q.className='native-big '+(s.phase==='click'?'click':'');q.textContent=s.phase==='click'?'GO! CLICK!':s.phase==='go'?'Get ready…':s.phase==='ready'?'Ready? Start the round.':'Waiting for opponent…';if(my&&s.phase==='ready'&&g.turnIndex%g.players.length===m){q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra;e.phase='go';e.goAt=Date.now()+1200+Math.random()*2200;await commit(g,c)}}else if(my&&s.phase==='click'){q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra;e.results=e.results||{};e.results[deviceId]=Date.now()-e.goAt;if(Object.keys(e.results).length===c.players.length){const winner=(e.results[c.players[0].deviceId]||Infinity)<(e.results[c.players[1].deviceId]||Infinity)?c.players[0]:c.players[1];e.results={};e.round++;if(e.round>e.rounds)finish(c,getDisplayName(winner.deviceId,winner.username));else{e.phase='ready';c.turnIndex=0}}await commit(g,c)}}a.append(q);return a}

  function wordduel(g){const a=box(),s=g.data.settings.extra,m=idx(g),my=mine(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:`Round ${s.round}/${s.rounds} · ${names(g)}`));const word=s.word||'APPLE',scrambled=word.split('').sort(()=>Math.random()-.5).join('');const title=document.createElement('div');title.style.cssText='font-size:30px;font-weight:900;letter-spacing:.15em';title.textContent=scrambled;a.append(title);const input=document.createElement('input');input.className='native-input';input.maxLength=word.length;input.placeholder='Your answer';const btn=document.createElement('button');btn.className='game-btn primary';btn.textContent='Submit';btn.disabled=!my;btn.onclick=async()=>{const c=clone(g),e=c.data.settings.extra,answer=input.value.trim().toUpperCase();if(answer!==word)return;e.scores[m]++;e.round++;if(e.round>e.rounds)finish(c,getDisplayName(deviceId,settings.username));else{e.word=WORDS[Math.floor(Math.random()*WORDS.length)];}await commit(g,c)};a.append(input,btn);return a}

  function checkersInitial(){const b=Array(64).fill(0);for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2)b[r*8+c]=2;for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2)b[r*8+c]=1;return b}
  function checkers(g){const a=box(),s=g.data.settings.extra,b=s.board,m=idx(g),my=canMove(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:turnText(g)));const grid=document.createElement('div');grid.className='native-grid checkers';let selected=-1;for(let i=0;i<64;i++){const q=document.createElement('button');q.className=((Math.floor(i/8)+i)%2?'dark':'light')+(b[i]===1?' p1':b[i]===2?' p2':'');q.disabled=!my;q.onclick=async()=>{if(selected<0){if(b[i]!==m+1)return;selected=i;for(const el of grid.children)el.style.outline='';q.style.outline='3px solid #ffd34d';return;}if(b[i]||Math.abs(Math.floor(i/8)-Math.floor(selected/8))!==1||Math.abs(i%8-selected%8)!==1)return;const c=clone(g),e=c.data.settings.extra;e.board[i]=e.board[selected];e.board[selected]=0;c.turnIndex++;if(!e.board.some(x=>x===((m+1)%2)+1))finish(c,getDisplayName(deviceId,settings.username));await commit(g,c)};grid.append(q)}a.append(grid);return a}

  function gomoku(g){return connectN(g,15,5,'gomoku','⚪')}
  function connect5(g){return connectN(g,9,5,'gomoku','🟣')}
  function connectN(g,n,need,cls,icon){const a=box(),s=g.data.settings.extra,b=s.board,m=idx(g),my=canMove(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:turnText(g)));const grid=document.createElement('div');grid.className='native-grid '+cls;grid.style.gridTemplateColumns=`repeat(${n},${n===15?27:38}px)`;for(let i=0;i<b.length;i++){const q=document.createElement('button');q.textContent=b[i]===1?'●':b[i]===2?'○':'';q.className=b[i]===1?'g1':b[i]===2?'g2':'';q.disabled=!my||!!b[i];q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra,v=m+1;e.board[i]=v;if(fiveN(e.board,i,v,n,need))finish(c,getDisplayName(deviceId,settings.username));else if(e.board.every(Boolean))finish(c,'Draw');else c.turnIndex++;await commit(g,c)};grid.append(q)}a.append(grid);return a}
  function fiveN(b,p,v,n,need){const r=Math.floor(p/n),c=p%n;for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){let x=1;for(const z of [-1,1]){let rr=r+dr*z,cc=c+dc*z;while(rr>=0&&rr<n&&cc>=0&&cc<n&&b[rr*n+cc]===v){x++;rr+=dr*z;cc+=dc*z}}if(x>=need)return true}return false}

  function morris(g){const a=box(),s=g.data.settings.extra,m=idx(g),my=canMove(g);a.append(status(g.winner?`🏆 ${g.winner} wins!`:turnText(g)));const grid=document.createElement('div');grid.className='native-grid morris';for(let i=0;i<24;i++){const q=document.createElement('button');q.textContent=s.board[i]?'●':'';q.className=s.board[i]===1?'m1':s.board[i]===2?'m2':'';q.disabled=!my||!!s.board[i]||s.placed[m]>=9;q.onclick=async()=>{const c=clone(g),e=c.data.settings.extra;e.board[i]=m+1;e.placed[m]++;if(e.placed.every(x=>x>=9)){e.phase='move';}c.turnIndex++;await commit(g,c)};grid.append(q)}a.append(grid);return a}

  function wordchain(g){const a=box(),s=g.data.settings.extra,m=idx(g),my=canMove(g),last=s.words[s.words.length-1]||'';a.append(status(g.winner?`🏆 ${g.winner} wins!`:last?`Last word: ${last}`:'Start the chain!'));const input=document.createElement('input');input.className='native-input';input.placeholder=last?`Word starting with ${last.slice(-1)}`:'First word';const b=document.createElement('button');b.className='game-btn primary';b.textContent='Add word';b.disabled=!my;b.onclick=async()=>{const w=input.value.trim().toUpperCase().replace(/[^A-ZÆØÅ]/g,'');if(w.length<2||last&&w[0]!==last.slice(-1)||s.used.includes(w))return;const c=clone(g),e=c.data.settings.extra;e.words.push(w);e.used.push(w);if(e.words.length>=20)finish(c,getDisplayName(deviceId,settings.username));else c.turnIndex++;await commit(g,c)};a.append(input,b,status(`Chain length: ${s.words.length}`));return a}
})();
