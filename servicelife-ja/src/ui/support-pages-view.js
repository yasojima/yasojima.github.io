import {el,icon,button} from './elements.js';
import {routeHash} from '../core/router.js';
export const supportRoutes=['/ai-assistant/','/knowledge/','/job-forms/','/commissions/dashboard/'];
export function supportPagesView(data,path,role){
 let title,titleIcon,node,headerExtra,overlay;
 if(path==='/ai-assistant/'){
  title='AIアシスタント';titleIcon='robot';
  node=el('section',{class:'support-content'},el('article',{class:'support-ai'},icon('power-off'),el('h2',{text:data.ai.heading}),el('p',{},'この会社ではAIアシスタントが無効です。オーナーまたは会社管理者が次の設定で有効にできます。 ',el('a',{href:routeHash(role,'/settings/'),text:'設定'}),'.')));
 }else if(path==='/knowledge/'){
  title='業務ナレッジ';titleIcon='book-open';
  node=el('section',{class:'support-content'},el('input',{id:'search',placeholder:'記事を検索',class:'support-search','aria-label':'記事を検索'}),el('div',{class:'support-no-articles'},icon('book-open'),el('p',{text:'該当する記事はありません'})));
 }else if(path==='/job-forms/'){
  title='作業用フォーム・チェックリスト';titleIcon='clipboard-check';
  const link=el('a',{href:'#',text:'管理メニュー → フォームのひな形',onclick:event=>{
   event.preventDefault();overlay=el('div',{class:'support-unavailable',role:'dialog','aria-label':'未収録の画面'},el('div',{},el('div',{text:'この原本ページはまだ取得されていません：/admin/forms/formtemplate/'}),button('元の画面へ戻る',()=>{overlay.remove();overlay=null;link.focus()})));document.body.append(overlay);overlay.querySelector('button').focus();
  }});
  node=el('section',{class:'support-content'},el('div',{class:'support-form-empty'},icon('clipboard-check'),el('p',{},'まだフォームのひな形がありません。作成先： ',link,'.')));
 }else{
  title='歩合給';titleIcon='hand-holding-usd';
  headerExtra=el('a',{class:'support-commission-settings',href:routeHash(role,'/settings/commissions/')},icon('cog'),' Plan settings');
  node=el('section',{class:'support-commissions'},el('div',{class:'support-commission-tiles'},data.commission.tiles.map(t=>el('article',{},el('strong',{text:t.value}),el('span',{text:t.label})))),data.commission.cards.map(c=>el('article',{class:'support-commission-card'},el('h2',{text:c.heading}),el('p',{text:c.empty}))));
 }
 node.dataset.supportPage=path;
 return {title,titleIcon,headerExtra,headerClass:'support-header',node,mount(){},dispose(){overlay?.remove()}};
}
