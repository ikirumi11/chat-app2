/* =====================================================
   SCREEN SHARE SETTINGS
   The header button opens a small menu containing only
   stream quality and FPS controls.
===================================================== */

(() => {
    "use strict";

    const button = document.getElementById("screenShareHeaderBtn");
    if (!button) return;

    const QUALITY_VALUES = [150, 200, 250, 300, 350, 400, 450];
    const FPS_VALUES = [5, 10, 15, 20, 25];

    const savedQuality = Number(localStorage.getItem("screen_share_quality"));
    const savedFps = Number(localStorage.getItem("screen_share_fps"));

    let quality = QUALITY_VALUES.includes(savedQuality) ? savedQuality : 450;
    let fps = FPS_VALUES.includes(savedFps) ? savedFps : 25;

    const style = document.createElement("style");
    style.textContent = `
        #screenShareSettingsOverlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            align-items: flex-start;
            justify-content: flex-end;
            padding: 72px 18px 18px;
            background: rgba(0,0,0,.18);
        }

        #screenShareSettingsOverlay.show {
            display: flex;
        }

        #screenShareSettingsMenu {
            width: min(340px, calc(100vw - 36px));
            background: var(--panel, #20242b);
            color: var(--text, #fff);
            border: 1px solid rgba(255,255,255,.12);
            border-radius: var(--corner-radius, 12px);
            box-shadow: 0 18px 50px rgba(0,0,0,.45);
            overflow: hidden;
        }

        .screen-share-settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255,255,255,.09);
        }

        .screen-share-settings-header strong {
            font-size: 15px;
        }

        .screen-share-settings-close {
            border: 0;
            background: transparent;
            color: inherit;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            opacity: .75;
        }

        .screen-share-settings-body {
            display: grid;
            gap: 14px;
            padding: 16px;
        }

        .screen-share-setting {
            display: grid;
            gap: 7px;
        }

        .screen-share-setting label {
            font-size: 13px;
            opacity: .75;
        }

        .screen-share-setting select {
            width: 100%;
            box-sizing: border-box;
            padding: 10px 11px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 8px;
            background: rgba(255,255,255,.06);
            color: inherit;
            font: inherit;
            outline: none;
        }

        .screen-share-settings-save {
            width: 100%;
            border: 0;
            border-radius: 8px;
            padding: 10px 12px;
            background: rgba(255,255,255,.10);
            color: inherit;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
        }

        .screen-share-settings-save:hover,
        .screen-share-settings-close:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "screenShareSettingsOverlay";
    overlay.innerHTML = `
        <div id="screenShareSettingsMenu" role="dialog" aria-modal="true" aria-labelledby="screenShareSettingsTitle">
            <div class="screen-share-settings-header">
                <strong id="screenShareSettingsTitle">🖥️ Screen Share</strong>
                <button class="screen-share-settings-close" type="button" aria-label="Close">×</button>
            </div>
            <div class="screen-share-settings-body">
                <div class="screen-share-setting">
                    <label for="screenShareQuality">Quality</label>
                    <select id="screenShareQuality">
                        ${QUALITY_VALUES.map(value => `<option value="${value}">${value}p</option>`).join("")}
                    </select>
                </div>

                <div class="screen-share-setting">
                    <label for="screenShareFps">FPS</label>
                    <select id="screenShareFps">
                        ${FPS_VALUES.map(value => `<option value="${value}">${value} FPS</option>`).join("")}
                    </select>
                </div>

                <button class="screen-share-settings-save" type="button">Apply</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const menu = overlay.querySelector("#screenShareSettingsMenu");
    const qualitySelect = overlay.querySelector("#screenShareQuality");
    const fpsSelect = overlay.querySelector("#screenShareFps");
    const closeButton = overlay.querySelector(".screen-share-settings-close");
    const applyButton = overlay.querySelector(".screen-share-settings-save");

    qualitySelect.value = String(quality);
    fpsSelect.value = String(fps);

    function openMenu() {
        qualitySelect.value = String(quality);
        fpsSelect.value = String(fps);
        overlay.classList.add("show");
        requestAnimationFrame(() => qualitySelect.focus());
    }

    function closeMenu() {
        overlay.classList.remove("show");
        button.focus();
    }

    function applySettings() {
        quality = Number(qualitySelect.value);
        fps = Number(fpsSelect.value);

        localStorage.setItem("screen_share_quality", String(quality));
        localStorage.setItem("screen_share_fps", String(fps));

        // Expose the selected values for the actual WebRTC screen-share
        // implementation without changing the rest of the chat app.
        window.screenShareSettings = { quality, fps };

        closeMenu();
    }

    window.screenShareSettings = { quality, fps };

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (overlay.classList.contains("show")) closeMenu();
        else openMenu();
    });

    closeButton.addEventListener("click", closeMenu);
    applyButton.addEventListener("click", applySettings);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeMenu();
    });

    menu.addEventListener("click", event => event.stopPropagation());

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("show")) {
            closeMenu();
        }
    });
})();
