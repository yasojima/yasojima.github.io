(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.CCHEstimateMailConfig, root).init();
})(typeof globalThis === 'object' ? globalThis : this, function (settings, env) {
  'use strict';
  const key = 'cch-contact-submission-v1';
  const lifetime = 23 * 60 * 60 * 1000;
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const limits = {name: 100, phone: 30, email: 254, region: 120, message: 2000};
  let endpoint = null;
  try {
    const url = new URL(settings.endpoint);
    if (url.protocol === 'https:' && !url.username && !url.password && /^[A-Za-z0-9_-]{10,100}$/.test(settings.turnstileSiteKey)) {
      url.pathname = '/contact'; url.search = ''; url.hash = ''; endpoint = url.href;
    }
  } catch { /* An unavailable configuration leaves sending disabled. */ }
  function validFields(fields) {
    return fields && fields.privacy === 'on' && Object.entries(limits).every(([name, max]) =>
      typeof fields[name] === 'string' && fields[name].length <= max && (name === 'phone' || fields[name].trim().length > 0)) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email);
  }
  function accepted(value, requestId) {
    return value && value.ok === true && value.requestId === requestId && value.mailStatus === 'accepted' &&
      typeof value.acceptedAt === 'string' && Number.isFinite(Date.parse(value.acceptedAt));
  }
  function readState() {
    const raw = env.sessionStorage.getItem(key);
    if (!raw) return null;
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('保存された受付状況を確認できません。別のタブでフォームを開いてください。'); }
    if (!value || value.version !== 1 || !uuid(value.requestId) || !Number.isFinite(value.createdAt) ||
        value.createdAt > Date.now() + 60000 || Date.now() - value.createdAt > lifetime ||
        !['pending', 'accepted'].includes(value.state) ||
        (value.state === 'pending' && !validFields(value.fields)) ||
        (value.state === 'accepted' && (typeof value.acceptedAt !== 'string' || !Number.isFinite(Date.parse(value.acceptedAt))))) {
      throw new Error('保存された受付状況の確認期限が過ぎたか、内容を確認できません。送信済みの場合は自動返信メールをご確認ください。');
    }
    return value;
  }
  function writeState(value) { env.sessionStorage.setItem(key, JSON.stringify(value)); }
  async function send(payload) {
    if (!endpoint || !uuid(payload?.requestId) || !validFields(payload.fields) || !payload.turnstileToken) throw new Error('入力内容と送信の準備をご確認ください。');
    const controller = new env.AbortController();
    const timer = env.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await env.fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal, body: JSON.stringify(payload)});
      const body = await response.json().catch(() => null);
      if (!response.ok || !accepted(body, payload.requestId)) {
        const error = new Error(typeof body?.message === 'string' ? body.message : '送信結果を確認できませんでした。同じ内容のまま、もう一度送信してください。');
        error.code = body?.code || 'unconfirmed'; throw error;
      }
      return body;
    } catch (error) {
      if (error?.code) throw error;
      throw new Error('送信結果を確認できませんでした。入力内容は保持しています。同じ内容のまま、もう一度送信してください。');
    } finally { env.clearTimeout(timer); }
  }
  function init() {
    const document = env.document;
    const complete = document.querySelector('[data-contact-complete]');
    if (complete) {
      let record = null;
      try { record = readState(); } catch { /* A missing or expired receipt never displays success. */ }
      const title = complete.querySelector('[data-contact-complete-title]');
      const message = complete.querySelector('[data-contact-complete-message]');
      if (record?.state !== 'accepted') {
        title.textContent = '送信完了情報を確認できませんでした。';
        message.textContent = '送信済みの場合は自動返信メールをご確認ください。未送信の場合は、お問い合わせフォームへお戻りください。';
        return;
      }
      let notice;
      try { notice = JSON.parse(document.querySelector('#cch-contact-content').textContent); } catch { return; }
      title.textContent = '送信が完了しました。';
      message.textContent = notice.message;
      for (const [name, text] of [['hours', '受付時間 ' + notice.hours], ['days', notice.days],
        ['reply', 'ご入力いただいたメールアドレスへ、受付完了メールをお送りしました。']]) {
        const element = complete.querySelector('[data-contact-complete-' + name + ']');
        element.textContent = text; element.hidden = false;
      }
      const link = complete.querySelector('[data-contact-complete-link]');
      link.href = '/'; link.textContent = 'ホームへ戻る';
      title.focus(); return;
    }
    const form = document.querySelector('#cch-contact-form');
    if (!form) return;
    const button = form.querySelector('[data-contact-submit]');
    const status = form.querySelector('[data-contact-status]');
    const mount = form.querySelector('[data-contact-challenge]');
    let pending = null, busy = false, token = '', widget = null, blocked = false;
    function notify(text, error = false) {
      status.textContent = text; status.classList.toggle('cch-contact__status--error', error);
    }
    function lock(value) {
      for (const name of Object.keys(limits)) form.elements.namedItem(name).readOnly = value;
      form.elements.namedItem('privacy').disabled = value;
    }
    function ready() { button.disabled = blocked || busy || !token || !endpoint; }
    try {
      const record = readState();
      if (record?.state === 'pending') {
        pending = record;
        for (const [name, value] of Object.entries(record.fields)) {
          if (name === 'privacy') form.elements.namedItem(name).checked = value === 'on';
          else form.elements.namedItem(name).value = value;
        }
        lock(true);
        notify('前回の送信結果を確認できていません。内容を変えずに、もう一度送信してください。', true);
      }
      const probe = key + '-check'; env.sessionStorage.setItem(probe, '1'); env.sessionStorage.removeItem(probe);
    } catch (error) { blocked = true; notify(error.message || '受付状況を保存できません。ブラウザーの設定をご確認ください。', true); }
    function challenge() {
      if (!endpoint || blocked) return;
      if (!pending) notify('送信の準備をしています。');
      function render() {
        widget = env.turnstile.render(mount, {sitekey: settings.turnstileSiteKey, action: 'contact', language: 'ja',
          size: 'normal', appearance: 'interaction-only',
          callback: value => { token = value; if (!busy && !pending) notify(''); ready(); },
          'expired-callback': () => { token = ''; ready(); },
          'error-callback': () => { token = ''; notify('送信の準備を確認できません。ページを再読み込みしてください。', true); ready(); }});
      }
      if (env.turnstile) render();
      else {
        const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true; script.onload = render;
        script.onerror = () => { notify('送信の準備を読み込めませんでした。ページを再読み込みしてください。', true); };
        document.head.append(script);
      }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || blocked || !endpoint || !token) return;
      if (!pending && !form.reportValidity()) return;
      busy = true; ready();
      try {
        if (!pending) {
          const fields = Object.fromEntries(Object.keys(limits).map(name => [name, form.elements.namedItem(name).value.trim()]));
          fields.privacy = form.elements.namedItem('privacy').checked ? 'on' : '';
          if (!validFields(fields)) throw new Error('入力内容をご確認ください。');
          const candidate = {version: 1, state: 'pending', requestId: env.crypto.randomUUID(), createdAt: Date.now(), fields};
          writeState(candidate); pending = candidate; lock(true);
        }
        notify('送信しています。そのままお待ちください。');
        const result = await send({version: 1, requestId: pending.requestId, fields: pending.fields, turnstileToken: token});
        writeState({version: 1, state: 'accepted', requestId: pending.requestId, createdAt: pending.createdAt, acceptedAt: result.acceptedAt});
        form.reset(); env.location.assign('/contact/complete/');
      } catch (error) {
        if (['invalid_request'].includes(error.code)) {
          env.sessionStorage.removeItem(key); pending = null; lock(false);
        }
        notify(error.message || '送信結果を確認できませんでした。もう一度お試しください。', true);
        token = '';
        if (widget !== null && env.turnstile) env.turnstile.reset(widget);
      } finally { busy = false; ready(); }
    });
    env.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      try { if (readState()?.state === 'accepted') { form.reset(); env.location.replace('/contact/complete/'); } } catch { blocked = true; ready(); }
    });
    if (!endpoint) notify('ただいま送信をご利用いただけません。時間をおいてもう一度お試しください。', true);
    ready(); challenge();
  }
  return Object.freeze({init, accepted, validFields, readState, writeState, send, enabled: Boolean(endpoint)});
});
