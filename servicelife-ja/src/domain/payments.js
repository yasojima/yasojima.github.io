export const paymentStatuses=[['','All statuses','すべての対応状況'],['completed','Completed','作業完了'],['pending','Pending','保留'],['failed','Failed','失敗'],['refunded','Refunded','返金済み']];
export const paymentMethods=[['','All methods','すべての決済方法'],['card','Card','カード'],['cash','Cash','現金'],['check','Check','小切手'],['ach','ACH','米国の銀行口座振替（ACH）']];
export const paymentStatus=value=>paymentStatuses.find(([key])=>key===value)?.[2]||value;
export const paymentMethod=value=>paymentMethods.find(([key])=>key===value)?.[2]||value;
export function paymentRows(snapshot,{status='',method='',staff='',search=''}={}){
  if(!snapshot.completeList&&(status||method||staff||search))return [];
  const term=search.trim().toLowerCase();
  return snapshot.items.filter(row=>(!status||row.status===status)&&(!method||row.method===method)&&(!staff||row.staff===staff)&&
    (!term||['id','customer','customer_name','invoice','created_at','amount','method','status'].some(key=>String(row[key]??'').toLowerCase().includes(term))))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,snapshot.pageSize);
}
