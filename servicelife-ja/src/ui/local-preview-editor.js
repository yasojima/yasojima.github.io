import {el,button,dialog} from './elements.js';
export function localPreviewEditor(title,fields,accept){
 const inputs={},body=el('form',{class:'local-preview-fields'}),status=el('p',{role:'status'});
 body.append(el('p',{text:'操作確認用です。ここでの仮登録は、この画面を離れると元に戻ります。'}));
 for(const f of fields){const input=f.options?el('select',{id:'preview-'+f.key},f.options.map(([value,text])=>el('option',{value,text}))):el(f.type==='textarea'?'textarea':'input',{id:'preview-'+f.key,type:f.type||'text',value:f.value||''});input.required=!!f.required;inputs[f.key]=input;body.append(el('label',{},el('span',{text:f.label}),input));}
 body.append(status);const modal=dialog(title,body,[button('仮登録して確認',()=>{if(!body.reportValidity())return;const values=Object.fromEntries(Object.entries(inputs).map(([k,x])=>[k,x.value.trim()]));try{accept(values);modal.close()}catch(e){status.textContent=e.message}},{class:'primary'})]);const leave=()=>modal.close();window.addEventListener('hashchange',leave,{once:true});modal.addEventListener('close',()=>window.removeEventListener('hashchange',leave),{once:true});body.addEventListener('submit',e=>e.preventDefault());return modal;
}
