-- ============================================================
-- update_work_log_slot — 실적(checkIn/checkOut) 이관 + 상태 파생 + 역할·커스텀 역할명 이력
--
-- 마이그레이션: 20260806140000_work_log_slot_attendance.sql
--               20260807120000_work_log_slot_custom_role.sql            (customRole 축, 22~37번)
--               20260807130000_work_log_slot_custom_role_enum_guard.sql (라벨 충돌 거부, 35~36번)
--
-- ⚠️ 아래 번호는 **실제 pgTAP 번호**다(`psql -f` TAP 출력 실측). 원본 e2abe630d 부터 섹션 주석이
--    실제보다 2 작게 어긋나 있었고(11-B~11-C 가 단언 2개를 늘렸는데 뒤 번호를 안 밀었다)
--    신규 구간이 그 드리프트를 이어받았다 — 전 구간을 실측값으로 맞췄다.
--    **단언을 중간에 끼워 넣으면 뒤 번호가 전부 밀린다. 고치기 전에 TAP 출력을 다시 떠라.**
--
-- 무엇을 지키는 테스트인가:
--   실적 쓰기가 클라 직접 UPDATE 2곳이었다(ConfirmedStaffRepository·SettlementRepository).
--   RPC 로 옮기면서 상태 파생(SET-1 규칙)·수정 이력·역할 이력을 서버 한 곳으로 모은다.
--   예정=RPC / 실적=직접 UPDATE 인 채로 통합 시트를 만들면 저장 한 번이 호출 두 번이 되어
--   부분 실패가 생긴다 — 이 파일은 그 한 트랜잭션의 계약을 고정한다.
--
-- 🔗 형제 파일 분담 — `work_log_slot_sync_rpc.test.sql`(33) 과 같은 RPC 를 보지만 축이 다르다.
--    notify_work_log_contract.test.sql:28-31 의 "세 번째 파일을 만들지 말 것" 주의를 알고도
--    새 파일로 둔다. 그 주의는 **같은 축**이 흩어지는 것을 막는 규율이기 때문이다.
--      · work_log_slot_sync_rpc.test.sql — **예정 축**: 패치 계약 검증·권한·
--        applications.assignments 동기화(multi-date 오염 차단·역할 키 매칭·모호 시 skip)
--      · 이 파일                          — **실적 축**: checkIn/checkOut 3상 계약·
--        status 파생·modification_history·role_change_history·custom_role 정리·정산 잠금
--    두 축은 픽스처부터 다르다(저쪽은 assignments 모양이 본체, 이쪽은 work_logs 컬럼이 본체).
--    새 단언을 추가할 때 어느 축인지 먼저 판단할 것.
--
-- 🔗 `customRole` 축(20260807120000)도 같은 기준으로 갈랐다:
--      · 이 파일 22~37 — **계약 판정표**(staffRole × customRole 6조합)·3상·입력 검증·
--        role_change_history 확장·GRID-1·정산 잠금 비적용. 전부 `work_logs` 컬럼으로 관측된다.
--      · sync 파일 31~32 — 이름이 바뀌었을 때 **assignments.roleIds 까지 수렴**하는가.
--        이 파일 픽스처는 전부 `application_id=NULL` 이라 동기화가 조기 종료돼 그 축을
--        한 번도 실행하지 않는다 — 수렴 가드는 저쪽에 있어야 한다.
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
SELECT plan(41);

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

  -- ⑦ customRole 축 전용 — **현재 역할이 'other'** 인 행. 판정표 ④(이름만 교정)·⑥(이름 삭제)의
  --    유일한 무대다. ⑤ 픽스처는 16~19번이 표준 역할(floor)로 바꿔 버려 재사용할 수 없다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role,
                                custom_role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-16', '18:00', 'scheduled', 'other',
          '바리스타')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_other', v_id::text, true);

  -- ⑧ 표준 역할 + custom_role 없음 — 판정표 ①(표준 → other + 커스텀 이름) 의 출발점.
  --    구 `updateRoleWithTransaction` 의 `isStandardRole=false` 갈래가 하던 일이다.
  INSERT INTO public.work_logs (job_posting_id, staff_id, owner_id, date, time_slot, status, role)
  VALUES (s.job_posting_id, s.collaborator_id, s.owner_id, '2026-08-17', '18:00', 'scheduled', 'dealer')
  RETURNING id INTO v_id;
  PERFORM set_config('wa.wl_std', v_id::text, true);
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

-- ── 12~13) 🔴 completed 는 checked_out 으로 강등하지 않는다 ──
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

-- ── 14~15) modification_history ─────────────────────────────
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

-- ── 16~18) 역할 변경 이력 + custom_role 정리 ────────────────
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

-- 18. 표준 역할로 바꾸면 옛 커스텀 역할명을 지운다. 남기면 _posting_role_key 가
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

-- ── 20~21) 정산 완료 잠금 ───────────────────────────────────
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

-- ══════════════════════════════════════════════════════════════
-- customRole 축 (22~37) — 20260807120000 + 20260807130000
--
-- 무엇을 지키는 테스트인가:
--   삭제된 `RoleChangeModal` 은 공고에서 뽑은 **커스텀 역할명**('바리스타')을 옵션에 넣고
--   `updateRoleWithTransaction` 이 `isStandardRole` 로 갈라 `custom_role` 을 세웠다. 통합 시트가
--   `STAFF_ROLES` 6종 고정으로 바뀌고 RPC 에도 이름 키가 없어 **커스텀 역할뿐인 대회 공고에서
--   스태프를 그 역할로 옮기거나 오타를 고칠 경로가 0이 됐다.** 이 구간이 그 계약을 고정한다.
--
-- 🔑 계약은 하나의 불변식으로 환원된다 —
--    **최종 custom_role 이 비어 있지 않다면 최종 role 은 'other' 여야 한다.**
--    `_posting_role_key` 가 custom_role 을 role 보다 우선하므로, 깨지면 role 컬럼은 'floor' 인데
--    역할 키는 'other:바리스타' 인 행 — 20260806140000 이 없애려던 레거시 표류 형태 — 이 생긴다.
-- ══════════════════════════════════════════════════════════════

-- ── 22~24) 판정표 ④ — staffRole 없이 이름만 교정한다 ─────────
-- 🔴 이게 "잘못 들어간 이름을 고친다"는 원래 능력이다. 역할 축은 그대로 두고 이름만 바꾼다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_other')::uuid,
    jsonb_build_object('customRole', '플로어장', 'reason', '역할명 오타 정정')
  );
END $$;

SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_other')::uuid),
  'other|플로어장',
  'customRole 만 보내면 역할은 other 그대로 두고 이름만 바뀐다 (판정표 ④)');

-- 23. 🔑 red-swap 대상. 이력 조건이 `role 컬럼 변경` 뿐이면 여기가 red 가 된다 —
--     '바리스타'→'플로어장' 은 둘 다 role='other' 라 role 컬럼이 안 바뀌기 때문이다.
--     구 `updateRoleWithTransaction` 은 이 변경도 남겼으므로 감사 흔적이 사라지면 기능 후퇴다.
SELECT is(
  (SELECT jsonb_array_length(COALESCE(role_change_history, '[]'::jsonb))::text || '|' ||
          (e ->> 'previousCustomRole') || '|' || (e ->> 'newCustomRole') || '|' ||
          (e ->> 'previousRole') || '|' || (e ->> 'newRole') || '|' || (e ->> 'reason')
   FROM public.work_logs w,
        LATERAL (SELECT w.role_change_history -> 0) AS x(e)
   WHERE w.id = current_setting('wa.wl_other')::uuid),
  '1|바리스타|플로어장|other|other|역할명 오타 정정',
  '🔴 커스텀 이름만 바뀌어도 role_change_history 에 남고 옛/새 이름이 함께 실린다');

-- 24. 같은 이름으로 다시 저장하면 이력이 늘지 않는다(변경이 없으면 기록도 없다).
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_other')::uuid,
    jsonb_build_object('customRole', '플로어장')
  );
END $$;

SELECT is(
  (SELECT jsonb_array_length(COALESCE(role_change_history, '[]'::jsonb))
   FROM public.work_logs WHERE id = current_setting('wa.wl_other')::uuid),
  1, '같은 이름을 다시 보내면 이력을 남기지 않는다');

-- ── 25) 🔴 GRID-1 — customRole 키를 안 보내면 기존 이름을 덮지 않는다 ──
-- 마이그가 UPDATE 를 `custom_role = v_final_custom_role` 로 단순화했다. 그 최종값 계산에서
-- `ELSE v_wl.custom_role` 갈래가 빠지면 **메모만 고쳐도 역할 이름이 증발한다.**
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_other')::uuid,
    jsonb_build_object('memo', '이름과 무관한 메모')
  );
END $$;

SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)') || '|' || notes
   FROM public.work_logs WHERE id = current_setting('wa.wl_other')::uuid),
  'other|플로어장|이름과 무관한 메모',
  '🔴 customRole 키가 없는 저장은 기존 역할 이름을 보존한다 (GRID-1)');

-- ── 26) 빈 문자열은 삭제로 접는다 ───────────────────────────
-- `_posting_role_key` 가 NULL 과 '' 를 같은 키('other:')로 보므로, '' 를 컬럼에 남기면
-- 키 공간에서는 구분되지 않는데 컬럼에서만 구분되는 두 번째 표현이 생긴다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_other')::uuid,
    jsonb_build_object('customRole', '   ')
  );
END $$;

-- 🔑 `COALESCE('[' || custom_role || ']', '(null)')` 는 NULL 과 '' 를 구분한다 —
--    NULL 이면 결합 전체가 NULL 이라 '(null)', '' 이면 '[]' 가 된다. 단순 COALESCE 로 쓰면
--    빈 문자열이 저장돼도 green 이라 이 단언이 빈 가드가 된다.
SELECT is(
  (SELECT role::text || '|' || COALESCE('[' || custom_role || ']', '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_other')::uuid),
  'other|(null)',
  '공백뿐인 역할명은 삭제로 접힌다 — 빈 문자열을 컬럼에 남기지 않는다');

-- ── 27~28) 판정표 ① — 표준 역할 행을 커스텀 역할로 옮긴다 ────
-- 구 `updateRoleWithTransaction` 의 `isStandardRole=false` 갈래
-- ({ role:'other', custom_role:<이름> })와 정확히 같은 결과여야 한다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_std')::uuid,
    jsonb_build_object('staffRole', 'other', 'customRole', '바리스타', 'reason', '대회 역할 배치')
  );
END $$;

SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_std')::uuid),
  'other|바리스타',
  '표준 역할 행을 other + 커스텀 이름으로 옮길 수 있다 (판정표 ①)');

-- 28. 이력 엔트리 — previousRole 은 enum, 새 이름은 newCustomRole 로 실린다.
--     옛 이름이 없었으므로 previousCustomRole 키는 **붙지 않는다**(있을 때만 싣는다).
SELECT is(
  (SELECT (e ->> 'previousRole') || '|' || (e ->> 'newRole') || '|' ||
          (e ->> 'newCustomRole') || '|' || (e ? 'previousCustomRole')::text
   FROM public.work_logs w,
        LATERAL (SELECT w.role_change_history -> 0) AS x(e)
   WHERE w.id = current_setting('wa.wl_std')::uuid),
  'dealer|other|바리스타|false',
  '이력에 이전 역할(enum)·새 역할·새 이름이 담기고 없던 옛 이름 키는 붙지 않는다');

-- ── 29) 판정표 ⑥ — customRole:null 은 이름만 지운다 ─────────
-- 🔑 역할은 'other' 로 남는다. 이름 삭제는 역할 삭제가 아니다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_std')::uuid,
    jsonb_build_object('customRole', NULL)
  );
END $$;

SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_std')::uuid),
  'other|(null)',
  'customRole:null 은 이름만 지우고 역할은 other 로 남긴다 (판정표 ⑥)');

-- ── 30~31) 🔴 모순 조합은 거부한다 (판정표 ③⑤) ─────────────
-- 조용한 무시("표준 우선")를 택하지 않은 이유: "저장했는데 이름이 안 바뀐다"로 나타나고
-- 서버 로그에도 흔적이 없어 나중에 못 찾는다. 허용 키 화이트리스트와 같은 fail-closed 규율이다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"staffRole":"floor","customRole":"바리스타"}'::jsonb)$q$,
         current_setting('wa.wl_other')),
  '%INVALID_INPUT%',
  '🔴 표준 역할과 커스텀 이름을 동시에 보내면 거부한다 (판정표 ③)');

-- 31. wl_id 는 role='dealer' 다 — staffRole 없이 이름만 보내면 최종 role 이 other 가 아니게 된다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"customRole":"바리스타"}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%INVALID_INPUT%',
  '🔴 현재 역할이 other 가 아닌 행에 이름만 보내면 거부한다 — 서버가 몰래 승격시키지 않는다 (판정표 ⑤)');

-- ── 32~34) 입력 검증 ────────────────────────────────────────
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"customRole": 12345}'::jsonb)$q$,
         current_setting('wa.wl_other')),
  '%INVALID_PATCH_TYPE%',
  'customRole 이 문자열도 null 도 아니면 거부한다');

-- 33. 상한 20 은 공고 작성 스키마(orderSheet.schema.ts:41,48 safeText(20))와 같은 값이다.
--     공고가 못 만드는 길이를 근무기록만 가지면 _posting_role_key 매칭이 영영 안 된다.
-- ⚠️ 긴 문자열은 `%L` 로 JSON 안에 넣지 않는다 — `%L` 은 SQL 리터럴(작은따옴표)을 만들어
--    `{"customRole":'가가...'}` 라는 깨진 JSON 이 되고, 42601 syntax error 로 죽는다.
--    jsonb_build_object 로 조립한다(그 편이 이스케이프 걱정도 없다).
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             jsonb_build_object('customRole', repeat('가', 21)))$q$,
         current_setting('wa.wl_other')),
  '%INVALID_INPUT%',
  '역할명이 20자를 넘으면 거부한다 (공고 스키마 safeText(20) 과 동일 상한)');

-- 34. 🔑 `work_logs_xss_check` 트리거도 같은 패턴을 잡지만 그쪽 메시지는
--     'XSS pattern detected in field: custom_role' 이라 앱이 매핑할 수 없다. 함수가 먼저
--     끊어 INVALID_INPUT 으로 나가야 WorkLogRepositoryVenue:162 의 기존 매핑이 받는다 —
--     그래서 이 단언은 %INVALID_INPUT% 여야 하고 트리거 메시지로는 green 이 되지 않는다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"customRole":"<script>x</script>"}'::jsonb)$q$,
         current_setting('wa.wl_other')),
  '%INVALID_INPUT%',
  'XSS 패턴이 든 역할명은 트리거보다 먼저 INVALID_INPUT 으로 거부한다');

-- ── 35) 🔴 표준 역할 라벨과 같은 이름은 거부한다 (20260807130000) ──
-- 🔑 이 결함은 **저장 두 번째**에 나타나 테스트가 놓치기 쉽다. 첫 저장은
--    `v_role_key_old` 가 아직 옛 값('dealer')이라 정상 매칭되고 roleIds 도 ["dealer"] 로 쓰인다.
--    두 번째 저장부터 `v_role_key_old`='other:dealer' vs roleIds 역산 'dealer' 로 어긋나
--    `no_match` — work_logs 만 갱신되고 assignments 는 **에러 없이** 영구히 낡는다.
--    그래서 "첫 저장이 성공한다"는 단언으로는 이 결함을 절대 잡을 수 없고,
--    입력 단계에서 끊는 것만이 유일하게 관측 가능한 가드다.
-- ⚠️ 'Dealer'(대문자)는 거부 대상이 **아니다** — `r = ANY(v_role_labels)` 가 false 라
--    역산이 'other:Dealer' 로 정확히 왕복한다. 아래 두 단언이 그 경계를 함께 고정한다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"customRole":"dealer"}'::jsonb)$q$,
         current_setting('wa.wl_other')),
  '%INVALID_INPUT%',
  '🔴 표준 역할 라벨과 같은 역할명은 거부한다 (assignments 영구 표류 차단)');

-- 36. 🔑 경계의 반대편. 이게 없으면 "라벨 비슷하면 다 막기"로 넓혀도 green 이라
--     멀쩡한 이름을 막는 회귀를 못 잡는다. 대소문자가 다르면 통과해야 한다.
DO $$
BEGIN
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_other')::uuid,
    jsonb_build_object('customRole', 'Dealer')
  );
END $$;

SELECT is(
  (SELECT role::text || '|' || COALESCE(custom_role, '(null)')
   FROM public.work_logs WHERE id = current_setting('wa.wl_other')::uuid),
  'other|Dealer',
  '대소문자가 다른 이름(Dealer)은 통과한다 — 역산이 정확히 왕복하므로 막을 이유가 없다');

-- ── 37) 정산 완료 잠금은 역할 축에 걸지 않는다 ──────────────
-- 🔴 구 `updateRoleWithTransaction` 도 AlreadySettledError 를 던지지 않았다. 정산 잠금은
--    **금액에 영향을 주는 시각**의 문제이고, 역할 표기 교정까지 막으면 정산 후에 발견한
--    오타를 영영 못 고친다. 실적 키(20번)와 대칭을 이루는 음성 단언이다.
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"staffRole":"other","customRole":"바리스타"}'::jsonb)$q$,
         current_setting('wa.wl_settled')),
  '정산 완료건이라도 역할·역할명은 고칠 수 있다 (잠금은 실적 축 전용)');

-- ── 38) 권한 ────────────────────────────────────────────────
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


-- ── 39~41) 퇴근 >= 출근 **서버** 검증 (20260807180000) ─────────
-- 지금까지 이 순서를 보는 것은 클라 `deriveAttendanceInsight` 뿐이었고 DB CHECK 도 없었다
-- (`work_logs_status_timestamp_consistency` 는 NULL 여부만 본다). 인증된 employer 가 RPC 를
-- 직접 호출하면 역전 시각이 저장되고, status='checked_out' 이 파생돼 정산 게이트를 통과한 뒤
-- `fn_settlement_amount` 의 GREATEST(0, ...) 가 음수를 0 으로 접어 ₩0 정산이 확정된다.
--
-- 🔑 39·40 은 **양쪽을 함께 패치**하는 경로, 41 은 **한쪽만 패치**해 기존 값과 역전되는 경로다.
--    41 이 핵심이다 — patch 값만 보고 판정하면 41 이 뚫린다(병합 후 v_final_* 로 봐야 한다).
DO $$
BEGIN
  PERFORM jpc_test_set_user(current_setting('wa.owner_id')::uuid);
  -- 알려진 정상 상태로 되돌린다(앞 단언들이 남긴 값에 의존하지 않기 위해).
  PERFORM public.update_work_log_slot(
    current_setting('wa.wl_id')::uuid,
    '{"checkIn":"2026-08-10T09:00:00+00:00","checkOut":"2026-08-10T18:00:00+00:00","reason":"기준 상태"}'::jsonb);
END $$;

SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"checkIn":"2026-08-10T18:00:00+00:00","checkOut":"2026-08-10T09:00:00+00:00","reason":"역전"}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%퇴근 시간은 출근 시간보다 뒤여야 합니다%',
  '퇴근이 출근보다 앞서면 서버가 거부한다');

SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"checkIn":"2026-08-10T09:00:00+00:00","checkOut":"2026-08-10T09:00:00+00:00","reason":"동일"}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%퇴근 시간은 출근 시간보다 뒤여야 합니다%',
  '퇴근과 출근이 같으면 거부한다 — 24시간 근무가 아니라 입력 오류다');

-- 기존 check_out_ts = 2026-08-10 18:00. 출근만 그보다 뒤로 고치면 병합 결과가 역전된다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid,
             '{"checkIn":"2026-08-10T20:00:00+00:00","reason":"한쪽만 패치"}'::jsonb)$q$,
         current_setting('wa.wl_id')),
  '%퇴근 시간은 출근 시간보다 뒤여야 합니다%',
  '한쪽만 패치해도 기존 값과의 순서가 깨지면 거부한다 (병합 후 판정)');

SELECT * FROM finish();
ROLLBACK;
