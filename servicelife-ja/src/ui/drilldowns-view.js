import {el,icon} from './elements.js';
import {routeHash} from '../core/router.js';
export function drilldownView(data,path,role){
 const model=data.pages[path];if(!model)throw new Error('Unknown drilldown');
 const link=(label,target,cls,glyph)=>el('a',{href:routeHash(role,target),class:cls},glyph?icon(glyph):null,glyph?' ':null,label);
 const node=el('section',{class:'drilldown-content','data-drilldown':path},
  el('header',{class:'drilldown-heading'},el('div',{},el('h2',{text:model.title}),el('p',{text:model.subtitle}),el('small',{text:model.count})),
   el('div',{class:'drilldown-actions'},link('CSVをダウンロード',path+'?format=csv','drilldown-csv','file-csv'),link('Back to Dashboard','/dashboard/','drilldown-back'))),
  model.rows.length?el('div',{class:'drilldown-scroll'},el('table',{},el('thead',{},el('tr',{},model.columns.map(text=>el('th',{text})))),el('tbody',{},model.rows.map(row=>el('tr',{},row.map(c=>el('td',{},c.maskedEmail?el('a',{href:'#',text:c.text}):c.text))))))):el('div',{class:'drilldown-empty'},icon('inbox'),el('span',{text:model.empty})));
 if(model.footnote)node.querySelector('.drilldown-scroll').append(el('div',{class:'drilldown-footnote',text:model.footnote}));
 return{title:model.title,titleIcon:'list',headerExtra:link('ダッシュボード','/dashboard/','drilldown-top-back','arrow-left'),headerClass:'drilldown-header',node,mount(){},dispose(){}};
}
