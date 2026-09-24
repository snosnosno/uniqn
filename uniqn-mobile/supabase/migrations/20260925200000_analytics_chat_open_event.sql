-- ============================================================================
-- 채팅방 진입 계측 — analytics_events 화이트리스트에 chat_open 추가 (17 → 18종)
-- ============================================================================
-- ## 무엇을 바꾸나
--   앱 내 채팅 S2(클라)가 방 화면(기존 방·새 방) 마운트당 1회 `chat_open` 을 보낸다
--   (props: job_id · method = job_detail/work_tab/applicants/posting_tile/board_tab/list).
--   설계 docs/planning/2026-09-24-in-app-chat-design.md §11. 클라 3곳과 1:1 로 움직인다:
--   이 CHECK · `PersistedAnalyticsEvent`(AnalyticsEventRepository.ts) · `CORE_FUNNEL_EVENTS`
--   (analyticsService.ts).
--
-- ## 위험 판정
--   · 권한 확대 없음: RLS·GRANT 무변경. chat_open 은 로그인 사용자 경로 전용이라 기존
--     `ae_auth_insert` 로 충분하고 `ae_anon_insert` 는 그대로 닫혀 있다.
--   · 값 **추가**뿐 — 기존 이벤트 동작 불변. 사용자당 시간당 240건 상한(fn_analytics_events_guard)
--     이 그대로 걸린다. prod 는 채팅 플래그가 OFF 라 ON 전까지 행이 생기지 않는다.
--   · 신클라 → 구서버는 CHECK 거부지만 계측은 fire-and-forget 이라 앱은 멀쩡하다.
--     그래도 #441 교훈대로 **서버 먼저** 적용한다.
--   · 되돌리기: CHECK 재교체(chat_open 제외)로 완전 가역.
--
-- ## 파리티
--   함수·정책 0 변경 → 238/105 불변. prod-migrate 는 verify_function 을 **비워서** 돌린다.
-- ============================================================================

-- 이름이 아니라 **정의로** 찾는다 — 이름이 어긋나면 DROP 이 조용히 지나가고 ADD 가 제약을 하나
-- 더 만들어 둘이 AND 로 묶인다(관용구 출처: 20260811100000 · 20260923100000).
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
    'settlement_complete',      -- 정산 완료 (props: settlement_count)
    -- 앱 내 채팅(20260925200000) — 로그인 사용자 전용
    'chat_open'                 -- 채팅방 진입 (props: job_id, method)
  ));

COMMENT ON CONSTRAINT analytics_events_event_check ON public.analytics_events IS
  'event 화이트리스트. 값을 늘릴 때는 클라 PersistedAnalyticsEvent 유니온과 함께 움직여야 한다(AnalyticsEventRepository.ts).';

-- 적용 시점 자체 검증: 정확히 18종, chat_open 포함
DO $$
DECLARE
  v_def text;
  v_count int;
BEGIN
  SELECT pg_get_constraintdef(con.oid) INTO v_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'analytics_events' AND con.conname = 'analytics_events_event_check';
  SELECT count(*) INTO v_count FROM regexp_matches(v_def, '''([a-z_]+)''', 'g');
  IF v_count <> 18 OR v_def NOT LIKE '%''chat_open''%' THEN
    RAISE EXCEPTION 'chat_open 화이트리스트 검증 실패: 값 %개, 정의=%', v_count, v_def;
  END IF;
END;
$$;
