// ============================================================
//  VoiceBill — Pay Menu Module v3.0
// ============================================================

const PayMenu = (() => {

  let _selected     = null;
  let _reminderDays = [];

  function toggle() {
    const wrap = document.getElementById('payBtnWrap');
    const dd   = document.getElementById('payDropdown');
    const isOpen = dd.classList.contains('open');
    if (isOpen) {
      dd.classList.remove('open');
      wrap.classList.remove('open');
    } else {
      dd.classList.add('open');
      wrap.classList.add('open');
      document.getElementById('duePanel').classList.remove('open');
    }
  }

  function select(method) {
    _selected = method;

    // Clear all checks
    ['cash','momo','bank','due'].forEach(m => {
      const el = document.getElementById('pmCheck_' + m);
      if (el) el.classList.remove('checked');
      const row = document.querySelector('.pm-' + m);
      if (row) row.classList.remove('selected');
    });

    // Mark selected
    const check = document.getElementById('pmCheck_' + method);
    if (check) check.classList.add('checked');
    const row = document.querySelector('.pm-' + method);
    if (row) row.classList.add('selected');

    // Close dropdown
    document.getElementById('payDropdown').classList.remove('open');
    document.getElementById('payBtnWrap').classList.remove('open');

    if (method === 'due') {
      // Show due date panel instead of confirming immediately
      document.getElementById('duePanel').classList.add('open');
      // Set min date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      document.getElementById('dueDateInp').min = tomorrow.toISOString().split('T')[0];
      return;
    }

    const labels = {
      cash: { title: '💵 Cash Payment',       desc: 'Invoice marked as paid in cash' },
      momo: { title: '📲 Mobile Money',        desc: 'Customer pays via MoMo' },
      bank: { title: '🏦 Bank Transfer',       desc: 'Customer pays via bank transfer' },
    };
    showConfirmed(labels[method].title, labels[method].desc);
  }

  function showConfirmed(title, desc) {
    document.getElementById('payConfirmedIcon').textContent = '✅';
    document.getElementById('payMethodChosen').textContent  = title;
    document.getElementById('payMethodDesc').textContent    = desc;
    document.getElementById('payConfirmed').classList.add('show');
    document.getElementById('duePanel').classList.remove('open');

    // Update pay button label
    document.getElementById('payBtnTitle').textContent = title;
    document.getElementById('payBtnSub').textContent   = 'Payment method selected';

    // Show badge inside invoice card
    const badge = document.getElementById('invPayBadge');
    const badgeTxt = document.getElementById('invPayBadgeText');
    if (badge && badgeTxt) {
      badgeTxt.textContent = title;
      badge.style.display  = 'block';
    }
  }

  function updateDueDisplay() {
    const val = document.getElementById('dueDateInp').value;
    if (!val) return;
    const date = new Date(val);
    const formatted = date.toLocaleDateString('en-GH', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

    const info = document.getElementById('dueInfo');
    const daysUntil = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
    info.textContent = `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} — ${formatted}`;
    info.classList.add('show');
  }

  function toggleReminder(el) {
    el.classList.toggle('active');
    const days = parseInt(el.dataset.days);
    if (el.classList.contains('active')) {
      if (!_reminderDays.includes(days)) _reminderDays.push(days);
    } else {
      _reminderDays = _reminderDays.filter(d => d !== days);
    }
  }

  function confirmDueDate() {
    const val = document.getElementById('dueDateInp').value;
    if (!val) { App.toast('Please pick a due date first', 'error'); return; }

    // Store due date on invoice
    const inv = Invoice.getCurrent();
    if (inv) {
      inv.dueDate    = val;
      inv.reminders  = [..._reminderDays];
      // Show due date on invoice card
      const dueCell = document.getElementById('inv_due_cell');
      const duDisp  = document.getElementById('inv_due_display');
      if (dueCell && duDisp) {
        const date = new Date(val);
        duDisp.textContent = date.toLocaleDateString('en-GH', { day:'numeric', month:'short', year:'numeric' });
        dueCell.style.display = 'flex';
      }
    }

    const reminderText = _reminderDays.length
      ? ` • Reminder${_reminderDays.length > 1 ? 's' : ''}: ${_reminderDays.map(d => d === 0 ? 'on due date' : d + ' day(s) before').join(', ')}`
      : '';

    showConfirmed('🗓️ Due Date Set', val + reminderText);
    App.toast('Due date set! Remember to send reminder via WhatsApp.', 'success');
  }

  function reset() {
    _selected    = null;
    _reminderDays = [];
    document.getElementById('payDropdown').classList.remove('open');
    document.getElementById('payBtnWrap').classList.remove('open');
    document.getElementById('duePanel').classList.remove('open');
    document.getElementById('payConfirmed').classList.remove('show');
    document.getElementById('payBtnTitle').textContent = 'Collect Payment';
    document.getElementById('payBtnSub').textContent   = 'Choose method ↓';
    const badge = document.getElementById('invPayBadge');
    if (badge) badge.style.display = 'none';
    ['cash','momo','bank','due'].forEach(m => {
      const el = document.getElementById('pmCheck_' + m);
      if (el) el.classList.remove('checked');
    });
    // Clear reminders UI
    document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('active'));
    const dueInfo = document.getElementById('dueInfo');
    if (dueInfo) { dueInfo.textContent = ''; dueInfo.classList.remove('show'); }
  }

  function getSelected() { return _selected; }

  return { toggle, select, updateDueDisplay, toggleReminder, confirmDueDate, reset, getSelected };
})();
