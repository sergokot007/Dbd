// Validate the shared RU/EN name index and every perk-owner alias.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const parseObject = (source, name) => {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  assert.ok(match, `${name} is present`);
  return Function(`"use strict";return (${match[1]});`)();
};
const ruEn = text => {
  const parts = window.dbdSplitDisplayName(text);
  return Boolean(parts && /[А-Яа-яЁё]/.test(parts.ru) && /[A-Za-z]/.test(parts.en));
};

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(read('fallback-data.js'), context);
vm.runInContext(read('names-data.js'), context);
vm.runInContext(read('name-utils.js'), context);
const { window } = context;
const data = window.DBD_NAME_DATA;
assert.ok(data, 'names-data.js defines DBD_NAME_DATA');
assert.equal(data.license, 'MIT', 'vendored localization is MIT licensed');
assert.match(data.source, /flexeykinDev\/dbd-perk-randomizer/, 'localization source is credited');
assert.ok(read('data/CREDITS.md').includes('MIT'), 'data/CREDITS.md mentions MIT');
assert.ok(read('data/LICENSE-MIT.txt').includes('MIT License'), 'MIT license text is bundled');

const characters = data.characters || [];
assert.ok(characters.length >= 95, `canonical characters: ${characters.length}`);
for (const character of characters) {
  assert.match(character.ru, /[А-Яа-яЁё]/, `Russian name for ${character.en}`);
  assert.match(character.en, /[A-Za-z]/, `English name for ${character.en}`);
  assert.ok(ruEn(character.display), `RU (EN) display for ${character.en}`);
  assert.match(character.icon || '', /^\.\/assets\/characters\/.+\.webp$/, `bundled portrait for ${character.en}`);
  assert.ok(fs.existsSync(path.join(ROOT, character.icon)), `portrait file for ${character.en}`);
}
const names = data.names || {};
assert.ok(Object.keys(names).length > 4000, `indexed names: ${Object.keys(names).length}`);
for (const [key, info] of Object.entries(names)) {
  assert.match(info.ru, /[А-Яа-яЁё]/, `Russian name for index ${key}`);
  assert.match(info.en, /[A-Za-z]/, `English name for index ${key}`);
  assert.ok(ruEn(info.display), `RU (EN) display for index ${key}`);
}

const fallback = context.window.DBD_FALLBACK_CATALOG || {};
window.__dbdCharacterCatalog = fallback.characters || [];
for (const kind of ['characters', 'perks', 'items', 'addons', 'offerings']) {
  for (const record of fallback[kind] || []) {
    assert.ok(ruEn(record.displayName || ''), `${kind} fallback display for ${record.nameEn || record.id}`);
  }
}
for (const [en] of Object.entries(parseObject(read('app.js'), 'BUILD_PERK_RU'))) {
  assert.ok(ruEn(window.dbdDisplayName(en, 'perk')), `curated perk ${en}`);
}
for (const [en] of Object.entries(parseObject(read('tier-list.js'), 'DBD_TIER_RU_NAMES'))) {
  assert.ok(ruEn(window.dbdDisplayName(en, 'character')), `tier character ${en}`);
}

const sourcePerks = readJson('data/perks.json');
const perkOwners = parseObject(read('character-details.js'), 'perkOwners');
const ownerAliases = new Set(
  [...sourcePerks.map(perk => perk.character), ...Object.values(perkOwners)]
    .filter(value => value && value !== 'All' && value !== 'General')
    .map(String)
);
assert.ok(ownerAliases.size >= 90, `owner aliases: ${ownerAliases.size}`);
for (const owner of ownerAliases) {
  assert.ok(ruEn(window.dbdDisplayName(owner, 'character')), `owner label ${owner}`);
  const record = window.dbdCharacterRecord(owner, fallback.characters || []);
  assert.ok(record, `owner ${owner} resolves to a character record`);
  assert.ok(ruEn(record.displayName), `owner ${owner} opens a RU (EN) dossier`);
  assert.match(record.image || '', /^\.\/assets\/characters\/.+\.webp$/, `owner ${owner} has a bundled portrait`);
}

assert.equal(window.dbdDisplayName('David Tapp', 'character'), 'Детектив Тэпп (Detective Tapp)', 'short owner alias maps to full character');
assert.equal(window.dbdDisplayName('Stake Out', 'perk'), 'Наблюдение (Stake Out)', 'curated perk translation wins');
assert.equal(window.dbdDisplayName('Med-Kit', 'item'), 'Аптечка (Med-Kit)', 'fallback item translation is indexed');
assert.equal(window.dbdRecordEnglish('Наблюдение (Stake Out)', 'perk'), 'Stake Out', 'formatted label resolves to English lookup key');

console.log(`✓ Validated ${characters.length} characters, ${Object.keys(names).length} name keys, ${ownerAliases.size} owner aliases, bundled portraits and RU (EN) formatting.`);
