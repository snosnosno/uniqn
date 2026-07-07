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
