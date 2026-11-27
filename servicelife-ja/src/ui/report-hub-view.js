import {el,button,icon}from './elements.js';
import {reportValues,exportReportRows}from '../domain/report-hub.js';
import {reportDocument}from './report-document.js';
const tabs=[['revenue','売上','dollar-sign'],['customers','顧客名簿','users'],['technicians','現場スタッフ','hard-hat'],['leads','見込み客','funnel-dollar'],['commercial','事業所','building'],['accounting','経理','calculator'],['sales','売上','user-tie'],['csr','顧客対応担当','headset']];
const colors=['#A5CE3A','#2196F3','#FF9800','#9C27B0','#F44336','#00BCD4','#795548','#E91E63'];
const staffLinks=[['technician-scorecard','現場スタッフの実績をすべて見る','table'],['cancellations-by-technician','担当スタッフ別のキャンセル状況を見る','ban'],['late-rate-by-technician','担当スタッフ別の遅延率を見る','clock'],['technician-timesheets','現場スタッフの勤務表を見る','business-time'],['job-durations-by-technician','担当スタッフ別の作業時間を見る','stopwatch'],['reputation-by-technician','スタッフ別の口コミ評価を見る','star'],['warranty-rechecks-by-technician','担当スタッフ別の保証再施工・再点検率を見る','undo'],['maintenance-cancellations-by-technician','担当スタッフ別の定期契約のキャンセルを見る','calendar-times']];
const action=(label,glyph,run,props={})=>el('button',{type:'button',onclick:run,...props},icon(glyph),' '+label);
const currency=(v,whole=false)=>'$'+Number(whole?Math.round(v):v).toLocaleString('en-US');
export function reportHubView(snapshot,role){
 let active='revenue',customerDenied=false,charts=[],calendars=[];const start=el('input',{type:'text',id:'filterStart','aria-label':'開始'}),end=el('input',{type:'text',id:'filterEnd','aria-label':'終了'});
 const customer=el('select',{id:'filterCustomerType',title:'顧客区分',hidden:true},[['','All Types','すべての種類'],['residential','Residential','個人宅'],['commercial','Commercial','事業所']].map(([value,text,label])=>el('option',{value,text,label})));
 const staff=el('select',{id:'filterTechId',title:'担当スタッフ',hidden:true},el('option',{value:'',label:'すべての担当スタッフ'},'All Technicians'),(reportValues(snapshot,'technicians')?.staff||[]).map(t=>el('option',{value:t.id,text:t.name})));
 const node=el('section',{class:'report-hub','data-report-hub':''}),nav=el('nav',{class:'report-hub-tabs'}),body=el('div',{class:'report-hub-body'});
 const filters=()=>({start:start.value,end:end.value,type:active==='customers'?customer.value:'',staff:active==='technicians'?staff.value:''});
 const link=(path,text,glyph,primary=false)=>el('a',{class:'report-link'+(primary?' primary':''),href:'#'+(role==='company_admin'?'':role)+path},icon(glyph),' '+text);
 const translate=s=>snapshot.terms[s]||s;
 const dateLabel=s=>{const d=new Date('1 '+s);return /\w{3} \d{4}/.test(s)&&!isNaN(d)?d.getFullYear()+'年'+(d.getMonth()+1)+'月':translate(s)};
 const kpis=items=>el('div',{class:'report-hub-kpis'},items.map(([label,value,color,sub])=>el('article',{},el('div',{text:label}),el('strong',{text:value,style:'color:'+(color||'#1b5e20')}),sub?el('small',{text:sub}):null)));
 const table=(heads,rows,numberLast=false)=>el('div',{class:'report-hub-table-scroll'},el('table',{class:'report-hub-table'},el('thead',{},el('tr',{},heads.map((text,i)=>el('th',{text,class:numberLast&&i===heads.length-1?'number':''})))),el('tbody',{},rows.map(row=>el('tr',{},row.map((text,i)=>el('td',{text,colspan:row.length===1?heads.length:1,class:numberLast&&i===row.length-1?'number':''})))))));
 const chartJobs=[];
 function graph(title,glyph,type,labels,datasets,legend=false,full=false){
  const canvas=el('canvas',{height:type?280:150,'aria-label':title,class:type?'':'empty-chart'});const card=el('article',{class:'report-hub-chart'+(full?' full':'')},el('h3',{},icon(glyph),' '+title),canvas);
  if(type)chartJobs.push(()=>{
   const opts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:legend,position:'bottom',labels:{font:{size:11},generateLabels:chart=>(['doughnut','pie'].includes(type)?globalThis.Chart.overrides[type].plugins.legend.labels:globalThis.Chart.defaults.plugins.legend.labels).generateLabels(chart).map(x=>({...x,text:translate(x.text)}))}},tooltip:{callbacks:{title:items=>items.map(x=>dateLabel(x.label)),label:ctx=>[translate(ctx.dataset.label||ctx.label)+': '+(ctx.formattedValue??'')]}}}};
   if(!['doughnut','pie'].includes(type))opts.scales={y:{beginAtZero:true,ticks:{font:{size:11}}},x:{ticks:{font:{size:10},callback:function(value){return dateLabel(this.getLabelForValue(value))}}}};
   charts.push(new globalThis.Chart(canvas,{type,data:{labels,datasets},options:opts}));
  });
  return card;
 }
 const bar=(label,values,color=colors[0])=>({label,data:values,backgroundColor:color,borderRadius:4});
 function render(){
  charts.forEach(c=>c.destroy());charts=[];chartJobs.length=0;body.replaceChildren();for(const b of nav.children)b.classList.toggle('active',b.dataset.kind===active);customer.hidden=active!=='customers';staff.hidden=active!=='technicians';
  let data=reportValues(snapshot,active,filters());
  if(role==='csr'&&active==='customers'){if(customer.value)customerDenied=true;if(customerDenied)data={total:'undefined',types:{residential:0,commercial:0},monthly:[],denied:true};}
  if(active==='technicians')body.append(el('div',{class:'report-hub-staff-links'},staffLinks.map(([name,label,glyph],i)=>link('/reports/'+name+'/',label,glyph,i===0))));
  if(tabs.findIndex(t=>t[0]===active)<5)body.append(el('div',{class:'report-hub-export'},[['CSV','csv','download'],['Excel','xlsx','file-excel'],['PDF','pdf','file-pdf']].map(([label,format,glyph])=>action(label,glyph,async()=>{if(!data||role==='csr'&&active!=='revenue'){alert('Unable to load document (403)');return}await reportDocument(active,format,exportReportRows(snapshot,active,format,{start:start.value,end:end.value}));},{class:'report-link','data-format':format}))));
  if(active==='revenue'){
   if(data)body.append(kpis([['請求総額',currency(data.invoices.total_invoiced)],['支払総額',currency(data.invoices.total_paid),'#2e7d32'],['未払い残高',currency(data.invoices.outstanding),'#e65100'],['期限超過',data.invoices.overdue,'#c62828'],['指定期間内',data.invoices.this_month+'件']]));
   body.append(el('div',{class:'report-hub-charts'},graph('月別売上','chart-bar',data?'bar':null,data?.monthly.map(x=>x.month),data?[bar('Revenue',data.monthly.map(x=>x.revenue))]:[]),graph('作業の種類別件数','chart-pie',data?'doughnut':null,snapshot.jobsChart.labels,[{data:snapshot.jobsChart.values,backgroundColor:colors}],true)));
  }else if(active==='customers'){
   if(data)body.append(kpis([['顧客総数',data.total],['個人宅',data.types.residential,'#e65100'],['事業所',data.types.commercial,'#1565c0']]));
   body.append(el('div',{class:'report-hub-charts'},graph('顧客数の増減','chart-area',data?'line':null,data?.monthly.map(x=>x.month),data?[{label:'New Customers',data:data.monthly.map(x=>x.new_customers),borderColor:colors[0],backgroundColor:'rgba(165,206,58,0.1)',fill:true,tension:.3}]:[]),graph('顧客区分別の内訳','chart-pie',data?'pie':null,data?.denied?[]:['Commercial','Residential'],data?[{data:data.denied?[]:[data.types.commercial,data.types.residential],backgroundColor:[colors[1],colors[2]]}]:[],true)));
  }else if(active==='technicians'){
   body.append(el('div',{class:'report-hub-charts'},graph('現場スタッフの作業実績','chart-bar',data?'bar':null,data?.staff.map(t=>t.name),data?[bar('Total Jobs',data.staff.map(t=>t.total_jobs)),bar('In Range',data.staff.map(t=>t.month_jobs),colors[1])]:[],true,true)),table(['担当スタッフ','作業件数の合計','指定期間内','予約済み','平均所要時間'],(data?.staff||[]).map(t=>[t.name,t.total_jobs,t.month_jobs,t.month_scheduled,Math.round(t.avg_duration)+'分'])));
  }else if(active==='leads'){
   if(data)body.append(kpis([['見込み客の総数',data.total],['1契約あたりの平均金額',currency(data.average)]]));
   body.append(el('div',{class:'report-hub-charts'},graph('見込み客から成約までの推移','chart-line',data?'line':null,data?.monthly.map(x=>x.month),data?['new','won','lost'].map((key,i)=>({label:key[0].toUpperCase()+key.slice(1),data:data.monthly.map(x=>x[key]),borderColor:['#2196F3','#4CAF50','#F44336'][i],tension:.3})):[],true),graph('流入経路別の見込み客','chart-bar',null,[],[])));
  }else if(active==='commercial'){
   const k=data?.kpis;if(k)body.append(kpis([['利用中の顧客口座',k.active_accounts,null,'全'+k.total_accounts+'件中'],['訪問先',k.service_locations],['売上',currency(k.revenue_12mo,true)],['直近30日間',currency(k.revenue_30d,true)],['平均単価',currency(k.avg_ticket,true),null,k.avg_ticket_residential?'（個人宅比 '+(k.avg_ticket>=k.avg_ticket_residential?'+':'')+Math.round((k.avg_ticket/k.avg_ticket_residential-1)*100)+'％）':''],['未払い残高',currency(k.outstanding,true),'#e65100']]));
   body.append(el('div',{class:'report-hub-charts'},graph('事業所向けサービスの売上','chart-bar',data?'bar':null,data?.monthly.map(x=>x.month),data?[bar('Revenue',data.monthly.map(x=>x.revenue),colors[3])]:[]),graph('物件種別の売上','chart-pie',data?'doughnut':null,data?.properties.map(x=>x.label),data?[{data:data.properties.map(x=>x.revenue_12mo),backgroundColor:colors.slice(0,data.properties.length)}]:[],true)),el('h3',{},icon('trophy'),' 取引額上位10社'),table(['アカウント','物件の種類','請求書','売上'],data&&!data.accounts.length?[['No commercial revenue in selected range']]:((data?.accounts||[]).map(a=>[a.name,translate(a.property_type),a.invoice_count,currency(a.revenue_12mo,true)])),true),el('h3',{},icon('layer-group'),' 物件種別の内訳'),table(['物件の種類','利用中の顧客口座','売上'],(data?.properties||[]).map(p=>[translate(p.label),p.accounts,currency(p.revenue_12mo,true)]),true));
  }else if(active==='accounting'){
   body.append(link('/reports/job-margin/','作業別の利益を見る（売上から資材費・人件費・移動費を引いた額）','chart-pie',true),el('h3',{},icon('percent'),' 受け取った売上税 ',el('small',{text:'（Squareのデータを取得できないため、入金済み請求書から推計）'})));
   if(role==='company_admin')body.append(stats(snapshot.accounting.stats),el('h4',{text:'月別の推移'}),table(['月表示','総売上','課税対象の売上','受け取った税額'],snapshot.accounting.rows.map(row=>row.map((v,i)=>i===0?dateLabel(v):v)),true));else body.append(el('p',{text:'Sales tax data unavailable.'}));
  }else if(active==='sales')body.append(link('/reports/sales-rep/','営業担当者の実績を見る','user-tie',true),el('p',{class:'report-hub-description',text:'営業担当者の実績、見込み客の成約率、歩合給を確認できます。'}));
  else if(active==='csr')body.append(el('h3',{},icon('headset'),' 顧客対応の実績 ',el('small',{text:'（過去30日）'})),stats(snapshot.activity));
  for(const job of chartJobs)job();
 }
 function stats(items){return el('div',{class:'report-hub-stats'},items.map((item,i)=>el('article',{style:'border-left-color:'+['#2196F3','#FF9800','#A5CE3A','#9C27B0','#00BCD4','#4CAF50'][i%6]},el('span',{text:item.label}),el('strong',{text:item.value}),item.sub?el('small',{text:item.sub}):null)));}
 for(const [kind,label,glyph]of tabs)nav.append(action(label,glyph,()=>{active=kind;render()},{'data-kind':kind}));
 node.append(nav,el('div',{class:'report-hub-filters'},el('strong',{},icon('filter'),' 絞り込み'),el('label',{},'開始 ',start),el('label',{},'終了 ',end),customer,staff,action('適用','search',render,{class:'primary','data-apply':''}),action('リセット','times',()=>{calendars.forEach(c=>c.clear());customer.value='';staff.value='';render()},{'data-reset':''})),body);
 return {title:'集計レポート',titleIcon:'chart-line',headerClass:'report-hub-header',node,mount(){calendars=[start,end].map(d=>globalThis.flatpickr(d,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true}));render()},dispose(){charts.forEach(c=>c.destroy());calendars.forEach(c=>c.destroy());document.querySelectorAll('.report-document').forEach(d=>d.close())}};
}
