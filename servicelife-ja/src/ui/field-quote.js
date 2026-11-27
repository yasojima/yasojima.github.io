import{el,icon}from'./elements.js';
export function fieldQuote(ctx){
 const{card,btn,make,say}=ctx,list=el('div'),total=el('strong'),sub=el('strong'),rows=[];let id=0;
 const amount=r=>Number(r.qty.value||0)*Number(r.price.value||0),money=x=>'$'+(Number.isFinite(x)?x:0).toFixed(2),update=()=>{let t=0;for(const r of rows){r.total.textContent=money(amount(r));t+=amount(r)}sub.textContent=total.textContent=money(t)};
 const add=()=>{const i=id++,desc=make('qdesc-0','','qdesc-'+i).input,qty=make('qqty-0','','qqty-'+i).input,price=make('qprice-0','','qprice-'+i).input,r={desc,qty,price,total:el('strong')};desc.value='';qty.value='1';price.value='';const line=el('div',{class:'field-quote-line'},desc,qty,price,r.total);for(const n of [desc,qty,price])n.addEventListener('input',update);rows.push(r);list.append(line);update()};add();const save=()=>say(rows.some(r=>r.desc.value.trim())?'Error creating quote':'Add at least one line item');
 return card('New Field Quote',[list,btn([icon('plus'),' Add Line Item'],add,'dashed'),el('div',{class:'field-quote-totals'},el('span',{},'小計 ',sub),el('span',{},'合計 ',total)),make('q-notes','QUOTE NOTES').node,el('div',{class:'field-actions'},btn([icon('save'),' Save Quote'],save,'green'),btn([icon('check-double'),' Save + Approve'],save,'blue'))],null,'plus-circle');
}
