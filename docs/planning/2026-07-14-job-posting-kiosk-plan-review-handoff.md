# 핸드오프 — 키오스크 주문서 구현 계획 다각 리뷰 (다음 세션 메인 프롬프트)

> 아래 블록을 다음 세션 첫 메시지로 그대로 사용.

---

공고작성 키오스크 "주문서" 개편의 **구현 계획을 실행 전에 여러 관점에서 리뷰**하고, 발견 사항을 계획에 반영한 뒤 실행 준비 상태로 만들어줘.

## 컨텍스트 (전부 커밋돼 있음 — 읽고 시작)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\job-posting-kiosk-ux` (브랜치 `worktree-job-posting-kiosk-ux`, node_modules junction 연결됨). **이 워크트리에서 작업** — 메인 체크아웃 이동 금지.
- 설계 스펙(사용자 승인 완료): `docs/planning/2026-07-14-job-posting-kiosk-order-sheet-design.md` (커밋 `95f87927f`)
- **리뷰 대상 = 구현 계획**: `docs/superpowers/plans/2026-07-14-job-posting-kiosk-order-sheet.md` (커밋 `3986805f7`, 11개 태스크 1,832줄)
- 화면 목업: https://claude.ai/code/artifact/ec822f84-5b32-4da4-8787-e038e9a65bbf (플로우 4화면+시트 12종) · 구조 4안 비교: https://claude.ai/code/artifact/4db5e75c-f4fa-4e37-ba9a-9e750e35abbf
- 메모리: `project_job_posting_kiosk_order_sheet.md`

## 리뷰 방법 — 관점별 병렬 (모델 라우팅: 판정=fable, 탐색=sonnet)

독립 관점이므로 **한 메시지에 병렬 디스패치**(5개 이하 배치). 각 리뷰어에게 스펙+계획 경로와 "계획의 주장 코드(파일:라인)를 실제 코드와 대조 실측하라"를 명시. 에이전트 보고는 그대로 믿지 말고 CRITICAL/HIGH는 메인 세션이 코드 열어 재검증.

1. **엔지니어링 리뷰** (`/plan-eng-review` 스킬 또는 `model: fable` planner/architect) — 태스크 분해·인터페이스 일관성·데이터 흐름·엣지케이스·테스트 커버리지.
2. **설계/UX 리뷰** (`/plan-design-review`) — 목업 대비 계획의 화면 스펙 누락, 다크모드·접근성·터치 타깃, 첫 작성자 순차 유도 UX.
3. **보안 리뷰** (security-reviewer, `model: fable`) — 신규 입력 표면(제목·장소·연락처·설명·조건·복지 금액) XSS/검증 경로, strict 스키마 화이트리스트의 부작용, RLS 접점 무변경 확인.
4. **DB 리뷰** (database-reviewer, `model: fable`) — `20260714000000_job_postings_conditions.sql`(additive nullable JSONB)의 파리티 가드(`parity_baseline_guard`/CI parity-smoke) 영향, 마이그레이션 타임스탬프 충돌(wiki `decisions/migration-timestamp-collision`), prod 적용 절차.
5. **정합성 리뷰** (general-purpose, `model: sonnet`) — 계획이 인용한 파일:라인·시그니처가 현재 코드와 일치하는지 전수 대조 (계획은 2026-07-13 탐사 기준 — 이후 PR #243 등이 머지돼 드리프트 가능).

## 리뷰어들이 반드시 팩트체크할 리스크 (계획 작성 시점의 미검증 가정)

- [ ] **zod 4 × @hookform/resolvers 5.2 호환** — zodResolver가 zod v4 스키마(z.custom, .default, .refine on nullable)를 지원하는지 실측(작은 스파이크 or context7). 안 되면 Task 5의 resolver 전략 수정 필요.
- [ ] **`jobPostingDocumentSchema`가 정말 `.strict()`인지** + `conditions` 화이트리스트 추가 지점(:473-514) 실재 확인.
- [ ] **`draftToCreateJobPostingInput`/`serializeJobPostingV3` 조립부가 조건부 스프레드를 넣을 수 있는 구조인지** (whitelist 매핑 함수 내부 구조 확인 — Task 2의 "4개 지점"이 실제로 4개인지).
- [ ] **PlaceSheet 안 RegionSelectModal, SheetModal 안 DatePickerModal** — 중첩 RN Modal iOS 터치먹통 함정([[pitfall_nested_rn_modal_touch_dead]]) 재발 여부. DatePickerModal을 OrderSheetScreen에서 직접 여는 구조(시트 아님)라 안전한지 검증.
- [ ] **`PROVIDED_FLAG(-1)` 복지 시맨틱** — 주문서 금액 입력이 기존 정산 계산(SettlementCalculator)과 일관되는지.
- [ ] **e2e `job-posting-create-submit` 승계** — 기존 스펙이 이 testID 외에 폼 섹션 셀렉터를 쓰는 구간 전수 확인 (Task 11 범위 과소평가 여부).
- [ ] **`CreateJobResult`에 생성 공고 id가 실제로 있는지** (Task 10 성공 네비 의존).
- [ ] 급여타입 `'other'` 레거시 공고를 프리셋으로 불렀을 때 hourly로 강제되는 UX가 수용 가능한지 (제품 판단 — 사용자 확인 항목으로 올려도 됨).
- [ ] `INITIAL_JOB_POSTING_DRAFT` 스프레드 기반 `valuesToDraft`가 INITIAL의 기본 roleCatalog(dealer+floor)를 오염 없이 덮어쓰는지.

## 진행 순서

1. 위 병렬 리뷰 디스패치 → 결과 회수 → CRITICAL/HIGH 메인 재검증.
2. 확정 결함은 **계획 문서를 직접 수정**(태스크 추가/코드 수정)하고 커밋. 스펙 변경이 필요한 발견은 사용자에게 결정 질문.
3. 리뷰 완료 후 사용자에게 실행 방식 질문: **서브에이전트 방식(superpowers:subagent-driven-development, 구현=opus 라우팅) vs 인라인(superpowers:executing-plans)** — 선택받고 실행 시작.
4. 실행 중 규율: 태스크마다 커밋, 완료 주장 전 이 세션 도구 결과 증거(fablize 게이트), 코드 직후 code-reviewer(fable).

## 금지

- `mcp__supabase__*` prod 직접 호출(마이그레이션 적용은 사용자 확인 후 배포 게이트에서), 기존 마이그레이션 파일 수정, push/PR(명시 요청 전), Workflow 도구(옵트인 없음), 메인 체크아웃에서 작업.
