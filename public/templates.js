// ============================================================
//  VoiceBill — Recurring Invoice Templates  v1.0
//  Saves invoice snapshots that can be re-used instantly
// ============================================================

const Templates = (() => {

  const LS_KEY = 'vb_templates';

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }

  function _save(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  // ── Save current invoice as template ─────────────────────
  function openSaveModal() {
    const inv = Invoice.getCurrent();
    if (!inv || !inv.items?.length) {
      App.toast('Create an invoice first, then save it as a template', 'error');
      return;
    }
    const name = prompt('Name this template:\n(e.g. "Ama Weekly Waakye")');
    if (!name?.trim()) return;

    const list = _load();
    list.unshift({
      id:       Date.now(),
      name:     name.trim(),
      customer: inv.customer,
      items:    inv.items.map(it => ({ ...it })),
      discount: inv.discount || 0,
      delivery: inv.delivery || 0,
      savedAt:  new Date().toISOString()
    });
    if (list.length > 20) list.pop();
    _save(list);
    renderList();
    App.toast(`Template "${name.trim()}" saved!`, 'success');
  }

  // ── Load template → new invoice instantly ────────────────
  function use(id) {
    const list = _load();
    const tpl  = list.find(t => t.id === id);
    if (!tpl) return;
    const inv     = Invoice.createInvoice(tpl.customer, tpl.items, tpl.discount);
    inv.delivery  = tpl.delivery || 0;
    Invoice.setCurrent(inv);
    InvoicePage.render();
    App.showPage('invoice');
    App.toast(`Template loaded: ${tpl.name}`, 'success');
  }

  // ── Delete template ───────────────────────────────────────
  function remove(id) {
    _save(_load().filter(t => t.id !== id));
    renderList();
    App.toast('Template removed', '');
  }

  // ── Render list in Settings page ─────────────────────────
  function renderList() {
    const wrap = document.getElementById('s_templates_list');
    if (!wrap) return;
    const list = _load();
    if (!list.length) {
      wrap.innerHTML = '<p style="font-size:0.78rem;color:var(--muted2);padding:8px 0">No templates saved yet.</p>';
      return;
    }
    wrap.innerHTML = list.map(t => `
      <div class="template-item">
        <div class="template-info" onclick="Templates.use(${t.id})">
          <div class="template-name">${_esc(t.name)}</div>
          <div class="template-meta">${_esc(t.customer)} &mdash; ${t.items.length} item${t.items.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="template-actions">
          <button class="template-use-btn" onclick="Templates.use(${t.id})">Use</button>
          <button class="template-del-btn" onclick="Templates.remove(${t.id})">&#x2715;</button>
        </div>
      </div>`).join('');
  }

  function _esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { openSaveModal, use, remove, renderList };
})();
