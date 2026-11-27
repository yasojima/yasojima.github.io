import {el,button,icon} from './elements.js';
import {complianceControls,addLicense} from './compliance-controls.js';
import {localReportDocument} from './local-report-document.js';
import {reportExamples,filterReport} from '../domain/compliance-report.js';
import {reportCopy} from './compliance-content.js';
const link=(path,text)=>el('a',{href:'#'+path},text);
const table=(heads,rows)=>el('div',{class:'compliance-table-scroll'},el('table',{},el('thead',{},el('tr',{},heads.map(text=>el('th',{text})))),el('tbody',{},rows)));
const cell=(text)=>el('td',{},text);
export function complianceView(snapshot,path){
 const kind=path==='/licenses/'?'licenses':path.slice('/compliance/'.length).replace(/\/$/,''),c=complianceControls(),node=el('section',{class:'compliance compliance-'+kind.replaceAll('/','-'),'data-compliance':kind}),cleanups=[];let title,extra=null,titleIcon='file-export';
 if(kind==='licenses'){
  title='資格・許可証';titleIcon='id-card-alt';extra=el('small',{class:'compliance-header-meta',text:'資格'+snapshot.licenses.length+'件'});
  const filters=el('div',{class:'compliance-license-filters'}),rows=el('div');
  const render=(failed=false)=>rows.replaceChildren(table(['担当スタッフ','州・許可番号','分類','等級','有効期限','期限までの残り日数','対応状況',''],failed?[el('tr',{},el('td',{colspan:8,text:'Could not load licenses.'}))]:snapshot.licenses.map(r=>el('tr',{},cell(r.technician),cell(r.state+' · '+r.number),cell(r.category),cell(r.tierLabel),cell(r.expires),cell(r.days),cell(el('span',{class:'compliance-status',text:'有効（'+r.days+'日）'})),cell(link('/compliance/licenses/'+r.id+'/edit/','更新・編集 ›'))))));
  for(const key of ['search','filterState','filterStatus','filterCategory','filterTechnician']){const field=c.field(snapshot.fields,key,'');filters.append(c.inputs[key]);c.inputs[key].setAttribute('aria-label',key==='search'?'資格を検索':({'filterState':'州','filterStatus':'対応状況','filterCategory':'分類','filterTechnician':'担当スタッフ'})[key]);c.inputs[key].addEventListener(key==='search'?'input':'change',()=>render(['search','filterState','filterStatus','filterCategory','filterTechnician'].some(k=>!!c.inputs[k].value)));}
  filters.append(button([icon('plus'),' 資格・許可証を追加'],()=>addLicense(snapshot.fields),{class:'primary'}));node.append(filters,rows);render();
 }else if(kind.startsWith('licenses/')&&kind.endsWith('/edit')){
  const id=kind.split('/')[1],r=snapshot.licenses.find(x=>x.id===id);if(!r)throw new Error('資格レコードがありません。');title='Edit License';titleIcon='id-card-alt';
  const grid=el('div',{class:'compliance-edit-grid'},el('div',{class:'compliance-field'},el('span',{text:'担当スタッフ'}),el('strong',{text:r.technician})),el('div',{class:'compliance-field'},el('span',{text:'分類'}),el('strong',{text:r.category})));
  for(const [key,label]of [['le-license-number','LICENSE NUMBER'],['le-tier','LICENSE TIER'],['le-issued','ISSUED DATE'],['le-expires','EXPIRY DATE'],['le-status','対応状況'],['le-supervisor','SUPERVISOR (REQUIRED FOR REGISTERED TECHNICIAN TIER)'],['le-notes','メモ']]){const field=c.field(r.editFields,key,label);if(key==='le-notes')field.classList.add('wide');grid.append(field);}
  node.append(el('form',{class:'compliance-edit-card',onsubmit:e=>e.preventDefault()},el('h2',{text:'License details'}),grid,el('footer',{},link('/licenses/','キャンセル'),el('button',{type:'submit',class:'primary'},'変更を保存'))));
 }else if(kind==='licenses/expiring'||kind==='inventory/low-stock'){
  const license=kind==='licenses/expiring';title=license?'更新期限が近い資格・許可証':'在庫が少ない防除用薬剤';titleIcon=license?'hourglass-half':'boxes';extra=link(license?'/licenses/':'/inventory/',[icon(license?'id-card-alt':'boxes'),' '+(license?'すべての資格':'在庫')]);extra.className='compliance-summary-link';
  node.append(el('div',{class:'compliance-summary'},(license?['期限切れ','14日以内','15〜30日','31〜60日']:['在庫切れ','基準値の50％未満','基準値の75％未満','基準値以下']).map(label=>el('article',{},el('strong',{text:'0'}),el('span',{text:label})))),el('div',{class:'compliance-empty'},icon('shield-alt'),el('p',{text:license?'60日以内に更新期限を迎える資格はありません。':'発注点を下回った薬剤はありません。'})));
 }else if(kind==='audit-log'){
  title='法令関連レポートの作成履歴';titleIcon='history';extra=link('/admin-tools/audit-log/','顧客・スタッフ・予約などの変更履歴');extra.className='compliance-summary-link';
  const result=el('div'),status=el('p',{role:'status'});
  const draw=()=>{const selected=c.inputs.report_type.selectedOptions[0],label=selected?.label||'',start=c.inputs.start.value,end=c.inputs.end.value;const rows=snapshot.audit.rows.filter(r=>(!selected.value||r.report===label)&&(!start||r.timestamp.slice(0,10)>=start)&&(!end||r.timestamp.slice(0,10)<=end));status.textContent='該当 '+rows.length+'件';result.replaceChildren(table(['日時','報告書の種類','対象期間','作成者','行数','SHA-256ハッシュ値'],rows.length?rows.map(r=>el('tr',{},cell(r.timestamp),cell(r.report),cell(r.period),cell(r.actor),cell(r.count),el('td',{title:r.digest},r.digestLabel))):[el('tr',{},el('td',{colspan:6,text:'条件に一致する作成履歴はありません。'}))]));};
  node.append(el('div',{class:'compliance-callout'},'報告書の出力履歴です。',link('/admin-tools/audit-log/','顧客・スタッフ・予約の変更履歴')),el('form',{class:'compliance-audit-filters',onsubmit:e=>{e.preventDefault();draw()}},c.field(snapshot.audit.fields,'report_type','報告書の種類'),c.field(snapshot.audit.fields,'start','対象期間の開始日（この日以降）'),c.field(snapshot.audit.fields,'end','対象期間の終了日（この日以前）'),el('button',{type:'submit',class:'primary'},icon('filter'),' 絞り込み')),status,result);draw();
 }else{
  const copy=reportCopy[kind],data=snapshot.reports[kind];if(!copy||!data)throw new Error('未対応の報告書です。');title=copy.title;node.classList.add('compliance-report');
  const form=el('form',{class:'compliance-report-card',onsubmit:exportLocal},el('h2',{text:'レポートを作成'}),el('p',{class:'compliance-report-intro',text:copy.intro})),grid=el('div',{class:'compliance-report-grid'}),radios=Object.keys(data.fields).filter(k=>data.fields[k].type==='radio');
  for(const [key,d]of Object.entries(data.fields)){if(d.type==='radio')continue;const label=d.name==='start'?'開始日':d.name==='end'?'終了日':d.name==='year'?'年':d.name==='quarter'?'四半期':key.includes('-tech')?'担当スタッフ（任意）':key.includes('-cust')?'顧客（任意）':'製品（任意）';const field=c.field(data.fields,key,label);grid.append(field);
   if(key==='pdax-cust-q'){
    const input=c.inputs[key],menu=el('div',{class:'compliance-search-options',role:'listbox',hidden:true}),wrap=el('div',{class:'compliance-search-wrap'},input,menu);field.append(wrap);
    const close=e=>{if(!e||!wrap.contains(e.target))menu.hidden=true;};document.addEventListener('click',close);cleanups.push(()=>document.removeEventListener('click',close));
    input.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))menu.hidden=true;});
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase(),data=snapshot.customerSearch;input.dataset.selectedId='';const results=q.length<2?[]:Object.hasOwn(data.queries,q)?data.queries[q].map(id=>data.records.find(r=>r.id===id)):data.records.filter(r=>r.search.some(s=>s.toLowerCase().includes(q)));menu.hidden=!results.length;menu.replaceChildren(...results.map(r=>button(r.name+' · '+r.phone,()=>{input.value=r.name;input.dataset.selectedId=r.id;close();},{role:'option'})));});
   }
  }
  if(radios.length)grid.append(el('div',{class:'compliance-field'},el('span',{text:'ファイル形式'}),el('div',{class:'compliance-formats'},radios.map(key=>{const d=data.fields[key];return el('label',{},el('input',{type:'radio',name:d.name,value:d.value,checked:d.checked}),d.value==='xlsx'?' Excelファイル（XLSX）':' '+d.value.toUpperCase());}))));
  const examples=reportExamples(snapshot,kind),status=el('p',{role:'status',class:'compliance-report-intro',text:'操作確認用の架空データ3件。条件に合う見本を、この端末で帳票にします。'});
  async function exportLocal(event){
   event.preventDefault();const values={};for(const [key,input] of Object.entries(c.inputs)){const name=data.fields[key].name;values[name||key]=input.value;if(key.includes('-tech'))values.technician_id=input.value;if(key.includes('-cust'))values.customer_id=input.dataset.selectedId||input.value;if(key.includes('-prod'))values.product_id=input.value;}
   try{const result=filterReport(examples,values),format=form.querySelector('input[name="format"]:checked')?.value||'csv';status.textContent='対象 '+result.rows.length+'件（操作確認用の見本）';await localReportDocument({title:copy.title,filename:'sukimakun-'+kind.replaceAll('/','-'),columns:['記録ID','使用日','担当スタッフ','お客様','製品（見本）','数量（L）'],rows:result.rows.map(r=>[r.id,r.date,r.staff,r.customer,r.product,r.quantity]),summary:['対象期間: '+(result.start||'指定なし')+' - '+(result.end||'指定なし'),'対象 '+result.rows.length+'件'],format});}catch(error){status.textContent=error.message;}
  }
  form.append(status);
  form.append(grid,el('footer',{},el('button',{type:'submit',class:'primary'},icon('download'),' '+(radios.length?'レポートをダウンロード':'CSVをダウンロード'))));node.append(form,...copy.notes.map(([heading,text])=>el('article',{class:'compliance-report-note'},el('p',{},el('strong',{text:heading}),' '+text))));
 }
 return {title,titleIcon,node,headerExtra:extra,headerClass:'compliance-header',mount:c.mount,dispose(){c.dispose();cleanups.forEach(fn=>fn());}};
}
