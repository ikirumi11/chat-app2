/* Drawing app for Chat App 2.
   Drawings can be sent as an image, a canvas timelapse video, or both.
*/
(() => {
  'use strict';

  const STYLE = `
    .draw-overlay{z-index:11000}
    .draw-panel{width:min(1000px,96vw);height:min(900px,94vh);display:flex;flex-direction:column}
    .draw-panel .panel-body{display:flex;flex-direction:column;min-height:0;flex:1}
    .draw-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px;border:1px solid #303641;border-radius:14px;background:#171a20;margin-bottom:10px}
    .draw-toolbar label{font-size:12px;color:#aeb6c2;font-weight:700;display:flex;align-items:center;gap:6px}
    .draw-toolbar input[type=range]{width:90px}
    .draw-toolbar input[type=color]{width:34px;height:30px;border:0;background:none;padding:0;cursor:pointer}
    .draw-tool{border:1px solid #353b46;background:#20242b;color:#e9edf2;border-radius:9px;padding:8px 11px;cursor:pointer;font-weight:700}
    .draw-tool:hover{background:#2a2f38}
    .draw-tool.active{background:#6654e8;border-color:#7b6aff}
    .draw-stage{position:relative;flex:1;min-height:260px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #303641;border-radius:16px;background:repeating-conic-gradient(#f1f1f1 0 25%,#ddd 0 50%) 50%/24px 24px}
    #drawCanvas{display:block;max-width:100%;max-height:100%;width:auto;height:auto;background:#fff;box-shadow:0 14px 40px rgba(0,0,0,.3);touch-action:none;cursor:crosshair}
    .draw-bottom{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
    .draw-toggles{display:flex;align-items:center;gap:12px;color:#b8c0ca;font-size:13px}
    .draw-toggle{display:flex;align-items:center;gap:7px}
    .draw-send{border:0;border-radius:10px;padding:10px 16px;background:#6654e8;color:#fff;font-weight:800;cursor:pointer}
    .draw-send:hover{filter:brightness(1.08)}
    .draw-status{font-size:12px;color:#8f98a5;min-height:16px}
    @media(max-width:650px){.draw-toolbar{gap:5px}.draw-toolbar input[type=range]{width:70px}.draw-stage{min-height:230px}.draw-bottom{align-items:stretch}.draw-send{width:100%}}
  `;

  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function injectStyle(){
    if(document.getElementById('draw-app-style')) return;
    const s=document.createElement('style');s.id='draw-app-style';s.textContent=STYLE;document.head.appendChild(s);
  }

  function openDrawApp(){
    injectStyle();
    const old=document.querySelector('.draw-overlay');if(old)old.remove();

    const overlay=document.createElement('div');
    overlay.className='overlay draw-overlay';overlay.style.display='flex';
    overlay.innerHTML=`
      <div class="panel draw-panel">
        <div class="panel-header"><h2>🎨 Draw</h2><button class="icon-btn draw-close" type="button">×</button></div>
        <div class="panel-body">
          <div class="draw-toolbar">
            <button class="draw-tool active" data-tool="pen" type="button">✏️ Pen</button>
            <button class="draw-tool" data-tool="eraser" type="button">🧽 Eraser</button>
            <label>Color <input id="drawColor" type="color" value="#20242b"></label>
            <label>Size <input id="drawSize" type="range" min="1" max="60" value="6"><span id="drawSizeValue">6px</span></label>
            <button class="draw-tool" id="drawUndo" type="button">↶ Undo</button>
            <button class="draw-tool" id="drawRedo" type="button">↷ Redo</button>
            <button class="draw-tool" id="drawClear" type="button">🗑 Clear</button>
          </div>
          <div class="draw-stage"><canvas id="drawCanvas" width="1200" height="700"></canvas></div>
          <div class="draw-bottom">
            <div>
              <div class="draw-toggles">
                <label class="draw-toggle"><input id="drawSendImage" type="checkbox" checked> Send image</label>
                <label class="draw-toggle"><input id="drawSendTimelapse" type="checkbox"> Send timelapse</label>
              </div>
              <div class="draw-status" id="drawStatus">Draw something, then choose what to send.</div>
            </div>
            <button class="draw-send" id="drawSend" type="button">Send to Public Chat</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const canvas=overlay.querySelector('#drawCanvas');
    const ctx=canvas.getContext('2d',{alpha:false});
    const color=overlay.querySelector('#drawColor');
    const size=overlay.querySelector('#drawSize');
    const sizeValue=overlay.querySelector('#drawSizeValue');
    const status=overlay.querySelector('#drawStatus');
    const sendImage=overlay.querySelector('#drawSendImage');
    const sendTimelapse=overlay.querySelector('#drawSendTimelapse');
    let tool='pen',drawing=false,last=null,history=[],historyIndex=-1,startedAt=Date.now(),frames=[];
    const maxFrames=180;

    function blank(){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)}
    function snapshot(){return canvas.toDataURL('image/png')}
    function pushHistory(){
      const shot=snapshot();
      history=history.slice(0,historyIndex+1);history.push(shot);historyIndex=history.length-1;
      if(history.length>25){history.shift();historyIndex--}
    }
    function restore(data){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);};img.src=data}
    function pos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
    function drawPoint(a,b){
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Number(size.value);
      ctx.strokeStyle=color.value;ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }
    function captureFrame(){
      if(!sendTimelapse.checked)return;
      if(frames.length>=maxFrames)frames.shift();
      frames.push({data:snapshot(),t:Date.now()-startedAt});
    }
    function down(e){e.preventDefault();drawing=true;last=pos(e);canvas.setPointerCapture?.(e.pointerId);captureFrame()}
    function move(e){if(!drawing)return;e.preventDefault();const p=pos(e);drawPoint(last,p);last=p;captureFrame()}
    function up(){if(!drawing)return;drawing=false;last=null;pushHistory();captureFrame()}

    blank();pushHistory();
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
    overlay.querySelector('.draw-close').onclick=()=>overlay.remove();
    overlay.querySelectorAll('.draw-tool[data-tool]').forEach(b=>b.onclick=()=>{overlay.querySelectorAll('.draw-tool[data-tool]').forEach(x=>x.classList.remove('active'));b.classList.add('active');tool=b.dataset.tool});
    size.oninput=()=>sizeValue.textContent=size.value+'px';
    overlay.querySelector('#drawUndo').onclick=()=>{if(historyIndex>0){historyIndex--;restore(history[historyIndex])}};
    overlay.querySelector('#drawRedo').onclick=()=>{if(historyIndex<history.length-1){historyIndex++;restore(history[historyIndex])}};
    overlay.querySelector('#drawClear').onclick=()=>{blank();pushHistory();captureFrame()};
    sendTimelapse.onchange=()=>{if(sendTimelapse.checked&&frames.length===0)captureFrame()};

    async function canvasBlob(){return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create drawing image.')),'image/png'))}
    async function makeTimelapse(){
      if(frames.length<2)captureFrame();
      if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('Timelapse recording is not supported by this browser.');
      const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
      if(!mime)throw new Error('This browser does not support WebM timelapses.');
      const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const x=c.getContext('2d');const stream=c.captureStream(12);const rec=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1800000});const chunks=[];
      const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>e.data?.size&&chunks.push(e.data);rec.onerror=()=>reject(new Error('Timelapse recording failed.'));rec.onstop=()=>resolve(new Blob(chunks,{type:mime}))});
      rec.start();
      const images=await Promise.all(frames.map(f=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=f.data})));
      for(const im of images){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);await new Promise(r=>setTimeout(r,70))}
      rec.stop();return done;
    }

    overlay.querySelector('#drawSend').onclick=async()=>{
      const wantImage=sendImage.checked,wantVideo=sendTimelapse.checked;
      if(!wantImage&&!wantVideo){status.textContent='Choose Send image, Send timelapse, or both.';return}
      const button=overlay.querySelector('#drawSend');button.disabled=true;status.textContent='Preparing drawing…';
      try{
        const payloads=[];
        if(wantImage){
          const blob=await canvasBlob();
          const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
          payloads.push({kind:'image',data,name:'drawing.png',type:'image/png',size:blob.size})
        }
        if(wantVideo){status.textContent='Rendering timelapse…';const blob=await makeTimelapse();const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});payloads.push({kind:'video',data,name:'drawing-timelapse.webm',type:'video/webm',size:blob.size})}
        status.textContent='Sending to Public Chat…';
        for(const p of payloads){
          const body={message:p.kind==='image'?'🎨 Drawing':'🎞️ Drawing timelapse',image:p.kind==='image'?p.data:null,files:p.kind==='video'?[p]:[]};
          const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
          if(!r.ok){const text=await r.text();throw new Error(text||'Server rejected the drawing.')}
        }
        status.textContent='Sent!';setTimeout(()=>overlay.remove(),450);
      }catch(e){console.error(e);status.textContent='Could not send: '+(e?.message||'Unknown error');}
      finally{button.disabled=false}
    };
  }

  window.openDrawApp=openDrawApp;
  function init(){
    const btn=document.getElementById('drawBtn');
    if(btn)btn.addEventListener('click',openDrawApp);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
