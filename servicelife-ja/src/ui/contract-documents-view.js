import {el,button} from './elements.js';
import {routeHash} from '../core/router.js';
import {savedDocument} from './saved-document.js';

const japanTime=value=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit'}):'記録なし';
export function contractDocumentsView(data){
 const search=el('input',{id:'document-search',type:'search'}),pdfOnly=el('input',{id:'document-pdf-only',type:'checkbox'}),count=el('p',{class:'documents-count'}),list=el('div',{class:'documents-list'}),detail=el('section',{class:'documents-detail'}),dialogs=new Set();
 let selected=data.records.find(r=>r.document)?.id||data.records[0]?.id,disposed=false;
 const node=el('section',{class:'contract-documents','data-contract-documents':''},
  el('header',{class:'documents-intro'},el('a',{href:routeHash('csr','/contracts/'),text:'← 契約管理へ'}),el('h1',{text:'契約PDF・署名情報'}),el('p',{text:'SUKIMAKUNの顧客対応ロールで収録した契約 · '+japanTime(data.capturedAt)+'（日本時間）'})),
  el('div',{class:'documents-grid'},el('section',{class:'documents-catalog'},el('div',{class:'documents-controls'},el('label',{for:'document-search',text:'契約番号・契約名'}),search,el('label',{class:'documents-checkbox'},pdfOnly,'PDFを閲覧できる契約のみ'),count),list),detail));
 function render(){
  const query=search.value.trim().toLowerCase(),rows=data.records.filter(r=>(!pdfOnly.checked||r.document)&&[r.number,r.title,r.titleLabel,r.customer].some(s=>s.toLowerCase().includes(query)));
  if(!rows.some(r=>r.id===selected))selected=rows[0]?.id;
  count.textContent=rows.length+'件 · PDFあり '+rows.filter(r=>r.document).length+'件';
  list.replaceChildren(...rows.map(r=>button([el('strong',{text:r.number}),el('b',{text:r.titleLabel}),el('small',{text:r.statusLabel+(r.document?' · PDFあり':'')})],()=>{selected=r.id;render()},{class:r.id===selected?'selected':'','data-document-record':r.id,'aria-pressed':String(r.id===selected)})));
  const r=rows.find(r=>r.id===selected);if(!r){detail.replaceChildren(el('p',{class:'documents-none',text:'該当する契約がありません。'}));return}
  const entries=[['契約状態',r.statusLabel],['署名日時（日本時間）',japanTime(r.signedAt)],...(r.signer?[['署名者',r.signer]]:[]),...(r.signatureStatusLabel&&r.signatureStatusLabel!==r.statusLabel?[['署名状態',r.signatureStatusLabel]]:[]),['署名画像','元デモで表示なし'],...(r.certificateKnown?[['署名証明書','元デモで表示なし']]:[])];
  detail.replaceChildren(el('header',{class:'documents-detail-header'},el('div',{},el('strong',{text:r.number}),el('h2',{text:r.titleLabel}),el('p',{text:r.customer})),button('契約PDFを開く',async()=>{try{const d=await savedDocument(r.document,r.number+'.pdf');if(disposed)d.close();else{dialogs.add(d);d.addEventListener('close',()=>dialogs.delete(d),{once:true})}}catch(e){if(!disposed)alert(e.message)}},{class:'documents-open',disabled:!r.document})),
   ...(!r.document?[el('p',{class:'documents-unavailable',text:'この契約には元デモの閲覧画面にPDFを開く操作がありません。'})]:[]),
   el('div',{class:'documents-signature'},el('h3',{text:'署名情報'}),el('dl',{},entries.map(([label,value])=>el('div',{},el('dt',{text:label}),el('dd',{text:value}))))));
 }
 search.addEventListener('input',render);pdfOnly.addEventListener('change',render);render();
 return{workspace:true,groups:data.groups,title:'契約PDF・署名情報',node,mount(){},dispose(){disposed=true;for(const d of dialogs)d.close()}};
}
