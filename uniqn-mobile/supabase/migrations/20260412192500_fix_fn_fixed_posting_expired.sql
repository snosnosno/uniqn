-- Migration: fix_fn_fixed_posting_expired
-- Date: 2026-04-12
-- Issue: ISSUE-005 — fn_fixed_posting_expired 트리거 3가지 컬럼명 오류
--        → confirm_application 실행 시 에러 발생
-- Fix:
--   - NEW.type → NEW.posting_type
--   - NEW.fixed_end_date → (NEW.fixed_config->>'expiresAt')::timestamptz
--   - NEW.close_reason → NEW.closed_reason

CREATE OR REPLACE FUNCTION public.fn_fixed_posting_expired()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  -- status가 active이고 posting_type이 fixed이며 expiresAt이 지났으면 closed로 변경
  IF NEW.posting_type = 'fixed' AND NEW.status = 'active'
     AND NEW.fixed_config IS NOT NULL
     AND (NEW.fixed_config->>'expiresAt') IS NOT NULL
     AND (NEW.fixed_config->>'expiresAt')::timestamptz < now() THEN
    NEW.status := 'closed';
    NEW.closed_at := now();
    NEW.closed_reason := 'expired';
  END IF;
  RETURN NEW;
END;
$$;
