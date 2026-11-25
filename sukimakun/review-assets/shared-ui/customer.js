(() => {
  'use strict';
  const sample=window.EXOPS_CUSTOMER_SAMPLE,customer=sample.profile;
  const $ = id => document.getElementById(id);
  const state = { confirmed: false, name: '', checked: false, confirmedAt: '2026年11月24日 14:32', paymentStatus: '未入金', receiptNumber: sample.current.id, estimate: 200, subtotal: 200, tax: 20, total: 220 };
  const form = $('confirmation-form');
  const nameInput = $('signature-name');
  const checkInput = $('confirmation-check');
  const dialog = $('invoice-dialog');

  function render() {
    $('customer-greeting').textContent=customer.name+' 様';
    $('customer-receipt').textContent=state.receiptNumber;
    nameInput.value = state.name;
    checkInput.checked = state.checked;
    $('confirm-button').disabled = !state.name.trim() || !state.checked || state.confirmed;
    $('confirmation-section').hidden = state.confirmed;
    $('confirmed-section').hidden = !state.confirmed;
    $('payment-section').hidden = !state.confirmed;
    $('invoice-before').hidden = state.confirmed;
    $('confirmed-name').textContent = state.name;
    $('shared-invoice').innerHTML = window.exopsInvoice({amount:state.total,method:'Stripe',signed:state.confirmed,name:state.name});
    $('work-status').textContent = state.confirmed ? '確認済み' : '確認待ち';
    $('work-status').className = `status ${state.confirmed ? 'done' : 'neutral'}`;
    $('step-confirm').className = state.confirmed ? 'complete' : 'active';
    $('step-payment').className = state.confirmed ? 'active' : '';
    $('page-title').textContent = state.confirmed ? '作業確認とお支払い' : '作業内容と金額のご確認';
    $('page-description').textContent = state.confirmed ? '作業の確認が完了しました。お支払いへお進みください。' : '内容をご確認のうえ、お名前を入力してください。';
    if (dialog.open) fitInvoice();
  }
  function readForm() { state.name = nameInput.value; state.checked = checkInput.checked; render(); }
  function confirm() {
    if (state.confirmed || !state.name.trim() || !state.checked) return false;
    state.name = state.name.trim();
    state.confirmed = true;
    render();
    return true;
  }
  function reset() {
    state.confirmed = false; state.name = ''; state.checked = false; state.paymentStatus = '未入金';
    if (dialog.open) dialog.close();
    render();
  }
  function setState(value) {
    if (typeof value === 'string') value = value === 'confirmed' ? { confirmed: true, name: customer.name, checked: true } : { confirmed: false, name: '', checked: false };
    if (Object.prototype.hasOwnProperty.call(value, 'name')) state.name = String(value.name);
    if (Object.prototype.hasOwnProperty.call(value, 'checked')) state.checked = Boolean(value.checked);
    if (Object.prototype.hasOwnProperty.call(value, 'confirmed')) state.confirmed = Boolean(value.confirmed) && Boolean(state.name.trim()) && state.checked;
    render();
    return { ...state };
  }
  function fitInvoice() {
    const holder = $('shared-invoice');
    const paper = holder.querySelector('.flow-paper');
    if (!dialog.open || !paper) return;
    const paperWidth = paper.offsetWidth;
    const paperHeight = paper.offsetHeight;
    if (!paperWidth || !paperHeight) return;
    const availableWidth = dialog.clientWidth - 32;
    const availableHeight = Math.floor(window.innerHeight * 0.9) - dialog.querySelector('.dialog-header').offsetHeight - 34;
    const scale = Math.min(1, availableWidth / paperWidth, availableHeight / paperHeight);
    holder.style.setProperty('--invoice-scale', String(scale));
    holder.style.width = `${paperWidth * scale}px`;
    holder.style.height = `${paperHeight * scale}px`;
  }
  function openInvoice() { render(); if (!dialog.open) dialog.showModal(); fitInvoice(); }
  nameInput.addEventListener('input', readForm);
  checkInput.addEventListener('change', readForm);
  form.addEventListener('submit', event => { event.preventDefault(); readForm(); confirm(); });
  $('invoice-before').addEventListener('click', openInvoice);
  $('invoice-after').addEventListener('click', openInvoice);
  $('close-invoice').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  $('payment-button').addEventListener('click', () => { window.alert('この画面は確認用です。実際の決済は行われません。入金状況は「未入金」のままです。'); });
  window.addEventListener('resize', fitInvoice);
  window.customerRough = { get state() { return { ...state }; }, setState, reset, confirm, openInvoice, fitInvoice, closeInvoice: () => dialog.close() };
  const params = new URLSearchParams(location.search);
  if (params.get('state') === 'confirmed') setState('confirmed');
  else if (params.get('state') === 'filled') setState({ name: customer.name, checked: true });
  else render();
  if (params.get('invoice') === 'open') openInvoice();
})();
