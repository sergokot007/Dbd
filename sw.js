/* Offline-first shell for the static DBD Fog Companion. */
const CACHE='dbd-fog-v66';
const CORE=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './ui.js','./maps-data.js','./fallback-data.js','./names-data.js','./name-utils.js','./maps.js',
 './app.js','./character-details.js','./tier-list.js','./perk-build-links.js',
 './my-builds.js','./perk-interactions.js',
 './assets/ui/hero-fog.webp','./assets/ui/map-fallback.webp','./assets/ui/asset-fallback.webp',
 './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-maskable-512.png',
 './assets/characters/CREDITS.md',
 './assets/characters/ace.webp','./assets/characters/ada.webp','./assets/characters/adam.webp','./assets/characters/aestri.webp','./assets/characters/alan.webp',
 './assets/characters/animatronic.webp','./assets/characters/artist.webp','./assets/characters/ash.webp','./assets/characters/aurora.webp','./assets/characters/bill.webp',
 './assets/characters/blight.webp','./assets/characters/cannibal.webp','./assets/characters/cenobite.webp','./assets/characters/cheryl.webp','./assets/characters/claudette.webp',
 './assets/characters/clown.webp','./assets/characters/dark-lord.webp','./assets/characters/david-king.webp','./assets/characters/david-tapp.webp','./assets/characters/deathslinger.webp',
 './assets/characters/demogorgon.webp','./assets/characters/doctor.webp','./assets/characters/dredge.webp','./assets/characters/dustin.webp','./assets/characters/dwight.webp',
 './assets/characters/eleven.webp','./assets/characters/ellen.webp','./assets/characters/elodie.webp','./assets/characters/executioner.webp','./assets/characters/felix.webp',
 './assets/characters/feng.webp','./assets/characters/first.webp','./assets/characters/gabriel.webp','./assets/characters/ghost-face.webp','./assets/characters/ghoul.webp',
 './assets/characters/good-guy.webp','./assets/characters/haddie.webp','./assets/characters/hag.webp','./assets/characters/hillbilly.webp','./assets/characters/houndmaster.webp',
 './assets/characters/huntress.webp','./assets/characters/jake.webp','./assets/characters/jane.webp','./assets/characters/jeff.webp','./assets/characters/jill.webp',
 './assets/characters/jonah.webp','./assets/characters/judgment.webp','./assets/characters/kate.webp','./assets/characters/knight.webp','./assets/characters/krasue.webp',
 './assets/characters/kwon.webp','./assets/characters/lara.webp','./assets/characters/laurie.webp','./assets/characters/legion.webp','./assets/characters/leon.webp',
 './assets/characters/lich.webp','./assets/characters/mastermind.webp','./assets/characters/meg.webp','./assets/characters/michonne.webp','./assets/characters/mikaela.webp',
 './assets/characters/nancy.webp','./assets/characters/nea.webp','./assets/characters/nemesis.webp','./assets/characters/nicolas.webp','./assets/characters/nightmare.webp',
 './assets/characters/nurse.webp','./assets/characters/oni.webp','./assets/characters/onryo.webp','./assets/characters/orela.webp','./assets/characters/pig.webp',
 './assets/characters/plague.webp','./assets/characters/quentin.webp','./assets/characters/rebecca.webp','./assets/characters/renato.webp','./assets/characters/rick.webp',
 './assets/characters/sable.webp','./assets/characters/shane.webp','./assets/characters/shape.webp','./assets/characters/sienna.webp','./assets/characters/singularity.webp',
 './assets/characters/skull-merchant.webp','./assets/characters/slasher.webp','./assets/characters/spirit.webp','./assets/characters/steve.webp','./assets/characters/taurie.webp',
 './assets/characters/terrifier.webp','./assets/characters/thalita.webp','./assets/characters/trapper.webp','./assets/characters/trevor.webp','./assets/characters/trickster.webp',
 './assets/characters/twins.webp','./assets/characters/unknown.webp','./assets/characters/vee.webp','./assets/characters/vittorio.webp','./assets/characters/wraith.webp',
 './assets/characters/xenomorph.webp','./assets/characters/yoichi.webp','./assets/characters/yui.webp','./assets/characters/yun-jin.webp','./assets/characters/zarina.webp'
];
const CATALOG_FILES=['catalog-data.json','catalog-fallback.json'];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key.startsWith('dbd-fog-')&&key!==CACHE).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

async function putInCache(request,response){
 if(!response||!(response.ok||response.type==='opaque'))return response;
 try{
  const cache=await caches.open(CACHE);
  await cache.put(request,response.clone());
 }catch{}
 return response;
}
async function cacheFirst(request){
 const cached=await caches.match(request);
 if(cached)return cached;
 const response=await fetch(request);
 return putInCache(request,response);
}
async function networkFirst(request){
 try{
  const response=await fetch(request);
  return await putInCache(request,response);
 }catch{
  const cached=await caches.match(request);
  if(cached)return cached;
  if(CATALOG_FILES.some(name=>request.url.endsWith(name))){
   return new Response('{}',{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});
  }
  if(request.mode==='navigate')return caches.match('./index.html');
  return Response.error();
 }
}

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 let url;
 try{url=new URL(request.url);}catch{return}
 if(url.origin===self.location.origin){
  if(CATALOG_FILES.some(name=>url.pathname.endsWith('/'+name))||request.mode==='navigate'){
   event.respondWith(networkFirst(request));return;
  }
  event.respondWith(cacheFirst(request).catch(()=>caches.match('./index.html')));
  return;
 }
 // Cache game artwork too. API responses are deliberately left to the network.
 if(url.hostname==='cdn.source.gs'||(url.hostname==='dbd.source.gs'&&!url.pathname.startsWith('/api/'))){
  event.respondWith(cacheFirst(request).catch(()=>fetch(request)));
 }
});
