import { notificationCategories, selectNotifications } from '../domain/notifications.js';
import { el, button, icon, select, notice } from './elements.js';
import { parseRoute, routeHash, canOpen } from '../core/router.js';
import { refuseMutation } from '../domain/bookings.js';

export function notificationsView(data, catalog, role) {
  const state = {page:1,unread_only:'',category:''};
  const node = el('section', { class:'notifications-content' });
  const error = el('p', { class:'error', role:'status', hidden:true });
  const filters = el('div', { class:'filters' },
    select('通知の既読状態', [{value:'',label:'すべての通知'},{value:'true',label:'未読のみ'}], '', value => {state.unread_only=value;state.page=1;paint();}),
    select('通知のカテゴリ', notificationCategories.map(([value,label])=>({value,label})), '', value => {state.category=value;state.page=1;paint();}));
  const table = el('table', { class:'notifications-table' },
    el('colgroup', {}, ['kind','subject','category','received','action'].map(key=>el('col',{class:'notice-'+key}))),
    el('thead', {}, el('tr', {}, ['種類','件名・メッセージ','分類','受信日時','対応状況'].map(text=>el('th',{scope:'col',text})))));
  const body = el('tbody');table.append(body);
  const pager = el('div', {class:'pagination notification-pages'});
  const deny = () => notice(refuseMutation().message);
  function targetLink(item) {
    try {
      const place = parseRoute('#'+(role==='company_admin'?'':role)+item.target);
      if (!item.target.startsWith('/') || !canOpen(catalog,place)) throw new Error('Unavailable target');
      return el('a', {href:routeHash(role,place.path,place.query),class:'notice-title',title:item.title,text:item.title});
    } catch {
      return el('span', {class:'notice-title',text:item.title,title:item.title});
    }
  }
  function paint() {
    const result = selectNotifications(data,state);
    error.hidden=result.status===200;
    if (result.status!==200) {
      error.textContent='Could not load notifications.'; error.dataset.status='404'; body.replaceChildren(); pager.replaceChildren(); return;
    }
    body.replaceChildren(...result.rows.map(item=>{
      const date=new Date(item.receivedAt);
      return el('tr', {class:item.read?'':'unread','data-notification-id':item.id},
        el('td',{},el('span',{class:'status '+(item.kind==='action'?'action':'info'),text:item.kind==='action'?'操作':'お知らせ'})),
        el('td',{},targetLink(item),el('div',{class:'notice-excerpt',text:item.excerpt,title:item.excerpt})),
        el('td',{text:notificationCategories.find(([key])=>key===item.category)?.[1]||item.category}),
        el('td',{text:`${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`}),
        el('td',{},item.read?el('span',{text:'既読'}):button([icon('check'),' 既読にする'],deny,{class:'small-button'})));
    }));
    pager.replaceChildren(button('前へ',()=>{state.page--;paint();},{disabled:state.page<=1}),
      el('span',{text:`全${result.pages}ページ中${state.page}ページ（全${result.total}件）`,role:'status'}),
      button('次へ',()=>{state.page++;paint();},{disabled:state.page>=result.pages}));
  }
  node.append(filters,error,el('div',{class:'table-scroll'},table),pager);paint();
  return {node,headerExtra:button([icon('check-double'),' すべて既読にする'],deny,{class:'mark-all-read'}),mount(){},dispose(){}};
}

export function notificationPopover(bell, role) {
  const panel=el('section',{class:'notification-popover',role:'region','aria-label':'通知'},
    el('header',{},el('strong',{text:'通知'}),button('すべて既読にする',()=>notice(refuseMutation().message))),
    el('p',{text:'Could not load notifications.'}),
    el('footer',{},el('a',{href:routeHash(role,'/notifications/'),text:'すべて見る'})));
  const abort=new AbortController();
  function close(){panel.remove();bell.setAttribute('aria-expanded','false');abort.abort();}
  bell.setAttribute('aria-expanded','true');bell.after(panel);
  document.addEventListener('click',event=>{if(!panel.contains(event.target)&&!bell.contains(event.target))close();},{signal:abort.signal});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){close();bell.focus();}},{signal:abort.signal});
  return close;
}
