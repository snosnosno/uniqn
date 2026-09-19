-- ============================================================
-- 감사 cost-01 / cost-02 / cost-03 / cost-04 / cost-05 — RLS·크론·인덱스 위생
-- 출처: docs/analysis/2026-08-09-full-app-audit-2rounds.md §3 S0-서버
-- ============================================================
--
-- ## cost-01 [LOW] job_postings 공개 SELECT 정책이 글자 그대로 중복이다
--
-- prod 실측(2026-08-09): 두 PERMISSIVE 정책이 **동일한 qual** 을 갖고 둘 다 TO public 이다.
--   job_postings_select_all  : status = ANY(approved, active, capacity_full, closed)
--   jp_select_public_search  : (동일)
-- baseline 덤프(20260710000002:13592, :13636)에 둘 다 실려 있다 — gen-1 시절 중복이
-- squash 로 그대로 굳은 것. 모든 공개 공고 조회가 같은 술어를 두 번 평가한다.
-- advisor `multiple_permissive_policies` WARN 이 anon·authenticator·dashboard_user·
-- supabase_privileged_role 4역할에서 이 쌍을 지목한다.
--
-- 어느 쪽을 남기나: **job_postings_select_all 을 남기고 jp_select_public_search 를 지운다.**
--   · job_postings_select_all 에는 전용 회귀 파일이 있다
--     (supabase/tests/job_postings_select_all_whitelist.test.sql — 4단언:
--      whitelist 축소·`status <> container` 블랭킷 잔재 부재·container fail-close).
--     이걸 살리는 쪽이 회귀 보호를 그대로 보존한다.
--   · jp_select_public_search 를 이름으로 참조하던 살아있는 단언은
--     job_postings_anon_public_select.test.sql TEST 3 하나뿐이고, 그 테스트의 주석이
--     이미 "정책 이름 드리프트 무관하게"를 의도로 선언해 두었다 → IN 목록에
--     job_postings_select_all 을 더해 의도를 그대로 유지한다(같은 PR).
--
-- ⚠️ authenticated 역할의 WARN 은 남는다 — 이건 의도다.
--   authenticated 에는 jp_select_managed(소유자·워크스페이스 멤버·협업자)가 별도로 있고,
--   이를 공개 정책과 하나로 합치려면 정책을 TO public 으로 넓혀야 한다.
--   그러면 **anon 공개검색 경로가 행마다 is_workspace_member/is_posting_collaborator 를
--   추가로 호출**하게 된다 — cost 항목을 고치려다 가장 뜨거운 읽기 경로를 느리게 만든다.
--   (게다가 20260525153952 가 정확히 그 반대 방향으로 고친 이력이 있다: 관리자 정책이
--    TO PUBLIC 이라 anon 이 42501 로 죽던 사고.) 중복 제거까지만 한다.
--
-- ## cost-02 [LOW] outbox 크론이 매분 실행
--
-- sync-schedule-board-outbox 가 `* * * * *` — 주 10,080회 EF 호출 + job_run_details 누적
-- (20260731090100 이 218MB 로그를 치운 원인이 바로 이 잡이다). `*/5` 로 완화한다.
-- 🚫 트리거 직결(http_post) 전환 금지 — 재시도 루프·내구성이 사라진다(감사 §6-5).
-- 🔑 cron.schedule 재등록이 아니라 **cron.alter_job(schedule:=...)** 을 쓴다.
--    명령 본문을 다시 타이핑하지 않으므로 전사 드리프트가 0 이다
--    (memory/pitfall_prod_migration_comment_abridged_md5.md 와 같은 계열의 방어).
--
-- ## cost-03 [LOW] notifications 무한 보존
--
-- prod 실측: 108행(2026-05-07 ~ 2026-08-06), 미읽음 70. 보존 정책이 없어 영구 누적된다.
-- 지금은 소급 삭제가 자유로운 유일한 구간이다.
--   · 읽은 알림 90일 / 안 읽은 알림 365일 — 안 읽은 것은 사용자가 아직 못 본 것이라
--     단발 알바 특성(시즌 이탈 후 복귀)을 감안해 길게 잡았다.
--   · 삭제해도 미읽음 뱃지가 어긋나지 않는다 — tr_notification_delete_decrement
--     (AFTER DELETE FOR EACH ROW → fn_notification_delete_decrement)가 실측으로 존재한다.
--   · 그 트리거가 행마다 돌기 때문에 1회 5,000행 상한을 둔다(락 시간 경계).
--     ⚠️ 이 상한은 조용한 절단이 아니다 — 일 5,000행을 넘는 유입이 생기면 잔량이
--        남으므로, 그때는 상한을 올리거나 배치 주기를 좁혀야 한다.
--   · 일회성 소급 삭제는 넣지 않았다. 현재 대상은 3행뿐이라 첫 크론 실행이 처리한다
--     (DDL 마이그레이션이 프로덕션 데이터를 지우지 않게 하는 편이 되돌리기도 쉽다).
--   · cron 잡은 postgres(=notifications 소유자, FORCE RLS off 실측)로 실행되어
--     RLS 를 우회한다 — SECURITY DEFINER 함수를 새로 만들 필요가 없다.
--     선례 purge-cron-run-details(20260731090100)와 동일하게 인라인 SQL 을 쓴다.
--
-- ## cost-04 [LOW] ops_prizes_select 가 행마다 auth 함수 재평가
--
-- advisor `auth_rls_initplan` WARN. 다른 정책들은 이미 `( SELECT auth.uid() )` 래핑을
-- 쓰는데(job_postings 계열 실측) ops_prizes 만 누락. 술어 의미는 그대로 두고 래핑만 한다.
--
-- ## cost-05 [LOW] work_logs.edited_by FK 커버링 인덱스 부재
--
-- advisor `unindexed_foreign_keys`. users 삭제/정산 편집자 역참조가 seq scan 이 된다.
-- 🔑 CONCURRENTLY 를 쓰지 않는다 — apply_migration/prod-migrate 가 트랜잭션으로 감싸므로
--    사용할 수 없고(이 레포의 확립된 관례), work_logs 는 prod 6행이라 잠금이 무의미하다.
-- ※ advisor 는 ops_events.actor_id 등 FK 4건을 더 지목하지만 원장 범위 밖이라 손대지 않는다
--   (전부 INFO 레벨이고, 쓰지 않는 방향의 인덱스는 쓰기 비용만 늘린다).
--
-- ## 파리티
--   함수 208 불변 (신규 함수 0 — 크론은 인라인 SQL).
--   정책 111 → **110** (jp_select_public_search 1개 제거. ops_prizes_select 는
--     DROP+CREATE 재정의라 증감 0).
--   → parity_baseline_guard.test.sql 의 마커·단언 리터럴·설명 문구 3곳 동시 갱신함.
--
-- ## 회귀 고정
--   supabase/tests/parity_baseline_guard.test.sql (정책 110)
--   supabase/tests/job_postings_select_all_whitelist.test.sql (기존 4단언 그대로 유효)
--   supabase/tests/job_postings_anon_public_select.test.sql (TEST 3 IN 목록 갱신)
--   supabase/tests/rls_cost_hygiene.test.sql (신설 — 중복 제거·initplan·인덱스·크론)
-- ============================================================

-- -----------------------------------------------------------------------------
-- 1. cost-01 — 중복 공개 SELECT 정책 제거
--    public.job_postings 는 postgres 소유라 DROP POLICY 권한 문제가 없다
--    (storage.objects 와 다르다 — 같은 배치 20260809130000 주석 참조).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS jp_select_public_search ON public.job_postings;

-- -----------------------------------------------------------------------------
-- 2. cost-04 — ops_prizes_select initplan 래핑 (술어 의미 불변)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ops_prizes_select ON public.ops_prizes;
CREATE POLICY ops_prizes_select ON public.ops_prizes
  FOR SELECT TO authenticated
  USING (
    public.is_ops_member(tournament_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- -----------------------------------------------------------------------------
-- 3. cost-05 — work_logs.edited_by 커버링 인덱스
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wl_edited_by ON public.work_logs (edited_by);

-- -----------------------------------------------------------------------------
-- 4. cost-02 — outbox 크론 */1 → */5 (명령 본문 재타이핑 없음)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sync-schedule-board-outbox';
  IF v_jobid IS NULL THEN
    RAISE WARNING '[cost-02] sync-schedule-board-outbox 크론 부재 — skip';
  ELSE
    PERFORM cron.alter_job(v_jobid, schedule := '*/5 * * * *');
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[cost-02] pg_cron 미설치 — skip';
END $$;

-- -----------------------------------------------------------------------------
-- 5. cost-03 — notifications 보존 정책 (KST 01:41 = UTC 16:41, 기존 잡과 시각 미충돌)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-notifications') THEN
    PERFORM cron.unschedule('purge-old-notifications');
  END IF;

  PERFORM cron.schedule(
    'purge-old-notifications',
    '41 16 * * *',
    $cron$
      DELETE FROM public.notifications
      WHERE id IN (
        SELECT id FROM public.notifications
        WHERE (is_read AND created_at < now() - interval '90 days')
           OR (NOT is_read AND created_at < now() - interval '365 days')
        LIMIT 5000
      );
    $cron$
  );
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[cost-03] pg_cron 미설치 — skip';
END $$;
