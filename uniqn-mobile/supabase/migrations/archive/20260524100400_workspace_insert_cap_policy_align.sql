-- workspaces_insert_employer_with_cap 정책을 archived-aware cap 으로 정렬 (fresh-stack 드리프트 해소).
--
-- 배경: prod 의 실제 정책은 이미 cap 을 workspace_count_for_owner(owner_id) < 10 으로 계산하며,
--       이 함수는 20260524100100 에서 archived_at IS NULL 만 집계하도록 패치됨 (archive cap 제외).
--       그러나 커밋된 마이그레이션 파일(20260430010400)의 정책 정의는 inline count(*) 라
--       fresh-stack(파일만으로 재구축) 에서는 RLS INSERT cap 이 archived 를 제외하지 못하는 드리프트.
--       본 마이그레이션이 정책을 prod 와 동일한 함수 호출 버전으로 재정의해 fresh-stack 도 일치.
--       prod 에는 동일 정의라 동작 변화 없음(no-op).
--
-- 안전: WITH CHECK 가 workspace_count_for_owner (SECURITY DEFINER STABLE) 를 호출하므로
--       메모리 pitfall_rls_with_check_self_select_recursion (inline SELECT FROM workspaces) 재귀 없음.
--       실제 클라이언트 INSERT 경로는 create_workspace RPC(SECURITY DEFINER) 단독이며 본 정책은
--       defense-in-depth.

DROP POLICY IF EXISTS workspaces_insert_employer_with_cap ON public.workspaces;
CREATE POLICY workspaces_insert_employer_with_cap
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND ((SELECT get_my_role()) = ANY (ARRAY['employer'::text, 'admin'::text]))
    AND (workspace_count_for_owner(owner_id) < 10)
  );
