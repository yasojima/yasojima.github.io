import {el,button,icon} from './elements.js';
import {maintenanceBuckets,maintenanceColumns,maintenanceRows} from '../domain/maintenance.js';
const denied='This action is disabled in the read-only demo.';
const operations=[['change_frequency','訪問頻度を変更'],['change_job_type','作業の種類を変更'],['reassign_tech','担当スタッフを変更'],['shift_future','予約日をまとめて移動'],['pause','定期予約を一時停止'],['cancel','定期予約をまとめて取り消す']];
const operationDetails={
 change_frequency:['訪問頻度を変更','New frequency',''],
 change_job_type:['作業の種類を変更','作業の種類を追加',''],
 reassign_tech:['Reassign technician','Assign to technician','Applies to future appointments (scheduled / confirmed / reminded).'],
 shift_future:['Shift appointment dates','Shift by (days, +/-)','Moves all future appointments by this many days. A shift crossing a daylight-saving change can move the time by an hour.'],
 pause:['定期予約を一時停止','','This removes the recurring cadence from the selected location(s); they will no longer show as due. Existing appointments are not changed.'],
 cancel:['定期予約をまとめて取り消す','','This pauses recurring AND cancels every future appointment (scheduled / confirmed / reminded) for the selected location(s). This cannot be undone in bulk.']
};
const choices=(items,attrs={})=>el('select',attrs,items.map(o=>el('option',{value:o.value,text:o.text||o.label,label:o.label||o.text})));
const dateLabel=value=>{const [y,m,d]=value.split('-');return `${y}年${Number(m)}月${Number(d)}日`};
export function maintenanceView(data){
 const state={search:'',frequency:'',type:'',bucket:'',sort:'',direction:1,view:'table'},selected=new Set();let modal=null;
 const node=el('section',{class:'maintenance-content','data-maintenance':''}),cards=el('div',{class:'maintenance-kpis'}),bulk=el('div',{class:'maintenance-bulk',hidden:true}),body=el('tbody',{});
 const checkAll=el('input',{type:'checkbox',id:'mxSelectAll',title:'すべて選択',onchange:()=>{for(const row of visibleRows())checkAll.checked?selected.add(row.location_id):selected.delete(row.location_id);renderRows()}});
 const search=el('input',{id:'mxSearch',type:'search',placeholder:'顧客名・住所・担当者名で検索',oninput:e=>{state.search=e.target.value;renderRows()}});
 const frequency=choices([{value:'',text:'All frequencies',label:'すべての訪問頻度'},...data.frequencies],{id:'mxFreq','aria-label':'訪問頻度',onchange:e=>{state.frequency=e.target.value;renderRows()}});
 const type=choices([{value:'',text:'All types',label:'すべての種類'},{value:'commercial',text:'Commercial',label:'事業所'},{value:'residential',text:'Residential',label:'個人宅'}],{id:'mxCtype','aria-label':'種類',onchange:e=>{state.type=e.target.value;renderRows()}});
 const tableButton=button([icon('table'),' 表形式'],()=>view('table'),{id:'mxViewTable',class:'active'}),mapButton=button([icon('map-marked-alt'),' 地図'],()=>view('map'),{id:'mxViewMap'});
 const map=el('div',{class:'maintenance-map',hidden:true},el('div',{},['訪問密度の分布図','顧客が集中する区域'].map((text,i)=>el('label',{},el('input',{type:'checkbox',checked:true,'aria-label':text}),text))),el('p',{text:'Map unavailable (no Google Maps key configured).'}));
 const table=el('table',{class:'maintenance-table'},el('thead',{},el('tr',{},el('th',{},checkAll),maintenanceColumns.map(([key,label])=>el('th',{'data-k':key,text:label,onclick:()=>{state.direction=state.sort===key?-state.direction:1;state.sort=key;renderRows()}})),el('th',{text:'関連付ける'}),el('th',{text:'顧客への連絡'}))),body);
 const scroll=el('div',{class:'maintenance-table-scroll'},table);
 const outreach=el('div',{class:'maintenance-outreach'},el('strong',{text:'再予約のご案内'}),el('div',{},[['off','非稼働'],['dry_run','変更内容を試算'],['live','実行']].map(([mode,label])=>button(label,()=>{
  if(mode===data.mode)return;
  if(mode==='live'&&!confirm('Switch maintenance rebooking outreach to LIVE? Real SMS/email will be sent to opted-in maintenance customers on the daily schedule.'))return;
  alert('Could not change mode: '+denied);
 },{'data-mode':mode,class:mode===data.mode?'active':''}))),el('span',{text:'案内の配信を一時停止しています。送信予定はありません。'}));
 node.append(cards,el('div',{class:'maintenance-filters'},search,frequency,type,el('div',{class:'maintenance-view-switch'},tableButton,mapButton)),map,outreach,bulk,scroll);
 function visibleRows(){return maintenanceRows(data.rows,state)}
 function view(kind){state.view=kind;map.hidden=kind!=='map';scroll.hidden=kind!=='table';tableButton.classList.toggle('active',kind==='table');mapButton.classList.toggle('active',kind==='map')}
 function renderCards(){cards.replaceChildren(...maintenanceBuckets.map(([key,label],index)=>button([el('b',{text:key?data.rows.filter(r=>r.bucket===key).length:data.rows.length}),el('span',{text:label})],()=>{state.bucket=key;renderCards();renderRows()},{class:'maintenance-kpi kpi-'+index+(state.bucket===key?' active':''),'data-b':key})))}
 function renderBulk(){bulk.hidden=!selected.size;bulk.replaceChildren(el('strong',{text:selected.size+' 選択中'}),...operations.map(([op,label])=>button(label,()=>openBulk(op),{'data-op':op,class:op==='cancel'?'danger':''})),button('選択を解除',()=>{selected.clear();renderRows()},{id:'mxBulkClear',class:'maintenance-clear'}))}
 function editCell(cell,item,kind){
  if(!data.editable||cell.querySelector('input,select'))return;
  const input=kind==='fee'?el('input',{type:'text',value:item.recurring_fee??'',class:'maintenance-inline-input','aria-label':'定期料金'}):choices(kind==='frequency'?data.frequencies:[{value:'',text:'— none —',label:'— なし —'},...data.jobTypes.map(o=>({value:o.id,text:o.label}))],{class:'maintenance-inline-input','aria-label':kind==='frequency'?'頻度':'種類'});
  if(kind!=='fee')input.value=kind==='frequency'?item.frequency:item.job_type_id;
  let ended=false;const done=save=>{if(ended)return;ended=true;if(save)alert('Update failed: '+denied);renderRows()};
  input.addEventListener('click',e=>e.stopPropagation());
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();done(false)}else if(e.key==='Enter'){e.preventDefault();done(true)}});
  input.addEventListener('change',()=>{if(kind!=='fee')done(true)});
  input.addEventListener('blur',()=>done(false));
  cell.replaceChildren(input);input.focus();if(kind==='fee')input.select();
 }
 function renderRows(){
  const rows=visibleRows();checkAll.checked=!!rows.length&&rows.every(r=>selected.has(r.location_id));checkAll.indeterminate=false;
  body.replaceChildren(...(rows.length?rows.map(item=>{
   const rowCheck=el('input',{type:'checkbox',checked:selected.has(item.location_id),'data-loc':item.location_id,'aria-label':item.customer_name+'を選択',onchange:()=>{rowCheck.checked?selected.add(item.location_id):selected.delete(item.location_id);renderRows()}});
   const job=el('td',{class:'maintenance-edit-jt',text:item.jobLabel}),freq=el('td',{class:'maintenance-edit-freq',text:item.frequencyLabel});
   const fee=el('td',{class:'maintenance-edit-fee'},'$'+Number(item.recurring_fee).toFixed(2)+' ',el('span',{class:'maintenance-pencil',title:'手動で変更',text:'✎'}),' ',el('small',{text:'・年間 $'+Number(item.annual_value).toLocaleString('en-US')}));
   job.addEventListener('click',()=>editCell(job,item,'job'));freq.addEventListener('click',()=>editCell(freq,item,'frequency'));fee.addEventListener('click',()=>editCell(fee,item,'fee'));
   const sendStatus=el('span',{class:'maintenance-send-status'}),send=button('リンクを送る',()=>{if(confirm('Send a booking link to '+item.customer_name+'? This will text or email the customer now.'))sendStatus.textContent='error: '+denied},{class:'maintenance-send'});
   return el('tr',{'data-location':item.location_id},el('td',{},rowCheck),el('td',{class:'maintenance-customer',text:item.customer_name}),el('td',{text:item.rep_sold||'—'}),el('td',{},el('span',{class:'maintenance-address',text:item.address})),job,freq,fee,el('td',{text:item.last_service||'—'}),el('td',{text:item.last_payment||'—'}),el('td',{text:item.next_due||'—'}),el('td',{class:item.next_appointment?'maintenance-next':'',text:item.next_appointment||'—'}),el('td',{text:item.has_upcoming?dateLabel(item.next_appointment)+' 予約済み':`in ${item.days_until_due}d`}),el('td',{},el('span',{class:'maintenance-badge '+item.bucket,text:maintenanceBuckets.find(([key])=>key===item.bucket)?.[1]||item.bucket})),el('td',{},send,sendStatus),el('td',{text:'—'}));
  }):[]));renderBulk();
  empty.hidden=!!rows.length;
 }
 function openBulk(op){
  const [title,label,note]=operationDetails[op],content=el('div',{class:'maintenance-modal-body'});let param;
  if(op==='change_frequency')param=choices(data.frequencies,{id:'mxParam'});
  if(op==='change_job_type')param=choices([{value:'',text:'(none)'},...data.jobTypes.map(r=>({value:r.id,text:r.label}))],{id:'mxParam'});
  if(op==='reassign_tech')param=choices(data.technicians.map(r=>({value:r.id,text:r.name})),{id:'mxParam'});
  if(op==='shift_future')param=el('input',{id:'mxParam',type:'number',value:7,step:1});
  if(param)content.append(el('label',{},label,param));if(note)content.append(el('p',{text:note}));content.append(el('div',{class:'maintenance-preview-error',text:'Cannot preview: '+denied}));
  const own=el('dialog',{class:'maintenance-modal','aria-label':title},el('h2',{text:title}),content,el('footer',{},button('キャンセル',()=>own.close(),{id:'mxModalCancel'}),button('適用',()=>{},{id:'mxModalApply',class:'primary',disabled:true})));
  own.addEventListener('close',()=>{own.remove();if(modal===own)modal=null},{once:true});own.addEventListener('click',e=>{if(e.target!==own)return;const r=own.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)own.close()});modal=own;node.append(own);own.showModal();
 }
 const empty=el('div',{class:'maintenance-empty',text:'該当するお客様は見つかりませんでした。'});scroll.append(empty);
 renderCards();renderRows();return{title:'定期メンテナンス',titleIcon:'sync-alt',headerClass:'maintenance-header',headerExtra:el('small',{text:'継続利用のお客様'}),node,mount(){},dispose(){modal?.close()}};
}
