#!/usr/bin/env python3
"""Rebuild the local DBD map artwork and map metadata.

The source images come from the Apache-2.0 DBD Map Overlay repository.  This
script downloads only the SamoelColt 3D views and EagerFace plans, converts them
to compact WebP files and writes ``maps-data.js``.  It is a maintenance tool:
the generated assets are committed, so the site does not need GitHub at runtime.

Usage (GitHub CLI authentication is recommended for higher API rate limits):
    python scripts/build_map_assets.py
"""
from __future__ import annotations

import io
import json
import re
import subprocess
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "maps"
DATA = ROOT / "data"
REPO = "LucaFontanot/dbd-map-overlay"
BRANCH = "master"
CDN = "https://cdn.source.gs/dead-by-daylight/img/"
GENERIC_ART = "./assets/ui/map-fallback.webp"

# Russian names, realms and hook ranges follow the published dbd.source.gs catalog.
# A missing cover is intentional: the app uses the generated atmospheric fallback
# rather than pretending that an unavailable screenshot is official artwork.
M = lambda en, ru, realm, hooks, cover="", aliases=None, tactical=None, plan=None: {
    "en": en, "ru": ru, "realm": realm, "hooks": hooks, "cover": cover,
    "aliases": aliases or [], "tactical": tactical, "plan": plan,
}

MAPS = [
    M("Ironworks of Misery", "Завод Страданий", "Поместье МакМиллан", "8 to 13 hooks", "map-ind-foundry02-862023-768.webp"),
    M("Coal Tower", "Угольная Башня", "Поместье МакМиллан", "6 to 11 hooks", "map-ind-coaltower02-c4f809-768.webp"),
    M("Suffocation Pit", "Удушающая Яма", "Поместье МакМиллан", "7 to 12 hooks", "map-ind-mine02-4ca339-768.webp"),
    M("Shelter Woods", "Лесная Опушка", "Поместье МакМиллан", "8 to 13 hooks", "map-ind-forest02-718cde-768.webp"),
    M("Groaning Storehouse", "Стонущий Склад", "Поместье МакМиллан", "7 to 12 hooks", "map-ind-storehouse02-d5a509-768.webp"),
    M("The Thompson House", "Дом Томпсонов", "Ферма Колдвинд", "7 to 12 hooks", "map-frm-farmhouse-554dc1-512.webp"),
    M("Torment Creek", "Ручей Страданий", "Ферма Колдвинд", "7 to 12 hooks", "map-frm-silo-337c95-512.webp"),
    M("Rancid Abattoir", "Заброшенная Скотобойня", "Ферма Колдвинд", "6 to 11 hooks", "map-frm-slaughterhouse-f8ed06-512.webp", aliases=["Rancid Abbatoir"]),
    M("Rotten Fields", "Сгнившие Поля", "Ферма Колдвинд", "8 to 13 hooks", "map-frm-cornfield-fced7c-512.webp"),
    M("Fractured Cowshed", "Разрушенный Хлев", "Ферма Колдвинд", "8 to 13 hooks", "map-frm-barn-03a1e7-512.webp"),
    M("Wretched Shop", "Магазин Барахольщика", "Свалка Автохевен", "8 to 13 hooks", "map-jnk-garage-88d8c8-512.webp"),
    M("Blood Lodge", "Кровавая Лачуга", "Свалка Автохевен", "6 to 11 hooks", "map-jnk-lodge-64fefa-512.webp"),
    M("Azarov's Resting Place", "Место Упокоения Азарова", "Свалка Автохевен", "7 to 12 hooks", "map-jnk-office-c8fd52-512.webp", aliases=["Azarov’s Resting Place"]),
    M("Wreckers' Yard", "Зона Свалки", "Свалка Автохевен", "6 to 11 hooks", "map-jnk-scrapyard-c5cd9b-512.webp"),
    M("Gas Heaven", "Гэс Хевен", "Свалка Автохевен", "8 to 13 hooks", "map-jnk-gasstation-a9f914-512.webp"),
    M("Father Campbell's Chapel", "Часовня Отца Кэмпбелла", "Психлечебница Кротус Пренн", "6 to 11 hooks", "map-asy-chapel-8615cb-512.webp", aliases=["Father Cambell's Chapel"]),
    M("Disturbed Ward", "Отделение для Буйных", "Психлечебница Кротус Пренн", "7 to 12 hooks", "map-asy-asylum-c78573-512.webp", aliases=["Crotus Prenn Asylum"]),
    M("Lampkin Lane", "Переулок Лэмпкин", "Хэддонфилд", "8 to 13 hooks", ""),
    M("Treatment Theatre", "Лечебный Зал", "Мемориальный институт Лэри", "8 to 13 hooks", "map-hos-treatment-65afe7-512.webp", aliases=["Treatment Theater"]),
    M("Mother's Dwelling", "Обитель Матери", "Красный лес", "8 to 13 hooks", "map-brl-mahouse-0805f1-768.webp"),
    M("The Temple of Purgation", "Храм Очищения", "Красный лес", "8 to 13 hooks", "map-brl-temple-c8cbbc-768.webp", aliases=["Temple of Purgation", "Temple Of Purgation"]),
    M("The Pale Rose", "Бледная Роза", "Гнилое болото", "9 to 14 hooks", "map-swp-palerose-bfed7a-512.webp"),
    M("Grim Pantry", "Чудовищная Кладовая", "Гнилое болото", "9 to 14 hooks", "map-swp-grimpantry-582335-512.webp"),
    M("Badham Preschool I", "Детский Сад Бэдхем I", "Спрингвуд", "7 to 12 hooks", "map-eng-street-01-70b0c7-512.webp", aliases=["Badham Preschool"]),
    M("Badham Preschool II", "Детский Сад Бэдхем II", "Спрингвуд", "7 to 12 hooks", "map-eng-street-02-5f471e-512.webp", aliases=["Badham Preschool"]),
    M("Badham Preschool III", "Детский Сад Бэдхем III", "Спрингвуд", "7 to 12 hooks", "map-eng-street-03-d9b5fd-512.webp", aliases=["Badham Preschool"]),
    M("Badham Preschool IV", "Детский Сад Бэдхем IV", "Спрингвуд", "7 to 12 hooks", "map-eng-street-04-fab686-512.webp", aliases=["Badham Preschool"]),
    M("Badham Preschool V", "Детский Сад Бэдхем V", "Спрингвуд", "7 to 12 hooks", "map-eng-street-05-949e47-512.webp", aliases=["Badham Preschool"]),
    M("The Game", "Игра", "Мясокомбинат «Гидеон»", "10 to 15 hooks", "map-fin-hideout-3ec270-512.webp",
      tactical=[("3D-схема", "SamoelColt/Gideon Meat Plant/The Game.jpg"), ("3D-схема · второй уровень", "SamoelColt/Gideon Meat Plant/The Game (2).jpg")]),
    M("Family Residence", "Семейная Резиденция", "Поместье Ямаоки", "8 to 12 hooks", "map-hti-manor02-95f630-768.webp"),
    M("Sanctum of Wrath", "Прибежище Гнева", "Поместье Ямаоки", "6 to 11 hooks", "map-hti-shrine02-d15e0d-768.webp", aliases=["Sanctum Of Wrath"]),
    M("Mount Ormond Resort", "Курорт «Гора Ормонд»", "Ормонд", "8 to 12 hooks", "map-kny-cottage03-040228-768.webp"),
    M("Ormond Lake Mine", "Шахта Озера Ормонд", "Ормонд", "9 to 13 hooks", "map-glo-level-01-f4a1d2-768.webp", aliases=["Lake Mine"]),
    M("The Underground Complex", "Подземный Комплекс", "Национальная лаборатория Хоукинса", "7 to 14 hooks", "map-qat-lab-82dced-512.webp",
      aliases=["The Undrground Complex"], plan=[("План", "EagerFace/Hawkins National Laboratory/The Undrground Complex.jpg")]),
    M("Dead Dawg Saloon", "Салун «Мертвяк Вусмерть»", "Могила в Гленвейле", "6 to 11 hooks", "map-ukr-saloon-aa8da6-512.webp"),
    M("Midwich Elementary School", "Начальная Школа Мидвича", "Сайлент Хилл", "14 to 18 hooks", "map-wal-level-01-20fa84-512.webp",
      tactical=[("3D-схема · верхний этаж", "SamoelColt/Silent Hill/Midwich  Elementary  School (Upper Floor).jpg"), ("3D-схема · нижний этаж", "SamoelColt/Silent Hill/Midwich  Elementary  School (Lower Floor).jpg")]),
    M("Raccoon City Police Station East Wing", "Полицейский Участок Раккун-Сити: Восточное Крыло", "Раккун-Сити", "14 to 19 hooks", "map-ecl-level-01-1c0aeb-512.webp",
      tactical=[("3D-схема · верхний этаж", "SamoelColt/Raccoon City/Raccoon City Police Station (Upper Floor).jpg"), ("3D-схема · нижний этаж", "SamoelColt/Raccoon City/Raccoon City Police Station (Lower Floor).jpg")]),
    M("Raccoon City Police Station West Wing", "Полицейский Участок Раккун-Сити: Западное Крыло", "Раккун-Сити", "14 to 18 hooks", "map-ecl-level-westside-a6584e-512.webp",
      tactical=[("3D-схема · верхний этаж", "SamoelColt/Raccoon City/Raccoon City Police Station (Upper Floor).jpg"), ("3D-схема · нижний этаж", "SamoelColt/Raccoon City/Raccoon City Police Station (Lower Floor).jpg")]),
    M("Eyrie of Crows", "Воронье Гнездовье", "Заброшенное кладбище", "10 to 13 hooks", "map-ion-level-01-cc39bf-512.webp"),
    M("Dead Sands", "Мёртвые Пески", "Заброшенное кладбище", "10 to 15 hooks", "map-ion-shack-a7c8de-768.webp"),
    M("Garden of Joy", "Сад Счастья", "Зачахший остров", "8 to 13 hooks", "map-mtr-level-1-5a67fe-768.webp"),
    M("Fallen Refuge", "Убежище Павших", "Зачахший остров", "10 to 15 hooks", "map-apl-shack-b0ebf3-768.webp"),
    M("Freddy Fazbear's Pizza", "Пиццерия Фредди Фазбера", "Зачахший остров", "13 to 15 hooks", "map-apl-level-02-911e4e-768.webp"),
    M("Greenville Square", "Площадь Гринвилла", "Зачахший остров", "13 to 15 hooks", "map-apl-level-01-7d94a8-768.webp"),
    M("The Shattered Square", "Разрушенная Площадь", "Разорённая деревня Борго", "9 to 13 hooks", "map-qtm-level-01-15b227-768.webp", aliases=["The Shattered square"]),
    M("Forgotten Ruins", "Забытые Руины", "Разорённая деревня Борго", "9 to 14 hooks", "",
      tactical=[("3D-схема · верхний этаж", "SamoelColt/The Decimated Borgo/Forgotten Ruins (Upper Floor).jpg"), ("3D-схема · нижний этаж", "SamoelColt/The Decimated Borgo/Forgotten Ruins (Lower Floor).jpg")]),
    M("Toba Landing", "Площадка Тоба", "Заросли Дварки", "11 to 15 hooks", "map-uba-level-01-81ec3a-768.webp"),
    M("Nostromo Wreckage", "Крушение «Ностромо»", "Заросли Дварки", "11 to 15 hooks", "map-wrm-level-01-231e80-768.webp"),
    M("Trickster's Delusion", "Заблуждение Трикстера", "Бессонный район", "10 to 15 hooks", "map-qui-level-01-6a308b-768.webp", tactical=[], plan=[]),
]

TACTICAL_OVERRIDES = {m["en"]: m["tactical"] for m in MAPS if m["tactical"] is not None}
PLAN_OVERRIDES = {m["en"]: m["plan"] for m in MAPS if m["plan"] is not None}


def norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def map_key(en: str) -> str:
    value = norm(en)
    return value[3:] if value.startswith("the") else value


def slugify(value: str) -> str:
    return map_key(value) or "map"


def gh_api(path: str, raw: bool = False) -> bytes:
    command = ["gh", "api", f"repos/{REPO}/{path}"]
    if raw:
        command += ["-H", "Accept: application/vnd.github.raw"]
    result = subprocess.run(command, check=True, capture_output=True)
    return result.stdout


def fetch_tree() -> list[dict]:
    payload = json.loads(gh_api(f"git/trees/{BRANCH}?recursive=1"))
    return [x for x in payload.get("tree", []) if x.get("size")]


def resolve(files: list[dict], artist: str, hints: list[str]) -> str | None:
    pool = [x["path"] for x in files if x["path"].startswith(f"maps/{artist}/") and x["path"].lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
    for hint in hints:
        needle = norm(hint)
        if not needle:
            continue
        exact = next((p for p in pool if norm(Path(p).stem) == needle), None)
        if exact:
            return exact
        partial = next((p for p in pool if needle in norm(p) or norm(Path(p).stem) in needle), None)
        if partial:
            return partial
    return None


def source_hints(entry: dict, artist: str) -> list[str]:
    overrides = TACTICAL_OVERRIDES if artist == "SamoelColt" else PLAN_OVERRIDES
    custom = overrides.get(entry["en"])
    if custom is not None:
        return [hint for _, hint in custom]
    return [entry["en"], *entry["aliases"]]


def view_labels(entry: dict, artist: str, count: int) -> list[str]:
    overrides = TACTICAL_OVERRIDES if artist == "SamoelColt" else PLAN_OVERRIDES
    custom = overrides.get(entry["en"])
    if custom is not None:
        return [label for label, _ in custom]
    return [("3D-схема" if artist == "SamoelColt" else "План")] * count


def make_webp(data: bytes, target: Path, width: int, quality: int) -> None:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    if image.width > width:
        height = round(image.height * width / image.width)
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=5)


def main() -> None:
    files = fetch_tree()
    DATA.mkdir(exist_ok=True)
    (DATA / "map-sources.json").write_text(json.dumps(MAPS, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    jobs: dict[str, dict] = {}
    for entry in MAPS:
        for artist in ("SamoelColt", "EagerFace"):
            hints = source_hints(entry, artist)
            found: list[tuple[str, str]] = []
            for hint in hints:
                path = resolve(files, artist, [hint])
                if path and all(p != path for _, p in found):
                    found.append((hint, path))
            labels = view_labels(entry, artist, len(found))
            key = f"{artist}:{entry['en']}"
            jobs[key] = {"entry": entry, "artist": artist, "found": found, "labels": labels}

    unique_paths = sorted({path for job in jobs.values() for _, path in job["found"]})
    print(f"Downloading {len(unique_paths)} map source images…")

    def download(path: str) -> tuple[str, bytes | None]:
        quoted = quote(path, safe="/")
        try:
            return path, gh_api(f"contents/{quoted}?ref={BRANCH}", raw=True)
        except Exception as exc:  # a missing optional asset should not break the catalog
            print("Skipping", path, "-", exc)
            return path, None

    with ThreadPoolExecutor(max_workers=6) as pool:
        downloaded = dict(pool.map(download, unique_paths))

    asset_map: dict[str, dict] = {}
    for path, data in downloaded.items():
        if not data:
            continue
        stem = slugify(Path(path).stem)
        subdir = "3d" if path.startswith("maps/SamoelColt/") else "plans"
        full = f"./assets/maps/{subdir}/{stem}.webp"
        thumb = f"./assets/maps/3d/thumbs/{stem}.webp" if subdir == "3d" else full
        make_webp(data, OUT / subdir / f"{stem}.webp", 1600 if subdir == "3d" else 1400, 82)
        if subdir == "3d":
            make_webp(data, OUT / "3d" / "thumbs" / f"{stem}.webp", 640, 74)
        asset_map[path] = {"full": full, "thumb": thumb}

    meta: dict[str, dict] = {}
    aliases: dict[str, str] = {}
    fallback_maps: list[dict] = []
    for entry in MAPS:
        key = map_key(entry["en"])
        tactical: list[dict] = []
        plans: list[dict] = []
        for artist, bucket in (("SamoelColt", tactical), ("EagerFace", plans)):
            job = jobs[f"{artist}:{entry['en']}"]
            for (label, (_, source_path)) in zip(job["labels"], job["found"]):
                asset = asset_map.get(source_path)
                if asset:
                    bucket.append({"label": label, "src": asset["full"], "thumb": asset["thumb"], "fallback": GENERIC_ART})
        slug = re.sub(r"[^a-z0-9]+", "-", entry["en"].lower()).strip("-")
        cover = CDN + entry["cover"] if entry["cover"] else GENERIC_ART
        thumb = tactical[0]["thumb"] if tactical else (plans[0]["src"] if plans else GENERIC_ART)
        meta[key] = {
            "key": key, "en": entry["en"], "ru": entry["ru"], "realm": entry["realm"],
            "hooks": entry["hooks"], "cover": cover, "thumb": thumb,
            "tacticals": tactical, "plans": plans,
            "description": "Полное описание локации загружается из игрового каталога. Здесь показаны art локации, 3D-схема и план, если они доступны.",
        }
        for alias in [entry["en"], *entry["aliases"]]:
            aliases.setdefault(norm(alias), key)
            aliases.setdefault(map_key(alias), key)
        aliases.setdefault(key, key)
        fallback_maps.append({
            "id": slug, "mapKey": key, "name": entry["ru"], "nameEn": entry["en"],
            "displayName": f"{entry['ru']} ({entry['en']})", "description": "",
            "image": cover, "realm": entry["realm"], "hooks": entry["hooks"],
            "category": entry["realm"], "source": "https://dbd.source.gs/maps/",
        })

    js = (
        "/* Generated by scripts/build_map_assets.py — do not edit by hand. */\n"
        f"window.DBD_MAP_META={json.dumps(meta, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.DBD_MAP_ALIASES={json.dumps(aliases, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.DBD_FALLBACK_MAPS={json.dumps(fallback_maps, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    (ROOT / "maps-data.js").write_text(js, encoding="utf-8")
    (OUT / "CREDITS.md").write_text(
        "# Map artwork credits\n\n"
        "3D map views: SamoelColt. Top-down plans: EagerFace. Source project: "
        "[LucaFontanot/dbd-map-overlay](https://github.com/LucaFontanot/dbd-map-overlay), Apache-2.0.\n\n"
        "Location artwork and game data: [dbd.source.gs](https://dbd.source.gs). "
        "Dead by Daylight art belongs to Behaviour Interactive and its licensors. "
        "This project is unofficial and is not affiliated with Behaviour Interactive.\n\n"
        "Atmospheric fallback art and app icons were generated for DBD Fog Companion. "
        "Maps without a community plan use the bundled fallback rather than an invented "
        "numbered diagram. The generated WebP files are optimized copies; see "
        "`data/map-sources.json` for the source paths.\n",
        encoding="utf-8",
    )
    print(f"Generated {len(meta)} map records, {len(asset_map)} local images and maps-data.js")


if __name__ == "__main__":
    main()
