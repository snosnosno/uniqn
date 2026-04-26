-- 목적: wallet_ledger INSERT 시 wallets 캐시 자동 갱신
-- 배경: ledger는 source of truth, wallets는 매 화면 표시용 캐시
-- 패턴: job_postings.stats trigger (20260421040000) 차용
-- 스펙: docs/superpowers/specs/2026-04-26-monetization-design.md §4.4

CREATE OR REPLACE FUNCTION public.fn_wallet_ledger_update_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- balance_after_*는 RPC가 이미 계산해서 ledger row에 기록한 값
  -- trigger는 그것을 wallets 캐시로 복사만 한다 (재계산 X)
  IF NEW.currency_type = 'heart' THEN
    UPDATE public.wallets SET
      heart_balance = GREATEST(0, NEW.balance_after_heart),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.currency_type = 'diamond' THEN
    UPDATE public.wallets SET
      diamond_balance = GREATEST(0, NEW.balance_after_diamond),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_wallet_ledger_update_balance ON public.wallet_ledger;
CREATE TRIGGER tr_wallet_ledger_update_balance
AFTER INSERT ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.fn_wallet_ledger_update_balance();

COMMENT ON FUNCTION public.fn_wallet_ledger_update_balance() IS
  'wallet_ledger INSERT → wallets 캐시 동기화. balance_after_*는 RPC가 미리 계산해서 ledger에 기록한 값을 그대로 복사. GREATEST(0, ...)는 환불 over-cancel 시 음수 ledger row가 들어와도 캐시는 0 floor 유지 (Decision #2).';
