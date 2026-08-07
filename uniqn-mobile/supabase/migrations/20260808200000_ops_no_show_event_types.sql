-- ops 결함② — 노쇼 이벤트 타입 2종 선행 추가.
-- ⚠️ ALTER TYPE ... ADD VALUE 로 추가한 값은 **같은 트랜잭션에서 사용할 수 없다**
--    (55P04 unsafe_use_of_new_value_of_enum_type). 그래서 RPC 마이그(20260808210000)와
--    반드시 파일을 분리한다 — 결함①(20260807200000/210000)에서 확립한 관용구.
-- 쌍으로 넣는 이유: 노쇼는 **되돌릴 수 있어야** 한다(등록 데스크 오조작이 흔하다).
--   되돌리기를 별도 타입으로 남기지 않으면 감사 로그에서 "표시했다"와 "취소했다"가 구분되지 않는다.
--   선례 = player_busted/player_bust_undone · prize_paid/prize_paid_undone.

ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_no_show';
ALTER TYPE public.ops_event_type ADD VALUE IF NOT EXISTS 'player_no_show_undone';
