-- ops 전면 개방 S1 — 신규 이벤트 타입 3종 (C4 상금 지급 마킹 · C6 TV 모니터 구성).
-- ⚠️ ALTER TYPE ... ADD VALUE 로 추가한 값은 같은 트랜잭션에서 사용할 수 없다
--    (레포 선례: archive/20260630000000_weekly_grid_container_enum.sql 주석).
--    → 이 파일은 enum 확장만 수행하고, 값을 사용하는 함수는 후속 마이그레이션 파일로 분리한다.

ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'monitor_config_set';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_paid';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'prize_paid_undone';
