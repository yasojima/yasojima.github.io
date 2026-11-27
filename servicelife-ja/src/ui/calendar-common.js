import {el, button} from './elements.js';

export const unavailable = 'この条件のデータは、確認用ページに含まれていません。';
export const readOnly = 'This action is disabled in the read-only demo.';
export const minutes = value => {const [h,m] = value.split(':').map(Number); return h * 60 + m;};
export const addDays = (date, n) => {const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);};
export function dayLabel(date) {
  const d = new Date(date+'T12:00:00Z'), name='日月火水木金土'[d.getUTCDay()];
  return `${d.getUTCMonth()+1}月${d.getUTCDate()}日（${name}）`;
}
export function calendarContext(node, data) {
  const pickers=[], dialogs=new Set(); let timer;
  const toastNode=el('div',{class:'cal-toast',hidden:true,role:'status'});
  node.append(toastNode);
  const toast=text=>{([...dialogs].filter(d=>d.open).at(-1)||node).append(toastNode);clearTimeout(timer);toastNode.replaceChildren(el('span',{text}),button('×',()=>toastNode.hidden=true));toastNode.hidden=false;timer=setTimeout(()=>toastNode.hidden=true,4000);};
  function input(id, value='', changed) {
    const meta=data.forms[id]||{tag:'INPUT',type:'text'};
    const attrs={id};
    for(const k of ['name','placeholder','min','max','step']) if(meta[k]) attrs[k]=meta[k];
    let result;
    if(meta.tag==='SELECT') result=el('select',attrs,(meta.options||[]).map(o=>el('option',{value:o.value,label:o.label||o.text},o.text)));
    else result=el(meta.tag==='TEXTAREA'?'textarea':'input',{...attrs,...(meta.tag==='TEXTAREA'?{rows:2}:{type:meta.type})});
    if(meta.type==='checkbox'){result.value='on';result.checked=!!value;} else result.value=value??'';
    if(changed)result.addEventListener('change',()=>changed(result.type==='checkbox'?result.checked:result.value));
    return result;
  }
  const field=(label,control,wide=false)=>el('label',{class:'cal-field'+(wide?' cal-wide':'')},el('span',{text:label}),control);
  function date(id,value,changed=()=>{}) {
    const control=el('input',{id,type:'text','aria-label':id});
    const activate=()=>{const picker=flatpickr(control,{dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',locale:'ja',allowInput:true,defaultDate:value,onChange:(_,v)=>changed(v)});pickers.push(picker);return picker;};
    return {control,activate};
  }
  function popup(title, extraClass='') {
    const box=el('dialog',{class:'cal-modal '+extraClass,'aria-label':title});
    const close=()=>box.close(),head=el('header',{},el('b',{text:title}),button('×',close,{'aria-label':'閉じる'}));
    const body=el('div',{class:'cal-modal-body'}),foot=el('footer',{});
    box.append(head,body,foot);node.append(box);dialogs.add(box);
    box.addEventListener('close',()=>{box.remove();dialogs.delete(box)});
    box.showModal();return {box,body,foot,head,close};
  }
  return {node,data,input,field,date,popup,toast,pickers,dispose(){clearTimeout(timer);pickers.forEach(p=>p.destroy());dialogs.forEach(d=>d.remove());dialogs.clear();}};
}
