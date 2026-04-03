// ============================================================
//  VoiceBill — Invoice Page UI Module
// ============================================================

const InvoicePage = (() => {

  function render() {
    const inv = Invoice.getCurrent();
    if (!inv) return;

    // header
    document.getElementById('inv_biz').textContent      = Settings.get('biz') || 'My Business';
    document.getElementById('inv_customer').textContent = inv.customer;
    document.getElementById('inv_number').textContent   = inv.number;
    document.getElementById('inv_date').textContent     = inv.date;

    // logo logic
    const logoUrl = Settings.get('logo');
    const logoImg = document.getElementById('inv_logo');
    if (logoUrl) { logoImg.src = logoUrl; logoImg.style.display = 'block'; }
    else { logoImg.style.display = 'none'; }

    // extra fields
    document.getElementById('inv_discount').value = inv.discount > 0 ? inv.discount : '';
    document.getElementById('inv_delivery').value = inv.delivery > 0 ? inv.delivery : '';
    document.getElementById('inv_momo').value     = Settings.get('momo') || '';

    renderItems();
    recalc();
  }

  function renderItems() {
    const inv   = Invoice.getCurrent();
    const tbody = document.getElementById('inv_items');
    tbody.innerHTML = (inv.items || []).map((it, i) => `
      <div class="item-row-edit">
        <input class="item-name-field" value="${escHtml(it.name)}"
               oninput="InvoicePage.updateField(${i},'name',this.value)" />
        <input class="item-qty-field" type="number" value="${it.qty}" min="1"
               oninput="InvoicePage.updateField(${i},'qty',this.value)" />
        <input class="item-price-field" type="number" value="${it.price.toFixed(2)}" min="0" step="0.01"
               oninput="InvoicePage.updateField(${i},'price',this.value)" />
        <button class="item-del-btn" onclick="InvoicePage.removeItem(${i})">✕</button>
      </div>`).join('');
  }

  function updateField(i, field, value) {
    const inv = Invoice.getCurrent();
    if (!inv || !inv.items[i]) return;
    if (field === 'qty')   inv.items[i].qty   = Math.max(1, parseInt(value)||1);
    if (field === 'price') inv.items[i].price = parseFloat(value)||0;
    if (field === 'name')  inv.items[i].name  = value;
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
    // focus name of last row
    const inputs = document.querySelectorAll('.item-name-field');
    if (inputs.length) inputs[inputs.length-1].focus();
  }

  function recalc() {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    inv.discount = parseFloat(document.getElementById('inv_discount').value) || 0;
    inv.delivery = parseFloat(document.getElementById('inv_delivery').value) || 0;

    const { sub, disc, del, grand } = Invoice.calcTotals(inv);

    document.getElementById('tot_sub').textContent   = `GHS ${sub.toFixed(2)}`;
    document.getElementById('tot_grand').textContent = `GHS ${grand.toFixed(2)}`;

    const discRow = document.getElementById('tot_disc_row');
    const delRow  = document.getElementById('tot_del_row');
    discRow.style.display = disc > 0 ? 'flex' : 'none';
    delRow.style.display  = del  > 0 ? 'flex' : 'none';
    document.getElementById('tot_disc').textContent = `- GHS ${disc.toFixed(2)}`;
    document.getElementById('tot_del').textContent  = `+ GHS ${del.toFixed(2)}`;
  }

  async function share(channel) {
    const inv = Invoice.getCurrent();
    if (!inv) return;
    // sync momo from field
    const momoVal = document.getElementById('inv_momo').value.trim();
    if (momoVal) await Settings.save({ momo: momoVal });

    // save to history
    await History.add(inv);

    const msg = Invoice.buildInvoiceText(inv);
    const wa  = Settings.get('wa');
    
    let url = '';
    if (channel === 'whatsapp') {
      url = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
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
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        App.toast('Copied!', 'success');
      });
  }

  async function saveAndNew() {
    const inv = Invoice.getCurrent();
    if (inv) await History.add(inv);
    App.toast('Invoice saved!', 'success');
    setTimeout(() => App.showPage('voice'), 400);
  }

  function escHtml(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render, renderItems, updateField, removeItem, addBlankItem, recalc, share, copyText, saveAndNew };
})();
