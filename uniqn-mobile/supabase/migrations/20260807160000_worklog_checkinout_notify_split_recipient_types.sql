-- uniqn-mobile/supabase/migrations/20260807160000_worklog_checkinout_notify_split_recipient_types.sql
-- 출퇴근 알림을 수신자별 타입으로 되돌린다 (전체 감사 A3, 2026-08-07)
--
-- 배경 — 이것은 신규 결함이 아니라 **리팩터 회귀의 복구**다:
--   2026-04-17 원설계(archive/20260417050000_work_log_checkinout_notifications.sql)는
--   수신자별로 타입을 나눠 보냈다.
--     스태프 → check_in_confirmed  / check_out_confirmed   link '/schedule'
--     구인자 → staff_checked_in    / staff_checked_out     link '/employer/applicants/{jobId}'
--   그런데 2026-04-21 의 timestamptz 전환(archive/20260421190000, 문서상 목표가 "비파괴")이
--   이 넷을 work_log_check_in / work_log_check_out **두 종으로 합쳐 버렸다.** 그 결과:
--     ① 합쳐진 값이 클라 enum 에 없어 '출퇴근' 카테고리 탭에서 알림이 증발(전체 탭에만 노출)
--     ② send-push-notification 의 카테고리 게이트가 미매핑 → fail-open →
--        사용자가 출퇴근 푸시를 꺼도 계속 발송
--     ③ 한 타입에 두 수신자가 섞여 라우팅 판별자가 소멸 → 구인자가 자기 공고의
--        **구직자용 상세**(/jobs/{id})에 착지
--   prod 실측(2026-08-07): work_log_check_in 4건 · work_log_check_out 2건.
--
-- 이 마이그레이션은 타입 4종을 되살리고 구인자 link 를 employer 화면으로 되돌린다.
-- 클라이언트 배선(카테고리·우선순위·라벨·라우트맵·EF 카테고리맵·그룹핑)은 원설계 시절
-- 그대로 **이미 완비되어 있다** — 되살리기만 하면 ①②③ 이 동시에 닫힌다.
--
-- ⚠️ 이미 발송된 6건은 work_log_check_in/out 값을 그대로 갖는다(이력 변조 금지).
--    클라이언트가 그 둘을 '레거시' 타입으로 등록해 흡수한다(src/types/notification.ts).
--
-- 방식: CREATE OR REPLACE 전용. DROP+CREATE 금지 —
--   ① 트리거가 이 함수에 매달려 있다(work_log_notify_checkinout_update)
--   ② DROP 하면 20260730174805 의 REVOKE 가 소실되고 prod pg_default_acl 의
--      anon=X 가 자동 부여되어 보안 회귀가 된다.
-- 본문은 prod pg_get_functiondef 원문을 복사했고, 아래 4곳만 바꿨다:
--   type 리터럴 4개 + 구인자 link 2줄. review_request INSERT 2건은 손대지 않는다.
-- 파리티: 함수 수·정책 수 증감 0 → 200/111 불변.

CREATE OR REPLACE FUNCTION public.notify_on_work_log_checkinout_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_did_check_in boolean;
  v_did_check_out boolean;
  v_staff_name text;
  v_employer_id uuid;
  v_job_title text;
  v_job_posting_id uuid;
  v_check_in_display text;
  v_check_out_display text;
  v_base_data jsonb;
BEGIN
  v_did_check_in := OLD.check_in_ts IS NULL AND NEW.check_in_ts IS NOT NULL;
  v_did_check_out := OLD.check_out_ts IS NULL AND NEW.check_out_ts IS NOT NULL;

  IF NOT v_did_check_in AND NOT v_did_check_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  SELECT jp.owner_id, jp.title, jp.id
    INTO v_employer_id, v_job_title, v_job_posting_id
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_posting_id;

  v_base_data := jsonb_build_object(
    'workLogId', NEW.id,
    'staffId', NEW.staff_id,
    'staffName', v_staff_name,
    'jobPostingId', v_job_posting_id,
    'jobPostingTitle', COALESCE(v_job_title, '근무')
  );

  IF v_did_check_in THEN
    v_check_in_display := public._fmt_worklog_time(NEW.check_in_ts);

    -- 스태프 본인: 내 출근이 기록됐다
    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'check_in_confirmed',
      '✅ 출근 확인',
      COALESCE(format('%s 출근 처리되었습니다. (%s)', v_job_title, v_check_in_display),
               '출근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      -- 구인자: 우리 스태프가 출근했다 → 지원자·출퇴근 화면으로 착지
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'staff_checked_in',
        '✅ 스태프 출근',
        COALESCE(format('%s 님이 %s 에 출근했습니다. (%s)', v_staff_name, v_job_title, v_check_in_display),
                 '스태프가 출근했습니다.'),
        format('/employer/applicants/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
        'normal'
      );
    END IF;
  END IF;

  IF v_did_check_out THEN
    v_check_out_display := public._fmt_worklog_time(NEW.check_out_ts);

    -- 스태프 본인: 내 퇴근이 기록됐다
    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'check_out_confirmed',
      '🏁 퇴근 확인',
      COALESCE(format('%s 퇴근 처리되었습니다. (%s)', v_job_title, v_check_out_display),
               '퇴근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
      'normal'
    );

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'review_request',
      '📝 평가 요청',
      COALESCE(format('%s 근무에 대해 평가해주세요.', v_job_title), '근무 평가를 남겨주세요.'),
      format('/reviews/%s', NEW.id),
      v_base_data || jsonb_build_object('reviewerType', 'staff'),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      -- 구인자: 우리 스태프가 퇴근했다 → 지원자·출퇴근 화면으로 착지
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'staff_checked_out',
        '🏁 스태프 퇴근',
        COALESCE(format('%s 님이 %s 에 퇴근했습니다. (%s)', v_staff_name, v_job_title, v_check_out_display),
                 '스태프가 퇴근했습니다.'),
        format('/employer/applicants/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
        'normal'
      );

      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'review_request',
        '📝 스태프 평가 요청',
        COALESCE(format('%s 근무의 스태프를 평가해주세요.', v_job_title),
                 '스태프 평가를 남겨주세요.'),
        format('/reviews/%s', NEW.id),
        v_base_data || jsonb_build_object('reviewerType', 'employer'),
        'normal'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_work_log_checkinout_update() IS
  'check_in_ts/check_out_ts null→non-null 전환 시 스태프+구인자 알림. 수신자별 타입 분리: 스태프=check_in_confirmed/check_out_confirmed(/schedule), 구인자=staff_checked_in/staff_checked_out(/employer/applicants). 2026-04-21 timestamptz 전환이 work_log_check_in/out 한 종으로 합쳤던 것을 2026-08-07 에 복원(감사 A3).';
