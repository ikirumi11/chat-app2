/* Visual/gameplay polish shared by every game card and game window. */
(() => {
  'use strict';
  const style = document.createElement('style');
  style.id = 'game-enhancements-style';
  style.textContent = `
    .game-choice,.solo-game-choice{position:relative;overflow:hidden}
    .game-choice::after,.solo-game-choice::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 20%,rgba(255,255,255,.06) 45%,transparent 70%);transform:translateX(-120%);transition:transform .45s;pointer-events:none}
    .game-choice:hover::after,.solo-game-choice:hover::after{transform:translateX(120%)}
    .game-choice,.solo-game-choice{box-shadow:0 8px 22px rgba(0,0,0,.18)}
    .game-choice:hover,.solo-game-choice:hover{box-shadow:0 14px 36px rgba(0,0,0,.32)}
    .game-extra-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 2px}
    .game-extra-bar button{border:1px solid #3a4050;border-radius:9px;padding:8px 12px;background:#1e2229;color:#e9edf3;cursor:pointer;font-weight:700}
    .game-extra-bar button:hover{background:#292e38}
    .game-tip{padding:9px 12px;margin:8px auto 0;max-width:600px;border:1px solid #303641;border-radius:10px;background:#171a20;color:#969fac;font-size:12px;text-align:center}
    .game-stat-pill{display:inline-block;padding:5px 9px;border-radius:8px;background:#252a33;color:#c5ccd6;font-size:11px;font-weight:800}
    .game-win-flash{animation:gameWinFlash .45s ease}
    @keyframes gameWinFlash{0%{transform:scale(.98);filter:brightness(1)}50%{transform:scale(1.015);filter:brightness(1.35)}100%{transform:scale(1)}}
  `;
  document.head.appendChild(style);

  const rules = {
    snake:'Use WASD or the arrow keys. Eat food, grow, and avoid the walls and yourself.',
    minesweeper:'Left-click to reveal. Right-click to flag a suspected mine. Clear every safe cell.',
    '2048':'Use WASD or the arrow keys to slide tiles. Matching numbers merge. Reach 2048.',
    wordle:'Enter a five-letter word. Green means correct place, yellow means the letter is elsewhere.',
    solitaire:'Build the four suits from Ace to King. Move cards between columns in descending alternating colors.'
  };

  function addToOverlay(overlay){
    if(!overlay||overlay.dataset.enhanced)return;
    const panel=overlay.querySelector('.game-play-panel');
    if(!panel)return;
    overlay.dataset.enhanced='1';
    const body=panel.querySelector('.panel-body');
    const board=panel.querySelector('.game-board-wrap');
    if(!body||!board)return;
    const name=(panel.querySelector('.panel-header h2')?.textContent||'').toLowerCase();
    let type='';
    if(name.includes('snake'))type='snake';
    else if(name.includes('minesweeper'))type='minesweeper';
    else if(name.includes('2048'))type='2048';
    else if(name.includes('word'))type='wordle';
    else if(name.includes('solitaire'))type='solitaire';

    const tip=document.createElement('div');tip.className='game-tip';tip.textContent=rules[type]||'Play the game, then use Restart to start a fresh round.';
    board.after(tip);

    const bar=document.createElement('div');bar.className='game-extra-bar';
    const full=document.createElement('button');full.type='button';full.textContent='⛶ Fullscreen';
    const rulesBtn=document.createElement('button');rulesBtn.type='button';rulesBtn.textContent='❔ How to play';
    const copyBtn=document.createElement('button');copyBtn.type='button';copyBtn.textContent='🔄 New round';
    bar.append(full,rulesBtn,copyBtn);
    body.querySelector('.game-toolbar')?.before(bar);

    full.onclick=()=>{
      if(!document.fullscreenElement)panel.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();
    };
    rulesBtn.onclick=()=>{tip.style.display=tip.style.display==='none'?'':'none'};
    copyBtn.onclick=()=>panel.querySelector('.restart-solo')?.click();
  }

  const observer=new MutationObserver(m=>{
    for(const x of m)for(const n of x.addedNodes){
      if(!(n instanceof Element))continue;
      if(n.classList.contains('game-play-overlay'))addToOverlay(n);
      n.querySelectorAll?.('.game-play-overlay').forEach(addToOverlay);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});

  function decorateCards(){
    document.querySelectorAll('.game-choice,.solo-game-choice').forEach(card=>{
      if(card.dataset.polished)return;
      card.dataset.polished='1';
      const label=document.createElement('span');label.className='game-stat-pill';
      label.textContent=card.classList.contains('solo-game-choice')?'SOLO':'PLAY';
      label.style.position='absolute';label.style.right='12px';label.style.top='12px';label.style.zIndex='2';
      card.appendChild(label);
    });
  }
  decorateCards();
  new MutationObserver(decorateCards).observe(document.body,{childList:true,subtree:true});
})();
