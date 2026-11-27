export const money=value=>'$'+Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export function customerDate(value,time=false,local=false){
  if(!value)return '--';
  const date=new Date(value),options={year:'numeric',month:'long',day:'numeric',...(local?{}:{timeZone:'America/New_York'})};
  if(time)Object.assign(options,{hour:'numeric',minute:'2-digit',hourCycle:'h23'});
  return date.toLocaleString('ja-JP',options);
}
// The comparison demo freezes its clock on this captured service day. Keeping
// the same day makes archived next-appointment cards reproducible, not live.
export const referenceNow='2026-11-26T11:37:00Z';
export function historySummary(history){
  const ordered=[...history.appointments].sort((a,b)=>Date.parse(a.start_datetime)-Date.parse(b.start_datetime));
  const next=ordered.find(a=>['scheduled','confirmed'].includes(a.status)&&Date.parse(a.start_datetime)>Date.parse(referenceNow));
  return{paid:history.paidAmounts.reduce((sum,x)=>sum+Number(x),0),invoiceCount:history.invoices.length,
    balance:history.invoices.reduce((sum,x)=>sum+Number(x.balance_due),0),appointmentCount:ordered.length,last:ordered.at(-1),next};
}
export const readOnlyResponse='{"detail":"This action is disabled in the read-only demo.","error":"This action is disabled in the read-only demo."}';

// Preserve visible Japanese labels while keeping the captured option values.
const optionLabels={
 'Use Tenant Default':'会社の標準設定を使う','Always Pre-Charge':'訪問前に毎回決済する','Never Pre-Charge':'訪問前の決済を行わない',
 'Inbound':'着信','Outbound':'発信','Completed (answered)':'通話終了（応答あり）','Callback Scheduled':'折り返し連絡を予定','Voicemail':'留守番電話','No Answer':'応答なし','Busy':'話し中','Wrong Number':'電話番号違い',
 'General Inquiry':'一般のお問い合わせ','Service Issue':'作業に関する問題','Billing':'請求','Scheduling':'訪問予定','Complaint':'苦情','Callback Request':'折り返し電話の依頼','Warranty':'保証','Cancellation':'キャンセル',
 'Low':'低','Medium':'中','High':'高','Urgent':'緊急','Pending (inferred)':'確認待ち（記録から推定）','Completed (customer-confirmed)':'完了（お客様が確認済み）',
 'Owner':'所有者','Property Manager':'物件管理者','On-Site Contact':'現場の連絡担当者','Accounts Payable':'支払担当者','Other':'その他'
};
export function labelCustomerOptions(select){for(const option of select.options||[])option.label=optionLabels[option.textContent]||option.textContent;return select;}
