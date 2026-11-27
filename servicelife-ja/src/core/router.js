const roles = new Set(['company_admin', 'csr', 'technician']);
export function parseRoute(hash) {
  const text = String(hash || '').replace(/^#/, '');
  const match = /^(?:(company_admin|csr|technician))?(\/[^#]*)(?:#.*)?$/.exec(text);
  if (!match) return { role: 'company_admin', path: '/appointments/', query: new URLSearchParams() };
  const part = match[2];
  if (part.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(part)) throw new Error('無効な画面の指定です。');
  const url = new URL(part, 'https://local.invalid');
  if (url.origin !== 'https://local.invalid') throw new Error('外部の画面は開けません。');
  const edit=/^edit=([0-9a-f-]{36})$/.exec(text.split('#')[1]||'');
  if(url.pathname==='/customers/'&&edit)url.searchParams.set('edit',edit[1]);
  const panel=/^[a-z-]+$/.test(text.split('#')[1]||'')?text.split('#')[1]:null;
  if(url.pathname==='/settings/'&&panel)url.searchParams.set('panel',panel);
  return { role: match[1] || 'company_admin', path: url.pathname, query: url.searchParams };
}
export function routeHash(role, path, query = new URLSearchParams()) {
  if (!roles.has(role) || !path.startsWith('/') || path.startsWith('//')) throw new Error('無効な画面です。');
  const suffix = query.size ? '?' + query : '';
  return '#' + (role === 'company_admin' ? '' : role) + path + suffix;
}
function containsRoute(routes,place){
  const key=place.role+'|'+place.path;
  if(routes.includes(key))return true;
  // Query-only catalog entries authorize the exact saved request, never another appointment.
  return routes.includes(key+(place.query?.size?'?'+place.query.toString():''));
}
export function canOpen(catalog,place){return containsRoute(catalog.routes,place)}
export function supportsIndependent(catalog,place){return containsRoute(catalog.migratedRoutes,place)}
