import { el, button, select, dialog } from './elements.js';
import { routeHash } from '../core/router.js';

export const settingRoutes=['/settings/holidays/','/settings/review-links/','/settings/tech-permissions/','/settings/clearpath/','/settings/clearpath/vehicles/'];
export function settingsView(snapshot,path,role) {
  const calendars=[],modals=new Set();
  const root=el('section',{class:'settings-content','data-setting-route':path});
  const description=text=>el('p',{class:'setting-description',text});
  const panel=(title,subtitle,...content)=>el('section',{class:'setting-panel'},el('h3',{},title),subtitle?description(subtitle):null,...content);
  const heading=(title,note)=>{root.append(el('h2',{text:title}),description(note));return title;};
  const field=(name,label,value='',options={})=>{
    const {type='text',help,id=name,...attributes}=options;
    const input=el('input',{name,id,type,value,...attributes});
    const box=el('div',{class:'setting-field'},el('label',{for:id,text:label}),input,help?el('small',{text:help}):null);
    return{box,input};
  };
  const calendar=input=>{input.dataset.date='true';calendars.push(input);return input;};
  const form=(...children)=>el('form',{autocomplete:'off',onsubmit:event=>event.preventDefault()},...children);
  const save=label=>el('button',{type:'submit',class:'primary',text:label||'保存'});
  const link=(label,route)=>el('a',{href:routeHash(role,route),text:label});
  let title;
  if(path==='/settings/holidays/') {
    root.classList.add('setting-narrow');
    title=heading('会社の休業日',"Days the whole company is closed. On a holiday, no technician is offered for new bookings — the scheduler skips the day for everyone. For one person's PTO or a partial-day block, use 休暇 on that user's page under 利用者アカウント.");
    const name=field('name','Name (optional)','',{maxlength:200,placeholder:'e.g. Thanksgiving'});
    const start=field('start_date','開始日','',{required:''}),end=field('end_date','End date (optional)');
    calendar(start.input);calendar(end.input);
    root.append(panel('Add a holiday','Pick one day, or a start and end date for a multi-day closure.',form(el('div',{class:'holiday-fields'},name.box,start.box,end.box,save('Add holiday')))));
    const rows=snapshot.holidays.map(record=>{
      const [year,month,day]=record.date.split('-').map(Number);
      return el('tr',{class:record.past?'holiday-past':''},el('td',{},record.name,record.past?el('span',{class:'holiday-badge',text:'PAST'}):null),
        el('td',{text:year+'年'+month+'月'+day+'日'}),el('td',{},form(el('button',{type:'submit',class:'danger',text:'削除'}))));
    });
    root.append(panel('Scheduled holidays','',el('div',{class:'table-scroll'},el('table',{class:'holiday-table'},el('thead',{},el('tr',{},['HOLIDAY','DATES',''].map(text=>el('th',{text})))),el('tbody',{},rows)))));
  }else if(path==='/settings/tech-permissions/') {
    root.classList.add('setting-narrow');
    title=heading('Technician Permissions','Controls what techs can do from the /my-day/ self-service surface.');
    const toggle=el('input',{id:'tp-toggle',name:'allow_tech_self_scheduling',type:'checkbox',checked:snapshot.technician.selfScheduling});
    const window=field('start_window_minutes','',snapshot.technician.startWindow,{type:'number',min:0,max:120,step:1});
    root.append(form(panel('Self-scheduling','Lets technicians create their own appointments from /my-day/.',el('label',{class:'setting-toggle'},toggle,
      el('span',{},el('strong',{text:'Allow techs to self-schedule appointments'}),description('When ON, technicians can create appointments for themselves only. Senior techs can also create appointments for techs they manage (via direct_reports). When OFF, only company_admin / csr / tech_manager can create appointments.')))),
      panel('Start Job window','How early a tech can tap "Start Job" before the scheduled time.',el('div',{class:'setting-number'},window.input,el('label',{for:'start_window_minutes',text:'minutes (range 0 – 120; default 30)'})),
        el('p',{class:'setting-window-help',text:'Techs can tap Start Job this many minutes before their scheduled appointment time. Set to 0 to require techs to start AT the scheduled time.'})),save()));
  }else if(path==='/settings/review-links/') {
    const data=snapshot.reviews;
    title=heading('Review Link Routing','Where customers land when they tap "Leave a Review" in the post-job follow-up. Used by Tech-view T11 (Send Review Link).');
    const google=field('google_url','Google review URL',data.google,{id:'rl-google',type:'url',placeholder:'https://g.page/r/...',help:'Open Google → your business → 3-dot menu → Get more reviews → Share review form.'});
    const yelp=field('yelp_url','Yelp review URL',data.yelp,{id:'rl-yelp',type:'url',placeholder:'https://www.yelp.com/biz/your-slug',help:'Use the public business listing page, not the dashboard URL.'});
    const radios=(name,values,current)=>el('div',{class:'setting-radios'},values.map(([value,label])=>el('label',{},el('input',{type:'radio',name,value,checked:value===current}),el('span',{text:label}))));
    const strategy=radios('rotation_strategy',[
      ['google_only','Google only — always Google.'],['yelp_only','Yelp only — always Yelp.'],['alternate','Alternate — alternates per send (requires both URLs).'],['weighted_least_recent','Weighted least-recent — picks the platform with the fewest recent sends (requires both URLs).']],data.strategy);
    const template="Hi {first_name}, thanks for letting {tenant_name} take care of your home. If you've got 30 seconds, would you leave us a quick review? {review_url}";
    // The saved preview does not change as draft URLs or strategy radios change.
    const preview=template.replace('{first_name}','Pat').replace('{tenant_name}',data.tenant).replace('{review_url}',data.google);
    root.append(form(panel([el('span',{text:'Review URLs'}),' ',el('span',{class:'setting-badge',text:'設定済み'})],'Paste the full landing URL from each platform.',google.box,yelp.box),
      panel('Rotation strategy','How the system picks Google vs Yelp on each send.',strategy),
      panel('Default channel','SMS or email when a tech triggers Send Review Link.',radios('channel',[['sms','SMS'],['email','メールアドレス']],data.channel)),
      panel('Preview','How the message will read with your tenant name and sample customer.',el('pre',{class:'review-template',text:template}),el('p',{class:'review-preview',text:preview})),
      panel('Stats — last 30 days','Counts how many review-link sends came out of this tenant.',el('div',{class:'review-stats'},
        [[data.stats.total,'TOTAL SENT'],[data.stats.per_platform.google,'GOOGLE'],[data.stats.per_platform.yelp,'YELP'],[data.stats.per_channel.sms,'SMS'],[data.stats.per_channel.email,'メールアドレス']].map(([value,label])=>el('div',{},el('strong',{text:value}),el('span',{text:label}))))),save()));
  }else if(path==='/settings/clearpath/') {
    const data=snapshot.gps;
    title=heading('ClearPathGPS Integration','Operator-controlled GPS share that powers the technician "On My Way" banner (Tech-view T4). ClearPathGPS uses HTTP Basic auth to mint a JWT, which we cache and re-use as a Bearer token. Password is encrypted at rest. Only company admins can view or edit.');
    root.append(panel(['対応状況 ',el('span',{class:'setting-badge warning',text:'未設定'})],'On My Way (T4) is disabled until login email and password are set.',
      el('div',{class:'gps-status'},el('span',{text:'JWT session'}),el('strong',{class:'setting-badge neutral',text:'Will refresh on next call'}),el('span',{text:'最終ログイン'}),el('span',{text:'—'}))));
    const testResult=el('p',{class:'gps-test-result',role:'status',hidden:true,'data-status':'403'});
    const inputs=[
      field('login_email','Login email',data.login_email,{type:'email',placeholder:'ops@example.com',help:'The email you log in to ClearPathGPS with.'}),
      field('password','パスワード','',{type:'password',placeholder:'Not set',autocomplete:'new-password',help:'Leave blank to keep the current password. Never displayed back after saving.'}),
      field('share_url_template','ClearShare URL template',data.share_url_template,{placeholder:data.share_url_template,help:'Tokens: {vehicle_id}, {share_token}, {appt_id}.'}),
      field('sandbox_url_template','Sandbox URL template',data.sandbox_url_template,{placeholder:data.sandbox_url_template,help:'Used when ClearPathGPS is disabled or no vehicle mapping exists. Visible during dev / QA.'}),
      field('api_base_url','API base URL',data.api_base_url,{placeholder:data.api_base_url,help:'Override only for sandbox or mock testing.'})];
    root.append(panel('認証情報','Per-tenant ClearPathGPS account. ClearPathGPS authenticates with POST /login + HTTP Basic, then issues a JWT. We cache the JWT and re-use it on subsequent calls. The password is encrypted (Fernet) on the server and is never displayed back.',
      form(el('label',{class:'gps-enable'},el('input',{type:'checkbox',name:'enabled',checked:data.enabled}),el('span',{text:'Enable ClearPathGPS for this tenant'})),
        el('div',{class:'gps-fields'},inputs.map(x=>x.box)),el('div',{class:'setting-actions'},button('接続をテスト',()=>{testResult.textContent='Test request failed (HTTP 403)';testResult.hidden=false},{id:'cp-test'}),save('Save credentials')),testResult)));
    root.append(panel('Vehicle mappings','One row per technician, mapping a User to a ClearPathGPS vehicle ID. Required for the On My Way share URL to resolve to a real vehicle.',link('Manage 0 mappings →','/settings/clearpath/vehicles/')));
  }else if(path==='/settings/clearpath/vehicles/') {
    title=heading('ClearPathGPS Vehicle Map','One row per technician. Maps a User to a ClearPathGPS vehicle ID so the On My Way share URL resolves to the right vehicle.');
    root.querySelector('.setting-description').append(' ',link('← API config','/settings/clearpath/'));
    root.append(el('p',{class:'delivery-warning'},"⚠ ClearPathGPS API isn't configured yet — vehicle mappings won't generate share URLs until you set the API key. ",link('Configure ClearPathGPS →','/settings/clearpath/')));
    const open=()=>{
      const tech=select('担当スタッフ',[{value:'',label:'Failed to load techs.'}],'',()=>{},{id:'cp-add-tech',name:'technician_id',required:''});
      const vehicle=field('vehicle_id','Vehicle ID','',{required:'',placeholder:'V-101'});
      const inputForm=form(el('div',{class:'setting-field'},el('label',{for:'cp-add-tech',text:'担当スタッフ'}),tech),vehicle.box,el('label',{class:'setting-token-label',text:'ClearShare token (optional)'}));
      const modal=dialog('Add ClearPathGPS Vehicle Mapping',inputForm);modals.add(modal);modal.addEventListener('close',()=>modals.delete(modal),{once:true});
      modal.classList.add('mapping-dialog');modal.querySelector('footer').replaceChildren(button('キャンセル',()=>modal.close()),button('Save mapping',()=>inputForm.reportValidity(),{class:'primary'}));
    };
    root.append(panel('Mappings (0)','',button('+ Add mapping',open,{class:'primary',id:'cp-add-btn'}),description('Click a vehicle ID to edit it inline.'),el('p',{class:'mapping-empty',text:'No vehicle mappings yet. Click + Add mapping to assign a tech.'})));
  }else throw Error('Unknown settings view');
  return {node:root,title,compactHeader:true,mount(){for(const input of calendars){input._calendar=globalThis.flatpickr(input,{locale:'ja',dateFormat:'Y-m-d',altInput:true,altFormat:'Y年m月d日',allowInput:true,disableMobile:true});}},dispose(){for(const input of calendars)input._calendar?.destroy();for(const modal of modals)modal.close();}};
}
