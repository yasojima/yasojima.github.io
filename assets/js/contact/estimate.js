(() => {
  (() => {
    'use strict';

    const postalInputs = document.querySelectorAll('.js-search-address-data input[type="text"][data-postal-code]');
    const formatPostalCode = (input) => {
      const numeric = input.value
        .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 65248))
        .replace(/[^0-9]/g, '');
      input.value = numeric.slice(0, Number(input.getAttribute('maxlength')));
    };
    postalInputs.forEach((input) => {
      input.addEventListener('change', () => formatPostalCode(input));
    });

    new class{constructor(){var t,e;this.privacyPolicyCheckboxElement=null,this.submitButtonElement=null,this.privacyPolicyCheckboxElement=document.querySelector("#js-privacy-policy"),this.submitButtonElement=document.querySelector("#js-submit-button"),null===(t=this.privacyPolicyCheckboxElement)||void 0===t||t.addEventListener("change",(t=>this.checkedPrivacyPolicy(t))),null===(e=this.privacyPolicyCheckboxElement)||void 0===e||e.dispatchEvent(new Event("change"))}checkedPrivacyPolicy(t){const e=t.currentTarget;this.submitButtonElement.disabled=!e.checked}},new class{constructor(){var t,e,n;this.privacyPolicyCheckboxElement=null,this.submitButtonElement=null,this.formElement=null,this.privacyPolicyCheckboxElement=document.querySelector("#js-privacy-policy"),this.submitButtonElement=document.querySelector("#js-submit-button"),this.formElement=null===(t=this.submitButtonElement)||void 0===t?void 0:t.closest("form"),this.changeSubmit(),null===(e=this.submitButtonElement)||void 0===e||e.addEventListener("click",this.submit.bind(this)),null===(n=this.submitButtonElement)||void 0===n||n.addEventListener("popstate",this.enabledSubmit.bind(this))}submit(){var t,e;null===(t=this.submitButtonElement)||void 0===t||t.setAttribute("disabled","true"),null===(e=this.formElement)||void 0===e||e.submit()}enabledSubmit(){var t;null===(t=this.submitButtonElement)||void 0===t||t.removeAttribute("disabled")}changeSubmit(){var t,e,n;this.privacyPolicyCheckboxElement?this.privacyPolicyCheckboxElement.checked?null===(t=this.submitButtonElement)||void 0===t||t.removeAttribute("disabled"):null===(e=this.submitButtonElement)||void 0===e||e.setAttribute("disabled","true"):null===(n=this.submitButtonElement)||void 0===n||n.removeAttribute("disabled")}}})()})();
