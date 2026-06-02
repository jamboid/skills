#!/usr/bin/env bash
# Regenerate the template test gallery and open it.
#
#   ./test/build.sh          rebuild into test/out/ and open the index
#   ./test/build.sh --no-open rebuild only
#
# Edit the templates in document-patterns/assets/, run this, eyeball test/out/.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/.." && pwd)"

python3 "$repo/document-patterns/scripts/build_patterns.py" \
  "$here" --out-dir "$here/out" --project "Template Test Gallery"

if [[ "${1:-}" != "--no-open" ]]; then
  open "$here/out/index.html"
fi
