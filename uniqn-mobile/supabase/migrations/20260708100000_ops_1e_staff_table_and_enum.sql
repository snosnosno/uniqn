-- 라이브 운영(ops) 1e M1 — ops_staff 테이블 + ops_event_type enum 7값 + 배정 백스톱 + RLS.
-- 스펙: docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md §1.
-- D3(SELECT-only RLS, 쓰기는 SECDEF RPC 전용 — M2 이후) · 딜러-테이블 1:1 백스톱(partial UNIQUE).
-- Idiom 출처: 20260625120100_ops_1a_rls_and_membership.sql(RLS/REVOKE 문형·initplan 래핑),
--            20260625130000_ops_1b_tables_seats.sql(CREATE TABLE IF NOT EXISTS·partial UNIQUE 관례),
--            20260630120000_ops_1d_prizes_table.sql(정책명 {table}_select, enum ADD VALUE 별도 트랜잭션 관례).
-- ⚠️ 이 마이그는 값을 "추가"만 한다 — 신규 enum 값을 쓰는 RPC 는 M2 이후 별도 트랜잭션(55P04 회피).
-- additive — 기존 데이터 영향 없음. ops_tables 는 prod 0행이라 백스톱 인덱스 생성 즉시 무해.
-- 표기 참고: 다른 ops 테이블(1a/1b/1c/1d)과 동일하게 테이블 GRANT 는 명시하지 않음 — 20260619133156
--   (ALTER DEFAULT PRIVILEGES) 가 신규 테이블에도 anon/authenticated/service_role 전체권한을 자동
--   부여하고, RLS + REVOKE INSERT/UPDATE/DELETE 가 실제 보안경계이므로 방어심층 REVOKE 만 명시.

-- ========================================
-- 1. ops_event_type enum 7값 확장(멱등)
-- ========================================
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'posting_linked';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'posting_unlinked';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_imported';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_added';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'staff_removed';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'table_staff_assigned';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'table_staff_unassigned';

-- ========================================
-- 2. ops_staff (§1.2 — 대회별 딜러/스태프 스냅샷)
-- ========================================
CREATE TABLE IF NOT EXISTS public.ops_staff (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id      uuid NOT NULL REFERENCES public.ops_tournaments(id) ON DELETE CASCADE,
  staff_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role               public.staff_role NOT NULL DEFAULT 'dealer',
  custom_role        text,
  staff_name         text NOT NULL,
  staff_nickname     text,
  source             text NOT NULL,
  source_work_log_id uuid REFERENCES public.work_logs(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, staff_id),
  CONSTRAINT ops_staff_source_check CHECK (source IN ('snapshot_import', 'manual'))
);

COMMENT ON TABLE public.ops_staff IS
  '대회별 딜러/스태프 스냅샷. staff_name/staff_nickname 은 INSERT 시점 고정(users 변경 무관). '
  'source_work_log_id 는 공고 확정스태프 import 출처(snapshot_import), 수동추가는 manual/NULL. '
  '쓰기는 SECDEF RPC 전용(M2~).';

ALTER TABLE public.ops_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_staff FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ops_staff_staff_id ON public.ops_staff (staff_id);
CREATE INDEX IF NOT EXISTS idx_ops_staff_source_work_log_id ON public.ops_staff (source_work_log_id);

-- ========================================
-- 3. 딜러 1명=테이블 1개 백스톱 (RPC move 시맨틱의 방어선. prod ops_tables 0행이라 즉시 무해)
-- ========================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_tables_assigned_staff
  ON public.ops_tables (tournament_id, assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

-- ========================================
-- 4. SELECT-only RLS (타 ops 테이블 동형 — is_ops_member 재사용)
--    is_admin()은 (SELECT ...) initplan 래핑(적대검증 SEC-2 — 기존 ops SELECT 정책 6종 자구 일치)
-- ========================================
DROP POLICY IF EXISTS ops_staff_select ON public.ops_staff;
CREATE POLICY ops_staff_select ON public.ops_staff
  FOR SELECT TO authenticated
  USING (public.is_ops_member(tournament_id, (SELECT auth.uid())) OR (SELECT public.is_admin()));

-- ========================================
-- 5. 테이블 DML REVOKE (방어심층 — 쓰기 정책 부재로도 차단되나 REVOKE 로 2중 방어)
-- ========================================
REVOKE INSERT, UPDATE, DELETE ON public.ops_staff FROM anon, authenticated;
