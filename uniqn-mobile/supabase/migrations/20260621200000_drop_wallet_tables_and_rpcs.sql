-- chore: 지갑/IAP 수익모델 제거 — wallet 관련 테이블·RPC·CRON 정리
-- ⚠️  prod 적용 전 반드시 확인:
--     1. 모든 사용자 wallets 잔액이 0 또는 별도 정산 완료
--     2. RevenueCat 대시보드 웹훅 URL 제거 + 구독 비활성화 완료
--     3. App Store / Google Play IAP 항목 제거 신청 완료
--     4. staging 환경에서 먼저 적용 후 회귀 확인
-- ✅ prod 적용 완료 (2026-06-23, MCP apply_migration → schema_migrations version 20260623102054).
--    적용 직후 src/types/supabase.ts 에서 wallet 타입 제거(재생성)로 prod 정합.
--    ⚠️ version 정합: 이 파일 version(20260621200000)과 prod 기록 version(20260623102054)이 다름.
--       머지 후 `supabase db push` 시 20260621200000 이 미기록이라 재적용되나, 전 구문이
--       IF EXISTS / CREATE OR REPLACE 라 멱등 no-op. 깔끔히 하려면 파일명을 20260623102054_* 로
--       rename 하거나 `supabase migration repair --status applied 20260621200000` 로 정합화.
--
-- [P2-2] 명시적 DROP FUNCTION 인자 타입을 실제 시그니처와 정합화 (2026-06-22).
--   기존 파일의 인자 타입(text/interval 등)이 실제와 달라 no-op 이었고,
--   wallet_reason 을 시그니처에 안 쓰는 함수(credit_diamonds_atomically 등)는
--   `DROP TYPE wallet_reason CASCADE` 로도 제거되지 않아 잔존했음.
-- [P2-3] handle_new_user 에서 하트 grant 블록 제거 → dangling 참조 해소.
-- [P3]   누락 orphan 함수 2종(refund_job_cancellation_atomically, fn_wallet_ledger_update_balance)
--        명시 DROP 추가 + enum 오타 정정(wallet_currency_type → wallet_currency) (2026-06-23).

-- 0. 가입 시 하트 적립 환원 [P2-3]
--    drop 적용 후 wallet_ledger / grant_heart_atomically / wallet_reason 가
--    사라지면 handle_new_user(20260530000004) 의 grant_signup 블록이 매 가입마다
--    미존재 객체를 참조해 경고 로그를 남김(EXCEPTION 격리로 가입은 성공하나 noisy).
--    하트 직전 정의(20260519223300) 본문으로 환원 — 그 외 로직(users INSERT +
--    employer default workspace)은 그대로 보존.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_provider text;
  v_role public.user_role;
  v_workspace_name text;
BEGIN
  v_provider := NEW.raw_app_meta_data ->> 'provider';
  v_role := COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'staff');

  INSERT INTO public.users (id, email, name, role, social_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    v_role,
    CASE
      WHEN v_provider IN ('apple', 'google', 'kakao', 'naver') THEN v_provider
      ELSE NULL
    END
  );

  -- employer 자동 default workspace 생성 (2026-05-07 backfill 후속)
  IF v_role = 'employer' THEN
    BEGIN
      v_workspace_name := COALESCE(
        NULLIF(LEFT(NEW.raw_user_meta_data ->> 'name', 40), ''),
        NULLIF(LEFT(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 40), ''),
        '내'
      ) || ' 워크스페이스';

      INSERT INTO public.workspaces (name, owner_id)
      VALUES (v_workspace_name, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: workspace 자동 생성 실패 (user_id=%, error=%)',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  '신규 가입자 public.users INSERT + employer default workspace 자동 생성. 지갑/IAP 제거로 가입 하트 grant 블록 제거 (2026-06-22). workspace 실패는 회원가입 차단하지 않음 (EXCEPTION 격리).';

-- 1. 결제/공고 생성 원자 RPC
--    실제 현행: create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) (20260602000001)
--    구 4-인자 오버로드(uuid, jsonb, integer, wallet_reason)도 혹 잔존 시 함께 제거
DROP FUNCTION IF EXISTS create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) CASCADE;
DROP FUNCTION IF EXISTS create_job_posting_with_payment_atomically(uuid, jsonb, integer, wallet_reason) CASCADE;
DROP FUNCTION IF EXISTS cancel_job_posting_with_refund_atomically(uuid, uuid) CASCADE;
-- 환불 워커 RPC(취소 래퍼 내부에서만 호출) — 래퍼 DROP 만으론 제거 안 됨(plpgsql 본문 참조는 의존성 추적 대상 아님).
--   본문이 wallets/wallet_ledger/heart_lots 를 참조 → 미존재 테이블 참조 고아 방지 위해 명시 제거.
DROP FUNCTION IF EXISTS refund_job_cancellation_atomically(uuid, uuid) CASCADE;

-- 2. 다이아 차감/적립 RPC
--    consume: (uuid, integer, wallet_reason, uuid, text) (20260609000001)
--    credit : (uuid, integer, text, text)               (20260605000000) — wallet_reason 미사용 → 명시 DROP 필수
DROP FUNCTION IF EXISTS consume_diamonds_atomically(uuid, integer, wallet_reason, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS credit_diamonds_atomically(uuid, integer, text, text) CASCADE;

-- 3. 하트 적립/출석 RPC
--    grant_heart: (uuid, integer, wallet_reason, uuid, integer) (20260427000500, p_expires_in_days 는 INT)
DROP FUNCTION IF EXISTS grant_heart_atomically(uuid, integer, wallet_reason, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS claim_daily_attendance() CASCADE;

-- 4. 공고 비용 조회 RPC + 서버 비용 산출 헬퍼
--    get_payment_server_cost_calc 는 존재하지 않는 함수였음(오기) → 실제 헬퍼 _calc_posting_cost(text, uuid) 제거로 교정
DROP FUNCTION IF EXISTS get_posting_cost(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_wallet_summary(uuid) CASCADE;
DROP FUNCTION IF EXISTS _calc_posting_cost(text, uuid) CASCADE;

-- 5. 가입 하트 백필 함수 제거 (handle_new_user 환원은 위 0번에서 처리)
DROP FUNCTION IF EXISTS backfill_signup_hearts() CASCADE;

-- 6. 하트 만료 CRON 해제 + 함수 제거
--    cron job 실제 이름은 'expire_heart_lots_daily' (20260427001000). 함수 본문이
--    heart_lots 테이블을 참조하므로 테이블 DROP 후 cron 이 살아있으면 매일 실패 → 명시 제거.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire_heart_lots_daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_heart_lots_daily');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron job이 없으면 무시
END;
$$;
DROP FUNCTION IF EXISTS fn_expire_heart_lots() CASCADE;

-- 6-1. wallet_ledger 잔액 동기화 트리거 함수 제거
--    트리거(tr_wallet_ledger_update_balance)는 wallet_ledger DROP CASCADE 로 함께 제거되나,
--    함수 자체는 독립 객체라 잔존 → 본문이 public.wallets 를 참조하는 고아 방지 위해 명시 제거.
DROP FUNCTION IF EXISTS fn_wallet_ledger_update_balance() CASCADE;

-- 7. 테이블 제거 (FK 참조 순서: heart_lots → wallet_ledger → wallets → diamond_products)
DROP TABLE IF EXISTS heart_lots CASCADE;
DROP TABLE IF EXISTS wallet_ledger CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS diamond_products CASCADE;

-- 8. Enum 제거 (테이블·함수 DROP 후)
DROP TYPE IF EXISTS wallet_reason CASCADE;
DROP TYPE IF EXISTS wallet_currency CASCADE;

-- 9. app_config monetization 키 제거 (선택적 — RC 비활성화 확인 후)
-- DELETE FROM app_config WHERE key = 'monetization';
