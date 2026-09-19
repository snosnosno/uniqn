-- ============================================================
-- 감사 push-01 / push-04 / push-02(DB 절반) 회귀 가드 (마이그 20260809150000)
-- ============================================================
-- 고정하려는 계약
--   1) 일괄 정산 중에는 트리거가 정산완료 알림을 만들지 않는다(GUC 스위치)
--   2) 개별 정산 경로는 종전 그대로 트리거가 만든다 — 스위치가 새면 알림이 통째로 사라진다
--   3) 음수 정산 브로드캐스트는 **활성 admin 만** 받는다
--   4) 일괄 RPC 가 스위치를 켜고 배치 INSERT 로 되갚는 구조를 유지한다(구조 단언)
--   5) push_tickets 는 deny-all(정책 0) 이고 receipts 폴링 크론이 등록돼 있다
--
-- 🚨 1번을 "알림 0건"만으로 단언하면 "원래 안 만들어졌다"와 구분되지 않는다.
--    그래서 **같은 UPDATE 를 스위치 off 로 한 번 더 돌려 1건이 생기는 것**을 대조군으로 둔다.
--
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(9);

DO $$
DECLARE s RECORD;
        v_admin uuid;
        v_inactive uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('push.wl_id', s.work_log_id::text, true);
  PERFORM set_config('push.staff_id', s.outsider_id::text, true);

  -- users.id 는 auth.users FK 라 헬퍼로 만든다(직접 INSERT 는 users_id_fkey 위반).
  v_admin := jpc_test_create_user('admin');
  v_inactive := jpc_test_create_user('admin');
  UPDATE public.users SET is_active = false, status = 'inactive' WHERE id = v_inactive;
  PERFORM set_config('push.admin_active', v_admin::text, true);
  PERFORM set_config('push.admin_inactive', v_inactive::text, true);

  -- 🔑 payroll 컬럼은 protect_work_log_payroll_columns 트리거가 지킨다. 그 트리거는
  --    definer 가 아니라 **호출자 JWT 의 app_metadata.role** 을 읽으므로, 클레임만 심는다.
  --    DB role 은 postgres 그대로 둔다 — 여기서 authenticated 로 바꾸면 RLS 까지 얹혀
  --    이 테스트가 검증하려는 트리거 동작이 가려진다.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );
END $$;

-- 정산 대상이 되도록 출퇴근을 채우고 미정산 상태로 맞춘다(신뢰 컨텍스트).
UPDATE public.work_logs
   SET payroll_status = 'pending',
       payroll_amount = 10000,
       staff_id = (current_setting('push.staff_id'))::uuid
 WHERE id = (current_setting('push.wl_id'))::uuid;

-- ------------------------------------------------------------
-- 1. 대조군 — 스위치 off 면 트리거가 정산완료 알림을 만든다 (개별 정산 경로 불변)
-- ------------------------------------------------------------
UPDATE public.work_logs SET payroll_status = 'completed'
 WHERE id = (current_setting('push.wl_id'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'settlement_completed'
      AND (data ->> 'workLogId') = current_setting('push.wl_id')),
  1,
  'push-01 대조군: 스위치 off 면 트리거가 정산완료 알림을 1건 만든다(개별 정산 경로 불변)'
);

-- ------------------------------------------------------------
-- 2. 스위치 on 이면 같은 전이에서 만들지 않는다
-- ------------------------------------------------------------
UPDATE public.work_logs SET payroll_status = 'pending'
 WHERE id = (current_setting('push.wl_id'))::uuid;
DELETE FROM public.notifications
 WHERE type = 'settlement_completed'
   AND (data ->> 'workLogId') = current_setting('push.wl_id');

SELECT set_config('uniqn.defer_settlement_notify', 'on', true);
UPDATE public.work_logs SET payroll_status = 'completed'
 WHERE id = (current_setting('push.wl_id'))::uuid;
SELECT set_config('uniqn.defer_settlement_notify', 'off', true);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'settlement_completed'
      AND (data ->> 'workLogId') = current_setting('push.wl_id')),
  0,
  'push-01: 스위치 on 이면 트리거가 정산완료 알림을 만들지 않는다(일괄이 뒤에 한 문으로 만든다)'
);

-- ------------------------------------------------------------
-- 3~5. push-04 — 음수 정산은 활성 admin 만 받는다
-- ------------------------------------------------------------
UPDATE public.work_logs SET payroll_amount = -5000
 WHERE id = (current_setting('push.wl_id'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'negative_settlement_alert'
      AND recipient_id = (current_setting('push.admin_active'))::uuid),
  1,
  'push-04: 활성 admin 은 음수 정산 경고를 받는다'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE type = 'negative_settlement_alert'
      AND recipient_id = (current_setting('push.admin_inactive'))::uuid),
  0,
  'push-04: 비활성 admin 은 받지 않는다(종전에는 role=admin 이면 전부 받았다)'
);

SELECT is(
  (SELECT priority FROM public.notifications
    WHERE type = 'negative_settlement_alert'
      AND recipient_id = (current_setting('push.admin_active'))::uuid),
  'urgent',
  'push-04: 우선순위 urgent 가 유지된다(단문화가 페이로드를 바꾸지 않았다)'
);

-- ------------------------------------------------------------
-- 6~7. 구조 — 일괄 RPC 가 스위치를 켜고 배치 INSERT 로 되갚는다
--   행동만으로는 "한 문으로 모았는가"를 관측할 수 없어(내용이 동일) 본문을 단언한다.
-- ------------------------------------------------------------
SELECT ok(
  (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'bulk_settle_work_logs')
   LIKE '%set_config(''uniqn.defer_settlement_notify'', ''on'', true)%',
  'push-01: bulk_settle_work_logs 가 루프 전에 알림 지연 스위치를 켠다'
);

SELECT ok(
  (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'bulk_settle_work_logs')
   LIKE '%INSERT INTO public.notifications%SELECT%v_settled_ids%',
  'push-01: bulk_settle_work_logs 가 성공 건 전체를 한 문(INSERT…SELECT)으로 알린다'
);

-- ------------------------------------------------------------
-- 8~9. push-02(DB 절반) — 관측 테이블과 폴링 크론
-- ------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_tickets'),
  0,
  'push-02: push_tickets 는 정책 0개(deny-all) — service_role 전용이고 파리티 정책 수도 불변'
);

SELECT is(
  (SELECT count(*)::int FROM cron.job WHERE jobname = 'poll-push-receipts'),
  1,
  'push-02: receipts 폴링 크론이 등록돼 있다(ticket ok 는 전달 보증이 아니다)'
);

SELECT * FROM finish();
ROLLBACK;
