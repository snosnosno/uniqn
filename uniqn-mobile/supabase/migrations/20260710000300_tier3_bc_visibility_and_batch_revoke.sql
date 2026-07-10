-- 2026-07-10 보안 하드닝 (P1, Tier-3 저위험 묶음)
--
-- C2 [LOW] board_comments.bc_select — board_posts.visibility 미러
--   현 bc_select USING = EXISTS(board_posts WHERE id=post_id) 로 visibility 무시.
--   bp_select 는 participants_only 글을 비멤버·anon 에 숨기지만 bc_select 는 post_id 만
--   알면 그 댓글을 노출(잠복 누수). → 댓글 가시성을 부모 글 가시성에 종속시킨다.
--   정상 접근 무회귀: 글을 볼 수 있는(=bp_select 통과) 사용자는 동일 조건이라 댓글도 본다.
--
-- B3/배치 [LOW] 미사용 authenticated EXECUTE 회수(defense-in-depth)
--   아래 9함수는 클라이언트 호출자 0(src/app 실측). 알림 카운터는 edge(service_role)만,
--   만료/정리/리마인더 배치는 cron(자체 롤)만 호출. authenticated 직접 호출은
--   타인 알림 read 처리(griefing)·리뷰 리마인더 스팸·배치 남용 벡터일 뿐 정상 경로 아님.
--   → authenticated/PUBLIC/anon EXECUTE 회수, service_role 유지.
--   트리거 겸용 함수는 트리거가 소유자 권한으로 계속 동작(EXECUTE 회수 무영향).

-- ── C2: bc_select 재작성 (visibility 미러) ──────────────────────────────────
DROP POLICY IF EXISTS "bc_select" ON public.board_comments;
CREATE POLICY "bc_select" ON public.board_comments
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.board_posts bp
      WHERE bp.id = board_comments.post_id
        AND (
          bp.visibility = 'public'
          OR bp.author_id = (SELECT auth.uid())
          OR (SELECT public.get_my_role()) = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.board_memberships bm
            WHERE bm.user_id = (SELECT auth.uid()) AND bm.post_id = bp.id
          )
        )
    )
  );

-- ── B3/배치: authenticated EXECUTE 회수 (service_role 유지) ──────────────────
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'decrement_unread_counter', 'reset_unread_counter', 'get_unread_notification_count',
    'fn_expire_by_last_work_date', 'fn_expire_fixed_postings_batch',
    'fn_cleanup_expired_fcm_tokens', 'fn_cleanup_rate_limits',
    'expire_pending_workspace_invitations', 'fn_send_review_reminders'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
  END LOOP;
END $$;
