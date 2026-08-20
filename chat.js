/* =========================================================
   CHAT CLIENT
   This is the browser-side chat code.
   Your API remains at /api/message
========================================================= */

const API_URL = "/api/message";
const CHANNEL = "general";

let deviceId = localStorage.getItem("chat_device_id");

if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("chat_device_id", deviceId);
}

const defaults = {
    username: "",
    refreshRate: 1000,
    showTimestamps: true,
    compactMessages: false,
    textSize: 16,
    wordSpacing: 0,
    lineSpacing: 1.45,
    cornerRadius: 12,
    uiScale: 1,
    enterToSend: true,
    autoScroll: true,
    confirmDelete: true,
    theme: "dark"
};

const settings = {};

for (const key in defaults) {
    const saved = localStorage.getItem("chat_" + key);

    if (saved === null) {
        settings[key] = defaults[key];
    } else if (saved === "true") {
        settings[key] = true;
    } else if (saved === "false") {
        settings[key] = false;
    } else if (!isNaN(Number(saved))) {
        settings[key] = Number(saved);
    } else {
        settings[key] = saved;
    }
}

const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const attachBtn = document.getElementById("attachBtn");

let currentMessages = [];
let refreshTimer = null;
let editingMessage = null;

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function linkify(text) {
    const escaped = escapeHTML(text);

    return escaped.replace(
        /(https?:\/\/[^\s<]+)/gi,
        url => {
            const clean = url.replace(/[.,!?;:]+$/, "");

            return `<a
                class="message-link"
                href="${clean}"
                target="_blank"
                rel="noopener noreferrer"
            >${clean}</a>`;
        }
    );
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function isGameMessage(message) {
    return (
        message &&
        (
            message.username === "__GAME_SERVER__" ||
            message.username === "SYSTEM"
        )
    );
}

function renderImage(image) {
    if (!image) return "";

    return `
        <img
            class="message-image"
            src="${image}"
            alt="Image"
            loading="lazy"
            onclick="window.openImageViewer(this.src)"
        >
    `;
}

function renderMessages() {
    if (!messagesEl) return;

    const wasNearBottom =
        messagesEl.scrollHeight -
        messagesEl.scrollTop -
        messagesEl.clientHeight < 120;

    messagesEl.innerHTML = "";

    const visible = currentMessages.filter(
        message => !isGameMessage(message)
    );

    if (!visible.length) {
        messagesEl.innerHTML = `
            <div class="empty">
                <div>
                    <strong>No messages yet</strong>
                    Start the conversation.
                </div>
            </div>
        `;

        return;
    }

    visible.forEach(message => {
        const article = document.createElement("article");

        article.className = "message";

        const username =
            message.username || "Unknown";

        const avatar =
            username.substring(0, 1).toUpperCase();

        article.innerHTML = `
            <div class="avatar">
                ${escapeHTML(avatar)}
            </div>

            <div class="message-content">

                <div class="message-top">

                    <span class="username">
                        ${escapeHTML(username)}
                    </span>

                    ${
                        settings.showTimestamps
                        ? `
                            <span class="time">
                                ${formatTime(message.created_at)}
                            </span>
                        `
                        : ""
                    }

                    ${
                        message.edited
                        ? `
                            <span class="edited">
                                edited
                            </span>
                        `
                        : ""
                    }

                </div>

                ${
                    message.message
                    ? `
                        <div class="message-text">
                            ${linkify(message.message)}
                        </div>
                    `
                    : ""
                }

                ${renderImage(message.image)}

            </div>
        `;

        if (
            message.device_id === deviceId
        ) {
            article.addEventListener(
                "contextmenu",
                event => {
                    event.preventDefault();

                    showMessageMenu(
                        event.clientX,
                        event.clientY,
                        message
                    );
                }
            );
        }

        messagesEl.appendChild(article);
    });

    if (
        settings.autoScroll &&
        wasNearBottom
    ) {
        messagesEl.scrollTop =
            messagesEl.scrollHeight;
    }
}

async function loadMessages() {
    try {
        const response = await fetch(
            `${API_URL}?channel=${encodeURIComponent(CHANNEL)}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();

        currentMessages =
            Array.isArray(data.messages)
                ? data.messages
                : [];

        renderMessages();

        /*
         * Give games.js the newest hidden
         * game-server states.
         */
        if (
            typeof window.updateGamesFromMessages ===
            "function"
        ) {
            window.updateGamesFromMessages(
                currentMessages
            );
        }

    } catch (error) {
        console.error(
            "Could not load messages:",
            error
        );
    }
}

async function sendMessage() {
    if (!messageInput) return;

    const text =
        messageInput.value.trim();

    if (!text) return;

    if (!settings.username) {
        alert(
            "Set your username in Settings first."
        );

        return;
    }

    sendBtn.disabled = true;

    try {
        let response;

        if (editingMessage) {

            response = await fetch(
                API_URL,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        id:
                            editingMessage.id,

                        device_id:
                            deviceId,

                        message: text
                    })
                }
            );

            editingMessage = null;

        } else {

            response = await fetch(
                API_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        username:
                            settings.username,

                        channel: CHANNEL,

                        message: text,

                        image: null,

                        device_id:
                            deviceId
                    })
                }
            );
        }

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Message request failed."
            );
        }

        messageInput.value = "";

        await loadMessages();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Could not send message."
        );

    } finally {
        sendBtn.disabled = false;
    }
}

function uploadImage(file) {
    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload = () =>
                resolve(reader.result);

            reader.onerror = reject;

            reader.readAsDataURL(file);
        }
    );
}

async function sendImage(file) {
    if (!file) return;

    if (!settings.username) {
        alert(
            "Set your username first."
        );

        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");

        return;
    }

    if (file.size > 3500000) {
        alert(
            "That image is too large."
        );

        return;
    }

    try {

        const image =
            await uploadImage(file);

        const response =
            await fetch(
                API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        username:
                            settings.username,

                        channel: CHANNEL,

                        message: "",

                        image,

                        device_id:
                            deviceId
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Image upload failed."
            );
        }

        await loadMessages();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Could not send image."
        );
    }
}

async function deleteMessage(message) {
    try {

        const response =
            await fetch(
                API_URL,
                {
                    method: "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        id: message.id,
                        device_id: deviceId
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Delete failed."
            );
        }

        await loadMessages();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Could not delete message."
        );
    }
}

function showMessageMenu(x, y, message) {
    const menu =
        document.getElementById(
            "contextMenu"
        );

    if (!menu) return;

    menu.style.left =
        Math.min(
            x,
            window.innerWidth - 170
        ) + "px";

    menu.style.top =
        Math.min(
            y,
            window.innerHeight - 110
        ) + "px";

    menu.style.display = "block";

    menu.dataset.messageId =
        message.id;

    menu.dataset.message =
        JSON.stringify(message);
}

function hideMessageMenu() {
    const menu =
        document.getElementById(
            "contextMenu"
        );

    if (menu) {
        menu.style.display = "none";
    }
}

window.openImageViewer = function(src) {
    const viewer =
        document.getElementById(
            "imageViewer"
        );

    const image =
        document.getElementById(
            "fullImage"
        );

    if (!viewer || !image) return;

    image.src = src;

    viewer.classList.add("show");
};

function setupSettings() {

    const username =
        document.getElementById(
            "usernameInput"
        );

    const device =
        document.getElementById(
            "deviceIdInput"
        );

    if (username)
        username.value =
            settings.username;

    if (device)
        device.value =
            deviceId;
}

function saveSetting(
    key,
    value
) {
    settings[key] = value;

    localStorage.setItem(
        "chat_" + key,
        value
    );
}

function startRefresh() {

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    refreshTimer =
        setInterval(
            loadMessages,
            Number(settings.refreshRate) || 1000
        );
}

function applyChatSettings() {

    document.documentElement.style
        .setProperty(
            "--text-size",
            settings.textSize + "px"
        );

    document.documentElement.style
        .setProperty(
            "--word-spacing",
            settings.wordSpacing + "px"
        );

    document.documentElement.style
        .setProperty(
            "--line-spacing",
            settings.lineSpacing
        );

    document.documentElement.style
        .setProperty(
            "--radius",
            settings.cornerRadius + "px"
        );

    document.documentElement.style
        .setProperty(
            "--ui-scale",
            settings.uiScale
        );

    startRefresh();
}

if (sendBtn) {
    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                settings.enterToSend
            ) {
                event.preventDefault();
                sendMessage();
            }
        }
    );
}

if (attachBtn) {

    attachBtn.addEventListener(
        "click",
        () => imageInput?.click()
    );
}

if (imageInput) {

    imageInput.addEventListener(
        "change",
        async () => {

            const file =
                imageInput.files?.[0];

            if (file)
                await sendImage(file);

            imageInput.value = "";
        }
    );
}

document.addEventListener(
    "click",
    event => {

        const menu =
            document.getElementById(
                "contextMenu"
            );

        if (
            menu &&
            !menu.contains(event.target)
        ) {
            hideMessageMenu();
        }
    }
);

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSettings();

        applyChatSettings();

        loadMessages();

        const edit =
            document.getElementById(
                "editMessage"
            );

        const del =
            document.getElementById(
                "deleteMessage"
            );

        if (edit) {

            edit.onclick = () => {

                const menu =
                    document.getElementById(
                        "contextMenu"
                    );

                if (!menu) return;

                try {

                    const message =
                        JSON.parse(
                            menu.dataset.message
                        );

                    editingMessage =
                        message;

                    messageInput.value =
                        message.message || "";

                    messageInput.focus();

                } catch {}

                hideMessageMenu();
            };
        }

        if (del) {

            del.onclick = async () => {

                const menu =
                    document.getElementById(
                        "contextMenu"
                    );

                if (!menu) return;

                try {

                    const message =
                        JSON.parse(
                            menu.dataset.message
                        );

                    if (
                        settings.confirmDelete &&
                        !confirm(
                            "Delete this message?"
                        )
                    ) {
                        hideMessageMenu();
                        return;
                    }

                    await deleteMessage(
                        message
                    );

                } catch {}

                hideMessageMenu();
            };
        }

        const usernameInput =
            document.getElementById(
                "usernameInput"
            );

        const saveSettings =
            document.getElementById(
                "saveSettings"
            );

        if (saveSettings) {

            saveSettings.onclick = () => {

                if (usernameInput) {

                    saveSetting(
                        "username",
                        usernameInput.value
                            .trim()
                            .substring(0, 24)
                    );
                }

                const ids = [
                    "textSize",
                    "wordSpacing",
                    "lineSpacing",
                    "cornerRadius",
                    "uiScale"
                ];

                ids.forEach(id => {

                    const el =
                        document.getElementById(
                            id
                        );

                    if (el) {

                        saveSetting(
                            id,
                            Number(el.value)
                        );
                    }
                });

                const overlay =
                    document.getElementById(
                        "settingsOverlay"
                    );

                if (overlay)
                    overlay.classList.remove(
                        "show"
                    );

                applyChatSettings();
            };
        }
    }
);