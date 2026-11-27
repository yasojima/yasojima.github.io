import {el,button} from './elements.js';
import {coordinatePlot} from './coordinate-plot.js';
const palette=['#157467','#405fa3','#a8652a','#77579d','#53732d','#a24f6a','#326c81'];
const modes={rebalance:['訪問ルートの再配分案','開始時刻を固定し、作業実績と勤務条件が合う担当変更を比較します。'],optimize:['1日の訪問順の最適化案','担当変更と、変更可能な到着時間帯がある訪問の時刻を比較します。'],pack:['訪問の空き時間を詰める案','担当者を固定し、変更可能な到着時間帯の範囲で訪問を早める案を比較します。']};
export function routesView(data){
 let selectedDate=data.defaultDate,map,mounted=false;
 const node=el('div',{class:'visit-planner','data-route-planner':''}),control=(text,action,attrs={})=>button(text,action,{class:'visit-control',...attrs});
 const date=el('input',{type:'date',value:selectedDate,required:'','aria-label':'訪問日','data-visit-date':'',onchange:update});
 const staff=el('select',{'aria-label':'担当スタッフ','data-visit-staff':'',onchange:update},el('option',{value:'',text:'全スタッフ'}),data.staff.map(s=>el('option',{value:s.id,text:s.name})));
 const scope=text=>el('p',{class:'visit-scope',text}),para=(text,cls='visit-note')=>el('p',{class:cls,text});
 const shift=amount=>{const d=new Date(selectedDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+amount);date.value=d.toISOString().slice(0,10);update()};
 const modal=el('dialog',{class:'visit-preview','aria-label':'訪問ルートのプレビュー'});
 function preview(mode){
  const key=[selectedDate,staff.value,mode].join('|'),result=data.previews[key]||{counts:'直線距離・時速35 km換算の試算 · 変更案 0件'+(mode==='rebalance'?'':' · 時刻を変えられる訪問 0件')+(staff.value?' · 選択中のスタッフに関係する変更案':''),distances:['0.0 km','0.0 km','0.0 km'],rows:[],empty:'この条件に該当する訪問がありません。'};
  const close=control('閉じる',()=>modal.close());modal.dataset.previewMode=mode;
  modal.replaceChildren(el('header',{},el('div',{},scope('閲覧用プレビュー · '+selectedDate),el('h2',{text:modes[mode][0]})),close),para(modes[mode][1]),para(result.counts),el('div',{class:'visit-distances'},['当日の総距離','提案後の総距離','削減見込み'].map((text,i)=>el('div',{},el('span',{text}),el('strong',{text:result.distances[i]})))),result.rows.length?el('table',{},el('thead',{},el('tr',{},['訪問先','現在の担当・開始','提案の担当・開始'].map(text=>el('th',{text})))),el('tbody',{},result.rows.map(r=>el('tr',{},r.map(text=>el('td',{text})))))):para(result.empty,'visit-empty'));modal.showModal();close.focus();
 }
 const intro=el('section',{class:'visit-intro'},el('div',{},scope('現場管理'),el('h1',{text:'当日の訪問ルート'}),para('日付と担当者を選び、訪問順と移動の案を確認できます。','visit-guide')),el('div',{class:'visit-actions'},control('再配分をプレビュー',()=>preview('rebalance'),{'data-visit-action':'rebalance'}),control('最適化をプレビュー',()=>preview('optimize'),{class:'visit-control visit-primary','data-visit-action':'optimize'})));
 const toolbar=el('div',{class:'visit-toolbar'},el('div',{class:'visit-date-controls'},control('‹',()=>shift(-1),{'aria-label':'前日',class:'visit-control visit-day'}),el('label',{},el('span',{text:'訪問日'}),date),control('›',()=>shift(1),{'aria-label':'翌日',class:'visit-control visit-day'})),el('label',{},el('span',{text:'担当スタッフ'}),staff),para('訪問先の現地時刻','visit-timezone'),control('訪問の空き時間を詰める',()=>preview('pack'),{class:'visit-control visit-pack','data-visit-action':'pack'}));
 const summary=para('','visit-summary'),mapSlot=el('div',{class:'visit-map-slot'}),list=el('div',{class:'visit-agenda','aria-label':'担当別の訪問一覧'});
 function update(){
  if(!date.value){date.value=selectedDate;return}selectedDate=date.value;map?.dispose();
  const jobs=data.visits.filter(j=>j.date===selectedDate&&(!staff.value||j.staff===staff.value));
  const groups=data.staff.map((s,i)=>({...s,color:palette[i%palette.length],jobs:jobs.filter(j=>j.staff===s.id)})).filter(g=>g.jobs.length);
  const unassigned=jobs.filter(j=>!j.staff);if(unassigned.length)groups.push({id:'',name:'担当未定',color:'#54635f',jobs:unassigned});
  summary.textContent=jobs.length+'件の訪問 · '+groups.filter(g=>g.id).length+'人';
  const records=[],paths=[];for(const g of groups){const indices=[];for(const [i,j] of g.jobs.filter(j=>j.point).entries()){indices.push(records.length);records.push({...j,lat:j.point[0],lng:j.point[1],initials:String(i+1),color:g.color,staffName:g.name})}if(indices.length>1)paths.push({indices,color:g.color})}
  map=coordinatePlot(records,j=>el('div',{},el('strong',{text:j.name}),el('p',{text:j.address}),el('small',{text:j.time+' · '+j.staffName}),j.service?el('p',{text:j.service}):null),{paths,fit:true,colored:true,zoomOnFocus:false});
  mapSlot.replaceChildren(map.node);list.replaceChildren(...groups.map(g=>el('section',{class:'visit-group'},el('h3',{},el('i',{class:'visit-person-dot',style:'background-color:'+g.color}),g.name,el('small',{text:g.jobs.length+'件'})),el('ol',{},g.jobs.map(j=>el('li',{},button([el('time',{text:j.time}),el('span',{},el('strong',{text:j.name}),el('small',{text:j.address||j.service}))],()=>map.choose(records.findIndex(r=>r.id===j.id),true),{class:'visit-stop',disabled:!j.point,'data-visit-id':j.id})))))));
  if(!groups.length)list.append(para('この日付・担当の訪問は収録されていません。','visit-empty'));if(mounted)map.mount();
 }
 node.append(intro,toolbar,el('section',{class:'visit-plan'},el('header',{},el('h2',{text:'訪問計画'}),summary),el('div',{class:'visit-columns'},el('div',{class:'visit-map-wrap'},mapSlot,para('地図の点線は訪問順の目安です。','visit-map-note')),list)),modal);update();
 return{title:'当日の訪問ルート',workspace:true,groups:data.groups,node,mount(){mounted=true;map.mount()},dispose(){modal.close();map?.dispose();mounted=false}};
}
