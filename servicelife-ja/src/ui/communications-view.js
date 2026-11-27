import {el,button,icon} from './elements.js';
const display=s=>String(s).replaceAll('\\u3000','　');
export function communicationsView(data,path){
 const isCall=path==='/call-log/',title=isCall?'通話履歴':'返信テンプレート',addLabel=isCall?'通話を記録':'返信テンプレートを追加';
 let modal=null,toast=null,timer=null,bodyEdited=false;const node=el('section',{class:'communications-content','data-communications':path});
 const flash=message=>{clearTimeout(timer);toast?.remove();toast=el('div',{class:'communications-toast',role:'status',text:message});(modal||node).append(toast);timer=setTimeout(()=>{toast?.remove();toast=null},2500)};
 const input=(id,extra={})=>el('input',{id,...extra});
 const optionSelect=(id,value,change)=>{const s=el('select',{id,onchange:change||(()=>{})},data.options[id].map(o=>el('option',{value:o.value,label:o.label,text:o.text})));s.value=value??data.options[id][0].value;return s};
 const search=input('search',{placeholder:isCall?'通話履歴を検索':'返信テンプレートを検索',oninput:()=>renderList()});
 const toolbar=el('div',{class:'communications-toolbar'},search);
 if(isCall)toolbar.append(optionSelect('fDir','',()=>renderList()),optionSelect('fOutcome','',()=>renderList()));else toolbar.append(optionSelect('fCat','',()=>renderList()));
 const list=el('div',{class:isCall?'communications-table':'communications-templates'});node.append(toolbar,list);
 function renderList(){
  if(isCall){list.replaceChildren(el('table',{},el('thead',{},el('tr',{},['','日時','お客様','電話番号','所要時間','対応結果','対応スタッフ','メモ','操作'].map(text=>el('th',{text})))),el('tbody',{},el('tr',{},el('td',{colspan:9},el('p',{text:'通話履歴はありません'}))))));return}
  const visible=!search.value&&!toolbar.querySelector('select').value?data.templates:[];
  list.replaceChildren(...(visible.length?visible.map(t=>el('article',{},el('h3',{text:t.titleLabel}),el('span',{class:'communications-category',text:t.categoryLabel}),el('p',{text:display(t.bodyLabel)}),el('footer',{},button([icon('copy'),' コピー'],async()=>{try{await navigator.clipboard.writeText(t.body);flash('Copied!')}catch{flash('Copy failed')}}),button([icon('edit'),' 編集'],()=>edit(t)),button(icon('trash'),()=>{if(confirm('Delete this response?'))flash('Deleted')},{'aria-label':t.titleLabel+'を削除',class:'communications-delete'})))):[el('div',{class:'communications-no-templates',text:'No canned responses yet — click New Response to add one.'})]));
 }
 const field=(label,control,extra)=>el('label',{class:'communications-field'},el('span',{},label,extra?el('span',{class:'communications-hint',text:' '+extra}):null),control);
 function edit(template){
  if(modal)modal.close();clearTimeout(timer);toast?.remove();toast=null;
  const body=el('div',{class:'communications-modal-body'}),controls={};
  const add=(id,control)=>{controls[id]=control;return control};
  if(isCall){
   const customer=add('fCustSearch',input('fCustSearch',{placeholder:'顧客を検索'})),results=el('div',{class:'communications-customer-results',id:'custResults'}),phone=add('fPhone',input('fPhone',{type:'tel'}));
   customer.addEventListener('input',()=>{const raw=customer.value.trim(),q=raw.replace(/\s+/g,' ').toLowerCase();if(q.length<2){results.replaceChildren();return}const matches=data.customers.filter(c=>c.search.some(v=>v.toLowerCase().includes(q))).slice(0,5);if(matches.length){results.replaceChildren(...matches.map(c=>button([c.first_name+' '+c.last_name+' ',el('span',{text:c.phone})],()=>{customer.value=c.first_name+' '+c.last_name;phone.value=c.phone;results.replaceChildren()})));return}const digits=(raw.match(/\d/g)||[]).length,isPhone=digits>=4&&digits/raw.length>=.5;results.replaceChildren(el('div',{class:'communications-no-customer',text:'No matching customer.'}),button([icon('user-plus'),' Create new customer '+(isPhone?'with phone '+raw:'"'+raw+'"')],()=>flash('Could not create customer: This action is disabled in the read-only demo., This action is disabled in the read-only demo.'),{class:'communications-create-customer'}));});
   body.append(field('お客様',el('div',{},customer,results)),el('div',{class:'communications-form-row'},field('電話番号',phone),field('発信・着信',add('fCallDir',optionSelect('fCallDir','inbound')))),el('div',{class:'communications-form-row'},field('所要時間（分）',add('fDuration',input('fDuration',{type:'number',value:0}))),field('対応結果',add('fCallOut',optionSelect('fCallOut','completed')))),field('電話の用件',add('fReason',input('fReason',{placeholder:'例：台所のゴキブリ、トコジラミ駆除後の確認'})),'害虫の種類・お問い合わせの内容'),field('メモ',add('fNotes',el('textarea',{id:'fNotes'}))));
  }else{
   body.append(field('件名（必須）',add('fTitle',input('fTitle',{value:template?.title||''}))),el('div',{class:'communications-form-row'},field('分類',add('fRCat',optionSelect('fRCat',template?.category||'general'))),field('経路',add('fRChan',optionSelect('fRChan',template?.channel||'all')))),field('本文（必須）',add('fBody',el('textarea',{id:'fBody',placeholder:'差し込み項目に {customer_name}、{appointment_date}、{tech_name} を使えます',value:template?(bodyEdited?template.body:template.bodyLabel):'',oninput:()=>bodyEdited=true}))));
  }
  const close=()=>modal?.close();
  const save=()=>flash(isCall?'Error: This action is disabled in the read-only demo., This action is disabled in the read-only demo.':!controls.fTitle.value.trim()||!controls.fBody.value.trim()?'Title and body required':'Error saving');
  modal=el('dialog',{class:'communications-modal '+(isCall?'call-modal':'template-modal'),'aria-label':template?'Edit Response':addLabel},el('header',{},el('h3',{text:template?'Edit Response':addLabel}),button('×',close,{'aria-label':'閉じる'})),body,el('footer',{},button('キャンセル',close),button([icon('check'),' 保存'],save,{class:'save'})));
  const currentModal=modal;currentModal.addEventListener('close',()=>{currentModal.remove();if(modal===currentModal){clearTimeout(timer);toast?.remove();toast=null;modal=null}},{once:true});node.append(currentModal);currentModal.showModal();
 }
 renderList();return{title,titleIcon:isCall?'phone-alt':'comments',headerClass:'communications-header '+(isCall?'call-header':'template-header'),addLabel,add:()=>edit(),node,mount(){},dispose(){clearTimeout(timer);modal?.close();toast?.remove()}};
}
