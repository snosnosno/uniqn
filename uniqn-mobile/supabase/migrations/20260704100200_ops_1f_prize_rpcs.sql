-- OPS 1f M3 — 상금 RPC: bust v2(eliminator/flat KO)·ops_undo_bust·ops_correct_participant_prize·
--   create/update bounty_cost 확장·공개 스냅샷 2종 확장(knockoutPool·knockouts/bountyAccrued).
-- 골격: 20260630120100_ops_1d_bust_reenter_prize_rpcs.sql. enum 값(player_bust_undone/prize_corrected)은
--   M1(별도 txn)에서 추가됨. 권한은 M4(20260704100300)에서 처리.
-- 락 불변식: advisory → 대회 FOR UPDATE → 참가자 FOR UPDATE(복수면 id 오름차순) → 좌석.
--   LS 트리거는 M2 로 DEFERRED — eliminator 행 추가 잠금이 LS-ABBA 표면을 넓히지 않음(설계 시너지).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) ops_bust_participant v2 — 구 2인자 명시 DROP(오버로딩 우회 차단, STEP A D6 관례) 후 3인자 CREATE.
--    기존 로직 전체 보존(가드 순서·finish_position 산정·ITM 매핑·좌석 해제·우승 자동확정·반환 형태).
--    변경분: eliminator 가드 4종·참가자 2행 id asc 잠금·knockouts 적립·payload 3필드.
DROP FUNCTION IF EXISTS public.ops_bust_participant(uuid, uuid);

CREATE FUNCTION public.ops_bust_participant(
  p_participant_id uuid,
  p_actor_id uuid,
  p_eliminator_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_status public.ops_participant_status;
  v_t_status public.ops_tournament_status;
  v_chips_before int;
  v_elim_status public.ops_participant_status;
  v_elim_tid uuid;
  v_active int;
  v_used_count int;
  v_finish int;
  v_prize int;
  v_active2 int;
  v_checked_in int;
  v_winner uuid;
  v_winner_prize int;
  v_seat_id uuid;
  v_freed_seat_id uuid;
  v_winner_json jsonb;
BEGIN
  -- 1) actor 가드 (v1 보존)
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금) — advisory 락을 행 잠금보다 먼저 취득(v1 보존)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 (v1 보존)
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 검사 (v1 보존)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중(active) 대회만 탈락 처리 가능 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) [1f] eliminator 자기자신 가드 — 순수 인자 비교라 행 잠금 전 판정(표면은 락 이후와 동일)
  IF p_eliminator_id IS NOT NULL AND p_eliminator_id = p_participant_id THEN
    RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(자기 자신)' USING ERRCODE = 'P0001';
  END IF;

  -- 6) 참가자 행 잠금 — 대상(+eliminator) id 오름차순 FOR UPDATE(락 불변식 '참가자' 항 복수 일반화)
  IF p_eliminator_id IS NOT NULL THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, p_eliminator_id)
      ORDER BY id FOR UPDATE;
  END IF;

  -- 대상 status/chips 확인 — v1 검사 순서 보존(에러 메시지/순서 무회귀). 6)에서 잠금 보유 시 재잠금 무해.
  SELECT status, chips INTO v_status, v_chips_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_status = 'busted' THEN
    RAISE EXCEPTION 'PARTICIPANT_ALREADY_BUSTED: 이미 탈락 처리된 참가자입니다' USING ERRCODE = 'P0001';
  ELSIF v_status <> 'active' THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_ACTIVE: 활성 참가자만 탈락 처리 가능 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) [1f] eliminator 가드: 존재+같은 대회(미존재·타대회 동일 처리)·active.
  --    비-바운티 대회에서도 지정 가능(기록만 — 적립 표시는 클라가 bounty_cost 유무로 게이트).
  IF p_eliminator_id IS NOT NULL THEN
    SELECT status, tournament_id INTO v_elim_status, v_elim_tid
      FROM public.ops_participants WHERE id = p_eliminator_id;
    IF v_elim_tid IS NULL OR v_elim_tid <> v_tournament_id THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다' USING ERRCODE = 'P0001';
    END IF;
    IF v_elim_status <> 'active' THEN
      RAISE EXCEPTION 'ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다(비활성)' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 8) 생존수 + 마지막 생존자 가드 (v1 보존)
  SELECT count(*) INTO v_active FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  IF v_active <= 1 THEN
    RAISE EXCEPTION 'PARTICIPANT_LAST_SURVIVOR: 마지막 생존자는 탈락 처리할 수 없습니다(우승 처리 대상)'
      USING ERRCODE = 'P0001';
  END IF;

  -- 9) finish_position = 생존수 이상 최소 미사용 순위 (v1 보존)
  SELECT count(*) INTO v_used_count FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND finish_position IS NOT NULL;
  SELECT g INTO v_finish
    FROM generate_series(v_active, v_active + v_used_count) AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND finish_position = g)
    ORDER BY g LIMIT 1;

  -- 10) prize 매핑 (v1 보존)
  SELECT amount INTO v_prize FROM public.ops_prizes
    WHERE tournament_id = v_tournament_id AND rank = v_finish;

  -- 11) 변이 (v1 보존)
  UPDATE public.ops_participants
    SET status = 'busted', busted_at = now(), finish_position = v_finish,
        prize_amount = v_prize, chips = 0
    WHERE id = p_participant_id;

  -- 11-b) [1f] eliminator KO 적립
  IF p_eliminator_id IS NOT NULL THEN
    UPDATE public.ops_participants SET knockouts = knockouts + 1 WHERE id = p_eliminator_id;
  END IF;

  -- 12) 좌석 해제 (v1 보존) + [1f] freed_seat_id 기록(복수면 첫 좌석 — 단일점유 불변식상 실제 최대 1)
  v_freed_seat_id := NULL;
  FOR v_seat_id IN
    SELECT id FROM public.ops_seats
    WHERE participant_id = p_participant_id ORDER BY id FOR UPDATE
  LOOP
    UPDATE public.ops_seats SET participant_id = NULL WHERE id = v_seat_id;
    IF v_freed_seat_id IS NULL THEN
      v_freed_seat_id := v_seat_id;
    END IF;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'seat_freed', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'seat_id', v_seat_id));
  END LOOP;

  -- 13) 이벤트 — [1f] payload 3필드 확장(chips_before/eliminator_id/freed_seat_id = undo 복원 소스)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_busted', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'finish_position', v_finish, 'prize_amount', v_prize,
                             'chips_before', v_chips_before,
                             'eliminator_id', p_eliminator_id,
                             'freed_seat_id', v_freed_seat_id));
  IF v_prize IS NOT NULL THEN
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
            jsonb_build_object('participant_id', p_participant_id, 'rank', v_finish, 'amount', v_prize));
  END IF;

  -- 14) 우승 자동확정 (v1 보존 + [🔨H12] 보류 가드: checked_in 생존자가 있으면 확정 보류.
  --     undo/register/reenter 의 무좌석 폴백이 만든 checked_in 을 무시하고 completed 확정하면
  --     그 참가자는 fp NULL 고아(재bust 불가·D2 로 undo 불가·correct 는 fp NULL 거부) — 구제 불가.
  --     보류 시 운영자는 checked_in 을 착석(active 승급)시킨 뒤 진행하면 다음 bust 에서 재평가.)
  SELECT count(*) INTO v_active2 FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'active';
  SELECT count(*) INTO v_checked_in FROM public.ops_participants
    WHERE tournament_id = v_tournament_id AND status = 'checked_in';
  v_winner_json := NULL;
  IF v_active2 = 1 AND v_checked_in = 0 THEN
    SELECT id INTO v_winner FROM public.ops_participants
      WHERE tournament_id = v_tournament_id AND status = 'active' FOR UPDATE;
    SELECT amount INTO v_winner_prize FROM public.ops_prizes
      WHERE tournament_id = v_tournament_id AND rank = 1;
    UPDATE public.ops_participants
      SET finish_position = 1, prize_amount = v_winner_prize WHERE id = v_winner;
    UPDATE public.ops_tournaments SET status = 'completed' WHERE id = v_tournament_id;
    INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
    VALUES (v_tournament_id, 'tournament_status_changed', p_actor_id,
            jsonb_build_object('from', 'active', 'to', 'completed', 'reason', 'winner_finalized'));
    IF v_winner_prize IS NOT NULL THEN
      INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
      VALUES (v_tournament_id, 'prize_assigned', p_actor_id,
              jsonb_build_object('participant_id', v_winner, 'rank', 1, 'amount', v_winner_prize));
    END IF;
    v_winner_json := jsonb_build_object('participant_id', v_winner,
                                        'finish_position', 1, 'prize_amount', v_winner_prize);
  END IF;

  -- 15) 반환 (v1 보존 — winner_finalized 는 H12 보류 반영)
  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'finish_position', v_finish,
    'prize_amount', v_prize,
    'winner_finalized', (v_active2 = 1 AND v_checked_in = 0),
    'winner', v_winner_json);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) ops_undo_bust — 오조작 bust 원상 복구(D2: active 중에만·completed 재개방 없음).
--    재진입과 구분: reentries 불변·칩=bust 직전 값 복원·registration_open 무관·KO 롤백.
--    복원 소스 = 최신 player_busted 이벤트(append-only 불변 → 행 잠금 전 조회 안전.
--    eliminator id 를 먼저 알아야 두 참가자 행을 id 오름차순으로 잠글 수 있음 — 4.1 규약 유지).
CREATE FUNCTION public.ops_undo_bust(
  p_participant_id uuid,
  p_actor_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_t_status public.ops_tournament_status;
  v_status public.ops_participant_status;
  v_payload jsonb;
  v_chips_before int;
  v_elim_id uuid;
  v_bust_seat_id uuid;
  v_seat_id uuid;
  v_seat_restored text;
  v_new_status public.ops_participant_status;
  v_seated boolean;
  v_table_no int;
  v_seat_no int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 1d 3종·bust v2 와 동일 순서.
  --    비멤버가 INVALID_STATUS/PERMISSION_DENIED 차등으로 대회 status 를 판별하는 오라클 차단 +
  --    비멤버는 advisory·행 잠금을 점유하지 않음]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active 한정(D2 — 우승확정 후 completed 면 여기서 차단)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status <> 'active' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 진행 중 대회에서만 탈락 취소가 가능합니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 복원 소스 = 최신 player_busted 이벤트(무잠금 조회 — append-only 불변).
  --    bust→reenter→재bust 이력에서도 "현재 busted = 최신 bust 이벤트" 대응 성립.
  --    [🔨H11] 정렬은 seq(IDENTITY 전순서) — created_at 은 now()=txn 시작 고정이라 동률 비결정.
  SELECT payload INTO v_payload FROM public.ops_events
    WHERE tournament_id = v_tournament_id AND type = 'player_busted'
      AND (payload->>'participant_id')::uuid = p_participant_id
    ORDER BY seq DESC LIMIT 1;
  v_chips_before := COALESCE((v_payload->>'chips_before')::int, 0);  -- E2 fail-safe(구 payload/이론상 부재)
  v_elim_id      := (v_payload->>'eliminator_id')::uuid;
  v_bust_seat_id := (v_payload->>'freed_seat_id')::uuid;

  -- 6) 참가자(+eliminator) id 오름차순 FOR UPDATE(4.1 규약) → busted 검사
  IF v_elim_id IS NOT NULL AND v_elim_id <> p_participant_id THEN
    PERFORM 1 FROM public.ops_participants
      WHERE id IN (p_participant_id, v_elim_id)
      ORDER BY id FOR UPDATE;
  END IF;
  SELECT status INTO v_status
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_status <> 'busted' THEN
    RAISE EXCEPTION 'UNDO_INVALID_STATE: 탈락 상태의 참가자만 취소할 수 있습니다 (status=%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7) KO 롤백 — GREATEST 0(CHECK 위반 방어). eliminator 가 그 사이 busted 여도 카운트만 감소(정합).
  IF v_elim_id IS NOT NULL THEN
    UPDATE public.ops_participants
      SET knockouts = GREATEST(knockouts - 1, 0) WHERE id = v_elim_id;
  END IF;

  -- 8) 좌석 3분기: ①원좌석(존재·비점유·open·unlocked) ②auto-seat(빈좌석 첫 자리 —
  --    auto_seat_on_register 설정과 무관하게 항상 시도: undo 는 "물리적으로 앉아 있던 사람"의 복구)
  --    ③빈좌석 없으면 무좌석. SKIP LOCKED = reenter 와 동일 패턴(경합 시 다음 분기 폴백).
  v_seat_id := NULL;
  v_seat_restored := 'none';
  IF v_bust_seat_id IS NOT NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.id = v_bust_seat_id AND s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'original';
    END IF;
  END IF;
  IF v_seat_id IS NULL THEN
    SELECT s.id INTO v_seat_id
      FROM public.ops_seats s
      JOIN public.ops_tables t ON t.id = s.table_id
      WHERE s.tournament_id = v_tournament_id
        AND s.participant_id IS NULL
        AND t.status = 'open' AND t.lock_type = 'none'
      ORDER BY s.table_no, s.seat_no
      LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
    IF v_seat_id IS NOT NULL THEN
      v_seat_restored := 'auto';
    END IF;
  END IF;
  v_seated := v_seat_id IS NOT NULL;
  v_new_status := CASE WHEN v_seated THEN 'active'::public.ops_participant_status
                       ELSE 'checked_in'::public.ops_participant_status END;

  -- 9) 참가자 복원
  UPDATE public.ops_participants
    SET status = v_new_status, chips = v_chips_before,
        finish_position = NULL, busted_at = NULL, prize_amount = NULL
    WHERE id = p_participant_id;

  IF v_seated THEN
    UPDATE public.ops_seats SET participant_id = p_participant_id WHERE id = v_seat_id;
    SELECT table_no, seat_no INTO v_table_no, v_seat_no
      FROM public.ops_seats WHERE id = v_seat_id;
  END IF;

  -- 10) 이벤트 + 반환
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'player_bust_undone', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'restored_chips', v_chips_before,
                             'eliminator_id', v_elim_id,
                             'seat_restored', v_seat_restored));

  RETURN jsonb_build_object(
    'participant_id', p_participant_id,
    'restored_chips', v_chips_before,
    'status', v_new_status,
    'seated', v_seated,
    'table_no', v_table_no,
    'seat_no', v_seat_no);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) ops_correct_participant_prize — 개인 지급액 정정(소급)·회수(D3: completed 후에도 허용).
--    순위·상태·구조(ops_prizes) 불변. p_amount NULL = 회수("수상 아님" 복귀), 0 이상 = 설정
--    (기존 NULL 이어도 부여 가능 — 비ITM자 수동 지급 포함). no-op 도 이벤트 기록(감사 명료성).
--    재진입 상호작용(의도): 정정 후 reenter 하면 prize_amount NULL 리셋(1d 계약 유지) — 이력은 이벤트 원장에만.
CREATE FUNCTION public.ops_correct_participant_prize(
  p_participant_id uuid,
  p_actor_id uuid,
  p_amount int DEFAULT NULL,
  p_reason text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_t_status public.ops_tournament_status;
  v_fp int;
  v_before int;
BEGIN
  -- 1) actor 가드
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 2) tournament_id 선취(비잠금)
  SELECT tournament_id INTO v_tournament_id
    FROM public.ops_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND: 참가자를 찾을 수 없습니다 (%)', p_participant_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3) 멤버십 [🔨H1: status 검사·advisory 보다 먼저 — 에러 차등 오라클 차단·1d 일관, §4.2 와 동일 근거]
  IF NOT (public.is_ops_member(v_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  -- 4) advisory → 대회 FOR UPDATE + active/completed 허용(upcoming 거부)
  PERFORM pg_advisory_xact_lock(hashtext('ops_tournament_' || v_tournament_id::text)::bigint);
  SELECT status INTO v_t_status FROM public.ops_tournaments
    WHERE id = v_tournament_id FOR UPDATE;
  IF v_t_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 시작 전 대회에는 정정할 상금이 없습니다 (status=%)', v_t_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5) 참가자 FOR UPDATE + 정산 대상(fp NOT NULL = busted 또는 확정 우승자)만
  SELECT finish_position, prize_amount INTO v_fp, v_before
    FROM public.ops_participants WHERE id = p_participant_id FOR UPDATE;
  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 순위가 확정된 참가자만 정정할 수 있습니다'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6) 값 검증
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 금액은 0 이상이어야 합니다' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 200 THEN
    RAISE EXCEPTION 'PRIZE_CORRECTION_INVALID: 사유는 200자 이내여야 합니다' USING ERRCODE = 'P0001';
  END IF;

  -- 7) 변이(no-op 도 이벤트는 기록)
  UPDATE public.ops_participants SET prize_amount = p_amount WHERE id = p_participant_id;

  -- 8) 이벤트(p_reason 은 payload 에만 저장 — 공개 표면 미노출)
  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'prize_corrected', p_actor_id,
          jsonb_build_object('participant_id', p_participant_id,
                             'amount_before', v_before, 'amount_after', p_amount,
                             'reason', p_reason));

  RETURN jsonb_build_object('participant_id', p_participant_id,
                            'amount_before', v_before, 'amount_after', p_amount);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) ops_create_tournament — bounty_cost 세팅 경로 추가(CREATE OR REPLACE, 시그니처 불변 → GRANT 보존).
--    [1f 변경 2곳] ① INSERT 컬럼 목록 addon_cost 뒤 bounty_cost ② VALUES 에 (p_config->>'bounty_cost')::int
--    (⚠️ COALESCE 없음 — NULL = 비-바운티 유지. 음수는 M1 CHECK 가 차단). 나머지 1a 원문 그대로.
CREATE OR REPLACE FUNCTION public.ops_create_tournament(
  p_owner_id uuid,
  p_name text,
  p_venue text,
  p_event_date date,
  p_game_type text,
  p_job_posting_id uuid,
  p_starting_chips int,
  p_seats_per_table int,
  p_config jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_jp record;
BEGIN
  -- [보안] 호출자 바인딩: p_owner_id 는 호출자 본인(또는 admin).
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_owner_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  -- 공고 연동 시: 호출자가 해당 공고를 관리할 수 있어야 함.
  IF p_job_posting_id IS NOT NULL THEN
    SELECT id, owner_id, workspace_id INTO v_jp
      FROM public.job_postings WHERE id = p_job_posting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 공고를 찾을 수 없습니다 (%)', p_job_posting_id
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (
      v_jp.owner_id = p_owner_id
      OR public.is_workspace_member(v_jp.workspace_id, p_owner_id)
      OR public.is_admin()
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: 공고 관리 권한 없음' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.ops_tournaments (
    owner_id, job_posting_id, name, venue, event_date, game_type,
    status, seats_per_table, starting_chips,
    buy_in_chips, rebuy_chips, addon_chips,
    buy_in_cost, fee_cost, rebuy_cost, addon_cost, bounty_cost
  ) VALUES (
    p_owner_id, p_job_posting_id, p_name, p_venue, p_event_date,
    COALESCE(NULLIF(p_game_type, ''), 'NLH'),
    'upcoming', COALESCE(p_seats_per_table, 9), COALESCE(p_starting_chips, 0),
    COALESCE((p_config->>'buy_in_chips')::int, 0),
    COALESCE((p_config->>'rebuy_chips')::int, 0),
    COALESCE((p_config->>'addon_chips')::int, 0),
    COALESCE((p_config->>'buy_in_cost')::int, 0),
    COALESCE((p_config->>'fee_cost')::int, 0),
    COALESCE((p_config->>'rebuy_cost')::int, 0),
    COALESCE((p_config->>'addon_cost')::int, 0),
    (p_config->>'bounty_cost')::int    -- [1f] COALESCE 없음: NULL = 비-바운티(0 과 구분)
  ) RETURNING id INTO v_tournament_id;

  INSERT INTO public.ops_events (tournament_id, type, actor_id, payload)
  VALUES (v_tournament_id, 'tournament_created', p_owner_id,
          jsonb_build_object('name', p_name));

  RETURN jsonb_build_object('tournament_id', v_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) ops_update_tournament — bounty_cost 패치 추가(CREATE OR REPLACE, 시그니처 불변 → GRANT 보존).
--    [1f 변경 1곳] UPDATE SET addon_cost 다음 bounty_cost 만 key-presence 분기(COALESCE 로는 NULL
--    되돌리기 불가): 키 없음=유지, {"bounty_cost":null}=NULL 설정, {"bounty_cost":5000}=값 설정.
--    나머지 1a 원문 그대로.
CREATE OR REPLACE FUNCTION public.ops_update_tournament(
  p_tournament_id uuid,
  p_actor_id uuid,
  p_patch jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_actor_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 호출자 인증 불일치' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.ops_tournaments
    WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND: 대회를 찾을 수 없습니다 (%)', p_tournament_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.is_ops_member(p_tournament_id, p_actor_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 대회 관리 권한 없음' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ops_tournaments SET
    name            = COALESCE(p_patch->>'name', name),
    venue           = COALESCE(p_patch->>'venue', venue),
    event_date      = COALESCE((p_patch->>'event_date')::date, event_date),
    game_type       = COALESCE(p_patch->>'game_type', game_type),
    starting_chips  = COALESCE((p_patch->>'starting_chips')::int, starting_chips),
    seats_per_table = COALESCE((p_patch->>'seats_per_table')::int, seats_per_table),
    buy_in_chips    = COALESCE((p_patch->>'buy_in_chips')::int, buy_in_chips),
    rebuy_chips     = COALESCE((p_patch->>'rebuy_chips')::int, rebuy_chips),
    addon_chips     = COALESCE((p_patch->>'addon_chips')::int, addon_chips),
    buy_in_cost     = COALESCE((p_patch->>'buy_in_cost')::int, buy_in_cost),
    fee_cost        = COALESCE((p_patch->>'fee_cost')::int, fee_cost),
    rebuy_cost      = COALESCE((p_patch->>'rebuy_cost')::int, rebuy_cost),
    addon_cost      = COALESCE((p_patch->>'addon_cost')::int, addon_cost),
    -- [1f] bounty_cost 만 key-presence 분기: COALESCE 패치로는 NULL 되돌리기(비-바운티 전환) 불가.
    bounty_cost     = CASE WHEN p_patch ? 'bounty_cost'
                           THEN (p_patch->>'bounty_cost')::int
                           ELSE bounty_cost END,
    color           = COALESCE(p_patch->>'color', color)
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object('tournament_id', p_tournament_id);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6) ops_get_monitor_snapshot — stats 에 knockoutPool 추가(비-PII 집계치 — 화이트리스트 심사 승인 D5).
--    [1f 변경 2곳] ① v_stats SELECT 끝에 knockout_pool ② stats 에 'knockoutPool' (COALESCE 없음 —
--    NULL = 비-바운티 신호 그대로 전달, 클라 카드 숨김). 나머지 1c3 원문 그대로(CREATE OR REPLACE → anon GRANT 보존).
CREATE OR REPLACE FUNCTION public.ops_get_monitor_snapshot(p_monitor_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_t     record;
  v_clock record;
  v_stats record;
  v_cur   record;
  v_next  record;
BEGIN
  IF p_monitor_token IS NULL OR char_length(p_monitor_token) < 32 THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, name, venue, event_date, game_type, status, color, registration_open
    INTO v_t
    FROM public.ops_tournaments
    WHERE monitor_token = p_monitor_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_MONITOR_TOKEN_INVALID: 유효하지 않은 모니터 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_t.id;

  SELECT playing, entries, reentries_total, tables_open, seats_total, seats_free,
         total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_t.id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_next FROM public.ops_blind_levels
    WHERE tournament_id = v_t.id AND sort = v_clock.current_level_sort + 1;

  RETURN jsonb_build_object(
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'eventDate', v_t.event_date,
      'gameType', v_t.game_type, 'status', v_t.status::text, 'color', v_t.color,
      'registrationOpen', v_t.registration_open),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'nextLevel', CASE WHEN v_next IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_next.level, 'smallBlind', v_next.small_blind, 'bigBlind', v_next.big_blind,
      'ante', v_next.ante, 'durationSec', v_next.duration_sec, 'isBreak', v_next.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'reentriesTotal', COALESCE(v_stats.reentries_total, 0), 'tablesOpen', COALESCE(v_stats.tables_open, 0),
      'seatsTotal', COALESCE(v_stats.seats_total, 0), 'seatsFree', COALESCE(v_stats.seats_free, 0),
      'totalChips', COALESCE(v_stats.total_chips, 0), 'averageStack', COALESCE(v_stats.average_stack, 0),
      'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0), 'prizePool', COALESCE(v_stats.prize_pool, 0),
      'knockoutPool', v_stats.knockout_pool),
    'serverNow', now()
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7) ops_get_player_view — me 에 knockouts·bountyAccrued 추가(본인 행 한정 — 화이트리스트 심사 승인 D5).
--    [1f 변경 3곳] ① v_p SELECT 에 knockouts ② v_t SELECT 에 bounty_cost(반환 안 함 — 적립 계산 전용)
--    ③ me 에 knockouts·bountyAccrued(=knockouts×bounty_cost, 비-바운티면 NULL). 나머지 claim_split 원문 그대로.
--    ⚠️ 시그니처 불변 → CREATE OR REPLACE(GRANT 보존, 파라미터명 변경 아님).
CREATE OR REPLACE FUNCTION public.ops_get_player_view(p_view_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_p record; v_seat record; v_t record; v_clock record; v_cur record; v_stats record;
BEGIN
  IF p_view_token IS NULL OR char_length(p_view_token) < 32 THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  -- 본인 1행. 안전필드만 — view_token/claim_pin_hash/phone/nationality/note/player_user_id 미선택.
  SELECT id, tournament_id, entry_number, name, status, chips,
         finish_position, prize_amount, rebuys, add_ons, reentries, knockouts
    INTO v_p
    FROM public.ops_participants
    WHERE view_token = p_view_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 플레이어 토큰' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.table_no, s.seat_no
    INTO v_seat
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.participant_id = v_p.id;

  -- bounty_cost 는 적립 계산에만 사용(자체는 반환 안 함).
  SELECT name, venue, game_type, status, bounty_cost
    INTO v_t FROM public.ops_tournaments WHERE id = v_p.tournament_id;

  SELECT current_level_sort, level_started_at, is_running, paused_remaining_sec
    INTO v_clock FROM public.ops_clock WHERE tournament_id = v_p.tournament_id;

  SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    INTO v_cur FROM public.ops_blind_levels
    WHERE tournament_id = v_p.tournament_id AND sort = v_clock.current_level_sort;

  SELECT playing, entries, average_stack, avg_stack_bb
    INTO v_stats FROM public.ops_live_stats WHERE tournament_id = v_p.tournament_id;

  RETURN jsonb_build_object(
    'me', jsonb_build_object(
      'entryNumber', v_p.entry_number, 'name', v_p.name, 'status', v_p.status::text,
      'chips', v_p.chips, 'finishPosition', v_p.finish_position, 'prizeAmount', v_p.prize_amount,
      'rebuys', v_p.rebuys, 'addOns', v_p.add_ons, 'reentries', v_p.reentries,
      'knockouts', v_p.knockouts,
      'bountyAccrued', CASE WHEN v_t.bounty_cost IS NULL THEN NULL
                            ELSE v_p.knockouts * v_t.bounty_cost END,
      'tableNo', v_seat.table_no, 'seatNo', v_seat.seat_no),
    'tournament', jsonb_build_object(
      'name', v_t.name, 'venue', v_t.venue, 'gameType', v_t.game_type, 'status', v_t.status::text),
    'clock', jsonb_build_object(
      'currentLevelSort', v_clock.current_level_sort, 'levelStartedAt', v_clock.level_started_at,
      'isRunning', COALESCE(v_clock.is_running, false), 'pausedRemainingSec', v_clock.paused_remaining_sec),
    'currentLevel', CASE WHEN v_cur IS NULL THEN NULL ELSE jsonb_build_object(
      'level', v_cur.level, 'smallBlind', v_cur.small_blind, 'bigBlind', v_cur.big_blind,
      'ante', v_cur.ante, 'durationSec', v_cur.duration_sec, 'isBreak', v_cur.is_break) END,
    'stats', jsonb_build_object(
      'playing', COALESCE(v_stats.playing, 0), 'entries', COALESCE(v_stats.entries, 0),
      'averageStack', COALESCE(v_stats.average_stack, 0), 'avgStackBb', COALESCE(v_stats.avg_stack_bb, 0)),
    'serverNow', now()
  );
END;
$function$;
