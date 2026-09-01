(()=>{
'use strict';

function load(){
  if(window.__expandedGamesLoader)return;
  window.__expandedGamesLoader=true;

  const addButton=()=>{
    const grid=document.querySelector('.game-grid');
    if(!grid || grid.querySelector('.expanded-games-launch'))return !!grid;

    const section=document.createElement('div');
    section.className='game-section-title';
    section.textContent='🎮 SOLO + PARTY GAMES';
    grid.insertBefore(section,grid.firstChild);

    const button=document.createElement('button');
    button.className='game-choice expanded-games-launch game-choice-featured';
    button.type='button';
    button.innerHTML='<strong>🕹️ Expanded Games Library</strong><span>20+ extra games • 1–4 players • Search & filters</span><div class="game-details"><b>Includes</b> · Solo games, local multiplayer, party games, arcade, puzzle and strategy games.<br>Use the library to search by name and filter by minimum/maximum players.</div><div class="game-players">1–4 players</div>';
    button.addEventListener('click',()=>{
      if(typeof window.openExpandedGames==='function')window.openExpandedGames();
      else {
        const s=document.createElement('script');
        s.src='games-browser.js?v=20260901';
        s.onload=()=>window.openExpandedGames&&window.openExpandedGames();
        document.body.appendChild(s);
      }
    });
    grid.insertBefore(button,grid.children[1]||null);
    return true;
  };

  const start=()=>{
    if(!document.querySelector('script[data-expanded-games]')){
      const s=document.createElement('script');
      s.src='games-browser.js?v=20260901';
      s.dataset.expandedGames='1';
      document.body.appendChild(s);
    }
    addButton();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(addButton()||tries>30)clearInterval(timer);
    },250);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
}

window.addEventListener('load',load);
load();
})();