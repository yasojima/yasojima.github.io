(() => {
  'use strict';

  const message = 'デモ表示のためリンク未設定です。';
  const blockedPath = /^\/(?:contact(?:\/|$)|business\/contact(?:\/|$)|campaign(?:\/|$)|reservation(?:\/|$)|reserve(?:\/|$)|booking(?:\/|$)|carts\/add_product_from_campaign(?:\/|$))/i;
  const blockedHost = /(?:^|\.)(?:forms?|reg\d+)(?:\.|$)/i;
  const blockedExternalPath = /(?:^|\/)(?:contacts?|reservations?|reserve|bookings?|inquir(?:y|ies)|enquir(?:y|ies))(?:[\/_.-]|$)/i;
  const submitLabel = /(?:予約|送信|申し込|申込|注文|購入|資料請求|今すぐ電話)/;

  function isEstimatePreview(form) {
    if (!form || form.id !== 'cch-estimate-form') return false;
    const target = new URL(form.action, location.href);
    return form.method === 'get' && target.origin === location.origin && target.pathname === '/cart/estimate/confirm/';
  }

  function show(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert(message);
  }

  document.addEventListener('click', (event) => {
    const control = event.target.closest('a, button, input[type="submit"], [data-demo-dialog]');
    if (!control) return;
    if (control.hasAttribute('data-demo-dialog')) return show(event);
    if (control.matches('button, input[type="submit"]')) {
      if (location.pathname.replace(/index\.html$/, '') === '/cart/estimate/confirm/' &&
          control.matches('button[type="button"][data-estimate-save]') && control.closest('[data-estimate-confirm]')) return;
      if (isEstimatePreview(control.closest('form'))) return;
      if (control.closest('form') || submitLabel.test(control.textContent || control.value || '')) show(event);
      return;
    }
    const href = control.getAttribute('href') || '';
    if (/^(?:tel:|mailto:)/i.test(href)) return show(event);
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (blockedHost.test(url.hostname) ||
        (url.origin === location.origin && blockedPath.test(url.pathname)) ||
        (url.origin !== location.origin && blockedExternalPath.test(url.pathname))) show(event);
  }, true);

  document.addEventListener('submit', (event) => {
    if (isEstimatePreview(event.target)) event.preventDefault();
    else show(event);
  }, true);
})();
