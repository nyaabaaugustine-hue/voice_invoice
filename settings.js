// ============================================================
//  VoiceBill — Settings Module
// ============================================================

const Settings = (() => {

  const DEFAULTS = {
    biz:     CONFIG.BUSINESS_NAME_DEFAULT,
    momo:    '',
    logo:    '',
    wa:      ''
  };

  let _data = { ...DEFAULTS };

  async function load() {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/settings`);
      const data = await res.json();
      if (data && data.biz) {
        _data = { 
          biz: data.biz, 
          momo: data.momo, 
          logo: data.logo,
          wa: data.wa
        };
      }
    } catch(e) { console.error("Settings load failed", e); }
  }

  async function save(obj) {
    _data = { ..._data, ...obj };
    try {
      await fetch(`${CONFIG.API_BASE_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_data)
      });
    } catch(e) { console.error("Settings save failed", e); }
  }

  function get(key) { return _data[key]; }

  function renderForm() {
    document.getElementById('s_biz').value    = _data.biz    || '';
    document.getElementById('s_momo').value   = _data.momo   || '';
    document.getElementById('s_logo').value   = _data.logo   || '';
    document.getElementById('s_wa').value     = _data.wa     || '';
  }

  async function submitForm() {
    await save({
      biz:    document.getElementById('s_biz').value.trim()    || DEFAULTS.biz,
      momo:   document.getElementById('s_momo').value.trim(),
      logo:   document.getElementById('s_logo').value.trim(),
      wa:     document.getElementById('s_wa').value.trim().replace(/\D/g,'')
    });
    App.updateHeaderBiz();
    App.toast('Settings saved', 'success');
  }

  return { load, save, get, renderForm, submitForm };
})();
