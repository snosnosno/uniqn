-- 달력 날짜 배지 RPC(get_regular_posting_date_counts) — 목록과 같은 전향 하한(마이그 20261010110000).
--   끝난 공고(last_work_date < KST 오늘)는 배지에서 빠진다 · 아직 이어지는 다중일 공고는 지난 날짜 칸에도 남는다 ·
--   last_work_date 가 없는 구형 행은 통과(fail-open) · 권한(anon·authenticated EXECUTE)은 그대로.
--
-- 다른 테스트·시드가 남긴 공고와 섞이지 않도록 **넣기 전후의 차이**로 단언한다(절대 건수 금지).
BEGIN;
SELECT plan(8);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('rdc.owner_id',     s.owner_id::text,     true);
  PERFORM set_config('rdc.workspace_id', s.workspace_id::text, true);
END $$;

-- KST 오늘 — RPC 와 같은 식.
CREATE FUNCTION pg_temp.kst_today() RETURNS date LANGUAGE sql STABLE AS
  $$ SELECT (now() AT TIME ZONE 'Asia/Seoul')::date $$;

-- 날짜 하나의 배지 수(없으면 0).
CREATE FUNCTION pg_temp.badge(p_date date) RETURNS bigint LANGUAGE sql STABLE AS
  $$ SELECT COALESCE(
       (SELECT posting_count FROM public.get_regular_posting_date_counts(p_date::text, p_date::text)), 0) $$;

-- 일반 공고 1건(근무일 배열 지정). last_work_date 는 트리거(fn_sync_last_work_date)가 work_dates 최댓값으로 채운다.
CREATE FUNCTION pg_temp.add_posting(p_title text, p_dates date[]) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at)
  VALUES (
    v_id, current_setting('rdc.owner_id')::uuid, 'rdc owner', current_setting('rdc.workspace_id')::uuid,
    p_title, 'active', 'regular',
    p_dates[1]::text, (SELECT array_agg(d::text ORDER BY d) FROM unnest(p_dates) d), 2, 0, 0,
    3, '+82103333333', now(), now());
  RETURN v_id;
END $$;

-- 넣기 전 기준선
CREATE TEMP TABLE rdc_before AS
SELECT pg_temp.badge(pg_temp.kst_today() - 1) AS yesterday,
       pg_temp.badge(pg_temp.kst_today())     AS today,
       pg_temp.badge(pg_temp.kst_today() + 1) AS tomorrow;

-- A: 어제 하루짜리 — 끝났다(자동 마감 크론은 +2일 뒤에야 status 를 닫으므로 아직 active)
SELECT pg_temp.add_posting('rdc A 어제 하루', ARRAY[pg_temp.kst_today() - 1]);
-- B: 어제~내일 다중일 — 아직 이어진다
SELECT pg_temp.add_posting('rdc B 어제~내일', ARRAY[pg_temp.kst_today() - 1, pg_temp.kst_today() + 1]);
-- C: 오늘 하루짜리 — 경계(오늘은 포함)
SELECT pg_temp.add_posting('rdc C 오늘 하루', ARRAY[pg_temp.kst_today()]);
-- D: 어제 하루짜리인데 last_work_date 가 없는 구형 행
DO $$
DECLARE v_id uuid;
BEGIN
  v_id := pg_temp.add_posting('rdc D 구형(마지막 근무일 없음)', ARRAY[pg_temp.kst_today() - 1]);
  -- last_work_date 만 고치면 동기화 트리거(UPDATE OF work_dates)는 돌지 않는다.
  UPDATE public.job_postings SET last_work_date = NULL WHERE id = v_id;
END $$;

-- ─── (1) 픽스처 확인 — 트리거가 마지막 근무일을 채웠다(전제가 깨지면 아래 단언이 공허해진다) ───
SELECT is(
  (SELECT last_work_date FROM public.job_postings WHERE title = 'rdc A 어제 하루'),
  pg_temp.kst_today() - 1, '전제: 어제 하루짜리 공고의 last_work_date = 어제');

-- ─── (2~4) 어제 칸: 끝난 A 는 빠지고, 이어지는 B 와 구형 D 만 센다 ───
SELECT is(
  pg_temp.badge(pg_temp.kst_today() - 1) - (SELECT yesterday FROM rdc_before),
  2::bigint, '어제 칸 배지는 +2 — 끝난 하루짜리(A)는 세지 않고 이어지는 다중일(B)·구형(D)만 센다');
SELECT is(
  (SELECT status::text FROM public.job_postings WHERE title = 'rdc A 어제 하루'),
  'active', '빠진 A 는 여전히 active 다 — status 가 아니라 마지막 근무일로 걸렀다');
SELECT is(
  (SELECT count(*)::int FROM public.job_postings
    WHERE title LIKE 'rdc %' AND last_work_date IS NULL),
  1, '구형 행(D)은 last_work_date 가 없어도 통과한다(fail-open)');

-- ─── (5~6) 오늘·내일 칸 ───
SELECT is(
  pg_temp.badge(pg_temp.kst_today()) - (SELECT today FROM rdc_before),
  1::bigint, '오늘 칸 배지는 +1 — 오늘이 마지막 근무일인 공고는 포함(경계)');
SELECT is(
  pg_temp.badge(pg_temp.kst_today() + 1) - (SELECT tomorrow FROM rdc_before),
  1::bigint, '내일 칸 배지는 +1 — 다중일 공고(B)');

-- ─── (7~8) 권한 보존 — CREATE OR REPLACE 가 ACL 을 건드리지 않는다(게스트 둘러보기는 anon 으로 부른다) ───
SELECT ok(has_function_privilege('anon', 'public.get_regular_posting_date_counts(text,text)', 'EXECUTE'),
  'anon 은 여전히 실행할 수 있다');
SELECT ok(has_function_privilege('authenticated', 'public.get_regular_posting_date_counts(text,text)', 'EXECUTE'),
  'authenticated 는 여전히 실행할 수 있다');

SELECT * FROM finish();
ROLLBACK;
