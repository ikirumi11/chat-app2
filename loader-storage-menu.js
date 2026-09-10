(()=>{
'use strict';

const REQUEST_TYPE='chat-app-storage-request';
const RESPONSE_TYPE='chat-app-storage-response';
const PREFIX='chat-app2.';
const LOG_LIMIT=200;
const logs=[];

function now(){
    return new Date().toLocaleTimeString([],{
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
    });
}

function addLog(action,key,ok,details){
    logs.unshift({
        time:now(),
        action,
        key:key||'—',
        ok,
        details:details||''
    });
    if(logs.length>LOG_LIMIT)logs.length=LOG_LIMIT;
    renderLogs();
}

function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
    }[c]));
}

function storageEntries(){
    const entries=[];
    for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key&&key.startsWith(PREFIX)){
            const value=localStorage.getItem(key);
            entries.push({
                key:key.slice(PREFIX.length),
                fullKey:key,
                value,
                size:value?value.length:0
            });
        }
    }
    entries.sort((a,b)=>a.key.localeCompare(b.key));
    return entries;
}

function renderStorage(){
    const list=document.getElementById('loaderStorageList');
    const count=document.getElementById('loaderStorageCount');
    if(!list||!count)return;

    const entries=storageEntries();
    count.textContent=`${entries.length} saved item${entries.length===1?'':'s'}`;

    if(!entries.length){
        list.innerHTML='<div class="loaderStorageEmpty">No loader-managed information is currently saved.</div>';
        return;
    }

    list.innerHTML=entries.map(entry=>{
        const value=entry.value||'';
        const preview=value.length>120?value.slice(0,120)+'…':value;
        const image=value.startsWith('data:image/');
        return `<div class="loaderStorageItem">
            <div class="loaderStorageItemTop">
                <strong>${esc(entry.key)}</strong>
                <span>${entry.size.toLocaleString()} chars</span>
            </div>
            <div class="loaderStorageValue">${image?'[profile/image data]':esc(preview||'[empty string]')}</div>
            <div class="loaderStorageItemButtons">
                <button data-loader-copy="${esc(entry.fullKey)}">Copy value</button>
                <button data-loader-remove="${esc(entry.fullKey)}">Remove</button>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-loader-copy]').forEach(button=>{
        button.addEventListener('click',async()=>{
            const key=button.getAttribute('data-loader-copy');
            const value=localStorage.getItem(key);
            try{
                await navigator.clipboard.writeText(value||'');
                addLog('COPY',key.replace(PREFIX,''),true,'Value copied to clipboard.');
            }catch(error){
                addLog('COPY',key.replace(PREFIX,''),false,error?.message||'Clipboard access failed.');
            }
        });
    });

    list.querySelectorAll('[data-loader-remove]').forEach(button=>{
        button.addEventListener('click',()=>{
            const key=button.getAttribute('data-loader-remove');
            try{
                localStorage.removeItem(key);
                addLog('REMOVE',key.replace(PREFIX,''),true,'Item removed.');
                renderStorage();
            }catch(error){
                addLog('REMOVE',key.replace(PREFIX,''),false,error?.message||'Remove failed.');
            }
        });
    });
}

function renderLogs(){
    const list=document.getElementById('loaderStorageLogs');
    if(!list)return;

    if(!logs.length){
        list.innerHTML='<div class="loaderStorageEmpty">No requests have been received yet.</div>';
        return;
    }

    list.innerHTML=logs.map(log=>`<div class="loaderLog ${log.ok?'success':'failure'}">
        <span class="loaderLogTime">${esc(log.time)}</span>
        <span class="loaderLogStatus">${log.ok?'SUCCESS':'FAIL'}</span>
        <span class="loaderLogAction">${esc(log.action)}</span>
        <span class="loaderLogKey">${esc(log.key)}</span>
        <span class="loaderLogDetails">${esc(log.details)}</span>
    </div>`).join('');
}

function injectUI(){
    if(document.getElementById('loaderStorageMenu'))return;

    const style=document.createElement('style');
    style.id='loaderStorageMenuStyle';
    style.textContent=`
#loaderStorageMenu{
    position:fixed;
    top:18px;
    right:18px;
    z-index:2147483647;
    font-family:Inter,Arial,sans-serif;
}
#loaderStorageButton{
    border:1px solid rgba(130,155,230,.35);
    border-radius:12px;
    padding:10px 14px;
    color:#eaf0ff;
    background:rgba(9,14,25,.88);
    box-shadow:0 10px 35px rgba(0,0,0,.35);
    backdrop-filter:blur(16px);
    cursor:pointer;
    font-weight:800;
}
#loaderStoragePanel{
    display:none;
    position:fixed;
    top:70px;
    right:18px;
    width:min(620px,calc(100vw - 36px));
    max-height:calc(100vh - 90px);
    overflow:auto;
    border:1px solid rgba(130,155,230,.32);
    border-radius:18px;
    padding:16px;
    background:rgba(7,11,20,.97);
    color:#eef3ff;
    box-shadow:0 25px 90px rgba(0,0,0,.55);
    backdrop-filter:blur(24px);
}
#loaderStoragePanel.open{display:block}
.loaderStorageHeader{display:flex;align-items:center;justify-content:space-between;gap:12px}
.loaderStorageTitle{font-size:18px;font-weight:900}
.loaderStorageSub{margin-top:4px;color:#8795b0;font-size:11px;line-height:1.5}
.loaderStorageSection{margin-top:16px}
.loaderStorageSectionTitle{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#91a4d1;font-weight:900;margin-bottom:8px}
.loaderStorageActions{display:flex;flex-wrap:wrap;gap:8px}
.loaderStorageActions button,.loaderStorageItemButtons button{border:1px solid #303b56;border-radius:9px;padding:8px 10px;background:#111a2b;color:#e9efff;cursor:pointer;font-size:11px}
.loaderStorageActions button:hover,.loaderStorageItemButtons button:hover,#loaderStorageButton:hover{background:#182541}
.loaderStorageList{display:grid;gap:8px}
.loaderStorageItem{border:1px solid #27324a;border-radius:12px;padding:10px;background:#0c1321}
.loaderStorageItemTop{display:flex;justify-content:space-between;gap:10px;font-size:12px}
.loaderStorageItemTop span{color:#71809b;font-family:monospace;font-size:10px}
.loaderStorageValue{margin-top:7px;color:#9aa8c1;font-family:monospace;font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:70px;overflow:hidden}
.loaderStorageItemButtons{display:flex;gap:7px;margin-top:9px}
.loaderStorageEmpty{padding:12px;border:1px dashed #29344c;border-radius:10px;color:#77859f;font-size:11px}
.loaderLog{display:grid;grid-template-columns:70px 52px 65px 1fr;gap:7px;padding:7px 8px;border-radius:8px;background:#0c1321;margin-bottom:5px;font-family:monospace;font-size:9px}
.loaderLog.success{border-left:3px solid #55d889}
.loaderLog.failure{border-left:3px solid #ff6477}
.loaderLogTime{color:#6f7d97}.loaderLogStatus{font-weight:900}.loaderLog.success .loaderLogStatus{color:#55d889}.loaderLog.failure .loaderLogStatus{color:#ff6477}.loaderLogAction{color:#aab8d4}.loaderLogKey{color:#d9e2f5;overflow:hidden;text-overflow:ellipsis}.loaderLogDetails{grid-column:1/-1;color:#7887a1}
.loaderStorageNotice{padding:10px;border-radius:10px;background:#101a2c;color:#8e9db8;font-size:10px;line-height:1.5}
@media(max-width:600px){#loaderStoragePanel{top:62px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 72px)}#loaderStorageMenu{right:10px;top:10px}.loaderLog{grid-template-columns:60px 48px 55px 1fr}}
`;
    document.head.appendChild(style);

    const wrap=document.createElement('div');
    wrap.id='loaderStorageMenu';
    wrap.innerHTML=`
        <button id="loaderStorageButton" type="button">💾 Storage Log</button>
        <div id="loaderStoragePanel">
            <div class="loaderStorageHeader">
                <div>
                    <div class="loaderStorageTitle">Loader Storage</div>
                    <div class="loaderStorageSub">Shows requests made by GitHub-loaded pages to this loader. Values are stored in this browser's localStorage under the <b>${PREFIX}</b> prefix.</div>
                </div>
                <button id="loaderStorageClose" type="button">✕</button>
            </div>

            <div class="loaderStorageSection">
                <div class="loaderStorageSectionTitle">Storage</div>
                <div id="loaderStorageCount"></div>
                <div class="loaderStorageActions">
                    <button id="loaderStorageRefresh">Refresh</button>
                    <button id="loaderStorageClear">Clear loader saves</button>
                    <button id="loaderStorageLocation">Where is it saved?</button>
                </div>
                <div class="loaderStorageList" id="loaderStorageList"></div>
            </div>

            <div class="loaderStorageSection">
                <div class="loaderStorageSectionTitle">Request log</div>
                <div id="loaderStorageLogs"></div>
            </div>

            <div class="loaderStorageSection loaderStorageNotice" id="loaderStorageLocationInfo" style="display:none">
                This is browser localStorage, not a normal Windows file. There is no safe standard web API that can open its physical folder. To inspect it manually, open your browser's developer tools and look under the site's Local Storage. The button cannot honestly promise to open a real disk folder.
            </div>
        </div>`;
    document.body.appendChild(wrap);

    const panel=document.getElementById('loaderStoragePanel');
    document.getElementById('loaderStorageButton').addEventListener('click',()=>{
        panel.classList.toggle('open');
        renderStorage();
        renderLogs();
    });
    document.getElementById('loaderStorageClose').addEventListener('click',()=>panel.classList.remove('open'));
    document.getElementById('loaderStorageRefresh').addEventListener('click',()=>renderStorage());
    document.getElementById('loaderStorageClear').addEventListener('click',()=>{
        try{
            const count=storageEntries().length;
            storageEntries().forEach(entry=>localStorage.removeItem(entry.fullKey));
            addLog('CLEAR','*',true,`${count} loader item${count===1?'':'s'} removed.`);
            renderStorage();
        }catch(error){
            addLog('CLEAR','*',false,error?.message||'Clear failed.');
        }
    });
    document.getElementById('loaderStorageLocation').addEventListener('click',()=>{
        const info=document.getElementById('loaderStorageLocationInfo');
        info.style.display=info.style.display==='none'?'block':'none';
    });

    renderStorage();
    renderLogs();
}

window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.type!==REQUEST_TYPE)return;

    const action=String(data.action||'');
    const key=String(data.key||'');
    const started=performance.now();

    let ok=true;
    let details='';

    try{
        const fullKey=PREFIX+key;
        if(action==='save'){
            localStorage.setItem(fullKey,String(data.value||''));
            details=`Saved ${String(data.value||'').length.toLocaleString()} chars.`;
        }else if(action==='get'){
            const value=localStorage.getItem(fullKey);
            details=value===null?'Key was not found.':`Returned ${value.length.toLocaleString()} chars.`;
        }else if(action==='remove'){
            localStorage.removeItem(fullKey);
            details='Removed key.';
        }else if(action==='clear'){
            storageEntries().forEach(entry=>localStorage.removeItem(entry.fullKey));
            details='Cleared loader-managed keys.';
        }else{
            ok=false;
            details='Unknown storage action.';
        }
    }catch(error){
        ok=false;
        details=error?.message||'Storage operation failed.';
    }

    addLog(action.toUpperCase(),key,ok,`${details} ${Math.round(performance.now()-started)}ms`);
    renderStorage();
},false);

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',injectUI,{once:true});
}else{
    injectUI();
}
})();
