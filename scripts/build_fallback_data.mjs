// Generates a compact offline catalog from the app's own curated name/owner maps.
// The full catalog-data.json is still built by GitHub Actions; this fallback only
// keeps the UI usable when neither that file nor the live API is available.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const details = fs.readFileSync(path.join(ROOT, 'character-details.js'), 'utf8');
const parseObject = (source, name) => {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  if (!match) throw new Error(`Cannot find ${name}`);
  return Function(`"use strict";return (${match[1]});`)();
};
const perkRu = parseObject(app, 'BUILD_PERK_RU');
const perkOwners = parseObject(details, 'perkOwners');
const key = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[’']/g, "'").replace(/[^a-z0-9]/g, '');
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Full-catalog builds publish these WebP files locally; the shared image
// fallback keeps the mini-catalog usable on a fresh checkout without them.
const icon = id => `./assets/perks/${id}.webp`;
const cdn = file => `https://cdn.source.gs/dead-by-daylight/img/${file}`;

const perks = Object.entries(perkRu).map(([en, ru]) => {
  const id = slug(en);
  const owner = perkOwners[en] || '';
  return {
    id, name: ru, nameEn: en, displayName: `${ru} (${en})`,
    description: `Перк «${ru}». Подробное игровое описание появится после загрузки полного каталога.`,
    image: icon(id), sourceImage: '', category: owner ? 'Уникальный перк' : 'Общий перк',
    characterName: owner, character: owner, owner, isGeneral: !owner,
    source: 'https://dbd.source.gs/perks/'
  };
});
const perkOwnerMap = {};
for (const perk of perks) {
  if (!perk.owner) continue;
  for (const candidate of [perk.id, perk.nameEn, perk.name, key(perk.id), key(perk.nameEn)]) {
    if (candidate) perkOwnerMap[candidate] = perk.owner;
  }
}
for (const [name, owner] of Object.entries(perkOwners)) if (owner) perkOwnerMap[key(name)] = owner;

const survivorPortraits = [
  ['Dwight Fairfield','Дуайт Фэрфилд','portrait-0-f361cf-512.webp'],
  ['Meg Thomas','Мэг Томас','portrait-1-b5ec18-512.webp'],
  ['Claudette Morel','Клодетт Морель','portrait-2-d5a10e-512.webp'],
  ['Jake Park','Джейк Парк','portrait-3-fad6d3-512.webp'],
  ['Nea Karlsson','Нея Карлссон','portrait-4-9b6421-512.webp'],
  ['Laurie Strode','Лори Строуд','portrait-5-8245b2-512.webp'],
  ['Ace Visconti','Эйс Висконти','portrait-6-b269df-512.webp'],
  ['William "Bill" Overbeck','Уильям «Билл» Овербек','portrait-7-b57a5c-512.webp'],
  ['Feng Min','Фэн Мин','portrait-8-330d28-512.webp'],
  ['David King','Дэвид Кинг','portrait-9-9b963d-512.webp'],
  ['Kate Denson','Кейт Денсон','portrait-10-4e752c-512.webp'],
  ['Quentin Smith','Квентин Смит','portrait-11-8f3ed7-512.webp'],
  ['Detective Tapp','Детектив Тэпп','portrait-12-f2216f-512.webp'],
  ['Adam Francis','Адам Фрэнсис','portrait-13-c79614-512.webp'],
  ['Jeff Johansen','Джефф Йохансен','portrait-14-4a5faa-512.webp'],
  ['Jane Romero','Джейн Ромеро','portrait-15-9a01c7-512.webp'],
  ['Ashley J. Williams','Эшли Уильямс','portrait-16-770e12-512.webp'],
  ['Nancy Wheeler','Нэнси Уиллер','portrait-17-bb436a-512.webp'],
  ['Steve Harrington','Стив Харрингтон','portrait-18-259b15-512.webp'],
  ['Yui Kimura','Юи Кимура','portrait-19-6df2ef-512.webp'],
  ['Zarina Kassir','Зарина Кассир','portrait-20-f47942-512.webp']
];
const killerPortraits = [
  ['The Trapper','Капканщик','portrait-268435456-ccd84e-512.webp'],
  ['The Wraith','Призрак','portrait-268435457-ebd27a-512.webp'],
  ['The Hillbilly','Деревенщина','portrait-268435458-54b6f5-512.webp'],
  ['The Nurse','Медсестра','portrait-268435459-60a880-512.webp'],
  ['The Hag','Ведьма','portrait-268435460-867c12-512.webp'],
  ['The Shape','Майкл Майерс','portrait-268435461-4a5f7f-512.webp'],
  ['The Doctor','Доктор','portrait-268435462-e48a04-512.webp'],
  ['The Huntress','Охотница','portrait-268435463-73c06e-512.webp'],
  ['The Cannibal','Каннибал','portrait-268435464-a36b50-512.webp'],
  ['The Nightmare','Кошмар','portrait-268435465-9cf325-512.webp'],
  ['The Pig','Свинья','portrait-268435466-bc08c2-512.webp'],
  ['The Clown','Клоун','portrait-268435467-0fc4ed-512.webp'],
  ['The Spirit','Дух','portrait-268435468-8b7426-512.webp'],
  ['The Legion','Легион','portrait-268435469-772acf-512.webp'],
  ['The Plague','Чума','portrait-268435470-f56989-512.webp'],
  ['The Ghost Face','Гоуст Фейс','portrait-268435471-fc24c2-512.webp'],
  ['The Demogorgon','Демогоргон','portrait-268435472-7c3906-512.webp']
];
const character = ([en, ru, portrait], role) => ({
  id: slug(en), name: ru, nameEn: en, displayName: `${ru} (${en})`,
  role, type: role, category: role === 'killer' ? 'Убийца' : 'Выживший',
  image: cdn(portrait), portrait: cdn(portrait), imageFull: cdn(portrait),
  power: role === 'killer' ? { name: 'Уникальная сила' } : null,
  source: `https://dbd.source.gs/${role === 'killer' ? 'killers' : 'survivors'}/${slug(en)}/`,
  link: `https://dbd.source.gs/${role === 'killer' ? 'killers' : 'survivors'}/${slug(en)}/`
});
const characters = [
  ...survivorPortraits.map(entry => character(entry, 'survivor')),
  ...killerPortraits.map(entry => character(entry, 'killer'))
];

const item = (id, en, ru, category, file, description) => ({
  id, name: ru, nameEn: en, displayName: `${ru} (${en})`, description,
  image: file ? cdn(file) : '', category, source: 'https://dbd.source.gs/items/'
});
const items = [
  item('med-kit','Med-Kit','Аптечка','Аптечки','medkit-001-212ff3.webp','Позволяет лечить себя и союзников, расходуя заряды.'),
  item('toolbox','Toolbox','Ящик с инструментами','Ящики с инструментами','', 'Ускоряет ремонт генераторов и саботаж крюков.'),
  item('flashlight','Flashlight','Фонарик','Фонари','', 'Может ослепить убийцу при точном наведении.'),
  item('map','Map','Карта','Карты','', 'Помогает отслеживать объекты, раскрытые её эффектами.'),
  item('key','Key','Ключ','Ключи','', 'Использует заряды для эффектов, зависящих от аддонов.'),
  item('fog-vial','Fog Vial','Флакон с туманом','Флаконы с туманом','', 'Создаёт облако тумана, скрывающее действия выживших.')
];
const addon = (id, en, ru, category, file, description) => ({
  id, name: ru, nameEn: en, displayName: `${ru} (${en})`, description,
  image: cdn(file), category, source: 'https://dbd.source.gs'
});
const addons = [
  addon('bandages','Bandages','Повязки','Аптечки','addon-medkit-001-212ff3.webp','Добавляет заряды аптечке.'),
  addon('gauze-roll','Gauze Roll','Бинты','Аптечки','addon-medkit-gauzeroll-6a7b0e.webp','Добавляет заряды аптечке.'),
  addon('styptic-agent','Styptic Agent','Кровоостанавливающий препарат','Аптечки','addon-medkit-007-f15f42.webp','Повышает эффективность лечения аптечкой.'),
  addon('needle-thread','Needle & Thread','Иголка и нитка','Аптечки','addon-medkit-needleandthread-7c829a.webp','Увеличивает шанс проверки реакции и бонус за неё.'),
  addon('sponge','Sponge','Губка','Аптечки','addon-medkit-005-e543a9.webp','Повышает бонус прогресса за проверки реакции.'),
  addon('butyl-rubber','Butyl Rubber','Бутилкаучук','Фонари','', 'Улучшает работу фонаря.')
];
const offering = (id, en, ru, file, description) => ({
  id, name: ru, nameEn: en, displayName: `${ru} (${en})`, description,
  image: cdn(file), category: 'Подношение', source: 'https://dbd.source.gs/offerings/'
});
const offerings = [
  offering('bloody-party-streamers','Bloody Party Streamers','Окровавленные праздничные гирлянды','bloodypartystreamers-bf6a36.webp','Дарует бонус очков крови всем участникам испытания.'),
  offering('bound-envelope','Bound Envelope','Перевязанный конверт','boundenvelope-1812d6.webp','Даёт дополнительные очки крови выжившим.'),
  offering('black-ward','Black Ward','Черный защитник','blackward-a0a740.webp','Защищает улучшения от потери после матча.'),
  offering('white-ward','White Ward','Белый защитник','whiteward-05ff0c.webp','Защищает предмет и улучшения от потери после матча.'),
  offering('shroud-of-union','Shroud of Union','Пелена союза','shroudofunion-e38df1.webp','Матч начинается рядом с союзником.')
];

const translations = {
  characters: Object.fromEntries(characters.map(x => [x.nameEn, x.name])),
  items: Object.fromEntries(items.map(x => [x.nameEn, x.name])),
  addons: Object.fromEntries(addons.map(x => [x.nameEn, x.name])),
  offerings: Object.fromEntries(offerings.map(x => [x.nameEn, x.name])),
  perks: perkRu,
  descriptions: { perks: {}, addons: {}, items: {}, offerings: {} },
  perkOwners: perkOwnerMap,
  maps: {}
};
const catalog = {
  generatedAt: new Date().toISOString(), source: 'offline fallback', fallback: true,
  perks, characters, items, addons, offerings, translations
};
const output = `/* Generated by scripts/build_fallback_data.mjs — do not edit by hand. */\n(function(){\n const catalog=${JSON.stringify(catalog, null, 2)};\n catalog.maps=(window.DBD_FALLBACK_MAPS||[]).slice();\n for(const map of catalog.maps)if(map.nameEn&&map.name)catalog.translations.maps[map.nameEn]=map.name;\n window.DBD_FALLBACK_CATALOG=catalog;\n})();\n`;
fs.writeFileSync(path.join(ROOT, 'fallback-data.js'), output);
console.log(`Generated fallback-data.js: ${perks.length} perks, ${characters.length} characters, ${items.length} items, ${addons.length} add-ons, ${offerings.length} offerings.`);
