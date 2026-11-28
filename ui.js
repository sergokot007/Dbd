/* Shared modal stack, browser history, image fallbacks and close/back behaviour. */
(function(){
 'use strict';
 const DEFAULT_FALLBACK='./assets/ui/asset-fallback.webp';
 const stack=[];
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=value=>{
  const text=String(value??'').trim();
  if(!text)return '';
  if(/^data:image\//i.test(text))return text;
  try{const parsed=new URL(text,location.href);if(parsed.protocol==='http:'||parsed.protocol==='https:')return text;}catch{}
  return '';
 };

 window.picture=function(src,options){
  const o=options||{},url=safeUrl(src),fallback=safeUrl(o.fallback||DEFAULT_FALLBACK)||DEFAULT_FALLBACK;
  const className=escapeHtml(o.className||''),label=escapeHtml(o.label||'✣');
  if(!url)return '<span class="picture-fallback '+className+'" aria-hidden="true">'+label+'</span>';
  const attrs=[
   'class="'+className+'"','src="'+escapeHtml(url)+'"','alt="'+escapeHtml(o.alt||'')+'"',
   'loading="'+(o.eager?'eager':'lazy')+'"','decoding="async"',
   'data-fallback="'+escapeHtml(fallback)+'"','data-fallback-label="'+label+'"',
   o.draggable===false?'draggable="false"':'',String(o.attrs||'')
  ].filter(Boolean).join(' ');
  return '<img '+attrs+'>';
 };

 function overlay(id){
  let el=document.getElementById(id);
  if(!el){
   el=document.createElement('div');el.id=id;el.className='detail-overlay';
   el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
   document.body.appendChild(el);
  }
  return el;
 }
 function sync(){
  stack.forEach((el,index)=>{el.style.zIndex=String(20+index*5);});
  document.body.classList.toggle('modal-open',stack.length>0);
  try{history.replaceState({...(history.state||{}),modalDepth:stack.length},'',location.href);}catch{}
 }
 function pushModalState(){
  const state={...(history.state||{}),tab:window.__dbdCurrentTab||history.state?.tab||'',modalDepth:stack.length+1};
  try{history.pushState(state,'',location.href);}catch{}
 }
 window.openModal=function(id,html,setup){
  const el=overlay(id),isNew=!stack.includes(el);
  if(isNew){pushModalState();stack.push(el);}
  el.innerHTML=html;
  el.classList.add('open');
  el.setAttribute('aria-hidden','false');
  el.scrollTop=0;
  sync();
  if(typeof setup==='function')setup(el);
  return el;
 };
 window.closeModal=function(id,fromHistory){
  const el=typeof id==='string'?document.getElementById(id):id;
  if(!el)return;
  el.classList.remove('open');el.setAttribute('aria-hidden','true');
  const index=stack.indexOf(el);if(index>=0)stack.splice(index,1);
  sync();
 };
 window.closeTopModal=function(){
  const el=stack[stack.length-1]||document.querySelector('.detail-overlay.open');
  if(!el)return;
  const priorDepth=Math.max(0,Number(history.state?.modalDepth)||0);
  window.closeModal(el);
  // A modal owns a history entry: stepping back makes the Android/browser Back
  // button behave like a close, not a jump to the previous site.
  if(priorDepth>stack.length&&!window.__dbdHistoryPop){
   try{history.back();}catch{}
  }
 };
 window.closeAllModals=function(){
  document.querySelectorAll('.detail-overlay.open').forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true');});
  stack.length=0;document.body.classList.toggle('modal-open',false);
  try{history.replaceState({...(history.state||{}),modalDepth:0},'',location.href);}catch{}
 };
 window.__dbdModalStack=()=>stack.slice();

 // A single close path: button, backdrop and Escape always affect only the topmost dialog.
 document.addEventListener('click',event=>{
  const close=event.target.closest('.detail-overlay.open .detail-close');
  if(close){
   event.preventDefault();event.stopImmediatePropagation();
   if(close.closest('.detail-overlay')===stack[stack.length-1])window.closeTopModal();
   return;
  }
  const backdrop=event.target.closest('.detail-overlay.open');
  if(backdrop&&event.target===backdrop&&backdrop===stack[stack.length-1]){
   event.preventDefault();event.stopImmediatePropagation();
   window.closeTopModal();
  }
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&stack.length){event.preventDefault();event.stopImmediatePropagation();window.closeTopModal();}
 },true);

 // Browser Back closes one dialog at a time; only then does it navigate tabs.
 window.addEventListener('popstate',event=>{
  window.__dbdHistoryPop=true;
  const targetDepth=Math.max(0,Number(event.state?.modalDepth)||0);
  let changed=false;
  while(stack.length>targetDepth){window.closeModal(stack[stack.length-1],true);changed=true;}
  if(changed){window.__dbdHistoryPop=false;return;}
  const fromHash=decodeURIComponent(location.hash.replace(/^#/,'')).trim();
  const nextTab=event.state?.tab||fromHash;
  if(nextTab&&nextTab!==window.__dbdCurrentTab&&typeof window.switchTab==='function'){
   window.switchTab(nextTab,{history:false});
  }
  window.__dbdHistoryPop=false;
 });

 // Remote catalog art can disappear. Swap to a bundled illustration once, then
 // show a styled glyph if even the local asset is unavailable.
 document.addEventListener('error',event=>{
  const img=event.target;
  if(!img||img.tagName!=='IMG')return;
  const fallback=img.getAttribute('data-fallback')||DEFAULT_FALLBACK;
  let absolute='';
  try{absolute=new URL(fallback,document.baseURI).href;}catch{}
  const current=img.getAttribute('src')||'';
  if(!img.dataset.fallbackApplied&&current!==absolute&&fallback){
   img.dataset.fallbackApplied='1';img.src=fallback;return;
  }
  const span=document.createElement('span');
  span.className='picture-fallback '+(img.className||'');
  span.setAttribute('aria-hidden','true');
  span.textContent=img.dataset.fallbackLabel||'✣';
  if(img.parentNode)img.parentNode.replaceChild(span,img);
 },true);
})();
