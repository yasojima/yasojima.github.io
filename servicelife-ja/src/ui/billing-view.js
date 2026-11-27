import {el,button,icon} from './elements.js';
import {routeHash} from '../core/router.js';
import {money,customerDate} from '../domain/customer-history.js';
import {invoiceStatus} from '../domain/invoices.js';

export function billingView(snapshot,invoices,payments,role,path){
  const link=(text,target,classes='',symbol)=>el('a',{href:routeHash(role,target),class:classes},symbol?[icon(symbol),' ']:null,text);
  const node=el('section',{class:'billing-content','data-billing':path,'data-role':role});
  let title='請求・入金管理',compactHeader=false;
  if(path==='/billing/parent-accounts/'){
    title='Parent Accounts (Billing)';compactHeader=true;node.classList.add('billing-parents');
    node.append(el('h2',{text:title}),el('div',{class:'table-scroll'},el('table',{class:'parent-account-table'},
      el('thead',{},el('tr',{},['氏名','対応状況','市区町村','顧客名簿','NET DAYS','作成日時'].map(text=>el('th',{text})))),
      el('tbody',{},el('tr',{},el('td',{colspan:6,text:'No parent accounts yet.'}))))));
  }else if(path==='/billing/reconcile/'&&snapshot.reconcileAllowed){
    title='Square Reconciliation';
    const hours=el('input',{id:'window_hours',type:'number',value:'24',min:1,max:168});
    const form=el('form',{class:'reconcile-form',onsubmit:e=>{e.preventDefault();}},
      el('div',{class:'reconcile-hours'},el('label',{for:'window_hours',text:'Look-back window (hours):'}),hours),
      el('small',{text:'Default 24 h. Maximum 168 h (7 days).'}),el('button',{type:'submit',class:'primary'},icon('play'),' Run Reconciliation'));
    node.append(el('article',{class:'billing-panel reconcile-panel'},el('h2',{text:'Trigger Square Reconciliation'}),
      el('p',{text:'Runs the Square payment reconciliation job on-demand. The job compares local Payment records against the Square API for the chosen time window and logs any mismatches for review. The job also runs automatically each night at 03:00 UTC.'}),form,
      link(' Back to Billing Hub','/billing/','billing-back','arrow-left')));
  }else if(path==='/billing/reconcile/'){
    title='Access Denied';node.classList.add('billing-denied');
    node.append(el('article',{class:'billing-panel'},icon('lock'),el('h2',{text:"You don't have access to this page"}),
      el('p',{},"Your current role isn't permitted to view ",el('code',{text:'/billing/reconcile/'}),'.'),
      el('p',{text:'If you think this is a mistake, ask your administrator to update your role.'}),
      el('div',{class:'access-roles'},el('div',{},el('strong',{text:'Your role'}),el('span',{text:'顧客対応担当'})),el('div',{},el('strong',{text:'Allowed roles'}),el('span',{text:'company_admin'}),el('span',{text:'billing_rep'}))),
      el('div',{class:'access-actions'},link('Go to your dashboard','/dashboard/','primary','home'),link('Go back','/billing/','','arrow-left'))));
  }else{
    const labels=[['今月の累計売上','今月の入金額','/payments/?status=completed'],['未回収の売掛金','未払いの請求書','/invoices/?status=overdue'],['過去7日間の決済失敗','要確認','/payments/?status=failed'],['本日の処理件数','完了した決済','/payments/?status=completed']];
    node.append(el('div',{class:'billing-kpis'},labels.map(([label,sub,target],i)=>link([el('span',{text:label}),el('strong',{text:i<2?'$'+snapshot.summary[i].toFixed(2):snapshot.summary[i]}),el('small',{text:sub})],target,'billing-kpi kpi-'+i))));
    node.append(el('article',{class:'billing-panel'},el('h3',{text:'よく使う画面'}),el('div',{class:'billing-shortcuts'},[
      ['請求書','/invoices/','file-invoice-dollar'],['決済・入金','/payments/','credit-card'],['照合する','/billing/reconcile/','sync-alt'],['設定','/settings/#billing-policies','cog'],['親アカウント','/billing/parent-accounts/','building'],['集計レポート','/reports/','chart-bar']
    ].map(([label,target,symbol])=>link(label,target,'',symbol)))));
    const groups=el('div',{class:'billing-recents'});
    const recentPayments=[...payments.items].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,10);
    const invoiceIds=new Set(invoices.listIds),recentInvoices=invoices.items.filter(x=>invoiceIds.has(x.id)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,10);
    for(const [kind,label,rows,symbol] of [['payments','最近の入金',recentPayments,'credit-card'],['invoices','最近の請求書',recentInvoices,'file-invoice-dollar']]){
      groups.append(el('article',{class:'billing-panel'},el('h3',{},icon(symbol),' ',label),rows.map(row=>{
        const date=kind==='payments'?new Date(row.created_at).toLocaleString('ja-JP',{timeZone:'America/New_York',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):customerDate(row.created_at);
        return el('div',{class:'billing-recent-item '+kind},el('div',{},el('strong',{text:row.customer_name}),el('p',{},date+'・ ',el('span',{class:'invoice-status '+(kind==='payments'?'paid':row.status),text:kind==='payments'?'作業完了':invoiceStatus(row.status)}))),el('b',{text:money(kind==='payments'?row.amount:row.total)}));
      })));
    }
    node.append(groups);
  }
  return {title,titleIcon:title==='Access Denied'?'lock':'file-invoice-dollar',compactHeader,headerClass:'billing-header'+(title==='Access Denied'?' denied-header':''),node,mount(){},dispose(){}};
}
