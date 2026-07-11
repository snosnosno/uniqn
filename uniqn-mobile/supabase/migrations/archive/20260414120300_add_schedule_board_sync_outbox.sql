-- =============================================================================
-- T-B7: schedule_board_sync_outbox 테이블
-- =============================================================================
-- 목적: jobManagementService의 fire-and-forget board sync를 outbox 패턴으로
--       대체하여 sync 실패 시 recovery 가능하게 함.
--
-- 참조: docs/qa/2026-04-14/team-b-atomicity-spec.md §4
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schedule_board_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'close', 'reopen')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed_retry_limit')),
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ON DELETE CASCADE는 의도적으로 사용하지 않음:
-- delete 액션의 경우 job_posting 행이 이미 사라진 상태에서 outbox row가 처리되어야 함.
-- 따라서 FK constraint도 두지 않고, RPC가 not-found 케이스를 명시적으로 처리.

CREATE INDEX IF NOT EXISTS idx_schedule_board_sync_outbox_status_created
  ON public.schedule_board_sync_outbox(status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_schedule_board_sync_outbox_job_posting
  ON public.schedule_board_sync_outbox(job_posting_id);

ALTER TABLE public.schedule_board_sync_outbox ENABLE ROW LEVEL SECURITY;

-- service_role만 직접 접근. authenticated는 INSERT만 허용 (클라이언트가 enqueue).
DROP POLICY IF EXISTS "schedule_board_sync_outbox_service_all" ON public.schedule_board_sync_outbox;
CREATE POLICY "schedule_board_sync_outbox_service_all"
  ON public.schedule_board_sync_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_board_sync_outbox_authenticated_insert" ON public.schedule_board_sync_outbox;
CREATE POLICY "schedule_board_sync_outbox_authenticated_insert"
  ON public.schedule_board_sync_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- enqueue 시 status는 항상 pending이어야 함 (worker만 상태 전이)
    status = 'pending'
    AND retry_count = 0
    AND error_message IS NULL
  );

GRANT INSERT ON public.schedule_board_sync_outbox TO authenticated;
GRANT ALL ON public.schedule_board_sync_outbox TO service_role;

COMMENT ON TABLE public.schedule_board_sync_outbox IS
  'Schedule board sync 의도를 영속화하는 outbox 테이블. jobManagementService 6개 site가 작성, sync-schedule-board-outbox Edge Function이 polling으로 처리.';
