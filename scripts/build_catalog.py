#!/usr/bin/env python3
"""Build an offline catalog from the public dbd.source.gs reference pages."""
import json, re, sys, time
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

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
        key = (name.lower(), realm.lower())
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
    soup = page("/offerings/")
    out, seen = [], set()
    # The rendered index links each offering icon to cdn.source.gs; title and effect sit beside it.
    for icon_link in soup.find_all("a", href=True):
        src = icon_link["href"]
        if "cdn.source.gs" not in src:
            continue
        card = icon_link
        for parent in icon_link.parents:
            text = clean(parent)
            if 25 < len(text) < 1800:
                card = parent
                break
        raw = clean(card)
        marker = re.search(r"\b(?:Ultra Rare|Very Rare|Rare|Uncommon|Common|Event)\b", raw, re.I)
        if not marker:
            continue
        name = raw[:marker.start()].strip(" •|—-")
        name = re.sub(r"^(?:Image\s*)+", "", name).strip()
        name = re.sub(r"\s+", " ", name)
        if not name or len(name) > 100 or name.lower() in seen:
            continue
        seen.add(name.lower())
        out.append({"id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "name": name, "description": raw, "image": urljoin(BASE, src), "source": BASE + "/offerings/", "category": "Подношение"})
    return out

def main():
    result = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": BASE,
        "perks": scrape_link_catalog("/perks/", "perks"),
        "offerings": scrape_offerings(),
        "maps": scrape_maps(),
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
