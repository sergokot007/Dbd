#!/usr/bin/env python3
"""Build an offline catalog from the public dbd.source.gs reference pages."""
import ast, json, re, sys, time
from pathlib import Path
from urllib.parse import urljoin, quote, unquote
import requests
from bs4 import BeautifulSoup, Tag, NavigableString

BASE = "https://dbd.source.gs"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DBD-Fog-Companion/1.0)"}

def clean(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()

def img_for(node):
    img = node.find("img") if node else None
    if not img:
        return ""
    src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
    return urljoin(BASE, src) if src else ""

def page(path):
    response = requests.get(BASE + path, headers=HEADERS, timeout=40)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")

def title_for(node):
    for sel in ("h1", "h2", "h3", "h4", "[class*=name]", "[class*=title]", "strong"):
        found = node.select_one(sel)
        if found:
            value = clean(found)
            if value and len(value) < 100:
                return value
    return ""

def ancestor_card(node, max_len=1800):
    cur = node
    for _ in range(5):
        if not cur or not getattr(cur, "parent", None):
            break
        txt = clean(cur)
        if 15 < len(txt) < max_len and (cur.find("img") or cur.name in ("article", "li")):
            return cur
        cur = cur.parent
    return node.parent if node.parent else node

def scrape_link_catalog(path, kind):
    soup = page(path)
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = a["href"].split("#")[0]
        if not re.match(r"^/" + re.escape(kind) + r"/[^/]+/?$", href):
            continue
        card = ancestor_card(a)
        raw = clean(a)
        name = title_for(a) or a.get("aria-label") or a.get("title") or ""
        if not name:
            name = re.split(r"\s+(?:General perk|Very Rare|Ultra Rare|Rare|Uncommon|Common)\b", raw, maxsplit=1)[0]
        name = re.sub(r"^Image\s+", "", name).strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        text = clean(card)
        desc = text.replace(name, "", 1).strip(" •|—-")
        out.append({"id": href.strip("/").split("/")[-1], "name": name, "description": desc, "image": img_for(card), "source": urljoin(BASE, href), "category": kind})
    return out

def scrape_maps():
    soup = page("/maps/")
    out, seen = [], set()
    for h in soup.find_all(["h2", "h3", "h4"]):
        name = clean(h)
        if not name or name.lower() in {"maps", "browse"} or len(name) > 90:
            continue
        if not h.find_parent():
            continue
        card = ancestor_card(h)
        text = clean(card)
        if not re.search(r"\b\d+\s+to\s+\d+\s+hooks?\b", text, re.I) and h.name != "h3":
            continue
        # Realm is the closest preceding section heading.
        realm = ""
        for prev in h.find_all_previous(["h2"]):
            candidate = clean(prev)
            if candidate and candidate != name:
                realm = candidate
                break
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        hooks = re.search(r"(\d+\s+to\s+\d+\s+hooks?)", text, re.I)
        desc = text.replace(name, "", 1)
        if hooks:
            desc = desc.replace(hooks.group(1), "", 1)
        out.append({"id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "name": name, "description": desc.strip(" •|—-"), "image": img_for(card), "realm": realm, "hooks": hooks.group(1) if hooks else "", "category": realm, "source": BASE + "/maps/"})
    return out

def scrape_offerings():
    # Prefer the documented JSON endpoint when available.
    api = "https://dbd-stats.info/api/offerings?branch=live"
    try:
        response = requests.get(api, headers=HEADERS, timeout=8)
        response.raise_for_status()
        payload = response.json()
        candidates = payload if isinstance(payload, list) else []
        if isinstance(payload, dict):
            for key in ("data", "results", "items", "offerings", "entries", "list"):
                if isinstance(payload.get(key), list):
                    candidates = payload[key]
                    break
        normalized = []
        for item in candidates:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("displayName") or item.get("display_name") or item.get("title")
            if name:
                normalized.append({"id": str(item.get("id") or item.get("_id") or name), "name": str(name), "description": str(item.get("description") or item.get("desc") or item.get("effect") or ""), "image": str(item.get("image") or item.get("imageUrl") or item.get("image_url") or item.get("icon") or ""), "source": api, "category": str(item.get("category") or item.get("type") or "Подношение")})
        if len(normalized) >= 80:
            print("Offerings loaded from JSON endpoint:", len(normalized))
            return normalized
        print("Offerings JSON endpoint returned", len(normalized), "usable records; using HTML")
    except Exception as exc:
        print("Offerings JSON endpoint unavailable:", repr(exc))
    # The HTML catalog exposes each offering as a text card with rarity and side.
    soup = page("/offerings/")
    out, seen = [], set()
    rarity_re = re.compile(r"\b(?:Ultra Rare|Very Rare|Rare|Uncommon|Common|Event)\b", re.I)
    for node in soup.find_all(["h2", "h3", "h4", "a", "div", "article", "li"]):
        text = clean(node)
        if not text or len(text) > 1500:
            continue
        marker = rarity_re.search(text)
        if not marker:
            continue
        name = text[:marker.start()].strip(" •|—-")
        name = re.sub(r"^(?:Image\s*)+", "", name).strip()
        name = re.sub(r"\s+", " ", name)
        if not name or len(name) > 100 or name.lower() in seen:
            continue
        seen.add(name.lower())
        out.append({"id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "name": name, "description": text, "image": img_for(node), "source": BASE + "/offerings/", "category": "Подношение"})
    print("Offerings HTML records:", len(out))
    return out

def addon_section(soup, owner):
    """Read add-on cards from the real DOM; image alt text is not part of get_text()."""
    records = []
    rarity_re = re.compile(r"\b(Visceral|Ultra Rare|Very Rare|Rare|Uncommon|Common)\b", re.I)
    headings = [h for h in soup.find_all(["h2", "h3"]) if "add-on" in clean(h).lower()]
    for heading in headings:
        for img in heading.find_all_next("img"):
            # Only images belonging to this exact add-on section.
            if img.find_previous(["h2", "h3"]) is not heading:
                break
            pieces = []
            for node in img.next_elements:
                if isinstance(node, Tag) and node is not img:
                    if node.name in ("img", "h2", "h3"):
                        break
                if isinstance(node, NavigableString):
                    value = str(node).strip()
                    if value:
                        pieces.append(value)
            segment = re.sub(r"\s+", " ", " ".join(pieces)).strip()
            marker = rarity_re.search(segment)
            if not marker:
                continue
            name = segment[:marker.start()].strip(" •|—-:").strip()
            name = re.sub(r"^(?:Image\s*)+", "", name, flags=re.I).strip()
            if not name or len(name) > 100:
                continue
            description = segment[marker.end():].strip(" •|—-")
            # Keep a useful fallback if the source places the text outside the image node.
            if not description:
                card = ancestor_card(img)
                card_text = clean(card)
                card_marker = rarity_re.search(card_text)
                if card_marker:
                    description = card_text[card_marker.end():].strip(" •|—-")
            records.append({
                "id": re.sub(r"[^a-z0-9]+", "-", (owner + "-" + name).lower()).strip("-"),
                "name": name, "description": description, "image": urljoin(BASE, img.get("src") or img.get("data-src") or ""),
                "category": owner, "rarity": marker.group(1), "source": BASE,
            })
    return records

def assignment_from_python(source, variable):
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == variable for t in node.targets):
            return ast.literal_eval(node.value)
    return {}

def fetch_ru_maps():
    """Load maintained RU-client name maps; English names remain searchable."""
    root = "https://raw.githubusercontent.com/yungspiderq/dbd-randomizer/main/"
    files = {
        "addon": ("tools/addon_names_ru_en.py", ["ADDON_RU_EN", "ITEM_ADDON_RU_EN"]),
        "chars": ("tools/char_map_ru.py", ["KILLER_EN_RU", "SURVIVOR_EN_RU"]),
        "items": ("tools/char_names_ru_en.py", ["ITEM_RU_EN"]),
        "game": ("dbd_data.py", ["KILLERS", "SURVIVORS", "SURVIVOR_ITEMS"]),
    }
    result = {}
    for group, (path, variables) in files.items():
        try:
            response = requests.get(root + path, headers=HEADERS, timeout=25)
            response.raise_for_status()
            for variable in variables:
                result[variable] = assignment_from_python(response.text, variable)
        except Exception as exc:
            print("Russian name map unavailable:", path, repr(exc))
            result.update({variable: {} for variable in variables})
    return result

def apply_ru_names(records, maps, kind):
    en_to_ru = {}
    translated = 0
    if kind == "addons":
        for variable in ("ADDON_RU_EN", "ITEM_ADDON_RU_EN"):
            for group in maps.get(variable, {}).values():
                for ru, en in group.items():
                    en_to_ru[re.sub(r"[^a-z0-9]+", "", str(en).lower())] = ru
    elif kind == "items":
        for ru, en in maps.get("ITEM_RU_EN", {}).items():
            en_to_ru[re.sub(r"[^a-z0-9]+", "", str(en).lower())] = ru
    elif kind == "characters":
        for variable in ("KILLER_EN_RU", "SURVIVOR_EN_RU"):
            for en, ru in maps.get(variable, {}).items():
                en_to_ru[re.sub(r"[^a-z0-9]+", "", str(en).lower())] = ru
    owner_map = maps.get("KILLER_EN_RU", {})
    for item in records:
        if kind == "addons" and item.get("category") in owner_map:
            item["category"] = owner_map[item["category"]]
        english = str(item.get("nameEn") or item.get("name") or "")
        key = re.sub(r"[^a-z0-9]+", "", english.lower())
        russian = en_to_ru.get(key)
        if russian:
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
        elif english:
            item["nameEn"] = english
            item["displayName"] = english
    return records



def ru_wiki_soup(title):
    """Fandom page fetch with API fallback for runners that cannot access page HTML."""
    encoded = quote(title.replace(" ", "_"), safe="()")
    direct = "https://dead-by-daylight.fandom.com/ru/wiki/" + encoded
    try:
        response = requests.get(direct, headers=HEADERS, timeout=12)
        if response.status_code == 200 and "mw-parser-output" in response.text:
            return BeautifulSoup(response.text, "html.parser")
    except Exception:
        pass
    try:
        response = requests.get(
            "https://dead-by-daylight.fandom.com/api.php",
            params={"action": "parse", "page": title, "prop": "text", "format": "json"},
            headers=HEADERS, timeout=12,
        )
        response.raise_for_status()
        payload = response.json()
        html = payload.get("parse", {}).get("text", {}).get("*", "")
        if html:
            return BeautifulSoup(html, "html.parser")
    except Exception as exc:
        print("Fandom API unavailable for", title, repr(exc))
    return None


def scrape_perk_ru_map(maps):
    """Pair live English perk slugs with the maintained Russian client names."""
    killer_map = maps.get("KILLER_EN_RU", {})
    survivor_map = maps.get("SURVIVOR_EN_RU", {})
    killer_perks = maps.get("KILLERS", {})
    survivor_perks = maps.get("SURVIVORS", {})
    indexes = [("/killers/", killer_map, killer_perks), ("/survivors/", survivor_map, survivor_perks)]
    jobs = []
    for index_path, name_map, perk_map in indexes:
        try:
            soup = page(index_path)
            for a in soup.find_all("a", href=True):
                href = a["href"].split("#")[0]
                if re.match(r"^" + re.escape(index_path) + r"[^/]+/?$", href):
                    jobs.append((href, name_map, perk_map))
        except Exception as exc:
            print("Could not read character index for perk translations:", index_path, repr(exc))
    def read_character(job):
        path, name_map, perk_map = job
        try:
            soup = page(path)
            h1 = soup.find("h1")
            english_owner = clean(h1) if h1 else ""
            lookup = re.sub(r"^The\s+", "", english_owner, flags=re.I)
            russian_owner = name_map.get(english_owner) or name_map.get(lookup)
            if not russian_owner:
                return {}
            data = perk_map.get(russian_owner)
            russian_perks = data.get("perks", []) if isinstance(data, dict) else data
            if not russian_perks:
                return {}
            heading = next((h for h in soup.find_all(["h2", "h3"]) if clean(h).lower() == "perks"), None)
            if not heading:
                return {}
            ids, seen = [], set()
            for a in heading.find_all_next("a", href=True):
                if a.find_previous("h2") is not heading and a.find_previous("h3") is not heading:
                    break
                href = a["href"].split("#")[0]
                match = re.match(r"^/perks/([^/]+)/?$", href)
                if match and match.group(1) not in seen:
                    seen.add(match.group(1))
                    ids.append(match.group(1))
            result = {}
            for perk_id, russian_name in zip(ids[:3], russian_perks[:3]):
                result[perk_id] = russian_name
            return result
        except Exception as exc:
            print("Perk-name mapping failed for", path, repr(exc))
            return {}
    from concurrent.futures import ThreadPoolExecutor
    result = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for part in pool.map(read_character, jobs):
            result.update(part)
    # Shared perks do not belong to one character, so keep their verified RU-client names here.
    common = {
        "dark-sense": "Темное чувство", "deja-vu": "Дежавю", "hope": "Надежда",
        "bond": "Кровные узы", "lightweight": "Легковес", "no-mither": "Этому не бывать",
        "well-make-it": "Мы справимся", "premonition": "Предчувствие", "resilience": "Устойчивость",
        "slippery-meat": "Скользкое мясо", "small-game": "Мелкая дичь", "spine-chill": "Мурашки по спине",
        "no-one-left-behind": "Никто не остался позади", "plunderers-instinct": "Мародерское чутье",
        "whispers": "Шепоты", "deerstalker": "Охотник на оленей", "fearmonger": "Сеющий страх",
        "hex-no-one-escapes-death": "Порча: никому не скрыться от смерти",
        "hex-huntress-lullaby": "Порча: охотничий азарт", "insidious": "Коварство",
        "iron-grasp": "Мертвая хватка", "monstrous-shrine": "Секущий крюк: чудовищный храм",
        "sloppy-butcher": "Небрежный мясник", "spies-from-the-shadows": "Сумеречные шпионы",
        "shattered-hope": "Разбитые надежды", "unrelenting": "Безжалостный",
    }
    result.update(common)
    print("Russian perk-name map:", len(result), "slugs")
    return result

def apply_perk_ru_names(records, id_map):
    translated = 0
    for item in records:
        english = str(item.get("nameEn") or item.get("name") or "")
        russian = id_map.get(str(item.get("id") or ""))
        if russian:
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
    print("Russian perk names:", translated, "/", len(records))
    return records

def scrape_ru_perk_descriptions(records, ru_maps):
    """Read the Russian 'Описание' section from each perk article when available."""
    def read_one(item):
        russian = item.get("name")
        if not russian or not re.search(r"[А-Яа-яЁё]", str(russian)):
            return (item.get("id"), "")
        url = "https://dead-by-daylight.fandom.com/ru/wiki/" + quote(str(russian).replace(" ", "_"), safe="()")
        try:
            soup = ru_wiki_soup(str(russian))
            if soup is None:
                return (item.get("id"), "")
            heading = next((h for h in soup.find_all(["h2", "h3"]) if clean(h).lower() == "описание"), None)
            if not heading:
                return (item.get("id"), "")
            parts = []
            for sibling in heading.find_next_siblings():
                if sibling.name in ("h2", "h3", "table"):
                    break
                if sibling.name in ("p", "ul", "ol"):
                    value = clean(sibling)
                    if value:
                        parts.append(value)
            return (item.get("id"), " ".join(parts))
        except Exception:
            return (item.get("id"), "")
    from concurrent.futures import ThreadPoolExecutor
    by_id = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        for perk_id, description in pool.map(read_one, records):
            if perk_id and description:
                by_id[perk_id] = description
    for item in records:
        if by_id.get(item.get("id")):
            item["description"] = by_id[item["id"]]
    print("Russian wiki perk descriptions:", len(by_id), "/", len(records))
    for item in records:
        if by_id.get(item.get("id")):
            item["description"] = by_id[item["id"]]
    # Fallback: DBDFOG publishes a single searchable Russian catalog with all current perks.
    try:
        response = requests.get("https://dbdfog.ru/perks/", headers=HEADERS, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        owner_names = set()
        for variable in ("KILLER_EN_RU", "SURVIVOR_EN_RU"):
            owner_names.update(ru_maps.get(variable, {}).values())
        fallback_count = 0
        for item in records:
            if re.search(r"[А-Яа-яЁё]", item.get("description", "")):
                continue
            ru = str(item.get("name") or "")
            candidates = []
            for node in soup.find_all(["article", "li", "div"]):
                value = clean(node)
                if len(value) <= 1600 and value.count(ru) >= 2:
                    candidates.append(value)
            if not candidates:
                continue
            value = min(candidates, key=len)
            rest = value.rsplit(ru, 1)[-1].strip()
            for owner in sorted(owner_names, key=len, reverse=True):
                if rest.startswith(owner):
                    rest = rest[len(owner):].strip()
                    break
            if len(rest) > 20 and re.search(r"[А-Яа-яЁё]", rest):
                item["description"] = rest
                fallback_count += 1
        print("DBDFOG Russian perk descriptions:", fallback_count, "/", len(records))
    except Exception as exc:
        print("DBDFOG perk catalog unavailable:", repr(exc))
    return records


def scrape_ru_addon_descriptions(addons, maps):
    """Use Russian client-text tables from the RU community wiki when available."""
    killer_data = maps.get("KILLERS", {})
    pages = []
    for killer_ru, data in killer_data.items():
        power = data.get("power")
        if power:
            pages.append((power + " (улучшения)", killer_ru))
    item_pages = {
        "Аптечки": "Аптечка (улучшения)",
        "Фонарики": "Фонарик (улучшения)",
        "Ящики с инструментами": "Ящик с инструментами (улучшения)",
        "Карты": "Карта (улучшения)",
        "Ключи": "Ключ (улучшения)",
        "Предметы с туманом": "Флакон с туманом (улучшения)",
    }
    pages.extend((title, owner) for owner, title in item_pages.items())
    def read_page(entry):
        title, owner = entry
        url = "https://dead-by-daylight.fandom.com/ru/wiki/" + quote(title.replace(" ", "_"), safe="()")
        try:
            soup = ru_wiki_soup(title)
            if soup is None:
                return {}
            found = {}
            for tr in soup.find_all("tr"):
                cells = tr.find_all(["td", "th"], recursive=False)
                if len(cells) < 2:
                    continue
                row = " ".join(clean(c) for c in cells)
                match = re.search(r"\(англ\.\s*[\"«]?(.+?)[\"»]?\)", row, re.I)
                if not match:
                    continue
                english = match.group(1).strip().strip('"«»')
                description = clean(cells[-1])
                if english and description:
                    found[re.sub(r"[^a-z0-9]+", "", english.lower())] = description
            print("RU add-on descriptions:", title, len(found))
            return found
        except Exception as exc:
            print("RU add-on page unavailable:", title, repr(exc))
            return {}
    from concurrent.futures import ThreadPoolExecutor
    descriptions = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for part in pool.map(read_page, pages):
            descriptions.update(part)
    for item in addons:
        key = re.sub(r"[^a-z0-9]+", "", str(item.get("nameEn") or item.get("name") or "").lower())
        if key in descriptions:
            item["description"] = descriptions[key]
    print("Russian add-on descriptions matched:", sum(1 for x in addons if x.get("description") and any(re.search(r"[А-Яа-яЁё]", x["description"]) for _ in [0])))
    return addons

def scrape_addons():
    items_soup = page("/items/")
    addons = addon_section(items_soup, "Предметы выжившего")
    killer_index = page("/killers/")
    paths, seen = [], set()
    for a in killer_index.find_all("a", href=True):
        href = a["href"].split("#")[0]
        if re.match(r"^/killers/[^/]+/?$", href) and href not in seen:
            seen.add(href)
            paths.append(href)

    def one_killer(path):
        try:
            soup = page(path)
            h1 = soup.find("h1")
            owner = clean(h1) if h1 else path.strip("/").split("/")[-1]
            return addon_section(soup, owner)
        except Exception as exc:
            print("Could not read add-ons from", path, repr(exc))
            return []

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=10) as pool:
        for result in pool.map(one_killer, paths):
            addons.extend(result)
    unique, keys = [], set()
    for item in addons:
        key = (item["category"].lower(), item["name"].lower())
        if key not in keys:
            keys.add(key)
            unique.append(item)
    print("Add-on extraction:", len(unique), "records from", len(paths), "killer pages plus survivor item page")
    return unique


def article_english_name(soup):
    text = clean(soup)
    match = re.search(r'\(англ\.\s*["«]?(.+?)["»]?\)', text, re.I)
    return match.group(1).strip().strip('"«»') if match else ""

def scrape_ru_index_name_map(index_title):
    """Resolve English catalog names through Russian wiki index/article titles."""
    index_soup = ru_wiki_soup(index_title)
    if index_soup is None:
        print("Russian index unavailable:", index_title)
        return {}
    content = index_soup.find(id="mw-content-text") or index_soup
    links, seen = [], set()
    for a in content.find_all("a", href=True):
        href = a["href"].split("#")[0]
        title = clean(a)
        if not href.startswith("/ru/wiki/") or href.startswith("/ru/wiki/Категория:") or not title or len(title) > 100:
            continue
        page_title = unquote(href.rsplit("/", 1)[-1].split("?", 1)[0]).replace("_", " ")
        if page_title not in seen and title.lower() not in {"править", "история", "обсуждение"}:
            seen.add(page_title)
            links.append((page_title, title))
    def read_article(entry):
        page_title, russian_name = entry
        soup = ru_wiki_soup(page_title)
        if soup is None:
            return None
        english = article_english_name(soup)
        if not english:
            return None
        return (re.sub(r"[^a-z0-9]+", "", english.lower()), (russian_name, english))
    from concurrent.futures import ThreadPoolExecutor
    result = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        for found in pool.map(read_article, links):
            if found:
                result[found[0]] = found[1]
    print("Russian index map:", index_title, len(result), "English aliases")
    return result

def apply_ru_article_names(records, name_map):
    translated = 0
    for item in records:
        english = str(item.get("nameEn") or item.get("name") or "")
        match = name_map.get(re.sub(r"[^a-z0-9]+", "", english.lower()))
        if match:
            russian, english = match
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
    print("Russian article names matched:", translated, "/", len(records))
    return records

REALM_RU = {
    "MacMillan Estate": "Поместье МакМиллан", "Autohaven Wreckers": "Свалка Автохевен",
    "Coldwind Farm": "Ферма Колдвинд", "Crotus Prenn Asylum": "Психлечебница Кротус Пренн",
    "Haddonfield": "Хэддонфилд", "Backwater Swamp": "Гнилое болото",
    "Léry's Memorial Institute": "Мемориальный институт Лэри", "Red Forest": "Красный лес",
    "Springwood": "Спрингвуд", "Gideon Meat Plant": 'Мясокомбинат "Гидеон"',
    "Yamaoka Estate": "Поместье Ямаоки", "Ormond": "Ормонд",
    "Hawkins National Laboratory": "Национальная лаборатория Хоукинса",
    "Grave of Glenvale": "Могила в Гленвейле", "Silent Hill": "Сайлент Хилл",
    "Raccoon City": "Раккун-Сити", "Forsaken Boneyard": "Заброшенное кладбище",
    "Withered Isle": "Зачахший остров", "The Decimated Borgo": "Разоренная деревушка-борго",
    "Dvarka Deepwood": "Заросли Дварки", "Sleepless District": "Бессонный район",
}

def scrape_ru_maps(records):
    realm_links = {}
    for item in records:
        realm = str(item.get("realm") or "")
        russian_realm = REALM_RU.get(realm)
        if russian_realm:
            realm_links.setdefault(russian_realm, set())
    page_titles = set()
    for realm in realm_links:
        soup = ru_wiki_soup(realm)
        if soup is None:
            continue
        content = soup.find(id="mw-content-text") or soup
        for a in content.find_all("a", href=True):
            href = a["href"].split("#")[0]
            if href.startswith("/ru/wiki/") and not href.startswith("/ru/wiki/Категория:"):
                title = unquote(href.rsplit("/", 1)[-1].split("?", 1)[0]).replace("_", " ")
                if title != realm and len(title) < 100:
                    page_titles.add(title)
    def read_map(title):
        soup = ru_wiki_soup(title)
        if soup is None:
            return None
        english = article_english_name(soup)
        if not english:
            return None
        return (re.sub(r"[^a-z0-9]+", "", english.lower()), (title, english))
    from concurrent.futures import ThreadPoolExecutor
    name_map = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        for found in pool.map(read_map, sorted(page_titles)):
            if found:
                name_map[found[0]] = found[1]
    return apply_ru_article_names(records, name_map), name_map


def main():
    ru_maps = fetch_ru_maps()
    perk_ru_map = scrape_perk_ru_map(ru_maps)
    offering_ru_map = scrape_ru_index_name_map("Подношения")
    result = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": BASE,
        "perks": scrape_ru_perk_descriptions(apply_perk_ru_names(scrape_link_catalog("/perks/", "perks"), perk_ru_map), ru_maps),
        "offerings": apply_ru_article_names(scrape_offerings(), offering_ru_map),
        "maps": scrape_maps(),
        "addons": [],
    }
    result["characters"] = apply_ru_names(scrape_link_catalog("/killers/", "killers") + scrape_link_catalog("/survivors/", "survivors"), ru_maps, "characters")
    result["maps"], map_ru_map = scrape_ru_maps(result["maps"])
    result["items"] = apply_ru_names(scrape_link_catalog("/items/", "items"), ru_maps, "items")
    result["translations"] = {
        "characters": {**ru_maps.get("KILLER_EN_RU", {}), **ru_maps.get("SURVIVOR_EN_RU", {})},
        "items": {en: ru for ru, en in ru_maps.get("ITEM_RU_EN", {}).items()},
        "addons": {en: ru for variable in ("ADDON_RU_EN", "ITEM_ADDON_RU_EN") for group in ru_maps.get(variable, {}).values() for ru, en in group.items()},
        "offerings": {en: ru for _, (ru, en) in offering_ru_map.items()},
        "perksById": perk_ru_map,
        "maps": {en: ru for ru, en in map_ru_map.values()},
    }
    try:
        addon_records = scrape_addons()
        result["addons"] = apply_ru_names(addon_records, ru_maps, "addons")
        result["addons"] = scrape_ru_addon_descriptions(result["addons"], ru_maps)
        print("Published add-on records:", len(result["addons"]))
    except Exception as exc:
        print("Add-on catalog unavailable; continuing without it:", repr(exc))
    counts = {k: len(result[k]) for k in ("perks", "offerings", "maps", "addons", "characters", "items")}
    print("Catalog extraction counts:", json.dumps(counts, ensure_ascii=False))
    # Fail the deployment rather than publish an incomplete or silently empty catalog.
    if counts["perks"] < 200 or counts["offerings"] < 80 or counts["maps"] < 40:
        raise SystemExit("Catalog validation failed; refusing to publish incomplete data.")
    Path("catalog-data.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("catalog-data.json created successfully")

if __name__ == "__main__":
    main()
