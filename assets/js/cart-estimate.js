(() => {
  'use strict';
  const fieldNames = ['last-name', 'first-name', 'last-name_kana', 'first-name_kana', 'email',
    'tel_01', 'tel_02', 'tel_03', 'postal-code_01', 'postal-code_02', 'address_01', 'address_02',
    'address_03', 'address_04', 'separate-address', 'service_postal-code_01', 'service_postal-code_02',
    'service_address_01', 'service_address_02', 'service_address_03', 'service_address_04', 'preferred-date', 'preferred-time', 'notes', 'privacy', 'mail-consent'];

  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

  function normalizeDraft(value) {
    if (!record(value) || value.version !== 1 || !record(value.fields)) return null;
    const fields = {}, display = {};
    for (const name of fieldNames) {
      if (!Object.hasOwn(value.fields, name)) continue;
      const text = value.fields[name];
      if (typeof text !== 'string' || text.length > (name === 'notes' ? 2000 : 120)) return null;
      if (name === 'preferred-date' && text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text + 'T00:00:00Z')) || new Date(text + 'T00:00:00Z').toISOString().slice(0, 10) !== text)) return null;
      if (name === 'preferred-time' && !['', '指定なし', '午前', '午後', '夕方以降'].includes(text)) return null;
      if (['privacy', 'separate-address', 'mail-consent'].includes(name) && text !== 'on') return null;
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
    const delivery = normalizeDelivery(value.delivery);
    if (value.delivery !== undefined && !delivery) return null;
    return {...draft, savedAt: value.savedAt, ...(delivery ? {delivery} : {}), lines, summary: {details, total: result.total, count: result.count,
      tax: result.tax, subtotal: result.subtotal, discount: result.discount, approximate: result.approximate, quoteCount: result.quoteCount}};
  }

  function normalizeDelivery(value) {
    if (!record(value) || typeof value.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId) ||
        !['pending', 'accepted'].includes(value.state) || typeof value.createdAt !== 'string' || value.createdAt.length > 40 || !Number.isFinite(Date.parse(value.createdAt))) return null;
    if (value.state === 'accepted' && (typeof value.acceptedAt !== 'string' || value.acceptedAt.length > 40 || !Number.isFinite(Date.parse(value.acceptedAt)))) return null;
    return {requestId: value.requestId, state: value.state, createdAt: value.createdAt,
      ...(value.state === 'accepted' ? {acceptedAt: value.acceptedAt} : {})};
  }

  function sameRequest(receipt, draft, lines) {
    if (!receipt?.delivery) return false;
    const fields = value => Object.fromEntries(fieldNames.filter(name => name !== 'mail-consent' && value[name]).sort().map(name => [name, value[name]]));
    const orderedLines = value => value.map(line => ({key: line.key, quantity: line.quantity})).sort((a, b) => a.key.localeCompare(b.key));
    return JSON.stringify(fields(receipt.fields)) === JSON.stringify(fields(draft.fields)) &&
      JSON.stringify(orderedLines(receipt.lines)) === JSON.stringify(orderedLines(lines));
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {normalizeDraft, normalizeReceipt, normalizeDelivery, sameRequest};
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
  const delivery = window.CCHEstimateDelivery;
  const connected = Boolean(delivery?.enabled);
  const deliveryUnavailable = !connected && Boolean(delivery?.configured || window.CCHEstimateMailConfig?.endpoint || window.CCHEstimateMailConfig?.turnstileSiteKey);
  let saving = false;
  let acceptedReceipt = null;

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
      ['ご希望日', f['preferred-date'] || '指定なし'],
      ['ご希望時間帯', f['preferred-time'] || '指定なし'],
      ['備考', f.notes || 'なし'],
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
    const main = document.querySelector('.cch-estimate');
    const progress = main.querySelector('[data-estimate-progress]');
    main.innerHTML = '<h1 class="c-page-heading">予約内容の確認</h1><div class="cch-cart-content"><p class="cch-cart-empty">カートが空です。ご希望のサービスをお選びください。</p><a class="c-button" href="/quick_cart/">サービスを選ぶ</a></div>';
    main.prepend(progress);
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
    for (const input of form.querySelectorAll('input[name],select[name],textarea[name]')) {
      if (draft?.fields && Object.hasOwn(draft.fields, input.name)) {
        if (input.type === 'checkbox') input.checked = draft.fields[input.name] === 'on';
        else input.value = draft.fields[input.name];
      }
    }
    const preferredDate = form.elements['preferred-date'];
    if (preferredDate) {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      preferredDate.min = today.toISOString().slice(0, 10);
    }
    toggleAddress();
    form.elements['separate-address'].addEventListener('change', toggleAddress);
    form.querySelector('[type="submit"]').disabled = !storage || deliveryUnavailable;
    if (deliveryUnavailable) showError(form, '現在、見積もり依頼の送信設定を確認中です。しばらくしてから再度ご利用ください。');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (deliveryUnavailable || !guard() || !form.reportValidity()) return;
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

  function saveReceipt(receipt) {
    const value = JSON.stringify(receipt);
    storage.setItem(receiptKey, value);
    if (storage.getItem(receiptKey) !== value) throw new Error('保存内容を確認できません。');
  }

  function makeReceipt(draft, result) {
    return {
      version: 1, savedAt: new Date().toISOString(), fields: {...draft.fields}, display: draft.display,
      lines: result.details.map(line => ({key: line.key, quantity: line.quantity})),
      summary: {
        details: result.details.map(line => ({key: line.key, name: line.item.name, quantity: line.quantity, amount: line.amount})),
        total: result.total, count: result.count, tax: result.tax, subtotal: result.subtotal,
        discount: result.discount, approximate: Boolean(result.approximate), quoteCount: result.quoteCount,
      },
    };
  }

  async function saveReservation() {
    if (saving || acceptedReceipt || deliveryUnavailable) return;
    const button = review.querySelector('[data-estimate-save]');
    const status = review.querySelector('[data-estimate-save-status]');
    saving = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = connected ? '見積もり依頼を送信しています。画面を閉じずにお待ちください。' : 'この端末に保存しています。';
    try {
      const draft = readSaved(key);
      if (!validDraft(draft)) throw new Error('お客様情報とプライバシーポリシーへの同意をもう一度ご確認ください。');
      const result = cart.getSummary();
      if (!result.count) throw new Error('カートが空です。ご希望のサービスをお選びください。');
      const receipt = makeReceipt(draft, result);
      if (connected) {
        if (!review.querySelector('[data-estimate-mail-consent]')?.checked) throw new Error('見積もり依頼の送信内容を確認し、送信に同意してください。');
        const previous = readSaved(receiptKey);
        const matches = sameRequest(previous, draft, receipt.lines);
        if (matches && previous.delivery.state === 'accepted') {
          acceptedReceipt = previous;
          renderAccepted(review, previous);
          return;
        }
        if (matches && Date.now() - Date.parse(previous.delivery.createdAt) >= 23 * 60 * 60 * 1000) {
          throw new Error('前回の送信から23時間以上経過しています。重複する依頼を防ぐため、送信状況を店舗へご確認ください。');
        }
        const token = delivery.getToken();
        if (!token) throw new Error('送信前の認証を完了してください。期限切れの場合は認証をやり直してください。');
        receipt.fields['mail-consent'] = 'on';
        receipt.delivery = matches ? previous.delivery : {requestId: crypto.randomUUID(), state: 'pending', createdAt: new Date().toISOString()};
        try { saveReceipt(receipt); }
        catch { throw new Error('送信準備の内容を保存できませんでした。依頼は送信していません。ブラウザの保存設定をご確認ください。'); }
        const response = await delivery.submit({version: 1, requestId: receipt.delivery.requestId,
          fields: receipt.fields, lines: receipt.lines, turnstileToken: token});
        const serverLines = Array.isArray(response.summary?.details) ? response.summary.details.map(line => ({key: line?.key, quantity: line?.quantity})) : [];
        const serverReceipt = normalizeReceipt({...receipt, lines: serverLines, summary: response.summary});
        if (!serverReceipt || !sameRequest(serverReceipt, draft, receipt.lines)) throw new Error('送信受付の詳細を確認できませんでした。内容を変更せず、同じ内容で再試行してください。');
        receipt.summary = serverReceipt.summary;
        receipt.lines = serverReceipt.lines;
        receipt.delivery = {...receipt.delivery, state: 'accepted', acceptedAt: response.acceptedAt};
        acceptedReceipt = receipt;
        delivery.reset();
        try { saveReceipt(receipt); }
        catch {
          renderAccepted(review, receipt, true);
          return;
        }
      } else {
        try { saveReceipt(receipt); }
        catch { throw new Error('予約内容を保存できませんでした。ブラウザの保存設定をご確認ください。'); }
      }
      location.assign('/cart/estimate/complete/');
    } catch (error) {
      saving = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      status.textContent = '';
      if (connected) delivery.reset();
      showError(review, error?.message || 'この端末に保存できませんでした。ブラウザの保存設定をご確認ください。');
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
    const result = cart.getSummary();
    let previous;
    try { previous = readSaved(receiptKey); } catch { /* A failed read is reported again before any send. */ }
    if (connected && previous?.delivery?.state === 'accepted' && sameRequest(previous, draft, result.details)) {
      acceptedReceipt = previous;
      renderAccepted(review, previous);
      return;
    }
    if (deliveryUnavailable) {
      review.innerHTML = `${summaryMarkup(result)}${detailsMarkup(draft)}<p class="cch-estimate-error" role="alert">現在、見積もり依頼の送信設定を確認中です。依頼は送信されていません。しばらくしてから再度ご利用ください。</p><div class="action-buttons"><a class="c-button" href="/cart/estimate/">入力内容に戻る</a><a class="c-button" href="/cart/">カートへ戻る</a></div>`;
      return;
    }
    const pending = connected && previous?.delivery?.state === 'pending' && sameRequest(previous, draft, result.details);
    review.innerHTML = `${summaryMarkup(result)}${detailsMarkup(draft)}
      <p class="cch-estimate-local-notice">${connected ? '上記の内容を送信すると、お客様に受付内容の自動応答メールが届きます。この操作では訪問日時・最終料金は確定せず、担当者より改めてご連絡いたします。' : 'この内容はこの端末のブラウザに保存されます。店舗への送信・予約の確定は行われません。'}</p>
      ${connected ? '<div class="cch-estimate-mail-consent"><label class="c-checkbox"><input class="c-checkbox__input" type="checkbox" data-estimate-mail-consent><span class="c-checkbox__icon"></span><span class="c-checkbox__content">上記の内容を送信することに同意します。</span></label></div><div class="cch-estimate-challenge" data-estimate-challenge></div><p data-estimate-challenge-status role="status" aria-live="polite">送信前の認証を読み込んでいます。</p>' : ''}
      <p class="cch-estimate-error" data-estimate-error role="alert" tabindex="-1" hidden></p><p data-estimate-save-status role="status" aria-live="polite"></p>
      <div class="action-buttons"><button class="c-button c-button--fill-red c-button--large" type="button" data-estimate-save>${connected ? pending ? '送信結果を確認・再試行する' : 'この内容で見積もりを依頼する' : '予約内容をこの端末に保存する'}</button><a class="c-button c-button--large" href="/cart/estimate/">入力内容を修正する</a><a class="c-button" href="/cart/">カートを修正する</a></div>`;
    review.querySelector('[data-estimate-save]').addEventListener('click', saveReservation);
    if (connected) {
      const challengeStatus = review.querySelector('[data-estimate-challenge-status]');
      delivery.challenge(review.querySelector('[data-estimate-challenge]'), state => {
        challengeStatus.textContent = state === 'ready' ? '認証が完了しました。' : state === 'expired' ? '認証の有効期限が切れました。もう一度認証してください。' : '認証に失敗しました。認証をやり直すか、ページを再読み込みしてください。';
      }).catch(error => { challengeStatus.textContent = error.message; });
    }
  }

  function renderAccepted(mount, receipt, saveFailed = false) {
    mount.innerHTML = `<div class="message-box"><h2 class="message-box__heading">見積もり依頼を受け付けました</h2><p class="message-box__text">受付内容の自動返信メールと店舗への通知を、メール送信サービスで受け付けました。メールの到着まで少しお時間がかかる場合があります。</p><p class="message-box__text">訪問日時・最終料金は担当者からのご連絡で確定します。受信箱と迷惑メールフォルダをご確認ください。</p><p class="message-box__text">受付日時：${escape(new Date(receipt.delivery.acceptedAt).toLocaleString('ja-JP'))}</p><p class="message-box__text">受付番号：${escape(receipt.delivery.requestId)}</p></div>
      ${saveFailed ? '<p class="cch-estimate-error" role="alert">依頼は受け付けましたが、この端末に受付結果を保存できませんでした。この画面を控え、同じ依頼を新たに送信しないでください。</p>' : ''}
      ${summaryMarkup(receipt.summary)}${detailsMarkup(receipt)}<p class="cch-estimate-local-notice">この端末の表示用データは、最後のサイト利用から24時間経過後の次回利用時に削除されます。送信済みメールの内容は削除されません。</p>
      <div class="action-buttons"><button class="c-button c-button--large" type="button" data-estimate-print>印刷する</button><a class="c-button" href="/">ホームへ戻る</a></div>`;
    mount.querySelector('[data-estimate-print]').addEventListener('click', () => window.print());
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
    if (receipt.delivery?.state === 'accepted') { renderAccepted(complete, receipt); return; }
    if (receipt.delivery?.state === 'pending') {
      complete.innerHTML = '<p>送信結果の確認が完了していません。入力確認画面から同じ内容で再試行してください。</p><a class="c-button" href="/cart/estimate/confirm/">送信結果の確認に戻る</a>';
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

  if (deliveryUnavailable) document.querySelectorAll('.cch-estimate-notice').forEach(node => { node.textContent = '現在、見積もり依頼の送信設定を確認中です。依頼は送信されていません。'; });
  if (connected) {
    document.querySelectorAll('.cch-estimate-notice').forEach(node => { node.textContent = form ? 'こちらの入力フォームより無料見積もりを依頼できます。訪問日時・料金案内は折り返し担当者からご連絡いたします。' : review ? '無料見積もりを依頼できます。訪問日時・料金案内は折り返し担当者からご連絡いたします。' : '内容を確認して見積もりを依頼できます。訪問日時・最終料金は担当者からの連絡で確定します。'; });
    if (form) {
      for (const [name, length] of Object.entries({'last-name': 50, 'first-name': 50, 'last-name_kana': 80, 'first-name_kana': 80, tel_02: 4, tel_03: 4})) form.elements[name].maxLength = length;
      form.querySelector('[data-estimate-confirmation-mail]').textContent = '確認画面で送信に同意後、自動応答メールがお客様に届きます。';
      form.querySelector('[data-estimate-confirmation-contact]').textContent = '訪問日時・最終料金はこの操作では確定せず、担当者より改めてご連絡いたします。';
    }
    if (complete) document.querySelector('.c-page-heading').textContent = '見積もり依頼の受付内容';
  }
  renderReview();
  renderComplete();
  window.addEventListener('cch:cart-updated', renderReview);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    if (connected && acceptedReceipt) {
      if (review) renderAccepted(review, acceptedReceipt);
      renderComplete();
      return;
    }
    if (connected && saving) return;
    saving = false;
    if (form) guard();
    renderReview();
    renderComplete();
  });
})();
