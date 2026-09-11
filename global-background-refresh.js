(() => {
  'use strict';

  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxr1kygpsBA_ksVaCPblX-8i0yIVlrW6AxNwrm1tKRfDfF9xFtBN1wz4cUm0MhTOhRO/exec';
  const CACHE_KEY = 'chatGlobalBackground.cache.v8';
  const CHECK_INTERVAL = 10000;

  function clean(v){
    if(!v)return '';
    let s=String(v).split('BACKGROUND_BASE64_START').join('').split('BACKGROUND_BASE64_END').join('');
    const comma=s.indexOf(',');
    if(s.trim().startsWith('data:image/')&&comma!==-1)s=s.slice(comma+1);
    return s.trim();
  }

  function apply(raw){
    raw=clean(raw);
    let style=document.getElementById('global-chat-background-style');
    if(!style){style=document.createElement('style');style.id='global-chat-background-style';document.head.appendChild(style);}
    if(!raw){style.textContent='.messages{background-image:none !important;}';return;}
    const data='data:image/jpeg;base64,'+raw;
    const safe=data.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/</g,'%3C');
    style.textContent=`.messages{background-image:linear-gradient(rgba(7,10,15,.34),rgba(7,10,15,.34)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`;
  }

  function getCache(){
    try{return clean(localStorage.getItem(CACHE_KEY)||'');}catch(_){return '';}
  }

  function setCache(raw){
    try{
      raw=clean(raw);
      if(raw)localStorage.setItem(CACHE_KEY,raw);else localStorage.removeItem(CACHE_KEY);
    }catch(_){ }
  }

  async function check(){
    try{
      const response=await fetch(`${BACKEND_URL}?action=getBackground&_=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)return;
      const text=(await response.text()).trim();
      if(!text)return;
      const result=JSON.parse(text);
      if(!result||result.success!==true)return;
      const server=clean(result.background||'');
      const local=getCache();
      if(server!==local){
        setCache(server);
        apply(server);
        window.dispatchEvent(new CustomEvent('chat-global-background-updated'));
      }
    }catch(_){ }
  }

  window.addEventListener('load',()=>{
    setTimeout(check,1000);
    setInterval(check,CHECK_INTERVAL);
  });
})();
