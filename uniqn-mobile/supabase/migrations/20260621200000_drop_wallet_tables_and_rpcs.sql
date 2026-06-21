-- chore: 지갑/IAP 수익모델 제거 — wallet 관련 테이블·RPC·CRON 정리
-- ⚠️  prod 적용 전 반드시 확인:
--     1. 모든 사용자 wallets 잔액이 0 또는 별도 정산 완료
--     2. RevenueCat 대시보드 웹훅 URL 제거 + 구독 비활성화 완료
--     3. App Store / Google Play IAP 항목 제거 신청 완료
--     4. staging 환경에서 먼저 적용 후 회귀 확인
-- ⚠️  이 파일은 작성만 된 상태이며 prod/staging에 적용하지 않았음 (2026-06-21)

-- 1. 결제/공고 생성 원자 RPC
DROP FUNCTION IF EXISTS create_job_posting_with_payment_atomically(uuid, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS cancel_job_posting_with_refund_atomically(uuid, uuid) CASCADE;

-- 2. 다이아 차감/적립 RPC
DROP FUNCTION IF EXISTS consume_diamonds_atomically(uuid, integer, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS credit_diamonds_atomically(uuid, integer, text, text, integer, integer) CASCADE;

-- 3. 하트 적립/출석 RPC
DROP FUNCTION IF EXISTS grant_heart_atomically(uuid, integer, text, interval) CASCADE;
DROP FUNCTION IF EXISTS claim_daily_attendance() CASCADE;

-- 4. 공고 비용 조회 RPC
DROP FUNCTION IF EXISTS get_posting_cost(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_wallet_summary(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_payment_server_cost_calc(text, uuid) CASCADE;

-- 5. 가입 시 하트 적립 트리거 제거
DROP TRIGGER IF EXISTS on_auth_user_created_grant_heart ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_grant_heart() CASCADE;
DROP FUNCTION IF EXISTS backfill_signup_hearts() CASCADE;

-- 6. 테이블 제거 (FK 참조 순서: heart_lots → wallet_ledger → wallets → diamond_products)
DROP TABLE IF EXISTS heart_lots CASCADE;
DROP TABLE IF EXISTS wallet_ledger CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS diamond_products CASCADE;

-- 7. Enum 제거 (테이블 DROP 후)
DROP TYPE IF EXISTS wallet_reason CASCADE;
DROP TYPE IF EXISTS wallet_currency_type CASCADE;

-- 8. CRON job 제거 (pg_cron 설치된 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-heart-lots');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron job이 없으면 무시
END;
$$;

-- 9. app_config monetization 키 제거 (선택적 — RC 비활성화 확인 후)
-- DELETE FROM app_config WHERE key = 'monetization';
