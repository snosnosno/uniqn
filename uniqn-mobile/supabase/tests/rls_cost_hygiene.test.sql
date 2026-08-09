-- ============================================================
-- 감사 cost-01 / cost-02 / cost-03 / cost-04 / cost-05 회귀 가드
-- (마이그 20260809140000)
-- ============================================================
-- 목적
--   중복 RLS 정책 제거·initplan 래핑·FK 인덱스·크론 위생이 되돌아가지 않게 고정한다.
--
-- 🚨 이 파일의 핵심은 3~5번이다 — "정책을 지웠다"가 아니라
--    "정책을 지워도 anon 이 보던 것은 그대로 보고, 못 보던 것은 그대로 못 본다"를
--    증명해야 한다. RLS 테이블에서 `count(*) = 0` 은 "행이 없다"일 수도 있어
--    그것만으로는 아무것도 증명하지 못한다(memory: pitfall_rls_dynamic_verification_sparse_data).
--    그래서 **행이 실제로 존재함을 신뢰 컨텍스트에서 먼저 단언**하고(대조군),
--    같은 행을 anon 이 보는지/못 보는지를 상태만 바꿔 양방향으로 확인한다.
--
-- 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(10);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('cost.jp_id', s.job_posting_id::text, true);
END $$;

-- 시드 공고를 공개 상태로 고정한다(신뢰 컨텍스트 = postgres, 테이블 소유자).
UPDATE public.job_postings
   SET status = 'active'
 WHERE id = (current_setting('cost.jp_id'))::uuid;

-- ------------------------------------------------------------
-- 1. 대조군 — 공개 whitelist 에 해당하는 행이 실제로 존재한다
--    이게 없으면 아래 anon 단언이 "0 = 0" 으로 공허하게 통과할 수 있다.
-- ------------------------------------------------------------
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.job_postings
    WHERE status = ANY (ARRAY['approved','active','capacity_full','closed']::posting_status[])),
  '>', 0,
  '대조군: 신뢰 컨텍스트에서 공개 whitelist 공고가 1건 이상 존재한다(빈 테이블 공허통과 방지)'
);

-- ------------------------------------------------------------
-- 2. cost-01 — 중복 공개 SELECT 정책이 제거됐다
-- ------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM pg_policy
    WHERE polrelid = 'public.job_postings'::regclass
      AND polname = 'jp_select_public_search'),
  0,
  'cost-01: 글자 그대로 중복이던 jp_select_public_search 가 제거됐다'
);

-- ------------------------------------------------------------
-- 3. cost-01 — 생존 정책이 공개 whitelist 를 그대로 유지한다
-- ------------------------------------------------------------
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
    WHERE polrelid = 'public.job_postings'::regclass
      AND polname = 'job_postings_select_all') LIKE '%capacity_full%',
  'cost-01: 생존 정책 job_postings_select_all 이 공개 whitelist(capacity_full 포함)를 유지한다'
);

-- ------------------------------------------------------------
-- 4. cost-01 행동 — anon 이 공개 공고를 여전히 본다 (접근이 줄지 않았다)
-- ------------------------------------------------------------
SELECT jpc_test_set_anon();
SELECT is(
  (SELECT count(*)::int FROM public.job_postings
    WHERE id = (current_setting('cost.jp_id'))::uuid),
  1,
  'cost-01: 중복 제거 후에도 anon 이 공개(active) 공고를 본다'
);
RESET ROLE;

-- ------------------------------------------------------------
-- 5. cost-01 행동(반대 방향) — 비공개 상태는 여전히 못 본다 (fail-close 유지)
--    같은 행의 status 만 바꿔 확인하므로 4번과 대칭이다.
-- ------------------------------------------------------------
UPDATE public.job_postings
   SET status = 'cancelled'
 WHERE id = (current_setting('cost.jp_id'))::uuid;

SELECT jpc_test_set_anon();
SELECT is(
  (SELECT count(*)::int FROM public.job_postings
    WHERE id = (current_setting('cost.jp_id'))::uuid),
  0,
  'cost-01: cancelled 공고는 anon 에게 여전히 보이지 않는다(whitelist fail-close 유지)'
);
RESET ROLE;

-- ------------------------------------------------------------
-- 6. cost-04 — ops_prizes_select 가 auth 함수를 행마다 재평가하지 않는다
-- ------------------------------------------------------------
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
    WHERE polrelid = 'public.ops_prizes'::regclass
      AND polname = 'ops_prizes_select') LIKE '%SELECT auth.uid()%',
  'cost-04: ops_prizes_select 가 (SELECT auth.uid()) 로 래핑돼 initplan 으로 1회 평가된다'
);

-- ------------------------------------------------------------
-- 7. cost-05 — work_logs.edited_by 커버링 인덱스
-- ------------------------------------------------------------
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND tablename = 'work_logs'
             AND indexdef LIKE '%(edited_by)%'),
  'cost-05: work_logs.edited_by FK 커버링 인덱스가 존재한다'
);

-- ------------------------------------------------------------
-- 8~9. cost-02 / cost-03 — 크론 위생
-- ------------------------------------------------------------
SELECT is(
  (SELECT schedule FROM cron.job WHERE jobname = 'sync-schedule-board-outbox'),
  '*/5 * * * *',
  'cost-02: outbox 크론이 매분(*/1)이 아니라 */5 로 실행된다'
);

SELECT is(
  (SELECT count(*)::int FROM cron.job WHERE jobname = 'purge-old-notifications'),
  1,
  'cost-03: notifications 보존 크론이 1건 등록돼 있다'
);

-- ------------------------------------------------------------
-- 10. cost-03 — 보존 크론이 미읽음 알림을 90일에 지우지 않는다
--     (읽은 것 90일 / 안 읽은 것 365일 계약. 상수를 잘못 줄이면 사용자가
--      한 번도 못 본 알림이 사라진다 — 그 회귀를 명령 본문으로 고정한다.)
-- ------------------------------------------------------------
SELECT ok(
  (SELECT command FROM cron.job WHERE jobname = 'purge-old-notifications')
    LIKE '%NOT is_read AND created_at < now() - interval ''365 days''%',
  'cost-03: 미읽음 알림 보존기간이 365일이다(읽은 것 90일과 분리)'
);

SELECT * FROM finish();
ROLLBACK;
