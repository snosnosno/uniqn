# ops 1e 스태프 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uniqn 공고 확정 스태프를 ops 대회 로스터(`ops_staff`)로 스냅샷 import하고, 딜러를 테이블에 배정한다(공고연결 N:1 + STAFF 탭 + TABLES 딜러 지정).

**Architecture:** 스펙 `uniqn-mobile/docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md`(이하 "스펙")를 그대로 구현. DB = 신규 마이그 3종(M1 테이블/enum/RLS → M2 SECDEF RPC 5종 → M3 grants/realtime) + pgTAP. 클라 = Presentation→Hooks→Service→Repository 계층 신설(OpsStaff*) + STAFF 탭 + TABLES 확장 + 진입점 3곳.

**Tech Stack:** Supabase(plpgsql SECDEF·RLS·pgTAP), Expo/RN(TS strict, NativeWind, TanStack Query, expo-router), jest.

## Global Constraints (전 태스크 공통 — 위반 시 리뷰 반려)

- **한글**: 응답·커밋 메시지·주석 전부 한글. 커밋 포맷 `<type>(<scope>): <한글>`.
- **작업 디렉토리**: `uniqn-mobile/`. 경로는 `@/` 절대 경로.
- **브랜치 생성/전환 금지 · `mcp__supabase__*` 등 MCP 도구 직접 호출 금지(로컬 docker/npm만) · 기존 마이그레이션 파일 수정 금지(신규 3종만 생성) · prod 접근 금지.**
- 구현 브랜치는 최신 origin/master(`8e2293aad` 이상) 기반. 워크트리에서 npm 명령 전 node_modules 정션 필요: PowerShell `New-Item -ItemType Junction -Path uniqn-mobile\node_modules -Target <메인레포>\uniqn-mobile\node_modules` (mklink는 MSYS 경로변환 실패).
- DB 로컬 검증: `npm run db:reset && npm run test:db:helpers && npx supabase test db` (reset이 ops_helpers를 지우므로 test:db:helpers 재적재 필수). docker psql 직접 실행 시 `MSYS_NO_PATHCONV=1`.
- RPC 규약: SECDEF + `SET search_path = 'public','extensions','pg_temp'` + actor 바인딩 + P0001 `'CODE: 한글메시지'` + ops_events 감사 + anon REVOKE. **anon-executable SECDEF은 monitor/player 2개 불변.**
- 클라 규약: `logger`(console.log 금지) · `dark:` 항상 · `toast`/`Alert.alert` · camelCase · 파일 800줄 이하 · 불변성(스프레드) · 읽기=Repository 직접(TanStack Query) / 쓰기=Service 경유.
- jest 함정: `restoreMocks:true` — 모듈 스코프 spyOn은 beforeEach에서 재설치.
- supabase.ts 타입은 수술적 추가만(전체 재생성 금지).
- 각 태스크 완료 주장 전 해당 태스크의 검증 명령 실행 증거 필수.

---

### Task 1: M1 마이그 — ops_staff 테이블·enum 확장·RLS (+pgTAP 스키마/RLS)

**Files:**

- Create: `uniqn-mobile/supabase/migrations/20260707100000_ops_1e_staff_table_and_enum.sql`
- Create: `uniqn-mobile/supabase/tests/ops_staff_schema.test.sql`

**Interfaces:**

- Produces: `public.ops_staff` 테이블(스펙 §1.2 DDL 그대로), `ops_event_type` 신규 7값, `uq_ops_tables_assigned_staff` partial UNIQUE. 이후 전 태스크가 의존.

- [ ] **Step 1: pgTAP 테스트 작성 (RED 먼저)**

기존 ops pgTAP 파일(`supabase/tests/ops_*.test.sql`)의 시드·롤 전환 헬퍼 관례를 그대로 따른다(멱등 시드, `tests.*`/ops_helpers 헬퍼, 무위 시드 금지 — 단언 전 매칭 행 수 사전 검증). 검증 항목:

```sql
-- ops_staff_schema.test.sql 핵심 단언 (plan(N) 및 시드는 기존 관례대로)
SELECT has_table('public','ops_staff','ops_staff 존재');
SELECT col_is_pk('public','ops_staff','id','PK=id');
SELECT col_not_null('public','ops_staff','staff_name','이름 스냅샷 NOT NULL');
SELECT col_type_is('public','ops_staff','role','staff_role','role은 staff_role enum');
-- UNIQUE(tournament_id, staff_id)
SELECT has_index('public','ops_staff','ops_staff_tournament_id_staff_id_key');
-- ops_tables 백스톱 partial UNIQUE
SELECT has_index('public','ops_tables','uq_ops_tables_assigned_staff');
-- enum 7값 추가 확인
SELECT enum_has_labels('public','ops_event_type', ARRAY[/* 기존 값 전부 + */ 'posting_linked','posting_unlinked','staff_imported','staff_added','staff_removed','table_staff_assigned','table_staff_unassigned']);
-- RLS: FORCE + SELECT 정책 1종 + DML REVOKE
--  (a) owner 롤로 SELECT 가시(시드: owner의 대회 + ops_staff 1행 직접 INSERT는 postgres 롤로)
--  (b) 공고 워크스페이스 멤버 롤로 SELECT 가시(대회에 공고 연결 시드)
--  (c) 무관 사용자 롤 SELECT 0행  (d) anon 롤 SELECT 실패 또는 0행
--  (e) authenticated 롤 직접 INSERT/UPDATE/DELETE 실패(권한 거부)
```

`enum_has_labels`는 기존 값 목록이 필요하므로 구현 시 `SELECT enum_range(NULL::public.ops_event_type)` 실측으로 현행 값을 채운 뒤 신규 7값을 덧붙일 것(1f가 추가한 값 포함 — 하드코딩 추측 금지).

- [ ] **Step 2: RED 확인** — `npm run db:reset && npm run test:db:helpers && npx supabase test db` → `ops_staff_schema` 파일 FAIL(테이블 부재) 확인.

- [ ] **Step 3: M1 마이그레이션 작성**

```sql
-- 20260707100000_ops_1e_staff_table_and_enum.sql
-- ops 1e M1: ops_staff 테이블 + ops_event_type 확장 + ops_tables 배정 백스톱 + RLS
-- 스펙: docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md §1

-- 1) enum 확장(신규 값 사용은 M2부터 — 동일 트랜잭션 사용 제약 회피)
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'posting_linked';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'posting_unlinked';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_imported';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_added';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_removed';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'table_staff_assigned';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'table_staff_unassigned';

-- 2) ops_staff (스펙 §1.2)
CREATE TABLE public.ops_staff (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id      uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  staff_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role               public.staff_role NOT NULL DEFAULT 'dealer',
  custom_role        text,
  staff_name         text NOT NULL,
  staff_nickname     text,
  source             text NOT NULL CHECK (source IN ('snapshot_import','manual')),
  source_work_log_id uuid REFERENCES public.work_logs(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, staff_id)
);
CREATE INDEX idx_ops_staff_staff_id ON public.ops_staff(staff_id);
CREATE INDEX idx_ops_staff_source_work_log_id ON public.ops_staff(source_work_log_id);

-- 3) 딜러 1명=테이블 1개 백스톱 (RPC move 시맨틱의 방어선, prod ops_tables 0행)
CREATE UNIQUE INDEX uq_ops_tables_assigned_staff
  ON public.ops_tables(tournament_id, assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

-- 4) RLS: 타 ops 테이블 동형(SELECT-only, 쓰기는 SECDEF RPC 100%)
ALTER TABLE public.ops_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_staff FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_staff_select ON public.ops_staff
  FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));
  -- is_admin()은 (SELECT ...) initplan 래핑(적대검증 SEC-2 — 기존 ops SELECT 정책 6종 자구 일치)
GRANT SELECT ON public.ops_staff TO authenticated;
GRANT ALL ON public.ops_staff TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.ops_staff FROM anon, authenticated;
```

작성 전 `20260625120100_ops_1a_rls_and_membership.sql`·`20260625130000_ops_1b_tables_seats.sql`의 RLS/GRANT 문형과 대조해 표기 차이(정책명 규칙, service_role 권한)를 현행 관례에 맞출 것.

- [ ] **Step 4: GREEN 확인** — `npm run db:reset && npm run test:db:helpers && npx supabase test db` → ops_staff_schema PASS + 기존 pgTAP 전건 PASS(회귀 0).

- [ ] **Step 5: Commit** — `feat(ops): 1e M1 — ops_staff 테이블·이벤트 enum 7값·배정 백스톱·RLS`

---

### Task 2: M2 마이그(전반) — ops_set_tournament_posting + ops_import_staff_from_posting (+pgTAP)

**Files:**

- Create: `uniqn-mobile/supabase/migrations/20260707100100_ops_1e_staff_rpcs.sql`
- Create: `uniqn-mobile/supabase/tests/ops_staff_link_import.test.sql`

**Interfaces:**

- Consumes: Task 1의 ops_staff·enum.
- Produces: `public.ops_set_tournament_posting(p_tournament_id uuid, p_actor_id uuid, p_job_posting_id uuid) RETURNS jsonb`, `public.ops_import_staff_from_posting(p_tournament_id uuid, p_actor_id uuid, p_date text DEFAULT NULL) RETURNS jsonb` — 반환 키는 각각 `{tournamentId, jobPostingId}`, `{imported, skipped}`.

- [ ] **Step 1: pgTAP 테스트 작성 (RED)** — 시나리오(스펙 §5.1 4·5항):

```text
[link] owner가 접근권 있는 공고 연결 → job_posting_id 반영 + ops_events 'posting_linked' 1행(payload old/new)
[link] 공고-경유 워크스페이스 멤버가 연결 변경 시도 → P0001 PERMISSION_DENIED (owner-only)
[link] owner가 접근권 없는 공고 연결 → P0001 POSTING_NOT_FOUND
[link] 해제(NULL) → 'posting_unlinked' + 이후 그 워크스페이스 멤버의 ops_staff SELECT 0행(is_ops_member 축소 실측)
[link] 동일 값 재설정 → 이벤트 미증가(no-op)
[import] 시드: 공고 1 + confirm 경로 work_logs 2인(딜러/플로어, 날짜 상이) + add_direct_staff 경로 1인 + cancelled 1행 + no_show 1행
         → 실행: imported=3, skipped=0. 이름/role/custom_role/source='snapshot_import'/source_work_log_id 스냅샷 단언
[import] 2회 실행 → imported=0, skipped=3, 기존 행 불변(멱등) + 'staff_imported' 이벤트 payload {imported,skipped,date,job_posting_id}
[import] p_date='특정일' → 그 날짜 행의 스태프만
[import] 미연결 대회 → P0001 NO_LINKED_POSTING
[import] 비멤버 actor → P0001 PERMISSION_DENIED
```

- [ ] **Step 2: RED 확인** — `npx supabase test db` → 신규 파일 FAIL(함수 부재).

- [ ] **Step 3: M2 파일 생성 — RPC 2종 구현**

파일 헤더에 ops RPC 공통 계약 주석(1a_rpcs 헤더 관례). 전문:

```sql
CREATE OR REPLACE FUNCTION public.ops_set_tournament_posting(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_job_posting_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public','extensions','pg_temp'
AS $$
DECLARE
  v_t  public.ops_tournaments%ROWTYPE;
  v_jp public.job_postings%ROWTYPE;
  v_old uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 연결 변경은 owner 전용(is_ops_member의 워크스페이스 분기를 바꾸는 조작)
  IF v_t.owner_id IS DISTINCT FROM p_actor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 소유자만 공고 연결을 변경할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  IF p_job_posting_id IS NOT NULL THEN
    SELECT * INTO v_jp FROM public.job_postings WHERE id = p_job_posting_id;
    -- ops_create_tournament의 공고 게이트(20260625120200:43-57)와 동일 조건 — 구현 시 현행 본문과 대조
    IF NOT FOUND OR NOT (
      v_jp.owner_id = p_actor_id
      OR public.is_workspace_member(v_jp.workspace_id, p_actor_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'POSTING_NOT_FOUND: 공고를 찾을 수 없거나 접근 권한이 없습니다' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_old := v_t.job_posting_id;
  IF v_old IS NOT DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('tournamentId', p_tournament_id, 'jobPostingId', p_job_posting_id);
  END IF;

  UPDATE public.ops_tournaments SET job_posting_id = p_job_posting_id WHERE id = p_tournament_id;
  -- ops_tournaments에 updated_at 컬럼·갱신 관례가 있으면(ops_update_tournament 현행 본문 실측) 동일하게 갱신

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (
    p_tournament_id,
    CASE WHEN p_job_posting_id IS NULL
      THEN 'posting_unlinked'::public.ops_event_type
      ELSE 'posting_linked'::public.ops_event_type END,
    p_actor_id,
    jsonb_build_object('old_posting_id', v_old, 'new_posting_id', p_job_posting_id)
  );

  RETURN jsonb_build_object('tournamentId', p_tournament_id, 'jobPostingId', p_job_posting_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ops_import_staff_from_posting(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_date text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public','extensions','pg_temp'
AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_posting_id uuid;
  v_candidates int;
  v_imported int;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  v_posting_id := v_t.job_posting_id;
  IF v_posting_id IS NULL THEN
    RAISE EXCEPTION 'NO_LINKED_POSTING: 연결된 공고가 없습니다. 먼저 공고를 연결하세요' USING ERRCODE = 'P0001';
  END IF;

  -- 확정 스태프 SSOT = work_logs (스펙 §2.2 — 읽기 전용, work_logs에 쓰지 않음)
  WITH src AS (
    SELECT DISTINCT ON (wl.staff_id)
           wl.staff_id, wl.role, wl.custom_role, wl.staff_name, wl.staff_nickname,
           wl.id AS work_log_id
    FROM public.work_logs wl
    WHERE wl.job_posting_id = v_posting_id
      AND wl.status NOT IN ('cancelled','no_show')
      AND (p_date IS NULL OR wl.date = p_date)
    ORDER BY wl.staff_id, wl.date DESC, wl.created_at DESC
  ), ins AS (
    INSERT INTO public.ops_staff
      (tournament_id, staff_id, role, custom_role, staff_name, staff_nickname, source, source_work_log_id)
    SELECT p_tournament_id, s.staff_id, s.role, s.custom_role,
           COALESCE(NULLIF(btrim(s.staff_name), ''), s.staff_nickname, '이름 미상'),
           s.staff_nickname, 'snapshot_import', s.work_log_id
    FROM src s
    ON CONFLICT (tournament_id, staff_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM src), (SELECT count(*) FROM ins)
  INTO v_candidates, v_imported;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_imported', p_actor_id,
          jsonb_build_object('job_posting_id', v_posting_id, 'date', p_date,
                             'imported', v_imported, 'skipped', v_candidates - v_imported));

  RETURN jsonb_build_object('imported', v_imported, 'skipped', v_candidates - v_imported);
END;
$$;
```

- [ ] **Step 4: GREEN 확인** — `npm run db:reset && npm run test:db:helpers && npx supabase test db` 전건 PASS. (grants는 Task 4 전이므로 pgTAP은 postgres/`SET ROLE` 헬퍼 경유로 실행 — 기존 ops 테스트 관례와 동일.)

- [ ] **Step 5: Commit** — `feat(ops): 1e M2(전반) — 공고 연결 변경·확정 스태프 스냅샷 import RPC`

---

### Task 3: M2 마이그(후반) — ops_add_staff / ops_remove_staff / ops_assign_table_staff (+pgTAP)

**Files:**

- Modify: `uniqn-mobile/supabase/migrations/20260707100100_ops_1e_staff_rpcs.sql` (같은 브랜치 내 미적용 파일에 이어쓰기 — "기존 마이그 수정 금지"는 이미 적용·머지된 마이그 대상)
- Create: `uniqn-mobile/supabase/tests/ops_staff_roster_assign.test.sql`

**Interfaces:**

- Consumes: Task 1 ops_staff, Task 2와 동일 공통 블록.
- Produces: `public.ops_add_staff(p_tournament_id uuid, p_actor_id uuid, p_staff_id uuid, p_role public.staff_role DEFAULT 'dealer', p_custom_role text DEFAULT NULL) RETURNS jsonb`(반환 `{opsStaffId}`), `public.ops_remove_staff(p_tournament_id uuid, p_actor_id uuid, p_ops_staff_id uuid) RETURNS jsonb`(반환 `{success, clearedTableIds}`), `public.ops_assign_table_staff(p_tournament_id uuid, p_actor_id uuid, p_table_id uuid, p_staff_id uuid DEFAULT NULL) RETURNS jsonb`(반환 `{tableId, staffId}`).

- [ ] **Step 1: pgTAP 테스트 작성 (RED)** — 시나리오(스펙 §5.1 6·7항):

```text
[add] 멤버(employer 롤)가 활성 사용자 추가 → 행 생성(source='manual', 이름 서버측 스냅샷=users.name) + 'staff_added'
[add] status=NULL 활성 사용자 추가 → 성공(COALESCE(status,'active') 흡수 — 적대검증 E1/L3-1/F3 회귀)
[add] 동일인 재추가 → P0001 DUPLICATE_STAFF
[add] 비활성(is_active=false) 대상 → P0001 STAFF_NOT_FOUND
[add] actor가 staff 롤(비 employer/admin)인 대회 owner → P0001 PERMISSION_DENIED (적대검증 SEC-1 롤 게이트)
[remove] 배정 중(T1 assigned) 스태프 제거 → ops_tables.assigned_staff_id NULL 실측 + 'staff_removed' payload cleared_table_ids=[T1]
[remove] 타 대회 ops_staff_id → P0001 STAFF_NOT_FOUND
[assign] 로스터 멤버를 T1에 배정 → assigned_staff_id 반영 + 'table_staff_assigned'
[assign] 같은 스태프를 T2로 재배정 → T1 자동 해제 + T2 배정(move 시맨틱, payload previous_table_id=T1)
[assign] 로스터 외 사용자 → P0001 STAFF_NOT_IN_ROSTER
[assign] NULL로 해제 → assigned_staff_id NULL + 'table_staff_unassigned'
[assign] 타 대회 테이블 → P0001 TABLE_NOT_FOUND
[백스톱] postgres 롤로 두 테이블에 동일 staff 직접 UPDATE 시도 → uq_ops_tables_assigned_staff 위반(23505)
```

- [ ] **Step 2: RED 확인** — `npx supabase test db` → 신규 파일 FAIL.

- [ ] **Step 3: RPC 3종을 M2 파일에 추가**

```sql
CREATE OR REPLACE FUNCTION public.ops_add_staff(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_staff_id uuid,
  p_role public.staff_role DEFAULT 'dealer',
  p_custom_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public','extensions','pg_temp'
AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 롤 게이트(적대검증 SEC-1): 이름 하베스팅 프리미티브 차단 — 전화검색(search_users_by_phone)과 신뢰경계 일치
  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('employer','admin') AND is_active = true
  )) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 스태프 추가 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 대상 검증: add_direct_staff(20260629000000:112)·search_users_by_phone(:65)와 문자 그대로 동일(COALESCE 필수 — status nullable)
  SELECT * INTO v_user FROM public.users
   WHERE id = p_staff_id AND is_active = true AND COALESCE(status, 'active') NOT IN ('deleted','deactivated');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 추가할 수 없는 사용자입니다' USING ERRCODE = 'P0001';
  END IF;

  -- advisory 락이 대회 단위 직렬화하므로 pre-check가 race-safe
  IF EXISTS (SELECT 1 FROM public.ops_staff WHERE tournament_id = p_tournament_id AND staff_id = p_staff_id) THEN
    RAISE EXCEPTION 'DUPLICATE_STAFF: 이미 로스터에 있는 스태프입니다' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ops_staff
    (tournament_id, staff_id, role, custom_role, staff_name, staff_nickname, source, source_work_log_id)
  VALUES
    (p_tournament_id, p_staff_id, p_role, p_custom_role,
     COALESCE(NULLIF(btrim(v_user.name), ''), v_user.nickname, '이름 미상'),
     v_user.nickname, 'manual', NULL)
  RETURNING id INTO v_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_added', p_actor_id,
          jsonb_build_object('staff_id', p_staff_id, 'role', p_role::text));

  RETURN jsonb_build_object('opsStaffId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ops_remove_staff(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_ops_staff_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public','extensions','pg_temp'
AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_row public.ops_staff%ROWTYPE;
  v_table_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.ops_staff
   WHERE id = p_ops_staff_id AND tournament_id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_FOUND: 로스터에서 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- cascade-clear: 배정 테이블 선해제 (id asc 잠금 — FOR UPDATE는 집계와 못 쓰므로 서브쿼리)
  SELECT array_agg(id) INTO v_table_ids FROM (
    SELECT id FROM public.ops_tables
     WHERE tournament_id = p_tournament_id AND assigned_staff_id = v_row.staff_id
     ORDER BY id
     FOR UPDATE
  ) locked;
  IF v_table_ids IS NOT NULL THEN
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = ANY(v_table_ids);
  END IF;

  DELETE FROM public.ops_staff WHERE id = p_ops_staff_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'staff_removed', p_actor_id,
          jsonb_build_object('staff_id', v_row.staff_id,
                             'cleared_table_ids', COALESCE(to_jsonb(v_table_ids), '[]'::jsonb)));

  RETURN jsonb_build_object('success', true,
                            'clearedTableIds', COALESCE(to_jsonb(v_table_ids), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.ops_assign_table_staff(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_table_id uuid,
  p_staff_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public','extensions','pg_temp'
AS $$
DECLARE
  v_t public.ops_tournaments%ROWTYPE;
  v_table public.ops_tables%ROWTYPE;
  v_prev_table_id uuid;
  v_replaced uuid;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 계정으로만 호출할 수 있습니다' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || p_tournament_id::text)::bigint);

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 운영 권한이 없습니다' USING ERRCODE = 'P0001';
  END IF;

  -- 관련 행 일괄 잠금: 대상 테이블 + (배정 시) 스태프의 기존 배정 테이블, id asc
  PERFORM 1 FROM (
    SELECT id FROM public.ops_tables
     WHERE tournament_id = p_tournament_id
       AND (id = p_table_id OR (p_staff_id IS NOT NULL AND assigned_staff_id = p_staff_id))
     ORDER BY id
     FOR UPDATE
  ) locked;

  SELECT * INTO v_table FROM public.ops_tables
   WHERE id = p_table_id AND tournament_id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: 테이블을 찾을 수 없습니다' USING ERRCODE = 'P0001';
  END IF;

  IF p_staff_id IS NULL THEN
    -- 해제(멱등)
    IF v_table.assigned_staff_id IS NULL THEN
      RETURN jsonb_build_object('tableId', p_table_id, 'staffId', NULL);
    END IF;
    v_replaced := v_table.assigned_staff_id;
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = p_table_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (p_tournament_id, 'table_staff_unassigned', p_actor_id,
            jsonb_build_object('table_id', p_table_id, 'staff_id', v_replaced));
    RETURN jsonb_build_object('tableId', p_table_id, 'staffId', NULL);
  END IF;

  -- 로스터 멤버십 강제(역할은 비강제 — UI가 딜러 우선 필터)
  IF NOT EXISTS (SELECT 1 FROM public.ops_staff
                  WHERE tournament_id = p_tournament_id AND staff_id = p_staff_id) THEN
    RAISE EXCEPTION 'STAFF_NOT_IN_ROSTER: 로스터에 없는 스태프입니다. 먼저 로스터에 추가하세요' USING ERRCODE = 'P0001';
  END IF;

  IF v_table.assigned_staff_id IS NOT DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('tableId', p_table_id, 'staffId', p_staff_id); -- no-op
  END IF;

  -- move 시맨틱: 기존 배정 테이블 선해제(백스톱 UNIQUE 충돌 예방)
  SELECT id INTO v_prev_table_id FROM public.ops_tables
   WHERE tournament_id = p_tournament_id AND assigned_staff_id = p_staff_id AND id <> p_table_id;
  IF v_prev_table_id IS NOT NULL THEN
    UPDATE public.ops_tables SET assigned_staff_id = NULL WHERE id = v_prev_table_id;
  END IF;

  v_replaced := v_table.assigned_staff_id; -- 대상 테이블에 다른 딜러가 있었으면 교대
  UPDATE public.ops_tables SET assigned_staff_id = p_staff_id WHERE id = p_table_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id, 'table_staff_assigned', p_actor_id,
          jsonb_build_object('table_id', p_table_id, 'staff_id', p_staff_id,
                             'previous_table_id', v_prev_table_id, 'replaced_staff_id', v_replaced));

  RETURN jsonb_build_object('tableId', p_table_id, 'staffId', p_staff_id);
END;
$$;
```

- [ ] **Step 4: GREEN 확인** — DB 3종 명령 전건 PASS(Task 1·2 테스트 포함 회귀 0).

- [ ] **Step 5: Commit** — `feat(ops): 1e M2(후반) — 로스터 수동 추가/삭제·딜러 테이블 배정 RPC(move 시맨틱)`

---

### Task 4: M3 grants+realtime + 보안 pgTAP + supabase.ts 타입

**Files:**

- Create: `uniqn-mobile/supabase/migrations/20260707100200_ops_1e_grants_and_realtime.sql`
- Create: `uniqn-mobile/supabase/tests/ops_staff_security.test.sql`
- Modify: `uniqn-mobile/src/types/supabase.ts` (수술적 추가만)

**Interfaces:**

- Produces: RPC 5종 anon REVOKE·authenticated GRANT, `ops_staff` Realtime 등록, supabase.ts에 ops_staff Row/RPC 타입.

- [ ] **Step 1: 보안 pgTAP 작성 (RED)**

```text
[grant] 신규 RPC 5종 has_function_privilege('anon', ..., 'EXECUTE') = false 전건
[grant] 신규 RPC 5종 has_function_privilege('authenticated', ..., 'EXECUTE') = true 전건
[불변] anon-executable SECDEF 총량 = 정확히 2 — **신규 카탈로그 카운트 단언 작성**(적대검증 E2/F4: 기존 pgTAP엔 함수별 단언만 있고 총량 단언은 부재하므로 "기존 테스트로 갈음" 불가). 예:
  `SELECT is( (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')), 2,
    'anon-executable SECDEF은 monitor/player 2개뿐');`
[actor] RPC 5종: p_actor_id ≠ auth.uid() 비-admin 호출 → P0001 PERMISSION_DENIED
[realtime] pg_publication_tables에 ops_staff 존재
```

- [ ] **Step 2: RED 확인** — `npx supabase test db` FAIL(grants/publication 부재).

- [ ] **Step 3: M3 작성** — 1b/1d grants 파일의 DO 루프 문형을 그대로 복제(함수명만 교체):

```sql
-- 변이 RPC 5종: PUBLIC/anon 회수, authenticated/service_role 부여 (1a~1f grants DO 루프 관례)
DO $$
DECLARE v_fn text;
BEGIN
  FOR v_fn IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ops_set_tournament_posting','ops_import_staff_from_posting',
                        'ops_add_staff','ops_remove_staff','ops_assign_table_staff')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END LOOP;
END $$;

-- Realtime 등록 — 멱등 가드 필수(적대검증 SEC-3: bare ADD는 db:reset 드리프트 시 42710. 1a/1b grants 문형)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_staff;
  END IF;
END $$;
```

- [ ] **Step 4: supabase.ts 수술적 추가** — `ops_staff` Row/Insert/Update 타입 + Functions에 RPC 5종 Args/Returns. 기존 ops_* 항목의 표기 관례(snake_case 키·Json 타입)를 그대로 따름.
- [ ] **Step 5: GREEN 확인** — DB 3종 전건 PASS + `npx tsc --noEmit` EXIT 0.
- [ ] **Step 6: Commit** — `feat(ops): 1e M3 — grants·realtime + 보안 pgTAP + supabase 타입`

---

### Task 5: 타입·zod 스키마·Repository·queryKeys (+jest)

**Files:**

- Modify: `uniqn-mobile/src/types/ops.ts`
- Create: `uniqn-mobile/src/schemas/opsStaff.schema.ts`
- Create: `uniqn-mobile/src/repositories/supabase/OpsStaffRepository.ts`
- Modify: `uniqn-mobile/src/repositories/supabase/opsRpcError.ts` (신규 에러 코드 매핑)
- Modify: `uniqn-mobile/src/repositories/ops.ts` (배럴), `uniqn-mobile/src/lib/queryClient.ts` (queryKeys.ops.staff)
- ~~OpsTable assigned_staff_id 추가~~ **불요(적대검증 C-1/F2)**: `OpsTableRepository.ts:10` COLUMNS에 `assigned_staff_id` 이미 포함 + `toCamelCase`로 `assignedStaffId` 자동 매핑 + `src/types/ops.ts:131`에 `assignedStaffId?: string | null` 이미 선언. Task 7 딜러 배지는 **기존 필드 그대로 소비**(신규 배선 금지 — 재추가 시 TS 중복 식별자).
- Test: `uniqn-mobile/src/repositories/supabase/__tests__/OpsStaffRepository.test.ts`

**Interfaces:**

- Produces (이후 태스크가 그대로 사용):

```ts
// src/types/ops.ts
export type OpsStaffSource = 'snapshot_import' | 'manual';
export interface OpsStaff {
  id: string; tournamentId: string; staffId: string;
  role: StaffRole; customRole: string | null;         // StaffRole = 기존 6값 타입 재사용
  staffName: string; staffNickname: string | null;
  source: OpsStaffSource; sourceWorkLogId: string | null; createdAt: string;
}
// OpsTable.assignedStaffId 는 이미 존재(types/ops.ts:131) — 신규 추가 금지(적대검증 C-1/F2)

// OpsStaffRepository (싱글톤 export: opsStaffRepository)
listByTournament(tournamentId: string): Promise<OpsStaff[]>            // .order('created_at')
setTournamentPosting(p: { tournamentId: string; actorId: string; jobPostingId: string | null }): Promise<void>
importFromPosting(p: { tournamentId: string; actorId: string; date: string | null }): Promise<{ imported: number; skipped: number }>
addStaff(p: { tournamentId: string; actorId: string; staffId: string; role: StaffRole; customRole?: string | null }): Promise<void>
removeStaff(p: { tournamentId: string; actorId: string; opsStaffId: string }): Promise<void>
assignTableStaff(p: { tournamentId: string; actorId: string; tableId: string; staffId: string | null }): Promise<void>

// queryKeys.ops.staff: (tournamentId: string) => readonly key (기존 queryKeys.ops.* 형태 답습)
```

- [ ] **Step 1: 실측** — `OpsParticipantRepository.ts`(SELECT 컬럼 상수·snake→camel 매핑·`mapOpsRpcError` 사용법)와 `opsRpcError.ts`(코드→AppError 매핑 테이블), `opsTournament.schema.ts`(zod 관례)를 읽고 동일 문형 채택.
- [ ] **Step 2: jest 작성 (RED)** — supabase 클라이언트 mock으로: listByTournament 매핑(snake→camel), RPC 5종 인자 스네이크 변환, P0001 **신규 4코드**(NO_LINKED_POSTING/DUPLICATE_STAFF/STAFF_NOT_IN_ROSTER/**POSTING_NOT_FOUND**) → AppError 매핑 단언. 기존 Ops*Repository 테스트 파일의 mock 관례 복제.
- [ ] **Step 3: RED 확인** — `npx jest src/repositories/supabase/__tests__/OpsStaffRepository.test.ts` FAIL.
- [ ] **Step 4: 구현** — zod 스키마는 읽기 내성 관례(`role`은 `z.enum(6값).catch('other')` 등 표시용 필드만 .catch — 기존 ops 스키마와 동일 수준, enum 발산 함정 예방). 에러 매핑에 **신규 4코드 추가**(적대검증 C-3/F1): `NO_LINKED_POSTING`→BUSINESS_INVALID_STATE류, `DUPLICATE_STAFF`/`STAFF_NOT_IN_ROSTER`→BUSINESS_INVALID_STATE, `STAFF_NOT_FOUND`→INFRA_NOT_FOUND, **`POSTING_NOT_FOUND`→INFRA_NOT_FOUND**(누락 시 handleSupabaseError 폴백으로 원시 에러 노출 — 보안 게이트 메시지 유실). **`TABLE_NOT_FOUND`는 신규 아님** — `opsRpcError.ts`에 이미 `OPS_TABLE_NOT_FOUND`로 매핑됨, 재추가 금지(기존 매핑 재사용). 구현 전 `opsRpcError.ts` PREFIX_MAP 실측해 신규 4코드만 추가.
- [ ] **Step 5: GREEN** — 해당 jest PASS + `npx tsc --noEmit` EXIT 0.
- [ ] **Step 6: Commit** — `feat(ops): 1e 데이터 레이어 — OpsStaff 타입·스키마·레포지토리·에러 매핑`

---

### Task 6: Service + Hooks (+jest)

**Files:**

- Create: `uniqn-mobile/src/services/ops/opsStaffService.ts` (+ `services/ops/index.ts` 배럴 등록)
- Create: `uniqn-mobile/src/hooks/ops/useOpsStaff.ts` (+ `hooks/ops/index.ts` 배럴 등록)
- Modify: `uniqn-mobile/src/hooks/ops/useOpsMutations.ts`
- Test: `uniqn-mobile/src/services/ops/__tests__/opsStaffService.test.ts`, `uniqn-mobile/src/hooks/ops/__tests__/useOpsStaff.test.tsx`

**Interfaces:**

- Consumes: Task 5의 opsStaffRepository·queryKeys.ops.staff.
- Produces:

```ts
// opsStaffService — 쓰기 5종을 Repository로 위임 + logger (기존 opsParticipantService 문형)
setTournamentPosting / importFromPosting / addStaff / removeStaff / assignTableStaff;

// useOpsStaff(tournamentId: string | undefined): UseQueryResult<OpsStaff[]>
//  - queryKey: queryKeys.ops.staff(tournamentId)
//  - 읽기는 Repository 직접(규약) + 'ops_staff' Realtime 구독→invalidate (useOpsParticipants 문형 복제)

// useOpsMutations.ts 추가 5종 (mutationFn=Service 경유, actor=authStore — 파일 상단 주석 계약 유지):
useSetTournamentPosting(); // onSuccess: invalidate ops.staff + ops.tournament(s) 관련 키
useImportOpsStaff(); // onSuccess: invalidate ops.staff, 반환 {imported, skipped}를 호출측에 전달
useAddOpsStaff() / useRemoveOpsStaff(); // onSuccess: invalidate ops.staff (+remove는 ops.tables도)
useAssignTableStaff(); // onSuccess: invalidate ops.tables + ops.staff
```

- [ ] **Step 1: jest 작성 (RED)** — service: 레포 위임·인자 전달 단언(레포 mock). hook: useOpsStaff 쿼리 성공 경로 + mutation onSuccess invalidate 키 단언(기존 useOpsMutations 테스트 관례·restoreMocks 함정 준수).
- [ ] **Step 2: RED 확인** — 해당 jest FAIL.
- [ ] **Step 3: 구현** — 기존 파일 문형 복제(에러 toast 처리·invalidate 위치 포함).
- [ ] **Step 4: GREEN** — 해당 jest PASS + `npx tsc --noEmit` EXIT 0.
- [ ] **Step 5: Commit** — `feat(ops): 1e 서비스·훅 — 로스터 조회(Realtime)+변이 5종`

---

### Task 7: TABLES 딜러 지정 + DealerPickerSheet (+jest)

**Files:**

- Create: `uniqn-mobile/src/components/ops/DealerPickerSheet.tsx`
- Modify: `uniqn-mobile/src/components/ops/TablesTab.tsx` (테이블 액션 시트에 "딜러 지정" 항목), `uniqn-mobile/src/components/ops/TableRow.tsx` (딜러명 배지)
- Test: `uniqn-mobile/src/components/ops/__tests__/DealerPickerSheet.test.tsx` (+기존 TablesTab/TableRow 테스트 확장)

**Interfaces:**

- Consumes: useOpsStaff(로스터)·useAssignTableStaff(Task 6)·OpsTable.assignedStaffId(Task 5).
- Produces: `<DealerPickerSheet visible tournamentId tableId currentStaffId onClose />` — 로스터를 딜러 우선 그룹핑(role==='dealer' 상단, 이하 역할별), 현재 배정자 표시 + "배정 해제" destructive 옵션. Task 8(STAFF 탭)의 행 액션 "테이블 지정"이 재사용.

- [ ] **Step 1: jest 작성 (RED)** — TableRow: assignedStaffId 있으면 로스터 이름 배지 렌더(로스터에 없으면 "외부 스태프" 폴백 라벨). DealerPickerSheet: 딜러 우선 정렬·해제 옵션 노출 조건·선택 시 assign mutation 호출 인자. TablesTab: 액션 시트에 "딜러 지정" 항목 추가 회귀.
- [ ] **Step 2: RED 확인** — 해당 jest FAIL.
- [ ] **Step 3: 구현** — TablesTab의 기존 잠금/우선순위 SelectBottomSheet 문형(TablesTab.tsx:157-186) 복제. TableRow 배지는 tableId→로스터 이름 매핑을 props로 주입(행 컴포넌트에서 훅 호출 금지 — 기존 관례 확인). DealerPickerSheet는 tableId 없이 "스태프 기준"으로도 열 수 있게 `{ mode: 'table' | 'staff' }` 없이 단순하게: props에 `tableId`가 있으면 그 테이블에 배정, Task 8에서는 스태프 행에서 열되 테이블 목록을 고르는 순서만 반대(테이블 선택 시트 → assign 호출) — 재사용이 어색하면 Task 8에서 테이블 선택용 `SelectBottomSheet` 인라인 구성으로 대체 가능(assign mutation은 동일).
- [ ] **Step 4: GREEN** — 해당 jest PASS + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(ops): 1e TABLES 딜러 지정 — 피커 시트·테이블 카드 배지(move 시맨틱)`

---

### Task 8: STAFF 탭 UI (+jest)

**Files:**

- Create: `uniqn-mobile/src/components/ops/StaffTab.tsx` (로스터·연결카드·import CTA)
- Create: `uniqn-mobile/src/components/ops/StaffAddSheet.tsx` (전화검색 수동 추가)
- Create: `uniqn-mobile/src/components/ops/PostingPickerSheet.tsx` (내 관리 공고 선택 시트 — Task 9가 재사용, 적대검증 F5로 소유 태스크 고정)
- Modify: `uniqn-mobile/app/(ops)/tournaments/[id].tsx` (세그먼트 `staff` 추가)
- Test: `uniqn-mobile/src/components/ops/__tests__/StaffTab.test.tsx`

**Interfaces:**

- Consumes: useOpsStaff·useOpsMutations 5종(Task 6), `DealerPickerSheet` 또는 테이블 선택 시트(Task 7), `useStaffPhoneSearch`(기존, `search_users_by_phone`), `useMyJobPostings`(기존, `src/hooks/useJobManagement.ts:71`), `SelectBottomSheet`(`@/components/ui`), `AppFlashList`.
- Produces: `<StaffTab tournamentId={id} tournament={tournament} />` — [id].tsx가 렌더. `<PostingPickerSheet visible onSelect(postingId) onClose />` — Task 9 재사용.

- [ ] **Step 1: 실측 (적대검증 C-4/C-2 정정 반영)** — `[id].tsx`: 탭 유니언 타입 **35-37행**(`useState<'players'|...>` — `'staff'` 추가), 세그먼트 배열 **76행**(`(['players',...] as const).map` — `'staff'` 추가), 라벨 삼항 **87-97행**(`스태프 ${N}` 추가), 탭 렌더 분기 **103-176행**(staff 케이스 추가). `TablesTab.tsx`(탭 컴포넌트 구조·시트 관례), `AddStaffModal.tsx`+`useStaffPhoneSearch.ts`(전화검색 UX). 공고 picker 원천 = **`useMyJobPostings()`(`src/hooks/useJobManagement.ts:71`, 사용 예 `app/(app)/(tabs)/employer.tsx`)** — `app/(employer)/my-postings/index.tsx`는 **존재하지 않음**(구 계획 오인용). ⚠️`useMyJobPostings`는 `enabled: !!user && !!activeWorkspace?.id`로 **활성 워크스페이스 스코프** — picker는 활성 워크스페이스 공고만 노출되고 활성 워크스페이스 없으면 비활성. 이 제약을 연결 카드 UX에 반영(빈 목록/워크스페이스 없음 안내).
- [ ] **Step 2: jest 작성 (RED)** — 렌더 분기: 미연결(안내+연결 버튼, owner 아니면 연결 버튼 숨김) / 연결+빈 로스터(import CTA) / 로스터 N행(이름·역할 배지·배정 테이블 배지 T{n}·source 구분) / 행 탭→액션 시트(테이블 지정/삭제) / import 확인 다이얼로그 문구("이미 있는 스태프는 건너뛰고, 삭제했던 스태프는 다시 추가됩니다") / import 성공 toast("N명 추가 · M명 건너뜀") / 로스터 상단 staleness 캡션("가져온 시점 기준 명단입니다") 렌더.
- [ ] **Step 3: RED 확인** — 해당 jest FAIL.
- [ ] **Step 4: 구현** — 스펙 §4.2 구성(위→아래: 연결 공고 카드→import CTA→로스터 리스트→수동 추가). 세그먼트 순서 = 참가/현황/테이블/블라인드/**스태프**/이력/상금, 라벨 `스태프 ${N}`. import 기본 date=대회 event_date('YYYY-MM-DD'), "전체 기간" 토글 시 null. 배정 테이블 배지는 `useOpsTables` 데이터에서 `assignedStaffId===row.staffId`인 테이블 번호 매핑. 행 액션 "테이블 지정"은 Task 7 산출물 재사용(스펙 §7 staleness 라벨 포함).
- [ ] **Step 5: GREEN** — 해당 jest PASS + `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat(ops): 1e STAFF 탭 — 공고연결·스냅샷 import·로스터·수동 추가`

---

### Task 9: 진입점 3곳 — 생성 폼 공고 picker · 목록 postingId 필터 · 공고 상세 인앱 전환 (+jest)

**Files:**

- Modify: `uniqn-mobile/app/(ops)/tournaments/new.tsx` ("공고 연결(선택)" 필드 + `?postingId=` 프리셋)
- Modify: `uniqn-mobile/app/(ops)/tournaments/index.tsx` (`?postingId=` 필터 + 필터 상태 "+ 대회" 프리셋 전달)
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx` (ActionCard 인앱 push 전환 — 현행 44·149행 `useOpsTournamentForPosting`, 539-569행 ActionCard+`openExternalUrl`)
- Modify: `uniqn-mobile/src/hooks/ops/useOpsTournaments.ts:51` — `useOpsTournamentForPosting`(단수)을 `useOpsTournamentsForPosting`(목록)으로 교체 + 레포 `listByPosting` 추가
- Modify: `uniqn-mobile/src/hooks/ops/index.ts:5` (배럴 export 교체 — 적대검증 L3-2, 누락 시 tsc 에러). 사용처는 my-postings/[id]/index.tsx **1곳뿐**(grep 확인됨)
- Reuse: `PostingPickerSheet`(Task 8 산출) — new.tsx 공고 연결 필드
- Test: 해당 화면/훅 기존 테스트 확장 + ActionCard 라우팅 회귀 테스트

**Interfaces:**

- Consumes: `ops_create_tournament`의 기존 `p_job_posting_id` 파라미터(서버 게이트 기존재 — 서버 변경 없음), Task 5·6 계층.
- Produces: `useOpsTournamentsForPosting(postingId: string | undefined): UseQueryResult<OpsTournament[]>` (레포: `.eq('job_posting_id', postingId).order('created_at', {ascending:false})`).

- [ ] **Step 1: 실측** — new.tsx 폼 상태 구조·`useCreateOpsTournament`→`opsTournamentService.createTournament` 시그니처(jobPostingId 전달 배선 여부 — RPC에는 파라미터 기존재), my-postings/[id]/index.tsx:539-569(ActionCard 현행: `useOpsTournamentForPosting`+`openExternalUrl`), 기존 훅 사용처 전수(grep `useOpsTournamentForPosting`).
- [ ] **Step 2: jest 작성 (RED)** — ActionCard: 연결 대회 0개→라벨 "라이브 운영 시작"+`router.push('/(ops)/tournaments/new?postingId={id}')` / N개→"라이브 운영 (N)"+`router.push('/(ops)/tournaments?postingId={id}')`, `openExternalUrl` 미호출. index.tsx: postingId 파라미터 시 필터링. new.tsx: postingId 프리셋 시 공고 필드 선반영, 생성 호출에 jobPostingId 포함.
- [ ] **Step 3: RED 확인** — 해당 jest FAIL.
- [ ] **Step 4: 구현** — 공고 picker는 Task 8 산출 `PostingPickerSheet`(내부에서 `useMyJobPostings` — 활성 워크스페이스 스코프) 재사용. `useOpsTournamentForPosting`→`useOpsTournamentsForPosting` 교체 시 배럴(`hooks/ops/index.ts:5`)도 함께 갱신. 외부 URL 경로(`getOpsBaseUrl`/`openExternalUrl` 사용부)는 이 ActionCard에서 제거하되 상수/유틸 자체는 보존(모니터·플레이어뷰 링크 등 타 사용처 실측 후 판단 — 무단 삭제 금지).
- [ ] **Step 5: GREEN** — 해당 jest PASS + `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat(ops): 1e 진입점 — 생성 폼 공고연결·목록 필터·공고 상세 인앱 전환(N:1)`

---

### Task 10: 최종 전체 검증 게이트 (코드 없음)

- [ ] **Step 1: DB 전체** — `npm run db:reset && npm run test:db:helpers && npx supabase test db` → 전건 PASS(신규 4 테스트 파일 + 기존 전건, 출력 원문 보존).
- [ ] **Step 2: 타입/테스트/품질** — `npx tsc --noEmit`(EXIT 0) · `npx jest`(전건 PASS, 통계 기록) · `npm run quality`(EXIT 0).
- [ ] **Step 3: 스펙 체크리스트** — 스펙 §0~§7 각 항목 vs 구현 대조표 작성(갭 있으면 태스크 추가). 특히: anon SECDEF 2개 불변 pgTAP 증거 / work_logs 무변이(신규 RPC에 work_logs INSERT/UPDATE/DELETE 없음 grep) / 기존 마이그 무수정(`git diff --stat origin/master -- supabase/migrations`에 신규 3파일만).
- [ ] **Step 4: 커밋 정리 확인** — 태스크별 커밋 존재, 커밋 메시지 한글 컨벤션.

**이 계획의 종료선**: Task 10까지 로컬 GREEN이 끝. **prod 마이그 적용(MCP apply_migration)·push·PR·배포는 계획 밖 — 사용자 "go" 게이트**(스펙 §8: apply 3종 → advisors ERROR 0 + anon SECDEF 2개 실측 → push+PR → CI 9종 → squash).
