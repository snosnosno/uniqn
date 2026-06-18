# Wiki 스키마 (AGENTS.md)

이 문서는 LLM을 **규율 있는 위키 관리자**로 만드는 단일 진실원이다. 슬래시 커맨드(`/ingest` `/query` `/lint`)와 스크립트는 얇은 진입점이며, 실제 규칙은 모두 여기 있다.

## 1. 정체성
홀덤 스태프 관리앱(UNIQN) 프로젝트 지식 위키. 4영역:
- **architecture** — 시스템이 실제로 어떻게 도는가(레이어·데이터흐름·RLS·모듈).
- **decisions** — 왜 이렇게 됐는가(ADR + pitfall 합성).
- **domain** — 제품/비즈니스 지식(역할·타깃시장·수익모델·약관).
- **sources** — 개별 원천 소스 요약(ingest 1건당 1페이지).

## 2. 3레이어 + 불변식
- **원천 소스(불변)**: 코드 `uniqn-mobile/`, `docs/`, `memory/`, 깃 히스토리/PR. **절대 수정 금지.** 읽기만.
- **위키(`wiki/`)**: LLM이 소유·유지하는 합성 레이어. 여기만 쓴다.
- **스키마(`wiki/AGENTS.md`)**: 본 문서.

## 3. 페이지 규약
- 작고 단일 목적. 엔티티/개념/결정 하나당 파일 하나. ≤200줄(넘으면 분리).
- 파일명 kebab-case 슬러그. 영역 폴더 아래 배치.
- frontmatter 의무 5필드:
  ```yaml
  ---
  area: architecture        # architecture | decisions | domain | sources
  updated: 2026-06-18        # 최종 반영일 YYYY-MM-DD
  status: current            # current | stale | draft
  sources:                   # 근거 (repo 파일경로 / PR#NNN / memory/xxx)
    - uniqn-mobile/src/services/wallet/walletService.ts
    - PR#172
  tags: [wallet, payment]
  ---
  ```
- `[[위키링크]]` 적극. 페이지당 cross-link ≥3개(그중 타 영역 ≥1개). dangling 링크는 "쓸 거리" TODO로 허용.
- 본문 한글, 코드 참조 `파일:줄`.
- `sources`는 가능한 한 **repo 파일 경로**로(staleness 자동추적 대상). `memory/`·`PR#NNN`·디렉토리 경로는 정보성(비추적) → file 소스가 하나도 없는 페이지는 `/lint`가 **UNVERIFIABLE**로 표기한다.

## 4. 증거 규칙
- 모든 주장은 인용: `파일:줄` · `PR#NNN` · 커밋 SHA · `[[sources/...]]`.
- **"코드로 검증됨"**(실제 파일/줄 확인)과 **"주장"**(미검증 추정)을 구분 표기.
- 무출처 주장 금지.

## 5. Ingest 워크플로우 (`/ingest`)
1. 소스 + 본 스키마 읽기.
2. 핵심 takeaway를 사용자와 1~2줄 논의.
3. `wiki/sources/<slug>.md` 소스 요약 작성(압축률 10~20%, 직접 인용 ≤3줄).
4. 영향받는 architecture/decisions/domain 페이지 갱신(없으면 생성). 기존 주장과 **모순 시 플래그**.
5. `wiki/index.md` 해당 영역에 1줄 추가/갱신.
6. `wiki/log.md`에 `## [YYYY-MM-DD] ingest | <제목>` append.
- 제약: raw 수정 금지, frontmatter 누락 금지, 무출처 금지.

## 6. Query 워크플로우 (`/query`)
1. `wiki/index.md` 먼저 → `grep "^## \[" wiki/log.md | tail -5` → 본 스키마.
2. 관련 페이지 ≤7개로 좁힘(백링크 밀도·최신성·영역 매칭). 백링크 1단계 확장 허용.
3. 인용된 답변 합성(주장마다 `[[링크]]`). 데이터 갭은 명시.
4. 가치 있는 답변은 새 페이지로 환류 제안.
- 제약: raw 직접 읽기 지양(부족 시 명시 후 ≤2개), 읽기 전용(위키 안 씀), 추측 금지.

## 7. Lint 워크플로우 (`/lint`)
점검(자동 수정 X, 진단만):
- **stale 페이지**: `bash wiki/scripts/check-staleness.sh` (소스가 `updated` 이후 변경).
- **UNVERIFIABLE 페이지**: file 소스가 없어 staleness 자동추적 불가(memory/PR#/디렉토리만) → 수동 검토 대상 (`check-staleness.sh` 동일 출력).
- **미흡수 docs**: `bash wiki/scripts/check-unprocessed-docs.sh`.
- **모순**: 페이지 간 충돌 주장.
- **고아**: 백링크 ≤2개.
- **데이터 갭**: 언급됐으나 자체 페이지 없는 개념.
- **증거 공백**: 무출처 주장.
출력: 진단 표 + 우선조치 top3 + 추가 탐색 제안. `log.md`에 lint 엔트리 append.
- 조치(갱신)는 사용자 승인 후 `/ingest` 또는 수동 편집.

## 8. 압축 룰
| 항목 | 룰 |
|---|---|
| 압축률 | 원천 1000줄 → 위키 100~200줄 (10~20%) |
| 페이지 길이 | ≤200줄 — 넘으면 분리 |
| 직접 인용 | 1소스당 ≤3줄 |
| cross-link | ≥3개 (그중 타 영역 ≥1개) |

## 9. memory/·docs/와의 관계
- `memory/`(repo 밖, ~/.claude/...) = LLM 세션 운영 메모. 위키 아님. 위키의 정보성 원천 소스로 읽힘(staleness 비추적).
- `docs/`(repo 내, 14 카테고리) = 사람/레거시 문서. 읽기 전용 원천. 이동/삭제 금지, `/ingest`로 점진 흡수.
- `wiki/` = 합성 레이어("X가 어떻게/왜 도는가"의 답).
