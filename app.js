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
function name(x){return x.name||x.displayName||x.display_name||x.title||x.killerName||x.id||'Без названия'}
function desc(x){return x.description||x.desc||x.effect||x.power||x.contentText||x.content||''}
function image(x){return x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.iconURL||x.perkIcon||x.perk_icon||x.iconPath||x.icon_path||x.portrait||x.portraitURL||''}
function category(x){return x.role||x.type||x.category||x.realm||x.faction||x.characterName||x.character||''}
function cosmetic(x){const v=norm([x.type,x.category,x.subcategory,x.kind,x.itemType,x.item_type,x.tags,x.name,x.displayName].join(' '));return /outfit|cosmetic|skin|wardrobe|charm|badge|banner|portrait|headwear|torso|legwear|customization|store outfit/.test(v)}
function usableGear(x){return !cosmetic(x)&&!x.isCosmetic&&!x.is_cosmetic&&!x.cosmetic}
function id(x){return String(x.id||x._id||x.name||name(x))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateFav(){$('#favCount').textContent=favorites.length;localStorage.setItem('dbd-favorites',JSON.stringify(favorites))}
async function getData(url){const r=await fetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}\nlet catalogPromise;async function localCatalog(){if(!catalogPromise)catalogPromise=fetch('./catalog-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Локальный каталог ещё не опубликован');return r.json()});return catalogPromise}
async function load(){
 if(tab==='favorites'){render();return}
 $('#notice').textContent='Ищем записи в Тумане…';$('#grid').innerHTML='';
 const cfg=TYPES[tab];let lastError;\n if(['perks','offerings','maps','addons'].includes(tab)){try{const local=await localCatalog();const data=arr(local[tab]);if(data.length){all=data;$('#connection').textContent='Локальная база загружена';$('#connection').classList.add('ok');render();return}}catch(e){lastError=e}}\n const sources=[...(cfg.source?(Array.isArray(cfg.source)?cfg.source:[cfg.source]):[]),API+'/'+cfg.endpoint+'?branch=live',API+'/'+cfg.endpoint,API+'/'+cfg.endpoint+'/'];
 for(const url of sources){try{
  let data=arr(await getData(url));if(['items','addons','offerings'].includes(tab))data=data.filter(usableGear);if(!data.length)throw Error('Источник вернул пустой список');
  all=data;$('#connection').textContent=url.startsWith(SOURCE)?'Резервная база подключена':'База подключена';$('#connection').classList.add('ok');render();return;
 }catch(e){lastError=e}}
 if(tab==='addons'){try{const [chars,items]=await Promise.all([getData(SOURCE+'/characters/'),getData(SOURCE+'/items/')]);const nested=[...arr(chars),...arr(items)].flatMap(x=>x.addons||x.addOns||x.add_ons||x.itemAddons||x.item_addons||x.powerAddons||x.power_addons||[]);if(nested.length){all=nested.filter(usableGear);$('#connection').textContent='Резервная база подключена';$('#connection').classList.add('ok');render();return}}catch(e){lastError=e}}
 if(['perks','offerings','maps'].includes(tab)){try{const local=await localCatalog();const data=arr(local[tab]);if(data.length){all=data;$('#connection').textContent='Локальная база загружена';$('#connection').classList.add('ok');render();return}}catch(e){lastError=e}}\n all=[];$('#notice').textContent='Не удалось загрузить этот раздел. Источник данных временно недоступен. ('+(lastError?.message||'ошибка')+')';
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
function buildPerk(wanted) {
 const key = norm(wanted).replace(/[^a-z0-9]/g,"");
 return allPerks.find(p=>norm(name(p)).replace(/[^a-z0-9]/g,"")===key) || allPerks.find(p=>norm(name(p)).replace(/[^a-z0-9]/g,"").includes(key) || key.includes(norm(name(p)).replace(/[^a-z0-9]/g,"")));
}
function buildPerkOwner(p) { return String(p.characterName||p.character_name||p.character||p.owner||p.survivor||p.killer||""); }
const LICENSED_PERK_OWNERS = ["Laurie Strode","Quentin Smith","Detective Tapp","Ash Williams","Nancy Wheeler","Steve Harrington","Cheryl Mason","Jill Valentine","Leon Kennedy","Rebecca Chambers","Ada Wong","Ellen Ripley","Pinhead","Alan Wake","Lara Croft"];\nconst LICENSED_PERK_NAMES = ["Decisive Strike","Hyperfocus","Chemical Trap","Background Player","Troubleshooter","Champion of Light","Moment of Glory","Invocation: Treacherous Crows"];
function buildPerkIsPaid(p) {
 const owner=buildPerkOwner(p).toLowerCase();
 return !!(p.isLicensed||p.is_licensed||p.licensed||p.dlc||p.isDlc||p.is_dlc||LICENSED_PERK_OWNERS.some(n=>owner.includes(n.toLowerCase()))||LICENSED_PERK_NAMES.some(n=>norm(name(p))===norm(n)));
}
async function loadBuilds(){try{const catalog=await localCatalog();allPerks=arr(catalog.perks);renderBuilds()}catch(e){allPerks=[];renderBuilds();$('#notice').textContent='Каталог перков недоступен — названия сборок всё равно доступны, иконки появятся после загрузки базы.'}}\nfunction renderBuilds() {
 const q=norm($('#search').value.trim());
 const groups=UNIVERSAL_BUILDS.filter(b=>norm(b.title+' '+b.tag+' '+b.desc+' '+b.perks.join(' ')).includes(q));
 $('#sectionTitle').textContent='Готовые билды';
 $('#sectionLabel').textContent='UNIVERSAL SURVIVOR BUILDS';
 $('#filters').innerHTML='<span class="builds-hint">Выбери стиль игры — в каждой сборке четыре перка</span>';
 $('#notice').textContent='Подборки для выжившего • '+groups.length+' сборок';
 $('#grid').classList.add('build-grid');
 $('#grid').innerHTML=groups.map(b=>{
  const perks=b.perks.map(wanted=>{
   const p=buildPerk(wanted),src=p?image(p):'';
   return '<div class="build-perk"><div class="build-perk-icon">'+(src?'<img loading="lazy" src="'+esc(src)+'" alt="" onerror="this.style.display=\'none\'">':'<span>✣</span>')+'</div><div class="build-perk-info"><b>'+esc(p?name(p):wanted)+'</b><small>'+esc(p?(buildPerkOwner(p)||'Игровой перк'):'Перк не найден в базе')+'</small></div>'+(p&&buildPerkIsPaid(p)?'<span class="auric-cell" title="Платный персонаж / лицензированный контент">◈</span>':'')+'</div>';
  }).join('');
  return '<article class="build-card"><div class="build-head"><span class="build-tag">'+esc(b.tag)+'</span><h3>'+esc(b.title)+'</h3><p>'+esc(b.desc)+'</p></div><div class="build-perks">'+perks+'</div><div class="build-foot"><span>4 ПЕРКА • ВЫЖИВШИЙ</span><button class="build-copy" data-copy-build="'+b.id+'">Скопировать названия</button></div></article>';
 }).join('') || '<div class="empty">По этому запросу сборок не найдено.</div>';
}
function render(){
 if(tab==='builds'){renderBuilds();return}
 $('#grid').classList.remove('build-grid');
 const cfg=TYPES[tab];$('#sectionTitle').textContent=tab==='favorites'?'Избранное':cfg.title;$('#sectionLabel').textContent=tab==='favorites'?'YOUR COLLECTION':cfg.label;
 const data=tab==='favorites'?favorites.map(x=>x.data):all,q=norm($('#search').value.trim()),cats=['Все',...new Set(data.map(category).filter(Boolean))];
 if(!cats.includes(filter))filter='Все';
 $('#filters').innerHTML=cats.length>2?cats.map(c=>'<button class="'+(filter===c?'active':'')+'" data-filter="'+esc(c)+'">'+esc(c)+'</button>').join(''):'';
 const shown=data.filter(x=>(filter==='Все'||category(x)===filter)&&(!q||norm(name(x)+' '+desc(x)+' '+category(x)).includes(q)));
 $('#notice').textContent=shown.length?'Найдено: '+shown.length+(tab==='items'?' • скины и косметика исключены':''):'Ничего не найдено';
 $('#grid').innerHTML=shown.map(x=>{const key=id(x),src=image(x),saved=favorites.some(f=>f.key===key);return '<article class="item"><div class="art">'+(src?'<img loading="lazy" src="'+esc(src)+'" alt="" onerror="this.remove()">':'<span class="placeholder">✣</span>')+'</div><div class="itembody"><div class="kind">'+esc(category(x)||cfg?.title||'DBD')+'</div><h3>'+esc(name(x))+'</h3><p>'+esc(desc(x)||'Информация об этой записи доступна в игровом справочнике.')+'</p><div class="cardbottom"><small>'+esc(x.realm||x.characterName||x.character||'DEAD BY DAYLIGHT')+'</small><button class="fav '+(saved?'saved':'')+'" data-fav="'+esc(key)+'">'+(saved?'♥':'♡')+'</button></div></div></article>'}).join('')||'<div class="empty">В этой части Тумана пока пусто.</div>';
}
function switchTab(t){tab=t;filter='Все';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));$('#search').value='';if(t==='builds'){loadBuilds();return}load()}

const DBD_MAP_LAYOUTS={"Azarov’s Resting Place":"Autohaven Wreckers/Azarov’s Resting Place.webp",
"Blood Lodge":"Autohaven Wreckers/Blood Lodge.webp",
"Gas Heaven":"Autohaven Wreckers/Gas Heaven.webp",
"Wreckers' Yard":"Autohaven Wreckers/Wreckers' Yard.webp",
"Wretched Shop":"Autohaven Wreckers/Wretched Shop.webp",
"Grim Pantry":"Backwater Swamp/Grim Pantry.webp",
"The Pale Rose":"Backwater Swamp/The Pale Rose.webp",
"Fractured Cowshed":"Coldwind Farm/Fractured Cowshed.webp",
"Rancid Abattoir":"Coldwind Farm/Rancid Abbatoir.webp",
"Rotten Fields":"Coldwind Farm/Rotten Fields.webp",
"The Thompson House":"Coldwind Farm/The Thompson House.webp",
"Torment Creek":"Coldwind Farm/Torment Creek.webp",
"Disturbed Ward":"Crotus Prenn Asylum/Disturbed Ward.webp",
"Father Campbell's Chapel":"Crotus Prenn Asylum/Father Campbell's Chapel.webp",
"Nostromo Wreckage":"Dvarka Deepwood/Nostromo Wreckage.webp",
"Toba Landing":"Dvarka Deepwood/Toba Landing.webp",
"Dead Sands":"Forsaken Boneyard/Dead Sands.webp",
"Eyrie of Crows":"Forsaken Boneyard/Eyrie of Crows.webp",
"The Game":"Gideon Meat Plant/The Game.webp",
"Dead Dawg Saloon":"Grave of Glenvale/Dead Dawg Saloon.webp",
"Lampkin Lane":"Haddonfield/Lampkin Lane.webp",
"The Underground Complex":"Hawkins National Laboratory/The Underground Complex.webp",
"Treatment Theatre":"Léry's Memorial Institute/Treatment Theatre.webp",
"Mount Ormond Resort":"Ormond/Mount Ormond Resort.webp",
"Ormond Lake Mine":"Ormond/Ormond Lake Mine.webp",
"Raccoon City Police Station East Wing":"Raccoon City/Raccoon City Police Station East Wing.webp",
"Raccoon City Police Station West Wing":"Raccoon City/Raccoon City Police Station West Wing.webp",
"Mother's Dwelling":"Red Forest/Mother's Dwelling.webp",
"Temple of Purgation":"Red Forest/Temple of Purgation.webp",
"Midwich Elementary School":"Silent Hill/Midwich Elementary School.webp",
"Trickster's Delusion":"Sleepless District/Tricksters Delusion.webp",
"Badham Preschool":"Springwood/Badham Preschool.webp",
"Forgotten Ruins":"The Decimated Borgo/Forgotten Ruins.webp",
"The Shattered Square":"The Decimated Borgo/The Shattered Square.webp",
"Coal Tower":"The MacMillan Estate/Coal Tower.webp",
"Groaning Storehouse":"The MacMillan Estate/Groaning Storehouse.webp",
"Ironworks of Misery":"The MacMillan Estate/Ironworks Of Misery.webp",
"Shelter Woods":"The MacMillan Estate/Shelter Woods.webp",
"Suffocation Pit":"The MacMillan Estate/Suffocation Pit.webp",
"Fallen Refuge":"Withered Isle/Fallen Refuge.webp",
"Freddy Fazbear's Pizza":"Withered Isle/Freddy Fazbear's Pizza.webp",
"Garden of Joy":"Withered Isle/Garden of Joy.webp",
"Greenville Square":"Withered Isle/Greenville Square.webp",
"Family Residence":"Yamaoka Estate/Family Residence.webp",
"Sanctum of Wrath":"Yamaoka Estate/Sanctum of Wrath.webp"};
function mapKey(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function mapLayoutPath(label){
 const n=mapKey(label);
 const aliases=[
  ["raccooncitypolicestationeast","Raccoon City Police Station East Wing"],["raccooncitypolicestationwest","Raccoon City Police Station West Wing"],
  ["rancid","Rancid Abattoir"],["templeofpurgation","Temple of Purgation"],["ironworksofmisery","Ironworks of Misery"],
  ["trickstersdelusion","Trickster's Delusion"],["badham","Badham Preschool"],["midwich","Midwich Elementary School"],
  ["thegame","The Game"],["forgottenruins","Forgotten Ruins"],["shatteredsquare","The Shattered Square"]
 ];
 for(const [part,key] of aliases)if(n.includes(part))return DBD_MAP_LAYOUTS[key];
 for(const key of Object.keys(DBD_MAP_LAYOUTS))if(mapKey(key)===n||n.includes(mapKey(key)))return DBD_MAP_LAYOUTS[key];
 return "";
}
function mapAssetUrl(path){return "https://raw.githubusercontent.com/LucaFontanot/dbd-map-overlay/master/maps/Hens333/"+path.split("/").map(encodeURIComponent).join("/")}
function openMapTactics(map){
 const label=name(map),path=mapLayoutPath(label),src=path?mapAssetUrl(path):image(map);
 let modal=document.getElementById("mapTacticsModal");
 if(!modal){modal=document.createElement("div");modal.id="mapTacticsModal";modal.className="detail-overlay";document.body.appendChild(modal)}
 modal.innerHTML='<section class="detail-panel map-tactics-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="eyebrow">CHASE ROUTE GUIDE</div><h2>'+esc(label)+'</h2><p class="map-tactics-intro">Схема безопасного перемещения между петлями. Красная линия — рекомендуемый путь, значки отмечают типичные зоны окон и паллет.</p><div class="map-route-controls"><button class="active" data-route="safe">Безопасная петля</button><button data-route="chain">Переход между петлями</button><button data-route="reset">Сброс погони</button></div><div class="map-stage">'+(src?'<img class="map-layout-image" src="'+esc(src)+'" alt="План карты '+esc(label)+'" onerror="this.closest(\'.map-stage\').classList.add(\'map-image-missing\')">':'<div class="map-image-fallback">План этой карты пока не найден в библиотеке схем</div>')+'<svg class="map-route-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Маршрут и возможные окна с паллетами"><defs><filter id="routeGlow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id="routeArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#ff4c55"/></marker></defs><path class="route-line route-safe" d="M500 855 C420 820 345 770 300 690 S245 560 315 485 S455 390 555 430 S720 520 760 420 S720 260 600 220" marker-end="url(#routeArrow)"/><path class="route-line route-chain" d="M500 855 C580 790 680 735 735 650 S790 520 700 455 S555 365 460 300 S330 230 250 145" marker-end="url(#routeArrow)"/><path class="route-line route-reset" d="M500 855 C390 800 275 730 205 625 S180 455 275 370 S470 280 600 310 S785 390 830 270" marker-end="url(#routeArrow)"/><g class="route-markers"><g class="map-marker pallet" transform="translate(300 690)"><circle r="20"/><path d="M-11 -10V10M0 -10V10M11 -10V10M-14 -5H14M-14 5H14"/><text y="34">P</text></g><g class="map-marker window" transform="translate(315 485)"><circle r="19"/><path d="M-11 -11H11V11H-11ZM0 -11V11M-11 0H11"/><text y="33">О</text></g><g class="map-marker pallet" transform="translate(555 430)"><circle r="20"/><path d="M-11 -10V10M0 -10V10M11 -10V10M-14 -5H14M-14 5H14"/><text y="34">P</text></g><g class="map-marker window" transform="translate(760 420)"><circle r="19"/><path d="M-11 -11H11V11H-11ZM0 -11V11M-11 0H11"/><text y="33">О</text></g><g class="map-marker pallet" transform="translate(735 650)"><circle r="20"/><path d="M-11 -10V10M0 -10V10M11 -10V10M-14 -5H14M-14 5H14"/><text y="34">P</text></g><g class="map-marker window" transform="translate(600 220)"><circle r="19"/><path d="M-11 -11H11V11H-11ZM0 -11V11M-11 0H11"/><text y="33">О</text></g></g></svg></div><div class="map-legend"><span><i class="legend-pallet">P</i> Возможная паллета</span><span><i class="legend-window">О</i> Возможное окно</span><span><i class="legend-route"></i> Маршрут отхода</span></div><p class="map-warning">Важно: точки и маршрут ориентировочные, а не точная раскладка спавнов матча. Окна и паллеты могут появляться в других тайлах, часть паллет может отсутствовать или быть уже использована. Используй ближайшую безопасную петлю, не пытайся любой ценой добежать до отмеченной точки.</p><div class="map-art-credit">Схема карты: Hens333 / проект <a href="https://github.com/LucaFontanot/dbd-map-overlay" target="_blank" rel="noopener">DBD Map Overlay</a> · <a href="https://discord.gg/hens333" target="_blank" rel="noopener">автор карт</a></div></section>';
 modal.classList.add("open");document.body.classList.add("modal-open");
 modal.querySelectorAll("[data-route]").forEach(b=>b.addEventListener("click",()=>{modal.querySelectorAll("[data-route]").forEach(x=>x.classList.toggle("active",x===b));modal.querySelector(".map-route-overlay").dataset.route=b.dataset.route;}));
 modal.querySelector(".map-route-overlay").dataset.route="safe";
}

document.addEventListener('click',e=>{const mapCard=e.target.closest('#grid .item');if(tab==='maps'&&mapCard&&!e.target.closest('[data-fav]')){openMapTactics(all.find(x=>name(x)===mapCard.querySelector('h3')?.textContent)||{name:mapCard.querySelector('h3')?.textContent});return}if(e.target.closest('#mapTacticsModal .detail-close')||e.target.id==='mapTacticsModal'){const m=document.getElementById('mapTacticsModal');if(m)m.classList.remove('open');document.body.classList.remove('modal-open');return}const routeBtn=e.target.closest('[data-route]');if(routeBtn&&e.target.closest('#mapTacticsModal'))return;const t=e.target.closest('[data-tab]');if(t){switchTab(t.dataset.tab);return}const copy=e.target.closest('[data-copy-build]');if(copy){const b=UNIVERSAL_BUILDS.find(x=>x.id===copy.dataset.copyBuild);if(b){const value=b.title+'\\n'+b.perks.join('\\n');navigator.clipboard?.writeText(value).then(()=>copy.textContent='Скопировано ✓').catch(()=>copy.textContent='Не удалось скопировать')}return}const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return}const b=e.target.closest('[data-fav]');if(b){const key=b.dataset.fav,item=(tab==='favorites'?favorites.map(x=>x.data):all).find(x=>id(x)===key);if(favorites.some(x=>x.key===key))favorites=favorites.filter(x=>x.key!==key);else if(item)favorites.push({key,data:item});updateFav();render()}});
$('#search').addEventListener('input',()=>tab==='builds'?renderBuilds():render());$('#refresh').addEventListener('click',load);updateFav();load();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
