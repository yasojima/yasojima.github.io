import {el,button,icon} from './elements.js';
const tabs=[
 {name:'売上',icon:'dollar-sign',export:'売上をCSVで出力',cards:[['chartRevTrend','入金額の推移','Squareの入金額（返金控除後）',true,'chart-bar'],['chartRevYoY','前年同期比','','','chart-line'],['chartAvgTicket','平均取引額の推移','','','receipt'],['chartRevService','サービス別の内訳','作業件数順',false,'chart-pie']]},
 {name:'継続契約・月次経常収益',icon:'sync',export:'月間定期売上をCSVで出力',cards:[['chartMrrMovement','月次経常収益の増減','契約の開始・更新・終了の記録から推計',true,'chart-line'],['chartMrrCadence','契約周期別の月次経常収益','',false,'chart-pie'],['chartForecast','売上予測','月次経常収益が現状のまま続く場合の見込み'],['chartBookings','受注した契約の総額','',true,'hand-holding-usd']]},
 {name:'継続利用',icon:'user-slash',export:'解約状況をCSVで出力',cards:[['chartGrowth','支払い継続・途絶の状況','Squareの取引記録を使用',true,'users'],['chartChurnRate','解約率','','','chart-line'],['chartCancelReasons','キャンセル理由','','','ban']]},
 {name:'売掛金・入金',icon:'file-invoice-dollar',export:'未払い残高をCSVで出力',two:true,cards:[['chartArAging','経過日数別の売掛金','','','clock'],['chartCollection','請求額と入金額','入金額はSquareの記録を使用',false,'chart-line']]},
 {name:'売上・契約更新',icon:'handshake',two:true,cards:[['chartPipeline','見込み客の進捗','','','filter'],['chartRenewal','契約更新の見込み','','','sync']]},
 {name:'害虫と地域',icon:'map-marked-alt',export:'郵便番号別の集計をCSVで出力',cards:[['chartTopZips','作業件数が多い郵便番号エリア','',true,'map-marker-alt'],['chartSeasonality','季節別の害虫発生状況','月別の作業件数',true,'chart-line']]},
 {name:'日常業務',icon:'cogs',export:'作業実績をCSVで出力',cards:[['chartProduction','対応結果別の作業件数','',true,'chart-bar'],['chartCompletion','作業完了率の推移','','','chart-line'],['chartTechProd','担当スタッフ別の作業実績','','','users']]}
];
const colors=['#A5CE3A','#2196F3','#FF9800','#9C27B0','#F44336','#00BCD4','#795548','#E91E63'];
const unavailable='この条件のデータは、確認用ページに含まれていません。';
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel=value=>{const [month,year]=String(value).split(' '),n=months.indexOf(month)+1;return n?(year?year+'/'+String(n).padStart(2,'0'):n+'月'):value};
const serviceNames=['一般害虫駆除','トコジラミ駆除','害獣の捕獲・撤去','ネズミ駆除','シロアリ点検','蚊の駆除','シロアリ駆除','3か月ごとの定期メンテナンス'];
export function biView(data){
 const node=el('section',{class:'bi-content','data-bi':''}),body=el('div',{class:'bi-body'}),charts=[],dates=[];let active=0,toast=null,timer=null;
 const notify=()=>{clearTimeout(timer);toast?.remove();toast=el('div',{class:'lead-toast',role:'status'},el('span',{text:unavailable}),button('×',()=>toast?.remove(),{'aria-label':'閉じる'}));document.body.append(toast);timer=setTimeout(()=>toast?.remove(),5000)};
 const navigation=el('nav',{class:'bi-tabs','aria-label':'経営分析の区分'},tabs.map((t,i)=>button([icon(t.icon),' '+t.name],()=>{active=i;draw();if(i)notify()},{'data-bi-tab':i}))),start=el('input',{id:'filterStart',type:'text','aria-label':'開始'}),end=el('input',{id:'filterEnd',type:'text','aria-label':'終了'}),gran=el('select',{id:'filterGran','aria-label':'担当'},[['week','週表示'],['month','月表示'],['quarter','四半期表示']].map(([value,label])=>el('option',{value,text:label})));gran.value='month';
 const reset=()=>{dates.forEach(d=>d.clear());gran.value='month';if(active)notify()};
 node.append(navigation,el('div',{class:'bi-filter'},el('b',{},icon('filter'),'対象期間'),el('label',{for:'filterStart',text:'開始'}),start,el('label',{for:'filterEnd',text:'終了'}),end,el('label',{for:'filterGran',text:'担当'}),gran,button([icon('search'),'適用'],()=>notify(),{class:'primary','data-bi-apply':''}),button([icon('times'),'リセット'],reset,{'data-bi-reset':''})),body);
 const heading=(name,sub='',mark='table')=>el('h3',{class:'bi-heading'},icon(mark),' '+name,sub?el('span',{text:' '+sub}):null);
 const table=(columns,rows)=>el('div',{class:'bi-table'},el('table',{},el('thead',{},el('tr',{},columns.map(text=>el('th',{text})))),el('tbody',{},rows.map(row=>el('tr',{},row.map((text,i)=>el('td',{class:i===row.length-1?'bi-amount':'',text})))))));
 function draw(){
  charts.splice(0).forEach(c=>c.destroy());body.replaceChildren();navigation.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i===active);b.setAttribute('aria-pressed',String(i===active))});const tab=tabs[active];body.dataset.biPanel=String(active);
  if(tab.export)body.append(el('div',{class:'bi-export'},button([icon('download'),' '+tab.export],notify,{'data-bi-export':''})));
  if(active!==6)body.append(el('div',{class:'bi-kpis'},active===0?data.kpis.map(([label,value])=>el('article',{},el('small',{text:label}),el('strong',{text:value}))):null));
  const chartNodes={};body.append(el('div',{class:'bi-grid'+(tab.two?' two':'')},tab.cards.map(([id,title,subtitle,wide,mark])=>{const canvas=el('canvas',{id,'aria-label':title});chartNodes[id]=canvas;return el('article',{class:'bi-card'+(wide?' wide':'')+(active?' empty':'')},el('header',{},el('h3',{},mark?icon(mark):null,' '+title),subtitle?el('small',{text:subtitle}):null),canvas)})));
  if(active===0)body.append(heading('売上上位の顧客','','trophy'),table(['お客様','種類','売上'],data.topCustomers));
  if(active===2)body.append(heading('登録時期別の継続率','（各登録月の顧客のうち、現在も利用している割合）'),el('div',{class:'bi-empty-table'}));
  if(active===3)body.append(heading('未入金額が大きい顧客','','hand-holding-usd'),table(['お客様','未入金額'],[]));
  if(active===5)body.append(heading('郵便番号別の害虫の内訳','（作業件数）'),el('div',{class:'bi-empty-table'}),heading('発生が増えている害虫','（過去90日間とその直前の90日間を比較。集計は保存されている期間内）','chart-line'),table(['害虫','過去90日間','直前の90日間','前期からの変化'],[]));
  if(active===6)body.append(table(['担当スタッフ','作業完了','合計','完了率'],[]));
  if(active===0&&node.isConnected)for(const spec of data.charts){const pie=spec.type==='doughnut',yoy=spec.id==='chartRevYoY',avg=spec.id==='chartAvgTicket';const labels=pie?serviceNames:spec.labels.map(monthLabel),datasets=spec.series.map((s,i)=>({label:pie?'':yoy?s.name:avg?'平均取引額':'入金額',data:s.values,...(pie?{backgroundColor:colors}:spec.type==='bar'?{backgroundColor:colors[0],borderRadius:4}:{borderColor:yoy?(i?'#9C27B0':colors[0]):colors[1],backgroundColor:yoy?'rgba(165,206,58,.1)':'rgba(33,150,243,.1)',tension:.3,...(yoy&&i?{borderDash:[5,4]}:{}),...(avg?{fill:true}:{})})}));charts.push(new Chart(chartNodes[spec.id],{type:spec.type,data:{labels,datasets},options:{responsive:true,animation:false,plugins:{legend:{display:pie||yoy,position:'bottom',labels:{font:{size:11}}}},...(pie?{}:{scales:{y:{beginAtZero:true,ticks:{font:{size:11}}},x:{ticks:{font:{size:10}}}}})}}))}
 }
 return {title:'経営分析',titleIcon:'chart-pie',headerClass:'bi-header',node,mount(){[start,end].forEach(input=>dates.push(flatpickr(input,{dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true})));draw()},dispose(){charts.forEach(c=>c.destroy());dates.forEach(d=>d.destroy());toast?.remove();clearTimeout(timer)}};
}
