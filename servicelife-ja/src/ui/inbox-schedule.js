import {el,button} from './elements.js';
import {field,input,choice,notifyChoices,reasons} from './inbox-dialogs.js';
const check=(id,label)=>el('label',{class:'inbox-form-check'},input(id,'on',{type:'checkbox'}),label);
const states='PA NJ DE NY MD CT MA RI VT NH ME VA WV OH FL CA TX IL GA NC SC TN KY IN MI WI MN IA MO AR LA MS AL OK KS NE SD ND MT WY CO NM AZ UT NV ID OR WA AK HI DC'.split(' ').map(x=>({value:x,label:x}));
export function scheduleDialogs(data,open){
 function schedule(record,appointment){if(!record.customer)return createCustomer(record);const asap=el('div',{class:'inbox-form-grid',hidden:true},field('Earliest',input('apptDrwEarliest','2026-11-27',{type:'date'})),field('Latest',input('apptDrwLatest','',{type:'date'})),field('Time of day',choice('apptDrwTimeOfDay',[{value:'',label:'指定なし'},{value:'morning',label:'Morning'},{value:'afternoon',label:'Afternoon'},{value:'evening',label:'Evening'}])),check('apptDrwAvoidWeekends','Avoid weekends'));const body=el('div'),specific=el('div',{class:'inbox-form-grid'}),options=choice('apptDrwAddrPicker',[{value:'primary',label:record.customer.primaryAddress},...record.customer.locations.map(l=>({value:l.id,label:l.name+' — '+l.address}))]),date=input('apptDrwSpecDate','2026-11-27',{type:'date'}),duration=input('apptDrwDuration',appointment?.minutes||60,{type:'number',min:1}),reason=choice('apptDrwReasonCode',reasons);let mode='specific';
 if(appointment)body.append(el('p',{text:'Currently scheduled: '+appointment.service+' ・ '+new Date(appointment.start).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'})+' with '+appointment.staff+'.'}));
 else if(record.id==='10730bb0-dce0-4113-a50b-1cf71ba6b25a'){const hint=el('div',{class:'inbox-detected'},'Detected: Saturday 11am',button('×',()=>hint.remove(),{'aria-label':'検出した日時を閉じる'}));body.append(hint)}
 const tabs=el('div',{class:'inbox-mode-tabs'},[['asap','ASAP — Soonest'],['specific','Specific date/time']].map(([value,label])=>button(label,()=>{mode=value;specific.hidden=mode!=='specific';asap.hidden=mode!=='asap';tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode))},{class:value===mode?'selected':'','data-mode':value})));specific.append(field('日付',date),field('開始時刻',input('apptDrwSpecStart','09:00',{type:'time'})),field('Time window end 任意',input('apptDrwSpecEnd','',{type:'time'})));
 body.append(tabs,field('Service(s)'+(appointment?'':' required'),el('div',{class:'inbox-empty-services'})),el('div',{class:'inbox-form-grid'},field('所要時間 minutes',duration),field('Preferred tech',choice('apptDrwTech',[{value:'',label:'Any'}])),field('料金 pre-tax subtotal',input('apptDrwPrice','',{type:'number',placeholder:'0.00'}))),field('現場住所',el('div',{class:'inbox-address-picker'},options,button('+ New',()=>newAddress(record),{id:'apptDrwAddrAdd'}))),specific,asap,field('Send confirmation',choice('apptDrwSendCh',notifyChoices)));
 if(appointment)body.append(field('Reason for reschedule',reason),field('Comment 任意',el('textarea',{id:'apptDrwReasonComment'})));
 body.append(el('p',{class:'inbox-help',text:appointment?"Couldn't load suggestions: This action is disabled in the read-only demo.":'Pick a service to see available slots.'}),el('p',{text:'No slot selected yet.'}));
 if(!appointment)body.append(el('h3',{text:'Contracts & forms — created & sent to the customer after scheduling'}),check('apptCkCcAuth','Create Credit Card Authorization form'),check('apptCkMaint','Create Maintenance agreement'),check('apptCkPrefLink','Send preferred recurring day/time form'));
 const ui=open(appointment?'Reschedule appointment':'Schedule appointment',body,{id:'apptDrwSubmit',label:appointment?'日時変更':'予定',disabled:true,run(){}},{drawer:true,cancelId:'apptDrwCancel'});
 for(const control of [date,...asap.querySelectorAll('input[type=date]')])globalThis.flatpickr(control,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'m/d/Y',allowInput:true,disableMobile:true,appendTo:ui.node});
 }
 function newAddress(record){const body=el('div',{},field('Location name e.g. Warehouse, Vacation Home',input('apptNewAddrName','',{placeholder:'訪問先の共通情報'})),field('Address line 1 required',input('apptNewAddrLine1')),field('Address line 2 apt, suite, unit',input('apptNewAddrLine2')),el('div',{class:'inbox-form-grid'},field('市区町村',input('apptNewAddrCity')),field('州',input('apptNewAddrState','PA')),field('郵便番号',input('apptNewAddrZip'))));open('Add service address',body,{id:'apptNewAddrSave',label:'Save address',run:ui=>{const address=body.querySelector('#apptNewAddrLine1').value,city=body.querySelector('#apptNewAddrCity').value;ui.error(!address.trim()?'Address line 1 is required.':'This action is disabled in the read-only demo.')}},{cancelId:'apptNewAddrCancel'})}
 function createCustomer(record){
  const body=el('div'),type=choice('apptNcType',[{value:'residential',label:'Residential'},{value:'commercial',label:'Commercial'}]);
  const company=field('会社名*',input('apptNcCompany'));
  const billing=el('div',{hidden:true,class:'inbox-form-grid'});
  for(const [id,label] of [['BillFirst','Billing first name'],['BillLast','Billing last name'],['BillEmail','Billing email'],['BillPhone','Billing phone'],['BillCompany','Billing company'],['BillAddr','Billing street'],['BillAddr2','Billing apt/suite'],['BillCity','請求先の市区町村'],['BillState','州'],['BillZip','郵便番号']])billing.append(field(label,id==='BillState'?choice('apptNc'+id,states):input('apptNc'+id)));
  const different=input('apptNcDiffBilling','on',{type:'checkbox',onchange:()=>billing.hidden=!different.checked});
  company.hidden=true;type.addEventListener('change',()=>company.hidden=type.value!=='commercial');
  body.append(el('p',{class:'inbox-help',text:'手順1／2 Create customer, then pick a slot. The phone number is prefilled from this call.'}),el('h3',{text:'お客様'}),field('種類*',type),company,
   el('div',{class:'inbox-form-grid'},field('名*',input('apptNcFirst')),field('姓*',input('apptNcLast')),field('電話番号*',input('apptNcPhone',record.contact_phone,{type:'tel'})),field('Alt phone 任意',input('apptNcPhoneAlt','',{type:'tel'})),field('メールアドレス 任意',input('apptNcEmail','',{type:'email'})),field('Preferred contact',choice('apptNcPrefContact',[{value:'phone',label:'Phone'},{value:'sms',label:'SMS'},{value:'email',label:'Email'}]))),
   el('h3',{text:'現場住所'}),field('通り名*',input('apptNcAddr')),field('Apt/Suite 任意',input('apptNcAddr2')),
   el('div',{class:'inbox-form-grid'},field('市区町村',input('apptNcCity')),field('州',choice('apptNcState',states)),field('郵便番号',input('apptNcZip')),field('物件の種類',choice('apptNcPropType','House Apartment Multifamily Retail Office Industrial Restaurant Hospitality Land'.split(' ').map(s=>({value:s.toLowerCase(),label:s}))))),
   field('Contact title',choice('apptNcContactTitle',[{value:'owner',label:'Owner'},{value:'landlord',label:'Landlord'},{value:'tenant',label:'Tenant'},{value:'property_manager',label:'Property Manager'}])),
   el('label',{class:'inbox-form-check'},different,'Different billing contact / address'),billing);
  open('顧客を追加',body,{id:'apptNcSubmit',label:'Create & Schedule',run:ui=>{
   const missing=[];body.querySelectorAll('.inbox-field-error').forEach(e=>e.remove());
   for(const [id,message] of [['apptNcFirst','First name is required.'],['apptNcLast','Last name is required.'],['apptNcPhone','Phone is required.'],['apptNcAddr','Service address is required.'],...(type.value==='commercial'?[['apptNcCompany','Company name is required for commercial customers.']]:[])]){
    const control=body.querySelector('#'+id);if(!control.value.trim()){control.after(el('small',{class:'inbox-field-error',text:message}));missing.push(id)}
   }ui.error(missing.length?'':"You don't have permission to do that.")
  }})
 }
 return{schedule};
}
