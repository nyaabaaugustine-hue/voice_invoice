// ============================================================
//  VoiceBill — Tax Modal Module v3.0
//  Matches the screenshots: list existing → add new
// ============================================================

const TaxModal = (() => {

  let _caller = 'settings'; // 'settings' | 'invoice'

  function open(from) {
    _caller = from || 'settings';
    document.getElementById('taxModalOverlay').classList.add('show');
    document.getElementById('modal_tax_name').value = '';
    document.getElementById('modal_tax_rate').value = '';
    document.getElementById('modal_compound').checked = false;
    renderList();
  }

  function close() {
    document.getElementById('taxModalOverlay').classList.remove('show');
    // Refresh wherever we came from
    if (_caller === 'settings') {
      Settings.renderForm();
    } else if (_caller === 'invoice') {
      const inv = Invoice.getCurrent();
      if (inv) {
        // Re-sync taxes from settings, keeping enabled state where possible
        const settingsTaxes = Settings.get('taxes') || [];
        const existingEnabled = {};
        (inv.taxes || []).forEach(t => { existingEnabled[t.name] = t.enabled; });
        inv.taxes = settingsTaxes.map(t => ({ ...t, enabled: existingEnabled[t.name] || false }));
        InvoicePage.renderTaxes();
        InvoicePage.recalc();
      }
    }
  }

  function closeIfBg(e) {
    if (e.target === document.getElementById('taxModalOverlay')) close();
  }

  function renderList() {
    const taxes = Settings.get('taxes') || [];
    const list  = document.getElementById('modalTaxList');
    if (!taxes.length) {
      list.innerHTML = '<div class="modal-empty">No taxes added yet</div>';
      return;
    }
    list.innerHTML = taxes.map((t, i) => `
      <div class="modal-tax-item">
        <div class="modal-tax-info">
          <div class="modal-tax-name">${t.name}${t.compound ? ' (Compound)' : ''}</div>
          <div class="modal-tax-rate">${t.rate}% · ${t.compound ? 'Compound tax' : 'Standard tax'}</div>
        </div>
        <button class="modal-tax-del" onclick="TaxModal.remove(${i})" title="Remove tax">✕</button>
      </div>`).join('');
  }

  function add() {
    const name     = document.getElementById('modal_tax_name').value.trim();
    const rate     = parseFloat(document.getElementById('modal_tax_rate').value);
    const compound = document.getElementById('modal_compound').checked;

    if (!name)     { App.toast('Enter a tax name', 'error'); return; }
    if (isNaN(rate) || rate < 0 || rate > 100) {
      App.toast('Enter a valid rate (0–100)', 'error'); return;
    }

    const taxes = Settings.get('taxes') || [];
    if (taxes.find(t => t.name.toLowerCase() === name.toLowerCase())) {
      App.toast('A tax with that name already exists', 'error'); return;
    }

    taxes.push({ name, rate, compound });
    Settings.save({ taxes });

    document.getElementById('modal_tax_name').value = '';
    document.getElementById('modal_tax_rate').value = '';
    document.getElementById('modal_compound').checked = false;

    renderList();
    App.toast(`${name} (${rate}%) added`, 'success');
  }

  function remove(i) {
    const taxes = Settings.get('taxes') || [];
    const name  = taxes[i]?.name;
    taxes.splice(i, 1);
    Settings.save({ taxes });
    renderList();
    App.toast(`${name} removed`, 'success');
  }

  return { open, close, closeIfBg, renderList, add, remove };
})();
