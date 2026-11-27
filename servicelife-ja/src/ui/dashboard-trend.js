import {el,button} from './elements.js';
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel=value=>{const m=String(value).match(/^([A-Z][a-z]+) (\d{4})$/);return m&&months.includes(m[1])?m[2]+'年'+(months.indexOf(m[1])+1)+'月':value};
const format=(value,unit)=>unit==='money'?'$'+Number(value).toLocaleString('en-US'):unit==='percent'?value+'%':value;
export function dashboardTrend(data,card,notify){
 const model=data.trends[card.metric]?.default,modal=el('dialog',{class:'dashboard-trend','aria-label':'推移'}),heading=el('h2',{text:model?.heading||'…'}),subtitle=el('p',{text:model?.subtitle||''}),body=el('div',{class:'dashboard-trend-body'});let chart;
 const close=()=>modal.close();modal.append(el('header',{},el('div',{},heading,subtitle),button('×',close,{id:'ktClose','aria-label':'閉じる'})),body);document.body.append(modal);modal.showModal();modal.addEventListener('close',()=>{chart?.destroy();modal.remove()},{once:true});modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 if(!model){body.append(el('div',{class:'dashboard-trend-error',text:'Could not load this trend (HTTP 404).'}));notify();return modal}
 const plot=el('canvas',{id:'ktCanvas'}),plotBox=el('div',{class:'dashboard-trend-plot'},plot);body.append(plotBox);let slider,caption;
 if(model.adjustable){caption=el('strong');slider=el('input',{id:'ktSpan',type:'range',min:model.span_min,max:model.span_max,value:model.span,'aria-label':'表示期間',oninput:()=>draw(+slider.value)});body.append(el('div',{class:'dashboard-trend-period'},el('label',{for:'ktSpan'},'Show ',caption),slider,el('div',{},'less',el('span',{text:'more history'}))))}
 const note=el('p',{class:'dashboard-trend-note',text:model.note||'',hidden:!model.note});body.append(note);if(card.detail)body.append(el('a',{class:'dashboard-trend-detail',href:'#'+(data.role==='company_admin'?'':data.role)+'/dashboard/drilldown/'+card.metric+'/',text:'View detail table →'}));
 function draw(span){
  const samples=data.trends[card.metric],largest=Object.values(samples).filter(s=>s.span).sort((a,b)=>b.span-a.span)[0];let current=samples[String(span)]||model;
  if(model.adjustable&&!samples[String(span)]&&span!==model.span&&largest){current={...largest,span,labels:largest.labels.slice(-span),values:largest.values.slice(-span),values2:largest.values2?.slice(-span),subtitle:largest.subtitle.replace(/last \d+ /,'last '+span+' ')}}
  heading.textContent=current.heading;subtitle.textContent=current.subtitle;note.textContent=current.note||'';note.hidden=!current.note;
  if(caption)caption.textContent=model.span_unit==='days'&&span===30?'直近30日間':'last '+span+' '+model.span_unit;
  chart?.destroy();const line=current.kind==='line',datasets=[{label:current.label||current.title,data:current.values,yAxisID:'y',order:2,backgroundColor:line?'rgba(165,206,58,.15)':'#43A047',borderColor:'#43A047',borderWidth:2,borderRadius:line?0:4,pointRadius:line?2:0,tension:.25,fill:line,maxBarThickness:46}];
  if(current.values2)datasets.push({label:current.label2,data:current.values2,type:'line',yAxisID:'y2',order:1,borderColor:'#2196F3',backgroundColor:'#2196F3',borderWidth:2,pointRadius:2,tension:.25,fill:false});
  chart=new Chart(plot,{type:current.kind,data:{labels:current.labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:!!current.values2,position:'bottom',labels:{font:{size:11}}},tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+format(ctx.parsed.y,ctx.dataset.yAxisID==='y2'?current.unit2:current.unit)}}},scales:{x:{grid:{display:false},ticks:{font:{size:10},callback:(_,i)=>monthLabel(current.labels[i])}},y:{beginAtZero:true,grid:{color:'#eef1f3'},ticks:{font:{size:10},callback:v=>format(v,current.unit)}},...(current.values2?{y2:{position:'right',beginAtZero:true,grid:{drawOnChartArea:false},ticks:{callback:v=>format(v,current.unit2)}}}:{})}}});
 }
 draw(model.span);return modal;
}
