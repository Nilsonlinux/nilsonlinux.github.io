#!/usr/bin/env python3
"""Build data/reactions.json with per-plugin GitHub issue reaction counts.

Reads all issues from Nilsonlinux/noctalia-plugins and aggregates the +1
(reaction) count per plugin folder (the issue title is the folder name). The
result is written to data/reactions.json so the site can render live-like
counts without calling the GitHub API from the browser.

The workflow runs this on a schedule and only commits when the counts change.
When GH_TOKEN/GITHUB_TOKEN is present it is used to avoid rate limits; the
workflow always passes github.token so the default 30-minute run is free.

Run from the repository root:  python3 scripts/update_reactions.py
"""
import json
import os
import time
import urllib.request
from pathlib import Path

OWNER = "Nilsonlinux"
REPO = "noctalia-plugins"
API = f"https://api.github.com/repos/{OWNER}/{REPO}/issues"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "reactions.json"


def fetch_json(url: str):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "nilsonlinux-site/1.0",
            "Accept": "application/vnd.github+json",
        },
    )
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def iter_issues():
    page = 1
    while True:
        data = fetch_json(f"{API}?state=all&per_page=100&page={page}&sort=updated&order=desc")
        if not data:
            break
        yield from data
        if len(data) < 100:
            break
        page += 1


def main() -> int:
    reactions: dict[str, dict] = {}
    for issue in iter_issues():
        if issue.get("pull_request"):
            continue
        folder = (issue.get("title") or "").strip()
        if not folder or "/" in folder:
            continue
        likes = int((issue.get("reactions") or {}).get("+1") or 0)
        entry = reactions.setdefault(folder, {"likes": 0, "issues": 0, "issue": None})
        entry["likes"] += likes
        entry["issues"] += 1
        number = issue.get("number")
        if entry["issue"] is None or issue.get("state") == "open":
            entry["issue"] = number

    payload = {
        "updated_at": int(time.time()),
        "source": f"{OWNER}/{REPO} issues",
        "reactions": {
            folder: {
                "likes": entry["likes"],
                "issues": entry["issues"],
                "issue": entry["issue"],
            }
            for folder, entry in sorted(reactions.items())
        },
    }

    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
    changed = previous != payload
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"reactions: {len(payload['reactions'])} plugins, changed: {'yes' if changed else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())