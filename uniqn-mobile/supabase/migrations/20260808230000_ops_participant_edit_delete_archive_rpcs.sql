-- ops 결함③ — 참가자 정정 / 오등록 제거 / 대회 아카이브 RPC 3종.
--
-- 배경: 참가자 수정·삭제 RPC 가 0개라 **이름 오타조차 고칠 수 없었다**. 대회 delete RPC·UI 도
--   없어 테스트로 만든 대회가 목록에 영구 잔존한다(prod 의 대회 1건이 그 사례).
-- 이벤트 타입 4종 + archived_at 컬럼은 20260808220000 에서 선행 추가.
-- 계약: anon-executable ops SECDEF = **2 유지**(monitor/player) — 3종 모두 PUBLIC/anon 명시 REVOKE.
-- 파리티: 신규 함수 3개 → 203 → **206**. 정책 변경 0 → 111 불변.
-- 회귀 고정: supabase/tests/ops_participant_edit_delete_archive.test.sql

-- ============================================================
-- 1) ops_update_participant — 등록 정보 정정
-- ============================================================
-- 설계:
--  · **상태 게이트 없음.** 오타는 어느 상태에서도 고쳐야 한다(busted 참가자의 이름이 틀렸다고
--    영영 못 고칠 이유가 없다). 대회 status 게이트도 없음 — ops_set_participant_chips 파리티.
--  · 세 필드를 **그대로 덮어쓴다**(폼이 현재 값을 프리필해 전체를 보낸다). nationality/phone 의
--    NULL 은 "지우기"다 — "변경 없음"과 "지우기"를 한 인자로 구분하려면 센티널이 필요한데,
--    센티널은 그 자체가 함정이 된다(빈 문자열이 센티널로 오인되는 계열의 버그).
--  · XSS 패턴을 서버에서 재판정한다 — ops_participants 에는 work_logs_xss_check 같은
--    트리거 계층이 없다(2026-08-08 확인). 클라 zod 만이 유일 방어면 RPC 직접 호출에 뚫린다.
CREATE OR REPLACE FUNCTION public.ops_update_participant(
  p_participant_id uuid,
  p_actor_id uuid,
  p_name text,
  p_nationality text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_p record;
  v_name text;
  v_nat  text;
  v_phone text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 순수 인자 검증 — 행 잠금 전에(잠금 보유 시간 최소화)
  v_name  := btrim(COALESCE(p_name, ''));
  v_nat   := NULLIF(btrim(COALESCE(p_nationality, '')), '');
  v_phone := NULLIF(btrim(COALESCE(p_phone, '')), '');

  IF length(v_name) = 0 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'PARTICIPANT_NAME_INVALID: 이름은 1~100자여야 합니다 (길이=%)', length(v_name)
      USING ERRCODE = 'P0001';
  END IF;
  IF length(COALESCE(v_nat, '')) > 50 THEN
    RAISE EXCEPTION 'PARTICIPANT_NATIONALITY_INVALID: 국적은 50자 이하여야 합니다'
      USING ERRCODE = 'P0001';
  END IF;
  IF length(COALESCE(v_phone, '')) > 30 THEN
    RAISE EXCEPTION 'PARTICIPANT_PHONE_INVALID: 연락처는 30자 이하여야 합니다'
      USING ERRCODE = 'P0001';
  END IF;
  -- 패턴은 update_work_log_custom_settlement 의 사유 검증과 **같은 값**으로 맞춘다(단일 소스
  -- 부재를 값 동기화로 메우는 그 함수의 선례를 따른다).
  IF concat_ws(' ', v_name, v_nat, v_phone)
       ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    RAISE EXCEPTION 'PARTICIPANT_TEXT_INVALID: 허용되지 않는 문자가 포함되어 있습니다'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, name, nationality, phone
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 멱등 no-op — 프리필 폼은 무변경 저장이 흔하고, 그때마다 이벤트가 쌓이면 감사 로그가 썩는다.
  IF v_p.name IS NOT DISTINCT FROM v_name
     AND v_p.nationality IS NOT DISTINCT FROM v_nat
     AND v_p.phone IS NOT DISTINCT FROM v_phone THEN
    RETURN jsonb_build_object('participant_id', p_participant_id, 'name', v_p.name,
                              'nationality', v_p.nationality, 'phone', v_p.phone,
                              'changed', false);
  END IF;

  UPDATE public.ops_participants
     SET name = v_name, nationality = v_nat, phone = v_phone
   WHERE id = p_participant_id;

  -- before/after 를 함께 남긴다 — 정정 분쟁에서 "원래 뭐였나"가 유일한 근거다.
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_updated'::public.ops_event_type, p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'name_before', v_p.name,        'name_after', v_name,
                             'nationality_before', v_p.nationality, 'nationality_after', v_nat,
                             'phone_before', v_p.phone,      'phone_after', v_phone));

  RETURN jsonb_build_object('participant_id', p_participant_id, 'name', v_name,
                            'nationality', v_nat, 'phone', v_phone, 'changed', true);
END;
$$;

-- ============================================================
-- 2) ops_delete_participant — 오등록 제거(비가역)
-- ============================================================
-- 왜 소프트가 아니라 hard DELETE 인가:
--   fn_ops_recompute_live_stats 는 `entries = count(*)` (상태 무관)이고
--   `prize_pool = (entries + reentries) × buy_in_cost + …` 다. 즉 오등록 1건이 **운영자가
--   화면에서 보는 상금 풀을 바이인 1건만큼 부풀린다.** 노쇼 표시(결함②)로는 빠지지 않는다 —
--   노쇼는 돈을 냈고 안 온 것이므로 entries 에 남는 게 **맞다**. 오등록은 애초에 없어야 하는 행이다.
--   소프트 컬럼으로 빼려면 상금 풀 계산의 정본 함수를 고쳐야 하고, 그 함수는 전광판·플레이어뷰·
--   KO풀까지 경유하므로 회귀 범위가 훨씬 넓다.
--
-- 안전은 **게이트의 좁음**으로 확보한다 — 한 판도 안 뛴 등록만 지울 수 있다:
--   status ∈ (checked_in, no_show) · rebuys/add_ons/reentries/knockouts = 0
--   · prize_amount IS NULL · buy_in_amount 미기재(NULL 또는 0) · 좌석 미점유
--   → 하나라도 어긋나면 P0001. 실참가자를 실수로 지울 수 없다.
--
-- 물리적 안전(2026-08-08 실측): ops_seats_participant_id_fkey 는 **ON DELETE SET NULL** 이라
--   좌석이 자동 해제되고, ops_events 에는 참가자 FK 가 없어 append-only 트리거와 충돌하지 않는다.
--   trg_ops_participants_recompute_stats 는 AFTER **DELETE** 도 커버하므로 entries·prize_pool 이
--   커밋 시 자동 재계산된다.
-- entry_number 는 빈 번호가 생긴다 — next_entry_seq 할당자는 번호를 재사용하지 않으므로
--   "그 엔트리는 무효였다"가 정직한 표현이다(재번호 부여가 오히려 기록을 왜곡한다).
CREATE OR REPLACE FUNCTION public.ops_delete_participant(
  p_participant_id uuid,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_p record;
  v_seats int;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, tournament_id, entry_number, name, status, chips,
         rebuys, add_ons, reentries, knockouts, prize_amount, buy_in_amount, player_user_id
    INTO v_p
    FROM public.ops_participants
    WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(v_p.tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_p.status NOT IN ('checked_in', 'no_show') THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_REMOVABLE: 대기/노쇼 참가자만 삭제할 수 있습니다 (status=%) — 진행 중인 참가자는 탈락 처리를 사용하세요',
      v_p.status USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_p.rebuys, 0) <> 0 OR COALESCE(v_p.add_ons, 0) <> 0
     OR COALESCE(v_p.reentries, 0) <> 0 OR COALESCE(v_p.knockouts, 0) <> 0
     OR v_p.prize_amount IS NOT NULL OR COALESCE(v_p.buy_in_amount, 0) <> 0 THEN
    RAISE EXCEPTION 'PARTICIPANT_HAS_HISTORY: 플레이 이력이 있는 참가자는 삭제할 수 없습니다 (리바이 % · 애드온 % · 재진입 % · KO % · 상금 % · 바이인 %) — 탈락 처리를 사용하세요',
      COALESCE(v_p.rebuys, 0), COALESCE(v_p.add_ons, 0), COALESCE(v_p.reentries, 0),
      COALESCE(v_p.knockouts, 0), COALESCE(v_p.prize_amount::text, 'none'),
      COALESCE(v_p.buy_in_amount, 0) USING ERRCODE = 'P0001';
  END IF;

  -- 좌석 점유는 FK SET NULL 로 조용히 풀린다 — 조용한 좌석 해제는 사고이므로 먼저 접는다.
  SELECT count(*) INTO v_seats FROM public.ops_seats WHERE participant_id = p_participant_id;
  IF v_seats > 0 THEN
    RAISE EXCEPTION 'PARTICIPANT_SEATED: 좌석을 점유한 참가자는 삭제할 수 없습니다 (좌석 %개) — 좌석 비우기를 먼저 사용하세요',
      v_seats USING ERRCODE = 'P0001';
  END IF;

  -- 🔑 이벤트를 **먼저** append 한다. 행이 사라진 뒤에는 스냅샷을 만들 수 없고,
  --    ops_events 는 append-only 라 이 행이 삭제 사실의 유일한 영구 기록이 된다.
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_p.tournament_id, 'player_deleted'::public.ops_event_type, p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'entry_number', v_p.entry_number,
                             'name', v_p.name,
                             'status_before', v_p.status,
                             'chips', v_p.chips,
                             'was_claimed', (v_p.player_user_id IS NOT NULL)));

  DELETE FROM public.ops_participants WHERE id = p_participant_id;

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'entry_number', v_p.entry_number,
                            'name', v_p.name, 'deleted', true);
END;
$$;

-- ============================================================
-- 3) ops_set_tournament_archived — 대회 보관/복원(undo-first)
-- ============================================================
-- 설계:
--  · 권한은 `is_ops_member` 로 둔다 — 워크스페이스 멤버가 만든 테스트 대회를 소유자만 치울 수
--    있으면 정리가 막힌다. 안전은 **상태 게이트**로 확보한다.
--  · **active 대회는 보관 거부.** 진행 중인 대회를 목록에서 치우는 것은 사고다.
--    복원(false)은 상태 무관 허용 — 되돌리는 방향은 언제나 열어 둔다(undo-first).
--  · 멱등 no-op(이미 목표 상태면 이벤트 0행).
CREATE OR REPLACE FUNCTION public.ops_set_tournament_archived(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_archived boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_t record;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'ARCHIVE_FLAG_INVALID: 보관 여부(true/false)를 지정해야 합니다'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, status, archived_at
    INTO v_t
    FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  IF (p_archived AND v_t.archived_at IS NOT NULL)
     OR (NOT p_archived AND v_t.archived_at IS NULL) THEN
    RETURN jsonb_build_object('tournament_id', p_tournament_id,
                              'archived_at', v_t.archived_at, 'changed', false);
  END IF;

  IF p_archived AND v_t.status = 'active' THEN
    RAISE EXCEPTION 'TOURNAMENT_ACTIVE: 진행 중인 대회는 보관할 수 없습니다 — 먼저 대회를 종료하세요'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments
     SET archived_at = (CASE WHEN p_archived THEN v_now ELSE NULL END)
   WHERE id = p_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (p_tournament_id,
          (CASE WHEN p_archived THEN 'tournament_archived'
                ELSE 'tournament_archive_undone' END)::public.ops_event_type,
          p_actor_id,
          jsonb_build_object('status', v_t.status,
                             'archived_at', (CASE WHEN p_archived THEN v_now ELSE NULL END)));

  RETURN jsonb_build_object('tournament_id', p_tournament_id,
                            'archived_at', (CASE WHEN p_archived THEN v_now ELSE NULL END),
                            'changed', true);
END;
$$;

-- ── 소유자 · 권한 (anon =2 계약 보존) ──────────────────────
ALTER FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.ops_delete_participant(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.ops_delete_participant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_delete_participant(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_delete_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_delete_participant(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.ops_update_participant(uuid, uuid, text, text, text) IS
  '참가자 등록 정보 정정(이름/국적/연락처) — ops 결함③. 상태 게이트 없음(오타는 어느 상태에서도 '
  '고쳐야 한다). 세 필드를 그대로 덮어쓴다(NULL=지우기). XSS 패턴을 서버가 재판정한다 — '
  'ops_participants 에는 트리거 계층이 없다. before/after 를 이벤트에 함께 남긴다.';

COMMENT ON FUNCTION public.ops_delete_participant(uuid, uuid) IS
  '오등록 참가자 제거(비가역) — ops 결함③. entries=count(*) 이고 prize_pool 이 entries 에 '
  '비례하므로 오등록은 상금 풀을 부풀린다(노쇼로는 안 빠진다 — 노쇼는 돈을 냈다). '
  '게이트: checked_in|no_show + 리바이·애드온·재진입·KO·상금·바이인 전부 0/NULL + 좌석 미점유. '
  '삭제 전에 player_deleted 이벤트로 스냅샷을 남긴다(append-only 라 그것이 유일한 영구 기록).';

COMMENT ON FUNCTION public.ops_set_tournament_archived(uuid, uuid, boolean) IS
  '대회 보관/복원(undo-first) — ops 결함③. hard DELETE 는 ops_events append-only 트리거와 '
  '충돌해 물리적으로 불가능하므로 이것이 "치우기"의 유일한 경로다. archived_at 은 status 와 '
  '직교(원래 상태 보존). active 대회 보관은 거부, 복원은 상태 무관 허용.';
