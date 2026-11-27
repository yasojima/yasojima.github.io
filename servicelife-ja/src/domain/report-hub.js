const rounded=n=>Math.round((n+Number.EPSILON)*100)/100;
const sum=(records,key)=>rounded(records.reduce((v,r)=>v+Number(r[key]||0),0));
export function reportValues(data,kind,filters={}){
 if(data.role==='csr'&&kind!=='revenue')return null;
 const {start='',end='',type='',staff=''}=filters,key=JSON.stringify([kind,start,end,type,staff]);
 if(data.captured[key])return structuredClone(data.captured[key]);
 const initial=data.captured[JSON.stringify([kind,'','','',''])];if(!initial)return null;
 const upper=end||data.date,inside=date=>!!date&&(!start||date.slice(0,10)>=start)&&date.slice(0,10)<=upper;
 const months=[];const from=new Date((start||data.date).slice(0,7)+'-01T12:00:00Z');if(!start)from.setUTCMonth(from.getUTCMonth()-11);
 while(from.toISOString().slice(0,7)<=upper.slice(0,7)&&months.length<240){months.push({key:from.toISOString().slice(0,7),month:from.toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})});from.setUTCMonth(from.getUTCMonth()+1)}
 const byId=new Map(data.visits.map(v=>[v.id,v])),people=new Map(data.customers.map(c=>[c.id,c])),bills=data.bills.filter(b=>inside(b.created)),performed=data.bills.filter(b=>inside(byId.get(b.visit)?.date));
 const monthly=(records,key)=>months.map(m=>({month:m.month,revenue:sum(records.filter(r=>r.created.startsWith(m.key)),key)}));
 if(kind==='revenue')return {monthly:monthly(bills,'paid'),invoices:{...initial.invoices,this_month:bills.length,total_invoiced:sum(bills,'total'),total_paid:sum(bills,'paid'),overdue:bills.filter(b=>b.status==='overdue').length}};
 if(kind==='customers'){const customers=data.customers.filter(c=>!type||c.type===type);return {...initial,total:customers.length,monthly:months.map(m=>({month:m.month,new_customers:customers.filter(c=>inside(c.created)&&c.created.startsWith(m.key)).length}))};}
 if(kind==='technicians')return {staff:initial.staff.filter(t=>!staff||t.id===staff).map(t=>({...t,month_jobs:performed.filter(b=>byId.get(b.visit)?.staff===t.id).length,month_scheduled:data.visits.filter(v=>v.staff===t.id&&inside(v.date)&&v.status!=='cancelled').length}))};
 if(kind==='leads'){if(data.leadCount)throw new Error('Lead data is not migrated');return {...initial,monthly:months.map(m=>({month:m.month,new:0,won:0,lost:0}))};}
 if(kind==='commercial'){
  const commercial=bills.filter(b=>people.get(b.customer)?.type==='commercial'),residential=bills.filter(b=>people.get(b.customer)?.type!=='commercial'),groups=new Map();
  for(const b of commercial){if(!groups.has(b.customer))groups.set(b.customer,[]);groups.get(b.customer).push(b)}
  const accounts=[...groups].map(([id,rows])=>({id,name:people.get(id)?.company||people.get(id)?.name,property_type:initial.accounts.find(a=>a.id===id)?.property_type||'House',revenue_12mo:sum(rows,'total'),invoice_count:rows.length})).sort((a,b)=>b.revenue_12mo-a.revenue_12mo).slice(0,10);
  return {...initial,kpis:{...initial.kpis,revenue_12mo:sum(commercial,'total'),paid_12mo:sum(commercial,'paid'),avg_ticket:commercial.length?rounded(sum(commercial,'total')/commercial.length):0,avg_ticket_residential:residential.length?rounded(sum(residential,'total')/residential.length):0,invoice_count_12mo:commercial.length},monthly:monthly(commercial,'total'),properties:initial.properties.map(p=>({...p,revenue_12mo:sum(commercial,'total')})),accounts};
 }
 return null;
}
export function reportRows(kind,data){
 if(kind==='revenue')return [['Month','Revenue'],...data.monthly.map(m=>[m.month,m.revenue])];
 if(kind==='customers')return [['Month','New Customers'],...data.monthly.map(m=>[m.month,m.new_customers])];
 if(kind==='technicians')return [['Technician','Total Jobs','This Month','Scheduled','Avg Duration (min)'],...data.staff.map(t=>[t.name,t.total_jobs,t.month_jobs,t.month_scheduled,t.avg_duration])];
 if(kind==='leads')return [['Month','New Leads','Won','Lost'],...data.monthly.map(m=>[m.month,m.new,m.won,m.lost])];
 return [['Account','Property Type','Invoices','Revenue'],...data.accounts.map(a=>[a.name,a.property_type,a.invoice_count,a.revenue_12mo])];
}

export function exportReportRows(snapshot,kind,format,filters){
 const stored=snapshot.exports[JSON.stringify([kind,filters.start||'',filters.end||'',format==='pdf'?'csv':format])];
 return stored?structuredClone(stored):reportRows(kind,reportValues(snapshot,kind,{start:filters.start,end:filters.end}));
}
