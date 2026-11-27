import {el,icon} from './elements.js';
import {routeHash} from '../core/router.js';
export function myDayView(data){
 const node=el('section',{class:'daily-itinerary','data-my-day':''});
 node.append(el('div',{class:'daily-totals'},data.stats.map((s,i)=>el('div',{class:'daily-total total-'+i},el('strong',{text:s.value}),el('span',{text:s.label})))));
 for(const r of data.rows){
  if(r.kind==='peek')node.append(el('div',{class:'daily-next'},icon('forward'),' '+data.nextLabel));
  node.append(el(r.path?'a':'div',{class:'daily-card '+r.kind,...(r.path?{href:routeHash('technician',r.path),'aria-label':'Open job card for '+r.name}:{'aria-disabled':'true'})},
   el('div',{class:'daily-card-top'},el('span',{class:'daily-time',text:r.time}),el('div',{class:'daily-person'},el('strong',{text:r.name}),r.address?el('div',{class:'daily-address'},icon(r.kind==='locked'?'lock':'map-marker-alt'),' '+r.address):null),el('span',{class:'daily-arrow',text:'›','aria-hidden':'true'})),
   el('div',{class:'daily-badges'},r.badges.map(b=>el('span',{class:'daily-badge '+b.kind,text:b.text})))));
 }
 return{title:'本日の予定',titleIcon:'calendar-day',headerClass:'daily-header',headerExtra:el('span',{class:'daily-date',text:data.date}),node,mount(){},dispose(){}};
}
