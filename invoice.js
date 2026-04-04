// ============================================================
//  VoiceBill — Invoice / AI Parsing Module  v4.0
//  + auto-increment invoice numbers
//  + customer quick-pick registry
//  + better error handling & retry messaging
// ============================================================

const Invoice = (() => {

  const INV_COUNTER_KEY  = 'vb_inv_counter';
  const CUSTOMERS_KEY    = 'vb_customers';

  let current = null;

  // ── INVOICE COUNTER ───────────────────────────────────────
  function _nextNumber(type) {
    const prefix = (type === 'receipt') ? 'REC' : 'INV';
    const count  = parseInt(localStorage.getItem(INV_COUNTER_KEY) || '0') + 1;
    localStorage.setItem(INV_COUNTER_KEY, String(count));
    const now    = new Date();
    const yy     = now.getFullYear().toString().slice(-2);
    const mm     = String(now.getMonth() + 1).padStart(2, '0');
    return `${prefix}-${yy}${mm}-${String(count).padStart(4, '0')}`;
  }

  // ── CUSTOMER REGISTRY ─────────────────────────────────────
  function getCustomers() {
    try { return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCustomer(name) {
    if (!name || name === 'Customer') return;
    const list = getCustomers();
    if (!list.includes(name)) {
      list.unshift(name);
      if (list.length > 30) list.pop(); // keep last 30
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
    }
  }

  function clearCustomers() {
    localStorage.removeItem(CUSTOMERS_KEY);
  }

  // ── AI PARSING ────────────────────────────────────────────
  async function parseText(text) {
    App.showLoading('Understanding your sale…');

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const parsed = await res.json();

      if (parsed.error) {
        App.hideLoading();
        // Friendly error message based on content
        let msg = parsed.error;
        if (msg.includes('Rate limit') || msg.includes('429'))
          msg = '⏱ AI is busy — wait a moment and try again.';
        else if (msg.includes('API Key') || msg.includes('401'))
          msg = '🔑 API key issue — contact support.';
        else if (msg.includes('empty'))
          msg = '🎤 Couldn\'t catch that — try rephrasing or type it below.';
        App.toast(msg, 'error');
        Voice.showTypeInput();
        return null;
      }

      current = createInvoice(parsed.customer, parsed.items || [], parsed.discount || 0);
      saveCustomer(current.customer);
      App.hideLoading();
      return current;

    } catch(e) {
      App.hideLoading();
      App.toast('📡 Connection issue — check internet and try again.', 'error');
      Voice.showTypeInput();
      console.error(e);
      return null;
    }
  }

  // ── INVOICE OBJECT ────────────────────────────────────────
  function createInvoice(customer, items, discount = 0, type = 'invoice') {
    const now  = new Date();
    const date = now.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
    const num  = _nextNumber(type);
    const settingsTaxes = (Settings.get('taxes') || []).map(t => ({ ...t, enabled: false }));

    return {
      id:       num,
      number:   num,
      date,
      type,
      customer: customer || 'Customer',
      items:    items.map(it => ({
        name:  it.name  || 'Item',
        qty:   Number(it.qty)   || 1,
        price: Number(it.price) || 0,
      })),
      discount: Number(discount) || 0,
      delivery: 0,
      taxes:    settingsTaxes,
    };
  }

  function getCurrent()      { return current; }
  function setCurrent(inv)   { current = inv; }

  function calcTotals(inv) {
    const sub  = (inv.items || []).reduce((s, it) => s + it.qty * it.price, 0);
    const disc = Number(inv.discount) || 0;
    const del  = Number(inv.delivery) || 0;

    const taxableAmount = Math.max(0, sub - disc);
    const taxLines = (inv.taxes || []).filter(t => t.enabled).map(t => ({
      name:   t.name,
      amount: taxableAmount * (Number(t.rate) / 100)
    }));
    const totalTax = taxLines.reduce((s, t) => s + t.amount, 0);
    const grand    = taxableAmount + totalTax + del;

    return { sub, disc, del, taxLines, totalTax, grand };
  }

  // ── PLAIN TEXT FOR SHARING ───────────────────────────────
  function buildInvoiceText(inv) {
    const biz  = Settings.get('biz') || 'My Business';
    const momo = Settings.get('momo') || '';
    const { sub, disc, del, taxLines, grand } = calcTotals(inv);
    const docTitle = (inv.type || 'invoice').toUpperCase();

    let msg = `🧾 *${docTitle} — ${biz}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 Ref: ${inv.number}\n`;
    msg += `👤 Customer: ${inv.customer}\n`;
    msg += `📅 Date: ${inv.date}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `*ITEMS*\n`;
    (inv.items || []).forEach(it => {
      const tot = (it.qty * it.price).toFixed(2);
      msg += `• ${it.name} × ${it.qty}  @  GHS ${Number(it.price).toFixed(2)}  =  *GHS ${tot}*\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Subtotal: GHS ${sub.toFixed(2)}\n`;
    if (disc > 0) msg += `Discount: -GHS ${disc.toFixed(2)}\n`;
    taxLines.forEach(t => {
      msg += `${t.name}: +GHS ${t.amount.toFixed(2)}\n`;
    });
    if (del > 0) msg += `Delivery: +GHS ${del.toFixed(2)}\n`;
    msg += `\n💰 *TOTAL DUE: GHS ${grand.toFixed(2)}*\n`;
    if (momo) {
      msg += `\n📲 *Pay via MoMo:*\n${momo}\n`;
    }
    msg += `\nThank you for your business! 🙏\n— ${biz}`;
    return msg;
  }

  return {
    parseText, getCurrent, setCurrent, calcTotals, buildInvoiceText,
    createInvoice, getCustomers, saveCustomer, clearCustomers
  };
})();
