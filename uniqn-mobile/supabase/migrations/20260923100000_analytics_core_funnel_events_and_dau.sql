-- ============================================================================
-- 핵심 퍼널 이벤트 영속화 + 관리자 DAU 집계 RPC
-- ============================================================================
-- ## 무엇이 문제였나
--   `analyticsService.trackEvent` 는 Sentry 브레드크럼만 남기고 서버에는 아무것도 쌓지 않았다.
--   서버(analytics_events)에 남는 것은 ops 퍼널·공유 퍼널·app_session_start 뿐이라,
--   가입 → 공고 열람 → 지원 → 출퇴근 → 정산으로 이어지는 **본 서비스 퍼널은 계측 0** 이었다.
--   출시 후 "어디서 이탈하는가"를 답할 수단이 없다.
--
--   관리자 통계의 DAU 는 `adminService.getSystemMetrics` 가 날짜만 채우고 count 를 0 으로
--   박아 반환했다. 계산할 원천 데이터(사용자 단위 활동 기록)가 없었기 때문이다.
--
-- ## 무엇을 바꾸나
--   ① event 화이트리스트 CHECK 에 핵심 퍼널 8종을 더한다.
--      **RLS 는 건드리지 않는다** — 이 8종은 로그인 사용자 경로 전용이라 기존
--      `ae_auth_insert`(user_id = auth.uid())로 충분하고, `ae_anon_insert` 는 그대로 닫혀 있다.
--      (20260813160000 의 교훈: CHECK 와 RLS 는 다른 층이다. 이번엔 anon 을 **의도적으로**
--       열지 않는다 — 공개 공고 열람을 anon 으로 받으면 tk 없는 행이 가드에서 거부될 뿐이다.)
--   ② 인증 사용자 활동의 날짜 범위 스캔용 부분 인덱스.
--   ③ `get_admin_daily_active_users(p_days, p_tz)` — 관리자 전용 DAU 집계.
--      DAU = 그 날(p_tz 기준) analytics_events 에 **한 줄이라도 남긴 로그인 사용자 수**.
--      app_session_start(콜드 스타트 1회) + 이번에 연 퍼널 이벤트가 활동 신호다.
--      ⚠️ 한계: 백그라운드에서 복귀만 하고 아무 퍼널 행동도 안 한 날은 세지 않는다(과소 추정).
--
-- ## 위험 판정
--   · 권한 확대 없음: 테이블 GRANT·RLS 정책 무변경. 새 함수는 SECDEF 이지만 admin 게이트 +
--     PUBLIC/anon EXECUTE 회수(20260915133500 규약).
--   · 행 증가: 사용자당 시간당 240건 상한(fn_analytics_events_guard)이 그대로 걸린다.
--   · PII: 클라이언트가 속성 화이트리스트(id·method·role·count)만 싣는다(analyticsService.ts).
--     서버는 props 2KB 상한을 유지한다.
--   · 구/신 호환: 값 **추가**뿐이라 기존 이벤트 동작 불변. 신클라 → 구서버는 CHECK 거부지만
--     계측은 fire-and-forget 이라 앱은 멀쩡하다. 그래도 #441 교훈대로 **서버 먼저** 적용한다.
--   · 되돌리기: CHECK 재교체 + DROP FUNCTION + DROP INDEX 로 완전 가역.
--
-- ## 파리티
--   함수 +1(get_admin_daily_active_users) → 225 → 226. 정책 102 불변.
--   parity_baseline_guard.test.sql 장부·단언·PARITY_EXPECT_FUNCS 동시 갱신.
-- ============================================================================

-- ------------------------------------------------------------
-- ① event 화이트리스트 교체 — 이름이 아니라 **정의로** 찾는다
-- ------------------------------------------------------------
-- 이름으로 짚어 지우면 이름이 어긋났을 때 DROP 이 조용히 지나가고, 뒤이은 ADD 가
-- 제약을 하나 더 만들어 둘이 AND 로 묶인다(관용구 출처: 20260811100000).
DO $$
DECLARE
  v_name text;
  v_dropped int := 0;
BEGIN
  FOR v_name IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'analytics_events'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%ops_hub_impression%'
  LOOP
    EXECUTE format('ALTER TABLE public.analytics_events DROP CONSTRAINT %I', v_name);
    v_dropped := v_dropped + 1;
  END LOOP;

  IF v_dropped <> 1 THEN
    RAISE EXCEPTION
      'analytics_events event 화이트리스트 CHECK 을 정확히 1개 지울 것으로 기대했으나 %개였다 — 스키마 전제가 깨졌으니 사람이 볼 것', v_dropped;
  END IF;
END;
$$;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_event_check CHECK (event IN (
    'ops_hub_impression',       -- 진입 표면 노출(프로필 메뉴 렌더 등)
    'ops_hub_entered',          -- (ops) 허브 진입
    'ops_tournament_created',   -- 대회 생성(복제 포함, props.method)
    'ops_public_view_opened',   -- 공개뷰 열람(anon 허용, props.tk = 토큰 8자 prefix)
    'ops_claim_converted',      -- 플레이어 claim 성공(가입 전환 보조 지표)
    'ops_limit_reached',        -- 한도 도달(S2 선배선)
    'app_session_start',        -- 콜드 스타트 1회(props: v/build/rt/platform/ota/channel)
    'job_share_created',        -- 공고 공유 발생 (props: job_id, src)
    'job_share_opened',         -- 공유 링크로 공고 열람 (props: job_id, src)
    -- 핵심 퍼널(20260923100000) — 로그인 사용자 전용. props 는 클라 화이트리스트 키만.
    'signup',                   -- 가입 완료 (props: method)
    'login',                    -- 로그인 (props: method)
    'job_view',                 -- 공고 상세 열람 (props: job_id)
    'job_apply',                -- 지원 제출 (props: job_id, job_role)
    'job_create',               -- 공고 등록 (props: job_id)
    'check_in',                 -- 출근 체크 (props: 없음)
    'check_out',                -- 퇴근 체크 (props: 없음)
    'settlement_complete'       -- 정산 완료 (props: settlement_count)
  ));

COMMENT ON CONSTRAINT analytics_events_event_check ON public.analytics_events IS
  'event 화이트리스트. 값을 늘릴 때는 클라 PersistedAnalyticsEvent 유니온과 함께 움직여야 한다(AnalyticsEventRepository.ts).';

-- ------------------------------------------------------------
-- ② DAU 집계용 부분 인덱스 — 인증 사용자 행의 날짜 범위 스캔
-- ------------------------------------------------------------
-- 기존 idx_analytics_events_user_time 은 (user_id, created_at) 순이라 "최근 N일 전체 사용자"
-- 범위 스캔에 쓰이지 않는다. created_at 선두 인덱스를 따로 둔다.
CREATE INDEX IF NOT EXISTS idx_analytics_events_auth_time
  ON public.analytics_events (created_at, user_id)
  WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------
-- ③ 관리자 DAU RPC
-- ------------------------------------------------------------
-- analytics_events 는 admin SELECT 전용(ae_admin_select)이지만, count(DISTINCT) 는
-- PostgREST 로 표현할 수 없고 행을 끌어오면 기본 1000행 상한에서 조용히 잘린다.
-- 그래서 서버에서 집계해 날짜당 한 행만 돌려준다. 활동이 없는 날도 0 으로 채운다
-- (클라가 빈 날을 "데이터 없음"과 구분할 수 있게 연속 날짜를 보장한다).
CREATE OR REPLACE FUNCTION public.get_admin_daily_active_users(
  p_days integer DEFAULT 7,
  p_tz text DEFAULT 'Asia/Seoul'
)
RETURNS TABLE (activity_date date, active_users integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today date;
  v_first date;
BEGIN
  -- admin 게이트 (NULL fail-open 차단)
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 전용' USING ERRCODE = 'P0001';
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'p_days 는 1~90 이어야 한다: %', p_days USING ERRCODE = '22023';
  END IF;

  -- 잘못된 시간대 이름은 여기서 22023 으로 거부된다(AT TIME ZONE 이 검증한다).
  v_today := (now() AT TIME ZONE coalesce(p_tz, 'Asia/Seoul'))::date;
  v_first := v_today - (p_days - 1);

  RETURN QUERY
  WITH days AS (
    SELECT gs::date AS d
      FROM generate_series(v_first::timestamp, v_today::timestamp, interval '1 day') AS gs
  ),
  active AS (
    SELECT (ae.created_at AT TIME ZONE coalesce(p_tz, 'Asia/Seoul'))::date AS d,
           count(DISTINCT ae.user_id)::integer AS n
      FROM public.analytics_events ae
     WHERE ae.user_id IS NOT NULL
       -- 하한을 p_tz 의 자정으로 환산해 인덱스 범위 스캔을 탄다
       AND ae.created_at >= (v_first::timestamp AT TIME ZONE coalesce(p_tz, 'Asia/Seoul'))
     GROUP BY 1
  )
  SELECT days.d, coalesce(active.n, 0)
    FROM days
    LEFT JOIN active ON active.d = days.d
   ORDER BY days.d;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_daily_active_users(integer, text) IS
  '관리자 DAU — p_tz 기준 날짜별로 analytics_events 에 활동을 남긴 로그인 사용자 수. 최근 p_days(1~90)일, 빈 날 0.';

REVOKE ALL ON FUNCTION public.get_admin_daily_active_users(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_daily_active_users(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_daily_active_users(integer, text) TO authenticated;

-- ------------------------------------------------------------
-- 스모크 — 새 값이 반영됐고 제약이 둘로 갈리지 않았는지, anon 이 막혔는지 지금 확인
-- ------------------------------------------------------------
DO $$
DECLARE
  v_def text;
  v_count int;
BEGIN
  SELECT count(*), max(pg_get_constraintdef(con.oid))
    INTO v_count, v_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE nsp.nspname = 'public'
     AND rel.relname = 'analytics_events'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) LIKE '%ops_hub_impression%';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'event 화이트리스트 CHECK 이 1개가 아니다(%개) — AND 결합으로 새 값이 막힌다', v_count;
  END IF;

  IF v_def NOT LIKE '%settlement_complete%' OR v_def NOT LIKE '%job_share_opened%' THEN
    RAISE EXCEPTION '화이트리스트에 새 값이 없거나 기존 값이 밀려났다: %', v_def;
  END IF;

  IF has_function_privilege('anon', 'public.get_admin_daily_active_users(integer, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon 이 get_admin_daily_active_users 를 실행할 수 있다 — REVOKE 누락';
  END IF;
END;
$$;
