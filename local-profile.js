(()=>{
'use strict';

const USERNAME_KEY='chat_username';
const PROFILE_PICTURE_KEY='chat_profile_picture';
const MAX_PFP_SIDE=256;
const MAX_PFP_LENGTH=600000;

const usernameInput=()=>document.getElementById('usernameInput');
const pictureInput=()=>document.getElementById('profilePictureInput');
const picturePreview=()=>document.getElementById('profilePicturePreview');
const saveButton=()=>document.getElementById('saveSettings');

function saveUsername(value){
    try{
        localStorage.setItem(
            USERNAME_KEY,
            String(value||'').trim().slice(0,24)
        );
        return true;
    }catch(error){
        console.warn('Could not save username:',error);
        return false;
    }
}

function saveProfilePicture(dataUrl){
    try{
        localStorage.setItem(
            PROFILE_PICTURE_KEY,
            String(dataUrl||'')
        );
        return true;
    }catch(error){
        console.warn('Could not save profile picture:',error);
        return false;
    }
}

function loadUsername(){
    try{
        const saved=localStorage.getItem(USERNAME_KEY);
        return saved===null?'':saved;
    }catch(error){
        console.warn('Could not load username:',error);
        return '';
    }
}

function loadProfilePicture(){
    try{
        const saved=localStorage.getItem(PROFILE_PICTURE_KEY);
        return saved===null?'':saved;
    }catch(error){
        console.warn('Could not load profile picture:',error);
        return '';
    }
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
    const raw=match[2]
        ?atob(match[3])
        :decodeURIComponent(match[3]);

    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);

    return new File(
        [bytes],
        'profile-picture.jpg',
        {type}
    );
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
        input.dispatchEvent(
            new Event('change',{bubbles:true})
        );
    }catch(error){
        console.warn('Could not restore profile picture input:',error);
    }
}

function compressPicture(file){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();

        reader.onerror=()=>reject(
            reader.error||new Error('Could not read image.')
        );

        reader.onload=()=>{
            const image=new Image();

            image.onerror=()=>reject(
                new Error('Could not load image.')
            );

            image.onload=()=>{
                const originalWidth=image.naturalWidth||image.width;
                const originalHeight=image.naturalHeight||image.height;
                const scale=Math.min(
                    1,
                    MAX_PFP_SIDE/Math.max(originalWidth,originalHeight)
                );

                const canvas=document.createElement('canvas');
                canvas.width=Math.max(1,Math.round(originalWidth*scale));
                canvas.height=Math.max(1,Math.round(originalHeight*scale));

                const context=canvas.getContext('2d');
                if(!context){
                    reject(new Error('Canvas is not available.'));
                    return;
                }

                context.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

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

    if(savedName){
        nameInput.value=savedName;
    }

    if(savedPicture){
        showPicture(savedPicture);
        setTimeout(()=>restorePictureInput(savedPicture),150);
    }

    return true;
}

function saveProfile(){
    const nameInput=usernameInput();
    if(!nameInput)return;

    const name=nameInput.value.trim().slice(0,24);

    if(!saveUsername(name)){
        alert('Could not save your username on this device.');
        return;
    }

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
            if(!currentPicture){
                alert('Could not save that profile picture.');
            }
        });
    }else if(currentPicture){
        showPicture(currentPicture);
    }
}

function clearLocalProfile(){
    try{
        localStorage.removeItem(USERNAME_KEY);
        localStorage.removeItem(PROFILE_PICTURE_KEY);

        const nameInput=usernameInput();
        const imageInput=pictureInput();

        if(nameInput)nameInput.value='';
        if(imageInput)imageInput.value='';

        showPicture('');
    }catch(error){
        console.warn('Could not clear local profile:',error);
    }
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
        if(install()||tries>=30){
            clearInterval(timer);
        }
    },100);
}

window.clearLocalProfile=clearLocalProfile;

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
}else{
    start();
}

})();
