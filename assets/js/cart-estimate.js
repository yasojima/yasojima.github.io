(() => {
  'use strict';
  const fieldNames = ['last-name', 'first-name', 'last-name_kana', 'first-name_kana', 'email',
    'tel_01', 'tel_02', 'tel_03', 'postal-code_01', 'postal-code_02', 'address_01', 'address_02',
    'address_03', 'address_04', 'separate-address', 'service_postal-code_01', 'service_postal-code_02',
    'service_address_01', 'service_address_02', 'service_address_03', 'service_address_04', 'privacy'];

  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

  function normalizeDraft(value) {
    if (!record(value) || value.version !== 1 || !record(value.fields)) return null;
    const fields = {}, display = {};
    for (const name of fieldNames) {
      if (!Object.hasOwn(value.fields, name)) continue;
      const text = value.fields[name];
      if (typeof text !== 'string' || text.length > 120) return null;
      if (['privacy', 'separate-address'].includes(name) && text !== 'on') return null;
      fields[name] = text;
    }
    if (value.display !== undefined) {
      if (!record(value.display)) return null;
      for (const name of ['address_01', 'service_address_01']) {
        if (!Object.hasOwn(value.display, name)) continue;
        const text = value.display[name];
        if (typeof text !== 'string' || text.length > 120) return null;
        display[name] = text;
      }
    }
    return {version: 1, fields, display};
  }

  function normalizeReceipt(value) {
    const draft = normalizeDraft(value);
    if (!draft || !validDraft(draft) || typeof value.savedAt !== 'string' || value.savedAt.length > 40 || !Number.isFinite(Date.parse(value.savedAt))) return null;
    const result = value.summary;
    if (!record(result) || !Array.isArray(result.details) || !result.details.length || result.details.length > 1000 ||
        !Array.isArray(value.lines) || value.lines.length !== result.details.length || typeof result.approximate !== 'boolean') return null;
    for (const name of ['total', 'count', 'tax', 'subtotal', 'discount', 'quoteCount']) {
      if (!Number.isSafeInteger(result[name]) || result[name] < 0) return null;
    }
    const details = [], lines = [];
    for (let i = 0; i < result.details.length; i++) {
      const line = result.details[i], savedLine = value.lines[i];
      if (!record(line) || !record(savedLine) || typeof line.key !== 'string' || !line.key || line.key.length > 200 ||
          typeof line.name !== 'string' || !line.name.trim() || line.name.length > 1000 ||
          !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 9999 ||
          !(line.amount === null || Number.isSafeInteger(line.amount) && line.amount >= 0) ||
          savedLine.key !== line.key || savedLine.quantity !== line.quantity) return null;
      details.push({key: line.key, name: line.name, quantity: line.quantity, amount: line.amount});
      lines.push({key: line.key, quantity: line.quantity});
    }
    if (details.reduce((sum, line) => sum + (line.amount || 0), 0) !== result.total ||
        details.reduce((sum, line) => sum + line.quantity, 0) !== result.count ||
        details.filter(line => line.amount === null).reduce((sum, line) => sum + line.quantity, 0) !== result.quoteCount ||
        result.subtotal + result.tax !== result.total) return null;
    return {...draft, savedAt: value.savedAt, lines, summary: {details, total: result.total, count: result.count,
      tax: result.tax, subtotal: result.subtotal, discount: result.discount, approximate: result.approximate, quoteCount: result.quoteCount}};
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {normalizeDraft, normalizeReceipt};
    return;
  }

  const cart = window.CCHCart;
  const storage = window.CCHCartStorage;
  const form = document.getElementById('cch-estimate-form');
  const review = document.querySelector('[data-estimate-confirm]');
  const complete = document.querySelector('[data-estimate-complete]');
  const key = 'cch-estimate-draft-v1';
  const receiptKey = 'cch-estimate-receipt-v1';
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => value.toLocaleString('ja-JP') + '円';
  let saving = false;

  function readSaved(name) {
    if (!storage) throw new Error('このブラウザでは保存機能を利用できません。');
    const value = storage.getItem(name);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return name === receiptKey ? normalizeReceipt(parsed) : normalizeDraft(parsed);
    } catch { return null; }
  }

  function summaryMarkup(result) {
    return `<h2 class="c-bullet-heading">ご希望のサービス</h2><ul class="cch-estimate-items">${result.details.map(line => `<li><span>${escape(line.name || line.item.name)} × ${line.quantity}</span><strong>${line.amount === null ? '別途見積り' : money(line.amount)}</strong></li>`).join('')}</ul>
      <p class="cch-estimate-total">合計金額（税込） <strong>${money(result.total)}${result.approximate ? '〜' : ''}</strong></p>${result.quoteCount ? '<p>別途見積りの商品は合計に含まれていません。</p>' : ''}`;
  }

  function detailsMarkup(draft) {
    const f = draft.fields;
    const address = prefix => `〒${f[prefix+'postal-code_01'] || ''}-${f[prefix+'postal-code_02'] || ''} ${draft.display?.[prefix+'address_01'] || ''} ${f[prefix+'address_02'] || ''} ${f[prefix+'address_03'] || ''} ${f[prefix+'address_04'] || ''}`;
    const details = [
      ['お名前', `${f['last-name'] || ''} ${f['first-name'] || ''}`],
      ['フリガナ', `${f['last-name_kana'] || ''} ${f['first-name_kana'] || ''}`],
      ['Eメールアドレス', f.email || ''],
      ['電話番号', [f.tel_01,f.tel_02,f.tel_03].join('-')],
      ['ご住所', address('')],
      ['サービスご提供先', f['separate-address'] === 'on' ? address('service_') : '上記のご住所と同じ'],
    ];
    return `<h2 class="c-bullet-heading">お客様情報</h2><dl class="cch-estimate-review">${details.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
  }

  function validDraft(draft) {
    if (draft?.version !== 1 || !draft.fields || draft.fields.privacy !== 'on') return false;
    const f = draft.fields;
    const required = ['last-name','first-name','last-name_kana','first-name_kana','email','tel_01','tel_02','tel_03',
      'postal-code_01','postal-code_02','address_01','address_02','address_03'];
    if (f['separate-address'] === 'on') required.push('service_postal-code_01','service_postal-code_02','service_address_01','service_address_02','service_address_03');
    return required.every(name => typeof f[name] === 'string' && f[name].trim() && f[name].length <= 120);
  }

  function guard() {
    if (cart?.getSummary().count) return true;
    document.querySelector('.cch-estimate').innerHTML = '<h1 class="c-page-heading">予約内容の確認</h1><div class="cch-cart-content"><p class="cch-cart-empty">カートが空です。ご希望のサービスをお選びください。</p><a class="c-button" href="/quick_cart/">サービスを選ぶ</a></div>';
    return false;
  }

  function showError(mount, message) {
    const node = mount.querySelector('[data-estimate-error]') || mount.querySelector('.c-form-announce__text');
    if (node) {
      node.textContent = message;
      node.hidden = false;
      node.setAttribute('role', 'alert');
      node.focus({preventScroll: true});
    }
  }

  function toggleAddress() {
    const enabled = form.elements['separate-address'].checked;
    const section = form.querySelector('.service-address__contents');
    section.hidden = !enabled;
    section.style.display = enabled ? 'block' : 'none';
    section.querySelectorAll('input,select').forEach(input => { input.disabled = !enabled; });
  }

  if (form && guard()) {
    let draft;
    try { draft = readSaved(key); }
    catch { showError(form, '入力内容を保存できません。ブラウザの保存設定をご確認ください。'); }
    for (const input of form.querySelectorAll('input[name],select[name]')) {
      if (draft?.fields && Object.hasOwn(draft.fields, input.name)) {
        if (input.type === 'checkbox') input.checked = draft.fields[input.name] === 'on';
        else input.value = draft.fields[input.name];
      }
    }
    toggleAddress();
    form.elements['separate-address'].addEventListener('change', toggleAddress);
    form.querySelector('[type="submit"]').disabled = !storage;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!guard() || !form.reportValidity()) return;
      const submitted = Object.fromEntries(new FormData(form));
      const fields = Object.fromEntries(fieldNames.filter(name => Object.hasOwn(submitted, name)).map(name => [name, submitted[name]]));
      const display = {};
      form.querySelectorAll('select[name]:enabled').forEach(select => { display[select.name] = select.selectedOptions[0].textContent.trim(); });
      try {
        const value = JSON.stringify({version:1, fields, display});
        storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error('保存内容を確認できません。');
      } catch {
        showError(form, '入力内容を保存できませんでした。ブラウザの保存設定をご確認ください。');
        return;
      }
      location.assign('/cart/estimate/confirm/');
    });
  }

  function saveReservation() {
    if (saving) return;
    const button = review.querySelector('[data-estimate-save]');
    const status = review.querySelector('[data-estimate-save-status]');
    saving = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = 'この端末に保存しています。';
    try {
      const draft = readSaved(key);
      if (!validDraft(draft)) throw new Error('お客様情報とプライバシーポリシーへの同意をもう一度ご確認ください。');
      const result = cart.getSummary();
      if (!result.count) throw new Error('カートが空です。ご希望のサービスをお選びください。');
      const receipt = {
        version: 1,
        savedAt: new Date().toISOString(),
        fields: draft.fields,
        display: draft.display,
        lines: result.details.map(line => ({key: line.key, quantity: line.quantity})),
        summary: {
          details: result.details.map(line => ({key: line.key, name: line.item.name, quantity: line.quantity, amount: line.amount})),
          total: result.total, count: result.count, tax: result.tax, subtotal: result.subtotal,
          discount: result.discount, approximate: Boolean(result.approximate), quoteCount: result.quoteCount,
        },
      };
      const value = JSON.stringify(receipt);
      try {
        storage.setItem(receiptKey, value);
        if (storage.getItem(receiptKey) !== value) throw new Error('readback');
      } catch { throw new Error('予約内容を保存できませんでした。ブラウザの保存設定をご確認ください。'); }
      location.assign('/cart/estimate/complete/');
    } catch (error) {
      saving = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      status.textContent = '';
      showError(review, error.message || 'この端末に保存できませんでした。ブラウザの保存設定をご確認ください。');
    }
  }

  function renderReview() {
    if (!review || saving || !guard()) return;
    let draft;
    try { draft = readSaved(key); }
    catch {
      review.innerHTML = '<p role="alert">保存した入力内容を読み込めません。ブラウザの保存設定をご確認ください。</p><a class="c-button" href="/cart/estimate/">情報入力に戻る</a>';
      return;
    }
    if (!validDraft(draft)) {
      review.innerHTML = '<p>お客様情報をご入力ください。</p><a class="c-button" href="/cart/estimate/">情報入力に進む</a>';
      return;
    }
    review.innerHTML = `${summaryMarkup(cart.getSummary())}${detailsMarkup(draft)}
      <p class="cch-estimate-local-notice">この内容はこの端末のブラウザに保存されます。店舗への送信・予約の確定は行われません。</p>
      <p class="cch-estimate-error" data-estimate-error role="alert" tabindex="-1" hidden></p><p data-estimate-save-status role="status" aria-live="polite"></p>
      <div class="action-buttons"><button class="c-button c-button--fill-red c-button--large" type="button" data-estimate-save>予約内容をこの端末に保存する</button><a class="c-button c-button--large" href="/cart/estimate/">入力内容を修正する</a><a class="c-button" href="/cart/">カートを修正する</a></div>`;
    review.querySelector('[data-estimate-save]').addEventListener('click', saveReservation);
  }

  function renderComplete() {
    if (!complete) return;
    let receipt;
    try { receipt = readSaved(receiptKey); }
    catch {
      complete.innerHTML = '<p role="alert">保存した内容を読み込めません。ブラウザの保存設定をご確認ください。</p><a class="c-button" href="/cart/">カートへ戻る</a>';
      return;
    }
    if (!receipt) {
      complete.innerHTML = '<p>この端末に保存された予約内容はありません。</p><p>カートの内容を確認して、保存へお進みください。</p><a class="c-button" href="/cart/">カートを確認する</a>';
      return;
    }
    const result = receipt.summary;
    complete.innerHTML = `<div class="message-box"><h2 class="message-box__heading">予約内容をこの端末に保存しました</h2><p class="message-box__text">この内容は、この端末のブラウザに保存されています。店舗への送信や予約の確定は行われていません。</p><p class="message-box__text">保存日時：${escape(new Date(receipt.savedAt).toLocaleString('ja-JP'))}</p></div>
      ${summaryMarkup(result)}${detailsMarkup(receipt)}<p class="cch-estimate-local-notice">このサイトを最後に利用してから24時間経過後、次にサイトを利用した際に、カート・入力内容・保存した予約内容は削除されます。</p>
      <div class="action-buttons"><a class="c-button c-button--large" href="/cart/estimate/confirm/">予約内容を確認・修正する</a><button class="c-button c-button--large" type="button" data-estimate-print>印刷する</button><a class="c-button" href="/">ホームへ戻る</a></div>`;
    complete.querySelector('[data-estimate-print]').addEventListener('click', () => {
      try {
        if (readSaved(receiptKey)) window.print();
        else renderComplete();
      } catch { renderComplete(); }
    });
  }

  renderReview();
  renderComplete();
  window.addEventListener('cch:cart-updated', renderReview);
  window.addEventListener('pageshow', () => {
    saving = false;
    if (form) guard();
    renderReview();
    renderComplete();
  });
})();
