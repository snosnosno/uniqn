-- ============================================================================
-- 고정 공고 만료 24시간 전 알림 (2026-09-27)
-- ============================================================================
-- 배경: 고정 공고는 게시 7일 뒤 크론 `expire-fixed-postings`(매시 11분)가 자동 마감한다.
--   방치 공고(이미 사람을 구했는데 안 내린 공고)를 막는 장치라 유지한다. 대신 상시로 사람을
--   구하는 사장이 매주 새로 올리지 않도록, 마감 24시간 전에 "계속 구하시면 7일 연장"을 알린다.
--   연장은 관리 화면의 [7일 연장] 한 번이다(앱 — JobPostingRepository.extendFixedPostingWithTransaction).
--
-- 🚨 멱등이 본체다(S3-1 20260813110000 과 같은 이유) — notifications 에는 멱등 컬럼이 없어
--    크론이 매시 도는 동안 같은 공고에 알림이 24번 쌓일 수 있다. 부분 UNIQUE 인덱스를 먼저 두고
--    INSERT 는 ON CONFLICT DO NOTHING 이다. 키에 **만료 시각**을 넣어, 연장해서 만료가 바뀌면
--    다음 주기에 다시 한 번 알릴 수 있게 한다.
--
-- 창: 지금 < expiresAt ≤ 지금 + 24시간. 크론은 매시 5분 — 만료 23~24시간 전에 한 번 간다.
--    앱의 '임박' 판정(FIXED_EXPIRY_SOON_HOURS = 24, src/domains/job-posting/fixedExpiry.ts)과 같은 창이다.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. 멱등 인덱스 (함수보다 먼저)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS notifications_fixed_posting_expiring_idem
  ON public.notifications (
    recipient_id,
    ((data ->> 'jobPostingId')),
    ((data ->> 'expiresAt'))
  )
  WHERE type = 'fixed_posting_expiring';

COMMENT ON INDEX public.notifications_fixed_posting_expiring_idem IS
  '고정 공고 만료 예정 알림 멱등 가드: 같은 (수신자, 공고, 만료 시각) 알림은 한 번만. '
  '연장으로 만료 시각이 바뀌면 새 키가 되어 다음 주기에 다시 알릴 수 있다.';

-- ------------------------------------------------------------
-- 2. 알림 생성 함수
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_fixed_postings_expiring()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH expiring AS (
    SELECT
      jp.id                                   AS job_posting_id,
      jp.owner_id                             AS recipient_id,
      COALESCE(jp.title, '공고')              AS posting_title,
      jp.fixed_config ->> 'expiresAt'         AS expires_at_raw,
      (jp.fixed_config ->> 'expiresAt')::timestamptz AS expires_at
    FROM public.job_postings jp
    WHERE jp.posting_type = 'fixed'
      AND jp.status IN ('active', 'capacity_full')
      AND jp.owner_id IS NOT NULL
      -- ISO 형식만 캐스팅한다 — 손상된 값 하나로 배치 전체가 죽지 않게.
      AND (jp.fixed_config ->> 'expiresAt') ~ '^\d{4}-\d{2}-\d{2}T'
  )
  INSERT INTO public.notifications (
    recipient_id, type, category, title, body, link, data, priority
  )
  SELECT
    e.recipient_id,
    'fixed_posting_expiring',
    'job'::public.notification_category,
    '⏰ 고정 공고가 곧 마감돼요',
    format(
      '''%s'' 고정 공고가 %s에 마감돼요. 계속 구하시면 7일 연장해 주세요.',
      e.posting_title,
      to_char(e.expires_at AT TIME ZONE 'Asia/Seoul', 'MM"월" DD"일" HH24:MI')
    ),
    format('/my-postings/%s', e.job_posting_id),
    jsonb_build_object(
      'jobPostingId', e.job_posting_id,
      'jobTitle',     e.posting_title,
      'expiresAt',    e.expires_at_raw
    ),
    'high'
  FROM expiring e
  WHERE e.expires_at > now()
    AND e.expires_at <= now() + interval '24 hours'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.fn_notify_fixed_postings_expiring() IS
  '고정 공고 만료 24시간 전 알림을 공고 소유자에게 보낸다. 멱등 인덱스 '
  'notifications_fixed_posting_expiring_idem 로 매시 실행에도 (공고, 만료 시각)당 한 번. 삽입 건수를 반환한다.';

-- SECDEF 하드닝 — 크론(postgres)만 부른다.
REVOKE ALL ON FUNCTION public.fn_notify_fixed_postings_expiring() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notify_fixed_postings_expiring() FROM anon;
REVOKE ALL ON FUNCTION public.fn_notify_fixed_postings_expiring() FROM authenticated;

-- ------------------------------------------------------------
-- 3. 크론 — 매시 5분 (만료 크론 11분보다 앞)
-- ------------------------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-fixed-postings-expiring') THEN
    PERFORM cron.unschedule('notify-fixed-postings-expiring');
  END IF;

  PERFORM cron.schedule(
    'notify-fixed-postings-expiring',
    '5 * * * *',
    $cron$ SELECT public.fn_notify_fixed_postings_expiring(); $cron$
  );
EXCEPTION
  -- 로컬 Docker 에는 pg_cron 이 없다. 여기서 죽으면 `npm run db:reset` 이 통째로 실패한다.
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[fixed-expiring] pg_cron 미설치 — 만료 예정 알림 크론 skip (함수·인덱스는 생성됨)';
END $do$;
