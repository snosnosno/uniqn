# Task 5 — RLS jp_select 분리 + list_managed_postings SECURITY DEFINER RPC

> **상태:** Spec only — eng-review + 사용자 confirm 후 production migration. **본 PR 은 spec 만, migration apply 안 함.**
>
> **진입 조건 (사용자 plan 인용):** "Phase 1+2 머지 후, eng-review 통과한 spec." 즉 PR #71 (✅ merged), PR #72 (대기), PR #73 (대기) 머지 완료 후.
>
> **위험도:** 🔴 HIGH — production DB RLS 정책 변경. 모든 employer my-postings + admin global view 영향. rollback 가능하나 복구 도중 누출 가능.

## 1. 문제 (RC0 진앙)

### 현재 jp_select 정책

```sql
-- production DB 2026-05-10
CREATE POLICY jp_select ON public.job_postings FOR SELECT USING (
  status IN ('approved', 'active', 'closed')        -- 분기 1: public read (staff search)
  OR owner_id = (SELECT auth.uid())                 -- 분기 2: owner self
  OR is_workspace_member(workspace_id, auth.uid())  -- 분기 3: workspace member
  OR is_admin()                                      -- 분기 4: admin global
);
```

### RC0 — 두 분기가 누출 진앙

1. **분기 1 (public read)** — staff search 의도. 그러나 employer my-postings 흐름에서도 평가됨 → 다른 employer 의 active 공고와 섞여 보임. PR #71 가 클라이언트 `workspace_id` 필터로 우회했으나 **보안 경계가 아닌 UX 필터에 의존** 하는 상태.

2. **분기 4 (admin global)** — admin 이 RLS 만으로 모든 employer 의 모든 공고 SELECT 가능. PR #70 가 `list_my_workspaces` 에서만 admin 누출을 막았으나 **`getManagedJobPostings` 는 여전히 RLS 단독 의존** → admin my-postings 에 다른 owner 공고 노출.

## 2. 설계 옵션

### 옵션 A (탈락) — View 분리

```sql
CREATE VIEW job_postings_search AS  -- public read
SELECT ... FROM job_postings WHERE status IN (...);

CREATE VIEW job_postings_managed AS  -- owner|member|admin
SELECT ... FROM job_postings WHERE owner_id = auth.uid() OR ...;
```

**거절 사유:** view 별로 RLS 평가가 정확히 어떻게 cascade 되는지 PostgreSQL 문서가 모호. 두 view 의 join 시 RLS 적용 순서 예측 어려움. 또한 client repository 가 두 view 사이 분기 결정 코드 추가 필요.

### 옵션 B (선택) — SECURITY DEFINER RPC + 정책 분리

PR #69 (`create_workspace`) / PR #70 (`list_my_workspaces`) 의 검증된 패턴 복제.

**B-1. `jp_select` 정책 분리:**
```sql
-- 기존 정책 DROP
DROP POLICY jp_select ON public.job_postings;

-- 새 정책 1: public search-only (status whitelist)
CREATE POLICY jp_select_public_search ON public.job_postings FOR SELECT
USING (status IN ('approved', 'active', 'closed'));

-- 새 정책 2: owner / member managed access
CREATE POLICY jp_select_managed ON public.job_postings FOR SELECT
USING (
  owner_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
);

-- ❌ admin global 분기 제거 — RPC 로 이전
```

PostgreSQL RLS 는 OR 조합. 2 정책이 OR 평가되어 (public OR managed) → 행이 SELECT 됨. **변화점:** admin 이 더 이상 RLS 만으로 다른 owner 공고를 SELECT 못함. admin 전용 RPC 호출해야 함.

**B-2. admin global view 용 RPC 신규:**
```sql
CREATE OR REPLACE FUNCTION public.list_all_managed_postings(
  p_status posting_status DEFAULT NULL
)
RETURNS SETOF public.job_postings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN; END IF;

  -- DB-of-record (public.users.role) 조회 — JWT staleness 우회
  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT * FROM public.job_postings
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_managed_postings(posting_status) TO authenticated;
```

**B-3. 사용처:**
- 일반 employer my-postings: 기존 `getManagedJobPostings(workspaceId)` 그대로 → RLS jp_select_managed 통과 (owner|member). admin 이어도 본인 owner/member 공고만.
- admin 전용 페이지 (있다면): `list_all_managed_postings()` RPC 호출. 명시적 admin 모드.

## 3. Migration SQL (실행 안 함, spec)

```sql
-- migration: 2026_05_10_jp_select_split.sql

BEGIN;

-- 1) 기존 jp_select 정책 백업 (rollback 용 SQL 주석으로 보존)
-- DROP POLICY jp_select ON public.job_postings;
--   원본: status IN (...) OR owner_id = uid OR is_workspace_member(...) OR is_admin()

DROP POLICY IF EXISTS jp_select ON public.job_postings;

-- 2) 새 정책 — public search-only
CREATE POLICY jp_select_public_search ON public.job_postings FOR SELECT
USING (status IN ('approved', 'active', 'closed'));

-- 3) 새 정책 — owner / member managed
CREATE POLICY jp_select_managed ON public.job_postings FOR SELECT
USING (
  owner_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
);

-- 4) 신규 RPC — admin global access
CREATE OR REPLACE FUNCTION public.list_all_managed_postings(
  p_status public.posting_status DEFAULT NULL
)
RETURNS SETOF public.job_postings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  SELECT *
  FROM public.job_postings
  WHERE p_status IS NULL OR status = p_status
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_managed_postings(public.posting_status) TO authenticated;

COMMIT;
```

### Rollback SQL

```sql
BEGIN;

DROP POLICY IF EXISTS jp_select_public_search ON public.job_postings;
DROP POLICY IF EXISTS jp_select_managed ON public.job_postings;

CREATE POLICY jp_select ON public.job_postings FOR SELECT USING (
  status IN ('approved', 'active', 'closed')
  OR owner_id = (SELECT auth.uid())
  OR is_workspace_member(workspace_id, (SELECT auth.uid()))
  OR is_admin()
);

DROP FUNCTION IF EXISTS public.list_all_managed_postings(public.posting_status);

COMMIT;
```

## 4. Client 영향

### 4-A. 영향 없음 (대부분)

기존 `getManagedJobPostings(status, workspaceId)` 흐름:
- owner: jp_select_managed 의 `owner_id = uid` 분기 → SELECT 성공
- member: jp_select_managed 의 `is_workspace_member` 분기 → SELECT 성공
- staff search: jp_select_public_search → 변화 없음

### 4-B. admin global view (신규 분기)

**전제:** 현재 코드에 명시적 admin global view 화면이 있는지 grep:

```bash
grep -rln "admin.*managed.*posting\|all.*posting" uniqn-mobile/src/app/(admin)
```

없으면 별도 코드 추가 불필요. 있으면 해당 호출이 `list_all_managed_postings()` RPC 로 이전.

### 4-C. PR #71 클라이언트 필터 — 영구 보존

PR #71 의 `getManagedJobPostings(workspaceId)` + `useMyJobPostings` activeWorkspace 의존은 **본 migration 후에도 유지**. 비즈니스 요구사항(워크스페이스별 분리) 이지 보안 경계가 아니므로.

차이점은 **보안 경계가 RLS 로 이전** 된다는 것. 클라이언트 필터에 버그가 있어도 RLS 가 누출 차단.

## 5. Eng-review checklist

- [ ] **PostgreSQL RLS OR 조합 의미** — 2 SELECT 정책이 OR 평가됨을 공식 문서로 확인
- [ ] **`is_workspace_member` 의 cycle 가드** — 본 RPC 가 plpgsql SECURITY DEFINER 라 SELECT FROM workspaces 재귀 가드 통과 (PR #67 핫픽스 패턴)
- [ ] **admin 누출 정량 검증** — review-admin 으로 `getManagedJobPostings()` 호출 시 다른 owner 공고 노출 0건 확인
- [ ] **dual-role 확인** — admin + 워크스페이스 owner/member 인 사용자 (review-admin 같은) 가 정상 SELECT 가능
- [ ] **ghost cache 회귀 가드** — workspaceId 미전달 시 (default 0개 row) 빈 상태 메시지 정상
- [ ] **ALL 명령** — `jp_update_workspace_member`, `jp_delete_workspace_owner`, `jp_insert` 정책 모두 변화 없음 — 단지 SELECT 만 분리
- [ ] **`list_all_managed_postings` RPC 호출자 식별** — admin 전용 페이지 존재 여부 + 호출 패턴 grep
- [ ] **rollback SQL 검증** — staging 또는 branch DB 에 migration → rollback 왕복 1회 무결성 확인
- [ ] **PostgREST schema reload** — RPC 등록 후 PostgREST 캐시 invalidate (Supabase 자동)

## 6. 사용자 dogfooding 시나리오 (apply 후)

| 시나리오 | Before | After |
|----------|--------|-------|
| review-employer A — own active 공고 SELECT | OK | OK |
| review-employer B — review-employer A 의 공고 SELECT (staff search 흐름) | OK | OK (jp_select_public_search) |
| **review-admin — getManagedJobPostings()** | review-employer 공고 노출 (잘못) | 본인 공고만 ✅ |
| **review-admin — list_all_managed_postings()** | (없음) | 모든 employer 공고 ✅ |
| 워크스페이스 멤버 (editor) — 본인이 멤버인 공고 SELECT | OK | OK |
| 외부인 — owner 의 draft (status='pending') SELECT | reject | reject |

## 7. 다른 4 테이블 (PR3-A 와 동시 진행 권장)

본 jp_select 분리 패턴은 그대로 다른 4 테이블에 복제 가능:
- `applications.app_select` 의 `(get_my_role() = 'admin')` 분기 제거 → admin RPC
- `event_qr_codes.qr_select` 의 `(get_my_role() = 'admin')` 분기 제거 → admin RPC
- `work_logs.wl_select` 의 `(get_my_role() = 'admin')` 분기 제거 → admin RPC
- `workspace_members.workspace_members_select_self_or_workspace` 의 `is_admin()` 분기 — 검토 필요

→ **단일 migration** 에 5 정책 분리 + 4 admin RPC 신규로 묶을지, 5 개별 PR 로 쪼갤지는 eng-review 결정 사항.

## 8. 단일 PR vs 5 PR 트레이드오프

**단일 PR (atomic)**
- ✅ atomic — admin global 누출이 5 영역 전부에서 한 번에 닫힘
- ❌ revert 시 5 영역 전부 영향
- ❌ review 부담 큼

**5 PR (개별)**
- ✅ 각 영역 독립 revert 가능
- ✅ review 작은 단위
- ❌ atomicity 깨짐 — 4 영역 만 닫히면 1 영역 누출 지속
- ❌ migration 5 회 → PostgREST schema reload 5 회

**권장:** **2 PR 분리** — (1) jp_select 분리 + RPC (본 spec); (2) 4 테이블 admin 분리 + 4 RPC. 본 spec 이 (1) 의 spec.

## 9. Migration 실행 직전 체크리스트

- [ ] PR #72 머지
- [ ] PR #73 머지 (write-side 도 admin 분기 통합 — 본 PR 후속)
- [ ] eng-review 통과 — 위 7개 checklist 항목 검증
- [ ] 사용자 명시적 confirm — production DB migration apply
- [ ] migration 실행 후 즉시 dogfooding 시나리오 6개 검증
- [ ] 회귀 발견 시 rollback SQL 즉시 실행 + 사용자 알림

## 10. 본 PR 산출물

- 본 spec 문서 (코드 변경 0)
- migration SQL + rollback SQL (실행 안 함)
- eng-review checklist 9 항목
- dogfooding 시나리오 6 케이스

## 11. 다음 액션

1. **PR #72, #73 머지 대기** (사용자)
2. **eng-review** — 본 spec 의 checklist 9 항목 통과 확인
3. **사용자 명시적 confirm** — "PR4 migration apply 진행" 명시
4. **migration apply** — `supabase__apply_migration` MCP 실행 (Claude 가 사용자 confirm 후)
5. **즉시 dogfooding** — 6 시나리오 검증
6. **회귀 시 rollback** — 위 SQL 즉시 실행
