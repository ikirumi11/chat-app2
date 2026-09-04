(()=>{
'use strict';
const KEY='chat_profile_cache_v2';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
const save=x=>localStorage.setItem(KEY,JSON.stringify(x));
let cache=load();
function cacheProfile(p){
 if(!p||!p.deviceId)return;
 const old=cache[p.deviceId];
 if(!old||Number(p.updatedAt||0)>=Number(old.updatedAt||0)){
  cache[p.deviceId]={name:String(p.name||'User').slice(0,24),pfp:typeof p.pfp==='string'?p.pfp:'',updatedAt:Number(p.updatedAt||Date.now())};
  save(cache);
 }
}
function readProfileMessage(m){if(m?.username!=='__PROFILE__')return;try{cacheProfile(JSON.parse(m.message||'{}'))}catch{}}
function injectCached(data){
 if(!Array.isArray(data))return data;
 const existing=new Set(data.map(m=>m.id));
 for(const [id,p] of Object.entries(cache)){
  const pid='cached-profile-'+id;
  if(existing.has(pid))continue;
  data.push({id:pid,username:'__PROFILE__',device_id:id,message:JSON.stringify({type:'profile',deviceId:id,name:p.name,pfp:p.pfp,updatedAt:p.updatedAt}),created_at:new Date(p.updatedAt||0).toISOString(),cached_profile:true});
 }
 return data;
}
const oldFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const response=await oldFetch(input,init);
 try{
  const url=typeof input==='string'?input:input?.url||'';
  const parsed=new URL(url,location.href);
  const method=String(init.method||(typeof input!=='string'?input.method:'GET')).toUpperCase();
  if(parsed.pathname.endsWith('/api/messages')&&method==='GET'){
   const json=await response.clone().json();
   const arr=Array.isArray(json)?json:(Array.isArray(json.messages)?json.messages:null);
   if(arr){arr.forEach(readProfileMessage);const out=injectCached([...arr]);return new Response(JSON.stringify(Array.isArray(json)?out:{...json,messages:out}),{status:response.status,headers:{'Content-Type':'application/json'}})}
  }
 }catch{}
 return response;
};
window.addEventListener('chat:p2p-message',e=>readProfileMessage(e.detail));
function wipe(){cache={};localStorage.removeItem(KEY);localStorage.removeItem('chat_profile_pfp');window.dispatchEvent(new CustomEvent('chat:profiles-cleared'));}
window.__chatProfiles={get:()=>({...cache}),wipe};
function inject(){
 const b=document.getElementById('wipeProfilesBtn');
 if(!b)return;
 if(b.dataset.bound)return;
 b.dataset.bound='1';
 b.onclick=()=>{if(confirm('Wipe all saved usernames and profile pictures from this device?')){wipe();alert('Saved profiles wiped from this device.');}};
}
document.addEventListener('DOMContentLoaded',inject);new MutationObserver(inject).observe(document.documentElement,{childList:true,subtree:true});
})();