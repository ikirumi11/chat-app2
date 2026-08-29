/* =====================================================
   LOW-BANDWIDTH SCREEN SHARE
   Captures the user's chosen screen, scales it down to the
   selected resolution, JPEG-compresses each frame, and
   publishes the small image through the server.
===================================================== */
(() => {
    "use strict";

    const button = document.getElementById("screenShareHeaderBtn");
    if (!button) return;

    const API = "/api/screen-share";
    const QUALITY_VALUES = [150,200,250,300,350,400,450];
    const FPS_VALUES = [5,10,15,20,25];
    const savedQ=Number(localStorage.getItem("screen_share_quality"));
    const savedF=Number(localStorage.getItem("screen_share_fps"));
    let quality=QUALITY_VALUES.includes(savedQ)?savedQ:450;
    let fps=FPS_VALUES.includes(savedF)?savedF:25;
    let sharing=false, frozen=false, stream=null, timer=null, busy=false;
    let currentShare=null;

    const style=document.createElement("style");
    style.textContent=`
    #screenShareSettingsOverlay{position:fixed;inset:0;z-index:10000;display:none;align-items:flex-start;justify-content:flex-end;padding:72px 18px;background:rgba(0,0,0,.18)}
    #screenShareSettingsOverlay.show{display:flex}
    #screenShareSettingsMenu{width:min(360px,calc(100vw - 36px));background:var(--panel,#20242b);color:var(--text,#fff);border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45);overflow:hidden}
    .ss-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.09)}
    .ss-close{border:0;background:transparent;color:inherit;font-size:22px;cursor:pointer}.ss-body{padding:16px;display:grid;gap:12px}.ss-setting{display:grid;gap:6px}.ss-setting label{font-size:13px;opacity:.75}.ss-setting select{padding:10px;border-radius:8px;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12)}
    .ss-btn{border:0;border-radius:8px;padding:10px;color:inherit;background:rgba(255,255,255,.1);font-weight:600;cursor:pointer}.ss-danger{background:rgba(180,50,50,.35)}
    #screenShareViewer{position:fixed;right:18px;bottom:90px;z-index:9000;width:min(560px,calc(100vw - 36px));background:var(--panel,#20242b);border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.5);overflow:hidden;display:none}
    #screenShareViewer.show{display:block}.ss-view-head{padding:10px 12px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;gap:10px}.ss-live{font-weight:600}.ss-image{display:block;width:100%;max-height:420px;object-fit:contain;background:#000}.ss-controls{display:flex;gap:8px;padding:10px}.ss-controls button{flex:1}.ss-muted{font-size:12px;opacity:.65}
    `;
    document.head.appendChild(style);

    const overlay=document.createElement("div");
    overlay.id="screenShareSettingsOverlay";
    overlay.innerHTML=`<div id="screenShareSettingsMenu"><div class="ss-head"><strong>🖥️ Screen Share</strong><button class="ss-close">×</button></div><div class="ss-body"><div class="ss-setting"><label>Quality</label><select id="ssQuality">${QUALITY_VALUES.map(v=>`<option value="${v}">${v}p</option>`).join("")}</select></div><div class="ss-setting"><label>FPS</label><select id="ssFps">${FPS_VALUES.map(v=>`<option value="${v}">${v} FPS</option>`).join("")}</select></div><button class="ss-btn" id="ssStart">Start screen share</button></div></div>`;
    document.body.appendChild(overlay);

    const viewer=document.createElement("div");
    viewer.id="screenShareViewer";
    viewer.innerHTML=`<div class="ss-view-head"><span id="ssHostLabel" class="ss-live">🖥️ Screen Share</span><span id="ssShareStatus" class="ss-muted">Live</span></div><img id="ssImage" class="ss-image" alt="Shared screen"><div class="ss-controls" id="ssHostControls" style="display:none"><button class="ss-btn" id="ssFreeze">Freeze</button><button class="ss-btn ss-danger" id="ssStop">Stop</button></div>`;
    document.body.appendChild(viewer);

    const q=overlay.querySelector("#ssQuality"), f=overlay.querySelector("#ssFps"), start=overlay.querySelector("#ssStart");
    q.value=String(quality);f.value=String(fps);
    const img=viewer.querySelector("#ssImage"), hostLabel=viewer.querySelector("#ssHostLabel"), status=viewer.querySelector("#ssShareStatus"), hostControls=viewer.querySelector("#ssHostControls"), freezeBtn=viewer.querySelector("#ssFreeze"), stopBtn=viewer.querySelector("#ssStop");

    function username(){ return window.settings?.username || localStorage.getItem("chat_username") || "User"; }
    function device(){ return localStorage.getItem("chat_device_id") || ""; }
    function channel(){ return window.CHANNEL || "general"; }
    async function call(action,extra={}){ const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,device_id:device(),channel:channel(),username:username(),quality,fps,...extra})}); let d={};try{d=await r.json()}catch{};if(!r.ok)throw new Error(d.error||"Screen share request failed");return d; }

    function openMenu(){ q.value=String(quality);f.value=String(fps);overlay.classList.add("show"); }
    function closeMenu(){overlay.classList.remove("show");}

    async function startShare(){
        quality=Number(q.value);fps=Number(f.value);localStorage.setItem("screen_share_quality",quality);localStorage.setItem("screen_share_fps",fps);
        if(!navigator.mediaDevices?.getDisplayMedia){alert("Screen sharing is not supported by this browser.");return;}
        try{
            const result=await call("start");
            if(result.alreadyHost){ sharing=true; frozen=false; currentShare=result.share; beginCapture(); closeMenu(); return; }
            stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:fps,max:fps}},audio:false});
            const track=stream.getVideoTracks()[0];
            track.addEventListener("ended",()=>stopShare());
            sharing=true;frozen=false;currentShare=result.share;closeMenu();
            showHost();beginCapture();
        }catch(e){ if(e.message.includes("already sharing")) alert("Someone else is already sharing their screen."); else if(e.name!=="NotAllowedError") alert(e.message||"Could not start screen sharing."); }
    }

    function beginCapture(){
        clearInterval(timer);
        const video=document.createElement("video");video.srcObject=stream;video.muted=true;video.playsInline=true;
        const canvas=document.createElement("canvas");
        const ctx=canvas.getContext("2d",{alpha:false});
        const send=async()=>{
            if(!sharing||frozen||busy||!stream)return;
            if(video.readyState<2){try{await video.play()}catch{return}}
            const vw=video.videoWidth||16,vh=video.videoHeight||9;const scale=Math.min(quality/vw,quality/vh);canvas.width=Math.max(2,Math.round(vw*scale));canvas.height=Math.max(2,Math.round(vh*scale));ctx.drawImage(video,0,0,canvas.width,canvas.height);
            const data=canvas.toDataURL("image/jpeg",.45); // deliberately small low-storage image
            busy=true;try{await call("frame",{image:data})}catch(e){}finally{busy=false}
        };
        video.play().catch(()=>{});send();timer=setInterval(send,1000/fps);
    }

    function showHost(){ viewer.classList.add("show");hostControls.style.display="flex";hostLabel.textContent="🖥️ You are hosting";status.textContent=frozen?"Frozen":"Live"; }
    function showViewer(s){ if(!s?.image)return;viewer.classList.add("show");hostControls.style.display=s.deviceId===device()?"flex":"none";hostLabel.textContent=s.deviceId===device()?"🖥️ You are hosting":"🖥️ Screen shared by "+(s.username||"User");status.textContent=s.frozen?"Frozen":"Live";if(img.src!==s.image)img.src=s.image; }

    async function freeze(){ try{frozen=!frozen;await call("freeze",{frozen});freezeBtn.textContent=frozen?"Resume":"Freeze";status.textContent=frozen?"Frozen":"Live";}catch{frozen=!frozen;} }
    async function stopShare(){ if(!sharing)return;sharing=false;frozen=false;clearInterval(timer);timer=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}try{await call("stop")}catch{}viewer.classList.remove("show");img.removeAttribute("src");hostControls.style.display="none"; }

    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openMenu()});
    overlay.querySelector(".ss-close").onclick=closeMenu;
    overlay.addEventListener("click",e=>{if(e.target===overlay)closeMenu()});
    start.onclick=startShare;freezeBtn.onclick=freeze;stopBtn.onclick=stopShare;

    // Poll the single shared low-resolution JPEG. A small delay is expected.
    async function poll(){
        try{const r=await fetch(API+"?channel="+encodeURIComponent(channel()));const d=await r.json();const s=d.share;if(s){currentShare=s;showViewer(s)}else if(!sharing)viewer.classList.remove("show");}
        catch{}
    }
    setInterval(poll,1000);
    poll();
})();
