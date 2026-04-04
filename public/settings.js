// ============================================================
//  VoiceBill — Settings Module  v4.1
//  FIX: localStorage fallback so settings always persist
//  even when the DB/API is unreachable (Vercel cold-start, etc.)
// ============================================================

const Settings = (() => {

  const LS_KEY = 'vb_settings';

  const DEFAULTS = {
    biz:   CONFIG.BUSINESS_NAME_DEFAULT,
    momo:  '',
    logo:  '',
    wa:    '',
    taxes: []
  };

  let _data = { ...DEFAULTS };

  // ── persist to localStorage immediately ──────────────────
  function _toLocal(d) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch(e) {}
  }

  function _fromLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }

  // ── load: localStorage first (instant), then DB (fresh) ──
  async function load() {
    // 1. Load from localStorage immediately so UI has data right away
    const local = _fromLocal();
    if (local && local.biz) {
      _data = { ...DEFAULTS, ...local };
    }

    // 2. Try to refresh from DB
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.biz) {
        _data = {
          biz:   data.biz   || DEFAULTS.biz,
          momo:  data.momo  || '',
          logo:  data.logo  || '',
          wa:    data.wa    || '',
          taxes: data.taxes || []
        };
        // Keep local in sync with DB
        _toLocal(_data);
      }
    } catch(e) {
      console.warn('Settings DB load failed — using local cache', e.message);
    }
  }

  // ── save: localStorage immediately + DB async ────────────
  async function save(obj) {
    _data = { ..._data, ...obj };
    // Save to localStorage right away (works offline & on Vercel)
    _toLocal(_data);
    // Also push to DB
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/settings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(_data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch(e) {
      console.warn('Settings DB save failed — saved locally only', e.message);
    }
  }

  function get(key) { return _data[key]; }

  function renderForm() {
    document.getElementById('s_biz').value  = _data.biz  || '';
    document.getElementById('s_momo').value = _data.momo || '';
    document.getElementById('s_logo').value = _data.logo || '';
    document.getElementById('s_wa').value   = _data.wa   || '';
    renderTaxList();
  }

  function renderTaxList() {
    const list = document.getElementById('s_tax_list');
    if (!list) return;
    list.innerHTML = (_data.taxes || []).map((t, i) => `
      <div class="tax-config-item">
        <span>${t.name} (${t.rate}%)</span>
        <button onclick="Settings.removeTax(${i})">✕</button>
      </div>
    `).join('');
  }

  function addTax() {
    const name = document.getElementById('s_tax_name')?.value.trim();
    const rate = parseFloat(document.getElementById('s_tax_rate')?.value);
    if (!name || isNaN(rate)) return;
    _data.taxes.push({ name, rate });
    document.getElementById('s_tax_name').value = '';
    document.getElementById('s_tax_rate').value = '';
    renderTaxList();
  }

  function removeTax(i) {
    _data.taxes.splice(i, 1);
    renderTaxList();
  }

  async function submitForm() {
    await save({
      biz:   document.getElementById('s_biz').value.trim()  || DEFAULTS.biz,
      momo:  document.getElementById('s_momo').value.trim(),
      logo:  document.getElementById('s_logo').value.trim(),
      wa:    document.getElementById('s_wa').value.trim().replace(/\D/g, ''),
      taxes: _data.taxes
    });
    App.updateHeaderBiz();
    App.toast('Settings saved ✓', 'success');
  }

  return { load, save, get, renderForm, addTax, removeTax, submitForm };
})();
