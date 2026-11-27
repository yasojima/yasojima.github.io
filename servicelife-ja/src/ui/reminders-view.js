import { reminderState, reminderTabs } from '../domain/reminders.js';
import { el, button, icon } from './elements.js';

export function remindersView(data) {
  let selected = 'pending';
  const node = el('section', { class: 'reminders-content' });
  const tabs = el('div', { class: 'reminder-tabs', role: 'tablist', 'aria-label': 'リマインダーの状態' });
  const panel = el('div', { class: 'reminder-panel', id: 'reminder-results', role: 'tabpanel', tabindex: 0 });
  const updated = el('span', { class: 'updated-at', text: '最終更新 ' + data.reminders.lastUpdated });
  const warning = el('div', { class: 'delivery-warning' }, icon('info-circle'), ' ',
    el('strong', { text: 'テスト送信モードが有効です' }),
    '。送信待ちのお知らせは、指定した時刻になっても ', el('strong', { text: '送信されません' }),
    '。例外として許可した宛先だけに送信します。テスト送信モードを解除する前に、この一覧で送信予定を確認してください。');
  const controls = reminderTabs.map(([key, label]) => button([label, el('span', { class: 'tab-count', text: data.reminders.counts[key || 'all'] || 0 })], () => {
    selected = key; paint();
  }, { role: 'tab', id: 'reminder-tab-' + (key || 'all'), 'aria-controls': panel.id, 'data-status': key }));
  tabs.append(...controls);
  tabs.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = controls.indexOf(document.activeElement);
    next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (next + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
    controls[next].click(); controls[next].focus();
  });
  function paint() {
    const state = reminderState(data.reminders, selected);
    controls.forEach((control, index) => {
      const active = reminderTabs[index][0] === selected;
      control.classList.toggle('active', active); control.setAttribute('aria-selected', String(active)); control.tabIndex = active ? 0 : -1;
      if (active) panel.setAttribute('aria-labelledby', control.id);
    });
    panel.classList.toggle('unavailable', !state.available);
    panel.dataset.status = String(state.code);
    if (!state.available) panel.replaceChildren(el('p', { role: 'status', text: 'Failed to load (404)' }));
    else panel.replaceChildren(icon('bell-slash'), el('p', { role: 'status', text: '送信待ちのリマインダーはありません。予約が入ると自動で作成されます。' }));
  }
  node.append(warning, tabs, panel); paint();
  return { node, headerExtra: updated, mount() {}, dispose() {} };
}
