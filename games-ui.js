/* Game UI refresh + solo games + Windows/browser notifications */
(() => {
  'use strict';

  const SOLO_GAMES = [
    { id:'snake', icon:'🐍', name:'Snake', desc:'Eat food, grow longer and beat your high score.', players:'1 player', type:'snake' },
    { id:'minesweeper', icon:'💣', name:'Minesweeper', desc:'Clear the board without hitting a mine.', players:'1 player', type:'minesweeper' },
    { id:'game2048', icon:'🔢', name:'2048', desc:'Combine matching tiles and reach 2048.', players:'1 player', type:'2048' },
    { id:'solitaire', icon:'🃏', name:'Solitaire', desc:'Classic Klondike-style single-player card game.', players:'1 player', type:'solitaire' },
    { id:'wordle', icon:'🔤', name:'Word Guess', desc:'Find the hidden five-letter word in six tries.', players:'1 player', type:'wordle' }
  ];

  const CSS = `
  .games-refresh-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;padding:16px;border:1px solid var(--border-color,#30343b);border-radius:16px;background:linear-gradient(135deg,rgba(124,92,255,.15),rgba(35,38,45,.8));}
  .games-refresh-title{font-size:24px;font-weight:800;margin:0}.games-refresh-sub{margin:5px 0 0;color:#9da5b0;font-size:13px}
  .games-filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.games-filter{border:1px solid #343942;background:#1b1e24;color:#cfd5dd;padding:9px 13px;border-radius:10px;cursor:pointer;font-weight:700}.games-filter.active{background:#6d55ff;color:#fff;border-color:#806cff}
  .games-search{flex:1;min-width:180px;border:1px solid #343942;background:#15171c;color:#fff;border-radius:10px;padding:10px 12px;outline:none}.games-section-label{grid-column:1/-1;color:#7e8794;font-size:11px;font-weight:800;letter-spacing:.12em;padding:8px 2px 0}
  .solo-game-choice{position:relative;text-align:left;border:1px solid #30343c;background:linear-gradient(145deg,#1d2026,#15171b);color:#fff;border-radius:15px;padding:17px;cursor:pointer;min-height:145px;transition:transform .16s,border-color .16s,box-shadow .16s}.solo-game-choice:hover{transform:translateY(-2px);border-color:#7460ff;box-shadow:0 10px 30px rgba(0,0,0,.25)}
  .solo-game-icon{font-size:30px}.solo-game-name{display:block;font-size:16px;font-weight:800;margin-top:9px}.solo-game-desc{display:block;color:#969eaa;font-size:12px;line-height:1.45;margin-top:5px}.solo-game-players{display:inline-block;margin-top:12px;padding:4px 8px;border-radius:7px;background:#252932;color:#b8bec8;font-size:11px}
  .game-play-overlay{z-index:10050}.game-play-panel{width:min(760px,94vw);max-height:90vh;overflow:auto}.game-board-wrap{padding:4px}.game-status{color:#aab1bc;text-align:center;margin:8px 0 14px}.game-toolbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}.game-toolbar button{border:0;border-radius:9px;padding:9px 14px;background:#6654e8;color:#fff;cursor:pointer}.solo-canvas{display:block;margin:auto;max-width:100%;border-radius:12px;background:#11151a;border:1px solid #343a44}
  .mine-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;max-width:430px;margin:auto}.mine-cell{aspect-ratio:1;border:0;border-radius:5px;background:#343a43;color:#fff;font-weight:800;cursor:pointer}.mine-cell.revealed{background:#1d2229}.mine-cell.flag{background:#5143a4}.tile2048{width:76px;height:76px;border-radius:8px;background:#30343b;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900}.board2048{display:grid;grid-template-columns:repeat(4,76px);gap:8px;justify-content:center;background:#252930;padding:10px;border-radius:12px}.word-grid{display:grid;grid-template-columns:repeat(5,48px);gap:6px;justify-content:center}.word-cell{width:48px;height:48px;border:1px solid #454b56;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:19px}.word-input{display:block;margin:14px auto 0;text-transform:uppercase;width:240px;padding:11px;border-radius:9px;border:1px solid #444b57;background:#15181d;color:#fff;text-align:center;letter-spacing:.2em}.sol-card{border:1px solid #3a4049;border-radius:9px;padding:13px;background:#f3f3f0;color:#15171b;cursor:pointer;min-width:70px;text-align:center}.sol-hand{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px}.notif-settings{margin-top:18px;padding:14px;border:1px solid #30343c;border-radius:14px;background:#17191e}.notif-enable{border:0;border-radius:9px;padding:9px 13px;background:#6654e8;color:#fff;cursor:pointer}.windows-notification-toast{position:fixed;right:20px;bottom:20px;width:min(360px,calc(100vw - 40px));z-index:20000;padding:14px 16px;border:1px solid #3b414c;border-radius:14px;background:#181b21;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.45);animation:notifIn .2s ease}.windows-notification-toast b{display:block;margin-bottom:4px}.windows-notification-toast span{color:#b8bec8;font-size:13px}@keyframes notifIn{from{transform:translateY(15px);opacity:0}to{transform:none;opacity:1}}
  `;

  function injectStyle(){
    if(document.getElementById('games-ui-refresh-style')) return;
    const s=document.createElement('style'); s.id='games-ui-refresh-style'; s.textContent=CSS; document.head.appendChild(s);
  }

  function showToast(title, body){
    const old=document.querySelector('.windows-notification-toast'); if(old) old.remove();
    const el=document.createElement('div'); el.className='windows-notification-toast';
    el.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span>`;
    document.body.appendChild(el); setTimeout(()=>el.remove(),5000);
  }
  function escapeHtml(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]));}

  function enableNotifications(){
    if(!('Notification' in window)){showToast('Notifications unavailable','Your browser does not support Windows/browser notifications.');return;}
    if(Notification.permission==='granted'){showToast('Notifications enabled','New chat activity can now appear as Windows notifications.');return;}
    Notification.requestPermission().then(p=>{
      if(p==='granted') showToast('Notifications enabled','You will receive notifications for new chat activity.');
      else showToast('Notifications blocked','Allow notifications in your browser settings to enable them.');
    });
  }

  function notify(title,body){
    showToast(title,body);
    if('Notification' in window && Notification.permission==='granted' && document.visibilityState!=='visible'){
      try{new Notification(title,{body,tag:'chat-app2'});}catch(e){}
    }
  }

  function installNotifications(){
    let initialized=false;
    const messages=document.getElementById('messages'); if(!messages)return;
    const observer=new MutationObserver(muts=>{
      if(!initialized)return;
      for(const m of muts){
        for(const node of m.addedNodes){
          if(!(node instanceof Element))continue;
          const text=(node.innerText||node.textContent||'').trim();
          if(text && text.length<300) notify('Game Chat',text.slice(0,180));
        }
      }
    });
    observer.observe(messages,{childList:true,subtree:true});
    setTimeout(()=>initialized=true,1200);
  }

  function addNotificationControl(){
    const settings=document.getElementById('settingsOverlay'); if(!settings || settings.querySelector('.notif-settings'))return;
    const body=settings.querySelector('.panel-body'); if(!body)return;
    const box=document.createElement('div');box.className='notif-settings';
    box.innerHTML='<b>🔔 Notifications</b><p style="color:#969eaa;font-size:13px;line-height:1.45">Enable browser notifications so Chat App 2 can show Windows-style notifications when new chat activity arrives.</p><button class="notif-enable" type="button">Enable notifications</button>';
    box.querySelector('button').onclick=enableNotifications; body.appendChild(box);
  }

  function buildGamesRefresh(){
    const overlay=document.getElementById('gamesOverlay'); if(!overlay)return;
    const panel=overlay.querySelector('.panel'); const grid=overlay.querySelector('.game-grid'); if(!panel||!grid)return;
    const body=panel.querySelector('.panel-body'); if(!body)return;
    if(body.querySelector('.games-refresh-head'))return;

    const head=document.createElement('div'); head.className='games-refresh-head';
    head.innerHTML='<div><h2 class="games-refresh-title">🎮 Games</h2><p class="games-refresh-sub">Play solo or create a multiplayer lobby.</p></div>';
    const row=document.createElement('div'); row.className='games-filter-row';
    row.innerHTML='<button class="games-filter active" data-filter="all">All</button><button class="games-filter" data-filter="solo">1 Player</button><button class="games-filter" data-filter="multi">Multiplayer</button><input class="games-search" placeholder="Search games…" aria-label="Search games">';
    body.insertBefore(head,body.firstChild); body.insertBefore(row,grid);

    const soloLabel=document.createElement('div');soloLabel.className='games-section-label';soloLabel.textContent='1 PLAYER GAMES';grid.insertBefore(soloLabel,grid.firstChild);
    for(const game of SOLO_GAMES){
      const card=document.createElement('button'); card.type='button'; card.className='solo-game-choice'; card.dataset.game=game.id; card.dataset.players='solo';
      card.innerHTML=`<span class="solo-game-icon">${game.icon}</span><span class="solo-game-name">${game.name}</span><span class="solo-game-desc">${game.desc}</span><span class="solo-game-players">${game.players}</span>`;
      card.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSoloGame(game.type,game.name);},true);
      grid.insertBefore(card,soloLabel.nextSibling);
    }

    const allCards=()=>Array.from(grid.querySelectorAll('.game-choice,.solo-game-choice'));
    function apply(){
      const active=row.querySelector('.games-filter.active')?.dataset.filter||'all'; const q=(row.querySelector('.games-search').value||'').toLowerCase();
      for(const card of allCards()){
        const text=(card.innerText||'').toLowerCase(); const solo=card.classList.contains('solo-game-choice');
        const playerOK=active==='all'||(active==='solo'?solo:!solo); card.style.display=playerOK&&text.includes(q)?'':'none';
      }
    }
    row.querySelectorAll('.games-filter').forEach(btn=>btn.onclick=()=>{row.querySelectorAll('.games-filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');apply();});
    row.querySelector('.games-search').oninput=apply;
  }

  let activeSoloCleanup=null;
  function openSoloGame(type,name){
    if(activeSoloCleanup)activeSoloCleanup();
    const overlay=document.createElement('div');overlay.className='overlay game-play-overlay';overlay.style.display='flex';
    overlay.innerHTML=`<div class="panel game-play-panel"><div class="panel-header"><h2>${name}</h2><button class="icon-btn close-solo">×</button></div><div class="panel-body"><div class="game-status" id="soloStatus">Loading…</div><div class="game-board-wrap" id="soloBoard"></div><div class="game-toolbar"><button class="restart-solo">Restart</button></div></div></div>`;
    document.body.appendChild(overlay); overlay.querySelector('.close-solo').onclick=()=>overlay.remove(); overlay.querySelector('.restart-solo').onclick=()=>{overlay.remove();openSoloGame(type,name);};
    const board=overlay.querySelector('#soloBoard'),status=overlay.querySelector('#soloStatus');
    if(type==='snake')runSnake(board,status); else if(type==='minesweeper')runMines(board,status); else if(type==='2048')run2048(board,status); else if(type==='wordle')runWordle(board,status); else runSolitaire(board,status);
    activeSoloCleanup=()=>overlay.remove();
  }

  function runSnake(board,status){
    const c=document.createElement('canvas');c.width=480;c.height=360;c.className='solo-canvas';board.appendChild(c);const x=c.getContext('2d');let snake=[{x:10,y:7}],dir={x:1,y:0},food={x:15,y:7},score=0,running=true;const size=24;
    function place(){food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*15)}}
    function key(e){const k=e.key.toLowerCase();if(k==='arrowup'||k==='w')dir={x:0,y:-1};if(k==='arrowdown'||k==='s')dir={x:0,y:1};if(k==='arrowleft'||k==='a')dir={x:-1,y:0};if(k==='arrowright'||k==='d')dir={x:1,y:0};}window.addEventListener('keydown',key);
    const timer=setInterval(()=>{if(!running)return;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(h.x<0||h.y<0||h.x>=20||h.y>=15||snake.some(p=>p.x===h.x&&p.y===h.y)){running=false;status.textContent=`Game over — score ${score}. Use Restart to play again.`;return;}snake.unshift(h);if(h.x===food.x&&h.y===food.y){score++;place();}else snake.pop();status.textContent=`Score: ${score} · WASD / Arrow Keys`;x.clearRect(0,0,c.width,c.height);x.fillStyle='#6d55ff';snake.forEach(p=>x.fillRect(p.x*size,p.y*size,size-2,size-2));x.fillStyle='#e85d75';x.fillRect(food.x*size,food.y*size,size-2,size-2);},110);
    activeSoloCleanup=()=>{clearInterval(timer);window.removeEventListener('keydown',key);board.closest('.game-play-overlay')?.remove();};
  }

  function runMines(board,status){
    const n=100,mines=new Set();while(mines.size<15)mines.add(Math.floor(Math.random()*n));const cells=[];const grid=document.createElement('div');grid.className='mine-grid';board.appendChild(grid);let safe=85,ended=false;function count(i){let c=0,r=Math.floor(i/10),col=i%10;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const j=(r+dr)*10+col+dc;if(r+dr>=0&&r+dr<10&&col+dc>=0&&col+dc<10&&mines.has(j))c++;}return c;}function reveal(i){if(ended||cells[i].classList.contains('revealed'))return;cells[i].classList.add('revealed');if(mines.has(i)){cells[i].textContent='💣';ended=true;status.textContent='Boom! You hit a mine.';cells.forEach((b,j)=>{if(mines.has(j))b.textContent='💣'});return;}safe--;const c=count(i);cells[i].textContent=c||'';if(safe===0){ended=true;status.textContent='You cleared the board! 🎉';}else status.textContent=`Safe cells left: ${safe}`;}for(let i=0;i<n;i++){const b=document.createElement('button');b.className='mine-cell';b.onclick=()=>reveal(i);b.oncontextmenu=e=>{e.preventDefault();if(!b.classList.contains('revealed')){b.classList.toggle('flag');b.textContent=b.classList.contains('flag')?'🚩':'';}};cells.push(b);grid.appendChild(b);}status.textContent='Left click to reveal · Right click to flag';
  }

  function run2048(board,status){let a=Array(16).fill(0);const wrap=document.createElement('div');wrap.className='board2048';board.appendChild(wrap);function add(){const z=a.map((v,i)=>v?null:i).filter(v=>v!==null);if(z.length)a[z[Math.floor(Math.random()*z.length)]]=Math.random()<.9?2:4;}add();add();function draw(){wrap.innerHTML='';a.forEach(v=>{const d=document.createElement('div');d.className='tile2048';d.textContent=v||'';wrap.appendChild(d)});status.textContent='Use Arrow Keys / WASD · Reach 2048';}function move(dir){let changed=false;const lines=[];for(let r=0;r<4;r++){let line=[];for(let c=0;c<4;c++)line.push(a[r*4+c]);if(dir==='up'||dir==='down')line=[0,1,2,3].map(c=>a[c*4+r]);if(dir==='down'||dir==='right')line.reverse();const nz=line.filter(Boolean);for(let i=0;i<nz.length-1;i++)if(nz[i]===nz[i+1]){nz[i]*=2;nz.splice(i+1,1)}while(nz.length<4)nz.push(0);if(dir==='down'||dir==='right')nz.reverse();lines.push(nz);}for(let r=0;r<4;r++)for(let c=0;c<4;c++){let v=(dir==='up'||dir==='down')?lines[c][r]:lines[r][c];if(a[r*4+c]!==v)changed=true;a[r*4+c]=v;}if(changed)add();draw();}function key(e){const k=e.key.toLowerCase();if(['arrowup','w','arrowdown','s','arrowleft','a','arrowright','d'].includes(k)){e.preventDefault();move(k==='arrowup'||k==='w'?'up':k==='arrowdown'||k==='s'?'down':k==='arrowleft'||k==='a'?'left':'right')}}window.addEventListener('keydown',key);draw();activeSoloCleanup=()=>{window.removeEventListener('keydown',key);board.closest('.game-play-overlay')?.remove();};}

  function runWordle(board,status){const words=['apple','brick','cloud','dream','flame','grape','house','light','mouse','ocean','plant','river','stone','table','train','world'];const answer=words[Math.floor(Math.random()*words.length)];let row=0;const grid=document.createElement('div');grid.className='word-grid';board.appendChild(grid);for(let i=0;i<30;i++){const d=document.createElement('div');d.className='word-cell';grid.appendChild(d)}const input=document.createElement('input');input.className='word-input';input.maxLength=5;input.placeholder='5 letters';board.appendChild(input);const btn=document.createElement('button');btn.textContent='Guess';btn.className='game-toolbar';btn.style.margin='12px auto';btn.style.display='block';board.appendChild(btn);function guess(){const g=input.value.toLowerCase();if(!/^[a-z]{5}$/.test(g)){status.textContent='Enter exactly 5 letters.';return;}for(let i=0;i<5;i++){const d=grid.children[row*5+i];d.textContent=g[i];d.style.borderColor=g[i]===answer[i]?'#55b878':answer.includes(g[i])?'#c6a84f':'#555b65';}row++;input.value='';if(g===answer){status.textContent=`Correct! You found ${answer.toUpperCase()}.`;input.disabled=true;btn.disabled=true;}else if(row===6){status.textContent=`Out of tries. The word was ${answer.toUpperCase()}.`;input.disabled=true;btn.disabled=true;}else status.textContent=`Try ${row+1} of 6`; }btn.onclick=guess;input.onkeydown=e=>{if(e.key==='Enter')guess()};status.textContent='Find the hidden five-letter word.';}

  function runSolitaire(board,status){const wrap=document.createElement('div');wrap.innerHTML='<div class="sol-hand" id="solCards"></div><div style="text-align:center;color:#929aa5;margin-top:10px">Simplified single-player card challenge: reveal cards and build your score.</div>';board.appendChild(wrap);const hand=wrap.querySelector('#solCards');const deck=['A','2','3','4','5','6','7','8','9','10','J','Q','K'].flatMap(v=>['♠','♥','♦','♣'].map(s=>v+s));let score=0;deck.sort(()=>Math.random()-.5);function draw(){hand.innerHTML='';deck.slice(0,8).forEach((c,i)=>{const b=document.createElement('button');b.className='sol-card';b.textContent='🂠';b.onclick=()=>{b.textContent=c;score+=c[0]==='A'?5:1;status.textContent=`Score: ${score}`};hand.appendChild(b)});}draw();status.textContent='Reveal cards and build your score.';}

  function init(){injectStyle();setTimeout(()=>{buildGamesRefresh();addNotificationControl();installNotifications();},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
