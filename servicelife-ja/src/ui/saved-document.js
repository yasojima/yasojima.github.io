import {readSnapshot} from '../core/data-reader.js';
import {documentLink} from '../core/local-files.js';
import {el,button} from './elements.js';
export async function savedDocument(key,filename){
 const data=await readSnapshot(key),bytes=Uint8Array.from(atob(data.pdf),s=>s.charCodeAt(0)),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==data.sha256)throw new Error('書類データの照合に失敗しました。');
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const open=documentLink(el('a',{target:'_blank',rel:'noopener noreferrer',text:'別タブで開く'}),url),download=documentLink(el('a',{download:filename,text:'ダウンロード'}),url);
 const own=el('dialog',{class:'saved-document','aria-label':filename},el('header',{},el('strong',{text:filename}),open,download,button('閉じる',()=>own.close())),el('div',{class:'saved-document-pages'},data.pages.map((p,i)=>el('img',{src:'data:image/png;base64,'+p.png,width:p.width,height:p.height,alt:filename+' '+(i+1)+'ページ'}))));
 own.addEventListener('close',()=>{URL.revokeObjectURL(url);own.remove()},{once:true});document.body.append(own);own.showModal();return own;
}
