import { el, button, icon } from './elements.js';
import { routeHash, roleLanding } from '../core/router.js';

export function roleNavigation(catalog, place, preservePage = false) {
  const roles = [
    ['company_admin', '会社管理者', 'user-shield'],
    ['csr', '顧客対応', 'headset'],
    ['technician', '担当スタッフ', 'user-tie'],
  ];
  return el('section', { class: 'sidebar-roles', 'aria-label': '権限' },
    el('div', { class: 'menu-group', text: '権限' }),
    roles.map(([role, label, glyph]) => button([icon(glyph), el('span', { text: label })], () => {
      location.hash = routeHash(role, roleLanding(catalog, role, preservePage ? place.path : null));
    }, { class: 'sidebar-role-button', 'data-preview-role': role, 'aria-pressed': String(role === place.role) })));
}

export function sidebarClose(close) {
  return button('×', close, { class: 'sidebar-close', 'aria-label': 'メニューを閉じる' });
}
