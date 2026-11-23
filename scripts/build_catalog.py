#!/usr/bin/env python3
"""Build an offline catalog from the public dbd.source.gs reference pages."""
import json, re, sys, time
from pathlib import Path
from urllib.parse import urljoin
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
    active = False
    pieces, image_urls = [], []
    for element in soup.descendants:
        if isinstance(element, Tag) and element.name in ("h2", "h3"):
            heading = clean(element)
            if heading.lower() == "add-ons" or heading.lower().endswith(" add-ons"):
                active = True
                continue
            if active:
                active = False
        if not active:
            continue
        if isinstance(element, NavigableString):
            value = str(element).strip()
            if value:
                pieces.append(value)
        elif isinstance(element, Tag) and element.name == "a":
            href = element.get("href", "")
            if "cdn.source.gs" in href:
                image_urls.append(urljoin(BASE, href))
    text = " ".join(pieces)
    pattern = re.compile(r"Image\s*(.{2,100}?)\s+(Visceral|Ultra Rare|Very Rare|Rare|Uncommon|Common)\b", re.I)
    matches = list(pattern.finditer(text))
    records = []
    for i, match in enumerate(matches):
        name = re.sub(r"\s+", " ", match.group(1)).strip(" •|—-")
        if not name or len(name) > 100:
            continue
        stop = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        description = text[match.end():stop].strip(" •|—-")
        records.append({
            "id": re.sub(r"[^a-z0-9]+", "-", (owner + "-" + name).lower()).strip("-"),
            "name": name,
            "description": description,
            "image": image_urls[i] if i < len(image_urls) else "",
            "category": owner,
            "rarity": match.group(2),
            "source": BASE,
        })
    return records

def scrape_addons():
    items_soup = page("/items/")
    addons = addon_section(items_soup, "Предметы выжившего")
    # The items page has a separate Add-ons heading for each survivor item family.
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
    # The source reports 922 total add-ons; deduplicate repeated cards by owner and name.
    unique, keys = [], set()
    for item in addons:
        key = (item["category"].lower(), item["name"].lower())
        if key not in keys:
            keys.add(key)
            unique.append(item)
    print("Add-on extraction:", len(unique), "records from", len(paths), "killer pages plus survivor item page")
    return unique

def main():
    result = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": BASE,
        "perks": scrape_link_catalog("/perks/", "perks"),
        "offerings": scrape_offerings(),
        "maps": scrape_maps(),\n        "addons": scrape_addons(),
    }
    counts = {k: len(result[k]) for k in ("perks", "offerings", "maps")}
    print("Catalog extraction counts:", json.dumps(counts, ensure_ascii=False))
    # Fail the deployment rather than publish an incomplete or silently empty catalog.
    if counts["perks"] < 200 or counts["offerings"] < 80 or counts["maps"] < 40:
        raise SystemExit("Catalog validation failed; refusing to publish incomplete data.")
    Path("catalog-data.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("catalog-data.json created successfully")

if __name__ == "__main__":
    main()
