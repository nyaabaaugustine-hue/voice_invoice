// ============================================================
//  VoiceBill — PWA Module  v1.0
//  Handles: install prompt, home screen banner,
//           service worker registration, push notifications
// ============================================================

const PWA = (() => {

  const BANNER_KEY   = 'vb_pwa_dismissed';
  let _deferredPrompt = null;

  // ── Service Worker ────────────────────────────────────────
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[PWA] SW registered', reg.scope);
        // Check for push permission on each load
        _schedulePushCheck(reg);
      })
      .catch(err => console.warn('[PWA] SW registration failed', err));
  }

  // ── Install Banner ────────────────────────────────────────
  function init() {
    registerSW();

    // Capture the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredPrompt = e;
      // Show banner if not already dismissed
      if (!localStorage.getItem(BANNER_KEY)) {
        setTimeout(_showBanner, 3000); // show after 3s so app loads first
      }
    });

    // Hide banner once installed
    window.addEventListener('appinstalled', () => {
      _hideBanner();
      App.toast('VoiceBill added to home screen!', 'success');
    });
  }

  function _showBanner() {
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.style.display = 'flex';
  }

  function _hideBanner() {
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.style.display = 'none';
  }

  function install() {
    if (!_deferredPrompt) {
      // iOS fallback — show instructions
      App.toast('Tap Share → "Add to Home Screen" in your browser', '');
      dismiss();
      return;
    }
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        App.toast('Installing VoiceBill…', 'success');
      }
      _deferredPrompt = null;
      dismiss();
    });
  }

  function dismiss() {
    localStorage.setItem(BANNER_KEY, '1');
    _hideBanner();
  }

  // ── Push Notifications ────────────────────────────────────
  function _schedulePushCheck(reg) {
    if (!('Notification' in window) || !('PushManager' in window)) return;
    // Check for overdue invoices every time app loads
    _checkOverdueAndNotify();
  }

  async function requestPushPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async function _checkOverdueAndNotify() {
    if (Notification.permission !== 'granted') return;

    const history = History.getAll();
    const today   = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = history.filter(inv =>
      inv.status !== 'paid' &&
      inv.due_date &&
      new Date(inv.due_date) < today
    );

    if (!overdue.length) return;

    // Only notify once per day using a date key
    const notifyKey = 'vb_notified_' + today.toISOString().slice(0, 10);
    if (localStorage.getItem(notifyKey)) return;
    localStorage.setItem(notifyKey, '1');

    const total = overdue.reduce((s, i) => s + (i._grand || 0), 0);
    const names = overdue.slice(0, 2).map(i => i.customer).join(', ');

    new Notification('VoiceBill — Overdue Invoices', {
      body: `${overdue.length} unpaid invoice${overdue.length > 1 ? 's' : ''} from ${names}. Total: GHS ${total.toFixed(2)}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag:  'vb-overdue'
    });
  }

  // Called from settings to enable notifications
  async function enableNotifications() {
    const granted = await requestPushPermission();
    if (granted) {
      App.toast('Overdue reminders enabled!', 'success');
    } else {
      App.toast('Notifications blocked — check browser settings', 'error');
    }
  }

  return { init, install, dismiss, enableNotifications };
})();
