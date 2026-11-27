import { el, button, select, dialog } from './elements.js';

export const itemTypes = [['service','サービス内容'],['material','材料'],['equipment','機材'],['labor','作業費'],['flat_rate','一律料金']];
const yesNo = [['true','はい'],['false','いいえ']];
export function resourceEditor(kind, snapshot, record = null) {
  const form = el('form', { class: 'resource-form', autocomplete: 'off' });
  const grid = el('div', { class: 'form-grid' });
  const calendars = [];
  const field = (id, label, options = {}) => {
    const { value = '', type = 'text', choices, wide, required, help, date, ...attributes } = options;
    const node = choices ? select(label, choices.map(([value,label]) => ({value,label})), value, () => {}, {id,...(required?{required:''}:{})}) :
      el(type === 'textarea' ? 'textarea' : 'input', {id, ...(type === 'textarea'?{}:{type}),value,...attributes,...(required?{required:''}:{})});
    const box = el('div', { class: 'field' + (wide?' wide':'') }, el('label', {for:id}, label, required ? el('span',{class:'required',text:' *'}) : null),node);
    if (help) box.append(el('p',{class:'resource-help',text:help}));
    grid.append(box);
    if (date) calendars.push(node);
    return node;
  };
  let title, saveLabel='保存', saveId;
  if (kind === 'job-types') {
    title=record?'Edit Job Type':'作業の種類を追加';saveId='jobTypeSaveBtn';
    field('fName','氏名',{value:record?.name||'',wide:true});
    field('fColor','色',{type:'color',value:record?.color||'#a5ce3a'});
    field('fDuration','標準の所要時間（分）',{type:'number',value:record?.minutes??60});
    field('fPrice','標準料金（ドル）',{type:'number',step:'0.01',value:record?.price??0});
    field('fActive','稼働中',{choices:yesNo,value:String(record?.active??true)});
    field('fDesc','内容',{type:'textarea',wide:true,value:record?.description||''});
    field('fPrepSheet','訪問前にお客様に準備いただくこと',{type:'file',wide:true,
      accept:'.pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/*',
      help:'この作業の予約が入るたびに、登録した資料をお客様にメールで自動送信します。対応形式はPDF、DOC、DOCX、PNG、JPG、上限は15MBです。'});
  } else if (kind === 'pricebook') {
    title='品目を追加';saveId='pricebookSaveBtn';
    field('fCode','コード・商品管理番号');field('fType','種類',{choices:itemTypes,value:'service'});
    field('fName','氏名',{wide:true,required:true});field('fDesc','内容',{type:'textarea',wide:true});
    for (const [id,label] of [['fPrice','標準プランの料金（ドル）'],['fPrice2','上位プラン（ドル）'],['fPrice3','最上位・プレミアム（ドル）'],['fCost','自社原価（ドル）']]) field(id,label,{type:'number',value:0,step:'0.01'});
    field('fUnit','区画・部屋番号',{value:'個'});field('fDur','所要時間（分）',{type:'number',value:0});
    field('fTax','課税対象',{choices:yesNo,value:'true'});field('fActive','稼働中',{choices:yesNo,value:'true'});
  } else if (kind === 'inventory') {
    title='在庫品を追加';saveLabel='品目を追加';saveId='i-submit-btn';
    field('i-name','名称',{required:true,wide:true,placeholder:'例：濃縮シロアリ駆除剤'});
    field('i-sku','商品管理番号（SKU）',{placeholder:'例：CHEM-001'});
    field('i-unit','区画・部屋番号',{value:'個',placeholder:'個'});
    field('i-cost','原価（米ドル）',{type:'number',value:0,min:0,step:'0.01',placeholder:'0.00'});
    field('i-reorder','発注点（この数を下回ると補充）',{type:'number',value:5,min:0,step:1,placeholder:'5'});
  } else if (kind === 'equipment') {
    title='機材を追加';saveId='equipmentSaveBtn';
    field('fCust','お客様',{required:true,choices:[['','選択'],...snapshot.customers.map(x=>[x.id,x.name])]});
    field('fType','機材の種類',{choices:[['','選択']]});
    field('fName','氏名',{required:true,wide:true,placeholder:'例：玄関ポーチのベイトステーション3番'});
    field('fSerial','製造番号');field('fBarcode','バーコード・QRコード');
    field('fMfr','メーカー');field('fModel','型式');
    field('fInstall','設置日',{date:true});field('fWarranty','保証期限',{date:true});
    field('fLocNotes','設置場所のメモ',{wide:true,placeholder:'敷地内の設置場所'});
    field('fNotes','メモ',{type:'textarea',wide:true});
  } else throw new Error('Unknown resource editor');
  const error = el('p', {class:'error',role:'alert',hidden:true,'data-status':'403'});
  form.append(grid,error);
  const modal = dialog(title,form);
  modal.classList.add('resource-dialog',kind+'-dialog');
  const save = () => {
    // Match the captured read-only screen, including its different error paths.
    // No record is persisted and no form values or selected files are sent.
    if(kind==='equipment'){modal.close();return;}
    const rejection='This action is disabled in the read-only demo.';
    const missingName=kind==='inventory'&&!form.querySelector('#i-name').value.trim();
    error.dataset.status=missingName?'400':'403';
    error.textContent=missingName?'Name is required.':kind==='inventory'?'Failed to add item: '+JSON.stringify({detail:rejection,error:rejection}):rejection;
    error.hidden=false;
    error.scrollIntoView({block:'nearest'});
  };
  form.addEventListener('submit',event=>{event.preventDefault();save()});
  modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button(saveLabel,save,{class:'primary',id:saveId}));
  const instances = calendars.map(node=>globalThis.flatpickr(node,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'Y年m月d日',allowInput:true,disableMobile:true}));
  modal.addEventListener('close',()=>instances.forEach(x=>x.destroy()),{once:true});
  return modal;
}
