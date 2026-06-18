#!/usr/bin/env bash
# 위키 페이지 stale 감지: repo 파일 소스가 페이지 updated 이후 변경됐는지 (결정적, LLM 불필요)
# PR#/SHA/memory(=repo 밖)·디렉토리 소스는 비추적. file 소스가 하나도 없는 페이지는 UNVERIFIABLE로 보고.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
stale_count=0
unverifiable_count=0

# 구조 파일(index/log/AGENTS)은 frontmatter 없음 → 제외. overview는 sources 있으면 점검.
mapfile -t pages < <(find wiki -name '*.md' \
  ! -path 'wiki/index.md' ! -path 'wiki/log.md' ! -path 'wiki/AGENTS.md')

for page in "${pages[@]}"; do
  fm="$(awk 'NR==1 && $0=="---"{f=1; next} f && $0=="---"{exit} f{print}' "$page")"
  [ -z "$fm" ] && continue
  updated="$(printf '%s\n' "$fm" | sed -n 's/^updated:[[:space:]]*//p' | head -1)"
  [ -z "$updated" ] && continue
  mapfile -t sources < <(printf '%s\n' "$fm" | sed -n '/^sources:/,/^[^[:space:]-]/p' | sed -n 's/^[[:space:]]*-[[:space:]]*//p')
  [ "${#sources[@]}" -eq 0 ] && continue   # 소스 없는 페이지(스켈레톤 등)는 점검 대상 아님
  has_file_source=0
  for src in "${sources[@]}"; do
    src="${src%\"}"; src="${src#\"}"
    [ -f "$src" ] || continue   # repo 파일만 추적 (PR#/SHA/memory/디렉토리는 -f 실패→skip)
    has_file_source=1
    last="$(git log -1 --format=%cs -- "$src" 2>/dev/null || true)"
    if [ -n "$last" ] && [[ "$last" > "$updated" ]]; then
      echo "STALE: $page (소스 $src 변경 $last > updated $updated)"
      stale_count=$((stale_count+1))
    fi
  done
  if [ "$has_file_source" -eq 0 ]; then
    echo "UNVERIFIABLE: $page (file 소스 없음 — memory/PR#/디렉토리만 → staleness 자동추적 불가, 수동 검토 권장)"
    unverifiable_count=$((unverifiable_count+1))
  fi
done
echo "---"
echo "stale 페이지: $stale_count"
echo "unverifiable 페이지: $unverifiable_count"
exit 0
