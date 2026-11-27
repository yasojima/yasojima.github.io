import { el, button, select, dialog } from './elements.js';
import { customerTypes, propertyTypes, leadSources } from '../domain/customers.js';
import { refuseMutation } from '../domain/bookings.js';

export function customerEditor(record = null) {
  const values = record || {type:'residential',propertyType:'house',state:'PA',billingState:'PA'};
  const form=el('form',{class:'customer-form',autocomplete:'off'}),grid=el('div',{class:'form-grid'});
  const controls={},fields={};
  function field(key,label,{id,wide=false,type='text',required=false,placeholder='',choices,change=()=>{}}={}){
    const identifier=id||'customer-'+key;
    const input=choices?select(label,choices.map(([value,label])=>({value,label})),values[key]||'',change,{id:identifier}):
      el(type==='textarea'?'textarea':'input',{id:identifier,...(type==='textarea'?{}:{type}),value:values[key]||'',placeholder,...(required?{required:''}:{})});
    const wrapper=el('div',{class:'field'+(wide?' wide':'')},el('label',{for:identifier,text:label}),input);
    grid.append(wrapper);controls[key]=input;fields[key]=wrapper;return input;
  }
  field('type','顧客区分',{id:'fType',choices:customerTypes,change:value=>{
    const options=propertyTypes[value];controls.propertyType.replaceChildren(...options.map(([value,label])=>el('option',{value},label)));
    controls.propertyType.value=value==='commercial'?'office':'house';updateCompany();
  }});
  field('propertyType','物件の種類',{id:'fPropType',choices:propertyTypes[values.type]||propertyTypes.residential});
  if (!controls.propertyType.value) controls.propertyType.value=values.type==='commercial'?'office':'house';
  field('company','会社名',{id:'fCompany',wide:true,required:true});
  field('firstName','名',{id:'fFirst',required:true});field('lastName','姓',{id:'fLast',required:true});
  field('phone','電話番号',{id:'fPhone',type:'tel',required:true});field('email','メールアドレス',{id:'fEmail',type:'email'});
  field('street','基本住所',{id:'fAddr',required:true,placeholder:'例：123 Main St'});
  field('unit','部屋番号・区画番号',{id:'fAddr2',placeholder:'例：4B号室、200号室など'});
  field('city','市区町村（必須）',{id:'fCity',required:true});field('state','州',{id:'fState'});field('postcode','郵便番号（必須）',{id:'fZip',required:true});
  field('notes','メモ',{id:'fNotes',type:'textarea',wide:true,placeholder:'顧客メモ（門の暗証番号、ペット、請求方法の希望など）'});
  field('leadSource','問い合わせのきっかけ',{id:'fLeadSource',choices:leadSources});
  field('leadDetail','問い合わせ経路の詳細',{id:'fLeadDetail',placeholder:'任意'});
  fields.leadDetail.querySelector('label').append(el('small',{text:' 紹介者名やキャンペーン名など'}));
  const checks=el('div',{class:'customer-checks wide'});
  for(const [key,id,label] of [['doNotCall','fDoNotCall','電話連絡を希望しない'],['doNotEmail','fDoNotEmail','メール連絡を希望しない'],
    ['smsOptOut','fSmsOptOut','SMSの受信を停止中'],['taxExempt','fTaxExempt','免税対象'],['billingDifferent','fBillDiff','請求先が現場住所と異なる']]){
    const checkbox=el('input',{id,type:'checkbox',checked:!!values[key],onchange:()=>{if(key==='billingDifferent')updateBilling();}});
    controls[key]=checkbox;checks.append(el('label',{},checkbox,' '+label));
  }
  grid.append(checks);
  field('billingStreet','請求先住所',{id:'fBillAddr'});field('billingUnit','部屋番号・区画番号',{id:'fBillAddr2'});
  field('billingCity','請求先の市区町村',{id:'fBillCity'});field('billingState','請求先の州',{id:'fBillState'});field('billingPostcode','請求先の郵便番号',{id:'fBillZip'});
  function updateCompany(){const visible=controls.type.value==='commercial';fields.company.hidden=!visible;controls.company.required=visible;}
  function updateBilling(){for(const key of ['billingStreet','billingUnit','billingCity','billingState','billingPostcode'])fields[key].hidden=!controls.billingDifferent.checked;}
  updateCompany();updateBilling();
  const error=el('p',{role:'alert',class:'error wide',hidden:true});form.append(grid,error);
  const modal=dialog(record?'Edit Customer':'顧客を追加',form);modal.classList.add('customer-dialog');
  modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button('保存',()=>{
    if(!form.reportValidity())return;
    error.textContent=refuseMutation().message;error.dataset.status='403';error.hidden=false;error.scrollIntoView({block:'nearest'});
  },{class:'primary'}));
  return modal;
}

export function customerMessage(record){
  const textarea=el('textarea',{id:'csBody',rows:5,'aria-label':'メッセージ'}),error=el('p',{role:'alert',class:'error',hidden:true});
  const body=el('div',{},el('p',{class:'sms-to',text:'To '+record.phone}),el('label',{for:'csBody',text:'メッセージ'}),textarea,error);
  const modal=dialog('お客様にSMSを送る',body);modal.classList.add('customer-sms');
  modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button('送信',()=>{
    error.textContent=textarea.value.trim()?refuseMutation().message:'メッセージを入力してください。';error.hidden=false;
    error.dataset.status=textarea.value.trim()?'403':'400';
  },{class:'primary'}));
  return modal;
}
