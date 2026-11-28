/* A real map browser: location artwork, bundled 3D views and optional plans. */
(function(){
 'use strict';
 const META=window.DBD_MAP_META||{};
 const ALIASES=window.DBD_MAP_ALIASES||{};
 const FALLBACK=window.DBD_FALLBACK_MAPS||[];
 const GENERIC='./assets/ui/map-fallback.webp';
 let realmFilter='Все';

 const rawKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const mapKey=value=>{const key=rawKey(value);return key.startsWith('the')?key.slice(3):key;};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const englishName=record=>{
  const direct=record.nameEn||record.englishName||record.name_en||record.english_name||record.slug||'';
  if(direct)return String(direct);
  const display=String(record.displayName||record.display_name||record.name||record.title||'');
  const parenthesized=display.match(/\(([^)]+)\)\s*$/);
  if(parenthesized&&/[a-z]/i.test(parenthesized[1]))return parenthesized[1];
  return display;
 };
 const metaFor=record=>{
  const english=englishName(record),raw=rawKey(english),key=mapKey(english);
  const main=ALIASES[raw]||ALIASES[key]||key;
  let meta=META[main]||META[key]||META[raw];
  if(!meta){
   const found=Object.keys(META).find(k=>k&&raw&&(raw.includes(k)||k.includes(raw)));
   if(found)meta=META[found];
  }
  return meta||null;
 };
 const hooksLabel=value=>{
  const match=String(value||'').match(/(\d+)\D+(\d+)/);
  if(match)return match[1]+'–'+match[2]+' крюков';
  const one=String(value||'').match(/\d+/);
  return one?one[0]+' крюков':'Крюки не указаны';
 };
 const short=value=>{const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>150?text.slice(0,147)+'…':text;};

 function mapInfo(record){
  const meta=metaFor(record),english=englishName(record)||meta?.en||'',key=mapKey(english)||String(record.mapKey||record.id||'');
  const cover=image(record)||meta?.cover||GENERIC;
  const thumb=meta?.thumb||(meta?.tacticals?.[0]?.thumb)||(meta?.plans?.[0]?.src)||GENERIC;
  return {
   record,meta,key,id:String(record.id||record._id||key),english,
   title:name(record)||meta?.ru||english||'Карта',
   ru:meta?.ru||String(record.name||''),
   realm:record.realm||record.category||meta?.realm||'Другие владения',
   hooks:record.hooks||meta?.hooks||'',
   description:desc(record)||meta?.description||'',
   cover,thumb,
   tactical:meta?.tacticals||[],plans:meta?.plans||[]
  };
 }
 function mapRecords(){
  const source=(typeof tab!=='undefined'&&tab==='maps'&&Array.isArray(all)&&all.length)?all:FALLBACK;
  return source.filter(Boolean).map(mapInfo);
 }
 function viewsFor(info){
  const views=[{
   label:'Локация',hint:'Арт локации',src:info.cover,
   fallback:info.thumb!==GENERIC?info.thumb:GENERIC,
   alt:'Изображение локации '+info.title
  }];
  for(const item of info.tactical)views.push({label:item.label||'3D-схема',hint:'Объёмная схема локации',src:item.src,fallback:item.fallback||GENERIC,alt:'3D-схема '+info.title});
  for(const item of info.plans)views.push({label:item.label||'План',hint:'План этажей и проходов',src:item.src,fallback:item.fallback||GENERIC,alt:'План '+info.title});
  return views;
 }
 function setGridLayout(className){
  if(typeof window.setGridLayout==='function')window.setGridLayout(className);
  else{const grid=document.getElementById('grid');if(grid)grid.className='grid'+(className?' '+className:'');}
 }
 function findMap(key){
  const needle=String(key||''),list=mapRecords();
  return list.find(x=>x.key===needle||x.id===needle||rawKey(x.english)===rawKey(needle)||mapKey(x.english)===mapKey(needle))||null;
 }
 window.mapRecordKey=function(record){
  if(!record)return '';
  const info=mapInfo(record);
  return info.key||String(record.mapKey||record.id||'');
 };

 window.renderMaps=function(){
  const grid=document.getElementById('grid');if(!grid)return;
  setGridLayout('map-grid');
  const list=mapRecords(),query=norm(document.getElementById('search')?.value.trim()||'');
  const searches=list.filter(x=>!query||norm([x.title,x.english,x.ru,x.realm,x.description].join(' ')).includes(query));
  const counts=new Map();
  searches.forEach(x=>counts.set(x.realm,(counts.get(x.realm)||0)+1));
  const realms=['Все',...[...counts.keys()].sort((a,b)=>a.localeCompare(b,'ru'))];
  if(!realms.includes(realmFilter))realmFilter='Все';
  const shown=searches.filter(x=>realmFilter==='Все'||x.realm===realmFilter);
  $('#sectionTitle').textContent='Карты';
  $('#sectionLabel').textContent='THE REALMS • ART, 3D VIEWS & FLOOR PLANS';
  $('#filters').innerHTML='<div class="map-realm-filters">'+realms.map(realm=>'<button type="button" data-map-realm="'+esc(realm)+'" class="'+(realm===realmFilter?'active':'')+'">'+esc(realm)+(realm==='Все'?'':' <span>'+(counts.get(realm)||0)+'</span>')+'</button>').join('')+'</div><span class="builds-hint">Нажми карту, чтобы открыть арт, 3D-схему и план</span>';
  $('#notice').textContent=shown.length+' локаций • '+new Set(shown.map(x=>x.realm)).size+' владений • локальные схемы доступны без внешнего API';
  const groups=new Map();
  shown.forEach(x=>{if(!groups.has(x.realm))groups.set(x.realm,[]);groups.get(x.realm).push(x);});
  if(!shown.length){grid.innerHTML='<div class="empty">В этой части Тумана пока пусто.</div>';return;}
  grid.innerHTML=[...groups.entries()].map(([realm,cards])=>{
   return '<section class="map-realm"><div class="map-realm-head"><div><span class="eyebrow">REALM</span><h3>'+esc(realm)+'</h3></div><span>'+cards.length+' '+(cards.length===1?'карта':'карт')+'</span></div><div class="map-realm-grid">'+cards.map(info=>{
    const fav=(typeof favKey==='function'?favKey('maps',info.record):('maps:'+info.id));
    const saved=(typeof favorites!=='undefined'&&Array.isArray(favorites))&&favorites.some(f=>f&&f.key===fav);
    const cover=picture(info.cover,{className:'map-card-cover',alt:'Арт локации '+info.title,fallback:info.thumb,label:'✣'});
    const mini=picture(info.thumb,{className:'map-card-mini',alt:'',fallback:'./assets/ui/asset-fallback.webp',label:'3D'});
    return '<article class="map-card" data-map-open="'+esc(info.key)+'"><button class="map-card-art" type="button" data-map-open="'+esc(info.key)+'" aria-label="Открыть карту '+esc(info.title)+'">'+cover+'<span class="map-card-shade"></span><span class="map-card-realm">'+esc(info.realm)+'</span><span class="map-card-mini-wrap">'+mini+'<small>СХЕМА</small></span></button><div class="map-card-body"><div class="map-card-kicker">'+esc(hooksLabel(info.hooks))+'</div><h4><button type="button" data-map-open="'+esc(info.key)+'">'+esc(info.title)+'</button></h4><p>'+esc(info.english||'Dead by Daylight')+'</p>'+(info.description?'<div class="map-card-desc">'+esc(short(info.description))+'</div>':'')+'<div class="map-card-foot"><button type="button" class="map-card-open" data-map-open="'+esc(info.key)+'">Открыть карту ↗</button><button type="button" class="fav map-fav '+(saved?'saved':'')+'" data-fav="'+esc(fav)+'" aria-pressed="'+(saved?'true':'false')+'" aria-label="'+(saved?'Убрать из избранного':'Добавить в избранное')+'">'+(saved?'♥':'♡')+'</button></div></div></article>';
   }).join('')+'</div></section>';
  }).join('');
 };

 function applyTransform(modal){
  const zoom=Number(modal.dataset.zoom||1),x=Number(modal.dataset.panX||0),y=Number(modal.dataset.panY||0);
  const img=modal.querySelector('[data-map-viewer-image]');
  if(img)img.style.transform='translate('+x+'px,'+y+'px) scale('+zoom+')';
  const value=modal.querySelector('[data-map-zoom-value]');if(value)value.textContent=Math.round(zoom*100)+'%';
 }
 function setZoom(modal,value){
  const zoom=Math.max(1,Math.min(3,Math.round(value*100)/100));
  modal.dataset.zoom=String(zoom);
  if(zoom===1){modal.dataset.panX='0';modal.dataset.panY='0';}
  applyTransform(modal);
 }
 function switchView(modal,index){
  const views=JSON.parse(modal.dataset.mapViews||'[]'),view=views[index];if(!view)return;
  const stage=modal.querySelector('.map-viewer-stage');
  if(stage){
   stage.innerHTML=picture(view.src,{className:'map-viewer-img',alt:view.alt,fallback:view.fallback,eager:true,draggable:false,label:'✣',attrs:'data-map-viewer-image="1"'});
  }
  modal.dataset.viewIndex=String(index);modal.dataset.zoom='1';modal.dataset.panX='0';modal.dataset.panY='0';
  modal.querySelectorAll('[data-map-view]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.mapView)===index));
  const hint=modal.querySelector('[data-map-view-hint]');if(hint)hint.textContent=view.hint||'';
  applyTransform(modal);
 }
 function setupViewer(modal){
  modal.dataset.zoom='1';modal.dataset.panX='0';modal.dataset.panY='0';
  const stage=modal.querySelector('.map-viewer-stage');if(!stage)return;
  let dragging=false,startX=0,startY=0,startPanX=0,startPanY=0;
  stage.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   dragging=true;startX=event.clientX;startY=event.clientY;
   startPanX=Number(modal.dataset.panX||0);startPanY=Number(modal.dataset.panY||0);
   stage.classList.add('dragging');
   if(stage.setPointerCapture)try{stage.setPointerCapture(event.pointerId);}catch{}
  });
  stage.addEventListener('pointermove',event=>{
   if(!dragging)return;
   modal.dataset.panX=String(startPanX+event.clientX-startX);
   modal.dataset.panY=String(startPanY+event.clientY-startY);
   applyTransform(modal);
  });
  const end=()=>{dragging=false;stage.classList.remove('dragging');};
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('pointerleave',end);
  stage.addEventListener('wheel',event=>{event.preventDefault();setZoom(modal,Number(modal.dataset.zoom||1)+(event.deltaY<0?.15:-.15));},{passive:false});
  applyTransform(modal);
 }
 window.openMapDetail=function(key){
  const info=findMap(key);if(!info)return;
  const views=viewsFor(info),related=mapRecords().filter(x=>x.realm===info.realm&&x.key!==info.key).slice(0,8);
  const fav=(typeof favKey==='function'?favKey('maps',info.record):('maps:'+info.id));
  const saved=(typeof favorites!=='undefined'&&Array.isArray(favorites))&&favorites.some(f=>f&&f.key===fav);
  const html='<section class="detail-panel map-detail-panel"><button class="detail-close" aria-label="Закрыть">×</button>'+
   '<div class="eyebrow">MAP ATLAS • '+esc(info.realm)+'</div><h2>'+esc(info.title)+'</h2><p class="map-detail-en">'+esc(info.english)+'</p>'+
   '<div class="map-facts"><span>◈ '+esc(hooksLabel(info.hooks))+'</span><span>'+views.length+' вида</span><button type="button" class="fav map-fav '+(saved?'saved':'')+'" data-fav="'+esc(fav)+'" aria-pressed="'+(saved?'true':'false')+'">'+(saved?'♥ В избранном':'♡ В избранное')+'</button></div>'+
   '<div class="map-view-tabs">'+views.map((view,index)=>'<button type="button" data-map-view="'+index+'" class="'+(index?'':'active')+'">'+esc(view.label)+'</button>').join('')+'</div>'+
   '<div class="map-viewer-toolbar"><div class="map-zoom-controls"><button type="button" data-map-zoom-out aria-label="Уменьшить">−</button><span data-map-zoom-value>100%</span><button type="button" data-map-zoom-in aria-label="Увеличить">+</button><button type="button" data-map-zoom-reset>Сбросить</button></div><span data-map-view-hint>'+esc(views[0].hint)+'</span></div>'+
   '<div class="map-viewer-stage">'+picture(views[0].src,{className:'map-viewer-img',alt:views[0].alt,fallback:views[0].fallback,eager:true,draggable:false,label:'✣',attrs:'data-map-viewer-image="1"'})+'</div>'+
   '<div class="map-viewer-help"><span>Колесо мыши или +/− — масштаб</span><span>Перетаскивание — перемещение</span></div>'+
   (info.description?'<section class="map-detail-copy"><h3>О локации</h3><p>'+esc(info.description)+'</p></section>':'')+
   '<p class="map-warning">Схема показывает планировку, а не точную раскладку конкретного матча: паллеты, окна, генераторы и выходы меняются от вариации карты и генерации.</p>'+
   (related.length?'<section class="map-related"><h3>Другие карты владения</h3><div class="map-related-grid">'+related.map(item=>'<button type="button" data-map-related="'+esc(item.key)+'">'+picture(item.thumb,{className:'map-related-img',alt:'',fallback:'./assets/ui/asset-fallback.webp',label:'✣'})+'<span>'+esc(item.ru||item.title)+'</span></button>').join('')+'</div></section>':'')+
   '<div class="map-art-credit">Арт локаций: <a href="https://dbd.source.gs" target="_blank" rel="noopener">dbd.source.gs</a>. 3D-схемы SamoelColt и планы EagerFace: <a href="https://github.com/LucaFontanot/dbd-map-overlay" target="_blank" rel="noopener">DBD Map Overlay</a> (Apache-2.0). Dead by Daylight — Behavior Interactive.</div></section>';
  openModal('mapDetailModal',html,modal=>{
   modal.dataset.mapViews=JSON.stringify(views);modal.dataset.viewIndex='0';
   setupViewer(modal);
  });
 };

 function handled(event){event.preventDefault();event.stopPropagation();}
 document.addEventListener('click',event=>{
  const realm=event.target.closest('[data-map-realm]');
  if(realm){handled(event);realmFilter=realm.dataset.mapRealm;if(typeof window.renderMaps==='function')window.renderMaps();return;}
  const related=event.target.closest('[data-map-related]');
  if(related&&related.closest('#mapDetailModal')){handled(event);window.openMapDetail(related.dataset.mapRelated);return;}
  const view=event.target.closest('[data-map-view]');
  if(view&&view.closest('#mapDetailModal')){handled(event);switchView(view.closest('#mapDetailModal'),Number(view.dataset.mapView));return;}
  const zoom=event.target.closest('[data-map-zoom-in],[data-map-zoom-out],[data-map-zoom-reset]');
  if(zoom&&zoom.closest('#mapDetailModal')){
   handled(event);const modal=zoom.closest('#mapDetailModal'),current=Number(modal.dataset.zoom||1);
   if(zoom.hasAttribute('data-map-zoom-in'))setZoom(modal,current+.25);
   else if(zoom.hasAttribute('data-map-zoom-out'))setZoom(modal,current-.25);
   else setZoom(modal,1);
   return;
  }
  const open=event.target.closest('[data-map-open]');
  if(open&&!event.target.closest('[data-fav]')){handled(event);window.openMapDetail(open.dataset.mapOpen);return;}
 },true);
})();
