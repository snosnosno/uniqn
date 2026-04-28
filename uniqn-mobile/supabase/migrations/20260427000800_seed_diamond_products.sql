-- 다이아 충전 패키지 6종 시드
-- BUSINESS_PLAN_2025.md §3.2, Plan Task 9
-- ON CONFLICT update — re-run 안전

INSERT INTO public.diamond_products (product_id, diamonds, bonus_diamonds, price_krw, display_order, active)
VALUES
  ('uniqn_diamonds_1000',     3,   0,   1000, 1, true),
  ('uniqn_diamonds_3000',    10,   0,   3000, 2, true),
  ('uniqn_diamonds_10000',   33,   2,  10000, 3, true),
  ('uniqn_diamonds_30000',  100,  10,  30000, 4, true),
  ('uniqn_diamonds_50000',  167,  23,  50000, 5, true),
  ('uniqn_diamonds_100000', 333,  67, 100000, 6, true)
ON CONFLICT (product_id) DO UPDATE SET
  diamonds       = EXCLUDED.diamonds,
  bonus_diamonds = EXCLUDED.bonus_diamonds,
  price_krw      = EXCLUDED.price_krw,
  display_order  = EXCLUDED.display_order,
  active         = EXCLUDED.active,
  updated_at     = now();
