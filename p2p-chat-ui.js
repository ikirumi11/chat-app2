(() => {
"use strict";

function handleFastP2PMessage(event) {
    const message = event?.detail;
    if (!message || !message.id) return;
    if (message.username === "__GAME_SERVER__" || message.username === "__SYSTEM__") return;
    if (typeof CHANNEL !== "undefined" && message.channel !== CHANNEL) return;

    if (typeof currentMessages !== "undefined" && Array.isArray(currentMessages)) {
        const existing = currentMessages.findIndex(item => item.id === message.id);
        if (existing >= 0) {
            currentMessages[existing] = message;
        } else {
            currentMessages.push(message);
        }
        currentMessages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }

    if (typeof renderMessages === "function") {
        renderMessages(true);
    }
}

window.addEventListener("chat-p2p-message", handleFastP2PMessage);
})();