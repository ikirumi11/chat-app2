/* Compatibility loader — the background system is now LOCAL. */
(() => {
  'use strict';

  const script = document.createElement('script');
  script.src = 'local-background.js';
  script.defer = true;
  document.head.appendChild(script);

  function startProfileSetup() {
    if (localStorage.getItem('chat_profile_setup_complete') === 'true') return;

    const overlay = document.getElementById('settingsOverlay');
    const settingsButton = document.getElementById('settingsBtn');
    const closeButton = document.getElementById('closeSettings');
    const saveButton = document.getElementById('saveSettings');
    const nameInput = document.getElementById('usernameInput');
    const pictureInput = document.getElementById('profilePictureInput');
    const picturePreview = document.getElementById('profilePicturePreview');

    if (!overlay || !settingsButton || !closeButton || !saveButton || !nameInput || !pictureInput) return;

    const categories = [...overlay.querySelectorAll('.category')];
    const originalCategoryDisplay = categories.map(el => el.style.display);
    const originalCloseDisplay = closeButton.style.display;
    const originalSaveText = saveButton.textContent;

    let profilePicture = localStorage.getItem('chat_profile_picture') || '';

    function applyPicturePreview(data) {
      if (!picturePreview) return;
      if (data) {
        picturePreview.src = data;
        picturePreview.style.display = 'block';
      } else {
        picturePreview.removeAttribute('src');
        picturePreview.style.display = 'none';
      }
    }

    function finishSetup() {
      const name = String(nameInput.value || '').trim();
      if (!name) {
        alert('Please enter your name.');
        nameInput.focus();
        return;
      }

      if (!profilePicture) {
        alert('Please choose a profile picture.');
        return;
      }

      localStorage.setItem('chat_username', name.substring(0, 24));
      localStorage.setItem('chat_profile_picture', profilePicture);
      localStorage.setItem('chat_profile_setup_complete', 'true');

      try {
        settings.username = name.substring(0, 24);
      } catch (_) {}

      try {
        pendingProfilePicture = profilePicture;
      } catch (_) {}

      // Let the app's normal settings saver store everything using its existing logic.
      saveButton.click();

      setTimeout(() => {
        categories.forEach((el, i) => {
          el.style.display = originalCategoryDisplay[i];
        });
        closeButton.style.display = originalCloseDisplay;
        saveButton.textContent = originalSaveText || 'Save settings';

        // Re-open the full, real Settings panel after profile setup.
        settingsButton.click();
      }, 150);
    }

    pictureInput.addEventListener('change', () => {
      const file = pictureInput.files && pictureInput.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        pictureInput.value = '';
        alert('Please choose an image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        profilePicture = String(reader.result || '');
        applyPicturePreview(profilePicture);
      };
      reader.readAsDataURL(file);
    });

    settingsButton.addEventListener('click', () => {
      if (localStorage.getItem('chat_profile_setup_complete') === 'true') return;
      setTimeout(() => {
        categories.forEach((el, i) => {
          // Keep only Profile visible during first-start setup.
          el.style.display = i === 0 ? originalCategoryDisplay[i] || '' : 'none';
        });
        closeButton.style.display = 'none';
        saveButton.textContent = 'Continue to Settings';

        nameInput.value = localStorage.getItem('chat_username') || '';
        profilePicture = localStorage.getItem('chat_profile_picture') || profilePicture;
        applyPicturePreview(profilePicture);

        if (!saveButton.dataset.profileSetupBound) {
          saveButton.dataset.profileSetupBound = 'true';
          saveButton.addEventListener('click', function profileSetupClick(e) {
            if (localStorage.getItem('chat_profile_setup_complete') === 'true') return;
            e.stopImmediatePropagation();
            e.preventDefault();
            finishSetup();
          }, true);
        }
      }, 0);
    });

    // First launch: automatically open the existing Settings UI for profile setup.
    setTimeout(() => settingsButton.click(), 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startProfileSetup);
  } else {
    startProfileSetup();
  }
})();
