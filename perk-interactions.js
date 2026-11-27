(function(){
"use strict";
const key=v=>typeof window.dbdNormalizeName==="function"?window.dbdNormalizeName(v):String(v??"").toLowerCase().normalize("NFKD").replace(/[’']/g,"'").replace(/[^a-z0-9а-яё]/gi,"");
const hasRuEn=v=>/[А-Яа-яЁё][^()]*\([^)]*[A-Za-z][^)]*\)/.test(String(v??""));
const sharedDisplay=(v,kind,fallback)=>typeof window.dbdDisplayName==="function"?window.dbdDisplayName(v,kind,fallback):String(v??"");
const sharedEnglish=(v,kind)=>typeof window.dbdRecordEnglish==="function"?window.dbdRecordEnglish(v,kind):String(v??"");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let catalogPromise=null,perkRecords=[],characters=[],perkNameMap={},perkDescriptionMap={};
const ownerFallback=()=>{try{return typeof perkOwners!=="undefined"?perkOwners:{}}catch{return {}}};
const arr=v=>Array.isArray(v)?v:[];
function fieldImage(x){
 if(!x)return "";
 const v=x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.iconURL||x.portrait||x.portraitURL||x.portraitUrl||x.characterIcon||x.character_icon||x.perkIcon||x.perk_icon||x.iconPath||x.icon_path;
 if(typeof v==="string")return v;
 if(v&&typeof v==="object")return v.url||v.src||v.href||"";
 const m=x.assets||x.media||x.images||{};return m.icon||m.portrait||m.image||m.url||"";
}
function english(p){return p&&(p.nameEn||p.englishName||p.name_en||p.english_name||p.slug||p.id||p.name||p.displayName)||""}
function perkKeys(label){
 const info=typeof window.dbdNameInfo==="function"?window.dbdNameInfo(label,"perk"):null;
 return [label,info&&info.en,info&&info.ru,info&&info.display,sharedEnglish(label,"perk")].filter(Boolean).map(key).filter(Boolean);
}
function findPerk(label){
 const keys=perkKeys(label),fields=p=>[p.nameEn,p.englishName,p.name_en,p.english_name,p.slug,p.id,p.name,p.displayName,p.display_name,p.title].filter(Boolean);
 return perkRecords.find(p=>fields(p).some(v=>keys.includes(key(v))))||perkRecords.find(p=>fields(p).some(v=>keys.some(k=>k.length>5&&key(v).length>5&&(key(v).includes(k)||k.includes(key(v))))))||null;
}
function translated(map,p,label){
 const keys=[p&&p.id,p&&p.slug,p&&p.nameEn,p&&p.englishName,p&&p.name_en,p&&p.english_name,p&&p.name,p&&p.displayName,label].filter(Boolean).map(key);
 for(const [k,v] of Object.entries(map||{}))if(keys.includes(key(k))&&v)return typeof v==="string"?v:"";
 return "";
}
function canonicalOwner(value){
 let text="";
 if(value&&typeof value==="object")text=String(value.name||value.displayName||value.nameEn||"");
 else text=String(value??"").trim();
 if(!text||(typeof window.dbdIsGeneralOwner==="function"&&window.dbdIsGeneralOwner(text)))return "";
 const info=typeof window.dbdNameInfo==="function"?window.dbdNameInfo(text,"character"):null;
 return info?.en||sharedEnglish(text,"character")||text;
}
function ownerFor(p,label){
 if(!p)return "";
 let raw="";
 const direct=p.characterName||p.character_name||p.owner||p.ownerName||p.owner_name||p.survivor||p.killer||p.character;
 if(typeof direct==="string"&&direct.trim())raw=direct.trim();
 else if(direct&&typeof direct==="object")raw=String(direct.name||direct.displayName||direct.nameEn||"");
 if(!raw){
  const maps=window.__dbdPerkOwners||{},ids=[p.id,p.slug,p.nameEn,p.englishName,p.name_en,p.english_name,p.name,p.displayName,label].filter(Boolean).map(key);
  for(const [k,v] of Object.entries(maps))if(ids.includes(key(k))&&v){raw=typeof v==="string"?v:(v.name||v.displayName||"");break}
 }
 if(!raw){
  const fallback=ownerFallback(),ids=[p.id,p.slug,p.nameEn,p.englishName,p.name_en,p.english_name,p.name,p.displayName,label].filter(Boolean).map(key);
  for(const [k,v] of Object.entries(fallback))if(ids.includes(key(k))&&v){raw=v;break}
 }
 return canonicalOwner(raw);
}
function ownerDisplay(owner){return owner?sharedDisplay(owner,"character",owner):""}
function findCharacter(owner){
 if(!owner||(typeof window.dbdIsGeneralOwner==="function"&&window.dbdIsGeneralOwner(owner)))return null;
 const pool=[...characters,...Object.values(window.__dbdCharacterCatalog||{}),...Object.values(typeof characterPortraits!=="undefined"?characterPortraits:{})];
 if(typeof window.dbdCharacterRecord==="function"){
  const resolved=window.dbdCharacterRecord(owner,pool);
  if(resolved)return resolved;
 }
 const k=key(owner);
 return pool.find(c=>[c.nameEn,c.englishName,c.name_en,c.english_name,c.name,c.displayName,c.display_name,c.title,c.killerName].filter(Boolean).some(v=>key(v)===k))||null;
}
async function loadCatalog(){
 if(catalogPromise)return catalogPromise;
 catalogPromise=(async()=>{
  try{if(typeof localCatalog==="function"){
   const c=await localCatalog();perkRecords=arr(c.perks);characters=arr(c.characters);
   const tr=c.translations||{};perkNameMap=tr.perks||{};perkDescriptionMap=tr.descriptions?.perks||{};
   window.__dbdPerkOwners=tr.perkOwners||window.__dbdPerkOwners||{};window.__dbdCharacterCatalog=characters;
  }}catch{}
  if(!characters.length&&typeof ensureCharacterPortraits==="function")try{await ensureCharacterPortraits();characters=Object.values(window.__dbdCharacterCatalog||{});}catch{}
  return {perks:perkRecords,characters};
 })();return catalogPromise;
}
function perkName(p,label){
 const full=sharedDisplay(label,"perk",p)||sharedDisplay(p,"perk",label);
 if(hasRuEn(full))return full;
 const ru=(p&&(p.nameRu||p.name_ru||p.russianName||p.russian_name))||translated(perkNameMap,p,label);
 const en=sharedEnglish(p,"perk")||english(p)||label;
 if(ru&&/[А-Яа-яЁё]/.test(ru)&&en&&ru!==en)return String(ru).replace(/\s*\([^)]*\)\s*$/,"")+" ("+en+")";
 const n=p&&(p.displayName||p.display_name||p.name);
 if(n&&/[А-Яа-яЁё]/.test(n))return String(n).replace(/\s*\([^)]*\)\s*$/,"")+" ("+en+")";
 try{const curated=typeof buildPerkRussianName==="function"?buildPerkRussianName(p,label):"";if(hasRuEn(curated))return curated}catch{}
 return full||label||english(p)||"Перк";
}
function formatValue(v){
 if(v===null||v===undefined||v==="")return "";
 if(Array.isArray(v))return v.map(formatValue).filter(Boolean).join("\n");
 if(typeof v==="object")return Object.entries(v).map(([k,x])=>k+": "+formatValue(x)).filter(Boolean).join("\n");
 return String(v).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function descriptionOf(p,label){
 const values=[
  ["Описание",translated(perkDescriptionMap,p,label)||p&&(p.descriptionRu||p.description_ru||p.description||p.desc||p.contentText||p.content_text||p.content||p.lore)],
  ["Эффект",p&&(p.effectDescription||p.effect_description||p.effect||p.effects||p.powerDescription||p.power_description||p.power)],
  ["Условия активации",p&&(p.conditions||p.requirements||p.activation||p.activationCondition||p.activation_condition)],
  ["Уровни перка",p&&(p.tiers||p.levels||p.rankDescriptions||p.rank_descriptions)],
  ["Дополнительная информация",p&&(p.details||p.notes||p.additionalInfo||p.additional_info)],
  ["Получение",p&&(p.obtain||p.obtainMethod||p.obtain_method||p.unlock||p.unlockMethod||p.unlock_method)]
 ];
 return values.map(([label,v])=>({label,text:formatValue(v)})).filter(x=>x.text);
}
function openDetail(label){
 const p=findPerk(label),owner=ownerFor(p,label),character=owner?findCharacter(owner):null;
 const perkIcon=p?fieldImage(p):"",portrait=character?fieldImage(character):"",title=perkName(p,label),ownerText=ownerDisplay(owner),sections=descriptionOf(p,label);
 const ownerSection=owner?'<section class="perk-detail-copy"><h3>Персонаж, которому принадлежит перк</h3><div class="perk-owner-card" data-perk-owner-open="'+esc(owner)+'" role="button" tabindex="0" aria-label="Открыть досье: '+esc(ownerText)+'">'+picture(portrait,{className:'perk-owner-art',alt:'',fallback:'./assets/ui/asset-fallback.webp',label:'✣'})+'<div><button type="button">'+esc(ownerText)+'</button><small>Нажми на имя или портрет, чтобы открыть досье персонажа</small></div></div></section>':'<section class="perk-detail-copy"><h3>Источник</h3><p>Общий перк — не закреплён за одним персонажем.</p></section>';
 const html='<section class="detail-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="eyebrow">DEAD BY DAYLIGHT • PERK</div><div class="perk-detail-head">'+picture(perkIcon,{className:'perk-detail-art',alt:'Иконка перка',eager:true,fallback:'./assets/ui/asset-fallback.webp',label:'✦'})+'<div><div class="detail-role">'+(owner?"УНИКАЛЬНЫЙ ПЕРК":"ОБЩИЙ ПЕРК")+'</div><h2>'+esc(title)+'</h2><small style="color:#999">'+esc(english(p)||label)+'</small></div></div>'+(sections.length?sections.map(s=>'<section class="perk-detail-copy"><h3>'+esc(s.label)+'</h3><p>'+esc(s.text)+'</p></section>').join(""):'<section class="perk-detail-copy"><h3>Описание</h3><p>Подробное игровое описание этого перка отсутствует в опубликованном каталоге. Название и владелец показаны по доступным данным; описание не подменяется выдуманным текстом.</p></section>')+ownerSection+'<section class="perk-detail-copy"><h3>Как открыть</h3><p>'+(owner?'Повышение персонажа до престижа I открывает его уникальные перки всем персонажам соответствующей роли на I уровне. Престиж II и III открывают следующие уровни. Также перк может появляться в Святилище тайн.':'Общий перк открывается через Кровавую паутину или может появляться в Святилище тайн — в зависимости от текущей системы разблокировок.')+'</p></section></section>';
 openModal("perkDetailModal",html);
}
function ownerMini(el){
 if(!el||el.dataset.perkOwnerReady==="1")return;
 const label=el.dataset.loadoutName||el.dataset.perkName||"",p=findPerk(label),owner=ownerFor(p,label);
 if(!owner){el.dataset.perkOwnerReady="1";return}
 const ch=findCharacter(owner),src=fieldImage(ch),ownerText=ownerDisplay(owner),chip=document.createElement("span");
 chip.className="perk-owner-mini";chip.dataset.perkOwnerOpen=owner;chip.setAttribute("role","button");chip.setAttribute("tabindex","0");
 chip.setAttribute("aria-label","Открыть досье: "+ownerText);
 chip.innerHTML=picture(src,{className:'perk-owner-mini-art',alt:'',fallback:'./assets/ui/asset-fallback.webp',label:'✣'})+'<span>'+esc(ownerText)+'</span>';
 const host=el.closest(".build-perk-info")||el.closest(".character-perk-card");
 if(host)host.appendChild(chip);else el.insertAdjacentElement("afterend",chip);
 el.dataset.perkOwnerReady="1";
}
function enhance(root){
 if(!root||!root.querySelectorAll)return;
 root.querySelectorAll('[data-loadout-type="perk"],[data-perk-name]').forEach(ownerMini);
}
function onClick(e){
 const target=e.target;
 const owner=target.closest("[data-perk-owner-open]");
 if(owner){e.preventDefault();e.stopImmediatePropagation();const ch=findCharacter(owner.dataset.perkOwnerOpen);if(ch&&typeof showDbdCharacter==="function")showDbdCharacter(ch);return;}
 if(target.closest("#perkDetailModal")||target.closest("[data-fav]"))return;
 let label="";
 const card=target.closest('#grid .item[data-item-detail]');
 if(card&&typeof tab!=="undefined"&&tab==="perks"){
  const item=arr(typeof all!=="undefined"?all:[]).find(x=>String(x.id||x._id||x.name||x.displayName)===card.dataset.itemDetail);
  label=item&&(item.nameEn||item.englishName||item.name_en||item.english_name||item.id||item.name||item.displayName)||"";
 }else{
  const direct=target.closest('[data-loadout-type="perk"],[data-perk-name]');
  if(direct)label=direct.dataset.loadoutName||direct.dataset.perkName||"";
  if(!label){const row=target.closest(".build-perk,.perk-chip,.tier-perk-wrap");const btn=row&&row.querySelector('[data-loadout-type="perk"],[data-perk-name]');if(btn)label=btn.dataset.loadoutName||btn.dataset.perkName||"";}
 }
 if(label){e.preventDefault();e.stopImmediatePropagation();const canonical=sharedEnglish(label,"perk")||label;loadCatalog().then(()=>openDetail(canonical));}
}
document.addEventListener("click",onClick,true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-perk-owner-open]")){e.preventDefault();const ch=findCharacter(e.target.dataset.perkOwnerOpen);if(ch&&typeof showDbdCharacter==="function")showDbdCharacter(ch);}},true);
if(typeof MutationObserver==="function"){const observer=new MutationObserver(()=>enhance(document.getElementById("grid")));const grid=document.getElementById("grid");if(grid)observer.observe(grid,{childList:true,subtree:true});}
loadCatalog().then(()=>{enhance(document);if(typeof ensureCharacterPortraits==="function")return ensureCharacterPortraits();}).then(()=>{enhance(document);if(typeof renderTierList==="function"&&typeof tab!=="undefined"&&tab==="tiers")renderTierList();});
window.__dbdOpenPerkDetail=label=>loadCatalog().then(()=>openDetail(label));
})();