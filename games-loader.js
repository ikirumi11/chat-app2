(()=>{'use strict';
if(window.__chatGamesLoaderV6)return;window.__chatGamesLoaderV6=true;
const V='20260902-v7';
const load=(src,key)=>{if(document.querySelector(`script[data-chat-games="${key}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${V}`;s.dataset.chatGames=key;s.async=false;document.body.appendChild(s)};
const start=()=>{
 load('/games/solo/index.js','solo-index');
 load('/games-system-v3.js','system-v4');
 load('/games-multiplayer-v2.js','multiplayer-v2');
 load('/games-invisible-fast.js','games-invisible-fast');
 load('/screen-share-fix.js','screen-share');
 load('/games-fast-sync.js','games-fast-sync');
 load('/games-first-menu.js','games-first-menu');
 load('/games-original-only.js','games-original-only');
 load('/site-update.js','site-update');
 load('/audio-compressor.js','audio-compressor');
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',start,{once:true});
})();