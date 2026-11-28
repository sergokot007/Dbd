# Локализация названий

Русские названия персонажей, перков, предметов, аддонов и подношений, а также
часть игровых описаний взяты из сообщества-поддерживаемого набора данных
[`flexeykinDev/dbd-perk-randomizer`](https://github.com/flexeykinDev/dbd-perk-randomizer).

- Лицензия: **MIT**. Полный текст — [`LICENSE-MIT.txt`](./LICENSE-MIT.txt).
- Copyright (c) 2026 flexeykinDev.
- Файлы в этой папке (`character-translations.ru.json`, `translations.ru.json`,
  `loadout-translations.ru.json`, `characters.json`, `perks.json`, `items.json`,
  `addons.json`, `offerings.json`, `description-ru-raw.json`,
  `loadout-description-ru-raw.json`) сохранены из `data/` upstream-репозитория.
- WebP-портреты из `public/characters/` того же репозитория сохранены в
  `assets/characters/`; отдельная атрибуция — `assets/characters/CREDITS.md`.
  Их локальные пути включены в `names-data.js` и кэш Service Worker.
- `scripts/build_name_data.mjs` превращает их в компактный `names-data.js`;
  runtime не обращается к GitHub. Кураторские названия из интерфейса имеют
  приоритет, чтобы один и тот же английский термин не менял перевод между
  карточками, досье, билдами и тир-листом.
- Переводы сообщества могут отличаться от официального русского клиента; это
  справочник, а не внутриигровой текст.

Исходные игровые данные и изображения также упомянуты в основном `README.md`.
