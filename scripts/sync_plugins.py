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
# Official community catalog: a plugin listed there is published on
# https://noctalia.dev/plugins; otherwise it is still in development.
COMMUNITY_CATALOG_URL = "https://raw.githubusercontent.com/noctalia-dev/community-plugins/refs/heads/main/catalog.toml"
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
    try:
        import markdown
    except ImportError:
        # Graceful degradation when the optional `markdown` package is missing
        # (the CI installs it via scripts/requirements.txt and fully re-renders).
        return "<p>" + html.escape(md_text).replace("\n", "<br>\n") + "</p>"
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
        oldest = '<span class="version-oldest">primeira versão</span>' if len(rows) > 1 and i == len(rows) - 1 else ""
        badges = " ".join(filter(None, [latest, oldest]))
        cell = f"v{html.escape(str(row['version']))}"
        if badges:
            cell += " " + badges
        out.append(
            "".join([
                "\n\t\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t\t<td><span class=\"version-cell\">",
                cell,
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


def community_badge(plugin_id: str, community_ids: set) -> str:
    """Green badge when the plugin is on the official Noctalia Community
    catalog, amber "in development" otherwise."""
    if plugin_id in community_ids:
        return '<span class="badge badge-community"><i class="ti ti-world" aria-hidden="true"></i> On Noctalia Community</span>'
    return '<span class="badge badge-dev"><i class="ti ti-tools" aria-hidden="true"></i> Em desenvolvimento</span>'


def community_version_badge(plugin, community_versions: dict) -> str:
    """Compare the version published on the Noctalia Community catalog with the
    one on this page: green when in sync, amber with the delta when they differ;
    empty when the plugin is not published on the community."""
    community_version = community_versions.get(plugin["id"])
    if community_version is None:
        return ""
    my_version = str(plugin.get("version", ""))
    community_version = str(community_version)
    if my_version == community_version:
        return (f'<span class="badge badge-community" title="Versão da Community em dia"><i class="ti ti-checks" aria-hidden="true"></i> '
                f'Community v{html.escape(community_version)}</span>')
    return (f'<span class="badge badge-version-diff" title="Versão da Community diferente da desta página"><i class="ti ti-alert-triangle" aria-hidden="true"></i> '
            f'Community v{html.escape(community_version)} <span class="vs">vs</span> aqui v{html.escape(my_version)}</span>')


def build_page(plugin, template: str, plugins, community_versions: dict) -> str:
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
        "{{COMMUNITY_BADGE}}": community_badge(plugin["id"], set(community_versions)),
        "{{COMMUNITY_VERSION}}": community_version_badge(plugin, community_versions),
    }
    page = template
    for token, value in repl.items():
        page = page.replace(token, value)
    return page


def main() -> int:
    catalog = tomllib.loads(fetch(f"{RAW}/catalog.toml"))
    community_versions = {}
    try:
        community_plugins = tomllib.loads(fetch(COMMUNITY_CATALOG_URL)).get("plugin", [])
        community_versions = {p["id"]: p.get("version") for p in community_plugins if "id" in p}
        print(f"Community catalog: {len(community_versions)} plugins loaded")
    except Exception as exc:
        print(f"WARNING: could not fetch community catalog ({exc}); all plugins will show 'Em desenvolvimento'", file=sys.stderr)
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
        content = build_page(plugin, template, plugins, community_versions)
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