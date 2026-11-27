import {el,button,icon,select,dialog} from './elements.js';

export function invoiceEditor(snapshot,record=null){
  const grid=el('div',{class:'form-grid'}),body=el('div',{class:'invoice-form'},grid);
  const field=(id,label,input,wide=false)=>{input.id=id;const box=el('div',{class:'field'+(wide?' wide':'')},el('label',{for:id},label),input);grid.append(box);return box;};
  const customer=select('お客様',[{value:'',label:'Select...'},...snapshot.customers.map(x=>({value:x.id,label:x.name}))],record?.customer||'',()=>updateLocation());
  customer.options[0].label='選択';
  const customerBox=field('fCustomer','お客様',customer),validation=el('p',{class:'invoice-validation',hidden:true});customerBox.append(validation);
  const due=el('input',{type:'text',value:record?.due_date||''});field('fDueDate','支払期限',due);
  const location=select('訪問先（任意）',[],'',()=>{});
  const locationBox=field('fInvServiceLoc',[icon('map-marker-alt'),' 訪問先（任意）'],location,true);
  locationBox.append(el('p',{class:'invoice-help',text:'複数拠点のある法人顧客の請求書を、特定の訪問先にひも付ける'}));
  function updateLocation(){
    validation.hidden=true;
    const person=snapshot.customers.find(x=>x.id===customer.value);
    location.replaceChildren(el('option',{value:'',label:'顧客単位で発行する請求書'},'Customer-level invoice'),
      ...(person?.locations||[]).map(x=>el('option',{value:x.id},x.name+' — '+x.street)));
    locationBox.hidden=!person;
  }
  updateLocation();location.value=record?.service_location||'';
  const tax=el('input',{type:'number',step:'.01',value:record?.tax_rate??0});
  const lookup=el('a',{href:'#',onclick:event=>{event.preventDefault();const person=snapshot.customers.find(x=>x.id===customer.value);if(person)alert('No tax rate found for '+person.city+', '+person.state);else alert('Please select a customer first');}},'📍 住所を検索');
  field('fTaxRate',['税率（%） ',lookup],tax);
  field('fDiscount','値引き額（ドル）',el('input',{type:'number',step:'.01',value:record?.discount??0}));
  grid.append(el('label',{class:'invoice-zero wide'},el('input',{id:'fIntentionallyZero',type:'checkbox',checked:record?.intentionally_zero||false}),
    '保証対応・サービス・社内記録のため、意図的に0ドルで請求書を発行'));
  field('fNotes','メモ',el('textarea',{value:record?.notes||'',placeholder:'お客様に表示する備考'}),true);
  const lines=el('div',{class:'invoice-lines'});let serial=0;
  function addLine(item={description:'',quantity:'1',unit_price:'0'}){
    const index=serial++;
    const row=el('div',{class:'invoice-line'},
      el('input',{id:'ld_'+index,type:'text',placeholder:'内容','aria-label':'明細の内容',value:item.description}),
      el('input',{id:'lq_'+index,type:'number',step:'.01','aria-label':'数量',value:item.quantity}),
      el('input',{id:'lp_'+index,type:'number',step:'.01','aria-label':'単価',value:item.unit_price}),
      button(icon('times'),()=>row.remove(),{'aria-label':'明細行を削除',class:'remove-invoice-line'}));lines.append(row);
  }
  (record?.lines.length?record.lines:[undefined]).forEach(addLine);
  body.append(el('h3',{text:'請求明細'}),lines,button([icon('plus'),' 明細行を追加'],()=>addLine(),{class:'add-invoice-line'}));
  const modal=dialog(record?'Invoice '+record.invoice_number:'請求書を作成',body);modal.classList.add('invoice-dialog');
  const save=()=>{
    if(!customer.value){validation.textContent='Please select a customer';validation.hidden=false;return;}
    const toast=el('div',{class:'local-toast',role:'status'},'This action is disabled in the read-only demo.');
    toast.append(button('×',()=>toast.remove(),{'aria-label':'通知を閉じる'}));
    document.querySelectorAll('.local-toast').forEach(x=>x.remove());document.body.append(toast);
  };
  modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button('請求書を保存',save,{id:'invSaveBtn',class:'primary'}));
  const calendar=globalThis.flatpickr(due,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true});
  modal.addEventListener('close',()=>{calendar.destroy();document.querySelectorAll('.local-toast').forEach(x=>x.remove());},{once:true});
  return modal;
}
