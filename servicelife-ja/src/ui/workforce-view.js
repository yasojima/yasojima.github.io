import {el} from './elements.js';
export function workforceView(data,path){
 const time=path==='/time-tracking/',node=el('section',{class:'workforce-content','data-workforce':''});
 const table=(headers,empty)=>el('div',{class:'workforce-table'},el('table',{},el('thead',{},el('tr',{},headers.map(text=>el('th',{text})))),el('tbody',{},el('tr',{},el('td',{colspan:headers.length,text:empty,class:'workforce-empty'})))));
 if(time){node.append(el('div',{class:'workforce-filters'},el('input',{id:'search',type:'text',placeholder:'スタッフ名で検索','aria-label':'スタッフ名で検索'}),['filterType','filterAnomaly'].map(id=>el('select',{id,'aria-label':id==='filterType'?'種類':'確認条件'},data.timeOptions[id].map(o=>el('option',{value:o.value,label:o.label,text:o.text}))))),table(['担当スタッフ','種類','出勤を記録','退勤を記録','所要時間','予約内容','承認済み','操作'],'該当する勤務記録はありません。'))}
 else{node.append(el('h2',{text:'対応区域'}),table(['区域','郵便番号','中心地点','半径','現場スタッフ','稼働中'],'担当エリアは未設定です。「設定 → 担当エリア」で登録してください。'),el('h2',{text:'作業班のひな形'}),table(['作業班名','班長','メンバー','稼働中'],'作業チームが未登録です。「設定 → 担当エリア → チームのひな形」で登録してください。'))}
 return{title:time?'作業時間の記録':'担当エリア・作業班',titleIcon:time?'clock':'map',headerClass:'workforce-header',node,mount(){},dispose(){}};
}
