import {el,button,icon} from './elements.js';
const blocked='This action is disabled in the read-only demo.';
export function teamView(data){
 const node=el('section',{class:'team-content','data-team':''});let modal=null;
 const initials=name=>name.split(' ').map(x=>x[0]).join('');
 function status(person){
  const restore=person.employment_status!=='active',state={target:'inactive',reason:restore?'returning_from_leave':'parental_leave',text:'',effective:'',restore:'clean_slate',ids:''};let step=0;
  const close=()=>modal.close(),body=el('div',{class:'team-status-body'}),footer=el('footer',{});
  const title='Status: '+person.name+' ('+person.employment_status.replaceAll('_',' ')+')';
  modal=el('dialog',{class:'team-status','aria-label':title},el('header',{},el('h2',{text:title}),button('✕',close,{'aria-label':'閉じる'})),body,footer);const own=modal;own.addEventListener('close',()=>{own.remove();if(modal===own)modal=null});node.append(own);own.showModal();
  const row=(label,input)=>el('label',{class:'team-field'},el('b',{text:label}),input);
  function draw(){body.replaceChildren();footer.replaceChildren();
   if(step===0){
    body.append(el('p',{},restore?'Bring '+person.name+' back to 稼働中.':'Choose new state, reason, and when it takes effect.'));
    if(!restore)body.append(el('b',{text:'Target status'}),...[['on_leave','On Leave (paused, keeps access)'],['inactive','Inactive (off, retains access for reports)'],['terminated','Terminated (fired, revokes SIP + sessions)']].map(([value,label])=>el('label',{class:'team-radio'},el('input',{type:'radio',name:'lc_target',value,checked:state.target===value,onchange:()=>state.target=value}),' '+label)));
    const reasons=el('select',{id:'lc_reason',onchange:e=>state.reason=e.target.value},data.reasons.map(o=>el('option',{...o})));reasons.value=state.reason;
    body.append(row('理由',reasons),row('メモ（任意）',el('textarea',{id:'lc_text',value:state.text,oninput:e=>state.text=e.target.value})));
    if(!restore)body.append(row('Effective at (blank = now)',el('input',{id:'lc_eff',type:'datetime-local',value:state.effective,oninput:e=>state.effective=e.target.value})));
    else{body.append(el('b',{text:'What to restore?'}),...[['restore_all','Restore everything (re-assign released appointments)'],['cherry_pick','Cherry-pick (review past changes — manual ID list)'],['clean_slate','Clean slate (restore access only)']].map(([value,label])=>el('label',{class:'team-radio'},el('input',{type:'radio',name:'lc_mode',value,checked:state.restore===value,onchange:()=>{state.restore=value;draw()}}),' '+label)))}
    footer.append(button('キャンセル',close));
   }else if(step===1){body.append(el('div',{},['Future appointments: undefined','Open time entries: undefined','Open invoices: undefined','Equipment assigned: undefined','Active licenses: undefined','Active sessions: undefined','SIP active: いいえ','Push tokens: undefined'].map(text=>el('div',{text}))));footer.append(button('← Back',()=>{step--;if(step===0)Object.assign(state,{target:'inactive',reason:'parental_leave',text:'',effective:''});draw()}))}
   else if(restore){body.append(el('p',{text:'Confirm reactivation: '+person.name+' → 稼働中'}),el('p',{text:'Restore mode: '+state.restore}),el('p',{text:'Reason: '+state.reason}));footer.append(button('← Back',()=>{step=0;Object.assign(state,{reason:'returning_from_leave',text:'',restore:'clean_slate'});draw()}))}
   else{body.append(el('p',{text:'確定 '+person.name+' → '+(restore?'稼働中':({on_leave:'休暇中',inactive:'停止中',terminated:'Terminated'})[state.target])}),el('p',{text:'Reason: '+state.reason}),el('p',{text:'Appointment disposition: release_to_pool'}));footer.append(button('← Back',()=>{step--;if(step===0)Object.assign(state,{target:'inactive',reason:'parental_leave',text:'',effective:''});draw()}))}
   footer.append(button(step===2?'適用':'次へ →',()=>{if(step===2){alert('Failed: '+JSON.stringify({detail:blocked,error:blocked}));return}step=restore?2:step+1;draw()},{class:'team-apply'}));
  }draw();
 }
 node.append(el('div',{class:'team-grid'},data.team.map(person=>el('article',{class:'team-card'},el('div',{class:'team-identity'},el('span',{class:'team-avatar',style:'background:'+person.color,text:initials(person.name)}),el('div',{},el('div',{class:'team-name'},el('strong',{text:person.name}),el('span',{class:'team-badge '+(person.employment_status==='on_leave'?'leave':''),text:person.employment_status==='on_leave'?'休暇中':'稼働中'})),el('small',{text:person.role==='senior_tech'?'主任の現場スタッフ':'担当スタッフ'}))),el('div',{class:'team-stats'},el('span',{},el('b',{text:'0'}),' 作業の種類'),el('span',{},el('b',{text:'0'}),' 資格取得済み'),el('span',{},'平均評価点 ',el('b',{text:'0'}))),el('div',{class:'team-actions'},[['予定','calendar','/calendar/'],['利用できる機能','star-half-alt','/users/'],['機材','toolbox','/equipment/'],['対応状況','user-cog',null]].map(([label,glyph,path])=>button([icon(glyph),' '+label],()=>path?location.hash='#'+path:status(person))))))));
 return{title:'所属チーム',titleIcon:'users',headerClass:'team-header',node,mount(){},dispose(){modal?.remove()}};
}
