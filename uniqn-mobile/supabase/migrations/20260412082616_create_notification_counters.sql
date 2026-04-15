-- notification_counters 테이블 생성
-- Supabase 이전 시 누락된 테이블. NotificationRepository.getUnreadCounterFromCache()에서 사용.
-- RPC 함수 decrement_unread_counter, reset_unread_counter의 대상 테이블.

CREATE TABLE IF NOT EXISTS public.notification_counters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unread_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own unread counter" ON public.notification_counters;
CREATE POLICY "Users can view own unread counter"
  ON public.notification_counters FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own unread counter" ON public.notification_counters;
CREATE POLICY "Users can update own unread counter"
  ON public.notification_counters FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON public.notification_counters;
CREATE POLICY "Service role full access"
  ON public.notification_counters FOR ALL
  USING (auth.role() = 'service_role');

-- notifications INSERT 시 unread_count 자동 증가
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

CREATE OR REPLACE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_unread_counter();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_counters;
