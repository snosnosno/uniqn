-- =============================================================================
-- reports 신원 컬럼 고정 (reporter_id / target_id / job_posting_id)
-- =============================================================================
-- 배경
--   `rep_update` 정책은 `USING (get_my_role() = 'admin')` 뿐이고 **WITH CHECK 이 없다**
--   (pg_policies 실측: qual 만 있고 with_check 는 비어 있다).
--   UPDATE 에 WITH CHECK 이 없으면 Postgres 는 USING 식을 그대로 쓰는데, 이 식은 행 컬럼을
--   하나도 보지 않으므로 **바뀐 뒤의 행이 무엇이든 통과**한다.
--
--   그 결과 관리자가 `review_report` RPC 를 우회해 raw PostgREST PATCH 로
--   `reporter_id` 를 임의 사용자로 재지정하면서 `status = 'resolved'` 로 전이시킬 수 있었다.
--   그러면 20260802170000 이 붙인 SECDEF 트리거가 `NEW.reporter_id` 를 그대로 믿고
--   notifications RLS 를 우회해 INSERT 한다 →
--     · 관리자 UI 에 존재하지 않는 "임의 수신자에게 시스템 알림" 경로가 열리고
--     · 원래 신고자는 처리 결과를 영영 받지 못한다(감사 회피).
--   기밀성 증가는 없다(관리자는 이미 전 데이터를 본다) — 위조·은폐가 문제다.
--
--   같은 축의 선례: 20260802120000 의 `fn_work_logs_pin_identity`(감사 M4).
--   판별 원리도 동일하다 — SECDEF 함수 안에서 `current_user` 는 definer 로 바뀌므로
--   직접 PATCH(`authenticated`)와 신뢰 경로(`postgres`/`service_role`)를 가를 수 있다.
--
-- ⚠️ 파리티: 함수 +1 (PARITY_EXPECT_FUNCS 187 → 188).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_reports_pin_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- target_id / job_posting_id 는 정당한 UPDATE writer 가 한 곳도 없다
  -- (public.reports 를 UPDATE 하는 함수는 review_report·permanently_delete_user 둘뿐이고,
  --  둘 다 이 두 컬럼을 건드리지 않는다 — prosrc 실측).
  IF NEW.target_id IS DISTINCT FROM OLD.target_id THEN
    RAISE EXCEPTION 'REPORT_TARGET_IMMUTABLE: reports.target_id 는 변경할 수 없습니다 (피신고자 바꿔치기 차단)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  IF NEW.job_posting_id IS DISTINCT FROM OLD.job_posting_id THEN
    RAISE EXCEPTION 'REPORT_POSTING_IMMUTABLE: reports.job_posting_id 는 변경할 수 없습니다 (신고 맥락 위조 차단)'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN
    -- 다른 사용자로의 재지정은 채널과 무관하게 전면 차단한다.
    -- 이걸 허용하면 처리 결과 알림이 엉뚱한 사람에게 가고 원 신고자는 통지를 잃는다.
    IF NEW.reporter_id IS NOT NULL THEN
      RAISE EXCEPTION 'REPORT_REPORTER_IMMUTABLE: reports.reporter_id 는 다른 사용자로 변경할 수 없습니다 (수신자 위조 차단)'
        USING ERRCODE = '42501';
    END IF;

    -- NULL 화(탈퇴 시 참조 해제)는 신뢰 컨텍스트에서만 허용한다.
    -- `permanently_delete_user` 가 `UPDATE public.reports SET reporter_id = NULL` 을 수행한다(실측).
    -- 그 함수는 SECDEF 라 내부에서 current_user 가 definer 로 바뀌므로 이 데니리스트를 통과한다.
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'REPORT_REPORTER_IMMUTABLE: reports.reporter_id 는 직접 해제할 수 없습니다 (계정 삭제 경로 전용)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_reports_pin_identity() IS
  'reports 의 reporter_id/target_id/job_posting_id 불변. reporter_id NULL 화(탈퇴 참조 해제)만 '
  '신뢰 컨텍스트에서 허용한다(current_user 데니리스트). rep_update 정책에 WITH CHECK 이 없어 '
  '관리자 raw PATCH 로 신고 수신자·대상을 바꿔치기할 수 있던 경로를 막는다.';

-- 트리거 함수는 직접 호출 대상이 아니다 (20260731090000 의 하드닝 관례와 정합).
REVOKE EXECUTE ON FUNCTION public.fn_reports_pin_identity() FROM PUBLIC, anon, authenticated;

-- `UPDATE OF <컬럼>` 이 아니라 WHEN 절로 **실제 값 전이**를 본다.
-- `UPDATE OF` 는 문장에 명시된 컬럼 기준이라 BEFORE 트리거가 값을 바꾸는 경로를 놓친다
-- (같은 판단을 20260802170000 의 report_notify_review 에서도 했다).
-- 이름이 r* 인 기존 BEFORE 트리거(reports_updated_at·reports_xss_check)보다 뒤에 발화하므로
-- 최종 값을 본다.
DROP TRIGGER IF EXISTS tr_reports_pin_identity ON public.reports;
CREATE TRIGGER tr_reports_pin_identity
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  WHEN (
    OLD.reporter_id    IS DISTINCT FROM NEW.reporter_id
    OR OLD.target_id      IS DISTINCT FROM NEW.target_id
    OR OLD.job_posting_id IS DISTINCT FROM NEW.job_posting_id
  )
  EXECUTE FUNCTION public.fn_reports_pin_identity();
