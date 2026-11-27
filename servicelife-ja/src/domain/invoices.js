export const invoiceStatuses=[['','All statuses','すべての対応状況'],['draft','Draft','下書き'],['sent','Sent','送信済み'],['viewed','Viewed','閲覧済み'],['paid','Paid','入金済み'],['overdue','Overdue','期限超過'],['cancelled','Cancelled','キャンセル済み']];
export const invoiceColumns=[['invoice_number','請求書番号'],['customer_name','お客様'],['created_at','日付'],['due_date','支払期限'],['subtotal','小計'],['tax_amount','税額'],['total','合計'],['amount_paid','入金済み'],['balance_due','残高'],['status','対応状況']];
export function invoiceRows(snapshot,{status='',search='',ordering='-created_at'}={}){
  if(!snapshot.completeList&&(status||search||ordering!=='-created_at'))return [];
  const allowed=new Set(snapshot.listIds),key=ordering.replace(/^-/,'');
  if(!invoiceColumns.some(([field])=>field===key))return [];
  const direction=ordering.startsWith('-')?-1:1;
  const numberFields=new Set(['subtotal','tax_amount','total','amount_paid','balance_due']);
  const compare=(a,b)=>numberFields.has(key)?Number(a[key])-Number(b[key]):String(a[key]??'').localeCompare(String(b[key]??''));
  // The saved administrator list does not filter its search text. Preserve that
  // observed read-only behavior; a production search is a separate operation.
  return snapshot.items.filter(row=>allowed.has(row.id)&&(!status||row.status===status))
    .sort((a,b)=>direction*compare(a,b)||a.invoice_number.localeCompare(b.invoice_number)).slice(0,snapshot.pageSize);
}
export const invoiceStatus=value=>invoiceStatuses.find(([key])=>key===value)?.[2]||value;
