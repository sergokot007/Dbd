(function(){
"use strict";
const key=v=>String(v??"").toLowerCase().normalize("NFKD").replace(/[’']/g,"'").replace(/[^a-z0-9а-яё]/gi,"");
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
function findPerk(label){
 const k=key(label),fields=p=>[p.nameEn,p.englishName,p.name_en,p.english_name,p.slug,p.id,p.name,p.displayName,p.display_name,p.title].filter(Boolean);
 return perkRecords.find(p=>fields(p).some(v=>key(v)===k))||perkRecords.find(p=>fields(p).some(v=>key(v).length>5&&k.length>5&&(key(v).includes(k)||k.includes(key(v)))))||null;
}
function translated(map,p,label){
 const keys=[p&&p.id,p&&p.slug,p&&p.nameEn,p&&p.englishName,p&&p.name_en,p&&p.english_name,p&&p.name,p&&p.displayName,label].filter(Boolean).map(key);
 for(const [k,v] of Object.entries(map||{}))if(keys.includes(key(k))&&v)return typeof v==="string"?v:"";
 return "";
}
function ownerFor(p,label){
 if(!p)return "";
 const direct=p.characterName||p.character_name||p.owner||p.ownerName||p.owner_name||p.survivor||p.killer||p.character;
 if(typeof direct==="string"&&direct.trim())return direct.trim();
 if(direct&&typeof direct==="object")return direct.name||direct.displayName||"";
 const maps=window.__dbdPerkOwners||{},ids=[p.id,p.slug,p.nameEn,p.englishName,p.name_en,p.english_name,p.name,p.displayName,label].filter(Boolean).map(key);
 for(const [k,v] of Object.entries(maps))if(ids.includes(key(k))&&v)return typeof v==="string"?v:(v.name||v.displayName||"");
 for(const [k,v] of Object.entries(ownerFallback()))if(ids.includes(key(k))&&v)return v;
 return "";
}
function findCharacter(owner){
 const k=key(owner),pool=[...characters,...Object.values(window.__dbdCharacterCatalog||{}),...Object.values(typeof characterPortraits!=="undefined"?characterPortraits:{})];
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
 const ru=(p&&(p.nameRu||p.name_ru||p.russianName||p.russian_name))||translated(perkNameMap,p,label);
 if(ru&&/[А-Яа-яЁё]/.test(ru))return ru;
 const n=p&&(p.displayName||p.display_name||p.name);if(n&&/[А-Яа-яЁё]/.test(n))return String(n).replace(/\s*\([^)]*\)\s*$/,"");
 try{if(typeof buildPerkRussianName==="function")return buildPerkRussianName(p,label)}catch{}
 return label||english(p)||"Перк";
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
 const p=findPerk(label),owner=ownerFor(p,label),character=owner?findCharacter(owner):null,perkIcon=p?fieldImage(p):"",portrait=character?fieldImage(character):"",title=perkName(p,label),sections=descriptionOf(p,label);
 let modal=document.getElementById("perkDetailModal");
 if(!modal){modal=document.createElement("div");modal.id="perkDetailModal";modal.className="detail-overlay";document.body.appendChild(modal);}
 modal.innerHTML='<section class="detail-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="eyebrow">DEAD BY DAYLIGHT • PERK</div><div class="perk-detail-head">'+(perkIcon?'<img class="perk-detail-art" src="'+esc(perkIcon)+'" alt="Иконка перка" onerror="this.outerHTML=\'<div class=&quot;detail-placeholder&quot;>✦</div>\'">':'<div class="detail-placeholder">✦</div>')+'<div><div class="detail-role">'+(owner?"УНИКАЛЬНЫЙ ПЕРК":"ОБЩИЙ ПЕРК")+'</div><h2>'+esc(title)+'</h2><small style="color:#999">'+esc(english(p)||label)+'</small></div></div>'+(sections.length?sections.map(s=>'<section class="perk-detail-copy"><h3>'+esc(s.label)+'</h3><p>'+esc(s.text)+'</p></section>').join(""):'<section class="perk-detail-copy"><h3>Описание</h3><p>Подробное игровое описание этого перка отсутствует в опубликованном каталоге. Название и владелец показаны по доступным данным; описание не подменяется выдуманным текстом.</p></section>')+(owner?'<section class="perk-detail-copy"><h3>Персонаж, которому принадлежит перк</h3><div class="perk-owner-card">'+(portrait?'<img src="'+esc(portrait)+'" alt="" onerror="this.style.display=\'none\'">':'<div class="tier-portrait-fallback">✣</div>')+'<div><button type="button" data-perk-owner-open="'+esc(owner)+'">'+esc(owner)+'</button><small>Нажми на имя или портрет, чтобы открыть досье персонажа</small></div></div></section>':'<section class="perk-detail-copy"><h3>Источник</h3><p>Общий перк — не закреплён за одним персонажем.</p></section>')+'<section class="perk-detail-copy"><h3>Как открыть</h3><p>'+(owner?'Повышение персонажа до престижа I открывает его уникальные перки всем персонажам соответствующей роли на I уровне. Престиж II и III открывают следующие уровни. Также перк может появляться в Святилище тайн.':'Общий перк открывается через Кровавую паутину или может появляться в Святилище тайн — в зависимости от текущей системы разблокировок.')+'</p></section></section>';
 modal.classList.add("open");document.body.classList.add("modal-open");
}
function ownerMini(el){
 if(!el||el.dataset.perkOwnerReady==="1")return;
 const label=el.dataset.loadoutName||el.dataset.perkName||"",p=findPerk(label),owner=ownerFor(p,label);if(!owner)return;
 const ch=findCharacter(owner),src=fieldImage(ch),chip=document.createElement("span");
 chip.className="perk-owner-mini";chip.dataset.perkOwnerOpen=owner;chip.setAttribute("role","button");chip.setAttribute("tabindex","0");
 chip.innerHTML=(src?'<img src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'<span class="tier-portrait-fallback" style="width:25px;height:25px;flex:0 0 25px">✣</span>')+'<span>'+esc(owner)+'</span>';
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
 if(target.closest("#perkDetailModal .detail-close")||target.id==="perkDetailModal"){const m=document.getElementById("perkDetailModal");if(m)m.classList.remove("open");document.body.classList.remove("modal-open");return;}
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
 if(label){e.preventDefault();e.stopImmediatePropagation();loadCatalog().then(()=>openDetail(label));}
}
document.addEventListener("click",onClick,true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-perk-owner-open]")){e.preventDefault();const ch=findCharacter(e.target.dataset.perkOwnerOpen);if(ch&&typeof showDbdCharacter==="function")showDbdCharacter(ch);}},true);
if(typeof MutationObserver==="function"){const observer=new MutationObserver(()=>enhance(document.getElementById("grid")));const grid=document.getElementById("grid");if(grid)observer.observe(grid,{childList:true,subtree:true});}
loadCatalog().then(()=>{enhance(document);if(typeof ensureCharacterPortraits==="function")return ensureCharacterPortraits();}).then(()=>{enhance(document);if(typeof renderTierList==="function"&&typeof tab!=="undefined"&&tab==="tiers")renderTierList();});
window.__dbdOpenPerkDetail=label=>loadCatalog().then(()=>openDetail(label));
})();