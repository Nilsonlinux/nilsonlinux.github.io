#!/usr/bin/env python3
"""Gera o feed.xml (RSS 2.0) a partir do feed Atom das releases do NLinux.

O GitHub já entrega as notas de release renderizadas em HTML no
`releases.atom`, então o script não precisa de Markdown nem de dependências
externas. A API REST é usada só para saber quais releases existem de fato e a
data de publicação; um `GH_TOKEN`/`GITHUB_TOKEN` no ambiente evita o limite de
requisições anônimas. O workflow `.github/workflows/update-feed.yml` roda este
arquivo periodicamente; para atualizar à mão:

    python3 scripts/update_feed.py
"""

from __future__ import annotations

import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

SITE = "https://nilsonlinux.github.io"
FEED_URL = f"{SITE}/feed.xml"
CHANGELOG_URL = f"{SITE}/changelog.html"
SOURCE_URL = "https://github.com/Nilsonlinux/nlinux-iso-build/releases.atom"
API_URL = "https://api.github.com/repos/Nilsonlinux/nlinux-iso-build/releases?per_page=100"

ATOM = "{http://www.w3.org/2005/Atom}"
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "feed.xml"


def fetch(url: str, accept: str) -> bytes:
    headers = {
        "User-Agent": "nlinux-site-feed/1.0",
        "Accept": accept,
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def releases_from_api() -> list[dict[str, str]]:
    """Lista canônica de releases publicadas (o Atom pode trazer tags sem release)."""
    try:
        data = json.loads(fetch(API_URL, "application/vnd.github+json"))
    except Exception as error:  # noqa: BLE001 - o feed funciona sem a API
        print(f"aviso: não foi possível consultar a API do GitHub ({error})")
        return []

    releases = []
    for release in data:
        if release.get("draft") or release.get("prerelease"):
            continue
        if not release.get("html_url"):
            continue
        releases.append(
            {
                "title": release.get("name") or release.get("tag_name") or "NLinux",
                "link": release["html_url"],
                "date": release.get("published_at") or release.get("created_at"),
                "body": release.get("body") or "",
            }
        )
    return releases


def text(node: ET.Element, tag: str, default: str = "") -> str:
    element = node.find(f"{ATOM}{tag}")
    return (element.text or "").strip() if element is not None else default


def parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def cdata(value: str) -> str:
    """Envolve HTML em CDATA sem quebrar o XML se aparecer `]]>`."""
    return "<![CDATA[" + value.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def main() -> None:
    root = ET.fromstring(
        fetch(SOURCE_URL, "application/atom+xml, application/xml;q=0.9, */*;q=0.8")
    )

    atom_entries = {}
    for entry in root.findall(f"{ATOM}entry"):
        link = entry.find(f"{ATOM}link[@rel='alternate']")
        href = link.get("href") if link is not None else text(entry, "id")
        content = entry.find(f"{ATOM}content")
        atom_entries[href] = {
            "title": text(entry, "title", "NLinux"),
            "link": href,
            "date": parse_date(text(entry, "updated")),
            "content": content.text if content is not None and content.text else "",
        }

    releases = releases_from_api()
    if releases:
        entries = []
        for release in releases:
            atom = atom_entries.get(release["link"], {})
            entries.append(
                {
                    "title": release["title"],
                    "link": release["link"],
                    "date": parse_date(release["date"]),
                    "content": atom.get("content")
                    or "<pre>" + escape(release["body"]) + "</pre>",
                }
            )
    else:
        entries = list(atom_entries.values())

    if not entries:
        raise SystemExit("Nenhuma release encontrada no feed do GitHub")

    entries.sort(key=lambda item: item["date"], reverse=True)
    latest = entries[0]["date"]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
        'xmlns:content="http://purl.org/rss/1.0/modules/content/">',
        "  <channel>",
        "    <title>NLinux — releases</title>",
        f"    <link>{CHANGELOG_URL}</link>",
        "    <description>Novas versões do NLinux: notas de release, "
        "download da ISO e checksum sha256.</description>",
        "    <language>pt-BR</language>",
        "    <copyright>© Nilsonlinux</copyright>",
        "    <ttl>60</ttl>",
        f"    <lastBuildDate>{format_datetime(latest)}</lastBuildDate>",
        f"    <pubDate>{format_datetime(latest)}</pubDate>",
        "    <generator>scripts/update_feed.py</generator>",
        f'    <atom:link href="{FEED_URL}" rel="self" type="application/rss+xml"/>',
        "    <image>",
        f"      <url>{SITE}/img/nlinux-512.png</url>",
        "      <title>NLinux — releases</title>",
        f"      <link>{CHANGELOG_URL}</link>",
        "    </image>",
    ]

    for entry in entries:
        lines += [
            "    <item>",
            f"      <title>{escape(entry['title'])}</title>",
            f"      <link>{escape(entry['link'])}</link>",
            f'      <guid isPermaLink="true">{escape(entry["link"])}</guid>',
            f"      <pubDate>{format_datetime(entry['date'])}</pubDate>",
            f"      <description>{cdata(entry['content'])}</description>",
            f"      <content:encoded>{cdata(entry['content'])}</content:encoded>",
            "    </item>",
        ]

    lines += ["  </channel>", "</rss>", ""]
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"feed.xml gerado com {len(entries)} releases (última: {entries[0]['title']})")


if __name__ == "__main__":
    main()
