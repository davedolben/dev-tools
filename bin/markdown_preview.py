#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["markdown>=3.5", "pygments>=2.17"]
# ///
"""Render a Markdown file to a nicely-styled HTML page and open it in a browser.

Usage:
    ./md_preview.py FILE.md [-o OUTPUT.html]
    ./md_preview.py FILE.md --stdout
    cat FILE.md | ./md_preview.py

If neither -o nor --stdout is given the HTML is written to a temp file in
/tmp and opened in the default browser.
"""

import argparse
import html
import sys
import tempfile
import webbrowser
from pathlib import Path
from typing import List, Optional

import markdown


# GitHub-flavored-ish styling. Kept close to what GitHub renders so long-form
# docs read comfortably; the "markdown-body" wrapper scopes everything.
CSS = """
  :root {
    --fg: #1f2328;
    --muted: #59636e;
    --border: #d1d9e0;
    --bg: #ffffff;
    --code-bg: #f6f8fa;
    --accent: #0969da;
    --quote-border: #d1d9e0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #e6edf3;
      --muted: #9198a1;
      --border: #3d444d;
      --bg: #0d1117;
      --code-bg: #151b23;
      --accent: #4493f8;
      --quote-border: #3d444d;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .markdown-body {
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 24px 96px;
  }
  .markdown-body > *:first-child { margin-top: 0; }
  h1, h2, h3, h4, h5, h6 {
    margin: 24px 0 16px;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid var(--border); }
  h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid var(--border); }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: .875em; }
  h6 { font-size: .85em; color: var(--muted); }
  p, blockquote, ul, ol, dl, table, pre { margin: 0 0 16px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { padding-left: 2em; }
  li + li { margin-top: .25em; }
  blockquote {
    padding: 0 1em;
    color: var(--muted);
    border-left: .25em solid var(--quote-border);
  }
  code, kbd, pre, samp {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 85%;
  }
  code {
    padding: .2em .4em;
    background: var(--code-bg);
    border-radius: 6px;
  }
  pre {
    padding: 16px;
    overflow: auto;
    background: var(--code-bg);
    border-radius: 6px;
    line-height: 1.45;
  }
  pre code { padding: 0; background: none; border-radius: 0; font-size: 100%; }
  table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow: auto; }
  th, td { padding: 6px 13px; border: 1px solid var(--border); }
  th { font-weight: 600; }
  tr:nth-child(2n) { background: var(--code-bg); }
  img { max-width: 100%; }
  hr { height: 1px; margin: 24px 0; border: 0; background: var(--border); }
  /* Pygments highlighting: keep it minimal and theme-friendly. */
  .codehilite .k, .codehilite .kd, .codehilite .kn { color: #cf222e; }
  .codehilite .s, .codehilite .s1, .codehilite .s2 { color: #0a3069; }
  .codehilite .c, .codehilite .c1, .codehilite .cm { color: var(--muted); font-style: italic; }
  .codehilite .nf, .codehilite .nc { color: #8250df; }
  .codehilite .mi, .codehilite .mf { color: #0550ae; }
  @media (prefers-color-scheme: dark) {
    .codehilite .k, .codehilite .kd, .codehilite .kn { color: #ff7b72; }
    .codehilite .s, .codehilite .s1, .codehilite .s2 { color: #a5d6ff; }
    .codehilite .nf, .codehilite .nc { color: #d2a8ff; }
    .codehilite .mi, .codehilite .mf { color: #79c0ff; }
  }
"""

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<article class="markdown-body">
{body}
</article>
</body>
</html>
"""


def render(md_text: str, title: str) -> str:
    body = markdown.markdown(
        md_text,
        extensions=["fenced_code", "codehilite", "tables", "toc", "sane_lists"],
        extension_configs={"codehilite": {"guess_lang": False}},
    )
    return TEMPLATE.format(title=html.escape(title), css=CSS, body=body)


def _emit(out: str, args: argparse.Namespace) -> None:
    if args.stdout:
        sys.stdout.write(out)
    elif args.output:
        Path(args.output).write_text(out, encoding="utf-8")
        print(f"Wrote HTML to {args.output}", file=sys.stderr)
    else:
        # No destination given: drop it in /tmp and pop it open in the browser.
        fd, path = tempfile.mkstemp(suffix=".html", prefix="md-", dir="/tmp")
        with open(fd, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Wrote HTML to {path}", file=sys.stderr)
        webbrowser.open(f"file://{path}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Render a Markdown file to a styled HTML page and open it in a browser.",
    )
    parser.add_argument("file", nargs="?", help="path to the Markdown file (omit to read from stdin)")
    parser.add_argument("-o", "--output", help="write the HTML to this file")
    parser.add_argument(
        "--stdout", action="store_true", help="print the HTML to stdout instead of opening a browser"
    )
    args = parser.parse_args(argv)

    if args.file:
        md_text = Path(args.file).read_text(encoding="utf-8", errors="replace")
        title = Path(args.file).name
    else:
        if sys.stdin.isatty():
            parser.error("no file given and nothing piped on stdin (try: md_preview.py README.md)")
        md_text = sys.stdin.read()
        title = "Markdown preview"

    out = render(md_text, title)
    _emit(out, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
