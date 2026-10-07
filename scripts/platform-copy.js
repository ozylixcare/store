// Browser installation state for the Ozylix PWA. No APK download is offered.
(function () {
  var deferredInstallPrompt = null;
  var prompting = false;
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inAppBrowser = /FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(ua);
  var standaloneQuery = window.matchMedia && window.matchMedia('(display-mode: standalone)');
  var installed = !!(standaloneQuery && standaloneQuery.matches || navigator.standalone === true);

  function get(id) { return document.getElementById(id); }
  function message(text) {
    var status = get('appInstallStatus');
    var help = get('androidInstallHelp');
    if (status) status.textContent = text;
    if (help) help.textContent = text;
  }
  function updatePlatformCopy() {
    var button = get('androidInstallButton');
    var card = get('androidInstallCard');
    if (card && !isAndroid) card.classList.add('app-platform-muted');
    if (button) {
      button.disabled = installed || prompting;
      button.textContent = installed ? 'Ozylix installed' : prompting ? 'Opening installation…' : deferredInstallPrompt ? 'Install Ozylix app' : 'Show install steps';
    }
    if (installed) message('Ozylix is installed. Open it from your home screen.');
    else if (isIOS) message('On iPhone or iPad, open Ozylix in Safari and follow the Home Screen steps below.');
    else if (!isAndroid) message('On Android, open ozylix.com in Chrome to install. You can keep using the website on this device.');
    else if (deferredInstallPrompt) message('Ready to install. Tap Install Ozylix app and confirm in your browser.');
    else if (inAppBrowser) message('Open this page in Chrome first: use this app’s menu and choose Open in browser. Then follow the steps below.');
    else message('In Chrome, tap ⋮ → Add to Home screen → Install. If Chrome offers an install prompt here, this button will change to Install Ozylix app.');
  }
  function showSteps() {
    updatePlatformCopy();
    var guide = get(isIOS ? 'appInstallStatus' : 'androidInstallGuide') || get('appInstallStatus');
    if (guide) {
      guide.setAttribute('tabindex', '-1');
      guide.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      guide.focus({ preventScroll: true });
    }
  }

  // Loaded early, so a prompt is retained even before the install page opens.
  window.addEventListener('beforeinstallprompt', function (event) {
    if (!isAndroid || installed) return;
    event.preventDefault();
    deferredInstallPrompt = event;
    updatePlatformCopy();
  });

  window.installOzylixAndroid = async function () {
    if (installed || prompting) return;
    if (!isAndroid || !deferredInstallPrompt) { showSteps(); return; }
    // An install event can only be used once. Consume it before any await.
    var event = deferredInstallPrompt;
    deferredInstallPrompt = null;
    prompting = true;
    updatePlatformCopy();
    try {
      await event.prompt();
      var result = await event.userChoice;
      prompting = false;
      updatePlatformCopy();
      if (!installed) message(result && result.outcome === 'accepted'
        ? 'Finish installing in Chrome. Ozylix will appear on your home screen.'
        : 'Installation cancelled. You can still install from Chrome’s ⋮ menu using the steps below.');
    } catch (error) {
      prompting = false;
      updatePlatformCopy();
      message('The browser could not open installation. Use Chrome’s ⋮ menu and follow the install steps below.');
    }
  };

  window.copyAppLink = async function () {
    var status = get('appInstallStatus');
    var url = window.location.origin + '/download';
    try {
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = 'Ozylix link copied. Open it in Safari on your iPhone or iPad.';
    } catch (e) { if (status) status.textContent = url; }
  };

  window.addEventListener('appinstalled', function () {
    installed = true;
    prompting = false;
    deferredInstallPrompt = null;
    updatePlatformCopy();
  });
  if (standaloneQuery && standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener('change', function (event) {
      if (event.matches) { installed = true; deferredInstallPrompt = null; updatePlatformCopy(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updatePlatformCopy);
  else updatePlatformCopy();
})();
