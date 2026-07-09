#!/usr/bin/env python3
"""Build an accessibility audit Markdown report and interactive HTML report
from a structured findings.json file.

Usage:
    python3 build_report.py <findings.json> [--out-dir DIR] [--template FILE]

Outputs (under --out-dir, default current directory):
    <slug>-audit.md      Markdown report
    html/<slug>.html     Self-contained interactive HTML report

See REFERENCE.md for the findings.json schema.
"""

import argparse
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

SEV_ORDER = ["critical", "high", "medium", "low"]
SEV_LABEL = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s or "accessibility-audit"


def attr(text):
    """Escape a string for use inside an HTML attribute."""
    return html.escape(str(text), quote=True)


def inline_html(text):
    """Escape text, then render `code` and **bold** markdown spans."""
    out = html.escape(str(text), quote=False)
    out = re.sub(r"`([^`]+)`", lambda m: "<code>" + m.group(1) + "</code>", out)
    out = re.sub(r"\*\*(.+?)\*\*", lambda m: "<strong>" + m.group(1) + "</strong>", out)
    return out


def plain_text(text):
    """Strip `code` and **bold** markers down to bare text.

    Text fields carry markdown-style markup only; any angle brackets are
    literal content (markup being discussed) and must be preserved.
    """
    t = re.sub(r"`([^`]+)`", r"\1", str(text))
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    return t.strip()


def escape_code(text):
    """Escape code for a <pre><code> block (leave quotes intact)."""
    return html.escape(str(text), quote=False)


def paragraphs(text):
    return [p.strip() for p in re.split(r"\n\s*\n", str(text)) if p.strip()]


def fail(msg):
    sys.stderr.write("error: " + msg + "\n")
    sys.exit(1)


# ── Load & validate ──────────────────────────────────────────────────────────

def load_findings(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail("findings file not found: " + str(path))
    except json.JSONDecodeError as e:
        fail("findings file is not valid JSON: " + str(e))

    if "meta" not in data:
        fail("findings file is missing the 'meta' object")
    if not data.get("issues"):
        fail("findings file has no 'issues'")

    severities = data.get("severities")
    if not severities:
        used = []
        for issue in data["issues"]:
            if issue.get("severity") not in used:
                used.append(issue.get("severity"))
        severities = [
            {"id": s, "label": SEV_LABEL.get(s, str(s).title()), "description": ""}
            for s in SEV_ORDER if s in used
        ]
        data["severities"] = severities
    return data


# ── Markdown ─────────────────────────────────────────────────────────────────

def build_markdown(data):
    meta = data["meta"]
    sevs = data["severities"]
    issues = data["issues"]
    by_sev = {s["id"]: [i for i in issues if i.get("severity") == s["id"]] for s in sevs}

    title = meta.get("title", "Accessibility Audit")
    subtitle = meta.get("subtitle", "")
    out = []

    out.append("# " + title + (": " + subtitle if subtitle else ""))
    out.append("")
    meta_lines = []
    if meta.get("scope"):
        meta_lines.append("**Scope:** `" + str(meta["scope"]) + "`")
    meta_lines.append("**Standard:** " + str(meta.get("standard", "WCAG 2.1 AA")))
    meta_lines.append("**Date:** " + str(meta.get("date", date.today().isoformat())))
    if meta.get("fileCount"):
        meta_lines.append("**Files audited:** " + str(meta["fileCount"]))
    out.append("  \n".join(meta_lines))
    out.append("")
    out.append("---")
    out.append("")

    out.append("## Executive Summary")
    out.append("")
    if data.get("summary"):
        for para in paragraphs(data["summary"]):
            out.append(para)
            out.append("")
    out.append("| Severity | Count | Description |")
    out.append("|---|---|---|")
    for s in sevs:
        out.append("| {0} | {1} | {2} |".format(
            s.get("label", s["id"].title()),
            len(by_sev.get(s["id"], [])),
            s.get("description", ""),
        ))
    out.append("")
    out.append("---")
    out.append("")

    for s in sevs:
        sev_issues = by_sev.get(s["id"], [])
        if not sev_issues:
            continue
        out.append("## " + s.get("label", s["id"].title()) + " Issues")
        out.append("")
        for issue in sev_issues:
            out.extend(markdown_issue(issue))

    if data.get("recommendations"):
        out.append("## Recommendations by Priority")
        out.append("")
        n = 0
        for phase in data["recommendations"]:
            head = phase.get("label", phase.get("phase", "")).strip()
            if phase.get("note"):
                head += " — " + phase["note"]
            out.append("### " + head)
            out.append("")
            for item in phase.get("items", []):
                n += 1
                ref = item.get("ref", "")
                prefix = "**" + ref + "** — " if ref else ""
                out.append("{0}. {1}{2}".format(n, prefix, item.get("text", "")))
            out.append("")

    if data.get("testing"):
        out.append("## Testing Checklist")
        out.append("")
        out.append("After implementing fixes, verify with:")
        out.append("")
        for item in data["testing"]:
            out.append("- [ ] " + str(item.get("text", "")))
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def markdown_issue(issue):
    lines = []
    lines.append("### " + str(issue.get("id", "")) + " — " + str(issue.get("title", "")))
    lines.append("")

    files = issue.get("files") or []
    location = issue.get("location")
    if len(files) == 1:
        suffix = " — " + location if location else ""
        lines.append("**File:** `" + files[0] + "`" + suffix)
        lines.append("")
    elif len(files) > 1:
        lines.append("**Files affected:**")
        lines.append("")
        for f in files:
            lines.append("- `" + f + "`")
        lines.append("")
        if location:
            lines.append("**Location:** " + location)
            lines.append("")
    elif location:
        lines.append("**Location:** " + location)
        lines.append("")

    wcag = issue.get("wcag") or []
    if wcag:
        lines.append("**WCAG reference:** " + ", ".join(wcag))
        lines.append("")

    for block in issue.get("code") or []:
        if block.get("label"):
            lines.append("*" + block["label"] + "*")
            lines.append("")
        lines.append("```" + str(block.get("language", "")))
        lines.append(str(block.get("content", "")).rstrip("\n"))
        lines.append("```")
        lines.append("")

    impact = paragraphs(issue.get("impact", ""))
    if impact:
        lines.append("**Impact:** " + impact[0])
        lines.append("")
        for para in impact[1:]:
            lines.append(para)
            lines.append("")

    fix_label = issue.get("fixLabel", "Fix")
    fix = issue.get("fix", "")
    if isinstance(fix, list):
        lines.append("**" + fix_label + ":**")
        lines.append("")
        if issue.get("fixIntro"):
            lines.append(issue["fixIntro"])
            lines.append("")
        for item in fix:
            lines.append("- " + str(item))
        lines.append("")
    else:
        if issue.get("fixIntro"):
            lines.append("**" + fix_label + ":** " + issue["fixIntro"])
            lines.append("")
            lines.append(str(fix))
        else:
            lines.append("**" + fix_label + ":** " + str(fix))
        lines.append("")

    lines.append("---")
    lines.append("")
    return lines


# ── HTML ─────────────────────────────────────────────────────────────────────

def build_sidebar_nav(data, by_sev):
    rows = []
    rows.append('    <div class="nav-section-label">Contents</div>')
    rows.append('    <a href="#overview" class="nav-top-link active" data-target="overview">Overview</a>')
    for s in data["severities"]:
        sev_issues = by_sev.get(s["id"], [])
        if not sev_issues:
            continue
        sid = s["id"]
        rows.append('    <div class="nav-group">')
        rows.append('      <div class="nav-group-head">')
        rows.append('        <span>' + html.escape(s.get("label", sid.title())) + '</span>')
        rows.append('        <span class="nav-pill ' + sid + '">' + str(len(sev_issues)) + '</span>')
        rows.append('      </div>')
        for issue in sev_issues:
            iid = str(issue.get("id", ""))
            label = html.escape(plain_text(issue.get("title", "")))
            rows.append(
                '      <a href="#' + attr(iid) + '" class="nav-item ' + sid
                + '" data-target="' + attr(iid) + '">'
                + html.escape(iid) + '&nbsp;&nbsp;' + label + '</a>'
            )
        rows.append('    </div>')

    has_rec = bool(data.get("recommendations"))
    has_test = bool(data.get("testing"))
    if has_rec or has_test:
        rows.append('    <div class="nav-section-label" style="margin-top:8px;">Action</div>')
        if has_rec:
            rows.append('    <a href="#recommendations" class="nav-top-link" data-target="recommendations">Recommendations</a>')
        if has_test:
            rows.append('    <a href="#testing" class="nav-top-link" data-target="testing">Testing Checklist</a>')
    return "\n".join(rows)


def build_stats(data, by_sev):
    rows = []
    for s in data["severities"]:
        sid = s["id"]
        rows.append('      <div class="stat-card ' + sid + '">')
        rows.append('        <div class="stat-count">' + str(len(by_sev.get(sid, []))) + '</div>')
        rows.append('        <div class="stat-label">' + html.escape(s.get("label", sid.title())) + '</div>')
        rows.append('      </div>')
    return "\n".join(rows)


def build_summary_text(data):
    paras = paragraphs(data.get("summary", ""))
    if not paras:
        return ""
    inner = "\n".join("        <p>" + inline_html(p) + "</p>" for p in paras)
    return '      <div class="summary-text">\n' + inner + '\n      </div>'


def build_summary_table(data, by_sev):
    rows = [
        '      <table class="summary-table">',
        '        <thead>',
        '          <tr><th>Severity</th><th>Count</th><th>Description</th></tr>',
        '        </thead>',
        '        <tbody>',
    ]
    for s in data["severities"]:
        sid = s["id"]
        rows.append('          <tr>')
        rows.append('            <td><span class="sev-badge ' + sid + '">'
                    + html.escape(s.get("label", sid.title())) + '</span></td>')
        rows.append('            <td><span class="count-chip ' + sid + '">'
                    + str(len(by_sev.get(sid, []))) + '</span></td>')
        rows.append('            <td>' + inline_html(s.get("description", "")) + '</td>')
        rows.append('          </tr>')
    rows += ['        </tbody>', '      </table>']
    return "\n".join(rows)


def build_issue_card(issue):
    sid = str(issue.get("severity", "low"))
    iid = str(issue.get("id", ""))
    rows = []
    rows.append('      <article class="issue ' + sid + '" id="' + attr(iid) + '">')
    rows.append('        <div class="issue-header">')
    rows.append('          <input class="issue-check" type="checkbox" aria-label="Mark issue '
                + attr(iid) + ' as fixed">')
    rows.append('          <span class="issue-id">' + html.escape(iid) + '</span>')
    rows.append('          <h3 class="issue-title">' + inline_html(issue.get("title", "")) + '</h3>')
    rows.append('          <span class="fixed-badge">Fixed</span>')
    rows.append('        </div>')

    files = issue.get("files") or []
    location = issue.get("location")
    display = issue.get("filesDisplay") or ("list" if len(files) >= 4 else "chips")

    meta_chips = []
    if display == "chips":
        for idx, f in enumerate(files):
            text = f
            if location and len(files) == 1:
                text = f + " · " + location
            meta_chips.append('<span class="meta-chip">' + html.escape(text) + '</span>')
        if location and len(files) != 1:
            meta_chips.append('<span class="meta-chip">' + html.escape(location) + '</span>')
    else:
        if location:
            meta_chips.append('<span class="meta-chip">' + html.escape(location) + '</span>')
    for w in issue.get("wcag") or []:
        meta_chips.append('<span class="wcag-chip">' + html.escape(w) + '</span>')

    if meta_chips:
        rows.append('        <div class="issue-meta">')
        for chip in meta_chips:
            rows.append('          ' + chip)
        rows.append('        </div>')

    rows.append('        <div class="issue-body">')

    for block in issue.get("code") or []:
        rows.append('          <div class="issue-subsection">')
        if block.get("label"):
            rows.append('            <div class="code-label">' + html.escape(block["label"]) + '</div>')
        rows.append('            <pre><code>' + escape_code(block.get("content", "")).rstrip("\n")
                    + '</code></pre>')
        rows.append('          </div>')

    if display == "list" and files:
        rows.append('          <div class="issue-subsection">')
        rows.append('            <div class="issue-subsection-label files">Affected files</div>')
        rows.append('            <ul class="file-list">')
        for f in files:
            rows.append('              <li>' + html.escape(f) + '</li>')
        rows.append('            </ul>')
        rows.append('          </div>')
        rows.append('          <div class="divider"></div>')

    impact = paragraphs(issue.get("impact", ""))
    if impact:
        rows.append('          <div class="issue-subsection">')
        rows.append('            <div class="issue-subsection-label impact">Impact</div>')
        for para in impact:
            rows.append('            <p>' + inline_html(para) + '</p>')
        rows.append('          </div>')
        rows.append('          <div class="divider"></div>')

    fix_label = issue.get("fixLabel", "Fix")
    fix = issue.get("fix", "")
    rows.append('          <div class="issue-subsection">')
    rows.append('            <div class="issue-subsection-label fix">' + html.escape(fix_label) + '</div>')
    if issue.get("fixIntro"):
        rows.append('            <p>' + inline_html(issue["fixIntro"]) + '</p>')
    if isinstance(fix, list):
        rows.append('            <ul>')
        for item in fix:
            rows.append('              <li>' + inline_html(item) + '</li>')
        rows.append('            </ul>')
    else:
        for para in paragraphs(fix):
            rows.append('            <p>' + inline_html(para) + '</p>')
    rows.append('          </div>')

    rows.append('        </div>')
    rows.append('      </article>')
    return "\n".join(rows)


def build_issue_sections(data, by_sev):
    sections = []
    for s in data["severities"]:
        sev_issues = by_sev.get(s["id"], [])
        if not sev_issues:
            continue
        sid = s["id"]
        label = html.escape(s.get("label", sid.title()))
        rows = ['    <section class="content-section">']
        rows.append('      <h2 class="section-heading">')
        rows.append('        <span class="section-badge ' + sid + '">' + label + '</span>')
        rows.append('        ' + label + ' Issues')
        rows.append('      </h2>')
        for issue in sev_issues:
            rows.append(build_issue_card(issue))
        rows.append('    </section>')
        sections.append("\n".join(rows))
    return "\n\n".join(sections)


def build_recommendations(data):
    recs = data.get("recommendations")
    if not recs:
        return ""
    rows = ['    <section class="content-section" id="recommendations">']
    rows.append('      <h2 class="section-heading">Recommendations by Priority</h2>')
    n = 0
    for phase in recs:
        phase_id = str(phase.get("phase", "")).lower()
        rows.append('      <div class="rec-group">')
        rows.append('        <div class="rec-group-title">')
        if phase.get("label"):
            rows.append('          <span class="rec-phase ' + phase_id + '">'
                        + html.escape(phase["label"]) + '</span>')
        if phase.get("note"):
            rows.append('          ' + html.escape(phase["note"]))
        rows.append('        </div>')
        rows.append('        <div class="rec-list">')
        for item in phase.get("items", []):
            n += 1
            ref = str(item.get("ref", ""))
            ref_sev = str(item.get("severity", "")).lower()
            rows.append('          <div class="rec-item">')
            rows.append('            <span class="rec-num">' + str(n) + '</span>')
            if ref:
                rows.append('            <span class="rec-ref ' + ref_sev + '">'
                            + html.escape(ref) + '</span>')
            rows.append('            <span>' + inline_html(item.get("text", "")) + '</span>')
            rows.append('          </div>')
        rows.append('        </div>')
        rows.append('      </div>')
    rows.append('    </section>')
    return "\n".join(rows)


def build_testing(data):
    testing = data.get("testing")
    if not testing:
        return ""
    rows = ['    <section class="content-section" id="testing">']
    rows.append('      <h2 class="section-heading">Testing Checklist</h2>')
    rows.append('      <p style="font-size:14px; color:var(--c-text-muted); margin-bottom:16px;">'
                'After implementing fixes, verify with the following. Your progress is saved '
                'in this browser.</p>')
    rows.append('      <div class="checklist" id="checklist">')
    for item in testing:
        item_id = slugify(item.get("id", item.get("text", "item")))
        text = item.get("text", "")
        rows.append('        <label class="checklist-item" id="chk-' + attr(item_id) + '">')
        rows.append('          <input type="checkbox" aria-label="' + attr(plain_text(text)) + '">')
        rows.append('          <span>' + inline_html(text) + '</span>')
        rows.append('        </label>')
    rows.append('      </div>')
    rows.append('    </section>')
    return "\n".join(rows)


def build_html(data, template, slug):
    meta = data["meta"]
    issues = data["issues"]
    by_sev = {s["id"]: [i for i in issues if i.get("severity") == s["id"]]
              for s in data["severities"]}

    file_count_meta = ""
    if meta.get("fileCount"):
        file_count_meta = ('        <span>Files: <strong>'
                           + html.escape(str(meta["fileCount"])) + '</strong></span>')

    replacements = {
        "{{TITLE}}": html.escape(meta.get("title", "Accessibility Audit")),
        "{{SUBTITLE}}": html.escape(meta.get("subtitle", "")),
        "{{PROJECT}}": html.escape(meta.get("project", "")),
        "{{STANDARD}}": html.escape(meta.get("standard", "WCAG 2.1 AA")),
        "{{DATE}}": html.escape(str(meta.get("date", date.today().isoformat()))),
        "{{SCOPE}}": html.escape(str(meta.get("scope", ""))),
        "{{FILE_COUNT_META}}": file_count_meta,
        "{{REPORT_ID}}": attr(slug),
        "{{ISSUE_COUNT}}": str(len(issues)),
        "{{SIDEBAR_NAV}}": build_sidebar_nav(data, by_sev),
        "{{STATS}}": build_stats(data, by_sev),
        "{{SUMMARY_TEXT}}": build_summary_text(data),
        "{{SUMMARY_TABLE}}": build_summary_table(data, by_sev),
        "{{ISSUE_SECTIONS}}": build_issue_sections(data, by_sev),
        "{{RECOMMENDATIONS}}": build_recommendations(data),
        "{{TESTING}}": build_testing(data),
    }
    out = template
    for key, value in replacements.items():
        out = out.replace(key, value)
    return out


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Build accessibility audit reports.")
    parser.add_argument("findings", help="Path to findings.json")
    parser.add_argument("--out-dir", default=".", help="Output directory (default: .)")
    parser.add_argument("--template", default=None, help="Path to report-template.html")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    template_path = Path(args.template) if args.template \
        else script_dir.parent / "assets" / "report-template.html"
    if not template_path.is_file():
        fail("HTML template not found: " + str(template_path))

    data = load_findings(args.findings)
    meta = data["meta"]
    slug = slugify(meta.get("slug") or meta.get("subtitle") or meta.get("title") or "audit")

    out_dir = Path(args.out_dir)
    html_dir = out_dir / "html"
    out_dir.mkdir(parents=True, exist_ok=True)
    html_dir.mkdir(parents=True, exist_ok=True)

    md_path = out_dir / (slug + "-audit.md")
    html_path = html_dir / (slug + ".html")

    md_path.write_text(build_markdown(data), encoding="utf-8")
    template = template_path.read_text(encoding="utf-8")
    html_path.write_text(build_html(data, template, slug), encoding="utf-8")

    by_sev = {}
    for issue in data["issues"]:
        by_sev[issue.get("severity")] = by_sev.get(issue.get("severity"), 0) + 1
    tally = ", ".join(
        "{0} {1}".format(by_sev.get(s["id"], 0), s.get("label", s["id"]))
        for s in data["severities"]
    )

    print("Accessibility audit reports written:")
    print("  Markdown : " + str(md_path))
    print("  HTML     : " + str(html_path))
    print("  Issues   : {0} total ({1})".format(len(data["issues"]), tally))


if __name__ == "__main__":
    main()
