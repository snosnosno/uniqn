-- ops 결함③ — 참가자 정정·오등록 제거·대회 아카이브의 선행 스키마.
-- ⚠️ ALTER TYPE ... ADD VALUE 로 추가한 값은 **같은 트랜잭션에서 사용할 수 없다**
--    (55P04). RPC 는 20260808230000 에 분리한다 — 결함①·②에서 확립한 관용구.
--    ADD COLUMN 은 enum 값을 쓰지 않으므로 이 파일에 함께 두어도 안전하다.

-- ── 이벤트 타입 4종 ────────────────────────────────────────
-- 정정/제거는 "무엇이 어떻게 바뀌었나"가 분쟁의 근거이므로 각각 별도 타입으로 남긴다.
-- 아카이브는 왕복이라 쌍으로 넣는다(선례 prize_paid/prize_paid_undone).
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_updated';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_deleted';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'tournament_archived';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'tournament_archive_undone';

-- ── ops_tournaments.archived_at ────────────────────────────
-- 🔑 대회 hard DELETE 는 **물리적으로 불가능**하다(2026-08-08 로컬 실증):
--    ops_events_tournament_id_fkey 가 ON DELETE CASCADE 인데
--    trg_ops_events_append_only(BEFORE DELETE OR UPDATE)가 P0001 로 접는다
--    → "OPS_EVENTS_APPEND_ONLY: ops_events 는 append-only — DELETE 불가".
--    감사 스파인을 유지하는 한 삭제는 설계상 봉쇄돼 있고, 그게 옳다.
--
-- 그래서 아카이브다. `ops_tournament_status` enum 에 'archived' 를 넣지 **않는** 이유:
--   1) 아카이브는 상태와 **직교**한다 — 끝난 대회(completed)도, 안 열린 대회(upcoming)도
--      보관할 수 있어야 한다. enum 값으로 만들면 원래 상태를 잃는다.
--   2) enum ADD VALUE 는 되돌릴 수 없고(Postgres 는 enum 값 DROP 불가),
--      ops_set_tournament_status 의 전이 규칙을 전부 다시 판정해야 한다.
--   3) timestamptz 는 "언제 보관했나"까지 공짜로 남는다.
ALTER TABLE public.ops_tournaments
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.ops_tournaments.archived_at IS
  '보관 시각(NULL=활성). 대회 목록 기본 필터에서 제외된다. 상태(upcoming/active/completed)와 '
  '직교 — 원래 상태를 보존한다. hard DELETE 는 ops_events append-only 트리거와 충돌해 불가능하므로 '
  '이 컬럼이 "치우기"의 유일한 경로다. 토글 RPC = ops_set_tournament_archived.';

-- 목록 조회는 owner/워크스페이스 스코프 + archived_at IS NULL 이 기본 경로다.
CREATE INDEX IF NOT EXISTS idx_ops_tournaments_owner_active
  ON public.ops_tournaments (owner_id, created_at DESC)
  WHERE archived_at IS NULL;
