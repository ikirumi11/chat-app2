/* Chat App 2 — custom local save location. */
(()=>{'use strict';
const FILE_NAME='chat-app2-local-data.json';
let dirHandle=null;
let data={messages:[],updated_at:null};
const originalFetch=window.fetch.bind(window);

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

function status(text,ok=false){
  let e=document.getElementById('customSaveStatus');
  if(!e){
    e=document.createElement('button');
    e.id='customSaveStatus';
    e.type='button';
    e.style.cssText='position:fixed;top:7px;left:8px;z-index:100000;font:600 11px/1.2 system-ui,sans-serif;background:transparent;border:0;padding:0;cursor:pointer;white-space:nowrap';
    document.body.appendChild(e);
    e.onclick=openPanel;
  }
  e.textContent=text;
  e.style.color=ok?'#9fddb4':'#ff9fa9';
}

function valid(){return !!dirHandle}

async function permission(){
  if(!dirHandle)return false;
  try{
    if(dirHandle.queryPermission){
      let p=await dirHandle.queryPermission({mode:'readwrite'});
      if(p==='granted')return true;
      p=await dirHandle.requestPermission({mode:'readwrite'});
      return p==='granted';
    }
    return true;
  }catch{return false}
}

async function writeFile(){
  if(!valid())throw Error('Ingen lagringsplass er valgt.');
  if(!(await permission()))throw Error('Tilgang til valgt lagringsplass mangler.');
  const file=await dirHandle.getFileHandle(FILE_NAME,{create:true});
  const writable=await file.createWritable();
  data.updated_at=new Date().toISOString();
  await writable.write(JSON.stringify(data,null,2));
  await writable.close();
}

async function readFile(){
  if(!valid())return false;
  if(!(await permission()))return false;
  try{
    const file=await dirHandle.getFileHandle(FILE_NAME,{create:false});
    const text=await (await file.getFile()).text();
    const parsed=JSON.parse(text);
    if(parsed&&Array.isArray(parsed.messages))data={...data,...parsed,messages:parsed.messages};
    return true;
  }catch(e){
    if(e?.name==='NotFoundError')return true;
    throw e;
  }
}

async function chooseLocation(){
  if(!window.showDirectoryPicker){
    status('Lagring: ❌ Ugyldig – nettleseren støtter ikke valg av mappe');
    alert('Denne nettleseren støtter ikke egendefinert lagringsmappe. Bruk en nettleser med File System Access API, for eksempel Edge eller Chrome på PC.');
    return false;
  }
  try{
    const chosen=await window.showDirectoryPicker({mode:'readwrite'});
    dirHandle=chosen;
    if(!(await permission()))throw Error('Tilgang til mappen ble ikke godkjent.');
    await readFile();
    await writeFile();
    await saveHandle();
    status(`Lagring: ✓ Valgt mappe · ${data.messages.length} lagret`,'ok');
    return true;
  }catch(e){
    status('Lagring: ❌ Ugyldig – ingen lagringsplass valgt');
    return false;
  }
}

async function saveHandle(){
  try{
    const d=await new Promise((res,rej)=>{const r=indexedDB.open('chat-app2-save-location',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    await new Promise((res,rej)=>{const t=d.transaction('settings','readwrite');t.objectStore('settings').put({id:'directory',handle:dirHandle});t.oncomplete=res;t.onerror=()=>rej(t.error)});
  }catch{}
}

async function loadHandle(){
  try{
    const d=await new Promise((res,rej)=>{const r=indexedDB.open('chat-app2-save-location',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    const row=await new Promise((res,rej)=>{const r=d.transaction('settings','readonly').objectStore('settings').get('directory');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
    if(row?.handle){dirHandle=row.handle;if(await permission()){await readFile();return true;}}
  }catch{}
  return false;
}

async function saveMessage(m){
  if(!m?.id)throw Error('Meldingen mangler ID.');
  if(!valid())throw Error('Ingen lagringsplass er valgt.');
  const i=data.messages.findIndex(x=>x?.id===m.id);
  if(i>=0)data.messages[i]=m;else data.messages.push(m);
  await writeFile();
  return true;
}

async function deleteMessage(id){
  if(!valid())throw Error('Ingen lagringsplass er valgt.');
  data.messages=data.messages.filter(m=>m?.id!==id);
  await writeFile();
}

function panelHtml(){
  const supported=!!window.showDirectoryPicker;
  return `<b>💾 Egendefinert lagringsplass</b><br><br><b>Status:</b> ${valid()?'✓ Gyldig lagringsplass valgt':'❌ Ugyldig – ingen lagringsplass valgt'}<br><b>Fil:</b> ${FILE_NAME}<br><b>Lagrede meldinger:</b> ${data.messages.length}<br><br><span style="color:#c8d0da">Du velger selv mappen. Chat App 2 lagrer lokal chat-data som <b>${FILE_NAME}</b> i akkurat den mappen.</span><br><br>${supported?'<button id="chooseCustomSave">📁 Velg lagringsmappe</button>':'<span style="color:#ff9fa9">Denne nettleseren støtter ikke valg av egendefinert mappe.</span>'} <button id="testCustomSave">🧪 Test</button> <button id="closeCustomSave">Lukk</button><div id="customSaveDetails" style="margin-top:10px;color:#c8d0da"></div>`;
}

async function openPanel(){
  let p=document.getElementById('customSaveInfo');
  if(p)p.remove();
  p=document.createElement('div');
  p.id='customSaveInfo';
  p.style.cssText='position:fixed;top:30px;left:8px;z-index:100001;width:min(560px,calc(100vw - 16px));padding:12px;border-radius:12px;background:#151a21;border:1px solid #343d49;box-shadow:0 12px 40px rgba(0,0,0,.35);color:#dce3eb;font:12px/1.5 system-ui,sans-serif;max-height:calc(100vh - 45px);overflow:auto';
  p.innerHTML=panelHtml();
  document.body.appendChild(p);
  p.querySelector('#closeCustomSave')?.addEventListener('click',()=>p.remove());
  p.querySelector('#chooseCustomSave')?.addEventListener('click',async()=>{await chooseLocation();if(document.body.contains(p)){p.innerHTML=panelHtml();p.querySelector('#closeCustomSave')?.addEventListener('click',()=>p.remove());p.querySelector('#chooseCustomSave')?.addEventListener('click',chooseLocation);p.querySelector('#testCustomSave')?.addEventListener('click',testSave)}});
  p.querySelector('#testCustomSave')?.addEventListener('click',testSave);
}

async function testSave(){
  if(!valid()){status('Lagring: ❌ Ugyldig – velg lagringsplass først');return;}
  try{
    await writeFile();
    status(`Lagring: ✓ Lagret · ${data.messages.length} lagret`,'ok');
    alert(`Lagringstest bestått. Filen er skrevet til den valgte mappen:\n${FILE_NAME}`);
  }catch(e){
    status('Lagring: ❌ Ugyldig – kunne ikke skrive til valgt plass');
  }
}

window.ChatApp2LocalSave={
  chooseLocation,
  hasLocation:()=>valid(),
  save:async(name,value)=>{
    if(!valid())throw Error('Ingen lagringsplass er valgt.');
    if(!data.app)data.app={};
    data.app[name]=value;
    await writeFile();
  },
  load:(name)=>data.app?.[name],
  getMessages:()=>data.messages.slice()
};

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  const method=String(init.method||(typeof input!=='string'?input.method:'GET')||'GET').toUpperCase();
  if(!url.includes('/api/messages'))return originalFetch(input,init);
  let body={};
  if(init.body){try{body=JSON.parse(init.body)}catch{}}
  if(body.game_server===true)return originalFetch(input,init);

  if(method==='GET'){
    if(!valid()){
      status('Lagring: ❌ Ugyldig – velg lagringsplass');
      const r=await originalFetch(input,init);
      try{
        const d=await r.clone().json();
        const games=Array.isArray(d?.messages)?d.messages.filter(m=>m?.username==='__GAME_SERVER__'||m?.game_state===true||(typeof m?.message==='string'&&m.message.startsWith('__CHAT_GAME_STATE__:'))):[];
        return new Response(JSON.stringify({...d,success:true,messages:games}),{status:r.status,headers:{'Content-Type':'application/json'}});
      }catch{return r}
    }
    try{
      await readFile();
      const r=await originalFetch(input,init),d=await r.clone().json();
      const games=Array.isArray(d?.messages)?d.messages.filter(m=>m?.username==='__GAME_SERVER__'||m?.game_state===true||(typeof m?.message==='string'&&m.message.startsWith('__CHAT_GAME_STATE__:'))):[];
      return new Response(JSON.stringify({...d,success:true,messages:[...games,...data.messages].sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0))}),{status:r.status,headers:{'Content-Type':'application/json'}});
    }catch{return originalFetch(input,init)}
  }

  if(method==='POST'||method==='PATCH'||method==='DELETE'){
    if(method!=='DELETE'&&!valid()){
      status('Lagring: ❌ Ugyldig – velg lagringsplass');
      throw Error('Chat App 2: Ingen egendefinert lagringsplass er valgt. Velg en mappe før du sender.');
    }
    try{
      const r=await originalFetch(input,init);
      if(!r.ok){if(method!=='DELETE')status(`Lagring: ❌ Ugyldig – server HTTP ${r.status}`);return r}
      let d=null;try{d=await r.clone().json()}catch{}
      const m=d?.message||body;
      if(method!=='DELETE'&&m?.id){await saveMessage(m);status(`Lagring: ✓ Lagret · ${data.messages.length} lagret`,'ok')}
      if(method==='DELETE'){
        if(body.delete_all){data.messages=[];if(valid())await writeFile()}
        else if(body.id)await deleteMessage(body.id);
      }
      return r;
    }catch(e){if(method!=='DELETE')status('Lagring: ❌ Ugyldig – kunne ikke lagre');throw e}
  }
  return originalFetch(input,init);
};

window.addEventListener('chat:p2p-message',async e=>{
  const m=e.detail;
  if(!m?.id)return;
  if(!valid()){status('Lagring: ❌ Ugyldig – velg lagringsplass');return;}
  try{await saveMessage(m);status(`Lagring: ✓ Lagret · ${data.messages.length} lagret`,'ok')}catch{status('Lagring: ❌ Ugyldig – kunne ikke lagre')}
});

async function start(){
  status('Lagring: ❌ Ugyldig – ingen lagringsplass valgt');
  await loadHandle();
  if(valid())status(`Lagring: ✓ Valgt mappe · ${data.messages.length} lagret`,'ok');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();