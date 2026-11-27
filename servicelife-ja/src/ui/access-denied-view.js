import {el,icon} from './elements.js';
import {routeHash} from '../core/router.js';
export function accessDeniedView(path,role,allowed){
 const link=(label,target,primary,symbol)=>el('a',{class:primary?'primary':'',href:routeHash(role,target)},icon(symbol),' '+label);
 const node=el('section',{class:'billing-content billing-denied','data-access-denied':path,'data-role':role},el('article',{class:'billing-panel'},icon('lock'),el('h2',{text:"You don't have access to this page"}),
  el('p',{},"Your current role isn't permitted to view ",el('code',{text:path}),'.'),el('p',{text:'If you think this is a mistake, ask your administrator to update your role.'}),
  el('div',{class:'access-roles'},el('div',{},el('strong',{text:'Your role'}),el('span',{text:role==='csr'?'顧客対応担当':'担当スタッフ'})),el('div',{},el('strong',{text:'Allowed roles'}),allowed.map(text=>el('span',{text})))),
  el('div',{class:'access-actions'},link('Go to your dashboard',role==='technician'?'/my-day/':'/dashboard/',true,'home'),el('a',{href:'#',onclick:event=>event.preventDefault()},icon('arrow-left'),' Go back'))));
 return{title:'Access Denied',titleIcon:'lock',headerClass:'billing-header denied-header',node,mount(){},dispose(){}};
}
