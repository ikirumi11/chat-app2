(()=>{
'use strict';

const ALLOWED_REQUEST_ORIGIN='*';
const REQUEST_TYPE='chat-app-storage-request';
const RESPONSE_TYPE='chat-app-storage-response';
const PREFIX='chat-app2.';

function storageKey(key){
    return PREFIX+String(key||'');
}

function respond(event,id,ok,value,error){
    if(!event.source||typeof event.source.postMessage!=='function')return;

    event.source.postMessage({
        type:RESPONSE_TYPE,
        id,
        ok:!!ok,
        value:value===undefined?null:value,
        error:error||null
    },event.origin==='null'?'*':event.origin);
}

window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.type!==REQUEST_TYPE)return;

    if(event.source===window)return;

    const key=storageKey(data.key);
    const action=String(data.action||'');

    try{
        if(action==='save'){
            localStorage.setItem(key,String(data.value||''));
            respond(event,data.id,true,String(data.value||''),null);
            return;
        }

        if(action==='get'){
            respond(event,data.id,true,localStorage.getItem(key),null);
            return;
        }

        if(action==='remove'){
            localStorage.removeItem(key);
            respond(event,data.id,true,null,null);
            return;
        }

        if(action==='clear'){
            const keys=[];
            for(let i=0;i<localStorage.length;i++){
                const currentKey=localStorage.key(i);
                if(currentKey&&currentKey.startsWith(PREFIX))keys.push(currentKey);
            }

            keys.forEach(currentKey=>localStorage.removeItem(currentKey));
            respond(event,data.id,true,null,null);
            return;
        }

        respond(event,data.id,false,null,'Unknown storage action.');
    }catch(error){
        respond(
            event,
            data.id,
            false,
            null,
            error&&error.message?error.message:'Storage operation failed.'
        );
    }
});

window.ChatAppLoaderStorage={
    prefix:PREFIX,
    save:(key,value)=>localStorage.setItem(storageKey(key),String(value||'')),
    get:key=>localStorage.getItem(storageKey(key)),
    remove:key=>localStorage.removeItem(storageKey(key)),
    clear:()=>{
        const keys=[];
        for(let i=0;i<localStorage.length;i++){
            const currentKey=localStorage.key(i);
            if(currentKey&&currentKey.startsWith(PREFIX))keys.push(currentKey);
        }
        keys.forEach(currentKey=>localStorage.removeItem(currentKey));
    }
};
})();
