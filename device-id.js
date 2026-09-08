/* =====================================================
   HOST-PROVIDED DEVICE ID

   The external loader sets iframe window.name to the stable
   device ID before this app is loaded. Use that ID as the
   authoritative identity whenever it is provided.
===================================================== */
(function(){
    try{
        const hostDeviceId=String(window.name || "").trim();

        if(hostDeviceId && hostDeviceId.length <= 200){
            localStorage.setItem("chat_device_id", hostDeviceId);
            window.__CHAT_APP_DEVICE_ID__=hostDeviceId;
            return;
        }

        const queryDeviceId=new URLSearchParams(window.location.search).get("deviceId");
        if(queryDeviceId && queryDeviceId.trim().length <= 200){
            const id=queryDeviceId.trim();
            localStorage.setItem("chat_device_id", id);
            window.__CHAT_APP_DEVICE_ID__=id;
        }
    }catch(error){
        console.warn("Could not read host-provided device ID:", error);
    }
})();
