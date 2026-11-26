/* Date/filter queries over the complete source-demo snapshot. No live writes. */
function createReferenceQueries(config){
 const fx=config.fixtures||{},dataset=fx['/reference/query-data/'];
 const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const values=k=>dataset?.collections?.[k]?.results||[];
 const sum=(xs,key)=>round(xs.reduce((n,x)=>n+Number(x[key]||0),0));
 const apps=values('appointments'),invoices=values('invoices'),customers=values('customers');
 const appById=new Map(apps.map(x=>[x.id,x])),customerById=new Map(customers.map(x=>[x.id,x]));
 function report(kind,q){
  const original=fx['/api/v1/billing/reports/'+kind+'/'];if(!original||!dataset)return null;
  const start=q.get('start_date')||'',end=q.get('end_date')||dataset.date;
  const includes=stamp=>!!stamp&&(!start||stamp.slice(0,10)>=start)&&(!end||stamp.slice(0,10)<=end);
  const byCreated=invoices.filter(x=>includes(x.created_at));
  const byVisit=invoices.filter(x=>includes(appById.get(x.appointment)?.start_datetime));
  const months=[];const monthStart=start?start.slice(0,7):dataset.date.slice(0,7);
  let date=new Date(monthStart+'-01T12:00:00Z');if(!start)date.setUTCMonth(date.getUTCMonth()-11);
  const last=(end||dataset.date).slice(0,7);
  while(date.toISOString().slice(0,7)<=last&&months.length<240){months.push({key:date.toISOString().slice(0,7),month:date.toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})});date.setUTCMonth(date.getUTCMonth()+1);}
  const counts=(xs,key)=>{const map=new Map();for(const x of xs){const n=key(x);if(n)map.set(n,(map.get(n)||0)+1)}return [...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));};
  if(kind==='revenue')return {monthly_revenue:months.map(m=>({month:m.month,revenue:sum(byCreated.filter(x=>x.created_at.startsWith(m.key)),'amount_paid')})),
   by_job_type:counts(byVisit,x=>x.line_items?.[0]?.description),by_technician:counts(byVisit,x=>appById.get(x.appointment)?.technician_name?.split(' ')[0]),
   invoices:{total_all_time:invoices.length,this_month:byCreated.length,total_invoiced:sum(byCreated,'total'),total_paid:sum(byCreated,'amount_paid'),overdue:byCreated.filter(x=>x.status==='overdue').length,outstanding:original.invoices.outstanding}};
  if(kind==='customers'){
   const type=q.get('customer_type'),selected=customers.filter(c=>!type||c.customer_type===type),jobCounts=counts(byVisit,x=>x.customer);
   return {...original,total:selected.length,monthly_growth:months.map(m=>({month:m.month,new_customers:selected.filter(x=>includes(x.created_at)&&x.created_at.startsWith(m.key)).length})),top_customers:jobCounts.slice(0,10).map(x=>({name:[customerById.get(x.name)?.first_name,customerById.get(x.name)?.last_name].filter(Boolean).join(' '),jobs:x.count}))};
  }
  if(kind==='technicians')return {technicians:original.technicians.filter(x=>!q.get('tech_id')||x.id===q.get('tech_id')).map(tech=>({...tech,month_jobs:byVisit.filter(x=>appById.get(x.appointment)?.technician===tech.id).length,month_scheduled:apps.filter(x=>x.technician===tech.id&&includes(x.start_datetime)&&x.status!=='cancelled').length}))};
  if(kind==='leads'&&values('leads').length===0)return {...original,monthly_funnel:months.map(m=>({month:m.month,new:0,won:0,lost:0}))};
  if(kind==='commercial'){
   const commercial=x=>customerById.get(x.customer)?.customer_type==='commercial',cis=byCreated.filter(commercial),res=byCreated.filter(x=>!commercial(x));
   const grouping=new Map();for(const inv of cis){if(!grouping.has(inv.customer))grouping.set(inv.customer,[]);grouping.get(inv.customer).push(inv);}
   const top_accounts=[...grouping].map(([id,rows])=>({id,name:customerById.get(id)?.company_name||customerById.get(id)?.full_name,property_type:original.top_accounts.find(x=>x.id===id)?.property_type||'House',revenue_12mo:sum(rows,'total'),invoice_count:rows.length})).sort((a,b)=>b.revenue_12mo-a.revenue_12mo).slice(0,10);
   return {...original,kpis:{...original.kpis,revenue_12mo:sum(cis,'total'),paid_12mo:sum(cis,'amount_paid'),avg_ticket:cis.length?round(sum(cis,'total')/cis.length):0,avg_ticket_residential:res.length?round(sum(res,'total')/res.length):0,invoice_count_12mo:cis.length},monthly_revenue:months.map(m=>({month:m.month,revenue:sum(cis.filter(x=>x.created_at.startsWith(m.key)),'total')})),by_property_type:original.by_property_type.map(x=>({...x,revenue_12mo:sum(cis,'total')})),top_accounts};
  }
  return null;
 }
 const flatten=(obj,prefix='',out=[])=>{for(const [k,v]of Object.entries(obj)){const key=prefix?prefix+' / '+k:k;if(v&&typeof v==='object')flatten(v,key,out);else out.push([key,v??'']);}return out;};
 function xml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
 function xlsx(rows){
  // A standards-compliant OOXML workbook, with ZIP store entries and CRC32.
  const enc=new TextEncoder(),files={
   '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
   'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>typeof v==='number'?'<c r="'+String.fromCharCode(65+j)+(i+1)+'"><v>'+v+'</v></c>':'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+xml(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>'};
  const chunks=[],directory=[];let offset=0;
  const header=(size,values)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [at,n,width]of values)width===2?v.setUint16(at,n,true):v.setUint32(at,n,true);return b;};
  for(const [name,text]of Object.entries(files)){const n=enc.encode(name),d=enc.encode(text);let crc=0xffffffff;for(const byte of d){crc^=byte;for(let i=0;i<8;i++)crc=crc>>>1^(crc&1?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
   chunks.push(header(30,[[0,0x04034b50],[4,20,2],[14,crc],[18,d.length],[22,d.length],[26,n.length,2]]),n,d);
   directory.push(header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[16,crc],[20,d.length],[24,d.length],[28,n.length,2],[42,offset]]),n);offset+=30+n.length+d.length;
  }const length=directory.reduce((s,x)=>s+x.length,0);return new Blob([...chunks,...directory,header(22,[[0,0x06054b50],[8,Object.keys(files).length,2],[10,Object.keys(files).length,2],[12,length],[16,offset]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 }
 async function exported(kind,value,format){
  const rows=kind==='revenue'?[['Month','Revenue'],...value.monthly_revenue.map(x=>[x.month,x.revenue])]:
   kind==='customers'?[['Month','New Customers'],...value.monthly_growth.map(x=>[x.month,x.new_customers])]:
   kind==='technicians'?[['Technician','Total Jobs','This Month','Scheduled','Avg Duration (min)'],...value.technicians.map(x=>[x.name,x.total_jobs,x.month_jobs,x.month_scheduled,x.avg_duration])]:
   kind==='leads'?[['Month','New Leads','Won','Lost'],...value.monthly_funnel.map(x=>[x.month,x.new,x.won,x.lost])]:
   [['Account','Property Type','Invoices','Revenue'],...value.top_accounts.map(x=>[x.name,x.property_type,x.invoice_count,x.revenue_12mo])];
  if(format==='csv')return new Response('\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv;charset=utf-8'}});
  if(format==='xlsx')return new Response(xlsx(rows),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  if(format==='pdf'){
   const PDFLib=await import(config.pdfLibUrl);
   const pdf=await PDFLib.PDFDocument.create(),font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);let page,y=0;
   for(const [key,val]of [[kind.toUpperCase()+' REPORT',''],...rows]){if(y<45){page=pdf.addPage([595,842]);y=800;}const text=(key+'    '+val).replace(/[^\x20-\x7e]/g,'?');for(let i=0;i<text.length;i+=96){page.drawText(text.slice(i,i+96),{x:30,y,size:9,font});y-=14;}}
   return new Response(await pdf.save(),{headers:{'Content-Type':'application/pdf'}});
  }
  return null;
 }
 async function query(url){
  if(!dataset)return null;
  if(url.pathname==='/api/v1/customer-search/'&&dataset.searchCustomers){const q=(url.searchParams.get('q')||'').trim().toLowerCase();return reply(q.length<2?[]:dataset.searchCustomers.filter(c=>[c.full_name,c.display_name,c.first_name,c.last_name,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(q))));}
  if(url.pathname==='/dashboard/drilldown/trend/'&&url.searchParams.has('span')){
   const metric=url.searchParams.get('metric'),prefix='/dashboard/drilldown/trend/?metric='+metric;
   const original=fx[prefix],maximum=original&&fx[prefix+'&span='+original.span_max];
   if(maximum?.adjustable){const n=Math.max(maximum.span_min,Math.min(maximum.span_max,Number(url.searchParams.get('span'))));
    const slice=span=>({...maximum,span,subtitle:maximum.subtitle.replace(/last \d+ /,'last '+span+' '),labels:maximum.labels.slice(-span),values:maximum.values.slice(-span),...(maximum.values2?{values2:maximum.values2.slice(-span)}:{})});
    const same=(a,b)=>Object.keys(a).every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
    if(Number.isInteger(n)&&Object.entries(fx).filter(([u])=>u===prefix||u.startsWith(prefix+'&span=')).every(([,v])=>same(v,slice(v.span))))return reply(slice(n));
   }
  }
  const match=url.pathname.match(/^\/api\/v1\/billing\/reports\/(revenue|customers|technicians|leads|commercial)\/$/);
  if(match){if(config.role==='csr'&&match[1]!=='revenue')return reply({detail:'Permission denied.'},403);if(config.role==='technician')return null;const value=report(match[1],url.searchParams);if(value)return url.searchParams.has('export')?exported(match[1],value,url.searchParams.get('export')):reply(value);}
  return null;
 }
 query.report=report;return query;
}
