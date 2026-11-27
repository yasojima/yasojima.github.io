const titles={revenue:'Revenue Report',customers:'Customer Growth Report',technicians:'Technician Productivity Report',leads:'Lead Conversion Report',commercial:'Commercial Accounts Report'};
export async function reportPdf(kind,rows){
 const {PDFDocument,StandardFonts,rgb}=await import('../../lib/pdf-lib-1.17.1.min.js'),doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const width=841.8898,height=595.2756,title=titles[kind];if(!title)throw new Error('Unknown PDF report');
 const clean=rows.map(row=>row.map(v=>String(v??'').replace(/[^\x20-\x7e]/g,'?'))),columns=clean[0].map((_,col)=>Math.max(...clean.map((row,i)=>(i===0?bold:regular).widthOfTextAtSize(row[col]||'',i===0?10:9)))+12);
 const total=columns.reduce((a,b)=>a+b,0),scale=Math.min(1,(width-72)/total),pages=[];const count=Math.max(1,Math.ceil((clean.length-1)/25));
 for(let pageIndex=0;pageIndex<count;pageIndex++){
  const selected=[clean[0],...clean.slice(1+pageIndex*25,1+(pageIndex+1)*25)],ops=[],top=height-76,left=(width-total*scale)/2;
  ops.push({type:'text',text:title,x:(width-bold.widthOfTextAtSize(title,18))/2,y:height-54,size:18,bold:true,color:[0,0,0]});
  for(let ri=0;ri<selected.length;ri++){
   const y=top-ri*18;ops.push({type:'rect',x:left,y:y-18,width:total*scale,height:18,color:ri===0?[31/255,78/255,121/255]:ri%2===0?[239/255,243/255,248/255]:[1,1,1]});let x=left;
   for(let col=0;col<columns.length;col++){ops.push({type:'text',text:selected[ri][col]||'',x:x+6*scale,y:y-(ri===0?13:12),size:(ri===0?10:9)*scale,bold:ri===0,color:ri===0?[1,1,1]:[0,0,0]});x+=columns[col]*scale;}
  }
  const bottom=top-selected.length*18;for(let ri=0;ri<=selected.length;ri++)ops.push({type:'line',x:left,y:top-ri*18,toX:left+total*scale,toY:top-ri*18});let x=left;ops.push({type:'line',x,y:top,toX:x,toY:bottom});for(const col of columns){x+=col*scale;ops.push({type:'line',x,y:top,toX:x,toY:bottom})}
  const page=doc.addPage([width,height]);for(const op of ops){if(op.type==='text')page.drawText(op.text,{x:op.x,y:op.y,size:op.size,font:op.bold?bold:regular,color:rgb(...op.color)});else if(op.type==='rect')page.drawRectangle({x:op.x,y:op.y,width:op.width,height:op.height,color:rgb(...op.color)});else page.drawLine({start:{x:op.x,y:op.y},end:{x:op.toX,y:op.toY},thickness:.4,color:rgb(2/3,2/3,2/3)})}
  pages.push({width,height,ops});
 }
 return {blob:new Blob([await doc.save()],{type:'application/pdf'}),pages};
}
