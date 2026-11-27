import { el, icon, button, select, dialog } from './elements.js';
import { selectLocations, locationAddress, frequencies, frequencyLabel } from '../domain/locations.js';
import { refuseMutation } from '../domain/bookings.js';
import { routeHash } from '../core/router.js';

export function locationsView(snapshot, customerId, role) {
  const customer = snapshot.customers.find(record => record.id === customerId);
  if (!customer) throw new Error('保存された訪問先が見つかりません。');
  const state = { search: '', active: 'true' }, activeDialogs = new Set();
  let toast = null;
  const showMessage = (message, host = document.body) => {
    toast?.remove();
    toast = el('div', { class: 'local-toast', role: 'status', 'data-status': '403' }, el('span', { text: message }),
      button('×', () => toast?.remove(), { 'aria-label': '通知を閉じる' }));
    host.append(toast);
  };
  const openEditor = editing => {
    const form = el('form', { class: 'location-form', autocomplete: 'off' });
    const grid = el('div', { class: 'form-grid' });
    function field(id, label, { tag = 'input', type = 'text', value = '', placeholder = '', wide = false, required = false, choices } = {}) {
      const input = choices ? select(label, choices.map(([value,label]) => ({value,label})), value, () => {}, { id }) :
        el(tag, { id, type: tag === 'input' ? type : undefined, value, placeholder, ...(required ? { required: '' } : {}) });
      if (tag !== 'input') input.removeAttribute('type');
      grid.append(el('div', { class: 'field' + (wide ? ' wide' : '') }, el('label', { for: id }, label, required ? el('span', { class: 'required', text: ' *' }) : null), input));
      return input;
    }
    const heading = (label, symbol) => grid.append(el('h3', { class: 'location-section wide' }, icon(symbol), ' ' + label));
    heading('LOCATION INFO', 'map-marker-alt');
    field('lName', 'Location Name', { wide: true, required: true, placeholder: 'e.g. Main Office, Building B, Warehouse' });
    const address = field('lAddr', '番地・通り名', { required: true, placeholder: '例：123 Main St' });
    address.parentElement.classList.add('location-street');
    field('lAddr2', 'Unit / Suite / Floor', { placeholder: '例：200号室' }).parentElement.classList.add('location-unit');
    field('lCity', '市区町村'); field('lState', '州', { value: 'PA' }); field('lZip', '郵便番号');
    field('lFreq', 'Recurring Frequency', { choices: frequencies }).classList.add('compact-select');
    field('lJobType', 'Recurring Service Type', { choices: [['','(not set)']], wide: true }).classList.add('compact-select');
    heading('SITE CONTACT', 'user-tie');
    field('lCName', '連絡先の氏名'); field('lCRole', '連絡先の方の立場', { placeholder: 'Facilities Manager, Super' });
    field('lCPhone', '連絡先の電話番号', { type: 'tel' }); field('lCEmail', '連絡先のメールアドレス', { type: 'email' });
    heading('INSTRUCTIONS', 'clipboard-list');
    field('lAccess', '入場時の案内', { tag: 'textarea', wide: true, placeholder: 'Gate codes, key location, parking instructions, hours of access...' });
    field('lSpec', '現場での注意事項', { tag: 'textarea', wide: true, placeholder: 'Preferred technician, known issues, pets, chemical restrictions...' });
    heading('SERVICE DURATIONS', 'clock');
    grid.append(el('p', { class: 'location-duration-note wide', text: 'SET CUSTOM MINUTES PER SERVICE FOR THIS SITE; BLANK USES THE DEFAULT' }),
      el('label', { class: 'location-checkbox wide' }, el('input', { id: 'lActive', type: 'checkbox', checked: !editing }), ' 稼働中'),
      el('label', { class: 'location-checkbox wide' }, el('input', { id: 'lFlexible', type: 'checkbox' }), ' Flexible scheduling'),
      el('p', { class: 'location-help wide', text: 'When this site is overdue, it appears in the /calendar/ flexible-overdue sidebar and can be drag-scheduled into the best-fitting route gap.' }));
    form.append(grid);
    const modal = dialog(editing ? 'Edit Service Location' : 'New Service Location', form);
    modal.classList.add('location-dialog'); activeDialogs.add(modal);
    modal.addEventListener('close', () => { activeDialogs.delete(modal); if (toast && modal.contains(toast)) toast.remove(); }, { once: true });
    const footer = modal.querySelector('footer');
    footer.replaceChildren(button('キャンセル', () => modal.close()),
      ...(editing ? [button('削除', () => {
        if (!confirm('Delete this service location? This cannot be undone.')) return;
        modal.close(); showMessage(refuseMutation().message);
      }, { class: 'danger' })] : []),
      button('Save Location', () => {
        if (!form.reportValidity()) return;
        modal.close(); showMessage(refuseMutation().message);
      }, { class: 'primary save-location' }));
    // The current reference opens the edit form but has no captured edit-detail
    // response. Preserve this observable empty form; never silently load a
    // different customer or pretend that the snapshot has been updated.
    if (editing) {
      showMessage('この条件のデータは、確認用ページに含まれていません。', modal);
      toast.dataset.status = '404';
    }
  };
  const cards = el('div', { class: 'location-cards', 'aria-live': 'polite' });
  const render = () => {
    const records = selectLocations(customer.locations, state);
    cards.replaceChildren(...records.map(record => {
      const details = [];
      const detail = (label, value, link = false) => {
        if (!value) return;
        details.push(el('div', {}, el('span', { class: 'location-detail-label', text: label }),
          link ? el('a', { href: '#', text: value, onclick: event => event.preventDefault() }) : el('span', { text: value })));
      };
      detail('SITE CONTACT', record.contactName); detail('電話番号', record.phone, true); detail('メールアドレス', record.email, true);
      if (record.frequency) detail('頻度', frequencyLabel(record.frequency));
      detail('入場時の案内', record.access); detail('現場での注意事項', record.instructions);
      return el('article', { class: 'location-card', 'data-location-id': record.id },
        el('div', { class: 'location-card-title' }, el('div', {}, el('h2', { text: record.name }),
          el('p', {}, icon('map-marker-alt'), ' ' + locationAddress(record))),
          button([icon('edit'), ' 編集'], () => openEditor(record), { class: 'small-button' })),
        el('div', { class: 'location-details' }, details));
    }));
    if (!records.length) cards.append(el('div', { class: 'location-empty' }, icon('map-marked-alt'),
      el('p', { text: 'No service locations yet' }), button([icon('plus'),' Add First Location'], () => openEditor(null), { class: 'primary' })));
  };
  const node = el('section', { class: 'locations-content', 'data-customer-id': customer.id },
    el('div', { class: 'location-customer' }, el('div', { class: 'location-home' }, icon('home')),
      el('div', {}, el('h2', { text: customer.name }), el('p', { text: [customer.propertyType, customer.address].filter(Boolean).join(' • ') })),
      el('span', { class: 'location-count', text: customer.locations.length + ' 訪問先' })),
    el('div', { class: 'location-filters' }, el('input', { type: 'search', 'aria-label': '訪問先を検索',
      placeholder: 'Search locations by name, address, or contact...', oninput: event => {state.search=event.target.value;render();} }),
      select('訪問先の稼働状態', [{value:'',label:'すべて'},{value:'true',label:'Active only'},{value:'false',label:'Inactive only'}], state.active, value => {state.active=value;render();})), cards);
  render();
  return { node, title: '訪問先', titleIcon: 'map-marked-alt', headerExtra: el('div', { class: 'location-actions' },
    el('a', { href: routeHash(role, '/customers/') }, icon('arrow-left'), ' 顧客名簿に戻る'),
    button([icon('plus'),' New Location'], () => openEditor(null), { class: 'primary' })),
    mount() {}, dispose() { for (const modal of activeDialogs) modal.close(); toast?.remove(); } };
}
