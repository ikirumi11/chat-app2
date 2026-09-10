/* Global Chat Background — Google Apps Script + Google Doc backend */
(() => {
  'use strict';

  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxr1kygpsBA_ksVaCPblX-8i0yIVlrW6AxNwrm1tKRfDfF9xFtBN1wz4cUm0MhTOhRO/exec';
  const CACHE_KEY = 'chatGlobalBackground.cache.v6';
  const MAX_DIM = 750;
  const MAX_BASE64_CHARS = 1_500_000;
  const DATA_PREFIX = 'data:image/jpeg;base64,';

  let selectedBackground = '';
  let editorState = null;

  function getStyleElement() {
    let style = document.getElementById('global-chat-background-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'global-chat-background-style';
      document.head.appendChild(style);
    }
    return style;
  }

  function cleanRawBase64(value) {
    if (!value) return '';
    let text = String(value);
    text = text.split('BACKGROUND_BASE64_START').join('');
    text = text.split('BACKGROUND_BASE64_END').join('');
    const comma = text.indexOf(',');
    if (text.trim().startsWith('data:image/') && comma !== -1) text = text.slice(comma + 1);
    return text.trim();
  }

  function toDataUrl(raw) {
    const value = cleanRawBase64(raw);
    return value ? DATA_PREFIX + value : '';
  }

  function applyBackground(raw) {
    const style = getStyleElement();
    const dataUrl = toDataUrl(raw);
    const safe = dataUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '%3C');
    style.textContent = safe
      ? `.messages{background-image:linear-gradient(rgba(7,10,15,.34),rgba(7,10,15,.34)),url("${safe}") !important;background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;background-attachment:fixed !important;}`
      : '.messages{background-image:none !important;}';
  }

  function cacheBackground(raw) {
    try {
      const clean = cleanRawBase64(raw);
      if (clean) localStorage.setItem(CACHE_KEY, clean);
      else localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
  }

  function getCachedBackground() {
    try { return cleanRawBase64(localStorage.getItem(CACHE_KEY) || ''); } catch (_) { return ''; }
  }

  async function readServerResponse(response, operation) {
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) throw new Error(`The background server returned an empty response while trying to ${operation}.`);
    let result;
    try { result = JSON.parse(trimmed); }
    catch (_) {
      const preview = trimmed.replace(/\s+/g, ' ').slice(0, 180);
      if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed) || trimmed.includes('<!DOCTYPE')) throw new Error(`The Apps Script deployment returned HTML instead of JSON. Response: ${preview}`);
      throw new Error(`The background server returned invalid JSON. Response: ${preview}`);
    }
    if (!result || result.success !== true) throw new Error(result?.error || `The server could not ${operation}.`);
    return result;
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that image.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not decode that image.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_DIM / img.width, MAX_DIM / img.height);
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas is unavailable.'));
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.82;
          let raw = cleanRawBase64(canvas.toDataURL('image/jpeg', quality));
          while (raw.length > MAX_BASE64_CHARS && quality > 0.42) { quality -= 0.06; raw = cleanRawBase64(canvas.toDataURL('image/jpeg', quality)); }
          if (raw.length > MAX_BASE64_CHARS) return reject(new Error('Image is still too large after compression. Choose a smaller image.'));
          resolve(raw);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function closeEditor() {
    if (editorState) { editorState.remove(); editorState = null; }
    const old = document.getElementById('gbe-style');
    if (old) old.remove();
  }

  function makeEditor(rawBase64, onApply) {
    closeEditor();
    const overlay = document.createElement('div');
    overlay.id = 'globalBackgroundEditor';
    overlay.innerHTML = `<div class="gbe-card"><div class="gbe-head"><strong>Adjust Background</strong><button id="gbeClose">×</button></div><div class="gbe-stage" id="gbeStage"><img id="gbeImage" src="${toDataUrl(rawBase64)}" draggable="false"></div><div class="gbe-controls"><label>Size <input id="gbeScale" type="range" min="25" max="250" value="100"></label><label>Rotation <input id="gbeRotate" type="range" min="-180" max="180" value="0"></label><div class="gbe-buttons"><button id="gbeLeft">↶ 90°</button><button id="gbeRight">↷ 90°</button><button id="gbeCenter">Center</button></div><div class="gbe-hint">Drag the image to move it. Use the wheel or Size slider to zoom.</div><button id="gbeApply" class="gbe-apply">Use This Background</button></div></div>`;
    const style = document.createElement('style');
    style.id = 'gbe-style';
    style.textContent = `#globalBackgroundEditor{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.72);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px}#globalBackgroundEditor .gbe-card{width:min(900px,96vw);max-height:94vh;overflow:auto;background:#151922;border:1px solid #343b49;border-radius:18px;box-shadow:0 20px 70px rgba(0,0,0,.55);color:#eef1f5;padding:16px;font-family:Arial,sans-serif}.gbe-head{display:flex;justify-content:space-between;align-items:center;font-size:18px;margin-bottom:12px}.gbe-head button{background:#252b35;color:#fff;border:0;border-radius:10px;width:36px;height:36px;font-size:24px;cursor:pointer}.gbe-stage{height:min(58vh,520px);min-height:280px;border-radius:14px;overflow:hidden;position:relative;background:repeating-conic-gradient(#20252e 0 25%,#181c23 0 50%) 50%/28px 28px;display:flex;align-items:center;justify-content:center;touch-action:none}.gbe-stage:after{content:'';position:absolute;inset:0;border:1px solid #3a414d;border-radius:14px;pointer-events:none}.gbe-stage img{position:absolute;max-width:none;max-height:none;user-select:none;cursor:grab;transform-origin:center center}.gbe-stage img.dragging{cursor:grabbing}.gbe-controls{padding-top:14px}.gbe-controls label{display:block;font-size:13px;color:#b8c0cc;margin:10px 0}.gbe-controls input[type=range]{width:100%;accent-color:#8d9cff}.gbe-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gbe-buttons button,.gbe-apply{border:0;border-radius:10px;padding:11px 14px;background:#282f3b;color:#fff;cursor:pointer}.gbe-apply{width:100%;background:#5265e8;font-weight:700;margin-top:8px}.gbe-hint{font-size:12px;color:#858e9c}`;
    document.head.appendChild(style); document.body.appendChild(overlay);

    const stage=overlay.querySelector('#gbeStage'), image=overlay.querySelector('#gbeImage'), scaleInput=overlay.querySelector('#gbeScale'), rotateInput=overlay.querySelector('#gbeRotate');
    let scale=1,rotation=0,x=0,y=0,dragging=false,sx=0,sy=0,ox=0,oy=0;
    const render=()=>{image.style.transform=`translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale})`;};
    const center=()=>{x=0;y=0;render();};
    image.onload=()=>center();
    image.onpointerdown=e=>{dragging=true;image.classList.add('dragging');sx=e.clientX;sy=e.clientY;ox=x;oy=y;image.setPointerCapture?.(e.pointerId);};
    image.onpointermove=e=>{if(!dragging)return;x=ox+(e.clientX-sx);y=oy+(e.clientY-sy);render();};
    image.onpointerup=image.onpointercancel=()=>{dragging=false;image.classList.remove('dragging');};
    stage.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.25,Math.min(2.5,scale*(e.deltaY<0?1.08:.925)));scaleInput.value=Math.round(scale*100);render();},{passive:false});
    scaleInput.oninput=()=>{scale=Number(scaleInput.value)/100;render();};
    rotateInput.oninput=()=>{rotation=Number(rotateInput.value);render();};
    overlay.querySelector('#gbeLeft').onclick=()=>{rotation=(rotation-90+180)%360-180;rotateInput.value=rotation;render();};
    overlay.querySelector('#gbeRight').onclick=()=>{rotation=(rotation+90+180)%360-180;rotateInput.value=rotation;render();};
    overlay.querySelector('#gbeCenter').onclick=center;
    overlay.querySelector('#gbeClose').onclick=closeEditor;
    overlay.querySelector('#gbeApply').onclick=()=>{
      const w=Math.max(1,Math.round(image.naturalWidth*scale)),h=Math.max(1,Math.round(image.naturalHeight*scale)),rad=rotation*Math.PI/180;
      const bw=Math.ceil(Math.abs(w*Math.cos(rad))+Math.abs(h*Math.sin(rad))),bh=Math.ceil(Math.abs(w*Math.sin(rad))+Math.abs(h*Math.cos(rad)));
      const fit=Math.min(1,MAX_DIM/Math.max(1,bw),MAX_DIM/Math.max(1,bh));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bw*fit));c.height=Math.max(1,Math.round(bh*fit));
      const ctx=c.getContext('2d');if(!ctx)return;
      ctx.translate(c.width/2+x*fit,c.height/2+y*fit);ctx.rotate(rad);ctx.drawImage(image,-w*fit/2,-h*fit/2,w*fit,h*fit);
      const result=cleanRawBase64(c.toDataURL('image/jpeg',.82));
      if(result.length>MAX_BASE64_CHARS){alert('This edited image is still too large. Zoom out or use a smaller image.');return;}
      onApply(result);closeEditor();
    };
    editorState=overlay;render();
  }

  async function loadGlobalBackground(statusElement){
    const cached=getCachedBackground();if(cached)applyBackground(cached);
    try{if(statusElement)statusElement.textContent='Laster global bakgrunn…';const response=await fetch(`${BACKEND_URL}?action=getBackground&_=${Date.now()}`,{method:'GET',cache:'no-store',redirect:'follow'});if(!response.ok)throw new Error(`Server returned HTTP ${response.status}.`);const result=await readServerResponse(response,'load the background');const background=cleanRawBase64(result.background||'');cacheBackground(background);applyBackground(background);updatePreview(background);if(statusElement)statusElement.textContent=background?'✓ Global bakgrunn lastet.':'Ingen global bakgrunn er satt.';return background;}catch(error){if(statusElement)statusElement.textContent='⚠ '+error.message+(cached?' Bruker sist lagrede bakgrunn.':'');return cached;}
  }

  async function saveGlobalBackground(rawBase64,statusElement){
    const cleanBase64=cleanRawBase64(rawBase64);if(!cleanBase64)return false;
    try{if(statusElement)statusElement.textContent='Sender global bakgrunn…';const response=await fetch(BACKEND_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save',background:cleanBase64}),redirect:'follow'});if(!response.ok)throw new Error(`Server returned HTTP ${response.status}.`);await readServerResponse(response,'save the background');cacheBackground(cleanBase64);applyBackground(cleanBase64);updatePreview(cleanBase64);if(statusElement)statusElement.textContent='✓ Global bakgrunn lagret og aktivert.';return true;}catch(error){if(statusElement)statusElement.textContent='✕ Kunne ikke lagre global bakgrunn: '+error.message;return false;}
  }

  async function clearGlobalBackground(statusElement){
    try{if(statusElement)statusElement.textContent='Fjerner global bakgrunn…';const response=await fetch(BACKEND_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'clear'}),redirect:'follow'});if(!response.ok)throw new Error(`Server returned HTTP ${response.status}.`);await readServerResponse(response,'remove the background');cacheBackground('');applyBackground('');selectedBackground='';updatePreview('');if(statusElement)statusElement.textContent='✓ Global bakgrunn fjernet.';return true;}catch(error){if(statusElement)statusElement.textContent='✕ Kunne ikke fjerne global bakgrunn: '+error.message;return false;}
  }

  function updatePreview(raw){const preview=document.getElementById('globalBackgroundPreview');if(!preview)return;const dataUrl=toDataUrl(raw);if(dataUrl){preview.src=dataUrl;preview.style.display='block';}else{preview.removeAttribute('src');preview.style.display='none';}}

  function setupSettings(){
    const panel=document.querySelector('#settingsOverlay .panel-body');if(!panel||document.getElementById('globalBackgroundSetting'))return;
    const category=document.createElement('div');category.className='category';category.id='globalBackgroundSetting';
    category.innerHTML=`<button class="category-title" type="button"><span>🌄 Global Background</span><span>⌄</span></button><div class="category-body"><div class="setting"><label>Current global background</label><img id="globalBackgroundPreview" style="display:none;width:100%;height:150px;object-fit:cover;border-radius:12px;margin-top:8px;border:1px solid #343a44;background:#111" alt="Current global background"><div id="globalBackgroundCurrent" style="color:#929aa5;font-size:12px;margin-top:8px">Laster…</div></div><div class="setting"><label>Choose a new background</label><input id="globalBackgroundFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small style="color:#89919d;display:block;margin-top:6px">Maks 750px. After choosing an image you can move, rotate and zoom it before sending.</small></div><div class="setting"><button class="save-btn" id="sendGlobalBackground" disabled>Send New Global Background</button><button class="game-btn" id="reloadGlobalBackground" style="margin-top:8px;width:100%">Reload Current Global Background</button><button class="game-btn" id="clearGlobalBackground" style="margin-top:8px;width:100%">Remove Global Background</button><div id="globalBackgroundStatus" style="color:#929aa5;font-size:12px;margin-top:9px;min-height:18px"></div></div></div>`;
    const appearance=[...panel.querySelectorAll('.category')].find(x=>x.querySelector('.category-title')?.textContent.includes('Appearance'));if(appearance)appearance.after(category);else panel.prepend(category);category.querySelector('.category-title').onclick=()=>category.classList.toggle('open');
    const input=category.querySelector('#globalBackgroundFile'),send=category.querySelector('#sendGlobalBackground'),reload=category.querySelector('#reloadGlobalBackground'),clear=category.querySelector('#clearGlobalBackground'),status=category.querySelector('#globalBackgroundStatus'),current=category.querySelector('#globalBackgroundCurrent');
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){status.textContent='✕ Velg en bildefil.';send.disabled=true;return;}send.disabled=true;status.textContent='Forbereder bakgrunn…';try{selectedBackground=await resizeImage(file);updatePreview(selectedBackground);makeEditor(selectedBackground,edited=>{selectedBackground=edited;updatePreview(edited);send.disabled=false;status.textContent='✓ Bakgrunn justert. Klar til å sende.';});status.textContent='Juster bakgrunnen før du sender den.';}catch(error){selectedBackground='';send.disabled=true;status.textContent='✕ '+error.message;}};
    send.onclick=async()=>{if(!selectedBackground)return;send.disabled=true;const ok=await saveGlobalBackground(selectedBackground,status);send.disabled=false;if(ok){input.value='';selectedBackground='';current.textContent='✓ Denne bakgrunnen er nå lagret globalt.';}};
    reload.onclick=async()=>{reload.disabled=true;const data=await loadGlobalBackground(status);current.textContent=data?'✓ Global bakgrunn lastet.':'Ingen global bakgrunn er satt.';reload.disabled=false;};
    clear.onclick=async()=>{clear.disabled=true;const ok=await clearGlobalBackground(status);if(ok)current.textContent='Ingen global bakgrunn er satt.';clear.disabled=false;};
    loadGlobalBackground(status).then(data=>{current.textContent=data?'✓ Global bakgrunn lastet.':'Ingen global bakgrunn er satt.';});
  }

  function boot(){const cached=getCachedBackground();if(cached)applyBackground(cached);setupSettings();loadGlobalBackground();new MutationObserver(setupSettings).observe(document.documentElement,{childList:true,subtree:true});}
  window.ChatGlobalBackground={load:loadGlobalBackground,save:saveGlobalBackground,clear:clearGlobalBackground};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
