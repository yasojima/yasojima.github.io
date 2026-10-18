(function (root, createDelivery) {
  if (typeof module === 'object' && module.exports) {
    module.exports = createDelivery;
    return;
  }
  root.CCHEstimateDelivery = createDelivery(root.CCHEstimateMailConfig, root);
})(typeof globalThis === 'object' ? globalThis : this, function (settings, runtime) {
  'use strict';
  const environment = runtime || globalThis;
  function config(value) {
    if (!value || typeof value.endpoint !== 'string' || typeof value.turnstileSiteKey !== 'string' ||
        !value.endpoint || !/^[A-Za-z0-9_-]{10,100}$/.test(value.turnstileSiteKey)) return null;
    try {
      const url = new URL(value.endpoint);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
      return {endpoint: url.href, turnstileSiteKey: value.turnstileSiteKey};
    } catch { return null; }
  }
  const active = config(settings);
  const configured = Boolean(settings && (settings.endpoint || settings.turnstileSiteKey));
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function validResponse(value, requestId) {
    return value && value.ok === true && value.requestId === requestId && value.mailStatus === 'accepted' &&
      typeof value.acceptedAt === 'string' && Number.isFinite(Date.parse(value.acceptedAt));
  }
  async function submit(payload) {
    if (!active || !payload || payload.version !== 1 || !uuid(payload.requestId) ||
        typeof payload.turnstileToken !== 'string' || !payload.turnstileToken) throw new Error('送信設定または認証をご確認ください。');
    const controller = new environment.AbortController();
    const timer = environment.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await environment.fetch(active.endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal: controller.signal, body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !validResponse(body, payload.requestId)) {
        const error = new Error(body && typeof body.message === 'string' ? body.message :
          '送信結果を確認できませんでした。内容を変更せず、認証をやり直して再試行してください。');
        error.code = typeof body?.code === 'string' ? body.code : 'unconfirmed';
        throw error;
      }
      return body;
    } catch (error) {
      if (error && typeof error.code === 'string') throw error;
      throw new Error('送信結果を確認できませんでした。内容は保持しています。認証をやり直し、同じ内容で再試行してください。');
    } finally { environment.clearTimeout(timer); }
  }

  let widget = null, token = '', ready = null;
  function challenge(mount, onChange) {
    if (!active || !mount) return Promise.resolve(false);
    token = '';
    if (!ready) ready = new Promise((resolve, reject) => {
      if (environment.turnstile) { resolve(); return; }
      const script = environment.document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { ready = null; reject(new Error('認証を読み込めませんでした。ページを再読み込みしてください。')); };
      environment.document.head.append(script);
    });
    return ready.then(() => {
      if (widget !== null) environment.turnstile.remove(widget);
      widget = environment.turnstile.render(mount, {
        sitekey: active.turnstileSiteKey, action: 'estimate', language: 'ja', size: environment.innerWidth < 400 ? 'compact' : 'normal',
        callback: value => { token = value; onChange('ready'); },
        'expired-callback': () => { token = ''; onChange('expired'); },
        'error-callback': () => { token = ''; onChange('error'); },
      });
      return true;
    });
  }
  function reset() {
    token = '';
    if (widget !== null && environment.turnstile) {
      try { environment.turnstile.reset(widget); } catch { widget = null; }
    }
  }
  return Object.freeze({enabled: Boolean(active), configured, config, uuid, validResponse, submit, challenge, reset, getToken: () => token});
});
