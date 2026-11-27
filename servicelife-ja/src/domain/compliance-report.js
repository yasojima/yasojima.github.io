// Explicit fictional examples for reviewing the local report workflow, not filings.
export function reportExamples(snapshot,kind){
 const state=kind==='pa-reporting'?'PA':kind.split('/')[1].split('-')[0].toUpperCase();
 const customers=snapshot.customerSearch.records.slice(0,3),staff=snapshot.licenses.slice(0,3);
 return ['2026-07-15','2026-09-20','2026-11-26'].map((date,i)=>({id:`DEMO-${state}-${i+1}`,date,state,customerId:customers[i]?.id||'',customer:customers[i]?.name||'デモ顧客'+(i+1),staffId:staff[i]?.technicianId||'',staff:staff[i]?.technician||'デモ担当'+(i+1),productId:'DEMO-PRODUCT-'+(i+1),product:'見本薬剤'+String.fromCharCode(65+i),quantity:(i+1)*.25}));
}
export function filterReport(records,values){
 let {start='',end='',year='',quarter=''}=values;
 if(year&&quarter){const m=(Number(quarter)-1)*3;start=`${year}-${String(m+1).padStart(2,'0')}-01`;end=new Date(Date.UTC(Number(year),m+3,0)).toISOString().slice(0,10)}
 if(start&&end&&start>end)throw new Error('終了日は開始日以降にしてください。');
 const match=(value,terms)=>!value||terms.some(t=>String(t).normalize('NFKC').toLowerCase().includes(value.normalize('NFKC').trim().toLowerCase()));
 const rows=records.filter(r=>(!start||r.date>=start)&&(!end||r.date<=end)&&match(values.technician_id||values.technician||'',[r.staffId,r.staff])&&match(values.customer_id||values.customer||'',[r.customerId,r.customer])&&match(values.product_id||values.product||'',[r.productId,r.product]));
 return {start,end,rows};
}
