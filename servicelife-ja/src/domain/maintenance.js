export const maintenanceBuckets = [['','すべて'],['overdue','期限超過'],['due','期限'],['due_soon','まもなく期限'],['scheduled','予約済み'],['ok','OK'],['no_history','履歴はありません']];
export const maintenanceColumns = [['customer_name','お客様'],['rep_sold','契約を獲得した営業担当'],['address','訪問先の共通情報'],['job_type','種類'],['frequency','頻度'],['annual_value','定期料金'],['last_service','前回の作業'],['last_payment','最終入金'],['next_due','次の期限'],['next_appointment','次の訪問予定'],['days_until_due','期限までの期間'],['bucket','対応状況']];
export function maintenanceRows(records,state){
 const query=String(state.search||'').trim().toLowerCase();
 const rows=records.filter(r=>(!state.bucket||r.bucket===state.bucket)&&(!state.frequency||r.frequency===state.frequency)&&(!state.type||r.customer_type===state.type)&&(!query||[r.customer_name,r.address,r.rep_sold].some(v=>String(v||'').toLowerCase().includes(query))));
 const compare=(a,b,key)=>typeof a[key]==='number'&&typeof b[key]==='number'?a[key]-b[key]:String(a[key]??'').localeCompare(String(b[key]??''));
 if(state.sort)rows.sort((a,b)=>(state.direction||1)*compare(a,b,state.sort));
 else rows.sort((a,b)=>Number(a.has_upcoming)-Number(b.has_upcoming)||compare(a,b,'next_due'));
 return rows;
}
