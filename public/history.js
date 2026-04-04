// ============================================================
//  VoiceBill — History Module  v4.0
//  + revenue analytics (today / week / month)
//  + customer filter
//  + search
// ============================================================

const History = (() => {

  const KEY = 'vb_history';
  let _list        = [];
  let _filterQuery = '';

  async function load() {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _list = Array.isArray(data) ? data : [];
    } catch(e) {
      console.error('History load failed', e);
      _list = [];
    }
  }

  async function add(inv) {
    const totals = Invoice.calcTotals(inv);
    const entry  = { ...inv, _grand: totals.grand, _savedAt: new Date().toISOString() };

    try {
      await fetch(`${CONFIG.API_BASE_URL}/history`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...inv, grand: totals.grand })
      });
    } catch(e) { console.error('History add failed', e); }

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

  // ── ANALYTICS ─────────────────────────────────────────────
  function _parseDateStr(d) {
    // inv.date is like "3 Apr 2025" from en-GH locale
    return new Date(d);
  }

  function _getRevenue(dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    const key = d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '');
    return _list
      .filter(inv => (inv.date || '').replace(/,/g, '') === key)
      .reduce((s, inv) => s + (inv._grand || 0), 0);
  }

  function getDailyTotal() { return _getRevenue(0); }

  function getWeekTotal() {
    const now  = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    return _list
      .filter(inv => {
        const d = new Date(inv._savedAt || inv.date);
        return (now - d.getTime()) < week;
      })
      .reduce((s, inv) => s + (inv._grand || 0), 0);
  }

  function getMonthTotal() {
    const now = new Date();
    return _list
      .filter(inv => {
        const d = new Date(inv._savedAt || inv.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, inv) => s + (inv._grand || 0), 0);
  }

  function getTopCustomers(n = 3) {
    const map = {};
    _list.forEach(inv => {
      if (!inv.customer || inv.customer === 'Customer') return;
      map[inv.customer] = (map[inv.customer] || 0) + (inv._grand || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, total]) => ({ name, total }));
  }

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    const wrap = document.getElementById('historyList');

    const filtered = _filterQuery
      ? _list.filter(inv =>
          (inv.customer || '').toLowerCase().includes(_filterQuery) ||
          (inv.number   || '').toLowerCase().includes(_filterQuery))
      : _list;

    if (!_list.length) {
      wrap.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">🧾</div>
          <h3 style="color:var(--muted);font-size:1rem;margin-bottom:8px">No invoices yet</h3>
          <p style="color:var(--muted2);font-size:0.85rem">Your saved invoices will show up here</p>
        </div>`;
      return;
    }

    const today  = getDailyTotal();
    const week   = getWeekTotal();
    const month  = getMonthTotal();
    const tops   = getTopCustomers(3);
    const paidCount   = _list.filter(i => i.status === 'paid').length;
    const unpaidCount = _list.filter(i => i.status !== 'paid').length;

    const analyticsHtml = `
      <div class="analytics-block">
        <div class="analytics-row">
          <div class="analytics-card">
            <div class="analytics-label">Today</div>
            <div class="analytics-value">GHS ${today.toFixed(2)}</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-label">This Week</div>
            <div class="analytics-value">GHS ${week.toFixed(2)}</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-label">This Month</div>
            <div class="analytics-value analytics-value-lg">GHS ${month.toFixed(2)}</div>
          </div>
        </div>
        <div class="analytics-row">
          <div class="analytics-badge paid-badge">✅ ${paidCount} Paid</div>
          <div class="analytics-badge unpaid-badge">⏳ ${unpaidCount} Unpaid</div>
          ${tops.length ? `<div class="analytics-badge customer-badge">🏆 ${tops[0].name}</div>` : ''}
        </div>
      </div>`;

    const searchHtml = `
      <div class="history-search-wrap">
        <input class="history-search" id="historySearch"
          placeholder="🔍  Search customer or ref…"
          value="${_filterQuery}"
          oninput="History.search(this.value)" />
      </div>`;

    const listHtml = filtered.length ? filtered.map((inv, i) => {
      const itemSummary = (inv.items || []).slice(0, 3)
        .map(it => `${it.qty}× ${it.name}`).join(', ')
        + ((inv.items || []).length > 3 ? ' …' : '');
      const amt    = (inv._grand || 0).toFixed(2);
      const type   = inv.type || 'invoice';
      const isPaid = inv.status === 'paid';
      // Overdue check
      const isOverdue = !isPaid && inv.due_date && new Date(inv.due_date) < new Date();
      const realIdx = _list.indexOf(inv);
      return `
        <div class="hist-card ${isOverdue ? 'overdue' : ''}" onclick="History.openInvoice(${realIdx})">
          <div class="hist-top">
            <div class="hist-customer">${escHtml(inv.customer)} ${isOverdue ? '<span class="overdue-badge">🔴 OVERDUE</span>' : ''}</div>
            <div class="hist-amount">GHS ${amt}</div>
          </div>
          <div class="hist-bottom">
            <div class="hist-items mono">${escHtml(itemSummary)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="status-toggle ${isPaid ? 'paid' : ''}"
                      onclick="event.stopPropagation();History.toggleStatus(${realIdx})">
                ${isPaid ? 'PAID' : 'UNPAID'}
              </button>
              <span class="hist-badge ${type === 'receipt' ? 'receipt' : ''}">${type === 'invoice' ? 'INV' : 'REC'}</span>
              <div class="hist-date">${escHtml(inv.date || '')}</div>
            </div>
          </div>
        </div>`;
    }).join('') : `<p style="text-align:center;color:var(--muted2);padding:24px;font-size:0.85rem">No results for "${escHtml(_filterQuery)}"</p>`;

    wrap.innerHTML = analyticsHtml + searchHtml + listHtml;
  }

  function search(q) {
    _filterQuery = q.toLowerCase().trim();
    render();
    // keep focus on search box
    setTimeout(() => document.getElementById('historySearch')?.focus(), 10);
  }

  function openInvoice(i) {
    const inv = _list[i];
    if (!inv) return;
    Invoice.setCurrent({ ...inv });
    InvoicePage.render();
    App.showPage('invoice');
  }

  async function toggleStatus(index) {
    const inv       = _list[index];
    const newStatus = inv.status === 'paid' ? 'pending' : 'paid';
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/history/${inv.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        inv.status = newStatus;
        render();
        App.toast(newStatus === 'paid' ? '✅ Marked as paid' : 'Marked as unpaid', 'success');
      }
    } catch(e) { console.error('Status update failed', e); }
  }

  function escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { load, add, getAll, clear, render, openInvoice, toggleStatus, search, getDailyTotal, getWeekTotal, getMonthTotal };
})();
