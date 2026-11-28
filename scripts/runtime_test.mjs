// Headless smoke test for every tab, modal and navigation path.
// Requires a dev-only dependency: npm install --no-save --no-package-lock jsdom
// Start a static server first: python3 -m http.server 8080 --bind 0.0.0.0
import assert from 'node:assert/strict';
import jsdom from 'jsdom';
const { JSDOM, VirtualConsole, requestInterceptor } = jsdom;

const BASE = process.env.DBD_TEST_URL || 'http://localhost:8080/';
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => {
  const message = error?.message || String(error);
  if (/Could not load img|Not implemented: window\.scrollTo|Not implemented: navigation|Could not parse CSS/i.test(message)) return;
  errors.push(message);
});
virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));

const resources = {
  interceptors: [
    requestInterceptor(request => {
      if (!String(request.url).startsWith(BASE)) {
        return new Response('', { headers: { 'Content-Type': 'text/plain' } });
      }
      return undefined;
    })
  ]
};

const dom = await JSDOM.fromURL(BASE, {
  runScripts: 'dangerously',
  resources,
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    // Keep the test offline and deterministic: no published full catalog, no live API.
    window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    window.scrollTo = () => {};
    window.history.back = () => {};
    window.addEventListener('error', event => errors.push('window error: ' + (event.message || event.error?.message || 'unknown')));
    window.addEventListener('unhandledrejection', event => errors.push('unhandled rejection: ' + (event.reason?.message || event.reason)));
  }
});
const { window } = dom;
const { document } = window;
const tick = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label, timeout = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (fn()) return;
    await tick(25);
  }
  throw new Error('Timed out waiting for ' + label);
}
function el(selector, root = document) {
  const node = root.querySelector(selector);
  assert.ok(node, `Missing ${selector}`);
  return node;
}
function assertRuEn(text, label) {
  const parts = window.dbdSplitDisplayName(String(text ?? ''));
  assert.ok(parts && /[А-Яа-яЁё]/.test(parts.ru) && /[A-Za-z]/.test(parts.en), `${label} uses RU (EN)`);
}
function click(node, label) {
  assert.ok(node, `Missing clickable element: ${label || 'element'}`);
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}
function key(name) {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}
function input(selector, value) {
  const node = el(selector);
  node.value = value;
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function popstate(state, fallbackState) {
  let event;
  if (typeof window.PopStateEvent === 'function') event = new window.PopStateEvent('popstate', { state });
  else {
    event = new window.Event('popstate');
    Object.defineProperty(event, 'state', { value: state });
  }
  window.dispatchEvent(event);
  if (fallbackState) return;
}
async function openTab(tab) {
  const button = el(`[data-tab="${tab}"]`);
  click(button, `tab ${tab}`);
  await waitFor(() => window.__dbdCurrentTab === tab, `tab ${tab}`);
  await tick(140);
  assert.equal(window.__dbdCurrentTab, tab, `current tab is ${tab}`);
  assert.ok(el('#sectionTitle').textContent.trim(), `section title for ${tab}`);
}

await waitFor(() => typeof window.switchTab === 'function' && typeof window.openCharacterByOwner === 'function' && document.querySelectorAll('#grid .item').length > 0, 'initial catalog');
assert.equal(window.__dbdCurrentTab, 'characters');
assert.equal(window.dbdDisplayName('David Tapp', 'character'), 'Детектив Тэпп (Detective Tapp)', 'short owner alias resolves to canonical RU/EN character');
assert.equal(window.dbdDisplayName('Stake Out', 'perk'), 'Наблюдение (Stake Out)', 'curated perk translation is catalog-wide');
assertRuEn(window.dbdCharacterRecord('David Tapp')?.displayName, 'synthetic owner dossier');

// Every primary tab renders and owns the correct grid layout.
const layouts = {
  characters: '', perks: '', items: '', addons: '', offerings: '',
  maps: 'map-grid', builds: 'build-grid', mybuilds: 'mybuild-layout', tiers: 'tier-grid', favorites: ''
};
for (const tab of Object.keys(layouts)) {
  await openTab(tab);
  assert.ok(document.querySelectorAll('#grid > *').length > 0 || tab === 'favorites', `${tab} has content`);
  if (['characters', 'perks', 'items', 'addons', 'offerings'].includes(tab)) assertRuEn(el('#grid .item h3').textContent, `${tab} card name`);
  if (tab === 'builds') assertRuEn(el('.build-perk-link').textContent, 'build perk name');
  if (tab === 'tiers') {
    assertRuEn(el('.tier-character-link').textContent, 'tier character name');
    const tierPerk = document.querySelector('.tier-perk');
    if (tierPerk) assertRuEn(tierPerk.textContent, 'tier perk name');
  }
  if (tab === 'mybuilds') assertRuEn(el('.mybuild-character-name').textContent, 'my-builds character name');
  if (layouts[tab]) assert.ok(el('#grid').classList.contains(layouts[tab]), `${tab} grid class`);
  else assert.ok(!/map-grid|build-grid|tier-grid|mybuild-layout/.test(el('#grid').className), `${tab} grid is clean`);
}

// Favorites preserve their source section and can be opened from another tab.
await openTab('characters');
const firstFav = el('#grid .fav');
click(firstFav, 'favorite button');
await tick(80);
assert.equal(el('#favCount').textContent.trim(), '1');
await openTab('favorites');
assert.ok(document.querySelectorAll('#grid .item').length > 0, 'favorite card exists');
assertRuEn(el('#grid .item h3').textContent, 'favorite card name');
click(el('#grid .item[data-item-detail]'), 'favorite detail');
await waitFor(() => document.querySelector('.detail-overlay.open'), 'favorite detail modal');
assert.equal(window.__dbdModalStack().length, 1);
click(el('.detail-overlay.open .detail-close'), 'favorite close');
await tick(40);
assert.equal(window.__dbdModalStack().length, 0);

// Role separation includes general perks without owners, and does not mix sides.
await openTab('perks');
click(el('[data-perk-side="survivor"]'), 'survivor perks');
assert.ok(document.querySelectorAll('#grid .item').length > 0, 'survivor perks exist');
assert.equal(document.querySelectorAll('#grid .item:not([data-perk-role="survivor"])').length, 0, 'survivor filter excludes other sides');
input('#search', 'Déjà Vu');
assert.ok(document.querySelector('#grid .item[data-perk-role="survivor"]'), 'general survivor perk is classified');
input('#search', '');
click(el('[data-perk-side="killer"]'), 'killer perks');
assert.ok(document.querySelectorAll('#grid .item').length > 0, 'killer perks exist');
assert.equal(document.querySelectorAll('#grid .item:not([data-perk-role="killer"])').length, 0, 'killer filter excludes other sides');
input('#search', 'Hex: No One Escapes Death');
assert.ok(document.querySelector('#grid .item[data-perk-role="killer"]'), 'general killer perk is classified');
input('#search', '');
click(el('[data-perk-side="all"]'), 'all perks');

// Perk cards expose a real owner portrait that opens the character dossier.

await waitFor(() => document.querySelector('#grid .perk-owner-mini'), 'perk card owner chip');
const perkOwnerMini = el('#grid .perk-owner-mini');
assertRuEn(perkOwnerMini.textContent, 'perk card owner chip');
assert.match(perkOwnerMini.querySelector('img')?.getAttribute('src') || '', /^\.\/assets\/characters\//, 'bundled perk-card owner portrait');
click(perkOwnerMini, 'perk card owner chip');
await waitFor(() => document.querySelector('#characterModal.open'), 'perk card owner dossier');
assertRuEn(el('#characterModal h2').textContent, 'perk card owner dossier title');
window.closeAllModals();
await tick(40);
perkOwnerMini.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await waitFor(() => document.querySelector('#characterModal.open'), 'keyboard owner dossier');
window.closeAllModals();
await tick(40);

// Search and catalog filters.
input('#search', 'дежавю');
await tick(60);
assert.match(el('#notice').textContent, /Найдено/, 'perk search notice');
input('#search', '');
await tick(40);
const perkFilters = document.querySelectorAll('[data-filter]');
if (perkFilters.length > 1) {
  click(perkFilters[1], 'perk filter');
  await tick(50);
  assert.ok(perkFilters[1].classList.contains('active') || el('[data-filter].active'), 'perk filter active');
}

// Realm atlas: filters, card lookup, views, zoom/pan, related map, close paths.
await openTab('maps');
assert.ok(document.querySelectorAll('.map-card').length >= 45, 'at least 45 map cards');
assert.ok(document.querySelectorAll('[data-map-realm]').length > 4, 'realm filters');
const mapRealmButtons = document.querySelectorAll('[data-map-realm]');
click(mapRealmButtons[1], 'realm filter');
await tick(50);
assert.ok(document.querySelectorAll('.map-card').length > 0, 'filtered realm has maps');
input('#search', 'Ормонд');
await tick(50);
assert.ok(document.querySelectorAll('.map-card').length > 0, 'map search has results');
input('#search', '');
await tick(50);
click(el('.map-card [data-map-open]'), 'map card');
await waitFor(() => document.querySelector('#mapDetailModal.open'), 'map detail');
assert.ok(document.querySelectorAll('#mapDetailModal [data-map-view]').length >= 2, 'map view tabs');
click(document.querySelectorAll('#mapDetailModal [data-map-view]')[1], '3D view');
await tick(40);
assert.match(el('#mapDetailModal .map-viewer-stage').innerHTML, /assets\/maps/, 'local map asset');
click(el('#mapDetailModal [data-map-zoom-in]'), 'zoom in');
await tick(30);
assert.notEqual(el('#mapDetailModal [data-map-zoom-value]').textContent.trim(), '100%');
click(el('#mapDetailModal [data-map-zoom-reset]'), 'zoom reset');
await tick(30);
assert.equal(el('#mapDetailModal [data-map-zoom-value]').textContent.trim(), '100%');
const related = document.querySelector('#mapDetailModal [data-map-related]');
if (related) {
  const before = el('#mapDetailModal h2').textContent;
  click(related, 'related map');
  await tick(50);
  assert.notEqual(el('#mapDetailModal h2').textContent, before, 'related map changed the dialog');
}
key('Escape');
await tick(50);
assert.equal(window.__dbdModalStack().length, 0, 'Escape closed map viewer');
click(el('.map-card [data-map-open]'), 'map backdrop test');
await waitFor(() => document.querySelector('#mapDetailModal.open'), 'backdrop test modal');
click(el('#mapDetailModal'), 'map backdrop');
await tick(50);
assert.equal(window.__dbdModalStack().length, 0, 'backdrop closed map viewer');

// Character dossier -> nested perk detail -> browser Back closes one layer at a time.
await openTab('characters');
click(el('#grid .item[data-item-detail]'), 'character card');
await waitFor(() => document.querySelector('#characterModal.open'), 'character dossier');
assertRuEn(el('#characterModal h2').textContent, 'character dossier title');
assert.ok(document.querySelector('#characterModal .build-card .build-rating'), 'character recommended build has a rating');
assertRuEn(el('#characterModal .build-perk-name').textContent, 'character dossier perk chip');
const perkChip = document.querySelector('#characterModal [data-loadout-type="perk"]');
click(perkChip, 'character perk');
await waitFor(() => document.querySelector('#perkDetailModal.open'), 'nested perk detail');
assert.equal(window.__dbdModalStack().length, 2, 'two modal layers');
popstate({ tab: 'characters', modalDepth: 1 });
await tick(50);
assert.equal(window.__dbdModalStack().length, 1, 'browser Back closed the top modal');
assert.ok(document.querySelector('#characterModal.open'), 'character dossier remains open');
popstate({ tab: 'characters', modalDepth: 0 });
await tick(50);
assert.equal(window.__dbdModalStack().length, 0, 'browser Back closed the dossier');

// Perk cards use the unified detail modal.
await openTab('perks');
click(el('#grid .item[data-item-detail]'), 'perk card');
await waitFor(() => document.querySelector('#perkDetailModal.open'), 'unified perk detail');
assertRuEn(el('#perkDetailModal h2').textContent, 'perk detail title');
click(el('#perkDetailModal .detail-close'), 'perk close');
await tick(40);
assert.equal(window.__dbdModalStack().length, 0);

// A perk with a short owner alias opens the canonical character's dossier.
await openTab('perks');
await window.__dbdOpenPerkDetail('Stake Out');
await waitFor(() => document.querySelector('#perkDetailModal.open'), 'Stake Out perk detail');
assertRuEn(el('#perkDetailModal h2').textContent, 'Stake Out detail title');
const ownerCard = el('#perkDetailModal [data-perk-owner-open]');
assert.match(ownerCard.textContent, /Детектив Тэпп \(Detective Tapp\)/, 'owner card shows canonical RU/EN name');
assertRuEn(ownerCard.querySelector('button')?.textContent, 'perk owner card');
assert.match(ownerCard.querySelector('img')?.getAttribute('src') || '', /^\.\/assets\/characters\//, 'bundled perk-detail owner portrait');
click(ownerCard, 'perk owner card');
await waitFor(() => document.querySelector('#characterModal.open'), 'owner character dossier');
assert.equal(window.__dbdModalStack().length, 2, 'owner dossier stacks over perk detail');
assert.match(el('#characterModal h2').textContent, /Детектив Тэпп \(Detective Tapp\)/, 'owner dossier canonical title');
window.closeAllModals();
await tick(50);
assert.equal(window.__dbdModalStack().length, 0, 'owner navigation can be closed');

// Item detail modal.
await openTab('items');
click(el('#grid .item[data-item-detail]'), 'item card');
await waitFor(() => document.querySelector('#itemDetailModal.open'), 'item detail');
assertRuEn(el('#itemDetailModal h2').textContent, 'item detail title');
click(el('#itemDetailModal .detail-close'), 'item close');
await tick(40);
assert.equal(window.__dbdModalStack().length, 0);

// Builds, tier list and personal builder controls.
await openTab('builds');
assert.ok(document.querySelectorAll('#grid .build-card').length >= 5, 'build cards');
assert.ok(document.querySelectorAll('#grid .build-card[data-build-role="survivor"]').length > 0, 'survivor builds');
assert.ok(document.querySelectorAll('#grid .build-card[data-build-role="killer"]').length >= 4, 'killer builds');
assert.equal(document.querySelectorAll('#grid .build-card:not(:has(.build-rating))').length, 0, 'every ready build has a rating');
for (const rating of document.querySelectorAll('#grid .build-card .build-rating')) assert.match(rating.getAttribute('aria-label'), /[1-5] из 5/, 'accessible star rating');
click(el('[data-build-side="killer"]'), 'killer build filter');
assert.ok(document.querySelectorAll('#grid .build-card').length >= 4, 'killer build filter shows builds');
assert.equal(document.querySelectorAll('#grid .build-card:not([data-build-role="killer"])').length, 0, 'killer filter excludes survivor builds');
assert.equal(document.querySelectorAll('#grid .build-card .build-perks').length, document.querySelectorAll('#grid .build-card').length, 'killer builds contain perk sections');
for (const card of document.querySelectorAll('#grid .build-card')) assert.equal(card.querySelectorAll('.build-perk-link').length, 4, 'killer build has four clickable perks');
click(el('[data-build-side="survivor"]'), 'survivor build filter');
assert.equal(document.querySelectorAll('#grid .build-card:not([data-build-role="survivor"])').length, 0, 'survivor build filter excludes killers');
click(el('[data-build-side="all"]'), 'all builds');
assertRuEn(el('.build-perk-link').textContent, 'build perk name');
await waitFor(() => document.querySelector('#grid .perk-owner-mini'), 'build owner mini');
const ownerMini = el('#grid .perk-owner-mini');
assertRuEn(ownerMini.textContent, 'build owner mini chip');
assert.match(ownerMini.querySelector('img')?.getAttribute('src') || '', /^\.\/assets\/characters\//, 'bundled build owner portrait');
click(ownerMini, 'build owner mini chip');
await waitFor(() => document.querySelector('#characterModal.open'), 'owner mini character dossier');
assertRuEn(el('#characterModal h2').textContent, 'owner mini dossier title');
window.closeAllModals();
await tick(50);
click(el('[data-copy-build]'), 'copy build');
await tick(30);
await openTab('tiers');
assert.ok(document.querySelectorAll('.tier-card').length > 10, 'tier cards');
assertRuEn(el('.tier-character-link').textContent, 'tier character name');
const tierPerkName = document.querySelector('.tier-perk');
if (tierPerkName) assertRuEn(tierPerkName.textContent, 'tier perk name');
const rank = el('[data-tier-rank="A"]');
click(rank, 'tier rank A');
await tick(40);
assert.ok(document.querySelector('[data-tier-rank].active'), 'tier rank active');
click(el('[data-tier-side="killers"]'), 'killer tier side');
await tick(40);
assert.ok(document.querySelector('[data-tier-side="killers"].active'), 'killer tier active');
await openTab('mybuilds');
assert.ok(el('.mybuild-main'), 'personal builder');
assertRuEn(el('.mybuild-character-name').textContent, 'my-builds roster name');
click(el('[data-my-side="killers"]'), 'mybuild killers');
await tick(40);
assert.ok(document.querySelector('[data-my-side="killers"].active'), 'mybuild side active');
const task = el('[data-my-task]');
click(task, 'mybuild task');
await tick(40);
assert.ok(document.querySelector('[data-my-task].active'), 'mybuild task active');
const checkbox = el('[data-owned-character]');
checkbox.checked = true;
checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
await tick(50);
assert.match(el('#notice').textContent, /Отмечено персонажей: 1/, 'owned character saved');
const myPerkName = document.querySelector('.mybuild-perk b');
if (myPerkName) assertRuEn(myPerkName.textContent, 'my-builds generated perk name');

// Hero route link and browser Back between tabs.
await openTab('characters');
click(el('[data-route="maps"]'), 'hero map route');
await waitFor(() => window.__dbdCurrentTab === 'maps', 'hero route to maps');
popstate({ tab: 'perks', modalDepth: 0 });
await waitFor(() => window.__dbdCurrentTab === 'perks', 'browser Back to perks');

// Refresh is safe in every section (it used to call load() with an undefined TYPES entry).
for (const tab of ['characters', 'perks', 'items', 'addons', 'offerings', 'maps', 'builds', 'mybuilds', 'tiers', 'favorites']) {
  await openTab(tab);
  click(el('#refresh'), `refresh ${tab}`);
  await tick(110);
  assert.ok(el('#sectionTitle').textContent.trim(), `refresh kept ${tab} alive`);
}

assert.deepEqual(errors, [], 'no runtime errors');
console.log('✓ Runtime smoke test passed: 10 tabs, RU (EN) names, local owner portraits, perk-to-character navigation, favorites, modal stack, map viewer, hero route, browser Back and refresh.');
await dom.window.close();
