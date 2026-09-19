-- ops 결함⑦-1 — 수동 추가 스태프 배정 알림.
--
-- 배경: ops → notification 참조가 **0건**이었다(3개 트리 + ops 전용 마이그 34개 + baseline
--   함수 30종 전수 확인, 2026-08-08). 공고 파이프라인으로 들어온 스태프
--   (`ops_import_staff_from_posting` → source='snapshot_import')는 work_logs INSERT 시
--   `notify_on_work_log_insert()` 가 'schedule_created' 를 보내주지만,
--   `ops_add_staff` 로 **ops 안에서 직접 추가된 스태프**(source='manual')는 work_log 도
--   application 도 없다. 즉 자기가 대회에 배정된 사실을 앱 안에서 알 길이 **전혀 없다**.
--   이 마이그는 그 한 구멍만 닫는다.
--
-- ── 설계 결정 1: `is_ops_member` 가 `ops_staff` 를 멤버로 안 본다 → **딥링크를 걸지 않는다** ──
--   `is_ops_member`(baseline:3543-3561) = 대회 owner **또는** 연결 공고 workspace 멤버.
--   `ops_staff` 는 포함되지 않는다. 그런데 ops 전 테이블의 SELECT 정책이 이 함수 하나에
--   달려 있다(`ops_staff_select` = baseline:13815, ops_tournaments 등 동일).
--   → 수동 추가 스태프를 ops 화면으로 보내면 **RLS 가 막는 빈 화면**에 도착한다.
--
--   검토한 세 후보와 채택 근거:
--    (A) 그 스태프가 실제로 볼 수 있는 다른 화면으로 보낸다 → **불가**. source='manual' 은
--        work_log·application 이 0건이라 /schedule 도 지원 상세도 빈 화면이다. 목적지가 없다.
--    (B) `ops_staff` 본인 행에 한정한 좁은 SELECT 정책을 추가한다 → **기각**. 정책 1개로는
--        아무 화면도 열리지 않는다. ops 화면은 `ops_tournaments`(이름·날짜) 를 먼저 읽고,
--        그 정책도 `is_ops_member` 다. 실제로 착지시키려면 tournaments/tables/seats 까지
--        연쇄로 열어야 하고 그게 `is_ops_member` 를 넓히는 것과 같은 크기가 된다
--        (= `/guard` 선행 대상, 이 PR 크기가 아니다). 화면을 못 여는 정책은 되돌리기 쉬운
--        대신 **사용자에게 아무것도 주지 않는 순수 공격면**이라 넣지 않는다.
--    (C) ✅ **채택** — 알림 본문만으로 완결시키고 딥링크를 걸지 않는다. link=NULL 이면
--        `getRouteFromNotification`(deepLinkNavigationExecutor.ts:175)이 route map 을 보고,
--        map 도 'notifications' 로 두었으므로 탭해도 알림함에 머문다(선례: report_resolved).
--        그래서 본문에 **대회명 · 담당 역할 · 날짜 · 장소**를 전부 싣는다 — 이 알림이
--        그 사람이 배정 사실에 접근할 수 있는 **유일한 매체**이기 때문이다.
--   ⚠️ `is_ops_member` 정의 자체는 건드리지 않는다 — 넓히면 ops 전 테이블의 가시성이
--      동시에 바뀐다. ops 화면을 스태프에게 여는 일은 별도 설계(⑦ 후속)로 남긴다.
--
-- ── 설계 결정 2: 형태는 **ops_staff AFTER INSERT 트리거** ──
--    · `ops_events` 에 fan-out 트리거를 다는 안은 기각 — 47종 ops RPC 전부가 한 함수를
--      경유하게 되고, 이벤트 타입 하나 잘못 매칭하면 전 대회·전 액션이 동시에 오발송된다.
--    · `ops_add_staff` 본문 인라인도 기각 — 알림 INSERT 가 ops 변이와 같은 트랜잭션이 되고
--      기존 notify_* 트리거의 fail-soft 보호(EXCEPTION → WARNING → RETURN NEW)가 없어
--      **알림 실패가 라이브 대회의 스태프 추가를 롤백**시킨다.
--    · 트리거 신설의 알려진 위험은 "같은 테이블 중복 트리거 → 푸시 2회"(20260620151331 /
--      20260726000000 실사고 2건)인데, `ops_staff` 에는 **트리거가 0개**다
--      (`node scripts/graph-db-deps.mjs triggers` 실측: 살아있는 트리거 89개, 중복 후보
--       테이블 목록에 ops_* 없음). 신설 후에도 이 테이블의 유일한 트리거다.
--
-- ── 중복 발송 차단 ──
--    · `WHEN (NEW.source = 'manual')` — snapshot_import 는 이미 'schedule_created' 를 받는다.
--      WHEN 절로 거르므로 함수 진입조차 하지 않는다.
--    · 같은 스태프 2회 추가는 `ops_add_staff` 가 DUPLICATE_STAFF(P0001)로 접는다
--      (baseline:5900, advisory lock + UNIQUE(tournament_id, staff_id)) → 알림도 1건뿐.
--    · 알림 INSERT 는 스태프 1인당 1문장 1행이다. 푸시 트리거
--      `on_notification_created_send_push` 는 FOR EACH STATEMENT 이므로 배치도 1회다.
--    · 자기가 자기를 추가한 경우(사장이 본인을 로스터에 넣는 흐름)는 침묵한다.
--
-- ── 알림 타입: 신규 'ops_staff_assigned' (기존 재사용 아님) ──
--    'schedule_created' 재사용은 기각 — 그 타입의 route map 은 '/schedule' 이고, 수동 추가
--    스태프에게 스케줄 탭은 **빈 화면**이다. 결정 (C) 가 성립하려면 자기 라우트를 가진
--    타입이 필요하다. 대신 `notification_category` enum 에는 손대지 않는다
--    ('ops' 추가는 ALTER TYPE ADD VALUE 라 되돌릴 수 없다 — 결함③에서 tournament_status 에
--     archived 를 안 넣기로 한 것과 같은 이유). 카테고리는 기존 'attendance' 재사용:
--    출퇴근·근무배정 축이고, 스태프가 이미 켜 두고 보는 탭이다.
--    ⚠️ 타입 추가는 TS 쪽 exhaustive Record **5곳 + Deno 사본 1곳**을 함께 갱신해야 한다
--       (누락 시 카테고리 게이트 fail-open → 끈 사용자에게도 푸시):
--       src/constants/notificationTemplates.ts · src/types/notification.ts(3곳) ·
--       src/shared/deeplink/NotificationRouteMap.ts · supabase/functions/send-push-notification/typeCategoryMap.ts
--
-- 계약: anon-executable ops SECDEF = **2 유지**(monitor/player). 이 함수는 proname 이
--   `ops\_%` 가 아니라 카운트 대상이 아니지만, PUBLIC/anon 명시 REVOKE 로 동일 규율을 지킨다.
-- 파리티: 신규 함수 1개 → 206 → **207**. 정책 변경 0 → 111 불변(RLS 미변경).
-- 회귀 고정: supabase/tests/ops_staff_assignment_notify.test.sql

CREATE OR REPLACE FUNCTION public.notify_on_ops_staff_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_t          public.ops_tournaments%ROWTYPE;
  v_role_label text;
  v_custom     text;
  v_venue      text;
  v_detail     text[];
  v_name_label text;
BEGIN
  -- 본인이 본인을 추가한 경우는 침묵 — 사장이 자기를 로스터에 넣는 흐름에서
  -- "당신이 배정되었습니다" 는 소음이다. service_role 경로(auth.uid() IS NULL)는 정상 발송.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.staff_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_t FROM public.ops_tournaments WHERE id = NEW.tournament_id;

  -- 역할 한글 라벨 — src/types/role.ts:105 STAFF_ROLE_LABELS 와 동기 유지.
  -- staff_role 은 6종 고정(dealer/floor/serving/manager/staff/other, baseline enum).
  v_role_label := CASE NEW.role
    WHEN 'dealer'  THEN '딜러'
    WHEN 'floor'   THEN '플로어'
    WHEN 'serving' THEN '서빙'
    WHEN 'manager' THEN '매니저'
    WHEN 'staff'   THEN '직원'
    WHEN 'other'   THEN '기타'
    ELSE NEW.role::text
  END;

  -- other 는 custom_role 과 짝이다 — 있으면 '기타' 대신 실제 직무명을 보여준다.
  v_custom := NULLIF(btrim(COALESCE(NEW.custom_role, '')), '');
  IF NEW.role = 'other' AND v_custom IS NOT NULL THEN
    v_role_label := v_custom;
  END IF;

  -- 본문이 유일한 전달 매체다(딥링크 없음 — 헤더 설계 결정 1) → 담당·날짜·장소를 모두 싣는다.
  v_detail := ARRAY['담당 ' || v_role_label];
  IF v_t.event_date IS NOT NULL THEN
    v_detail := v_detail || to_char(v_t.event_date, 'YYYY-MM-DD');
  END IF;
  v_venue := NULLIF(btrim(COALESCE(v_t.venue, '')), '');
  IF v_venue IS NOT NULL THEN
    v_detail := v_detail || v_venue;
  END IF;

  v_name_label := CASE
    WHEN NULLIF(btrim(COALESCE(v_t.name, '')), '') IS NULL THEN '해당'
    ELSE format('''%s''', btrim(v_t.name))
  END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.staff_id,
    'ops_staff_assigned',
    '대회 스태프 배정',
    format('%s 대회에 스태프로 배정되었습니다. (%s)',
           v_name_label, array_to_string(v_detail, ' · ')),
    -- link 는 NULL 이다. 착지시킬 화면이 없다(설계 결정 1) — 굵은 링크를 심으면
    -- RLS 가 막는 빈 화면으로 보내게 된다.
    NULL,
    jsonb_build_object(
      'opsStaffId',     NEW.id,
      'tournamentId',   NEW.tournament_id,
      'tournamentName', COALESCE(v_t.name, ''),
      'eventDate',      COALESCE(to_char(v_t.event_date, 'YYYY-MM-DD'), ''),
      'venue',          COALESCE(v_venue, ''),
      'role',           NEW.role::text,
      'customRole',     COALESCE(v_custom, ''),
      'senderId',       v_t.owner_id
    ),
    'high'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- fail-soft: 알림 실패가 라이브 대회의 스태프 추가를 롤백시키면 안 된다.
  RAISE WARNING '[notify_on_ops_staff_insert] failed for ops_staff % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_on_ops_staff_insert() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_on_ops_staff_insert() IS
  'ops_staff INSERT(source=manual) 시 해당 스태프에게 대회 배정 알림 — ops 결함⑦-1. '
  'snapshot_import 는 트리거 WHEN 절에서 제외한다(공고 파이프라인의 schedule_created 와 중복). '
  'is_ops_member 가 ops_staff 를 멤버로 보지 않아 착지시킬 ops 화면이 없으므로 link 는 NULL 이고 '
  '본문이 대회명·담당·날짜·장소를 모두 싣는다. fail-soft(WARNING) — 알림 실패로 스태프 추가를 롤백하지 않는다.';

-- ops_staff 의 유일한 트리거다(graph-db-deps.mjs triggers 실측: 이 테이블 트리거 0개였음).
-- 재실행 안전을 위해 DROP IF EXISTS 선행 — 중복 트리거는 이 레포에서 2번 사고를 냈다.
DROP TRIGGER IF EXISTS ops_staff_notify_manual_insert ON public.ops_staff;
CREATE TRIGGER ops_staff_notify_manual_insert
  AFTER INSERT ON public.ops_staff
  FOR EACH ROW
  WHEN (NEW.source = 'manual')
  EXECUTE FUNCTION public.notify_on_ops_staff_insert();

-- 트리거 함수는 직접 호출 대상이 아니다(RETURNS trigger). PUBLIC 상속 EXECUTE 를 회수해
-- ops SECDEF 하드닝 규율과 동일하게 맞춘다. 트리거 발화는 ops_add_staff(SECDEF, owner=postgres)
-- 컨텍스트에서 일어나므로 이 회수는 발화에 영향이 없다.
REVOKE ALL ON FUNCTION public.notify_on_ops_staff_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_ops_staff_insert() FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_on_ops_staff_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_ops_staff_insert() TO service_role;
