// Build a compact EN/RU name index from the committed community localization data.
// The generated names-data.js is committed; no GitHub request is needed at runtime.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readJson = file => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const cyrillic = /[А-Яа-яЁё]/;
const latin = /[A-Za-z]/;
function splitDisplayName(value){
  const text=String(value ?? '').trim();
  if(!text.endsWith(')'))return null;
  let depth=0,start=-1;
  for(let i=text.length-1;i>=0;i--){
    if(text[i]===')')depth++;
    else if(text[i]==='('){
      depth--;
      if(depth===0){start=i;break}
    }
  }
  if(start<0)return null;
  return {ru:text.slice(0,start).trim(),en:text.slice(start+1,text.length-1).trim(),text};
}
const strip = value => {
  const parts=splitDisplayName(value);
  return parts&&cyrillic.test(parts.ru)&&latin.test(parts.en)?parts.ru:String(value ?? '').trim();
};
const norm = value => strip(value)
  .toLocaleLowerCase('ru')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9а-яё]+/gi, '');
const slug = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('ru')
  .replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
const display = (ru, en) => {
  const russian=strip(ru),english=strip(en);
  return russian && english && russian !== english && cyrillic.test(russian) && latin.test(english)
    ? `${russian} (${english})` : (russian || english || '');
};
const translitPairs = [
  ['sch','щ'],['ch','ч'],['sh','ш'],['zh','ж'],['kh','х'],['ts','ц'],['ya','я'],['ye','е'],['yu','ю'],['yo','ё'],
  ['ai','эй'],['ay','ей'],['ey','ей'],['ee','и'],['oo','у'],['ou','у'],['ph','ф'],['th','т'],['ck','к'],['qu','кв'],['x','кс']
];
const translitLetters = {a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'х',i:'и',j:'дж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',y:'и',z:'з'};
function transliterate(value){
  const text=String(value ?? '');
  let out='';
  for(let i=0;i<text.length;){
    const lower=text.slice(i).toLocaleLowerCase('ru');
    const pair=translitPairs.find(([from])=>lower.startsWith(from));
    if(pair){out+=pair[1];i+=pair[0].length;continue}
    const char=text[i];
    if(/[A-Za-z]/.test(char)){out+=translitLetters[char.toLowerCase()]||char;i++;continue}
    if(/[А-Яа-яЁё0-9]/.test(char)){out+=char;i++;continue}
    if(char==='-'){out+=' ';i++;continue}
    if(/\s/.test(char)){out+=' ';i++;continue}
    i++;
  }
  return out.replace(/\s+/g,' ').trim().split(' ').map(word=>word?word[0].toLocaleUpperCase('ru')+word.slice(1):'').join(' ');
}
const manualRuByEnglish = {
  'Sienna':'Сиенна','Best Gift Ever':'Лучший подарок','Shared Trauma':'Общая травма',"Valkyrie's Rage":'Ярость валькирии',
  'Funny Business':'Забавное дело','Kill Spree':'Серия убийств','Laughingstock':'Посмешище',"Allie's Scalp":'Скальп Элли',
  'Art Crispies':'Арт-хрустяшки','Blackened Heart':'Почерневшее сердце','Bloodstained Bullet':'Окровавленная пуля',
  'Bottle of Bleach':'Бутылка отбеливателя',"Brooke's Pustule":'Пустула Брук','Burnt Wings':'Обожжённые крылья',
  'Candy Head Bowl':'Конфетная чаша с головами','Dead Opossum':'Мёртвый опоссум','Duct Tape':'Клейкая лента','Emily':'Эмили',
  'Explosive Gift':'Взрывной подарок',"Jonathan's Skull":'Череп Джонатана',"Mike's Phone":'Телефон Майка',
  'Shiny Tricycle':'Блестящий трёхколёсный велосипед',"Sienna's Flesh":'Плоть Сиенны','The Ninth Circle':'Девятый круг',
  'Thornton Salt':'Соль Торнтона',"Victoria's Eye":'Глаз Виктории','Wacky Jacks':'Причудливые фишки',
  "Grandma's Cookbook":'Кулинарная книга бабушки','Grandma S Cookbook':'Кулинарная книга бабушки'
};
const manualRu = Object.fromEntries(Object.entries(manualRuByEnglish).map(([en,ru])=>[norm(en),ru]));
function russianName(kind,en,ru){
  const key=norm(en);
  if(manualRu[key])return manualRu[key];
  if(ru&&cyrillic.test(ru)&&ru!==en)return ru;
  return transliterate(en);
}
const parseObject = (source, name) => {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  if (!match) throw new Error(`Cannot find ${name}`);
  return Function(`"use strict";return (${match[1]});`)();
};

// Curated full character names already shipped with the app.
const fallbackContext = { window: { DBD_FALLBACK_MAPS: [] } };
vm.createContext(fallbackContext);
vm.runInContext(read('fallback-data.js'), fallbackContext);
const fallbackCatalog = fallbackContext.window.DBD_FALLBACK_CATALOG || {};
const fallbackCharacters = fallbackCatalog.characters || [];
const fallbackPerks = fallbackCatalog.perks || [];
const fallbackItems = fallbackCatalog.items || [];
const fallbackAddons = fallbackCatalog.addons || [];
const fallbackOfferings = fallbackCatalog.offerings || [];
const tierNames = parseObject(read('tier-list.js'), 'DBD_TIER_RU_NAMES');
const buildPerkRu = parseObject(read('app.js'), 'BUILD_PERK_RU');
const perkOwners = parseObject(read('character-details.js'), 'perkOwners');
const dossierSource = read('character-details.js');
const dossierBlock = dossierSource.match(/const dossiers = \{([\s\S]*?)\n\};/)?.[1] || '';
const dossierKeys = [...dossierBlock.matchAll(/^\s*"([^"]+)":/gm)].map(match => match[1]);

// Community RU translations (MIT): flexeykinDev/dbd-perk-randomizer.
const characterRuShort = readJson('character-translations.ru.json');
for (const [key, value] of Object.entries(characterRuShort)) {
  if (key.startsWith('_')) continue;
  const russian = russianName('character', key, value);
  characterRuShort[key] = russian;
  characterRuShort[norm(key)] = russian;
}
const sourceCharacters = readJson('characters.json');
const sourcePerks = readJson('perks.json');
const perkRuBySlug = readJson('translations.ru.json');
const sourceItems = readJson('items.json');
const sourceAddons = readJson('addons.json');
const sourceOfferings = readJson('offerings.json');
const loadoutRu = readJson('loadout-translations.ru.json');

// Perks carry the short owner key and role; use them to infer a role for short names.
const roleByShort = {};
for (const perk of sourcePerks) {
  if (!perk.character || perk.character === 'All') continue;
  const key = norm(perk.character);
  if (perk.role === 'killer') roleByShort[key] = 'killer';
  else if (!roleByShort[key]) roleByShort[key] = 'survivor';
}

const characters = new Map();
const aliasToCanonical = new Map();
const addAlias = (alias, canonicalKey) => {
  const key = norm(alias);
  if (!key || !canonicalKey) return;
  aliasToCanonical.set(key, canonicalKey);
  const canonical = characters.get(canonicalKey);
  if (canonical && !canonical.aliases.includes(key)) canonical.aliases.push(key);
};
const aliasesFor = en => {
  const base = norm(en);
  const withoutThe = base.replace(/^the/, '');
  const short = String(en).replace(/^The\s+/i, '').split(/[\s«"(]/)[0];
  return [...new Set([base, withoutThe, norm(short), norm(String(en).replace(/^The\s+/i, ''))].filter(Boolean))];
};
// A few full names do not share a first token with their short community key.
const specialCanonical = {
  davidtapp: 'Detective Tapp',
  ash: 'Ashley J. Williams',
  bill: 'William "Bill" Overbeck',
  shape: 'The Shape',
  ghostface: 'The Ghost Face',
  skullmerchant: 'The Skull Merchant',
  goodguy: 'The Good Guy',
  darklord: 'The Dark Lord'
};
const canonicalEn = value => specialCanonical[norm(value)] || String(value);
const inferRole = (en, fallbackRole = '') => {
  if (fallbackRole === 'killer' || fallbackRole === 'survivor') return fallbackRole;
  if (/^The\s+/i.test(en)) return 'killer';
  return roleByShort[norm(String(en).replace(/^The\s+/i, ''))] || 'survivor';
};
function addCharacter(en, ru, role, aliases = []) {
  if (!en) return;
  const key = norm(en);
  const canonical = characters.get(key) || {
    en: String(en), ru: '', display: '', role: inferRole(en, role), aliases: []
  };
  if (ru && (!canonical.ru || canonical.ru === canonical.en)) canonical.ru = String(ru);
  if (!canonical.display || canonical.display === canonical.en) canonical.display = display(canonical.ru, canonical.en);
  if (role && !canonical.role) canonical.role = role;
  for (const alias of [...aliasesFor(en), ...aliases]) {
    if (!canonical.aliases.includes(alias)) canonical.aliases.push(alias);
    addAlias(alias, key);
  }
  aliasToCanonical.set(key, key);
  characters.set(key, canonical);
}
function canonicalFromAlias(alias) {
  return aliasToCanonical.get(norm(alias)) || aliasToCanonical.get(norm(alias).replace(/^the/, '')) || '';
}

for (const character of fallbackCharacters) {
  addCharacter(character.nameEn, character.name, character.role, [character.id, slug(character.nameEn)]);
}
for (const [en, ru] of Object.entries(tierNames)) addCharacter(en, ru, inferRole(en));
for (const sourceName of dossierKeys) {
  const en = canonicalEn(sourceName);
  const short = String(en).replace(/^The\s+/i, '');
  const ru = characterRuShort[norm(short)] || characterRuShort[short] || characterRuShort[norm(sourceName)] || tierNames[en] || tierNames[sourceName] || '';
  addCharacter(en, ru, inferRole(en));
  addAlias(sourceName, norm(en));
}
for (const owner of Object.values(perkOwners)) {
  if (!owner || typeof owner !== 'string') continue;
  const en = canonicalEn(owner);
  const short = String(en).replace(/^The\s+/i, '');
  const ru = tierNames[en] || characterRuShort[norm(short)] || characterRuShort[short] || '';
  addCharacter(en, ru, inferRole(en));
  addAlias(owner, norm(en));
}
for (const [alias, en] of Object.entries(specialCanonical)) {
  const key = norm(en);
  if (characters.has(key)) addAlias(alias, key);
}

for (const [short, ru] of Object.entries(characterRuShort)) {
  if (short.startsWith('_')) continue;
  let key = canonicalFromAlias(short) || (specialCanonical[norm(short)] ? norm(specialCanonical[norm(short)]) : '');
  if (!key || !characters.has(key)) {
    const isKillerShort = roleByShort[norm(short)] === 'killer';
    const en = isKillerShort && !/^The\s+/i.test(short) ? `The ${short}` : short;
    addCharacter(en, ru, inferRole(en, roleByShort[norm(short)]), [short, norm(short)]);
    key = norm(en);
  } else {
    addAlias(short, key);
    addAlias(norm(short), key);
    const canonical = characters.get(key);
    if (ru && !canonical.ru) {
      canonical.ru = ru;
      canonical.display = display(ru, canonical.en);
    }
  }
}
for (const short of Object.keys(sourceCharacters)) {
  const key = canonicalFromAlias(short) || (specialCanonical[norm(short)] ? norm(specialCanonical[norm(short)]) : '');
  if (key && characters.has(key)) addAlias(short, key);
  else {
    const en = roleByShort[norm(short)] === 'killer' && !/^The\s+/i.test(short) ? `The ${short}` : short;
    addCharacter(en, characterRuShort[norm(short)] || characterRuShort[short] || '', inferRole(en, roleByShort[norm(short)]), [short]);
  }
}

const names = {};
function indexName(entry, keys, kind) {
  const value = { ru: entry.ru, en: entry.en, display: entry.display, kind };
  for (const candidate of keys) {
    const key = norm(candidate);
    if (key) names[key] = value;
  }
}
for (const character of characters.values()) {
  indexName(character, [character.en, `character:${slug(character.en)}`, character.ru, character.display, ...character.aliases], 'character');
}
for (const perk of sourcePerks) {
  const en = perk.name?.en || perk.slug.replace(/-/g, ' ');
  const ru = russianName('perk', en, perkRuBySlug[perk.slug] || perk.name?.ru || '');
  indexName({ en, ru, display: display(ru, en) }, [perk.slug, `perk:${perk.slug}`, en, ru, display(ru, en)], 'perk');
}
for (const [slugKey, rawRu] of Object.entries(perkRuBySlug)) {
  if (slugKey.startsWith('_') || names[norm(slugKey)]) continue;
  const en = slugKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const ru = russianName('perk', en, rawRu);
  indexName({ en, ru, display: display(ru, en) }, [slugKey, `perk:${slugKey}`, en, ru], 'perk');
}
for (const [kind, records] of [['item', sourceItems], ['addon', sourceAddons], ['offering', sourceOfferings]]) {
  for (const record of records) {
    const en = record.name?.en || record.slug.replace(/-/g, ' ');
    const ru = russianName(kind, en, loadoutRu[`${kind}:${record.slug}`] || record.name?.ru || '');
    indexName({ en, ru, display: display(ru, en) }, [record.slug, `${kind}:${record.slug}`, en, ru, display(ru, en)], kind);
  }
}
for (const [key, rawRu] of Object.entries(loadoutRu)) {
  if (key.startsWith('_') || names[norm(key)]) continue;
  const [kind, slugKey] = key.split(':');
  if (!slugKey) continue;
  const en = slugKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const ru = russianName(kind, en, rawRu);
  indexName({ en, ru, display: display(ru, en) }, [slugKey, key, en, ru], kind);
}

// The app's curated RU names win over community alternatives. This keeps one
// translation per English name across cards, details, builds and tier lists.
const curatedRecords = [];
function registerCurated(kind, en, ru, id, slugKey) {
  const english = String(en || '').trim(), russian = String(ru || '').trim();
  if (!english || !russian || !cyrillic.test(russian) || !latin.test(english)) return;
  const value = { en: english, ru: russian, display: display(russian, english), kind };
  const recordSlug = slugKey || slug(english);
  curatedRecords.push({ value, keys: [id, recordSlug, english, russian, value.display, `${kind}:${recordSlug}`, `${kind}:${english}`], kind });
}
for (const record of fallbackCharacters) registerCurated('character', record.nameEn, record.name, record.id, record.id);
for (const [en, ru] of Object.entries(tierNames)) registerCurated('character', en, ru, slug(en), slug(en));
for (const record of fallbackPerks) registerCurated('perk', record.nameEn, record.name, record.id, record.id);
for (const [en, ru] of Object.entries(buildPerkRu)) registerCurated('perk', en, ru, slug(en), slug(en));
for (const record of fallbackItems) registerCurated('item', record.nameEn, record.name, record.id, record.id);
for (const record of fallbackAddons) registerCurated('addon', record.nameEn, record.name, record.id, record.id);
for (const record of fallbackOfferings) registerCurated('offering', record.nameEn, record.name, record.id, record.id);
for (const entry of curatedRecords) {
  for (const [nameKey, info] of Object.entries(names)) {
    if (info.kind === entry.kind && norm(info.en) === norm(entry.value.en)) names[nameKey] = entry.value;
  }
}
for (const entry of curatedRecords) indexName(entry.value, entry.keys, entry.kind);

const result = {
  generatedAt: new Date().toISOString(),
  source: 'https://github.com/flexeykinDev/dbd-perk-randomizer',
  license: 'MIT',
  characters: [...characters.values()].sort((a, b) => a.en.localeCompare(b.en, 'ru')),
  characterByAlias: Object.fromEntries(aliasToCanonical),
  names
};
const output = `/* Generated by scripts/build_name_data.mjs — do not edit by hand. */\nwindow.DBD_NAME_DATA=${JSON.stringify(result)};\n`;
fs.writeFileSync(path.join(ROOT, 'names-data.js'), output);
console.log(`Generated names-data.js: ${result.characters.length} characters, ${Object.keys(names).length} indexed name keys.`);
