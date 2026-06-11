#!/usr/bin/env bash
# Regenerate skill test galleries from their fixtures and open them.
#
#   ./test/build.sh                       rebuild every skill, open each index
#   ./test/build.sh document-patterns     rebuild one skill only
#   ./test/build.sh accessibility-audit
#   ./test/build.sh --no-open [skill]     rebuild without opening
#
# Each skill has its own fixture folder under test/<skill>/; output lands in
# test/<skill>/out/ (gitignored). Edit the templates in <skill>/assets/, run
# this, eyeball the output.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/.." && pwd)"

open_out=1
if [[ "${1:-}" == "--no-open" ]]; then
  open_out=0
  shift
fi

want="${1:-all}"

maybe_open() { [[ "$open_out" == 1 ]] && open "$1" || true; }

build_document_patterns() {
  python3 "$repo/document-patterns/scripts/build_patterns.py" \
    "$here/document-patterns" --out-dir "$here/document-patterns/out" \
    --project "Template Test Gallery"
  maybe_open "$here/document-patterns/out/index.html"
}

build_accessibility_audit() {
  python3 "$repo/accessibility-audit/scripts/build_report.py" \
    "$here/accessibility-audit/findings.json" --out-dir "$here/accessibility-audit/out"
  maybe_open "$here/accessibility-audit/out/html/"*.html
}

case "$want" in
  all)
    build_document_patterns
    build_accessibility_audit
    ;;
  document-patterns)   build_document_patterns ;;
  accessibility-audit) build_accessibility_audit ;;
  *)
    echo "unknown skill: $want (expected document-patterns, accessibility-audit, or all)" >&2
    exit 1
    ;;
esac
