import {el, button, icon} from './elements.js';
import {readOnly, unavailable} from './calendar-common.js';
import {recurrenceFields} from './calendar-recurrence.js';

function serviceList(common, selected, id) {
  return el('div',{class:'cal-service-list',id},common.services.map(s=>el('label',{},
    el('input',{type:'checkbox',value:s.id,checked:selected.includes(s.id)}),' ',
    s.name==='3か月ごとの定期メンテナンス'?`定期メンテナンス（3か月ごと・${s.duration}分）`:(s.name==='害獣の捕獲・撤去'?'野生動物の除去':s.name)+`（${s.duration}分）`)));
}
function staffSelect(ctx,common,id,value,extra) {
  const options=[{id:'',name:'Auto-assign'},...common.staff];
  if(extra&&!options.some(p=>p.id===extra.id))options.push(extra);
  const input=el('select',{id},options.map(s=>el('option',{value:s.id,...(!s.id?{label:'自動で割り当て'}:{})},s.name)));input.value=value||'';return input;
}
function crewFields(ctx,prefix,detail={}){
  const edit=prefix==='ea',crew=ctx.input(edit?'ea-crew':'bCrew',detail.crew||1),multiple=ctx.input(edit?'ea-multiday':'bMultiDay',detail.multiday),hours=ctx.input(edit?'ea-total-hrs':'bTotalHrs',detail.workMinutes?detail.workMinutes/60:8);
  const extra=el('div',{},ctx.field('合計作業時間',hours),el('small',{text:'時間（作業日ごとに自動配分）'}));extra.hidden=!multiple.checked;multiple.addEventListener('change',()=>extra.hidden=!multiple.checked);
  return [ctx.field('現場に入る人数',el('div',{class:'cal-inline'},crew,'名')),el('div',{},el('label',{},multiple,' 複数日にわたる作業'),extra)];
}
function cancellation(ctx){
  const modal=ctx.popup('Cancel this appointment?','cal-cancel');
  const reason=ctx.input('cbpCrCode'),comment=ctx.input('cbpCrComment'),error=el('p',{class:'error',hidden:true});
  reason.addEventListener('change',()=>{error.hidden=true;commentLabel.firstChild.textContent=reason.value==='other'?'メモ *':'メモ';});
  const commentLabel=ctx.field('メモ',comment);
  modal.body.append(el('p',{text:'Pick a reason so we can learn from cancellations.'}),ctx.field('理由 *',reason),commentLabel,error);
  modal.foot.append(button('Keep appointment',modal.close,{id:'cbpCrBack'}),button('予約を取り消す',()=>{
    if(!reason.value){error.textContent='Please select a reason.';error.hidden=false;return;}
    if(reason.value==='other'&&!comment.value.trim()){error.textContent='A note is required when choosing Other.';error.hidden=false;return;}
    modal.close();ctx.toast('Could not cancel: '+readOnly);
  },{id:'cbpCrGo',class:'danger'}));
}
export function calendarEditor(ctx, common, appointment){
  const {data,input,field}=ctx, detail=data.details[appointment.id];
  if(!detail){ctx.toast(unavailable);return;}
  const person=data.customers[appointment.customerId], modal=ctx.popup(appointment.customerName);
  modal.box.id='editApptModal';
  const statusLabel=(data.forms['ea-status'].options.find(s=>s.value===appointment.status)||{}).label||appointment.status;
  modal.head.insertBefore(el('span',{class:'status completed',text:statusLabel}),modal.head.lastChild);
  const tabs=el('div',{class:'cal-modal-tabs'}),details=el('div',{class:'cal-form-grid',id:'ea-panel-details'}),reschedule=el('div',{hidden:true}),contracts=el('div',{hidden:true});
  modal.body.before(tabs);modal.body.append(details,reschedule,contracts);
  const modes=[['details','詳細',details],['reschedule','日時変更',reschedule],['contracts','契約管理',contracts]];
  modes.forEach(([id,label,panel])=>tabs.append(button(label,()=>{for(const [key,,pane]of modes)pane.hidden=key!==id;tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.id==='ea-tab-'+id));},{id:'ea-tab-'+id,class:id==='details'?'active':''})));
  const heading=text=>el('h3',{class:'cal-wide',text});
  const customerKeys=[['first','名','text'],['last','姓','text'],['phone','電話番号','text'],['email','メールアドレス','email'],['addr','基本住所','text']];
  details.append(heading('お客様'),...customerKeys.map(([key,label])=>field(label,input('ea-cust-'+key,key==='addr'?person.street:person[key]),key==='addr')),heading('予約内容'));
  const staff=data.days[appointment.date].find(t=>t.id===appointment.staffId);
  details.append(field('担当スタッフ',staffSelect(ctx,common,'ea-tech',appointment.staffId,staff)),field('作業の種類（複数選択可）',serviceList(common,detail.services,'ea-jobtype')));
  const date=ctx.date('ea-date',appointment.date,()=>recurrence.update()),time=input('ea-time',appointment.start);
  const recurrence=recurrenceFields(ctx,'ea',()=>date.control.value||appointment.date,detail);
  details.append(field('日付',date.control),field('開始時刻',time),field('所要時間（分）',input('ea-dur',appointment.duration)),field('対応状況',input('ea-status',appointment.status)),recurrence.node);
  const crew=crewFields(ctx,'ea',detail);details.append(crew[0],crew[1],field('料金（税抜）',el('div',{},el('div',{class:'cal-inline'},'$',input('ea-price',detail.price)),el('small',{text:'税抜の作業料金小計'}))));
  const locations=el('select',{id:'ea-service-loc'},el('option',{value:'',label:'登録済みの基本住所を使う'},'Use primary service address'),person.locations.map(l=>el('option',{value:l.id},l.name+' - '+l.street)),el('option',{value:'__new__',label:'＋ 訪問先を追加…'},'+ Add a new site...'));
  const street=input('ea-loc',appointment.address),unit=input('ea-loc2',detail.unit),access=input('ea-site-access'),special=input('ea-site-special');
  const newSite=el('div',{class:'cal-new-site cal-wide',hidden:true});
  const newFields=[['eaNewSiteName','訪問先の名称',''],['eaNewSiteAddr','番地・通り名',person.street],['eaNewSiteAddr2','部屋番号・区画番号',''],['eaNewSiteCity','市区町村',''],['eaNewSiteState','州','PA'],['eaNewSiteZip','郵便番号','']];
  newSite.append(el('b',{text:'新しい訪問先（次回も使えるよう、この顧客に登録）'}),el('div',{class:'cal-form-grid'},newFields.map(([id,label,value])=>field(label,input(id,value)))));
  locations.addEventListener('change',()=>{
    const location=person.locations.find(l=>l.id===locations.value);newSite.hidden=locations.value!=='__new__';
    if(location){street.value=location.street;unit.value=location.unit;access.value=location.access;special.value=location.instructions;}
    if(!locations.value)street.value=person.street;
  });
  details.append(field('訪問先',el('div',{},locations,el('small',{text:'登録済みの訪問先を選ぶと、下の現場住所に反映されます。'})),true),newSite,
    field('現場住所',street,true),field('部屋番号・区画番号',unit,true),el('p',{class:'cal-wide cal-help',text:'担当スタッフに表示されるのはこの住所です。今回の現場が基本住所と異なる場合だけ変更してください。'}),
    heading('訪問先の共通情報 （この訪問先でのすべての作業に適用）'),field('入場方法（訪問先で共通）',access,true),field('注意事項（訪問先で共通）',special,true),heading('今回の訪問'),
    field('今回の作業メモ （事務所・現場スタッフで共有）',input('ea-jobnotes',detail.notes),true),field('入場方法（今回のみ）',input('ea-visitaccess',detail.visitAccess),true),field('社内メモ （スタッフ専用・お客様には非表示）',input('ea-repnotes',detail.privateNotes),true));
  const from=ctx.date('ea-rs-from',appointment.date),result=el('p',{text:'「検索」を押すと空き枠が表示されます。'});
  reschedule.append(el('div',{class:'cal-form-grid'},field('検索開始日',from.control),field('検索する日数',input('ea-rs-days','5')),field('所要時間（分）',input('ea-rs-dur',appointment.duration))),button('検索',()=>{result.textContent='No slots found.'},{class:'primary'}),result);
  contracts.append(el('p',{text:'失敗'}),field('登録済みの契約を予約に関連付ける',input('ea-contract-pick')),button('関連付ける',()=>ctx.toast('Select a contract first.')));
  modal.foot.append(button('予約を取り消す',()=>cancellation(ctx),{id:'eaCancelApptBtn'}),button('削除',()=>{if(confirm('Delete this appointment? It will be hidden from the calendar. Recoverable by an admin.'))ctx.toast('Could not delete: '+readOnly)},{id:'eaDeleteApptBtn',class:'danger',title:'この予約を削除（管理者が復元できます）'}),button('完了にする',()=>ctx.toast('Could not mark complete: '+readOnly),{id:'eaCompleteBtn'}),button('閉じる',modal.close),button('変更を保存',()=>ctx.toast('Save failed: '+readOnly),{id:'eaSaveBtn',class:'primary'}));
  date.activate();from.activate();return modal;
}

export function calendarCreate(ctx, common, preset={}){
  const modal=ctx.popup('予約を追加'),{input,field}=ctx;modal.box.id='calendar-create';
  const grid=el('div',{class:'cal-form-grid'});modal.body.append(grid);
  let customer=preset.customer||null;
  const search=input('bCust'),found=el('div',{class:'cal-customer-results',hidden:true}),tag=el('div',{class:'cal-customer-chosen',hidden:true});
  const street=input('bLoc',preset.address||''),unit=input('bLoc2');
  const contactName=input('bSiteContactName'),contactPhone=input('bSiteContactPhone'),contactEmail=input('bSiteContactEmail'),contactRole=input('bSiteContactRole');
  const site=input('bServiceLoc'),siteRow=field('訪問先',el('div',{},site,el('small',{text:'登録済みの訪問先を選ぶと、下の現場住所に反映されます。'})),true),newSite=el('div',{class:'cal-new-site cal-wide',hidden:true});siteRow.hidden=true;
  const siteInputs={};
  newSite.append(el('b',{text:'新しい訪問先（次回も使えるよう、この顧客に登録）'}),el('div',{class:'cal-form-grid'},[['Name','訪問先の名称'],['Addr','番地・通り名'],['Addr2','部屋番号・区画番号'],['City','市区町村'],['State','州'],['Zip','郵便番号']].map(([key,label])=>{siteInputs[key]=input('bNewSite'+key,key==='State'?'PA':'');return field(label,siteInputs[key])})));
  site.addEventListener('change',()=>{newSite.hidden=site.value!=='__new__';if(site.value==='__new__')siteInputs.Addr.value=street.value;else street.value=customer?.street||''});
  const choose=person=>{customer=person;search.hidden=true;found.hidden=true;tag.hidden=false;siteRow.hidden=false;site.value='';tag.replaceChildren(el('span',{text:person.name+' — '+person.phone}),button('×',()=>{customer=null;search.hidden=false;tag.hidden=true;siteRow.hidden=true;newSite.hidden=true;search.value=''}));street.value=person.street||person.address;};
  search.addEventListener('input',()=>{found.hidden=search.value.length<2;found.replaceChildren(...ctx.data.searchCustomers.filter(c=>[c.name,c.phone,c.address].join(' ').toLowerCase().includes(search.value.toLowerCase())).slice(0,5).map(c=>button([el('b',{text:c.name}),' '+c.phone+' '+(c.kind==='commercial'?'事業所':'個人宅'),el('small',{text:c.street+', '+c.city})],()=>choose(c))))});
  const newToggle=input('bNewCustToggle',false),newPanel=el('section',{class:'cal-new-site cal-wide',hidden:true}),newInputs={};
  const type=input('bNewType','residential'),property=input('bNewPropType','house');
  const company=field('会社名（必須）',input('bNewCompany'),true);newInputs.bNewCompany=company.querySelector('input');company.hidden=true;
  const newGrid=el('div',{class:'cal-form-grid'},field('顧客区分',type),field('物件の種類',property),company);
  for(const[id,label]of [['bNewFirst','名（必須）'],['bNewLast','姓（必須）'],['bNewPhone','電話番号（必須）'],['bNewEmail','メールアドレス'],['bNewAddr','基本住所'],['bNewAddr2','部屋番号・区画番号']]){newInputs[id]=input(id);newGrid.append(field(label,newInputs[id],id==='bNewAddr'));}
  newPanel.append(el('b',{text:'顧客を追加'}),newGrid);
  type.addEventListener('change',()=>{property.replaceChildren(...ctx.data.propertyOptions[type.value].map(o=>el('option',{value:o.value,label:o.label},o.text)));property.value=type.value==='commercial'?'office':'house';company.hidden=type.value!=='commercial'});
  newToggle.addEventListener('change',()=>{newPanel.hidden=!newToggle.checked;search.hidden=newToggle.checked||!!customer;tag.hidden=newToggle.checked||!customer;siteRow.hidden=newToggle.checked||!customer;newSite.hidden=true;found.hidden=true});
  grid.append(field('お客様',el('div',{class:'cal-customer'},el('div',{class:'cal-inline'},search,el('label',{class:'cal-checkbox'},newToggle,' 新規')),tag,found)),newPanel,siteRow,newSite,field('担当スタッフ',staffSelect(ctx,common,'bTech',preset.staffId)),field('作業の種類（複数選択可）',serviceList(common,preset.serviceId?[preset.serviceId]:[],'bJobType'),true),field('現場',street),field('部屋番号・区画番号',unit));
  const date=ctx.date('bDate',preset.date||ctx.data.today,()=>recurrence.update()),recurrence=recurrenceFields(ctx,'b',()=>date.control.value||ctx.data.today);
  grid.append(field('日付',date.control),field('開始時刻',input('bTime',preset.time||'09:00')),field('所要時間（分）',input('bDur',preset.duration||30)),recurrence.node,
    el('h3',{class:'cal-wide',text:'現場・入居者の連絡先 （任意。顧客情報から自動入力され、訪問ごとに変更できます）'}),field('連絡先の氏名',contactName),field('連絡先の電話番号',contactPhone),field('連絡先のメールアドレス',contactEmail),field('連絡先の方の立場',contactRole),...crewFields(ctx,'b'),
    field('料金（税抜）',el('div',{},el('div',{class:'cal-inline'},'$',input('bPrice')),el('small',{text:'作業料金の税抜小計です。税は請求書の発行時または決済時に加算します。'})),true),
    ...[['bSiteAccess','入場方法（訪問先で共通）'],['bNotes','今回の作業メモ （事務所・現場スタッフで共有）'],['bVisitAccess','入場方法（今回のみ）'],['bRepNotes','社内メモ （スタッフ専用・お客様には非表示）']].map(([id,label])=>field(label,input(id),true)));
  const contract=input('bGenContract',false),contractFields=el('div',{class:'cal-wide',hidden:true}),rows=el('div');
  function contractRow(){
    const row=el('div',{class:'cal-contract-row'},el('select',{'aria-label':'契約テンプレート'},el('option',{value:''},'Select template...')),button(icon('trash'),()=>row.remove(),{title:'削除'}),el('div',{class:'cal-contract-fees'},['初回料金','定期料金','One-Time Fee'].map(label=>field(label,el('div',{class:'cal-inline'},'$',el('input',{type:'number',step:'.01',value:0}))))));rows.append(row);
  }
  contract.addEventListener('change',()=>{contractFields.hidden=!contract.checked;if(contract.checked&&!rows.children.length)contractRow()});
  contractFields.append(button([icon('plus'),' 契約を追加'],()=>{},{id:'btnAddContract'}),rows);
  grid.append(el('label',{class:'cal-wide'},contract,' 契約書を作成'),contractFields);
  modal.foot.append(button('キャンセル',modal.close),button('作成',()=>{
    if(newToggle.checked){
      if(['bNewFirst','bNewLast','bNewPhone'].some(id=>!newInputs[id].value.trim()))return ctx.toast('New customer requires first name, last name, and phone');
      if(type.value==='commercial'&&!newInputs.bNewCompany.value.trim())return ctx.toast('Company name required for commercial customers');
      return ctx.toast('Customer creation failed: '+readOnly);
    }
    if(customer){modal.foot.lastChild.textContent='Saving...';}
    ctx.toast(customer?'Could not create appointment: '+readOnly:'Please select a customer (or toggle New Customer)');
  },{id:'apptCreateBtn',class:'primary'}));
  if(customer)choose(customer);date.activate();return modal;
}
