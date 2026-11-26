/* No network-capable integrations in the reference frame. */
(() => {
  'use strict';
  const local = new URL('./', document.currentScript.src);
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
  window.fetch = () => Promise.reject(new DOMException('Network requests are disabled in this demo.', 'SecurityError'));
  window.open = (value, target, features) => {
    let url; try { url = new URL(value, local); } catch { return null; }
    if (url.origin !== local.origin || url.pathname !== local.pathname) return null;
    return nativeOpen(url.href, '_blank', features);
  };
  function cleanLink(anchor) {
    anchor.removeAttribute('ping');
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('/') && !href.startsWith('//')) return;
    if (/^javascript:\s*(?:void\(0\)|;)\s*;?$/i.test(href)) return;
    let url; try { url = new URL(href, local); } catch { anchor.setAttribute('href', '#'); return; }
    if (url.hostname === 'reference.invalid') {
      anchor.setAttribute('href', url.pathname + url.search + url.hash);
    } else if (url.protocol !== 'blob:' && (url.origin !== local.origin || !url.pathname.startsWith(local.pathname))) {
      anchor.setAttribute('href', '#'); anchor.removeAttribute('target');
    }
    anchor.removeAttribute('ping');
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
  document.addEventListener('auxclick', event => {
    if (event.target.closest?.('a[href],area[href]')) event.preventDefault();
  }, true);
  document.addEventListener('submit', event => event.preventDefault(), true);
})();
