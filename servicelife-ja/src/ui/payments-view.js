import {el,button,icon,select,dialog} from './elements.js';
import {routeHash} from '../core/router.js';
import {money,customerDate} from '../domain/customer-history.js';
import {paymentRows,paymentMethods,paymentStatuses,paymentStatus,paymentMethod} from '../domain/payments.js';

function labelledSelect(id,label,choices,value,change){const input=select(label,choices.map(([value,label])=>({value,label})),value,change,{id});[...input.options].forEach((o,i)=>o.label=choices[i][2]||choices[i][1]);return input;}
function paymentEditor(snapshot,invoices){
  const fields=el('div',{class:'form-grid'}),error=el('p',{class:'profile-error wide',role:'alert',hidden:true});
  const field=(label,input)=>{fields.append(el('div',{class:'field'+(input.tagName==='TEXTAREA'?' wide':'')},el('label',{for:input.id},label),input));};
  const invoice=labelledSelect('npInvoice','入金を充当する請求書（任意）',[['','— None —','— なし —']],'',()=>{});
  const customer=labelledSelect('npCustomer','お客様',[['','Select customer...','顧客を選択'],...invoices.customers.map(x=>[x.id,x.name])],'',()=>{
    const items=invoices.completeList?invoices.items.filter(x=>invoices.listIds.includes(x.id)&&x.customer===customer.value&&Number(x.balance_due)>0).sort((a,b)=>b.created_at.localeCompare(a.created_at)):[];
    invoice.replaceChildren(el('option',{value:'',label:'— なし —'},'— None —'),...items.map(x=>el('option',{value:x.id},x.invoice_number+' — '+money(x.balance_due)+' due')));
  });
  const amount=el('input',{id:'npAmount',type:'number',step:'0.01',min:'0',placeholder:'0.00'});
  field(['お客様',el('span',{class:'required',text:' *'})],customer);field(['金額（米ドル）',el('span',{class:'required',text:' *'})],amount);
  field('支払方法',labelledSelect('npMethod','支払方法',[
    ['cash','Cash','現金'],['check','Check','小切手'],['ach','ACH','米国の銀行口座振替（ACH）'],['card','Card','カード'],['other','Other','その他']
  ],'cash',()=>{}));field('入金を充当する請求書（任意）',invoice);
  field('メモ',el('textarea',{id:'npNotes',placeholder:'社内メモ'}));fields.append(error);
  const modal=dialog('入金を記録',fields);modal.classList.add('invoice-dialog','payment-record-dialog');
  const save=()=>{error.hidden=false;error.textContent=!customer.value?'Please select a customer.':!(Number(amount.value)>0)?'Please enter a valid amount greater than zero.':'This action is disabled in the read-only demo.';};
  modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button([icon('save'),' 入金記録を保存'],save,{id:'npSaveBtn',class:'primary'}));
  return modal;
}

export function paymentsView(snapshot,invoices,role,query){
  const state={status:query.get('status')||'',method:'',staff:'',search:''};
  const node=el('section',{class:'payments-content invoices-content','data-payments':role});
  const stats=el('div',{class:'invoice-stats'},[['今月の入金額',money(snapshot.stats.month)],['決済・入金',snapshot.stats.count],['累計入金額',money(snapshot.stats.all)]].map(([label,value])=>el('div',{},el('span',{text:label}),el('strong',{text:value}))));
  const input=el('input',{id:'search',type:'search',placeholder:'顧客名・決済IDで検索',oninput:e=>{state.search=e.target.value;render();}});
  const status=labelledSelect('filterStatus','対応状況',paymentStatuses,state.status,v=>{state.status=v;render();});
  const method=labelledSelect('filterMethod','支払方法',paymentMethods,'',v=>{state.method=v;render();});
  const staff=labelledSelect('filterTech','担当スタッフ',[['','All technicians','すべての担当スタッフ'],...snapshot.staff.map(x=>[x.id,x.name])],'',v=>{state.staff=v;render();});
  const body=el('tbody'),table=el('table',{class:'payment-table invoice-table'},el('thead',{},el('tr',{},['日付','お客様','金額','支払方法','カード','対応状況','請求書','決済サービスの取引ID','操作'].map(text=>el('th',{text})))),body);
  function render(){const rows=paymentRows(snapshot,state);body.replaceChildren(...rows.map(row=>el('tr',{'data-id':row.id},
    el('td',{text:customerDate(row.created_at,false,true)}),el('td',{},el('strong',{text:row.customer_name})),el('td',{},el('strong',{text:money(row.amount)})),
    el('td',{},icon(row.method==='card'?'credit-card':row.method==='ach'?'university':'money-bill-wave'),' ',paymentMethod(row.method)),el('td',{text:row.method==='card'?'登録済みカード':'—'}),
    el('td',{},el('span',{class:'invoice-status paid',text:paymentStatus(row.status)})),
    el('td',{},row.invoice?el('a',{href:routeHash(role,'/invoices/',new URLSearchParams({id:row.invoice}))},'表示'):'—'),el('td',{text:'—'}),el('td',{text:'—'}))));
    if(!rows.length)body.append(el('tr',{},el('td',{colspan:9,class:'invoice-empty payment-empty'},icon('credit-card'),el('p',{text:'No payments yet'}))));
  }
  node.append(stats,el('div',{class:'invoice-filters'},input,status,method,staff),el('div',{class:'table-scroll'},table));render();
  return{title:'決済・入金',titleIcon:'credit-card',node,addLabel:'入金を記録',add:()=>paymentEditor(snapshot,invoices),mount(){},dispose(){}};
}
