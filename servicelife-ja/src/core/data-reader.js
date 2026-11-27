import {isDocumentLink} from './local-files.js';
import { approvedData } from './approved-data.js';

// The only network-capable function in the independent application. User input
// never enters a request URL, headers, body, or the snapshot key.
const request = globalThis.fetch.bind(globalThis);
const root = new URL('../../', import.meta.url);
const pending = new Map();
export function readSnapshot(key) {
  if (!Object.hasOwn(approvedData, key)) return Promise.reject(new Error('許可されていないデータです。'));
  if (!pending.has(key)) pending.set(key, (async () => {
    const url = new URL(key, root);
    const response = await request(url, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-cache' });
    if (!response.ok || response.redirected || response.url !== url.href || response.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Error('保存データを読み込めませんでした。');
    const bytes = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    if (digest !== approvedData[key]) throw new Error('保存データの照合に失敗しました。');
    return JSON.parse(new TextDecoder().decode(bytes));
  })().catch(error => { pending.delete(key); throw error; }));
  return pending.get(key);
}

export function disableConnections() {
  const deny = () => { throw new DOMException('確認用デモでは外部接続できません。', 'SecurityError'); };
  const lock = (target, name, value) => Object.defineProperty(target, name, { value, configurable: false, writable: false });
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'Worker', 'SharedWorker', 'open']) lock(globalThis, name, deny);
  lock(navigator, 'sendBeacon', () => false);
  lock(navigator, 'geolocation', undefined);
  lock(navigator, 'serviceWorker', undefined);
  lock(HTMLFormElement.prototype, 'submit', deny);
  document.addEventListener('submit', event => event.preventDefault(), true);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    link.removeAttribute('ping');
    if (!isDocumentLink(link) && !/^#(?:(?:company_admin|csr|technician))?\/(?!\/)/.test(link.getAttribute('href'))) event.preventDefault();
  }, true);
}
