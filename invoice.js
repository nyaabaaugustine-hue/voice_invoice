// ============================================================
//  VoiceBill — Invoice / AI Parsing Module
// ============================================================

const Invoice = (() => {

  let current = null;

  // ── AI PARSING ────────────────────────────────────────────
  async function parseText(text) {
    App.showLoading('Understanding your sale...');

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      const parsed = await res.json();
      if (parsed.error) {
        App.hideLoading();
        App.toast(parsed.error || 'Parsing error', 'error');
        return null;
      }

      current = createInvoice(parsed.customer, parsed.items || []);
      App.hideLoading();
      return current;

    } catch(e) {
      App.hideLoading();
      App.toast('Could not parse. Please try again.', 'error');
      console.error(e);
      return null;
    }
  }

  // ── INVOICE OBJECT ────────────────────────────────────────
  function createInvoice(customer, items) {
    const now   = new Date();
    const date  = now.toLocaleDateString('en-GH', { day:'numeric', month:'short', year:'numeric' });
    const num   = 'INV-' + now.getFullYear().toString().slice(-2) +
                  String(now.getMonth()+1).padStart(2,'0') +
                  String(now.getDate()).padStart(2,'0') + '-' +
                  String(Math.floor(Math.random()*9000)+1000);
    // copy taxes from settings so they can be toggled per invoice
    const settingsTaxes = (Settings.get('taxes') || []).map(t => ({ ...t, enabled: false }));
    return {
      id:       num,
      number:   num,
      date:     date,
      type:     'invoice',
      customer: customer || 'Customer',
      items:    items.map(it => ({
        name:  it.name  || 'Item',
        qty:   Number(it.qty)   || 1,
        price: Number(it.price) || 0,
      })),
      discount: 0,
      delivery: 0,
      taxes:    settingsTaxes,
    };
  }

  function getCurrent() { return current; }
  function setCurrent(inv) { current = inv; }

  function calcTotals(inv) {
    const sub   = (inv.items||[]).reduce((s,it) => s + it.qty * it.price, 0);
    const disc  = Number(inv.discount) || 0;
    const del   = Number(inv.delivery) || 0;

    const taxableAmount = Math.max(0, sub - disc);
    const taxLines = (inv.taxes || []).filter(t => t.enabled).map(t => ({
      name: t.name,
      amount: taxableAmount * (Number(t.rate) / 100)
    }));

    const totalTax = taxLines.reduce((s, t) => s + t.amount, 0);
    const grand = taxableAmount + totalTax + del;

    return { sub, disc, del, taxLines, totalTax, grand };
  }

  // ── GENERATE PLAIN TEXT FOR SHARING ───────────────────────
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
    (inv.items||[]).forEach(it => {
      const tot = (it.qty * it.price).toFixed(2);
      msg += `• ${it.name} × ${it.qty}  @  GHS ${Number(it.price).toFixed(2)}  =  *GHS ${tot}*\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Subtotal: GHS ${sub.toFixed(2)}\n`;
    if (disc > 0) msg += `Discount: -GHS ${disc.toFixed(2)}\n`;
    taxLines.forEach(t => {
      msg += `${t.name}: +GHS ${t.amount.toFixed(2)}\n`;
    });
    if (del  > 0) msg += `Delivery: +GHS ${del.toFixed(2)}\n`;
    msg += `\n💰 *TOTAL DUE: GHS ${grand.toFixed(2)}*\n`;
    if (momo) {
      msg += `\n📲 *Pay via MoMo:*\n${momo}\n`;
    }
    msg += `\nThank you for your business! 🙏\n— ${biz}`;
    return msg;
  }

  return { parseText, getCurrent, setCurrent, calcTotals, buildInvoiceText, createInvoice };
})();
