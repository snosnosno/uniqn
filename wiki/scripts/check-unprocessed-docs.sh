#!/usr/bin/env bash
# docs/ 중 어떤 위키 페이지에서도 참조되지 않은 문서(미흡수) 목록.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
referenced="$(grep -rhoE 'docs/[A-Za-z0-9._/-]+\.md' wiki/ 2>/dev/null | sort -u || true)"
unprocessed=0
while IFS= read -r doc; do
  if ! printf '%s\n' "$referenced" | grep -qxF "$doc"; then
    echo "UNPROCESSED: $doc"
    unprocessed=$((unprocessed+1))
  fi
done < <(find docs -name '*.md' ! -path 'docs/archive/*' ! -path 'docs/superpowers/*' 2>/dev/null)
echo "---"
echo "미흡수 docs: $unprocessed"
exit 0
