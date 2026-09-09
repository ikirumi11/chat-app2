/* Compatibility loader — the background system is now LOCAL. */
(() => {
  'use strict';

  const script = document.createElement('script');
  script.src = 'local-background.js';
  script.defer = true;
  document.head.appendChild(script);

  function openRealSettingsOnStart() {
    const settingsButton = document.getElementById('settingsBtn');
    if (!settingsButton) return;

    // Open the normal, real Settings panel when the app starts.
    // Do not hide categories, replace buttons, or run a separate setup screen.
    setTimeout(() => {
      settingsButton.click();
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openRealSettingsOnStart);
  } else {
    openRealSettingsOnStart();
  }
})();
