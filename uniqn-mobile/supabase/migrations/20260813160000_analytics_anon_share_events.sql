-- ============================================================================
-- S3-5 보정 · 공유 퍼널 anon INSERT 허용
-- ============================================================================
-- 20260813130000 이 `job_share_created`/`job_share_opened` 를 event 화이트리스트(CHECK)에
-- 넣었다. 그런데 화이트리스트를 통과해도 **anon 은 그 행을 넣을 수 없었다.**
-- `ae_anon_insert`(20260717090500:77-79)의 WITH CHECK 가 `event = 'ops_public_view_opened'`
-- 하나로 못박혀 있기 때문이다. CHECK 제약과 RLS 정책은 다른 층이고, 값만 늘리면 반쪽이다.
--
-- 🚨 왜 이게 기능 전체를 죽였나 — **막힌 쪽이 하필 유일하게 중요한 인구다.**
--    공유 링크와 지원 QR 의 대상은 "아직 우리 앱이 없는 구직자" 다. 그 사람은 정의상 anon 이고,
--    `AnalyticsEventRepository.insert` 는 계측 원칙상 에러를 삼킨다(프로덕션에선 로그도 없다).
--    그래서 서버에는 0건이 쌓이는데 **아무 신호도 없다.** 대시보드에는 로그인 사용자만 담긴
--    그럴듯한 숫자가 남아 "공유는 효과가 없다" 로 읽힌다 — 빈 값보다 나쁘다.
--    `SHARE_SOURCES.applyQr` 은 QR 이 유일한 생산자이므로 이 출처는 영원히 공집합이었다.
--
-- 🔑 짝을 함께 연다. `opened` 만 열고 `created` 를 막으면 익명 공유가 분모에서만 빠져
--    전환율(opened/created)이 1 을 넘는 숫자가 나온다 — 비(比)를 재는 지표에서 한쪽만
--    여는 것은 안 여느니만 못하다.
--
-- ── 위험 판정 (권한을 넓히는 변경이므로 명시한다) ───────────────
--   · 넓어지는 것: anon 이 공유 이벤트 2종을 INSERT. `user_id IS NULL` 제약은 유지되고,
--     BEFORE 가드가 `user_id := auth.uid()` 로 캐노니컬라이즈하므로 위조는 여전히 불가능하며,
--     `props.tk` 당 시간당 120건 상한도 그대로 적용된다.
--   · 남용 표면: anon 이 tk 를 회전시켜 상한을 우회해 계측을 오염시킬 수 있다. 다만 이는
--     `ops_public_view_opened` 로 **이미 존재하던 등급**이고, 이 테이블은 admin SELECT 전용이라
--     (`ae_admin_select`) PII 도 없고 비즈니스 로직이 읽지도 않는다. 최악이 "쓰레기 행" 이다.
--   · 넓어지지 않는 것: SELECT 권한·테이블 GRANT·함수 권한 무변경. FORCE RLS 유지.
--   · 되돌리기: 정책 DROP+CREATE 뿐이라 완전 가역. 파괴적 DDL·데이터 이전 없음.
--
-- 형식 규율: 정책 **교체**(같은 이름 DROP+CREATE)라 파리티 정책 수는 112 불변, 함수도 불변.
--            parity_baseline_guard.test.sql 갱신 불필요.
-- ============================================================================

DROP POLICY IF EXISTS ae_anon_insert ON public.analytics_events;

-- anon 은 공개 열람 + 공유 퍼널만. 값을 늘릴 때는 **여기와 event CHECK 화이트리스트가
-- 함께** 움직여야 한다 — 한쪽만 늘리면 통과할 것 같은데 조용히 거부된다(이 마이그의 사유).
CREATE POLICY ae_anon_insert ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND event IN ('ops_public_view_opened', 'job_share_created', 'job_share_opened')
  );

-- ------------------------------------------------------------
-- 스모크 — 두 층이 실제로 일치하는지 지금 확인한다
-- ------------------------------------------------------------
-- 이 결함의 본질은 "CHECK 은 통과하는데 RLS 가 막는다" 였다. 그래서 한 층만 보면 또 놓친다.
DO $$
DECLARE
  v_check text;
BEGIN
  SELECT with_check INTO v_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'analytics_events'
     AND policyname = 'ae_anon_insert';

  IF v_check IS NULL THEN
    RAISE EXCEPTION 'ae_anon_insert 정책이 없다 — anon 계측이 통째로 막힌다';
  END IF;

  IF v_check NOT LIKE '%job_share_opened%' OR v_check NOT LIKE '%job_share_created%' THEN
    RAISE EXCEPTION 'ae_anon_insert 가 공유 이벤트를 허용하지 않는다: %', v_check;
  END IF;

  -- 반대편 층(event CHECK 화이트리스트)도 같은 값을 갖고 있어야 짝이 맞는다.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'analytics_events'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%job_share_opened%'
  ) THEN
    RAISE EXCEPTION
      'event CHECK 화이트리스트에 job_share_opened 가 없다 — 20260813130000 이 선행돼야 한다';
  END IF;
END;
$$;
