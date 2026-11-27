import { el, button } from './elements.js';
import { routeHash } from '../core/router.js';
import { richTextEditor } from './rich-text.js';

export function treatmentView(snapshot,path,role) {
  const root=el('section',{class:'settings-content treatment-content','data-treatment-route':path});
  const index='/settings/job-types/';let title='Treatment Processes',editor=null;
  const link=(text,to)=>el('a',{href:routeHash(role,to),text});
  const heading=(text,description)=>root.append(el('h2',{text}),el('p',{class:'setting-description',text:description}));
  if(path===index){
    heading(title,'Per-JobType reference shown to the technician on the field job card (Tech-view T10). Rich-text content; saved per-tenant.');
    const rows=snapshot.treatmentProcesses.map(record=>el('tr',{class:record.active?'':'treatment-inactive'},
      el('td',{},el('span',{class:'treatment-dot',style:'background:'+record.color}),el('strong',{text:record.label})),
      el('td',{text:record.active?'✅':'—'}),el('td',{class:'treatment-unset',text:'✖ Not set'}),el('td',{text:'—'}),
      el('td',{},link('Edit ▶',index+record.id+'/treatment-process/'))));
    root.append(el('section',{class:'setting-panel'},el('h3',{text:'作業の種類'}),el('p',{class:'setting-description',text:'0 of '+rows.length+' job types have a treatment process configured. Inactive job types are dimmed.'}),
      el('div',{class:'table-scroll'},el('table',{class:'treatment-table'},el('thead',{},el('tr',{},['作業の種類','稼働中','TREATMENT PROCESS','最終更新',''].map(text=>el('th',{text})))),el('tbody',{},rows)))));
  }else{
    const record=snapshot.treatmentProcesses.find(x=>path===index+x.id+'/treatment-process/');
    if(!record)throw Error('作業手順が見つかりません。');
    title=record.label+' ・ Treatment Process';
    root.append(el('div',{class:'treatment-back'},link('← Back to Job Types',index)));
    heading(title,'Operator-facing rich-text editor. The content is shown to the technician on the field job card when they tap the treatment-process card (T10).');
    const input=el('div',{id:'tp-editor'}),preview=el('div',{id:'tp-preview',class:'treatment-preview'});
    const status=el('p',{id:'tp-status',class:'treatment-status',role:'status',hidden:true});
    const save=button('保存',()=>{status.textContent='Save failed: {"detail":"This action is disabled in the read-only demo.","error":"This action is disabled in the read-only demo."}';status.hidden=false;},{class:'primary',id:'tp-save'});
    root.append(el('section',{class:'setting-panel treatment-columns'},
      el('div',{},el('h3',{text:'Editor'}),input,el('div',{class:'treatment-save'},save),status),
      el('div',{},el('h3',{text:'Preview'}),preview)));
    editor={mount:()=>richTextEditor(input,preview)};
  }
  let instance;
  return{node:root,title,compactHeader:true,mount(){instance=editor?.mount();},dispose(){instance?.dispose();}};
}
