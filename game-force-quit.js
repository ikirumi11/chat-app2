(()=>{'use strict';
const POLL=700;
let deviceId=localStorage.getItem('chat_device_id')||'';
let stopping=new Set();

function dev(){
    if(!deviceId){
        deviceId=crypto.randomUUID?crypto.randomUUID():'game-'+Date.now()+'-'+Math.random();
        localStorage.setItem('chat_device_id',deviceId);
    }
    return deviceId;
}

function channel(){
    return window.CHANNEL||'general';
}

function ensureStyle(){
    if(document.getElementById('game-force-quit-style'))return;
    const s=document.createElement('style');
    s.id='game-force-quit-style';
    s.textContent=`
        .game-force-quit-row{display:flex;justify-content:center;margin-top:12px;}
        .game-force-quit-btn{border:1px solid #8e3947;background:#a63f4b;color:#fff;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;}
        .game-force-quit-btn:hover{filter:brightness(1.08);}
        .game-force-quit-btn:disabled{opacity:.65;cursor:wait;}
    `;
    document.head.appendChild(s);
}

async function forceQuit(game,button){
    if(!game?.id||stopping.has(game.id))return;
    stopping.add(game.id);
    if(button){
        button.disabled=true;
        button.textContent='Stopping…';
    }

    try{
        const response=await fetch('/api/messages',{
            method:'POST',
            cache:'no-store',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                game_server:true,
                game_action:'stop',
                channel:channel(),
                device_id:dev(),
                game_id:game.id
            })
        });

        let data={};
        try{data=await response.json();}catch{}
        if(!response.ok)throw new Error(data.error||'Could not stop the game.');

        if(Array.isArray(window.games)){
            window.games=window.games.filter(g=>g&&g.id!==game.id);
        }
        if(window.stoppedGames&&typeof window.stoppedGames.add==='function'){
            window.stoppedGames.add(game.id);
        }
        if(typeof window.renderMessages==='function')window.renderMessages(false);
    }catch(error){
        stopping.delete(game.id);
        if(button){
            button.disabled=false;
            button.textContent='⏹ Force quit for everyone';
        }
        alert(error.message||'Could not stop the game.');
        return;
    }

    stopping.delete(game.id);
}

function addButtons(){
    ensureStyle();
    const list=Array.isArray(window.games)?window.games:[];
    const active=new Map(list.filter(g=>g&&g.id&&g.status!=='finished'&&g.status!=='forcequit').map(g=>[g.id,g]));

    document.querySelectorAll('.game-message').forEach(wrapper=>{
        const raw=wrapper.dataset.id||'';
        const id=raw.startsWith('game_')?raw.slice(5):raw;
        const game=active.get(id);
        if(!game)return;

        const actions=wrapper.querySelector('.game-actions');
        if(!actions)return;

        actions.querySelectorAll('.game-btn.danger').forEach(btn=>{
            if((btn.textContent||'').toLowerCase().includes('force quit'))btn.remove();
        });

        let row=actions.querySelector('.game-force-quit-row');
        let button=row?.querySelector('.game-force-quit-btn');
        if(!row){
            row=document.createElement('div');
            row.className='game-force-quit-row';
            button=document.createElement('button');
            button.type='button';
            button.className='game-btn danger game-force-quit-btn';
            button.textContent='⏹ Force quit for everyone';
            row.appendChild(button);
            actions.appendChild(row);
        }

        button.disabled=stopping.has(game.id);
        if(!stopping.has(game.id))button.textContent='⏹ Force quit for everyone';
        button.onclick=()=>{
            if(typeof window.openConfirm==='function'){
                window.openConfirm(
                    'Force quit game for everyone?',
                    'This will stop the game for every player, including the host.',
                    ()=>forceQuit(game,button)
                );
            }else if(confirm('Force quit this game for everyone?')){
                forceQuit(game,button);
            }
        };
    });
}

function tick(){
    addButtons();
}

ensureStyle();
dev();
tick();
setInterval(tick,POLL);
})();