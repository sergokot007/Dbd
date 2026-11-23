
// Load the current in-game perk artwork once and reuse it in every recommended build.
const perkIconIndex = new Map();
let perkIconLoadPromise = null;
function perkKey(v){return String(v||"").toLowerCase().normalize("NFKD").replace(/[’']/g,"'").replace(/[^a-z0-9]/g,"")}
function perkIconUrl(p){return p&&(p.icon||p.iconUrl||p.icon_url||p.iconURL||p.image||p.imageUrl||p.image_url||p.perkIcon||p.perk_icon||p.iconPath||p.icon_path)||""}
function loadPerkIcons(){
 if(perkIconLoadPromise)return perkIconLoadPromise;
 perkIconLoadPromise=(async()=>{for(const url of ["https://dbd-stats.info/api/perks?branch=live","https://dbd.tricky.lol/api/perks?branch=live"]){try{const r=await fetch(url,{cache:"force-cache"});if(!r.ok)continue;const d=await r.json();const list=Array.isArray(d)?d:(d.data||d.perks||d.results||[]);for(const p of list){const n=p.name||p.displayName||p.display_name||p.title;if(n&&perkIconUrl(p))perkIconIndex.set(perkKey(n),perkIconUrl(p));}if(perkIconIndex.size)break;}catch{}}})();
 return perkIconLoadPromise;
}
function buildPerkIcon(name){return perkIconIndex.get(perkKey(name))||""}
loadPerkIcons();

const survivorBuilds = [
{title:"Универсальный / соло",goal:"Стабильная игра в одиночку",perks:["Sprint Burst","Decisive Strike","Windows of Opportunity","Déjà Vu"],why:"Мобильность, защита после снятия с крюка, ориентирование в погоне и помощь команде с генераторами.",gear:"Аптечка — запасной вариант для самостоятельного лечения.",gearAddons:"Bandages + Gauze Roll — дополнительные заряды и эффективность лечения.",offering:"Escape Cake или Bloody Party Streamers — если нужна прибавка очков крови."},
{title:"Погони и петли",goal:"Дольше отвлекать убийцу",perks:["Lithe","Windows of Opportunity","Resilience","Finesse"],why:"Помогает выбирать безопасные маршруты и получать преимущество у окон и препятствий.",gear:"Фонарик — для ослепления убийцы и спасения союзников в подходящей ситуации.",gearAddons:"Battery + Focus Lens — больше времени работы и удобства использования.",offering:"Shroud of Binding — начать матч ближе к союзникам для командной игры."},
{title:"Быстрые генераторы",goal:"Сосредоточиться на цели",perks:["Déjà Vu","Prove Thyself","Stake Out","Built to Last"],why:"Поиск выгодных генераторов, ускорение совместной починки и эффективное использование ящика.",gear:"Commodious Toolbox — ускорить ремонт генератора.",gearAddons:"Wire Spool + Socket Swivels — больше зарядов и скорость ремонта.",offering:"Escape Cake / Bloody Party Streamers для очков крови; подношение карты — только если нужна конкретная карта."},
{title:"Спасение и поддержка",goal:"Помогать команде",perks:["Kindred","We'll Make It","Reassurance","Empathy"],why:"Информация о ситуации на крюке, быстрое лечение и более безопасные спасения.",gear:"Аптечка — лечить союзников после спасения или восстановиться самому.",gearAddons:"Bandages + Gauze Roll — дополнительные заряды и эффективность лечения.",offering:"Shroud of Binding для совместной игры; Escape Cake / Bloody Party Streamers — для фарма."},
{title:"Скрытность",goal:"Избегать обнаружения",perks:["Iron Will","Lightweight","Quick & Quiet","Lucky Break"],why:"Меньше шума и следов, проще разорвать контакт и сменить позицию.",gear:"Карта — отслеживать раскрытые ею важные объекты.",gearAddons:"Аддоны карты на дальность и раскрытие объектов — по доступности.",offering:"Escape Cake / Bloody Party Streamers для фарма; другое подношение не обязательно."}
];
const killerBuilds = [
{title:"Универсальный контроль",goal:"Давление на генераторы",perks:["Corrupt Intervention","Pop Goes the Weasel","Grim Embrace","No Holds Barred"],why:"Сдерживает ранний прогресс и создаёт давление через повешения и регресс генераторов.",gear:"Убийца не использует предметы выживших — вместо них два аддона собственной силы.",gearAddons:"Пара аддонов из списка ниже: один на стабильность/перезарядку силы, второй на давление или контроль.",offering:"Shroud of Separation — разнести выживших; подношение карты — под территорию убийцы."},
{title:"Поиск и информация",goal:"Быстро находить выживших",perks:["Lethal Pursuer","Barbecue & Chilli","Nowhere to Hide","I'm All Ears"],why:"Помогает начать погоню сразу, находить следующую цель после крюка и не терять след.",gear:"Предметов у убийцы нет — используй два аддона силы персонажа.",gearAddons:"Приоритет: дальность обнаружения, длительность эффекта или ускорение повторного применения.",offering:"Shroud of Separation — начать матч с выжившими на расстоянии."},
{title:"Сильная погоня",goal:"Быстрее сокращать дистанцию",perks:["Bamboozle","Brutal Strength","Enduring","Spirit Fury"],why:"Ускоряет разрушение препятствий и помогает выигрывать столкновения у окон и палет.",gear:"Предметов у убийцы нет — используй два аддона силы персонажа.",gearAddons:"Выбирай аддоны на скорость, дистанцию атаки или сокращение пауз между применениями силы.",offering:"Подношение карты выбирай под механику убийцы; универсального лучшего варианта нет."},
{title:"Давление на команду",goal:"Наказывать за ошибки",perks:["Infectious Fright","Deadlock","Scourge Hook: Pain Resonance","Hex: No One Escapes Death"],why:"Даёт информацию о позициях и мешает команде восстановить темп.",gear:"Предметов у убийцы нет — используй два аддона силы персонажа.",gearAddons:"Один аддон на стабильное применение силы, второй — на массовое давление или контроль.",offering:"Escape Cake / Bloody Party Streamers для очков крови; карту выбирай под механику убийцы."}
];
const dossiers = {
"Dwight Fairfield":"Организатор команды. Его стиль строится вокруг совместной работы: поиск союзников, ускорение групповой починки и поддержка команды.",
"Meg Thomas":"Спортивная и очень мобильная выжившая. Сильная сторона — быстрый старт погони и возможность резко увеличить дистанцию.",
"Claudette Morel":"Выжившая, ориентированная на лечение и поддержку. Хорошо подходит для восстановления команды и осторожной игры.",
"Jake Park":"Одиночка, привыкший выживать в лесу. Его стиль подходит для скрытности, тихого перемещения и взаимодействия с крюками.",
"Nea Karlsson":"Уличная художница с дерзким характером. Подходит игрокам, которые любят погони, манёвры и использование окружения.",
"Feng Min":"Бывшая киберспортсменка. Её стиль сочетается с внимательной игрой, контролем проверок реакции и погонями.",
"Kate Denson":"Музыкант и оптимистка. Её сильная сторона — ориентирование на карте и уверенное использование препятствий.",
"David King":"Боец с прямолинейным стилем. Подходит для рискованных спасений, защиты союзников и активного давления на убийцу.",
"The Trapper":"Контролирует территорию ловушками. Силен, когда заранее перекрывает проходы и направляет выживших в подготовленные зоны.",
"The Wraith":"Охотится из невидимости и быстро меняет позицию. Силен во внезапных атаках и постоянном перемещении между генераторами.",
"The Hillbilly":"Мобильный убийца с бензопилой. Быстро пересекает карту и наказывает за ошибки на открытых участках.",
"The Nurse":"Перемещается сквозь препятствия рывками. Очень сильна в умелых руках, но требует точного расчёта дистанции.",
"The Huntress":"Давит на расстоянии метательными топорами. Особенно опасна на открытых линиях обзора и у окон.",
"The Shape":"Набирает силу, наблюдая за выжившими. Стиль строится на скрытном начале матча и выборе момента для атаки.",
"The Hag":"Защищает территорию ловушками-символами и быстро возвращается к ним. Сильна в обороне крюков и подготовленных зон.",
"The Doctor":"Выявляет выживших электрическими разрядами и мешает им спокойно выполнять действия. Хорош для контроля области.",
"The Cannibal":"Опасен вблизи благодаря бензопиле. Особенно силён в узких пространствах и при наказании за ошибки позиционирования.",
"The Clown":"Использует бутылки, чтобы замедлять или ускорять участников погони. Контролирует проходы и вынуждает менять маршрут.",
"The Spirit":"Скрытно перемещается в фазе и ловит противников на чтении звуков и поведения. Требует хорошего чувства тайминга.",
"The Legion":"Быстро перемещается между целями и наносит серию ранений. Силен в постоянном давлении на нескольких выживших.",
"The Plague":"Заражает выживших и объекты, вынуждая команду выбирать между лечением и риском. Эффективна против сгруппированных команд.",
"The Ghost Face":"Скрывает присутствие и метит выживших для мощных атак. Силен в засаде и неожиданном начале погони.",
"The Oni":"Набирает ярость, собирая кровь раненых выживших. В усиленном состоянии способен быстро менять ход матча.",
"The Deathslinger":"Поражает выживших гарпуном на расстоянии. Опасен у окон и палет, где может использовать точный выстрел.",
"The Executioner":"Контролирует маршруты карательными следами и способен наказывать выживших через препятствия.",
"The Blight":"Очень мобильный убийца, разгоняющийся от препятствий. Силен в быстром перемещении и цепочках атак.",
"The Twins":"Управляет двумя персонажами и может оказывать давление на разные участки карты. Требует планирования переключений.",
"The Trickster":"Атакует сериями метательных ножей. Опасен на открытых пространствах и при удержании линии обзора.",
"The Nemesis":"Использует щупальце и зомби для давления. Становится опаснее по мере развития силы и контроля карты.",
"The Cenobite":"Создаёт цепи и вынуждает команду отвлекаться на головоломку. Хорошо распределяет давление между целями.",
"The Artist":"Посылает воронов для разведки и атак на расстоянии. Сильна в контроле маршрутов и генераторов.",
"The Onryō":"Использует телевизоры и проклятые кассеты для скрытого перемещения и постепенного давления.",
"The Mastermind":"Быстро сокращает дистанцию рывками и может бросать выживших. Силен в агрессивных погонях.",
"The Knight":"Патрулирует территорию призванными стражами. Умеет разделять команду и защищать важные зоны.",
"The Skull Merchant":"Использует дроны для наблюдения и контроля областей. Сильна в удержании ключевых генераторов.",
"The Singularity":"Расставляет биоподы для наблюдения и телепортации. Требует активного контроля камеры и карты.",
"The Xenomorph":"Использует туннели для быстрого перемещения и хвост для атак. Силен в контроле маршрутов.",
"The Good Guy":"Маленький и скрытный убийца с рывком и режимом скрытности. Может неожиданно начинать и продолжать погони."
};
const detailEsc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function isDbdKiller(x){const t=String(x.type||x.role||x.category||"").toLowerCase();return t.includes("killer")||!!x.killerName||!!x.power||!!x.ability}
function showDbdCharacter(cardOrData){
 let data=null;
 if(cardOrData&&typeof cardOrData==="object"&&!cardOrData.querySelector){
  data=cardOrData;
 }else{
  const card=cardOrData;
  if(!card||card.querySelector("[data-fav]")?.matches(":active"))return;
  const cardName=card.querySelector("h3")?.textContent||"";
  data=typeof all!=="undefined"?all.find(x=>normDetail(x.displayName||x.display_name||x.name||x.title||x.killerName||x.id)===normDetail(cardName)):null;
 }
 if(!data)return;
 const key=String(data.nameEn||data.englishName||data.name_en||data.english_name||data.name||data.displayName||data.title||data.killerName||"");
 const displayKey=String(data.displayName||data.display_name||data.name||data.title||key);
 const isK=isDbdKiller(data),builds=isK?killerBuilds:survivorBuilds;
 const img=data.image||data.imageUrl||data.image_url||data.icon||data.iconUrl||data.icon_url||data.iconURL||data.portrait||data.portraitURL||"";
 let addons=data.addons||data.add_ons||data.addOns||data.powerAddons||data.power_addons; if(!Array.isArray(addons)||!addons.length){const owner=String(data.killerName||key).toLowerCase().replace(/^the /,"");const list=window.__dbdAddonIndex||[];addons=list.filter(a=>{const who=String(a.characterName||a.killerName||a.character||a.owner||a.parentName||a.killer||"").toLowerCase().replace(/^the /,"");return who===owner||who===key.toLowerCase()})}
 let modal=document.getElementById("characterModal");
 if(!modal){modal=document.createElement("div");modal.id="characterModal";modal.className="detail-overlay";document.body.appendChild(modal)}
 modal.innerHTML='<section class="detail-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="detail-head">'+(img?'<img src="'+detailEsc(img)+'" alt="">':'<div class="detail-placeholder">✣</div>')+'<div><div class="eyebrow">'+(isK?"KILLER DOSSIER":"SURVIVOR DOSSIER")+'</div><h2>'+detailEsc(displayKey)+'</h2><span class="detail-role">'+(isK?"Убийца":"Выживший")+'</span></div></div><div class="detail-copy"><h3>Описание персонажа</h3><p>'+detailEsc(dossiers[key]||(isK?"Убийца со своей уникальной силой и тактикой. Используй способность, чтобы создавать давление, выбирать выгодные маршруты и не давать выжившим спокойно выполнять генераторы.":"Выживший со своим набором личных перков. Базовые характеристики выживших одинаковы, поэтому выбор персонажа — это прежде всего выбор личных перков и любимого стиля игры."))+'</p>'+(data.description||data.desc||data.effect?'<p>'+detailEsc(data.description||data.desc||data.effect)+'</p>':"")+(data.power||data.ability?'<h3>Особенность</h3><p>'+detailEsc(data.power||data.ability)+'</p>':"")+'</div><div class="build-section"><div class="eyebrow">RECOMMENDED LOADOUTS</div><h3>Подходящие билды</h3><div class="build-filters"><button type="button" class="active" data-build-filter="all">Все билды</button><button type="button" data-build-filter="free">Без доната</button></div>'+builds.map((b,i)=>{const buildPaid=b.perks.some(perkNeedsAuricCells);const notes=buildNotes[b.title]||{strength:b.why,weakness:"Эффективность зависит от карты, действий команды и выбранного противника."};const gearLabel=(b.gear||"").split(" — ")[0];const addonLabels=(b.gearAddons||"").split(" — ")[0].split(" + ").map(x=>x.trim()).filter(Boolean);const offeringLabels=(b.offering||"").split(" — ")[0].split(" / ").map(x=>x.trim()).filter(Boolean);return '<article class="build-card" data-build-paid="'+(buildPaid?'true':'false')+'"><div class="build-title"><div><h4>'+detailEsc(b.title)+'</h4><small>'+detailEsc(b.goal)+'</small></div><span>0'+(i+1)+'</span></div><div class="perk-chips">'+b.perks.map(p=>'<button type="button" class="perk-chip'+(perkNeedsAuricCells(p)?' requires-auric':'')+'" data-loadout-type="perk" data-loadout-name="'+detailEsc(p)+'"'+(perkNeedsAuricCells(p)?' title="Персонаж лицензированный: покупка за Auric Cells или DLC. Перк также может появиться в Святилище тайн за радужные осколки."':'')+'>'+(buildPerkIcon(p)?'<img class="build-perk-icon" src="'+detailEsc(buildPerkIcon(p))+'" alt="" loading="lazy" onerror="this.remove()">':'<span class="build-perk-placeholder">✦</span>')+'<span class="build-perk-name">'+detailEsc((typeof buildPerk==='function'&&buildPerk(p)?name(buildPerk(p)):p))+'</span>'+(perkNeedsAuricCells(p)?'<svg class="auric-cell-icon" viewBox="0 0 20 20" aria-label="Лицензированный персонаж"><path d="M10 1.4 17.4 5.7v8.6L10 18.6 2.6 14.3V5.7Z" fill="#e8b84d" stroke="#ffe6a0" stroke-width="1"/><path d="M10 4.5 14.5 7.1v5.8L10 15.5l-4.5-2.6V7.1Z" fill="#8a5b20" stroke="#fff0b8" stroke-width=".8"/></svg>':'')+'</button>').join("")+'</div><div class="build-analysis"><div><b>Почему билд хорош</b><p>'+detailEsc(notes.strength)+'</p></div><div><b>Слабые стороны</b><p>'+detailEsc(notes.weakness)+'</p></div></div><div class="loadout-gear"><div><b>'+(isK?"Аддоны силы":"Предмет")+'</b><p><button type="button" data-loadout-type="'+(isK?"addon":"item")+'" data-loadout-name="'+detailEsc(gearLabel)+'">'+detailEsc(gearLabel||"Не требуется")+'</button><span>'+detailEsc((b.gear||"").includes(" — ")?b.gear.split(" — ").slice(1).join(" — "):"")+'</span></p></div><div><b>'+(isK?"Рекомендация по аддонам":"Аддоны предмета")+'</b><p>'+addonLabels.map(x=>/аддон|пара аддонов|приоритет|выбирай|предпочтительны|один аддон/i.test(x)?'<span>'+detailEsc(x)+'</span>':'<button type="button" data-loadout-type="addon" data-loadout-name="'+detailEsc(x)+'">'+detailEsc(x)+'</button>').join(" + ")+'<span>'+detailEsc((b.gearAddons||"").includes(" — ")?b.gearAddons.split(" — ").slice(1).join(" — "):"")+'</span></p></div><div><b>Подношение</b><p>'+offeringLabels.map(x=>'<button type="button" data-loadout-type="offering" data-loadout-name="'+detailEsc(x)+'">'+detailEsc(x)+'</button>').join(" / ")+'<span>'+detailEsc((b.offering||"").includes(" — ")?b.offering.split(" — ").slice(1).join(" — "):"")+'</span></p></div></div></article>'}).join("")+'</div>'+(isK?'<div class="build-section"><div class="eyebrow">POWER ADD-ONS</div><h3>Аддоны убийцы</h3>'+(Array.isArray(addons)&&addons.length?'<div class="addon-list">'+addons.slice(0,12).map(a=>'<div class="addon-row"><button type="button" data-loadout-type="addon" data-loadout-name="'+detailEsc(a.name||a.title||"Аддон")+'">'+detailEsc(a.name||a.title||"Аддон")+'</button><small>'+detailEsc(a.description||a.effect||"Аддон силы персонажа")+'</small></div>').join("")+'</div>':'<p class="addon-note">Точные названия аддонов этого убийцы пока отсутствуют в подключённой базе. Не буду выдавать случайные предметы за лучшие. Для этого убийцы подбирай пару аддонов, усиливающих его ключевую механику: перезарядку, дальность, скорость, длительность или число зарядов. Когда база аддонов будет доступна, здесь появятся конкретные названия и эффекты.</p>')+'</div>':'<div class="build-section"><div class="eyebrow">SURVIVOR GEAR</div><h3>Предметы под роль</h3><p class="addon-note">В каждом билде выше указаны подходящий предмет, конкретные аддоны к нему и подношение. Это рекомендации по задаче, а не обязательный набор: снаряжение можно менять под карту и стиль команды.</p></div>')+(data.link?'<a class="wiki-link" href="'+detailEsc(data.link)+'" target="_blank" rel="noopener">Открыть полное досье ↗</a>':"")+'</section>';
 modal.classList.add("open");document.body.classList.add("modal-open");
}
function closeDbdCharacter(){const m=document.getElementById("characterModal");if(m)m.classList.remove("open");document.body.classList.remove("modal-open")}
document.addEventListener("click",e=>{
 if(e.target.closest(".detail-close")||e.target.id==="characterModal"){closeDbdCharacter();return}
 const tierButton=e.target.closest("[data-tier-character-open]");
 if(tierButton){
  const en=tierButton.dataset.tierCharacterOpen;
  const record=typeof all!=="undefined"&&Array.isArray(all)?all.find(x=>normDetail(x.nameEn||x.englishName||x.name_en||x.name||x.displayName||x.title)===normDetail(en)):null;
  if(record)showDbdCharacter(record);
  return;
 }
 const card=e.target.closest("#grid .item");if(card&&!e.target.closest("[data-fav]")){showDbdCharacter(card)}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDbdCharacter()});

fetch("https://dbd-stats.info/api/itemaddons?branch=live",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(d=>{window.__dbdAddonIndex=Array.isArray(d)?d:(d.data||d.addons||d.itemAddons||[])}).catch(()=>{window.__dbdAddonIndex=[]});

const buildNotes = {
"Универсальный / соло":{strength:"Сочетает экстренную мобильность, защиту после спасения и постоянную подсказку по генераторам. Хорош для самостоятельной игры, когда нельзя рассчитывать на голосовую связь.",weakness:"Нет сильного ускорения лечения или командного баффа; Sprint Burst требует контроля усталости, а Decisive Strike полезен только в определённых ситуациях."},
"Погони и петли":{strength:"Windows of Opportunity помогает заранее видеть безопасные маршруты, а Lithe даёт рывок после прыжка через препятствие. Resilience и Finesse усиливают игру вокруг окон.",weakness:"Нужны подходящие окна и грамотное управление усталостью. Почти нет помощи команде на генераторах и лечении."},
"Быстрые генераторы":{strength:"Déjà Vu помогает выбрать выгодную цель, Prove Thyself ускоряет совместную работу, Stake Out повышает надёжность проверок, а Built to Last позволяет повторно использовать инструмент.",weakness:"Максимальная отдача зависит от совместной починки и наличия ящика. В погоне билд почти не защищает, поэтому важно заранее уходить от убийцы."},
"Спасение и поддержка":{strength:"Kindred даёт информацию о ситуации на крюке, Empathy показывает раненых союзников, а We'll Make It ускоряет лечение после спасения. Reassurance помогает выиграть время.",weakness:"Билд раскрывается только при активной командной игре. Мало инструментов для самостоятельной погони и ускорения генераторов."},
"Скрытность":{strength:"Снижает заметность и помогает разрывать контакт, а карта может подсветить важные объекты, если они уже раскрываются её эффектами.",weakness:"Скрытность не гарантирует безопасность и почти не ускоряет цели матча. Карта зависит от зарядов и подходящих аддонов."},
"Универсальный контроль":{strength:"Corrupt Intervention замедляет раннее начало, Pop Goes the Weasel и Grim Embrace создают регресс и паузы на генераторах. Хорошая основа для убийцы, который стабильно вешает выживших.",weakness:"Требует регулярно получать повешения и добираться до генераторов. После раннего отключения Corrupt давление может просесть; No Holds Barred требует проверки актуального эффекта и владельца в базе."},
"Поиск и информация":{strength:"Lethal Pursuer даёт раннюю информацию, Barbecue & Chilli помогает найти следующую цель, а Nowhere to Hide и I'm All Ears раскрывают позиции во время давления.",weakness:"Мало прямого замедления генераторов. Если быстро не превращать информацию в попадания и повешения, команда может закончить цели раньше."},
"Сильная погоня":{strength:"Bamboozle ограничивает сильные окна, Brutal Strength ускоряет разрушение, Enduring смягчает оглушения, а Spirit Fury может наказать за палеты.",weakness:"Почти нет информации и регресса генераторов. Эффективность зависит от того, насколько убийца умеет использовать палеты и окна."},
"Давление на команду":{strength:"Infectious Fright даёт информацию после падения выжившего, Deadlock задерживает генератор, Pain Resonance создаёт регресс, а NOED может стать угрозой в эндгейме.",weakness:"Часть силы проявляется только после повешений или в конце матча. NOED можно найти и очистить, а билд не помогает искать первую цель."}
};
const perkOwners = {
"Sprint Burst":"Meg Thomas","Decisive Strike":"Laurie Strode","Windows of Opportunity":"Kate Denson","Déjà Vu":null,
"Lithe":"Feng Min","Resilience":null,"Finesse":"Lara Croft","Prove Thyself":"Dwight Fairfield","Stake Out":"David Tapp","Built to Last":"Felix Richter",
"Kindred":null,"We'll Make It":null,"Reassurance":"Rebecca Chambers","Empathy":"Claudette Morel","Iron Will":"Jake Park","Lightweight":null,"Quick & Quiet":"Meg Thomas","Lucky Break":"Yui Kimura",
"Corrupt Intervention":"The Plague","Pop Goes the Weasel":"The Clown","Grim Embrace":"The Artist","No Holds Barred":null,
"Lethal Pursuer":"The Nemesis","Barbecue & Chilli":"The Cannibal","Nowhere to Hide":"The Knight","I'm All Ears":"The Ghost Face",
"Bamboozle":"The Clown","Brutal Strength":"The Trapper","Enduring":"The Hillbilly","Spirit Fury":"The Spirit",
"Infectious Fright":"The Plague","Deadlock":"The Cenobite","Scourge Hook: Pain Resonance":"The Artist","Hex: No One Escapes Death":null
};
const licensedPerkOwners = new Set(["Laurie Strode","Lara Croft","Rebecca Chambers","The Nemesis","The Cannibal","The Ghost Face","The Cenobite"]);
function perkNeedsAuricCells(perk){return licensedPerkOwners.has(perkOwners[perk]);}
const characterPortraits = {};
function normDetail(v){return String(v||"").toLowerCase().replace(/^the /,"").replace(/[^a-z0-9а-яё]/gi,"")}
function findCharacter(owner){
 if(!owner)return null;
 const pool=typeof all!=="undefined"&&Array.isArray(all)?all:[];
 return pool.find(x=>normDetail(x.displayName||x.display_name||x.name||x.title||x.killerName)===normDetail(owner))||characterPortraits[normDetail(owner)]||null;
}
function itemInfo(type,label){
 const n=String(label||"").toLowerCase();
 if(type==="item"){
  if(n.includes("toolbox")||n.includes("ящик"))return {desc:"Ящик с инструментами расходует заряды, ускоряя ремонт генератора или саботаж крюков — в зависимости от типа.",obtain:"Обычные и редкие варианты появляются в Кровавой паутине; предметы также можно находить в сундуках на карте. Выбирай ящик по запасу зарядов и скорости ремонта."};
  if(n.includes("аптеч")||n.includes("first aid")||n.includes("med-kit"))return {desc:"Аптечка позволяет лечить себя и союзников, расходуя заряды. Эффективность зависит от редкости и аддонов.",obtain:"Открывается в Кровавой паутине и может быть найдена в сундуках. Аддоны на лечение подбирай по доступным зарядам и скорости лечения."};
  if(n.includes("flashlight")||n.includes("фонар"))return {desc:"Фонарик ослепляет убийцу при точном наведении в нужный момент; может помочь со спасением при переносе выжившего.",obtain:"Получается в Кровавой паутине или из сундуков. Для стабильного использования нужны практика тайминга и заряд."};
  if(n.includes("map")||n.includes("карт"))return {desc:"Карта помогает отслеживать объекты, которые раскрываются её эффектами и установленными аддонами.",obtain:"Получается в Кровавой паутине или из сундуков. Без подходящего эффекта карта не показывает автоматически все объекты."};
  return {desc:"Игровой предмет выжившего. Его свойства и расход зарядов зависят от типа и редкости.",obtain:"Обычно доступен в Кровавой паутине и/или в сундуках на карте. Точные условия смотри в карточке предмета."};
 }
 if(type==="addon")return {desc:"Аддон усиливает или изменяет свойства выбранного предмета/силы убийцы. Он работает только с совместимым предметом или персонажем.",obtain:"Аддоны появляются в Кровавой паутине; часть можно найти в сундуках. Аддон должен соответствовать предмету или силе, указанным в его описании."};
 return {desc:"Подношение выбирается перед матчем и расходуется после его завершения. Эффект зависит от конкретного подношения.",obtain:"Подношения открываются в Кровавой паутине. Некоторые дают очки крови, меняют условия карты или стартовое расположение игроков."};
}
async function ensureCharacterPortraits(){
 if(Object.keys(characterPortraits).length)return;
 try{let list=[];if(typeof localCatalog==="function"){const catalog=await localCatalog();list=Array.isArray(catalog.characters)?catalog.characters:[];}if(!list.length){const r=await fetch("https://dbd.source.gs/api/characters/",{cache:"force-cache"});if(r.ok){const payload=await r.json();list=Array.isArray(payload)?payload:(payload.data||payload.characters||payload.items||[]);}}for(const x of list){const nm=x.displayName||x.display_name||x.name||x.title||x.killerName;const im=x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.portrait;if(nm&&im)characterPortraits[normDetail(nm)]=x;}}catch{}
}
async function openLoadoutInfo(type,label){
 if(type==="perk"&&typeof localCatalog==="function"&&(!Array.isArray(allPerks)||!allPerks.length)){try{const catalog=await localCatalog();allPerks=Array.isArray(catalog.perks)?catalog.perks:[]}catch{}}
 const perkRecord=type==="perk"&&typeof allPerks!=="undefined"?allPerks.find(p=>[p.name,p.displayName,p.display_name,p.nameEn,p.englishName,p.id].some(v=>normDetail(v)===normDetail(label))):null;
 const owner=type==="perk"?(perkOwners[label]||buildPerkOwner(perkRecord)||null):null;
 const character=owner?findCharacter(owner):null;
 const portrait=character?(character.image||character.imageUrl||character.image_url||character.icon||character.iconUrl||character.icon_url||character.portrait||""):"";
 const info=type==="perk"?(owner?{desc:"Уникальный перк персонажа "+owner+". После открытия его можно использовать на других персонажах той же роли.",obtain:"Повысь "+owner+" до престижа 1, чтобы открыть перк I уровня всем персонажам этой роли; престиж 2 и 3 сразу открывают II и III уровни. Альтернатива — купить перк в Святилище тайн за радужные осколки, когда он там появится."}:{desc:"Общий перк: он не привязан к одному конкретному персонажу.",obtain:"Открывается через Кровавую паутину. Если перк относится к отдельному персонажу, его владелец будет указан в карточке."}):itemInfo(type,label);
 let m=document.getElementById("loadoutInfoModal");
 if(!m){m=document.createElement("div");m.id="loadoutInfoModal";m.className="detail-overlay";document.body.appendChild(m);}
 m.innerHTML='<section class="detail-panel info-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="detail-head">'+(portrait?'<img src="'+detailEsc(portrait)+'" alt="">': '<div class="detail-placeholder">'+(type==="perk"?"✦":type==="item"?"▣":type==="addon"?"◇":"✧")+'</div>')+'<div><div class="eyebrow">'+({perk:"PERK",item:"SURVIVOR ITEM",addon:"ADD-ON",offering:"OFFERING"}[type]||"DBD")+'</div><h2>'+detailEsc(label)+'</h2>'+(owner?'<span class="detail-role">Персонаж-источник: '+detailEsc(owner)+'</span>':"")+'</div></div><div class="detail-copy"><h3>Что даёт</h3><p>'+detailEsc(info.desc)+'</p><h3>Как получить</h3><p>'+detailEsc(info.obtain)+'</p>'+(owner?'<p class="source-character">'+(portrait?'<img src="'+detailEsc(portrait)+'" alt="">':"")+'<b>'+detailEsc(owner)+'</b><span>Открой его уникальные перки через престиж 1–3.</span></p>':"")+'</div></section>';
 m.classList.add("open");document.body.classList.add("modal-open");
}
document.addEventListener("click",e=>{
 const buildFilter=e.target.closest("[data-build-filter]");
 if(buildFilter){const panel=buildFilter.closest(".build-section");if(panel){panel.querySelectorAll("[data-build-filter]").forEach(b=>b.classList.toggle("active",b===buildFilter));panel.querySelectorAll(".build-card[data-build-paid]").forEach(card=>{card.hidden=buildFilter.dataset.buildFilter==="free"&&card.dataset.buildPaid==="true";});}return;}
 const chip=e.target.closest("[data-loadout-type]");
 if(chip){e.preventDefault();e.stopPropagation();const type=chip.dataset.loadoutType,label=chip.dataset.loadoutName;if(type==="perk")ensureCharacterPortraits().finally(()=>openLoadoutInfo(type,label));else openLoadoutInfo(type,label);return;}
 if(e.target.closest("#loadoutInfoModal .detail-close")||e.target.id==="loadoutInfoModal"){const m=document.getElementById("loadoutInfoModal");if(m)m.classList.remove("open");document.body.classList.remove("modal-open");}
});
