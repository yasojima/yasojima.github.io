import {el,button} from './elements.js';
import {routeHash} from '../core/router.js';
export function csrDashboardView(data){
 let example=false;const node=el('div',{class:'customer-desk','data-csr-dashboard':''}),link=(label,route)=>el('a',{href:routeHash(data.role,route),text:label}),muted=text=>el('p',{class:'desk-muted',text});
 const heading=(title,sub,action)=>el('header',{class:'desk-panel-heading'},el('div',{},el('h2',{text:title}),sub?muted(sub):null),action);
 const toggle=button('操作例を表示',()=>{example=!example;toggle.textContent=example?'操作例を閉じる':'操作例を表示';toggle.setAttribute('aria-pressed',String(example));update()},{class:'desk-example-toggle','aria-pressed':'false'});
 const top=el('header',{class:'desk-intro'},el('div',{},el('h1',{text:'顧客対応ダッシュボード'}),el('p',{text:'2026年11月26日のデモ記録'})),toggle);
 const visits=el('div',{class:'desk-schedule-list',tabindex:0,'aria-label':'今日の予定一覧'});
 for(const [name,predicate] of [['午前',v=>v.time<'12:00'],['午後',v=>v.time>='12:00']]){const rows=data.visits.filter(predicate);if(!rows.length)continue;visits.append(el('div',{class:'desk-time-group'},el('h3',{text:name+' · '+rows.length+'件'}),el('ol',{},rows.map(v=>el('li',{class:'desk-visit'},el('time',{text:v.time}),el('div',{},el('strong',{text:v.name}),muted(v.info)),el('div',{class:'desk-assignment'},el('span',{text:v.staff}),el('span',{class:'desk-visit-status',text:v.status})))))))}
 const schedule=el('section',{class:'desk-panel desk-schedule'},heading('今日の予定',data.visits.length+'件の予定 · 担当 '+new Set(data.visits.map(v=>v.staff)).size+'人',link('カレンダーへ','/calendar/')),visits);
 const callbacks=el('div',{class:'desk-callback-body'}),callbackPanel=el('section',{class:'desk-panel'},heading('折り返しが必要な電話','',link('通話履歴へ','/call-log/')),callbacks);
 const tickets=el('section',{class:'desk-panel'},heading('対応中の依頼','表示対象 '+data.tickets.length+'件',link('依頼一覧へ','/tickets/')),el('ul',{class:'desk-tickets'},data.tickets.map(t=>el('li',{},link(t.title,'/tickets/'),muted(t.info)))));
 const recent=el('details',{class:'desk-recent'},el('summary',{text:'最近の通話'}),el('p',{class:'desk-empty',text:'通話記録はありません。'}));
 const activity=el('section',{class:'desk-panel'},heading('対応の記録','',link('受信箱へ','/csr-inbox/')),el('dl',{class:'desk-activity'},data.activity.map(([name,value])=>el('div',{},el('dt',{text:name}),el('dd',{text:value})))),recent);
 const performance=el('div',{class:'desk-performance-body'}),performancePanel=el('section',{class:'desk-panel'},heading('受信箱の予約実績'),performance);
 function update(){callbacks.replaceChildren(muted(example?'操作例・架空データ · '+data.callbacks.length+'件':'保存済み通話記録 · 0件'),...(example?data.callbacks.map(c=>el('details',{class:'desk-callback'},el('summary',{},el('strong',{text:c.name}),el('time',{text:c.time})),el('div',{class:'desk-callback-text'},muted(c.staff),el('p',{text:c.note})))):[el('p',{class:'desk-empty',text:'折り返しの記録はありません。'})]));performance.replaceChildren(muted(example?'操作例・架空の予約記録から集計':'2026年11月26日 22:27（日本時間）に別のデモ環境で取得した参考集計'),el('div',{class:'desk-performance-scroll'},el('table',{},el('thead',{},el('tr',{},['指標','直近7日','内訳'].map(text=>el('th',{text})))),el('tbody',{},(example?data.examplePerformance:data.performance).map(row=>el('tr',{},row.map(text=>el('td',{text}))))))))}
 node.append(top,el('div',{class:'desk-top-grid'},schedule,el('div',{class:'desk-right-stack'},callbackPanel,tickets)),el('div',{class:'desk-bottom-grid'},activity,performancePanel));update();
 return{title:'顧客対応ダッシュボード',workspace:true,groups:data.groups,node,mount(){},dispose(){}};
}
