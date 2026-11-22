const survivorBuilds = [
{title:"Универсальный / соло",goal:"Стабильная игра в одиночку",perks:["Sprint Burst","Decisive Strike","Windows of Opportunity","Déjà Vu"],why:"Мобильность, защита после снятия с крюка, ориентирование в погоне и помощь команде с генераторами."},
{title:"Погони и петли",goal:"Дольше отвлекать убийцу",perks:["Lithe","Windows of Opportunity","Resilience","Finesse"],why:"Помогает выбирать безопасные маршруты и получать преимущество у окон и препятствий."},
{title:"Быстрые генераторы",goal:"Сосредоточиться на цели",perks:["Déjà Vu","Prove Thyself","Stake Out","Built to Last"],why:"Поиск выгодных генераторов, ускорение совместной починки и эффективное использование ящика."},
{title:"Спасение и поддержка",goal:"Помогать команде",perks:["Kindred","We'll Make It","Reassurance","Empathy"],why:"Информация о ситуации на крюке, быстрое лечение и более безопасные спасения."},
{title:"Скрытность",goal:"Избегать обнаружения",perks:["Iron Will","Lightweight","Quick & Quiet","Lucky Break"],why:"Меньше шума и следов, проще разорвать контакт и сменить позицию."}
];
const killerBuilds = [
{title:"Универсальный контроль",goal:"Давление на генераторы",perks:["Corrupt Intervention","Pop Goes the Weasel","Grim Embrace","No Holds Barred"],why:"Сдерживает ранний прогресс и создаёт давление через повешения и регресс генераторов."},
{title:"Поиск и информация",goal:"Быстро находить выживших",perks:["Lethal Pursuer","Barbecue & Chilli","Nowhere to Hide","I'm All Ears"],why:"Помогает начать погоню сразу, находить следующую цель после крюка и не терять след."},
{title:"Сильная погоня",goal:"Быстрее сокращать дистанцию",perks:["Bamboozle","Brutal Strength","Enduring","Spirit Fury"],why:"Ускоряет разрушение препятствий и помогает выигрывать столкновения у окон и палет."},
{title:"Давление на команду",goal:"Наказывать за ошибки",perks:["Infectious Fright","Deadlock","Scourge Hook: Pain Resonance","Hex: No One Escapes Death"],why:"Даёт информацию о позициях и мешает команде восстановить темп."}
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
function showDbdCharacter(card){
 if(typeof tab!=="undefined"&&tab!=="characters")return;
 if(card.querySelector("[data-fav]")?.matches(":active"))return;
 const key=card.querySelector("h3")?.textContent||"";
 const data=typeof all!=="undefined"?all.find(x=>(x.name||x.displayName||x.display_name||x.title||x.killerName||x.id)===key):null;
 if(!data)return;
 const isK=isDbdKiller(data),builds=isK?killerBuilds:survivorBuilds;
 const img=data.image||data.imageUrl||data.image_url||data.icon||data.iconUrl||data.icon_url||data.iconURL||data.portrait||data.portraitURL||"";
 const addons=data.addons||data.add_ons||data.addOns||data.powerAddons||data.power_addons;
 let modal=document.getElementById("characterModal");
 if(!modal){modal=document.createElement("div");modal.id="characterModal";modal.className="detail-overlay";document.body.appendChild(modal)}
 modal.innerHTML='<section class="detail-panel"><button class="detail-close" aria-label="Закрыть">×</button><div class="detail-head">'+(img?'<img src="'+detailEsc(img)+'" alt="">':'<div class="detail-placeholder">✣</div>')+'<div><div class="eyebrow">'+(isK?"KILLER DOSSIER":"SURVIVOR DOSSIER")+'</div><h2>'+detailEsc(key)+'</h2><span class="detail-role">'+(isK?"Убийца":"Выживший")+'</span></div></div><div class="detail-copy"><h3>Описание персонажа</h3><p>'+detailEsc(dossiers[key]||(isK?"Убийца со своей уникальной силой и тактикой. Используй способность, чтобы создавать давление, выбирать выгодные маршруты и не давать выжившим спокойно выполнять генераторы.":"Выживший со своим набором личных перков. Базовые характеристики выживших одинаковы, поэтому выбор персонажа — это прежде всего выбор личных перков и любимого стиля игры."))+'</p>'+(data.description||data.desc||data.effect?'<p>'+detailEsc(data.description||data.desc||data.effect)+'</p>':"")+(data.power||data.ability?'<h3>Особенность</h3><p>'+detailEsc(data.power||data.ability)+'</p>':"")+'</div><div class="build-section"><div class="eyebrow">RECOMMENDED LOADOUTS</div><h3>Подходящие билды</h3>'+builds.map((b,i)=>'<article class="build-card"><div class="build-title"><div><h4>'+detailEsc(b.title)+'</h4><small>'+detailEsc(b.goal)+'</small></div><span>0'+(i+1)+'</span></div><div class="perk-chips">'+b.perks.map(p=>'<span>'+detailEsc(p)+'</span>').join("")+'</div><p>'+detailEsc(b.why)+'</p></article>').join("")+'</div>'+(isK?'<div class="build-section"><div class="eyebrow">POWER ADD-ONS</div><h3>Аддоны убийцы</h3>'+(Array.isArray(addons)&&addons.length?'<div class="addon-list">'+addons.slice(0,12).map(a=>'<div class="addon-row"><b>'+detailEsc(a.name||a.title||"Аддон")+'</b><small>'+detailEsc(a.description||a.effect||"Аддон силы персонажа")+'</small></div>').join("")+'</div>':'<p class="addon-note">Точные названия аддонов этого убийцы пока отсутствуют в подключённой базе. Не буду выдавать случайные предметы за лучшие. Для этого убийцы подбирай пару аддонов, усиливающих его ключевую механику: перезарядку, дальность, скорость, длительность или число зарядов. Когда база аддонов будет доступна, здесь появятся конкретные названия и эффекты.</p>')+'</div>':'<div class="build-section"><div class="eyebrow">SURVIVOR GEAR</div><h3>Предметы под роль</h3><p class="addon-note">Генераторы — ящик с инструментами. Поддержка и лечение — аптечка. Разведка — карта. Спасения и отвлечение — фонарь. Выбирай аддоны предмета под задачу матча.</p></div>')+(data.link?'<a class="wiki-link" href="'+detailEsc(data.link)+'" target="_blank" rel="noopener">Открыть полное досье ↗</a>':"")+'</section>';
 modal.classList.add("open");document.body.classList.add("modal-open");
}
function closeDbdCharacter(){const m=document.getElementById("characterModal");if(m)m.classList.remove("open");document.body.classList.remove("modal-open")}
document.addEventListener("click",e=>{
 if(e.target.closest(".detail-close")||e.target.id==="characterModal"){closeDbdCharacter();return}
 const card=e.target.closest("#grid .item");if(card&&!e.target.closest("[data-fav]")){showDbdCharacter(card)}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDbdCharacter()});
