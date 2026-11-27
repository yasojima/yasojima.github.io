import {el,button} from './elements.js';
import {documentLink} from '../core/local-files.js';
import {reportFile} from '../domain/report-files.js';

// All bytes are generated in this browser. No remote viewer or form submission.
export async function localReportDocument({title,filename,columns,rows,summary=[],format='pdf'}) {
 const sheet=[['SUKIMAKUN 操作確認用の見本'],[title],...summary.map(x=>[x]),[],columns,...rows];
 const modal=el('dialog',{class:'report-document','aria-label':'帳票の確認'}),pages=el('div',{class:'report-document-pages'});
 let blob;
 if(format==='pdf'){
  await document.fonts.ready;
  const {PDFDocument}=await import('../../lib/pdf-lib-1.17.1.min.js'),pdf=await PDFDocument.create();pdf.setTitle(title);pdf.setAuthor('SUKIMAKUN');
  const width=1120,height=790,margin=40,colWidth=(width-margin*2)/columns.length;
  const wrap=(ctx,text,max)=>{const result=[];let line='';for(const ch of String(text??'')){if(ctx.measureText(line+ch).width>max&&line){result.push(line);line=''}line+=ch}result.push(line);return result;};
  const chunks=[];let chunk=[],used=0;
  // Row height is measured with the same font used for the final PDF image.
  const measure=document.createElement('canvas').getContext('2d');measure.font='14px sans-serif';
  for(const row of rows){const lines=row.map(v=>wrap(measure,v,colWidth-16)),h=Math.max(36,...lines.map(x=>x.length*19+16));if(used+h>450&&chunk.length){chunks.push(chunk);chunk=[];used=0}chunk.push({lines,h});used+=h;}if(chunk.length||!chunks.length)chunks.push(chunk);
  for(const [pageIndex,items] of chunks.entries()){
   const canvas=el('canvas',{width:width*2,height:height*2,'aria-label':'PDFプレビュー'}),ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#23362b';ctx.font='bold 22px sans-serif';ctx.fillText(title,margin,52);ctx.font='14px sans-serif';
   ['SUKIMAKUN 操作確認用の見本（提出用ではありません）',...summary].forEach((text,i)=>ctx.fillText(text,margin,84+i*23));
   let y=180;ctx.fillStyle='#1b5e20';ctx.fillRect(margin,y,width-margin*2,38);ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';columns.forEach((v,i)=>ctx.fillText(v,margin+i*colWidth+8,y+24));y+=38;
   ctx.font='14px sans-serif';
   for(const [ri,item] of items.entries()){ctx.fillStyle=ri%2?'#fff':'#f7f9f8';ctx.fillRect(margin,y,width-margin*2,item.h);ctx.fillStyle='#23362b';item.lines.forEach((lines,i)=>lines.forEach((s,j)=>ctx.fillText(s,margin+i*colWidth+8,y+22+j*19)));y+=item.h;ctx.strokeStyle='#d9e2dd';ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke()}
   if(!items.length){ctx.fillStyle='#53615a';ctx.fillText('指定した条件に一致する記録はありません。',margin+8,y+28)}
   ctx.fillStyle='#53615a';ctx.fillText(`${pageIndex+1} / ${chunks.length}　対象 ${rows.length}件`,margin,height-30);
   const png=await pdf.embedPng(canvas.toDataURL('image/png'));pdf.addPage([width,height]).drawImage(png,{x:0,y:0,width,height});pages.append(canvas);
  }
  blob=new Blob([await pdf.save()],{type:'application/pdf'});
 }else{
  blob=await reportFile('local',format,sheet);
  pages.append(el('p',{text:'SUKIMAKUN 操作確認用の見本'}),...summary.map(text=>el('p',{text})),el('table',{},el('thead',{},el('tr',{},columns.map(text=>el('th',{text})))),el('tbody',{},rows.length?rows.map(row=>el('tr',{},row.map(text=>el('td',{text})))):el('tr',{},el('td',{colspan:columns.length,text:'指定した条件に一致する記録はありません。'})))));
 }
 const url=URL.createObjectURL(blob),download=documentLink(el('a',{download:filename+'.'+format,text:'ダウンロード'}),url),open=documentLink(el('a',{target:'_blank',rel:'noopener',text:'別タブで開く'}),url);
 modal.append(el('header',{},el('strong',{text:title}),open,download,button('閉じる',()=>modal.close())),pages);
 modal.addEventListener('close',()=>{URL.revokeObjectURL(url);modal.remove()},{once:true});document.body.append(modal);modal.showModal();return modal;
}
