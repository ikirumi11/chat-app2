/* Chat App 2 - session login
   Username and profile picture are chosen every time the page is opened.
   Nothing about the profile is persisted as an account.
*/
(() => {
    "use strict";

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    const sessionDeviceId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);

    let sessionUsername = "";
    let sessionProfilePicture = "";

    // Keep the existing app's multiplayer/message ownership working with a
    // temporary session ID, but never save it to browser storage.
    Storage.prototype.getItem = function(key) {
        if (key === "chat_device_id") return sessionDeviceId;
        if (key === "chat_username") return sessionUsername;
        if (key === "chat_profile_picture") return sessionProfilePicture;
        return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function(key, value) {
        if (key === "chat_device_id" || key === "chat_username" || key === "chat_profile_picture") return;
        return originalSetItem.call(this, key, value);
    };

    // Remove old saved identity data from previous versions.
    try {
        originalRemoveItem.call(localStorage, "chat_device_id");
        originalRemoveItem.call(localStorage, "chat_username");
        originalRemoveItem.call(localStorage, "chat_profile_picture");
    } catch {}

    const app = document.querySelector(".app");
    if (app) app.style.display = "none";

    const overlay = document.createElement("div");
    overlay.id = "chatLoginOverlay";
    overlay.innerHTML = `
        <div class="chat-login-card">
            <div class="chat-login-icon">🎮</div>
            <h1>Welcome to Game Chat</h1>
            <p>Choose your username and profile picture to enter.</p>

            <label for="chatLoginUsername">Username</label>
            <input id="chatLoginUsername" maxlength="24" autocomplete="off" placeholder="Enter your username">

            <label for="chatLoginPicture">Profile picture</label>
            <input id="chatLoginPicture" type="file" accept="image/*">
            <div class="chat-login-preview-wrap">
                <img id="chatLoginPreview" class="chat-login-preview" alt="Profile preview">
            </div>

            <button id="chatLoginButton" type="button">Login</button>
            <div id="chatLoginError" class="chat-login-error"></div>
        </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
        #chatLoginOverlay {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: #090b0f;
            color: #fff;
            font-family: Inter, Arial, sans-serif;
        }
        .chat-login-card {
            width: min(430px, 100%);
            padding: 30px;
            border: 1px solid #303641;
            border-radius: 18px;
            background: #141820;
            box-shadow: 0 25px 80px #0009;
        }
        .chat-login-icon {
            width: 64px;
            height: 64px;
            display: grid;
            place-items: center;
            margin: 0 auto 16px;
            border-radius: 18px;
            background: #252b35;
            font-size: 30px;
        }
        .chat-login-card h1 {
            margin: 0;
            text-align: center;
            font-size: 25px;
        }
        .chat-login-card p {
            margin: 9px 0 24px;
            text-align: center;
            color: #929aa7;
            line-height: 1.45;
        }
        .chat-login-card label {
            display: block;
            margin: 15px 0 7px;
            color: #dce1e8;
            font-weight: 700;
        }
        .chat-login-card input[type="text"],
        .chat-login-card input:not([type]) {
            width: 100%;
        }
        #chatLoginUsername {
            width: 100%;
            padding: 12px 13px;
            border: 1px solid #3a414c;
            border-radius: 10px;
            outline: none;
            background: #0e1116;
            color: #fff;
            font-size: 16px;
        }
        #chatLoginUsername:focus {
            border-color: #6654e8;
        }
        #chatLoginPicture {
            width: 100%;
            padding: 9px;
            border: 1px solid #3a414c;
            border-radius: 10px;
            background: #0e1116;
            color: #cbd1da;
        }
        .chat-login-preview-wrap {
            display: flex;
            justify-content: center;
            min-height: 86px;
            margin: 14px 0 4px;
        }
        .chat-login-preview {
            display: none;
            width: 82px;
            height: 82px;
            object-fit: cover;
            border-radius: 50%;
            border: 2px solid #3d4450;
        }
        #chatLoginButton {
            width: 100%;
            margin-top: 14px;
            padding: 12px 16px;
            border: 0;
            border-radius: 10px;
            background: #6654e8;
            color: #fff;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
        }
        #chatLoginButton:hover { filter: brightness(1.08); }
        #chatLoginButton:disabled { opacity: .55; cursor: wait; }
        .chat-login-error {
            min-height: 20px;
            margin-top: 10px;
            color: #ff8b8b;
            text-align: center;
            font-size: 13px;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    const usernameInput = document.getElementById("chatLoginUsername");
    const pictureInput = document.getElementById("chatLoginPicture");
    const preview = document.getElementById("chatLoginPreview");
    const loginButton = document.getElementById("chatLoginButton");
    const error = document.getElementById("chatLoginError");

    pictureInput.addEventListener("change", () => {
        const file = pictureInput.files && pictureInput.files[0];
        if (!file) {
            sessionProfilePicture = "";
            preview.removeAttribute("src");
            preview.style.display = "none";
            return;
        }
        if (!file.type.startsWith("image/")) {
            error.textContent = "Please choose an image file.";
            pictureInput.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            error.textContent = "Profile picture must be 5MB or smaller.";
            pictureInput.value = "";
            return;
        }
        error.textContent = "";
        const reader = new FileReader();
        reader.onload = () => {
            sessionProfilePicture = String(reader.result || "");
            preview.src = sessionProfilePicture;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    });

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error("Could not load " + src));
            document.body.appendChild(script);
        });
    }

    async function enterChat() {
        const username = usernameInput.value.trim().substring(0, 24);
        if (!username) {
            error.textContent = "Please enter a username.";
            usernameInput.focus();
            return;
        }

        sessionUsername = username;
        error.textContent = "";
        loginButton.disabled = true;
        loginButton.textContent = "Loading...";

        try {
            await loadScript("games.js");
            await loadScript("app.js");
            await loadScript("games-ui.js");
            await loadScript("game-settings.js");
            await loadScript("youtube-together.js");
            await loadScript("chat-features.js");
            await loadScript("youtube-cleanup.js");
            await loadScript("global-background.js");
            await loadScript("solo-player-fix.js");
            await loadScript("ui-animations.js");

            window.__CHAT_SESSION_USERNAME__ = sessionUsername;
            window.__CHAT_SESSION_PROFILE_PICTURE__ = sessionProfilePicture;
            window.__CHAT_SESSION_ID__ = sessionDeviceId;

            if (app) app.style.display = "";
            overlay.remove();
        } catch (e) {
            console.error(e);
            error.textContent = "Could not load Chat App. Please refresh and try again.";
            loginButton.disabled = false;
            loginButton.textContent = "Login";
        }
    }

    loginButton.addEventListener("click", enterChat);
    usernameInput.addEventListener("keydown", e => {
        if (e.key === "Enter") enterChat();
    });

    setTimeout(() => usernameInput.focus(), 0);
})();
