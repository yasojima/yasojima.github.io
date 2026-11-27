import {el,button}from './elements.js';
import {documentLink}from '../core/local-files.js';
import {reportPdf}from '../domain/report-pdf.js';
import {reportFile}from '../domain/report-files.js';
export async function reportDocument(kind,format,rows){
 const pdf=format==='pdf'?await reportPdf(kind,rows):null,blob=pdf?.blob||await reportFile(kind,format,rows),url=URL.createObjectURL(blob),filename=kind==='revenue'&&format==='pdf'?'売上レポート.pdf':'reports-'+kind+'.'+format;
 const open=documentLink(el('a',{target:'_blank',rel:'noopener',text:'別タブで開く'}),url),download=documentLink(el('a',{download:filename,text:'ダウンロード'}),url);
 const modal=el('dialog',{class:'report-document','aria-label':'書類の控え'},el('header',{},el('strong',{text:filename}),open,download,button('閉じる',()=>modal.close())));
 // Render the generated PDF's own text locally. No embedded original document,
 // remote viewer, or document code is needed to display this export.
 if(format==='pdf'){
  const pages=el('div',{class:'report-document-pages'});
  for(const page of pdf.pages){const canvas=el('canvas',{width:Math.ceil(page.width*2),height:Math.ceil(page.height*2),'aria-label':'PDFプレビュー'}),ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='white';ctx.fillRect(0,0,page.width,page.height);
   for(const op of page.ops){if(op.color)ctx.fillStyle='rgb('+op.color.map(c=>Math.round(c*255)).join(',')+')';if(op.type==='text'){ctx.font=(op.bold?'bold ':'')+op.size+'px Arial';ctx.fillText(op.text,op.x,page.height-op.y)}else if(op.type==='rect')ctx.fillRect(op.x,page.height-op.y-op.height,op.width,op.height);else{ctx.strokeStyle='#aaa';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(op.x,page.height-op.y);ctx.lineTo(op.toX,page.height-op.toY);ctx.stroke()}}
   pages.append(canvas);
  }
  modal.append(pages);
 }
 modal.addEventListener('close',()=>{URL.revokeObjectURL(url);modal.remove()},{once:true});document.body.append(modal);modal.showModal();download.click();return modal;
}
