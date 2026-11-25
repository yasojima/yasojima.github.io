/* Preserve reference interactions; settlement uses the reviewed sample only. */
(() => {
 document.addEventListener('click',e=>{
   if(e.target.closest('#cdHeader [data-phone-preview]')){e.preventDefault();e.stopImmediatePropagation();return;}
   // Keep normal anchor navigation; the reference demo blocks all external links.
   if(e.target.closest('#cdHeader a.rough-address[href]'))e.stopImmediatePropagation();
 },true);
 document.addEventListener('click',e=>{
   const b=e.target.closest('[data-sl-click]');
   if(b&&/^openTakePay\(/.test(b.getAttribute('data-sl-click')||'')){
     e.preventDefault();e.stopImmediatePropagation();
     window.dispatchEvent(new CustomEvent('exops-reference-note',{detail:'この請求書から精算への接続は調整中です'}));
   }
 },true);
 const selected=document.querySelector('.cd-tab.active')?.dataset.pane||'overview';
 exopsRough.showPayments();
 cdSwitchTab(selected);
 window.EXOPS_SHARED_READY=true;
})();
