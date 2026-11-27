import { el,button,icon,select } from './elements.js';
import { routeHash } from '../core/router.js';
import { customerDate,money,historySummary,readOnlyResponse,labelCustomerOptions } from '../domain/customer-history.js';
import { customerTypes,leadSources } from '../domain/customers.js';
import { statuses } from '../domain/bookings.js';
import { customerActions,contactForm,billingOverride } from './customer-detail-actions.js';

export function customerDetailView(customers,histories,identifier,role){
  const person=customers.details[identifier],history=histories.records[identifier];
  if(!person||!history)throw Error('顧客データが見つかりません。');
  const root=el('section',{class:'customer-detail-content','data-customer-detail':identifier,'data-role':role});
  const actions=customerActions(person,role);
  const link=(text,path,query)=>el('a',{href:routeHash(role,path,query),text});
  const inert=text=>el('a',{href:'#',text});
  const group=(title,...body)=>el('section',{class:'profile-group'},el('h3',{text:title}),...body);
  const row=(label,value)=>el('div',{class:'profile-row'},el('span',{text:label}),value instanceof Node?value:el('span',{text:value||'--'}));
  const btn=(label,ic,fn,options={})=>button([ic?icon(ic):null,ic?' ':null,label],fn,{class:'profile-action',...options});
  const type=customerTypes.find(x=>x[0]===person.type)?.[1]||person.type;
  root.append(el('div',{class:'profile-back'},el('a',{href:routeHash(role,'/customers/')},icon('arrow-left'),' 顧客名簿に戻る')));
  root.append(el('section',{class:'profile-header'},el('div',{class:'profile-identity'},el('div',{class:'profile-avatar',text:(person.firstName[0]||'')+(person.lastName[0]||'')}),el('div',{},
    el('h2',{text:person.name}),el('div',{class:'profile-contact'},el('span',{},icon('phone'),' ',inert(person.phone)),el('span',{},icon('envelope'),' ',inert(person.email))),
    el('p',{},icon('map-marker-alt'),' ',history.profile.full_service_address),el('p',{},icon(person.type==='commercial'?'building':'user-tag'),' ',type))),
    el('div',{class:'profile-header-actions'},
      btn('予約を入れる','calendar-plus',actions.book,{class:'profile-action primary'}),btn('支払いを受け付ける','credit-card',()=>actions.payment()),
      btn('通話を記録','phone',actions.call),btn('対応依頼を追加','ticket-alt',actions.ticket),
      btn('訪問先','map-marker-alt',()=>{location.hash=routeHash(role,'/customers/'+identifier+'/locations/');}),
      btn('編集','pen',actions.edit),btn('削除','trash',actions.remove,{class:'profile-action danger'}))));
  const summary=historySummary(history);
  root.append(el('div',{class:'profile-stats'},[
    ['これまでのお支払い総額',money(summary.paid),summary.invoiceCount+'件'],
    ['未払い残高',money(summary.balance),summary.balance>0?'未払い残高':'問題なし',summary.balance>0?'negative':''],
    ['予約一覧',summary.appointmentCount,'最終：'+customerDate(summary.last?.start_datetime)],
    ['次回の予約',customerDate(summary.next?.start_datetime),summary.next?.service||'予定なし']
  ].map(([label,value,note,className=''])=>el('div',{},el('span',{text:label}),el('strong',{class:className,text:value}),el('small',{text:note})))));
  const counts=history.counts;
  const tabs=[['概要'],['対応履歴',counts.timeline],['予約一覧',counts.appointments],['連絡履歴',counts.communications],['請求書',counts.invoices],['決済・入金',0],['問い合わせ・対応依頼',counts.tickets],['希望条件'],['請求ルール'],['書類',counts.documents]];
  const tabBar=el('div',{class:'profile-tabs',role:'tablist'}),content=el('div',{class:'profile-tab-content',role:'tabpanel'});
  const table=(head,rows)=>el('div',{class:'table-scroll'},el('table',{class:'profile-table'},el('thead',{},el('tr',{},head.map(text=>el('th',{text})))),el('tbody',{},rows)));
  const pill=(label,kind)=>el('span',{class:'profile-status '+kind,text:label});
  function overview(){
    const prepay=role==='company_admin'?select('訪問前の決済',[['default','Use Tenant Default'],['always','Always Pre-Charge'],['never','Never Pre-Charge']].map(([value,label])=>({value,label})),history.profile.prepay_override,()=>{prepay.value=history.profile.prepay_override;actions.message('This action is disabled in the read-only demo.');}, {id:'cdPrepayOverride'}):el('span',{text:'会社の標準設定を使う'});
    if(role==='company_admin')labelCustomerOptions(prepay);
    const notes=el('div',{class:'profile-notes'}),display=el('p',{text:person.notes||'--'});
    const edit=btn('編集','pen',()=>{
      const input=el('textarea',{id:'ovNotesInput',value:person.notes}),error=el('p',{class:'profile-error',role:'status',hidden:true});
      edit.hidden=true;notes.append(input,el('div',{class:'profile-inline-actions'},button('保存',()=>{error.textContent='Error: This action is disabled in the read-only demo.';error.hidden=false;},{id:'ovNotesSave',class:'primary'}),button('キャンセル',()=>{input.remove();input.nextSibling?.remove();renderTab(0);})),error);
    },{id:'ovNotesEdit'});
    notes.append(el('div',{class:'profile-group-title'},el('h3',{text:'メモ'}),edit),display);
    return [el('div',{class:'profile-overview-columns'},
      group('連絡先',row('氏名',[person.firstName,person.lastName].filter(Boolean).join(' ')),row('会社名',person.company),row('電話番号',inert(person.phone)),row('メールアドレス',inert(person.email)),row('顧客区分',type),row('作成日時',customerDate(person.createdAt)),row('問い合わせのきっかけ',({website:'ウェブサイト'})[person.leadSource]||leadSources.find(x=>x[0]===person.leadSource)?.[1]||person.leadSource)),
      el('div',{},group('基本住所',row('住所',history.profile.full_service_address)),group('請求',row('請求先住所',history.profile.full_billing_address),row('請求の連絡先',history.profile.billing_contact_name),row('訪問前の決済',prepay)))),notes];
  }
  function renderTab(index){
    [...tabBar.children].forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
    if(index===0)content.replaceChildren(...overview());
    if(index===1)content.replaceChildren(el('div',{class:'profile-timeline'},history.timeline.map(event=>el('article',{},el('div',{class:'timeline-dot'},icon(event.icon.replace(/^fa-/,''))),el('div',{},el('strong',{text:event.title}),el('small',{text:customerDate(event.date,true)}),event.detail?el('p',{text:event.detail}):null)))));
    if(index===2)content.replaceChildren(table(['日時','種類','担当スタッフ','所要時間','対応状況',''],history.appointments.map(item=>el('tr',{},
      el('td',{text:customerDate(item.start_datetime,true)}),el('td',{text:item.service}),el('td',{text:item.technician_name}),el('td',{text:item.duration_minutes+'分'}),el('td',{},pill(statuses[item.status]||item.status,item.status)),el('td',{},btn('Send report',null,actions.report))))));
    if(index===3)content.replaceChildren(history.messages.length?table(['日時','種類','DETAIL'],history.messages.map(message=>el('tr',{},el('td',{text:customerDate(message.created_at,true)}),el('td',{text:message.direction.toUpperCase()+' '+message.channel.toUpperCase()}),el('td',{text:message.body})))):el('p',{class:'profile-empty',text:'No calls, SMS, or email logged for this customer.'}));
    if(index===4)tabBar.children[4].querySelector('.tab-count').textContent=history.invoices.length;
    if(index===4)content.replaceChildren(history.invoices.length?table(['請求書番号','日付','合計','残高','対応状況',''],history.invoices.map(item=>el('tr',{},
      el('td',{},link(item.invoice_number,'/invoices/',new URLSearchParams({id:item.id}))),el('td',{text:customerDate(item.issue_date)}),el('td',{text:money(item.total)}),el('td',{text:money(item.balance_due)}),
      el('td',{},pill(({paid:'入金済み',overdue:'期限超過',sent:'送付済み',draft:'下書き',partial:'一部入金',void:'無効'})[item.status]||item.status,item.status)),el('td',{},Number(item.balance_due)>0?btn('支払い',null,()=>actions.payment(item.balance_due)):null)))):el('p',{class:'profile-empty',text:'このお客様の請求書はありません。'}));
    if(index===5){
      const sum=history.squareSummary;
      tabBar.children[5].querySelector('.tab-count').textContent=history.squarePayments.length;
      content.replaceChildren(el('div',{class:'profile-payment-summary'},el('strong',{text:sum.completed_count+' 件の決済が完了'}),el('span',{text:money(sum.completed_total)+' 入金額'}),el('span',{text:'最終入金 '+customerDate(sum.last_payment_date,false,true)})),
        table(['日付','金額','対応状況','カード','現場',''],history.squarePayments.map(item=>el('tr',{},el('td',{text:customerDate(item.date,false,true)}),el('td',{text:money(item.amount)}),el('td',{},pill(item.status==='COMPLETED'?'決済完了':item.status,item.status.toLowerCase())),el('td',{text:[item.card_brand,item.last4].filter(Boolean).join(' ')||'--'}),el('td',{text:item.location||'--'}),el('td')))));
    }
    if(index===6){
      const category={general_inquiry:'一般のお問い合わせ',service_issue:'作業に関する問題',billing:'請求',scheduling:'訪問予定',complaint:'苦情',callback_request:'折り返し依頼',warranty:'保証',cancellation:'キャンセル'};
      const priority={low:'低',medium:'中',high:'高',urgent:'至急'},status={open:'未対応',in_progress:'作業中',waiting_customer:'お客様の返信待ち',resolved:'解決済み',closed:'対応終了'};
      content.replaceChildren(...(history.tickets.length?[table(['#','件名','分類','優先度','対応状況','開封済み'],history.tickets.map(item=>el('tr',{},el('td',{text:'#'+item.ticket_number}),el('td',{text:item.subject}),el('td',{text:category[item.category]||item.category}),el('td',{},pill(priority[item.priority]||item.priority,item.priority)),el('td',{},pill(status[item.status]||item.status,item.status)),el('td',{text:customerDate(item.created_at)}))))]:[el('p',{class:'profile-empty',text:'No tickets yet.'}),btn('対応依頼を開く',null,actions.openTickets)]));
    }
    if(index===7){
      const pref=history.preference;
      const edit=el('div',{class:'profile-inline-actions'},btn(pref?'Edit Preferences':'Set Preferences',null,()=>actions.preferences(pref),{class:'profile-action primary'}),btn('希望条件の入力リンクを送る',null,actions.sendPreferences));
      content.replaceChildren(...(pref?[el('div',{class:'preference-heading'},el('strong',{text:'SCHEDULING PREFERENCES'}),pill(pref.status==='completed'?'確認済み':'未確認',pref.status),edit),group('希望の曜日・時間帯',el('p',{text:'No preferred windows set'})),group('希望の担当スタッフ',el('div',{},pref.staff.map(x=>pill(x.name.toUpperCase(),'staff')))),el('small',{text:'最終：'+customerDate(pref.updated_at,true)})]:[el('p',{class:'profile-empty',text:'No scheduling preferences recorded yet.'}),edit]));
    }
    if(index===8)content.replaceChildren(billingOverride());
    if(index===9)content.replaceChildren(el('p',{class:'profile-empty',text:'このお客様の書類は登録されていません。'}));
  }
  tabs.forEach(([label,count],index)=>tabBar.append(button([label,count===undefined?null:' ',count===undefined?null:el('span',{class:'tab-count',text:count})],()=>renderTab(index),{role:'tab',onkeydown:event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;renderTab(next);tabBar.children[next].focus();}}})));
  root.append(el('section',{class:'profile-card'},tabBar,content));renderTab(0);
  root.append(group('支払方法',el('p',{class:'profile-muted'},icon('info-circle'),' カードを登録するには、請求設定でStripeまたはSquareとの連携を設定してください。'),
    ['Stripe','Square'].map(name=>el('div',{class:'profile-provider'},el('strong',{text:name}),el('p',{class:'profile-dashed',text:name+'に登録済みのカードはありません。'})))));
  root.append(group('自動支払い',el('p',{class:'profile-muted',text:'定期請求が設定されていないため、このお客様は自動支払いを利用していません。'})));
  const flexError=el('p',{class:'profile-error',role:'status',hidden:true});
  root.append(group('訪問日時の調整',el('p',{class:'profile-muted',text:'指定曜日の範囲で、巡回予定に合わせて訪問日を調整することにお客様が同意しています。同意の設定は担当者が管理します。'}),
    el('label',{class:'profile-check'},el('input',{id:'rfFlexFlag',type:'checkbox',checked:history.profile.flexibility_flag}),'お客様が訪問日時の調整に同意している'),
    el('div',{class:'profile-days'},el('span',{text:'日程調整が可能な曜日'}),['月','火','水','木','金','土','日'].map((text,i)=>el('label',{},el('input',{type:'checkbox',checked:history.profile.flexibility_window.includes(i)}),text))),
    el('label',{class:'profile-check'},el('input',{id:'rfAutoRebalance',type:'checkbox',checked:history.profile.allow_auto_rebalance}),'毎週の訪問予定を自動で調整する（変更ごとの承認は不要）'),
    btn('保存',null,()=>{flexError.textContent='Error: '+readOnlyResponse;flexError.hidden=false;},{id:'rfSaveBtn',class:'profile-action primary'}),flexError));
  const contact=el('div');
  root.append(el('section',{class:'profile-group'},el('div',{class:'profile-group-title'},el('h3',{text:'通知を受け取る連絡先'}),btn('連絡先を追加','plus',()=>{contact.replaceChildren(contactForm(()=>contact.replaceChildren()));},{id:'ccAddBtn',class:'profile-action primary'})),contact,
    el('p',{class:'profile-dashed',text:'追加の連絡先はまだありません。通知を受け取る所有者、管理者、入居者、請求担当者などを登録してください。'})));
  return{node:root,title:person.name,compactHeader:true,mount(){},dispose(){actions.dispose();}};
}
