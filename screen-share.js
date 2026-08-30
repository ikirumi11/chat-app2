(()=>{'use strict';

const btn=document.getElementById('screenShareHeaderBtn');
if(!btn)return;

const API='/api/screen-share';
const Q=[150,300,450,600,750,900,1080,1440,2160];
const F=[5,10,15,20,25,30,45,60,90,120,144];

let q=+localStorage.getItem('screen_share_quality')||2160;
let f=+localStorage.getItem('screen_share_fps')||60;
let audio=localStorage.getItem('screen_share_audio')!=='0';

if(!Q.includes(q))q=2160;
if(!F.includes(f))f=60;

let peer=null;
let stream=null;
let sid='';
let sharing=false;
let watching=false;
let hidden=false;
let frozen=false;
let hb=null;
let pollTimer=null;

let calls=new Map();

let lastLive=null;

let watchPeerId='';
let watchHostPeerId='';

let watchRetryTimer=null;
let watchConnecting=false;
let watchAttempts=0;

const device=()=>{
    let x=localStorage.getItem('chat_device_id');

    if(!x){
        x=crypto.randomUUID?
            crypto.randomUUID():
            'ss-'+Date.now()+'-'+Math.random();

        localStorage.setItem('chat_device_id',x);
    }

    return x;
};

const user=()=>
    window.settings?.username||
    localStorage.getItem('chat_username')||
    'User';

const channel=()=>
    window.CHANNEL||
    'general';

const css=document.createElement('style');

css.textContent=`
.ss-o{
    position:fixed;
    inset:0;
    z-index:20000;
    display:none;
    align-items:flex-start;
    justify-content:flex-end;
    padding:80px 18px;
    background:transparent;
    pointer-events:none
}

.ss-o.show{
    display:flex
}

.ss-box{
    pointer-events:auto;
    width:min(430px,calc(100vw - 36px));
    background:var(--panel,#20242b);
    color:var(--text,#fff);
    border:1px solid #fff2;
    border-radius:12px;
    box-shadow:0 20px 60px #0009;
    overflow:hidden
}

.ss-h{
    display:flex;
    align-items:center;
    gap:10px;
    padding:13px 15px;
    border-bottom:1px solid #fff2
}

.ss-h b{
    flex:1
}

.ss-x{
    border:0;
    background:none;
    color:inherit;
    font-size:22px;
    cursor:pointer
}

.ss-b{
    display:grid;
    gap:12px;
    padding:15px
}

.ss-f{
    display:grid;
    gap:6px
}

.ss-note{
    font-size:12px;
    opacity:.7
}

.ss-s,
.ss-btn{
    width:100%;
    box-sizing:border-box;
    padding:10px;
    border-radius:8px;
    border:1px solid #fff2;
    background:#fff1;
    color:inherit
}

.ss-btn{
    cursor:pointer;
    font-weight:600
}

.ss-toggle{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:10px;
    border:1px solid #fff2;
    border-radius:8px
}

.ss-toggle input{
    width:20px;
    height:20px
}

.ss-error{
    font-size:12px;
    padding:9px;
    border-radius:8px;
    background:#f4433622;
    border:1px solid #f4433655
}

.ss-view{
    position:fixed;
    z-index:21000;
    right:20px;
    bottom:80px;
    width:min(900px,calc(100vw - 40px));
    height:min(600px,calc(100vh - 120px));
    display:none;
    flex-direction:column;
    background:#000;
    border:1px solid #fff3;
    border-radius:12px;
    overflow:hidden;
    box-shadow:0 20px 70px #000b
}

.ss-view.show{
    display:flex
}

.ss-vh{
    display:flex;
    align-items:center;
    gap:10px;
    padding:9px 12px;
    background:var(--panel,#20242b);
    color:var(--text,#fff);
    flex:none
}

.ss-vh b{
    flex:1
}

.ss-full{
    border:0;
    background:#fff1;
    color:inherit;
    border-radius:7px;
    padding:6px 9px;
    cursor:pointer
}

.ss-video-wrap{
    position:relative;
    flex:1;
    min-height:0;
    background:#000
}

.ss-video{
    width:100%;
    height:100%;
    object-fit:contain;
    background:#000
}

.ss-wait{
    height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    color:#fff;
    text-align:center;
    padding:20px;
    box-sizing:border-box
}

.ss-controls{
    display:flex;
    gap:8px;
    padding:9px;
    background:var(--panel,#20242b);
    flex:none
}

.ss-controls button{
    flex:1
}

.ss-reopen{
    position:fixed;
    right:18px;
    bottom:18px;
    z-index:20500;
    display:none;
    padding:10px 15px;
    border:1px solid #fff2;
    border-radius:9px;
    background:var(--panel,#20242b);
    color:var(--text,#fff);
    cursor:pointer;
    box-shadow:0 8px 30px #0007
}

.ss-reopen.show{
    display:block
}

.ss-live{
    font-size:11px;
    padding:3px 7px;
    border-radius:99px;
    background:#d33;
    color:#fff;
    font-weight:700
}

.ss-frozen{
    position:absolute;
    inset:0;
    display:none;
    align-items:center;
    justify-content:center;
    background:#000b;
    color:#fff;
    font-size:22px;
    font-weight:700;
    text-align:center;
    z-index:5
}

.ss-frozen.show{
    display:flex
}
`;

document.head.appendChild(css);


/* =========================================================
   UI
========================================================= */

const menu=document.createElement('div');

menu.className='ss-o';

menu.innerHTML=`
<div class="ss-box">
    <div class="ss-h">
        <b>Screen Share</b>
        <button class="ss-x" id="ssmx">×</button>
    </div>

    <div class="ss-b">

        <div class="ss-f">
            <label>Quality</label>
            <select class="ss-s" id="ssq">
                ${Q.map(x=>`
                    <option value="${x}">
                        ${x}p${x===2160?' (4K)':''}
                    </option>
                `).join('')}
            </select>
        </div>

        <div class="ss-f">
            <label>FPS</label>
            <select class="ss-s" id="ssf">
                ${F.map(x=>`
                    <option value="${x}">
                        ${x} FPS
                    </option>
                `).join('')}
            </select>
        </div>

        <label class="ss-toggle">
            <span>Share audio</span>
            <input id="ssa" type="checkbox" ${audio?'checked':''}>
        </label>

        <div class="ss-note">
            Screen share only. Camera sharing has been removed.
        </div>

        <div id="ssaerr"></div>

        <button class="ss-btn" id="ssstart">
            Start screen share
        </button>

    </div>
</div>
`;

document.body.appendChild(menu);


/* =========================================================
   LIVE PROMPT
========================================================= */

const prompt=document.createElement('div');

prompt.className='ss-o';

prompt.innerHTML=`
<div class="ss-box">

    <div class="ss-h">
        <b id="sstitle">Live just started</b>
        <button class="ss-x" id="sspx">×</button>
    </div>

    <div class="ss-b">

        <div id="sstext">
            Someone started sharing their screen.
        </div>

        <button class="ss-btn" id="sswatch">
            Watch Live
        </button>

        <button class="ss-btn" id="ssno">
            Not now
        </button>

    </div>
</div>
`;

document.body.appendChild(prompt);


/* =========================================================
   REOPEN
========================================================= */

const reopen=document.createElement('button');

reopen.className='ss-reopen';
reopen.textContent='Open Live';

document.body.appendChild(reopen);


/* =========================================================
   VIEW
========================================================= */

const view=document.createElement('div');

view.className='ss-view';

view.innerHTML=`
<div class="ss-vh">

    <b id="sshost">
        Screen Share
    </b>

    <span id="sslive"></span>

    <span id="ssstate">
        Connecting…
    </span>

    <button class="ss-full" id="ssfull">
        ⛶
    </button>

    <button class="ss-x" id="ssclose">
        ×
    </button>

</div>

<div class="ss-video-wrap">

    <div class="ss-wait" id="sswait">
        Connecting to live screen…
    </div>

    <video
        id="ssvideo"
        class="ss-video"
        autoplay
        playsinline
        style="display:none"
    ></video>

    <div id="ssfrozen" class="ss-frozen">
        Host froze live
    </div>

</div>

<div class="ss-controls" id="sscontrols" style="display:none">

    <button class="ss-btn" id="ssfreeze">
        Freeze
    </button>

    <button class="ss-btn" id="ssstop">
        Stop
    </button>

</div>
`;

document.body.appendChild(view);


/* =========================================================
   ELEMENTS
========================================================= */

const selQ=menu.querySelector('#ssq');
const selF=menu.querySelector('#ssf');
const audioToggle=menu.querySelector('#ssa');
const audioErr=menu.querySelector('#ssaerr');

const video=view.querySelector('#ssvideo');
const wait=view.querySelector('#sswait');
const state=view.querySelector('#ssstate');
const host=view.querySelector('#sshost');
const live=view.querySelector('#sslive');

const controls=view.querySelector('#sscontrols');
const freezeBtn=view.querySelector('#ssfreeze');
const frozenOverlay=view.querySelector('#ssfrozen');

selQ.value=q;
selF.value=f;

const open=x=>x.classList.add('show');
const close=x=>x.classList.remove('show');


/* =========================================================
   WHITEBOARD
========================================================= */

function loadScript(src){
    return new Promise((ok,no)=>{
        const s=document.createElement('script');

        s.src=src;

        s.onload=ok;

        s.onerror=no;

        document.head.appendChild(s);
    });
}

loadScript('whiteboard.js')
    .catch(e=>console.warn('Whiteboard could not load:',e));


/* =========================================================
   API
========================================================= */

async function api(action,extra={}){

    const r=await fetch(API,{
        method:'POST',
        cache:'no-store',
        headers:{
            'Content-Type':'application/json'
        },

        body:JSON.stringify({

            action,

            channel:channel(),

            device_id:device(),

            username:user(),

            share_id:sid,

            mode:'screen-share',

            peer_id:peer?.id,

            quality:q,

            fps:f,

            audio,

            ...extra
        })
    });

    let d={};

    try{
        d=await r.json();
    }catch{}

    if(!r.ok){
        throw Error(
            d.error||
            `Screen-share error (${r.status})`
        );
    }

    return d;
}


/* =========================================================
   GET LIVE INFO
========================================================= */

async function liveInfo(){

    const r=await fetch(
        API+
        '?channel='+
        encodeURIComponent(channel())+
        '&_='+
        Date.now(),
        {
            cache:'no-store'
        }
    );

    if(!r.ok)return null;

    return r.json();
}


/* =========================================================
   PEERJS
========================================================= */

function loadPeer(){

    return new Promise((ok,no)=>{

        if(window.Peer){
            ok();
            return;
        }

        const s=document.createElement('script');

        s.src=
            'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';

        s.onload=ok;

        s.onerror=()=>{
            no(
                Error(
                    'Could not load PeerJS.'
                )
            );
        };

        document.head.appendChild(s);
    });
}


/* =========================================================
   CREATE PEER
========================================================= */

function makePeer(){

    return new Promise((ok,no)=>{

        if(
            peer &&
            !peer.destroyed &&
            peer.open
        ){
            ok(peer.id);
            return;
        }

        if(peer){

            try{
                peer.destroy();
            }catch{}

            peer=null;
        }

        peer=new Peer({

            debug:0,

            config:{
                iceServers:[
                    {
                        urls:'stun:stun.l.google.com:19302'
                    },
                    {
                        urls:'stun:stun1.l.google.com:19302'
                    },
                    {
                        urls:'stun:stun.cloudflare.com:3478'
                    }
                ]
            }

        });


        let done=false;

        const timer=setTimeout(()=>{

            if(done)return;

            done=true;

            no(
                Error(
                    'PeerJS connection timed out.'
                )
            );

        },20000);


        peer.on('open',id=>{

            if(done)return;

            done=true;

            clearTimeout(timer);

            console.log(
                '[ScreenShare] Peer opened:',
                id
            );

            ok(id);
        });


        peer.on('error',e=>{

            console.warn(
                '[ScreenShare] PeerJS:',
                e
            );

            if(done)return;

            done=true;

            clearTimeout(timer);

            no(e);
        });


        peer.on('disconnected',()=>{

            console.warn(
                '[ScreenShare] Peer disconnected'
            );

            try{
                peer.reconnect();
            }catch{}

        });


        /*
         * IMPORTANT:
         * HOST RECEIVES CALL HERE.
         */

        peer.on('call',call=>{

            console.log(
                '[ScreenShare] Incoming call from:',
                call.peer
            );


            if(sharing && stream){

                try{

                    call.answer(stream);

                    calls.set(
                        call.peer,
                        call
                    );

                    call.on('close',()=>{
                        calls.delete(call.peer);
                    });

                    call.on('error',()=>{
                        calls.delete(call.peer);
                    });

                    console.log(
                        '[ScreenShare] Answered viewer:',
                        call.peer
                    );

                }catch(e){

                    console.error(
                        '[ScreenShare] Could not answer viewer:',
                        e
                    );

                    try{
                        call.close();
                    }catch{}
                }

                return;
            }


            /*
             * If the viewer receives a call,
             * answer it and listen for stream.
             */

            if(watching){

                try{

                    call.answer();

                    call.on(
                        'stream',
                        setRemote
                    );

                    call.on(
                        'close',
                        ()=>{
                            if(watching){
                                scheduleWatchRetry();
                            }
                        }
                    );

                    call.on(
                        'error',
                        ()=>{
                            if(watching){
                                scheduleWatchRetry();
                            }
                        }
                    );

                }catch(e){

                    console.warn(
                        '[ScreenShare] Viewer call error:',
                        e
                    );
                }

                return;
            }


            try{
                call.close();
            }catch{}

        });

    });
}


/* =========================================================
   REMOTE STREAM
========================================================= */

function setRemote(s){

    if(!s){
        console.warn(
            '[ScreenShare] Empty remote stream'
        );
        return;
    }

    console.log(
        '[ScreenShare] REMOTE STREAM RECEIVED'
    );

    video.srcObject=s;

    video.muted=false;

    video.style.display='block';

    wait.style.display='none';

    const hasAudio=
        s.getAudioTracks &&
        s.getAudioTracks().length>0;

    state.textContent=
        hasAudio?
        'Live • Audio on':
        'Live • No audio';

    video.play().catch(()=>{});

    watchConnecting=false;

    watchAttempts=0;

    if(watchRetryTimer){

        clearTimeout(
            watchRetryTimer
        );

        watchRetryTimer=null;
    }
}


/* =========================================================
   CONNECT VIEWER
========================================================= */

function connectViewerToHost(){

    if(!watching){
        return;
    }

    if(!peer){
        scheduleWatchRetry();
        return;
    }

    if(!peer.open){
        scheduleWatchRetry();
        return;
    }

    if(!watchHostPeerId){

        console.warn(
            '[ScreenShare] No host peer ID yet'
        );

        scheduleWatchRetry();

        return;
    }

    if(watchConnecting){
        return;
    }

    watchConnecting=true;

    state.textContent='Connecting…';

    wait.textContent=
        'Connecting to host…';

    console.log(
        '[ScreenShare] Calling host:',
        watchHostPeerId
    );


    try{

        /*
         * We do NOT need to send media.
         * The host sends the screen stream back.
         */
        const emptyStream=
            typeof MediaStream!=='undefined'?
            new MediaStream():
            undefined;

        let call;

        if(emptyStream){

            call=peer.call(
                watchHostPeerId,
                emptyStream,
                {
                    metadata:{
                        type:'screen-share-view',
                        shareId:sid
                    }
                }
            );

        }else{

            /*
             * Fallback for browsers where
             * MediaStream isn't available.
             */
            call=peer.call(
                watchHostPeerId,
                undefined,
                {
                    metadata:{
                        type:'screen-share-view',
                        shareId:sid
                    }
                }
            );

        }


        if(!call){

            console.warn(
                '[ScreenShare] peer.call returned nothing'
            );

            watchConnecting=false;

            scheduleWatchRetry();

            return;
        }


        console.log(
            '[ScreenShare] Call created:',
            call.peer
        );


        call.on(
            'stream',
            stream=>{
                console.log(
                    '[ScreenShare] Host stream arrived'
                );

                setRemote(stream);
            }
        );


        call.on(
            'close',
            ()=>{
                console.warn(
                    '[ScreenShare] Host call closed'
                );

                watchConnecting=false;

                if(watching &&
                    !video.srcObject
                ){
                    scheduleWatchRetry();
                }
            }
        );


        call.on(
            'error',
            e=>{
                console.warn(
                    '[ScreenShare] Host call failed:',
                    e
                );

                watchConnecting=false;

                if(watching){
                    scheduleWatchRetry();
                }
            }
        );


        /*
         * If PeerJS fails silently,
         * retry after a short delay.
         */
        setTimeout(()=>{

            if(
                watching &&
                watchConnecting &&
                !video.srcObject
            ){

                watchConnecting=false;

                scheduleWatchRetry();
            }

        },4000);

    }catch(e){

        console.error(
            '[ScreenShare] Could not call host:',
            e
        );

        watchConnecting=false;

        scheduleWatchRetry();
    }
}


/* =========================================================
   RETRY WATCH
========================================================= */

function scheduleWatchRetry(){

    if(!watching){
        return;
    }

    if(watchRetryTimer){
        return;
    }

    watchAttempts++;

    state.textContent='Connecting…';

    wait.textContent=
        'Connecting to host…';

    const delay=
        Math.min(
            5000,
            500+
            watchAttempts*400
        );

    console.log(
        '[ScreenShare] Retry in',
        delay,
        'ms'
    );


    watchRetryTimer=setTimeout(
        async()=>{

            watchRetryTimer=null;

            if(!watching){
                return;
            }


            /*
             * Refresh the server information.
             * This is important if the host's PeerJS
             * ID was not ready when we first joined.
             */

            try{

                const d=await liveInfo();

                const s=d?.share;

                if(
                    !s ||
                    s.type!=='screen-share'
                ){

                    stopWatching();

                    return;
                }


                if(s.id){
                    sid=String(s.id);
                }


                const hostId=
                    s.hostPeerId||
                    s.peerId;


                if(hostId){

                    watchHostPeerId=
                        String(hostId);

                    console.log(
                        '[ScreenShare] Host ID:',
                        watchHostPeerId
                    );
                }


                /*
                 * If PeerJS somehow disconnected,
                 * recreate it.
                 */

                if(
                    !peer ||
                    peer.destroyed
                ){

                    try{

                        await loadPeer();

                        watchPeerId=
                            await makePeer();

                    }catch(e){

                        console.warn(
                            '[ScreenShare] Peer recreate failed:',
                            e
                        );

                        scheduleWatchRetry();

                        return;
                    }
                }


                if(
                    peer &&
                    peer.open &&
                    watchHostPeerId
                ){

                    watchConnecting=false;

                    connectViewerToHost();

                }else{

                    scheduleWatchRetry();
                }

            }catch(e){

                console.warn(
                    '[ScreenShare] Watch retry info error:',
                    e
                );

                scheduleWatchRetry();
            }

        },
        delay
    );
}


/* =========================================================
   START SHARING
========================================================= */

async function start(){

    if(sharing)return;

    q=+selQ.value;

    f=+selF.value;

    audio=audioToggle.checked;

    localStorage.setItem(
        'screen_share_quality',
        q
    );

    localStorage.setItem(
        'screen_share_fps',
        f
    );

    localStorage.setItem(
        'screen_share_audio',
        audio?'1':'0'
    );

    audioErr.innerHTML='';


    try{

        const g=await liveInfo();

        if(
            g?.share?.type==='camera-share'
        ){
            throw Error(
                'Camera sharing is no longer available.'
            );
        }

        if(
            g?.share?.type==='screen-share'
        ){
            throw Error(
                'Someone is already sharing their screen.'
            );
        }


        await loadPeer();


        stream=
            await navigator.mediaDevices
            .getDisplayMedia({

                video:{
                    width:{
                        ideal:q
                    },

                    height:{
                        ideal:
                            Math.round(
                                q*9/16
                            )
                    },

                    frameRate:{
                        ideal:f,
                        max:f
                    },

                    contentHint:'motion'
                },

                audio

            });


        const pid=
            await makePeer();


        const r=
            await api(
                'start',
                {
                    peer_id:pid,

                    audio:
                        audio&&
                        stream
                        .getAudioTracks()
                        .length>0
                }
            );


        sid=
            String(
                r.shareId||
                r.id||
                ''
            );


        if(!sid){

            throw Error(
                'Could not create screen-share session.'
            );
        }


        sharing=true;

        hidden=false;

        frozen=false;


        open(view);

        close(menu);

        reopen.classList.remove('show');


        host.textContent=
            'You are hosting';

        live.textContent='LIVE';

        state.textContent=
            stream
            .getAudioTracks()
            .length>0?
            'Live • Audio on':
            'Live • No audio';


        controls.style.display='flex';

        video.srcObject=stream;

        video.muted=true;

        video.style.display='block';

        wait.style.display='none';


        freezeBtn.textContent='Freeze';


        hb=setInterval(
            ()=>{
                if(sharing){
                    api('heartbeat')
                        .catch(()=>{});
                }
            },
            5000
        );


        stream
        .getVideoTracks()[0]
        ?.addEventListener(
            'ended',
            ()=>stop(),
            {once:true}
        );


        console.log(
            '[ScreenShare] Hosting:',
            pid
        );

    }catch(e){

        if(stream){

            stream
            .getTracks()
            .forEach(t=>t.stop());

        }

        stream=null;


        if(peer){

            try{
                peer.destroy();
            }catch{}

            peer=null;
        }


        if(
            e.name!=='NotAllowedError'
        ){

            alert(
                e.message||
                'Could not start screen sharing.'
            );
        }
    }
}


/* =========================================================
   WATCH LIVE
========================================================= */

async function watch(id,hn,knownHostPeerId){

    if(watching)return;

    watching=true;

    hidden=false;

    sid=String(id||'');

    watchHostPeerId=
        String(
            knownHostPeerId||
            ''
        );

    watchAttempts=0;

    watchConnecting=false;


    open(view);

    close(prompt);

    reopen.classList.remove('show');


    host.textContent=
        'Screen shared by '+
        (hn||'User');

    live.textContent='LIVE';

    state.textContent='Connecting…';

    wait.textContent=
        'Connecting to host…';

    wait.style.display='flex';

    video.style.display='none';

    video.srcObject=null;


    try{

        /*
         * FIRST PRIORITY:
         * Create viewer PeerJS immediately.
         */

        await loadPeer();

        watchPeerId=
            await makePeer();


        console.log(
            '[ScreenShare] Viewer peer:',
            watchPeerId
        );


        /*
         * Register ourselves.
         */

        const r=
            await api(
                'join',
                {
                    peer_id:watchPeerId,
                    share_id:sid
                }
            );


        /*
         * Server now explicitly returns hostPeerId.
         */

        if(r?.hostPeerId){

            watchHostPeerId=
                String(
                    r.hostPeerId
                );

        }else if(
            r?.peerId &&
            r?.role==='host'
        ){

            watchHostPeerId=
                String(r.peerId);

        }


        /*
         * If server response did not contain it,
         * fetch it immediately.
         */

        if(!watchHostPeerId){

            const d=
                await liveInfo();

            const s=d?.share;

            if(
                s?.hostPeerId
            ){

                watchHostPeerId=
                    String(
                        s.hostPeerId
                    );

            }else if(
                s?.peerId
            ){

                watchHostPeerId=
                    String(
                        s.peerId
                    );
            }

        }


        console.log(
            '[ScreenShare] Host peer:',
            watchHostPeerId
        );


        /*
         * DO NOT WAIT.
         * Call host immediately.
         */

        if(watchHostPeerId){

            state.textContent=
                'Connecting to host…';

            connectViewerToHost();

        }else{

            state.textContent=
                'Finding host…';

            scheduleWatchRetry();
        }


    }catch(e){

        console.error(
            '[ScreenShare] Watch error:',
            e
        );

        watchConnecting=false;

        state.textContent=
            'Connection failed';

        wait.textContent=
            e.message||
            'Could not connect to host.';

        /*
         * Still retry because PeerJS can
         * temporarily fail.
         */

        scheduleWatchRetry();
    }
}


/* =========================================================
   STOP WATCHING
========================================================= */

function stopWatching(){

    watching=false;

    watchConnecting=false;

    watchAttempts=0;

    watchHostPeerId='';

    watchPeerId='';


    if(watchRetryTimer){

        clearTimeout(
            watchRetryTimer
        );

        watchRetryTimer=null;
    }


    if(video.srcObject){

        const tracks=
            video.srcObject
            .getTracks?
            video.srcObject.getTracks():
            [];

        tracks.forEach(
            t=>{
                try{
                    t.stop();
                }catch{}
            }
        );
    }


    video.srcObject=null;

    video.style.display='none';

    wait.style.display='flex';


    close(view);

    reopen.classList.remove('show');


    if(peer){

        try{
            peer.destroy();
        }catch{}

        peer=null;
    }
}


/* =========================================================
   STOP HOST
========================================================= */

async function stop(send=true){

    if(!sharing&&send)return;


    sharing=false;


    clearInterval(hb);

    hb=null;


    for(
        const c of calls.values()
    ){

        try{
            c.close();
        }catch{}

    }

    calls.clear();


    if(stream){

        stream
        .getTracks()
        .forEach(
            t=>{
                try{
                    t.stop();
                }catch{}
            }
        );

        stream=null;
    }


    if(send&&sid){

        try{
            await api('stop');
        }catch{}
    }


    sid='';


    if(peer){

        try{
            peer.destroy();
        }catch{}

        peer=null;
    }


    close(view);

    reopen.classList.remove('show');
}


/* =========================================================
   POLL
========================================================= */

async function poll(){

    try{

        const d=
            await liveInfo();

        const s=d?.share;


        /*
         * No active share.
         */

        if(
            !s ||
            s.type!=='screen-share'
        ){

            if(sharing){
                return;
            }


            if(watching){

                stopWatching();

                wait.textContent=
                    'Live ended.';

                state.textContent=
                    'Live ended';
            }


            close(prompt);

            reopen.classList.remove('show');

            lastLive=null;

            return;
        }


        /*
         * Update share ID.
         */

        if(s.id){
            sid=String(s.id);
        }


        /*
         * Always keep host peer ID fresh.
         */

        if(
            s.hostPeerId||
            s.peerId
        ){

            const id=
                s.hostPeerId||
                s.peerId;

            watchHostPeerId=
                String(id);
        }


        const key=
            String(
                s.id||
                s.shareId||
                s.startedAt||
                s.peerId
            );


        /*
         * New live session.
         */

        if(
            lastLive&&
            lastLive!==key&&
            !sharing
        ){

            if(watching){

                stopWatching();
            }

            close(view);
        }


        lastLive=key;


        /*
         * HOST
         */

        if(sharing){

            if(
                s.deviceId===device()
            ){

                connectViewers(
                    s.viewerPeers
                );

            }

            return;
        }


        /*
         * VIEWER
         */

        if(watching){

            /*
             * If stream isn't connected,
             * aggressively reconnect.
             */

            if(
                !video.srcObject
            ){

                watchConnecting=false;

                connectViewerToHost();

            }


            if(s.frozen){

                frozenOverlay
                    .classList
                    .add('show');

                state.textContent=
                    'Host froze live';

                video.pause()
                    .catch(()=>{});

            }else{

                frozenOverlay
                    .classList
                    .remove('show');

                if(video.srcObject){

                    state.textContent=
                        video
                        .srcObject
                        .getAudioTracks?
                        (
                            video
                            .srcObject
                            .getAudioTracks()
                            .length?
                            'Live • Audio on':
                            'Live • No audio'
                        ):
                        'Live';

                    video.play()
                        .catch(()=>{});

                }else{

                    state.textContent=
                        'Connecting to host…';
                }
            }


            return;
        }


        /*
         * Not watching yet.
         */

        if(!hidden){

            open(prompt);


            const age=
                Date.now()-
                (
                    Number(
                        s.startedAt
                    )||0
                );


            prompt
            .querySelector('#sstitle')
            .textContent=
                age<=1000?
                'Live just started':
                'Live';


            prompt
            .querySelector('#sstext')
            .textContent=
                age<=1000?
                'Someone just started sharing their screen.':
                'Someone is currently sharing their screen.';
        }


    }catch(e){

        console.warn(
            'Screen-share poll:',
            e
        );
    }
}


/* =========================================================
   HOST VIEWER CONNECTIONS
========================================================= */

function connectViewers(ids){

    if(
        !sharing||
        !stream||
        !peer
    ){
        return;
    }


    for(
        const id of
        Array.isArray(ids)?
        ids:
        []
    ){

        if(
            !id||
            id===peer.id||
            calls.has(id)
        ){
            continue;
        }


        try{

            console.log(
                '[ScreenShare] Host calling viewer:',
                id
            );


            /*
             * The viewer is already calling us,
             * so normally this isn't required.
             *
             * Kept as fallback for old clients.
             */

            const c=
                peer.call(
                    id,
                    stream,
                    {
                        metadata:{
                            type:'screen-share',
                            shareId:sid,
                            quality:q,
                            fps:f,
                            audio:
                                stream
                                .getAudioTracks()
                                .length>0
                        }
                    }
                );


            if(c){

                calls.set(id,c);

                c.on(
                    'close',
                    ()=>{
                        calls.delete(id);
                    }
                );

                c.on(
                    'error',
                    ()=>{
                        calls.delete(id);
                    }
                );
            }


        }catch(e){

            console.warn(
                '[ScreenShare] Host viewer call failed:',
                e
            );
        }
    }
}


/* =========================================================
   FREEZE
========================================================= */

async function freeze(next){

    if(!sharing)return;


    frozen=!!next;


    freezeBtn.textContent=
        frozen?
        'Resume':
        'Freeze';


    frozenOverlay
        .classList
        .toggle(
            'show',
            false
        );


    if(stream){

        stream
        .getVideoTracks()
        .forEach(
            t=>{
                t.enabled=!frozen;
            }
        );
    }


    try{

        await api(
            'freeze',
            {
                frozen
            }
        );

    }catch(e){

        console.warn(e);
    }
}


/* =========================================================
   FULLSCREEN
========================================================= */

async function fullscreen(){

    try{

        if(document.fullscreenElement){

            await document.exitFullscreen();

        }else{

            await view.requestFullscreen();

        }

    }catch{}
}


/* =========================================================
   BUTTON EVENTS
========================================================= */

btn.onclick=e=>{

    e.preventDefault();

    open(menu);
};


menu
.querySelector('#ssmx')
.onclick=()=>close(menu);


audioToggle.onchange=()=>{

    audio=
        audioToggle.checked;

    localStorage.setItem(
        'screen_share_audio',
        audio?'1':'0'
    );
};


menu
.querySelector('#ssstart')
.onclick=start;


/* Prompt close */

prompt
.querySelector('#sspx')
.onclick=()=>{

    close(prompt);

    hidden=true;

    reopen.classList.add('show');
};


prompt
.querySelector('#ssno')
.onclick=()=>{

    close(prompt);

    hidden=true;

    reopen.classList.add('show');
};


/* Watch button */

prompt
.querySelector('#sswatch')
.onclick=async()=>{

    try{

        const d=
            await liveInfo();

        const s=d?.share;


        if(
            !s||
            s.type!=='screen-share'
        ){

            close(prompt);

            return;
        }


        /*
         * Pass host peer ID directly.
         */

        await watch(
            s.id,
            s.host,
            s.hostPeerId||
            s.peerId
        );

    }catch(e){

        console.error(e);
    }
};


/* Reopen */

reopen.onclick=async()=>{

    hidden=false;


    if(watching){

        open(view);

        reopen.classList.remove(
            'show'
        );

        /*
         * Force connection attempt again.
         */

        watchConnecting=false;

        connectViewerToHost();

        return;
    }


    const d=
        await liveInfo();

    const s=d?.share;


    if(
        s?.type==='screen-share'
    ){

        await watch(
            s.id,
            s.host,
            s.hostPeerId||
            s.peerId
        );

    }else{

        reopen.classList.remove(
            'show'
        );
    }
};


/* Close */

view
.querySelector('#ssclose')
.onclick=()=>{

    hidden=true;

    close(view);

    reopen.classList.add(
        'show'
    );
};


/* Fullscreen */

view
.querySelector('#ssfull')
.onclick=fullscreen;


/* Freeze */

freezeBtn.onclick=()=>
    freeze(!frozen);


/* Stop */

view
.querySelector('#ssstop')
.onclick=()=>
    stop(true);


/* =========================================================
   START POLLING
========================================================= */

pollTimer=setInterval(
    poll,
    500
);

poll();

})();
