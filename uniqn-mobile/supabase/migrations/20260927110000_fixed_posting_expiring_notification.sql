-- ============================================================================
-- 고정 공고 게시 기간 — 만료 24시간 전 알림 + 서버 시각 연장·재오픈 RPC (2026-09-27)
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
--
-- ⚠️ expiresAt 이 **없는** 공고는 알리지 않는다. 만료 함수는 그런 행을 created_at + 7일로 닫지만
--    (20260727000000 §5 fallback), 신규 생성은 항상 fixedConfig 를 채우므로(serialization.ts
--    buildFixedConfig) 대상은 레거시 행뿐이다 — 알림 창을 추정 시각으로 만들지 않는다.
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
  -- 🔴 캐스팅은 **CASE 안에서만** 한다. `fixed_config` 는 클라이언트가 직접 쓰는 jsonb 라
  --    '2026-02-30T00:00:00Z' 처럼 모양만 날짜인 값이 들어올 수 있고(만료 트리거는 active 의
  --    UPDATE 만 막는다), WHERE 의 캐스팅은 평가 순서가 보장되지 않는다 — 그 한 행이 이 배치를,
  --    곧 **모든 사장의 알림을** 매시 멈춘다. pg_input_is_valid(PG16+) 로 먼저 거른다.
  WITH candidates AS (
    SELECT
      jp.id                           AS job_posting_id,
      jp.owner_id                     AS recipient_id,
      COALESCE(jp.title, '공고')      AS posting_title,
      jp.fixed_config ->> 'expiresAt' AS expires_at_raw
    FROM public.job_postings jp
    WHERE jp.posting_type = 'fixed'
      AND jp.status IN ('active', 'capacity_full')
      AND jp.owner_id IS NOT NULL
      -- 형식 필터(캐스팅 없음) — pg_input_is_valid 는 'now'·'tomorrow' 같은 특수어도 유효로 본다.
      AND (jp.fixed_config ->> 'expiresAt') ~ '^\d{4}-\d{2}-\d{2}[T ]'
  ),
  expiring AS (
    SELECT
      c.job_posting_id,
      c.recipient_id,
      c.posting_title,
      CASE
        WHEN pg_input_is_valid(c.expires_at_raw, 'timestamptz') THEN c.expires_at_raw::timestamptz
      END AS expires_at
    FROM candidates c
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
      -- 🔑 멱등 키는 **정규화한** 시각이다. 원문 문자열을 쓰면 같은 시각의 다른 표기
      --    ('…Z' vs '…+00:00')가 다른 키가 되어 같은 만료에 알림이 두 번 간다.
      'expiresAt',    to_char(e.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'high'
  FROM expiring e
  WHERE e.expires_at IS NOT NULL
    AND e.expires_at > now()
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

-- ------------------------------------------------------------
-- 4. 연장·재오픈 RPC — 만료 시각을 **서버 시각**으로 다시 잡는다
-- ------------------------------------------------------------
-- 왜 RPC 인가: 만료 판정은 서버 now() 로 하는데(BEFORE UPDATE 트리거 tr_fixed_posting_expired ·
--   크론), 클라이언트가 기기 시각으로 expiresAt 을 쓰면 기기 시계가 느린 폰에서 새 만료가 이미
--   과거가 된다 → 트리거가 **그 UPDATE 안에서 즉시** 공고를 닫는데 앱은 성공 토스트를 띄운다.
--   (이전 재오픈 결함의 실제 원인도 이 트리거였다 — 상태만 active 로 돌리면 옛 expiresAt 때문에
--    같은 UPDATE 에서 곧바로 closed 로 되돌아갔다.)
--
-- SECURITY INVOKER — 권한은 호출자의 RLS·컬럼 권한이 그대로 판단한다(종전 클라 UPDATE 와 동일,
--   owner·워크스페이스 멤버). 권한이 없으면 0행이라 결과가 비고, 앱은 그걸 실패로 다룬다.
-- 반환: 갱신 뒤 상태·만료 — 트리거가 닫아 버린 경우까지 앱이 확인할 수 있게.
CREATE OR REPLACE FUNCTION public.renew_fixed_posting(
  p_job_posting_id uuid,
  p_reopen boolean DEFAULT false
)
RETURNS TABLE (result_status text, result_expires_at text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expires text := to_char((now() + interval '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  RETURN QUERY
  UPDATE public.job_postings jp
     SET fixed_config = jsonb_build_object(
           'durationDays', 7,
           'createdAt', COALESCE(
             jp.fixed_config ->> 'createdAt',
             to_char(jp.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           ),
           'expiresAt', v_expires
         ),
         status = CASE WHEN p_reopen THEN 'active'::public.posting_status ELSE jp.status END,
         updated_at = now()
   WHERE jp.id = p_job_posting_id
     AND jp.posting_type = 'fixed'
     AND CASE
           -- 재오픈: 취소·컨테이너는 다시 열지 않는다(나머지 업무 검증은 앱 저장소가 먼저 한다)
           WHEN p_reopen THEN jp.status NOT IN ('cancelled', 'container')
           -- 연장: 게시 중인 공고만
           ELSE jp.status IN ('active', 'capacity_full')
         END
  RETURNING jp.status::text, jp.fixed_config ->> 'expiresAt';
END;
$$;

COMMENT ON FUNCTION public.renew_fixed_posting(uuid, boolean) IS
  '고정 공고 게시 기간을 서버 시각 기준 지금부터 7일로 다시 잡는다(p_reopen=true 면 active 로 재오픈). '
  'SECURITY INVOKER — RLS 가 권한을 판단한다. 갱신 뒤 상태·만료를 돌려준다(0행 = 권한 없음/대상 아님).';

REVOKE ALL ON FUNCTION public.renew_fixed_posting(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_fixed_posting(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.renew_fixed_posting(uuid, boolean) TO authenticated;
