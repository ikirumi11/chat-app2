/* Compatibility loader — the background system is now LOCAL. */
(() => {
  'use strict';
  const script = document.createElement('script');
  script.src = 'local-background.js';
  script.defer = true;
  document.head.appendChild(script);
})();
