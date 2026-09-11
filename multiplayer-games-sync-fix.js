(() => {
  'use strict';

  const PREFIX='__CHAT_APP2_EXTRA_GAME__:';
  const NAMES={
    'Connect Four':'connect4',
    'Reversi':'reversi',
    'Dots & Boxes':'dots',
    'Reaction Duel':'reaction',
    'Word Duel':'word'
  };
  let reactionTimers=new Map();

  function states(){
    const map=new Map();
    let list=[];
    try{list=typeof currentMessages!=='undefined'?currentMessages:[];}catch(_){ }
    for(const m of list||[]){
      const raw=typeof m?.message==='string'?m.message:'';
      if(!raw.startsWith(PREFIX))continue;
      try{const g=JSON.parse(raw.slice(PREFIX.length));if(g?.id&&(!map.has(g.id)||Number(g.updatedAt||0)>Number(map.get(g.id).updatedAt||0)))map.set(g.id,g);}catch(_){ }
    }
    return [...map.values()];
  }

  function publish(g){
    if(typeof apiPost!=='function')return;
    g.version=(g.version||0)+1;
    g.updatedAt=Date.now();
    apiPost({game_server:true,username:'__GAME_SERVER__',channel:typeof CHANNEL!=='undefined'?CHANNEL:'general',message:PREFIX+JSON.stringify(g),device_id:g.hostDeviceId}).catch(()=>{});
  }

  function findOpenGame(){
    const modal=document.querySelector('.extra-game-modal');
    if(!modal)return null;
    const title=modal.querySelector('.extra-game-head h2')?.textContent||'';
    let type=null;
    for(const [name,id] of Object.entries(NAMES))if(title.includes(name)){type=id;break;}
    if(!type)return null;
    const list=states().filter(g=>g.type===type&&g.updatedAt>Date.now()-30*60*1000);
    if(!list.length)return null;
    const me=typeof deviceId!=='undefined'?deviceId:localStorage.getItem('chat_device_id');
    return list.filter(g=>(g.players||[]).some(p=>p.id===me)).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0]||list.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
  }

  function attachId(){
    const modal=document.querySelector('.extra-game-modal');
    if(!modal||modal.dataset.gameId)return;
    const g=findOpenGame();
    if(g)modal.dataset.gameId=g.id;
  }

  function reactionControl(){
    const modal=document.querySelector('.extra-game-modal');
    if(!modal||!modal.dataset.gameId)return;
    const g=states().find(x=>x.id===modal.dataset.gameId);
    if(!g||g.type!=='reaction'||g.phase!=='playing'||g.state.phase!=='waiting')return;
    const me=typeof deviceId!=='undefined'?deviceId:localStorage.getItem('chat_device_id');
    if(g.hostDeviceId!==me)return;
    if(g.state.startAt)return;
    g.state.phase='countdown';
    g.state.startAt=Date.now()+1800+Math.floor(Math.random()*2200);
    publish(g);
    const id=g.id;
    if(reactionTimers.has(id))clearTimeout(reactionTimers.get(id));
    reactionTimers.set(id,setTimeout(()=>{
      const latest=states().find(x=>x.id===id);
      if(!latest||latest.state.phase!=='countdown')return;
      latest.state.phase='go';
      latest.state.goAt=Date.now();
      latest.state.results={};
      publish(latest);
      reactionTimers.delete(id);
    },Math.max(200,Number(g.state.startAt)-Date.now())));
  }

  const observer=new MutationObserver(()=>attachId());
  window.addEventListener('load',()=>{
    observer.observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{attachId();reactionControl();},500);
  });
})();
