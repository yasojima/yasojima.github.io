/* No network-capable integrations in the reference frame. */
(() => {
  'use strict';
  const local = new URL('./', document.currentScript.src);
  const savedAdapter = document.currentScript.hasAttribute('data-saved-api');
  const nativeOpen = window.open.bind(window);
  const blocked = () => { throw new DOMException('External connections are disabled in this demo.', 'SecurityError'); };
  const replace = (object, name, value) => {
    try { Object.defineProperty(object, name, { value, configurable: false, writable: false }); } catch {}
  };
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'Worker', 'SharedWorker']) {
    replace(window, name, function DisabledDemoConnection() { blocked(); });
  }
  replace(navigator, 'sendBeacon', () => false);
  replace(navigator, 'serviceWorker', undefined);
  replace(navigator, 'geolocation', undefined);
  replace(HTMLFormElement.prototype, 'submit', blocked);
  // The source-page adapter replaces fetch with its saved-data lookup.
  // Workspace pages keep this rejecting implementation.
  const rejectFetch = () => Promise.reject(new DOMException('Network requests are disabled in this demo.', 'SecurityError'));
  if (savedAdapter) window.fetch = rejectFetch;
  else replace(window, 'fetch', rejectFetch);
  const localOpen = (value, target, features) => {
    let url; try { url = new URL(value, local); } catch { return null; }
    if (url.origin !== local.origin || url.pathname !== local.pathname) return null;
    return nativeOpen(url.href, '_blank', features);
  };
  if (savedAdapter) window.open = localOpen;
  else replace(window, 'open', localOpen);
  function classify(value) {
    const href = String(value || '');
    let decoded = href;
    try { for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded); } catch { return null; }
    if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith('//')) return null;
    if (!href || href.startsWith('#')) return {kind:'fragment', href};
    if (/^javascript:(?:void\(0\)|;);?$/i.test(href)) return {kind:'inert', href};
    let url; try { url = new URL(href, local); } catch { return null; }
    if (url.origin === 'https://reference.invalid' || (href.startsWith('/') && !href.startsWith('//'))) {
      const virtual = new URL(href, 'https://reference.invalid');
      if (virtual.origin !== 'https://reference.invalid') return null;
      return {kind:'virtual', href:virtual.pathname + virtual.search + virtual.hash};
    }
    if (url.origin === local.origin && url.pathname === local.pathname) return {kind:'local', href:url.href};
    // Document Blob URLs are created and managed by the parent preview only.
    return null;
  }
  function cleanLink(anchor) {
    anchor.removeAttribute('ping');
    const result = classify(anchor.getAttribute('href'));
    if (!result) {
      anchor.setAttribute('href', '#'); anchor.removeAttribute('target');
    } else if (anchor.getAttribute('href') !== result.href) {
      anchor.setAttribute('href', result.href);
    }
  }
  const clean = node => {
    if (node.nodeType !== 1) return;
    if (node.matches('a[href],area[href]')) cleanLink(node);
    node.querySelectorAll('a[href],area[href]').forEach(cleanLink);
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') cleanLink(record.target);
      else record.addedNodes.forEach(clean);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'ping'] });
  clean(document.documentElement);
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href],area[href]');
    if (!anchor) return;
    anchor.removeAttribute('ping');
    const result = classify(anchor.getAttribute('href'));
    if (!result) { event.preventDefault(); event.stopImmediatePropagation(); cleanLink(anchor); }
    // Virtual routes must be handled by the saved-page adapter, never the browser.
    else if (result.kind === 'virtual') event.preventDefault();
  }, true);
  document.addEventListener('auxclick', event => {
    if (event.target.closest?.('a[href],area[href]')) event.preventDefault();
  }, true);
  document.addEventListener('submit', event => event.preventDefault(), true);
})();
