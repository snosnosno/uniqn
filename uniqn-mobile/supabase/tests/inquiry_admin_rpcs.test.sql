-- 관리자 문의 응답/상태변경 RPC pgTAP (마이그 20260725150000, Sentry UNIQN-MOBILE-1N 회귀 가드)
--   respond_inquiry(p_inquiry_id, p_responder_id, p_responder_name, p_response, p_target_status)
--   update_inquiry_status(p_inquiry_id, p_target_status)
-- 계약: ① 시그니처가 출하 클라이언트(named-args)와 정확히 일치 ② admin 게이트 + actor 바인딩
--   ③ response XSS/길이 서버측 검증 ④ anon EXECUTE 회수.
-- ⚠️ JWT 주입은 헬퍼(jpc_test_set_user_with_role) 경유만 — 인라인 set_config 금지
--    (wiki decisions/wallet-pgtap-caller-binding: singular/plural GUC 동시 갱신 필수).
BEGIN;
SELECT plan(14);

-- 시드(superuser 컨텍스트, set_user 이전): admin 1 + staff 1 + staff 의 문의 1건
DO $$
DECLARE v_admin uuid; v_staff uuid; v_inq uuid := gen_random_uuid();
BEGIN
  v_admin := jpc_test_create_user('admin');
  v_staff := jpc_test_create_user('staff');
  INSERT INTO public.inquiries (id, user_id, user_email, user_name, category, subject, message)
  VALUES (v_inq, v_staff, 'inq_test@test.local', '문의자', 'general', '테스트 문의', '문의 내용입니다');
  PERFORM set_config('inq.admin', v_admin::text, true);
  PERFORM set_config('inq.staff', v_staff::text, true);
  PERFORM set_config('inq.id', v_inq::text, true);
END $$;

-- ─── (1)(2) 시그니처 계약: 출하 바이너리의 named-args 와 파라미터 이름·타입 일치 ───
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'respond_inquiry'),
  'p_inquiry_id uuid, p_responder_id uuid, p_responder_name text, p_response text, p_target_status inquiry_status',
  'respond_inquiry 시그니처 == 출하 클라이언트 계약(이름 변경 = 기출하 바이너리 재파손)');
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_inquiry_status'),
  'p_inquiry_id uuid, p_target_status inquiry_status',
  'update_inquiry_status 시그니처 == 출하 클라이언트 계약');

-- ─── (3) staff(non-admin) 응답 → P0001 (admin 게이트) ───
SELECT jpc_test_set_user_with_role((current_setting('inq.staff'))::uuid, 'staff');
SELECT throws_ok(
  format($q$ SELECT public.respond_inquiry(%L::uuid, %L::uuid, '응답자', '답변', 'closed'::public.inquiry_status) $q$,
         current_setting('inq.id'), current_setting('inq.staff')),
  'P0001', '관리자 전용', 'respond: non-admin 차단(P0001)');

-- ─── (4) admin 이지만 p_responder_id 위조 → P0001 (actor 바인딩) ───
SELECT jpc_test_set_user_with_role((current_setting('inq.admin'))::uuid, 'admin');
SELECT throws_ok(
  format($q$ SELECT public.respond_inquiry(%L::uuid, %L::uuid, '응답자', '답변', 'closed'::public.inquiry_status) $q$,
         current_setting('inq.id'), current_setting('inq.staff')),
  'P0001', 'actor 불일치', 'respond: responder_id 위조 차단(P0001)');

-- ─── (5) XSS 패턴 response → P0001 (response 는 inquiries_xss_check 트리거 미커버) ───
SELECT throws_ok(
  format($q$ SELECT public.respond_inquiry(%L::uuid, %L::uuid, '응답자', '<script>alert(1)</script>', 'closed'::public.inquiry_status) $q$,
         current_setting('inq.id'), current_setting('inq.admin')),
  'P0001', 'XSS pattern detected in field: response', 'respond: XSS response 차단(P0001)');

-- ─── (6) 빈 response → P0001 ───
SELECT throws_ok(
  format($q$ SELECT public.respond_inquiry(%L::uuid, %L::uuid, '응답자', '   ', 'closed'::public.inquiry_status) $q$,
         current_setting('inq.id'), current_setting('inq.admin')),
  'P0001', '응답 내용 불량', 'respond: 공백 response 차단(P0001)');

-- ─── (7) 존재하지 않는 문의 → P0001 ───
SELECT throws_ok(
  format($q$ SELECT public.respond_inquiry(%L::uuid, %L::uuid, '응답자', '답변', 'closed'::public.inquiry_status) $q$,
         gen_random_uuid()::text, current_setting('inq.admin')),
  'P0001', '문의 없음', 'respond: 미존재 문의 P0001(침묵 no-op 금지)');

-- ─── (8) admin 정상 응답 → response/responder/status/responded_at 반영 ───
DO $$
BEGIN
  PERFORM public.respond_inquiry(
    (current_setting('inq.id'))::uuid, (current_setting('inq.admin'))::uuid,
    '운영팀', '안녕하세요, 답변드립니다.', 'closed'::public.inquiry_status);
END $$;
SELECT is(
  (SELECT json_build_object(
      'response', response, 'responder', responder_id::text, 'name', responder_name,
      'status', status::text, 'answered', (responded_at IS NOT NULL))::text
     FROM public.inquiries WHERE id = (current_setting('inq.id'))::uuid),
  json_build_object(
    'response', '안녕하세요, 답변드립니다.', 'responder', current_setting('inq.admin'), 'name', '운영팀',
    'status', 'closed', 'answered', true)::text,
  'respond: admin 정상 응답 반영(response·responder·status·responded_at)');

-- ─── (9) 답변 알림: 문의자에게 inquiry_answered 1건 + 정밀 딥링크(마이그 20260807170000) ───
-- 감사 A3: 배선은 완비인데 발송자가 없어 문의자가 답변을 영영 몰랐다(prod 실측 0건).
--
-- ⚠️ 단언은 반드시 **문의자 세션**에서 한다. notifications 의 notif_select 정책은
--    recipient_id = auth.uid() 라, admin 세션으로 세면 행이 있어도 0 건으로 보인다
--    (RLS 가시성 함정 — "행이 없다"와 "안 보인다"는 다르다).
--    수신자 시점 단언은 덤으로 "문의자가 실제로 이 알림을 볼 수 있다"까지 증명한다.
SELECT jpc_test_set_user_with_role((current_setting('inq.staff'))::uuid, 'staff');
SELECT is(
  (SELECT json_build_object(
      'cnt', count(*)::int,
      'link', min(link),
      'inquiryId', min(data->>'inquiryId'),
      'body', min(body))::text
     FROM public.notifications
    WHERE recipient_id = (current_setting('inq.staff'))::uuid
      AND type = 'inquiry_answered'),
  json_build_object(
    'cnt', 1,
    'link', '/support/inquiry/' || current_setting('inq.id'),
    'inquiryId', current_setting('inq.id'),
    -- 본문은 고정문이어야 한다. 문의 제목을 실으면 그대로 푸시 payload 가 되어
    -- 잠금화면에 노출된다(문의 카테고리엔 payment·account·report 가 있다).
    'body', '문의하신 내용에 답변이 등록되었습니다.')::text,
  'respond: 문의자에게 inquiry_answered 1건 + /support/inquiry/{id} + 고정 본문');

-- ─── (10) 같은 답변 재저장 → 재알림 없음 (관리자 재클릭이 푸시를 반복하지 않는다) ───
SELECT jpc_test_set_user_with_role((current_setting('inq.admin'))::uuid, 'admin');
DO $$
BEGIN
  PERFORM public.respond_inquiry(
    (current_setting('inq.id'))::uuid, (current_setting('inq.admin'))::uuid,
    '운영팀', '안녕하세요, 답변드립니다.', 'closed'::public.inquiry_status);
END $$;
SELECT jpc_test_set_user_with_role((current_setting('inq.staff'))::uuid, 'staff');
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('inq.staff'))::uuid AND type = 'inquiry_answered'),
  1,
  'respond: 동일 답변 재저장은 재알림 없음(멱등)');

-- ─── (11) 답변 내용이 바뀌면 재알림 ───
SELECT jpc_test_set_user_with_role((current_setting('inq.admin'))::uuid, 'admin');
DO $$
BEGIN
  PERFORM public.respond_inquiry(
    (current_setting('inq.id'))::uuid, (current_setting('inq.admin'))::uuid,
    '운영팀', '정정합니다. 다시 답변드립니다.', 'closed'::public.inquiry_status);
END $$;
SELECT jpc_test_set_user_with_role((current_setting('inq.staff'))::uuid, 'staff');
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (current_setting('inq.staff'))::uuid AND type = 'inquiry_answered'),
  2,
  'respond: 답변 내용 변경 시 재알림(읽을 내용이 달라졌다)');

-- ─── (12) update_inquiry_status: staff 차단 ───
SELECT jpc_test_set_user_with_role((current_setting('inq.staff'))::uuid, 'staff');
SELECT throws_ok(
  format($q$ SELECT public.update_inquiry_status(%L::uuid, 'in_progress'::public.inquiry_status) $q$,
         current_setting('inq.id')),
  'P0001', '관리자 전용', 'updateStatus: non-admin 차단(P0001)');

-- ─── (13) update_inquiry_status: admin 정상 변경 ───
SELECT jpc_test_set_user_with_role((current_setting('inq.admin'))::uuid, 'admin');
DO $$
BEGIN
  PERFORM public.update_inquiry_status((current_setting('inq.id'))::uuid, 'in_progress'::public.inquiry_status);
END $$;
SELECT is(
  (SELECT status::text FROM public.inquiries WHERE id = (current_setting('inq.id'))::uuid),
  'in_progress', 'updateStatus: admin 상태 변경 반영');

-- ─── (14) anon EXECUTE 회수(SECDEF 하드닝 회귀 가드) ───
SELECT is(
  (SELECT has_function_privilege('anon',
      'public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status)', 'EXECUTE')
   OR has_function_privilege('anon',
      'public.update_inquiry_status(uuid, public.inquiry_status)', 'EXECUTE')),
  false, 'anon EXECUTE 회수 유지(respond_inquiry·update_inquiry_status)');

SELECT * FROM finish();
ROLLBACK;
