// ============================================================
//  VoiceBill — Invoice / AI Parsing Module
// ============================================================

const Invoice = (() => {

  let current = null;

  // ── AI PARSING ────────────────────────────────────────────
  async function parseText(text) {
    App.showLoading('Understanding your sale...');

    const prompt = `You are an invoice parser for a Ghanaian market seller. Extract invoice data from the spoken/typed description below.

Return ONLY valid JSON — no markdown, no explanation, no backticks.

Input: "${text}"

Expected JSON shape:
{
  "customer": "customer name, or 'Customer' if not mentioned",
  "items": [
    { "name": "item name", "qty": <number>, "price": <unit price as number> }
  ]
}

Rules:
- If a unit price is stated ("50 cedis each", "50 a piece"), use it directly as price.
- If a total for multiple items is stated ("3 shirts 150 cedis"), price = total / qty.
- If no price is mentioned at all, set price to 0.
- Handle Ghanaian pidgin/informal speech: "give am", "pieces", "pcs", "waakye", "kenkey", "pure water", "banku", "fufu", "jollof", "trotro", "cedis", "pesewas" etc.
- Qty must be a positive integer. Price must be a non-negative number.
- Customer name is usually the first proper noun. If absent use "Customer".
- Return items as an array even if only one item.`;

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          prompt: prompt
        })
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
    return {
      id:       num,
      number:   num,
      date:     date,
      customer: customer || 'Customer',
      items:    items.map(it => ({
        name:  it.name  || 'Item',
        qty:   Number(it.qty)   || 1,
        price: Number(it.price) || 0,
      })),
      discount: 0,
      delivery: 0,
    };
  }

  function getCurrent() { return current; }
  function setCurrent(inv) { current = inv; }

  function calcTotals(inv) {
    const sub   = (inv.items||[]).reduce((s,it) => s + it.qty * it.price, 0);
    const disc  = Number(inv.discount) || 0;
    const del   = Number(inv.delivery) || 0;
    const grand = Math.max(0, sub - disc + del);
    return { sub, disc, del, grand };
  }

  // ── GENERATE PLAIN TEXT FOR SHARING ───────────────────────
  function buildInvoiceText(inv) {
    const biz  = Settings.get('biz') || 'My Business';
    const momo = Settings.get('momo') || '';
    const { sub, disc, del, grand } = calcTotals(inv);

    let msg = `🧾 *INVOICE — ${biz}*\n`;
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
