-- ============================================================================
-- ops-web 로컬 검증용 시드 — 대회 데이터 (W3). 계정은 seed-local-ops.sql 이 먼저 만든다.
-- ⚠️ 로컬 전용. 실행기(scripts/seed-local.mjs)는 로컬 Docker 컨테이너에만 붙는다.
--
-- 모든 쓰기는 앱과 같은 ops_* SECDEF RPC 로 한다(테이블 직접 DML 없음) — 운영자 세션을
-- 흉내 내려고 트랜잭션 로컬 JWT 클레임을 ops-owner 로 설정한다(pgTAP 헬퍼와 같은 방식).
--
-- 멱등: ops_events 는 append-only 라 대회를 지울 수 없다 → 이름으로 존재를 확인해 **없을 때만** 만든다.
-- E2E 가 상태를 바꾸는 시나리오는 이 시드 대회가 아니라 자기가 만든 대회를 쓴다.
-- ============================================================================
BEGIN;

SELECT set_config('request.jwt.claim.sub', '0a5e0000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"0a5e0000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_owner constant uuid := '0a5e0000-0000-4000-8000-000000000001';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_tid uuid;
  v_levels jsonb := '[
    {"level":1,"small_blind":100,"big_blind":200,"ante":200,"duration_sec":1200,"is_break":false},
    {"level":2,"small_blind":200,"big_blind":400,"ante":400,"duration_sec":1200,"is_break":false},
    {"level":0,"small_blind":0,"big_blind":0,"ante":0,"duration_sec":600,"is_break":true},
    {"level":3,"small_blind":300,"big_blind":600,"ante":600,"duration_sec":1200,"is_break":false},
    {"level":4,"small_blind":500,"big_blind":1000,"ante":1000,"duration_sec":1200,"is_break":false}
  ]'::jsonb;
  v_config jsonb := '{"buy_in_chips":30000,"rebuy_chips":30000,"addon_chips":20000,
    "buy_in_cost":50000,"fee_cost":5000,"rebuy_cost":50000,"addon_cost":30000,"bounty_cost":null}'::jsonb;
  v_names text[] := ARRAY['김민준','이서연','박도윤','최지우','정하준','강서윤','조시우','윤지호',
    '장수아','임건우','한예린','오주원','서하은','신우진','권지안','황태윤','안소율','송민재'];
  i int;
BEGIN
  -- ① 진행 중: 테이블 2개 · 18명 자동 착석 · 블라인드 · 클럭 시작
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE owner_id = v_owner AND name = '시드 · 수요 딥스택') THEN
    v_tid := (public.ops_create_tournament(v_owner, '시드 · 수요 딥스택', '강남 홀덤펍', v_today, 'NLH',
      NULL, 30000, 9, v_config) ->> 'tournament_id')::uuid;
    PERFORM public.ops_add_table(v_tid, v_owner, 9, NULL, 'none', 0);
    PERFORM public.ops_add_table(v_tid, v_owner, 9, NULL, 'none', 0);
    PERFORM public.ops_set_blind_levels(v_tid, v_owner, v_levels);
    PERFORM public.ops_set_tournament_status(v_tid, v_owner, 'active');
    FOR i IN 1..array_length(v_names, 1) LOOP
      PERFORM public.ops_register_participant(v_tid, v_owner, v_names[i], 'KR', NULL, 30000);
    END LOOP;
    PERFORM public.ops_clock_start(v_tid, v_owner);
  END IF;

  -- ② 완료: 복제 대상
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE owner_id = v_owner AND name = '시드 · 지난주 토너먼트') THEN
    v_tid := (public.ops_create_tournament(v_owner, '시드 · 지난주 토너먼트', '강남 홀덤펍', v_today - 7,
      'NLH', NULL, 25000, 9, v_config) ->> 'tournament_id')::uuid;
    PERFORM public.ops_set_blind_levels(v_tid, v_owner, v_levels);
    PERFORM public.ops_set_tournament_status(v_tid, v_owner, 'active');
    PERFORM public.ops_set_tournament_status(v_tid, v_owner, 'completed');
  END IF;

  -- ③ 예정
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE owner_id = v_owner AND name = '시드 · 다음주 메인') THEN
    PERFORM public.ops_create_tournament(v_owner, '시드 · 다음주 메인', '역삼 라운지', v_today + 7, 'NLH',
      NULL, 50000, 8, v_config);
  END IF;

  -- ④ 보관됨
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE owner_id = v_owner AND name = '시드 · 보관된 테스트') THEN
    v_tid := (public.ops_create_tournament(v_owner, '시드 · 보관된 테스트', NULL, v_today - 30, 'NLH',
      NULL, 20000, 9, v_config) ->> 'tournament_id')::uuid;
    PERFORM public.ops_set_tournament_archived(v_tid, v_owner, true);
  END IF;
END $$;

COMMIT;
