import { reminderState, reminderTabs } from '../domain/reminders.js';
import { el, button, icon } from './elements.js';

export function remindersView(data) {
  let selected = 'pending';
  const node = el('section', { class: 'reminders-content' });
  const tabs = el('div', { class: 'reminder-tabs', role: 'tablist', 'aria-label': 'リマインダーの状態' });
  const panel = el('div', { class: 'reminder-panel', id: 'reminder-results', role: 'tabpanel', tabindex: 0 });
  const updated = el('span', { class: 'updated-at', text: '最終更新 ' + data.reminders.lastUpdated });
  const warning=el('div',{class:'delivery-warning'},icon('info-circle'),' 確認用デモの保存済み通知です。実際のメール・SMSは送信されません。');
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
    panel.replaceChildren(icon('bell-slash'),el('p',{role:'status',text:state.rows.length?state.rows.map(r=>r.subject||r.message||'通知').join(' / '):(reminderTabs.find(([k])=>k===selected)[1]+'に該当する保存済みの通知はありません。')}));
  }
  node.append(warning, tabs, panel); paint();
  return { node, headerExtra: updated, mount() {}, dispose() {} };
}
