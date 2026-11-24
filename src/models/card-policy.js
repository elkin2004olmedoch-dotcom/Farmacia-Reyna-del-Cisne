(function(global){
  'use strict';
  const brands=Object.freeze({visa:'Visa',mastercard:'Mastercard',amex:'American Express',diners:'Diners Club',discover:'Discover'});
  // Brand recognition only: this does not validate an account, funds or a bank authorization.
  function detectBrand(value){
    if(typeof value!=='string'||value.length>25)return null;
    const number=value.replace(/[ -]/g,'');if(!/^\d{13,19}$/.test(number))return null;
    const length=number.length,prefix=Number(number.slice(0,4)),bin=Number(number.slice(0,6));
    if([13,16,19].includes(length)&&number[0]==='4')return 'visa';
    if(length===16&&(/^(5[1-5])/.test(number)||prefix>=2221&&prefix<=2720))return 'mastercard';
    if(length===15&&/^3[47]/.test(number))return 'amex';
    if([14,16].includes(length)&&/^3(?:0[0-5]|[689])/.test(number))return 'diners';
    if([16,19].includes(length)&&(/^(6011|65|64[4-9])/.test(number)||bin>=622126&&bin<=622925))return 'discover';
    return null;
  }
  function formatNumber(value){const digits=String(value||'').replace(/\D/g,'').slice(0,19),groups=/^3[47]/.test(digits)?[4,6,5]:/^3(?:0[0-5]|[689])/.test(digits)?[4,6,4,2]:[4,4,4,4,3];let start=0;return groups.map(size=>{const part=digits.slice(start,start+size);start+=size;return part;}).filter(Boolean).join(' ');}
  function formatExpiry(value){const digits=String(value||'').replace(/\D/g,'').slice(0,4);return digits.length>2?digits.slice(0,2)+'/'+digits.slice(2):digits;}
  const api={brands,detectBrand,formatNumber,formatExpiry};(global.Farmacia ||= {}).cards=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
