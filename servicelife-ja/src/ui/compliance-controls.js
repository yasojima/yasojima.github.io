import {el,button} from './elements.js';
export function complianceControls(){
 const dates=[],inputs={};
 const field=(meta,key,label)=>{const d=meta[key];if(!d)throw new Error('Missing compliance field '+key);const input=d.type==='select'?el('select',{},d.options.map(o=>el('option',{value:o.value,label:o.label},o.text))):d.type==='textarea'?el('textarea',{rows:3}):el('input',{type:d.type==='date'?'text':d.type,checked:d.checked});input.id=d.id||'compliance-'+key;input.name=d.name;input.value=d.value;input.required=d.required;input.placeholder=d.placeholder;inputs[key]=input;if(d.type==='date')dates.push(input);return el('label',{class:'compliance-field'},el('span',{text:label}),input);};
 return {field,inputs,mount(){for(const input of dates)if(!input._flatpickr)globalThis.flatpickr(input,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true});},dispose(){dates.forEach(x=>x._flatpickr?.destroy());}};
}
export function addLicense(fields){
 const c=complianceControls(),error=el('p',{class:'compliance-error',role:'status',hidden:true}),grid=el('div',{class:'compliance-add-grid'}),d=el('dialog',{class:'dialog compliance-dialog','aria-label':'資格・許可証を追加'});
 const supervisor=c.field(fields,'al-supervisor','監督者（登録技術者の場合は必須）');supervisor.hidden=true;
 const labels=[['al-technician','担当スタッフ（必須）'],['al-category','資格区分（必須）'],['al-tier','等級（必須）'],['al-supervisor',null],['al-number','資格番号（必須）'],['al-status','対応状況'],['al-issued','発行日（必須）'],['al-expires','有効期限（必須）'],['al-notes','メモ']];
 for(const [key,label]of labels){const node=key==='al-supervisor'?supervisor:c.field(fields,key,label);if(key==='al-notes')node.classList.add('wide');grid.append(node);}
 c.inputs['al-tier'].addEventListener('change',()=>{supervisor.hidden=c.inputs['al-tier'].value!=='registered_technician';});
 const save=()=>{const pairs=[['al-technician','technician'],['al-category','category'],['al-number','license number'],['al-issued','issued date'],['al-expires','expiration date']];if(!supervisor.hidden)pairs.push(['al-supervisor','supervisor']);const missing=pairs.filter(([key])=>!c.inputs[key].value.trim()).map(([,label])=>label);error.textContent=missing.length?'Please fill in: '+missing.join(', ')+'.':'This action is disabled in the read-only demo.';error.hidden=false;};
 d.append(el('header',{},el('h2',{text:'資格・許可証を追加'}),button('×',()=>d.close(),{class:'close','aria-label':'閉じる'})),el('div',{class:'dialog-body'},error,grid),el('footer',{},button('キャンセル',()=>d.close()),button('資格・許可証を追加',save,{class:'primary',id:'al-submit'})));
 d.addEventListener('close',()=>{c.dispose();d.remove();},{once:true});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});document.body.append(d);d.showModal();c.mount();return d;
}
