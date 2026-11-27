import {el} from './elements.js';

export function recurrenceFields(ctx, prefix, date, initial={}) {
  const edit=prefix==='ea', id=edit?'ea-rec':'bRec';
  const input=ctx.input(id,initial.recurrence||'none');
  const options=el('div',{class:'cal-recurrence'}), note=el('p',{});
  const interval=ctx.input(edit?'eaRecInt':'bRecInt',initial.interval||1);
  const unit=ctx.input(edit?'eaRecCustomUnit':'bRecCustomUnit','weekly');
  const mode=ctx.input(edit?'eaRecMode':'bRecMode',initial.monthlyMode||'same_date');
  const renew=ctx.input(edit?'eaRecAuto':'bRecAuto',initial.autoRenew!==false);
  const intervalRow=el('div',{class:'cal-recurrence-custom'},ctx.field('間隔',interval),unit);
  const renewRow=el('label',{},renew,' この定期予約を自動更新する');
  options.append(intervalRow,mode,note,renewRow);
  function update(){
    options.hidden=input.value==='none';intervalRow.hidden=input.value!=='custom';
    const key=input.value==='custom'?unit.value:input.value;
    const monthly=['monthly','bimonthly','quarterly','biannual','annual'].includes(key);
    mode.hidden=!monthly;
    const n=input.value==='custom'?Math.max(1,Number(interval.value)||1):({biweekly:2,triweekly:3,bimonthly:2,quarterly:3,biannual:6,annual:12}[key]||1);
    const when=new Date(date()+'T12:00:00Z'), day=when.getUTCDate();
    const week=['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'][when.getUTCDay()];
    const nth=day%10===1&&day!==11?'st':day%10===2&&day!==12?'nd':day%10===3&&day!==13?'rd':'th';
    note.textContent=monthly ? `The ${day}${nth}, every ${n===1?'month':n+' months'}.` : `Every ${n===1?'week':n+' weeks'} on ${week}.`;
    if(monthly&&mode.value!=='same_date') note.textContent=mode.value==='last_weekday'?`The last ${week.slice(0,-1)}, every ${n===1?'month':n+' months'}.`:`The ${Math.ceil(day/7)}${['st','nd','rd','th','th'][Math.ceil(day/7)-1]} ${week.slice(0,-1)}, every ${n===1?'month':n+' months'}.`;
  }
  [input,interval,unit,mode].forEach(e=>e.addEventListener('change',update)); update();
  return {node:ctx.field('繰り返し設定',el('div',{},input,options)),update,input};
}
