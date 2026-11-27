const SOURCE='https://dbd.source.gs/api';
const TYPES={
 characters:{title:'Персонажи',label:'THE ROSTER',endpoint:'characters',source:SOURCE+'/characters/'},
 perks:{title:'Перки',label:'TEACHABLES & ABILITIES',endpoint:'perks'},
 items:{title:'Предметы',label:'SURVIVAL GEAR',endpoint:'items',source:SOURCE+'/items/'},
 offerings:{title:'Подношения',label:'OFFERINGS',endpoint:'offerings'},
 addons:{title:'Аддоны',label:'ADD-ONS',endpoint:'itemaddons'},
 maps:{title:'Карты',label:'REALM ATLAS',endpoint:'maps'}
};
const ALL_TABS=[...Object.keys(TYPES),'builds','mybuilds','tiers','favorites'];
function tabFromHash(){const value=decodeURIComponent(location.hash.replace(/^#/,'')).trim();return ALL_TABS.includes(value)?value:'characters'}
let tab=tabFromHash(),all=[],filter='Все',favorites=[];
window.__dbdCurrentTab=tab;
try{
 const saved=JSON.parse(localStorage.getItem('dbd-favorites')||'[]');
 favorites=(Array.isArray(saved)?saved:[]).filter(x=>x&&x.data).map(x=>({...x,key:x.key||favKey(x.sourceTab||'catalog',x.data),sourceTab:x.sourceTab||x.source||'catalog'}));
}catch{}
const $=selector=>document.querySelector(selector);
const norm=value=>String(value??'').toLocaleLowerCase('ru');
function sharedName(value,kind){return typeof window.dbdDisplayName==='function'?window.dbdDisplayName(value,kind):''}
function sharedEnglish(value,kind){return typeof window.dbdRecordEnglish==='function'?window.dbdRecordEnglish(value,kind):''}
function formattedSharedName(value,kind){const text=sharedName(value,kind);return /[А-Яа-яЁё][^()]*\([^)]*[A-Za-z][^)]*\)/.test(text)?text:''}
function ownerDisplayName(value){return value?(sharedName(value,'character')||String(value)):''}
function arr(data){if(Array.isArray(data))return data;for(const key of ['data','results','items','characters','perks','maps','realms','killers','survivors','offerings','addons','itemAddons','item_addons','killerAddons','killer_addons','survivorAddons','survivor_addons','entries','list'])if(Array.isArray(data?.[key]))return data[key];if(data&&typeof data==='object'){const nested=Object.values(data).find(value=>Array.isArray(value));if(nested)return nested}return []}
function name(item){
 if(!item||typeof item!=='object')return sharedName(item,'')||String(item??'Без названия');
 const kind=item.__sourceTab||item.sourceTab||(typeof tab!=='undefined'?tab:'');
 return sharedName(item,kind)||item.displayName||item.name||item.display_name||item.title||item.killerName||item.id||'Без названия';
}
function safeText(value){
 let text=String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 if(!text)return '';
 if((text.match(/,/g)||[]).length>18&&/(?:survivor|killer|chapter|character|roster|персонаж|глава)/i.test(text))return '';
 if(/(?:[A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z’'\-]+){1,4},\s*){6,}/.test(text))return '';
 if(text.length>1400)text=text.slice(0,1400).replace(/\s+\S*$/,'')+'…';
 return text;
}
function desc(item){return safeText(item.description||item.desc||item.effect||item.power||item.contentText||item.content||item.lore||'')}
function safeUrl(value,protocols){
 const text=String(value??'').trim();if(!text)return '';
 if(protocols==='image'&&/^data:image\//i.test(text))return text;
 try{const parsed=new URL(text,location.href);if(parsed.protocol==='http:'||parsed.protocol==='https:')return text;}catch{}
 return '';
}
function safeImageUrl(value){return safeUrl(value,'image')}
function imageValue(value){
 if(!value)return '';
 if(typeof value==='string')return safeImageUrl(value);
 if(Array.isArray(value))return imageValue(value[0]);
 if(typeof value==='object')return safeImageUrl(value.url||value.src||value.href||value.image||'');
 return '';
}
function image(item){
 const fields=['image','imageUrl','image_url','icon','iconUrl','icon_url','iconURL','perkIcon','perk_icon','perkIconUrl','perk_icon_url','iconPath','icon_path','iconFile','icon_file','portrait','portraitURL','portraitUrl','imageFull','sourceImage','imagePath','image_path'];
 for(const field of fields){const url=imageValue(item?.[field]);if(url)return url}
 const nested=item?.assets||item?.media||item?.images||{};
 for(const field of ['icon','perk','portrait','image','url','full']){const url=imageValue(nested?.[field]);if(url)return url}
 return '';
}
function category(item){return item.role||item.type||item.category||item.realm||item.faction||item.characterName||item.character||''}
function cosmetic(item){const value=norm([item.type,item.category,item.subcategory,item.kind,item.itemType,item.item_type,item.tags,item.name,item.displayName].join(' '));return /outfit|cosmetic|skin|wardrobe|charm|badge|banner|portrait|headwear|torso|legwear|customization|store outfit/.test(value)}
function usableGear(item){return !cosmetic(item)&&!item.isCosmetic&&!item.is_cosmetic&&!item.cosmetic}
function id(item){return String(item.id||item._id||item.name||name(item))}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function favKey(sourceTab,item){return String(sourceTab||'catalog')+':'+id(item)}
function cleanFavoriteData(item){if(!item||typeof item!=='object')return item;const copy={...item};delete copy.__favKey;delete copy.__sourceTab;return copy}
function favoriteRecords(){return favorites.filter(entry=>entry&&entry.data).map(entry=>({...entry.data,__favKey:entry.key,__sourceTab:entry.sourceTab||'catalog'}))}
function currentRecords(){return tab==='favorites'?favoriteRecords():all}
function recordKey(item){return item?.__favKey||favKey(item?.__sourceTab||tab,item)}
function findRecordByKey(key){
 const records=currentRecords();
 return records.find(item=>recordKey(item)===key)||records.find(item=>id(item)===key)||favorites.find(entry=>entry.key===key)?.data||all.find(item=>id(item)===key)||null;
}
function setGridLayout(className){const grid=$('#grid');if(grid)grid.className='grid'+(className?' '+className:'')}
window.setGridLayout=setGridLayout;
function fallbackArt(sourceTab){return sourceTab==='maps'?'./assets/ui/map-fallback.webp':'./assets/ui/asset-fallback.webp'}
function artTag(src,options){return typeof picture==='function'?picture(src,options):(safeImageUrl(src)?'<img loading="lazy" src="'+esc(src)+'" alt="'+esc(options?.alt||'')+'">':'<span class="picture-fallback">✣</span>')}
function safeLink(value){return safeUrl(value)}

function translationKey(value){return String(value||'').toLocaleLowerCase('ru').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,'')}
function applyCatalogNames(records,catalog,kind){
 const translations=catalog?.translations||{},map=translations[kind]||{},descriptionMap=translations.descriptions?.[kind]||{};
 return records.map(item=>{
  const en=String(item.nameEn||item.englishName||item.name_en||item.english_name||item.name||item.title||'');
  const normalized=translationKey(en),shortName=translationKey(en.replace(/^the\s+/i,''));
  const catalogRu=map[normalized]||map[shortName]||Object.entries(map).find(([key])=>translationKey(key)===normalized||translationKey(key)===shortName)?.[1]||translations.perksById?.[String(item.id||'')];
  const info=typeof window.dbdNameInfo==='function'?(window.dbdNameInfo(en,kind)||window.dbdNameInfo(item,kind)):null;
  const english=info?.en||en,russian=info?.ru||catalogRu;
  const display=formattedSharedName(english,kind)||(russian?russian+' ('+english+')':formattedSharedName(item,kind))||item.displayName||item.name;
  const named={...item,nameEn:english,name:russian||item.name||english,displayName:display};
  const ruDescription=safeText(descriptionMap[normalized]||descriptionMap[shortName]||'');
  return ruDescription?{...named,description:ruDescription}:named;
 });
}
function updateFav(){const counter=$('#favCount');if(counter)counter.textContent=favorites.length;try{localStorage.setItem('dbd-favorites',JSON.stringify(favorites))}catch{}}
async function getData(url){const response=await fetch(url,{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('HTTP '+response.status);return response.json()}
let catalogPromise;
function fallbackCatalog(){
 const catalog={...(window.DBD_FALLBACK_CATALOG||{})};
 if((!Array.isArray(catalog.maps)||!catalog.maps.length)&&Array.isArray(window.DBD_FALLBACK_MAPS))catalog.maps=window.DBD_FALLBACK_MAPS.slice();
 catalog.translations={...(catalog.translations||{})};
 return catalog;
}
async function localCatalog(){
 if(!catalogPromise)catalogPromise=(async()=>{
  const fallback=fallbackCatalog();
  for(const url of ['./catalog-data.json','./catalog-fallback.json']){
   try{
    const response=await fetch(url,{cache:'no-store',credentials:'omit'});
    if(!response.ok)continue;
    const data=await response.json();
    if(!Array.isArray(data.maps)||!data.maps.length)data.maps=fallback.maps||[];
    return {...fallback,...data,translations:{...fallback.translations,...(data.translations||{})}};
   }catch{}
  }
  if(Object.values(fallback).some(Array.isArray))return fallback;
  throw Error('Локальный каталог недоступен');
 })().catch(error=>{catalogPromise=null;throw error});
 return catalogPromise;
}
async function load(){
 if(tab==='favorites'){render();return}
 const cfg=TYPES[tab];if(!cfg){render();return}
 $('#notice').textContent='Ищем записи в Тумане…';$('#grid').innerHTML='';
 let lastError;
 if(['perks','offerings','maps','addons','items'].includes(tab)){
  let local=null;
  try{local=await localCatalog()}catch(error){lastError=error}
  const data=local?arr(local[tab]):[];
  if(data.length){
   all=applyCatalogNames(data,local,tab);
   $('#connection').textContent=tab==='maps'?'Атлас карт готов':(local.fallback?'Локальный мини-каталог':(tab==='addons'?'Улучшения загружены: '+all.length:'Локальная база загружена'));
   $('#connection').classList.add('ok');
   try{render()}catch(error){console.error('DBD catalog render error:',tab,error);$('#notice').textContent='Данные загружены, но произошла ошибка отображения: '+(error?.message||'ошибка')}
   return;
  }
  if(tab==='addons')lastError=lastError||Error('Локальный каталог улучшений пуст');
 }
 const sources=tab==='addons'?[]:Array.isArray(cfg.source)?cfg.source:(cfg.source?[cfg.source]:[]);
 for(const url of sources){
  try{
   let data=arr(await getData(url));
   if(['items','characters','offerings','perks','maps'].includes(tab)){try{data=applyCatalogNames(data,await localCatalog(),tab)}catch{}}
   if(['items','addons','offerings'].includes(tab))data=data.filter(usableGear);
   if(!data.length)throw Error('Источник вернул пустой список');
   all=data;
   $('#connection').textContent=url.startsWith(SOURCE)?'База dbd.source.gs подключена':'База подключена';$('#connection').classList.add('ok');render();return;
  }catch(error){lastError=error}
 }
 if(tab==='addons'){
  try{
   const [characters,items]=await Promise.all([getData(SOURCE+'/characters/'),getData(SOURCE+'/items/')]);
   const nested=[...arr(characters),...arr(items)].flatMap(x=>x.addons||x.addOns||x.add_ons||x.itemAddons||x.item_addons||x.powerAddons||x.power_addons||[]);
   if(nested.length){all=nested.filter(usableGear);$('#connection').textContent='Резервная база подключена';$('#connection').classList.add('ok');render();return}
  }catch(error){lastError=error}
 }
 // A small bundled catalog is always available, even on a fresh checkout with
 // no generated catalog-data.json and no network access.
 try{
  const local=await localCatalog(),data=arr(local[tab]);
  if(data.length){all=applyCatalogNames(data,local,tab);$('#connection').textContent=tab==='maps'?'Атлас карт готов':'Локальный мини-каталог';$('#connection').classList.add('ok');render();return}
 }catch(error){lastError=error}
 all=[];
 $('#notice').textContent='Не удалось загрузить этот раздел. Источник данных временно недоступен. ('+(lastError?.message||'ошибка')+')';
 $('#connection').textContent='Нет соединения';$('#connection').classList.remove('ok');render();
}


const UNIVERSAL_BUILDS = [
{id:"genrush",title:"Генераторный раш",tag:"GEN RUSH",desc:"Быстрый ремонт: поиск генераторов и ускорение совместной починки.",perks:["Déjà Vu","Prove Thyself","Stake Out","Hyperfocus"]},
{id:"chase",title:"Побег от убийцы",tag:"CHASE",desc:"Для долгих погонь: информация о петлях, быстрые переходы и дополнительное время.",perks:["Windows of Opportunity","Lithe","Resilience","Off the Record"]},
{id:"stealth",title:"Скрытность",tag:"STEALTH",desc:"Меньше шума и следов, проще скрыться и не выдать своё местоположение.",perks:["Distortion","Lightweight","Calm Spirit","Urban Evasion"]},
{id:"healing",title:"Лечение и отхил",tag:"HEALING",desc:"Поиск раненых союзников, ускоренное лечение и возможность лечить себя.",perks:["Botany Knowledge","We'll Make It","Empathy","Self-Care"]},
{id:"support",title:"Поддержка команды",tag:"TEAM SUPPORT",desc:"Безопасные спасения с крюка и помощь союзникам после спасения.",perks:["Kindred","We'll Make It","Borrowed Time","We're Gonna Live Forever"]},
{id:"solo",title:"Универсальный соло-билд",tag:"SOLO QUEUE",desc:"Сборка для игры без связи: информация, генераторы и надёжный инструмент для погони.",perks:["Windows of Opportunity","Déjà Vu","Bond","Lithe"]},
{id:"escape",title:"Выживание любой ценой",tag:"LAST SURVIVOR",desc:"Больше шансов пережить опасную ситуацию, скрыться после удара и дотянуть до выхода.",perks:["Adrenaline","Decisive Strike","Off the Record","Unbreakable"]}
];
let allPerks = [];
const BUILD_PERK_RU={
 "Déjà Vu":"Дежавю","Prove Thyself":"Докажи свою состоятельность","Stake Out":"Наблюдение","Hyperfocus":"Гиперфокус",
 "Windows of Opportunity":"Окна возможностей","Lithe":"Гибкость","Resilience":"Стремление","Off the Record":"Не под запись",
 "Distortion":"Искажение","Lightweight":"Лёгкий шаг","Calm Spirit":"Спокойный дух","Urban Evasion":"Городское уклонение",
 "Botany Knowledge":"Ботанические знания","We'll Make It":"Мы справимся","Empathy":"Эмпатия","Self-Care":"Самолечение",
 "Kindred":"Родственные души","Borrowed Time":"Заёмное время","We're Gonna Live Forever":"Мы будем жить вечно",
 "Bond":"Связь","Adrenaline":"Адреналин","Decisive Strike":"Решающий удар","Unbreakable":"Несломленный",
 "Sprint Burst":"Спринтерский рывок","Quick & Quiet":"Бесшумность","Iron Will":"Железная воля","Lucky Break":"Счастливый случай",
 "Finesse":"Ловкость","Built to Last":"Долговечность","Resurgence":"Возрождение","Reassurance":"Уверенность",
 "Aftercare":"Забота","Deliverance":"Избавление","Flashbang":"Светошумовая граната","Plot Twist":"Неожиданный поворот",
 "Alert":"Бдительность","Technician":"Техник","Dead Hard":"Жёсткий удар","Boil Over":"Волна",
 "Better Than New":"Лучше прежнего","Blast Mine":"Мина-ловушка","Background Player":"Игрок поддержки",
 "Made for This":"Рождён для этого","Troubleshooter":"Устранение неполадок","Open-Handed":"Открытая ладонь",
 "Ace in the Hole":"Туз в рукаве","Wake Up!":"Проснись!","Pharmacy":"Аптека","Vigil":"Бдительность",
 "A Nurse's Calling":"Зов медсестры","Thanatophobia":"Танатофобия","Stridor":"Пронзительный крик",
 "Hex: Undying":"Проклятие: Бессмертие","Dragon's Grip":"Драконья хватка","Hex: Blood Favor":"Проклятие: Кровавая милость",
 "Scourge Hook: Pain Resonance":"Крюк-мучитель: Резонанс боли","Grim Embrace":"Мрачные объятия",
 "Hex: Pentimento":"Проклятие: Пентименто","Corrupt Intervention":"Порченое вмешательство",
 "Infectious Fright":"Заразительный ужас","Dark Devotion":"Тёмная преданность","Pop Goes the Weasel":"Чертик из табакерки",
 "Bamboozle":"Обман","Coulrophobia":"Кулрофобия","Deadlock":"Мёртвая хватка","Hex: Plaything":"Проклятие: Игрушка",
 "Gift of Pain":"Дар боли","Lethal Pursuer":"Смертельный преследователь","Eruption":"Извержение","Hysteria":"Истерия",
 "Nowhere to Hide":"Негде спрятаться","Hubris":"Высокомерие","Face the Darkness":"Лицом к тьме",
 "Barbecue & Chilli":"Барбекю и чили","Franklin's Demise":"Гибель Франклина","Knock Out":"Нокаут",
 "Spirit Fury":"Ярость духа","Haunted Ground":"Зачарованная земля","Rancor":"Злоба","I'm All Ears":"Я весь внимание",
 "Thrilling Tremors":"Волнующая дрожь","Furtive Chase":"Скрытная погоня","No Way Out":"Выхода нет",
 "Starstruck":"Поражённый звездой","Crowd Control":"Контроль толпы","Predator":"Хищник","Bloodhound":"Ищейка",
 "Shadowborn":"Рождённый во тьме","Monitor & Abuse":"Наблюдение и жестокость",
 "Overwhelming Presence":"Подавляющее присутствие","Overcharge":"Перегрузка","Discordance":"Разлад",
 "Mad Grit":"Безумная хватка","Iron Maiden":"Железная дева","Save the Best for Last":"Приберечь лучшее напоследок",
 "Play with Your Food":"Игра с едой","Dying Light":"Угасающий свет","Agitation":"Возбуждение",
 "Unnerving Presence":"Тревожное присутствие","Brutal Strength":"Жестокая сила","Fire Up":"Разгорается",
 "Remember Me":"Помни меня","Blood Warden":"Страж крови"
};
function buildPerkKey(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function buildPerk(wanted) {
 const key=buildPerkKey(wanted);
 if(!key)return null;
 const records=Array.isArray(allPerks)?allPerks:[];
 const fields=p=>[p.nameEn,p.englishName,p.name_en,p.english_name,p.slug,p.id,p.name,p.displayName,p.display_name];
 return records.find(p=>fields(p).some(v=>buildPerkKey(v)===key))||
  records.find(p=>fields(p).some(v=>{const k=buildPerkKey(v);return k.length>5&&key.length>5&&(k.includes(key)||key.includes(k))}))||null;
}
function buildPerkRussianName(p,wanted){
 const label=String(wanted||p?.nameEn||p?.englishName||p?.name_en||p?.id||p?.name||"");
 const formatted=sharedName(label,'perk');
 if(formatted&&formatted!==label)return formatted;
 const info=typeof window.dbdNameInfo==='function'?(window.dbdNameInfo(p,'perk')||window.dbdNameInfo(label,'perk')):null;
 if(info?.display)return info.display;
 let ru="";
 for(const value of [p?.nameRu,p?.name_ru,p?.russianName,p?.russian_name,p?.translation,p?.name]){
  const text=String(value||"").trim();
  if(/[А-Яа-яЁё]/.test(text)){ru=text.replace(/\s*\([^)]*\)\s*$/,"").trim();break}
 }
 const display=String(p?.displayName||p?.display_name||"");
 const prefix=display.split(/\s*\([^)]*\)\s*$/)[0];
 if(!ru&&/[А-Яа-яЁё]/.test(prefix))ru=prefix.trim();
 const english=sharedEnglish(p,'perk')||label;
 if(ru&&english&&ru!==english)return ru+' ('+english+')';
 const curated=BUILD_PERK_RU[wanted];
 return curated?curated+' ('+wanted+')':(formatted||label||"Перк");
}
function buildPerkOwner(p) { return String(p?.characterName||p?.character_name||p?.character||p?.owner||p?.survivor||p?.killer||""); }
const LICENSED_PERK_OWNERS = ["Laurie Strode","Quentin Smith","Detective Tapp","Ash Williams","Nancy Wheeler","Steve Harrington","Cheryl Mason","Jill Valentine","Leon Kennedy","Rebecca Chambers","Ada Wong","Ellen Ripley","Pinhead","Alan Wake","Lara Croft"];
const LICENSED_PERK_NAMES = ["Decisive Strike","Hyperfocus","Chemical Trap","Background Player","Troubleshooter","Champion of Light","Moment of Glory","Invocation: Treacherous Crows"];
function buildPerkIsPaid(p) {
 const owner=buildPerkOwner(p).toLowerCase();
 const perkEnglish=sharedEnglish(p,'perk')||p.nameEn||p.englishName||p.name_en||p.id||p.name||'';
 return !!(p.isLicensed||p.is_licensed||p.licensed||p.dlc||p.isDlc||p.is_dlc||LICENSED_PERK_OWNERS.some(n=>owner.includes(n.toLowerCase()))||LICENSED_PERK_NAMES.some(n=>norm(perkEnglish)===norm(n)));
}
async function loadBuilds(){
 try{
  const catalog=await localCatalog();allPerks=arr(catalog.perks);
 }catch(error){
  allPerks=[];
 }
 renderBuilds();
 if(!allPerks.length&&tab==='builds')$('#notice').textContent='Локальный мини-каталог: иконки появятся после публикации полной базы.';
}
function renderBuilds() {
 setGridLayout('build-grid');
 const q=norm($('#search').value.trim());
 const groups=UNIVERSAL_BUILDS.filter(b=>norm(b.title+' '+b.tag+' '+b.desc+' '+b.perks.join(' ')).includes(q));
 $('#sectionTitle').textContent='Готовые билды';
 $('#sectionLabel').textContent='UNIVERSAL SURVIVOR BUILDS';
 $('#filters').innerHTML='<span class="builds-hint">Выбери стиль игры — в каждой сборке четыре перка</span>';
 $('#notice').textContent='Подборки для выжившего • '+groups.length+' сборок';
 $('#grid').innerHTML=groups.map(b=>{
  const perks=b.perks.map(wanted=>{
   const p=buildPerk(wanted),src=p?image(p):'',perkTitle=buildPerkRussianName(p,wanted),ownerLabel=p?(ownerDisplayName(buildPerkOwner(p))||'Игровой перк'):'Перк не найден в базе';
   const icon=artTag(src,{className:'build-perk-icon',alt:'',fallback:'./assets/ui/asset-fallback.webp',label:'✦'});
   return '<div class="build-perk"><div class="build-perk-icon">'+icon+'</div><div class="build-perk-info"><b><button type="button" class="build-perk-link" data-loadout-type="perk" data-loadout-name="'+esc(p?(p.nameEn||p.englishName||p.name_en||p.english_name||p.id||wanted):wanted)+'">'+esc(perkTitle)+'</button></b><small>'+esc(ownerLabel)+'</small></div>'+(p&&buildPerkIsPaid(p)?'<span class="auric-cell" title="Платный персонаж / лицензированный контент">◈</span>':'')+'</div>';
  }).join('');
  return '<article class="build-card"><div class="build-head"><span class="build-tag">'+esc(b.tag)+'</span><h3>'+esc(b.title)+'</h3><p>'+esc(b.desc)+'</p></div><div class="build-perks">'+perks+'</div><div class="build-foot"><span>4 ПЕРКА • ВЫЖИВШИЙ</span><button class="build-copy" data-copy-build="'+b.id+'">Скопировать названия</button></div></article>';
 }).join('') || '<div class="empty">По этому запросу сборок не найдено.</div>';
}
function render(){
 if(tab==='maps'&&typeof window.renderMaps==='function'){window.renderMaps();return}
 if(tab==='mybuilds'&&typeof renderMyBuilds==='function'){renderMyBuilds();return}
 if(tab==='builds'){renderBuilds();return}
 if(tab==='tiers'&&typeof renderTierList==='function'){renderTierList();return}
 setGridLayout('');
 const cfg=TYPES[tab]||{title:'Избранное',label:'YOUR COLLECTION'};
 $('#sectionTitle').textContent=tab==='favorites'?'Избранное':cfg.title;
 $('#sectionLabel').textContent=tab==='favorites'?'YOUR COLLECTION':cfg.label;
 const data=currentRecords(),q=norm($('#search').value.trim()),cats=['Все',...new Set(data.filter(usableGear).map(category).filter(Boolean))].slice(0,16);
 if(!cats.includes(filter))filter='Все';
 $('#filters').innerHTML=cats.length>2?cats.map(c=>'<button class="'+(filter===c?'active':'')+'" data-filter="'+esc(c)+'">'+esc(c)+'</button>').join(''):'';
 const shown=data.filter(x=>(filter==='Все'||category(x)===filter||norm(category(x)).includes(norm(filter)))&&(!q||norm([name(x),x.nameEn,x.englishName,desc(x),category(x),x.realm].join(' ')).includes(q)));
 $('#notice').textContent=shown.length?'Найдено: '+shown.length+(tab==='items'?' • скины и косметика исключены':''):'Ничего не найдено';
 $('#grid').innerHTML=shown.map(x=>{
  const key=recordKey(x),src=image(x),saved=favorites.some(f=>f&&f.key===key),sourceTab=x.__sourceTab||tab;
  const art=artTag(src,{className:'item-art-img',alt:'',fallback:fallbackArt(sourceTab),label:sourceTab==='characters'?'◈':'✣'});
  const perkLink=sourceTab==='perks'||tab==='perks';
  const title=perkLink?'<button class="catalog-perk-link" type="button" data-loadout-type="perk" data-loadout-name="'+esc(sharedEnglish(x,'perk')||x.nameEn||x.englishName||x.name_en||x.id||name(x))+'">'+esc(name(x))+'</button>':'<button class="item-name-link" type="button" data-item-detail="'+esc(key)+'">'+esc(name(x))+'</button>';
  return '<article class="item'+(sourceTab==='characters'?' character-card':'')+'" data-item-detail="'+esc(key)+'" data-source-tab="'+esc(sourceTab)+'" tabindex="0"><button class="art item-art-button" type="button" data-item-detail="'+esc(key)+'" aria-label="Подробнее: '+esc(name(x))+'">'+art+'</button><div class="itembody"><div class="kind">'+esc(category(x)||cfg.title||'DBD')+'</div><h3>'+title+'</h3><div class="cardbottom"><small>'+esc(x.realm||ownerDisplayName(x.characterName||x.character||x.owner)||x.nameEn||'DEAD BY DAYLIGHT')+'</small><button class="fav '+(saved?'saved':'')+'" data-fav="'+esc(key)+'" aria-pressed="'+(saved?'true':'false')+'" aria-label="'+(saved?'Убрать из избранного':'Добавить в избранное')+'">'+(saved?'♥':'♡')+'</button></div><button class="item-more" type="button" data-item-detail="'+esc(key)+'">Открыть описание и эффект ↗</button></div></article>';
 }).join('')||'<div class="empty">В этой части Тумана пока пусто.</div>';
 document.querySelectorAll('.item[data-item-detail]').forEach(card=>card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click()}}));
}
function detailValue(v){
 if(v===null||v===undefined||v==='')return '';
 if(Array.isArray(v))return safeText(v.map(detailValue).filter(Boolean).join(' • '));
 if(typeof v==='object')return safeText(Object.entries(v).map(([k,val])=>k+': '+detailValue(val)).filter(Boolean).join(' • '));
 return safeText(v);
}
function detailMarkup(item){
 const sourceTab=item.__sourceTab||tab,title=name(item),english=sharedEnglish(item,sourceTab)||item.nameEn||item.englishName||item.name_en||item.display_name_en||'',imageUrl=image(item);
 const englishLine=english&&!title.includes('('+english+')')?'<p class="item-detail-en">'+esc(english)+'</p>':'';
 const description=safeText(item.descriptionRu||item.description_ru||item.description||item.desc||item.contentText||item.content||item.lore||'');
 const effect=item.effectDescription||item.effect_description||item.effect||item.effects||item.powerDescription||item.power_description||item.bonus||'';
 const sections=[
  ['Игровой эффект',effect],
  ['Дополнительное описание',item.detailedDescription||item.detailed_description||item.longDescription||item.long_description||item.gameDescription||item.game_description],
  ['Заряды и использование',item.charges||item.chargeCount||item.charge_count||item.uses||item.maxUses||item.max_uses],
  ['Длительность',item.duration||item.effectDuration||item.effect_duration],
  ['Дальность действия',item.range||item.radius||item.distance],
  ['Скорость и бонусы',item.speedBonus||item.speed_bonus||item.bonusDescription||item.bonus_description],
  ['Ограничения и условия',item.conditions||item.requirements||item.restrictions||item.limitations],
  ['Штрафы и недостатки',item.penalty||item.penalties||item.drawback||item.drawbacks]
 ].map(([label,value])=>({label,value:detailValue(value)})).filter(x=>x.value);
 const fields=[
  ['Категория',item.type||item.category||item.itemType||item.item_type],
  ['Редкость',item.rarity||item.quality],
  ['Персонаж / владелец',ownerDisplayName(item.characterName||item.character_name||item.owner||item.character)],
  ['Стоимость',item.price||item.cost],
  ['Источник',item.source||item.unlock||item.obtain||item.acquisition]
 ].map(([label,value])=>({label,value:detailValue(value)})).filter(x=>x.value);
 const descriptionText=description||'Подробное описание для этого объекта пока отсутствует в доступной базе. Не буду придумывать игровые эффекты.';
 const source=safeLink(item.sourceUrl||item.source_url||item.wiki||item.url||'');
 const icon=artTag(imageUrl,{className:'item-detail-icon',alt:'',fallback:fallbackArt(sourceTab),eager:true,label:'✣'});
 return '<section class="detail-panel item-detail-panel item-detail-readable"><button class="detail-close" aria-label="Закрыть">×</button><div class="eyebrow">СПРАВОЧНИК DEAD BY DAYLIGHT</div><div class="item-detail-head">'+icon+'<div><h2>'+esc(title)+'</h2>'+englishLine+'<span class="item-detail-kind">'+esc(category(item)||sourceTab)+'</span></div></div><section class="item-detail-section"><h3>Что это и что делает</h3><p class="item-detail-description">'+esc(descriptionText)+'</p></section>'+(sections.length?'<section class="item-detail-section"><h3>Подробности игрового эффекта</h3>'+sections.map(x=>'<div class="item-detail-field"><b>'+esc(x.label)+'</b><span>'+esc(x.value)+'</span></div>').join('')+'</section>':'')+(fields.length?'<section class="item-detail-section"><h3>Характеристики и получение</h3>'+fields.map(x=>'<div class="item-detail-field"><b>'+esc(x.label)+'</b><span>'+esc(x.value)+'</span></div>').join('')+'</section>':'')+(source?'<a class="item-detail-source" href="'+esc(source)+'" target="_blank" rel="noopener">Открыть источник информации ↗</a>':'')+'<p class="item-detail-note">Показываются только сведения, которые действительно есть в базе игры или справочника. Если у объекта не хватает подробностей, это отмечено отдельно.</p></section>';
}
function openItemDetail(item){openModal('itemDetailModal',detailMarkup(item))}
function openDetail(item){
 if(!item)return;
 const sourceTab=item.__sourceTab||tab;
 if(sourceTab==='maps'&&typeof window.openMapDetail==='function'){window.openMapDetail(window.mapRecordKey?window.mapRecordKey(item):String(item.mapKey||item.id||''));return}
 if(sourceTab==='characters'&&typeof showDbdCharacter==='function'){showDbdCharacter(item);return}
 if(sourceTab==='perks'&&typeof window.__dbdOpenPerkDetail==='function'){window.__dbdOpenPerkDetail(sharedEnglish(item,'perk')||item.nameEn||item.englishName||item.name_en||item.id||name(item));return}
 openItemDetail(item);
}
window.openDetail=openDetail;
function switchTab(value,options){
 const next=ALL_TABS.includes(value)?value:'characters';
 const opts=options||{};
 if(typeof closeAllModals==='function')closeAllModals();
 tab=next;window.__dbdCurrentTab=next;filter='Все';
 const search=$('#search');if(search){search.value='';search.placeholder=next==='maps'?'Поиск карт и владений…':'Поиск в Тумане…'}
 document.querySelectorAll('[data-tab]').forEach(button=>{
  const active=button.dataset.tab===tab;
  button.classList.toggle('active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 });
 setGridLayout('');
 if(opts.history!==false){
  const state={...(history.state||{}),tab,modalDepth:0};
  try{if(opts.replace)history.replaceState(state,'','#'+tab);else history.pushState(state,'','#'+tab);}catch{}
 }
 if(tab==='maps'){
  // The full published catalog adds lore text and official cover art; the
  // bundled fallback keeps all 49 maps and their local plans available offline.
  $('#connection').textContent='Загружаем атлас карт…';
  load();return;
 }
 if(tab==='builds'){loadBuilds();return}
 if(tab==='mybuilds'){if(typeof loadMyBuilds==='function')loadMyBuilds();else render();return}
 if(tab==='tiers'){if(typeof loadTierList==='function')loadTierList();else render();return}
 if(tab==='favorites'){render();return}
 load();
}
window.switchTab=switchTab;
window.navigateToTab=value=>{switchTab(value);window.scrollTo({top:0,behavior:'smooth'})};

// The old numbered-square viewer has been replaced by maps.js: local 3D views,
// detailed top-down plans, realm grouping, zoom/pan and artist credits.
function openMapTactics(map){if(typeof window.openMapDetail==='function')window.openMapDetail(window.mapRecordKey?window.mapRecordKey(map):String(map?.mapKey||map?.id||''))}
function handleGlobalClick(event){
 const fav=event.target.closest('[data-fav]');
 if(fav){
  event.preventDefault();event.stopPropagation();
  const key=fav.dataset.fav,index=favorites.findIndex(entry=>entry.key===key);
  let sourceTab=fav.closest('[data-source-tab]')?.dataset.sourceTab||tab;
  if(index>=0){sourceTab=favorites[index].sourceTab||sourceTab;favorites.splice(index,1)}
  else{
   const item=findRecordByKey(key);
   if(item)favorites.push({key,sourceTab:item.__sourceTab||sourceTab,data:cleanFavoriteData(item)});
  }
  updateFav();render();
  const selector=typeof CSS!=='undefined'&&CSS.escape?'.fav[data-fav="'+CSS.escape(key)+'"]':null;
  const buttons=selector?document.querySelectorAll(selector):[];
  buttons.forEach(button=>{
   const saved=favorites.some(entry=>entry.key===key);
   button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',saved?'true':'false');
   button.setAttribute('aria-label',saved?'Убрать из избранного':'Добавить в избранное');
   if(!button.textContent.includes('избран'))button.textContent=saved?'♥':'♡';
  });
  return;
 }
 const route=event.target.closest('[data-route]');
 if(route&&typeof window.navigateToTab==='function'){event.preventDefault();window.navigateToTab(route.dataset.route);return}
 const tabButton=event.target.closest('[data-tab]');
 if(tabButton){switchTab(tabButton.dataset.tab);return}
 const copy=event.target.closest('[data-copy-build]');
 if(copy){
  const build=UNIVERSAL_BUILDS.find(item=>item.id===copy.dataset.copyBuild);
  if(build){
   const value=build.title+'\n'+build.perks.join('\n');
   if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>copy.textContent='Скопировано ✓').catch(()=>copy.textContent='Не удалось скопировать');
   else copy.textContent='Буфер обмена недоступен';
  }
  return;
 }
 const filterButton=event.target.closest('[data-filter]');
 if(filterButton){filter=filterButton.dataset.filter;render();return}
 const detail=event.target.closest('[data-item-detail]');
 if(detail&&!event.target.closest('[data-fav]')){
  event.preventDefault();
  const item=findRecordByKey(detail.dataset.itemDetail);
  if(item)openDetail(item);
 }
}
document.addEventListener('click',handleGlobalClick);
$('#search').addEventListener('input',()=>render());
window.addEventListener('hashchange',()=>{const value=tabFromHash();if(value!==tab)switchTab(value,{history:false})});
$('#refresh').addEventListener('click',()=>{
 catalogPromise=null;
 if(tab==='tiers'&&typeof loadTierList==='function')loadTierList(true);
 else if(tab==='builds')loadBuilds();
 else if(tab==='mybuilds'&&typeof loadMyBuilds==='function')loadMyBuilds();
 else if(tab==='maps')render();
 else if(tab==='favorites')render();
 else load();
});
updateFav();switchTab(tab,{replace:true});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
