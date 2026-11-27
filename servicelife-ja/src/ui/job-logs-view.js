import {el} from './elements.js';
const date=value=>value?new Date(value).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}):'—';
const time=value=>value?new Date(value).toLocaleTimeString('ja-JP',{hour:'numeric',minute:'2-digit'}):'—';
export function jobLogsView(data,role){const own=role==='technician',columns=own?['日付','お客様','サービス内容','対応状況','メモ']:['日付','担当スタッフ','お客様','処理した区域','使用薬剤','開始日時','作業完了'];
 const rows=data.records.map(r=>own?[date(r.createdAt),r.customer,r.service,r.status,r.notes]:[date(r.createdAt),r.staff,r.customer,r.areas,r.chemicals,time(r.startedAt),time(r.completedAt)]);
 return {mount(){},dispose(){},title:own?'自分の作業記録':'作業記録',titleIcon:'clipboard-list',headerClass:'job-log-header',node:el('section',{class:'job-log-content','data-joblogs':role},own?null:el('input',{id:'search',type:'text',placeholder:'予約・担当スタッフで検索','aria-label':'予約・担当スタッフで検索',class:'job-log-search'}),el('div',{class:'job-log-table'},el('table',{},el('thead',{},el('tr',{},columns.map(text=>el('th',{text})))),el('tbody',{},rows.map(row=>el('tr',{},row.map(text=>el('td',{text}))))))))};}
