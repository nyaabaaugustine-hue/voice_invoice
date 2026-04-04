// ============================================================
//  VoiceBill — Invoice Page UI Module  v4.0
//  + customer quick-pick datalist
//  + PDF export via print
//  + haptic feedback on share
// ============================================================

const InvoicePage = (() => {

  function render() {
    const inv = Invoice.getCurrent();
    if (!inv) return;

    const type = inv.type || 'invoice';

    // Badge
    const badge = document.getElementById('inv_doc_badge');
    if (badge) badge.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${type === 'invoice' ? 'Invoice' : 'Receipt'}`;

    const biz = Settings.get('biz') || 'My Business';
    document.getElementById('inv_biz').textContent      = biz;
    document.getElementById('inv_biz2').textContent     = biz;
    document.getElementById('inv_customer').textContent = inv.customer;
    document.getElementById('inv_date').textContent     = inv.date;
    document.getElementById('inv_number_badge').textContent = inv.number;

    // MoMo display in header
    const momo    = Settings.get('momo') || '';
    const momoEl  = document.getElementById('inv_momo_display');
    if (momoEl) momoEl.textContent = momo ? '📲 ' + momo : '';

    // QR code for MoMo payment
    _renderQR(momo, inv);

    // type switcher
    document.getElementById('btn_type_invoice').classList.toggle('active', type === 'invoice');
    document.getElementById('btn_type_receipt').classList.toggle('active', type === 'receipt');

    // logo
    const logoUrl = Settings.get('logo');
    const logoImg = document.getElementById('inv_logo');
    if (logoUrl) { logoImg.src = logoUrl; logoImg.style.display = 'block'; }
    else { logoImg.style.display = 'none'; }

    // fields
    document.getElementById('inv_discount').value = inv.discount > 0 ? inv.discount : '';
    document.getElementById('inv_delivery').value = inv.delivery > 0 ? inv.delivery : '';
    document.getElementById('inv_momo').value     = momo;

    // customer quick-pick datalist
    _renderCustomerDatalist();

    PayMenu.reset();
    document.getElementById('payBtnAmount').textContent = 'GHS 0.00';

    renderItems();
    renderTaxes();
    recalc();
  }

  // ── QR CODE ────────────────────────────────────────────────────────
  function _renderQR(momo, inv) {
    const wrap = document.getElementById('inv_qr_wrap');
    const box  = document.getElementById('inv_qr_code');
    if (!wrap || !box) return;
    if (!momo) { wrap.style.display = 'none'; return; }

    wrap.style.display = 'flex';
    box.innerHTML = ''; // clear old QR

    const { grand } = Invoice.calcTotals(inv);
    const qrText = `MoMo: ${momo} | Amount: GHS ${grand.toFixed(2)} | Ref: ${inv.number}`;

    try {
      new QRCode(box, {
        text:          qrText,
        width:         100,
        height:        100,
        colorDark:     '#000000',
        colorLight:    '#ffffff',
        correctLevel:  QRCode.CorrectLevel.M
      });
    } catch(e) {
      wrap.style.display = 'none';
    }
  }

  function _renderCustomerDatalist() {
    let dl = document.getElementById('customerList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'customerList';
      document.body.appendChild(dl);
    }
    const customers = Invoice.getCustomers();
    dl.innerHTML = customers.map(c => `<option value="${escHtml(c)}">`).join('');
  }

  function renderItems() {
    const inv   = Invoice.getCurrent();
    const tbody = document.getElementById('inv_items');
    tbody.innerHTML = (inv.items || []).map((it, i) => {
      const lineTotal = (it.qty * it.price).toFixed(2);
      return `
      <div class="item-row-edit">
        <input class="item-name-field" value="${escHtml(it.name)}"
               oninput="InvoicePage.updateField(${i},'name',this.value)" />
        <input class="item-qty-field" type="number" value="${it.qty}" min="1"
               oninput="InvoicePage.updateField(${i},'qty',this.value)" />
        <input class="item-price-field" type="number" value="${Number(it.price).toFixed(2)}" min="0" step="0.01"
               oninput="InvoicePage.updateField(${i},'price',this.value)" />
        <div class="item-line-total" id="ilt_${i}">GHS ${lineTotal}</div>
        <button class="item-del-btn" onclick="InvoicePage.removeItem(${i})">✕</button>
      </div>`;
    }).join('');
  }

  function renderTaxes() {
    const inv  = Invoice.getCurrent();
    const wrap = document.getElementById('inv_tax_toggles');
    if (!inv.taxes || !inv.taxes.length) {
      wrap.innerHTML = '<p style="font-size:0.8rem;color:var(--muted2)">No taxes configured in Settings</p>';
      return;
    }
    wrap.innerHTML = inv.taxes.map((t, i) => `
      <label class="tax-toggle">
        <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="InvoicePage.toggleTax(${i}, this.checked)">
        <span>${escHtml(t.name)} (${t.rate}%)</span>
      </label>`).join('');
  }

  function updateField(i, field, value) {
    const inv = Invoice.getCurrent();
    if (!inv || !inv.items[i]) return;
    if (field === 'qty')   inv.items[i].qty   = Math.max(1, parseInt(value) || 1);
    if (field === 'price') inv.items[i].price = parseFloat(value) || 0;
    if (field === 'name')  inv.items[i].name  = value;
    const el = document.getElementById('ilt_' + i);
    if (el) el.textContent = 'GHS ' + (inv.items[i].qty * inv.items[i].price).toFixed(2);
    recalc();
  }

  function setType(type) {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    inv.type = type;
    // re-generate number with correct prefix
    const num = 'INV' in {} ? inv.number : inv.number; // keep existing number, just re-render
    render();
  }

  function toggleTax(i, enabled) {
    const inv = Invoice.getCurrent();
    if (!inv || !inv.taxes[i]) return;
    inv.taxes[i].enabled = enabled;
    recalc();
  }

  function removeItem(i) {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    inv.items.splice(i, 1);
    renderItems();
    recalc();
  }

  function addBlankItem() {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    inv.items.push({ name: 'New item', qty: 1, price: 0 });
    renderItems();
    recalc();
    const inputs = document.querySelectorAll('.item-name-field');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function updateMomoDisplay() {
    const val = document.getElementById('inv_momo').value.trim();
    const el  = document.getElementById('inv_momo_display');
    if (el) el.textContent = val ? '📲 ' + val : '';
  }

  function recalc() {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    inv.discount = parseFloat(document.getElementById('inv_discount').value) || 0;
    inv.delivery = parseFloat(document.getElementById('inv_delivery').value) || 0;

    const { sub, disc, del, taxLines, grand } = Invoice.calcTotals(inv);

    document.getElementById('tot_sub').textContent   = `GHS ${sub.toFixed(2)}`;
    document.getElementById('tot_grand').textContent = `GHS ${grand.toFixed(2)}`;

    const discRow = document.getElementById('tot_disc_row');
    const delRow  = document.getElementById('tot_del_row');
    discRow.style.display = disc > 0 ? 'flex' : 'none';
    delRow.style.display  = del  > 0 ? 'flex' : 'none';
    document.getElementById('tot_disc').textContent = `- GHS ${disc.toFixed(2)}`;
    document.getElementById('tot_del').textContent  = `+ GHS ${del.toFixed(2)}`;

    const taxRowsWrap = document.getElementById('tot_tax_rows');
    taxRowsWrap.innerHTML = taxLines.map(t => `
      <div class="tot-line tax">
        <span>${escHtml(t.name)}</span>
        <span class="val">+ GHS ${t.amount.toFixed(2)}</span>
      </div>`).join('');

    document.getElementById('payBtnAmount').textContent = `GHS ${grand.toFixed(2)}`;
  }

  async function share(channel) {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    if (navigator.vibrate) navigator.vibrate(25);
    const momoVal = document.getElementById('inv_momo').value.trim();
    if (momoVal) await Settings.save({ momo: momoVal });
    await History.add(inv);

    const msg = Invoice.buildInvoiceText(inv);
    const wa  = Settings.get('wa');
    let url   = '';

    if (channel === 'whatsapp') {
      url = wa
        ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    } else if (channel === 'telegram') {
      url = `https://t.me/share/url?url=&text=${encodeURIComponent(msg)}`;
    } else if (channel === 'sms') {
      url = `sms:?body=${encodeURIComponent(msg)}`;
    } else if (channel === 'email') {
      const subject = `Invoice ${inv.number} from ${Settings.get('biz')}`;
      url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    }

    window.open(url, '_blank');
    App.toast(`Opening ${channel}…`, 'success');
  }

  function copyText() {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    const txt = Invoice.buildInvoiceText(inv);
    navigator.clipboard.writeText(txt)
      .then(() => App.toast('Copied to clipboard!', 'success'))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        App.toast('Copied!', 'success');
      });
  }

  // ── PDF EXPORT VIA PRINT ──────────────────────────────────
  function exportPDF() {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    if (navigator.vibrate) navigator.vibrate(15);

    const { sub, disc, del, taxLines, grand } = Invoice.calcTotals(inv);
    const biz   = Settings.get('biz') || 'My Business';
    const momo  = Settings.get('momo') || '';
    const logo  = Settings.get('logo') || '';
    const type  = (inv.type || 'invoice').toUpperCase();

    const itemsHtml = (inv.items || []).map(it => `
      <tr>
        <td>${escHtml(it.name)}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">GHS ${Number(it.price).toFixed(2)}</td>
        <td style="text-align:right"><strong>GHS ${(it.qty * it.price).toFixed(2)}</strong></td>
      </tr>`).join('');

    const taxRowsHtml = taxLines.map(t => `
      <tr class="totals-row">
        <td colspan="3" style="text-align:right">${escHtml(t.name)}</td>
        <td style="text-align:right">+ GHS ${t.amount.toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${type} ${inv.number} — ${biz}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; color: #111; background: #fff; font-size: 13px; padding: 40px; max-width: 680px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #4eff91; }
  .biz-name { font-size: 22px; font-weight: 800; color: #111; }
  .doc-type { display: inline-block; padding: 3px 12px; background: #e8fff2; border: 1px solid #4eff91; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #0a5c2a; margin-top: 6px; }
  .inv-num { font-size: 11px; color: #666; font-family: monospace; }
  .parties { display: flex; gap: 40px; margin-bottom: 28px; padding: 20px; background: #f8f8f8; border-radius: 10px; }
  .party-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #999; margin-bottom: 4px; }
  .party-name { font-size: 15px; font-weight: 700; }
  .party-momo { font-size: 11px; color: #d18000; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #111; color: #fff; padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 10px 14px; border-bottom: 1px solid #eee; }
  .totals-section { margin-left: auto; width: 280px; }
  .totals-section table { border: none; }
  .totals-section td { border-bottom: 1px solid #f0f0f0; color: #555; }
  .grand-row td { font-size: 16px; font-weight: 800; color: #111; border-top: 2px solid #111; border-bottom: none; padding-top: 14px; }
  .grand-row td:last-child { color: #0a5c2a; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
  .momo-box { margin-top: 24px; padding: 14px 18px; background: #fff8e6; border: 1px solid #f5a623; border-radius: 8px; font-size: 12px; }
  .momo-box strong { color: #c47d00; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    ${logo ? `<img src="${logo}" style="height:48px;margin-bottom:10px;display:block;" />` : ''}
    <div class="biz-name">${escHtml(biz)}</div>
    <div class="doc-type">${type}</div>
  </div>
  <div style="text-align:right">
    <div class="inv-num">Ref: ${escHtml(inv.number)}</div>
    <div class="inv-num">Date: ${escHtml(inv.date)}</div>
  </div>
</div>

<div class="parties">
  <div>
    <div class="party-label">From</div>
    <div class="party-name">${escHtml(biz)}</div>
    ${momo ? `<div class="party-momo">📲 ${escHtml(momo)}</div>` : ''}
  </div>
  <div>
    <div class="party-label">To</div>
    <div class="party-name">${escHtml(inv.customer)}</div>
    <div style="font-size:11px;color:#999;margin-top:3px">${escHtml(inv.date)}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Item</th><th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${itemsHtml}</tbody>
</table>

<div class="totals-section">
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">GHS ${sub.toFixed(2)}</td></tr>
    ${disc > 0 ? `<tr><td>Discount</td><td style="text-align:right;color:#c0392b">- GHS ${disc.toFixed(2)}</td></tr>` : ''}
    ${taxRowsHtml}
    ${del > 0 ? `<tr><td>Delivery</td><td style="text-align:right">+ GHS ${del.toFixed(2)}</td></tr>` : ''}
    <tr class="grand-row">
      <td>Total Due</td>
      <td style="text-align:right">GHS ${grand.toFixed(2)}</td>
    </tr>
  </table>
</div>

${momo ? `<div class="momo-box"><strong>💳 Pay via Mobile Money:</strong> ${escHtml(momo)}</div>` : ''}

<div class="footer">Thank you for your business! 🙏 &nbsp;—&nbsp; ${escHtml(biz)}</div>

<script>window.onload = () => { window.print(); }<\/script>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { App.toast('Allow popups to export PDF', 'error'); return; }
    win.document.write(html);
    win.document.close();
    App.toast('Opening print / save PDF…', 'success');
  }

  async function saveAndNew() {
    const inv = Invoice.getCurrent();
    if (inv) await History.add(inv);
    App.toast('Invoice saved!', 'success');
    setTimeout(() => App.showPage('voice'), 400);
  }

  function escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    render, renderItems, updateField, setType, toggleTax,
    removeItem, addBlankItem, recalc, share, copyText,
    saveAndNew, updateMomoDisplay, exportPDF
  };
})();
