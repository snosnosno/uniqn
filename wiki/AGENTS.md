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

## 10. 4계층 지식 시스템 — 역할 분담 + 졸업 규칙

지식이 4채널에 중복되면 매 세션 토큰만 샌다. 각 계층은 **서로 다른 일만** 맡는다.

| 계층 | 담당(무엇을 적나) | 로딩 | 수명 |
|---|---|---|---|
| **CLAUDE.md** | 모든 작업에 적용되는 **불변 규칙**(린트·다크모드·커밋·아키텍처·언어·역할). 날짜 노트/변경이력 누적 금지. | 항상 | 규칙 바뀔 때까지 |
| **memory/MEMORY.md** | **라이브 관심사만** — 아직 코드/git에 없는 진행중 작업 + "다음 작업에서 날 물 함정(재발방지 규칙)". | 항상(인덱스) | 머지·해결되면 **졸업** |
| **wiki/** | **영속 합성 지식** — 결정의 "왜", 아키텍처, 재발 패턴. 영구 기록·정제. | on-demand(`/query`) | 영구 |
| **옵시디언 색인 훅** | "무슨 노트가 있나" 발견용 지도(제목만) + 지식운영 리마인더 + MEMORY.md 예산 경고. | 항상(제목만) | 자동 생성 |
| **memory 토픽 / docs/** | 전체 상세. | on-demand(Read) | 영구 |

**졸업(graduation) 규칙 — 이게 시스템을 작게 유지한다:**
> 함정이 **수정·머지**되면 → ① 영속 교훈은 `/ingest`로 **wiki로 졸업**, ② MEMORY.md 한 줄은 **삭제하거나 포인터로 압축**(머지완료 냉이력은 `memory/MEMORY-archive.md` — 세션 미로딩).

**토큰 예산:** MEMORY.md(항상-로딩 인덱스) ≤ **14,000자**. 초과 시 옵시디언 훅이 세션 시작에 ⚠️ 경고 → 졸업 적용. (CLAUDE.md는 규칙만 유지해 자연히 작다.)

**상시 운영 사이클:**
- 작업 중: MEMORY.md만 가볍게 터치. `/ingest` 매번 금지(memory 피드백 `feedback_doc_freshness_token_consistency_workflow` 정신).
- 세션 끝: `/session-wrap`(문서/패턴/학습/후속 4병렬 탐지).
- 함정 머지 시: `/ingest` → wiki 졸업 → MEMORY.md 가지치기.
- 월 1회: `/lint`(끊긴 링크·stale·고아) + `/memory-audit`(코드 claim 실존 검증·frontmatter 스키마).
- 발견: 옵시디언 색인 + `/query`로 **로딩 없이** 인용 답변 → 필요한 한 노트만 Read.

**자동화 지점:** 색인/리마인더/예산경고는 `scripts/obsidian-context.mjs`(SessionStart 훅)가 매 세션 자동 수행. 색인 범위는 그 파일 `INCLUDE_DIRS`/`EXCLUDE`/`BUDGET`만 고치면 된다.
