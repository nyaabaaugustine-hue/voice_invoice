// ============================================================
//  VoiceBill — Main App Controller v3.0
// ============================================================

const App = (() => {

  let _toastTimer = null;

  // ── PAGE ROUTING ──────────────────────────────────────────
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page_' + name).classList.add('active');
    const nb = document.getElementById('nav_' + name);
    if (nb) nb.classList.add('active');
    if (name === 'history')  History.render();
    if (name === 'settings') Settings.renderForm();
  }

  function updateHeaderBiz() {
    const biz = Settings.get('biz') || 'My Business';
    document.getElementById('headerBizName').textContent = biz;
  }

  function showLoading(msg) {
    document.getElementById('loadingText').textContent = msg || 'Processing...';
    document.getElementById('loadingOverlay').classList.add('show');
  }
  function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
  }

  function toast(msg, type) {
    const el = document.getElementById('toastEl');
    el.textContent = msg;
    el.className   = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ── VOICE ─────────────────────────────────────────────────
  let _recognition   = null;
  let _listening     = false;
  let _lastTranscript = '';
  let _inputHandled   = false;

  function toggleMic() {
    if (_listening) { stopMic(); return; }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      toast('Mic not supported — use text input below', 'error');
      Voice.showTypeInput();
      return;
    }

    _lastTranscript = '';
    _inputHandled   = false;

    _recognition = new SpeechRec();
    _recognition.lang            = 'en-US';
    _recognition.continuous      = false;
    _recognition.interimResults  = true;
    _recognition.maxAlternatives = 1;

    _recognition.onstart = () => { _listening = true; setMicUI(true); };

    _recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      _lastTranscript  = transcript;
      Voice.setTranscript(transcript);
      if (e.results[e.results.length - 1].isFinal && !_inputHandled) {
        _inputHandled = true;
        stopMic();
        handleInput(transcript);
      }
    };

    _recognition.onerror = (e) => {
      stopMic();
      if (e.error === 'not-allowed') {
        toast('Microphone access denied. Use text input.', 'error');
      } else if (e.error !== 'no-speech') {
        toast('Mic error — try typing below', 'error');
      }
      Voice.showTypeInput();
    };

    _recognition.onend = () => {
      if (!_inputHandled && _lastTranscript.trim()) {
        _inputHandled = true;
        handleInput(_lastTranscript);
      } else if (!_inputHandled && !_lastTranscript.trim()) {
        toast('No speech detected — try again or type below', 'error');
        Voice.showTypeInput();
      }
      stopMic();
    };

    _recognition.start();
  }

  function stopMic() {
    _listening = false;
    if (_recognition) { try { _recognition.stop(); } catch(e){} }
    setMicUI(false);
  }

  function setMicUI(on) {
    const btn  = document.getElementById('micBtn');
    const ring = document.getElementById('micRing');
    const stat = document.getElementById('micStatus');
    const lbl  = document.getElementById('micLabel');
    if (on) {
      btn.classList.add('listening'); ring.classList.add('listening');
      stat.textContent = '● Listening — speak now'; stat.classList.add('on');
      lbl.textContent  = 'Stop';
    } else {
      btn.classList.remove('listening'); ring.classList.remove('listening');
      stat.textContent = 'Ready'; stat.classList.remove('on');
      lbl.textContent  = 'Tap to speak';
    }
  }

  async function handleInput(text) {
    if (!text.trim()) return;
    const inv = await Invoice.parseText(text);
    if (inv) { InvoicePage.render(); showPage('invoice'); }
  }

  // ── INIT ──────────────────────────────────────────────────
  async function init() {
    await Settings.load();
    await History.load();
    updateHeaderBiz();
    PinAuth.init();
    showPage('voice');
    // Show quick-resend pill if there's recent history
    _maybeShowQuickResend();
  }

  function _maybeShowQuickResend() {
    const list = History.getAll();
    if (!list.length) return;
    const last = list[0];
    const wrap = document.getElementById('quickResendWrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <button class="quick-resend-pill" onclick="App.quickResend()">
        <span class="quick-resend-icon">↩</span>
        Resend last: <strong>${last.customer}</strong> &mdash; GHS ${(last._grand||0).toFixed(2)}
      </button>`;
  }

  function quickResend() {
    const list = History.getAll();
    if (!list.length) return;
    Invoice.setCurrent({ ...list[0] });
    InvoicePage.render();
    showPage('invoice');
  }

  return { showPage, updateHeaderBiz, showLoading, hideLoading, toast, toggleMic, handleInput, quickResend };
})();

// ── VOICE PAGE HELPERS ────────────────────────────────────
const Voice = (() => {
  function showTypeInput() {
    document.getElementById('typeRow').classList.add('show');
    document.getElementById('typeInp').focus();
  }
  function toggleType() { document.getElementById('typeRow').classList.toggle('show'); }
  function setTranscript(text) {
    const box = document.getElementById('transcriptBox');
    box.textContent = text; box.classList.add('show');
  }
  function submitType() {
    const val = document.getElementById('typeInp').value.trim();
    if (!val) return;
    setTranscript(val); App.handleInput(val);
  }
  function useExample(el) {
    const text = el.textContent.trim();
    setTranscript(text); App.handleInput(text);
  }
  return { showTypeInput, toggleType, setTranscript, submitType, useExample };
})();

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
