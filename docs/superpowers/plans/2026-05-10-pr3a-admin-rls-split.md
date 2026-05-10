# PR3-A — 4 테이블 admin global RLS 분리 + per-table SECURITY DEFINER RPC

> **상태:** Spec only — eng-review + 사용자 confirm 후 production migration. **본 PR 은 spec 만, migration apply 안 함.**
>
> **진입 조건:** PR #75 (✅ jp_select 분리 spec, prod migration 적용됨) 와 동일 패턴 복제. PR #76/#77/#79 (read-side hooks workspace 분리) 머지 후 진행 권장.
>
> **위험도:** 🔴 HIGH — production DB RLS 정책 4개 변경 + 신규 RPC 4개. admin global RLS 누출 4 영역에서 동시 차단. rollback 가능.
>
> **종속:** PR #75 (`list_all_managed_postings` 패턴) 가 prod 에 적용되어 검증된 상태이므로 본 PR 은 동일 패턴 복제. 단일 atomic migration.

## 1. 문제 (RC0 진앙)

### 4 테이블의 SELECT 정책에 admin global 분기

PR #74 audit ADR §3 에서 식별. PR #75 가 `job_postings` 만 우선 처리 → 4 테이블에 admin global 분기가 RLS 만으로 모든 row SELECT 허용 상태 유지.

```sql
-- production DB 2026-05-10 (PR #75 적용 후 상태)
applications.app_select USING (
  applicant_id = auth.uid()
  OR job_posting_id IN (SELECT id FROM job_postings WHERE owner_id = auth.uid()
                                                       OR is_workspace_member(workspace_id, auth.uid()))
  OR get_my_role() = 'admin'                  -- ❌ 누출 분기
);

event_qr_codes.qr_select USING (
  user_id = auth.uid()
  OR job_posting_id IN (SELECT id FROM job_postings WHERE owner_id = auth.uid()
                                                       OR is_workspace_member(workspace_id, auth.uid()))
  OR get_my_role() = 'admin'                  -- ❌ 누출 분기
);

work_logs.wl_select USING (
  staff_id = auth.uid()
  OR owner_id = auth.uid()
  OR job_posting_id IN (SELECT id FROM job_postings WHERE is_workspace_member(workspace_id, auth.uid()))
  OR get_my_role() = 'admin'                  -- ❌ 누출 분기
);

workspace_members.workspace_members_select_self_or_workspace USING (
  user_id = auth.uid()
  OR is_workspace_member(workspace_id, auth.uid())
  OR is_admin()                                -- ❌ 누출 분기 (is_admin() 형태)
);
```

### RC0 — admin 이 RLS 만으로 모든 row 읽기 가능

`get_my_role() = 'admin'` / `is_admin()` 분기는 admin role 사용자에게 무조건 SELECT 허용 → admin 이 *어떤* employer 의 *어떤* applications / event_qr_codes / work_logs / workspace_members 도 읽을 수 있음.

PR #75 가 `job_postings.jp_select` 에서 같은 분기를 제거했으므로, 4 테이블도 동일한 보안 경계로 통일 필요. 일관성 확보 + admin 누출 4 영역 동시 차단.

## 2. 설계 — 옵션 B (PR #75 패턴 복제)

PR #75 이 검증한 패턴 그대로 복제:

1. **SELECT 정책에서 admin 분기 제거** — 일반 사용자 흐름 (owner / member / self) 만 RLS 통과.
2. **per-table `list_all_<table>` SECURITY DEFINER RPC 신규** — admin 전용 global access. role 검증을 RPC 내부에서 `public.users.role` 조회로 수행 (JWT staleness 우회 — PR #75 와 동일).

### 2-A. 정책 분리 (4 테이블)

```sql
-- 1) applications
DROP POLICY app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  -- admin 분기 제거 → list_all_applications() RPC 로 이전
);

-- 2) event_qr_codes
DROP POLICY qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  -- admin 분기 제거
);

-- 3) work_logs
DROP POLICY wl_select ON public.work_logs;
CREATE POLICY wl_select ON public.work_logs FOR SELECT USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  -- admin 분기 제거
);

-- 4) workspace_members
DROP POLICY workspace_members_select_self_or_workspace ON public.workspace_members;
CREATE POLICY workspace_members_select_self_or_workspace ON public.workspace_members FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  -- admin 분기 제거
);
```

### 2-B. SECURITY DEFINER RPC (4개 신규)

각 RPC 는 PR #75 의 `list_all_managed_postings` 와 동일한 안전 패턴:
- `SECURITY DEFINER` + `STABLE` + `SET search_path TO 'public', 'pg_temp'`
- `auth.uid()` 검증
- DB-of-record (`public.users.role`) 조회 — JWT staleness 우회
- non-admin 호출 시 `RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001'`
- `GRANT EXECUTE ... TO authenticated`

```sql
-- list_all_applications(p_status?)
CREATE OR REPLACE FUNCTION public.list_all_applications(
  p_status public.application_status DEFAULT NULL
)
RETURNS SETOF public.applications
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.applications
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_applications(public.application_status) TO authenticated;

-- list_all_event_qr_codes(p_active?)
CREATE OR REPLACE FUNCTION public.list_all_event_qr_codes(
  p_active boolean DEFAULT NULL
)
RETURNS SETOF public.event_qr_codes
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.event_qr_codes
  WHERE p_active IS NULL OR is_active = p_active
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_event_qr_codes(boolean) TO authenticated;

-- list_all_work_logs(p_status?, p_date_from?, p_date_to?)
CREATE OR REPLACE FUNCTION public.list_all_work_logs(
  p_status public.work_log_status DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS SETOF public.work_logs
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.work_logs
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_date_from IS NULL OR date >= p_date_from)
    AND (p_date_to IS NULL OR date <= p_date_to)
  ORDER BY date DESC, created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_work_logs(public.work_log_status, date, date) TO authenticated;

-- list_all_workspace_members(p_workspace_id?)
CREATE OR REPLACE FUNCTION public.list_all_workspace_members(
  p_workspace_id uuid DEFAULT NULL
)
RETURNS SETOF public.workspace_members
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.workspace_members
  WHERE p_workspace_id IS NULL OR workspace_id = p_workspace_id
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_workspace_members(uuid) TO authenticated;
```

### 2-C. UPDATE / DELETE 정책 — 본 PR 범위 외

`applications.app_update`, `event_qr_codes.qr_update/qr_delete`, `work_logs.wl_update` 도 admin 분기 보유. 그러나 **본 PR 은 SELECT 만 처리** (audit ADR §5.PR3-A 명시):
- 누출 위험은 SELECT 가 1차. UPDATE/DELETE 는 admin 이 row id 를 알아야 가능 (간접 공격 경로).
- UPDATE/DELETE admin 분리는 follow-up PR (PR3-A.2) 으로 분리 — RPC 시그니처 + 트랜잭션 보호 등 추가 설계 필요.

## 3. Migration SQL

### 적용 SQL (전체 — atomic)

```sql
-- migration: 2026_05_10_pr3a_admin_rls_split.sql

BEGIN;

-- ============================================================
-- 1) applications.app_select — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS app_select ON public.applications;

CREATE POLICY app_select ON public.applications FOR SELECT USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 2) event_qr_codes.qr_select — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;

CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 3) work_logs.wl_select — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS wl_select ON public.work_logs;

CREATE POLICY wl_select ON public.work_logs FOR SELECT USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
);

-- ============================================================
-- 4) workspace_members.workspace_members_select_self_or_workspace — admin 분기 제거
-- ============================================================
DROP POLICY IF EXISTS workspace_members_select_self_or_workspace ON public.workspace_members;

CREATE POLICY workspace_members_select_self_or_workspace ON public.workspace_members FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
);

-- ============================================================
-- 5) admin SECURITY DEFINER RPC 4개 신규
-- ============================================================

-- 5-1) list_all_applications
CREATE OR REPLACE FUNCTION public.list_all_applications(
  p_status public.application_status DEFAULT NULL
)
RETURNS SETOF public.applications
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.applications
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_applications(public.application_status) TO authenticated;

-- 5-2) list_all_event_qr_codes
CREATE OR REPLACE FUNCTION public.list_all_event_qr_codes(
  p_active boolean DEFAULT NULL
)
RETURNS SETOF public.event_qr_codes
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.event_qr_codes
  WHERE p_active IS NULL OR is_active = p_active
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_event_qr_codes(boolean) TO authenticated;

-- 5-3) list_all_work_logs
CREATE OR REPLACE FUNCTION public.list_all_work_logs(
  p_status public.work_log_status DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS SETOF public.work_logs
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.work_logs
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_date_from IS NULL OR date >= p_date_from)
    AND (p_date_to IS NULL OR date <= p_date_to)
  ORDER BY date DESC, created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_work_logs(public.work_log_status, date, date) TO authenticated;

-- 5-4) list_all_workspace_members
CREATE OR REPLACE FUNCTION public.list_all_workspace_members(
  p_workspace_id uuid DEFAULT NULL
)
RETURNS SETOF public.workspace_members
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.workspace_members
  WHERE p_workspace_id IS NULL OR workspace_id = p_workspace_id
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_workspace_members(uuid) TO authenticated;

-- PostgREST schema cache 강제 reload — 4 RPC 즉시 callable 보장
NOTIFY pgrst, 'reload schema';

COMMIT;
```

### Rollback SQL (회귀 발견 시 즉시 실행)

```sql
BEGIN;

-- 1) applications.app_select — admin 분기 복원
DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT USING (
  applicant_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 2) event_qr_codes.qr_select — admin 분기 복원
DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE owner_id = (SELECT auth.uid())
       OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 3) work_logs.wl_select — admin 분기 복원
DROP POLICY IF EXISTS wl_select ON public.work_logs;
CREATE POLICY wl_select ON public.work_logs FOR SELECT USING (
  staff_id = (SELECT auth.uid())
  OR owner_id = (SELECT auth.uid())
  OR job_posting_id IN (
    SELECT id FROM public.job_postings
    WHERE is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  OR (SELECT get_my_role()) = 'admin'
);

-- 4) workspace_members.workspace_members_select_self_or_workspace — admin 분기 복원
DROP POLICY IF EXISTS workspace_members_select_self_or_workspace ON public.workspace_members;
CREATE POLICY workspace_members_select_self_or_workspace ON public.workspace_members FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  OR (SELECT is_admin())
);

-- 5) admin RPC 4개 DROP
DROP FUNCTION IF EXISTS public.list_all_applications(public.application_status);
DROP FUNCTION IF EXISTS public.list_all_event_qr_codes(boolean);
DROP FUNCTION IF EXISTS public.list_all_work_logs(public.work_log_status, date, date);
DROP FUNCTION IF EXISTS public.list_all_workspace_members(uuid);

-- PostgREST schema cache 강제 reload — RPC drop 즉시 반영
NOTIFY pgrst, 'reload schema';

COMMIT;
```

## 4. Client 영향

### 4-A. 영향 없음 (대부분 흐름)

기존 employer / staff 흐름:
- staff 본인 applications/work_logs/event_qr_codes — `*_id = auth.uid()` 분기 통과
- employer owner — `job_postings.owner_id = auth.uid()` 분기 통과
- workspace member (editor) — `is_workspace_member(...)` 분기 통과
- workspace_members 본인 멤버십 — `user_id = auth.uid()` / `is_workspace_member` 분기 통과

### 4-B. admin 흐름 변화

현재 코드에 admin 전용 page/repository call site **부재** (grep 결과: `is_admin` RPC 호출만 있고 직접 admin SELECT 없음). 따라서 본 migration 적용 시:
- 즉각적 코드 변경 불필요.
- 향후 admin 전용 페이지 도입 시 `list_all_<table>()` RPC 호출 패턴.

### 4-C. PR #76 / #77 / #79 (read-side hooks workspace 분리) 와의 관계

PR #76 의 `loadAndVerifyJobPostingAccess` 헬퍼는 owner|member|admin 호환을 *서비스 레이어*에서 처리. RLS 가 admin 분기 갖던 시기엔 admin 이 추가로 RLS 통과해서 서비스 레이어 관문이 RPC `is_admin` 결과로 결정. PR3-A 후엔:
- 일반 employer 흐름 (PR #76 적용 후): owner/member 가 RLS 통과 + 서비스 헬퍼 통과. 변화 없음.
- admin 흐름: RLS 통과 못함 → `loadAndVerifyJobPostingAccess` 가 `is_admin()` 분기로 통과 처리하지만 후속 SELECT 가 RLS 차단. **이 경우 `loadAndVerifyJobPostingAccess` 의 admin 분기 동작 검증 필요**.

→ eng-review 항목 추가.

## 5. Eng-review checklist

- [ ] **PostgreSQL RLS OR 조합 의미** — drop 후 새 정책 단일 SELECT 정책으로 평가 — PR #75 와 동일 패턴
- [ ] **`is_workspace_member` cycle 가드** — 4 새 정책 모두 plpgsql STABLE 함수 호출 → 재귀 가드 유효 (PR #67 핫픽스 패턴)
- [ ] **admin 누출 정량 검증** — review-admin 으로 4 테이블 직접 SELECT 시 본인/멤버십 row 만 노출 (모든 row 노출 차단)
- [ ] **`list_all_<table>` RPC 호출 권한** — RAISE EXCEPTION 'PERMISSION_DENIED' 가 non-admin 호출자에게 정상 발생
- [ ] **dual-role 확인** — admin + 워크스페이스 owner/member 인 사용자 가 RLS 일반 분기 (`*_id = auth.uid()`, `is_workspace_member`) 로 본인 row 정상 SELECT
- [ ] **PR #76 헬퍼 admin 분기 동작** — `loadAndVerifyJobPostingAccess` 의 `is_admin` RPC 결과 true 일 때 후속 SELECT 가 RLS 차단으로 **silent empty result** 반환 (RLS SELECT 는 row 필터링이라 exception 미발생). 현재 admin call site 부재로 즉시 영향 없음. 향후 admin 페이지 도입 시 `list_all_<table>` RPC 사용 강제 (admin RPC 사용 권장)
- [ ] **UPDATE/DELETE admin 분기 잔존** — 본 PR 범위 외임을 spec 에 명시. 후속 PR3-A.2 로 분리.
- [ ] **rollback SQL 검증** — staging branch DB 에 migration → rollback 왕복 1회 — pg_policies 스냅샷 비교
- [ ] **PostgREST schema reload** — migration block 마지막에 `NOTIFY pgrst, 'reload schema'` 명시 발행 (Supabase 자동 invalidate ~10초 도 백업으로 작동). apply 직후 4 RPC 호출 1회로 callable 확인

## 6. 사용자 dogfooding 시나리오 (apply 후)

### 6-A. 시나리오 표

| 시나리오 | Before | After |
|----------|--------|-------|
| review-admin → 본인 applications SELECT | OK | OK (applicant_id 분기) |
| **review-admin → 다른 user 의 applications SELECT** | 노출 (잘못) | 차단 ✅ |
| review-admin → `list_all_applications()` RPC | (없음) | 모든 applications 노출 ✅ |
| 외부인 → `list_all_applications()` RPC | (없음) | `PERMISSION_DENIED` ✅ |
| review-employer → 본인 job_posting 의 applications | OK | OK (job_posting subquery) |
| **review-admin → workspace_members 전체** | 노출 (잘못) | 본인 + 멤버 워크스페이스만 ✅ |
| review-admin → `list_all_workspace_members()` RPC | (없음) | 모든 멤버 노출 ✅ |
| review-admin → 다른 user 의 work_logs SELECT | 노출 (잘못) | 차단 ✅ |
| review-admin → `list_all_work_logs(p_status='completed')` | (없음) | filter 적용된 모든 work_logs ✅ |
| **dual-role: admin + 워크스페이스 W1 owner → W1 의 applications SELECT** | OK (admin 분기) | OK (`is_workspace_member` 분기로 통과) ✅ |
| **dual-role: admin + 워크스페이스 W1 member → W1 의 work_logs SELECT** | OK (admin 분기) | OK (`is_workspace_member` 분기로 통과) ✅ |

### 6-B. 정량 측정 절차 (apply 직전·직후 1회씩 실행)

각 row 의 Before / After count 를 SQL 측정해 evidence 로 PR comment 에 첨부. count diff 가 기대값과 일치하지 않으면 즉시 rollback.

| # | 측정 SQL | Before 기대 | After 기대 |
|---|---------|------------|------------|
| 1 | `SELECT count(*) FROM applications WHERE applicant_id <> '<review-admin-uid>' AND job_posting_id NOT IN (SELECT id FROM job_postings WHERE owner_id = '<review-admin-uid>' OR is_workspace_member(workspace_id, '<review-admin-uid>'));` (review-admin JWT) | > 0 (admin 누출) | **0** (차단) |
| 2 | `SELECT count(*) FROM event_qr_codes WHERE user_id <> '<review-admin-uid>' AND job_posting_id NOT IN (...같은 서브쿼리);` | > 0 | **0** |
| 3 | `SELECT count(*) FROM work_logs WHERE staff_id <> '<review-admin-uid>' AND owner_id <> '<review-admin-uid>' AND job_posting_id NOT IN (SELECT id FROM job_postings WHERE is_workspace_member(workspace_id, '<review-admin-uid>'));` | > 0 | **0** |
| 4 | `SELECT count(*) FROM workspace_members WHERE user_id <> '<review-admin-uid>' AND NOT is_workspace_member(workspace_id, '<review-admin-uid>');` | > 0 | **0** |
| 5 | `SELECT count(*) FROM list_all_applications();` (review-admin JWT) | (없음) | DB 의 전체 applications count 와 일치 |
| 6 | `SELECT count(*) FROM list_all_applications();` (review-employer JWT — non-admin) | (없음) | `PERMISSION_DENIED` exception |

측정 시 JWT 세팅:
```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<uid>","role":"authenticated"}'::jsonb;
```
또는 Supabase Studio SQL Editor 의 "Run as user" 기능 사용.

## 7. PR3-A vs PR #75 차이점

| 항목 | PR #75 | PR3-A |
|------|--------|-------|
| 테이블 | 1 (job_postings) | 4 (applications, event_qr_codes, work_logs, workspace_members) |
| 정책 분리 | 2 정책 (jp_select_public_search + jp_select_managed) | 4 정책 단일 RLS (admin 분기만 제거) |
| RPC 신규 | 1 (list_all_managed_postings) | 4 (list_all_<table>) |
| Client side | `getManagedJobPostings` 변경 없음 | 변경 없음 (admin call site 부재) |
| atomic | 단일 migration | 단일 migration (4 테이블 일관) |

PR3-A 가 더 단순한 이유: 기존 정책에 admin 분기만 OR 로 추가된 형태라 `DROP + CREATE` 로 분기만 제거. PR #75 는 public search-only 와 managed 의 *시맨틱 분리*가 추가로 필요했음.

## 8. Migration 실행 직전 체크리스트

- [ ] PR #76 머지 (P0 hotfix)
- [ ] PR #77 머지 (PR3-C settlement workspace)
- [ ] PR #79 머지 (PR3-B monthly payroll workspace)
- [ ] PR #78 머지 (PR3-D schedule staff-only verify)
- [ ] eng-review 통과 — 위 9개 checklist 항목 검증
- [ ] 사용자 명시적 confirm — production DB migration apply
- [ ] migration 실행 직후 dogfooding 시나리오 9개 검증 (review-admin 계정 필요)
- [ ] 회귀 발견 시 rollback SQL 즉시 실행 + 사용자 알림

## 9. 본 PR 산출물

- 본 spec 문서 (코드 변경 0)
- migration SQL + rollback SQL (실행 안 함)
- eng-review checklist 9 항목
- dogfooding 시나리오 9 케이스
- PR3-A.2 (UPDATE/DELETE admin 분기) 후속 작업 명시

## 10. 다음 액션

1. **PR #76, #77, #78, #79 머지 대기** (사용자 / dogfooding 후)
2. **eng-review** — 본 spec 의 checklist 9 항목 통과 확인
3. **사용자 명시적 confirm** — "PR3-A migration apply 진행" 명시
4. **migration apply** — `mcp__supabase__apply_migration` 실행 (Claude 가 사용자 confirm 후, name: `pr3a_admin_rls_split`)
5. **즉시 dogfooding** — 9 시나리오 검증 (review-admin 계정)
6. **회귀 시 rollback** — 위 SQL 즉시 실행
7. **PR3-A.2 후속 spec** — UPDATE/DELETE admin 분기 처리 (별도 세션)
