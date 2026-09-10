(()=>{
'use strict';

const USERNAME_KEY='chat_username';
const PROFILE_PICTURE_KEY='chat_profile_picture';
const MAX_PFP_SIDE=256;
const MAX_PFP_LENGTH=600000;
const BRIDGE_TIMEOUT=5000;

const usernameInput=()=>document.getElementById('usernameInput');
const pictureInput=()=>document.getElementById('profilePictureInput');
const picturePreview=()=>document.getElementById('profilePicturePreview');
const saveButton=()=>document.getElementById('saveSettings');

let bridgeSequence=0;
const bridgeRequests=new Map();

function hasLoaderBridge(){
    return !!(window.parent&&window.parent!==window&&typeof window.parent.postMessage==='function');
}

function bridgeRequest(action,key,value){
    if(!hasLoaderBridge())return Promise.resolve({handled:false,value:null});

    return new Promise(resolve=>{
        const id=`chat-storage-${Date.now()}-${++bridgeSequence}`;
        const timer=setTimeout(()=>{
            bridgeRequests.delete(id);
            resolve({handled:false,value:null});
        },BRIDGE_TIMEOUT);

        bridgeRequests.set(id,result=>{
            clearTimeout(timer);
            bridgeRequests.delete(id);
            resolve(result);
        });

        window.parent.postMessage({
            type:'chat-app-storage-request',
            id,
            action,
            key,
            value:value===undefined?null:String(value)
        },'*');
    });
}

window.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.type!=='chat-app-storage-response')return;

    const request=bridgeRequests.get(data.id);
    if(!request)return;

    request({handled:data.ok===true,value:data.value===undefined?null:data.value});
});

function saveLocal(key,value){
    try{
        localStorage.setItem(key,String(value||''));
        return true;
    }catch(error){
        console.warn('Could not save local value:',error);
        return false;
    }
}

function loadLocal(key){
    try{return localStorage.getItem(key);}catch(error){
        console.warn('Could not load local value:',error);
        return null;
    }
}

function removeLocal(key){
    try{
        localStorage.removeItem(key);
        return true;
    }catch(error){
        console.warn('Could not remove local value:',error);
        return false;
    }
}

function saveUsername(value){
    const clean=String(value||'').trim().slice(0,24);
    saveLocal(USERNAME_KEY,clean);
    if(hasLoaderBridge())bridgeRequest('save',USERNAME_KEY,clean).catch(()=>{});
    return true;
}

function saveProfilePicture(dataUrl){
    const value=String(dataUrl||'');
    if(!saveLocal(PROFILE_PICTURE_KEY,value))return false;
    if(hasLoaderBridge())bridgeRequest('save',PROFILE_PICTURE_KEY,value).catch(()=>{});
    return true;
}

function loadUsername(){
    const local=loadLocal(USERNAME_KEY);

    if(local!==null&&local!=='')return local;

    if(hasLoaderBridge())bridgeRequest('get',USERNAME_KEY).then(result=>{
        if(result.handled&&result.value!==null){
            saveLocal(USERNAME_KEY,result.value);
            const input=usernameInput();
            if(input&&!input.value)input.value=String(result.value).slice(0,24);
        }
    }).catch(()=>{});

    return local===null?'':local;
}

function loadProfilePicture(){
    const local=loadLocal(PROFILE_PICTURE_KEY);

    if(local!==null&&local!=='')return local;

    if(hasLoaderBridge())bridgeRequest('get',PROFILE_PICTURE_KEY).then(result=>{
        if(result.handled&&result.value){
            saveLocal(PROFILE_PICTURE_KEY,result.value);
            showPicture(result.value);
            setTimeout(()=>restorePictureInput(result.value),50);
        }
    }).catch(()=>{});

    return local===null?'':local;
}

function showPicture(dataUrl){
    const preview=picturePreview();
    if(!preview)return;

    if(dataUrl){
        preview.src=dataUrl;
        preview.style.display='block';
    }else{
        preview.removeAttribute('src');
        preview.style.display='none';
    }
}

function dataUrlToFile(dataUrl){
    const match=String(dataUrl||'').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if(!match)return null;

    const type=match[1]||'image/jpeg';
    const raw=match[2]?atob(match[3]):decodeURIComponent(match[3]);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);

    return new File([bytes],'profile-picture.jpg',{type});
}

function restorePictureInput(dataUrl){
    const input=pictureInput();
    if(!input||!dataUrl||!window.DataTransfer)return;

    const file=dataUrlToFile(dataUrl);
    if(!file)return;

    try{
        const transfer=new DataTransfer();
        transfer.items.add(file);
        input.files=transfer.files;
        input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(error){
        console.warn('Could not restore profile picture input:',error);
    }
}

function compressPicture(file){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(reader.error||new Error('Could not read image.'));
        reader.onload=()=>{
            const image=new Image();
            image.onerror=()=>reject(new Error('Could not load image.'));
            image.onload=()=>{
                const originalWidth=image.naturalWidth||image.width;
                const originalHeight=image.naturalHeight||image.height;
                const scale=Math.min(1,MAX_PFP_SIDE/Math.max(originalWidth,originalHeight));
                const canvas=document.createElement('canvas');
                canvas.width=Math.max(1,Math.round(originalWidth*scale));
                canvas.height=Math.max(1,Math.round(originalHeight*scale));
                const context=canvas.getContext('2d');
                if(!context){reject(new Error('Canvas is not available.'));return;}
                context.drawImage(image,0,0,canvas.width,canvas.height);

                let quality=.82;
                let result=canvas.toDataURL('image/jpeg',quality);
                while(result.length>MAX_PFP_LENGTH&&quality>.4){
                    quality-=.06;
                    result=canvas.toDataURL('image/jpeg',quality);
                }
                resolve(result);
            };
            image.src=reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function loadProfile(){
    const nameInput=usernameInput();
    const imageInput=pictureInput();
    if(!nameInput||!imageInput)return false;

    const savedName=loadUsername();
    const savedPicture=loadProfilePicture();

    if(savedName)nameInput.value=savedName;
    if(savedPicture){
        showPicture(savedPicture);
        setTimeout(()=>restorePictureInput(savedPicture),150);
    }
    return true;
}

function saveProfile(){
    const nameInput=usernameInput();
    if(!nameInput)return;

    saveUsername(nameInput.value.trim().slice(0,24));

    const currentPicture=loadProfilePicture();
    const imageInput=pictureInput();
    const file=imageInput&&imageInput.files&&imageInput.files[0];

    if(file){
        compressPicture(file).then(dataUrl=>{
            if(!saveProfilePicture(dataUrl)){
                alert('Could not save your profile picture on this device.');
                return;
            }
            showPicture(dataUrl);
        }).catch(error=>{
            console.error(error);
            if(!currentPicture)alert('Could not save that profile picture.');
        });
    }else if(currentPicture){
        showPicture(currentPicture);
    }
}

function clearLocalProfile(){
    removeLocal(USERNAME_KEY);
    removeLocal(PROFILE_PICTURE_KEY);

    if(hasLoaderBridge()){
        bridgeRequest('remove',USERNAME_KEY).catch(()=>{});
        bridgeRequest('remove',PROFILE_PICTURE_KEY).catch(()=>{});
    }

    const nameInput=usernameInput();
    const imageInput=pictureInput();
    if(nameInput)nameInput.value='';
    if(imageInput)imageInput.value='';
    showPicture('');
}

function install(){
    const nameInput=usernameInput();
    const imageInput=pictureInput();
    const save=saveButton();
    if(!nameInput||!imageInput||!save)return false;

    loadProfile();

    if(!save.dataset.localProfileBound){
        save.dataset.localProfileBound='1';
        save.addEventListener('click',saveProfile,true);
    }

    if(!imageInput.dataset.localProfileBound){
        imageInput.dataset.localProfileBound='1';
        imageInput.addEventListener('change',()=>{
            const file=imageInput.files&&imageInput.files[0];
            if(!file)return;
            if(!file.type.startsWith('image/')){
                alert('Please choose an image for your profile picture.');
                imageInput.value='';
                return;
            }
            const reader=new FileReader();
            reader.onload=()=>showPicture(reader.result);
            reader.readAsDataURL(file);
        },true);
    }

    return true;
}

function start(){
    if(install())return;
    let tries=0;
    const timer=setInterval(()=>{
        tries++;
        if(install()||tries>=30)clearInterval(timer);
    },100);
}

window.clearLocalProfile=clearLocalProfile;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();

})();

/* loader-storage-bridge protocol enabled */
