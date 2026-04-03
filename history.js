// ============================================================
//  VoiceBill — History Module
// ============================================================

const History = (() => {

  const KEY = 'vb_history';
  let _list = [];

  async function load() {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/history`);
      _list = await res.json();
    } catch(e) { 
      console.error("History load failed", e);
      _list = []; 
    }
  }

  async function add(inv) {
    // store snapshot with totals
    const totals = Invoice.calcTotals(inv);
    const entry  = { ...inv, _grand: totals.grand, _savedAt: new Date().toISOString() };
    
    try {
      await fetch(`${CONFIG.API_BASE_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inv, grand: totals.grand })
      });
    } catch(e) { console.error("History add failed", e); }

    _list.unshift(entry);
    if (_list.length > CONFIG.MAX_HISTORY) _list = _list.slice(0, CONFIG.MAX_HISTORY);
  }

  function getAll() { return _list; }

  async function clear() {
    try {
      await fetch(`${CONFIG.API_BASE_URL}/history`, { method: 'DELETE' });
    } catch(e) {}
    _list = [];
  }

  function render() {
    const wrap = document.getElementById('historyList');
    if (!_list.length) {
      wrap.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">🧾</div>
          <h3 style="color:var(--muted);font-size:1rem;margin-bottom:8px">No invoices yet</h3>
          <p>Your saved invoices will show up here</p>
        </div>`;
      return;
    }

    wrap.innerHTML = _list.map((inv, i) => {
      const itemSummary = (inv.items||[]).slice(0,3)
        .map(it => `${it.qty}× ${it.name}`).join(', ')
        + ((inv.items||[]).length > 3 ? ' …' : '');
      const amt = (inv._grand || 0).toFixed(2);
      const d   = inv.date || '';
      return `
        <div class="hist-card" onclick="History.openInvoice(${i})">
          <div class="hist-top">
            <div class="hist-customer">${inv.customer}</div>
            <div class="hist-amount">GHS ${amt}</div>
          </div>
          <div class="hist-bottom">
            <div class="hist-items mono">${itemSummary}</div>
            <div class="hist-date">${d}</div>
          </div>
        </div>`;
    }).join('');
  }

  function openInvoice(i) {
    const inv = _list[i];
    if (!inv) return;
    Invoice.setCurrent({ ...inv });
    InvoicePage.render();
    App.showPage('invoice');
  }

  return { load, add, getAll, clear, render, openInvoice };
})();
