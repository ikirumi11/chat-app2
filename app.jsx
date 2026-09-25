import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket } from "@websim/websim-socket";
const initialCustomSettings = {
  bgColor: "#f5f5f5",
  chatBg: "#ffffff",
  textColor: "#333333",
  headerBg: "#007bff",
  headerText: "#ffffff",
  messageBg: "#f8f9fa",
  messageOwnBg: "#007bff",
  messageOwnText: "#ffffff",
  borderColor: "#dddddd",
  inputBg: "#ffffff",
  linkColor: "#007bff",
  backgroundImage: ""
};
const getSavedCustomSettings = () => {
  try {
    return {
      ...initialCustomSettings,
      ...JSON.parse(localStorage.getItem("customThemeSettings") || "{}")
    };
  } catch {
    return initialCustomSettings;
  }
};
const applyCustomTheme = (settings) => {
  const root = document.documentElement;
  root.style.setProperty("--custom-bg-color", settings.bgColor);
  root.style.setProperty("--custom-chat-bg", settings.chatBg);
  root.style.setProperty("--custom-text-color", settings.textColor);
  root.style.setProperty("--custom-header-bg", settings.headerBg);
  root.style.setProperty("--custom-header-text", settings.headerText);
  root.style.setProperty("--custom-message-bg", settings.messageBg);
  root.style.setProperty("--custom-message-own-bg", settings.messageOwnBg);
  root.style.setProperty("--custom-message-own-text", settings.messageOwnText);
  root.style.setProperty("--custom-border-color", settings.borderColor);
  root.style.setProperty("--custom-input-bg", settings.inputBg);
  root.style.setProperty("--custom-link-color", settings.linkColor);
  if (settings.backgroundImage) {
    document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
    document.body.classList.add("custom-background");
  } else {
    document.body.style.backgroundImage = "";
    document.body.classList.remove("custom-background");
  }
  localStorage.setItem("customThemeSettings", JSON.stringify(settings));
};
const initialSettings = {
  showTyping: true,
  chatSize: "normal",
  ttsEnabled: true,
  ttsVoice: "",
  ttsRate: 1,
  ttsPitch: 1,
  sttLanguage: "en-US",
  videoQuality: "high",
  videoFov: "normal",
  videoMaxDuration: 30,
  videoFps: 30,
  showScreens: true
};
const getSavedSettings = () => {
  try {
    return {
      ...initialSettings,
      ...JSON.parse(localStorage.getItem("chatSettings") || "{}")
    };
  } catch {
    return initialSettings;
  }
};
const AVAILABLE_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ru-RU", name: "Russian" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "hi-IN", name: "Hindi" },
  { code: "ar-SA", name: "Arabic" }
];
const isImageUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
    return imageExtensions.some((ext) => urlObj.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
};
const normalizeChatCode = (code) => String(code ?? "").trim().toLowerCase();
function App() {
  const [room, setRoom2] = useState(null);
  const [chatCode, setChatCode] = useState("");
  const [nickname, setNickname] = useState(localStorage.getItem("chatNickname") || "");
  const [theme, setTheme] = useState("light");
  const [showCustomize, setShowCustomize] = useState(false);
  const [customSettings, setCustomSettings] = useState(getSavedCustomSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(getSavedSettings());
  const [uploadProgress, setUploadProgress2] = useState(0);
  const [showPopularCodes, setShowPopularCodes] = useState(false);
  const [popularCodes, setPopularCodes] = useState([]);
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.altKey && e.key === "1") {
        const handleSecondKey = async (e2) => {
          if (e2.key === "3") {
            try {
              const joins = await room.collection("chat_joins").getList();
              const codeCounts = joins.reduce((acc, join) => {
                acc[join.code] = (acc[join.code] || 0) + 1;
                return acc;
              }, {});
              const sorted = Object.entries(codeCounts).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5);
              setPopularCodes(sorted);
              setShowPopularCodes(true);
            } catch (error) {
              console.error("Error fetching popular codes:", error);
            }
          }
          document.removeEventListener("keydown", handleSecondKey);
        };
        document.addEventListener("keydown", handleSecondKey, { once: true });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [room]);
  const handleJoin = async (e) => {
    e.preventDefault();
    const normalizedCode = normalizeChatCode(chatCode);
    if (normalizedCode) {
      setChatCode(normalizedCode);
      try {
        const newRoom = new WebsimSocket();
        await newRoom.collection("chat_joins").create({
          code: normalizedCode,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        setRoom2(newRoom);
      } catch (error) {
        console.error("Error joining chat:", error);
      }
    }
  };
  const selectPopularCode = (code) => {
    setChatCode(code);
    setShowPopularCodes(false);
  };
  useEffect(() => {
    const savedTheme = localStorage.getItem("chatTheme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (savedTheme === "custom") {
      applyCustomTheme(getSavedCustomSettings());
    }
  }, []);
  const handleNicknameChange = (newNickname) => {
    setNickname(newNickname);
    localStorage.setItem("chatNickname", newNickname);
  };
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("chatTheme", newTheme);
    if (newTheme === "custom") {
      applyCustomTheme(customSettings);
      setShowCustomize(true);
    } else {
      document.body.style.backgroundImage = "";
      document.body.classList.remove("custom-background");
    }
  };
  const handleCustomSettingChange = (key, value) => {
    const newSettings = { ...customSettings, [key]: value };
    setCustomSettings(newSettings);
    applyCustomTheme(newSettings);
  };
  const handleBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await websim.upload(file);
        handleCustomSettingChange("backgroundImage", url);
      } catch (error) {
        console.error("Error uploading background:", error);
        alert("Failed to upload background image");
      }
    }
  };
  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem("chatSettings", JSON.stringify(newSettings));
  };
  if (!room) {
    return /* @__PURE__ */ jsxDEV("div", { className: "container", children: /* @__PURE__ */ jsxDEV("form", { className: "join-form", onSubmit: handleJoin, children: [
      /* @__PURE__ */ jsxDEV("div", { className: "header-actions", children: [
        /* @__PURE__ */ jsxDEV("h1", { children: "Join Chat Room" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 254,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: "settings-button",
            onClick: () => setShowSettings(!showSettings),
            children: "\u2699\uFE0F Settings"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 255,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 253,
        columnNumber: 11
      }, this),
      showSettings && /* @__PURE__ */ jsxDEV("div", { className: "settings-panel", children: [
        /* @__PURE__ */ jsxDEV("h3", { children: "Settings" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 266,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
          /* @__PURE__ */ jsxDEV("label", { children: "Show Typing Indicator" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 269,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "checkbox",
              checked: settings.showTyping,
              onChange: (e) => handleSettingChange("showTyping", e.target.checked)
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 270,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 268,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
          /* @__PURE__ */ jsxDEV("label", { children: "Chat Size" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 278,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "select",
            {
              value: settings.chatSize,
              onChange: (e) => handleSettingChange("chatSize", e.target.value),
              children: [
                /* @__PURE__ */ jsxDEV("option", { value: "small", children: "Small" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 283,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "normal", children: "Normal" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 284,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "large", children: "Large" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 285,
                  columnNumber: 19
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "<stdin>",
              lineNumber: 279,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 277,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
          /* @__PURE__ */ jsxDEV("label", { children: "Show Shared Screens" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 290,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "checkbox",
              checked: settings.showScreens,
              onChange: (e) => handleSettingChange("showScreens", e.target.checked)
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 291,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 289,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 265,
        columnNumber: 13
      }, this),
      showPopularCodes && popularCodes.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "popular-codes-modal", children: [
        /* @__PURE__ */ jsxDEV("h3", { children: "Popular Chat Rooms" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 303,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "popular-codes-list", children: popularCodes.map((item, index) => /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: "popular-code-item",
            onClick: () => selectPopularCode(item.code),
            children: [
              /* @__PURE__ */ jsxDEV("span", { className: "rank", children: [
                "#",
                index + 1
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 311,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "code", children: item.code }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 312,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "count", children: [
                item.count,
                " joins"
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 313,
                columnNumber: 21
              }, this)
            ]
          },
          item.code,
          true,
          {
            fileName: "<stdin>",
            lineNumber: 306,
            columnNumber: 19
          },
          this
        )) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 304,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { type: "button", onClick: () => setShowPopularCodes(false), children: "Close" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 317,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 302,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          placeholder: "Enter a nickname",
          value: nickname,
          onChange: (e) => handleNicknameChange(e.target.value),
          required: true
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 321,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          placeholder: "Enter chat code",
          value: chatCode,
          onChange: (e) => setChatCode(e.target.value),
          required: true
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 328,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("button", { type: "submit", children: "Join" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 335,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "theme-selector", style: { marginTop: "1rem" }, children: [
        /* @__PURE__ */ jsxDEV("span", { children: "Theme:" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 338,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: `theme-button ${theme === "light" ? "active" : ""}`,
            onClick: () => handleThemeChange("light"),
            children: "Light"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 339,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: `theme-button ${theme === "dark" ? "active" : ""}`,
            onClick: () => handleThemeChange("dark"),
            children: "Dark"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 346,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: `theme-button ${theme === "full-dark" ? "active" : ""}`,
            onClick: () => handleThemeChange("full-dark"),
            children: "Full Dark"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 353,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            className: `theme-button ${theme === "custom" ? "active" : ""}`,
            onClick: () => {
              handleThemeChange("custom");
              setShowCustomize(true);
            },
            children: "Custom"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 360,
            columnNumber: 13
          },
          this
        ),
        showCustomize && theme === "custom" && /* @__PURE__ */ jsxDEV("div", { className: "color-picker-panel", children: [
          /* @__PURE__ */ jsxDEV("h3", { children: "Customize Theme" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 373,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "background-options", children: [
            /* @__PURE__ */ jsxDEV("h4", { children: "Background Settings" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 376,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
              /* @__PURE__ */ jsxDEV("label", { children: "Background Color:" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 378,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "color",
                  value: customSettings.bgColor,
                  onChange: (e) => handleCustomSettingChange("bgColor", e.target.value)
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 379,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 377,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("div", { children: "Upload Background Image:" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 387,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("label", { className: "file-upload-label", children: [
                "Choose Image",
                /* @__PURE__ */ jsxDEV(
                  "input",
                  {
                    type: "file",
                    accept: "image/*",
                    className: "file-upload-input",
                    onChange: handleBackgroundUpload
                  },
                  void 0,
                  false,
                  {
                    fileName: "<stdin>",
                    lineNumber: 390,
                    columnNumber: 23
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 388,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 386,
              columnNumber: 19
            }, this),
            customSettings.backgroundImage && /* @__PURE__ */ jsxDEV("div", { className: "background-preview", style: { backgroundImage: `url(${customSettings.backgroundImage})` }, children: /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: "remove-bg",
                onClick: () => handleCustomSettingChange("backgroundImage", ""),
                children: "\xD7"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 401,
                columnNumber: 23
              },
              this
            ) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 400,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 375,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("h4", { children: "Color Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 412,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Chat Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 414,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.chatBg,
                onChange: (e) => handleCustomSettingChange("chatBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 415,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 413,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Text Color:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 423,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.textColor,
                onChange: (e) => handleCustomSettingChange("textColor", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 424,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 422,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Header Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 432,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.headerBg,
                onChange: (e) => handleCustomSettingChange("headerBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 433,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 431,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Header Text:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 441,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.headerText,
                onChange: (e) => handleCustomSettingChange("headerText", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 442,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 440,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Message Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 450,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageBg,
                onChange: (e) => handleCustomSettingChange("messageBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 451,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 449,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Own Message Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 459,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageOwnBg,
                onChange: (e) => handleCustomSettingChange("messageOwnBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 460,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 458,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Own Message Text:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 468,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageOwnText,
                onChange: (e) => handleCustomSettingChange("messageOwnText", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 469,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 467,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              type: "button",
              className: "theme-button",
              onClick: () => setShowCustomize(false),
              style: { marginTop: "1rem" },
              children: "Close"
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 475,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 372,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 337,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 252,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 251,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(
    ChatRoom,
    {
      room,
      chatCode,
      nickname,
      onNicknameChange: handleNicknameChange,
      theme,
      onThemeChange: handleThemeChange,
      showCustomize,
      setShowCustomize,
      customSettings,
      handleCustomSettingChange,
      handleBackgroundUpload,
      settings,
      onSettingChange: handleSettingChange,
      uploadProgress
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 492,
      columnNumber: 5
    },
    this
  );
}
function ChatRoom({
  room,
  chatCode,
  nickname,
  onNicknameChange,
  theme,
  onThemeChange,
  showCustomize,
  setShowCustomize,
  customSettings,
  handleCustomSettingChange,
  handleBackgroundUpload,
  settings,
  onSettingChange,
  uploadProgress
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [showNicknameEdit, setShowNicknameEdit] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [typingUsers, setTypingUsers] = useState(/* @__PURE__ */ new Set());
  const fileInputRef = useRef();
  const messagesEndRef = useRef();
  const inputRef = useRef();
  const typingTimeoutRef = useRef();
  const messageSubscriptionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecorder, setVideoRecorder] = useState(null);
  const [videoPreviewStream, setVideoPreviewStream] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const chunks = [];
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(/* @__PURE__ */ new Set());
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollOptions, setPollOptions] = useState([""]);
  const [showEffectCreator, setShowEffectCreator] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState("confetti");
  const [showScreenShare, setShowScreenShare] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [sharedScreens, setSharedScreens] = useState([]);
  const getVideoConstraints = () => {
    const quality = {
      high: { width: 1920, height: 1080 },
      medium: { width: 1280, height: 720 },
      low: { width: 640, height: 480 }
    }[settings.videoQuality];
    const fov = {
      wide: 120,
      normal: 90,
      narrow: 60
    }[settings.videoFov];
    return {
      ...quality,
      frameRate: settings.videoFps,
      facingMode: "user",
      aspectRatio: 16 / 9,
      fov
    };
  };
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(),
        audio: true
      });
      setVideoPreviewStream(stream);
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const uploadWithProgress = async (blob2) => {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/upload");
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.round(event.loaded / event.total * 100);
                onSettingChange("uploadProgress", progress);
              }
            };
            xhr.onload = () => {
              if (xhr.status === 200) {
                resolve(JSON.parse(xhr.response).url);
              } else {
                reject(new Error("Upload failed"));
              }
            };
            xhr.onerror = () => reject(new Error("Upload failed"));
            const formData = new FormData();
            formData.append("file", blob2);
            xhr.send(formData);
          });
        };
        try {
          setIsUploading(true);
          onSettingChange("uploadProgress", 0);
          const url = await uploadWithProgress(blob);
          await room.collection("message").create({
            video: url,
            chatCode,
            nickname,
            type: "video",
            fileName: "video-recording.webm",
            fileType: "video/webm"
          });
        } catch (error) {
          console.error("Error uploading video:", error);
          alert("Failed to upload video");
        } finally {
          setIsUploading(false);
          onSettingChange("uploadProgress", 0);
          if (videoPreviewStream) {
            videoPreviewStream.getTracks().forEach((track) => track.stop());
          }
          setVideoRecorder(null);
          setVideoPreviewStream(null);
          chunks.length = 0;
        }
      };
      recorder.start();
      setVideoRecorder(recorder);
      setIsVideoRecording(true);
      setTimeout(() => {
        if (recorder.state === "recording") {
          stopVideoRecording();
        }
      }, settings.videoMaxDuration * 1e3);
    } catch (err) {
      console.error("Failed to start video recording:", err);
      alert("Could not access camera or microphone");
    }
  };
  const stopVideoRecording = async () => {
    if (videoRecorder && videoRecorder.state === "recording") {
      videoRecorder.stop();
      setIsVideoRecording(false);
      try {
        if (videoPreviewStream) {
          videoPreviewStream.getTracks().forEach((track) => track.stop());
        }
        const blob = new Blob(chunks, { type: "video/webm" });
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", blob);
        const xhr = new XMLHttpRequest();
        const uploadPromise = new Promise((resolve, reject) => {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round(event.loaded / event.total * 100);
              setUploadProgress(progress);
            }
          };
          xhr.onload = async () => {
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              resolve(response.url);
            } else {
              reject(new Error("Upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
        });
        const url = await websim.upload(blob, {
          onProgress: (progress) => {
            setUploadProgress(progress);
          }
        });
        await room.collection("message").create({
          video: url,
          chatCode,
          nickname,
          type: "video",
          fileName: "video-recording.webm",
          fileType: "video/webm"
        });
      } catch (error) {
        console.error("Error uploading video:", error);
        alert("Failed to upload video");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setVideoRecorder(null);
        setVideoPreviewStream(null);
        chunks.length = 0;
      }
    }
  };
  const handleCameraCapture = async () => {
    try {
      let cleanup = function() {
        stream.getTracks().forEach((track) => track.stop());
        modal.remove();
      };
      const video = document.createElement("video");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const modal = document.createElement("div");
      modal.className = "camera-modal";
      const previewContainer = document.createElement("div");
      previewContainer.className = "camera-preview-container";
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "camera-button-container";
      const captureBtn = document.createElement("button");
      captureBtn.textContent = "\u{1F4F8} Capture";
      captureBtn.className = "camera-capture-btn";
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "\u2715 Close";
      closeBtn.className = "camera-close-btn";
      previewContainer.appendChild(video);
      buttonContainer.appendChild(captureBtn);
      buttonContainer.appendChild(closeBtn);
      modal.appendChild(previewContainer);
      modal.appendChild(buttonContainer);
      document.body.appendChild(modal);
      await video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      captureBtn.onclick = async () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"));
        const url = await websim.upload(blob);
        await room.collection("message").create({
          file: url,
          fileName: "camera-capture.jpg",
          fileType: "image/jpeg",
          chatCode,
          nickname
        });
        cleanup();
      };
      closeBtn.onclick = cleanup;
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Could not access camera");
    }
  };
  useEffect(() => {
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0 && !settings.ttsVoice) {
          onSettingChange("ttsVoice", voices[0].name);
        }
      };
      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }
  }, []);
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks2 = [];
      recorder.ondataavailable = (e) => chunks2.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks2, { type: "audio/webm" });
        const url = await websim.upload(blob);
        await room.collection("message").create({
          audio: url,
          chatCode,
          nickname
        });
        setAudioChunks([]);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone");
    }
  };
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };
  const speakText = (text, voice) => {
    if ("speechSynthesis" in window && settings.ttsEnabled) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      utterance.voice = voices.find((v) => v.name === (voice || settings.ttsVoice)) || voices[0];
      utterance.rate = settings.ttsRate;
      utterance.pitch = settings.ttsPitch;
      speechSynthesis.speak(utterance);
    }
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current();
    }
    const deleteOldMessages = async (msgs) => {
      msgs.forEach(async (msg) => {
        try {
          await room.collection("message").delete(msg.id);
        } catch (error) {
          console.error("Error deleting message:", error);
        }
      });
    };
    const cleanOldMessages = async () => {
      const allMessages = await room.collection("message").filter({ chatCode: normalizeChatCode(chatCode) }).getList();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      const oldMessages = allMessages.filter(
        (msg) => normalizeChatCode(msg.chatCode) === normalizeChatCode(chatCode) && new Date(msg.created_at) < oneDayAgo
      );
      if (oldMessages.length > 0) {
        await deleteOldMessages(oldMessages);
      }
    };
    cleanOldMessages();
    const cleanupInterval = setInterval(cleanOldMessages, 24 * 60 * 60 * 1e3);
    const roomCode = normalizeChatCode(chatCode);
    messageSubscriptionRef.current = room.collection("message").filter({ chatCode: roomCode }).subscribe((msgs) => {
      const roomMessages = msgs.filter((msg) => normalizeChatCode(msg.chatCode) === roomCode).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(roomMessages);
      scrollToBottom();
    });
    const screenShareSubscription = room.collection("screen_share").filter({ chatCode: roomCode }).subscribe((screens) => {
      const currentTime = Date.now();
      setSharedScreens(screens.filter((screen) => {
        const screenTime = new Date(screen.created_at).getTime();
        return normalizeChatCode(screen.chatCode) === roomCode && currentTime - screenTime < 5 * 60 * 1e3;
      }));
    });
    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current();
      }
      if (screenShareSubscription) {
        screenShareSubscription();
      }
      clearInterval(cleanupInterval);
    };
  }, [room, chatCode]);
  const broadcastTyping = (isTyping) => {
    room.send({
      type: "typing",
      chatCode: normalizeChatCode(chatCode),
      isTyping,
      nickname: nickname || room.party.client.username
    });
  };
  const handleTyping = () => {
    broadcastTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 2e3);
  };
  useEffect(() => {
    setTypingUsers(/* @__PURE__ */ new Set());
    const handleMessage = (event) => {
      const data = event.data;
      if (normalizeChatCode(data.chatCode) !== normalizeChatCode(chatCode)) return;
      if (data.type === "typing") {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.nickname);
          } else {
            newSet.delete(data.nickname);
          }
          return newSet;
        });
      } else if (data.type === "effect") {
        playEffect(data.effectType, data.username);
      }
    };
    room.onmessage = handleMessage;
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [room, nickname, chatCode]);
  const handleSend = async (e) => {
    e.preventDefault();
    if (message.trim()) {
      if (message.startsWith("/") && !message.startsWith("/ai")) {
        const command = message.slice(1).toLowerCase();
        handleCommand(command);
        setMessage("");
        return;
      }
      if (message.startsWith("/ai")) {
        await room.collection("message").create({
          text: message,
          chatCode,
          nickname
        });
        room.send({
          type: "typing",
          chatCode: normalizeChatCode(chatCode),
          isTyping: true,
          nickname: "AI Assistant"
        });
        try {
          const aiPrompt = message.slice(4);
          const response = await fetch("/api/ai_completion", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              prompt: `You are a helpful AI assistant in a chat room. Respond to: ${aiPrompt}
              
              Keep responses concise but engaging. Include emojis where appropriate.
              Format response in clear, readable text.
              
              interface Response {
                reply: string;
              }
              
              {
                "reply": "\u{1F914} That's an interesting question! Based on my analysis, I think..."
              }
              `,
              data: aiPrompt
            })
          });
          const data = await response.json();
          await room.collection("message").create({
            text: data.reply,
            chatCode,
            nickname: "AI Assistant",
            isAI: true
          });
          room.send({
            type: "typing",
            chatCode: normalizeChatCode(chatCode),
            isTyping: false,
            nickname: "AI Assistant"
          });
        } catch (error) {
          console.error("Error getting AI response:", error);
          await room.collection("message").create({
            text: "\u274C Sorry, I encountered an error while processing your request.",
            chatCode,
            nickname: "AI Assistant",
            isAI: true
          });
        }
      } else {
        const words = message.split(" ");
        const imageUrls = words.filter((word) => isImageUrl(word));
        if (imageUrls.length > 0) {
          const textWithoutImages = words.filter((word) => !isImageUrl(word)).join(" ");
          await room.collection("message").create({
            text: textWithoutImages || null,
            images: imageUrls,
            chatCode,
            nickname
          });
        } else {
          await room.collection("message").create({
            text: message,
            chatCode,
            nickname
          });
        }
      }
      setMessage("");
    }
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await websim.upload(file);
        await room.collection("message").create({
          file: url,
          fileName: file.name,
          fileType: file.type,
          chatCode
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file");
      }
    }
  };
  const handleDeleteMessage = async (messageId) => {
    try {
      await room.collection("message").delete(messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
  };
  const handleStartEdit = (messageId) => {
    setEditingMessageId(messageId);
  };
  const handleSaveEdit = async (messageId, newText) => {
    try {
      await room.collection("message").update(messageId, {
        text: newText
      });
      setEditingMessageId(null);
    } catch (error) {
      console.error("Error updating message:", error);
      alert("Failed to update message");
    }
  };
  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };
  const formatMessageText = (text) => {
    if (!text) return "";
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const username = match[1];
      const nickname2 = localStorage.getItem(`chatNickname_${username}`) || username;
      if (Object.values(room.party.peers).some((peer) => peer.username === username)) {
        parts.push(
          /* @__PURE__ */ jsxDEV("span", { className: "mention", children: [
            "@",
            nickname2
          ] }, match.index, true, {
            fileName: "<stdin>",
            lineNumber: 1190,
            columnNumber: 11
          }, this)
        );
      } else {
        parts.push(`@${nickname2}`);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };
  const handleMessageChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setMessage(value);
    setCursorPosition(position);
    handleTyping();
    const lastAtSymbol = value.lastIndexOf("@", position);
    if (lastAtSymbol !== -1) {
      const nextSpace = value.indexOf(" ", lastAtSymbol);
      const searchEnd = nextSpace === -1 ? value.length : nextSpace;
      if (position > lastAtSymbol && position <= searchEnd) {
        const search = value.slice(lastAtSymbol + 1, searchEnd);
        setMentionSearch(search.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };
  const insertMention = (username, nickname2) => {
    const lastAtSymbol = message.lastIndexOf("@", cursorPosition);
    const nextSpace = message.indexOf(" ", lastAtSymbol);
    const beforeMention = message.slice(0, lastAtSymbol);
    const afterMention = nextSpace === -1 ? "" : message.slice(nextSpace);
    const mentionText = nickname2;
    setMessage(`${beforeMention}@${mentionText}${afterMention}`);
    setShowMentions(false);
    inputRef.current.focus();
  };
  const toggleSpeechToText = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition is not supported in your browser");
      return;
    }
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.sttLanguage;
    recognition.onstart = () => {
      setIsListening(true);
    };
    recognition.onresult = (event) => {
      const currentTranscript = Array.from(event.results).map((result) => result[0].transcript).join("");
      setTranscript(currentTranscript);
      setMessage(currentTranscript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopListening();
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
  };
  const handleCommand = async (command) => {
    const parts = command.split(" ");
    const mainCommand = parts[0];
    switch (mainCommand) {
      case "clear":
        setHiddenMessageIds(new Set(messages.map((m) => m.id)));
        break;
      case "leave":
        window.location.reload();
        break;
      case "reconnect":
        try {
          const newRoom = new WebsimSocket();
          setRoom(newRoom);
        } catch (error) {
          console.error("Failed to reconnect:", error);
          alert("Failed to reconnect. Please try again or refresh the page.");
        }
        break;
      case "poll":
        setShowPollCreator(true);
        break;
      case "effect":
        setShowEffectCreator(true);
        break;
      default:
        console.log("Unknown command:", command);
    }
    setShowCommandMenu(false);
  };
  const handlePollSubmit = async () => {
    if (!pollTitle || pollOptions.filter((opt) => opt.trim()).length === 0) {
      alert("Please enter a title and at least one option");
      return;
    }
    const validOptions = pollOptions.filter((opt) => opt.trim());
    try {
      await room.collection("message").create({
        text: pollTitle,
        chatCode,
        nickname,
        isPoll: true,
        pollData: {
          title: pollTitle,
          options: validOptions,
          votes: {}
          // Initialize empty votes object
        }
      });
      setShowPollCreator(false);
      setPollTitle("");
      setPollOptions([""]);
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Failed to create poll");
    }
  };
  const handleVote = async (messageId, pollData, optionIndex) => {
    try {
      const votes = { ...pollData.votes };
      const username = room.party.client.username;
      Object.keys(votes).forEach((key) => {
        if (votes[key]?.includes(username)) {
          votes[key] = votes[key].filter((voter) => voter !== username);
        }
      });
      if (!votes[optionIndex]) {
        votes[optionIndex] = [];
      }
      votes[optionIndex].push(username);
      await room.collection("message").update(messageId, {
        pollData: {
          ...pollData,
          votes
        }
      });
    } catch (error) {
      console.error("Error voting:", error);
      alert("Failed to register vote");
    }
  };
  const sendEffect = (effectType) => {
    try {
      room.collection("message").create({
        text: `\u{1F389} Sent a ${effectType} effect!`,
        chatCode,
        nickname,
        isEffect: true,
        effectType
      });
      room.send({
        type: "effect",
        chatCode: normalizeChatCode(chatCode),
        effectType,
        username: room.party.client.username
      });
      setShowEffectCreator(false);
    } catch (error) {
      console.error("Error sending effect:", error);
      alert("Failed to send effect");
    }
  };
  const playEffect = (effectType, username) => {
    const container = document.createElement("div");
    container.className = `effect ${effectType}`;
    document.body.appendChild(container);
    switch (effectType) {
      case "confetti":
        for (let i = 0; i < 50; i++) {
          const confetti = document.createElement("div");
          confetti.className = "confetti-piece";
          confetti.style.backgroundColor = `hsl(${Math.random() * 360}deg, 100%, 50%)`;
          confetti.style.left = `${Math.random() * 100}vw`;
          container.appendChild(confetti);
        }
        break;
      case "hearts":
        for (let i = 0; i < 20; i++) {
          const heart = document.createElement("div");
          heart.className = "heart";
          heart.style.left = `${Math.random() * 100}vw`;
          container.appendChild(heart);
        }
        break;
      case "fireworks":
        for (let i = 0; i < 10; i++) {
          const firework = document.createElement("div");
          firework.className = "firework";
          firework.style.left = `${Math.random() * 100}vw`;
          firework.style.animationDelay = `${Math.random() * 2}s`;
          container.appendChild(firework);
        }
        break;
      case "sparkles":
        for (let i = 0; i < 30; i++) {
          const sparkle = document.createElement("div");
          sparkle.className = "sparkle";
          sparkle.style.left = `${Math.random() * 100}vw`;
          sparkle.style.animationDelay = `${Math.random() * 3}s`;
          container.appendChild(sparkle);
        }
        break;
      case "bubbles":
        for (let i = 0; i < 25; i++) {
          const bubble = document.createElement("div");
          bubble.className = "bubble";
          bubble.style.left = `${Math.random() * 100}vw`;
          bubble.style.animationDelay = `${Math.random() * 4}s`;
          container.appendChild(bubble);
        }
        break;
      case "leaves":
        for (let i = 0; i < 40; i++) {
          const leaf = document.createElement("div");
          leaf.className = "leaf";
          leaf.style.top = `${Math.random() * 100}vh`;
          leaf.style.animationDelay = `${Math.random() * 5}s`;
          container.appendChild(leaf);
        }
        break;
    }
    setTimeout(() => container.remove(), 5e3);
  };
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor"
        }
      });
      setScreenStream(stream);
      setIsScreenSharing(true);
      const videoTrack = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.5);
      const blob = await (await fetch(thumbnailUrl)).blob();
      const uploadedThumbnail = await websim.upload(blob);
      await room.collection("screen_share").create({
        thumbnail: uploadedThumbnail,
        chatCode,
        nickname,
        active: true
      });
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
      alert("Could not access screen sharing");
      setIsScreenSharing(false);
    }
  };
  const stopScreenShare = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      const myScreens = await room.collection("screen_share").filter({
        username: room.party.client.username,
        active: true,
        chatCode: normalizeChatCode(chatCode)
      }).getList();
      for (const screen of myScreens) {
        await room.collection("screen_share").update(screen.id, { active: false });
      }
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "container", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "chat-wrapper", children: [
      /* @__PURE__ */ jsxDEV("div", { className: `chat-container size-${settings.chatSize}`, children: [
        /* @__PURE__ */ jsxDEV("div", { className: "chat-header", children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: "1rem" }, children: [
            /* @__PURE__ */ jsxDEV("h2", { children: [
              "Chat Room: ",
              chatCode
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1568,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "nickname-display", children: showNicknameEdit ? /* @__PURE__ */ jsxDEV("div", { className: "nickname-edit", children: /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "text",
                value: nickname,
                onChange: (e) => onNicknameChange(e.target.value),
                onBlur: () => setShowNicknameEdit(false),
                onKeyDown: (e) => {
                  if (e.key === "Enter") setShowNicknameEdit(false);
                },
                autoFocus: true
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1572,
                columnNumber: 21
              },
              this
            ) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1571,
              columnNumber: 19
            }, this) : /* @__PURE__ */ jsxDEV("span", { onClick: () => setShowNicknameEdit(true), style: { cursor: "pointer" }, children: [
              "Nickname: ",
              nickname
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1584,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1569,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1567,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "header-tabs", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: `tab-button ${!showScreenShare ? "active" : ""}`,
                onClick: () => setShowScreenShare(false),
                children: "Chat"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1592,
                columnNumber: 15
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: `tab-button ${showScreenShare ? "active" : ""}`,
                onClick: () => setShowScreenShare(true),
                children: "Screens"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1598,
                columnNumber: 15
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("div", { className: "theme-selector", children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  className: `theme-button ${theme === "light" ? "active" : ""}`,
                  onClick: () => onThemeChange("light"),
                  children: "Light"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1605,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  className: `theme-button ${theme === "dark" ? "active" : ""}`,
                  onClick: () => onThemeChange("dark"),
                  children: "Dark"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1611,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  className: `theme-button ${theme === "full-dark" ? "active" : ""}`,
                  onClick: () => onThemeChange("full-dark"),
                  children: "Full Dark"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1617,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  className: `theme-button ${theme === "custom" ? "active" : ""}`,
                  onClick: () => onThemeChange("custom"),
                  children: "Custom"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1623,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  className: "settings-button",
                  onClick: () => setShowCustomize(!showCustomize),
                  title: "Settings",
                  children: "\u2699\uFE0F"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1629,
                  columnNumber: 17
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1604,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1591,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1566,
          columnNumber: 11
        }, this),
        showScreenShare ? /* @__PURE__ */ jsxDEV("div", { className: "screen-share-container", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "screen-share-header", children: [
            /* @__PURE__ */ jsxDEV("h3", { children: "Screen Sharing" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1643,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                className: `screen-share-button ${isScreenSharing ? "active" : ""}`,
                onClick: isScreenSharing ? stopScreenShare : startScreenShare,
                children: isScreenSharing ? "Stop Sharing" : "Share Screen"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1644,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1642,
            columnNumber: 15
          }, this),
          settings.showScreens && sharedScreens.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "shared-screens-grid", children: sharedScreens.filter((screen) => screen.active).map((screen) => /* @__PURE__ */ jsxDEV("div", { className: "shared-screen-item", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "screen-user-info", children: [
              /* @__PURE__ */ jsxDEV(
                "img",
                {
                  src: `https://images.websim.ai/avatar/${screen.username}`,
                  alt: screen.nickname || screen.username,
                  className: "screen-avatar"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1657,
                  columnNumber: 25
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("span", { children: screen.nickname || screen.username }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1662,
                columnNumber: 25
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1656,
              columnNumber: 23
            }, this),
            /* @__PURE__ */ jsxDEV(
              "img",
              {
                src: screen.thumbnail,
                alt: `Screen shared by ${screen.nickname || screen.username}`,
                className: "screen-thumbnail",
                onClick: () => window.open(screen.thumbnail, "_blank")
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1664,
                columnNumber: 23
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("span", { className: "screen-timestamp", children: [
              "Shared ",
              new Date(screen.created_at).toLocaleTimeString()
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1670,
              columnNumber: 23
            }, this)
          ] }, screen.id, true, {
            fileName: "<stdin>",
            lineNumber: 1655,
            columnNumber: 21
          }, this)) }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1653,
            columnNumber: 17
          }, this) : /* @__PURE__ */ jsxDEV("div", { className: "no-screens-message", children: settings.showScreens ? "No screens are currently being shared in this room." : "Screen sharing display is turned off in settings." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1677,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1641,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
          /* @__PURE__ */ jsxDEV("div", { className: "messages", children: [
            messages.filter((msg) => !hiddenMessageIds.has(msg.id)).map((msg) => /* @__PURE__ */ jsxDEV(
              Message,
              {
                message: msg,
                isOwn: msg.username === room.party.client.username,
                onDelete: handleDeleteMessage,
                onStartEdit: handleStartEdit,
                onSaveEdit: handleSaveEdit,
                onCancelEdit: handleCancelEdit,
                isEditing: editingMessageId === msg.id,
                formatMessageText,
                onSpeak: speakText,
                ttsEnabled: settings.ttsEnabled,
                onVote: handleVote,
                playEffect,
                room,
                username: room.party.client.username
              },
              msg.id,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1690,
                columnNumber: 21
              },
              this
            )),
            /* @__PURE__ */ jsxDEV("div", { ref: messagesEndRef }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1708,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1686,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("form", { className: "input-area", onSubmit: handleSend, children: [
            /* @__PURE__ */ jsxDEV("div", { className: "input-container", children: [
              settings.showTyping && typingUsers.size > 0 && /* @__PURE__ */ jsxDEV("div", { className: "typing-indicator", children: [
                Array.from(typingUsers).join(", "),
                " ",
                typingUsers.size === 1 ? "is" : "are",
                " typing..."
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 1714,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  className: "command-menu-button",
                  onClick: () => setShowCommandMenu(!showCommandMenu),
                  title: "Show Commands",
                  children: "/"
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1718,
                  columnNumber: 19
                },
                this
              ),
              showCommandMenu && /* @__PURE__ */ jsxDEV("div", { className: "command-menu", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "command-item", onClick: () => handleCommand("clear"), children: "/clear - Clear chat history" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 1728,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "command-item", onClick: () => handleCommand("leave"), children: "/leave - Leave chat room" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 1731,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "command-item", onClick: () => handleCommand("reconnect"), children: "/reconnect - Reconnect to chat" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 1734,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "command-item", onClick: () => handleCommand("poll"), children: "/poll - Create a poll" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 1737,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "command-item", onClick: () => handleCommand("effect"), children: "/effect - Send an effect" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 1740,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 1727,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  ref: inputRef,
                  type: "text",
                  placeholder: "Type a message... (Use @ to mention)",
                  value: message,
                  onChange: handleMessageChange
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1745,
                  columnNumber: 19
                },
                this
              ),
              showMentions && /* @__PURE__ */ jsxDEV("div", { className: "mentions-dropdown", children: Object.values(room.party.peers).filter((peer) => {
                const peerNickname = localStorage.getItem(`chatNickname_${peer.username}`) || peer.username;
                const searchTerm = mentionSearch.toLowerCase();
                return peerNickname.toLowerCase().includes(searchTerm) || peer.username.toLowerCase().includes(searchTerm);
              }).map((peer) => {
                const peerNickname = localStorage.getItem(`chatNickname_${peer.username}`) || peer.username;
                return /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    className: "mention-item",
                    onClick: () => insertMention(peer.username, peerNickname),
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        "img",
                        {
                          className: "mention-avatar",
                          src: `https://images.websim.ai/avatar/${peer.username}`,
                          alt: peerNickname
                        },
                        void 0,
                        false,
                        {
                          fileName: "<stdin>",
                          lineNumber: 1769,
                          columnNumber: 31
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV("span", { children: peerNickname }, void 0, false, {
                        fileName: "<stdin>",
                        lineNumber: 1774,
                        columnNumber: 31
                      }, this),
                      peerNickname !== peer.username && /* @__PURE__ */ jsxDEV("span", { style: { opacity: 0.7 }, children: [
                        " (",
                        peer.username,
                        ")"
                      ] }, void 0, true, {
                        fileName: "<stdin>",
                        lineNumber: 1776,
                        columnNumber: 33
                      }, this)
                    ]
                  },
                  peer.username,
                  true,
                  {
                    fileName: "<stdin>",
                    lineNumber: 1764,
                    columnNumber: 29
                  },
                  this
                );
              }) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1753,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1712,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "file",
                ref: fileInputRef,
                className: "file-input",
                onChange: handleFileUpload
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1785,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "label",
              {
                className: "file-label",
                onClick: () => fileInputRef.current.click(),
                children: "\u{1F4CE}"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1791,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: "camera-button",
                onClick: handleCameraCapture,
                title: "Take Photo",
                children: "\u{1F4F7}"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1797,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: `voice-record-button ${isRecording ? "recording" : ""}`,
                onClick: isRecording ? stopRecording : startRecording,
                children: isRecording ? "\u2B24 Stop" : "\u{1F3A4}"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1805,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: `video-record-button ${isVideoRecording ? "recording" : ""}`,
                onClick: isVideoRecording ? stopVideoRecording : startVideoRecording,
                children: isVideoRecording ? "\u2B24 Stop Video" : "\u{1F4F9}"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1812,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                className: `speech-to-text-button ${isListening ? "listening" : ""}`,
                onClick: toggleSpeechToText,
                title: isListening ? "Stop Dictation" : "Start Dictation",
                children: isListening ? "\u{1F399}\uFE0F Stop" : "\u{1F399}\uFE0F"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1819,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("button", { type: "submit", children: "Send" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1827,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1711,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1685,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 1565,
        columnNumber: 9
      }, this),
      showCustomize && /* @__PURE__ */ jsxDEV("div", { className: "customize-panel", children: [
        /* @__PURE__ */ jsxDEV("h3", { children: "Settings" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 1835,
          columnNumber: 13
        }, this),
        theme === "custom" && /* @__PURE__ */ jsxDEV(Fragment, { children: /* @__PURE__ */ jsxDEV("div", { className: "background-options", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: "Theme Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1840,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Background Color:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1842,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.bgColor,
                onChange: (e) => handleCustomSettingChange("bgColor", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1843,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1841,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("div", { children: "Upload Background Image:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1851,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("label", { className: "file-upload-label", children: [
              "Choose Image",
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "file",
                  accept: "image/*",
                  className: "file-upload-input",
                  onChange: handleBackgroundUpload
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1854,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1852,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1850,
            columnNumber: 19
          }, this),
          customSettings.backgroundImage && /* @__PURE__ */ jsxDEV("div", { className: "background-preview", style: { backgroundImage: `url(${customSettings.backgroundImage})` }, children: /* @__PURE__ */ jsxDEV(
            "button",
            {
              className: "remove-bg",
              onClick: () => handleCustomSettingChange("backgroundImage", ""),
              children: "\xD7"
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 1865,
              columnNumber: 23
            },
            this
          ) }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1864,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("h4", { children: "Color Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1874,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Chat Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1876,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.chatBg,
                onChange: (e) => handleCustomSettingChange("chatBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1877,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1875,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Text Color:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1885,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.textColor,
                onChange: (e) => handleCustomSettingChange("textColor", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1886,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1884,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Header Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1894,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.headerBg,
                onChange: (e) => handleCustomSettingChange("headerBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1895,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1893,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Header Text:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1903,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.headerText,
                onChange: (e) => handleCustomSettingChange("headerText", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1904,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1902,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Message Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1912,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageBg,
                onChange: (e) => handleCustomSettingChange("messageBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1913,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1911,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Own Message Background:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1921,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageOwnBg,
                onChange: (e) => handleCustomSettingChange("messageOwnBg", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1922,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1920,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "color-picker-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Own Message Text:" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1930,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "color",
                value: customSettings.messageOwnText,
                onChange: (e) => handleCustomSettingChange("messageOwnText", e.target.value)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1931,
                columnNumber: 21
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1929,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1839,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 1838,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "settings-section", children: [
          /* @__PURE__ */ jsxDEV("h3", { children: "Chat Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1942,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Show Typing Indicator" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1944,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "checkbox",
                checked: settings.showTyping,
                onChange: (e) => onSettingChange("showTyping", e.target.checked)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1945,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1943,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Chat Size" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1953,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.chatSize,
                onChange: (e) => onSettingChange("chatSize", e.target.value),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "small", children: "Small" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 1958,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "normal", children: "Normal" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 1959,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "large", children: "Large" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 1960,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 1954,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1952,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Show Shared Screens" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1965,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "checkbox",
                checked: settings.showScreens,
                onChange: (e) => onSettingChange("showScreens", e.target.checked)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1966,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1964,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1941,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "voice-settings", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: "Voice Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1975,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Enable Text-to-Speech" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1977,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "checkbox",
                checked: settings.ttsEnabled,
                onChange: (e) => onSettingChange("ttsEnabled", e.target.checked)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1978,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1976,
            columnNumber: 15
          }, this),
          settings.ttsEnabled && /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
              /* @__PURE__ */ jsxDEV("label", { children: "Voice" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1988,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "select",
                {
                  value: settings.ttsVoice,
                  onChange: (e) => onSettingChange("ttsVoice", e.target.value),
                  children: speechSynthesis.getVoices().map((voice) => /* @__PURE__ */ jsxDEV("option", { value: voice.name, children: voice.name }, voice.name, false, {
                    fileName: "<stdin>",
                    lineNumber: 1994,
                    columnNumber: 25
                  }, this))
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 1989,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1987,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
              /* @__PURE__ */ jsxDEV("label", { children: [
                "Speech Rate: ",
                settings.ttsRate.toFixed(2),
                "x"
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 2002,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "range",
                  min: "0.01",
                  max: "3",
                  step: "0.01",
                  value: settings.ttsRate,
                  onChange: (e) => onSettingChange("ttsRate", parseFloat(e.target.value))
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 2003,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 2001,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
              /* @__PURE__ */ jsxDEV("label", { children: [
                "Pitch: ",
                settings.ttsPitch.toFixed(2)
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 2014,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "range",
                  min: "0.01",
                  max: "10",
                  step: "0.01",
                  value: settings.ttsPitch,
                  onChange: (e) => onSettingChange("ttsPitch", parseFloat(e.target.value))
                },
                void 0,
                false,
                {
                  fileName: "<stdin>",
                  lineNumber: 2015,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 2013,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1986,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1974,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "speech-recognition-settings", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: "Speech Recognition Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2029,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Recognition Language" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2031,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.sttLanguage,
                onChange: (e) => onSettingChange("sttLanguage", e.target.value),
                children: AVAILABLE_LANGUAGES.map((lang) => /* @__PURE__ */ jsxDEV("option", { value: lang.code, children: lang.name }, lang.code, false, {
                  fileName: "<stdin>",
                  lineNumber: 2037,
                  columnNumber: 21
                }, this))
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 2032,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2030,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2028,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "video-settings", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: "Video Settings" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2046,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Video Quality" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2048,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.videoQuality,
                onChange: (e) => onSettingChange("videoQuality", e.target.value),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "high", children: "High (1080p)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2053,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "medium", children: "Medium (720p)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2054,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "low", children: "Low (480p)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2055,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 2049,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2047,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Field of View" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2060,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.videoFov,
                onChange: (e) => onSettingChange("videoFov", e.target.value),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "wide", children: "Wide (120\xB0)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2065,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "normal", children: "Normal (90\xB0)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2066,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "narrow", children: "Narrow (60\xB0)" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2067,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 2061,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2059,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Frame Rate (FPS)" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2072,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.videoFps,
                onChange: (e) => onSettingChange("videoFps", Number(e.target.value)),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "60", children: "60 FPS" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2077,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "30", children: "30 FPS" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2078,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "24", children: "24 FPS" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2079,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "15", children: "15 FPS" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2080,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 2073,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2071,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Max Duration (seconds)" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2085,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "select",
              {
                value: settings.videoMaxDuration,
                onChange: (e) => onSettingChange("videoMaxDuration", Number(e.target.value)),
                children: [
                  /* @__PURE__ */ jsxDEV("option", { value: "15", children: "15 seconds" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2090,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "30", children: "30 seconds" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2091,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "60", children: "1 minute" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2092,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("option", { value: "120", children: "2 minutes" }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2093,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 2086,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2084,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2045,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "screen-share-settings", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: "Screen Sharing" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2099,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "setting-row", children: [
            /* @__PURE__ */ jsxDEV("label", { children: "Show Shared Screens" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2101,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "checkbox",
                checked: settings.showScreens,
                onChange: (e) => onSettingChange("showScreens", e.target.checked)
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 2102,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2100,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2098,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "theme-button",
            onClick: () => setShowCustomize(false),
            style: { marginTop: "1rem", width: "100%" },
            children: "Close Settings"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2110,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 1834,
        columnNumber: 11
      }, this),
      videoPreviewStream && /* @__PURE__ */ jsxDEV("div", { className: "video-preview", children: [
        /* @__PURE__ */ jsxDEV(
          "video",
          {
            autoPlay: true,
            muted: true,
            playsInline: true,
            ref: (video) => {
              if (video) {
                video.srcObject = videoPreviewStream;
              }
            }
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2123,
            columnNumber: 13
          },
          this
        ),
        isUploading && /* @__PURE__ */ jsxDEV("div", { className: "video-upload-overlay", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "upload-progress-ring", children: [
            /* @__PURE__ */ jsxDEV("svg", { children: /* @__PURE__ */ jsxDEV(
              "circle",
              {
                cx: "40",
                cy: "40",
                r: "35",
                style: {
                  strokeDasharray: `${2 * Math.PI * 35}`,
                  strokeDashoffset: `${2 * Math.PI * 35 * (1 - uploadProgress / 100)}`
                }
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 2137,
                columnNumber: 21
              },
              this
            ) }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 2136,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "progress-text", children: [
              uploadProgress,
              "%"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 2147,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 2135,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: "Uploading video..." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2149,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2134,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2122,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 1564,
      columnNumber: 7
    }, this),
    showPollCreator && /* @__PURE__ */ jsxDEV("div", { className: "modal", children: /* @__PURE__ */ jsxDEV("div", { className: "modal-content", children: [
      /* @__PURE__ */ jsxDEV("h3", { children: "Create Poll" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 2158,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          placeholder: "Poll Title",
          value: pollTitle,
          onChange: (e) => setPollTitle(e.target.value)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 2159,
          columnNumber: 13
        },
        this
      ),
      pollOptions.map((option, index) => /* @__PURE__ */ jsxDEV("div", { className: "poll-option", children: [
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            type: "text",
            placeholder: `Option ${index + 1}`,
            value: option,
            onChange: (e) => {
              const newOptions = [...pollOptions];
              newOptions[index] = e.target.value;
              setPollOptions(newOptions);
            }
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2167,
            columnNumber: 17
          },
          this
        ),
        index > 0 && /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => {
              const newOptions = pollOptions.filter((_, i) => i !== index);
              setPollOptions(newOptions);
            },
            children: "\xD7"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2178,
            columnNumber: 19
          },
          this
        )
      ] }, index, true, {
        fileName: "<stdin>",
        lineNumber: 2166,
        columnNumber: 15
      }, this)),
      pollOptions.length < 5 && /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => setPollOptions([...pollOptions, ""]),
          children: "Add Option"
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 2190,
          columnNumber: 15
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsxDEV("button", { onClick: handlePollSubmit, children: "Create Poll" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2197,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setShowPollCreator(false), children: "Cancel" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2198,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2196,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 2157,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 2156,
      columnNumber: 9
    }, this),
    showEffectCreator && /* @__PURE__ */ jsxDEV("div", { className: "modal", children: /* @__PURE__ */ jsxDEV("div", { className: "modal-content", children: [
      /* @__PURE__ */ jsxDEV("h3", { children: "Send Effect" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 2206,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "effect-options", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "confetti" ? "active" : "",
            onClick: () => setSelectedEffect("confetti"),
            children: "\u{1F38A} Confetti"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2208,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "hearts" ? "active" : "",
            onClick: () => setSelectedEffect("hearts"),
            children: "\u{1F496} Hearts"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2214,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "fireworks" ? "active" : "",
            onClick: () => setSelectedEffect("fireworks"),
            children: "\u{1F386} Fireworks"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2220,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "sparkles" ? "active" : "",
            onClick: () => setSelectedEffect("sparkles"),
            children: "\u2728 Sparkles"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2226,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "bubbles" ? "active" : "",
            onClick: () => setSelectedEffect("bubbles"),
            children: "\u{1FAE7} Bubbles"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2232,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: selectedEffect === "leaves" ? "active" : "",
            onClick: () => setSelectedEffect("leaves"),
            children: "\u{1F343} Leaves"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2238,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2207,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsxDEV("button", { onClick: () => {
          sendEffect(selectedEffect);
          setShowEffectCreator(false);
        }, children: "Send Effect" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2246,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setShowEffectCreator(false), children: "Cancel" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2252,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2245,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 2205,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 2204,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 1563,
    columnNumber: 5
  }, this);
}
function Message({ message, isOwn, onDelete, onStartEdit, onSaveEdit, onCancelEdit, isEditing, formatMessageText, onSpeak, ttsEnabled, onVote, playEffect, room, username }) {
  const [editText, setEditText] = useState(message.text || "");
  const displayName = message.nickname || message.username;
  const storedNickname = localStorage.getItem(`chatNickname_${message.username}`);
  const finalDisplayName = storedNickname || displayName;
  const createdAt = message.created_at ? new Date(message.created_at) : null;
  const formattedTimestamp = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }) : null;
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSaveEdit(message.id, editText);
    } else if (e.key === "Escape") {
      onCancelEdit();
    }
  };
  useEffect(() => {
    setEditText(message.text || "");
  }, [message.text]);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener("loadeddata", () => {
        setVideoLoaded(true);
      });
    }
  }, [message.video]);
  return /* @__PURE__ */ jsxDEV("div", { className: `message ${isOwn ? "own" : ""} ${message.isAI ? "ai-message" : ""}`, children: [
    /* @__PURE__ */ jsxDEV(
      "img",
      {
        className: "message-avatar",
        src: message.isAI ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzAwN2JmZiIgZD0iTTEyIDJhMTAgMTAgMCAwIDEgMTAgMTBjMCA1LjUyMy00LjQ3NyAxMC0xMCAxMFMyIDIxLjUyMyAyIDE2YzAtMS43OTQuNDctMy40NzggMS4zMDItNC45NTZhMTAuMDIxIDEwLjAyMSAwIDAgMSAyLjUyLTIuODU4QTkuOTU0IDkuOTU0IDAgMCAxIDEyIDJ6bTAgMmE4IDggMCAwIDAtOCA4YzAgNC40MTggMy41ODIgOCA4IDhzOC0zLjU4MiA4LTgtMy41ODItOC04LTh6bTEgM3Y2aC00di0yaDJ2LTRoMnptMCA4YTEgMSAwIDEgMSAwIDIgMSAxIDAgMCAxIDAtMnoiLz48L3N2Zz4=" : `https://images.websim.ai/avatar/${message.username}`,
        alt: finalDisplayName
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 2301,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "message-content", children: [
      isOwn && /* @__PURE__ */ jsxDEV("div", { className: "message-actions", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "edit-message",
            onClick: () => onStartEdit(message.id),
            title: "Edit message",
            children: "\u270E"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2309,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "delete-message",
            onClick: () => onDelete(message.id),
            title: "Delete message",
            children: "\xD7"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2316,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2308,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "message-meta", children: [
        /* @__PURE__ */ jsxDEV("strong", { children: finalDisplayName }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2326,
          columnNumber: 11
        }, this),
        formattedTimestamp && /* @__PURE__ */ jsxDEV(
          "time",
          {
            className: "message-time",
            dateTime: createdAt.toISOString(),
            title: createdAt.toLocaleString(),
            children: formattedTimestamp
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2328,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2325,
        columnNumber: 9
      }, this),
      isEditing ? /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            type: "text",
            className: "edit-input",
            value: editText,
            onChange: (e) => setEditText(e.target.value),
            onKeyDown: handleKeyDown,
            autoFocus: true,
            placeholder: "Edit message..."
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2339,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.8em", marginTop: "0.2rem" }, children: "Press Enter to save, Esc to cancel" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2348,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2338,
        columnNumber: 11
      }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        message.text && /* @__PURE__ */ jsxDEV("div", { children: formatMessageText(message.text) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2354,
          columnNumber: 30
        }, this),
        message.isPoll && message.pollData && /* @__PURE__ */ jsxDEV("div", { className: "poll", children: [
          /* @__PURE__ */ jsxDEV("h4", { children: message.pollData.title }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2359,
            columnNumber: 17
          }, this),
          message.pollData.options.map((option, index) => {
            const votes = message.pollData.votes?.[index] || [];
            const totalVotes = Object.values(message.pollData.votes || {}).reduce((sum, voters) => sum + (voters?.length || 0), 0);
            const percentage = totalVotes === 0 ? 0 : votes.length / totalVotes * 100;
            const hasVoted = votes.includes(room.party.client.username);
            return /* @__PURE__ */ jsxDEV("div", { className: "poll-option", children: /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => onVote(message.id, message.pollData, index),
                className: hasVoted ? "voted" : "",
                children: [
                  option,
                  /* @__PURE__ */ jsxDEV("div", { className: "vote-bar", style: { width: `${percentage}%` } }, void 0, false, {
                    fileName: "<stdin>",
                    lineNumber: 2375,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "vote-count", children: [
                    votes.length,
                    " vote",
                    votes.length !== 1 ? "s" : ""
                  ] }, void 0, true, {
                    fileName: "<stdin>",
                    lineNumber: 2376,
                    columnNumber: 25
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 2370,
                columnNumber: 23
              },
              this
            ) }, index, false, {
              fileName: "<stdin>",
              lineNumber: 2369,
              columnNumber: 21
            }, this);
          })
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2358,
          columnNumber: 15
        }, this),
        message.isEffect && /* @__PURE__ */ jsxDEV("div", { className: "effect-message", children: /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => playEffect(message.effectType, message.username),
            className: "replay-effect-button",
            children: "\u{1F504} Replay Effect"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2387,
            columnNumber: 17
          },
          this
        ) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2386,
          columnNumber: 15
        }, this),
        message.images && message.images.map((url, index) => /* @__PURE__ */ jsxDEV("img", { src: url, alt: "Shared image", className: "shared-image" }, index, false, {
          fileName: "<stdin>",
          lineNumber: 2398,
          columnNumber: 15
        }, this)),
        message.file && (message.fileType.startsWith("image/") ? /* @__PURE__ */ jsxDEV("img", { src: message.file, alt: message.fileName }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2402,
          columnNumber: 17
        }, this) : /* @__PURE__ */ jsxDEV("a", { href: message.file, target: "_blank", download: message.fileName, children: [
          "\u{1F4CE} ",
          message.fileName
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2404,
          columnNumber: 17
        }, this)),
        message.audio && /* @__PURE__ */ jsxDEV("audio", { controls: true, src: message.audio }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 2410,
          columnNumber: 15
        }, this),
        message.video && /* @__PURE__ */ jsxDEV("div", { className: "video-container", children: [
          /* @__PURE__ */ jsxDEV(
            "video",
            {
              ref: videoRef,
              controls: true,
              src: message.video,
              className: videoLoaded ? "loaded" : "",
              style: {
                maxWidth: "100%",
                borderRadius: "8px",
                marginTop: "0.5rem",
                opacity: videoLoaded ? 1 : 0,
                transition: "opacity 0.3s ease"
              }
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 2414,
              columnNumber: 17
            },
            this
          ),
          !videoLoaded && /* @__PURE__ */ jsxDEV("div", { className: "video-loading", children: "Loading video..." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 2428,
            columnNumber: 19
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 2413,
          columnNumber: 15
        }, this),
        message.text && ttsEnabled && /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "tts-button",
            onClick: () => onSpeak(message.text),
            title: "Text to Speech",
            children: "\u{1F50A}"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 2435,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 2353,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 2306,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 2300,
    columnNumber: 5
  }, this);
}
createRoot(document.getElementById("app")).render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 2450,
  columnNumber: 51
}));
