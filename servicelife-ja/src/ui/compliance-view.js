import {el,button,icon} from './elements.js';
import {complianceControls,addLicense} from './compliance-controls.js';
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
  node.append(el('div',{class:'compliance-callout'},'このページには、作成済みの ',el('strong',{text:'州への法令対応報告書'}),' が表示されます。顧客・ユーザー・訪問先・スタッフ・営業所ごとの編集記録を確認するには、こちらを開いてください： ',link('/admin-tools/audit-log/','変更履歴'),'.'),el('form',{class:'compliance-audit-filters',onsubmit:e=>e.preventDefault()},c.field(snapshot.audit.fields,'report_type','報告書の種類'),c.field(snapshot.audit.fields,'start','対象期間の開始日（この日以降）'),c.field(snapshot.audit.fields,'end','対象期間の終了日（この日以前）'),el('button',{type:'submit',class:'primary'},icon('filter'),' 絞り込み')),table(['日時','報告書の種類','対象期間','作成者','行数','SHA-256ハッシュ値'],snapshot.audit.rows.map(r=>el('tr',{},cell(r.timestamp),cell(el('span',{class:'compliance-report-kind',text:r.report})),cell(r.period),cell(r.actor),cell(r.count),el('td',{title:r.digest},r.digestLabel)))),el('div',{class:'compliance-pages'},button('« 前へ',()=>{},{disabled:true}),el('span',{text:'全1ページ中1ページ'}),button('次へ »',()=>{},{disabled:true})));
 }else{
  const copy=reportCopy[kind],data=snapshot.reports[kind];if(!copy||!data)throw new Error('未対応の報告書です。');title=copy.title;node.classList.add('compliance-report');
  const form=el('form',{class:'compliance-report-card',onsubmit:e=>e.preventDefault()},el('h2',{text:'レポートを作成'}),el('p',{class:'compliance-report-intro',text:copy.intro})),grid=el('div',{class:'compliance-report-grid'}),radios=Object.keys(data.fields).filter(k=>data.fields[k].type==='radio');
  for(const [key,d]of Object.entries(data.fields)){if(d.type==='radio')continue;const label=d.name==='start'?'開始日':d.name==='end'?'終了日':d.name==='year'?'年':d.name==='quarter'?'四半期':key.includes('-tech')?'担当スタッフ（任意）':key.includes('-cust')?'顧客（任意）':'製品（任意）';const field=c.field(data.fields,key,label);grid.append(field);
   if(key==='pdax-cust-q'){
    const input=c.inputs[key],menu=el('div',{class:'compliance-search-options',role:'listbox',hidden:true}),wrap=el('div',{class:'compliance-search-wrap'},input,menu);field.append(wrap);
    const close=e=>{if(!e||!wrap.contains(e.target))menu.hidden=true;};document.addEventListener('click',close);cleanups.push(()=>document.removeEventListener('click',close));
    input.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))menu.hidden=true;});
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase(),data=snapshot.customerSearch;input.dataset.selectedId='';const results=q.length<2?[]:Object.hasOwn(data.queries,q)?data.queries[q].map(id=>data.records.find(r=>r.id===id)):data.records.filter(r=>r.search.some(s=>s.toLowerCase().includes(q)));menu.hidden=!results.length;menu.replaceChildren(...results.map(r=>button(r.name+' · '+r.phone,()=>{input.value=r.name;input.dataset.selectedId=r.id;close();},{role:'option'})));});
   }
  }
  if(radios.length)grid.append(el('div',{class:'compliance-field'},el('span',{text:'ファイル形式'}),el('div',{class:'compliance-formats'},radios.map(key=>{const d=data.fields[key];return el('label',{},el('input',{type:'radio',name:d.name,value:d.value,checked:d.checked}),d.value==='xlsx'?' Excelファイル（XLSX）':' '+d.value.toUpperCase());}))));
  form.append(grid,el('footer',{},el('button',{type:'submit',class:'primary'},icon('download'),' '+(radios.length?'レポートをダウンロード':'CSVをダウンロード'))));node.append(form,...copy.notes.map(([heading,text])=>el('article',{class:'compliance-report-note'},el('p',{},el('strong',{text:heading}),' '+text))));
 }
 return {title,titleIcon,node,headerExtra:extra,headerClass:'compliance-header',mount:c.mount,dispose(){c.dispose();cleanups.forEach(fn=>fn());}};
}
