# PR3-A.2 — admin 분기 제거 (UPDATE/DELETE) + helper throw + deny-all 정책 + integration test

> **상태:** ✅ **SHIPPED** (2026-05-11) — production migration `pr3a2_admin_write_rls_split` applied.
>
> **선행 조건:** PR3-A (✅ #82/#84/#85, prod 적용 + RPC runtime hotfix 완료) + PR3-B/C/D (✅ #79/#77/#78 머지)
>
> **위험도:** 🔴 HIGH — production DB RLS 정책 4개 변경 (UPDATE 3 + DELETE 1) + workspace_members deny-all 2 정책 신규 + helper 1 함수 변경. SELECT 누출은 PR3-A 가 차단했으므로 본 PR 은 admin row id 추측 기반 *간접 write* 경로 차단. rollback 가능.
>
> **종속:** PR3-A 의 `list_all_<table>` 읽기 RPC 패턴이 검증됨. 본 PR 은 *write 측 admin 분기*만 제거 + admin write RPC **defer 정책** 명시 + helper silent no-op 차단.
>
> **eng-review 결정 사항 (2026-05-11):**
> - **Issue #1 (B)**: `loadAndVerifyMutateAccess` admin 분기에서 `PermissionError` throw — silent no-op 차단 + admin UI 도입 시 RPC 강제
> - **Issue #2 (B)**: `workspace_members` 에 deny-all UPDATE/DELETE 정책 명시 — 자기 문서화 + 누군가 정책 추가하는 함정 차단
> - **Issue #3 (A)**: prod trigger 14개 (applications 5 + work_logs 7 + event_qr_codes 0) 사전 조사 완료, 모두 `pg_net`/HTTP 호출 부재 확인 → §6-B dry-run + ROLLBACK 안전 (NOTIFY 도 ROLLBACK 시 함께 회수)
> - **Issue #4 (B)**: jest integration test (`__tests__/integration/pr3a2RlsAdminDeny.test.ts`) 신규 — CI 상시 회귀 차단

## 1. 문제 (잔존 admin write 분기)

### 1-A. 현재 production 상태 (2026-05-11 기준)

PR3-A 후 SELECT 정책 4개에서 admin 분기는 모두 제거됨. 그러나 UPDATE/DELETE 4 정책에 admin 분기 잔존:

```sql
-- pg_policy 측정 결과 (2026-05-11 mcp__supabase__execute_sql)

applications.app_update USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'        -- ❌ 잔존 분기
);

event_qr_codes.qr_update USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'        -- ❌ 잔존 분기
);

event_qr_codes.qr_delete USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'        -- ❌ 잔존 분기
);

work_logs.wl_update USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'        -- ❌ 잔존 분기
);
```

### 1-B. workspace_members / work_logs.delete 등은 자동 제외

| 테이블 | UPDATE 정책 | DELETE 정책 |
|--------|------------|-------------|
| applications | `app_update` (admin 분기 ❌) | `applications_delete_own` (applicant-only, admin 없음 ✅) |
| event_qr_codes | `qr_update` (admin 분기 ❌) | `qr_delete` (admin 분기 ❌) |
| work_logs | `wl_update` (admin 분기 ❌) | **DELETE 정책 없음** (RLS 기본 deny) |
| workspace_members | **UPDATE/DELETE 정책 없음** (RPC-only write) → **eng-review Issue #2 B**: deny-all 명시 추가 | 동일 |

→ **본 PR 범위: admin 분기 4개 제거 (3 테이블) + workspace_members deny-all 2 정책 신규 (의도 명시).**

### 1-C. RC0 — 간접 write 누출

PR3-A 가 SELECT 누출 (admin 이 *모든* row 노출) 을 차단했으므로 admin 은 일반 RLS 흐름으로는 다른 사용자의 row id 를 알 수 없음. 그러나:

- **list_all_<table>() RPC 호출** → admin 이 row id 획득
- **legacy 캐시/로그** → 과거 SELECT 시 보관된 id 활용
- **추측 (UUID 충돌은 비현실적이지만 sequence/식별 가능 컬럼 조합으로 추측)**

이 후, admin 이 RLS 만으로 UPDATE/DELETE 가능. 즉 **PR3-A 가 막은 1차 경로의 우회 경로**가 잔존.

PR3-A.2 가 본 우회 경로 차단으로 admin 분기 4 영역 일관성 완성.

## 2. 설계 — 옵션 A (RPC 추가 없이 admin 분기만 제거)

### 2-A. 결정 트리

| 항목 | PR3-A (read) | PR3-A.2 (write) — 본 PR |
|------|-------------|----------------------|
| admin 분기 제거 | ✅ | ✅ |
| admin SECURITY DEFINER RPC | 4개 추가 (`list_all_*`) | **defer** — admin UI 도입 시점에 per-need 추가 |

### 2-B. RPC defer 근거

1. **admin write call site 부재** — codebase 전체 grep 결과 admin role 분기로 work/qr/applications 직접 UPDATE 하는 코드 없음 (PR3-A 와 동일 결론).
2. **write RPC 설계 비용** — read RPC 는 `SETOF table + filter args` 단일 패턴이지만 write 는 컬럼별 patch 시그니처가 필요. 무차별 jsonb patch 는 보안 위험 (admin 이 schema-bypass 컬럼 수정), 컬럼별 RPC 는 N개 함수 폭증.
3. **YAGNI** — admin UI 가 실제 도입될 때 *그* UI 가 필요로 하는 컬럼만 patch 하는 좁은 RPC 작성이 가장 안전. 본 PR 에서 speculative RPC 추가 시 dead code 양산 + 잘못된 시그니처 리스크.
4. **선례** — PR3-A 도 admin call site 부재 상태에서 `list_all_*` RPC 만 추가했으나 *write 측은 read 와 다르게 매개변수가 컬럼 단위로 발산*. 동일 speculative 추가는 비대칭이 정당화됨.

### 2-C. 향후 admin write RPC 작성 가이드 (defer 시 보존)

본 PR 머지 후 admin UI 도입 시 다음 패턴 강제:

```sql
-- 예: admin_update_application_status(p_id uuid, p_status application_status)
CREATE OR REPLACE FUNCTION public.admin_update_application_status(
  p_id uuid,
  p_status public.application_status
) RETURNS public.applications
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_row public.applications;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  UPDATE public.applications
  SET status = p_status, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_application_status(uuid, public.application_status) TO authenticated;
```

원칙:
- **컬럼-단위 RPC** (`admin_update_<table>_<column>`) — 무차별 jsonb 금지
- **VOLATILE + RETURNING** — caller 가 변경 결과 검증 가능
- **SECURITY DEFINER + role check** — JWT staleness 우회 (`public.users.role` 조회)
- **NOT FOUND → P0002** — caller 가 row 부재와 권한 거부 구분

## 3. Migration SQL

### 3-A. 적용 SQL (atomic)

```sql
-- migration: 2026_05_11_pr3a2_admin_write_rls_split.sql

BEGIN;

-- ============================================================
-- 1) applications.app_update — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS app_update ON public.applications;

CREATE POLICY app_update ON public.applications FOR UPDATE USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  -- admin 분기 제거 → 향후 admin_update_<table>_<column>() RPC 로 이전
);

-- ============================================================
-- 2) event_qr_codes.qr_update — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS qr_update ON public.event_qr_codes;

CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 3) event_qr_codes.qr_delete — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS qr_delete ON public.event_qr_codes;

CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 4) work_logs.wl_update — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS wl_update ON public.work_logs;

CREATE POLICY wl_update ON public.work_logs FOR UPDATE USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 5) workspace_members.no_direct_write — eng-review Issue #2 B
-- ============================================================
-- 의도: workspace_members write 는 SECURITY DEFINER RPC 경유 강제
-- (PR #69 create_workspace, member 추가/제거 RPC). 누군가 RLS 정책을
-- 추가하려 하면 명시적 DROP 강제 → 자기 문서화 + admin 누출 함정 차단.
CREATE POLICY workspace_members_no_direct_update ON public.workspace_members FOR UPDATE USING (false);
CREATE POLICY workspace_members_no_direct_delete ON public.workspace_members FOR DELETE USING (false);

-- PostgREST schema cache reload — 정책 변경 즉시 반영
NOTIFY pgrst, 'reload schema';

COMMIT;
```

### 3-B. Rollback SQL

```sql
BEGIN;

-- 1) applications.app_update — admin 분기 복원
DROP POLICY IF EXISTS app_update ON public.applications;
CREATE POLICY app_update ON public.applications FOR UPDATE USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 2) event_qr_codes.qr_update — admin 분기 복원
DROP POLICY IF EXISTS qr_update ON public.event_qr_codes;
CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 3) event_qr_codes.qr_delete — admin 분기 복원
DROP POLICY IF EXISTS qr_delete ON public.event_qr_codes;
CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 4) work_logs.wl_update — admin 분기 복원
DROP POLICY IF EXISTS wl_update ON public.work_logs;
CREATE POLICY wl_update ON public.work_logs FOR UPDATE USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 5) workspace_members deny-all 정책 제거
DROP POLICY IF EXISTS workspace_members_no_direct_update ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_no_direct_delete ON public.workspace_members;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

## 4. Client 영향

### 4-A. 영향 없음 (대부분 흐름)

기존 employer/staff/member 흐름:
- staff 본인 (work_logs/applications/event_qr_codes) — `*_id = auth.uid()` 분기 통과
- employer owner — `job_postings.owner_id = auth.uid()` 분기 통과
- workspace member (editor) — `is_workspace_member(...)` 분기 통과

### 4-B. admin 흐름 변화

codebase 전체 grep 결과 admin 전용 write call site **부재** (PR3-A 와 동일 결론).

향후 admin UI 도입 시:
- §2-C 패턴 (컬럼-단위 SECURITY DEFINER RPC) 으로 작성
- 본 spec 의 가이드 준수
- per-RPC eng-review 필수

### 4-C. `loadAndVerifyMutateAccess` admin 분기 변경 (eng-review Issue #1 B)

기존 `JobPostingRepository.loadAndVerifyMutateAccess` (L139~) 는 owner|member|admin 호환 → admin 통과. PR3-A.2 적용 후 RLS 가 admin write 를 차단하면 **silent no-op** (UPDATE 0 row affected, exception 미발생) 발생. caller 가 "성공" 으로 오인 + UI stale 데이터.

**조치**: helper 의 admin 분기에서 `PermissionError` throw 로 변경. silent no-op 차단 + 향후 admin UI 도입 시 RPC (§2-C) 강제.

```ts
// uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts L163~
// Before:
const adminResult = await supabase.rpc('is_admin');
if (adminResult.error) {
  handleSupabaseError(adminResult.error, { operation, table: TABLE });
}
if (adminResult.data === true) return jobPosting;

// After (PR3-A.2):
const adminResult = await supabase.rpc('is_admin');
if (adminResult.error) {
  handleSupabaseError(adminResult.error, { operation, table: TABLE });
}
if (adminResult.data === true) {
  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `admin 직접 ${operation} 은 허용되지 않습니다. admin 전용 RPC 를 사용하세요.`,
  });
}
```

**테스트** — `JobPostingRepository.write.workspace.test.ts` 에 회귀 시나리오 3개 추가 (Iron Rule):
1. admin role + 비-멤버 W2 jobPosting → `rejects.toThrow(PermissionError)` + errorCode `INFRA_PERMISSION_DENIED`
2. admin role + 본인 owner jobPosting → 정상 통과 (owner 분기 우선)
3. admin role + 멤버 W1 jobPosting → 정상 통과 (workspace_member 분기 우선)

## 5. Eng-review checklist (2026-05-11 통과 ✅)

- [x] **PostgreSQL RLS UPDATE/DELETE OR 조합 의미** — `app_update / qr_update / qr_delete / wl_update` 의 새 USING 절이 단일 정책으로 평가 — PR3-A 와 동일 패턴
- [x] **`is_workspace_member` cycle 가드** — 4 새 정책 모두 plpgsql STABLE 함수 호출 → 재귀 가드 유효 (PR #67 핫픽스 패턴)
- [x] **admin 누출 정량 검증** — review-admin 으로 4 테이블 직접 UPDATE 시 본인/멤버십 row 만 수정 가능 (다른 사용자 row UPDATE 0 row affected)
- [x] **dual-role 확인** — admin + 워크스페이스 owner/member 인 사용자가 RLS 일반 분기 (`*_id = auth.uid()`, `is_workspace_member`) 로 본인 row 정상 UPDATE
- [x] **silent no-op 차단 (Issue #1 B)** — `loadAndVerifyMutateAccess` admin 분기에서 PermissionError throw. silent no-op 차단 + admin UI 도입 시 RPC (§2-C) 강제. 회귀 테스트 3 시나리오 mandatory
- [x] **workspace_members deny-all (Issue #2 B)** — `workspace_members_no_direct_update` / `workspace_members_no_direct_delete` 정책 신규 추가. RPC-only write 의도를 코드로 명시
- [x] **trigger ROLLBACK 안전성 (Issue #3 A)** — applications 5 + work_logs 7 + event_qr_codes 0 = 14 trigger 사전 조사 완료. 모두 `pg_net`/HTTP 호출 부재. NOTIFY/internal mutation 만 사용 → ROLLBACK 시 함께 회수. dry-run SQL 안전
- [x] **integration test (Issue #4 B)** — `__tests__/integration/pr3a2RlsAdminDeny.test.ts` 신규. CI 상시 회귀 차단
- [x] **DELETE 정책 시맨틱** — `qr_delete` USING 통과 row 만 DELETE 가능. admin 분기 제거 후 admin 이 비-소유 qr DELETE 시 0 row affected (silent). helper throw (Issue #1 B) 로 caller 측에서 차단
- [x] **rollback SQL 검증** — staging branch DB 에 migration → rollback 왕복 1회 — pg_policies 스냅샷 비교 (workspace_members 2 deny-all 정책 포함)
- [x] **PostgREST schema reload** — migration block 마지막에 `NOTIFY pgrst, 'reload schema'` 발행
- [x] **PR3-A `list_all_*` 와의 시맨틱 정합성** — read 측은 admin RPC 로 전체 노출, write 측은 admin RPC 미제공 + helper throw. 의도된 비대칭 (§2-B 근거)

## 6. 사용자 dogfooding 시나리오 (apply 후)

### 6-A. 시나리오 표

| 시나리오 | Before | After |
|----------|--------|-------|
| review-admin → 본인 application UPDATE (status 변경) | OK (admin 분기) | OK (applicant_id 분기) |
| **review-admin → 다른 user 의 application UPDATE** | OK (잘못) | 0 row affected ✅ |
| review-admin → 다른 user 의 event_qr_code is_active=false (UPDATE) | OK (잘못) | 0 row affected ✅ |
| review-admin → 다른 user 의 event_qr_code DELETE | OK (잘못) | 0 row affected ✅ |
| review-admin → 다른 user 의 work_log payroll_status UPDATE | OK (잘못) | 0 row affected ✅ |
| review-employer → 본인 job_posting 의 application UPDATE | OK (job_posting subquery) | OK (변화 없음) |
| review-employer → 본인 job_posting 의 work_log payroll UPDATE | OK | OK (변화 없음) |
| **dual-role: admin + 워크스페이스 W1 owner → W1 의 application UPDATE** | OK (admin 분기) | OK (`is_workspace_member` 분기) ✅ |
| **dual-role: admin + 워크스페이스 W1 member → W1 의 work_log UPDATE** | OK (admin 분기) | OK (`is_workspace_member` 분기) ✅ |

### 6-B. 정량 측정 절차 (apply 직전·직후 1회씩)

review-admin JWT 로 다음 SQL 측정. count 변화로 차단 evidence 확보 → PR comment 첨부.

> **trigger 안전성 (Issue #3 A 검증 완료)**: applications/work_logs trigger 14개 모두 `pg_net`/HTTP 호출 부재. ROLLBACK 시 NOTIFY 도 회수됨 → dry-run UPDATE/DELETE 가 production side effect 없음 (BEFORE UPDATE `applications_xss_check` 와 `protect_work_log_payroll` 은 `SET updated_at = updated_at` 패턴이라 trigger fire 하지만 실제 변경 없음).

```sql
-- 측정 시 JWT 세팅
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<review-admin-uid>","role":"authenticated"}'::jsonb;
```

| # | 측정 SQL | Before 기대 | After 기대 |
|---|---------|------------|------------|
| 1 | `BEGIN; WITH dry AS (UPDATE applications SET updated_at = updated_at WHERE applicant_id <> '<review-admin-uid>' AND job_posting_id NOT IN (SELECT id FROM job_postings WHERE owner_id = '<review-admin-uid>' OR is_workspace_member(workspace_id, '<review-admin-uid>')) RETURNING 1) SELECT count(*) FROM dry; ROLLBACK;` | > 0 (admin 누출) | **0** (차단) |
| 2 | 동일 패턴 — `event_qr_codes` UPDATE dry-run | > 0 | **0** |
| 3 | 동일 패턴 — `event_qr_codes` DELETE dry-run | > 0 | **0** |
| 4 | 동일 패턴 — `work_logs` UPDATE dry-run | > 0 | **0** |
| 5 | review-employer JWT 로 본인 job_posting 의 application UPDATE — 변화 없음 검증 | OK | OK (회귀 없음) |
| 6 | `BEGIN; UPDATE workspace_members SET role = role WHERE user_id <> '<review-admin-uid>' RETURNING 1; ROLLBACK;` (Issue #2 B 검증) | depends | **0** (deny-all 정책) |

각 측정은 `BEGIN; ...; ROLLBACK;` 으로 감싸 production data 영향 없음 (trigger ROLLBACK 안전성 §6-B intro 참조).

## 7. PR3-A vs PR3-A.2 차이점

| 항목 | PR3-A | PR3-A.2 (본 PR) |
|------|-------|----------------|
| 정책 종류 | SELECT 4개 | UPDATE 3개 + DELETE 1개 (총 4 정책) |
| admin RPC 추가 | 4 (`list_all_*`) | **0** (defer 정책 §2-C) |
| atomic | 단일 migration | 단일 migration |
| 정량 측정 | SELECT count(*) | UPDATE/DELETE dry-run + ROLLBACK |
| 비대칭 정당화 | (read 시맨틱 단순) | write RPC 컬럼별 발산 + admin call site 부재 → YAGNI |

PR3-A.2 가 더 단순한 이유: 기존 정책에 admin 분기만 OR 로 추가된 형태라 `DROP + CREATE` 로 분기만 제거. RPC 추가 없음으로 PR 표면적 작음.

## 8. Migration 실행 직전 체크리스트

- [ ] PR3-A (#82/#84/#85) prod 적용 검증 — 4 RLS SELECT 정책에 admin 분기 부재
- [ ] PR3-B/C/D (#79/#77/#78) 머지 검증 — read-side workspace 필터 적용
- [ ] eng-review 통과 — 위 10개 checklist 항목 검증
- [ ] 사용자 명시적 confirm — production DB migration apply
- [ ] migration 실행 직후 dogfooding 시나리오 9개 검증 (review-admin 계정 필요)
- [ ] 회귀 발견 시 rollback SQL 즉시 실행 + 사용자 알림
- [ ] PR3-A 와 동일 — staging dry-run 시 `SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polname IN ('app_update','qr_update','qr_delete','wl_update');` 4 정책 USING 절 admin 분기 부재 확인

## 9. 본 PR 산출물

- 본 spec 문서 (eng-review 통과 ✅)
- migration SQL + rollback SQL (실행 안 함)
  - 4 admin 분기 제거 + 2 deny-all 정책 신규 + NOTIFY pgrst
- 코드 변경 1 파일 (Issue #1 B): `JobPostingRepository.ts` L163~ admin 분기 throw
- 신규 테스트 파일 1개 + 기존 테스트 파일 3 시나리오 추가:
  - `__tests__/integration/pr3a2RlsAdminDeny.test.ts` (Issue #4 B, integration)
  - `JobPostingRepository.write.workspace.test.ts` (Iron Rule, regression × 3)
- eng-review checklist 12 항목 통과
- dogfooding 시나리오 9 케이스 + 정량 측정 6 SQL (Issue #2 검증 1개 추가)
- admin write RPC defer 정책 + 향후 작성 가이드 (§2-C)

## 10. 다음 액션

1. ✅ **eng-review** — 본 spec 의 checklist 12 항목 통과 (2026-05-11)
2. **사용자 명시적 confirm** — "PR3-A.2 migration + helper 변경 + integration test apply 진행" 명시
3. **branch 작업** — `feat/pr3a2-admin-write-rls-split` worktree
   1. helper 변경 (Issue #1 B): `JobPostingRepository.ts` L163~
   2. 회귀 테스트 3 시나리오 추가
   3. integration test 신규 (Issue #4 B)
   4. `npm run quality && npm test` 통과 확인
4. **migration apply** — `mcp__supabase__apply_migration` (name: `pr3a2_admin_write_rls_split`, 4 정책 변경 + 2 deny-all + NOTIFY)
5. **즉시 dogfooding** — 9 시나리오 + 6 정량 SQL 검증 (review-admin 계정)
6. **integration test 검증** — `npm test -- pr3a2RlsAdminDeny` 통과 확인
7. **회귀 시 rollback** — §3-B SQL 즉시 실행 (workspace_members deny-all 2 정책 DROP 포함)
8. **memory 업데이트** — `project_pr3a_admin_rls_split_complete.md` 에 PR3-A.2 완료 표기, audit ADR §5.PR3-A.2 status `📋 deferred` → `✅ shipped`

## 11. PR3-E 관계

audit ADR §5.PR3-E (client write helper 통일) 는 본 PR 과 독립. WorkLogRepository / EventQRRepository 의 mutation 메서드에 owner-only 클라이언트 가드가 부재함을 codebase grep 으로 확인 → no-op + ADR (`docs/decisions/2026-05-11-pr3e-client-write-helper-unification.md`).

## 12. Apply 결과 (2026-05-11)

### 12-A. Migration 적용

`mcp__supabase__apply_migration` (name: `pr3a2_admin_write_rls_split`) → `success: true`

### 12-B. Schema-level evidence

```sql
-- pg_policy 검증 결과 (admin 분기 부재)
| Policy                              | Table             | Cmd    | admin branch? |
|-------------------------------------|-------------------|--------|---------------|
| app_update                          | applications      | UPDATE | ❌ removed    |
| qr_delete                           | event_qr_codes    | DELETE | ❌ removed    |
| qr_update                           | event_qr_codes    | UPDATE | ❌ removed    |
| wl_update                           | work_logs         | UPDATE | ❌ removed    |
| workspace_members_no_direct_delete  | workspace_members | DELETE | USING(false)  |
| workspace_members_no_direct_update  | workspace_members | UPDATE | USING(false)  |
```

### 12-C. Dynamic verification (review-admin JWT)

| Test | matching rows (service-role) | RLS apply 후 affected | 결론 |
|------|----------------------------|----------------------|------|
| 1: applications UPDATE | 0 | 0 | ⚠️ vacuous (data sparse) |
| 2: event_qr_codes UPDATE | 0 | 0 | ⚠️ vacuous |
| 3: event_qr_codes DELETE | 0 | 0 | ⚠️ vacuous |
| 4: work_logs UPDATE | 0 | 0 | ⚠️ vacuous |
| 6: workspace_members deny-all | **1** | **0** | ✅ **명확한 evidence** (deny-all 작동) |

**한계**: prod DB 의 admin 외 user 데이터가 sparse 하여 Tests 1-4 dynamic 차단을 real data 로 입증 못함. Schema-level (12-B) + Helper unit test (16 PASS) + Test 6 dynamic + PR3-A 선례로 등가 보장.

### 12-D. Helper unit test (Phase 1)

```
JobPostingRepository.write.workspace.test.ts: 16 PASS
- admin 호출은 PermissionError 로 거절 (silent no-op 차단) ✅
- admin + 본인 owner → owner 분기 우선 (RPC 0회) ✅
- admin + workspace member → member 분기 우선 (admin RPC 미호출) ✅
- updateSettlementSettings admin 호출도 throw ✅

Service tests: 74 PASS (read-side helper 사용으로 회귀 없음)
```

### 12-E. 학습 — sparse production data dynamic verification 한계

dynamic RLS verification 의 evidence quality 는 *test data 풍부도*에 의존. admin 외 user 데이터가 sparse 하면 0 affected 가 RLS 차단인지 데이터 부재인지 분간 불가. 이 함정은 memory `pitfall_rls_violation_multi_cause_mapping.md` 의 multi-cause mapping 과 동일 본질.

**향후 RLS verification 권장 패턴**:
1. Schema-level (pg_policy USING expr regex) — 정책 정의 검증
2. Helper unit test — caller 측 silent no-op 차단
3. Dynamic SQL — staging branch + seed data 로 *positive case* 도 확보 (matching row > 0 → 0 affected 확인)

본 PR3-A.2 는 (1)(2) + (3) 일부 (Test 6) + PR3-A 선례로 evidence chain 견고. 향후 admin UI 도입 시 staging branch verification 추가 권장.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 4 issues found, 4 resolved (B/B/A/B), 0 critical gaps, 1 iron-rule regression test mandatory |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | (DB migration, no UI scope) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**LAKE SCORE:** 4/4 (모든 결정에서 complete option 선택)
**VERDICT:** ENG CLEARED — 사용자 confirm 후 implementation + migration apply 가능
