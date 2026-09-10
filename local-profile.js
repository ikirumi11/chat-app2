(()=>{
'use strict';

const PROFILE_KEY='chat_local_profile_v1';
const MAX_PFP_SIDE=256;
const MAX_PFP_BYTES=450000;

function readProfile(){
    try{
        const raw=localStorage.getItem(PROFILE_KEY);
        if(!raw)return {username:'',profilePicture:''};
        const data=JSON.parse(raw);
        return {
            username:typeof data.username==='string'?data.username.slice(0,24):'',
            profilePicture:typeof data.profilePicture==='string'?data.profilePicture:''
        };
    }catch{
        return {username:'',profilePicture:''};
    }
}

function writeProfile(profile){
    try{
        localStorage.setItem(PROFILE_KEY,JSON.stringify({
            username:String(profile.username||'').slice(0,24),
            profilePicture:String(profile.profilePicture||'')
        }));
        return true;
    }catch(error){
        console.warn('Could not save local profile:',error);
        return false;
    }
}

function setPreview(data){
    const preview=document.getElementById('profilePicturePreview');
    if(!preview)return;
    if(data){
        preview.src=data;
        preview.style.display='block';
    }else{
        preview.removeAttribute('src');
        preview.style.display='none';
    }
}

function dataUrlToFile(dataUrl,name='profile-picture.jpg'){
    const match=String(dataUrl||'').match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if(!match)return null;
    const type=match[1]||'image/jpeg';
    const isBase64=!!match[2];
    const raw=isBase64?atob(match[3]):decodeURIComponent(match[3]);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return new File([bytes],name,{type});
}

function putStoredPictureIntoInput(dataUrl){
    const input=document.getElementById('profilePictureInput');
    if(!input||!dataUrl||!window.DataTransfer)return;
    const file=dataUrlToFile(dataUrl);
    if(!file)return;
    try{
        const transfer=new DataTransfer();
        transfer.items.add(file);
        input.files=transfer.files;
        input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(error){
        console.warn('Could not restore local profile picture:',error);
    }
}

function compressImage(file){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(reader.error||new Error('Could not read image.'));
        reader.onload=()=>{
            const img=new Image();
            img.onerror=()=>reject(new Error('Could not load image.'));
            img.onload=()=>{
                const scale=Math.min(1,MAX_PFP_SIDE/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
                const width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
                const height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
                const canvas=document.createElement('canvas');
                canvas.width=width;
                canvas.height=height;
                const ctx=canvas.getContext('2d');
                if(!ctx){reject(new Error('Canvas is not available.'));return;}
                ctx.drawImage(img,0,0,width,height);
                let quality=.82;
                let result=canvas.toDataURL('image/jpeg',quality);
                while(result.length>MAX_PFP_BYTES*1.37&&quality>.45){
                    quality-=.07;
                    result=canvas.toDataURL('image/jpeg',quality);
                }
                resolve(result);
            };
            img.src=reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function install(){
    const usernameInput=document.getElementById('usernameInput');
    const pictureInput=document.getElementById('profilePictureInput');
    const saveButton=document.getElementById('saveSettings');
    const profileBody=document.querySelector('#settingsOverlay .category:first-child .category-body');
    if(!usernameInput||!pictureInput||!saveButton)return false;

    const profile=readProfile();

    if(profile.username){
        usernameInput.value=profile.username;
        localStorage.setItem('chat_username',profile.username);
    }

    setPreview(profile.profilePicture);

    if(profile.profilePicture){
        setTimeout(()=>putStoredPictureIntoInput(profile.profilePicture),150);
    }

    if(!pictureInput.dataset.localProfileBound){
        pictureInput.dataset.localProfileBound='1';
        pictureInput.addEventListener('change',async()=>{
            const file=pictureInput.files&&pictureInput.files[0];
            if(!file)return;
            if(!file.type.startsWith('image/')){
                alert('Please choose an image for your profile picture.');
                return;
            }
            try{
                const data=await compressImage(file);
                const current=readProfile();
                current.username=usernameInput.value.trim().slice(0,24);
                current.profilePicture=data;
                if(!writeProfile(current)){
                    alert('Could not save your profile picture on this device.');
                    return;
                }
                setPreview(data);
            }catch(error){
                console.error(error);
                alert('Could not save that profile picture.');
            }
        },true);
    }

    if(!saveButton.dataset.localProfileBound){
        saveButton.dataset.localProfileBound='1';
        saveButton.addEventListener('click',()=>{
            const current=readProfile();
            current.username=usernameInput.value.trim().slice(0,24);
            writeProfile(current);
            localStorage.setItem('chat_username',current.username);
        },true);
    }

    if(profileBody&&!profileBody.querySelector('.local-profile-note')){
        const note=document.createElement('div');
        note.className='local-profile-note';
        note.style.cssText='margin-top:10px;padding:10px 12px;border:1px solid #303640;border-radius:10px;background:#171a20;color:#9da5b0;font-size:12px;line-height:1.45';
        note.innerHTML='💾 <strong style="color:#dfe4ea">Saved on this device</strong><br>Your name and profile picture are kept in this browser so you do not have to choose them again.';
        profileBody.appendChild(note);
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

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();

})();
