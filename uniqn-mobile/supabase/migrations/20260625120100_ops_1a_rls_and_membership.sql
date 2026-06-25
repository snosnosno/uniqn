-- 라이브 운영(ops) 1a — is_ops_member 멤버십 함수 + SELECT-only RLS + 테이블 DML REVOKE
-- D3: ops 테이블은 SELECT-only RLS. INSERT/UPDATE/DELETE 는 REVOKE → T2 SECDEF RPC 만 쓰기.
-- Idiom 출처: 20260430010300 (is_workspace_member SECDEF), 20260430010400 (DROP/CREATE POLICY + (SELECT auth.uid())),
--            20260605000010 (테이블 DML REVOKE 방어심층).

-- ========================================
-- 1. is_ops_member — 멤버십 단일 진실 (owner OR 연결 공고 워크스페이스 멤버)
-- ========================================
CREATE OR REPLACE FUNCTION public.is_ops_member(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ops_tournaments t
    WHERE t.id = _tournament_id
      AND (
        t.owner_id = _user_id
        OR (
          t.job_posting_id IS NOT NULL
          AND public.is_workspace_member(
            (SELECT jp.workspace_id FROM public.job_postings jp WHERE jp.id = t.job_posting_id),
            _user_id
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.is_ops_member IS
  'ops 멤버십 단일 진실 — owner OR 연결 공고 워크스페이스 멤버. RLS 정책 + RPC authz 핫패스.';

REVOKE EXECUTE ON FUNCTION public.is_ops_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_ops_member(uuid, uuid) TO authenticated;

-- ========================================
-- 2. SELECT-only RLS 정책 (3 테이블)
-- ========================================
DROP POLICY IF EXISTS ops_tournaments_select_member ON public.ops_tournaments;
CREATE POLICY ops_tournaments_select_member
  ON public.ops_tournaments FOR SELECT TO authenticated
  USING (
    public.is_ops_member(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS ops_participants_select_member ON public.ops_participants;
CREATE POLICY ops_participants_select_member
  ON public.ops_participants FOR SELECT TO authenticated
  USING (
    public.is_ops_member(tournament_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS ops_events_select_member ON public.ops_events;
CREATE POLICY ops_events_select_member
  ON public.ops_events FOR SELECT TO authenticated
  USING (
    public.is_ops_member(tournament_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ========================================
-- 3. 테이블 DML REVOKE (방어심층 — 쓰기 정책 회귀 시에도 직접 write 불가)
-- ========================================
REVOKE INSERT, UPDATE, DELETE ON public.ops_tournaments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_participants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ops_events       FROM anon, authenticated;
