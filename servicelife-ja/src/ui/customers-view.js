import { el, icon, button, select } from './elements.js';
import { routeHash } from '../core/router.js';
import { customerTypes, selectCustomers } from '../domain/customers.js';
import { customerEditor, customerMessage } from './customer-editor.js';

export function customersView(snapshot, role, query) {
  const state={search:query.get('search')||'',type:query.get('customer_type')||'',order:query.get('ordering')||'-created_at',page:1,size:25};
  const dialogs=new Set(),watch=modal=>{dialogs.add(modal);modal.addEventListener('close',()=>dialogs.delete(modal),{once:true});};
  const body=el('tbody'),pagination=el('div',{class:'pagination customer-pagination'}),count=el('span',{class:'count'});
  const table=el('table',{class:'customers-table'},el('colgroup',{},['customer','type','phone','email','address','created'].map(name=>el('col',{class:'customer-column-'+name}))),
    el('thead',{},el('tr')),body);
  const render=()=>{
    const result=selectCustomers(snapshot.records,state);state.page=result.page;
    const header=table.querySelector('thead tr');header.replaceChildren();
    for(const [label,key] of [['氏名','last_name'],['種類'],['電話番号'],['メールアドレス'],['基本住所'],['作成日時','created_at']]){
      const direction=state.order===key?'ascending':state.order==='-'+key?'descending':'none';
      const sort=()=>{state.order=state.order===key?'-'+key:key;state.page=1;render();};
      header.append(el('th',key?{'aria-sort':direction}:{},key?button([label,' ',icon(direction==='none'?'sort':direction==='ascending'?'caret-up':'caret-down')],sort,{class:'sort-button','aria-label':label+'で並び替え'}):label));
    }
    body.replaceChildren(...result.rows.map(record=>{
      const detail=()=>routeHash(role,'/customers/'+record.id+'/');
      const phone=el('div',{class:'customer-phone'},el('span',{text:record.phone}),
        el('a',{href:'#',class:'contact-action','aria-label':record.name+'に電話',onclick:event=>event.preventDefault()},icon('phone')),
        button(icon('comment'),()=>watch(customerMessage(record)),{class:'contact-action','aria-label':record.name+'にSMSを送る'}));
      const created=record.createdAt?new Date(record.createdAt).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}):'—';
      return el('tr',{'data-customer-id':record.id},
        el('td',{title:record.name},el('a',{href:detail(),class:'customer-main-name',text:record.name}),record.type==='commercial'?el('small',{class:'customer-contact-name',text:[record.firstName,record.lastName].filter(Boolean).join(' ')}):null),
        el('td',{},el('span',{class:'customer-type '+record.type,text:customerTypes.find(([key])=>key===record.type)?.[1]||record.type})),
        el('td',{},phone),el('td',{title:record.email,text:record.email}),
        el('td',{title:[record.street,record.city].filter(Boolean).join(', '),text:[record.street,record.city].filter(Boolean).join(', ')}),
        el('td',{},el('div',{class:'customer-row-actions'},el('span',{text:created}),
          button(icon('pen'),()=>watch(customerEditor(snapshot.details[record.id])),{class:'edit-customer','aria-label':record.name+'を編集'}),
          record.type==='commercial'?el('a',{href:routeHash(role,'/customers/'+record.id+'/locations/'),class:'customer-locations'},icon('map-marked-alt'),' 訪問先'):null)));
    }));
    if(!result.rows.length)body.append(el('tr',{},el('td',{colspan:6,class:'empty',text:'該当する顧客がいません'})));
    const jump=el('input',{type:'number',min:1,max:result.pages,value:result.page,'aria-label':'ページ',onchange:event=>{state.page=event.target.value;render();},onkeydown:event=>{if(event.key==='Enter'){state.page=event.target.value;render();}}});
    pagination.replaceChildren(button([icon('chevron-left'),' 前へ'],()=>{state.page--;render();},{disabled:result.page===1}),
      'ページ',jump,'／全'+result.pages+'ページ',button(['次へ ',icon('chevron-right')],()=>{state.page++;render();},{disabled:result.page===result.pages}),
      el('label',{},'1ページの表示件数 ',select('1ページの表示件数',[10,25,50,100].map(value=>({value,label:String(value)})),result.size,value=>{state.size=value;state.page=1;render();})),count);
    count.textContent='全'+result.total+'件中 '+result.from+'～'+result.to+'件';
  };
  const node=el('section',{class:'customers-content'},
    el('div',{class:'customer-list-filters'},el('input',{type:'search',value:state.search,'aria-label':'顧客を検索',placeholder:'名前・電話番号・メール・住所で検索',oninput:event=>{state.search=event.target.value;state.page=1;render();}}),
      select('顧客区分',[{value:'',label:'すべての種類'},...customerTypes.map(([value,label])=>({value,label}))],state.type,value=>{state.type=value;state.page=1;render();})),
    el('div',{class:'table-scroll'},table),pagination);
  render();
  return {node,title:'顧客名簿',titleIcon:'users',addLabel:'顧客を追加',add:()=>watch(customerEditor()),mount(){const edit=query.get('edit');if(edit&&snapshot.details[edit])watch(customerEditor(snapshot.details[edit]));},dispose(){for(const modal of dialogs)modal.close();}};
}
