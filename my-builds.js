/* Builds restricted to perks the player has unlocked. */
(function(){
 const STORE='dbd-owned-characters-v1';
 const GENERAL={survivors:['Déjà Vu','Kindred','Lightweight','No One Left Behind','Resilience','Slippery Meat','Spine Chill','This Is Not Happening',"We'll Make It"],killers:['Bitter Murmur','Deerstalker','Hex: No One Escapes Death','Insidious','Iron Grasp','Monstrous Shrine','Sloppy Butcher','Spies from the Shadows','Unrelenting','Whispers']};
 const TASKS={
  survivors:[
   {id:'chase',title:'Долгая погоня',desc:'Преимущества для окон, паллет и продления преследования.',terms:['chase','loop','pallet','vault','window','exhaustion','speed','ускор','погон','окн','паллет','прыж'],known:['Windows of Opportunity','Lithe','Sprint Burst','Balanced Landing','Dead Hard','Finesse','Resilience','Made for This','Adrenaline','Quick & Quiet','Dance With Me','Overcome']},
   {id:'gens',title:'Быстрый ремонт',desc:'Скорость ремонта, совместная починка и контроль проверок реакции.',terms:['generator','repair','gen','skill check','toolbox','генератор','ремонт','провер'],known:['Déjà Vu','Prove Thyself','Hyperfocus','Stake Out','Fast Track','Built to Last','Potential Energy','Friendly Competition','Technician','Resilience']},
   {id:'heal',title:'Лечение команды',desc:'Лечение союзников, самовосстановление и поддержка раненых.',terms:['heal','healing','injured','health','леч','ранен','здоров','аптеч'],known:['Botany Knowledge',"We'll Make It",'Empathy','Self-Care',"We'll Make It",'Bite the Bullet','Desperate Measures','Resurgence','Autodidact','Aftercare','Weaving Spiders']},
   {id:'stealth',title:'Скрытность',desc:'Меньше шума и следов, скрытие аур и безопасный отход.',terms:['scratch','aura','quiet','silent','hide','footstep','след','шум','аур','скрыт'],known:['Distortion','Lightweight','Calm Spirit','Urban Evasion','Iron Will','Lucky Break','Quick & Quiet','Dance With Me','Off the Record','Low Profile','Poised']},
   {id:'solo',title:'Одиночная игра',desc:'Информация о союзниках и убийце, ремонт и личное выживание.',terms:['aura','information','generator','chase','обнаруж','информац','генератор','погон'],known:['Windows of Opportunity','Déjà Vu','Bond','Lithe','Kindred','Alert','Fogwise','Object of Obsession','Detective\'s Hunch','Inner Focus']},
   {id:'rescue',title:'Спасение и поддержка',desc:'Безопасные снятия с крюка и помощь команде.',terms:['hook','unhook','protection','heal','крюк','сняти','защит','леч'],known:['Kindred','We\'ll Make It','Borrowed Time','We\'re Gonna Live Forever','Deliverance','Reassurance','Off the Record','Background Player','Guardian','Breakout']}
  ],
  killers:[
   {id:'slow',title:'Замедление генераторов',desc:'Регресс генераторов, блокировки и давление на ремонт.',terms:['generator','regression','repair','blocked','regress','генератор','регресс','ремонт','блок'],known:['Pop Goes the Weasel','Scourge Hook: Pain Resonance','Deadlock','Corrupt Intervention','Grim Embrace','Eruption','Overcharge','Nowhere to Hide','Call of Brine','Surge','Jolt','Pain Resonance','Hex: Ruin','Thrilling Tremors','Dead Man\'s Switch','No Way Out']},
   {id:'info',title:'Поиск выживших',desc:'Ауры, уведомления и обнаружение следующей цели.',terms:['aura','reveal','notify','loud noise','information','аур','обнаруж','уведом','информац'],known:['Lethal Pursuer','Barbecue & Chilli','Nowhere to Hide','I\'m All Ears','Discordance','A Nurse\'s Calling','Whispers','Bitter Murmur','Surveillance','Thrilling Tremors','Tinkerer','Gearhead','Ultimate Weapon']},
   {id:'chase',title:'Сильная погоня',desc:'Преимущества для преследования и обхода паллет и окон.',terms:['chase','pallet','vault','bloodlust','hit','погон','паллет','окн','удар'],known:['Bamboozle','Spirit Fury','Enduring','Brutal Strength','Hubris','Superior Anatomy','Save the Best for Last','Play with Your Food','I\'m All Ears','Coup de Grâce','Fire Up','Unbound']},
   {id:'pressure',title:'Постоянное давление',desc:'Наказание за лечение, группировку и ошибки команды.',terms:['injured','heal','exposed','down','slug','ранен','леч','уязвим','повален'],known:['Sloppy Butcher','Thanatophobia','Infectious Fright','Starstruck','Coulrophobia','A Nurse\'s Calling','Forced Penance','Deathbound','Gift of Pain','Leverage','Dying Light','Blood Echo']},
   {id:'endgame',title:'Контроль эндгейма',desc:'Задержка ворот и усиление в конце матча.',terms:['exit gate','endgame','gate','hook','ворот','конец матча','крюк'],known:['No Way Out','Blood Warden','Remember Me','Hex: No One Escapes Death','Terminus','Fire Up','Bitter Murmur','Rancor']}
  ]
 };
 let catalog=null,side='survivors',task='chase',owned={survivors:[],killers:[]},search='';
 const $=s=>document.querySelector(s);
 const key=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яё]/gi,'');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const records=d=>Array.isArray(d)?d:(d&&Object.values(d).find(Array.isArray))||[];
 const charName=c=>String(c.nameEn||c.englishName||c.name_en||c.english_name||c.name||c.displayName||c.display_name||c.title||'');
 const displayName=c=>String(c.displayName||c.display_name||c.nameRu||c.name_ru||c.name||charName(c));
 const isKiller=c=>{const h=[c.role,c.type,c.category,c.faction,c.side,c.characterType,c.character_type,c.group].filter(Boolean).join(' ').toLowerCase();return c.isKiller===true||c.is_killer===true||/killer|убийц/.test(h)||!!(c.power||c.ability||c.killerPower)};
 const imageOf=x=>{const v=x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.portrait||x.portraitURL||x.perkIcon||x.perk_icon;return typeof v==='string'?v:(v?.url||v?.src||'')};
 const ownerMap=()=>catalog?.translations?.perkOwners||{};
 function perkOwner(p){
  const direct=p.characterName||p.character_name||p.character||p.owner||p.survivor||p.killer||p.ownerName||p.owner_name;
  if(direct)return String(direct);
  const map=ownerMap(),ids=[p.id,p.slug,p.nameEn,p.englishName,p.name_en,p.english_name,p.name,p.displayName].filter(Boolean).map(String);
  for(const id of ids){if(map[id])return String(map[id]);const hit=Object.entries(map).find(([k])=>key(k)===key(id));if(hit)return String(hit[1])}
  return '';
 }
 function isGeneral(p){const o=perkOwner(p),names=[p.nameEn,p.englishName,p.name_en,p.english_name,p.slug,p.id,p.name,p.displayName].filter(Boolean).map(key);return p.isGeneral===true||p.is_general===true||p.general===true||/^(general|общие перки|общий перк|all characters)$/i.test(o)||GENERAL[side].some(n=>names.includes(key(n)))||/general|общ(ий|ая|ие)|без владельца/i.test(String(p.sourceType||p.source_type||p.unlockType||p.unlock_type||''))}
 function perkName(p){return String(p.nameRu||p.name_ru||p.russianName||p.russian_name||p.displayName||p.display_name||p.name||p.nameEn||p.id||'Перк')}
 function perkDescription(p){return String(p.descriptionRu||p.description_ru||p.description||p.desc||p.effect||'')}
 function availablePerks(){
  const chars=catalog.characters.filter(c=>isKiller(c)===(side==='killers'));
  const chosen=new Set(chars.filter(c=>owned[side].some(n=>key(n)===key(charName(c)))).map(c=>key(charName(c))));
  return catalog.perks.filter(p=>{const o=perkOwner(p);return o?(/^(general|общие перки|общий перк|all characters)$/i.test(o)||chosen.has(key(o))):isGeneral(p)});
 }
 function makeBuild(){
  const t=TASKS[side].find(x=>x.id===task)||TASKS[side][0],available=availablePerks();
  const known=t.known.map(key);
  const scored=available.map((p,i)=>{
   const n=key([p.nameEn,p.englishName,p.name_en,p.english_name,p.slug,p.id,p.name,p.displayName].join(' '));
   const body=key([p.description,p.desc,p.effect,perkDescription(p)].join(' '));
   const exact=known.findIndex(x=>n.includes(x));
   const termHits=t.terms.filter(x=>body.includes(key(x))||n.includes(key(x))).length;
   return {p,i,score:(exact>=0?100+(known.length-exact):0)+termHits};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
  const picked=[];
  for(const x of scored){if(picked.length===4)break;if(!picked.some(p=>key(perkName(p))===key(perkName(x.p))))picked.push(x.p)}
  return {taskData:t,picked,availableCount:available.length,matched:scored.length};
 }
 function save(){try{localStorage.setItem(STORE,JSON.stringify(owned))}catch(e){}}
 function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');owned={survivors:Array.isArray(x.survivors)?x.survivors:[],killers:Array.isArray(x.killers)?x.killers:[]}}catch(e){}}
 function render(){
  const grid=$('#grid');if(!grid)return;
  const chars=catalog.characters.filter(c=>isKiller(c)===(side==='killers'));
  const chosen=new Set(owned[side].map(key)),query=key(search),build=makeBuild();
  $('#sectionTitle').textContent='Мои персонажи';$('#sectionLabel').textContent='MY UNLOCKED ROSTER';
  $('#filters').innerHTML='<div class="mybuild-side"><button data-my-side="survivors" class="'+(side==='survivors'?'active':'')+'">Выжившие</button><button data-my-side="killers" class="'+(side==='killers'?'active':'')+'">Убийцы</button></div><div class="mybuild-task-label">Задача для билда</div><div class="mybuild-tasks">'+TASKS[side].map(t=>'<button data-my-task="'+t.id+'" class="'+(task===t.id?'active':'')+'">'+esc(t.title)+'</button>').join('')+'</div>';
  $('#notice').textContent='Отмечено персонажей: '+owned[side].length+' • доступно перков: '+build.availableCount;
  grid.classList.remove('build-grid','tier-grid');grid.classList.add('mybuild-layout');
  const roster='<section class="mybuild-roster"><div class="mybuild-roster-head"><h3>Твои '+(side==='killers'?'убийцы':'выжившие')+'</h3><span>'+owned[side].length+' выбрано</span></div><p>Отметь персонажей, чьи уникальные перки открыты на аккаунте. Выбор сохранится на этом устройстве.</p><div class="mybuild-character-list">'+chars.filter(c=>!query||key(charName(c)+' '+displayName(c)).includes(query)).map(c=>{const n=charName(c),on=chosen.has(key(n)),img=imageOf(c);return '<label class="mybuild-character '+(on?'selected':'')+'"><input type="checkbox" data-owned-character="'+esc(n)+'" '+(on?'checked':'')+'><span class="mybuild-check">'+(on?'✓':'')+'</span>'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="mybuild-no-portrait">✣</span>')+'<span class="mybuild-character-name">'+esc(displayName(c))+'</span></label>'}).join('')||'<div class="empty">Персонажи не найдены.</div>'+'</div></section>';
  const cards=build.picked.map(p=>{const img=imageOf(p);return '<article class="mybuild-perk"><div class="mybuild-perk-image">'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" onerror="this.remove()">':'<span>✣</span>')+'</div><div><b>'+esc(perkName(p))+'</b><small>'+esc(perkOwner(p)||'Общий перк')+'</small><p>'+esc(perkDescription(p)||'Описание отсутствует в каталоге.')+'</p></div></article>'}).join('');
  const empty=!owned[side].length?'Сначала отметь открытых персонажей.':!build.availableCount?'Для выбранных персонажей не удалось сопоставить доступные перки в каталоге.':!build.picked.length?'В базе пока нет надёжного совпадения перков с этой задачей. Не буду подставлять случайные перки.':'';
  const buildHtml='<section class="mybuild-result"><div class="mybuild-result-top"><div><span class="eyebrow">PERSONAL LOADOUT</span><h3>'+esc(build.taskData.title)+'</h3><p>'+esc(build.taskData.desc)+'</p></div><button type="button" data-my-copy '+(!build.picked.length?'disabled':'')+'>Копировать</button></div><div class="mybuild-perks">'+(cards||'<p class="mybuild-empty">'+esc(empty)+'</p>')+'</div><div class="mybuild-foot">'+build.picked.length+' из 4 перков подобрано · '+build.availableCount+' доступно · '+build.matched+' совпадений по задаче</div></section>';
  grid.innerHTML='<div class="mybuild-main">'+roster+buildHtml+'</div>';
 }
 async function init(){loadSaved();try{catalog=await localCatalog();catalog={...catalog,characters:records(catalog.characters),perks:records(catalog.perks),translations:catalog.translations||{}};render()}catch(e){$('#notice').textContent='Не удалось загрузить каталог персонажей и перков. Попробуй обновить данные позже.';$('#grid').innerHTML='<div class="empty">Каталог недоступен.</div>'}}
 const searchInput=$('#search');if(searchInput)searchInput.addEventListener('input',()=>{if(tab==='mybuilds'){search=searchInput.value;render()}});
 document.addEventListener('change',e=>{const input=e.target.closest('[data-owned-character]');if(input&&tab==='mybuilds'){const n=input.dataset.ownedCharacter;owned[side]=input.checked?[...owned[side].filter(x=>key(x)!==key(n)),n]:owned[side].filter(x=>key(x)!==key(n));save();render()}});
 document.addEventListener('click',e=>{
  const s=e.target.closest('[data-my-side]');if(s&&tab==='mybuilds'){side=s.dataset.mySide;task=TASKS[side][0].id;render();return}
  const t=e.target.closest('[data-my-task]');if(t&&tab==='mybuilds'){task=t.dataset.myTask;render();return}
  if(e.target.closest('[data-my-copy]')&&tab==='mybuilds'){const b=makeBuild();const value=b.taskData.title+'\n'+b.picked.map(perkName).join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>{$('[data-my-copy]').textContent='Скопировано ✓'}).catch(()=>{});return}
 });
 window.renderMyBuilds=render;window.loadMyBuilds=init;
})();