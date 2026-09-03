/* Per-game settings + system message visibility */
(() => {
  'use strict';

  const KEY = 'chatApp2GameSettings';
  const SYSTEM_KEY = 'chatApp2ShowSystemMessages';
  const defaults = {
    snake:{difficulty:'normal',board:'20x15',wrap:'off',sound:'on'},
    minesweeper:{difficulty:'normal',board:'10x10',mines:'15',flags:'on'},
    game2048:{board:'4x4',target:'2048',animations:'on'},
    solitaire:{draw:'1',hints:'on',timer:'on'},
    wordle:{difficulty:'normal',attempts:'6',hard:'off'},
    ttt3:{players:'2',rounds:'1',turnTime:'30'},
    ttt4:{players:'2',rounds:'1',turnTime:'30'},
    ttt5:{players:'2',rounds:'1',turnTime:'30'},
    ttt6:{players:'2',rounds:'1',turnTime:'30'},
    hangman:{players:'2',rounds:'1',turnTime:'60'},
    battleship:{players:'2',turns:'unlimited',turnTime:'60'},
    memory:{players:'2',rounds:'1',turnTime:'30'},
    quickdraw:{players:'2',rounds:'5',turnTime:'30'},
    coinflip:{players:'2',rounds:'5',turnTime:'30'},
    numberguess:{players:'2',rounds:'3',turnTime:'60'},
    target:{players:'2',rounds:'5',turnTime:'30'},
    reaction:{players:'2',rounds:'5',turnTime:'30'},
    type:{players:'2',rounds:'3',turnTime:'60'},
    boss:{players:'2',rounds:'1',turnTime:'120'},
    trivia:{players:'2',rounds:'10',turnTime:'30'},
    wordscramble:{players:'2',rounds:'5',turnTime:'45'},
    mathrace:{players:'2',rounds:'5',turnTime:'45'},
    ttttournament:{players:'4',rounds:'3',turnTime:'30'},
    rpstournament:{players:'4',rounds:'5',turnTime:'20'}
  };

  const labels = {
    snake:'Snake',minesweeper:'Minesweeper',game2048:'2048',solitaire:'Solitaire',wordle:'Word Guess',
    ttt3:'Tic-Tac-Toe 3x3',ttt4:'Tic-Tac-Toe 4x4',ttt5:'Tic-Tac-Toe 5x5',ttt6:'Tic-Tac-Toe 6x6',
    hangman:'Hangman',battleship:'Battleship',memory:'Memory Match',quickdraw:'Quick Draw',coinflip:'Coin Flip Battle',numberguess:'Number Guess',target:'Target Click',reaction:'Reaction Time',type:'Type Sentence',boss:'Boss Battle',trivia:'Trivia Quiz',wordscramble:'Word Scramble',mathrace:'Math Race',ttttournament:'Tic-Tac-Toe Tournament',rpstournament:'RPS Tournament'
  };

  const soloFields = {
    snake:[['difficulty','Difficulty',['easy','normal','hard']],['board','Board size',['15x10','20x15','30x20']],['wrap','Wrap at edges',['on','off']],['sound','Sound',['on','off']]],
    minesweeper:[['difficulty','Difficulty',['easy','normal','hard']],['board','Board size',['8x8','10x10','12x12']],['mines','Mines',['10','15','25']],['flags','Flags',['on','off']]],
    game2048:[['board','Board size',['4x4','5x5']],['target','Target tile',['512','1024','2048','4096']],['animations','Animations',['on','off']]],
    solitaire:[['draw','Draw cards',['1','3']],['hints','Hints',['on','off']],['timer','Timer',['on','off']]],
    wordle:[['difficulty','Difficulty',['easy','normal','hard']],['attempts','Attempts',['6','7','8']],['hard','Hard mode',['on','off']]]
  };

  const multiFields = [['players','Players',['2','3','4','5','6']],['rounds','Rounds',['1','3','5','10']],['turnTime','Turn time',['20','30','45','60','120']]];
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e) { settings = {}; }
  const get = id => Object.assign({}, defaults[id] || {}, settings[id] || {});
  const save = (id,data) => { settings[id] = data; localStorage.setItem(KEY,JSON.stringify(settings)); };

  const CSS = `<style id="game-settings-style">
  .game-settings-btn{position:absolute;right:10px;top:10px;width:32px;height:32px;border:1px solid #3a404a;border-radius:9px;background:#20242b;color:#dbe0e7;cursor:pointer;font-size:15px;z-index:2}.game-settings-btn:hover{background:#6654e8;color:#fff}
  .solo-game-choice{padding-right:55px!important}.game-choice{position:relative}.game-settings-dialog{z-index:10100}.game-settings-panel{width:min(520px,94vw);max-height:88vh;overflow:auto}.game-settings-list{display:grid;gap:12px}.game-setting-row{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:12px;border:1px solid #303640;border-radius:11px;background:#191c22}.game-setting-row label{font-weight:700;color:#e1e5ea}.game-setting-row select{min-width:130px;padding:8px 10px;border:1px solid #414854;border-radius:8px;background:#111419;color:#fff}.game-settings-note{color:#8f98a5;font-size:12px;line-height:1.45;margin-bottom:14px}.game-settings-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}.game-settings-actions button{border:0;border-radius:9px;padding:9px 14px;background:#6654e8;color:#fff;cursor:pointer}.game-settings-actions .secondary{background:#303640}
  .system-message-hidden{display:none!important}
  .system-setting{margin-top:18px;padding:14px;border:1px solid #30343c;border-radius:14px;background:#17191e}.system-toggle{display:flex;align-items:center;justify-content:space-between;gap:15px}.system-toggle label{font-weight:700}.system-toggle input{width:20px;height:20px}
  </style>`;

  function inject(){if(!document.getElementById('game-settings-style'))document.head.insertAdjacentHTML('beforeend',CSS);}

  function addSettingsButtons(){
    document.querySelectorAll('#gamesOverlay .game-choice, #gamesOverlay .solo-game-choice').forEach(card=>{
      if(card.querySelector('.game-settings-btn'))return;
      const id=card.dataset.game;if(!id)return;
      const b=document.createElement('button');b.type='button';b.className='game-settings-btn';b.title='Game settings';b.setAttribute('aria-label',`Settings for ${labels[id]||'game'}`);b.textContent='⚙';
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openSettings(id);},true);card.appendChild(b);
    });
  }

  function fieldMarkup(id){
    const fields=soloFields[id] || multiFields; const current=get(id);
    return fields.map(([key,label,options])=>`<div class="game-setting-row"><label>${label}</label><select data-key="${key}">${options.map(v=>`<option value="${v}" ${String(current[key])===String(v)?'selected':''}>${v}</option>`).join('')}</select></div>`).join('');
  }

  function openSettings(id){
    document.querySelector('.game-settings-dialog')?.remove();
    const overlay=document.createElement('div');overlay.className='overlay game-settings-dialog';overlay.style.display='flex';
    const solo=!!soloFields[id];
    overlay.innerHTML=`<div class="panel game-settings-panel"><div class="panel-header"><h2>⚙️ ${labels[id]||'Game'} Settings</h2><button class="icon-btn game-settings-close">×</button></div><div class="panel-body"><p class="game-settings-note">These settings are saved on this device for ${labels[id]||'this game'}. Multiplayer lobby settings can be used by the player creating the game.</p><div class="game-settings-list">${fieldMarkup(id)}</div><div class="game-settings-actions"><button type="button" class="secondary reset-game-settings">Reset</button><button type="button" class="save-game-settings">Save settings</button></div></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.game-settings-close').onclick=()=>overlay.remove();
    overlay.querySelector('.save-game-settings').onclick=()=>{const data=get(id);overlay.querySelectorAll('select[data-key]').forEach(s=>data[s.dataset.key]=s.value);save(id,data);overlay.remove();showSavedToast(labels[id]||'Game');};
    overlay.querySelector('.reset-game-settings').onclick=()=>{save(id,Object.assign({},defaults[id]||{}));overlay.remove();showSavedToast(`${labels[id]||'Game'} reset`);};
  }

  function showSavedToast(name){
    const old=document.querySelector('.game-settings-toast');old?.remove();const t=document.createElement('div');t.className='game-settings-toast';t.textContent=`${name} settings saved`;
    t.style.cssText='position:fixed;right:20px;bottom:20px;z-index:11000;padding:11px 15px;border:1px solid #414752;border-radius:10px;background:#181b21;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.35)';document.body.appendChild(t);setTimeout(()=>t.remove(),2200);
  }

  function isSystemNode(node){
    if(!(node instanceof Element))return false;
    if(node.matches('[data-system-message="true"],.system-message,.system,.message-system,[data-message-type="system"]'))return true;
    const text=(node.innerText||'').trim().toLowerCase();
    return /^system\s*[:\-]/.test(text) || /^game system\s*[:\-]/.test(text);
  }
  function applySystemVisibility(){
    const show=localStorage.getItem(SYSTEM_KEY)==='true';
    const messages=document.getElementById('messages');if(!messages)return;
    Array.from(messages.children).forEach(n=>{if(isSystemNode(n))n.classList.toggle('system-message-hidden',!show);});
  }
  function addSystemSetting(){
    const settingsOverlay=document.getElementById('settingsOverlay');const body=settingsOverlay?.querySelector('.panel-body');if(!body||body.querySelector('.system-setting'))return;
    const box=document.createElement('div');box.className='system-setting';const checked=localStorage.getItem(SYSTEM_KEY)==='true';
    box.innerHTML=`<div class="system-toggle"><label for="showSystemMessages">Show system messages</label><input id="showSystemMessages" type="checkbox" ${checked?'checked':''}></div><p style="color:#969eaa;font-size:12px;margin:8px 0 0;line-height:1.45">Default is Off. Turn this on if you want to see system-generated messages in chat.</p>`;
    box.querySelector('input').onchange=e=>{localStorage.setItem(SYSTEM_KEY,String(e.target.checked));applySystemVisibility();};body.appendChild(box);
  }

  function observe(){
    addSettingsButtons();addSystemSetting();applySystemVisibility();
    const games=document.getElementById('gamesOverlay');if(games)new MutationObserver(()=>addSettingsButtons()).observe(games,{childList:true,subtree:true});
    const messages=document.getElementById('messages');if(messages)new MutationObserver(()=>applySystemVisibility()).observe(messages,{childList:true,subtree:true});
  }

  inject();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
  setTimeout(observe,500);setTimeout(observe,1500);
})();
