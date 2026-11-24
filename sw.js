const CACHE='dbd-fog-v58';
const FILES=['./','./index.html','./style.css','./app.js','./catalog-data.json','./character-details.js','./tier-list.js','./perk-build-links.js','./my-builds.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dbd-fog-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(v=>{
  if(v.ok){const copy=v.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
  return v;
 }).catch(()=>caches.match(e.request).then(v=>v||caches.match('./index.html'))));
});