(()=>{'use strict';
const LIMIT=2*1024*1024;
const TYPES=['audio/ogg','audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/aac','audio/flac','audio/*'];
function supported(){return !!window.AudioContext&&!!window.MediaRecorder}
async function compress(file){
 if(!file||file.size<=LIMIT||!file.type.startsWith('audio/')||!supported())return file;
 const AC=window.AudioContext||window.webkitAudioContext;let ctx=null;
 try{
  const buf=await file.arrayBuffer();ctx=new AC();const decoded=await ctx.decodeAudioData(buf.slice(0));
  const channels=Math.min(2,decoded.numberOfChannels||1),rate=Math.min(24000,decoded.sampleRate||44100);
  const src=ctx.createBufferSource(),dest=ctx.createMediaStreamDestination();src.buffer=decoded;src.connect(dest);
  const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime)return file;
  let chunks=[],rec=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:32000});
  const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);rec.onerror=()=>reject(rec.error||Error('Audio compression failed'));rec.onstop=()=>resolve(new Blob(chunks,{type:mime}))});
  src.start();rec.start(250);await new Promise(r=>src.addEventListener('ended',r,{once:true}));rec.stop();const out=await done;
  const final=out.size<=LIMIT?out:await recompress(decoded,mime,16000);
  if(final.size>LIMIT)return file;
  const ext=mime.includes('ogg')?'.ogg':'.webm';return new File([final],file.name.replace(/\.[^.]+$/,ext),{type:mime,lastModified:Date.now()});
 }catch(e){console.warn('Audio compression skipped:',e);return file}finally{try{await ctx?.close()}catch{}}
}
async function recompress(decoded,mime,bitrate){const AC=window.AudioContext||window.webkitAudioContext,ctx=new AC(),src=ctx.createBufferSource(),dest=ctx.createMediaStreamDestination();src.buffer=decoded;src.connect(dest);const chunks=[],rec=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:bitrate});const p=new Promise((res,rej)=>{rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);rec.onerror=()=>rej(rec.error);rec.onstop=()=>res(new Blob(chunks,{type:mime}))});src.start();rec.start(250);await new Promise(r=>src.addEventListener('ended',r,{once:true}));rec.stop();const b=await p;await ctx.close();return b}
async function processInput(input){if(!input?.files?.length)return;const files=Array.from(input.files);let changed=false;for(let i=0;i<files.length;i++){if(files[i].type.startsWith('audio/')&&files[i].size>LIMIT){const old=files[i];const f=await compress(old);if(f!==old){files[i]=f;changed=true;showNotice(old,f)}}}if(changed){try{const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));input.files=dt.files}catch{}}}
function showNotice(oldFile,newFile){const n=document.createElement('div');n.textContent=`Audio reduced: ${(oldFile.size/1048576).toFixed(2)} MB → ${(newFile.size/1048576).toFixed(2)} MB`;n.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:100001;background:#202630;color:#fff;border:1px solid #ffffff22;border-radius:9px;padding:9px 14px;font:13px system-ui';document.body.appendChild(n);setTimeout(()=>n.remove(),3500)}
function install(){const input=document.getElementById('fileInput');if(!input||input.dataset.audioFix)return;if(!supported())return;input.dataset.audioFix='1';input.addEventListener('change',()=>processInput(input),true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});window.AudioCompressor={compress,limit:LIMIT};
})();