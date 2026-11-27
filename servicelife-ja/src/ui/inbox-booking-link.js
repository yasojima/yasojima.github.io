import {el,button} from './elements.js';
export function bookingLinkControl(customers){
 let modal;
 function open(){
  const fields={},linked=el('small',{class:'inbox-link-picked',hidden:true}),error=el('p',{class:'inbox-link-error',hidden:true}),results=el('div',{class:'inbox-link-results',hidden:true});
  function input(id,type='text',value='',placeholder=''){return fields[id]=el('input',{id,type,value,placeholder})}
  const field=(text,node)=>el('label',{},text,node),search=input('sblCustSearch','text','','名前・電話番号・メールアドレスで検索'),customer=field('顧客を検索',search),job=el('select',{id:'sblJobType'});
  customer.append(results);search.addEventListener('input',()=>{const term=search.value.trim().toLowerCase(),matches=term?customers.filter(c=>[c.name,c.phone,c.email].join(' ').toLowerCase().includes(term)):[];results.hidden=!matches.length;results.replaceChildren(...matches.map(c=>button(c.name+' — '+c.address,()=>{search.value=c.name;results.hidden=true;linked.textContent='Linked: '+c.name;linked.hidden=false;for(const [id,key] of [['sblAddr','address'],['sblCity','city'],['sblState','state'],['sblZip','zip'],['sblEmail','email'],['sblPhone','phone']])fields[id].value=c[key]||''}))) });
  const tabs=el('div',{class:'inbox-link-tabs'},['既存顧客','新しい見込み客'].map((text,i)=>button(text,()=>{customer.hidden=Boolean(i);linked.hidden=Boolean(i)||!linked.textContent;tabs.querySelectorAll('button').forEach((b,n)=>b.classList.toggle('selected',n===i))},{id:i?'sblModeProspect':'sblModeExisting',class:i?'':'selected'})));
  modal=el('dialog',{class:'inbox-link-dialog','aria-label':'予約リンクを送る'},el('h2',{text:'予約リンクを送る'}),el('p',{text:'既存のお客様または見込み客が、自分で日時を選べる予約リンクを発行します。'}),tabs,customer,field('作業の種類',job),el('div',{class:'inbox-link-two'},field('所要時間（分）',input('sblDur','number')),linked),field('現場住所',input('sblAddr','text','','番地・通り名')),el('div',{class:'inbox-link-three'},field('市区町村',input('sblCity')),field('州',input('sblState','text','PA')),field('郵便番号',input('sblZip'))),el('div',{class:'inbox-link-two'},field('送信先メールアドレス',input('sblEmail','email')),field('送信先の電話番号',input('sblPhone','tel'))),error,el('footer',{},button('閉じる',()=>modal.close(),{id:'sblCancel'}),button('作成して送る',()=>{error.hidden=false;error.textContent='Pick a job type.'},{id:'sblGo',class:'inbox-link-primary'})));
  const own=modal;own.addEventListener('close',()=>{own.remove();if(modal===own)modal=null},{once:true});own.addEventListener('click',e=>{if(e.target===own){const r=own.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)own.close()}});document.body.append(own);own.showModal();
 }
 return{node:button('＋ 予約リンク',open,{class:'inbox-booking-link'}),dispose(){modal?.close()}};
}
