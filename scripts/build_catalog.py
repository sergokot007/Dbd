#!/usr/bin/env python3
"""Build an offline catalog from the public dbd.source.gs reference pages."""
import ast, json, re, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin, quote, unquote, urlencode
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
        hooks = re.search(r"(\d+\s+to\s+\d+\s+hooks?)", text, re.I)
        if not hooks:
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
        "perks": ("tools/perk_icon_ids.py", ["PERK_ICON_IDS"]),
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
    category_map = {}
    if kind == "addons":
        for variable in ("ADDON_RU_EN", "ITEM_ADDON_RU_EN"):
            for group_name, group in maps.get(variable, {}).items():
                for ru, en in group.items():
                    key = re.sub(r"[^a-z0-9]+", "", str(en).lower())
                    en_to_ru[key] = ru
                    if variable == "ITEM_ADDON_RU_EN":
                        category_map[key] = group_name
    elif kind == "items":
        for ru, en in maps.get("ITEM_RU_EN", {}).items():
            en_to_ru[re.sub(r"[^a-z0-9]+", "", str(en).lower())] = ru
    elif kind == "characters":
        for variable in ("KILLER_EN_RU", "SURVIVOR_EN_RU"):
            for en, ru in maps.get(variable, {}).items():
                en_to_ru[re.sub(r"[^a-z0-9]+", "", str(en).lower())] = ru
    owner_map = maps.get("KILLER_EN_RU", {})
    translated = 0
    for item in records:
        if kind == "addons":
            owner = str(item.get("category") or "")
            owner_key = re.sub(r"^The\s+", "", owner, flags=re.I)
            if owner in owner_map or owner_key in owner_map:
                item["category"] = owner_map.get(owner) or owner_map.get(owner_key)
        english = str(item.get("nameEn") or item.get("name") or "")
        key = re.sub(r"[^a-z0-9]+", "", english.lower())
        russian = en_to_ru.get(key)
        if russian:
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
            if kind == "addons" and item.get("category") == "Предметы выжившего":
                item["category"] = category_map.get(key, item["category"])
        elif english:
            item["nameEn"] = english
            item["displayName"] = english
    print("Russian", kind, "names:", translated, "/", len(records))
    return records


def ru_wiki_soup(title):
    """Fandom page fetch with API fallback for runners that cannot access page HTML."""
    encoded = quote(title.replace(" ", "_"), safe="()")
    direct = "https://dead-by-daylight.fandom.com/ru/wiki/" + encoded
    try:
        response = requests.get(direct, headers=HEADERS, timeout=6)
        if response.status_code == 200 and "mw-parser-output" in response.text:
            return BeautifulSoup(response.text, "html.parser")
    except Exception:
        pass
    try:
        response = requests.get(
            "https://dead-by-daylight.fandom.com/ru/api.php",
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
    # GitHub-hosted runners are often blocked by Fandom. Jina Reader can fetch
    # the same public page and return its HTML when explicitly requested.
    try:
        proxy_url = "https://r.jina.ai/" + direct
        proxy_headers = {**HEADERS, "X-Respond-With": "html"}
        response = requests.get(proxy_url, headers=proxy_headers, timeout=12)
        response.raise_for_status()
        if "<html" in response.text.lower() or "mw-parser-output" in response.text:
            print("Russian wiki page loaded through proxy:", title)
            return BeautifulSoup(response.text, "html.parser")
    except Exception as exc:
        print("Russian wiki proxy unavailable for", title, repr(exc))
    return None


def fetch_ru_wiki_export(titles, batch_size=50):
    """Bulk-download Russian wiki article source in a few proxy requests."""
    titles = list(dict.fromkeys(str(x).strip() for x in titles if str(x).strip()))
    result = {}
    for start in range(0, len(titles), batch_size):
        batch = titles[start:start + batch_size]
        params = urlencode({"action": "query", "export": "1", "exportnowrap": "1", "titles": "|".join(batch), "format": "xml"})
        target = "https://dead-by-daylight.fandom.com/ru/api.php?" + params
        proxy = "https://r.jina.ai/" + target
        payload = ""
        for attempt in range(3):
            try:
                response = requests.get(proxy, headers={**HEADERS, "X-Respond-With": "html"}, timeout=25)
                if response.status_code == 429:
                    time.sleep(4 + attempt * 3)
                    continue
                response.raise_for_status()
                payload = response.text
                break
            except Exception as exc:
                print("Russian wiki export batch failed:", start, repr(exc))
                time.sleep(2)
        if not payload:
            continue
        try:
            root = ET.fromstring(payload)
            for page_node in root.iter():
                if page_node.tag.rsplit("}", 1)[-1] != "page":
                    continue
                title, wikitext = "", ""
                for node in page_node.iter():
                    local = node.tag.rsplit("}", 1)[-1]
                    if local == "title" and not title:
                        title = node.text or ""
                    elif local == "text":
                        wikitext = node.text or ""
                if title and wikitext:
                    result[title.replace("_", " ")] = wikitext
        except Exception as exc:
            print("Could not parse Russian wiki export:", repr(exc), payload[:180])
        print("Russian wiki export batch:", start + 1, "-", start + len(batch), "of", len(titles), "loaded", len(result))
        if start + batch_size < len(titles):
            time.sleep(3)
    return result

def wiki_links(wikitext):
    found = []
    for raw in re.findall(r"\[\[([^|\]#]+)(?:\|[^\]]*)?\]\]", wikitext or ""):
        title = raw.strip().replace("_", " ")
        if not title or ":" in title or title.startswith("#"):
            continue
        if title not in found:
            found.append(title)
    return found

def clean_wikitext(value):
    value = re.sub(r"<!--.*?-->", " ", value or "", flags=re.S)
    value = re.sub(r"<ref[^>]*>.*?</ref>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<ref[^>]*/>", " ", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    for _ in range(5):
        value = re.sub(r"\{\{[^{}]*\}\}", " ", value)
    value = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", value)
    value = re.sub(r"'{2,3}", "", value)
    value = re.sub(r"<[^>]+>", " ", value)
    lines = []
    for line in value.splitlines():
        line = re.sub(r"^\s*[*#;:]+\s*", "", line).strip()
        if line and not line.startswith(("|", "{|", "|}", "!", "__")):
            lines.append(line)
    return re.sub(r"\s+", " ", " ".join(lines)).strip()

def article_english_name_wikitext(wikitext):
    match = re.search(r'\(англ\.\s*["«]?(.+?)["»]?\)', wikitext or "", re.I)
    return match.group(1).strip().strip('"«»') if match else ""

def article_description_wikitext(wikitext):
    headings = list(re.finditer(r"(?m)^==\s*(.*?)\s*==\s*$", wikitext or ""))
    for i, heading in enumerate(headings):
        if heading.group(1).strip().lower() == "описание":
            end = headings[i + 1].start() if i + 1 < len(headings) else len(wikitext)
            return clean_wikitext(wikitext[heading.end():end])
    # Offering pages often put the in-game effect in the lead paragraph instead of a section.
    for line in (wikitext or "").splitlines():
        line = line.strip()
        if not line or line.startswith(("{{", "{|", "|", "==", "[[Категория:")):
            continue
        if "англ." in line.lower():
            line = re.sub(r"^.*?\(англ\..*?\)\s*[-—–:]\s*", "", line, flags=re.I)
        value = clean_wikitext(line)
        if len(value) > 20:
            return value
    return ""

def norm_en(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())

def scrape_perk_ru_map(maps):
    """Combine the Russian icon-ID table with character-owned perk lists."""
    result = {}
    for russian, icon_id in maps.get("PERK_ICON_IDS", {}).items():
        key = norm_en(icon_id)
        if key:
            result[key] = russian
    killer_map = maps.get("KILLER_EN_RU", {})
    survivor_map = maps.get("SURVIVOR_EN_RU", {})
    killer_perks = maps.get("KILLERS", {})
    survivor_perks = maps.get("SURVIVORS", {})
    jobs = []
    for index_path, name_map, perk_map in [
        ("/killers/", killer_map, killer_perks),
        ("/survivors/", survivor_map, survivor_perks),
    ]:
        try:
            index = page(index_path)
            seen = set()
            for a in index.find_all("a", href=True):
                href = a["href"].split("#")[0]
                if re.match(r"^" + re.escape(index_path) + r"[^/]+/?$", href) and href not in seen:
                    seen.add(href)
                    jobs.append((href, name_map, perk_map))
        except Exception as exc:
            print("Character perk index unavailable:", index_path, repr(exc))
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
                match = re.match(r"^/perks/([^/]+)/?$", a["href"].split("#")[0])
                if match and match.group(1) not in seen:
                    seen.add(match.group(1))
                    ids.append(match.group(1))
            return {norm_en(perk_id): ru for perk_id, ru in zip(ids[:3], russian_perks[:3])}
        except Exception as exc:
            print("Character perk map failed:", path, repr(exc))
            return {}
    from concurrent.futures import ThreadPoolExecutor
    character_map = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for part in pool.map(read_character, jobs):
            character_map.update(part)
    result.update(character_map)
    common = {
        "hexnooneescapesdeath": "Порча: никому не скрыться от смерти",
        "hexthrillofthehunt": "Порча: охотничий азарт",
        "scourgehookmonstrousshrine": "Секущий крюк: чудовищный храм",
        "bittermurmur": "Тихий шорох",
        "distressing": "Ужасающая",
        "kindred": "Родственные души",
        "thisisnothappening": "Это не происходит",
        "detectiveshunch": "Интуиция детектива",
        "stakeout": "Под прицелом",
        "slipperymeat": "Скользкое мясо",
        "unnervingpresence": "Пугающее присутствие",
        "enduring": "Стойкость",
        "lightborn": "Светорожденный",
        "tinkerer": "Мастер на все руки",
        "anursescalling": "Зов медсестры",
        "hexdevourhope": "Порча: пожирающая надежда",
    }
    result.update(common)
    print("Russian perk-name map combined:", len(result), "slugs; character pages:", len(character_map))
    return result



def perk_english_from_slug(slug):
    slug = str(slug or "").lower().strip("/")
    special = {
        "deja-vu": "Déjà Vu", "well-make-it": "We'll Make It", "we-ll-make-it": "We'll Make It",
        "a-nurses-calling": "A Nurse's Calling", "nurses-calling": "A Nurse's Calling",
        "hex-no-one-escapes-death": "Hex: No One Escapes Death",
        "hex-thrill-of-the-hunt": "Hex: Thrill of the Hunt",
        "scourge-hook-monstrous-shrine": "Scourge Hook: Monstrous Shrine",
        "hex-devour-hope": "Hex: Devour Hope", "this-is-not-happening": "This Is Not Happening",
        "detectives-hunch": "Detective's Hunch", "stake-out": "Stake Out",
        "bitter-murmur": "Bitter Murmur",
    }
    if slug in special:
        return special[slug]
    words = slug.replace("_", "-").split("-")
    name = " ".join(x.capitalize() for x in words if x)
    name = re.sub(r"^Hex\s+", "Hex: ", name)
    name = re.sub(r"^Scourge Hook\s+", "Scourge Hook: ", name)
    return name

def apply_perk_ru_names(records, id_map):
    translated = 0
    for item in records:
        perk_id = str(item.get("id") or "")
        english = str(item.get("nameEn") or item.get("name") or "")
        if len(english) > 90 or len(english.split()) > 9:
            english = perk_english_from_slug(perk_id)
        russian = id_map.get(norm_en(perk_id)) or id_map.get(norm_en(english))
        if russian:
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
        else:
            item["nameEn"] = english
            item["displayName"] = english
    print("Russian perk names:", translated, "/", len(records))
    missing = [str(x.get("nameEn") or x.get("name")) for x in records if not re.search(r"[А-Яа-яЁё]", str(x.get("name") or ""))]
    print("Perks without RU names:", missing[:30])
    return records

def scrape_ru_perk_descriptions(records, ru_maps):
    """Load Russian perk descriptions from bulk wiki exports."""
    titles = [str(x.get("name")) for x in records if re.search(r"[А-Яа-яЁё]", str(x.get("name") or ""))]
    exported = fetch_ru_wiki_export(titles)
    by_title = {norm_en(k): v for k, v in exported.items()}
    exact_count = 0
    for item in records:
        source = by_title.get(norm_en(item.get("name") or ""), "")
        description = article_description_wikitext(source)
        if description:
            item["description"] = description
            exact_count += 1
    print("Russian wiki perk descriptions:", exact_count, "/", len(records))
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
    missing = [str(x.get("nameEn") or x.get("name")) for x in records if not re.search(r"[А-Яа-яЁё]", str(x.get("name") or ""))]
    print("Perks without RU names:", missing[:25])
    return records

def scrape_ru_addon_descriptions(addons, maps):
    """Bulk-read Russian add-on names and descriptions from power/item wiki tables."""
    pages = []
    for data in maps.get("KILLERS", {}).values():
        power = data.get("power")
        if power:
            pages.append(power + " (улучшения)")
    pages.extend(["Аптечка (улучшения)", "Фонарик (улучшения)", "Ящик с инструментами (улучшения)", "Карта (улучшения)", "Ключ (улучшения)", "Флакон с туманом (улучшения)"])
    exported = fetch_ru_wiki_export(pages)
    names, descriptions = {}, {}
    for page_title, source in exported.items():
        for table in re.findall(r"\{\|.*?\|\}", source, re.S):
            rows = re.split(r"(?m)^\|-\s*$", table)
            for row in rows:
                cells = []
                for line in row.splitlines():
                    line = line.strip()
                    if line.startswith("|") and not line.startswith("|}"):
                        cells.extend(re.split(r"\s*\|\|\s*", line[1:].strip()))
                if not cells:
                    continue
                combined = " ".join(cells)
                match = re.search(r'\(англ\.\s*["«]?(.+?)["»]?\)', combined, re.I)
                if not match:
                    continue
                english = match.group(1).strip().strip('"«»')
                key = norm_en(english)
                name_cell = next((c for c in cells if "англ." in c.lower()), "")
                russian = clean_wikitext(re.sub(r"\(англ\..*", "", name_cell, flags=re.I)).strip()
                if russian:
                    names[key] = russian
                candidates = [clean_wikitext(c) for c in cells if c != name_cell]
                candidates = [c for c in candidates if len(c) > 12 and not re.search(r"\b(?:Common|Uncommon|Rare|Very Rare|Ultra Rare)\b", c, re.I)]
                if candidates:
                    descriptions[key] = max(candidates, key=len)
    translated = described = 0
    for item in addons:
        english = str(item.get("nameEn") or item.get("name") or "")
        key = norm_en(english)
        if key in names:
            item["name"] = names[key]
            item["nameEn"] = english
            item["displayName"] = f"{names[key]} ({english})"
            translated += 1
        if key in descriptions:
            item["description"] = descriptions[key]
            described += 1
    print("Russian wiki add-on names:", translated, "/", len(addons))
    print("Russian wiki add-on descriptions:", described, "/", len(addons))
    missing = [str(x.get("nameEn") or x.get("name")) for x in addons if not re.search(r"[А-Яа-яЁё]", str(x.get("name") or ""))]
    print("Add-ons without RU names:", missing[:40])
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
    """Export the Russian index and its linked offering articles in batches."""
    index_pages = fetch_ru_wiki_export([index_title])
    source = next(iter(index_pages.values()), "")
    titles = [x for x in wiki_links(source) if len(x) < 100]
    print("Russian index article links:", index_title, len(titles))
    exported = fetch_ru_wiki_export(titles)
    result = {}
    for title, wikitext in exported.items():
        english = article_english_name_wikitext(wikitext)
        if english:
            result[norm_en(english)] = (title, english, article_description_wikitext(wikitext))
    print("Russian index map:", index_title, len(result), "English aliases")
    return result

def apply_ru_article_names(records, name_map):
    translated = descriptions = 0
    for item in records:
        english = str(item.get("nameEn") or item.get("name") or "")
        match = name_map.get(norm_en(english))
        if match:
            russian, english, *extra = match
            item["nameEn"] = english
            item["name"] = russian
            item["displayName"] = f"{russian} ({english})"
            translated += 1
            if extra and extra[0]:
                item["description"] = extra[0]
                descriptions += 1
    print("Russian article names matched:", translated, "/", len(records), "; descriptions:", descriptions)
    missing = [str(x.get("nameEn") or x.get("name")) for x in records if not re.search(r"[А-Яа-яЁё]", str(x.get("name") or ""))]
    print("Offerings without RU names:", missing[:30])
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


MAP_RU_EN = {
    "Ironworks of Misery": "Завод Страданий", "Coal Tower": "Угольная Башня",
    "Suffocation Pit": "Удушающая Яма", "Shelter Woods": "Лесная Опушка",
    "Groaning Storehouse": "Стонущий Склад",
    "The Thompson House": "Дом Томпсонов", "Torment Creek": "Ручей Страданий",
    "Rancid Abattoir": "Заброшенная Скотобойня", "Rotten Fields": "Сгнившие Поля",
    "Fractured Cowshed": "Разрушенный Хлев",
    "Wretched Shop": "Магазин Барахольщика", "Blood Lodge": "Кровавая Лачуга",
    "Azarov's Resting Place": "Место Упокоения Азарова", "Wreckers' Yard": "Зона Свалки",
    "Gas Heaven": "Гэс Хевен",
    "Father Campbell's Chapel": "Часовня Отца Кэмпбелла", "Disturbed Ward": "Отделение для Буйных",
    "Lampkin Lane": "Переулок Лэмпкин", "Treatment Theater": "Лечебный Зал",
    "Mother's Dwelling": "Обитель Матери", "The Temple of Purgation": "Храм Очищения",
    "The Pale Rose": "Бледная Роза", "Grim Pantry": "Чудовищная Кладовая",
    "Badham Preschool I": "Детский Сад Бэдхем I", "Badham Preschool II": "Детский Сад Бэдхем II",
    "Badham Preschool III": "Детский Сад Бэдхем III", "Badham Preschool IV": "Детский Сад Бэдхем IV",
    "Badham Preschool V": "Детский Сад Бэдхем V",
    "The Game": "Игра", "Family Residence": "Семейная Резиденция",
    "Sanctum of Wrath": "Прибежище Гнева", "Mount Ormond Resort": 'Курорт "Гора Ормонд"',
    "Ormond Lake Mine": "Шахта Озера Ормонд", "The Underground Complex": "Подземный Комплекс",
    "Dead Dawg Saloon": 'Салун "Мертвяк Вусмерть"', "Midwich Elementary School": "Начальная Школа Мидвича",
    "Raccoon City Police Station East Wing": "Полицейский Участок Раккун-Сити: Восточное Крыло",
    "Raccoon City Police Station West Wing": "Полицейский Участок Раккун-Сити: Западное Крыло",
    "Eyrie of Crows": "Воронье Гнездовье", "Dead Sands": "Мёртвые Пески",
    "Garden of Joy": "Сад Счастья", "Greenville Square": "Площадь Гринвилла",
    "Freddy Fazbear's Pizza": "Пиццерия Фредди Фазбера", "Fallen Refuge": "Убежище Павших",
    "The Shattered Square": "Разрушенная Площадь", "Forgotten Ruins": "Забытые Руины",
    "Toba Landing": "Площадка Тоба", "Nostromo Wreckage": 'Крушение "Ностромо"',
    "Trickster's Delusion": "Заблуждение Трикстера",
}

def scrape_ru_maps(records):
    realm_titles = list(dict.fromkeys(REALM_RU.values()))
    realm_export = fetch_ru_wiki_export(realm_titles)
    map_titles = []
    name_map = {norm_en(en): (ru, en, "") for en, ru in MAP_RU_EN.items()}
    source_names = {norm_en(x.get("name")): str(x.get("name") or "") for x in records}
    for source in realm_export.values():
        # Some realm pages expose the English map name as the display text of a Russian link.
        for target, display in re.findall(r"\[\[([^|\]]+)\|([^\]]+)\]\]", source):
            russian = target.strip().replace("_", " ")
            english = clean_wikitext(display)
            key = norm_en(english)
            if key in source_names:
                name_map[key] = (russian, source_names[key], "")
        for title in wiki_links(source):
            if len(title) < 100 and title not in realm_titles and title not in map_titles:
                map_titles.append(title)
    print("Russian map article links:", len(map_titles), "; direct English aliases:", len(name_map))
    map_export = fetch_ru_wiki_export(map_titles)
    for title, wikitext in map_export.items():
        english = article_english_name_wikitext(wikitext)
        if english:
            name_map[norm_en(english)] = (title, english, article_description_wikitext(wikitext))
    result = apply_ru_article_names(records, name_map)
    for item in result:
        realm_ru = REALM_RU.get(str(item.get("realm") or ""))
        if realm_ru:
            item["realm"] = realm_ru
            item["category"] = realm_ru
    missing = [str(x.get("nameEn") or x.get("name")) for x in result if not x.get("displayName") or x.get("displayName") == x.get("nameEn")]
    print("Maps without RU names:", missing[:30])
    return result, name_map


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
        "offerings": {en: ru for _, (ru, en, *_rest) in offering_ru_map.items()},
        "perksById": perk_ru_map,
        "maps": {en: ru for ru, en, *_ in map_ru_map.values()},
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
