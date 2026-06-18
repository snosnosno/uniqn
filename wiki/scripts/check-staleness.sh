#!/usr/bin/env bash
# 위키 페이지 stale 감지: repo 파일 소스가 페이지 updated 이후 변경됐는지 (결정적, LLM 불필요)
# PR#/SHA/memory(=repo 밖)는 정보성 소스로 비추적.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
stale_count=0

mapfile -t pages < <(find wiki -name '*.md' \
  ! -path 'wiki/index.md' ! -path 'wiki/log.md' ! -path 'wiki/overview.md' ! -path 'wiki/AGENTS.md')

for page in "${pages[@]}"; do
  fm="$(awk 'NR==1 && $0=="---"{f=1; next} f && $0=="---"{exit} f{print}' "$page")"
  [ -z "$fm" ] && continue
  updated="$(printf '%s\n' "$fm" | sed -n 's/^updated:[[:space:]]*//p' | head -1)"
  [ -z "$updated" ] && continue
  mapfile -t sources < <(printf '%s\n' "$fm" | sed -n '/^sources:/,/^[^[:space:]-]/p' | sed -n 's/^[[:space:]]*-[[:space:]]*//p')
  for src in "${sources[@]}"; do
    src="${src%\"}"; src="${src#\"}"
    [ -f "$src" ] || continue   # repo 파일만 추적 (PR#/SHA/memory는 -f 실패→skip)
    last="$(git log -1 --format=%cs -- "$src" 2>/dev/null || true)"
    if [ -n "$last" ] && [[ "$last" > "$updated" ]]; then
      echo "STALE: $page (소스 $src 변경 $last > updated $updated)"
      stale_count=$((stale_count+1))
    fi
  done
done
echo "---"
echo "stale 페이지: $stale_count"
exit 0
