import {localPreviewEditor} from './local-preview-editor.js';
import {el,button} from './elements.js';
export function workforceView(data,path){
 const time=path==='/time-tracking/',node=el('section',{class:'workforce-content','data-workforce':''});
 const table=(headers,empty)=>el('div',{class:'workforce-table'},el('table',{},el('thead',{},el('tr',{},headers.map(text=>el('th',{text})))),el('tbody',{},el('tr',{},el('td',{colspan:headers.length,text:empty,class:'workforce-empty'})))));
 if(time){node.append(el('div',{class:'workforce-filters'},el('input',{id:'search',type:'text',placeholder:'スタッフ名で検索','aria-label':'スタッフ名で検索'}),['filterType','filterAnomaly'].map(id=>el('select',{id,'aria-label':id==='filterType'?'種類':'確認条件'},data.timeOptions[id].map(o=>el('option',{value:o.value,label:o.label,text:o.text}))))),table(['担当スタッフ','種類','出勤を記録','退勤を記録','所要時間','予約内容','承認済み','操作'],'該当する勤務記録はありません。'))}
 else{node.append(el('h2',{text:'対応区域'}),table(['区域','郵便番号','中心地点','半径','現場スタッフ','稼働中'],'担当エリアは未設定です。追加から入力内容を確認できます。'),el('h2',{text:'作業班のひな形'}),table(['作業班名','班長','メンバー','稼働中'],'作業チームは未登録です。追加から入力内容を確認できます。'))}
 if(!time){const add=(team=false)=>localPreviewEditor(team?'作業班を追加':'担当エリアを追加',team?[{key:'name',label:'作業班名',required:true},{key:'lead',label:'班長',required:true},{key:'members',label:'メンバー'}]:[{key:'name',label:'エリア名',required:true},{key:'zip',label:'郵便番号',required:true},{key:'staff',label:'担当スタッフ'}],v=>{const tbody=node.querySelectorAll('tbody')[team?1:0];if(tbody.querySelector('.workforce-empty'))tbody.replaceChildren();tbody.append(el('tr',{},(team?[v.name,v.lead,v.members||'—','有効（確認用）']:[v.name,v.zip,'—','—',v.staff||'—','有効（確認用）']).map(text=>el('td',{text}))));});node.querySelectorAll('h2').forEach((heading,i)=>heading.append(' ',button('追加',()=>add(!!i),{class:'primary'})));}
 return{title:time?'作業時間の記録':'担当エリア・作業班',titleIcon:time?'clock':'map',headerClass:'workforce-header',node,mount(){},dispose(){}};
}
