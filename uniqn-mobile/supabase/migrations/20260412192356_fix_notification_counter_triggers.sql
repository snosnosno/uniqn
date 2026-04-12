-- Migration: fix_notification_counter_triggers
-- Date: 2026-04-12
-- Issue: ISSUE-004 — fn_notification_insert_increment 트리거가 존재하지 않는
--        users.unread_notification_count 컬럼 참조 → 알림 생성 전체 실패
-- Fix: 구버전 트리거 3개 제거 + fn_notification_* 함수들을 notification_counters 기반으로 재작성

-- 1. 구버전 트리거 제거 (INSERT: on_notification_created가 대체)
DROP TRIGGER IF EXISTS tr_notification_insert_increment ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_delete_decrement ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_read_decrement ON public.notifications;

-- 2. fn_notification_delete_decrement 재작성 (notification_counters 사용)
CREATE OR REPLACE FUNCTION public.fn_notification_delete_decrement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF OLD.is_read = false THEN
    UPDATE public.notification_counters
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = OLD.recipient_id;
  END IF;
  RETURN OLD;
END;
$$;

-- 3. fn_notification_read_decrement 재작성 (notification_counters 사용)
CREATE OR REPLACE FUNCTION public.fn_notification_read_decrement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    UPDATE public.notification_counters
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = NEW.recipient_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. fn_notification_insert_increment 재작성 (notification_counters 사용)
CREATE OR REPLACE FUNCTION public.fn_notification_insert_increment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
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

-- 5. decrement_unread_counter(uuid, integer) 재작성 (notification_counters 사용)
CREATE OR REPLACE FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer DEFAULT 1)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notification_counters
  SET unread_count = GREATEST(0, unread_count - p_delta),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 6. 삭제/읽음 트리거 재등록
CREATE TRIGGER tr_notification_delete_decrement
  AFTER DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notification_delete_decrement();

CREATE TRIGGER tr_notification_read_decrement
  AFTER UPDATE OF is_read ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notification_read_decrement();
