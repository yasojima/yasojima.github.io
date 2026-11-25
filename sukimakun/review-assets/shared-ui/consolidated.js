/* Review-only interaction states. No network requests, storage or payment execution. */
(() => {
  const sample=window.EXOPS_CUSTOMER_SAMPLE,customer=sample.profile;
  const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
  const api=window.exopsRough, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n).toFixed(2), icon=n=>`<i class="fas fa-${n}" aria-hidden="true"></i>`;
  const date=d=>d.replaceAll('-','/'), label={cash:'現金',Stripe:'Stripe',Square:'Square',wallet:'電子マネー'};
  const tabs={overview:'概要',timeline:'MSG',appointments:'予約一覧'};
  const aliases={comms:'timeline',tickets:'timeline',invoices:'appointments',preferences:'overview',billing:'overview',payments:'appointments',documents:'appointments',media:'appointments'};
  const latest=()=>api.records()[0];
  const reservations=()=>api.records().map((r,i)=>({...r,estimate:i===0?200:r.amount,status:i===0?(api.state.closed?'対応完了':r.signed?'作業完了・確認済み':'作業完了・確認待ち'):'対応完了'}));
  const refunds=structuredClone(sample.refunds);
  const local={paymentView:'payments',receipt:latest().id,media:latest().id,unread:true,sent:[]};

  all('.cd-tab').forEach(t=>{if(!tabs[t.dataset.pane])t.remove();else{t.firstChild.textContent=tabs[t.dataset.pane]+' ';if(t.dataset.pane==='timeline')t.querySelector('.cnt').textContent='1';if(t.dataset.pane==='documents')t.querySelector('.cnt').remove();}});
  for(const n of ['comms','tickets','invoices','preferences','billing'])$('#pane'+n[0].toUpperCase()+n.slice(1)).replaceChildren();
  // Demo-only customer policies are retired together with their independent tabs.
  for(const id of ['cdPmSection','cdAutopaySection','routingFlexPanel'])$('#'+id)?.remove();
  $('#cdPrepayOverride')?.closest('.ov-row')?.remove();
  $('#paneOverview').append($('#ccSection'));
  // The former email CTA moves into the timeline; the address stays visible as contact information.
  const email=$('#cdHeader .rough-email');email.removeAttribute('aria-label');email.removeAttribute('href');
  const switchOriginal=window.cdSwitchTab;
  window.cdSwitchTab=name=>{
    name=aliases[name]||name;if(!tabs[name])name='overview';switchOriginal(name);
    if(name==='appointments')renderAppointments();
    if(name==='timeline')renderMessages();
  };
  window.addEventListener('popstate',()=>cdSwitchTab(location.hash.slice(1)||'overview'));

  function contextSelect(id,value,old=false){return `<select class="draft-select" id="${id}" aria-label="対象の予約">${reservations().map(r=>`<option value="${r.id}" ${value===r.id?'selected':''}>${r.id} ｜ ${date(r.date)} ｜ ${esc(r.service)}</option>`).join('')}${old?`<option value="expired" ${value==='expired'?'selected':''}>最終利用日から半年経過後（表示例）</option>`:''}</select>`;}
  function dialog(title,sub,body,foot=''){api.dialog(title,sub,body,foot||'<span></span><button class="cd-act" id="draftClose">閉じる</button>');$('#draftClose')?.addEventListener('click',api.close);}
  function openPdf(r,kind){
    if(kind==='invoice')return api.showRecordPdf(r);
    const paper=document.createElement('div');paper.innerHTML=window.exopsInvoice({amount:r.estimate,method:label[r.method],service:r.service,date:date(r.date),receipt:r.id,invoiceId:r.id.replace(/^R-?/,'EST-')});
    paper.querySelector('h2').textContent='見積書';paper.querySelector('.paper-id').innerHTML=`発行日：${r.id===latest().id?'2026/11/23':date(r.date)}<br>見積書番号：${r.id.replace(/^R-?/,'EST-')}<br>受付番号：${r.id}`;
    paper.querySelector('.paper-total .total span').textContent='概算見積金額';paper.querySelector('.paper-sign').textContent='無料見積もりの概算金額です。現場確認後の確定金額は請求書でご案内します。';
    dialog('見積書PDF',`受付番号 ${r.id}`,`<div class="signed-pdf-wrap">${paper.innerHTML}</div>`);
  }
  function reservationDetail(r){
    const related=refunds.filter(x=>x.receipt===r.id);
    dialog('予約の詳細',`${esc(customer.name)} ・ ${r.id}`,`<div class="draft-dialog-content"><dl><dt>受付番号</dt><dd class="draft-key">${r.id}</dd><dt>利用日</dt><dd>${date(r.date)}</dd><dt>サービス</dt><dd>${esc(r.service)}</dd><dt>訪問先</dt><dd>${esc(customer.address)}</dd><dt>依頼内容</dt><dd>家具・家電などの不用品回収</dd><dt>概算見積金額</dt><dd>${money(r.estimate)}</dd><dt>確定金額</dt><dd>${money(r.amount)}</dd><dt>決済方法</dt><dd>${label[r.method]}</dd><dt>入金状況</dt><dd>${r.paid?'入金済み':'未入金'}</dd><dt>入金日時</dt><dd>${r.paid?date(r.paidAt).replace('T',' '):'—'}</dd><dt>お客様の確認</dt><dd>${r.signed?'確認済み':'確認待ち'}</dd><dt>返金</dt><dd>${related.length?related.map(x=>`${money(x.amount)} ／ ${x.status}`).join('<br>'):'返金の記録はありません'}</dd></dl></div>`,`<div class="draft-subnav"><button class="cd-act" id="reservationMessage">MSG</button><button class="cd-act" id="reservationMedia">写真・動画</button><button class="cd-act" id="reservationPaymentEdit">入金記録を編集</button><button class="cd-act" id="reservationRefund" ${r.paid?'':'disabled'}>返金</button></div><button class="cd-act" id="draftClose">閉じる</button>`);
    $('#reservationMessage').onclick=()=>{local.receipt=r.id;api.close();cdSwitchTab('timeline');};
    $('#reservationMedia').onclick=()=>openMedia(r);
    $('#reservationPaymentEdit').onclick=()=>api.editRecord(r.id);
    $('#reservationRefund').onclick=()=>refundForm(r);
  }
  function reservationTable(){return `<table class="draft-table"><colgroup>${[108,150,150,150,100,90,110,90,85].map(w=>`<col style="width:${w}px">`).join('')}</colgroup><thead><tr><th>利用日</th><th>受付番号</th><th>サービス</th><th>状態</th><th>確定金額</th><th>見積書</th><th>写真・動画</th><th>請求書</th><th>予約内容</th></tr></thead><tbody>${reservations().map(r=>`<tr><td>${date(r.date)}</td><td><button class="draft-key" data-reservation="${r.id}">${r.id}</button></td><td>${esc(r.service)}</td><td>${r.status}</td><td>${money(r.amount)}</td><td><button class="cd-act pdf-button" data-document="estimate" data-receipt="${r.id}" aria-label="${r.id}の見積書PDF" title="見積書PDFを開く">${icon('file-pdf')}</button></td><td><button class="cd-act" data-reservation-media="${r.id}" aria-label="${r.id}の写真・動画">${icon('images')} 確認</button></td><td><button class="cd-act pdf-button" data-document="invoice" data-receipt="${r.id}" aria-label="${r.id}の請求書PDF" title="請求書PDFを開く">${icon('file-pdf')}</button></td><td><button class="cd-act" data-reservation="${r.id}">詳細</button></td></tr>`).join('')}</tbody></table><div class="draft-count">表示例 ${reservations().length}件</div>`;}
  function bindReservations(pane){
    pane.querySelectorAll('[data-document]').forEach(b=>b.onclick=()=>openPdf(reservations().find(r=>r.id===b.dataset.receipt),b.dataset.document));
    pane.querySelectorAll('[data-reservation]').forEach(b=>b.onclick=()=>reservationDetail(reservations().find(r=>r.id===b.dataset.reservation)));
    pane.querySelectorAll('[data-reservation-media]').forEach(b=>b.onclick=()=>openMedia(reservations().find(r=>r.id===b.dataset.reservationMedia)));
  }
  function renderAppointments(){
    $('#cntAppt').textContent=String(reservations().length);
    api.renderPayments();
  }
  function renderMessages(){
    const r=reservations().find(r=>r.id===local.receipt)||latest(), current=r.id===latest().id;
    $('#paneTimeline').innerHTML=`<div class="section-toolbar"><div><h3>MSG</h3><p>対象の予約に関するメールと対応の経緯</p></div><div class="draft-subnav">${contextSelect('messageReservation',r.id)}<button class="cd-act" id="messageRefresh">${icon('sync-alt')} 更新</button></div></div><div class="message-meta"><div><span>宛先</span>${esc(customer.email)}</div><div><span>担当</span>Alex Morgan</div><div><span>サービス</span>${esc(r.service)}</div></div><div class="message-log"><div class="message-event">${current?'2026/11/23 10:20':date(r.date)+' 09:00'}　見積書 ${money(r.estimate)} を送信</div><div class="message-bubble out"><div class="meta"><b>Alex Morgan</b><time>${current?'2026/11/23 17:20':date(r.date)+' 09:10'}</time></div>${current?'明日14時に伺います。よろしくお願いいたします。':'本日はご利用ありがとうございます。回収内容をご確認ください。'}</div><div class="message-bubble"><div class="meta"><b>${esc(customer.name)}</b><time>${current?'2026/11/24 09:05':date(r.date)+' 09:20'}</time>${local.unread?'<span class="draft-badge wait">未読</span>':''}</div>${current?'本日は14時でお願いします。家具と小型家電を玄関にまとめてあります。':'確認しました。よろしくお願いします。'}</div>${local.sent.filter(m=>m.receipt===r.id).map(m=>`<div class="message-bubble out"><div class="meta"><b>Alex Morgan</b><time>${m.time}</time><span>送信例</span></div>${esc(m.text)}</div>`).join('')}</div><button class="cd-act" id="messageUnread">未読に戻す</button><div class="message-compose"><label for="messageText">返信内容</label><textarea id="messageText" placeholder="返信内容を入力"></textarea><div class="message-bottom"><button class="cd-act" data-template="arrival">到着案内</button><button class="cd-act" data-template="schedule">日程確認</button><button class="cd-act" data-template="thanks">作業後のお礼</button><button class="cd-act primary send" id="messageSend" disabled>${icon('paper-plane')} 送信</button></div><div class="draft-message-status" id="messageStatus" role="status"></div></div>`;
    $('#messageReservation').onchange=e=>{local.receipt=e.target.value;renderMessages();};
    $('#messageRefresh').onclick=()=>{$('#messageStatus').textContent='表示中の履歴を確認しました。';};
    $('#messageUnread').onclick=()=>{local.unread=true;renderMessages();$('#messageStatus').textContent='未読に戻しました。';};
    $('#messageText').oninput=()=>{$('#messageSend').disabled=!$('#messageText').value.trim();local.unread=false;};
    const templates={arrival:`${esc(customer.name)} 様\nまもなく到着いたします。よろしくお願いいたします。`,schedule:`${esc(customer.name)} 様\nご予約の日程について確認させてください。`,thanks:`${esc(customer.name)} 様\n本日はご利用いただき、ありがとうございました。`};
    all('[data-template]').forEach(b=>b.onclick=()=>{$('#messageText').value=templates[b.dataset.template];$('#messageText').dispatchEvent(new Event('input'));$('#messageText').focus();});
    $('#messageSend').onclick=()=>{const value=$('#messageText').value.trim();if(!value)return;local.sent.push({receipt:r.id,text:value,time:'2026/11/25 10:00'});renderMessages();$('#messageStatus').textContent='送信後の表示例です。実際のメールは送っていません。';};
  }
  function openMedia(r,expired=false){
    local.media=r.id;
    const body=expired?`<div class="media-expired">最終利用日：${date(sample.directory.latestUse)}<br>写真・動画は保存期限を過ぎたため閲覧できません。<br>最終利用日から半年経過後、古いものから順次削除します。<br>顧客情報・PDFは保存期限なしで保持します。顧客を削除した後は復元できません。</div>`:`<div class="media-groups">${[['依頼時の資料',[['回収品の写真','image'],['室内の動画','video']]],['作業前',[['搬出前の写真','image']]],['作業後',[['回収後の写真','image']]]].map(([title,items])=>`<section class="media-group"><h4>${title}</h4>${items.map(([name,type])=>`<button class="media-file" data-media="${name}" data-type="${type}">${icon(type)}<span>${name}<small>${type==='video'?'動画':'写真'} ・ 確認用の表示枠</small></span></button>`).join('')}</section>`).join('')}</div><p class="draft-muted" style="margin-top:20px">写真・動画：最終利用日から半年経過後、古いものから順次削除</p>`;
    dialog('写真・動画',`${r.id} ｜ ${date(r.date)} ｜ ${esc(r.service)}`,`<div class="draft-dialog-content">${body}</div>`);
    all('[data-media]').forEach(b=>b.onclick=()=>{
      dialog(b.dataset.media,`${r.id} ｜ ${date(r.date)} ｜ ${esc(r.service)}`,`<div class="draft-dialog-content"><div class="media-placeholder">${icon(b.dataset.type)}<span>${b.dataset.media}</span><span>ここに対象の${b.dataset.type==='video'?'動画':'写真'}を表示します。</span></div></div>`,`<button class="cd-act" id="mediaBack">写真・動画に戻る</button><button class="cd-act" id="draftClose">閉じる</button>`);
      $('#mediaBack').onclick=()=>openMedia(r);
    });
  }
  function refundRow(r){const p=api.records().find(p=>p.id===r.receipt);return `<tr><td>${r.requested}</td><td><button class="draft-key" data-refund-open="${r.id}">${r.receipt}</button></td><td>${esc(p?.service||'不用品回収')}</td><td>${money(r.amount)}</td><td>${label[p?.method]||'—'}</td><td><span class="draft-badge ${r.status==='待機中'?'wait':'done'}">${r.status}</span></td><td>${r.completed}</td><td><button class="cd-act" data-refund-open="${r.id}">詳細</button></td></tr>`;}
  function refundDetail(r){const p=api.records().find(p=>p.id===r.receipt);dialog('返金履歴の詳細',`${esc(customer.name)} ・ ${r.receipt}`,`<div class="draft-dialog-content"><dl><dt>サービス</dt><dd>${esc(p.service)}</dd><dt>元の決済方法</dt><dd>${label[p.method]}</dd><dt>返金額</dt><dd>${money(r.amount)}</dd><dt>状態</dt><dd>${r.status}</dd><dt>操作日時</dt><dd>${r.requested}</dd><dt>返金確定日時</dt><dd>${r.completed}</dd><dt>担当</dt><dd>${r.staff}</dd><dt>理由</dt><dd>${esc(r.reason)}</dd></dl></div>`);}
  function attachPayments(){
    const pane=$('#paneAppointments');if(pane.querySelector('#paymentViews'))return;
    const confirmed=refunds.filter(r=>r.status==='返金確定'),pending=refunds.filter(r=>r.status==='待機中');
    $('#cdKpis .refund-kpi .cd-kpi-lbl').textContent='返金総額';
    $('.refund-value').textContent=money(confirmed.reduce((s,r)=>s+r.amount,0));
    // Replace the old payment table with the reviewed two-PDF reservation layout.
    // Keep the existing completion panel and refund-history view.
    const completion=pane.querySelector('.payment-detail');
    pane.innerHTML=`<div class="section-toolbar"><div><h3>予約一覧</h3><p>受付番号ごとに、依頼内容・見積書・写真や動画・請求書・入金状況を確認できます。</p></div><div class="draft-subnav" id="paymentViews"><button class="cd-act" data-view="payments">予約一覧</button><button class="cd-act" data-view="refunds">返金履歴</button></div></div><div class="payment-view" id="paymentRecords">${reservationTable()}</div>`;
    pane.querySelector('#paymentRecords').append(completion);
    bindReservations(pane);
    pane.insertAdjacentHTML('beforeend',`<div class="payment-view" id="refundRecords"><table class="draft-table refund-table"><colgroup>${[155,160,165,95,155,100,155,75].map(w=>`<col style="width:${w}px">`).join('')}</colgroup><thead><tr><th>操作日時</th><th>受付番号</th><th>サービス</th><th>返金額</th><th>元の決済方法</th><th>状態</th><th>返金確定日時</th><th></th></tr></thead><tbody>${refunds.map(refundRow).join('')}</tbody></table><div class="draft-count">返金操作の記録 ${refunds.length}件</div></div>`);
    const select=v=>{local.paymentView=v;$('#paymentRecords').hidden=v!=='payments';$('#refundRecords').hidden=v!=='refunds';all('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));};
    all('[data-view]').forEach(b=>b.onclick=()=>select(b.dataset.view));select(local.paymentView);
    all('[data-refund-open]').forEach(b=>b.onclick=()=>refundDetail(refunds.find(r=>r.id===b.dataset.refundOpen)));
  }
  function refundForm(r){
    const prior=refunds.find(x=>x.receipt===r.id);if(prior)return refundDetail(prior);
    dialog('返金内容を入力',`${esc(customer.name)} ・ ${r.id}`,`<div class="draft-dialog-content"><dl><dt>サービス</dt><dd>${esc(r.service)}</dd><dt>元の決済方法</dt><dd>${label[r.method]}</dd><dt>入金額</dt><dd>${money(r.amount)}</dd></dl><label for="refundAmount">返金額</label><input id="refundAmount" type="number" min="0.01" max="${r.amount}" step="0.01" value="${r.amount.toFixed(2)}"><label for="refundReason">返金理由</label><textarea id="refundReason" placeholder="返金する理由を入力"></textarea></div>`,`<span class="flow-muted">返金操作の画面案</span><button class="cd-act primary" id="refundReview">返金内容を確認</button>`);
    $('#refundReview').onclick=()=>{if(!$('#refundAmount').reportValidity())return;const amount=Number($('#refundAmount').value),reason=$('#refundReason').value;dialog('返金内容の確認',`${esc(customer.name)} ・ ${r.id}`,`<div class="draft-dialog-content"><dl><dt>返金額</dt><dd>${money(amount)}</dd><dt>元の決済方法</dt><dd>${label[r.method]}</dd><dt>理由</dt><dd>${esc(reason||'—')}</dd></dl><p class="draft-muted">確認用の画面です。実際の返金は行いません。</p></div>`,`<button class="cd-act" id="refundBack">戻る</button><button class="cd-act primary" id="refundApply">返金を申請</button>`);$('#refundBack').onclick=()=>refundForm(r);$('#refundApply').onclick=()=>{refunds.unshift({id:'refund-sample-'+(refunds.length+1),receipt:r.id,amount,status:'待機中',requested:'2026/11/25 10:00',completed:'—',reason:reason||'—',staff:'Alex Morgan'});api.close();local.paymentView='refunds';cdSwitchTab('payments');};};
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-refund]');if(b){e.stopImmediatePropagation();e.preventDefault();refundForm(api.records().find(r=>r.id===b.dataset.refund));}},true);
  window.addEventListener('exops:payments-rendered',attachPayments);
  window.exopsConsolidated={local,refunds,renderAppointments,renderMessages,openMedia,selectPaymentView(v){local.paymentView=v;api.renderPayments();}};
  // Map every previous entry to its current destination, including direct hashes.
  renderAppointments();
  api.renderPayments();
  cdSwitchTab(location.hash.slice(1)||'overview');
  window.EXOPS_FIVE_TABS_READY=true;
  window.SUKIMAKUN_THREE_TABS_READY=true;
})();
