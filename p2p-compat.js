(()=>{
'use strict';
const base=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const response=await base(input,init);
 try{
  const url=typeof input==='string'?input:input?.url||'';
  const method=String(init.method||(typeof input!=='string'?input.method:'GET')).toUpperCase();
  if(method==='GET'&&new URL(url,location.href).pathname.endsWith('/api/messages')){
   const json=await response.clone().json();
   if(Array.isArray(json)) return new Response(JSON.stringify({messages:json}),{status:response.status,headers:{'Content-Type':'application/json'}});
  }
 }catch{}
 return response;
};
})();