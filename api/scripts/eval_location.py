"""Automated evaluation of Forest Echo's identification and location features.

Uses labelled Xeno-canto recordings (each has a species label, coordinates and date),
so no manual listening is needed.

  # 1. one-off: free Xeno-canto account -> API key at https://xeno-canto.org/account
  set XENO_CANTO_API_KEY=...            (PowerShell: $env:XENO_CANTO_API_KEY="...")
  python scripts/eval_location.py download --country "united states" --max 30 --out C:\\fe-test\\xc

  # 2. does the location filter help? (needs CLASSIFIER=birdnet deps installed)
  python scripts/eval_location.py run --dir C:\\fe-test\\xc

  # 3. is the geo model sane? (no audio needed)
  python scripts/eval_location.py geo-sanity

Run from the api/ folder with PYTHONPATH=. (PowerShell: $env:PYTHONPATH=".").
Xeno-canto recordings are individually licensed (mostly Creative Commons): keep them out of the repo.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

CLIP_SECONDS = 5  # matches the longest hold in the app


# ---------- pure helpers (unit-tested) ----------
def norm(s: str) -> str:
    return " ".join(s.lower().replace("-", " ").split())


def is_match(expected_sci: str, expected_common: str, got_sci: str, got_common: str) -> bool:
    """Scientific name first (taxonomies differ in common names), common name as a fallback."""
    if expected_sci and got_sci and norm(expected_sci) == norm(got_sci):
        return True
    return bool(expected_common and got_common and norm(expected_common) == norm(got_common))


def parse_recording_date(value: str) -> date | None:
    try:
        y, m, d = (int(x) for x in value.split("-")[:3])
        return date(y, m, d)
    except Exception:
        return None


def summarize(rows: list[dict]) -> dict:
    n = len(rows)
    if not n:
        return {"n": 0}

    def rate(key: str) -> float:
        return round(100 * sum(1 for r in rows if r[key] == "correct") / n, 1)

    def wrong(key: str) -> float:
        return round(100 * sum(1 for r in rows if r[key] == "wrong") / n, 1)

    def silent(key: str) -> float:
        return round(100 * sum(1 for r in rows if r[key] == "none") / n, 1)

    return {
        "n": n,
        "plain_correct_%": rate("plain"), "plain_wrong_%": wrong("plain"), "plain_silent_%": silent("plain"),
        "located_correct_%": rate("located"), "located_wrong_%": wrong("located"), "located_silent_%": silent("located"),
        "expected_in_geo_list_%": round(100 * sum(1 for r in rows if r["in_geo_list"]) / n, 1),
    }


def evaluate(items: list[dict], classify, geo_labels) -> list[dict]:
    """classify(audio_bytes, location, week) -> obs|None ; geo_labels(lat, lon, week) -> list[str]."""
    rows = []
    for it in items:
        audio = Path(it["path"]).read_bytes()
        loc = (it["lat"], it["lon"])
        row = {"file": Path(it["path"]).name, "expected": it["common"], "week": it["week"]}
        for key, location in (("plain", None), ("located", loc)):
            obs = classify(audio, location, it["week"])
            row[key + "_got"] = obs.species_name if obs else ""
            if obs is None:
                row[key] = "none"
            elif is_match(it["sci"], it["common"], obs.scientific_name, obs.species_name):
                row[key] = "correct"
            else:
                row[key] = "wrong"
        labels = geo_labels(it["lat"], it["lon"], it["week"])
        row["in_geo_list"] = any(
            is_match(it["sci"], it["common"], *(lab.split("_", 1) + [""])[:2]) for lab in labels
        )
        rows.append(row)
    return rows


# ---------- download ----------
def api_search(country: str, key: str, per_page: int, page: int) -> dict:
    q = f'cnt:"{country}" grp:birds q:A len:5-30'
    url = "https://xeno-canto.org/api/3/recordings?" + urllib.parse.urlencode(
        {"query": q, "key": key, "per_page": per_page, "page": page}
    )
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def cmd_download(a) -> None:
    key = os.environ.get("XENO_CANTO_API_KEY")
    if not key:
        sys.exit("Set XENO_CANTO_API_KEY first (free key: https://xeno-canto.org/account).")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    meta, seen, page = [], set(), 1
    while len(meta) < a.max:
        data = api_search(a.country, key, 100, page)
        recs = data.get("recordings", [])
        if not recs:
            break
        for r in recs:
            sci = f'{r.get("gen", "")} {r.get("sp", "")}'.strip()
            d = parse_recording_date(r.get("date", ""))
            try:
                lat, lon = float(r["lat"]), float(r["lon"])
            except (KeyError, ValueError, TypeError):
                continue
            if not d or sci in seen:  # one clip per species keeps the set varied
                continue
            seen.add(sci)
            from app.services.nearby import birdnet_week

            raw = out / f'{r["id"]}.src'
            clip = out / f'{r["id"]}.wav'
            urllib.request.urlretrieve(r["file"], raw)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-t", str(CLIP_SECONDS), "-i", str(raw),
                 "-ac", "1", "-ar", "48000", str(clip)], check=True, timeout=60)
            raw.unlink(missing_ok=True)
            meta.append({"path": str(clip), "sci": sci, "common": r.get("en", ""), "lat": lat, "lon": lon,
                         "week": birdnet_week(d), "xc_id": r["id"], "license": r.get("lic", "")})
            if len(meta) >= a.max:
                break
        if page >= int(data.get("numPages", 1)):
            break
        page += 1
    (out / "manifest.json").write_text(json.dumps(meta, indent=2))
    print(f"Saved {len(meta)} clips + manifest.json to {out}")


# ---------- run ----------
def cmd_run(a) -> None:
    from app.config import settings
    from app.services import classifier, nearby

    settings.classifier = "birdnet"
    items = json.loads((Path(a.dir) / "manifest.json").read_text())
    rows = evaluate(items, classifier.birdnet_classify, nearby.species_labels)
    out = Path(a.dir) / "results.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    s = summarize(rows)
    print(json.dumps(s, indent=2))
    print(f"\nPer-clip results: {out}")
    print("Read this honestly: a small sample, one clip per species, and Xeno-canto clips are cleaner than a real trail.")
    if s["located_wrong_%"] > s["plain_wrong_%"]:
        print("WARNING: the location filter made wrong answers MORE common. Check the species-name format.")


# ---------- geo sanity ----------
# Primary region: the United States, where BirdNET's training data and the eBird-based
# geo model are strongest. London is the contrast region the lists should NOT resemble.
HOME = ("New York City", (40.71, -74.01))
CONTRAST = ("London", (51.51, -0.12))
EXPECTED_HOME = {"american robin", "northern cardinal", "blue jay", "american crow", "song sparrow",
                 "mourning dove", "black capped chickadee", "downy woodpecker", "carolina wren",
                 "tufted titmouse", "house finch", "white breasted nuthatch", "dark eyed junco"}
MAX_OVERLAP = 0.25  # introduced species (House Sparrow, Starling...) overlap; tune after a first real run


def cmd_geo_sanity(_a) -> None:
    from app.config import settings
    from app.services import nearby

    settings.classifier = "birdnet"
    wk = nearby.birdnet_week(date.today())
    home = nearby.nearby_species(*HOME[1], week=wk, limit=200)["species"]
    other = nearby.nearby_species(*CONTRAST[1], week=wk, limit=200)["species"]
    home_names = {norm(s["species_name"]) for s in home}
    other_names = {norm(s["species_name"]) for s in other}
    jaccard = len(home_names & other_names) / max(1, len(home_names | other_names))
    found = sorted(EXPECTED_HOME & home_names)
    print(f"Week {wk}: {HOME[0]} list {len(home_names)} species, {CONTRAST[0]} list {len(other_names)} species")
    print(f"Overlap (Jaccard): {jaccard:.2f}  (expect low, under {MAX_OVERLAP})")
    print(f"Expected {HOME[0]} birds found: {len(found)}/{len(EXPECTED_HOME)} -> {found}")
    ok = jaccard < MAX_OVERLAP and len(found) >= 3
    print("PASS" if ok else "FAIL: the geo model is not returning region-appropriate species")
    sys.exit(0 if ok else 1)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("download"); d.add_argument("--country", default="united states"); d.add_argument("--max", type=int, default=30); d.add_argument("--out", required=True)
    r = sub.add_parser("run"); r.add_argument("--dir", required=True)
    sub.add_parser("geo-sanity")
    a = p.parse_args()
    {"download": cmd_download, "run": cmd_run, "geo-sanity": cmd_geo_sanity}[a.cmd](a)


if __name__ == "__main__":
    main()
