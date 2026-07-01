#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Produce a GitHub-style side-by-side HTML diff.

Usage:
    # Diff two files directly:
    ./sidebyside_diff.py OLD_FILE NEW_FILE [-o OUTPUT.html]

    # Diff a git diff piped in on stdin (multi-file, with a sidebar):
    git diff | ./sidebyside_diff.py [-o OUTPUT.html]
    git diff HEAD~1 | ./sidebyside_diff.py

If neither -o nor --stdout is given the HTML is written to a temp file in
/tmp and opened in the default browser.
"""

import argparse
import difflib
import html
import re
import sys
import tempfile
import webbrowser
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class Row:
    # left/right line numbers are None where a side has no line (a pad row)
    left_no: Optional[int]
    left_text: Optional[str]
    right_no: Optional[int]
    right_text: Optional[str]
    # kind drives the row coloring: "equal", "delete", "insert", "replace"
    kind: str


def _inline_marks(a: str, b: str) -> Tuple[str, str]:
    """Return HTML for a/b with the differing spans wrapped in <span class="x">.

    Used on "replace" rows so the user can see exactly which characters changed,
    matching GitHub's intra-line highlighting.
    """
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    left_parts: List[str] = []
    right_parts: List[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        a_seg = html.escape(a[i1:i2])
        b_seg = html.escape(b[j1:j2])
        if tag == "equal":
            left_parts.append(a_seg)
            right_parts.append(b_seg)
        else:
            if a_seg:
                left_parts.append(f'<span class="x">{a_seg}</span>')
            if b_seg:
                right_parts.append(f'<span class="x">{b_seg}</span>')
    return "".join(left_parts), "".join(right_parts)


def build_rows(a_lines: List[str], b_lines: List[str]) -> List[Row]:
    """Align the two files into side-by-side rows using difflib opcodes."""
    sm = difflib.SequenceMatcher(a=a_lines, b=b_lines, autojunk=False)
    rows: List[Row] = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for off in range(i2 - i1):
                rows.append(
                    Row(i1 + off + 1, a_lines[i1 + off],
                        j1 + off + 1, b_lines[j1 + off], "equal")
                )
        elif tag == "delete":
            for off in range(i2 - i1):
                rows.append(Row(i1 + off + 1, a_lines[i1 + off], None, None, "delete"))
        elif tag == "insert":
            for off in range(j2 - j1):
                rows.append(Row(None, None, j1 + off + 1, b_lines[j1 + off], "insert"))
        elif tag == "replace":
            # Pair changed lines up so they sit on the same row; the longer side
            # spills into delete/insert rows.
            n_left = i2 - i1
            n_right = j2 - j1
            for off in range(max(n_left, n_right)):
                li = i1 + off
                rj = j1 + off
                has_l = off < n_left
                has_r = off < n_right
                rows.append(
                    Row(
                        li + 1 if has_l else None,
                        a_lines[li] if has_l else None,
                        rj + 1 if has_r else None,
                        b_lines[rj] if has_r else None,
                        "replace",
                    )
                )
    return rows


def render_row(row: Row, extra_cls: str = "", attrs: str = "") -> str:
    # Decide per-cell CSS class and content.
    if row.kind == "replace" and row.left_text is not None and row.right_text is not None:
        left_html, right_html = _inline_marks(row.left_text, row.right_text)
        l_cls, r_cls = "del", "ins"
    else:
        left_html = html.escape(row.left_text) if row.left_text is not None else ""
        right_html = html.escape(row.right_text) if row.right_text is not None else ""
        if row.kind == "equal":
            l_cls = r_cls = "eq"
        elif row.kind == "delete":
            l_cls, r_cls = "del", "pad"
        elif row.kind == "insert":
            l_cls, r_cls = "pad", "ins"
        else:  # replace with a missing side
            l_cls = "del" if row.left_text is not None else "pad"
            r_cls = "ins" if row.right_text is not None else "pad"

    l_no = str(row.left_no) if row.left_no is not None else ""
    r_no = str(row.right_no) if row.right_no is not None else ""

    tr_cls = f' class="{extra_cls}"' if extra_cls else ""
    return (
        f'<tr{tr_cls}{attrs}>'
        f'<td class="ln {l_cls}">{l_no}</td>'
        f'<td class="code {l_cls}"><pre>{left_html}</pre></td>'
        f'<td class="ln {r_cls}">{r_no}</td>'
        f'<td class="code {r_cls}"><pre>{right_html}</pre></td>'
        f'</tr>'
    )


def _visible_mask(rows: List[Row], context: int) -> List[bool]:
    """True for rows that should be shown initially: every change row, plus
    `context` equal rows on each side of a change."""
    n = len(rows)
    vis = [False] * n
    for i, r in enumerate(rows):
        if r.kind != "equal":
            lo = max(0, i - context)
            hi = min(n, i + context + 1)
            for k in range(lo, hi):
                vis[k] = True
    return vis


def render_html(rows: List[Row], old_name: str, new_name: str, context: int) -> str:
    vis = _visible_mask(rows, context)
    body: List[str] = []

    n = len(rows)
    gap_id = 0
    i = 0
    while i < n:
        if vis[i]:
            body.append(render_row(rows[i]))
            i += 1
            continue
        # Collect a contiguous run of hidden (collapsed) rows into one gap.
        j = i
        while j < n and not vis[j]:
            j += 1
        gap_id += 1
        count = j - i
        body.append(
            f'<tr class="expander" data-gap="{gap_id}">'
            f'<td colspan="4">'
            f'<span class="exp-arrows">'
            f'<button class="exp-btn" onclick="expandUp({gap_id})" title="Expand 10 lines up">&#8593;</button>'
            f'<button class="exp-btn" onclick="expandDown({gap_id})" title="Expand 10 lines down">&#8595;</button>'
            f'</span>'
            f'<span class="exp-label" id="lbl-{gap_id}">{count} hidden lines</span>'
            f'</td></tr>'
        )
        for pos, k in enumerate(range(i, j)):
            body.append(render_row(rows[k], extra_cls="ctx", attrs=f' hidden data-gap="{gap_id}" data-pos="{pos}"'))
        i = j

    added = sum(1 for r in rows if r.kind == "insert" or (r.kind == "replace" and r.right_text is not None))
    removed = sum(1 for r in rows if r.kind == "delete" or (r.kind == "replace" and r.left_text is not None))

    return TEMPLATE.format(
        old=html.escape(old_name),
        new=html.escape(new_name),
        added=added,
        removed=removed,
        rows="\n".join(body),
    )


TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diff: {old} → {new}</title>
<style>
  :root {{
    --border: #d0d7de;
    --eq-bg: #ffffff;
    --del-bg: #ffebe9;
    --del-ln: #ffd7d5;
    --ins-bg: #e6ffec;
    --ins-ln: #ccffd8;
    --pad-bg: #f6f8fa;
    --word-del: #ff818266;
    --word-ins: #abf2bc;
    --ln-fg: #6e7781;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font: 13px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    color: #1f2328;
    background: #f6f8fa;
  }}
  .wrap {{ padding: 16px; }}
  .header {{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    font-family: -apple-system, system-ui, sans-serif;
  }}
  .header h1 {{ font-size: 15px; margin: 0; font-weight: 600; }}
  .stat {{ font-size: 12px; font-weight: 600; }}
  .stat .add {{ color: #1a7f37; }}
  .stat .rem {{ color: #cf222e; }}
  .diff {{
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: #fff;
  }}
  .colhead {{
    display: flex;
    background: var(--pad-bg);
    border-bottom: 1px solid var(--border);
    font-family: -apple-system, system-ui, sans-serif;
    font-weight: 600;
    font-size: 12px;
  }}
  .colhead div {{ flex: 1 1 50%; padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .colhead div:first-child {{ border-right: 1px solid var(--border); }}
  table {{ border-collapse: collapse; width: 100%; table-layout: fixed; }}
  td.ln {{
    width: 1%;
    min-width: 40px;
    text-align: right;
    padding: 0 10px;
    color: var(--ln-fg);
    user-select: none;
    vertical-align: top;
    white-space: nowrap;
  }}
  td.code {{ width: 49%; padding: 0; vertical-align: top; }}
  td.code pre {{
    margin: 0;
    padding: 0 10px;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }}
  td.code:first-of-type {{ border-right: 1px solid var(--border); }}
  .eq {{ background: var(--eq-bg); }}
  .del {{ background: var(--del-bg); }}
  td.ln.del {{ background: var(--del-ln); }}
  .ins {{ background: var(--ins-bg); }}
  td.ln.ins {{ background: var(--ins-ln); }}
  .pad {{ background: var(--pad-bg); }}
  .code .x {{ border-radius: 2px; }}
  .code.del .x {{ background: var(--word-del); }}
  .code.ins .x {{ background: var(--word-ins); }}
  tr.expander td {{
    background: var(--pad-bg);
    color: var(--ln-fg);
    padding: 4px 12px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 12px;
  }}
  .exp-btn, .expand-all {{
    font-family: ui-monospace, monospace;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: #fff;
    color: #0969da;
    padding: 1px 7px;
    line-height: 1.4;
  }}
  .exp-btn {{ margin-right: 4px; }}
  .exp-arrows {{ margin-right: 8px; }}
  .expand-all {{ margin-right: 0; }}
  .exp-btn:hover, .expand-all:hover {{ background: #ddf4ff; }}
  .expand-all {{
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 12px;
    font-weight: 600;
    margin: 0;
  }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>{old} → {new}</h1>
    <span class="stat"><span class="add">+{added}</span> <span class="rem">−{removed}</span></span>
    <button class="expand-all" onclick="expandAll()">Expand whole file</button>
  </div>
  <div class="diff">
    <div class="colhead"><div>{old}</div><div>{new}</div></div>
    <table>
      <colgroup>
        <col style="width:44px"><col><col style="width:44px"><col>
      </colgroup>
      <tbody>
{rows}
      </tbody>
    </table>
  </div>
</div>
<script>
  var STEP = 10;

  function gapRows(g) {{
    return Array.prototype.slice
      .call(document.querySelectorAll('tr.ctx[data-gap="' + g + '"]'))
      .sort(function (a, b) {{ return (+a.dataset.pos) - (+b.dataset.pos); }});
  }}

  // After revealing lines, keep the fold widget anchored just above the first
  // still-hidden row so it always sits at the boundary of the remaining gap.
  function refresh(g) {{
    var hidden = gapRows(g).filter(function (r) {{ return r.hidden; }});
    var exp = document.querySelector('tr.expander[data-gap="' + g + '"]');
    if (!hidden.length) {{
      exp.parentNode.removeChild(exp);
      return;
    }}
    var first = hidden[0];
    first.parentNode.insertBefore(exp, first);
    document.getElementById('lbl-' + g).textContent = hidden.length + ' hidden lines';
  }}

  // Expand down: reveal the top slice of the gap (context below the change above).
  function expandDown(g) {{
    gapRows(g).filter(function (r) {{ return r.hidden; }}).slice(0, STEP)
      .forEach(function (r) {{ r.hidden = false; }});
    refresh(g);
  }}

  // Expand up: reveal the bottom slice of the gap (context above the change below).
  function expandUp(g) {{
    gapRows(g).filter(function (r) {{ return r.hidden; }}).slice(-STEP)
      .forEach(function (r) {{ r.hidden = false; }});
    refresh(g);
  }}

  function expandAll() {{
    document.querySelectorAll('tr.ctx').forEach(function (r) {{ r.hidden = false; }});
    document.querySelectorAll('tr.expander').forEach(function (r) {{
      r.parentNode.removeChild(r);
    }});
  }}
</script>
</body>
</html>
"""


@dataclass
class Hunk:
    header: str
    rows: List[Row]


@dataclass
class FileDiff:
    old_name: str
    new_name: str
    hunks: List[Hunk] = field(default_factory=list)
    binary: bool = False

    @property
    def added(self) -> int:
        return sum(
            1
            for h in self.hunks
            for r in h.rows
            if r.kind == "insert" or (r.kind == "replace" and r.right_text is not None)
        )

    @property
    def removed(self) -> int:
        return sum(
            1
            for h in self.hunks
            for r in h.rows
            if r.kind == "delete" or (r.kind == "replace" and r.left_text is not None)
        )


def _strip_prefix(name: str) -> str:
    """Drop git's a/ or b/ path prefix; leave /dev/null and bare names alone."""
    name = name.split("\t", 1)[0]  # some tools append a tab-separated timestamp
    if name == "/dev/null":
        return name
    if name.startswith(("a/", "b/")):
        return name[2:]
    return name


def _flush(rows: List[Row], pdel: List[Tuple[int, str]], pins: List[Tuple[int, str]]) -> None:
    """Emit a pending run of deletes/inserts, pairing them into "replace" rows so
    intra-line highlighting lines up (matching GitHub); leftovers become plain
    delete/insert rows."""
    m = min(len(pdel), len(pins))
    for k in range(m):
        dno, dtext = pdel[k]
        ino, itext = pins[k]
        rows.append(Row(dno, dtext, ino, itext, "replace"))
    for dno, dtext in pdel[m:]:
        rows.append(Row(dno, dtext, None, None, "delete"))
    for ino, itext in pins[m:]:
        rows.append(Row(None, None, ino, itext, "insert"))
    pdel.clear()
    pins.clear()


def parse_git_diff(text: str) -> List[FileDiff]:
    """Parse `git diff` output into per-file, side-by-side rows."""
    files: List[FileDiff] = []
    cur: Optional[FileDiff] = None
    header: Optional[str] = None  # current open hunk header, None if between hunks
    rows: List[Row] = []
    pdel: List[Tuple[int, str]] = []
    pins: List[Tuple[int, str]] = []
    old_no = new_no = 0

    def close_hunk() -> None:
        nonlocal header
        if header is not None and cur is not None:
            _flush(rows, pdel, pins)
            cur.hunks.append(Hunk(header, list(rows)))
        header = None

    for line in text.split("\n"):
        if line.startswith("diff --git"):
            close_hunk()
            if cur is not None:
                files.append(cur)
            # Names come from the ---/+++ lines below; seed from the header as a
            # fallback for diffs that carry no hunks (pure renames, mode changes).
            parts = line.split(" ")
            oname = _strip_prefix(parts[2]) if len(parts) >= 4 else ""
            nname = _strip_prefix(parts[3]) if len(parts) >= 4 else ""
            cur = FileDiff(oname, nname)
        elif line.startswith("--- "):
            if cur is None:
                cur = FileDiff("", "")
            cur.old_name = _strip_prefix(line[4:])
        elif line.startswith("+++ "):
            if cur is not None:
                cur.new_name = _strip_prefix(line[4:])
        elif line.startswith("@@"):
            close_hunk()
            if cur is None:
                cur = FileDiff("", "")
            m = re.match(r"@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
            old_no = int(m.group(1)) if m else 1
            new_no = int(m.group(2)) if m else 1
            header = line
            rows = []
            pdel, pins = [], []
        elif header is not None:
            if line.startswith(" "):
                _flush(rows, pdel, pins)
                rows.append(Row(old_no, line[1:], new_no, line[1:], "equal"))
                old_no += 1
                new_no += 1
            elif line.startswith("-"):
                pdel.append((old_no, line[1:]))
                old_no += 1
            elif line.startswith("+"):
                pins.append((new_no, line[1:]))
                new_no += 1
            elif line.startswith("\\"):
                pass  # "\ No newline at end of file"
            else:
                close_hunk()  # blank/other line ends the hunk body
        elif line.startswith("Binary files") and cur is not None:
            cur.binary = True

    close_hunk()
    if cur is not None:
        files.append(cur)
    return files


def _display_name(f: FileDiff) -> str:
    o, n = f.old_name, f.new_name
    if o == "/dev/null":
        return f"{n} (added)"
    if n == "/dev/null":
        return f"{o} (deleted)"
    if o and n and o != n:
        return f"{o} → {n}"
    return n or o or "(unknown)"


def _build_file_body(f: FileDiff) -> str:
    if f.binary:
        return '<tr><td colspan="4" class="nochange">Binary file not shown</td></tr>'
    if not f.hunks:
        return '<tr><td colspan="4" class="nochange">No textual changes</td></tr>'
    parts: List[str] = []
    for h in f.hunks:
        parts.append(f'<tr class="hunk-sep"><td colspan="4">{html.escape(h.header)}</td></tr>')
        for r in h.rows:
            parts.append(render_row(r))
    return "\n".join(parts)


def render_git_html(files: List[FileDiff]) -> str:
    total_add = sum(f.added for f in files)
    total_rem = sum(f.removed for f in files)

    sidebar_items: List[str] = []
    file_blocks: List[str] = []
    for idx, f in enumerate(files):
        label = html.escape(_display_name(f))
        stat = f'<span class="add">+{f.added}</span> <span class="rem">−{f.removed}</span>'
        sidebar_items.append(
            f'<li><a href="#file-{idx}" data-target="file-{idx}">'
            f'<span class="fn">{label}</span>'
            f'<span class="fstat">{stat}</span></a></li>'
        )
        old = html.escape(f.old_name or "")
        new = html.escape(f.new_name or "")
        file_blocks.append(
            f'<section class="file" id="file-{idx}">'
            f'<div class="file-head"><span class="fname">{label}</span>'
            f'<span class="stat">{stat}</span></div>'
            f'<div class="diff">'
            f'<div class="colhead"><div>{old}</div><div>{new}</div></div>'
            f'<table><colgroup>'
            f'<col style="width:44px"><col><col style="width:44px"><col>'
            f'</colgroup><tbody>\n{_build_file_body(f)}\n</tbody></table>'
            f'</div></section>'
        )

    if len(files) > 1:
        sidebar = (
            '<nav class="sidebar"><h2>Files changed</h2><ul>'
            + "".join(sidebar_items)
            + "</ul></nav>"
        )
    else:
        sidebar = ""

    n = len(files)
    return GIT_TEMPLATE.format(
        css=GIT_CSS,
        script=GIT_JS,
        title=f"Diff ({n} file{'s' if n != 1 else ''})",
        nfiles=n,
        plural="s" if n != 1 else "",
        added=total_add,
        removed=total_rem,
        sidebar=sidebar,
        files="\n".join(file_blocks),
    )


# The CSS/JS live outside the template so their braces don't need escaping; they
# are injected via .format() (which never touches braces inside substituted values).
GIT_CSS = """
  :root {
    --border: #d0d7de;
    --eq-bg: #ffffff;
    --del-bg: #ffebe9;
    --del-ln: #ffd7d5;
    --ins-bg: #e6ffec;
    --ins-ln: #ccffd8;
    --pad-bg: #f6f8fa;
    --word-del: #ff818266;
    --word-ins: #abf2bc;
    --ln-fg: #6e7781;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font: 13px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    color: #1f2328;
    background: #f6f8fa;
  }
  .topbar {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; background: #fff;
    border-bottom: 1px solid var(--border);
    font-family: -apple-system, system-ui, sans-serif;
  }
  .topbar h1 { font-size: 15px; margin: 0; font-weight: 600; }
  .stat { font-size: 12px; font-weight: 600; }
  .add { color: #1a7f37; }
  .rem { color: #cf222e; }
  .files-count { color: var(--ln-fg); font-size: 12px; }
  .layout { display: flex; align-items: flex-start; gap: 16px; padding: 16px; }
  .sidebar {
    position: sticky; top: 57px;
    flex: 0 0 240px; align-self: flex-start;
    max-height: calc(100vh - 73px); overflow: auto;
    background: #fff; border: 1px solid var(--border); border-radius: 6px;
    font-family: -apple-system, system-ui, sans-serif;
  }
  .sidebar h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--ln-fg); margin: 0; padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar ul { list-style: none; margin: 0; padding: 4px; }
  .sidebar a {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 5px 8px; border-radius: 5px; text-decoration: none;
    color: #1f2328; font-size: 12px;
  }
  .sidebar a:hover { background: #f6f8fa; }
  .sidebar a.active { background: #ddf4ff; }
  .sidebar .fn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar .fstat { flex: 0 0 auto; font-size: 11px; font-weight: 600; }
  .main { flex: 1 1 auto; min-width: 0; }
  .file { margin-bottom: 20px; scroll-margin-top: 64px; }
  .file-head {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: #fff;
    border: 1px solid var(--border); border-bottom: none;
    border-radius: 6px 6px 0 0;
    font-family: -apple-system, system-ui, sans-serif;
    font-weight: 600; font-size: 13px;
  }
  .file .diff {
    border: 1px solid var(--border); border-radius: 0 0 6px 6px;
    overflow: hidden; background: #fff;
  }
  .colhead {
    display: flex; background: var(--pad-bg);
    border-bottom: 1px solid var(--border);
    font-family: -apple-system, system-ui, sans-serif;
    font-weight: 600; font-size: 12px;
  }
  .colhead div { flex: 1 1 50%; padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .colhead div:first-child { border-right: 1px solid var(--border); }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td.ln {
    width: 1%; min-width: 40px; text-align: right; padding: 0 10px;
    color: var(--ln-fg); user-select: none; vertical-align: top; white-space: nowrap;
  }
  td.code { width: 49%; padding: 0; vertical-align: top; }
  td.code pre {
    margin: 0; padding: 0 10px;
    white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
  }
  td.code:first-of-type { border-right: 1px solid var(--border); }
  .eq { background: var(--eq-bg); }
  .del { background: var(--del-bg); }
  td.ln.del { background: var(--del-ln); }
  .ins { background: var(--ins-bg); }
  td.ln.ins { background: var(--ins-ln); }
  .pad { background: var(--pad-bg); }
  .code .x { border-radius: 2px; }
  .code.del .x { background: var(--word-del); }
  .code.ins .x { background: var(--word-ins); }
  tr.hunk-sep td {
    background: var(--pad-bg); color: var(--ln-fg);
    padding: 4px 12px;
    border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  }
  td.nochange { padding: 10px 12px; color: var(--ln-fg); font-family: -apple-system, system-ui, sans-serif; }
"""

GIT_JS = """
  var links = document.querySelectorAll('.sidebar a');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.dataset.target] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.classList.remove('active'); });
          var a = byId[e.target.id];
          if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-60px 0px -70% 0px' });
    document.querySelectorAll('.file').forEach(function (f) { obs.observe(f); });
  }
"""

GIT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<div class="topbar">
  <h1>{title}</h1>
  <span class="stat"><span class="add">+{added}</span> <span class="rem">−{removed}</span></span>
  <span class="files-count">{nfiles} file{plural} changed</span>
</div>
<div class="layout">
  {sidebar}
  <div class="main">
{files}
  </div>
</div>
<script>{script}</script>
</body>
</html>
"""


def read_lines(path: str) -> List[str]:
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    # splitlines() drops the trailing newline and handles all line-ending styles.
    return text.splitlines()


def _emit(out: str, args: argparse.Namespace) -> None:
    if args.stdout:
        sys.stdout.write(out)
    elif args.output:
        Path(args.output).write_text(out, encoding="utf-8")
        print(f"Wrote diff to {args.output}", file=sys.stderr)
    else:
        # No destination given: drop it in /tmp and pop it open in the browser.
        fd, path = tempfile.mkstemp(suffix=".html", prefix="diff-", dir="/tmp")
        with open(fd, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Wrote diff to {path}", file=sys.stderr)
        webbrowser.open(f"file://{path}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="GitHub-style side-by-side HTML diff of two files, or of a git diff on stdin.",
    )
    parser.add_argument("old", nargs="?", help="path to the original/old file (omit to read a git diff from stdin)")
    parser.add_argument("new", nargs="?", help="path to the modified/new file")
    parser.add_argument("-o", "--output", help="write the HTML to this file")
    parser.add_argument(
        "--stdout", action="store_true", help="print the HTML to stdout instead of opening a browser"
    )
    parser.add_argument(
        "-c", "--context", type=int, default=8,
        help="number of unchanged context lines to show around each change, file mode only (default: 8)",
    )
    args = parser.parse_args(argv)

    if args.old and args.new:
        a_lines = read_lines(args.old)
        b_lines = read_lines(args.new)
        rows = build_rows(a_lines, b_lines)
        out = render_html(rows, args.old, args.new, args.context)
    elif args.old or args.new:
        parser.error("provide both OLD_FILE and NEW_FILE, or neither (to read a git diff from stdin)")
    else:
        if sys.stdin.isatty():
            parser.error("no files given and nothing piped on stdin (try: git diff | sidebyside_diff.py)")
        files = parse_git_diff(sys.stdin.read())
        if not files:
            print("No diff found on stdin.", file=sys.stderr)
            return 1
        out = render_git_html(files)

    _emit(out, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
