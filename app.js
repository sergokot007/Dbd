const API='https://dbd.tricky.lol/api';
const SOURCE='https://dbd.source.gs/api';
const TYPES={
characters:{title:'Персонажи',label:'THE ROSTER',endpoint:'characters',source:SOURCE+'/characters/'},
perks:{title:'Перки',label:'TEACHABLES & ABILITIES',endpoint:'perks'},
items:{title:'Предметы',label:'TOOLS OF SURVIVAL',endpoint:'items',source:SOURCE+'/items/'},
maps:{title:'Карты',label:'THE REALMS',endpoint:'maps'}
};
let tab='characters',all=[],filter='Все',favorites=[];
try{favorites=JSON.parse(localStorage.getItem('dbd-favorites')||'[]')}catch{}
const $=s=>document.querySelector(s);
const norm=x=>String(x??'').toLowerCase();
function arr(d){if(Array.isArray(d))return d;for(const k of ['data','results','items','characters','perks','maps','realms','killers','survivors','offerings','addons'])if(Array.isArray(d?.[k]))return d[k];return []}
function name(x){return x.name||x.displayName||x.display_name||x.title||x.killerName||x.id||'Без названия'}
function desc(x){return x.description||x.desc||x.effect||x.power||x.contentText||x.content||''}
function image(x){return x.image||x.imageUrl||x.image_url||x.icon||x.iconUrl||x.icon_url||x.iconURL||x.portrait||x.portraitURL||''}
function category(x){return x.role||x.type||x.category||x.realm||x.faction||x.characterName||''}
function id(x){return String(x.id||x._id||x.name||name(x))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateFav(){$('#favCount').textContent=favorites.length;localStorage.setItem('dbd-favorites',JSON.stringify(favorites))}
async function getData(url){const r=await fetch(url,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function load(){
 if(tab==='favorites'){render();return}
 $('#notice').textContent='Ищем записи в Тумане…';$('#grid').innerHTML='';
 const cfg=TYPES[tab],sources=[...(cfg.source?[cfg.source]:[]),API+'/'+cfg.endpoint];let lastError;
 for(const url of sources){try{
  const data=arr(await getData(url));if(!data.length)throw Error('Источник вернул пустой список');
  all=data;$('#connection').textContent=url.startsWith(SOURCE)?'Резервная база подключена':'База подключена';$('#connection').classList.add('ok');render();return;
 }catch(e){lastError=e}}
 all=[];$('#notice').textContent='Не удалось загрузить этот раздел. Источник данных временно недоступен. ('+(lastError?.message||'ошибка')+')';
 $('#connection').textContent='Нет соединения';$('#connection').classList.remove('ok');render();
}
function render(){
 const cfg=TYPES[tab];$('#sectionTitle').textContent=tab==='favorites'?'Избранное':cfg.title;$('#sectionLabel').textContent=tab==='favorites'?'YOUR COLLECTION':cfg.label;
 const data=tab==='favorites'?favorites.map(x=>x.data):all,q=norm($('#search').value.trim()),cats=['Все',...new Set(data.map(category).filter(Boolean))];
 if(!cats.includes(filter))filter='Все';
 $('#filters').innerHTML=cats.length>2?cats.map(c=>'<button class="'+(filter===c?'active':'')+'" data-filter="'+esc(c)+'">'+esc(c)+'</button>').join(''):'';
 const shown=data.filter(x=>(filter==='Все'||category(x)===filter)&&(!q||norm(name(x)+' '+desc(x)+' '+category(x)).includes(q)));
 $('#notice').textContent=shown.length?'Найдено: '+shown.length:'Ничего не найдено';
 $('#grid').innerHTML=shown.map(x=>{const key=id(x),src=image(x),saved=favorites.some(f=>f.key===key);return '<article class="item"><div class="art">'+(src?'<img loading="lazy" src="'+esc(src)+'" alt="" onerror="this.remove()">':'<span class="placeholder">✣</span>')+'</div><div class="itembody"><div class="kind">'+esc(category(x)||cfg?.title||'DBD')+'</div><h3>'+esc(name(x))+'</h3><p>'+esc(desc(x)||'Информация об этой записи доступна в игровом справочнике.')+'</p><div class="cardbottom"><small>'+esc(x.realm||x.characterName||x.character||'DEAD BY DAYLIGHT')+'</small><button class="fav '+(saved?'saved':'')+'" data-fav="'+esc(key)+'">'+(saved?'♥':'♡')+'</button></div></div></article>'}).join('')||'<div class="empty">В этой части Тумана пока пусто.</div>';
}
function switchTab(t){tab=t;filter='Все';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));$('#search').value='';load()}
document.addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t){switchTab(t.dataset.tab);return}const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return}const b=e.target.closest('[data-fav]');if(b){const key=b.dataset.fav,item=(tab==='favorites'?favorites.map(x=>x.data):all).find(x=>id(x)===key);if(favorites.some(x=>x.key===key))favorites=favorites.filter(x=>x.key!==key);else if(item)favorites.push({key,data:item});updateFav();render()}});
$('#search').addEventListener('input',render);$('#refresh').addEventListener('click',load);updateFav();load();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
