-- ops 결함① — 칩 카운트 수동 입력 이벤트 타입 1종.
-- ⚠️ ALTER TYPE ... ADD VALUE 로 추가한 값은 같은 트랜잭션에서 사용할 수 없다
--    (레포 선례: 20260717090000_ops_s1_event_types.sql 주석).
--    → 이 파일은 enum 확장만 수행하고, 값을 사용하는 RPC 는 후속 마이그레이션 파일로 분리한다.
-- 이름 계열: 참가자 스코프 이벤트는 player_* (player_rebuy/player_addon/player_busted/
--    player_moved/player_reentered). _set 계열(monitor_config_set 등)은 대회 설정 스코프라 제외.

ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_chips_set';
