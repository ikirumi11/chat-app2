/* 25 additional multiplayer games for Chat App 2. */
(function(){
  'use strict';
  const games = [
    ['connect4x','Connect 4','🔴','Drop pieces and connect four first.','connect',2,6],
    ['colorclash','Color Clash','🎨','Pick the correct color before everyone else.','choice',2,6],
    ['taprush','Tap Rush','👆','Be the first player to reach 15 taps.','tap',2,6],
    ['tapmania','Tap Mania','🔥','First to 30 taps wins.','tap',2,6],
    ['higherlower','Higher or Lower','⬆️','Guess whether the next number is higher or lower.','higher',2,6],
    ['numberdash','Number Dash','🔢','Find the hidden number before anyone else.','number',2,6],
    ['diceroyale','Dice Royale','🎲','Roll once; the highest roll wins.','dice',2,6],
    ['rpsroyale','RPS Royale','✊','Rock, paper, scissors for everyone.','rps',2,6],
    ['truefalse','True or False','✅','Answer quick true/false questions.','choice',2,6],
    ['capitals','Capital Clash','🏛️','Choose the correct capital.','choice',2,6],
    ['geography','Geo Quiz','🌍','Answer fast geography questions.','choice',2,6],
    ['science','Science Sprint','🔬','Answer science questions for points.','choice',2,6],
    ['history','History Sprint','📜','Answer history questions for points.','choice',2,6],
    ['emojiquiz','Emoji Quiz','😀','Pick what the emoji clue represents.','choice',2,6],
    ['oddone','Odd One Out','🧐','Find the item that does not belong.','choice',2,6],
    ['anagram','Anagram Race','🔤','Solve the scrambled word first.','word',2,6],
    ['wordchain','Word Chain','🔗','Keep the word chain going.','word',2,6],
    ['memoryrush','Memory Rush','🧠','Remember the sequence and repeat it.','sequence',2,6],
    ['pattern','Pattern Master','🟦','Watch the pattern, then reproduce it.','sequence',2,6],
    ['countdown','Countdown','⏱️','Solve the number target before time runs out.','number',2,6],
    ['quickmath','Quick Math','➕','Solve the math question first.','math',2,6],
    ['mathblitz','Math Blitz','⚡','Race through quick math challenges.','math',2,6],
    ['treasure','Treasure Hunt','💎','Pick a tile and find the hidden treasure.','choice',2,6],
    ['safetile','Safe Tile','🟩','Choose a safe tile; avoid the losing tile.','choice',2,6],
    ['laststanding','Last Standing','🏆','Score points each round and finish on top.','choice',2,6]
  ];

  const defs={};
  games.forEach(([id,name,icon,desc,mode,min,max])=>{
    defs[id]={name,icon,desc,min,max,size:null};
    if(typeof GAME_TYPES!=='undefined') GAME_TYPES[id]=defs[id];
  });

  const QUESTIONS={
    colorclash:[['Which color is made by mixing blue and yellow?',['Green','Purple','Orange','Pink'],0]],
    truefalse:[['The Earth orbits the Sun.',['True','False'],0]],
    capitals:[['What is the capital of France?',['Paris','Rome','Madrid','Berlin'],0]],
    geography:[['Which is the largest ocean?',['Pacific','Atlantic','Indian','Arctic'],0]],
    science:[['How many legs does an insect have?',['4','6','8','10'],1]],
    history:[['The pyramids of Giza are in which country?',['Egypt','Greece','Mexico','Italy'],0]],
    emojiquiz:[['Which animal is represented by 🐼?',['Panda','Tiger','Koala','Bear'],0]],
    oddone:[['Which one is different?',['Apple','Banana','Carrot','Orange'],2]],
    treasure:[['Pick a treasure chest.',['🧰 A','🧰 B','🧰 C','🧰 D'],Math.floor(Math.random()*4)]],
    safetile:[['Pick a tile.',['🟩 1','🟩 2','🟩 3','🟩 4'],Math.floor(Math.random()*4)]],
    laststanding:[['Choose your move.',['1','2','3','4'],Math.floor(Math.random()*4)]]
  };

  function clone(x){return JSON.parse(JSON.stringify(x));}
  function players(game){return game.players||[];}
  function nameOf(game,id){const p=players(game).find(x=>x.deviceId===id);return p?p.username:id;}
  async function save(game){if(typeof writeGameState==='function')await writeGameState(game);}
  function ensure(game){
    if(!game.data)game.data={};
    if(!game.data.extra)game.data.extra={scores:{},submissions:{},round:1};
    const e=game.data.extra;
    players(game).forEach(p=>{if(typeof e.scores[p.deviceId]!=='number')e.scores[p.deviceId]=0;});
    return e;
  }
  function button(text){const b=document.createElement('button');b.className='game-btn primary';b.textContent=text;return b;}
  function base(game){const root=document.createElement('div');root.className='extra-game-board';root.style.cssText='margin-top:14px;padding:14px;border:1px solid var(--border,#303640);border-radius:12px;background:var(--panel2,#181c22)';return root;}
  function renderScores(root,game,e){
    const s=document.createElement('div');s.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    players(game).forEach(p=>{const x=document.createElement('span');x.className='game-pill';x.textContent=`${nameOf(game,p.deviceId)}: ${e.scores[p.deviceId]||0}`;s.appendChild(x);});root.appendChild(s);
  }
  async function submit(game,fn){const g=clone(game);const e=ensure(g);fn(g,e);await save(g);if(typeof loadMessages==='function')await loadMessages();}

  function createExtraBoard(game){
    const root=base(game),e=ensure(game);
    const title=document.createElement('div');title.style.fontWeight='800';title.textContent=defs[game.gameType].icon+' '+defs[game.gameType].name;root.appendChild(title);
    const info=document.createElement('div');info.className='game-description';info.style.margin='8px 0';info.textContent=defs[game.gameType].desc;root.appendChild(info);
    if(game.status!=='playing'){renderScores(root,game,e);return root;}
    const mode=defs[game.gameType].mode||'choice';
    if(mode==='tap')renderTap(root,game,e);
    else if(mode==='dice')renderDice(root,game,e);
    else if(mode==='rps')renderRPS(root,game,e);
    else if(mode==='number'||mode==='higher')renderNumber(root,game,e);
    else if(mode==='math')renderMath(root,game,e);
    else if(mode==='sequence')renderSequence(root,game,e);
    else if(mode==='word')renderWord(root,game,e);
    else renderChoice(root,game,e);
    renderScores(root,game,e);
    return root;
  }

  function renderTap(root,game,e){
    const mine=typeof deviceId!=='undefined'?deviceId:'';const score=e.scores[mine]||0;
    const p=document.createElement('div');p.textContent=`Your taps: ${score} / ${game.gameType==='tapmania'?30:15}`;root.appendChild(p);
    const b=button('👆 TAP');b.onclick=()=>submit(game,(g,x)=>{const id=mine;x.scores[id]=(x.scores[id]||0)+1;if(x.scores[id]>=(g.gameType==='tapmania'?30:15)){g.winner=id;g.status='finished';}});root.appendChild(b);
  }
  function renderDice(root,game,e){
    const mine=deviceId;const b=button('🎲 Roll');if(e.submissions[mine]!=null)b.disabled=true;b.onclick=()=>submit(game,(g,x)=>{x.submissions[mine]=1+Math.floor(Math.random()*6);const vals=Object.values(x.submissions);if(vals.length>=players(g).length){let best=Math.max(...vals),wins=Object.keys(x.submissions).filter(k=>x.submissions[k]===best);g.winner=wins[0];g.status='finished';}});root.appendChild(b);if(e.submissions[mine]!=null){const t=document.createElement('div');t.textContent=`You rolled ${e.submissions[mine]}.`;root.appendChild(t);}}
  function renderRPS(root,game,e){
    const mine=deviceId;['✊ Rock','✋ Paper','✌️ Scissors'].forEach((label,i)=>{const b=button(label);b.disabled=e.submissions[mine]!=null;b.onclick=()=>submit(game,(g,x)=>{x.submissions[mine]=i;if(Object.keys(x.submissions).length>=players(g).length){const vals=Object.values(x.submissions);const present=[0,1,2].filter(v=>vals.includes(v));let winners=players(g).filter(p=>{const v=x.submissions[p.deviceId];return present.length===1||!present.length||present.every(q=>q===v||((v+2)%3===q));});if(winners.length){g.winner=winners[0].deviceId;g.status='finished';}}});root.appendChild(b);});
  }
  function renderNumber(root,game,e){
    const mine=deviceId;
    if(game.gameType==='higherlower'){
      const b1=button('⬆️ Higher'),b2=button('⬇️ Lower');[b1,b2].forEach((b,i)=>{b.onclick=()=>submit(game,(g,x)=>{if(x.current==null)x.current=50+Math.floor(Math.random()*51);x.submissions[mine]=i;if(Object.keys(x.submissions).length>=players(g).length){g.winner=mine;g.status='finished';}});root.appendChild(b);});
      return;
    }
    if(e.target==null)e.target=1+Math.floor(Math.random()*99);
    const input=document.createElement('input');input.type='number';input.min=1;input.max=100;input.placeholder='1-100';input.style.cssText='padding:9px;border-radius:8px;background:var(--panel);color:#fff;border:1px solid var(--border);margin-right:8px';root.appendChild(input);const b=button('Guess');b.onclick=()=>submit(game,(g,x)=>{const n=Math.max(1,Math.min(100,Number(input.value)||1));x.submissions[mine]=n;if(n===x.target){g.winner=mine;g.status='finished';}else if(Object.keys(x.submissions).length>=players(g).length){g.winner=Object.keys(x.submissions).sort((a,b)=>Math.abs(x.submissions[a]-x.target)-Math.abs(x.submissions[b]-x.target))[0];g.status='finished';}});root.appendChild(b);
  }
  function renderMath(root,game,e){
    if(e.mathAnswer==null){const a=2+Math.floor(Math.random()*18),b=2+Math.floor(Math.random()*18);e.mathAnswer=a+b;e.mathQuestion=`${a} + ${b} = ?`;}const q=document.createElement('div');q.textContent=e.mathQuestion;root.appendChild(q);const input=document.createElement('input');input.type='number';input.style.cssText='padding:9px;border-radius:8px;background:var(--panel);color:#fff;border:1px solid var(--border);margin:8px';root.appendChild(input);const b=button('Answer');b.onclick=()=>submit(game,(g,x)=>{if(Number(input.value)===x.mathAnswer){x.scores[deviceId]=(x.scores[deviceId]||0)+1;g.winner=deviceId;g.status='finished';}else{x.submissions[deviceId]=1;if(Object.keys(x.submissions).length>=players(g).length){g.status='finished';g.winner=players(g).sort((p1,p2)=>(x.scores[p2.deviceId]||0)-(x.scores[p1.deviceId]||0))[0]?.deviceId;}}});root.appendChild(b);}
  function renderSequence(root,game,e){
    if(!e.sequence)e.sequence=Array.from({length:4},()=>1+Math.floor(Math.random()*4));const q=document.createElement('div');q.textContent=`Sequence: ${e.sequence.join(' · ')}`;root.appendChild(q);const input=document.createElement('input');input.placeholder='Repeat the sequence';input.style.cssText='padding:9px;border-radius:8px;background:var(--panel);color:#fff;border:1px solid var(--border);margin:8px';root.appendChild(input);const b=button('Submit');b.onclick=()=>submit(game,(g,x)=>{const ok=input.value.trim()===x.sequence.join('');if(ok){x.scores[deviceId]=(x.scores[deviceId]||0)+1;g.winner=deviceId;g.status='finished';}else{x.submissions[deviceId]=1;if(Object.keys(x.submissions).length>=players(g).length){g.status='finished';g.winner=players(g).sort((a,b)=>(x.scores[b.deviceId]||0)-(x.scores[a.deviceId]||0))[0]?.deviceId;}}});root.appendChild(b);
  }
  function renderWord(root,game,e){
    const words=['planet','castle','rocket','forest','orange','window','school','purple'];if(!e.word)e.word=words[Math.floor(Math.random()*words.length)];const q=document.createElement('div');q.textContent=`Solve the word: ${e.word.split('').sort(()=>Math.random()-.5).join('')}`;root.appendChild(q);const input=document.createElement('input');input.placeholder='Your answer';input.style.cssText='padding:9px;border-radius:8px;background:var(--panel);color:#fff;border:1px solid var(--border);margin:8px';root.appendChild(input);const b=button('Submit');b.onclick=()=>submit(game,(g,x)=>{if(input.value.trim().toLowerCase()===x.word){g.winner=deviceId;g.status='finished';}else{x.submissions[deviceId]=1;if(Object.keys(x.submissions).length>=players(g).length){g.status='finished';g.winner=null;}}});root.appendChild(b);
  }
  function renderChoice(root,game,e){
    const data=(QUESTIONS[game.gameType]||[['Choose an option',['A','B','C','D'],0]])[0];if(!e.choiceAnswer)e.choiceAnswer=data[2];const q=document.createElement('div');q.textContent=data[0];root.appendChild(q);data[1].forEach((txt,i)=>{const b=button(txt);b.disabled=e.submissions[deviceId]!=null;b.onclick=()=>submit(game,(g,x)=>{x.submissions[deviceId]=i;if(i===x.choiceAnswer)x.scores[deviceId]=(x.scores[deviceId]||0)+1;if(Object.keys(x.submissions).length>=players(g).length){const best=Math.max(...Object.values(x.scores));g.winner=Object.keys(x.scores).find(k=>x.scores[k]===best)||null;g.status='finished';}});root.appendChild(b);});
  }

  function addCards(){
    const grid=document.querySelector('.game-grid');if(!grid)return;
    if(grid.querySelector('[data-extra-games]'))return;
    const label=document.createElement('div');label.className='games-section-label';label.dataset.extraGames='label';label.textContent='25 MORE MULTIPLAYER GAMES';grid.appendChild(label);
    games.forEach(([id,name,icon,desc,mode,min,max])=>{const b=document.createElement('button');b.type='button';b.className='game-choice';b.dataset.game=id;b.dataset.players='multi';b.innerHTML=`<strong>${icon} ${name}</strong><span>${desc}</span><div class="game-players">${min}-${max} players</div>`;b.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();if(typeof createGame==='function')createGame(id);};grid.appendChild(b);});
  }
  function patchBoard(){
    if(typeof window.createGameBoard!=='function')return;
    const original=window.createGameBoard;if(original.__extraPatched)return;
    const wrapped=function(game){if(defs[game.gameType])return createExtraBoard(game);return original(game)};wrapped.__extraPatched=true;window.createGameBoard=wrapped;
  }
  function boot(){Object.keys(defs).forEach(k=>{if(typeof GAME_TYPES!=='undefined')GAME_TYPES[k]=defs[k]});patchBoard();addCards();setTimeout(()=>{patchBoard();addCards()},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
