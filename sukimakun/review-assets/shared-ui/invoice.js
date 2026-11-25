(() => {
 const sample=window.EXOPS_CUSTOMER_SAMPLE,customer=sample.profile;
 const fmt=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateJP=d=>d.replace(/(\d{4})-(\d{2})-(\d{2})/,'$1年$2月$3日');
 function invoice({amount=sample.current.amount,method='Stripe',signed=false,name=customer.name,service=sample.current.service,date=dateJP(sample.current.date),receipt=sample.current.id,invoiceId='INV-'+receipt.replace(/^R-?/,''),issuedAt=date,signedAt=date+' 14:32'}={}){
  return `<div class="flow-paper"><div class="paper-top"><div><h2>請求書</h2><div class="paper-company">Evergreen Pest Solutions</div><div class="paper-address">不用品回収・家具・家電回収</div></div><div class="paper-id">発行日：${esc(issuedAt)}<br>請求書番号：${esc(invoiceId)}<br>受付番号：${esc(receipt)}</div></div><div class="paper-customer">${esc(customer.name)} 様</div><div class="paper-info">${esc(customer.address)}<br>サービス実施日：${esc(date)}</div><table><thead><tr><th>サービス内容</th><th>金額</th></tr></thead><tbody><tr><td>${esc(service)}</td><td>${fmt(amount/1.1)}</td></tr></tbody></table><div class="paper-total"><div><span>小計</span><span>${fmt(amount/1.1)}</span></div><div><span>税</span><span>${fmt(amount-amount/1.1)}</span></div><div class="total"><span>ご請求金額</span><span>${fmt(amount)}</span></div></div><div class="paper-sign">お支払い方法：${esc(method)}<br>お客様の確認：<b>${signed?'確認済み':'未確認'}</b><br>${signed?'ご本人入力の氏名：'+esc(name)+'<br>確認日時：'+esc(signedAt):'氏名・確認日時は、ご本人の確認後に反映されます。'}</div></div>`;
 }
 window.exopsInvoice=invoice;
})();
