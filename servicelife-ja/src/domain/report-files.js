import {reportPdf}from './report-pdf.js';
const encode=s=>new TextEncoder().encode(s);
const xml=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function zipStored(files){
 const chunks=[],central=[];let offset=0;
 const bytes=(length,entries)=>{const buffer=new Uint8Array(length),view=new DataView(buffer.buffer);for(const [at,value,word]of entries)word?view.setUint16(at,value,true):view.setUint32(at,value,true);return buffer;};
 for(const [filename,content]of Object.entries(files)){
  const name=encode(filename),data=encode(content);let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}crc=(crc^0xffffffff)>>>0;
  chunks.push(bytes(30,[[0,0x04034b50],[4,20,1],[14,crc],[18,data.length],[22,data.length],[26,name.length,1]]),name,data);
  central.push(bytes(46,[[0,0x02014b50],[4,20,1],[6,20,1],[16,crc],[20,data.length],[24,data.length],[28,name.length,1],[42,offset]]),name);
  offset+=30+name.length+data.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),count=Object.keys(files).length;
 return new Blob([...chunks,...central,bytes(22,[[0,0x06054b50],[8,count,1],[10,count,1],[12,size],[16,offset]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export async function reportFile(kind,format,rows){
 if(format==='csv')return new Blob(['\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 if(format==='xlsx'){
  const spreadsheet='http://schemas.openxmlformats.org/spreadsheetml/2006/main',relationships='http://schemas.openxmlformats.org/package/2006/relationships',office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipStored({
   '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
   '_rels/.rels':`<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
   'xl/workbook.xml':`<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`,
   'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
   'xl/worksheets/sheet1.xml':`<worksheet xmlns="${spreadsheet}"><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((value,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}"${typeof value==='number'?'':' t="inlineStr"'}>${typeof value==='number'?`<v>${value}</v>`:`<is><t>${xml(value)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
  });
 }
 if(format!=='pdf')throw new Error('Unsupported document format');
 return (await reportPdf(kind,rows)).blob;
}
