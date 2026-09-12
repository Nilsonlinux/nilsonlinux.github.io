#!/usr/bin/env python3
"""Generate plugin detail pages from the Noctalia plugins catalog.

Reads Nilsonlinux/noctalia-plugins' catalog.toml and, for EVERY plugin by
Nilsonlinux, regenerates plugins/<folder>/index.html from
scripts/plugin_page_template.html (README converted from Markdown, catalog
metadata for versions/badges/tags, thumbnail from the plugin repo).
Regeneration is idempotent — pages only change when the template or the
catalog data does.

The index.html catalog grid is rendered client-side from the same catalog.toml
and already links each card to plugins/<folder>/, so a new plugin only needs
its page to exist — no index edits required.

Run from the repository root:  python3 scripts/sync_plugins.py
"""
import datetime
import html
import sys
import tomllib
import urllib.request
from pathlib import Path

OWNER = "Nilsonlinux"
REPO = "noctalia-plugins"
BRANCH = "main"
RAW = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}"
ROOT = Path(__file__).resolve().parent.parent
PLUGINS_DIR = ROOT / "plugins"
TEMPLATE = ROOT / "scripts" / "plugin_page_template.html"

MONTHS = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "nilsonlinux-plugin-pages/1.0 (+github pages)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def fmt_date(ts) -> str:
    d = datetime.datetime.fromtimestamp(int(ts))
    return f"{d.day:02d} {MONTHS[d.month]} {d.year}"


def md_to_html(md_text: str) -> str:
    import markdown
    return markdown.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists"])


def tag_badges(tags) -> str:
    return "".join(f'<a href="../../index.html" class="tag-badge">{html.escape(t)}</a>' for t in tags or [])


def versions_rows(plugin) -> str:
    current = {
        "plugin_api": plugin.get("plugin_api"),
        "version": plugin.get("version"),
        "updated_at": plugin.get("updated_at"),
    }
    others = [
        r for r in plugin.get("release") or []
        if (r.get("plugin_api") != current["plugin_api"]) or (r.get("version") != current["version"])
    ]
    others.sort(key=lambda r: r.get("updated_at") or 0, reverse=True)
    rows = [current] + others
    out = []
    for i, row in enumerate(rows):
        latest = '<span class="version-latest">latest</span>' if i == 0 else ""
        out.append(
            "".join([
                "\n\t\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t\t<td><span class=\"version-cell\">",
                f"v{html.escape(str(row['version']))} {latest}",
                "</span></td>\n\t\t\t\t\t\t\t\t<td>",
                html.escape(str(row["plugin_api"])),
                "</td>\n\t\t\t\t\t\t\t\t<td>",
                fmt_date(row["updated_at"]),
                "</td>\n\t\t\t\t\t\t\t</tr>",
            ])
        )
    return "".join(out)


def footer_plugin_list(plugins) -> str:
    items = []
    for p in sorted(plugins, key=lambda x: x["name"].casefold()):
        folder = p["id"].split("/")[-1]
        items.append(f"\n\t\t\t\t\t\t\t\t<li><a href=\"../{html.escape(folder)}/index.html\">{html.escape(p['name'])}</a></li>")
    return "".join(items)


def build_page(plugin, template: str, plugins) -> str:
    folder = plugin["id"].split("/")[-1]
    name = plugin["name"]
    description = plugin.get("description", "")
    version = plugin.get("version", "")
    author = plugin.get("author", OWNER)

    try:
        readme_md = fetch(f"{RAW}/{folder}/README.md")
    except Exception:
        readme_md = f"# {name}\n\n{description}\n"

    repl = {
        "{{PLUGIN_NAME}}": html.escape(name),
        "{{DESCRIPTION}}": html.escape(description),
        "{{THUMB_PATH}}": f"{RAW}/{folder}/thumbnail.webp",
        "{{VERSION}}": html.escape(str(version)),
        "{{AUTHOR}}": html.escape(author),
        "{{FOLDER}}": html.escape(folder),
        "{{TAGS}}": tag_badges(plugin.get("tags")),
        "{{ABOUT_HTML}}": md_to_html(readme_md),
        "{{VERSIONS_TABLE}}": versions_rows(plugin),
        "{{GITHUB_URL}}": f"https://github.com/{OWNER}/{REPO}/tree/main/{folder}",
        "{{FOOTER_PLUGIN_LIST}}": footer_plugin_list(plugins),
    }
    page = template
    for token, value in repl.items():
        page = page.replace(token, value)
    return page


def main() -> int:
    catalog = tomllib.loads(fetch(f"{RAW}/catalog.toml"))
    plugins = [p for p in catalog.get("plugin", []) if (p.get("author") or "").casefold() == OWNER.casefold()]
    if not plugins:
        print(f"No plugins for {OWNER} in catalog; nothing to do.")
        return 0

    template = TEMPLATE.read_text(encoding="utf-8")
    created = []
    updated = []
    for plugin in plugins:
        folder = plugin["id"].split("/")[-1]
        dest = PLUGINS_DIR / folder / "index.html"
        content = build_page(plugin, template, plugins)
        if dest.exists():
            if dest.read_text(encoding="utf-8") != content:
                dest.write_text(content, encoding="utf-8")
                updated.append(folder)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
            created.append(folder)

    if created:
        print(f"Created plugin pages: {', '.join(created)}")
    if updated:
        print(f"Updated plugin pages: {', '.join(updated)}")
    if not created and not updated:
        print("All plugin pages up to date.")
    return 0


if __name__ == "__main__":
    sys.exit(main())