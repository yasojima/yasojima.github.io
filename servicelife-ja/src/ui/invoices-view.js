import {el,button,icon,select} from './elements.js';
import {money,customerDate} from '../domain/customer-history.js';
import {invoiceRows,invoiceColumns,invoiceStatuses,invoiceStatus} from '../domain/invoices.js';
import {invoiceEditor} from './invoice-editor.js';

export function invoicesView(snapshot,query=new URLSearchParams()){
  let ordering='-created_at',status=query.get('status')||'',search='';
  const node=el('section',{class:'invoices-content','data-invoices':snapshot.role});
  const stats=el('div',{class:'invoice-stats'},[
    ['今月の請求額',money(snapshot.stats.invoiced),''],['入金額',money(snapshot.stats.collected),''],
    ['未払い残高',money(snapshot.stats.outstanding),'outstanding'],['期限超過',snapshot.stats.overdue,'overdue'],['登録済みのカード',snapshot.stats.cards,'cards']
  ].map(([label,value,kind])=>el('div',{class:kind},el('span',{text:label}),el('strong',{text:value}))));
  const input=el('input',{id:'search',type:'search',placeholder:'請求書番号・顧客名で検索','aria-label':'請求書番号・顧客名で検索',oninput:e=>{search=e.target.value;render();}});
  const filter=select('対応状況',invoiceStatuses.map(([value,label])=>({value,label})),status,value=>{status=value;render();},{id:'filterStatus'});
  [...filter.options].forEach((option,i)=>option.label=invoiceStatuses[i][2]);
  const head=el('thead'),body=el('tbody'),table=el('table',{class:'invoice-table'},head,body);
  function render(){
    head.replaceChildren(el('tr',{},invoiceColumns.map(([key,label])=>{
      const sortable=key!=='customer_name',active=ordering.replace(/^-/,'')===key;
      const th=el('th',{...(sortable?{tabindex:'0','aria-sort':active?(ordering.startsWith('-')?'descending':'ascending'):'none','data-sort':key}:{})},label,
        sortable?icon(active?(ordering.startsWith('-')?'sort-down':'sort-up'):'sort'):null);
      const sort=()=>{ordering=ordering===key?'-'+key:key;render();};
      if(sortable){th.addEventListener('click',sort);th.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();sort();}});}
      return th;
    })));
    const rows=invoiceRows(snapshot,{status,search,ordering});
    body.replaceChildren(...rows.map(row=>{
      const tr=el('tr',{tabindex:'0','aria-label':row.invoice_number,'data-id':row.id,onclick:()=>invoiceEditor(snapshot,row),onkeydown:e=>{if(e.key==='Enter')invoiceEditor(snapshot,row);}},
        invoiceColumns.map(([key])=>el('td',{class:key==='status'?'invoice-state-cell':key},key==='status'?el('span',{class:'invoice-status '+row.status,text:invoiceStatus(row.status)}):
          ['created_at','due_date'].includes(key)?customerDate(row[key],false,true):
          ['subtotal','tax_amount','total','amount_paid','balance_due'].includes(key)?el('span',{class:key==='balance_due'?(Number(row[key])>0?'owing':'settled'):'',text:money(row[key])}):row[key])));
      return tr;
    }));
    if(!rows.length)body.append(el('tr',{},el('td',{colspan:'10',class:'invoice-empty',text:'No invoices yet'})));
  }
  node.append(stats,el('div',{class:'invoice-filters'},input,filter),el('div',{class:'table-scroll'},table));render();
  return{title:'請求書',titleIcon:'file-invoice-dollar',node,addLabel:'請求書を作成',add:()=>invoiceEditor(snapshot),mount(){if(query.get('id')){const record=snapshot.items.find(x=>x.id===query.get('id'));if(record)invoiceEditor(snapshot,record);}},dispose(){document.querySelectorAll('.local-toast').forEach(x=>x.remove());}};
}
