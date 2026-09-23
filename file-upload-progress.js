(function(){
    'use strict';

    const input=document.getElementById('fileInput');
    const preview=document.getElementById('filePreview');
    const send=document.getElementById('sendBtn');
    if(!input||!preview) return;

    const MAX_FILES=5;
    const MAX_SIZE=5*1024*1024;
    const IMAGE_MAX_SIZE=450;

    function formatSize(bytes){
        if(bytes<1024) return `${bytes} B`;
        if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
        return `${(bytes/(1024*1024)).toFixed(1)} MB`;
    }

    function escapeHtml(value){
        return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
    }

    function addStyle(){
        if(document.getElementById('file-upload-progress-style')) return;
        const style=document.createElement('style');
        style.id='file-upload-progress-style';
        style.textContent=`
            .file-preview{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:7px!important;padding:6px 8px!important;}
            .fup-item{width:100%;padding:8px 10px;background:var(--panel3,#20252d);border:1px solid var(--border,#292f38);border-radius:9px;}
            .fup-top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;}
            .fup-name{font-size:13px;color:var(--text,#edf0f4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .fup-size{font-size:11px;color:var(--muted,#7e8793);flex-shrink:0;}
            .fup-bar{height:5px;margin-top:6px;background:var(--panel2,#181c22);border-radius:999px;overflow:hidden;}
            .fup-fill{height:100%;width:0%;background:var(--green,#70e0a0);border-radius:999px;transition:width .08s linear;}
            .fup-status{margin-top:4px;font-size:10px;color:var(--muted,#7e8793);}
            .fup-remove{border:0;background:transparent;color:var(--muted,#7e8793);font-size:16px;line-height:1;padding:0 2px;cursor:pointer;flex-shrink:0;}
            .fup-remove:hover{color:var(--danger,#ff7070);}
        `;
        document.head.appendChild(style);
    }

    function ensureState(){
        if(!Array.isArray(window.__chatUploadFiles)) window.__chatUploadFiles=[];
        if(!Array.isArray(pendingFiles)) pendingFiles=[];
    }

    function row(file,index){
        const el=document.createElement('div');
        el.className='fup-item';
        el.dataset.index=index;
        el.innerHTML=`<div class="fup-top"><span class="fup-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span><span class="fup-size">${formatSize(file.size)}</span><button class="fup-remove" type="button" aria-label="Remove ${escapeHtml(file.name)}">×</button></div><div class="fup-bar"><div class="fup-fill"></div></div><div class="fup-status">Preparing 0%</div>`;
        el.querySelector('.fup-remove').addEventListener('click',()=>{
            window.__chatUploadFiles.splice(index,1);
            pendingFiles.splice(index,1);
            renderRows();
            input.value='';
        });
        return el;
    }

    function renderRows(){
        ensureState();
        preview.innerHTML='';
        window.__chatUploadFiles.forEach((file,index)=>preview.appendChild(row(file,index)));
    }

    function setProgress(index,percent,status){
        const item=preview.querySelector(`.fup-item[data-index="${index}"]`);
        if(!item) return;
        item.querySelector('.fup-fill').style.width=`${percent}%`;
        item.querySelector('.fup-status').textContent=status||`Preparing ${percent}%`;
    }

    function readFile(file,index){
        return new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.addEventListener('progress',event=>{
                if(event.lengthComputable){
                    const percent=Math.round(event.loaded*100/event.total);
                    setProgress(index,percent,`Preparing ${percent}%`);
                }
            });
            reader.addEventListener('load',()=>{
                setProgress(index,100,'Ready to send');
                resolve({name:file.name,data:String(reader.result),size:file.size,type:file.type||'application/octet-stream',audio:false,base64:true});
            });
            reader.addEventListener('error',()=>reject(new Error(`Could not read ${file.name}`)));
            reader.readAsDataURL(file);
        });
    }

    function loadImage(file){
        return new Promise((resolve,reject)=>{
            const url=URL.createObjectURL(file);
            const img=new Image();
            img.onload=()=>{
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror=()=>{
                URL.revokeObjectURL(url);
                reject(new Error(`Could not read ${file.name} as an image.`));
            };
            img.src=url;
        });
    }

    function canvasToDataURL(canvas,type,quality){
        return new Promise((resolve,reject)=>{
            canvas.toBlob(blob=>{
                if(!blob){
                    reject(new Error('Could not convert image.'));
                    return;
                }
                const reader=new FileReader();
                reader.onload=()=>resolve(reader.result);
                reader.onerror=()=>reject(new Error('Could not encode image.'));
                reader.readAsDataURL(blob);
            },type,quality);
        });
    }

    async function imageTo450p(file,index){
        setProgress(index,10,'Resizing image to 450p');
        const img=await loadImage(file);
        const originalWidth=img.naturalWidth||img.width;
        const originalHeight=img.naturalHeight||img.height;

        const scale=Math.min(1,IMAGE_MAX_SIZE/Math.max(originalWidth,originalHeight));
        const width=Math.max(1,Math.round(originalWidth*scale));
        const height=Math.max(1,Math.round(originalHeight*scale));

        const canvas=document.createElement('canvas');
        canvas.width=width;
        canvas.height=height;

        const ctx=canvas.getContext('2d',{alpha:true});
        if(!ctx) throw new Error('Your browser does not support image conversion.');

        const inputType=(file.type||'').toLowerCase();
        const outputType=inputType==='image/png'?'image/png':'image/jpeg';

        if(outputType==='image/jpeg'){
            ctx.fillStyle='#ffffff';
            ctx.fillRect(0,0,width,height);
        }

        ctx.drawImage(img,0,0,width,height);
        setProgress(index,70,'Converting to Base64');

        const data=await canvasToDataURL(
            canvas,
            outputType,
            outputType==='image/png'?undefined:0.86
        );

        setProgress(index,100,'Ready to send');

        return {
            name:file.name.replace(/\\.[^.]+$/,'')+(outputType==='image/png'?'.png':'.jpg'),
            data,
            size:Math.round((data.length-data.indexOf(',')-1)*0.75),
            type:outputType,
            base64:true,
            image:true,
            width,
            height,
            originalSize:file.size
        };
    }

    async function handleSelection(event){
        event.stopImmediatePropagation();
        ensureState();

        const selected=[...event.target.files];
        if(!selected.length) return;

        const available=MAX_FILES-pendingFiles.length;
        if(selected.length>available) alert(`You can attach up to ${MAX_FILES} files.`);

        const files=selected.slice(0,Math.max(0,available));
        for(const file of files){
            const type=(file.type||'').toLowerCase();
            const isImage=type.startsWith('image/');
            const isVideo=type.startsWith('video/');
            if(!isImage&&!isVideo){
                alert('Only images and videos can be sent.');
                continue;
            }
            if(file.size>MAX_SIZE){
                alert(`${file.name} is too large. Maximum size is 5 MB.`);
                continue;
            }

            window.__chatUploadFiles.push(file);
        }

        renderRows();
        const startIndex=pendingFiles.length;
        const added=window.__chatUploadFiles.slice(startIndex);
        if(send) send.disabled=true;

        try{
            for(let i=0;i<added.length;i++){
                const file=added[i];
                const index=startIndex+i;
                const type=(file.type||'').toLowerCase();

                if(type.startsWith('image/')){
                    pendingFiles.push(await imageTo450p(file,index));
                }else{
                    pendingFiles.push(await readFile(file,index));
                }
            }
        }catch(error){
            alert(error.message||'Could not prepare the file.');
        }finally{
            if(send) send.disabled=false;
            input.value='';
        }
    }

    addStyle();
    ensureState();
    input.addEventListener('change',handleSelection,true);
})();
