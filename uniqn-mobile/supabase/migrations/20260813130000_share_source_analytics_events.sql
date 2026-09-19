-- ============================================================================
-- S3-5 · 공유 출처 계측 이벤트 화이트리스트 확장
-- ============================================================================
-- 공고 공유 링크에 `?src=` 를 붙여도, 그걸 **아무도 기록하지 않으면 기능이 아니다.**
-- URL 파라미터는 그 자체로는 아무것도 알려주지 않는다 — 서버에 남아야 "어느 경로로 들어온
-- 사람이 실제로 지원까지 갔나"를 답할 수 있다.
--
-- 두 이벤트가 짝이다. 하나만으로는 아무 질문에도 답하지 못한다:
--   job_share_created — 공유가 **발생**했다 (누가 어디서 공유했나)
--   job_share_opened  — 그 링크로 **들어왔다** (공유가 실제로 사람을 데려왔나)
-- 전환율은 이 둘의 비(比)다.
--
-- 🚨 CHECK 교체는 이름이 아니라 **정의로** 찾는다.
--    이름으로 짚어 지우면 이름이 어긋났을 때 DROP 이 조용히 지나가고, 뒤이은 ADD 가
--    제약을 하나 더 만들어 둘이 AND 로 묶인다. 그러면 새 값은 여전히 거부되는데
--    마이그레이션은 성공으로 보인다. (관용구 출처: 20260811100000)
-- ============================================================================

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
    'job_share_opened'          -- 공유 링크로 공고 열람 (props: job_id, src)
  ));

COMMENT ON CONSTRAINT analytics_events_event_check ON public.analytics_events IS
  'event 화이트리스트. 값을 늘릴 때는 클라 OpsFunnelEvent 유니온과 함께 움직여야 한다(AnalyticsEventRepository.ts).';

-- 출처별 집계는 `props->>'src'` 로 그룹핑한다. 공유 이벤트에 한정한 부분 인덱스를 둔다
-- (app_session_start 의 버전 인덱스와 같은 이유 — 전체 스캔 방지).
CREATE INDEX IF NOT EXISTS idx_analytics_events_share_src
  ON public.analytics_events ((props->>'src'), created_at)
  WHERE event IN ('job_share_created', 'job_share_opened');

-- 스모크 — 새 값이 실제로 통과하는지, 제약이 둘로 갈리지 않았는지 지금 확인한다.
DO $$
BEGIN
  IF NOT (
    SELECT pg_get_constraintdef(con.oid) LIKE '%job_share_opened%'
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'analytics_events'
       AND con.conname = 'analytics_events_event_check'
  ) THEN
    RAISE EXCEPTION 'job_share_opened 가 화이트리스트에 반영되지 않았다';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'analytics_events'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%ops_hub_impression%'
  ) <> 1 THEN
    RAISE EXCEPTION 'event 화이트리스트 CHECK 이 1개가 아니다 — AND 결합으로 새 값이 막힌다';
  END IF;
END;
$$;
