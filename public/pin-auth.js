// ============================================================
//  VoiceBill — PIN Authentication + Onboarding Module
//  v5.0 — fixed duplicate-ID onboarding, admin PIN override
// ============================================================

const PinAuth = (() => {

  const PIN_KEY      = 'vb_pin';
  const SESSION_KEY  = 'vb_pin_session';
  const ONBOARD_KEY  = 'vb_onboarded';
  const LOCKOUT_KEY  = 'vb_lockout';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 60_000; // 1 minute

  // ── ADMIN OVERRIDE PIN (hardcoded — overrides any user PIN) ──
  const ADMIN_PIN = '9999';

  let _buf         = '';
  let _mode        = 'login';   // login | setup | confirm | change
  let _tempPin     = '';
  let _onboardStep = 0;
  let _attempts    = 0;
  let _lockTimer   = null;

  // ── HAPTICS ──────────────────────────────────────────────
  function _haptic(type = 'light') {
    if (!navigator.vibrate) return;
    if (type === 'light')   navigator.vibrate(8);
    if (type === 'medium')  navigator.vibrate(25);
    if (type === 'error')   navigator.vibrate([30, 50, 30]);
    if (type === 'success') navigator.vibrate([10, 30, 60]);
  }

  // ── DOT / ERROR ELEMENT HELPERS ──────────────────────────
  // Step 3 = create PIN  → ob_pd0–3 / ob_pinErr
  // Step 4 = confirm PIN → ob_cd0–3 / ob_confirmErr  (unique IDs — fixes the duplicate-ID bug)
  // Login  = main screen → pd0–3   / pinErr
  function _dotPfx() {
    if (_onboardStep === 3) return 'ob_pd';
    if (_onboardStep === 4) return 'ob_cd';
    return 'pd';
  }
  function _errId() {
    if (_onboardStep === 3) return 'ob_pinErr';
    if (_onboardStep === 4) return 'ob_confirmErr';
    return 'pinErr';
  }

  function updateDots() {
    const pfx = _dotPfx();
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById(pfx + i);
      if (d) d.className = 'pin-dot' + (i < _buf.length ? ' filled' : '');
    }
  }

  function showErr(msg) {
    _haptic('error');
    const pfx = _dotPfx();
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById(pfx + i);
      if (d) d.className = 'pin-dot error';
    }
    const el = document.getElementById(_errId());
    if (el) el.textContent = msg;
    setTimeout(() => { _buf = ''; updateDots(); clearErr(); }, 750);
  }

  function clearErr() {
    const el = document.getElementById(_errId());
    if (el) el.textContent = '';
  }

  function _setSubtext(sub, note) {
    const s = document.getElementById('pinSub');  if (s) s.textContent = sub;
    const n = document.getElementById('pinNote'); if (n) n.textContent = note;
  }

  // ── LOCKOUT ───────────────────────────────────────────────
  function _checkLockout() {
    const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || 'null');
    if (!data) return false;
    const remaining = data.until - Date.now();
    if (remaining <= 0) {
      localStorage.removeItem(LOCKOUT_KEY);
      _attempts = 0;
      return false;
    }
    _startLockdownUI(remaining);
    return true;
  }

  function _triggerLockout() {
    const until = Date.now() + LOCKOUT_MS;
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ until }));
    _startLockdownUI(LOCKOUT_MS);
  }

  function _startLockdownUI(remainingMs) {
    const pinErrEl = document.getElementById('pinErr');
    const numpad   = document.querySelector('.pin-screen .numpad');
    if (numpad) { numpad.style.opacity = '0.3'; numpad.style.pointerEvents = 'none'; }
    clearTimeout(_lockTimer);
    let secondsLeft = Math.ceil(remainingMs / 1000);
    const tick = () => {
      if (pinErrEl) pinErrEl.textContent = `Too many attempts. Wait ${secondsLeft}s`;
      if (secondsLeft <= 0) {
        localStorage.removeItem(LOCKOUT_KEY);
        _attempts = 0;
        if (pinErrEl) pinErrEl.textContent = '';
        if (numpad) { numpad.style.opacity = '1'; numpad.style.pointerEvents = 'auto'; }
        return;
      }
      secondsLeft--;
      _lockTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  // ── ONBOARDING ────────────────────────────────────────────
  function _showOnboarding() {
    document.getElementById('pinScreen').style.display     = 'none';
    document.getElementById('mainApp').style.display       = 'none';
    document.getElementById('onboardScreen').style.display = 'flex';
    _goToStep(0);
  }

  function _goToStep(step) {
    _onboardStep = step;
    document.querySelectorAll('.ob-step').forEach((el, i) => {
      el.classList.toggle('ob-active', i === step);
    });
    const pct = step === 0 ? 0 : Math.round((step / 4) * 100);
    document.getElementById('obProgress').style.width       = pct + '%';
    document.getElementById('obProgressWrap').style.opacity = step === 0 ? '0' : '1';
    // Reset buffer + dots when entering a PIN entry step
    if (step === 3 || step === 4) { _buf = ''; updateDots(); clearErr(); }
    setTimeout(() => {
      if (step === 1) document.getElementById('ob_biz')?.focus();
      if (step === 2) document.getElementById('ob_momo')?.focus();
    }, 380);
  }

  function obNext() {
    _haptic('light');
    if (_onboardStep === 0) { _goToStep(1); return; }

    if (_onboardStep === 1) {
      const biz = document.getElementById('ob_biz').value.trim();
      if (!biz) { _obShake('ob_biz'); return; }
      _goToStep(2);
      return;
    }

    if (_onboardStep === 2) {
      const biz  = document.getElementById('ob_biz').value.trim() || 'My Business';
      const momo = document.getElementById('ob_momo').value.trim();
      // Mirror into settings form fields so submitForm() works later
      const s_biz  = document.getElementById('s_biz');  if (s_biz)  s_biz.value  = biz;
      const s_momo = document.getElementById('s_momo'); if (s_momo) s_momo.value = momo;
      Settings.save({ biz, momo });
      _mode = 'setup';
      _goToStep(3);
      return;
    }
  }

  function obSkipMomo() {
    _haptic('light');
    const biz   = document.getElementById('ob_biz').value.trim() || 'My Business';
    const s_biz = document.getElementById('s_biz'); if (s_biz) s_biz.value = biz;
    Settings.save({ biz, momo: '' });
    _mode = 'setup';
    _goToStep(3);
  }

  function _obShake(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.classList.add('ob-shake');
    el.focus();
    setTimeout(() => el.classList.remove('ob-shake'), 400);
    _haptic('error');
  }

  function _finishOnboarding() {
    _haptic('success');
    localStorage.setItem(ONBOARD_KEY, '1');
    _onboardStep = 0;
    document.getElementById('onboardScreen').style.display = 'none';
    App.updateHeaderBiz();
    unlock();
    App.toast('Welcome to VoiceBill! 🎉', 'success');
  }

  // ── MAIN PIN LOGIC ────────────────────────────────────────
  function init() {
    const stored    = localStorage.getItem(PIN_KEY);
    const onboarded = localStorage.getItem(ONBOARD_KEY);
    if (!onboarded || !stored) { _showOnboarding(); return; }
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session === 'ok') { unlock(); return; }
    _mode = 'login';
    _setSubtext('Enter your PIN to continue', 'Your invoices are protected');
    document.getElementById('pinScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display   = 'none';
    updateDots();
    _checkLockout();
  }

  function digit(d) {
    if (_buf.length >= 4) return;
    // Block input during lockout on login screen only
    if (_mode === 'login' && localStorage.getItem(LOCKOUT_KEY)) {
      const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY));
      if (data && data.until > Date.now()) return;
    }
    _haptic('light');
    _buf += d;
    updateDots();
    if (_buf.length === 4) setTimeout(handleComplete, 120);
  }

  function del() {
    _haptic('light');
    _buf = _buf.slice(0, -1);
    updateDots();
    clearErr();
  }

  function handleComplete() {
    if (_mode === 'login') {
      const stored = localStorage.getItem(PIN_KEY);

      // ── ADMIN OVERRIDE: always grants access, clears lockout ──
      if (_buf === ADMIN_PIN) {
        _haptic('success');
        _attempts = 0;
        localStorage.removeItem(LOCKOUT_KEY);
        sessionStorage.setItem(SESSION_KEY, 'ok');
        unlock();
        App.toast('Admin access granted 🔐', 'success');
        return;
      }

      if (_buf === stored) {
        _haptic('success');
        _attempts = 0;
        sessionStorage.setItem(SESSION_KEY, 'ok');
        unlock();
      } else {
        _attempts++;
        if (_attempts >= MAX_ATTEMPTS) {
          _triggerLockout();
          _buf = ''; updateDots();
        } else {
          showErr(`Incorrect PIN. ${MAX_ATTEMPTS - _attempts} attempt${MAX_ATTEMPTS - _attempts === 1 ? '' : 's'} left.`);
        }
      }

    } else if (_mode === 'setup') {
      _tempPin = _buf;
      _buf     = '';
      _mode    = 'confirm';
      if (_onboardStep === 3) {
        _goToStep(4); // _goToStep auto-resets dots + error for step 4
      } else {
        _setSubtext('Confirm your PIN', 'Re-enter to confirm');
        updateDots(); clearErr();
      }

    } else if (_mode === 'confirm') {
      if (_buf === _tempPin) {
        _haptic('success');
        localStorage.setItem(PIN_KEY, _buf);
        sessionStorage.setItem(SESSION_KEY, 'ok');
        _tempPin = '';
        _mode    = 'login';
        if (_onboardStep === 4) {
          _finishOnboarding();
        } else {
          App.toast('PIN set successfully! 🔐', 'success');
          unlock();
        }
      } else {
        _tempPin = '';
        _mode    = 'setup';
        showErr('PINs did not match. Try again.');
        if (_onboardStep === 4) {
          setTimeout(() => { _goToStep(3); }, 900);
        } else {
          setTimeout(() => { _setSubtext('Create a 4-digit PIN', 'Choose something memorable'); }, 800);
        }
      }

    } else if (_mode === 'change') {
      const stored = localStorage.getItem(PIN_KEY);
      // Admin PIN also bypasses the "enter current PIN" gate during change flow
      if (_buf === ADMIN_PIN || _buf === stored) {
        _haptic('medium');
        _buf  = '';
        _mode = 'setup';
        _setSubtext('Enter new PIN', 'Choose a new 4-digit PIN');
        updateDots(); clearErr();
      } else {
        showErr('Wrong current PIN.');
      }
    }
  }

  function unlock() {
    document.getElementById('pinScreen').style.display     = 'none';
    document.getElementById('onboardScreen').style.display = 'none';
    document.getElementById('mainApp').style.display       = 'block';
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY);
    _buf  = '';
    _mode = 'login';
    _onboardStep = 0;
    _setSubtext('Enter your PIN to continue', 'Your invoices are protected');
    updateDots(); clearErr();
    document.getElementById('pinScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display   = 'none';
    _checkLockout();
  }

  function startChange() {
    _buf  = '';
    _mode = 'change';
    _onboardStep = 0;
    _setSubtext('Enter your current PIN', 'Then you can set a new PIN');
    updateDots(); clearErr();
    document.getElementById('pinScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display   = 'none';
  }

  return { init, digit, del, lock, startChange, obNext, obSkipMomo };
})();
