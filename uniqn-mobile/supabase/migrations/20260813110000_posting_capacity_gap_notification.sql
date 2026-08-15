-- ============================================================================
-- S3-1 · 근무일 D-2/D-1 정원 미달 알림
-- ============================================================================
-- 사장이 공고를 올려 두고 잊는다. 근무 당일 아침에야 "한 명 못 채웠네"를 알면 그때는
-- 메울 방법이 없다 — 단발 인력은 하루 전에 이미 다른 일정을 잡는다.
-- 근무일 이틀 전·하루 전에 "아직 N자리 비었다"를 알려 아직 손쓸 수 있을 때 알게 한다.
--
-- 🚨 멱등이 이 마이그레이션의 본체다.
--    `notifications` 에는 멱등 컬럼이 없어서, 크론이 두 번 돌거나(재시도·수동 실행)
--    같은 날 배포로 재실행되면 **같은 알림이 그대로 또 INSERT 된다.** 사장 알림함이
--    같은 문장으로 도배되면 그 다음부터는 알림 자체를 안 본다 — 기능이 스스로를 망친다.
--    그래서 함수보다 **부분 UNIQUE 인덱스가 먼저**고, INSERT 는 ON CONFLICT DO NOTHING 이다.
--
-- 판정 축:
--   필요 인원 = job_postings.schedule → requirements[].timeSlots[].roles[].count 합 (날짜별)
--   채운 인원 = work_logs 중 cancelled/no_show 를 뺀 행 수 (날짜별)
--   ⚠️ 공고 단위 합계(filled_positions/total_positions)를 쓰지 않는 이유: 여러 날짜 공고에서
--      D-2 인 날은 다 찼는데 다른 날이 비어 있으면 엉뚱한 날짜로 알림이 간다.
--      "언제" 가 빠진 정원 경고는 행동으로 이어지지 않는다.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. 멱등 인덱스 (함수보다 먼저)
-- ------------------------------------------------------------
-- 같은 (수신자, 공고, 근무일, D-offset) 조합은 영원히 한 번만.
-- 부분 인덱스라 다른 알림 타입의 INSERT 비용에는 영향이 없다.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_posting_capacity_gap_idem
  ON public.notifications (
    recipient_id,
    ((data ->> 'jobPostingId')),
    ((data ->> 'workDate')),
    ((data ->> 'dOffset'))
  )
  WHERE type = 'posting_capacity_gap';

COMMENT ON INDEX public.notifications_posting_capacity_gap_idem IS
  'S3-1 멱등 가드: 크론 재실행·중복 호출에도 같은 (공고,근무일,D-offset) 알림이 두 번 들어가지 않게 한다. '
  'notifications 테이블에 멱등 컬럼이 없어 data jsonb 표현식으로 대신한다.';

-- ------------------------------------------------------------
-- 2. 알림 생성 함수
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_posting_capacity_gap()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- 근무일은 KST 로 산다. UTC 로 D-day 를 재면 한국 시간 오전 9시 이전에 하루가 밀린다.
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_inserted integer := 0;
BEGIN
  WITH required AS (
    SELECT
      jp.id                                     AS job_posting_id,
      jp.owner_id                               AS recipient_id,
      jp.title                                  AS posting_title,
      (req ->> 'date')::date                    AS work_date,
      SUM(COALESCE((r ->> 'count')::integer, 0)) AS required_count
    FROM public.job_postings jp
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(jp.schedule -> 'requirements', '[]'::jsonb)) req
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(req -> 'timeSlots', '[]'::jsonb)) ts
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts -> 'roles', '[]'::jsonb)) r
    -- 🚨 `capacity_full` 을 빼면 안 된다. 그 상태는 **공고 합계**(filled_positions/total_positions)
    --    기준으로 좌석 트리거가 자동 전이시키는데(20260718000000:50-55), 이 함수가 :17-19 에서
    --    "합계 축은 날짜를 못 가린다"며 거부한 바로 그 축이다. A일 정원1·B일 정원2 인 공고에서
    --    A일에 3명이 들어가면 합계가 차 `capacity_full` 이 되고, B일이 0/2 인데 알림이 한 건도
    --    안 나간다 — 아래 :91-92 의 좁은 판정축 방어가 status 필터에서 통째로 무효화된다.
    --    날짜별 gap 계산이 이미 정확하므로 포함해도 오탐은 늘지 않는다(빈자리 없으면 안 뽑힌다).
    WHERE jp.status IN ('active', 'approved', 'capacity_full')
      AND jp.owner_id IS NOT NULL
      -- 고정 공고는 date 가 'FIXED_SCHEDULE' 이다 — 날짜 캐스팅이 죽지 않게 형식으로 거른다.
      AND (req ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
      AND (req ->> 'date')::date IN (v_today + 1, v_today + 2)
    GROUP BY jp.id, jp.owner_id, jp.title, (req ->> 'date')
  ),
  filled AS (
    -- 🔑 '채움'의 판정축은 **앱이 노쇼를 읽는 축**과 같아야 한다.
    --    좌석 카운터 트리거(fn_sync_filled_positions_seat)는 `status` 만 본다.
    --    그런데 앱은 `status='no_show' OR no_show_at IS NOT NULL` 로 읽는다
    --    (src/services/work/confirmedStaffService.ts:44,
    --     src/domains/staff/confirmedStaff.ts:60 은 no_show_at 만 본다).
    --    정본 경로(ConfirmedStaffRepository.markAsNoShow)는 두 컬럼을 **함께** 쓰므로
    --    지금은 두 축이 일치한다 — 즉 이건 실측된 누락이 아니라 방어다.
    --    그래도 좁은 축(no_show_at 추가)을 택하는 이유는 **실패 방향**이 다르기 때문이다:
    --      · 넓게 세면(=status 만) 노쇼를 채움으로 착각해 **알림이 안 간다** → 빈 자리로 당일을 맞는다.
    --      · 좁게 세면 이미 채운 자리를 비었다고 볼 수 있다 → 알림 1건이 더 갈 뿐이다.
    --    "지금이면 아직 채울 수 있어요" 라고 말하는 알림에서 거짓 침묵은 거짓 경고보다 훨씬 비싸다.
    -- ⚠️ 그 대가로 화면의 "자리 N/M 채움"(filled_positions, 트리거 축)과 이 알림이
    --    어긋날 수 있다 — 두 축이 갈라진 행이 실제로 생겼을 때만이고, 그건 의도한 절충이다.
    SELECT
      wl.job_posting_id,
      wl.date              AS work_date_text,
      COUNT(*)::integer    AS filled_count
    FROM public.work_logs wl
    WHERE wl.status NOT IN ('cancelled', 'no_show')
      AND wl.no_show_at IS NULL
    GROUP BY wl.job_posting_id, wl.date
  ),
  gap AS (
    SELECT
      rq.job_posting_id,
      rq.recipient_id,
      rq.posting_title,
      rq.work_date,
      rq.required_count,
      COALESCE(f.filled_count, 0)                     AS filled_count,
      rq.required_count - COALESCE(f.filled_count, 0) AS missing_count,
      (rq.work_date - v_today)                        AS d_offset
    FROM required rq
    LEFT JOIN filled f
      ON f.job_posting_id = rq.job_posting_id
     AND f.work_date_text = to_char(rq.work_date, 'YYYY-MM-DD')
    WHERE rq.required_count > COALESCE(f.filled_count, 0)
  )
  INSERT INTO public.notifications (
    recipient_id, type, category, title, body, link, data, priority
  )
  SELECT
    g.recipient_id,
    'posting_capacity_gap',
    'job'::public.notification_category,
    format('D-%s · 아직 %s자리가 비었어요', g.d_offset, g.missing_count),
    format(
      '%s · %s 근무 %s/%s명. 지금이면 아직 채울 수 있어요.',
      g.posting_title,
      to_char(g.work_date, 'MM"월" DD"일"'),
      g.filled_count,
      g.required_count
    ),
    format('/my-postings/%s', g.job_posting_id),
    jsonb_build_object(
      'jobPostingId', g.job_posting_id,
      'workDate',     to_char(g.work_date, 'YYYY-MM-DD'),
      'dOffset',      g.d_offset,
      'missingCount', g.missing_count
    ),
    -- 하루 전은 마지막 기회다. 이틀 전은 아직 여유가 있다.
    CASE WHEN g.d_offset = 1 THEN 'urgent' ELSE 'high' END
  FROM gap g
  -- 멱등 인덱스가 이미 있는 조합을 조용히 흘려보낸다.
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.fn_notify_posting_capacity_gap() IS
  'S3-1: 근무일 D-2/D-1 정원 미달 알림을 공고 소유자에게 보낸다. 날짜별로 판정하며(공고 합계가 아님), '
  '멱등 인덱스 notifications_posting_capacity_gap_idem 로 중복 실행에 안전하다. 삽입 건수를 반환한다.';

-- SECDEF 하드닝 — 이 함수는 크론(postgres)만 부른다. 클라이언트 롤에 실행 권한을 주지 않는다.
REVOKE ALL ON FUNCTION public.fn_notify_posting_capacity_gap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notify_posting_capacity_gap() FROM anon;
REVOKE ALL ON FUNCTION public.fn_notify_posting_capacity_gap() FROM authenticated;

-- ------------------------------------------------------------
-- 3. 크론 — 매일 KST 오전 10시(UTC 01:00)
-- ------------------------------------------------------------
-- 사장이 하루를 시작하며 볼 시간대에 보낸다. 새벽에 보내면 알림함 아래로 밀린다.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-posting-capacity-gap') THEN
    PERFORM cron.unschedule('notify-posting-capacity-gap');
  END IF;

  PERFORM cron.schedule(
    'notify-posting-capacity-gap',
    '0 1 * * *',
    $cron$ SELECT public.fn_notify_posting_capacity_gap(); $cron$
  );
EXCEPTION
  -- 로컬 Docker 에는 pg_cron 이 없다. 여기서 죽으면 `npm run db:reset` 이 통째로 실패한다.
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[S3-1] pg_cron 미설치 — 정원 미달 알림 크론 skip (함수·인덱스는 생성됨)';
END $do$;
