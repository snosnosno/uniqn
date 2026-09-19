-- 롤아웃 계기판 — analytics_events 에 app_session_start 이벤트를 연다 (감사 testgap-01).
--
-- ## 왜
-- `runtimeVersion = appVersion` 정책이라 하나의 스토어 빌드 위에 여러 OTA 번들이 얹힌다.
-- 그런데 서버에는 앱 버전 기록이 **0건**이라 "지금 몇 %가 새 번들을 받았나"를 셀 수 없었다.
-- 그 공백 때문에 두 가지가 막혀 있었다:
--   · #407 REVOKE — "롤아웃 확인 다음"이라 못박혔는데 확인할 계기판이 없다.
--   · data-01 직접 PATCH 차단 트리거 — 구클라이언트 파손을 감지할 수단이 없어 투입 보류.
-- Sentry 태그만으로는 부족하다 — 그건 "에러가 난 세션"만 표본으로 잡는다.
-- 롤아웃 분모는 정상 세션까지 세야 나온다.
--
-- ## 변경 범위
-- event 화이트리스트 CHECK 에 값 하나를 더한다. 테이블·트리거·정책·인덱스는 그대로다.
--   → 함수 수 불변(208), 정책 수 불변(110). 파리티 기대값은 손대지 않는다.
--
-- ## 구/신 클라이언트 호환
-- 화이트리스트에 **값을 추가**할 뿐이라 기존 6개 이벤트의 동작은 바이트 하나 안 바뀐다.
-- 구 클라(1.0.5/1.0.6)는 이 값을 보낼 코드가 없다. 역방향(신클라 → 구서버)은
-- INSERT 가 CHECK 위반으로 거부되지만, 계측은 fire-and-forget 이라 조용히 무시되고
-- 앱은 멀쩡하다 — 그래도 #441 의 교훈대로 **서버를 먼저** 올린다.

-- CHECK 제약을 이름으로 짚어 지우면 이름이 다를 때 DROP 이 조용히 지나가고,
-- 뒤이은 ADD 가 제약을 하나 더 만들어 **둘이 AND 로 묶인다**. 그러면 새 값은
-- 여전히 거부되는데 마이그레이션은 성공으로 보인다. 정의로 찾아서 전부 지운다.
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
    'app_session_start'         -- 콜드 스타트 1회(props: v/build/rt/platform/ota/channel)
  ));

-- 롤아웃 조회는 "버전별 고유 사용자 수"라 (event, created_at) 인덱스만으로는
-- props->>'v' 를 매번 풀스캔한다. 세션 이벤트에 한정한 부분 인덱스를 둔다.
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_version
  ON public.analytics_events ((props->>'v'), created_at)
  WHERE event = 'app_session_start';

COMMENT ON CONSTRAINT analytics_events_event_check ON public.analytics_events IS
  'event 화이트리스트. 값을 늘릴 때는 클라 OpsFunnelEvent 유니온과 함께 움직여야 한다(AnalyticsEventRepository.ts).';

-- 스모크 — 새 값이 실제로 통과하는지 여기서 확인한다.
-- (제약이 둘로 갈려 AND 결합된 경우를 마이그레이션 시점에 잡는다.)
DO $$
BEGIN
  IF NOT (
    SELECT pg_get_constraintdef(con.oid) LIKE '%app_session_start%'
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'analytics_events'
       AND con.conname = 'analytics_events_event_check'
  ) THEN
    RAISE EXCEPTION 'app_session_start 가 화이트리스트에 반영되지 않았다';
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
