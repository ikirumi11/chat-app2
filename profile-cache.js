(()=>{
'use strict';
/*
 * Profile snapshots are message data, not live profile references.
 * A later username/PFP change must never rewrite an older message.
 */
const KEY='chat_profile_cache_v3';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
const save=x=>{try{localStorage.setItem(KEY,JSON.stringify(x))}catch{}};
let cache=load();

function cacheProfile(p){
 if(!p||!p.deviceId)return;
 const old=cache[p.deviceId];
 if(!old||Number(p.updatedAt||0)>=Number(old.updatedAt||0)){
  cache[p.deviceId]={
   name:String(p.name||'User').slice(0,24),
   pfp:typeof p.pfp==='string'?p.pfp:'',
   updatedAt:Number(p.updatedAt||Date.now())
  };
  save(cache);
 }
}

function readProfileMessage(m){
 if(m?.username!=='__PROFILE__')return;
 try{cacheProfile(JSON.parse(m.message||'{}'))}catch{}
}

/*
 * If a message already contains a sender snapshot, preserve it forever.
 * We only attach the currently known profile when the message itself does
 * not contain a snapshot yet. This prevents later profile changes from
 * changing historical messages that already have sender data.
 */
function freezeMessage(m){
 if(!m||m.username==='__PROFILE__')return m;
 const out={...m};
 const id=String(out.device_id||out.deviceId||'');
 const profile=cache[id];
 if(!out.sender_name && !out.profile_name && !out.username_snapshot){
  out.username_snapshot=String(out.username||profile?.name||'User').slice(0,24);
 }
 if(!out.sender_pfp && !out.profile_picture && !out.pfp_snapshot && profile?.pfp){
  out.pfp_snapshot=profile.pfp;
 }
 return out;
}

function processMessages(data){
 if(!Array.isArray(data))return data;
 data.forEach(readProfileMessage);
 return data.map(freezeMessage);
}

const oldFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const response=await oldFetch(input,init);
 try{
  const url=typeof input==='string'?input:input?.url||'';
  const parsed=new URL(url,location.href);
  const method=String(init.method||(typeof input!=='string'?input.method:'GET')||'GET').toUpperCase();
  if(parsed.pathname.endsWith('/api/messages')&&method==='GET'){
   const json=await response.clone().json();
   const arr=Array.isArray(json)?json:(Array.isArray(json.messages)?json.messages:null);
   if(arr){
    const out=processMessages(arr);
    return new Response(JSON.stringify(Array.isArray(json)?out:{...json,messages:out}),{status:response.status,headers:{'Content-Type':'application/json'}});
   }
  }
 }catch{}
 return response;
};

window.addEventListener('chat:p2p-message',e=>{
 const m=e.detail;
 readProfileMessage(m);
 if(m&&m.username!=='__PROFILE__'){
  const frozen=freezeMessage(m);
  if(frozen!==m){
   try{Object.assign(m,frozen)}catch{}
  }
 }
});

function wipe(){
 cache={};
 try{localStorage.removeItem(KEY);localStorage.removeItem('chat_profile_pfp')}catch{}
 window.dispatchEvent(new CustomEvent('chat:profiles-cleared'));
}

window.__chatProfiles={get:()=>({...cache}),wipe};

function inject(){
 const b=document.getElementById('wipeProfilesBtn');
 if(!b||b.dataset.bound)return;
 b.dataset.bound='1';
 b.onclick=()=>{
  if(confirm('Wipe saved profile snapshots from this device?')){
   wipe();
   alert('Saved profile snapshots wiped from this device. Existing message snapshots are unchanged.');
  }
 };
}

document.addEventListener('DOMContentLoaded',inject);
new MutationObserver(inject).observe(document.documentElement,{childList:true,subtree:true});
})();