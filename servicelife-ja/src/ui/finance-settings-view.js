import {el,button,icon,dialog} from './elements.js';
import {routeHash} from '../core/router.js';

export const financeSettingsRoutes=['/settings/billing-policies/','/settings/commissions/','/settings/payments/','/settings/system-bugs/'];
const choices=(id,options,value)=>{const node=el('select',{id,name:id},options.map(x=>el('option',{value:x.value,label:x.label},x.text)));if(value!==undefined)node.value=value;return node;};
export function financeSettingsView(snapshot,path,role,query){
 const node=el('section',{class:'finance-settings','data-finance-setting':path}),modals=[];
 const link=(label,url,cls='')=>el('a',{href:routeHash(role,url),class:cls},label);
 const description=text=>el('p',{class:'finance-setting-description',text});
 const panel=(title,sub,...children)=>el('article',{class:'finance-setting-panel'},el('h3',{},title),sub?description(sub):null,...children);
 const noop=()=>{},form=(...children)=>el('form',{onsubmit:e=>e.preventDefault(),autocomplete:'off'},...children);
 let title,compactHeader=true,headerExtra=null,titleIcon;
 if(path==='/settings/billing-policies/'){
  title='請求ルール';node.classList.add('policy-settings');
  const body=el('section'),tabs=el('nav',{class:'policy-tabs'}),drafts={};let selected=0;
  const names=['Tenant default','Customer-type defaults','親アカウント','Per-customer overrides'];
  const draw=()=>{for(const [i,b] of [...tabs.children].entries())b.classList.toggle('active',i===selected);const input=choices('tenantPolicySelect',snapshot.policyOptions,drafts[selected]?.policy||''),status=el('span',{class:'policy-unset',text:drafts[selected]?'仮設定済み':'NOT SET'});let target=null;
   if(selected===1)target=choices('policyTarget',[{value:'residential',text:'個人宅'},{value:'commercial',text:'会社・施設'}],drafts[selected]?.target||'residential');
   else if(selected>1)target=el('input',{id:'policyTarget',placeholder:selected===2?'親アカウント名':'顧客名またはID',value:drafts[selected]?.target||''});
   body.replaceChildren(el('h3',{text:['Tenant-wide default','顧客区分ごとの標準','親アカウントごとの標準','お客様ごとの例外'][selected]}),description('優先順：お客様の例外 → 顧客区分 → 親アカウント → 業者の標準。仮設定はこの画面を離れると元に戻ります。'),...(target?[el('label',{},'対象 ',target)]:[]),el('div',{class:'policy-row'},el('label',{for:input.id,text:'Policy'}),input,status),button('設定をプレビュー',()=>{if(!input.value||target&&!target.value.trim()){status.textContent='対象とルールを選択してください。';return}drafts[selected]={policy:input.value,target:target?.value};status.textContent='仮設定：'+input.selectedOptions[0].label;},{id:'tenantSaveBtn',class:'primary'}));};
  names.forEach((name,i)=>tabs.append(button(name,()=>{selected=i;draw()},{class:i===0?'active':''})));
  node.append(el('h2',{text:title}),description('Cascade order: customer override > customer-type default > parent-account default > tenant default.'),el('div',{class:'policy-card'},tabs,body));draw();
 }else if(path==='/settings/payments/'){
  title='決済会社';node.classList.add('payment-settings');let selected='square';
  const provider=choices('pp-provider-select',[{value:'square',text:'Square',label:'Square'},{value:'stripe',text:'Stripe',label:'Stripe'}],snapshot.provider),saveMessage=el('p',{class:'finance-setting-error',hidden:true,role:'status'});
  const active=panel('Active provider','Determines which gateway processes new charges, refunds, and recurring auto-pay.',el('div',{class:'provider-row'},el('b',{class:'provider-badge',text:'Square'}),provider,button('Save provider',()=>{saveMessage.hidden=false;saveMessage.textContent='Save failed: {"detail":"This action is disabled in the read-only demo.","error":"This action is disabled in the read-only demo."}';},{id:'pp-save-provider',class:'primary'})),saveMessage);
  const forms={};
  const field=(name,label,placeholder,help)=>{const input=el('input',{id:'pp-'+name,name,placeholder});return el('label',{class:'payment-setting-field',for:input.id},label,input,help?el('small',{text:help}):null);};
  const secretLabel=(label,help)=>el('p',{class:'payment-secret-label'},label+' ',el('small',{text:help}));
  for(const gateway of ['stripe','square']){
   const stripe=gateway==='stripe',capital=stripe?'Stripe':'Square',message=el('p',{class:'finance-setting-error',role:'status',hidden:true});
   const content=stripe?[
    secretLabel('Secret key','Starts with sk_live_ (production) or sk_test_ (sandbox). Never displayed back after saving.'),field('publishable_key','Publishable key','pk_live_…'),secretLabel('Webhook signing secret','From your Stripe webhook endpoint settings.')
   ]:[secretLabel('Access token','From Square Developer Dashboard → your application → Credentials. Never displayed back after saving.'),field('application_id','Application ID','sq0idp-… (or sandbox-sq0idb-…)','From Square Developer Dashboard → Credentials → Application ID. Required for the customer portal Web Payments SDK.'),field('location_id','Location ID','L…','Visible — identifies which Square location funds settle to.'),el('label',{class:'payment-setting-field'},'利用環境',choices('environment',[{value:'sandbox',text:'Sandbox (test)',label:'Sandbox (test)'},{value:'production',text:'Production (live)',label:'本番環境'}],snapshot.environment))];
   forms[gateway]=panel([capital+' credentials ',el('span',{class:'setting-badge warning',text:'未設定'})],stripe?"Per-tenant Stripe keys. Required when this tenant's preferred provider is Stripe.":"Per-tenant Square access token + location. Required when this tenant's preferred provider is Square.",
    form(el('div',{class:'payment-setting-fields'},content),el('div',{class:'payment-setting-actions'},button('接続をテスト',()=>{message.hidden=false;message.textContent='Test request failed (HTTP 403)';},{id:'pp-test-'+gateway}),el('button',{class:'primary',type:'submit'},'Save '+capital+' credentials'))),message);
   forms[gateway].hidden=gateway!==selected;
  }
  const tabs=el('nav',{class:'provider-tabs'},['stripe','square'].map(gateway=>button(gateway==='stripe'?'Stripe':'Square',()=>{selected=gateway;Object.entries(forms).forEach(([name,form])=>form.hidden=name!==selected);[...tabs.children].forEach(x=>x.classList.toggle('active',x.textContent.toLowerCase()===selected));},{class:gateway===selected?'active':''})));
  node.append(el('h2',{text:title}),description('Configure which payment gateway your tenant uses and supply the API credentials. Stored encrypted at rest. Only company admins can view or edit.'),active,tabs,forms.stripe,forms.square);
 }else if(path==='/settings/commissions/'){
  title='歩合給のプラン';node.classList.add('commission-settings');compactHeader=false;titleIcon='percent';headerExtra=link([icon('chart-line'),' ダッシュボード'],'/commissions/dashboard/');
  const grid=el('div',{class:'commission-grid'});
  const labels={name:'名称',description:'内容',trigger:'Trigger',trigger_days:'Trigger days (retention only)',recipient_kind:'Recipient',manager_depth:'Manager depth (override only)',calc_kind:'Calculation',flat_amount_cents:'Flat amount (cents)',percent:'Percent',residual_cap_months:'Residual cap months',payout_cadence:'Payout cadence',clawback_window_days:'Clawback window (days)',clawback_schedule:'Tiered clawback schedule (JSON, optional)'};
  const helps={trigger:'When does the commission "earn"?',manager_depth:'1 = direct manager, 2 = grandmanager. Capped at 5.',clawback_schedule:'Empty = all-or-nothing 100% within the window.'};
  for(const name of Object.keys(labels)){
   const data=snapshot.commissions[name],input=data.type==='select'?choices(name,data.options,data.value):el(data.type==='textarea'?'textarea':'input',{id:name,name,...(data.type==='textarea'?{}:{type:data.type}),value:data.value,placeholder:data.placeholder,...Object.fromEntries(['min','max','step'].filter(k=>data[k]).map(k=>[k,data[k]])),...(data.required?{required:''}:{})});
   if(data.type==='select'&&data.required)input.required=true;
   grid.append(el('div',{class:'commission-field'+(['name','description','clawback_schedule'].includes(name)?' wide':'')},el('label',{for:name,text:labels[name]}),input,helps[name]?el('small',{text:helps[name]}):null));
  }
  node.append(description('Define how this tenant pays commissions. Each plan can target a different rep population (sales reps, technicians, managers via override) and use a different calculation. The auto-assignment fires when a customer is created with an original_sales_rep set — flip the "default for new customers" toggle on the plans you want auto-applied.'),
   panel('Existing plans','',description('No plans yet. Create your first below.')),panel('Create new plan','Saved via the commissions API. Fields validate before submit.',form(grid,el('label',{class:'commission-default'},el('input',{type:'checkbox',name:'is_default_for_new_customers',value:'1'}),' Default for new customers (auto-assign)'),el('button',{type:'submit',class:'primary'},'Create plan'))),
   panel('Recent assignments (0)','Auto-created when a contract is signed for a customer with a default plan + sales rep. Manual rows live alongside.',description('No active assignments yet.')));
 }else if(path==='/settings/system-bugs/'){
  title='不具合の管理';node.classList.add('bug-settings');compactHeader=false;titleIcon='bug';
  const filters=[['','すべて'],['queued','処理待ち'],['investigating','調査中'],['needs_review','要確認'],['under_review','審査中'],['merged','統合済み'],['wontfix','修正対象外'],['closed','対応終了']];
  const open=()=>{
   const title=el('input',{id:'bug-title',name:'title',required:'',placeholder:'簡潔な概要（例：顧客対応の受信箱で日付順に並べ替えられない）'}),description=el('textarea',{id:'bug-description',name:'description',required:'',placeholder:'期待した動作、実際に起きたこと、該当のページやURL、同じことが起きる操作手順を記入してください。調査担当は入力した内容をそのまま確認します。'}),priority=choices('bug-priority',[['low','Low','低'],['medium','Medium','中'],['high','High','高'],['critical','Critical','緊急']].map(([value,text,label])=>({value,text,label})),'medium');
   const body=form(...[['タイトル',title],['内容',description],['優先度',priority]].map(([label,input])=>el('div',{class:'field'},el('label',{for:input.id,text:label}),input)));
   const modal=dialog('不具合を報告',body);modal.classList.add('bug-dialog');modal.querySelector('header .close').remove();modals.push(modal);modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button([icon('paper-plane'),' 不具合を対応待ちに追加'],()=>body.reportValidity(),{class:'primary'}));
  };
  node.append(el('div',{class:'bug-toolbar'},el('nav',{},filters.map(([value,label])=>link(label,'/settings/system-bugs/'+(value?'?status='+value:''),query.get('status')===value||!query.get('status')&&!value?'active':''))),button([icon('plus'),' 不具合を報告'],open,{id:'new-bug-btn',class:'primary'})),el('div',{class:'bug-empty'},icon('bug'),el('p',{text:'不具合の報告はありません。'})));
 }
 return {title,node,compactHeader,titleIcon,headerExtra,headerClass:compactHeader?'':'finance-setting-header',mount(){},dispose(){modals.forEach(x=>x.close());}};
}
