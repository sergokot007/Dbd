/* Offline-first shell for the static DBD Fog Companion. */
const CACHE='dbd-fog-v65';
const CORE=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './ui.js','./maps-data.js','./fallback-data.js','./names-data.js','./name-utils.js','./maps.js',
 './app.js','./character-details.js','./tier-list.js','./perk-build-links.js',
 './my-builds.js','./perk-interactions.js',
 './assets/ui/hero-fog.webp','./assets/ui/map-fallback.webp','./assets/ui/asset-fallback.webp',
 './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-maskable-512.png'
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
