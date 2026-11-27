import {el,button,icon} from './elements.js';
const blocked='Error: This action is disabled in the read-only demo., This action is disabled in the read-only demo.';
export function ticketsView(data){
 const node=el('section',{class:'tickets-content','data-tickets':''}),list=el('div',{class:'ticket-table'});let modal=null,toast=null,timer;
 const previous={fCat:'general_inquiry',fPri:'medium',fStat:'open',fChan:'phone'};
 const flash=text=>{clearTimeout(timer);toast?.remove();toast=el('div',{class:'ticket-toast',role:'status',popover:'manual',text});node.append(toast);toast.showPopover();timer=setTimeout(()=>toast?.remove(),2500)};
 const option=(id,value,change)=>{const c=el('select',{id,onchange:change||(()=>{})},data.options[id].map(o=>el('option',{value:o.value,label:o.label,text:o.text})));c.value=value??data.options[id][0].value;return c};
 node.append(el('div',{class:'ticket-kpis'},['未完了','作業中','上位担当者へ引き継ぎ済み','本日の解決件数'].map((text,i)=>el('article',{},el('strong',{text:data.statistics[i]}),el('small',{text})))));
 const search=el('input',{id:'search',placeholder:'対応依頼を検索',oninput:()=>render()}),filters=el('div',{class:'ticket-filters'},search,...['fStatus','fPriority','fCategory'].map(id=>option(id,'',()=>render())));node.append(filters,list);
 const badge=(text,kind)=>el('span',{class:'ticket-badge '+kind,text});
 function render(){const hasFilter=search.value||[...filters.querySelectorAll('select')].some(s=>s.value),rows=hasFilter?[]:data.records;
 list.replaceChildren(el('table',{},el('thead',{},el('tr',{},['対応依頼','お客様','件名','分類','優先度','対応状況','割り当て済み','作成日時','操作'].map(text=>el('th',{text})))),el('tbody',{},rows.length?rows.map(r=>el('tr',{},el('td',{class:'ticket-number',text:r.ticket_number}),el('td',{text:r.customer_name||'—'}),el('td',{text:r.subjectLabel}),el('td',{},badge(r.categoryLabel,'category')),el('td',{},badge(r.priorityLabel,r.priority)),el('td',{},badge(r.statusLabel,r.status)),el('td',{text:r.assigned_to_name||'—'}),el('td',{text:new Date(r.created_at).toLocaleDateString('ja-JP',{month:'short',day:'numeric'})}),el('td',{},button(icon('edit'),()=>edit(data.details[r.id]),{'aria-label':r.ticket_number+'を編集',class:'ticket-edit'})))):el('tr',{},el('td',{colspan:9,class:'ticket-empty',text:'No tickets found'})))));
 }
 function edit(record){
  toast?.remove();clearTimeout(timer);const body=el('div',{class:'ticket-modal-body'}),fields={},label=(text,control)=>el('label',{class:'ticket-field'},el('span',{text}),control),row=(a,b)=>el('div',{class:'ticket-row'},a,b);let customerId=record?.customer||'';
  const make=(id,tag,value,attrs={})=>fields[id]=el(tag,{id,value,...attrs});
  if(record)Object.assign(previous,{fCat:record.category,fPri:record.priority,fStat:record.status,fChan:record.channel});
  const results=el('div',{class:'ticket-customer-results',id:'custResults'}),customer=make('fCustSearch','input',record?.customer_name||'',{placeholder:'顧客を検索'});
  customer.addEventListener('input',()=>{const q=customer.value.trim().toLowerCase();if(q.length<2){results.replaceChildren();return}const matches=data.customers.filter(c=>c.search.some(v=>v.toLowerCase().includes(q))).slice(0,5);results.replaceChildren(...matches.map(c=>el('div',{role:'button',tabindex:0,onclick:()=>choose(c),onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(c)}}},c.name+' ',el('span',{text:c.phone}))));});
  function choose(c){customerId=c.id;customer.value=c.name;results.replaceChildren()}
  const choice=(id,value)=>{fields[id]=option(id,value,()=>{if(id in previous)previous[id]=fields[id].value});return fields[id]};
  body.append(label('顧客（必須）',el('div',{},customer,results)),label('件名（必須）',make('fSubject','input',record?.subject||'')),label('内容（必須）',make('fDesc','textarea',record?.description||'')),row(label('分類',choice('fCat',previous.fCat)),label('優先度',choice('fPri',previous.fPri))),row(label('対応状況',choice('fStat',previous.fStat)),label('経路',choice('fChan',previous.fChan))),label('担当者',choice('fAssign',record?.assigned_to||'')));
  if(record){const comment=make('fCommentBody','textarea','',{placeholder:'返信または社内メモを入力'});body.append(el('section',{class:'ticket-comments'},el('h4',{text:'コメント'}),el('p',{text:'No comments yet.'}),comment,el('div',{class:'ticket-comment-actions'},choice('fCommentType','reply'),button([icon('paper-plane'),' 送信'],()=>flash(comment.value.trim()?blocked:'Comment body cannot be empty'),{id:'commentSubmitBtn',class:'ticket-save'}))));}
  const close=()=>modal?.close();modal=el('dialog',{class:'ticket-modal','aria-label':record?'Edit Ticket #'+record.ticket_number:'対応依頼を追加'},el('header',{},el('h2',{text:record?'Edit Ticket #'+record.ticket_number:'対応依頼を追加'}),button('×',close,{'aria-label':'閉じる'})),body,el('footer',{},button('キャンセル',close),button([icon('check'),' 保存'],()=>flash(!customerId||!fields.fSubject.value.trim()?'Customer and subject required':blocked),{id:'ticketSaveBtn',class:'ticket-save'})));
  const own=modal;own.addEventListener('close',()=>{own.remove();if(modal===own)modal=null},{once:true});node.append(own);own.showModal();
 }
 render();return{title:'問い合わせ・対応依頼',titleIcon:'ticket-alt',headerClass:'tickets-header',addLabel:'対応依頼を追加',add:()=>edit(),node,mount(){},dispose(){clearTimeout(timer);toast?.remove();modal?.close()}};
}
