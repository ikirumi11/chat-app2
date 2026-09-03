(()=>{'use strict';
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function animateOverlay(overlay,open){if(!overlay)return;if(open){overlay.classList.remove('closing');overlay.classList.add('show');}else if(overlay.classList.contains('show')){overlay.classList.add('closing');setTimeout(()=>{overlay.classList.remove('show','closing');},220);}}
function wireOverlayButtons(){
 document.querySelectorAll('.overlay').forEach(o=>{
   if(o.dataset.uiAnim)return;o.dataset.uiAnim='1';
   const close=o.querySelector('.panel-header .icon-btn');
   if(close)close.addEventListener('click',e=>{e.preventDefault();animateOverlay(o,false);});
   o.addEventListener('mousedown',e=>{if(e.target===o)animateOverlay(o,false);});
 });
 const pairs=[['gamesBtn','gamesOverlay'],['settingsBtn','settingsOverlay'],['gamesComposerBtn','gamesOverlay']];
 pairs.forEach(([b,o])=>{const btn=document.getElementById(b),ov=document.getElementById(o);if(!btn||!ov||btn.dataset.uiAnim)return;btn.dataset.uiAnim='1';btn.addEventListener('click',()=>animateOverlay(ov,true));});
 ['closeGames','closeSettings'].forEach(id=>{const b=document.getElementById(id);if(!b||b.dataset.uiAnim)return;b.dataset.uiAnim='1';b.addEventListener('click',()=>animateOverlay(b.closest('.overlay'),false));});
}
function animateNewContent(){
 const box=document.getElementById('messages');if(!box)return;
 const observer=new MutationObserver(records=>{records.forEach(r=>r.addedNodes.forEach(n=>{if(!(n instanceof Element))return;if(reduced)return;if(n.classList.contains('message')||n.classList.contains('game-message')){n.classList.remove('ui-new-item');void n.offsetWidth;n.classList.add('ui-new-item');}}));});
 observer.observe(box,{childList:true});
}
function buttonFeedback(){document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||reduced)return;b.classList.remove('ui-press');void b.offsetWidth;b.classList.add('ui-press');setTimeout(()=>b.classList.remove('ui-press'),180);});}
function loadPremiumGames(){if(document.getElementById('games-premium-script'))return;const s=document.createElement('script');s.id='games-premium-script';s.src='games-premium.js';s.defer=true;document.head.appendChild(s);}
function init(){wireOverlayButtons();animateNewContent();buttonFeedback();loadPremiumGames();
 const mo=new MutationObserver(()=>wireOverlayButtons());mo.observe(document.body,{childList:true,subtree:true});
 const startup=document.getElementById('startupScreen');if(startup&&!startup.classList.contains('is-hiding'))setTimeout(()=>startup.classList.add('is-hiding'),900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
