import {el,button,icon} from './elements.js';
import {routeHash} from '../core/router.js';
import {money} from '../domain/customer-history.js';
import {disputeCustomers,disputeError} from '../domain/disputes.js';

const choice=(id,options)=>el('select',{id},options.map(x=>el('option',{value:x.value,label:x.label},x.text)));
const required=label=>[label,el('span',{class:'required'},' *')];
export function disputesView(snapshot,path,role){
  const isNew=path==='/disputes/new/',dates=[],node=el('section',{class:'disputes-content '+(isNew?'dispute-create':'dispute-list'),'data-disputes':path});
  const link=(label,target,primary=false)=>el('a',{class:primary?'primary':'',href:routeHash(role,target)},primary?[icon('plus'),' ']:null,label);
  const field=(label,input,help,wide=false)=>el('div',{class:'dispute-field'+(wide?' wide':'')},el('label',{for:input.id},label),input,help?el('small',{text:help}):null);
  const date=(id,value='')=>{const input=el('input',{id,type:'date',value});dates.push(input);return input;};
  if(!isNew){
    const s=snapshot.stats;
    node.append(el('div',{class:'dispute-kpis'},[
      ['対応中の決済異議申し立て',s.open_count,'回答待ち・提出済み'],['回収に懸念がある金額',money(s.at_risk_amount),'対応中の決済異議申し立ての総額'],
      ['今週が期限',s.due_this_week,'回答期限まで7日以内'],['過去90日間の異議申し立てが認められた割合',s.win_rate_pct===null?'—':s.win_rate_pct+'%','結果の確定した異議申し立てはありません']
    ].map(([label,value,sub])=>el('article',{},el('h3',{text:label}),el('strong',{text:value}),el('small',{text:sub})))),
    el('div',{class:'dispute-add'},link('決済の異議申し立てを登録','/disputes/new/',true)),
    el('div',{class:'dispute-filters'},field('対応状況',choice('status-filter',snapshot.statuses)),field('受信期間の開始日',date('received-from')),field('受信期間の終了日',date('received-to')),button('絞り込み',()=>{}, {class:'primary'})),
    el('div',{class:'dispute-table table-scroll'},el('table',{},el('thead',{},el('tr',{},['受信日時','お客様','理由','金額','対応状況','回答期限','決済代行会社'].map(text=>el('th',{text})))),el('tbody',{},el('tr',{},el('td',{colspan:7},icon('shield-alt'),el('p',{text:'決済の異議申し立てはありません。'})))))));
  }else{
    let selected=null;
    const error=el('p',{class:'dispute-error',role:'alert',hidden:true}),body=el('div',{class:'dispute-form'});
    const amount=el('input',{id:'disputed-amount',type:'number',min:'0',step:'0.01',placeholder:'0.00'});
    const charge=choice('charge-select',[]),chargeField=field('Disputed charge',charge,'Evidence is gathered automatically for this charge: receipt, the service visit it paid for, GPS report, confirmations, signed agreement + card authorization, texts, emails and relevant call transcripts. If you skip this, the charge is matched by amount.',true);chargeField.hidden=true;
    charge.addEventListener('change',()=>{const row=(snapshot.charges[selected]||[]).find(x=>x.square_payment_id===charge.value);if(row)amount.value=row.amount;});
    const results=el('div',{class:'dispute-suggestions',role:'listbox',hidden:true});
    const customer=el('input',{id:'customer-q',placeholder:'名前・電話番号で検索',autocomplete:'off','aria-controls':'dispute-customer-options',oninput:()=>{
      selected=null;const rows=disputeCustomers(snapshot,customer.value);results.hidden=!rows.length;
      results.replaceChildren(...rows.map(person=>button(person.name+' · '+person.phone,()=>{
        selected=person.id;customer.value=person.name;results.hidden=true;
        const rows=snapshot.charges[selected]||[];
        charge.replaceChildren(el('option',{value:'',text:'Pick the charge being disputed (recommended)…'}),...rows.map(row=>el('option',{value:row.square_payment_id},row.date+' — '+money(row.amount))));
        chargeField.hidden=!rows.length;
      },{role:'option'})));
    }});results.id='dispute-customer-options';
    const customerField=field(required('お客様'),customer,null,true);customerField.classList.add('dispute-customer');customerField.append(results);
    const details=el('div',{class:'dispute-grid'},customerField,chargeField,field(required('Reason Code'),choice('reason-code',snapshot.reasons)),field(required('決済代行会社'),choice('processor',snapshot.processors)),field(required('Disputed Amount (USD)'),amount),
      field('Processor Dispute ID',el('input',{id:'processor-dispute-id',placeholder:'Optional — Square/Stripe/paper ID'}),'Leave blank if not yet assigned.'));
    body.append(el('h2',{text:'DISPUTE DETAILS'}),details,el('h2',{text:'DATES'}),el('div',{class:'dispute-grid'},field(required('Received Date'),date('received-date',snapshot.receivedDate),'When the chargeback notice was received.'),field(required('Response Due Date'),date('response-due-date',snapshot.responseDueDate),'Card-network deadline (typically 7–10 days).')),
      el('h2',{text:'ADDITIONAL INFO'}),el('div',{class:'dispute-grid'},field("Customer's Claim",el('textarea',{id:'customer-claim',placeholder:'What the customer said in their dispute notice…'}),null,true),field('Operator Notes',el('textarea',{id:'operator-notes',placeholder:'Internal notes…'}),null,true)),
      el('footer',{},link('キャンセル','/disputes/'),button([icon('plus'),' Create Dispute'],()=>{error.hidden=false;error.textContent=disputeError(selected,amount.value);},{id:'submit-btn',class:'primary'})));
    node.append(error,body);
  }
  return {title:isNew?'New Chargeback Dispute':'カード決済の異議申し立て',titleIcon:'shield-alt',headerClass:'disputes-header'+(isNew?' dispute-new-header':''),node,
    mount(){dates.forEach(input=>globalThis.flatpickr(input,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true}));},dispose(){dates.forEach(x=>x._flatpickr?.destroy());}};
}
