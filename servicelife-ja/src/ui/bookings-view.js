import { selectBookings, statuses, searchCustomers, initialBookingState, refuseMutation } from '../domain/bookings.js';
import { el, button, select, icon, dialog, notice } from './elements.js';

function datePicker(input, value, change) {
  input.value = value;
  if (globalThis.flatpickr) return flatpickr(input, { dateFormat: 'Y-m-d', altInput: true, altFormat: 'm/d/Y', defaultDate: value || null, locale: 'ja', allowInput: true, onChange: (_, date) => change(date) });
  input.type = 'date'; input.addEventListener('change', () => change(input.value));
  return { clear() { input.value = ''; change(''); }, destroy() {} };
}
function displayDate(value) {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
const choices = (items, empty) => [{ value: '', label: empty }, ...items.map(x => ({ value: x.id, label: x.name }))];

export function bookingEditor(data, record = null) {
  const draft = record ? { ...record } : { customerId: '', customerName: '', customerPhone: '', staffId: '', serviceId: '', duration: 60, address: '', unit: '', notes: '' };
  const body = el('div', { class: 'booking-editor' });
  const controls = new Map();
  const field = (name, label, input, wide = false) => {
    input.id = 'edit-' + name; controls.set(name, input);
    return el('div', { class: wide ? 'field wide' : 'field' }, el('label', { for: input.id }, label), input);
  };
  const grid = el('div', { class: 'form-grid' });
  const error = el('p', { role: 'alert', class: 'error', hidden: true });
  const customerSearch = el('input', { type: 'search', placeholder: '名前・電話番号・住所で検索', autocomplete: 'off', 'aria-label': 'お客様を検索' });
  const results = el('ul', { class: 'customer-results', role: 'listbox', hidden: true });
  const customerChip = el('div', { class: 'customer-chip' });
  const customer = el('div', { class: 'customer-picker' }, customerSearch, customerChip, results);
  const displayCustomer = () => {
    customerSearch.hidden = !!draft.customerId;
    customerChip.hidden = !draft.customerId;
    customerChip.replaceChildren(el('span', { text: [draft.customerName, draft.customerPhone].filter(Boolean).join(' — ') }),
      button('×', () => { draft.customerId = ''; customerSearch.value = ''; displayCustomer(); customerSearch.focus(); }, { 'aria-label': 'お客様の選択を解除' }));
  };
  customerSearch.addEventListener('input', () => {
    const rows = searchCustomers(data.customers, customerSearch.value).slice(0, 12);
    results.hidden = false;
    results.replaceChildren(...rows.map(c => el('li', {}, button([c.name, c.phone].filter(Boolean).join(' — '), () => {
      draft.customerId = c.id; draft.customerName = c.name; draft.customerPhone = c.phone;
      if (!record && controls.has('address')) controls.get('address').value = c.address;
      results.hidden = true; displayCustomer();
    }, { role: 'option' }))));
    if (!rows.length) results.append(el('li', { text: '該当するお客様はいません。' }));
  });
  displayCustomer();
  grid.append(field('customer', 'お客様', customer), field('staff', '担当スタッフ', select('担当スタッフ', choices(data.staff, '未割り当て'), draft.staffId, () => {})),
    field('service', '作業の種類', select('作業の種類', choices(data.services, '選択'), draft.serviceId, value => {
      const service = data.services.find(s => s.id === value); if (service) controls.get('duration').value = service.duration;
    })), field('duration', '所要時間（分）', el('input', { type: 'number', min: 1, value: draft.duration })));
  const date = el('input', { type: 'text', autocomplete: 'off', 'aria-label': '日付' });
  const time = record ? new Date(record.startsAt) : null;
  grid.append(field('date', '日付', date), field('time', '時刻', el('input', { type: 'time', value: time ? `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}` : '' })),
    el('div', { class: 'address-fields wide' }, field('address', '現場', el('input', { type: 'text', value: draft.address, placeholder: '住所を入力して候補を検索' })),
    field('unit', '部屋番号・区画番号', el('input', { type: 'text', value: draft.unit, placeholder: '部屋番号・区画・階' }))),
    field('notes', 'メモ', el('textarea', { rows: 3, value: draft.notes }), true));
  const unavailable = el('section', { class: 'nearby' },
    el('h3', { text: 'この現場の近くで立ち寄れる訪問先' }), el('p', { text: 'この条件のデータは、確認用ページに含まれていません。' }),
    el('h3', { text: '今週、近くで予定されている定期訪問' }), el('p', { text: 'この条件のデータは、確認用ページに含まれていません。' }),
    el('h3', { text: '付近にいる、訪問予定から90日以上経過したお客様' }));
  body.append(error, grid); if (record) body.append(unavailable);
  const deny = () => { const result = refuseMutation(); error.textContent = result.message; error.hidden = false; error.dataset.status = String(result.status); };
  const actions = [];
  if (record) actions.push(button([icon('ban'), ' 予約を取り消す'], deny, { class: 'danger' }),
    button([icon('thumbtack'), draft.pinned ? ' 日時の固定を解除' : ' この日時に固定（顧客への通知なし）'], deny));
  if (record?.status === 'completed') actions.push(button('請求書を作成', deny));
  actions.push(button('保存', () => {
    if (!draft.customerId || !controls.get('service').value || !date.value || !controls.get('time').value) {
      error.textContent = 'お客様・作業の種類・日付・時刻を入力してください。'; error.hidden = false; return;
    }
    deny();
  }, { class: 'primary' }));
  const node = dialog(record ? '予約の編集' : '予約を追加', body, actions);
  const picker = datePicker(date, record?.startsAt.slice(0,10) || '', () => {});
  node.addEventListener('close', () => picker.destroy(), { once: true });
  return node;
}

export function bookingsView(data, query) {
  const state = initialBookingState(query);
  const section = el('section', { class: 'bookings-content' });
  const filters = el('div', { class: 'filters', role: 'search', 'aria-label': '予約を絞り込む' });
  const search = el('input', { id: 'booking-search', type: 'search', placeholder: '顧客名・現場住所で検索', value: state.search, 'aria-label': '顧客名・現場住所で検索', autocomplete: 'off' });
  const change = (key, value) => { state[key] = value; state.page = 1; paint(); };
  search.addEventListener('input', () => change('search', search.value));
  const status = select('対応状況', [{ value: '', label: 'すべての対応状況' }, ...Object.entries(statuses).filter(([key]) => key !== 'en_route').map(([value,label]) => ({ value,label }))], state.status, value => change('status', value));
  const staff = select('担当スタッフ', choices(data.staff, 'すべての担当スタッフ'), state.staff, value => change('staff', value));
  const services = select('作業', choices(data.services, 'すべての作業'), state.services[0], value => change('services', value ? [value] : []));
  const date = el('input', { id: 'booking-date', type: 'text', autocomplete: 'off', 'aria-label': '利用日' });
  let picker;
  filters.append(search, status, staff, services, date, button('日付指定を解除', () => picker.clear(), { class: 'clear-date' }));
  const table = el('table', { class: 'booking-table' });
  table.append(el('colgroup', {}, ['date','customer','service','staff','address','duration','status'].map(key => el('col', { class: 'column-' + key }))),
    el('thead', {}, el('tr', {}, ['日時','お客様','サービス内容','担当スタッフ','現場','所要時間','対応状況'].map(text => el('th', { scope: 'col', text })))));
  const tbody = el('tbody'); table.append(tbody);
  const pager = el('div', { class: 'pagination' });
  const count = el('div', { class: 'count', role: 'status', 'aria-live': 'polite' });
  section.append(filters, el('div', { class: 'table-scroll' }, table), pager, count);
  function paint() {
    const result = selectBookings(data.bookings, state); state.page = result.page;
    tbody.replaceChildren(...result.rows.map(record => {
      const row = el('tr', { tabindex: 0, 'data-booking-id': record.id, 'aria-label': `${record.customerName}の予約を開く`, onclick: () => bookingEditor(data, record), onkeydown: event => {
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); bookingEditor(data, record); }
      } });
      const values = [displayDate(record.startsAt), record.customerName, record.services.length ? record.services.map(s => s.name).join(', ') : record.serviceName, record.staffName || '未割り当て', record.address, record.duration + '分'];
      row.append(...values.map((text, index) => el('td', { text, title: text, class: index === 1 ? 'customer-name' : '' })), el('td', {}, el('span', { class: 'status ' + record.status, text: statuses[record.status] || record.status })));
      return row;
    }));
    if (!result.rows.length) tbody.append(el('tr', {}, el('td', { colspan: 7, class: 'empty', text: '該当する予約はありません。' })));
    const pageInput = el('input', { type: 'number', min: 1, max: result.pages, value: result.page, 'aria-label': 'ページ', onchange: event => { state.page = event.target.value; paint(); } });
    pager.replaceChildren(button('‹ 前へ', () => { state.page--; paint(); }, { disabled: result.page <= 1 }), el('span', { text: 'ページ' }), pageInput,
      el('span', { text: `／全${result.pages}ページ` }), button('次へ ›', () => { state.page++; paint(); }, { disabled: result.page >= result.pages }),
      el('label', {}, '1ページの表示件数 ', select('1ページの表示件数', [10,25,50,100].map(value => ({ value, label: String(value) })), state.size, value => change('size', Number(value)))));
    count.textContent = `全${result.total}件中 ${result.from}～${result.to}件`;
  }
  paint();
  return { node: section, mount() { picker = datePicker(date, state.date, value => change('date', value)); }, dispose() { picker?.destroy(); }, add() { return bookingEditor(data); } };
}
