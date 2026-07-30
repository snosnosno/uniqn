-- ============================================================
-- 알림 미읽음 카운터 — INSERT 증가 술어 비대칭 봉합 + 고아 함수 제거
--
-- 결함: notifications 카운터 트리거 4경로 중 INSERT 증가만 is_read 검사가 없다.
--   increment_unread_counter (on_notification_created, AFTER INSERT) → 무조건 +1
--   fn_notification_delete_decrement (AFTER DELETE)     → IF OLD.is_read = false
--   fn_notification_read_decrement   (AFTER UPDATE OF)  → IF OLD.is_read = false AND NEW.is_read = true
--   결과: is_read = true(또는 NULL)로 알림을 INSERT 하면 카운터가 +1 되지만
--   이후 삭제·읽음처리 어느 쪽도 그 +1 을 회수하지 못한다 → 미읽음 뱃지 영구 부풀림.
--
-- 유래: archive/20260412192356_fix_notification_counter_triggers.sql 이
--   tr_notification_insert_increment 트리거를 DROP 하며 "INSERT: on_notification_created가
--   대체"로 정리했는데(§1), 정작 대체재인 increment_unread_counter 에는 그 검사가 없었다.
--   같은 마이그레이션이 §4 에서 fn_notification_insert_increment 본체는 검사를 넣어
--   재작성해두고 §6 에서 INSERT 트리거만 재등록하지 않아, "검사가 있는 쪽"이
--   트리거 0개짜리 고아 함수로 남았다.
--
-- 현재 도달 불가(prod 실측 2026-07-31): is_read NULL 0건 · 모든 INSERT 경로가
--   is_read 를 명시하지 않아 DEFAULT false 를 탄다. 즉 실유출 0건 — 선제 봉합이다.
--   백필/일괄 발송 같이 "이미 읽음" 알림을 심는 기능이 생기는 순간 터진다.
--
-- 순서 주의: ①가드 확립 → ②고아 DROP. 고아를 먼저 지우면 "검사가 있던 버전"의
--   마지막 흔적이 사라져 재발 시 단서가 없다.
--
-- ⚠️ CREATE OR REPLACE 필수 — DROP+CREATE 하면 20260731090000 이 회수한
--   PUBLIC/anon EXECUTE 가 기본값으로 되살아난다(보안 퇴행).
-- ============================================================

-- 1. is_read NULL 여지 제거 (증가는 되는데 감소 두 경로가 전부 건너뛰던 값)
--    prod 실측 0건이나, 제약이 없으면 언제든 다시 들어올 수 있다.
UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;

ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;

-- 2. INSERT 증가에 감소 경로와 동일한 술어(is_read = false) 적용
--    술어를 문자 그대로 맞춰 4경로 대칭을 grep 으로 감사할 수 있게 한다.
--    NOT NULL 하에서 `= false` 와 `IS NOT TRUE` 는 동치이지만, 만약 제약이 다시
--    풀리더라도 `= false` 는 "카운터에 안 잡힘"(회복 가능) 쪽으로 실패한다.
--    `IS NOT TRUE` 는 "영구 부풀림"(회복 불가) 쪽으로 실패한다.
--    search_path 도 나머지 3경로와 동일한 pg_catalog 우선으로 정렬.
CREATE OR REPLACE FUNCTION public.increment_unread_counter()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.is_read = false THEN
    INSERT INTO public.notification_counters (user_id, unread_count, updated_at)
    VALUES (NEW.recipient_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET unread_count = public.notification_counters.unread_count + 1,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. 고아 제거 — 트리거 0개, 반환형 trigger 라 RPC 로도 호출 불가.
--    2026-07-31 pg_depend 실측: 잔존 의존성 0.
DROP FUNCTION IF EXISTS public.fn_notification_insert_increment();
