(() => {
"use strict";

const $=id=>document.getElementById(id);
const WS_URL=(location.protocol==="https:"?"wss://":"ws://")+location.host+"/signal";
const ICE_SERVERS=[
  {urls:"stun:stun.cloudflare.com:3478"},
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun1.l.google.com:19302"}
];
const AVATARS=[["#6b5cff","#4098ff"],["#ff766e","#ffb64f"],["#46d3a2","#4d7eff"],["#c25cff","#ff69b1"],["#49c2f2","#8260ff"],["#f3b45a","#e96b78"],["#62dc8b","#18a0a7"],["#997dff","#ff916b"]];

const state={
  ws:null,myId:"",entered:false,profile:{name:"",avatar:"",avatarIndex:1,sharing:false},
  peers:new Map(),messages:[],seen:new Set(),incoming:new Map(),screen:null,screenPeers:new Map(),pendingIce:new Map(),reconnectTimer:null
};

function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#039;"}[c]))}
function initials(n){const p=String(n||"?").trim().split(/s+/).slice(0,2);return p.map(x=>x[0]).join("").toUpperCase()||"?"}
function avatarHtml(p,extra){p=p||{};extra=extra||"";if(p.avatar)return '<div class="avatar '+extra+'"><img src="'+p.avatar+'" alt=""></div>';const g=AVATARS[(Number(p.avatarIndex)||1)-1]||AVATARS[0];return '<div class="avatar '+extra+'" style="background:linear-gradient(135deg,'+g[0]+','+g[1]+')">'+esc(initials(p.name))+"</div>"}
function toast(text){const e=$("toast");e.textContent=text;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),2400)}
function setConnect(text,kind){$("connectText").textContent=text;$("connectDot").className="state-dot "+(kind||"")}
function setTop(text,good){$("topStatus").textContent=text;$("topStatus").style.color=good?"#77e4bf":""}
function signal(msg){if(state.ws&&state.ws.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(msg))}

function connectSignaling(){
  clearTimeout(state.reconnectTimer);
  if(state.ws&&(state.ws.readyState===WebSocket.OPEN||state.ws.readyState===WebSocket.CONNECTING))return;
  setConnect("Connecting to the temporary network...");
  const ws=new WebSocket(WS_URL);state.ws=ws;
  ws.onopen=()=>{setConnect("Network connected. Discovering everyone...","good");signal({type:"join",profile:state.profile})};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}handleSignal(m)};
  ws.onclose=()=>{if(!state.entered)setConnect("Network unavailable. Retrying...","bad");else setTop("Signaling reconnecting...",false);clearTimeout(state.reconnectTimer);state.reconnectTimer=setTimeout(connectSignaling,1600)};
  ws.onerror=()=>{if(!state.entered)setConnect("Could not reach the temporary network.","bad")};
}

async function ensurePeer(id,profile,initiator){
  if(!id||id===state.myId)return null;
  let peer=state.peers.get(id);
  if(peer&&peer.pc){peer.profile=Object.assign({},peer.profile,profile,{peerId:id});renderMembers();return peer}
  if(!peer){
    peer={id:id,profile:Object.assign({},profile,{peerId:id}),pc:null,dc:null,dataReady:false,connected:false};
    state.peers.set(id,peer)
  }else{
    peer.profile=Object.assign({},peer.profile,profile,{peerId:id});
  }

  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS,bundlePolicy:"max-bundle"});
  peer.pc=pc;
  pc.onicecandidate=e=>{if(e.candidate)signal({type:"ice",to:id,candidate:e.candidate})};
  pc.ondatachannel=e=>bindDataChannel(peer,e.channel);
  pc.onconnectionstatechange=()=>{
    peer.connected=pc.connectionState==="connected";
    if(peer.connected&&state.screen)setTimeout(()=>startScreenToPeer(peer),200);
    if(pc.connectionState==="failed"){try{pc.restartIce()}catch{}}
    if(pc.connectionState==="closed")removePeer(id);
    renderMembers();updateStatus()
  };
  if(initiator){
    const dc=pc.createDataChannel("chat",{ordered:true});
    bindDataChannel(peer,dc);
    try{
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal({type:"offer",to:id,description:pc.localDescription})
    }catch{}
  }
  renderMembers();return peer
}

function bindDataChannel(peer,dc){
  peer.dc=dc;dc.binaryType="arraybuffer";
  dc.onopen=()=>{peer.dataReady=true;try{dc.send(JSON.stringify({type:"profile",profile:state.profile}))}catch{};renderMembers();updateStatus()};
  dc.onmessage=e=>handleData(peer.id,e.data);
  dc.onclose=()=>{peer.dataReady=false;renderMembers();updateStatus()};
}

async function handleOffer(m){
  const p=await ensurePeer(m.from,m.profile||{},false);if(!p)return;
  try{
    await p.pc.setRemoteDescription(m.description);
    const answer=await p.pc.createAnswer();
    await p.pc.setLocalDescription(answer);
    signal({type:"answer",to:p.id,description:p.pc.localDescription});
    await flushIce(p.id)
  }catch{}
}

async function handleAnswer(m){
  const p=state.peers.get(m.from);if(!p||!p.pc)return;
  try{await p.pc.setRemoteDescription(m.description);await flushIce(p.id)}catch{}
}

async function handleIce(m){
  const p=await ensurePeer(m.from,m.profile||{},false);if(!p)return;
  if(p.pc.remoteDescription){try{await p.pc.addIceCandidate(m.candidate)}catch{}}
  else{const q=state.pendingIce.get(p.id)||[];q.push(m.candidate);state.pendingIce.set(p.id,q)}
}

async function flushIce(id){
  const p=state.peers.get(id),q=state.pendingIce.get(id)||[];if(!p||!p.pc||!p.pc.remoteDescription)return;
  for(const c of q){try{await p.pc.addIceCandidate(c)}catch{}}
  state.pendingIce.delete(id)
}

function handleSignal(m){
  if(m.type==="welcome"){
    state.myId=m.id;
    (m.peers||[]).forEach(p=>state.peers.set(p.id,{id:p.id,profile:Object.assign({},p.profile,{peerId:p.id}),pc:null,dc:null,dataReady:false,connected:false}));
    renderMembers();
    (m.peers||[]).forEach(p=>{if(state.myId<p.id)ensurePeer(p.id,p.profile,true)});
    updateStatus();return
  }
  if(m.type==="peer-joined"){
    state.peers.set(m.id,{id:m.id,profile:Object.assign({},m.profile,{peerId:m.id}),pc:null,dc:null,dataReady:false,connected:false});
    if(state.myId<m.id)ensurePeer(m.id,m.profile,true);
    renderMembers();updateStatus();return
  }
  if(m.type==="peer-profile"){
    const p=state.peers.get(m.id);
    if(p){p.profile=Object.assign({},p.profile,m.profile,{peerId:m.id});renderMembers();if(!p.profile.sharing)stopRemoteScreen(m.id)}
    return
  }
  if(m.type==="peer-left"){removePeer(m.id);return}
  if(m.type==="offer")handleOffer(m);
  else if(m.type==="answer")handleAnswer(m);
  else if(m.type==="ice")handleIce(m);
  else if(m.type==="screen-offer")handleScreenOffer(m);
  else if(m.type==="screen-answer")handleScreenAnswer(m);
  else if(m.type==="screen-ice")handleScreenIce(m)
}

function removePeer(id){
  const p=state.peers.get(id);if(!p)return;
  try{p.pc&&p.pc.close()}catch{}
  const entry=state.screenPeers.get(id);if(entry&&entry.pc){try{entry.pc.close()}catch{}}
  state.screenPeers.delete(id);
  state.pendingIce.delete(id);state.peers.delete(id);
  const card=document.querySelector('[data-stream="'+CSS.escape(id)+'"]');if(card)card.remove();
  if(!$("streams").querySelector(".stream-card"))$("noStreams").classList.remove("hidden");
  renderMembers();updateStatus()
}

function dataPeers(){return Array.from(state.peers.values()).filter(p=>p.dataReady&&p.dc&&p.dc.readyState==="open")}
function broadcastData(obj){const raw=JSON.stringify(obj);dataPeers().forEach(p=>{try{p.dc.send(raw)}catch{}})}
function broadcastBytes(buffer){dataPeers().forEach(p=>{try{p.dc.send(buffer)}catch{}})}

function handleData(fromId,payload){
  if(payload instanceof ArrayBuffer){receiveChunk(payload);return}
  if(payload instanceof Blob){payload.arrayBuffer().then(receiveChunk);return}
  let m;try{m=JSON.parse(payload)}catch{return}
  if(m.type==="profile"){const p=state.peers.get(fromId);if(p){p.profile=Object.assign({},p.profile,m.profile,{peerId:fromId});renderMembers();if(!m.profile.sharing)stopRemoteScreen(fromId)}return}
  if(m.type==="message"){receiveMessage(m.message);return}
  if(m.type==="file-start"){startIncoming(m);return}
  if(m.type==="file-end"){finishIncoming(m);return}
}

function sendMessage(text){
  const body=text.trim();if(!body)return;
  if(!dataPeers().length)return toast("Nobody is connected yet.");
  const m={id:crypto.randomUUID(),type:"text",senderId:state.myId,sender:state.profile.name,avatar:state.profile.avatar,avatarIndex:state.profile.avatarIndex,text:body,time:Date.now()};
  receiveMessage(m);broadcastData({type:"message",message:m})
}
function receiveMessage(m){if(!m||state.seen.has(m.id))return;state.seen.add(m.id);state.messages.push(m);renderMessages()}

function renderMessages(){
  const box=$("messages");box.innerHTML="";let day="";
  state.messages.forEach(m=>{
    const d=new Date(m.time),key=d.toLocaleDateString();
    if(key!==day){const s=document.createElement("div");s.className="system";s.textContent=d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});box.appendChild(s);day=key}
    const row=document.createElement("div");row.className="message "+(m.senderId===state.myId?"mine":"");
    const p={name:m.sender,avatar:m.avatar,avatarIndex:m.avatarIndex};
    let body="";
    if(m.type==="text")body='<div class="bubble"><div class="message-text">'+esc(m.text)+'</div></div>';
    else if(m.type==="image")body='<div class="bubble image-bubble"><img src="'+m.dataUrl+'" alt="'+esc(m.name||"image")+'"></div>';
    else body='<div class="bubble"><div class="file-card"><div class="file-icon">◫</div><div><div class="file-name">'+esc(m.name||"file")+'</div><div class="file-meta">'+formatBytes(m.size)+'</div></div></div></div>';
    row.innerHTML=avatarHtml(p)+'<div class="message-body"><div class="message-meta">'+esc(m.sender)+' · '+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</div>'+body+'</div>';
    box.appendChild(row)
  });
  box.scrollTop=box.scrollHeight
}

function membersArray(){return [Object.assign({},state.profile,{peerId:state.myId})].concat(Array.from(state.peers.values()).map(p=>p.profile))}
function memberHtml(p){
  const peer=state.peers.get(p.peerId);
  const connected=p.peerId===state.myId||!!(peer&&peer.dataReady);
  const status=p.peerId===state.myId?"You":p.sharing?"Sharing screen":connected?"P2P connected":"Connecting...";
  return '<div class="member">'+avatarHtml(p)+'<div class="member-info"><div class="member-name"><span>'+esc(p.name)+'</span>'+(p.peerId===state.myId?'<span class="you">YOU</span>':"")+'</div><div class="member-state"><i></i>'+status+'</div></div></div>'
}
function renderMembers(){
  const people=membersArray();people.sort((a,b)=>a.peerId===state.myId?-1:b.peerId===state.myId?1:String(a.name).localeCompare(String(b.name)));
  $("onlineCount").textContent=people.length;
  const html=people.map(memberHtml).join("");
  $("members").innerHTML=html;$("mobileMembers").innerHTML=html
}
function updateStatus(){
  const expected=state.peers.size,ready=dataPeers().length;
  $("meshState").textContent=expected?ready+"/"+expected:"P2P";
  setTop(expected?(ready+"/"+expected+" peers connected"):"Waiting for more peers...",expected===0||ready===expected)
}

function formatBytes(bytes){if(!bytes)return"0 B";const u=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1);return(bytes/Math.pow(1024,i)).toFixed(i?1:0)+" "+u[i]}
async function fileToDataUrl(file,max){
  const b=await createImageBitmap(file),scale=Math.min(1,(max||1800)/Math.max(b.width,b.height));
  const c=document.createElement("canvas");c.width=Math.max(1,Math.round(b.width*scale));c.height=Math.max(1,Math.round(b.height*scale));c.getContext("2d").drawImage(b,0,0,c.width,c.height);b.close();
  return c.toDataURL("image/jpeg",.82)
}
function blobToDataUrl(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}

async function sendImage(file){
  if(!file||!dataPeers().length)return toast("Nobody is connected yet.");
  if(file.size>15*1024*1024)return toast("Choose an image under 15 MB.");
  try{const url=await fileToDataUrl(file,1800),buf=await(await fetch(url)).arrayBuffer();await sendFileBuffer(buf,{kind:"image",name:file.name||"image.jpg",mime:"image/jpeg"})}catch{toast("Could not send that image.")}
}
async function sendFile(file){
  if(!file||!dataPeers().length)return toast("Nobody is connected yet.");
  if(file.size>25*1024*1024)return toast("Choose a file under 25 MB.");
  try{await sendFileBuffer(await file.arrayBuffer(),{kind:"file",name:file.name||"file",mime:file.type||"application/octet-stream"})}catch{toast("Could not send that file.")}
}
async function sendFileBuffer(buffer,meta){
  const id=crypto.randomUUID(),fm={...meta,size:buffer.byteLength,senderId:state.myId,sender:state.profile.name,avatar:state.profile.avatar,avatarIndex:state.profile.avatarIndex,time:Date.now()};
  state.seen.add(id);broadcastData({type:"file-start",id:id,meta:fm});
  const chunkSize=32*1024,total=Math.ceil(buffer.byteLength/chunkSize);
  for(let i=0;i<total;i++){
    const part=buffer.slice(i*chunkSize,Math.min(buffer.byteLength,(i+1)*chunkSize));
    const head=new TextEncoder().encode(JSON.stringify({t:"chunk",id:id})+"
");
    const merged=new Uint8Array(head.byteLength+part.byteLength);merged.set(head);merged.set(new Uint8Array(part),head.byteLength);broadcastBytes(merged.buffer);
    await new Promise(r=>setTimeout(r,0))
  }
  broadcastData({type:"file-end",id:id});
  const dataUrl=meta.kind==="image"?await blobToDataUrl(new Blob([buffer],{type:meta.mime})):"";
  receiveMessage({id:id+"-own",type:meta.kind==="image"?"image":"file",senderId:state.myId,sender:state.profile.name,avatar:state.profile.avatar,avatarIndex:state.profile.avatarIndex,name:meta.name,size:buffer.byteLength,dataUrl:dataUrl,time:fm.time})
}
function startIncoming(m){if(m.id&&m.meta)state.incoming.set(m.id,{meta:m.meta,chunks:[],bytes:0})}
function receiveChunk(buffer){
  const bytes=new Uint8Array(buffer),nl=bytes.indexOf(10);if(nl<0)return;
  let h;try{h=JSON.parse(new TextDecoder().decode(bytes.slice(0,nl)))}catch{return}
  if(h.t!=="chunk")return;const item=state.incoming.get(h.id);if(!item)return;
  const chunk=bytes.slice(nl+1);item.chunks.push(chunk);item.bytes+=chunk.byteLength
}
async function finishIncoming(m){
  const item=state.incoming.get(m.id);if(!item)return;state.incoming.delete(m.id);
  const out=new Uint8Array(item.bytes);let off=0;item.chunks.forEach(c=>{out.set(c,off);off+=c.byteLength});
  const blob=new Blob([out],{type:item.meta.mime||"application/octet-stream"}),dataUrl=item.meta.kind==="image"?await blobToDataUrl(blob):"";
  receiveMessage({id:item.meta.senderId+"-"+m.id,type:item.meta.kind==="image"?"image":"file",senderId:item.meta.senderId,sender:item.meta.sender,avatar:item.meta.avatar,avatarIndex:item.meta.avatarIndex,name:item.meta.name,size:item.meta.size,dataUrl:dataUrl,time:item.meta.time})
}

async function startScreen(){
  if(state.screen)return stopScreen();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia)return toast("Screen sharing is not supported here.");
  if(!dataPeers().length)return toast("Nobody is connected yet.");
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:24,max:30}},audio:true,systemAudio:"include",selfBrowserSurface:"exclude",surfaceSwitching:"include"});
    state.screen=stream;state.profile.sharing=true;
    broadcastData({type:"profile",profile:state.profile});signal({type:"profile",profile:state.profile});
    $("screenBtn").innerHTML="■ <span>Stop sharing</span>";$("screenMenuBtn").textContent="■ Stop sharing";
    addSystem(state.profile.name+" started sharing a screen.");
    const track=stream.getVideoTracks()[0];if(track)track.addEventListener("ended",stopScreen);
    for(const peer of state.peers.values())if(peer.connected)startScreenToPeer(peer);
    renderMembers()
  }catch(e){if(e&&e.name!=="AbortError")toast("Screen sharing was blocked or unavailable.")}
}
async function startScreenToPeer(peer){
  if(!state.screen||!peer||!peer.id)return;
  const old=state.screenPeers.get(peer.id);if(old)return;
  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS,bundlePolicy:"max-bundle"});
  state.screenPeers.set(peer.id,{pc:pc,local:true,queuedIce:[]});
  state.screen.getTracks().forEach(t=>pc.addTrack(t,state.screen));
  pc.onicecandidate=e=>{if(e.candidate)signal({type:"screen-ice",to:peer.id,candidate:e.candidate})};
  pc.onconnectionstatechange=()=>{if(["failed","closed"].includes(pc.connectionState))state.screenPeers.delete(peer.id)};
  try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);signal({type:"screen-offer",to:peer.id,description:pc.localDescription})}catch{}
}
async function handleScreenOffer(m){
  const old=state.screenPeers.get(m.from);if(old&&old.pc){try{old.pc.close()}catch{}}
  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS,bundlePolicy:"max-bundle"}),entry={pc:pc,local:false,queuedIce:[]};
  state.screenPeers.set(m.from,entry);
  pc.onicecandidate=e=>{if(e.candidate)signal({type:"screen-ice",to:m.from,candidate:e.candidate})};
  pc.ontrack=e=>{if(e.streams[0])showRemoteScreen(m.from,e.streams[0])};
  pc.onconnectionstatechange=()=>{if(["failed","closed","disconnected"].includes(pc.connectionState))stopRemoteScreen(m.from)};
  try{await pc.setRemoteDescription(m.description);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);signal({type:"screen-answer",to:m.from,description:pc.localDescription});for(const c of entry.queuedIce){try{await pc.addIceCandidate(c)}catch{}}entry.queuedIce=[]}catch{}
}
async function handleScreenAnswer(m){const e=state.screenPeers.get(m.from);if(!e||!e.local)return;try{await e.pc.setRemoteDescription(m.description)}catch{}}
async function handleScreenIce(m){
  const e=state.screenPeers.get(m.from);if(!e||!e.pc)return;
  if(e.pc.remoteDescription){try{await e.pc.addIceCandidate(m.candidate)}catch{}}else e.queuedIce.push(m.candidate)
}
function showRemoteScreen(id,stream){
  const p=state.peers.get(id)?.profile||{name:"Peer",avatarIndex:1};let card=document.querySelector('[data-stream="'+CSS.escape(id)+'"]');
  if(!card){card=document.createElement("div");card.className="stream-card";card.dataset.stream=id;card.innerHTML='<div class="stream-top">'+avatarHtml(p)+'<div class="who"><strong>'+esc(p.name)+'</strong><small>Screen + audio</small></div><span class="live-pill">LIVE</span></div><video class="stream-video" autoplay playsinline controls></video>';$("streams").appendChild(card);$("noStreams").classList.add("hidden")}
  const video=card.querySelector("video");video.srcObject=stream;video.play().catch(()=>{})
}
function stopRemoteScreen(id,force){
  const e=state.screenPeers.get(id);
  if(e&&e.local&&!force)return;
  if(e&&e.pc){try{e.pc.close()}catch{}}
  state.screenPeers.delete(id);
  const card=document.querySelector('[data-stream="'+CSS.escape(id)+'"]');if(card)card.remove();
  if(!$("streams").querySelector(".stream-card"))$("noStreams").classList.remove("hidden")
}
function stopScreen(){
  if(!state.screen)return;
  state.screen.getTracks().forEach(t=>t.stop());state.screen=null;state.profile.sharing=false;
  broadcastData({type:"profile",profile:state.profile});signal({type:"profile",profile:state.profile});
  for(const [id,e] of state.screenPeers)if(e.local){try{e.pc.close()}catch{}state.screenPeers.delete(id)}
  $("screenBtn").innerHTML="▣ <span>Share screen</span>";$("screenMenuBtn").textContent="▣ Share screen";addSystem(state.profile.name+" stopped sharing.");renderMembers()
}

function addSystem(t){const e=document.createElement("div");e.className="system";e.textContent=t;$("messages").appendChild(e);$("messages").scrollTop=$("messages").scrollHeight}

async function savePdf(){
  if(!state.messages.length)return toast("There is nothing to save yet.");
  const jsPDF=window.jspdf&&window.jspdf.jsPDF;if(!jsPDF)return toast("PDF export is still loading.");
  const doc=new jsPDF({unit:"pt",format:"a4"}),w=595.28,h=841.89,m=42;let y=48;
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text("DropLink chat",m,y);y+=18;doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(100,110,125);doc.text("Temporary live session · "+new Date().toLocaleString(),m,y);y+=26;doc.setTextColor(18,22,28);
  for(const item of state.messages){
    const time=new Date(item.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    if(item.type==="text"){
      const lines=doc.splitTextToSize(item.sender+" · "+time+"
"+item.text,w-m*2-20),bh=19+lines.length*13;
      if(y+bh>h-42){doc.addPage();y=48}
      doc.setFillColor(244,246,249);doc.roundedRect(m,y,w-m*2,bh,8,8,"F");doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(70,80,96);doc.text(lines,m+10,y+15,{lineHeightFactor:1.25});doc.setTextColor(18,22,28);y+=bh+8
    }else if(item.type==="image"&&item.dataUrl){
      if(y+30>h-42){doc.addPage();y=48}doc.setFont("helvetica","bold");doc.setFontSize(9);doc.text(item.sender+" · "+time+" · "+(item.name||"image"),m,y+12);y+=20;
      await new Promise(resolve=>{const img=new Image();img.onload=()=>{const maxW=w-m*2,maxH=280,s=Math.min(1,maxW/img.width,maxH/img.height),iw=img.width*s,ih=img.height*s;if(y+ih>h-42){doc.addPage();y=48}try{doc.addImage(img,"JPEG",m,y,iw,ih,undefined,"FAST")}catch{}y+=ih+22;resolve()};img.onerror=()=>resolve();img.src=item.dataUrl})
    }else{
      if(y+26>h-42){doc.addPage();y=48}doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text(item.sender+" · "+time+" · "+(item.name||"file")+" · "+formatBytes(item.size),m,y);y+=19
    }
  }
  doc.save("droplink-chat.pdf")
}

$("avatarFileBtn").onclick=()=>$("avatarFile").click();
$("avatarFile").onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;if(f.size>6*1024*1024)return toast("Choose a PFP under 6 MB.");try{state.profile.avatar=await fileToDataUrl(f,320);updateAvatarPreview()}catch{toast("Could not use that image.")}};
$("randomAvatar").onclick=()=>{state.profile.avatar="";state.profile.avatarIndex=Math.floor(Math.random()*AVATARS.length)+1;updateAvatarPreview()};
$("name").oninput=()=>{state.profile.name=$("name").value.trim().replace(/s+/g," ").slice(0,28);updateAvatarPreview()};
function updateAvatarPreview(){const p={name:$("name").value||"?",avatar:state.profile.avatar,avatarIndex:state.profile.avatarIndex};$("avatarPreview").outerHTML='<div id="avatarPreview" class="avatar xl">'+(p.avatar?'<img src="'+p.avatar+'" alt="">':'<span>'+esc(initials(p.name))+'</span>')+"</div>"}
$("enterBtn").onclick=()=>{state.profile.name=$("name").value.trim().replace(/s+/g," ").slice(0,28);if(!state.profile.name)return toast("Enter a username.");state.entered=true;$("setup").classList.add("hidden");$("app").classList.remove("hidden");connectSignaling();setTop("Connecting peers...",false)};
$("sendBtn").onclick=()=>{sendMessage($("messageInput").value);$("messageInput").value="";resizeInput()};
$("messageInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("sendBtn").click()}resizeInput()};
function resizeInput(){const e=$("messageInput");e.style.height="auto";e.style.height=Math.min(150,Math.max(42,e.scrollHeight))+"px"}
$("plusBtn").onclick=()=>$("attachMenu").classList.toggle("hidden");
$("sendImageBtn").onclick=()=>{$("attachMenu").classList.add("hidden");$("imageInput").click()};
$("sendFileBtn").onclick=()=>{$("attachMenu").classList.add("hidden");$("fileInput").click()};
$("screenMenuBtn").onclick=()=>{$("attachMenu").classList.add("hidden");startScreen()};
$("screenBtn").onclick=startScreen;
$("imageInput").onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)sendImage(f);e.target.value=""};
$("fileInput").onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)sendFile(f);e.target.value=""};
$("saveBtn").onclick=savePdf;
$("mobilePeople").onclick=()=>$("mobilePanel").classList.remove("hidden");
$("closeMobilePanel").onclick=()=>$("mobilePanel").classList.add("hidden");
$("leaveBtn").onclick=()=>location.reload();
window.addEventListener("beforeunload",()=>{try{if(state.screen)state.screen.getTracks().forEach(t=>t.stop());if(state.ws)state.ws.close()}catch{}});

state.profile.avatarIndex=Math.floor(Math.random()*AVATARS.length)+1;
updateAvatarPreview();
connectSignaling();
})();