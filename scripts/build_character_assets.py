#!/usr/bin/env python3
"""Bundle the community character portraits used by perk-owner chips.

The generated WebP files are committed, so the site does not call GitHub at
runtime. Re-run this helper manually when the upstream icon set changes.
Requires the GitHub CLI (`gh`) and access to the public upstream repository.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "characters"
REPO = "flexeykinDev/dbd-perk-randomizer"
TREE = f"repos/{REPO}/git/trees/main?recursive=1"
RAW = f"repos/{REPO}/contents/{{path}}"


def gh_api(endpoint, *, raw=False):
    command = ["gh", "api", endpoint]
    if raw:
        command += ["-H", "Accept: application/vnd.github.raw"]
    result = subprocess.run(command, check=True, capture_output=True)
    return result.stdout


def is_webp(data):
    return len(data) > 16 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def download(path):
    filename = Path(path).name
    target = OUT / filename
    for attempt in range(3):
        try:
            data = gh_api(RAW.format(path=path), raw=True)
            if is_webp(data):
                target.write_bytes(data)
                return filename, len(data)
        except Exception:
            if attempt == 2:
                raise
        time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"Could not download a valid WebP icon: {path}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tree = json.loads(gh_api(TREE))
    paths = sorted(
        item["path"]
        for item in tree.get("tree", [])
        if item.get("path", "").startswith("public/characters/")
        and item.get("path", "").endswith(".webp")
        and item.get("type") == "blob"
    )
    if not paths:
        raise SystemExit("No upstream character portraits found")
    results = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(download, path): path for path in paths}
        for future in as_completed(futures):
            results.append(future.result())
    (OUT / "CREDITS.md").write_text(
        "# Портреты персонажей\n\n"
        "Локальные WebP-портреты для владельцев перков сохранены из "
        f"`public/characters/` репозитория [{REPO}](https://github.com/{REPO}).\n\n"
        "Исходный репозиторий распространяется по лицензии MIT; текст лицензии "
        "лежит в `data/LICENSE-MIT.txt`, атрибуция локализации — в `data/CREDITS.md`. "
        "Персонажи и изображения Dead by Daylight принадлежат Behaviour Interactive "
        "и её лицензиарам. Портреты используются в неофициальном справочнике и "
        "загружаются локально, без обращения к GitHub во время работы сайта.\n",
        encoding="utf-8",
    )
    total = sum(size for _, size in results)
    print(f"Bundled {len(results)} character portraits ({total / 1024:.0f} KiB) into assets/characters/.")


if __name__ == "__main__":
    main()
