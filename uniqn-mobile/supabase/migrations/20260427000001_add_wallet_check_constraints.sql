-- 후속 보강: 코드 리뷰 피드백 반영 CHECK 제약 추가
-- 목적: 음수/0 가격 product 방지 + heart_lots 거꾸로 된 만료일 방지
-- 배경: 20260427000000 마이그레이션의 누락 invariant 후속 보완
-- 스펙 참조: docs/superpowers/specs/2026-04-26-monetization-design.md §3.1, §3.4

ALTER TABLE public.diamond_products
  ADD CONSTRAINT chk_price_krw_positive CHECK (price_krw > 0);

ALTER TABLE public.heart_lots
  ADD CONSTRAINT chk_expires_after_granted CHECK (expires_at > granted_at);

COMMENT ON CONSTRAINT chk_price_krw_positive ON public.diamond_products IS
  '유료 product는 양수 가격 필수 (무료 free tier는 별도 시스템).';

COMMENT ON CONSTRAINT chk_expires_after_granted ON public.heart_lots IS
  '만료일은 적립 시점 이후여야 함. 백데이트 lot 방지.';
