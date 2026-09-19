-- ============================================================
-- 신고 처리 결과 알림 발송 (report_resolved) — 앱이 FAQ 로 약속한 통지 복구
--
-- 배경: `src/types/inquiry.ts` 의 FAQ 'faq-report-1' 답변이
--   "처리 결과는 앱 내 알림으로 안내드립니다" 라고 명시하고 있는데,
--   실제로는 그 알림을 만드는 코드가 **어디에도 없었다**.
--     · `report_resolved` 를 INSERT 하는 SQL: 마이그레이션 전체에서 0건
--     · `review_report` RPC(archive/20260420150000_add_report_rpcs.sql) 본문:
--       reports UPDATE 만 하고 notifications INSERT 없음
--     · reports 테이블 트리거 3개(report_notify_insert · reports_updated_at ·
--       reports_xss_check) 중 UPDATE 시 알림을 보내는 것은 없음
--   반면 수신측은 100% 배선돼 있다 —
--     타입 `NotificationType.REPORT_RESOLVED`(src/types/notification.ts:100),
--     카테고리 매핑 ADMIN(:223), 기본 우선순위 'normal'(:302),
--     템플릿(src/constants/notificationTemplates.ts:291),
--     아이콘(src/components/notifications/NotificationIcon.tsx:90),
--     라우트맵(src/shared/deeplink/NotificationRouteMap.ts:94 → 'notifications'),
--     푸시 카테고리(supabase/functions/send-push-notification/typeCategoryMap.ts:56 → 'admin').
--   즉 **송신부 한 조각만 비어 있었다.** 그 조각을 트리거로 채운다.
--
-- 설계 결정
--   1) RPC(review_report) 안이 아니라 트리거로 둔다.
--      reports.status 는 RPC 말고도 관리자 콘솔/수기 UPDATE 로 바뀔 수 있다
--      (rep_update RLS 는 admin 에게 테이블 직접 UPDATE 를 허용한다).
--      전이 자체에 붙여야 경로가 늘어도 약속이 깨지지 않는다.
--   2) 수신자는 `NEW.reporter_id` 단 한 명. 신고 대상(target_id)에게는 보내지 않는다 —
--      제재 여부는 별도 정책이고, 통지 자체가 신고자 신원을 추측하게 만든다.
--   3) ⚠️ `reviewer_notes`(관리자 내부 메모)는 본문에 **넣지 않는다**.
--      노출 여부는 아직 결정되지 않은 프라이버시 사안이다. 관리자 식별자(reviewer_id)도
--      싣지 않는다(신고자에게 담당자를 특정시킬 이유가 없다).
--
-- ⚠️ 함수 카운트: +1 (notify_on_report_review) → 186 → 187.
--    supabase/tests/parity_baseline_guard.test.sql 의 단언 리터럴 +
--    PARITY_EXPECT_FUNCS 마커를 같은 PR 에서 동시 갱신했다.
--    정책 카운트는 불변(테이블·RLS 미변경 — 기존 reports/notifications 재사용).
-- ============================================================

-- ------------------------------------------------------------
-- 트리거 함수
--
-- search_path 에 pg_temp 를 반드시 포함한다 — parity_baseline_guard 7번 단언이
-- "SECDEF search_path pg_temp 누락 함수 0" 을 강제한다(temp-table shadowing 방어).
-- 형태는 형제 트리거 notify_on_report_insert 의 현행 설정
-- (baseline 'public','extensions' + 20260711100000 이 ALTER 로 얹은 pg_temp)과 동일하게 맞춘다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_report_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_type_label text;
  v_title text;
  v_body text;
BEGIN
  -- 1) 발화 조건 재확인 (트리거 WHEN 절과 이중 가드)
  --    미처리(pending/reviewed) → 종결(resolved/dismissed) 전이만 통지한다.
  IF COALESCE(OLD.status, 'pending') NOT IN ('pending', 'reviewed')
     OR NEW.status IS NULL
     OR NEW.status NOT IN ('resolved', 'dismissed') THEN
    RETURN NULL;
  END IF;

  -- 2) 수신자 가드 — reporter_id 는 nullable 이다(탈퇴 시 SET NULL 경로 포함).
  --    NULL 이면 보낼 곳이 없다. notifications.recipient_id 는 NOT NULL 이라
  --    가드가 없으면 여기서 예외가 나고 신고 처리 자체가 위험해진다.
  IF NEW.reporter_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3) 신고 유형 라벨 — notify_on_report_insert 의 매핑과 1:1 동일하게 유지한다.
  v_type_label := CASE NEW.type
    WHEN 'tardiness' THEN '지각'
    WHEN 'negligence' THEN '근무태만'
    WHEN 'no_show' THEN '노쇼'
    WHEN 'early_leave' THEN '무단 조퇴'
    WHEN 'inappropriate' THEN '부적절한 행동'
    WHEN 'dress_code' THEN '복장 불량'
    WHEN 'communication' THEN '소통 문제'
    WHEN 'false_posting' THEN '허위 공고'
    WHEN 'employer_negligence' THEN '근무 관리 태만'
    WHEN 'unfair_treatment' THEN '부당한 대우'
    WHEN 'inappropriate_behavior' THEN '부적절한 행동'
    WHEN 'other' THEN '기타'
    ELSE NEW.type
  END;

  -- 4) 처리(resolved)와 기각(dismissed)을 문구로 구분한다.
  --    "처리되었습니다" 하나로 뭉뚱그리면 기각당한 신고자가 조치가 된 줄 안다.
  IF NEW.status = 'resolved' THEN
    v_title := '✅ 신고 처리 완료';
    v_body := format(
      '접수하신 %s 신고가 검토를 마치고 조치 완료되었습니다.',
      v_type_label
    );
  ELSE
    v_title := '📋 신고 검토 결과';
    v_body := format(
      '접수하신 %s 신고는 검토 결과 별도 조치 없이 종결되었습니다.',
      v_type_label
    );
  END IF;

  -- 5) 알림 INSERT
  --    · type: 클라이언트 SSOT 의 NotificationType.REPORT_RESOLVED 와 동일한 'report_resolved'
  --    · category: NOTIFICATION_TYPE_TO_CATEGORY[REPORT_RESOLVED] = ADMIN 과 일치하는 'admin'
  --    · priority: NOTIFICATION_DEFAULT_PRIORITY[REPORT_RESOLVED] = 'normal'
  --    · link: 신고자용 상세 화면이 없다(admin/report 는 관리자 전용).
  --      NOTIFICATION_ROUTE_MAP[REPORT_RESOLVED] 가 가리키는 목적지와 같은 '/notifications'.
  INSERT INTO public.notifications (
    recipient_id, type, category, title, body, link, data, priority
  ) VALUES (
    NEW.reporter_id,
    'report_resolved',
    'admin'::public.notification_category,
    v_title,
    v_body,
    '/notifications',
    jsonb_build_object(
      'reportId', NEW.id,
      'reportType', NEW.type,
      'reportStatus', NEW.status,
      'targetName', COALESCE(NEW.target_name, '')
      -- ⚠️ reviewer_notes(관리자 내부 메모)·reviewer_id 는 의도적으로 제외한다.
    ),
    'normal'
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 알림 실패가 신고 처리(UPDATE) 자체를 되돌리면 안 된다.
  RAISE WARNING '[notify_on_report_review] failed for report % — %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.notify_on_report_review() IS
  'reports 상태가 pending/reviewed → resolved/dismissed 로 전이될 때 신고자에게 report_resolved 알림 발송. '
  'reporter_id NULL(탈퇴 등)이면 무발송. 관리자 내부 메모(reviewer_notes)·담당자 식별자는 싣지 않는다.';

-- ------------------------------------------------------------
-- 트리거 배선
--
-- `AFTER UPDATE OF status` 대신 WHEN 절로 실제 값 전이를 본다 —
-- `UPDATE OF` 는 문장에 명시된 컬럼 기준이라 다른 경로(BEFORE 트리거가 값을 바꾸는 등)를 놓친다.
-- 이름은 형제 트리거 report_notify_insert 의 관례를 따른다.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS report_notify_review ON public.reports;
CREATE TRIGGER report_notify_review
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('resolved', 'dismissed')
    AND COALESCE(OLD.status, 'pending') IN ('pending', 'reviewed')
    AND NEW.reporter_id IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_on_report_review();

-- ------------------------------------------------------------
-- 권한 회수
--
-- ⚠️ DROP FUNCTION 을 쓰지 않는 이유와 같은 맥락이다 —
-- 20260731090000_revoke_public_execute_trigger_functions.sql 이 확립한 규율대로
-- 신설 트리거 함수도 PUBLIC/anon/authenticated 의 EXECUTE 를 즉시 회수한다.
-- 트리거는 테이블 소유자 권한으로 실행되므로 회수해도 동작에 영향이 없다.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.notify_on_report_review() FROM PUBLIC, anon, authenticated;
