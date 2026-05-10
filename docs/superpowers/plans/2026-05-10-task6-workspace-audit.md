# Task 6 Audit — applications/work_logs/event_qr_codes/settlement/schedule workspace 호환

> **목적:** Phase 2A.후속(PR #71/#72/#73)에서 job_postings 한정으로 도입한 workspace member 호환 + active workspace 필터링 + admin 누출 방지를 다른 4 영역에서도 일관되게 적용해야 하는지 audit. 본 문서는 **조사 결과 + 영역별 sub-PR 로드맵** 만 정리; 실제 fix 는 각 sub-PR에서.
>
> **방법:** production DB pg_policy 검사 (5 테이블 17 정책) + client repository 시그니처 grep + hook query key 분석.
>
> **결론 미리보기:** 4 영역 모두 backend RLS 는 workspace_member 분기를 갖추고 있으나 **client 쪽 0% 연동**. employer-side aggregate hook 에서 ghost cache + admin global 노출 위험 존재. 가장 시급한 건 settlement (employer 결제 흐름) > applications (cancellation 검토) > work_logs > event_qr_codes > schedule.

## 1. RLS 정책 매트릭스 (production DB 2026-05-10 기준)

| 테이블 | SELECT | UPDATE | DELETE | INSERT |
|--------|--------|--------|--------|--------|
| `applications` | applicant\|owner\|member\|**admin** | applicant\|owner\|member\|**admin** | applicant only (status applied/cancelled) | applicant_id = auth.uid() |
| `event_qr_codes` | user\|owner\|member\|**admin** | user\|member\|**admin** | user\|member\|**admin** | user_id = auth.uid() |
| `job_postings` | **public(approved/active/closed)**\|owner\|member\|**admin** | member\|**admin** | workspace_owner\|**admin** | role IN admin/employer |
| `work_logs` | staff\|owner\|member\|**admin** | staff\|owner\|member\|**admin** | (no policy) | (no policy) |
| `workspace_members` | self\|member\|**admin** | (no policy) | (no policy) | (no policy) |

**범례:**
- **`admin`** (굵게) = `get_my_role() = 'admin'` OR `is_admin()` global bypass — RC0 동일 패턴
- **`public`** (job_postings 전용) = `status IN (approved, active, closed)` 모든 인증 사용자 read 허용

## 2. 핵심 발견

### 2-A. RC0 (admin global 누출) — 4 영역 모두 동일 패턴

`applications`, `event_qr_codes`, `job_postings`, `work_logs` 의 SELECT 정책 모두 `get_my_role() = 'admin'` 분기 보유. PR #70 가 `list_my_workspaces` RPC 로 admin global 누출을 막았듯, my-postings 외 화면(my-applications, my-worklogs, my-qr 등)에도 동일 누출 가능성.

**검증 방법:** review-admin 으로 staff 모드 접근 → my-applications 탭에서 다른 사용자 application 노출 여부 확인.

### 2-B. Public read (RC0 진앙) — job_postings 전용

`jp_select` 의 `status IN (approved/active/closed)` 분기는 **모든 인증 사용자에게 active 공고 SELECT 권한** 부여 (staff search 용). 이게 PR #71 에서 employer my-postings 가 다른 employer 의 active 공고와 섞여 나온 진짜 진앙. 다른 4 테이블에는 public read 분기 없음 → 그 영역들의 누출은 RC0 (admin global) 단독.

→ **Task 5 RLS jp_select 분리** (PR4) 가 다른 4 테이블에는 직접 적용 안 됨. 4 테이블 의 admin global 만 별도 분리하면 충분.

### 2-C. Client 측 workspace 연동 0%

```bash
grep "workspaceId|activeWorkspace" \
  src/repositories/supabase/{ApplicationRepository,WorkLogRepository,EventQRRepository,SettlementRepository}.ts
# → No matches found (4 영역 모두)
```

```bash
grep -l "useActiveWorkspace" src/hooks/
# → useJobManagement.ts (1건만 — job_postings)
```

**진단:** Phase 3A/3B/3C 가 backend RLS 만 풀고 client 측은 무변경. PR #71 가 처음으로 job_postings 만 풀었지만 같은 패턴이 4 영역 더 필요.

### 2-D. Settlement / Schedule 별도 테이블 부재

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%settlement%|schedule%|payroll%'
-- → schedule_board_sync_outbox 만 (audit 대상 아님)
```

**확인:**
- `settlement` — work_logs aggregation 으로 구현. PR #66 ADR (no-op) 와 일치.
- `schedule` — work_logs 기반. 별도 RLS 정책 없음.

→ work_logs 한 곳만 fix 하면 settlement + schedule 자동 cascade.

## 3. 영역별 hook scope (employer-side vs staff-side)

### applications (`useApplications.ts`)

- **`useApplications`** (line 54) — staff side: 본인 applicant_id 기반. workspace 무관.
- **`useHasAppliedToJob`** (line 322) — staff side, jobPostingId 단일 조회. workspace 무관.
- **`getCancellationRequests`** — employer side, jobPostingId scoped (PR #71 ApplicationRepositoryHelpers 에서 이미 fix). 추가 작업 없음.

→ **applications 자체 fix 불필요.** PR #71 이 이미 해결.

### work_logs (`useWorkLogs.ts`)

| hook | scope | risk |
|------|-------|------|
| `useWorkLogs` (52) | staff side (본인 work_logs) | 낮음 |
| `useWorkLogsByDate` (118) | staff side | 낮음 |
| `useWorkLogDetail` (171) | id 단일 조회 | 낮음 |
| `useCurrentWorkStatus` (188) | staff side | 낮음 |
| `useWorkLogStats` (321) | staff side | 낮음 |
| `useMonthlyPayroll` (345) | **employer aggregate** | 🔴 ghost cache + admin global |

### event_qr_codes (`useEventQR.ts`)

- **`useEventQR`** (78) — jobPostingId scoped 단일. workspace 의존 낮음 (단, employer 가 cross-workspace QR 검증 시 누출 가능 — admin 전용 운영 도구라면 별도 검토).

### settlement (`useSettlement.ts`)

| hook | scope | risk |
|------|-------|------|
| `useWorkLogsByJobPosting` (45) | jobPosting scoped | 낮음 |
| `useSettlementSummary` (69) | jobPosting scoped | 낮음 |
| `useMySettlementSummary` (88) | **staff side aggregate** | 낮음 |
| `useSettlement` (376) | jobPosting scoped | 낮음 |
| **`useSettlementDashboard`** (487) | **employer aggregate** | 🔴 ghost cache + admin global |

### schedule (`useSchedules.ts`)

| hook | scope | risk |
|------|-------|------|
| `useSchedules` (103) | staff side | 낮음 |
| `useSchedulesByMonth` (203) | staff side | 낮음 |
| `useScheduleStats` (570) | **dual** (staff or employer 분기) | 🟡 staff-side ok, employer 분기 검증 필요 |
| `useCalendarView` (600) | dual | 🟡 동일 |

## 4. 위험 hook 매트릭스 (workspace 필터 필요)

| hook | 영역 | 권장 변경 |
|------|------|----------|
| `useMonthlyPayroll` | work_logs | activeWorkspaceId 를 query key + repo 인자로. employer-side scope. |
| `useSettlementDashboard` | settlement | 동일. workspace 별 정산 dashboard 분리. |
| `useScheduleStats` (employer 분기) | schedule | dual mode 검증 + employer 분기에 active workspace 필터. |
| `useCalendarView` (employer 분기) | schedule | 동일. |

→ **3 hook + dual-mode 2 hook = 총 5 hook 수정 필요.** 각 hook 당 PR #71 의 패턴 (Repository signature + hook query key + ghost cache 가드) 복제.

## 5. Sub-PR 로드맵

### PR3-A: RLS admin global 분리 (4 테이블) — ✅ shipped (#82/#84/#85)

### PR3-A.2: UPDATE/DELETE admin 분기 제거 + helper throw — ✅ shipped (2026-05-11)

> spec: `docs/superpowers/plans/2026-05-11-pr3a2-admin-rls-update-delete-split.md`
> migration: `pr3a2_admin_write_rls_split` (4 admin 분기 제거 + 2 deny-all + helper throw)

### PR3-E: client write helper 통일 — ❎ no-op (2026-05-11)

> ADR: `docs/decisions/2026-05-11-pr3e-client-write-helper-unification.md`
> WorkLogRepository / EventQRRepository mutation 에 owner-only 클라이언트 가드 부재 → 진입 조건 미충족

---

### PR3-A (원본 spec 본문):

> 별도 plan + eng-review. PR4 (Task 5) 와 동일 결정 트리 — **production migration**.

`applications`, `event_qr_codes`, `work_logs`, `workspace_members` 의 SELECT 정책에서 `get_my_role() = 'admin'` 분기 제거 + 별도 admin SECURITY DEFINER RPC 로 이전 (PR #69, #70 패턴 일관). 검증:
- jest 4 역할 테스트
- review-admin 으로 staff 모드 접근 시 본인 데이터만 노출

### PR3-B: useMonthlyPayroll workspace 필터

PR #71 패턴 복제:
1. `WorkLogRepository.getMonthlyPayroll(ownerId, options?)` 시그니처에 `workspaceId?` 추가
2. `useMonthlyPayroll(year, month, enabled?)` 가 `useActiveWorkspace` 의존
3. query key 에 `activeWorkspaceId` 포함, `enabled = !!user && !!activeWorkspace?.id`
4. jest contract 테스트 (workspace 필터 적용 여부 + ghost cache 가드)

### PR3-C: useSettlementDashboard workspace 필터

PR3-B 와 동일 패턴. `SettlementRepository.getDashboard` (또는 work_logs aggregation 함수) 의 호출 흐름 추적 필요.

### PR3-D: schedule dual-mode hook 검증 + employer 분기 필터

`useScheduleStats`, `useCalendarView` 의 employer 모드 분기에서 active workspace 필터 추가. staff 모드는 무변경.

### PR3-E (선택): client write helper 통일

`work_logs`, `event_qr_codes` 도 mutation hook 에 owner-only 클라이언트 가드 있다면 PR #73 패턴 (`loadAndVerifyMutateAccess`) 복제. 우선순위 낮음 — RLS 이미 풀려있어 functional impact 없음, 정합성/가독성 cleanup.

## 6. 의존성 그래프

```
PR #71 (read-side workspace + cancellation 멤버)
  └→ PR #72 (rename + DRY)
       └→ PR #73 (write-side mutation 호환)
            └→ PR3-B, PR3-C, PR3-D (각 영역 독립적, 병렬 가능)
            └→ PR4 (jp_select 분리, eng-review)
                └→ PR3-A (4 테이블 admin 분리, 패턴 복제)
                    └→ PR3-E (선택)
```

## 7. 즉시 실행 가능 (low-risk) vs 신중 (high-risk)

**Low-risk (코드만, 즉시 진행)**:
- PR3-B: useMonthlyPayroll
- PR3-C: useSettlementDashboard
- PR3-D: schedule dual-mode

**High-risk (production migration, eng-review 필요)**:
- PR3-A: 4 테이블 admin 분리
- PR4: jp_select 분리

## 8. 본 audit 후속 액션

1. **사용자 dogfooding 시나리오 추가** — review-admin 이 staff 모드로 다른 사용자 데이터 보이는지 확인 (PR3-A 진입 조건 검증)
2. **dual-mode hook 의 employer/staff 분기 코드** 정확한 위치 확인 (PR3-D 작성 전)
3. **SettlementRepository getDashboard 함수** (또는 work_logs aggregation) 의 호출 path 추적 (PR3-C 작성 전)

## 9. 본 PR 의 산출물

- 본 ADR 만 (코드 변경 0)
- 다음 세션의 Sub-PR 진입점 명시
- RLS 정책 매트릭스 snapshot (2026-05-10 기준)

## PR3-D Resolution (2026-05-10)

`useScheduleStats` (L570) 와 `useCalendarView` (L600) 의 employer 분기 audit 항목 검증 완료.

**결론:** 두 hook 모두 **staff-only**. 코드 검증으로 확인:
- `useScheduleStats` → `getScheduleStats(staffId)` (scheduleService.ts:727) — `staff_id` 로만 query.
- `useCalendarView` → `useSchedulesByMonth` (L203) → `getSchedulesByMonth(staffId, year, month)` (scheduleService.ts:462) — `staff_id` 로만 query.

employer 분기는 존재하지 않음. audit ADR §3.schedule 의 "dual (staff or employer 분기)" 분류는 잘못된 것이었음. RLS 가 staff 본인 work_logs 만 노출하므로 workspace 필터 불필요.

**조치:** PR3-D 는 코드 변경 없이 staff-only 의도를 JSDoc + 테스트로 잠금. 실제 employer 스케줄 hook 이 향후 도입되면 그때 active workspace 필터 검토.

(See PR #[NUMBER] for the verification + JSDoc + test additions.)
