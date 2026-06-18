---
description: 원천 소스를 wiki에 정제·반영 (LLM Wiki: Ingest)
---

`$ARGUMENTS`(파일 경로 또는 자료)를 위키에 정제 반영한다.

**먼저 `wiki/AGENTS.md` §5(Ingest 워크플로우)·§3·§4·§8을 읽고 그대로 따른다.**

절차 요약(상세는 AGENTS.md §5):
1. 소스 + AGENTS.md 읽기
2. 핵심 takeaway 1~2줄 사용자와 논의
3. `wiki/sources/<slug>.md` 요약(압축 10~20%, 직접인용 ≤3줄)
4. 영향 architecture/decisions/domain 페이지 갱신(모순 플래그)
5. `wiki/index.md` 갱신 + `wiki/log.md` append

제약: raw(`uniqn-mobile/`·`docs/`·`memory/`) 수정 금지 · frontmatter 5필드 의무 · 무출처 금지 · cross-link ≥3.

출력: 생성/갱신 페이지 경로 · index 항목 · log 엔트리.
