import {el,button,icon} from './elements.js';
import {routeHash} from '../core/router.js';
import {roleNavigation,sidebarClose} from './sidebar-controls.js';
export function workspaceFrame(view,place,accountName,catalog){
 const nav=el('nav',{'aria-label':'管理メニュー',class:'workspace-menu'},view.groups.map(group=>el('details',{...(group.open?{open:''}:{})},el('summary',{text:group.name}),group.links.map(link=>el('a',{href:routeHash(place.role,link.route),text:link.label,class:link.route===place.path?'active':'',...(link.route===place.path?{'aria-current':'page'}:{})})))));
 nav.prepend(roleNavigation(catalog,place,true));
 const sidebar=el('aside',{class:'workspace-sidebar sidebar'},el('div',{class:'workspace-brand'},el('img',{src:'./brand.svg',alt:'SUKIMAKUN'}),sidebarClose(()=>{sidebar.classList.remove('open');menuButton.setAttribute('aria-expanded','false')})),nav,el('footer',{},el('span',{text:accountName}),button(icon('sign-out-alt'),()=>alert('確認用デモのため、実際のログアウトは行いません。'),{'aria-label':'ログアウト',class:'workspace-logout'})));
 const menuButton=button([icon('bars'),' メニュー'],()=>{const open=sidebar.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))},{class:'workspace-menu-button','aria-label':'メニュー','aria-expanded':'false'});
 const header=el('header',{class:'workspace-header'},menuButton);
 const main=el('main',{class:'workspace-main','data-route':place.role+'|'+place.path,'data-query':place.query.toString()},view.node);
 return{nodes:[sidebar,header,main],dispose(){view.dispose()}};
}
