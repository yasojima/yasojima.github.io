/* Customer overview draft. Edits and deletion examples affect this page only. */
(() => {
  const $ = s => document.querySelector(s);
  const contact = [...$('#ovContact').children];
  const service = [...$('#ovService').children];
  const billing = [...$('#ovBilling').children];
  const value = row => row.querySelector('.ov-val');
  const text = row => value(row).textContent.trim().replace(/^--$/, '');
  const fields = {
    name: {row: contact[0], label: '氏名', required: true},
    phone: {row: contact[2], label: '電話番号', type: 'tel'},
    email: {row: contact[3], label: 'メールアドレス', type: 'email'},
    address: {row: service[0], label: '住所'},
    billingAddress: {row: billing[0], label: '請求先住所'},
    billingContact: {row: billing[1], label: '請求の連絡先'}
  };
  const profile = window.EXOPS_CUSTOMER_SAMPLE.profile;
  Object.assign(profile, {
    id: $('#cdHeader .rough-user-id strong').textContent,
    flag: $('#cdHeader .badge-blue').textContent,
    marker: $('#cdHeader .sub-status').textContent,
    primaryPayment: profile.primaryPayment,
    note: $('#ovNotes').textContent.trim().replace(/^--$/, '')
  });
  const row = (label, id, content) => {
    const el = document.createElement('div'); el.className = 'ov-row';
    const key = document.createElement('div'); key.className = 'ov-lbl'; key.textContent = label;
    const val = document.createElement('div'); val.className = 'ov-val'; val.id = id; val.textContent = content;
    el.append(key, val); return el;
  };
  contact[0].after(row('ID', 'overviewUserId', profile.id));
  const details = document.createElement('div'); details.id = 'overviewCustomerState';
  details.append(row('フラグ', 'overviewFlag', profile.flag));
  const markerRow = row('マーカー', 'overviewMarker', '');
  const marker = document.createElement('span'); marker.className = 'overview-marker'; marker.textContent = profile.marker;
  value(markerRow).append(marker); details.append(markerRow);
  details.append(row('主な決済方法', 'overviewPrimaryPayment', profile.primaryPayment));
  // Keep the existing two-column frame: customer information left, status right.
  contact[1].remove();
  const leftColumn = $('#ovContact').parentElement;
  const rightColumn = $('#ovService').parentElement;
  leftColumn.id = 'overviewPersonalColumn';
  rightColumn.id = 'overviewStatusColumn';
  const addressTitle = $('#ovService').previousElementSibling;
  const billingTitle = $('#ovBilling').previousElementSibling;
  addressTitle.style.marginTop = '18px';
  leftColumn.append(addressTitle, $('#ovService'), billingTitle, $('#ovBilling'));
  const statusTitle = document.createElement('div');
  statusTitle.className = 'cd-section-title'; statusTitle.textContent = 'ステータス';
  rightColumn.replaceChildren(statusTitle, details);

  // Reuse the existing pencil entry; it now edits overview information from the lower right.
  const edit = $('#ovNotesEdit'); edit.removeAttribute('data-sl-click'); edit.removeAttribute('style');
  edit.className = 'cd-act'; edit.setAttribute('aria-label', '概要を編集');
  const remove = document.createElement('button'); remove.type='button'; remove.id='overviewDelete'; remove.className='cd-act overview-delete'; remove.innerHTML='<i class="fas fa-trash" aria-hidden="true"></i> 削除'; remove.setAttribute('aria-label','顧客を削除');
  const footer = document.createElement('div'); footer.className = 'overview-footer';
  const feedback = document.createElement('span'); feedback.id = 'overviewFeedback'; feedback.setAttribute('role', 'status');
  const controls = document.createElement('div'); controls.className = 'overview-controls'; controls.append(edit,remove);
  footer.append(feedback, controls); $('#paneOverview').append(footer);
  $('#ovNotesEditor').remove();
  let editing = false;
  function updateHeader() {
    $('#cdName').textContent = profile.name;
    $('#cdAvatar').textContent = profile.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
    $('#cdHeader .rough-user-id strong').textContent = profile.id;
    $('#cdHeader .badge-blue').textContent = profile.flag;
    $('#cdHeader .sub-status').textContent = profile.marker;
    const phone = $('#cdHeader .rough-phone'), email = $('#cdHeader .rough-email');
    phone.replaceChildren(phone.querySelector('i'), document.createTextNode(' ' + profile.phone));
    phone.setAttribute('aria-label', profile.phone + ' に電話');
    email.replaceChildren(email.querySelector('i'), document.createTextNode(' ' + profile.email));
    $('#cdHeader .rough-address span').textContent = profile.address;
    const addressLink=$('#cdHeader .rough-address');
    if(profile.address.trim()){
      addressLink.href='https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:profile.address});
      addressLink.setAttribute('aria-label',profile.address+' を目的地としてGoogleマップで開く（新しいタブ）');
      addressLink.removeAttribute('aria-disabled');
    }else{addressLink.removeAttribute('href');addressLink.setAttribute('aria-disabled','true');addressLink.setAttribute('aria-label','住所未登録');}
  }
  function render() {
    for (const [key, f] of Object.entries(fields)) {
      const target = value(f.row); target.replaceChildren(); target.classList.toggle('empty', !profile[key] && !editing);
      if (editing) {
        const input = document.createElement('input'); input.className = 'overview-input'; input.id = 'overview-' + key;
        input.type = f.type || 'text'; input.value = profile[key]; input.required = !!f.required;
        input.setAttribute('aria-label', f.label); target.append(input);
      } else target.textContent = profile[key] || '--';
    }
    $('#ovNotes').replaceChildren();
    if (editing) {
      const input = document.createElement('textarea'); input.id = 'overview-note'; input.className = 'overview-input';
      input.value = profile.note; input.setAttribute('aria-label','メモ'); $('#ovNotes').append(input);
    } else $('#ovNotes').textContent = profile.note || '--';
    controls.replaceChildren();
    if (editing) {
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'cd-act'; cancel.id = 'overviewCancel'; cancel.textContent = 'キャンセル';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'cd-act primary'; save.id = 'overviewSave'; save.textContent = '保存';
      controls.append(cancel,save);
      cancel.onclick = () => { editing=false;render();edit.focus(); };
      save.onclick = () => {
        const inputs = [...$('#paneOverview').querySelectorAll('.overview-input')];
        if (inputs.some(i => !i.reportValidity())) return;
        for (const key of Object.keys(fields)) profile[key] = $('#overview-'+key).value.trim();
        profile.note = $('#overview-note').value; editing=false; render(); updateHeader();
        feedback.textContent='画面内の表示を更新しました。'; edit.focus();
      };
    } else controls.append(edit,remove);
    $('#ccAddBtn').disabled = editing;
  }
  edit.onclick = () => { editing=true;feedback.textContent='';render();$('#overview-name').focus(); };
  render(); updateHeader();

  const popup = document.createElement('dialog'); popup.id = 'customerDeleteDialog'; popup.className = 'customer-delete-dialog';
  popup.setAttribute('aria-labelledby','customerDeleteTitle'); popup.setAttribute('aria-describedby','customerDeleteWarning');
  popup.innerHTML='<h2 id="customerDeleteTitle">顧客を削除しますか？</h2><p id="customerDeleteName"></p><p id="customerDeleteWarning">削除すると復元できません。</p><div class="delete-choices"><button class="cd-act danger" id="customerDeleteYes">はい</button><button class="cd-act" id="customerDeleteNo">いいえ</button></div>';
  document.body.append(popup);
  remove.onclick = () => {
    $('#customerDeleteName').textContent=profile.name;popup.showModal();$('#customerDeleteNo').focus();
  };
  $('#customerDeleteNo').onclick = () => popup.close();
  popup.addEventListener('click',e=>{if(e.target===popup){const r=popup.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)popup.close();}});
  popup.addEventListener('close',()=>remove.focus());
  $('#customerDeleteYes').onclick = () => {
    popup.close();$('#cdRoot').hidden=true;
    const result=document.createElement('div');result.className='overview-deleted';result.id='customerDeletedExample';result.setAttribute('role','status');
    result.innerHTML='<p>削除後の表示例です。実際の顧客データは削除していません。</p><a class="cd-act" id="deletedBackToCustomers">顧客名簿に戻る</a>';
    $('#cdRoot').after(result);$('#deletedBackToCustomers').setAttribute('href',$('.cd-back').getAttribute('href'));
    $('#deletedBackToCustomers').focus();
  };
  window.exopsOverview={profile,get editing(){return editing}};
  window.EXOPS_OVERVIEW_READY=true;
})();
