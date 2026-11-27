import {el,button} from './elements.js';
import {accessDeniedView} from './access-denied-view.js';
export const staffReportNames=['cancellations-by-technician','job-durations-by-technician','late-rate-by-technician','maintenance-cancellations-by-technician','reputation-by-technician','sales-rep','technician-scorecard','warranty-rechecks-by-technician','technician-timesheets'];
const rich=parts=>parts.map(p=>p.bold?el('strong',{},p.italic?el('em',{text:p.text}):p.text):p.italic?el('em',{text:p.text}):p.text);
export function staffReportsView(snapshot,path,role){
 if(role!=='company_admin')return accessDeniedView(path,role,['company_admin']);
 const kind=path.split('/')[2],data=snapshot.reports[kind],dates=[],timers=[];if(!data)throw new Error('Report snapshot unavailable');
 const node=el('section',{class:'staff-report','data-staff-report':kind},el('h2',{text:data.title}),el('p',{class:'staff-report-intro'},rich(data.intro)),data.notes.map(parts=>el('div',{class:'staff-report-note'},rich(parts))));
 const form=el('form',{class:'staff-report-filters',onsubmit:e=>e.preventDefault()});
 for(const d of data.fields){const input=d.type==='select'?el('select',{},d.options.map(o=>el('option',{value:o.value,label:o.label},o.text))):el('input',{type:d.type==='date'?'text':d.type,checked:d.checked,...(d.min?{min:d.min}:{})});input.id=d.id;input.name=d.name;input.value=d.value;if(d.type==='date')dates.push(input);const label=el('label',{class:d.type==='checkbox'?'staff-report-check':''},el('span',{text:d.label}),input);if(d.type==='checkbox')label.prepend(input);form.append(label);}
 form.append(el('button',{type:'submit',class:'primary'},'適用'),button('Export CSV',()=>{},{class:'staff-report-export'}));node.append(form);
 if(data.kpis.length)node.append(el('div',{class:'staff-report-kpis'},data.kpis.map(k=>el('article',{},k.labelFirst?el('span',{text:k.label}):null,el('strong',{text:k.value}),k.labelFirst?null:el('span',{text:k.label})))));
 const copyButton=(label,value,id)=>{const btn=button(label,async()=>{try{await navigator.clipboard.writeText(value);btn.textContent='Copied';timers.push(setTimeout(()=>btn.textContent=label,1200));}catch{btn.textContent='Copy failed';timers.push(setTimeout(()=>btn.textContent=label,1200));}},{...(id?{id}:{}),class:'staff-report-copy'});return btn;};
 for(const block of data.output){
  if(block.type==='heading')node.append(el('h3',{text:block.text}));
  else if(block.type==='empty')node.append(el('div',{class:'staff-report-empty'},rich(block.parts)));
  else if(block.type==='copyActions')node.append(el('div',{class:'staff-report-copy-actions'},copyButton('Copy whole table (with header)',data.copies.tscAll,'tscCopyAll'),copyButton('Copy header row',data.copies.tscHead,'tscCopyHead'),el('span',{text:block.summary})));
  else if(block.type==='legend')node.append(el('div',{class:'staff-report-legend'},rich(block.parts)));
  else if(block.type==='timesheet'){
   const body=el('tbody');
   for(const row of block.rows){
    const form=el('form',{class:'staff-report-time-edit',onsubmit:e=>e.preventDefault()});
    for(const d of row.edit.fields)form.append(el('label',{},d.label.toUpperCase()+' ',el('input',{name:d.name,type:d.type,value:d.value,placeholder:d.placeholder,...(d.min?{min:d.min}:{}),...(d.step?{step:d.step}:{}),...(d.maxLength?{maxlength:d.maxLength}:{})})));
    const detail=el('tr',{id:row.edit.id,hidden:true,class:'staff-report-time-detail'},el('td',{colspan:11},form));
    form.append(el('button',{type:'submit',class:'primary'},'保存'),el('button',{type:'submit'},'Reset to auto'),button('キャンセル',()=>detail.hidden=true));
    body.append(el('tr',{class:row.cells.some(x=>x.span>1)?'staff-report-time-flag':''},row.cells.map((cell,i)=>el('td',{class:cell.number?'number':'',colspan:cell.span},i===row.cells.length-1?button('編集',()=>detail.hidden=!detail.hidden,{class:'staff-report-time-toggle','aria-controls':row.edit.id}):rich(cell.parts)))),detail);
   }
   node.append(el('article',{class:'staff-report-timesheet'},el('header',{},el('strong',{text:block.name}),el('span',{},rich(block.summary))),el('div',{class:'staff-report-scroll'},el('table',{},el('thead',{},el('tr',{},block.heads.map(text=>el('th',{text})))),body))));
  }
  else if(block.type==='table')node.append(el('div',{class:'staff-report-scroll'},el('table',{},el('thead',{},el('tr',{},block.heads.map(text=>el('th',{text})))),el('tbody',{},block.rows.map(row=>el('tr',{class:row.summary?'staff-report-total':''},row.cells.map((cell,i)=>el('td',{class:(cell.number?'number ':'')+cell.tone,title:cell.title},i===0&&row.copy?copyButton('コピー',row.copy):rich(cell.parts)))))))));
 }
 return {title:data.title,node,compactHeader:true,mount(){for(const d of dates)globalThis.flatpickr(d,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true});},dispose(){dates.forEach(d=>d._flatpickr?.destroy());timers.forEach(clearTimeout);}};
}
