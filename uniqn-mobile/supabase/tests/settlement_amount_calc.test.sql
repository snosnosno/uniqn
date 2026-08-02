-- ============================================================
-- fn_settlement_amount — 정산 금액 계산기 짝 픽스처 (감사 L1 잔여)
--
-- 마이그레이션: 20260802160000_settlement_amount_calculator.sql
--
-- 🔴 이 파일은 짝이 있다:
--      src/domains/settlement/__tests__/settlementAmountParity.test.ts
--    같은 입력 · 같은 기대값이며, 케이스를 한쪽에만 추가하면 양쪽의 개수 단언이 깨진다.
--    (여기 plan(22) = 픽스처 21 + 시그니처 1, 저쪽 FIXTURES.length === 21)
--
-- 왜 이 형태인가:
--   `fn_settlement_amount` 는 테이블을 읽지 않는 **순수 함수**(IMMUTABLE)라
--   시딩 없이 리터럴 입력으로 직접 호출된다. 그래서 두 언어의 계산기를
--   같은 표로 나란히 고정할 수 있다 — 이식 드리프트를 잡는 유일한 수단이다.
--
-- 각 케이스가 지키는 규칙(원본 JS 의 의미론):
--   01~04 역할별 단가표 > defaultSalary 폴백 · PROVIDED_FLAG(-1) 수당 제외 · 반올림 지점
--   05    근무시간 0 이면 수당·세금 무시하고 전 항목 0 (조기 반환)
--   06~08 컨테이너는 schedule.roleSalaries 를 보고 폴백이 하드코딩 15,000 이며
--         스키마에 어긋난 항목은 통째로 드롭된다
--   09~10 override 우선순위 · 'other'(협의) 급여 타입은 0원
--   11    정액세는 클램프가 없다 → 세후 음수 허용 (GREATEST(0,…) 를 넣으면 원본과 달라진다)
--   12~13 taxableItems 는 opt-out — 키가 없으면 **포함**이다
--   14    빈 객체 수당 override 도 override 다(공고 수당 무시)
--   15    role='other' + customRole 매칭
--   16    role 이 빈 문자열이면 단가표를 보지 않고 폴백으로 간다(NULL 만 보면 놓친다)
--   17~21 fable 리뷰(2026-08-02)가 지목한 "조용히 0원" 클래스. 🔴 **jsonb 의 JSON null 은 SQL NULL 이 아니다** —
--         `'{"defaultSalary":null}'::jsonb -> 'defaultSalary'` 는 `'null'::jsonb` 라 `IS NULL` 을 통과 못 하고,
--         amount 없는 급여 객체로 계산돼 0원이 확정된다. 17·18·19 가 그 3지점을 각각 고정한다.
--         20 은 taxableItems 값이 문자열 `"false"` 인 경우(JS `!== false` 는 포함).
--         21 은 리뷰가 발산이라 본 축인데 **양쪽이 같은 값**이었다(오탐) — 재조사를 막으려 남긴다.
--
-- 안전: BEGIN/ROLLBACK, 쓰기 없음.
-- ============================================================
BEGIN;
SELECT plan(22);

-- 0. 시그니처 고정 — 인자 순서가 바뀌면 호출부가 조용히 다른 값을 넣게 된다.
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_settlement_amount'),
  'p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_role text, '
  || 'p_custom_role text, p_custom_salary_info jsonb, p_custom_allowances jsonb, '
  || 'p_custom_tax_settings jsonb, p_posting_status text, p_posting_schedule jsonb, '
  || 'p_posting_role_catalog jsonb, p_posting_compensation jsonb',
  'fn_settlement_amount 시그니처가 고정돼 있다');

-- 실제 prod 공고(e558ca64) 형태 — 역할별 단가 + 식비 + 제공(-1) 2종 + 3.3%
CREATE TEMP TABLE sac_posting ON COMMIT DROP AS
SELECT
  '{"requirements":[{"timeSlots":[{"roles":[{"role":"dealer","count":2}]}]},{"timeSlots":[{"roles":[{"role":"floor","count":1}]}]}]}'::jsonb AS sched,
  '[{"role":"dealer","salary":{"type":"hourly","amount":20000}},{"role":"floor","salary":{"type":"hourly","amount":30000}}]'::jsonb AS cat,
  '{"allowances":{"meal":20000,"accommodation":-1,"transportation":-1,"guaranteedHours":4},"taxSettings":{"type":"rate","value":3.3},"defaultSalary":{"type":"hourly","amount":20000}}'::jsonb AS comp;

-- 01
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  174060::numeric,
  '01 일반공고 dealer 8h — 단가표 20,000 + 식비 20,000, 제공(-1) 2종 제외, 3.3%')
FROM sac_posting p;

-- 02
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'floor', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  251420::numeric,
  '02 일반공고 floor 8h — 역할별 단가가 defaultSalary 를 이긴다')
FROM sac_posting p;

-- 03
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'serving', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  174060::numeric,
  '03 단가표에 없는 역할 → defaultSalary 폴백')
FROM sac_posting p;

-- 04
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T17:30:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  164390::numeric,
  '04 7시간 30분 — 반올림 전 원값으로 기본급을 낸다')
FROM sac_posting p;

-- 05
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', NULL, 'dealer', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  0::numeric,
  '05 퇴근 시각 없음 → 수당·세금 무시하고 전 항목 0')
FROM sac_posting p;

-- 06
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'container',
    '{"kind":"dated","roleSalaries":[{"role":"dealer","salary":{"type":"hourly","amount":25000}}]}'::jsonb,
    '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  125000::numeric,
  '06 컨테이너 — 지점 단가표 매칭(25,000/h × 5h)');

-- 07
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'floor', NULL,
    NULL, NULL, NULL, 'container',
    '{"kind":"dated","roleSalaries":[{"role":"dealer","salary":{"type":"hourly","amount":25000}}]}'::jsonb,
    '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  75000::numeric,
  '07 컨테이너 — 단가표 미매칭 시 하드코딩 폴백 15,000/h');

-- 08
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'container',
    '{"kind":"dated","roleSalaries":[{"role":"","salary":{"type":"hourly","amount":99999}},{"role":"dealer","salary":{"type":"hourly","amount":25000}}]}'::jsonb,
    '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  125000::numeric,
  '08 컨테이너 — role 이 빈 문자열인 항목은 통째로 드롭된다');

-- 09
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    '{"type":"daily","amount":123000}'::jsonb, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  138281::numeric,
  '09 override 급여가 단가표를 이긴다 (일급은 시간 무관 전액)')
FROM sac_posting p;

-- 10
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    '{"type":"other","amount":50000}'::jsonb, NULL, NULL, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  0::numeric,
  '10 급여 타입 other(협의)는 기본급 0원');

-- 11
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z', 'dealer', NULL,
    '{"type":"hourly","amount":10000}'::jsonb, NULL, '{"type":"fixed","value":30000}'::jsonb, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  (-20000)::numeric,
  '11 정액세는 클램프가 없다 → 세후 음수 허용');

-- 12
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'dealer', NULL,
    '{"type":"hourly","amount":10000}'::jsonb, '{"meal":10000}'::jsonb,
    '{"type":"rate","value":10,"taxableItems":{"basePay":false}}'::jsonb, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  89000::numeric,
  '12 taxableItems opt-out — basePay 를 과세표준에서 뺀다');

-- 13
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'dealer', NULL,
    '{"type":"hourly","amount":10000}'::jsonb, '{"meal":10000}'::jsonb,
    '{"type":"rate","value":10,"taxableItems":{"transportation":false}}'::jsonb, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  81000::numeric,
  '13 taxableItems 부분 지정 — 미지정 키는 포함(opt-out 설계)');

-- 14
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T18:00:00Z', 'dealer', NULL,
    '{"type":"hourly","amount":10000}'::jsonb, '{}'::jsonb, NULL, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{"allowances":{"meal":50000}}'::jsonb) ->> 'afterTaxPay')::numeric,
  80000::numeric,
  '14 빈 객체 수당 override 는 공고 수당을 무시한다');

-- 15
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'other', '바텐더',
    NULL, NULL, NULL, 'active',
    '{"requirements":[{"timeSlots":[{"roles":[{"role":"other","customRole":"바텐더","count":1}]}]}]}'::jsonb,
    '[{"role":"other","customRole":"바텐더","salary":{"type":"hourly","amount":40000}}]'::jsonb,
    '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  200000::numeric,
  '15 role=other + customRole 로 단가표를 찾는다');

-- 16
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', '', NULL,
    NULL, NULL, NULL, 'active', p.sched, p.cat, p.comp) ->> 'afterTaxPay')::numeric,
  116040::numeric,
  '16 역할 미지정(빈 문자열)은 단가표를 보지 않고 폴백으로 간다')
FROM sac_posting p;

-- 17 🔴 defaultSalary 가 JSON null → 카탈로그 첫 단가로 폴백
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'serving', NULL,
    NULL, NULL, NULL, 'active',
    '{"requirements":[{"timeSlots":[{"roles":[{"role":"dealer","count":1}]}]}]}'::jsonb,
    '[{"role":"dealer","salary":{"type":"hourly","amount":20000}}]'::jsonb,
    '{"defaultSalary":null}'::jsonb) ->> 'afterTaxPay')::numeric,
  100000::numeric,
  '17 compensation.defaultSalary 가 JSON null 이면 카탈로그 첫 단가로 폴백한다');

-- 18 🔴 카탈로그 salary 가 JSON null → 없는 것으로 본다
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'active',
    '{"requirements":[{"timeSlots":[{"roles":[{"role":"dealer","count":1}]}]}]}'::jsonb,
    '[{"role":"dealer","salary":null}]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  75000::numeric,
  '18 카탈로그 항목의 salary 가 JSON null 이면 없는 것으로 본다');

-- 19 🔴 컨테이너 단가표 항목에 salary 가 없음 → 폴백 15,000/h
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'container',
    '{"kind":"dated","roleSalaries":[{"role":"dealer"}]}'::jsonb,
    '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  75000::numeric,
  '19 컨테이너 단가표 항목에 salary 가 없으면 폴백 15,000/h');

-- 20 🔴 taxableItems 값이 문자열 "false" 면 제외되지 않는다
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z', 'dealer', NULL,
    '{"type":"hourly","amount":10000}'::jsonb, NULL,
    '{"type":"rate","value":10,"taxableItems":{"basePay":"false"}}'::jsonb, 'active',
    '{"requirements":[]}'::jsonb, '[]'::jsonb, '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  9000::numeric,
  '20 taxableItems 값이 문자열 "false" 면 제외되지 않는다 (JS 는 !== false)');

-- 21 schedule 역할이 빈 문자열 → 매칭 불가, 폴백(카탈로그 첫 단가)
SELECT is(
  (public.fn_settlement_amount('2026-08-01T10:00:00Z', '2026-08-01T15:00:00Z', 'dealer', NULL,
    NULL, NULL, NULL, 'active',
    '{"requirements":[{"timeSlots":[{"roles":[{"role":"","count":1}]}]}]}'::jsonb,
    '[{"role":"dealer","salary":{"type":"hourly","amount":30000}}]'::jsonb,
    '{}'::jsonb) ->> 'afterTaxPay')::numeric,
  150000::numeric,
  '21 schedule 역할이 빈 문자열이면 매칭 불가 — 폴백(카탈로그 첫 단가)로 간다');

SELECT * FROM finish();
ROLLBACK;
