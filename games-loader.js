(()=>{'use strict';
if(window.__chatGamesLoaderV4)return;window.__chatGamesLoaderV4=true;
const V='20260901-v4';
const load=(src,key)=>{if(document.querySelector(`script[data-chat-games="${key}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${V}`;s.dataset.chatGames=key;s.async=false;document.body.appendChild(s)};
const start=()=>{
 load('/games/solo/index.js','solo-index');
 load('/games-system-v3.js','system-v4');
 load('/screen-share-fix.js','screen-share');
 load('/games-fast-sync.js','games-fast-sync');
 load('/site-update.js','site-update');
 load('/audio-compressor.js','audio-compressor');
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('load',start,{once:true});
})();