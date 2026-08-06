-- ============================================================
-- update_work_log_slot — 실적(checkIn/checkOut) 이관 + 상태 파생 + 역할 이력
--
-- 마이그레이션: 20260806140000_work_log_slot_attendance.sql
--
-- 무엇을 지키는 테스트인가:
--   실적 쓰기가 클라 직접 UPDATE 2곳이었다(ConfirmedStaffRepository·SettlementRepository).
--   RPC 로 옮기면서 상태 파생(SET-1 규칙)·수정 이력·역할 이력을 서버 한 곳으로 모은다.
--   예정=RPC / 실적=직접 UPDATE 인 채로 통합 시트를 만들면 저장 한 번이 호출 두 번이 되어
--   부분 실패가 생긴다 — 이 파일은 그 한 트랜잭션의 계약을 고정한다.
--
-- 🔗 형제 파일 분담 — `work_log_slot_sync_rpc.test.sql`(27) 과 같은 RPC 를 보지만 축이 다르다.
--    notify_work_log_contract.test.sql:28-31 의 "세 번째 파일을 만들지 말 것" 주의를 알고도
--    새 파일로 둔다. 그 주의는 **같은 축**이 흩어지는 것을 막는 규율이기 때문이다.
--      · work_log_slot_sync_rpc.test.sql — **예정 축**: 패치 계약 검증·권한·
--        applications.assignments 동기화(multi-date 오염 차단·역할 키 매칭·모호 시 skip)
--      · 이 파일                          — **실적 축**: checkIn/checkOut 3상 계약·
--        status 파생·modification_history·role_change_history·custom_role 정리·정산 잠금
--    두 축은 픽스처부터 다르다(저쪽은 assignments 모양이 본체, 이쪽은 work_logs 컬럼이 본체).
--    새 단언을 추가할 때 어느 축인지 먼저 판단할 것.
--
-- ⚠️ 42501 단독 단언 금지 — 권한 거부는 throws_like '%PERMISSION_DENIED%' 로 본다.
--    SQLSTATE 만 보면 무관한 트리거(tr_work_logs_pin_identity·tr_work_logs_pin_payroll)가
--    낸 42501 로도 green 이 되어 red-스왑이 안 잡힌다.
-- ⚠️ RPC 호출과 결과 조회를 한 SELECT 에 섞지 않는다(볼라틸 함수와 스칼라 서브쿼리의
--    평가 순서 비보장). 호출은 DO 블록에서 먼저 끝낸다.
-- 🔑 이 RPC 는 payroll 컬럼을 건드리지 않으므로 protect_work_log_payroll_columns 도
--    tr_work_logs_pin_payroll 도 발화하지 않는다 — jpc_test_set_user() 로 충분하다.
-- ============================================================
BEGIN;
SELECT plan(22);

-- ── 픽스처 ──────────────────────────────────────────────────
-- application_id 를 NULL 로 둔다(add_direct_staff 산 행의 형태). 이 파일은 실적 축만 보므로
-- assignments 동기화는 'no_application' 으로 조기 종료돼 무관 변인이 사라진다.
DO $$
DECLARE
  s RECORD;
  v_id uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wa.owner_id', s.owner_id::text,       true);
  PERFORM set_config('wa.out_id',   s.outsider_id::text,    true);
  PERFORM set_config('wa.jp_id',    s.job_posting_id::text, true);
  PERFORM set_config('wa.staff_id', s.collaborator_id::text, true);

  -- ① 본선: scheduled 상태의 평범한 행
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-10', '18:00', 'scheduled', 'dealer')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_id', v_id::text, true);

  -- ② 🔴 D1 판별용: status='scheduled' 인데 check_in_ts 가 이미 있는 행.
  --    CHECK work_logs_status_timestamp_consistency 는 scheduled 를 ELSE true 로 통과시키므로
  --    적법한 상태다(raw PostgREST·상태 되돌리기 경로로 실제로 만들어진다).
  --    상태 파생을 실적 키 존재와 무관하게 돌리면 **예정만 바꿔도 checked_in 으로 튄다.**
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role,
                                check_in_ts)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-11', '18:00', 'scheduled', 'dealer',
          '2026-08-11T09:00:00+00:00')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_drift', v_id::text, true);

  -- ③ 노쇼 행 — 시간 수정이 노쇼를 조용히 뒤집으면 없던 유급 근무가 생긴다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-12', '18:00', 'no_show', 'dealer')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_noshow', v_id::text, true);

  -- ④ 정산 완료 행. protect_work_log_payroll_columns 는 BEFORE UPDATE 라 INSERT 로 만든다.
  --    completed 상태는 CHECK 상 양쪽 타임스탬프가 필수다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role,
                                check_in_ts, check_out_ts, payroll_status, payroll_amount)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-13', '18:00', 'completed', 'dealer',
          '2026-08-13T09:00:00+00:00', '2026-08-13T18:00:00+00:00', 'completed', 100000)
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_settled', v_id::text, true);

  -- ⑤ 커스텀 역할 행 — 표준 역할로 바꿀 때 옛 커스텀 역할명이 지워지는지 본다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role,
                                custom_role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-14', '18:00', 'scheduled', 'other',
          '바리스타')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_cust', v_id::text, true);

  -- ⑥ 🔴 completed 인데 **정산은 아직 안 된** 행. ④ 로는 이 성질을 볼 수 없다 —
  --    ④ 는 payroll_status='completed' 라 ALREADY_SETTLED 로 먼저 튕겨서 상태 파생까지
  --    가지도 못한다. 강등 금지 규칙을 보려면 실적 키가 실제로 통과하는 completed 행이 필요하다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role,
                                check_in_ts, check_out_ts, payroll_status)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-15', '18:00', 'completed', 'dealer',
          '2026-08-15T09:00:00+00:00', '2026-08-15T18:00:00+00:00', 'pending')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_done', v_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('wa.owner_id'))::uuid);

-- ── 1~2) 출근만 기록 → status='checked_in' ──────────────────
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkIn', '2026-08-10T09:00:00+00:00', 'reason', '지각 정정')
  );
END $$;

SELECT is((SELECT status::text FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'checked_in', '출근만 기록하면 status=checked_in');

SELECT is((SELECT check_in_ts FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          '2026-08-10T09:00:00+00:00'::timestamptz, 'check_in_ts 가 보낸 값 그대로 기록된다');

-- ── 3) 퇴근까지 → status='checked_out' + 출처를 사람으로 되돌린다 ──
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkOut', '2026-08-10T18:00:00+00:00', 'reason', '퇴근 정정')
  );
END $$;

SELECT is((SELECT status::text FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'checked_out', '퇴근까지 기록하면 status=checked_out');

-- 4. end_time_source — 빼면 QR 로 찍힌 뒤 사람이 고친 행이 계속 'qr' 로 남아
--    화면에 거짓 "QR 기록" 이 뜬다(ConfirmedStaffRepository.ts:426 이 지키던 것).
SELECT is((SELECT end_time_source FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'manual', '퇴근 시각을 사람이 쓰면 end_time_source 가 manual 로 되돌아간다');

-- 5. has_time_modification_logs — 정산 화면의 '수정됨' 표식
SELECT is((SELECT has_time_modification_logs FROM public.work_logs
           WHERE id = current_setting('wa.wl_id')::uuid),
          true, '실적을 고치면 has_time_modification_logs 가 선다');

-- ── 6~8) 🔴 3상 계약: 키 없음 / JSON null / 값 ──────────────
-- JSON null 은 '삭제' 다. COALESCE·truthy 로 짜면 여기서 조용히 무시된다(데이터 손실).
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('checkIn', NULL, 'checkOut', NULL, 'reason', '오기록 정정')
  );
END $$;

SELECT is((SELECT (check_in_ts IS NULL)::text || '|' || (check_out_ts IS NULL)::text
           FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'true|true', 'JSON null 은 삭제다 — 두 시각이 모두 비워진다');

SELECT is((SELECT status::text FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'scheduled', '시각을 지우면 status 가 scheduled 로 강등된다(23514 방지)');

-- 잘못된 타입은 22007 원시 에러가 새기 전에 앱이 매핑할 수 있는 코드로 거부한다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"checkIn": 12345}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%INVALID_PATCH_TYPE%',
  'checkIn 이 문자열도 null 도 아니면 거부한다');

-- ── 9~10) 🔴 D1 — 예정 변경은 근태 상태를 건드리지 않는다 ────
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    jsonb_build_object('startTime', '19:00')
  );
END $$;

SELECT is((SELECT status::text FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
          'scheduled', '출근 예정만 바꾸면 근태 상태는 바뀌지 않는다');

-- 10. 🔑 진짜 가드. ② 픽스처는 status='scheduled' 인데 check_in_ts 가 이미 있다.
--     상태 파생을 실적 키 존재와 무관하게 돌리면 여기서 'checked_in' 으로 튀고
--     스태프에게 근거 없는 근무 변경 알림이 나간다. 9번은 이 회귀를 잡지 못한다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_drift')::uuid,
    jsonb_build_object('startTime', '20:00')
  );
END $$;

SELECT is((SELECT status::text || '|' || (check_in_ts IS NOT NULL)::text
           FROM public.work_logs WHERE id = current_setting('wa.wl_drift')::uuid),
          'scheduled|true',
          '🔴 실적 키가 없으면 이미 있던 check_in_ts 로 상태를 파생하지 않는다 (D1)');

-- ── 11) 노쇼는 상태 파생에서 제외 ───────────────────────────
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_noshow')::uuid,
    jsonb_build_object('checkIn', '2026-08-12T09:00:00+00:00', 'reason', '기록 보정')
  );
END $$;

SELECT is((SELECT status::text || '|' || (check_in_ts IS NOT NULL)::text
           FROM public.work_logs WHERE id = current_setting('wa.wl_noshow')::uuid),
          'no_show|true',
          '노쇼는 시각을 기록해도 상태가 뒤집히지 않는다 (없던 유급 근무 방지)');

-- ── 11-B~11-C) 🔴 completed 는 checked_out 으로 강등하지 않는다 ──
-- 마이그 20260806140000:364-371 이 명시적으로 지키는 성질인데 직접 핀이 없었다.
-- completed 도 '양쪽 NOT NULL' 을 만족해 제약 위반이 아니므로 조용히 강등된다 —
-- 그러면 tr_sync_application_completion 이 applications 를 불필요하게 역전파한다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_done')::uuid,
    jsonb_build_object('checkOut', '2026-08-15T19:30:00+00:00', 'reason', '퇴근 시각 정정')
  );
END $$;

SELECT is((SELECT status::text FROM public.work_logs WHERE id = current_setting('wa.wl_done')::uuid),
          'completed',
          '🔴 completed 행의 실적을 고쳐도 checked_out 으로 강등하지 않는다');

-- 🔑 동반 양성 단언. 이게 없으면 RPC 가 아무것도 안 해도 위 단언이 통과한다(빈 가드).
SELECT is((SELECT check_out_ts FROM public.work_logs WHERE id = current_setting('wa.wl_done')::uuid),
          '2026-08-15T19:30:00+00:00'::timestamptz,
          '강등은 막되 실적 자체는 정상 반영된다 (위 단언이 빈 가드가 아님을 보증)');

-- ── 12~13) modification_history ─────────────────────────────
-- 이 배열 길이 증가가 notify_on_work_log_update Case 2 를 발화시킨다.
SELECT is(
  (SELECT jsonb_array_length(COALESCE(modification_history, '[]'::jsonb))
   FROM public.work_logs WHERE id = current_setting('wa.wl_id')::uuid),
  3, '실적을 바꾼 횟수(3)만큼만 modification_history 가 늘어난다 — 예정 변경은 안 남긴다');

-- 엔트리 모양은 클라 appendWorkTimeModification 계약(camelCase)과 같아야 한다.
-- 표시 컴포넌트(SettlementDetailModal 이력 섹션)와 알림 트리거가 이 키들을 읽는다.
SELECT is(
  (SELECT (e ->> 'reason') || '|' || (e ->> 'modifiedBy') || '|' || (e ? 'newStartTime')::text
   FROM public.work_logs w,
        LATERAL (SELECT w.modification_history -> (jsonb_array_length(w.modification_history) - 1)) AS x(e)
   WHERE w.id = current_setting('wa.wl_id')::uuid),
  '오기록 정정|' || current_setting('wa.owner_id') || '|true',
  '이력 엔트리에 사유·수정자(호출자)·변경 축이 담긴다');

-- ── 14~16) 역할 변경 이력 + custom_role 정리 ────────────────
-- 근무표 경로(WorkLogRepositoryVenue.updateSlot)에는 아예 없던 것이다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_cust')::uuid,
    jsonb_build_object('staffRole', 'floor', 'reason', '역할 조정')
  );
END $$;

SELECT is(
  (SELECT jsonb_array_length(COALESCE(role_change_history, '[]'::jsonb))
   FROM public.work_logs WHERE id = current_setting('wa.wl_cust')::uuid),
  1, '역할 변경이 role_change_history 에 append 된다');

SELECT is(
  (SELECT (e ->> 'previousRole') || '|' || (e ->> 'newRole') || '|' || (e ->> 'changedBy')
   FROM public.work_logs w,
        LATERAL (SELECT w.role_change_history -> 0) AS x(e)
   WHERE w.id = current_setting('wa.wl_cust')::uuid),
  'other|floor|' || current_setting('wa.owner_id'),
  '역할 이력에 이전·이후 역할과 변경자가 담긴다');

-- 16. 표준 역할로 바꾸면 옛 커스텀 역할명을 지운다. 남기면 _posting_role_key 가
--     custom_role 을 우선하므로 역할 키가 'other:바리스타' 에서 영영 안 바뀐다(유령 부활).
SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_cust')::uuid),
  'floor|(null)',
  '표준 역할로 바꾸면 custom_role 이 정리된다');

-- 같은 역할로 다시 저장해도 이력이 늘지 않는다(변경이 없으면 기록도 없다).
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_cust')::uuid,
    jsonb_build_object('staffRole', 'floor')
  );
END $$;

SELECT is(
  (SELECT jsonb_array_length(COALESCE(role_change_history, '[]'::jsonb))
   FROM public.work_logs WHERE id = current_setting('wa.wl_cust')::uuid),
  1, '역할이 실제로 바뀌지 않으면 이력을 남기지 않는다');

-- ── 18~19) 정산 완료 잠금 ───────────────────────────────────
-- 클라 AlreadySettledError 의 서버 짝. 실적 키에만 건다 —
-- 기존 키(예정·역할·색·메모)의 계약을 조용히 좁히면 구 빌드가 막힌다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"checkIn":"2026-08-13T10:00:00+00:00","reason":"수정"}'::jsonb)$q$,
         current_setting('wa.wl_settled')),
  '%ALREADY_SETTLED%',
  '정산 완료된 근무의 실적은 수정할 수 없다');

SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"memo":"정산 후 메모"}'::jsonb)$q$,
         current_setting('wa.wl_settled')),
  '정산 완료건이라도 기존 키(메모)는 계속 통과한다 (하위호환)');

-- ── 20) 권한 ────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM jpc_test_set_user(current_setting('wa.out_id')::uuid);
END $$;

SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"checkIn":"2026-08-10T09:00:00+00:00"}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%PERMISSION_DENIED%',
  '공고 소유자가 아니면 실적도 수정할 수 없다');

SELECT * FROM finish();
ROLLBACK;
