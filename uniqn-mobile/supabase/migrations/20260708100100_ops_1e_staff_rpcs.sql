-- 라이브 운영(ops) 1e M2(전반) — 변이 SECDEF RPC 2종: 공고 연결/변경/해제 + 확정 스태프 스냅샷 import.
-- 스펙: docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md §5.1 4·5항.
-- 공통 규약(1a_rpcs 헤더 관례 — 20260625120200_ops_1a_rpcs.sql:1-12 계승):
--   · search_path = public, extensions, pg_temp
--   · actor 가드: auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM p_actor AND NOT is_admin())
--   · 대회 로드는 FOR UPDATE(advisory lock 뒤 — ops_1f 데드락 견고화 패턴 계승, hashtext 잠금 우선)
--   · 모든 비즈니스 RAISE 는 ERRCODE='P0001' (Repository.mapOpsRpcError 매핑)
--   · 권한(REVOKE anon / GRANT authenticated,service_role)은 Task 4 grants 마이그레이션에서 처리.
-- ops_tournaments.updated_at 은 trg_ops_tournaments_set_updated_at(BEFORE UPDATE 트리거,
--   20260625120000:103-106)가 자동 갱신 — RPC 본문에서 명시 SET 불필요(ops_update_tournament 현행과 동형).
--
-- 1) ops_set_tournament_posting — 대회↔공고 연결 N:1 재편. 변경은 owner 전용(is_ops_member 분기를 바꾸는 조작).
--    공고 접근 게이트는 ops_create_tournament(20260625120200:43-57)와 동일 3분기(owner_id/workspace 멤버/admin).
-- 2) ops_import_staff_from_posting — 확정 스태프(work_logs) 스냅샷을 ops_staff 로 1회성 복사.
--    SSOT=work_logs(읽기 전용, §2.2) — DISTINCT ON(staff_id) ORDER BY date DESC, created_at DESC 로 최신 배정만 채택.
--    ON CONFLICT (tournament_id, staff_id) DO NOTHING → 재실행 멱등(skipped 로 반영).

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
    -- ops_create_tournament의 공고 게이트(20260625120200:43-57)와 동일 조건
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

-- 3) ops_add_staff — 로스터 수동 추가(가입자 검색 결과 기반). 이름 스냅샷 방식은 import 경로와 동형.
--    롤 게이트(SEC-1): search_users_by_phone(20260629000000:47-51)과 신뢰경계 일치 — 열거/하베스팅 방지.
-- 4) ops_remove_staff — 로스터 제거 + cascade-clear(배정 중이던 ops_tables.assigned_staff_id 선해제).
-- 5) ops_assign_table_staff — 딜러 테이블 배정. move 시맨틱(같은 스태프 재배정 시 이전 테이블 자동 해제),
--    NULL 배정=해제(멱등). 로스터 멤버십 강제(STAFF_NOT_IN_ROSTER), 역할은 비강제.

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
