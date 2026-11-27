// Static validation for the committed offline assets and generated metadata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file.replace(/^\.\//, '')));
const assert = (condition, message) => { if (!condition) { console.error(`✗ ${message}`); process.exitCode = 1; } };
const jsonFrom = (source, name) => {
  const match = source.match(new RegExp(`window\\.${name}=([\\s\\S]*?);\\n`));
  assert(Boolean(match), `${name} is present`);
  if (!match) throw new Error(`Missing ${name}`);
  return JSON.parse(match[1]);
};

const mapData = read('maps-data.js');
const nameData = jsonFrom(read('names-data.js'), 'DBD_NAME_DATA');
const meta = jsonFrom(mapData, 'DBD_MAP_META');
const aliases = jsonFrom(mapData, 'DBD_MAP_ALIASES');
const fallbackMaps = jsonFrom(mapData, 'DBD_FALLBACK_MAPS');
assert(Object.keys(meta).length >= 45, `map metadata contains ${Object.keys(meta).length} entries`);
assert(Object.keys(aliases).length >= 45, `map aliases contain ${Object.keys(aliases).length} entries`);
assert(fallbackMaps.length >= 45, `offline map catalog contains ${fallbackMaps.length} entries`);

const localPaths = new Set();
for (const entry of Object.values(meta)) {
  for (const key of ['cover', 'thumb']) {
    const value = entry[key];
    if (value?.startsWith('./')) localPaths.add(value);
    assert(Boolean(value) && (value.startsWith('./') || value.startsWith('https://cdn.source.gs/')), `valid ${key} for ${entry.en}`);
  }
  const views = [...(entry.tacticals || []), ...(entry.plans || [])];
  // One very new map has no community plan yet. It still has a bundled atmospheric
  // fallback instead of a fake numbered diagram.
  assert(views.length > 0 || entry.thumb?.startsWith('./'), `at least one bundled view or fallback for ${entry.en}`);
  for (const view of views) {
    for (const key of ['src', 'thumb', 'fallback']) {
      const value = view[key];
      if (value?.startsWith('./')) localPaths.add(value);
      assert(Boolean(value), `${key} for ${entry.en} / ${view.label}`);
    }
  }
}
for (const map of fallbackMaps) {
  assert(Boolean(map.id && map.mapKey && map.name && map.nameEn), `offline map record ${map.id || '?'} is complete`);
  assert(Boolean(map.realm && map.hooks && map.image), `offline map record ${map.id} has realm, hooks and art`);
}
for (const file of localPaths) assert(exists(file), `${file} exists`);
assert(localPaths.size >= 120, `${localPaths.size} bundled map images are referenced`);

for (const file of [
  'assets/ui/hero-fog.webp', 'assets/ui/map-fallback.webp', 'assets/ui/asset-fallback.webp',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
  'assets/maps/CREDITS.md', 'assets/characters/CREDITS.md', 'data/map-sources.json', 'data/CREDITS.md', 'data/LICENSE-MIT.txt',
  'maps-data.js', 'fallback-data.js', 'names-data.js', 'name-utils.js',
  'ui.js', 'maps.js', 'app.js', 'sw.js', 'index.html', 'style.css', 'manifest.webmanifest'
]) assert(exists(file), `${file} exists`);

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) assert(exists(icon.src), `manifest icon ${icon.src} exists`);
const html = read('index.html');
for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) assert(exists(match[1]), `script ${match[1]} exists`);
assert(/names-data\.js[\s\S]*name-utils\.js[\s\S]*app\.js/.test(html), 'name index and resolver load before app.js');
for (const match of html.matchAll(/href="(\.\/assets\/[^"]+)"/g)) assert(exists(match[1]), `linked asset ${match[1]} exists`);
const css = read('style.css');
for (const match of css.matchAll(/url\('(\.\/assets\/[^']+)'\)/g)) assert(exists(match[1]), `CSS asset ${match[1]} exists`);
const sw = read('sw.js');
const coreMatch = sw.match(/const CORE=\[([\s\S]*?)\];/);
assert(Boolean(coreMatch), 'service worker defines a core file list');
const coreFiles = [...(coreMatch?.[1] || '').matchAll(/'([^']+)'/g)].map(match => match[1]);
for (const file of coreFiles) {
  if (file === './') continue;
  assert(exists(file), `service worker core file ${file} exists`);
}
for (const file of ['./names-data.js', './name-utils.js']) assert(coreFiles.includes(file), `service worker caches ${file}`);
const characterIcons = [...new Set([
  ...(nameData.characters || []).map(character => character.icon),
  ...Object.values(nameData.characterIcons || {})
].filter(Boolean))];
assert(characterIcons.length >= 95, `${characterIcons.length} bundled character portraits are indexed`);
for (const icon of characterIcons) {
  assert(exists(icon), `character portrait ${icon} exists`);
  assert(coreFiles.includes(icon), `service worker caches character portrait ${icon}`);
}
const sources = JSON.parse(read('data/map-sources.json'));
assert(Array.isArray(sources) && sources.length >= 45, `map source manifest has ${sources.length} entries`);
assert(read('assets/maps/CREDITS.md').includes('Apache-2.0'), 'map artwork credits mention Apache-2.0');
assert(read('fallback-data.js').includes('DBD_FALLBACK_CATALOG'), 'offline catalog is committed');
assert(read('names-data.js').includes('window.DBD_NAME_DATA='), 'shared RU/EN name index is committed');
assert(read('data/CREDITS.md').includes('MIT'), 'community localization credits mention MIT');
assert(read('assets/characters/CREDITS.md').includes('MIT'), 'character portrait credits mention MIT');

if (process.exitCode) process.exit(process.exitCode);
console.log(`✓ Validated ${Object.keys(meta).length} maps, ${localPaths.size} bundled map assets, ${characterIcons.length} character portraits, ${manifest.icons.length} icons and the offline shell.`);
