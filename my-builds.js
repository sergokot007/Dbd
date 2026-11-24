/* Personal loadout builder: only perks belonging to selected characters and explicit general perks. */
(function(){
 const STORE='dbd-owned-characters-v1';
 const TASKS={
  survivors:[
   {id:'chase',title:'Долгая погоня',desc:'Окна, паллеты и инструменты для увеличения времени погони.',keys:['chase','loop','pallet','vault','window','exhaustion','speed','ускор','погон','окн','паллет','прыж']},
   {id:'gens',title:'Быстрый ремонт',desc:'Эффективная починка генераторов и командная работа.',keys:['generator','repair','gen','skill check','toolbox','генератор','ремонт','провер']},
   {id:'heal',title:'Лечение команды',desc:'Поиск раненых, ускоренное лечение и помощь союзникам.',keys:['heal','healing','injured','health','леч','ранен','здоров','аптеч']},
   {id:'stealth',title:'Скрытность',desc:'Снижение шума, следов и риска быть обнаруженным.',keys:['scratch','aura','quiet','silent','hide','footstep','след','шум','аур','скрыт']},
   {id:'solo',title:'Одиночная игра',desc:'Самостоятельная информация, ремонт и надёжный инструмент для погони.',keys:['aura','information','generator','chase','обнаруж','информац','генератор','погон']},
   {id:'rescue',title:'Спасение и поддержка',desc:'Безопасные снятия с крюка и помощь команде.',keys:['hook','unhook','protection','heal','крюк','сняти','защит','леч']}
  ],
  killers:[
   {id:'slow',title:'Замедление генераторов',desc:'Давление на ремонт и наказание за прогресс команды.',keys:['generator','regression','repair','blocked','regress','генератор','регресс','ремонт','блок']},
   {id:'info',title:'Поиск выживших',desc:'Ауры, уведомления и обнаружение следующей цели.',keys:['aura','reveal','notify','loud noise','information','аур','обнаруж','уведом','информац']},
   {id:'chase',title:'Сильная погоня',desc:'Помощь в преследовании, обходе паллет и окон.',keys:['chase','pallet','vault','bloodlust','hit','погон','паллет','окн','удар']},
   {id:'pressure',title:'Постоянное давление',desc:'Наказание за лечение, группировку и ошибки команды.',keys:['injured','heal','exposed','down','slug','ранен','леч','уязвим','повален']},
   {id:'endgame',title:'Контроль эндгейма',desc:'Задержка ворот и усиление в конце матча.',keys:['exit gate','endgame','gate','hook','ворот','конец матча','крюк']}
  ]
 };
 let catalog=null,side='survivors',task='chase',owned={survivors:[],killers:[]},search='';
 const $=s=>document.querySelector(s);
 const key=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яё]/gi,'');
 const escLocal=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const records=d=>Array.isArray(d)?d:(d&&Object.values(d).find(Array.isArray))||[];
 const charName=c=>String(c.nameEn||c.englishName||c.name_en||c.english_name||c.name||c.displayName||c.display_name||c.title||'');
 const displayName=c=>String(c.displayName||c.display_name||c.nameRu||c.name_ru||c.name||charName(c));
 const isKiller=c=>{const hint=[c.role,c.type,c.category,c.faction,c.side,c.characterType,c.character_type,c.group].filter(Boolean).join(' ').toLowerCase();return c.isKiller===true||c.is_killer===true||/killer|убийц/.test(hint)||!!(c.power||c.ability||c.killerPower)};
 const imageOf=x=>{const v=x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.portrait||x.portraitURL||x.perkIcon||x.perk_icon;return typeof v==='string'?v:(v?.url||v?.src||'')};
 const ownerMap=()=>catalog?.translations?.perkOwners||window.__dbdPerkOwners||{};
 function perkOwner(p){
  const direct=p.characterName||p.character_name||p.character||p.owner||p.survivor||p.killer||p.ownerName||p.owner_name;
  if(direct)return String(direct);
  const map=ownerMap(), ids=[p.id,p.slug,p.nameEn,p.englishName,p.name_en,p.english_name,p.name,p.displayName].filter(Boolean).map(String);
  for(const id of ids){if(map[id])return String(map[id]);const found=Object.entries(map).find(([k])=>key(k)===key(id));if(found)return String(found[1])}
  return '';
 }
 function generalPerk(p){return p.isGeneral===true||p.is_general===true||p.general===true||/general|общ(ий|ая|ие)|без владельца/i.test(String(p.source||p.category||p.type||''))}
 function perkName(p){return String(p.nameRu||p.name_ru||p.russianName||p.russian_name||p.displayName||p.display_name||p.name||p.nameEn||p.id||'Перк')}
 function perkDescription(p){return String(p.descriptionRu||p.description_ru||p.description||p.desc||p.effect||'')}
 function selectedNames(){return new Set(owned[side].map(key))}
 function availablePerks(){
  const chars=(catalog?.characters||[]).filter(c=>isKiller(c)===(side==='killers'));
  const chosen=new Set(chars.filter(c=>selectedNames().has(key(charName(c)))).map(c=>key(charName(c))));
  return (catalog?.perks||[]).filter(p=>{const o=perkOwner(p);return o?chosen.has(key(o)):generalPerk(p)});
 }
 function scorePerk(p,keys){
  const hay=key([p.nameEn,p.englishName,p.name,p.displayName,p.description,p.desc,p.effect,perkDescription(p)].join(' '));
  return keys.reduce((n,k)=>n+(hay.includes(key(k))?1:0),0);
 }
 function makeBuild(){
  const taskData=TASKS[side].find(x=>x.id===task)||TASKS[side][0],available=availablePerks();
  const scored=available.map((p,i)=>({p,i,score:scorePerk(p,taskData.keys)})).sort((a,b)=>b.score-a.score||a.i-b.i);
  const picked=[];
  for(const item of scored){if(picked.length===4)break;if(!picked.some(x=>key(perkName(x))===key(perkName(item.p))))picked.push(item.p)}
  return {taskData,picked,availableCount:available.length};
 }
 function save(){try{localStorage.setItem(STORE,JSON.stringify(owned))}catch(e){}}
 function loadSaved(){try{const x=JSON.parse(localStorage.getItem(STORE)||'{}');owned={survivors:Array.isArray(x.survivors)?x.survivors:[],killers:Array.isArray(x.killers)?x.killers:[]}}catch(e){}}
 function render(){
  const grid=$('#grid');if(!grid)return;
  const chars=(catalog?.characters||[]).filter(c=>isKiller(c)===(side==='killers'));
  const chosen=new Set(owned[side].map(key)),query=key(search);
  const visible=chars.filter(c=>!query||key(charName(c)+' '+displayName(c)).includes(query));
  const build=makeBuild(),taskOptions=TASKS[side];
  $('#sectionTitle').textContent='Мои персонажи';
  $('#sectionLabel').textContent='MY UNLOCKED ROSTER';
  $('#filters').innerHTML='<div class="mybuild-side"><button data-my-side="survivors" class="'+(side==='survivors'?'active':'')+'">Выжившие</button><button data-my-side="killers" class="'+(side==='killers'?'active':'')+'">Убийцы</button></div><div class="mybuild-task-label">Задача для билда</div><div class="mybuild-tasks">'+taskOptions.map(t=>'<button data-my-task="'+t.id+'" class="'+(task===t.id?'active':'')+'">'+escLocal(t.title)+'</button>').join('')+'</div>';
  $('#notice').textContent='Отметь персонажей, которые у тебя открыты. Выбрано: '+owned[side].length+' • доступно перков: '+build.availableCount;
  grid.classList.add('mybuild-layout');
  const roster='<section class="mybuild-roster"><div class="mybuild-roster-head"><h3>Твои '+(side==='killers'?'убийцы':'выжившие')+'</h3><span>'+owned[side].length+' выбрано</span></div><p>Отметь всех персонажей, чьи личные перки уже доступны на аккаунте. Выбор сохраняется на этом устройстве.</p><div class="mybuild-character-list">'+visible.map(c=>{const n=charName(c),on=chosen.has(key(n)),img=imageOf(c);return '<label class="mybuild-character '+(on?'selected':'')+'"><input type="checkbox" data-owned-character="'+escLocal(n)+'" '+(on?'checked':'')+'><span class="mybuild-check">'+(on?'✓':'')+'</span>'+(img?'<img src="'+escLocal(img)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="mybuild-no-portrait">✣</span>')+'<span class="mybuild-character-name">'+escLocal(displayName(c))+'</span></label>'}).join('')||'<div class="empty">Персонажи не найдены.</div>'+'</div></section>';
  const perks=build.picked.map(p=>{const img=imageOf(p),owner=perkOwner(p);return '<article class="mybuild-perk"><div class="mybuild-perk-image">'+(img?'<img src="'+escLocal(img)+'" alt="" loading="lazy" onerror="this.remove()">':'<span>✣</span>')+'</div><div><b>'+escLocal(perkName(p))+'</b><small>'+escLocal(owner||'Общий перк')+'</small><p>'+escLocal(perkDescription(p)||'Описание отсутствует в каталоге.')+'</p></div></article>'}).join('');
  const buildHtml='<section class="mybuild-result"><div class="mybuild-result-top"><div><span class="eyebrow">GENERATED LOADOUT</span><h3>'+escLocal(build.taskData.title)+'</h3><p>'+escLocal(build.taskData.desc)+'</p></div><button type="button" data-my-copy>Копировать</button></div><div class="mybuild-perks">'+(perks||'<p class="mybuild-empty">Выбери хотя бы одного персонажа, чтобы получить доступ к его личным перкам.</p>')+'</div><div class="mybuild-foot">'+(build.picked.length===4?'Сборка из 4 перков':'Найдено перков: '+build.picked.length+' из 4')+' · '+build.availableCount+' доступно в выбранном наборе</div></section>';
  grid.innerHTML='<div class="mybuild-main">'+roster+buildHtml+'</div>';
 }
 async function init(){
  loadSaved();
  try{catalog=await localCatalog();catalog={...catalog,characters:records(catalog.characters),perks:records(catalog.perks)};render()}
  catch(e){$('#notice').textContent='Не удалось загрузить каталог персонажей и перков. Попробуй обновить данные позже.';$('#grid').innerHTML='<div class="empty">Каталог недоступен.</div>'}
 }
 function openTab(){
  side='survivors';task='chase';search='';$('#search').value='';$('#grid').classList.remove('build-grid');$('#filters').innerHTML='';$('#grid').classList.add('mybuild-layout');
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='mybuilds'));
  init();
 }
 const originalSwitch=window.switchTab||switchTab;
 window.switchTab=function(t){if(t==='mybuilds'){tab='mybuilds';filter='Все';openTab();return}return originalSwitch(t)};
 const searchInput=$('#search');
 if(searchInput)searchInput.addEventListener('input',()=>{if(tab==='mybuilds'){search=searchInput.value;render()}});
 document.addEventListener('change',e=>{const input=e.target.closest('[data-owned-character]');if(input&&tab==='mybuilds'){const n=input.dataset.ownedCharacter,list=owned[side];owned[side]=input.checked?[...list.filter(x=>key(x)!==key(n)),n]:list.filter(x=>key(x)!==key(n));save();render()}});
 document.addEventListener('click',e=>{
  const s=e.target.closest('[data-my-side]');if(s&&tab==='mybuilds'){side=s.dataset.mySide;task=TASKS[side][0].id;render();return}
  const t=e.target.closest('[data-my-task]');if(t&&tab==='mybuilds'){task=t.dataset.myTask;render();return}
  if(e.target.closest('[data-my-copy]')&&tab==='mybuilds'){const b=makeBuild(),textValue=b.taskData.title+'\n'+b.picked.map(perkName).join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(textValue).then(()=>{$('[data-my-copy]').textContent='Скопировано ✓'}).catch(()=>{});return}
 });
 window.renderMyBuilds=render;
 window.loadMyBuilds=init;
})();
