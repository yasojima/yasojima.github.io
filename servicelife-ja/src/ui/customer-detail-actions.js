import { el,button,select,dialog,icon } from './elements.js';
import { routeHash } from '../core/router.js';
import { money,labelCustomerOptions } from '../domain/customer-history.js';

const denied='This action is disabled in the read-only demo.';
function errorNode(){return el('p',{class:'profile-error',role:'status',hidden:true});}
function show(node,text){node.textContent=text;node.hidden=false;}
function field(id,label,{type='text',value='',options,placeholder='',checked=false}={}){
  const input=options?select(label,options.map(([value,label])=>({value,label})),value,()=>{},{id}):el(type==='textarea'?'textarea':'input',{id,...(type==='textarea'?{rows:3}:{type}),value,placeholder,checked});
  if(options)labelCustomerOptions(input);
  return{input,node:el('div',{class:'field'},el('label',{for:id,text:label}),input)};
}
function check(id,label,checked=false){return el('label',{class:'profile-check'},el('input',{id,type:'checkbox',checked}),label);}
export function customerActions(person,role){
  const modals=new Set();
  let toast;
  function message(text){
    toast?.remove();toast=el('div',{class:'local-toast',role:'status'},el('span',{text}),button('×',()=>toast.remove(),{'aria-label':'通知を閉じる'}));document.body.append(toast);
  }
  function open(title,ic,content,label,submit,width=440){
    const modal=dialog(title,content);modal.classList.add('customer-operation');modal.style.width=width+'px';
    modal.querySelector('header h2').prepend(icon(ic),' ');modal.querySelector('header .close').remove();
    modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button(label,()=>submit(modal),{class:'primary'}));
    modals.add(modal);modal.addEventListener('close',()=>modals.delete(modal),{once:true});return modal;
  }
  function payment(amount=''){
    const total=el('p',{class:'profile-payment-total',hidden:!amount,text:amount?'合計 '+money(amount)+' (no sales-tax rate configured for this location)':''}),error=errorNode();
    const amt=field('payAmt','金額（税抜）',{type:'number',value:amount,placeholder:'0.00'});amt.input.min='0';amt.input.step='.01';
    amt.input.addEventListener('input',()=>{total.hidden=!(Number(amt.input.value)>0);total.textContent='合計 '+money(amt.input.value)+' (no sales-tax rate configured for this location)';});
    const pm=field('payPm','支払方法',{value:'__manual__',options:[['__manual__','+ Key in a new card...']]});
    const note=field('payNote','メモ（任意）',{placeholder:'例：7月分の作業料金を電話で受領'});
    open('支払いを受け付ける','credit-card',el('div',{class:'operation-fields'},amt.node,pm.node,
      el('div',{class:'field'},el('label',{text:'カード情報を手入力'}),el('div',{class:'unavailable-card'}),el('p',{class:'profile-error',text:'Card entry is not configured for this account.'})),
      check('paySaveCard','次回以降の支払いに使うカードとして登録する'),note.node,total,error),'決済する',()=>{
        show(error,Number(amt.input.value)>0?'Card form is still loading - try again in a moment.':'Enter a valid amount.');
      });
  }
  function call(){
    const direction=field('callDir','発信・着信',{value:'inbound',options:[['inbound','Inbound'],['outbound','Outbound']]});
    const outcome=field('callOut','対応結果',{value:'completed',options:[['completed','Completed (answered)'],['callback_scheduled','Callback Scheduled'],['voicemail','Voicemail'],['no_answer','No Answer'],['busy','Busy'],['wrong_number','Wrong Number']]});
    const duration=field('callDur','所要時間（分）',{type:'number',value:0}),reason=field('callReason','電話の用件'),notes=field('callNotes','メモ',{type:'textarea'}),error=errorNode();
    open('通話を記録','phone',el('div',{class:'operation-fields'},direction.node,outcome.node,duration.node,reason.node,notes.node,error),'通話記録を保存',()=>show(error,denied+', '+denied),520);
  }
  function ticket(){
    const subject=field('tkSubj','件名'),category=field('tkCat','分類',{value:'general_inquiry',options:[['general_inquiry','General Inquiry'],['service_issue','Service Issue'],['billing','Billing'],['scheduling','Scheduling'],['complaint','Complaint'],['callback_request','Callback Request'],['warranty','Warranty'],['cancellation','Cancellation']]}),
      priority=field('tkPri','優先度',{value:'medium',options:[['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']]}),description=field('tkDesc','内容',{type:'textarea'}),error=errorNode();
    open('対応依頼を追加','ticket-alt',el('div',{class:'operation-fields'},subject.node,category.node,priority.node,description.node,error),'対応依頼を作成',()=>show(error,subject.input.value.trim()?denied+', '+denied:'Subject required.'),520);
  }
  function preferences(pref){
    const status=field('prefStatus','対応状況',{value:pref?.status||'pending',options:[['pending','Pending (inferred)'],['completed','Completed (customer-confirmed)']]}),error=errorNode();
    show(error,'Could not load preference options.');
    open('訪問の希望条件を編集','sliders-h',el('div',{class:'operation-fields'},status.node,el('div',{class:'field'},el('label',{text:'希望の曜日・時間帯'}),'読み込み中…'),
      el('div',{class:'field'},el('label',{text:'希望の担当スタッフ'}),'読み込み中…'),error),'希望条件を保存',()=>show(error,denied),520);
  }
  function sendPreferences(){
    const choices=el('div',{class:'preference-channels'},[['sms','SMS TO '+person.phone],['email','EMAIL TO '+person.email.toUpperCase()]].map(([value,label])=>el('label',{},el('input',{name:'splCh',type:'radio',value}),label))),error=errorNode();
    const modal=open('希望条件の入力リンクを送る','paper-plane',el('div',{},el('p',{text:'お客様が希望の曜日・時間帯・担当者を変更できるリンクの送信方法を選んでください。リンクは14日間有効です。'}),el('h4',{text:'送信方法'}),choices,error),'リンクを送る',()=>{
      show(error,choices.querySelector(':checked')?denied:'Select a channel.');
    },520);
    const send=modal.querySelector('footer .primary');send.id='splSendBtn';send.disabled=true;choices.addEventListener('change',()=>{send.disabled=!choices.querySelector(':checked');});
  }
  return{payment,call,ticket,preferences,sendPreferences,message,
    book(){location.hash=routeHash(role,'/calendar/',new URLSearchParams({customer:person.id}));},
    edit(){location.hash=routeHash(role,'/customers/')+'#edit='+person.id;},
    openTickets(){location.hash=routeHash(role,'/tickets/',new URLSearchParams({customer:person.id}));},
    remove(){if(confirm('Delete this customer? They will be hidden from default lists. Recoverable by an admin.'))message('Could not delete: '+denied);},
    report(){if(confirm('Send the treatment report to this customer now (email + SMS)?'))message('No job log / report exists for this visit.');},
    dispose(){for(const modal of modals)modal.close();toast?.remove();}};
}

export function contactForm(close){
  const name=field('ccName','氏名'),role=field('ccRole','役割',{value:'other',options:[['owner','Owner'],['property_manager','Property Manager'],['tenant','Tenant'],['on_site_contact','On-Site Contact'],['ap','Accounts Payable'],['other','Other']]}),
    email=field('ccEmail','メールアドレス',{type:'email'}),phone=field('ccPhone','電話番号'),error=errorNode();
  return el('div',{class:'profile-contact-form'},el('h4',{text:'連絡先を追加'}),el('div',{class:'form-grid'},name.node,role.node,email.node,phone.node),
    el('h4',{text:'受け取る通知'}),el('div',{class:'profile-inline-checks'},check('ccRecInv','請求書'),check('ccRecSvc','訪問・作業のお知らせ'),check('ccRecDun','期限超過・督促')),
    el('h4',{text:'送信方法'}),el('div',{class:'profile-inline-checks'},check('ccViaEmail','メールアドレス',true),check('ccViaSms','SMS（ショートメッセージ）')),
    error,el('div',{class:'profile-inline-actions'},button('キャンセル',close),button('連絡先を保存',()=>show(error,name.input.value.trim()?denied:'Name is required.'),{id:'ccSaveBtn',class:'primary'})));
}

export function billingOverride(){
  const body=el('div',{class:'profile-billing-override'}),error=errorNode();
  const options=[['','— Select —'],['at_arrival_charge','At-arrival charge (server-side card on file)'],['at_service_collect','At-service collection (cash / check / card-via-reader)'],['net_invoice','Net Invoice (post-service billing)'],['pre_authorize','Pre-authorize (auth + later capture)'],['prepay_charge','Prepay (charge card on file before service)']];
  const policy=field('cd-billing-policy','Policy',{options}),notes=field('cd-billing-notes','Notes (required)',{type:'textarea'});
  const editor=el('div',{class:'profile-override-editor',hidden:true},el('h4',{text:'Override policy for this customer'}),policy.node,notes.node,error,
    // This captured control has no visible save result. Keep it local and do
    // not invent a successful policy update or validation that was not shown.
    el('div',{class:'profile-inline-actions'},button('キャンセル',()=>{editor.hidden=true;}),button('Save override',()=>{}, {id:'cd-billing-save',class:'primary'})));
  body.append(el('h3',{text:'請求ルール'}),el('p',{text:'No policy resolved (set a tenant default).'}),button('Override',()=>{editor.hidden=false;},{id:'cd-billing-override-btn'}),editor);return body;
}
