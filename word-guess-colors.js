/* Word Guess visual color upgrade */
(() => {
  'use strict';

  const STYLE_ID = 'word-guess-colors-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .word-cell.word-exact {
        background: #55b878 !important;
        border-color: #55b878 !important;
        color: #fff !important;
      }
      .word-cell.word-present {
        background: #c6a84f !important;
        border-color: #c6a84f !important;
        color: #fff !important;
      }
      .word-cell.word-missing {
        background: #555b65 !important;
        border-color: #555b65 !important;
        color: #fff !important;
      }
    `;
    document.head.appendChild(style);
  }

  function updateCellColors() {
    document.querySelectorAll('.word-cell').forEach(cell => {
      const border = String(cell.style.borderColor || '').toLowerCase();
      cell.classList.remove('word-exact', 'word-present', 'word-missing');

      if (border.includes('55b878') || border.includes('85, 184, 120')) {
        cell.classList.add('word-exact');
      } else if (border.includes('c6a84f') || border.includes('198, 168, 79')) {
        cell.classList.add('word-present');
      } else if (border.includes('555b65') || border.includes('85, 91, 101')) {
        cell.classList.add('word-missing');
      }
    });
  }

  function boot() {
    injectStyle();
    const observer = new MutationObserver(updateCellColors);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    updateCellColors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
