# 다음 세션 프롬프트 (2026-05-10 PR #71 follow-up 작업 종료 후)

## ⚠️ P0 발견 — 즉시 fix 필요 (본 세션 dogfooding 중 발견)

본 세션 종료 직전 사용자 dogfooding 에서 **workspace member 가 자기 멤버십 공고에 진입 시 차단** 되는 service-level 사각지대 발견. PR #71/#73 가 Repository helper 만 풀고 **Service layer guards 는 미해결**된 부분 마이그레이션 잔여.

**증상 (콘솔 로그 2026-05-10 08:52~08:53):**
```
PermissionError: 해당 공고의 소유자가 아닙니다 (applicantManagementService.subscribeToApplicantsAsync:366)
PermissionError: 본인의 공고만 조회할 수 있습니다 (settlementQuery getWorkLogsByJobPosting + getJobPostingSettlementSummary)
```

**시나리오:** review-employer (`b2222222`) 가 `c3333333` 소유 공고에 워크스페이스 멤버 자격으로 진입 → RLS 통과 → service 가드 거절.

**수정 위치 (3건, 모두 owner|member|admin 으로 풀기):**

| 위치 | 패턴 | PR #71/#73 미러 |
|------|------|----------------|
| `src/services/jobs/applicantManagementService.ts:359` | `verifyJobPostingOwnership` 이 owner-only 검증 | `loadAndVerifyJobPostingAccess` 호출로 교체 |
| `src/services/work/settlement/settlementQuery.ts:62` (getWorkLogsByJobPosting) | `jobPosting.ownerId !== ownerId` 직접 비교 | `loadAndVerifyJobPostingAccess` 사용 |
| `src/services/work/settlement/settlementQuery.ts:??` (getJobPostingSettlementSummary) | 동일 | 동일 |

**진입 방법:**
1. master pull (HEAD = `2e4019db9` 이상)
2. PR #75 머지 후 PR #75 가 만든 `list_all_managed_postings` RPC 와 jp_select 분리 정책 사용 가능 확인
3. 위 3 service 가드를 `loadAndVerifyJobPostingAccess(jobPostingId, ownerId, operation)` 호출로 교체
4. 회귀 테스트 추가 (member 통과 + owner 통과 + 외부인 차단)
5. 사용자 dogfooding: review-employer 로 c3333333 워크스페이스 공고 → 정산 탭 진입 정상 동작 확인

**왜 이 사각지대였나:**
- PR #71 = Repository read-side 만
- PR #73 = Repository write-side 만
- Service layer (applicantManagementService, settlementQuery) 의 가드는 별도 함수 (`verifyJobPostingOwnership`) 로 추상화되어 있어 grep 시 누락
- PR #74 audit ADR 도 hook layer 만 점검, service layer 누락

**우선순위: P0** — 본 누락 fix 없이는 review-employer dogfooding 차단됨.

---

## 세션 진행 요약

본 세션 시작 시 master HEAD = `bf03eec12` (PR #71 머지 후).

### 4 PR 생성 (4-PR 시퀀스 stacked)

| PR | 제목 | 상태 | 위험도 | 의존 |
|----|------|------|--------|------|
| **#72** | rename `loadAndVerifyJobPostingOwner` → Access + mutation hook DRY | open | 🟢 low | 독립 |
| **#73** | write-side `loadAndVerifyOwner` workspace 호환 | open (stacked on #72) | 🟡 med | #72 |
| **#74** | Task 6 audit ADR (5 영역 + sub-PR 로드맵) | open | 🟢 docs | 독립 |
| **#75** | Task 5 RLS jp_select 분리 spec (migration NOT applied) | open | 🔴 spec | #72/#73 |

### 작업 결과 요약

**PR #72 (refactor):**
- ApplicationRepositoryHelpers.loadAndVerifyJobPostingOwner → loadAndVerifyJobPostingAccess
- 8 파일 변경 (helper + 2 repo + 4 test 파일 + useJobManagement DRY)
- useMyPostingsQueryKey 헬퍼 신규 (4 mutation hook DRY)
- jest 4001/3 fail (master baseline)

**PR #73 (feat, write-side):**
- loadAndVerifyMutateAccess (owner|member|admin) — 4 update flow (수정/마감/재오픈/정산설정)
- loadAndVerifyDeleteAccess (owner|admin only) — delete flow
- 5 callsite 의 `.eq('owner_id', ownerId)` 제거 (RLS 단일 진실)
- 신규 14 테스트 PASS (mutate access 7 + delete access 4 + owner_id 회귀 가드 3)
- 알려진 갭: soft-delete 시 RLS 가 jp_update 평가 → API 직접 호출로 member 우회 가능 (별도 PR 필요)

**PR #74 (audit ADR):**
- 5 영역 (applications/work_logs/event_qr_codes/settlement/schedule) RLS 매트릭스 snapshot (production 2026-05-10)
- 핵심 발견: 4 테이블 admin global 누출 (`get_my_role()='admin'` 분기), 클라이언트 workspace 연동 0%
- 위험 hook 5개: useMonthlyPayroll, useSettlementDashboard, useScheduleStats(employer), useCalendarView(employer)
- Sub-PR 로드맵 PR3-A ~ PR3-E

**PR #75 (RLS spec):**
- jp_select 단일 → 2 정책 분리 (public_search + managed)
- list_all_managed_postings SECURITY DEFINER RPC (PR #69/#70 패턴)
- migration SQL + rollback SQL (실행 안 함)
- eng-review checklist 9 항목, dogfooding 시나리오 6 케이스
- ⛔ apply_migration 은 사용자 명시 confirm 후

## 다음 세션 우선순위

### 🔴 P0 — 사용자 액션 (Claude 가 할 수 없는 부분)

1. **PR #72 리뷰 + 머지** (rename + DRY, low-risk)
2. **PR #73 리뷰 + 머지** (write-side, base 가 자동으로 master 로 이전됨)
3. **PR #74 리뷰** (docs only, 머지)
4. **PR #75 spec 리뷰** — eng-review checklist 9 항목 통과 확인

### 🟡 P1 — PR #72/#73 머지 후 진행 가능 (Claude 단독)

**PR3-B: useMonthlyPayroll workspace 필터** (low-risk)
1. WorkLogRepository.getMonthlyPayroll 시그니처 확장 (`workspaceId?` 추가)
2. useMonthlyPayroll 가 useActiveWorkspace 의존
3. query key 에 activeWorkspaceId 포함
4. jest contract 테스트 (PR #71 패턴 복제)

**PR3-C: useSettlementDashboard workspace 필터** (low-risk)
1. SettlementRepository.getDashboard (또는 work_logs aggregation 함수) 호출 path 추적
2. 동일 패턴 적용

**PR3-D: schedule dual-mode hook 검증** (low-risk)
1. useScheduleStats / useCalendarView 의 employer 분기 코드 위치 확인
2. employer 분기에 active workspace 필터 추가 (staff 분기는 무변경)

→ 위 3 PR 은 PR #71 패턴 그대로 복제. 각 PR worktree 격리 + subagent-driven 4 task + 2-stage review.

### 🔴 P2 — eng-review + 사용자 confirm 필요 (high-risk)

**PR #75 → migration apply** (production DB 변경)
1. 사용자가 PR #75 의 spec + checklist 9 항목 검토
2. 사용자 명시적 confirm: "PR4 migration apply 진행"
3. Claude 가 `mcp__supabase__apply_migration` 으로 적용
4. 즉시 dogfooding 6 시나리오 검증
5. 회귀 시 rollback SQL 즉시 실행

**PR3-A: 4 테이블 admin global 분리** (PR #75 패턴 복제, 동일 high-risk)
1. PR #75 머지 + 검증 PASS 후 진행
2. applications/event_qr_codes/work_logs/workspace_members 의 SELECT 정책에서 `get_my_role()='admin'` 분기 제거
3. 4 admin global RPC 신규 (각각 list_all_*)
4. eng-review checklist 동일

### 🟢 P3 — 선택적 (low priority)

**PR3-E: write helper 통일**
- work_logs / event_qr_codes 의 mutation hook 에 owner-only client 가드가 있다면 PR #73 패턴 (loadAndVerifyMutateAccess) 복제
- 우선순위 낮음 — RLS 이미 풀려있어 functional impact 없음, 정합성/가독성 cleanup

## 시작 전 확인 사항

- [ ] master pull
- [ ] PR #72/#73/#74/#75 상태 확인 (`gh pr list`)
- [ ] PR #72 머지 → base 자동 갱신으로 #73 가 master 기반이 됨
- [ ] localhost dev 서버 확인 (port 8081)
- [ ] review-employer / review-admin 계정 dogfooding 가능 상태

## 핵심 파일 위치

### PR #72/#73 변경된 파일
- `src/repositories/supabase/ApplicationRepositoryHelpers.ts` (loadAndVerifyJobPostingAccess — rename)
- `src/repositories/supabase/JobPostingRepository.ts` (loadAndVerifyMutateAccess + loadAndVerifyDeleteAccess 신규)
- `src/hooks/useJobManagement.ts` (useMyPostingsQueryKey DRY 헬퍼)

### PR3-B 진입점
- `src/repositories/supabase/WorkLogRepository.ts` (getMonthlyPayroll 검토)
- `src/hooks/useWorkLogs.ts:345` (useMonthlyPayroll)

### PR3-C 진입점
- `src/repositories/supabase/SettlementRepository.ts`
- `src/hooks/useSettlement.ts:487` (useSettlementDashboard)

### PR3-D 진입점
- `src/hooks/useSchedules.ts:570` (useScheduleStats)
- `src/hooks/useSchedules.ts:600` (useCalendarView)

### PR #75 migration SQL
- `docs/superpowers/plans/2026-05-10-task5-rls-jp-select-split.md` (full migration + rollback)

## 환경 노트

- master HEAD (본 세션 종료 시) = `bf03eec12` (PR #71 머지 후, 본 세션은 worktree 만 사용)
- 4 worktree 보존됨:
  - `.claude/worktrees/workspace-cleanup-rename-dry` (PR #72)
  - `.claude/worktrees/workspace-write-side-access` (PR #73)
  - `.claude/worktrees/workspace-task6-audit` (PR #74)
  - `.claude/worktrees/workspace-task5-rls-spec` (PR #75)
- production DB 테스트 데이터 (review-employer 의 공고 "234" + 워크스페이스 1개) 보존
- localhost dev 서버 본 세션 미사용

## 메타 — 본 세션 워크플로우 효율

- 4 PR 을 1 세션에 생성 (PR #72: rename + DRY → PR #73: write-side stacked → PR #74: audit ADR → PR #75: RLS spec)
- 모든 PR worktree 격리 + 영역별 분리
- PR #73 은 #72 위에 stacked (PR #72 머지 시 base 자동 갱신)
- PR #74 + #75 는 docs only (코드 변경 0, low risk)
- PR #75 는 production migration spec — apply 는 사용자 confirm 후 분리

## 참조 — 본 세션 이전 작업

- `docs/superpowers/plans/2026-05-10-NEXT-SESSION-PROMPT.md` — PR #71 직후 작성된 prompt (본 prompt 가 v2)
- `docs/superpowers/plans/2026-05-09-workspace-posting-filter.md` — Phase 2A.후속 plan (PR #71 의 spec)
- `docs/superpowers/plans/2026-05-10-task6-workspace-audit.md` — PR #74 audit ADR
- `docs/superpowers/plans/2026-05-10-task5-rls-jp-select-split.md` — PR #75 RLS spec
