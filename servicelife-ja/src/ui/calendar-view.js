import {el, button, icon} from './elements.js';
import {calendarContext, addDays, dayLabel, minutes, unavailable} from './calendar-common.js';
import {calendarEditor, calendarCreate} from './calendar-editor.js';

export function calendarView(data, common) {
  const node=el('section',{class:'calendar-content','data-calendar':''}), ctx=calendarContext(node,data);
  const state={tab:'week',from:data.today,to:addDays(data.today,7),day:data.today,days:'5',duration:'30',address:'',staff:new Set()};
  const firstDay=data.days[data.today], selectable=common.staff;
  let customer=null;
  const start=ctx.date('sFrom',data.today), end=ctx.date('sTo',addDays(data.today,6));
  const searchName=ctx.input('sCust'), newCustomer=ctx.input('sNewCust',false), address=ctx.input('sAddr'), service=ctx.input('sJobType'), duration=ctx.input('sDur','30');
  const choices=el('div',{class:'cal-customer-results',hidden:true}), chosen=el('div',{class:'cal-customer-chosen',hidden:true});
  function setDuration(value){
    if(![...duration.options].some(o=>o.value===String(value)))duration.insertBefore(el('option',{value:String(value)},value+'m'),duration.lastChild);
    duration.value=String(value);
  }
  duration.addEventListener('change',()=>{if(duration.value==='custom'){const answer=prompt('Enter duration in minutes (e.g. 480 for a full day, 960 for 2 days):','30');setDuration(Math.max(15,Number(answer)||30));}});
  service.addEventListener('change',()=>{const v=common.services.find(s=>s.id===service.value);if(v&&[...duration.options].some(o=>o.value===String(v.duration)))duration.value=String(v.duration)});
  searchName.addEventListener('input',()=>{
    choices.hidden=searchName.value.length<2;
    const needle=searchName.value.toLowerCase();
    choices.replaceChildren(...data.searchCustomers.filter(c=>[c.name,c.phone,c.address].join(' ').toLowerCase().includes(needle)).slice(0,5).map(c=>button([el('b',{text:c.name}),' '+c.phone+' '+(c.kind==='commercial'?'事業所':'個人宅'),el('small',{text:c.street+', '+c.city})],()=>{
      customer=c;searchName.hidden=true;choices.hidden=true;chosen.hidden=false;address.value=c.address;
      chosen.replaceChildren(el('span',{text:c.name}),button('×',()=>{customer=null;searchName.hidden=false;chosen.hidden=true;searchName.value=''}));
    })));
  });
  const searchRow=el('div',{class:'cal-search'},
    el('div',{class:'cal-customer'},ctx.field('お客様',el('div',{},searchName,chosen,choices)),el('label',{},newCustomer,' 顧客を追加')),
    ctx.field('現場住所',address),ctx.field('作業の種類',service),ctx.field('所要時間',el('div',{class:'cal-duration'},duration,button('+',()=>setDuration((Number(duration.value)||30)+15)))),
    ctx.field('開始',start.control),ctx.field('終了',end.control),button([icon('search'),' 検索'],()=>{
      state.from=start.control.value||data.today;state.to=end.control.value||state.from;state.day=state.from;state.address=address.value;
      draw();if(address.value)ctx.toast(unavailable);
    },{class:'primary',id:'searchBtn'}));
  const flex=el('section',{class:'cal-flex',hidden:true},el('header',{},el('b',{text:'日程を調整できる予約・期限超過の予約'}),button('×',()=>flex.hidden=true)),
    el('p',{text:'訪問時期が来た法人の現場です。空き枠にカードを移すか、「予定に入れる」を押してください。お客様への通知は送信されません。'}),
    el('p',{text:'No commercial sites are flagged flexible and overdue right now.'}),el('p',{text:'Mark a site flexible under Customer → Locations.'}));
  const chips=el('div',{class:'cal-chips'}), panel=el('div',{class:'cal-panel'});
  const tabs=el('div',{class:'cal-tabs'}), actions=el('div',{class:'cal-header-actions'},button([icon('sync-alt'),' 更新'],()=>draw(),{id:'refreshBtn'}),button([icon('history'),' 日程調整・期限超過'],()=>flex.hidden=!flex.hidden,{id:'flexToggleBtn'}),button([icon('crosshairs'),' 今日'],today));
  const headerExtra=el('div',{class:'cal-header-extra'},tabs,actions);
  for(const [id,label,symbol] of [['week','週表示','calendar'],['dispatch','訪問割り当て','truck'],['availability','空き状況','table']])tabs.append(button([icon(symbol),label],()=>{
    state.tab=id;state.from=data.today;state.to=addDays(data.today,6);state.duration=duration.value;state.day=id==='dispatch'?addDays(data.today,-1):data.today;draw();
  },{'data-calendar-tab':id}));
  function today(){state.from=data.today;state.to=addDays(data.today,state.tab==='week'?7:6);state.day=state.tab==='dispatch'?addDays(data.today,-1):data.today;draw()}
  function drawChips(){chips.replaceChildren(button('● すべて',()=>{state.staff.clear();drawChips()},{class:state.staff.size?'':'chosen'}),...selectable.map(s=>{
    const t=firstDay.find(t=>t.id===s.id),btn=button([el('span',{style:'color:'+(t?.color||'#888')},'●'),' '+s.name,el('small',{text:' ✓'})],()=>{state.staff.has(s.id)?state.staff.delete(s.id):state.staff.add(s.id);drawChips()},{class:state.staff.has(s.id)?'chosen':''});return btn;
  }));}
  const bounds=[];
  function range(){
    const from=ctx.date(state.tab==='week'?'rvFrom':state.tab==='dispatch'?'dispFrom':'availFrom',state.from,value=>{state.from=value;state.day=value;if(state.to<value)state.to=value;draw()}),
      to=ctx.date(state.tab==='week'?'rvTo':state.tab==='dispatch'?'dispTo':'availTo',state.to,value=>{state.to=value;if(state.from>value)state.from=value;state.day=state.from;draw()});
    bounds.push(from,to);return el('div',{class:'cal-range'},ctx.field('開始',from.control),ctx.field('終了',to.control),button('今日',today));
  }
  function drawDays(dispatch=false){
    const dates=[];for(let date=state.from,i=0;date<=state.to&&i<62;date=addDays(date,1),i++)dates.push(dispatch?addDays(date,-1):date);
    return el('div',{class:'cal-days'},dates.map((date,i)=>button(dayLabel(date),()=>{state.day=date;draw()},{id:(dispatch?'dispDayBtn':'rvDayBtn')+i,class:state.day===date?'active':''})));
  }
  function grid(){
    const people=data.days[state.day]||firstDay.map(t=>({...t,appointments:[]}));
    const table=el('div',{class:'cal-grid',style:'--calendar-columns:'+people.length});
    table.append(el('div',{class:'cal-grid-corner'}),...people.map(t=>el('div',{class:'cal-grid-staff',style:'border-color:'+t.color},t.name,' ',el('small',{},icon('car'),' '+t.travelMinutes+'分'))));
    const times=el('div',{class:'cal-time-axis'},Array.from({length:14},(_,i)=>el('span',{style:'top:'+(i*80)+'px',text:(i+7)+':00'})));
    table.append(times,...people.map(t=>{
      const column=el('div',{class:'cal-grid-column'});
      const before=Math.max(0,minutes(t.start)-420)*80/60, after=Math.max(0,minutes(t.end)-420)*80/60;
      column.append(el('div',{class:'cal-off',style:`top:0;height:${before}px`}),el('div',{class:'cal-off',style:`top:${after}px;bottom:0`}));
      for(const appt of t.appointments){
        const event=el('div',{class:'cal-event',tabindex:'0',role:'button','aria-label':appt.customerName+' '+appt.start,'data-appointment':appt.id,
          style:`top:${(minutes(appt.start)-420)*80/60+1}px;height:${Math.max(20,appt.duration*80/60-2)}px;background:${appt.color}b3`,onclick:()=>calendarEditor(ctx,common,appt),onkeydown:e=>{if(e.key==='Enter')calendarEditor(ctx,common,appt)}},
          el('b',{text:appt.start+'-'+appt.end}),el('div',{text:appt.service}));
        if(appt.duration>30)event.append(el('div',{text:appt.customerName}),el('div',{text:appt.address}));
        if(appt.duration>=60)event.append(el('div',{class:'cal-event-actions'},['phone','comment'].map((name,i)=>button(icon(name),e=>{e.stopPropagation()},{title:i?'お客様にSMSを送る':'お客様に電話',disabled:i?appt.smsOptOut:appt.doNotCall}))));
        column.append(event);
      }
      return column;
    }));return el('div',{class:'cal-grid-scroll'},table);
  }
  function availability(){
    const ds=ctx.input('availDays',state.days,v=>{state.days=v;draw()}),min=ctx.input('availDur',state.duration,v=>{state.duration=v;draw()});
    panel.append(el('div',{class:'cal-availability-head'},el('h2',{text:'優先して割り当てられる空き枠'}),range(),el('div',{class:'cal-availability-filters'},ctx.field('対象日数',ds),ctx.field('最短の空き時間',min))));
    const present=state.days==='5'&&state.duration==='30'&&state.from===data.today&&!state.address;
    if(!present){panel.append(el('p',{class:'cal-empty',text:'No qualified technicians available for this search'}));return;}
    panel.append(...data.availability.map(t=>{
      const grouped=new Map();for(const slot of t.slots){if(!grouped.has(slot.date))grouped.set(slot.date,[]);grouped.get(slot.date).push(slot)}
      return el('section',{class:'cal-available-tech'},el('header',{},el('span',{class:'cal-initials',style:'background:'+t.color},t.name.split(' ').map(n=>n[0]).join('')),el('div',{},el('b',{text:t.name}),' ',el('small',{text:'移動時間の上限：'+t.travelMinutes+'分'}),el('p',{text:`空き枠${t.slots.length}件・平均評価${t.score}点`})),el('strong',{text:t.score+'点'})),
        el('div',{class:'cal-available-days'},[...grouped].map(([date,slots])=>el('div',{},el('h3',{text:dayLabel(date)}),slots.map(slot=>button([el('b',{text:Number(slot.start.slice(0,2))+slot.start.slice(2)+'〜'+Number(slot.end.slice(0,2))+slot.end.slice(2)}),el('span',{text:slot.minutes+'分'}),el('strong',{text:slot.score})],()=>calendarCreate(ctx,common,{date,staffId:t.id,time:slot.start,duration:30}),{class:'cal-slot'}))))));
    }));
  }
  function draw(){
    for(const r of bounds.splice(0))r.picker?.destroy();panel.replaceChildren();
    tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.calendarTab===state.tab));
    if(state.tab==='availability')availability();
    else if(state.tab==='dispatch'){
      const en=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
      panel.append(el('h2',{text:`Dispatch — ${en(state.from)} – ${en(state.to)}, ${state.from.slice(0,4)}`}),range(),drawDays(true),el('p',{class:'cal-empty',text:'No technicians scheduled for this day'}));
    }else panel.append(range(),el('div',{class:'cal-legend'},[['#9C27B0','予約済み'],['#4CAF50','確認済み'],['#FF9800','リマインド済み'],['#2196F3','作業中'],['#00BCD4','移動中'],['#607D8B','作業完了'],['#dfb8e6','非稼働'],['','|'],['#e4f4e4','割り当てに最適'],['#fff0db','適している'],['#ffe5e5','条件付きで可']].map(([color,text])=>el('span',{},color?el('i',{style:'background:'+color}):null,text))),drawDays(),grid());
    if(node.isConnected)for(const r of bounds)r.picker=r.activate();
  }
  node.prepend(flex,searchRow,chips,panel);drawChips();draw();
  return {title:'予約カレンダー',titleIcon:'calendar-alt',headerClass:'calendar-header',headerExtra,node,
    add:()=>calendarCreate(ctx,common,{date:state.day,customer,staffId:'',time:'09:00',duration:Number(duration.value)||30,address:address.value,serviceId:service.value}),
    mount(){start.activate();end.activate();for(const r of bounds)r.picker=r.activate()},dispose:()=>ctx.dispose()};
}
