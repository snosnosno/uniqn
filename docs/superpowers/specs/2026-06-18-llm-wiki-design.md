# T-HOLDEM LLM Wiki — 설계 스펙

- **작성일**: 2026-06-18
- **상태**: 설계 승인 완료 (슬래시 커맨드 Phase 1 포함) → 구현 진행
- **브랜치**: `feat/llm-wiki`
- **출처 패턴**: "LLM Wiki" (LLM이 유지·관리하는 영속 위키. 사용자가 공유한 원문 패턴 기반)

---

## 1. 목적과 동기

T-HOLDEM(UNIQN) 프로젝트의 지식이 흩어져 있다. LLM이 매 질문마다 코드·문서·메모리를 재발견(RAG식)하는 대신, **영속적이고 누적되는 위키**를 LLM이 점진적으로 구축·유지한다. 위키는 한 번 컴파일되면 최신 상태로 유지되며, 소스를 추가할수록·질문할수록 풍부해진다.

해결할 4대 페인포인트(사용자 확인):

1. **결정·이유가 흩어짐** — 왜 이렇게 만들었는지, 어떤 함정(pitfall)을 고쳤는지가 PR·메모리 89개·머릿속에 분산. 주제별로 묶인 제도적 기억이 없음.
2. **아키텍처 전체상이 안 보임** — 시스템이 실제로 어떻게 도는지(모듈·데이터흐름·RPC·RLS·스키마)를 한눈에 보는 살아있는 지도가 없음.
3. **도메인/제품 지식 분산** — 홀덤펍 사장·대회사 운영·역할 체계·수익모델·약관 같은 지식과 제품 결정이 docs/와 분석 폴더에 흩어짐.
4. **docs/ 자체가 통제 안 됨** — 14개 카테고리 docs/가 쪼개져 stale·중복·고아 문서가 누적.

이 넷은 별개 시스템이 아니라 **하나의 통합 프로젝트 위키의 네 단면**이다.

---

## 2. 세 레이어

| 레이어 | 정체 | 규칙 |
|--------|------|------|
| **원천 소스** (불변) | 코드(`uniqn-mobile/src`, `app`, `functions`, migrations) · 깃 히스토리/PR · 기존 `docs/` · `memory/` 89개 · (선택) 외부 리서치 | LLM은 **읽기만**, 절대 수정하지 않음 |
| **위키** (`wiki/`) | LLM이 소유·유지하는 합성 레이어 | LLM이 페이지 생성·갱신·상호참조 전담. 사용자는 열람·질문·소싱 |
| **스키마** (`wiki/AGENTS.md`) | LLM을 "규율 있는 위키 관리자"로 만드는 설정 파일 | 루트 `CLAUDE.md`에는 한 줄 포인터만 추가 → 프로젝트 CLAUDE.md 비대화 방지 |

**핵심 불변식:** 위키는 원천 소스(코드·docs·memory)를 절대 수정하지 않는다. 위키는 합성 산출물이며, 원천이 진실의 근거다.

---

## 3. 디렉토리 레이아웃 (얕은 카테고리 + 링크 중심)

옵시디언은 폴더 깊이보다 링크(그래프 뷰)로 빛난다. 따라서 **소수의 얕은 카테고리 폴더 + 작고 많은 링크된 페이지** 방식.

```
wiki/
├── AGENTS.md        # 스키마: 규약 + 워크플로우(ingest/query/lint)
├── index.md         # 내용 카탈로그: 전 페이지 + 한 줄 요약, 카테고리별
├── log.md           # 시간순 append-only: ## [2026-06-18] ingest | 제목
├── overview.md      # "여기서 시작" 합성 — 시스템 thesis + 허브 링크
├── architecture/    # 시스템이 실제로 어떻게 도는가
│   ├── layers.md          # Presentation→Hooks→Service→Repository→Supabase
│   ├── data-flow.md
│   ├── rls-model.md
│   └── <module>.md        # auth · wallet · job-postings · scheduling …
├── decisions/       # 왜 이렇게 됐는가 (ADR + pitfall 합성)
│   └── <slug>.md
├── domain/          # 제품/비즈니스 지식
│   ├── roles.md           # UserRole vs StaffRole
│   ├── target-market.md   # 홀덤펍 + 대회사
│   ├── revenue-model.md
│   └── <concept>.md
├── sources/         # 소스별 요약 1페이지 (+ 필요 시 raw/, assets/)
│   └── <slug>.md
└── scripts/         # 최신화 감지 (결정적, LLM 불필요)
    ├── check-staleness.sh
    └── check-unprocessed-docs.sh
```

추가로 리포 루트 `.claude/commands/`에 슬래시 커맨드 3종:

```
.claude/commands/
├── ingest.md        # /ingest — 원천 소스를 위키에 정제·반영
├── query.md         # /query  — 위키 기반 인용 답변 (읽기 전용)
└── lint.md          # /lint   — 위키 건강 진단
```

---

## 4. 페이지 규약

- **작고 단일 목적** — 엔티티/개념/결정 하나당 파일 하나 (`memory/` 철학과 동일). 200줄 넘으면 분리.
- **YAML frontmatter** (의무):
  - `area`: architecture | decisions | domain | sources
  - `updated`: YYYY-MM-DD
  - `sources`: 근거 소스 링크 배열 (`[[sources/...]]` 또는 `path:line` / PR / 커밋)
  - `status`: current | stale | draft
  - `tags`: 자유 태그 (나중에 Obsidian Dataview 활용)
- **`[[위키링크]]` 적극** — 관련 페이지 + 소스로 항상 연결. dangling 링크는 "쓸 거리" TODO로 허용(에러 아님).
- **증거 우선** — 모든 주장은 `파일:줄` · PR · 커밋 · 소스요약으로 인용. **"코드로 검증됨"과 "주장"을 구분 표기.** 무출처 주장 금지.
- 본문 한글, 코드 참조는 `파일:줄` 형식.

---

## 5. 스키마 (`wiki/AGENTS.md`) — 위키의 심장

LLM을 규율 있는 위키 관리자로 만드는 핵심 설정. 다음을 정의한다:

- **3 레이어 + 불변식**: 원천 소스 절대 수정 금지.
- **페이지 분류 체계 + frontmatter 명세 + 명명 규칙**(kebab-case 슬러그).
- **링크 규약**: `[[ ]]` 적극, dangling 허용.
- **Ingest 워크플로우**: 소스 읽기 → 핵심 논의 → 소스요약 작성 → 영향받는 architecture/decisions/domain 페이지 갱신 → `index.md` 갱신 → `log.md` 추가. 기존 주장과 모순 시 플래그.
- **Query 워크플로우**: `index.md` 먼저 읽기 → 관련 페이지 드릴다운 → 인용된 답변 합성 → 가치 있는 답변은 새 페이지로 환류.
- **Lint 워크플로우**: 모순 · stale 주장 · 고아 페이지 · 누락 개념 · 누락 상호참조 · 증거 공백 점검 + 다음 조사거리 제안.
- **증거 규칙**: `파일:줄` / PR / 소스 인용. "검증됨" vs "주장" 구분.
- **memory/·docs/와의 관계**:
  - `memory/` = LLM 세션 운영 메모(별도 유지, 위키 아님)
  - `docs/` = 사람·레거시 문서(읽기 전용 원천 소스)
  - `wiki/` = 합성 레이어("X가 어떻게/왜 도는가"의 답)

루트 `CLAUDE.md`에는 한 줄만 추가: *"위키 작업 시 `wiki/AGENTS.md` 규약 준수."*

---

## 6. 운영 (사용자가 쓰는 법)

| 동작 | 트리거 예시 | LLM이 하는 일 |
|------|------------|--------------|
| **Ingest** | "위키에 wallet 모듈 반영해줘" / "PR #172 반영" | 소스 읽기 → 논의 → 소스요약 → 영향 페이지 갱신 → index/log 갱신. 모순 플래그 |
| **Query** | "위키 기준으로 정산 흐름 알려줘" | index 먼저 → 드릴다운 → 인용 답변. 가치 있으면 새 페이지로 환류 |
| **Lint** | "위키 점검해줘" | 모순·**stale(소스 변경)**·**미흡수 docs**·고아·누락·증거공백 점검 + 조사거리 제안 (§12) |

**슬래시 커맨드 (Phase 1 포함):** 위 3개 운영을 `.claude/commands/`의 `/ingest`, `/query`, `/lint`로 박제한다. 현재 프로젝트 `.claude/commands/`는 비어 있어 충돌 없음. 각 커맨드 본문은 스키마(`wiki/AGENTS.md`)와 규약을 **런타임에 참조**하므로 도메인 불문 동일하며, `$ARGUMENTS`로 대상(파일경로 / 질문 / 영역)을 수신한다. 커맨드는 얇은 진입점이고, 실제 규칙·워크플로우의 단일 진실원은 `wiki/AGENTS.md`다(중복 금지).

---

## 7. 하이브리드 시드 (Phase 1 범위)

골격 + 고가치 백본만 1차 생성, 나머지는 ingest로 점진. **모든 시드 페이지는 기존 자산에서 합성(복붙 아님)하고 소스를 인용한다.**

**골격:**
- `wiki/AGENTS.md` (스키마)
- `wiki/index.md`, `wiki/log.md`, `wiki/overview.md` (골격)
- `.claude/commands/ingest.md`, `query.md`, `lint.md` (슬래시 커맨드 3종, 얇은 진입점)
- `wiki/scripts/check-staleness.sh`, `check-unprocessed-docs.sh` (최신화 감지, 결정적·LLM 불필요 — §12)

**백본 페이지 (시드 대상 + 출처):**

| 페이지 | 출처(원천 소스) |
|--------|----------------|
| `architecture/layers.md` | `CLAUDE.md` 아키텍처 섹션 + 실제 코드 구조 |
| `architecture/data-flow.md` | 코드(Service→Repository→Supabase) 합성 |
| `architecture/rls-model.md` | `memory/` RLS pitfalls + migrations |
| `domain/roles.md` | `CLAUDE.md` 역할 섹션 (admin>employer>staff, UserRole vs StaffRole) |
| `domain/target-market.md` | `memory/project_target_market_pivot` |
| `domain/revenue-model.md` | `memory/project_revenue_model_audit_20260609` |
| `decisions/` 3~5건 | 가장 풍부한 memory pitfall 합성: enum 발산 · 근무시간 SSOT · capacity_full · posting-role-filled dead counter 등 |

나머지(개별 모듈·결정·도메인 개념)는 실사용하며 `/ingest`로 점진 확장.

---

## 8. 옵시디언 연동

- `wiki/`는 리포 내 추적·커밋 → 버전관리·브랜치·diff 무료.
- 기존 루트 `.obsidian` 볼트로 열람, **그래프 뷰 = 길찾기**.
- 나중 옵션: Dataview(frontmatter 표) · Marp(슬라이드 덱).

---

## 9. 범위 밖 (YAGNI)

- Phase 1엔 임베딩/RAG 검색엔진 ❌ (`index.md`로 충분, 커지면 qmd 도입).
- **무인 자동 *쓰기* ❌** — headless Claude가 위키를 자동 갱신·자동 커밋하는 파이프라인은 안 함(토큰 비용·무인 합성 품질 리스크). 단 **자동 *감지*는 함** → §12.
- 스케줄 cron 드리프트 리포트 / 자동 ingest PR ❌ (Phase 2 후보).
- 기존 `docs/` **파일 이동·삭제 ❌** (코드/CI 참조 깨짐 방지). 단 **점진 ingest로 흡수 ✅** → §12.
- 이미지 처리 ❌ (외부 소스 필요 시에만).

---

## 10. 검증

- 위키는 코드가 아닌 산문 → "테스트" = lint 워크플로우 + 증거 인용.
- 시드 검증:
  - 시드된 주장 표본이 실재 `파일:줄`/memory/PR을 인용하는지 점검.
  - 모든 `[[링크]]`가 의도된 대상을 가리키는지(오타 없는지) 점검.
  - `index.md` ↔ 실제 파일 정합 확인.
- 최신화 감지 검증 (§12): 한 페이지의 소스를 인위로 변경(또는 `updated`를 과거로) → `check-staleness.sh`가 그 페이지를 stale로 보고하는지 확인(Red). 정상 페이지는 보고 안 됨(Green).

---

## 11. 기존 자산과의 관계 (요약)

- **`memory/`** (89개) — LLM 세션 운영 메모. 그대로 유지. 위키와 별개. 위키의 원천 소스로 읽힘.
- **`docs/`** (14 카테고리) — 사람/레거시 문서. 읽기 전용 원천 소스. 마이그레이션 안 함.
- **`wiki/`** (신규) — LLM 소유 합성 레이어. 본 스펙의 산출물.

---

## 12. 최신화 유지 (Staleness Detection) — 자동 감지 + 수동 갱신

위키가 코드·docs 변화에 뒤처지지 않게 하되, **감지는 자동(결정적·LLM 불필요), 갱신(쓰기)은 사람이 `/ingest`로 트리거**한다 (사용자 결정). 건강검진은 자동·정기적으로, 수술(내용 갱신)은 사람이 판단.

### 12-1. 메커니즘

모든 위키 페이지 frontmatter의 `sources`(근거)와 `updated`(반영일)를 활용:

- **소스 = 파일 경로** (예: `uniqn-mobile/src/services/walletService.ts`):
  `git log -1 --format=%cs -- <path>`의 마지막 커밋일 > 페이지 `updated` → **stale**.
- **소스 = PR/커밋 SHA**: 불변 → stale 아님.
- **소스 = `memory/` 파일**: 파일 mtime > `updated` → stale 후보.

결정적 비교라 LLM 호출 0, 비용 0.

### 12-2. 산출물

- `wiki/scripts/check-staleness.sh` — 전 위키 페이지 frontmatter 스캔 → stale 페이지 목록 출력(페이지 경로 · 변경된 소스 · 갱신 권고).
- `wiki/scripts/check-unprocessed-docs.sh` — `docs/` 파일 중 어떤 위키 페이지의 `sources`에도 없는 것(미흡수 docs) 목록 출력.

두 스크립트는 읽기 전용·결정적. 위키나 소스를 수정하지 않음(보고만).

### 12-3. `/lint` 통합

`/lint`가 위 두 스크립트를 호출해 진단 표에 포함:
- **stale 페이지**: 소스가 `updated` 이후 변경된 페이지
- **미흡수 docs**: 위키에 반영 안 된 `docs/` 문서

`/lint`는 진단만 한다. 갱신은 사용자가 `/ingest <대상>`으로 트리거(자동 수정 X).

### 12-4. (선택) git 훅 넛지

git `post-merge` 훅(프로젝트 기존 훅 인프라 존중)에서 `check-staleness.sh`를 실행해 **"⚠️ N개 위키 페이지 stale (소스 변경됨)"** 한 줄만 출력. 자동 수정·자동 커밋 X — 사람이 보고 `/ingest` 판단. 비침습적, 실패해도 커밋·머지 막지 않음(경고만).

### 12-5. docs/ 흡수 전략

`docs/` 파일은 **이동·삭제하지 않는다**(코드/CI 참조 깨짐 방지). 대신 `/ingest`로 점진 흡수해 위키가 권위 합성본이 되게 하고, `check-unprocessed-docs.sh`가 미흡수 docs를 추적해 통제를 회복한다. 흡수가 끝난 docs는 추후 `docs/archive/`로 이동할지 별도 판단(본 스펙 범위 밖).
