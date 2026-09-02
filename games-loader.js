(()=>{'use strict';
if(window.__chatGamesLoaderTTT)return;window.__chatGamesLoaderTTT=true;
const V='20260902-ttt-chat-v2';
const load=(src,key)=>{if(document.querySelector(`script[data-chat-games="${key}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${V}`;s.dataset.chatGames=key;s.async=false;document.body.appendChild(s)};
const start=()=>{
 load('/chat-tictactoe.js','chat-tictactoe');
 load('/site-update.js','site-update');
 load('/audio-compressor.js','audio-compressor');
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',start,{once:true});
})();