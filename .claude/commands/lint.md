---
description: wiki 건강 진단 (모순·stale·고립·갭) - LLM Wiki: Lint
---

`$ARGUMENTS`(영역명 또는 "all", 생략 시 all) 위키 건강을 진단한다. **자동 수정 X — 진단만.**

> 주의: 두 감지 스크립트(`check-staleness.sh`/`check-unprocessed-docs.sh`)는 항상 전체 위키를 스캔한다. `$ARGUMENTS` 영역 지정은 아래 3단계(frontmatter 스캔)와 리포트 범위에만 적용된다.

**먼저 `wiki/AGENTS.md` §7(Lint 워크플로우)을 읽고 그대로 따른다.**

절차:
1. `bash wiki/scripts/check-staleness.sh` → stale 페이지 + UNVERIFIABLE 페이지(file 소스 없음)
2. `bash wiki/scripts/check-unprocessed-docs.sh` → 미흡수 docs
3. `wiki/index.md` + 전 페이지 frontmatter 스캔 → 모순·고아(백링크≤2)·데이터갭·증거공백
4. `wiki/log.md`에 `## [YYYY-MM-DD] lint | <범위>` append

출력 형식:
- **A. 진단 표**: | 항목 | 개수 | 우선순위 | (stale·UNVERIFIABLE·미흡수docs·모순·고아·데이터갭·증거공백)
- **B. 우선 조치 top3**
- **C. 추가 탐색 제안**

제약: 진단만(자동수정 X). 조치는 사용자 승인 후 `/ingest` 또는 수동 편집.
