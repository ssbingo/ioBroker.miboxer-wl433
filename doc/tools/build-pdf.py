#!/usr/bin/env python3
"""Renders the manuals in doc/ to PDF with the print design of doc/tools/manual.css.

Usage (from the repository root):
    python3 doc/tools/build-pdf.py doc/Handbuch_miboxer-wl433.md doc/Manual_miboxer-wl433.md

Needs md-to-pdf (https://github.com/simonhaenisch/md-to-pdf). Set MD_TO_PDF to its executable, otherwise
"npx --yes md-to-pdf" is used. The Markdown files stay GitHub friendly; only the temporary copy that is rendered is
converted:
- the title block up to the first "##" heading becomes the cover page (with the adapter logo),
- the first "##" section (table of contents) gets its own page,
- GitHub alerts ("> [!TIP]" etc.) become coloured boxes,
- images on their own line become figures with the alt text as caption,
- every further "##" chapter starts on a new page.
Other documents (e.g. the protocol analysis) are rendered without cover page and page breaks, with the same design.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

TOOLS = os.path.dirname(os.path.abspath(__file__))
LABELS = {
    "de": {"TIP": "Tipp", "NOTE": "Hinweis", "IMPORTANT": "Wichtig", "WARNING": "Achtung", "CAUTION": "Vorsicht",
           "page": "Seite", "of": "von", "kicker": "ioBroker-Adapter · Handbuch"},
    "en": {"TIP": "Tip", "NOTE": "Note", "IMPORTANT": "Important", "WARNING": "Caution", "CAUTION": "Danger",
           "page": "Page", "of": "of", "kicker": "ioBroker adapter · User manual"},
}


def convert(markdown: str, lang: str) -> tuple[str, str]:
    labels = LABELS[lang]
    title = re.search(r"^# (.+)$", markdown, re.M).group(1)
    version_match = re.search(r"\| (?:Adapter-Version|Adapter version) \| ([^|]+) \|", markdown)

    if version_match:
        # manual: cover page, table of contents, every chapter on a new page
        version = version_match.group(1).strip()
        first_h2 = markdown.index("\n## ")
        second_h2 = markdown.index("\n## ", first_h2 + 1)
        cover = markdown[:first_h2].replace("miboxer-wl433", "miboxer\u2011wl433", 1)
        toc = markdown[first_h2:second_h2]
        body = markdown[second_h2:]
        cover = (
            '<section class="cover">\n\n'
            f'<p class="kicker">{labels["kicker"]}<br><span>MiBoxer WL-433 · PW01 · PW02</span></p>\n\n'
            '<img class="logo" src="img/miboxer-wl433.png" alt="">\n\n'
            + cover.strip()
            + "\n\n</section>\n"
        )
        toc = '\n<section class="toc">\n' + toc + "\n</section>\n"
        body = cover + toc + re.sub(r"^## (.+)$", r'<h2 class="chapter">\1</h2>', body, flags=re.M)
    else:
        # other documents: same design, no cover
        date = re.search(r"Stand (\d{2}\.\d{2}\.\d{4})", markdown)
        version = f"Stand {date.group(1)}" if date else ""
        body = markdown

    # GitHub alerts
    def alert(match: re.Match) -> str:
        kind = match.group(1)
        content = re.sub(r"^> ?", "", match.group(2), flags=re.M)
        return f'<div class="callout {kind.lower()}">\n\n**{labels[kind]}**\n\n{content.strip()}\n\n</div>\n'

    body = re.sub(r"^> \[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\n((?:>.*\n?)+)", alert, body, flags=re.M)

    # figures
    body = re.sub(
        r"^!\[([^\]]*)\]\(([^)]+)\)$",
        lambda m: f'<figure><img src="{m.group(2)}" alt="{m.group(1)}"><figcaption>{m.group(1)}</figcaption></figure>',
        body,
        flags=re.M,
    )
    footer = (
        '<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#5b6875;'
        'padding:0 17mm;display:flex;justify-content:space-between;">'
        f"<span>{title} · {version}</span>"
        f'<span>{labels["page"]} <span class="pageNumber"></span> {labels["of"]} <span class="totalPages"></span></span>'
        "</div>"
    )
    return body, footer


def main() -> None:
    renderer = os.environ.get("MD_TO_PDF", "npx --yes md-to-pdf").split()
    for source in sys.argv[1:]:
        lang = "en" if os.path.basename(source).startswith("Manual") else "de"
        folder = os.path.dirname(os.path.abspath(source))
        with open(source, encoding="utf-8") as file:
            markdown, footer = convert(file.read(), lang)
        with tempfile.NamedTemporaryFile("w", suffix=".md", dir=folder, delete=False, encoding="utf-8") as tmp:
            tmp.write(markdown)
            temp_md = tmp.name
        options = {
            "format": "A4",
            "printBackground": True,
            "displayHeaderFooter": True,
            "headerTemplate": "<span></span>",
            "footerTemplate": footer,
            "margin": {"top": "18mm", "bottom": "20mm", "left": "17mm", "right": "17mm"},
        }
        try:
            subprocess.run(
                renderer
                + [
                    temp_md,
                    "--stylesheet",
                    os.path.join(TOOLS, "manual.css"),
                    "--pdf-options",
                    json.dumps(options),
                    "--launch-options",
                    json.dumps({"args": ["--no-sandbox"]}),
                ],
                check=True,
            )
            shutil.move(temp_md[:-3] + ".pdf", os.path.splitext(os.path.abspath(source))[0] + ".pdf")
            print(f"{source} -> {os.path.splitext(source)[0]}.pdf")
        finally:
            os.remove(temp_md)


if __name__ == "__main__":
    main()
