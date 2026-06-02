#!/usr/bin/env python3
"""Render pattern Markdown docs into styled, navigable HTML pages.

Markdown is the source of truth. Each `docs/patterns/*.md` becomes
`docs/patterns/HTML/<slug>.html`; `README.md` becomes `HTML/index.html`.
Plain markdown renders directly; optional YAML frontmatter supplies the
editorial chrome (lede, chips, index-card metadata) and `:::` fenced
directives expand into the rich components (callout, compare, tabs,
diagram, raw passthrough).

Usage:
    python3 build_patterns.py <patterns-dir> [--out-dir DIR] [--project NAME]

See REFERENCE.md for the frontmatter fields and directive vocabulary.

Dependency-free: standard library only.
"""

import argparse
import html
import re
import sys
from pathlib import Path

# ── small helpers ─────────────────────────────────────────────────────────────

def esc(text):
    """Escape &, <, > for HTML text content (leave quotes)."""
    return html.escape(str(text), quote=False)


def attresc(text):
    return html.escape(str(text), quote=True)


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s or "section"


def strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    return s


def dedent_block(lines):
    real = [ln for ln in lines if ln.strip()]
    if not real:
        return ""
    indent = min(len(ln) - len(ln.lstrip()) for ln in real)
    return "\n".join(ln[indent:] if len(ln) >= indent else ln for ln in lines).strip("\n")


_PRE_ID = [0]


def next_pre_id():
    _PRE_ID[0] += 1
    return "pre%d" % _PRE_ID[0]


# ── frontmatter (minimal YAML subset) ─────────────────────────────────────────

def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    lines = text.split("\n")
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return {}, text
    return parse_yaml(lines[1:end]), "\n".join(lines[end + 1:])


def parse_yaml(lines):
    meta = {}
    i, n = 0, len(lines)
    while i < n:
        raw = lines[i]
        if not raw.strip() or raw.lstrip().startswith("#"):
            i += 1
            continue
        m = re.match(r"^([\w-]+):\s*(.*)$", raw)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2)
        if val in ("|", ">"):
            block, i = [], i + 1
            while i < n and (lines[i].strip() == "" or lines[i][:1] in (" ", "\t")):
                block.append(lines[i])
                i += 1
            meta[key] = dedent_block(block)
            continue
        if val == "":
            items, j = [], i + 1
            while j < n and re.match(r"^\s*-\s+", lines[j]):
                items.append(strip_quotes(re.sub(r"^\s*-\s+", "", lines[j])))
                j += 1
            meta[key] = items if items else ""
            i = j if items else i + 1
            continue
        meta[key] = strip_quotes(val)
        i += 1
    return meta


# ── inline markdown ───────────────────────────────────────────────────────────

def inline(text):
    """Render inline markdown: `code`, **bold**, *italic*, [text](url)."""
    spans = []

    def stash(m):
        spans.append(esc(m.group(1)))
        return "\x00%d\x00" % (len(spans) - 1)

    text = re.sub(r"`([^`]+)`", stash, str(text))
    text = esc(text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                  lambda m: '<a href="%s">%s</a>' % (attresc(m.group(2)), m.group(1)), text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*(?!\*)([^*]+?)\*(?!\*)", r"<em>\1</em>", text)
    text = re.sub(r"(?<![_\w])_(?!_)([^_]+?)_(?!\w)", r"<em>\1</em>", text)
    text = re.sub(r"\x00(\d+)\x00", lambda m: "<code>" + spans[int(m.group(1))] + "</code>", text)
    return text


# ── syntax highlighting (stdlib tokenizer, JS/TS/Vue-leaning) ──────────────────

KEYWORDS = {
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "await", "async", "of", "in", "new", "class", "extends", "import",
    "from", "export", "default", "yield", "throw", "try", "catch", "finally",
    "switch", "case", "break", "continue", "this", "super", "static", "get",
    "set", "typeof", "instanceof", "void",
    "delete", "interface", "type", "enum", "implements", "public", "private",
    "protected", "readonly", "as", "namespace",
}
# Monokai colours these like numbers (purple), not like keywords.
CONSTANTS = {"true", "false", "null", "undefined", "NaN", "Infinity"}
# Types / classes / constructors → cyan italic.
TYPES = {
    "Object", "String", "Number", "Array", "Boolean", "Date", "Promise", "JSON",
    "Math", "Map", "Set", "Symbol", "Error", "RegExp", "WeakMap", "WeakSet",
}
# Callable builtins → green (same as function names).
FUNCS = {
    "console", "defineProps", "defineEmits", "ref", "reactive", "computed",
    "watch", "watchEffect", "onMounted", "onUnmounted", "defineComponent",
}

def _build_token_re(hash_comments):
    cmt = r"//[^\n]*|/\*.*?\*/|<!--.*?-->"
    if hash_comments:  # only for langs where # starts a line comment
        cmt += r"|(?<![\w$])#[^\n]*"
    return re.compile(
        r"(?P<cmt>" + cmt + r")"
        r"|(?P<str>\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)"
        r"|(?P<num>\b\d+(?:\.\d+)?\b)"
        r"|(?P<op>[-+*/%=&|<>!?^~]+)"
        r"|(?P<word>[A-Za-z_$][\w$]*)",
        re.S,
    )


_TOKEN_RE = _build_token_re(False)            # JS/TS/Vue and most langs
_TOKEN_RE_HASH = _build_token_re(True)         # # is a line comment here
HASH_LANGS = {"sh", "bash", "zsh", "shell", "yaml", "yml", "toml",
              "py", "python", "rb", "ruby", "ini", "conf"}

_PASCAL = re.compile(r"^[A-Z][a-z]|^[A-Z]$")   # PascalCase or lone cap (generic)
_SCREAMING = re.compile(r"^[A-Z][A-Z0-9_]+$")  # SCREAMING_SNAKE constant


def highlight(code, lang=""):
    rx = _TOKEN_RE_HASH if lang.lower() in HASH_LANGS else _TOKEN_RE
    out, last = [], 0
    for m in rx.finditer(code):
        if m.start() > last:
            out.append(esc(code[last:m.start()]))
        kind = m.lastgroup
        tok = m.group()
        if kind == "cmt":
            cls = "tk-cmt"
        elif kind == "str":
            cls = "tk-str"
        elif kind == "num":
            cls = "tk-num"
        elif kind == "op":
            cls = "tk-op"
        else:  # word
            tail = code[m.end():]
            if tok in KEYWORDS:
                cls = "tk-kw"
            elif tok in CONSTANTS:
                cls = "tk-num"
            elif tok in TYPES or _PASCAL.match(tok):
                cls = "tk-type"
            elif _SCREAMING.match(tok):
                cls = "tk-num"
            elif tok in FUNCS or tail.lstrip().startswith("("):
                cls = "tk-fn"
            else:
                cls = None
        out.append('<span class="%s">%s</span>' % (cls, esc(tok)) if cls else esc(tok))
        last = m.end()
    if last < len(code):
        out.append(esc(code[last:]))
    return "".join(out)


# ── code blocks ────────────────────────────────────────────────────────────────

def code_header(label, pid):
    dots = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'
    txt = ("&nbsp;&nbsp;" + esc(label)) if label else ""
    return ('<div class="code-header"><span>%s%s</span>'
            '<button class="copy-btn" data-copy-target="%s">Copy</button></div>'
            % (dots, txt, pid))


def code_inner(code, lang="", label=None):
    pid = next_pre_id()
    return code_header(label, pid) + '\n<pre id="%s">%s</pre>' % (pid, highlight(code, lang))


def code_block(code, lang="", label=None):
    return '<div class="code">\n' + code_inner(code, lang, label) + '\n</div>'


def extract_fence(lines):
    """Pull the first fenced code block out of a list of lines."""
    i = 0
    while i < len(lines) and not lines[i].lstrip().startswith("```"):
        i += 1
    if i >= len(lines):
        return "", None, "\n".join(lines).strip("\n")
    info = lines[i].lstrip()[3:].strip()
    parts = info.split(None, 1)
    lang = parts[0] if parts else ""
    label = parts[1] if len(parts) > 1 else None
    code, j = [], i + 1
    while j < len(lines) and lines[j].strip() != "```":
        code.append(lines[j])
        j += 1
    return lang, label, "\n".join(code)


# ── directives ─────────────────────────────────────────────────────────────────

def split_markers(buf, markers):
    segs, cur = [], None
    for line in buf:
        s = line.strip()
        hit = None
        for mk in markers:
            if s == mk or s.startswith(mk + " "):
                hit, label = mk, s[len(mk):].strip()
                break
        if hit:
            cur = {"marker": hit, "label": label, "lines": []}
            segs.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    return segs


def render_compare(buf):
    segs = split_markers(buf, ["@bad", "@good"])
    gid = next_pre_id()
    btns, panels = [], []
    for k, seg in enumerate(segs):
        cls = "bad" if seg["marker"] == "@bad" else "good"
        pid = "%s-%d" % (gid, k)
        lang, flabel, code = extract_fence(seg["lines"])
        btns.append('<button class="cmp-tab" data-cmp="%s"><span class="dot %s"></span>%s</button>'
                    % (pid, cls, inline(seg["label"])))
        panels.append('<div id="%s" class="compare-view">\n%s\n</div>'
                      % (pid, code_block(code, lang, flabel)))
    # "Both" tab: re-render every segment stacked (fresh pre ids → unique copy targets)
    both_id = "%s-both" % gid
    both_blocks = []
    for seg in segs:
        lang, flabel, code = extract_fence(seg["lines"])
        both_blocks.append(code_block(code, lang, flabel))
    btns.append('<button class="cmp-tab active" data-cmp="%s">Both</button>' % both_id)
    panels.append('<div id="%s" class="compare-view active">\n%s\n</div>'
                  % (both_id, "\n".join(both_blocks)))
    return ('<div class="compare">\n<div class="compare-tabs">' + "".join(btns) + "</div>\n"
            + "\n".join(panels) + "\n</div>")


def render_tabs(buf):
    segs = split_markers(buf, ["@tab"])
    gid = next_pre_id()
    btns, panels = [], []
    for k, seg in enumerate(segs):
        pid = "%s-tab%d" % (gid, k)
        active = " active" if k == 0 else ""
        btns.append('<button class="tab-btn%s" data-tab="%s">%s</button>'
                    % (active, pid, inline(seg["label"])))
        lang, flabel, code = extract_fence(seg["lines"])
        panels.append('<div id="%s" class="tab-panel%s">\n%s\n</div>'
                      % (pid, active, code_inner(code, lang, flabel or seg["label"])))
    return ('<div class="code">\n<div class="tabs">' + "".join(btns) + "</div>\n"
            + "\n".join(panels) + "\n</div>")


def render_directive(name, buf):
    name = name.lower()
    if name == "callout":
        return '<div class="callout">\n' + render_blocks(buf) + "\n</div>"
    if name == "diagram":
        return '<div class="flow-diagram">\n' + "\n".join(buf).strip("\n") + "\n</div>"
    if name == "raw":
        return "\n".join(buf).strip("\n")
    if name == "compare":
        return render_compare(buf)
    if name == "tabs":
        return render_tabs(buf)
    return render_blocks(buf)  # unknown directive: render contents plainly


# ── block-level markdown ────────────────────────────────────────────────────────

def is_block_start(line):
    s = line.strip()
    return (s.startswith((":::", "### ", "```", "---"))
            or bool(re.match(r"^\s*[-*]\s+", line))
            or bool(re.match(r"^\s*\d+\.\s+", line)))


def render_table(lines):
    rows = [[c.strip() for c in re.sub(r"^\s*\|?|\|?\s*$", "", ln).split("|")] for ln in lines]
    head, body = rows[0], rows[2:]
    out = ["<table>", "<thead><tr>"
           + "".join("<th>" + inline(c) + "</th>" for c in head) + "</tr></thead>", "<tbody>"]
    for r in body:
        out.append("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in r) + "</tr>")
    out += ["</tbody>", "</table>"]
    return "\n".join(out)


def render_blocks(lines):
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if s.startswith(":::"):
            name = s[3:].strip().split(None, 1)[0] if s[3:].strip() else ""
            j, buf = i + 1, []
            while j < n and lines[j].strip() != ":::":
                buf.append(lines[j])
                j += 1
            out.append(render_directive(name, buf))
            i = j + 1
            continue
        if s.startswith("### "):
            out.append("<h3>" + inline(s[4:].strip()) + "</h3>")
            i += 1
            continue
        if s.startswith("```"):
            info = s[3:].strip()
            parts = info.split(None, 1)
            lang = parts[0] if parts else ""
            label = parts[1] if len(parts) > 1 else None
            j, code = i + 1, []
            while j < n and lines[j].strip() != "```":
                code.append(lines[j])
                j += 1
            out.append(code_block("\n".join(code), lang, label))
            i = j + 1
            continue
        if s == "---":
            out.append("<hr>")
            i += 1
            continue
        if "|" in s and i + 1 < n and re.match(r"^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$", lines[i + 1]):
            j, tbl = i, []
            while j < n and "|" in lines[j] and lines[j].strip():
                tbl.append(lines[j])
                j += 1
            out.append(render_table(tbl))
            i = j
            continue
        if re.match(r"^\s*[-*]\s+", line):
            j, items = i, []
            while j < n and re.match(r"^\s*[-*]\s+", lines[j]):
                items.append(re.sub(r"^\s*[-*]\s+", "", lines[j]).strip())
                j += 1
            out.append("<ul>" + "".join("<li>" + inline(it) + "</li>" for it in items) + "</ul>")
            i = j
            continue
        if re.match(r"^\s*\d+\.\s+", line):
            j, items = i, []
            while j < n and re.match(r"^\s*\d+\.\s+", lines[j]):
                items.append(re.sub(r"^\s*\d+\.\s+", "", lines[j]).strip())
                j += 1
            out.append("<ol>" + "".join("<li>" + inline(it) + "</li>" for it in items) + "</ol>")
            i = j
            continue
        j, para = i, []
        while j < n and lines[j].strip() and not is_block_start(lines[j]):
            para.append(lines[j].strip())
            j += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")
        i = j
    return "\n".join(out)


# ── sections ────────────────────────────────────────────────────────────────────

ADV = {"advantages", "pros", "benefits"}
DIS = {"disadvantages", "cons", "drawbacks", "trade-offs", "tradeoffs"}


def list_items(lines):
    items = []
    for ln in lines:
        if re.match(r"^\s*[-*]\s+", ln):
            items.append(re.sub(r"^\s*[-*]\s+", "", ln).strip())
    return items


def split_sections(body):
    """Drop a leading H1, then split into (heading, lines) at every '## '."""
    lines = body.split("\n")
    sections, cur = [], None
    for ln in lines:
        if re.match(r"^#\s+", ln):
            continue
        if ln.startswith("## "):
            cur = {"heading": ln[3:].strip(), "lines": []}
            sections.append(cur)
        elif cur is not None:
            cur["lines"].append(ln)
        elif ln.strip():
            cur = {"heading": "", "lines": [ln]}
            sections.append(cur)
    return sections


def render_key_files(lines):
    cards = []
    for it in list_items(lines):
        m = re.match(r"^`([^`]+)`\s*(?:[—-]\s*)?(.*)$", it)
        if m:
            path, desc = m.group(1), m.group(2)
        else:
            path, desc = it, ""
        ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        icon_cls = ext if ext in ("js", "ts", "vue", "json", "css") else ""
        label = {"js": "JS", "ts": "TS", "vue": "VUE", "json": "{}", "css": "CSS"}.get(ext, "›")
        cards.append(
            '<li>\n<span class="file-icon %s">%s</span>\n<div>\n'
            '<div class="file-path">%s</div>\n'
            '%s</div>\n</li>'
            % (icon_cls, label, esc(path),
               '<div class="file-desc">' + inline(desc) + "</div>\n" if desc else "")
        )
    return '<ul class="files">\n' + "\n".join(cards) + "\n</ul>"


def render_tradeoffs(adv_lines, dis_lines):
    def card(kind, title, sign, lines):
        lis = "".join("<li>" + inline(it) + "</li>" for it in list_items(lines))
        return ('<div class="pc-card %s">\n<h3><span class="badge-icon">%s</span> %s</h3>\n'
                '<ul>%s</ul>\n</div>' % (kind, sign, title, lis))
    return ('<div class="pc-grid">\n'
            + card("pros", "Advantages", "+", adv_lines) + "\n"
            + card("cons", "Disadvantages", "&minus;", dis_lines) + "\n</div>")


def build_sections(body):
    """Return (toc_html, body_html)."""
    secs = split_sections(body)
    rendered, toc = [], []
    used_ids = set()

    def uid(base):
        sid, k = base, 2
        while sid in used_ids:
            sid = "%s-%d" % (base, k)
            k += 1
        used_ids.add(sid)
        return sid

    i = 0
    while i < len(secs):
        sec = secs[i]
        h = sec["heading"]
        hl = h.lower()
        # adjacent Advantages + Disadvantages → one Trade-offs section
        if hl in ADV and i + 1 < len(secs) and secs[i + 1]["heading"].lower() in DIS:
            sid = uid("tradeoffs")
            inner = render_tradeoffs(sec["lines"], secs[i + 1]["lines"])
            heading = "Trade-offs"
            rendered.append('<section id="%s">\n<h2>%s</h2>\n%s\n</section>'
                            % (sid, esc(heading), inner))
            toc.append((sid, heading))
            i += 2
            continue
        sid = uid(slugify(h) if h else "section")
        if hl.startswith("key files"):
            inner = render_key_files(sec["lines"])
        else:
            inner = render_blocks(sec["lines"])
        if h:
            rendered.append('<section id="%s">\n<h2>%s</h2>\n%s\n</section>'
                            % (sid, esc(h), inner))
            toc.append((sid, h))
        else:
            rendered.append('<section id="%s">\n%s\n</section>' % (sid, inner))
        i += 1

    toc_html = "\n".join('      <li><a href="#%s">%s</a></li>' % (sid, esc(label))
                         for sid, label in toc)
    body_html = "\n\n".join("    " + r for r in rendered)
    return toc_html, body_html


# ── hero pieces ──────────────────────────────────────────────────────────────────

def render_chips(chips, cls="chip"):
    if not chips:
        return ""
    if isinstance(chips, str):
        chips = [chips]
    items = "\n".join('        <span class="%s">%s</span>' % (cls, inline(c)) for c in chips)
    return '      <div class="meta">\n' + items + "\n      </div>"


def render_lede(lede):
    return '      <p class="lede">' + inline(lede) + "</p>" if lede else ""


# ── page assembly ─────────────────────────────────────────────────────────────────

def build_page(md_path, template, project):
    text = md_path.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(text)

    title = meta.get("title")
    if not title:
        m = re.search(r"^#\s+(.+)$", body, re.M)
        title = m.group(1).strip() if m else md_path.stem.replace("-", " ").title()

    toc_html, body_html = build_sections(body)
    slug = meta.get("slug") or md_path.stem

    out = template
    repl = {
        "{{LANG}}": "en",
        "{{TITLE}}": esc(title),
        "{{EYEBROW}}": esc(meta.get("eyebrow", "Pattern")),
        "{{LEDE}}": render_lede(meta.get("lede", "")),
        "{{CHIPS}}": render_chips(meta.get("chips")),
        "{{TOC}}": toc_html,
        "{{BODY}}": body_html,
        "{{FOOTER_LEFT}}": esc(meta.get("footer", project)),
        "{{SOURCE_MD}}": attresc(md_path.name),
    }
    for k, v in repl.items():
        out = out.replace(k, v)
    return slug, out, meta, title


DEFAULT_ICON = (
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h6"/></svg>'
)


def render_card(href, title, meta, hook):
    cat = (meta.get("category") or "server").lower()
    icon = meta.get("icon") or DEFAULT_ICON
    summary = meta.get("summary") or hook or ""
    tags = meta.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    tags_html = ""
    if tags:
        tags_html = ('      <div class="tags">'
                     + "".join('<span class="tag">%s</span>' % inline(t) for t in tags)
                     + "</div>\n")
    return (
        '    <a class="pattern %s" href="%s">\n'
        '      <div class="pattern-head">\n'
        '        <span class="pattern-icon" aria-hidden="true">%s</span>\n'
        '        <div>\n          <h3>%s</h3>\n          <div class="file">%s</div>\n        </div>\n'
        '      </div>\n'
        '%s'
        '      <p>%s</p>\n'
        '      <span class="read">Read pattern <span class="arrow">&rarr;</span></span>\n'
        '    </a>'
        % (cat, attresc(href), icon, esc(title), esc(href), tags_html, inline(summary))
    )


def build_index(readme_path, template, project, metas):
    """metas maps md filename -> (meta, title) for the detail pages already built."""
    meta, body = parse_frontmatter(readme_path.read_text(encoding="utf-8"))
    lines = body.split("\n")

    # page heading: frontmatter, else first H1, else project
    heading = meta.get("heading")
    if not heading:
        m = re.search(r"^#\s+(.+)$", body, re.M)
        heading = m.group(1).strip() if m else project

    # intro: frontmatter block scalar, else README paragraphs before the link list
    link_re = re.compile(r"^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:[—-]\s*(.*))?$")
    cards, intro_lines, seen_list = [], [], False
    for ln in lines:
        m = link_re.match(ln)
        if m:
            seen_list = True
            text_label, target, hook = m.group(1), m.group(2), (m.group(3) or "")
            fname = target.rsplit("/", 1)[-1]
            href = re.sub(r"\.md$", ".html", fname)
            pmeta, ptitle = metas.get(fname, ({}, text_label))
            cards.append(render_card(href, pmeta.get("title") or text_label, pmeta, hook))
        elif not seen_list and not re.match(r"^#", ln):
            intro_lines.append(ln)

    intro_src = meta.get("intro")
    if intro_src:
        intro_html = '  <div class="intro">\n' + render_blocks(intro_src.split("\n")) + "\n  </div>"
    else:
        paras = render_blocks(intro_lines).strip()
        intro_html = '  <div class="intro">\n' + paras + "\n  </div>" if paras else ""

    out = template
    repl = {
        "{{LANG}}": "en",
        "{{TITLE}}": esc(meta.get("title", heading + " — " + project)),
        "{{EYEBROW}}": esc(meta.get("eyebrow", project)),
        "{{HEADING}}": esc(heading),
        "{{LEDE}}": render_lede(meta.get("lede", "")),
        "{{CHIPS}}": render_chips(meta.get("chips")),
        "{{INTRO}}": intro_html,
        "{{SECTION_EYEBROW}}": esc(meta.get("section_eyebrow", "Index")),
        "{{SECTION_HEADING}}": esc(meta.get("section_heading", "Patterns covered")),
        "{{CARDS}}": "\n\n".join(cards),
        "{{FOOTER_LEFT}}": esc(meta.get("footer", project)),
        "{{FOOTER_RIGHT}}": esc(meta.get("footer_right", "Index")),
    }
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Render pattern Markdown into HTML.")
    ap.add_argument("patterns_dir", help="Folder containing the pattern .md files")
    ap.add_argument("--out-dir", default=None, help="Output dir (default: <patterns-dir>/HTML)")
    ap.add_argument("--project", default="Patterns", help="Project name for titles/footers")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    assets = script_dir.parent / "assets"
    page_tpl = (assets / "page-template.html").read_text(encoding="utf-8")
    index_tpl = (assets / "index-template.html").read_text(encoding="utf-8")

    src = Path(args.patterns_dir)
    if not src.is_dir():
        sys.stderr.write("error: not a directory: %s\n" % src)
        sys.exit(1)
    out_dir = Path(args.out_dir) if args.out_dir else src / "HTML"
    out_dir.mkdir(parents=True, exist_ok=True)

    metas, built = {}, []
    for md in sorted(src.glob("*.md")):
        if md.name.lower() == "readme.md":
            continue
        slug, page_html, meta, title = build_page(md, page_tpl, args.project)
        (out_dir / (slug + ".html")).write_text(page_html, encoding="utf-8")
        metas[md.name] = (meta, title)
        built.append(slug + ".html")

    readme = src / "README.md"
    if readme.is_file():
        (out_dir / "index.html").write_text(
            build_index(readme, index_tpl, args.project, metas), encoding="utf-8")
        built.append("index.html")

    print("Pattern HTML written to %s:" % out_dir)
    for name in built:
        print("  " + name)


if __name__ == "__main__":
    main()
