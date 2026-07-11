-- 신규 생성 함수들에 search_path 고정 (보안 어드바이저 WARN 해결)
-- Supabase 보안 권장사항: SECURITY DEFINER 함수는 SET search_path = public 필요

CREATE OR REPLACE FUNCTION public.increment_unread_counter()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_counters (user_id, unread_count, updated_at)
  VALUES (NEW.recipient_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET unread_count = public.notification_counters.unread_count + 1,
        updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
