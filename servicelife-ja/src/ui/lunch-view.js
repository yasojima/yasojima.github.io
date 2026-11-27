import {el} from './elements.js';

export function lunchView(snapshot,identifier){
 const person=snapshot.records.find(x=>x.id===identifier);
 if(!person)throw new Error('昼休みの対象スタッフがありません。');
 const title='Lunch overrides — '+person.name;
 const node=el('section',{class:'lunch-content','data-lunch':identifier}),grid=el('div',{class:'lunch-grid'});
 const date=el('input',{name:'date',type:'text',required:'',value:person.fields.date.value});
 for(const [name,label,type] of [['date','日付','text'],['start_time','LUNCH START','time'],['end_time','LUNCH END','time'],['name','LABEL','text'],['reason','理由（任意）','text']]){
  const data=person.fields[name],input=name==='date'?date:el('input',{name,type,value:data.value,...(data.required?{required:''}:{}),...(data.maxlength?{maxlength:data.maxlength}:{})});
  input.id='lunch-'+name;
  grid.append(el('label',{for:input.id},el('span',{text:label}),input));
 }
 node.append(el('h2',{text:title}),el('p',{class:'lunch-description',text:`Move ${person.name}'s lunch for a single date without changing their recurring weekly schedule. The new window blocks that time for booking on that date only; their normal lunch is untouched on every other day.`}));
 if(person.inactive)node.append(el('p',{class:'lunch-warning',text:"This user isn't an active technician, so overrides here won't affect booking."}));
 // The reviewed demo leaves a valid submission unchanged. Nothing is persisted
 // or sent; the browser still enforces the observed required field constraints.
 const form=el('form',{class:'lunch-form',autocomplete:'off',onsubmit:e=>e.preventDefault()},grid,el('button',{type:'submit',class:'primary'},'Save override'));
 node.append(form,el('h3',{text:'UPCOMING OVERRIDES'}),el('div',{class:'lunch-empty',text:`No upcoming lunch overrides for ${person.name}. Use the form above to move a lunch for a specific date.`}));
 return {title,node,compactHeader:true,mount(){globalThis.flatpickr(date,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true,minDate:person.fields.date.min});},dispose(){date._flatpickr?.destroy();}};
}
