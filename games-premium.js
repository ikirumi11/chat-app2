/* =========================================================
   GAMES PREMIUM SYSTEM
   Visual polish + consistent game HUD + result presentation.
   Works as a non-invasive layer over the existing game engines.
========================================================= */
(() => {
  'use strict';

  const STYLE_ID = 'games-premium-system-style';
  const GAME_MARK = 'data-premium-game';

  const CSS = `
  :root{--gp-accent:#7667ff;--gp-accent2:#9a8fff;--gp-bg:#0c0f15;--gp-panel:rgba(18,22,30,.96);--gp-line:rgba(255,255,255,.09);--gp-text:#f7f8fb;--gp-muted:#9da6b5}
  .games-refresh-head{position:relative;overflow:hidden;box-shadow:0 16px 50px rgba(0,0,0,.25)}
  .games-refresh-head:before{content:"";position:absolute;inset:-80px;background:radial-gradient(circle at 20% 30%,rgba(118,103,255,.22),transparent 32%),radial-gradient(circle at 85% 70%,rgba(60,190,255,.12),transparent 30%);pointer-events:none}
  .games-refresh-title,.games-refresh-sub{position:relative}
  .games-filter-row{position:sticky;top:0;z-index:3;padding:8px;border-radius:14px;background:rgba(12,15,21,.84);backdrop-filter:blur(16px);border:1px solid var(--gp-line);box-shadow:0 10px 30px rgba(0,0,0,.18)}
  .games-filter{transition:all .18s ease;box-shadow:inset 0 1px rgba(255,255,255,.05)}
  .games-filter:hover{transform:translateY(-1px);border-color:rgba(118,103,255,.7)}
  .games-search:focus{border-color:var(--gp-accent);box-shadow:0 0 0 3px rgba(118,103,255,.15)}
  .game-grid{perspective:900px}
  .game-choice,.solo-game-choice{overflow:hidden;isolation:isolate;box-shadow:0 8px 28px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.045)!important}
  .game-choice:before,.solo-game-choice:before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.055),transparent 35%,rgba(118,103,255,.06));opacity:0;transition:opacity .2s;pointer-events:none}
  .game-choice:hover:before,.solo-game-choice:hover:before{opacity:1}
  .game-choice:hover,.solo-game-choice:hover{transform:translateY(-4px) scale(1.01)!important;box-shadow:0 18px 42px rgba(0,0,0,.32),0 0 0 1px rgba(118,103,255,.28)!important}
  .game-choice strong{font-size:15px;letter-spacing:.01em}
  .game-choice span,.solo-game-desc{color:#aab2c0}
  .game-players,.solo-game-players{border:1px solid rgba(255,255,255,.06);box-shadow:inset 0 1px rgba(255,255,255,.04)}
  .game-play-overlay{background:radial-gradient(circle at 50% 10%,rgba(118,103,255,.12),transparent 35%),rgba(3,5,9,.76)!important;backdrop-filter:blur(10px)}
  .game-play-panel{border:1px solid rgba(255,255,255,.11)!important;background:linear-gradient(145deg,rgba(22,26,35,.98),rgba(11,14,20,.98))!important;box-shadow:0 30px 100px rgba(0,0,0,.6),0 0 80px rgba(118,103,255,.08)!important;border-radius:22px!important;animation:gpPanelIn .22s ease-out}
  @keyframes gpPanelIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
  .game-play-panel .panel-header{border-bottom:1px solid var(--gp-line)!important;background:linear-gradient(180deg,rgba(255,255,255,.035),transparent);padding:17px 19px!important}
  .game-play-panel .panel-header h2{font-weight:900;letter-spacing:-.02em}
  .game-play-panel .panel-body{padding:18px!important}
  .game-status{padding:10px 14px!important;border:1px solid var(--gp-line);border-radius:12px;background:rgba(255,255,255,.025);box-shadow:inset 0 1px rgba(255,255,255,.035);font-weight:700}
  .game-toolbar button,.game-play-panel button:not(.icon-btn){transition:transform .15s,box-shadow .15s,filter .15s!important;box-shadow:0 7px 18px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.08)!important}
  .game-toolbar button:hover,.game-play-panel button:not(.icon-btn):hover{transform:translateY(-2px);filter:brightness(1.08)}
  .game-toolbar button:active,.game-play-panel button:not(.icon-btn):active{transform:translateY(0) scale(.98)}
  .solo-canvas{box-shadow:0 20px 50px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.06)!important}
  .mine-grid{padding:10px!important;border-radius:18px;background:rgba(0,0,0,.2);box-shadow:inset 0 1px rgba(255,255,255,.04)}
  .mine-cell{transition:transform .1s,filter .1s,background .1s!important;box-shadow:inset 0 1px rgba(255,255,255,.05)}
  .mine-cell:hover{transform:scale(.96);filter:brightness(1.15)}
  .board2048{box-shadow:0 20px 50px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.05)!important;border:1px solid var(--gp-line)}
  .tile2048{box-shadow:inset 0 1px rgba(255,255,255,.07),0 5px 12px rgba(0,0,0,.16);transition:transform .12s}
  .word-cell{background:rgba(255,255,255,.025);box-shadow:inset 0 1px rgba(255,255,255,.04);transition:transform .12s,background .12s,border-color .12s}
  .word-cell:hover{transform:translateY(-1px);border-color:rgba(118,103,255,.55)}
  .word-input{box-shadow:inset 0 1px rgba(255,255,255,.04),0 8px 20px rgba(0,0,0,.18)!important}
  .word-input:focus{border-color:var(--gp-accent)!important;box-shadow:0 0 0 3px rgba(118,103,255,.14)!important;outline:none}
  .sol-card{box-shadow:0 8px 18px rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s!important}.sol-card:hover{transform:translateY(-3px) rotate(-1deg);box-shadow:0 14px 25px rgba(0,0,0,.26)}
  .gp-livebar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:8px 11px;border:1px solid var(--gp-line);border-radius:11px;background:rgba(255,255,255,.025);color:var(--gp-muted);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
  .gp-live{display:inline-flex;align-items:center;gap:6px;color:#b9f7d0}.gp-live i{width:7px;height:7px;border-radius:50%;background:#55d98b;box-shadow:0 0 12px rgba(85,217,139,.7);animation:gpPulse 1.4s infinite}.gp-time{font-variant-numeric:tabular-nums}
  @keyframes gpPulse{50%{opacity:.35;transform:scale(.72)}}
  .gp-result{position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.72);backdrop-filter:blur(9px);animation:gpFade .18s ease}
  .gp-result-card{width:min(520px,92vw);padding:28px;border:1px solid rgba(255,255,255,.13);border-radius:24px;background:linear-gradient(145deg,#1b202b,#0d1017);box-shadow:0 30px 100px rgba(0,0,0,.65);text-align:center;animation:gpResultIn .25s cubic-bezier(.2,.8,.2,1)}
  .gp-result-icon{font-size:52px;line-height:1;margin-bottom:13px}.gp-result-title{font-size:28px;font-weight:950;letter-spacing:-.04em}.gp-result-text{margin:9px 0 20px;color:#aeb6c3;line-height:1.5}.gp-result-card button{border:0;border-radius:12px;padding:11px 18px;background:var(--gp-accent);color:#fff;font-weight:900;cursor:pointer}
  @keyframes gpFade{from{opacity:0}to{opacity:1}}@keyframes gpResultIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
  .gp-game-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;background:rgba(118,103,255,.13);border:1px solid rgba(118,103,255,.2);color:#c9c2ff;font-size:10px;font-weight:900}
  @media(max-width:600px){.game-play-panel{width:96vw!important;max-height:94vh!important;border-radius:18px!important}.game-play-panel .panel-body{padding:12px!important}.gp-result-card{padding:22px}.games-refresh-title{font-size:21px}.tile2048{width:62px;height:62px}.board2048{grid-template-columns:repeat(4,62px)}}
  `;

  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=CSS;document.head.appendChild(s);
  }

  function decoratePanel(panel){
    if(!panel || panel.dataset.gpDecorated==='1') return;
    panel.dataset.gpDecorated='1';
    panel.setAttribute(GAME_MARK,'1');

    const body=panel.querySelector('.panel-body');
    if(!body) return;

    const title=panel.querySelector('.panel-header h2')?.textContent?.trim() || 'Game';
    const bar=document.createElement('div');
    bar.className='gp-livebar';
    bar.innerHTML='<span class="gp-live"><i></i> LIVE GAME</span><span class="gp-time">00:00</span>';
    body.insertBefore(bar,body.firstChild);

    const started=performance.now();
    const timer=setInterval(()=>{
      if(!document.body.contains(panel)){clearInterval(timer);return;}
      const seconds=Math.floor((performance.now()-started)/1000);
      bar.querySelector('.gp-time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    },1000);

    const observer=new MutationObserver(()=>{
      if(!document.body.contains(panel)){observer.disconnect();clearInterval(timer);return;}
      const text=(body.innerText||'').toLowerCase();
      if(/\b(game over|you win|you won|winner|victory|you lost|defeat|draw|tie|cleared the board|finished)\b/.test(text)){
        bar.querySelector('.gp-live').innerHTML='<i style="background:#9a8fff"></i> RESULT';
      }
    });
    observer.observe(body,{childList:true,subtree:true,characterData:true});

    const close=panel.querySelector('.close-solo,.icon-btn');
    if(close && !close.dataset.gpClose) close.dataset.gpClose='1';
  }

  function decorateExisting(){
    document.querySelectorAll('.game-play-panel').forEach(decoratePanel);
  }

  function watch(){
    const observer=new MutationObserver(muts=>{
      for(const m of muts){
        for(const node of m.addedNodes){
          if(!(node instanceof Element)) continue;
          if(node.matches('.game-play-panel')) decoratePanel(node);
          node.querySelectorAll?.('.game-play-panel').forEach(decoratePanel);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function boot(){injectStyle();decorateExisting();watch();}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
