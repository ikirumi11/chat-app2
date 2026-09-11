(() => {
  'use strict';

  const PREFIX='__CHAT_APP2_EXTRA_GAME__:';
  const POLL=1000;
  const GAMES={
    connect4:{name:'Connect Four',icon:'🔴',players:2,desc:'Drop four pieces in a row before your opponent.'},
    reversi:{name:'Reversi',icon:'⚫',players:2,desc:'Surround and flip your opponent’s pieces on an 8×8 board.'},
    dots:{name:'Dots & Boxes',icon:'⬛',players:2,desc:'Draw edges, complete boxes and collect the most squares.'},
    reaction:{name:'Reaction Duel',icon:'⚡',players:2,desc:'Wait for GO, then react faster than your opponent.'},
    word:{name:'Word Duel',icon:'🔤',players:2,desc:'Solve the same word challenge first. Best of five rounds.'}
  };

  let styleReady=false;
  let currentOverlay=null;
  let pollTimer=null;
  const rendered=new Set();

  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));}
  function id(){return 'eg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function meId(){return typeof deviceId!=='undefined'?deviceId:(localStorage.getItem('chat_device_id')||'unknown');}
  function meName(){return typeof settings!=='undefined'&&settings.username?settings.username:(localStorage.getItem('chat_username')||'Player');}
  function sendState(game){
    if(typeof apiPost!=='function')return Promise.reject(new Error('Chat server is unavailable.'));
    return apiPost({game_server:true,username:'__GAME_SERVER__',channel:typeof CHANNEL!=='undefined'?CHANNEL:'general',message:PREFIX+JSON.stringify(game),device_id:game.hostDeviceId});
  }
  function readStates(){
    const map=new Map();
    let list=[];
    try{list=typeof currentMessages!=='undefined'?currentMessages:[];}catch(_){list=[];}
    for(const m of list||[]){
      const raw=typeof m?.message==='string'?m.message:'';
      if(!raw.startsWith(PREFIX))continue;
      try{
        const g=JSON.parse(raw.slice(PREFIX.length));
        if(g&&g.id&&(!map.has(g.id)||Number(g.updatedAt||0)>Number(map.get(g.id).updatedAt||0)))map.set(g.id,g);
      }catch(_){ }
    }
    return [...map.values()];
  }
  function injectStyle(){
    if(styleReady)return;
    styleReady=true;
    const s=document.createElement('style');s.id='extra-multiplayer-games-style';s.textContent=`
      .extra-games-section{grid-column:1/-1;margin-top:16px;padding-top:18px;border-top:1px solid #30343c}
      .extra-games-title{font-size:12px;letter-spacing:.12em;color:#7e8794;font-weight:900;margin:0 0 10px}
      .extra-games-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
      .extra-game-card{border:1px solid #303640;background:linear-gradient(145deg,#1e2229,#14171c);color:#fff;border-radius:15px;padding:15px;text-align:left;cursor:pointer;transition:.16s;min-height:132px}
      .extra-game-card:hover{transform:translateY(-2px);border-color:#7563ff;box-shadow:0 10px 30px rgba(0,0,0,.28)}
      .extra-game-icon{font-size:28px}.extra-game-name{font-weight:900;font-size:16px;margin-top:7px}.extra-game-desc{color:#9aa2ad;font-size:12px;line-height:1.4;margin-top:5px}.extra-game-meta{display:inline-block;margin-top:10px;padding:4px 8px;border-radius:7px;background:#272c35;color:#bfc5ce;font-size:11px}
      .extra-lobbies{grid-column:1/-1;margin-top:12px}.extra-lobby{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #303640;background:#171a20;border-radius:11px;padding:10px 12px;margin-top:7px}.extra-lobby-info{min-width:0}.extra-lobby-name{font-weight:800}.extra-lobby-meta{color:#8f98a5;font-size:11px;margin-top:3px}.extra-lobby button{border:0;border-radius:8px;padding:8px 12px;background:#6654e8;color:#fff;font-weight:800;cursor:pointer}
      .extra-game-modal{position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.76);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px}.extra-game-panel{width:min(760px,95vw);max-height:92vh;overflow:auto;background:#15181e;border:1px solid #363c47;border-radius:18px;color:#fff;box-shadow:0 25px 80px rgba(0,0,0,.55)}.extra-game-head{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #303640}.extra-game-head h2{margin:0;font-size:20px}.extra-game-head button{border:0;background:#252a32;color:#fff;border-radius:9px;width:36px;height:36px;font-size:22px;cursor:pointer}.extra-game-body{padding:16px}.extra-status{text-align:center;color:#aeb6c1;min-height:22px;margin-bottom:14px}.extra-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:15px}.extra-actions button{border:0;border-radius:9px;padding:9px 13px;background:#6654e8;color:#fff;font-weight:800;cursor:pointer}.extra-actions button.secondary{background:#292f38}.extra-board{display:flex;justify-content:center;align-items:center;min-height:260px}.c4-board{display:grid;grid-template-columns:repeat(7,46px);gap:6px;background:#254b9b;padding:10px;border-radius:14px}.c4-cell{width:46px;height:46px;border:0;border-radius:50%;background:#10141a;cursor:pointer}.c4-cell.red{background:#ef5265}.c4-cell.yellow{background:#ffd34d}.reversi-board{display:grid;grid-template-columns:repeat(8,42px);gap:2px;background:#155d3a;padding:5px;border-radius:10px}.rev-cell{width:42px;height:42px;border:0;background:#1c8050;cursor:pointer;display:flex;align-items:center;justify-content:center}.rev-piece{width:30px;height:30px;border-radius:50%;box-shadow:inset 0 2px 4px rgba(255,255,255,.25),0 2px 4px rgba(0,0,0,.3)}.rev-piece.black{background:#111}.rev-piece.white{background:#eee}.dots-board{display:grid;grid-template-columns:repeat(5,42px);grid-template-rows:repeat(5,42px);position:relative;width:210px;height:210px;background:#1a1e25}.dot{width:8px;height:8px;border-radius:50%;background:#dce1e8;position:absolute;transform:translate(-4px,-4px);z-index:2}.dot-edge{position:absolute;background:#6654e8;cursor:pointer;border-radius:4px;z-index:1}.dot-box{position:absolute;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#fff}.reaction-box{width:min(520px,90vw);height:260px;border-radius:18px;background:#252a32;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;cursor:pointer;user-select:none}.word-card{text-align:center;width:min(520px,90vw)}.word-round{font-size:12px;color:#858e9a;margin-bottom:12px}.word-scramble{font-size:34px;font-weight:1000;letter-spacing:.12em;margin:14px 0}.word-input-extra{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #414854;background:#0f1216;color:#fff;font-size:18px;text-align:center;text-transform:uppercase;outline:none}.word-submit{margin-top:9px;border:0;border-radius:10px;padding:10px 16px;background:#6654e8;color:#fff;font-weight:900;cursor:pointer}
      @media(max-width:560px){.c4-board{grid-template-columns:repeat(7,38px);gap:4px;padding:7px}.c4-cell{width:38px;height:38px}.reversi-board{grid-template-columns:repeat(8,34px)}.rev-cell{width:34px;height:34px}.rev-piece{width:25px;height:25px}}
    `;document.head.appendChild(s);
  }

  function makeGame(type){
    const g={id:id(),type,hostDeviceId:meId(),hostName:meName(),players:[{id:meId(),name:meName(),slot:0}],maxPlayers:GAMES[type].players,phase:'lobby',turn:0,version:1,updatedAt:Date.now()};
    if(type==='connect4')g.state={board:Array(42).fill(0)};
    if(type==='reversi')g.state={board:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],turn:1};
    if(type==='dots')g.state={h:Array(20).fill(0),v:Array(20).fill(0),boxes:Array(16).fill(0),scores:[0,0],turn:0};
    if(type==='reaction')g.state={round:1,rounds:5,phase:'waiting',winner:null,goAt:0,results:{}};
    if(type==='word')g.state={round:1,rounds:5,word:null,scramble:null,answers:{},scores:[0,0],phase:'playing'};
    return g;
  }

  async function publish(g){g.version=(g.version||0)+1;g.updatedAt=Date.now();try{await sendState(g);}catch(e){if(currentOverlay)currentOverlay.status.textContent='⚠ '+e.message;}}
  function openGame(g){
    if(currentOverlay)currentOverlay.close();
    injectStyle();
    const modal=document.createElement('div');modal.className='extra-game-modal';
    modal.innerHTML=`<div class="extra-game-panel"><div class="extra-game-head"><h2>${esc(GAMES[g.type].icon+' '+GAMES[g.type].name)}</h2><button class="extra-close">×</button></div><div class="extra-game-body"><div class="extra-status"></div><div class="extra-board"></div><div class="extra-actions"></div></div></div>`;
    document.body.appendChild(modal);
    const api={modal,status:modal.querySelector('.extra-status'),board:modal.querySelector('.extra-board'),actions:modal.querySelector('.extra-actions'),close:()=>{modal.remove();if(currentOverlay===api)currentOverlay=null;}};
    modal.querySelector('.extra-close').onclick=api.close;
    currentOverlay=api;
    renderGame(g,api);
  }

  function playerIndex(g){return (g.players||[]).findIndex(p=>p.id===meId());}
  function canJoin(g){return g.phase==='lobby'&&g.players.length<g.maxPlayers&&!g.players.some(p=>p.id===meId());}
  async function join(g){
    if(!canJoin(g))return;
    g.players.push({id:meId(),name:meName(),slot:g.players.length});
    if(g.players.length>=g.maxPlayers){g.phase='playing';if(g.type==='reaction')g.state.phase='waiting';if(g.type==='word'){g.state.word=randomWord();g.state.scramble=shuffle(g.state.word);}}
    await publish(g);openGame(g);
  }
  function startIfReady(g){
    if(g.players.length<g.maxPlayers){return false;}
    if(g.phase==='lobby')g.phase='playing';
    return true;
  }
  function winnerText(g){
    if(!g.winner)return '';
    const p=g.players.find(x=>x.slot===g.winner);
    return p?`${p.name} wins! 🎉`:'';
  }

  function renderGame(g,api){
    if(!api||!document.body.contains(api.modal))return;
    if(g.phase==='lobby'){
      api.status.textContent=`Waiting for players… ${g.players.length}/${g.maxPlayers}`;
      api.board.innerHTML=`<div style="text-align:center;color:#aeb6c1"><div style="font-size:44px">${esc(GAMES[g.type].icon)}</div><div style="margin-top:10px">${g.players.map(p=>esc(p.name)).join(' · ')}</div><div style="font-size:12px;margin-top:8px">Share this chat with your opponent and they can press Join.</div></div>`;
      api.actions.innerHTML='';return;
    }
    if(g.type==='connect4')renderConnect4(g,api);
    else if(g.type==='reversi')renderReversi(g,api);
    else if(g.type==='dots')renderDots(g,api);
    else if(g.type==='reaction')renderReaction(g,api);
    else renderWord(g,api);
  }

  function renderConnect4(g,api){
    const b=g.state.board, mine=playerIndex(g), active=g.turn===mine&&!g.winner;
    api.status.textContent=g.winner?winnerText(g):`Turn: ${esc(g.players[g.turn]?.name||'Player')} ${active?'— your move':''}`;
    const board=document.createElement('div');board.className='c4-board';
    for(let i=0;i<42;i++){const c=document.createElement('button');c.className='c4-cell '+(b[i]===1?'red':b[i]===2?'yellow':'');c.disabled=!active;c.onclick=async()=>{const col=i%7;const row=dropRow(b,col);if(row<0)return;b[row*7+col]=mine===0?1:2;if(checkC4(b,mine===0?1:2)){g.winner=mine;g.phase='ended';}else if(b.every(Boolean)){g.phase='ended';g.winner=-1;}else g.turn=1-g.turn;await publish(g);};board.appendChild(c);}
    api.board.innerHTML='';api.board.appendChild(board);api.actions.innerHTML=`<button class="secondary">Players: ${g.players.map(p=>esc(p.name)).join(' vs ')}</button>`;
  }
  function dropRow(b,col){for(let r=5;r>=0;r--)if(!b[r*7+col])return r;return -1;}
  function checkC4(b,v){for(let r=0;r<6;r++)for(let c=0;c<7;c++){if(c<4&&[0,1,2,3].every(k=>b[r*7+c+k]===v))return true;if(r<3&&[0,1,2,3].every(k=>b[(r+k)*7+c]===v))return true;if(r<3&&c<4&&[0,1,2,3].every(k=>b[(r+k)*7+c+k]===v))return true;if(r<3&&c>=3&&[0,1,2,3].every(k=>b[(r+k)*7+c-k]===v))return true;}return false;}

  function revMoves(b,idx,v){const out=[];const r=Math.floor(idx/8),c=idx%8;const enemy=v===1?2:1;for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){let rr=r+dr,cc=c+dc,line=[];while(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===enemy){line.push(rr*8+cc);rr+=dr;cc+=dc;}if(line.length&&rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===v)out.push(...line);}return out;}
  function renderReversi(g,api){
    const b=g.state.board,mine=playerIndex(g),v=mine+1,active=g.turn===v&&!g.winner;
    const legal=[];for(let i=0;i<64;i++)if(!b[i]&&revMoves(b,i,v).length)legal.push(i);
    api.status.textContent=g.winner?winnerText(g):`Turn: ${esc(g.players[(g.turn-1)]?.name||'Player')}${active?' — your move':''}`;
    const board=document.createElement('div');board.className='reversi-board';
    for(let i=0;i<64;i++){const c=document.createElement('button');c.className='rev-cell';if(b[i]){const p=document.createElement('span');p.className='rev-piece '+(b[i]===1?'black':'white');c.appendChild(p);}else if(active&&legal.includes(i))c.style.boxShadow='inset 0 0 0 3px rgba(255,255,255,.25)';c.disabled=!active||(!b[i]&&legal.indexOf(i)<0);c.onclick=async()=>{const flips=revMoves(b,i,v);if(!flips.length)return;b[i]=v;flips.forEach(x=>b[x]=v);const next=v===1?2:1;const nextMoves=[];for(let j=0;j<64;j++)if(!b[j]&&revMoves(b,j,next).length)nextMoves.push(j);if(!nextMoves.length){const mineMoves=[];for(let j=0;j<64;j++)if(!b[j]&&revMoves(b,j,v).length)mineMoves.push(j);if(!mineMoves.length){const a=b.filter(x=>x===1).length,d=b.filter(x=>x===2).length;g.winner=a===d?-1:(a>d?0:1);g.phase='ended';}else g.turn=v;}else g.turn=next;await publish(g);};board.appendChild(c);}
    api.board.innerHTML='';api.board.appendChild(board);api.actions.innerHTML=`<button class="secondary">Black: ${esc(g.players[0]?.name||'')} · White: ${esc(g.players[1]?.name||'')}</button>`;
  }

  function renderDots(g,api){
    const s=g.state,mine=playerIndex(g),board=document.createElement('div');board.className='dots-board';
    for(let r=0;r<5;r++)for(let c=0;c<5;c++){const d=document.createElement('span');d.className='dot';d.style.left=(c*42)+'px';d.style.top=(r*42)+'px';board.appendChild(d);}
    const addEdge=(horizontal,index,x,y,w)=>{const e=document.createElement('button');e.className='dot-edge';e.style.left=x+'px';e.style.top=y+'px';e.style.width=(horizontal?w:7)+'px';e.style.height=(horizontal?7:w)+'px';e.disabled=s.turn!==mine||!!(horizontal?s.h[index]:s.v[index]);if(horizontal?s.h[index]:s.v[index])e.style.background=s.turn===0?'#ff5b69':'#ffd34d';e.onclick=async()=>{if(horizontal)s.h[index]=mine+1;else s.v[index]=mine+1;let gained=0;if(horizontal){const r=Math.floor(index/4),c=index%4;if(s.v[r*5+c]&&s.v[r*5+c+1]&&s.h[r*4+c]&&s.h[(r+1)*4+c]){s.boxes[r*4+c]=mine+1;gained++;}}else{const r=Math.floor(index/5),c=index%5;if(c<4&&r<4&&s.h[r*4+c]&&s.h[(r+1)*4+c]&&s.v[r*5+c]&&s.v[r*5+c+1]){s.boxes[r*4+c]=mine+1;gained++;}if(c>0&&r<4&&s.h[r*4+c-1]&&s.h[(r+1)*4+c-1]&&s.v[r*5+c-1]&&s.v[r*5+c]){s.boxes[r*4+c-1]=mine+1;gained++;}}if(gained)s.scores[mine]+=gained;else s.turn=1-s.turn;if(s.boxes.every(Boolean)){g.phase='ended';g.winner=s.scores[0]===s.scores[1]?-1:(s.scores[0]>s.scores[1]?0:1);}await publish(g);};board.appendChild(e);};
    for(let r=0;r<5;r++)for(let c=0;c<4;c++)addEdge(true,r*4+c,c*42+4,r*42+4,34);
    for(let r=0;r<4;r++)for(let c=0;c<5;c++)addEdge(false,r*5+c,c*42+4,r*42+4,34);
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){const box=document.createElement('span');box.className='dot-box';box.style.left=(c*42+8)+'px';box.style.top=(r*42+8)+'px';box.style.width='26px';box.style.height='26px';box.textContent=s.boxes[r*4+c]===1?'P1':s.boxes[r*4+c]===2?'P2':'';board.appendChild(box);}
    api.status.textContent=g.phase==='ended'?`Final score ${s.scores[0]} - ${s.scores[1]} · ${g.winner<0?'Draw':g.players[g.winner].name+' wins!'}`:`${g.players[0].name}: ${s.scores[0]} · ${g.players[1].name}: ${s.scores[1]} · Turn: ${g.players[s.turn].name}`;
    api.board.innerHTML='';api.board.appendChild(board);
  }

  function renderReaction(g,api){
    const s=g.state,mine=playerIndex(g),box=document.createElement('div');box.className='reaction-box';
    if(g.phase==='ended'){api.status.textContent=`${g.players[0].name}: ${s.results[0]||0} ms · ${g.players[1].name}: ${s.results[1]||0} ms`;box.textContent='Match complete';api.board.innerHTML='';api.board.appendChild(box);return;}
    if(s.phase==='waiting'){api.status.textContent=`Round ${s.round}/${s.rounds} — wait for GO`;box.textContent='WAIT…';setTimeout(async()=>{const latest=readStates().find(x=>x.id===g.id);if(!latest||latest.state.phase!=='waiting'||latest.hostDeviceId!==meId())return;latest.state.phase='go';latest.state.goAt=Date.now();await publish(latest);},1500+Math.random()*2500);}
    else if(s.phase==='go'){api.status.textContent=`Round ${s.round}/${s.rounds} — GO!`;box.textContent='GO!';box.style.background='#1f9d55';box.onclick=async()=>{if(s.results[mine])return;s.results[mine]=Date.now()-s.goAt;if(Object.keys(s.results).length>=2){if(s.round>=s.rounds){const a=g.scores||[0,0];if(s.results[0]<s.results[1])a[0]++;else if(s.results[1]<s.results[0])a[1]++;g.scores=a;g.phase='ended';g.winner=a[0]===a[1]?-1:(a[0]>a[1]?0:1);}else{if(!g.scores)g.scores=[0,0];if(s.results[0]<s.results[1])g.scores[0]++;else g.scores[1]++;s.round++;s.results={};s.phase='waiting';s.goAt=0;}}await publish(g);};}
    api.board.innerHTML='';api.board.appendChild(box);
  }

  const WORDS=['planet','castle','rocket','banana','forest','dragon','winter','camera','pencil','orange','silver','guitar','thunder','island','coffee','window','purple','summer','button','jungle'];
  function randomWord(){return WORDS[Math.floor(Math.random()*WORDS.length)];}
  function shuffle(w){return w.split('').sort(()=>Math.random()-.5).join('').toUpperCase();}
  function renderWord(g,api){
    const s=g.state,mine=playerIndex(g);if(!s.word){s.word=randomWord();s.scramble=shuffle(s.word);publish(g);}
    api.status.textContent=`Round ${s.round}/${s.rounds} · ${g.players[0].name}: ${s.scores[0]} · ${g.players[1].name}: ${s.scores[1]}`;
    const wrap=document.createElement('div');wrap.className='word-card';wrap.innerHTML=`<div class="word-round">Unscramble this word</div><div class="word-scramble">${esc(s.scramble)}</div><input class="word-input-extra" maxlength="20" autocomplete="off" placeholder="Type your answer"><button class="word-submit">Submit</button>`;const input=wrap.querySelector('input'),btn=wrap.querySelector('button');btn.onclick=async()=>{if(s.answers[mine])return;s.answers[mine]=input.value.trim().toLowerCase();if(Object.keys(s.answers).length>=2){const a=s.answers[0]===s.word?0:s.answers[1]===s.word?1:-1;if(a>=0)s.scores[a]++;if(s.round>=s.rounds){g.phase='ended';g.winner=s.scores[0]===s.scores[1]?-1:(s.scores[0]>s.scores[1]?0:1);}else{s.round++;s.word=randomWord();s.scramble=shuffle(s.word);s.answers={};}}await publish(g);};input.onkeydown=e=>{if(e.key==='Enter')btn.click();};api.board.innerHTML='';api.board.appendChild(wrap);if(g.phase==='ended')api.status.textContent=`${winnerText(g)} Final score: ${s.scores[0]} - ${s.scores[1]}`;
  }

  function installCards(){
    const overlay=document.getElementById('gamesOverlay');if(!overlay)return false;const grid=overlay.querySelector('.game-grid');if(!grid)return false;injectStyle();if(grid.querySelector('.extra-games-section'))return true;
    const section=document.createElement('div');section.className='extra-games-section';section.innerHTML=`<div class="extra-games-title">MORE MULTIPLAYER</div><div class="extra-games-grid"></div><div class="extra-lobbies"></div>`;grid.appendChild(section);
    const cards=section.querySelector('.extra-games-grid');for(const [type,info] of Object.entries(GAMES)){const b=document.createElement('button');b.className='extra-game-card';b.innerHTML=`<div class="extra-game-icon">${info.icon}</div><div class="extra-game-name">${info.name}</div><div class="extra-game-desc">${info.desc}</div><span class="extra-game-meta">2 players · online</span>`;b.onclick=async()=>{const g=makeGame(type);openGame(g);await publish(g);};cards.appendChild(b);}
    return true;
  }

  function refreshLobbies(){
    const section=document.querySelector('.extra-games-section');if(!section)return;const list=section.querySelector('.extra-lobbies');if(!list)return;const games=readStates().filter(g=>GAMES[g.type]&&g.phase==='lobby'&&g.updatedAt>Date.now()-15*60*1000&&canJoin(g));
    list.innerHTML='';if(!games.length)return;const title=document.createElement('div');title.style.cssText='color:#7e8794;font-size:11px;font-weight:900;letter-spacing:.12em;margin-top:12px';title.textContent='OPEN LOBBIES';list.appendChild(title);
    for(const g of games){const row=document.createElement('div');row.className='extra-lobby';row.innerHTML=`<div class="extra-lobby-info"><div class="extra-lobby-name">${esc(GAMES[g.type].icon+' '+GAMES[g.type].name)}</div><div class="extra-lobby-meta">Host: ${esc(g.hostName)} · ${g.players.length}/${g.maxPlayers}</div></div><button>Join</button>`;row.querySelector('button').onclick=()=>join(g);list.appendChild(row);}
  }

  function tick(){installCards();refreshLobbies();if(currentOverlay){const idv=currentOverlay.modal?.dataset?.gameId;if(idv){const g=readStates().find(x=>x.id===idv);if(g)renderGame(g,currentOverlay);}}}

  window.addEventListener('load',()=>{
    installCards();
    setTimeout(installCards,500);
    pollTimer=setInterval(tick,POLL);
  });

  const originalOpen=openGame;
})();
