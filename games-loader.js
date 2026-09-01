(()=>{
'use strict';
if(window.__expandedGamesLoader)return;
window.__expandedGamesLoader=true;
const BUILD='3.0.0';
const load=(src,key)=>{if(document.querySelector('script[data-chatapp-fix="'+key+'"]'))return;const s=document.createElement('script');s.src=src+'?v='+BUILD;s.dataset.chatappFix=key;s.async=false;document.body.appendChild(s)};
const add=()=>{const grid=document.querySelector('.game-grid');if(!grid)return false;if(grid.querySelector('.games-v3-launch'))return true;const section=document.createElement('div');section.className='game-section-title';section.textContent='🎮 GAMES';grid.insertBefore(section,grid.firstChild);const button=document.createElement('button');button.className='game-choice games-v3-launch game-choice-featured';button.type='button';button.innerHTML='<strong>🎮 Games</strong><span>Solo Arcade + multiplayer • Search • filters • 1–4 players</span><div class="game-details"><b>New</b> · Configurable 3-player Tic-Tac-Toe, Solo Arcade and a unified game picker.</div><div class="game-players">1–4 players</div>';button.onclick=()=>window.ChatGamesV3?.open();grid.insertBefore(button,grid.children[1]||null);return true};
const start=()=>{load('/games-plus.js','games-plus-v3');load('/games/solo-arcade.js','solo-arcade');load('/games-system-v3.js','games-system-v3');load('/screen-share-fix.js','screen-share');load('/games-fast-sync.js','games-fast-sync');load('/site-update.js','site-update');load('/audio-compressor.js','audio-compressor');load('/games-extra-5.js','games-extra-5');let tries=0;const timer=setInterval(()=>{tries++;if(add()||tries>=50)clearInterval(timer)},200)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('load',start,{once:true});
})();