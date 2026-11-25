/* Interaction adapter for the captured native customer page. No network writes. */
(() => {
  'use strict';
  const modals = JSON.parse(document.getElementById('capture-modal-data').textContent);
  const policies = JSON.parse(document.getElementById('capture-billing-data')?.textContent || '{}');
  const byId = id => document.getElementById(id);
  let lastTrigger = null;
  let toastTimer;
  function note(text = '操作確認用の原稿です。保存・送信・決済は実行されません。') {
    let box = byId('rough-operation-note');
    if (!box) {
      box = document.createElement('div'); box.id = 'rough-operation-note'; box.setAttribute('role', 'status');
      box.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646;border-radius:7px;padding:10px 17px;background:#233628;color:#fff;font:14px/1.5 system-ui;max-width:85vw;text-align:center';
      document.body.append(box);
    }
    box.textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => box.remove(), 3500);
  }
  function clean(markup) {
    const fragment = document.createElement('template'); fragment.innerHTML = markup;
    fragment.content.querySelectorAll('script,iframe,object,embed').forEach(el => el.remove());
    fragment.content.querySelectorAll('*').forEach(el => {
      for (const a of [...el.attributes]) {
        if (/^on/i.test(a.name)) { el.setAttribute('data-sl-' + a.name.slice(2), a.value); el.removeAttribute(a.name); }
      }
    });
    return fragment.content;
  }
  function fields(root, values) {
    const inputs = root.querySelectorAll('input,textarea,select');
    for (const field of values || []) {
      const input = inputs[field.index]; if (!input) continue;
      input.value = field.value;
      if (field.checked !== undefined) input.checked = field.checked;
      if (field.disabled !== undefined) input.disabled = field.disabled;
    }
  }
  function open(name, trigger) {
    const captured = modals[name]; if (!captured) return note('この操作の画面は未取得です。');
    const old = document.querySelector(captured.selector);
    const fragment = clean(captured.html), root = fragment.firstElementChild;
    fields(root, captured.fields);
    if (old) old.replaceWith(fragment); else document.body.append(fragment);
    lastTrigger = trigger;
    if (root.matches('.cd-modal-bg')) {
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    }
    if (name === 'notes') {
      byId('ovNotesEdit').style.display = 'none';
      const current = byId('ovNotes').textContent;
      byId('ovNotesInput').value = current === '--' ? '' : current;
      byId('ovNotesInput').focus();
    }
  }
  function close(element) {
    const root = element.closest('.cd-modal-bg,#cd-billing-modal,#ccForm,#ovNotesEditor');
    if (!root) return;
    if (root.matches('.cd-modal-bg')) root.classList.remove('open'); else root.style.display = 'none';
    if (root.id === 'ovNotesEditor') byId('ovNotesEdit').style.display = '';
    lastTrigger?.focus();
  }
  document.addEventListener('click', event => {
    if (event.target.matches('.cd-modal-bg.open,#cd-billing-modal')) return close(event.target);
    const button = event.target.closest('button,a,[data-sl-click]'); if (!button) return;
    if (button.matches('.cd-tab')) return;
    const action = button.getAttribute('data-sl-click') || '';
    const modalName = Object.entries(modals).find(([, entry]) => entry.trigger === action)?.[0];
    if (modalName) { event.preventDefault(); open(modalName, button); return; }
    if (button.id === 'cd-billing-override-btn') { open('billing', button); return; }
    if (/^(?:close\w*|ccCloseForm|cdCancelNote)\(/.test(action) || button.id === 'cd-billing-cancel') {
      event.preventDefault(); close(button); return;
    }
    if (/(?:submit|save|delete|remove|sendTreatmentReport|rfSave|cdPrepay)/i.test(action) || button.id === 'cd-billing-save') {
      event.preventDefault(); note(); return;
    }
    if (action || button.matches('a[href]')) {
      event.preventDefault();
      const href = button.getAttribute('href') || '';
      if (href === '/customers/' || button.closest('.sidebar-nav') && /顧客名簿/.test(button.textContent)) {
        location.href = '../#C01'; return;
      }
      if (href.startsWith('#') && !action) return;
      note('この先は別画面への移動です。今回の原稿は顧客詳細の概要から書類までです。');
    }
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'cdPrepayOverride') note('確認用の選択です。顧客の設定は保存されません。');
    if (target.name === 'splCh') byId('splSendBtn').disabled = false;
    if (target.id === 'cd-billing-policy') {
      const current = policies[target.value], root = byId('cd-billing-params');
      root.replaceChildren(current ? clean(current.html) : document.createDocumentFragment());
      if (current) fields(root, current.fields);
    }
    if (target.id === 'payPm') byId('payCardRow').style.display = target.value === '__manual__' ? '' : 'none';
  });
  document.addEventListener('input', event => {
    if (event.target.id !== 'payAmt') return;
    const preview = byId('payPreview'), amount = Number(event.target.value);
    if (!preview) return;
    if (!(amount > 0)) { preview.style.display = 'none'; return; }
    preview.style.display = '';
    const template = modals.invoicePayment?.html;
    if (!template) return;
    const copied = clean(template).querySelector('#payPreview');
    if (copied) preview.innerHTML = copied.innerHTML.replace(/907\.38/g, amount.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}));
  });
  document.addEventListener('submit', event => { event.preventDefault(); note(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const root = document.querySelector('.cd-modal-bg.open,#cd-billing-modal[style*="display: flex"]');
      if (root) close(root);
    }
  });
  // Browser Back/Forward retains a tab selection in the local manuscript.
  const tabNames = new Set(EXOPS_CAPTURE.tabs.map(tab => tab.pane));
  const switchTab = window.cdSwitchTab;
  window.cdSwitchTab = function(name) {
    switchTab(name);
    if (tabNames.has(name) && location.hash !== '#' + name) history.pushState(null, '', location.pathname + location.search + '#' + name);
  };
  function restoreTab() {
    const name = location.hash.slice(1);
    switchTab(tabNames.has(name) ? name : 'overview');
  }
  window.addEventListener('popstate', restoreTab); restoreTab();
  window.addEventListener('exops-reference-note', event => note(event.detail));
})();
