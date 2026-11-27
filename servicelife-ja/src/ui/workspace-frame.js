import {el,button,icon} from './elements.js';
import {routeHash,roleLanding} from '../core/router.js';
export function workspaceFrame(view,place,accountName,catalog){
 const nav=el('nav',{'aria-label':'管理メニュー',class:'workspace-menu'},view.groups.map(group=>el('details',{...(group.open?{open:''}:{})},el('summary',{text:group.name}),group.links.map(link=>el('a',{href:routeHash(place.role,link.route),text:link.label,class:link.route===place.path?'active':'',...(link.route===place.path?{'aria-current':'page'}:{})})))));
 const sidebar=el('aside',{class:'workspace-sidebar sidebar'},el('div',{class:'workspace-brand'},el('img',{src:'./brand.svg',alt:'SUKIMAKUN'})),nav,el('footer',{},el('span',{text:accountName}),button(icon('sign-out-alt'),()=>alert('確認用デモのため、実際のログアウトは行いません。'),{'aria-label':'ログアウト',class:'workspace-logout'})));
 const menuButton=button([icon('bars'),' メニュー'],()=>{const open=sidebar.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))},{class:'workspace-menu-button','aria-label':'メニュー','aria-expanded':'false'});
 const roles=el('select',{'aria-label':'表示する役割',onchange:()=>{location.hash=routeHash(roles.value,roleLanding(catalog,roles.value,place.path))}},[['company_admin','会社管理者'],['csr','顧客対応'],['technician','担当スタッフ']].map(([value,text])=>el('option',{value,text})));roles.value=place.role;
 const header=el('header',{class:'workspace-header'},menuButton,el('span',{text:'確認用デモ'}),el('label',{},el('span',{class:'workspace-role-label',text:'表示する役割'}),roles));
 const main=el('main',{class:'workspace-main','data-route':place.role+'|'+place.path,'data-query':place.query.toString()},view.node);
 return{nodes:[sidebar,header,main],dispose(){view.dispose()}};
}
