const API='https://dbd-stats.info/api';
const SOURCE='https://dbd.source.gs/api';
const TYPES={
characters:{title:'Персонажи',label:'THE ROSTER',endpoint:'characters',source:SOURCE+'/characters/'},
perks:{title:'Перки',label:'TEACHABLES & ABILITIES',endpoint:'perks'},
items:{title:'Предметы',label:'SURVIVAL GEAR',endpoint:'items',source:SOURCE+'/items/'},
offerings:{title:'Подношения',label:'OFFERINGS',endpoint:'offerings'},
addons:{title:'Аддоны',label:'ADD-ONS',endpoint:'itemaddons'},
maps:{title:'Карты',label:'THE REALMS',endpoint:'maps'}
};
let tab='characters',all=[],filter='Все',favorites=[];
try{favorites=JSON.parse(localStorage.getItem('dbd-favorites')||'[]')}catch{}
const $=s=>document.querySelector(s);
const norm=x=>String(x??'').toLowerCase();
function arr(d){if(Array.isArray(d))return d;for(const k of ['data','results','items','characters','perks','maps','realms','killers','survivors','offerings','addons','itemAddons','item_addons','killerAddons','killer_addons','survivorAddons','survivor_addons','entries','list'])if(Array.isArray(d?.[k]))return d[k];if(d&&typeof d==='object'){const nested=Object.values(d).find(v=>Array.isArray(v));if(nested)return nested}return []}
function name(x){return x.displayName||x.name||x.display_name||x.title||x.killerName||x.id||'Без названия'}
function desc(x){return x.description||x.desc||x.effect||x.power||x.contentText||x.content||''}
function image(x){return x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.iconURL||x.perkIcon||x.perk_icon||x.iconPath||x.icon_path||x.portrait||x.portraitURL||''}
function category(x){return x.role||x.type||x.category||x.realm||x.faction||x.characterName||x.character||''}
function cosmetic(x){const v=norm([x.type,x.category,x.subcategory,x.kind,x.itemType,x.item_type,x.tags,x.name,x.displayName].join(' '));return /outfit|cosmetic|skin|wardrobe|charm|badge|banner|portrait|headwear|torso|legwear|customization|store outfit/.test(v)}
function usableGear(x){return !cosmetic(x)&&!x.isCosmetic&&!x.is_cosmetic&&!x.cosmetic}
function id(x){return String(x.id||x._id||x.name||name(x))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function translationKey(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'')}
function applyCatalogNames(records,catalog,kind){
 const maps=catalog?.translations||{},map=maps[kind]||{},descriptionMap=maps.descriptions?.[kind]||{};
 return records.map(item=>{
  const en=String(item.nameEn||item.name||item.display_name||item.title||'');
  const normalized=translationKey(en),shortName=translationKey(en.replace(/^the\\s+/i,''));
  const ru=map[normalized]||map[shortName]||Object.entries(map).find(([key])=>translationKey(key)===normalized||translationKey(key)===shortName)?.[1]||maps.perksById?.[String(item.id||'')];
  const ruDescription=descriptionMap[normalized]||descriptionMap[shortName]||'';
  const named=ru?{...item,nameEn:en,name:ru,displayName:ru+' ('+en+')'}:item;
  return ruDescription?{...named,description:ruDescription}:named;
 });
}

function updateFav(){$('#favCount').textContent=favorites.length;localStorage.setItem('dbd-favorites',JSON.stringify(favorites))}
async function getData(url){const r=await fetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
let catalogPromise;async function localCatalog(){if(!catalogPromise)catalogPromise=fetch('./catalog-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Локальный каталог ещё не опубликован');return r.json()});return catalogPromise}
async function load(){
 if(tab==='favorites'){render();return}
 $('#notice').textContent='Ищем записи в Тумане…';$('#grid').innerHTML='';
 const cfg=TYPES[tab];let lastError;
 if(['perks','offerings','maps','addons'].includes(tab)){
  let local=null;
  try{local=await localCatalog()}catch(e){lastError=e}
  const data=local?arr(local[tab]):[];
  if(data.length){
   all=applyCatalogNames(data,local,tab);
   $('#connection').textContent=tab==='addons'?'Улучшения загружены: '+all.length:'Локальная база загружена';
   $('#connection').classList.add('ok');
   try{render()}catch(e){console.error('DBD catalog render error:',tab,e);$('#notice').textContent='Данные загружены, но произошла ошибка отображения: '+(e?.message||'ошибка');}
   return;
  }
  if(tab==='addons')lastError=lastError||Error('Локальный каталог улучшений пуст. Публикация должна содержать не менее 500 записей.');
 }
 const sources=tab==='addons'?[]:[...(cfg.source?(Array.isArray(cfg.source)?cfg.source:[cfg.source]):[]),API+'/'+cfg.endpoint+'?branch=live',API+'/'+cfg.endpoint,API+'/'+cfg.endpoint+'/'];
 for(const url of sources){try{
  let data=arr(await getData(url));
  if(['items','characters','offerings'].includes(tab)){try{data=applyCatalogNames(data,await localCatalog(),tab)}catch(e){}}
  if(['items','addons','offerings'].includes(tab))data=data.filter(usableGear);
  if(!data.length)throw Error('Источник вернул пустой список');
  all=data;$('#connection').textContent=url.startsWith(SOURCE)?'Резервная база подключена':'База подключена';$('#connection').classList.add('ok');render();return;
 }catch(e){lastError=e}}
 if(tab==='addons'){
  try{
   const [chars,items]=await Promise.all([getData(SOURCE+'/characters/'),getData(SOURCE+'/items/')]);
   const nested=[...arr(chars),...arr(items)].flatMap(x=>x.addons||x.addOns||x.add_ons||x.itemAddons||x.item_addons||x.powerAddons||x.power_addons||[]);
   if(nested.length){all=nested.filter(usableGear);$('#connection').textContent='Резервная база подключена';$('#connection').classList.add('ok');render();return}
  }catch(e){lastError=e}
 }
 if(['perks','offerings','maps'].includes(tab)){try{const local=await localCatalog();const data=arr(local[tab]);if(data.length){all=applyCatalogNames(data,local,tab);$('#connection').textContent='Локальная база загружена';$('#connection').classList.add('ok');render();return}}catch(e){lastError=e}}
 all=[];$('#notice').textContent=tab==='addons'?'Не удалось открыть каталог улучшений. ('+(lastError?.message||'каталог не опубликован')+')':'Не удалось загрузить этот раздел. Источник данных временно недоступен. ('+(lastError?.message||'ошибка')+')';
 $('#connection').textContent='Нет соединения';$('#connection').classList.remove('ok');render();
}

