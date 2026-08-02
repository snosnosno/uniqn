-- ============================================================
-- 감사 후속 P5 — L1(2/2) 1단계: 정산 금액 계산기 서버 이식
--
-- 왜 이 함수가 먼저 있어야 하는가:
--   확정(settle)·일괄(bulk)만 RPC 로 옮기고 계산을 안 옮기면, 서버가 클라가 보낸
--   금액을 그대로 받게 되어 **지금 있는 canonical 재계산 방어가 오히려 사라진다**.
--   즉 확정의 반쪽 전환은 개선이 아니라 퇴행이다(20260802130000...sql:17-24 가 남긴 판정).
--
-- 🔑 이 이식은 구현을 **하나 늘리는 게 아니라 옮기는 것**이다.
--    `SettlementRepository.calculateSettlementAmount`(TS, private)는 같은 PR 에서 삭제된다.
--    클라에 남는 계산기 갈래 수는 그대로다.
--
-- 이식 원본(단일 체인, 전부 실측으로 확인):
--   SettlementRepository.calculateSettlementAmount
--     → (컨테이너) buildVenueContainerContext(getRoleSalaries(schedule))
--       (일반)     getPostingSettlementContext(posting)
--     → getEffectiveSalaryInfoFromRoles / getEffectiveAllowances / getEffectiveTaxSettings
--     → SettlementCalculator.calculate
--       → TimeNormalizer.calculateDurationInHours
--       → calculateBasePay / calculateAllowances
--       → TaxCalculator.calculateByItems → calculateItemizedRateTax
--
-- 🔴 인자를 테이블 행(record)이 아니라 **순수 스칼라·jsonb 로 받는다.** 이유는 검증이다 —
--    순수 함수라야 pgTAP 이 시딩 없이 리터럴 픽스처로 직접 호출할 수 있고,
--    Jest 쪽 클라 계산기에 **같은 픽스처 표**를 물려 두 구현의 기대값을 한 자리에서 고정할 수 있다.
--    (짝 테스트: supabase/tests/settlement_amount_calc.test.sql
--             ↔ src/domains/settlement/__tests__/settlementAmountParity.test.ts)
--
-- ⚠️ JS 와 의도적으로 다르게 둔 곳(원본이 NaN 을 만드는 자리) — 아래 [DIVERGE-n] 주석 참조.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_settlement_amount(
  p_check_in              timestamptz,
  p_check_out             timestamptz,
  p_role                  text,
  p_custom_role           text,
  p_custom_salary_info    jsonb,
  p_custom_allowances     jsonb,
  p_custom_tax_settings   jsonb,
  p_posting_status        text,
  p_posting_schedule      jsonb,
  p_posting_role_catalog  jsonb,
  p_posting_compensation  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  -- 해소 컨텍스트
  v_roles           jsonb;   -- [{role, customRole, salary}] — 순서 보존(첫 등장 순)
  v_default_salary  jsonb;
  v_allow_src       jsonb;
  v_tax_src         jsonb;

  -- 유효 설정
  v_salary          jsonb;
  v_allow           jsonb;
  v_tax             jsonb;
  v_effective_role  text;

  -- 계산 중간값
  v_hours           numeric;
  v_diff_s          numeric;
  v_amount          numeric;
  v_base            numeric := 0;
  v_meal            numeric;
  v_trans           numeric;
  v_accom           numeric;
  v_addl            numeric;
  v_allow_pay       numeric := 0;
  v_total           numeric := 0;
  v_tax_type        text;
  v_tax_value       numeric;
  v_items           jsonb;
  v_taxable         numeric := 0;
  v_tax_amount      numeric := 0;
BEGIN
  -- ==========================================================
  -- 1. 급여 근거 해소 — 컨테이너(지점 직속)와 일반 공고는 **완전히 다른 필드**를 본다.
  --    컨테이너를 일반 분기로 태우면 roles 가 빈 배열이 되어 전원 폴백 단가(시급 15,000)로
  --    조용히 계산된다(SettlementRepository.ts:840-846 이 기록한 실제 사고).
  -- ==========================================================
  IF p_posting_status = 'container' THEN
    -- getRoleSalaries(schedule): schedule.roleSalaries 배열을 관대 파싱.
    -- entrySchema = { role: string.min(1), customRole?: string, salary?: {type: enum, amount: number} }
    -- 🔑 항목 하나라도 스키마에 어긋나면 zod safeParse 가 **그 항목을 통째로 드롭**한다.
    --    salary.type 이 enum 밖이거나 amount 가 숫자가 아니면 salary 만 버리는 게 아니라 항목이 사라진다.
    SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_roles
    FROM (
      SELECT
        t.ord,
        jsonb_build_object(
          'role',       t.obj ->> 'role',
          'customRole', t.obj -> 'customRole',
          'salary',     t.obj -> 'salary'
        ) AS e
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(p_posting_schedule -> 'roleSalaries') = 'array'
                  THEN p_posting_schedule -> 'roleSalaries'
                  ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS t(obj, ord)
      WHERE jsonb_typeof(t.obj) = 'object'
        AND COALESCE(t.obj ->> 'role', '') <> ''
        AND (t.obj -> 'customRole' IS NULL OR jsonb_typeof(t.obj -> 'customRole') = 'string')
        AND (
          t.obj -> 'salary' IS NULL
          OR (
            jsonb_typeof(t.obj -> 'salary') = 'object'
            AND (t.obj -> 'salary' ->> 'type') IN ('hourly', 'daily', 'monthly', 'other')
            AND jsonb_typeof(t.obj -> 'salary' -> 'amount') = 'number'
          )
        )
    ) s;

    -- buildVenueContainerContext: defaultSalary 는 **하드코딩 DEFAULT_SALARY_INFO**,
    -- allowances/taxSettings 는 항상 undefined(지점 직속 배치엔 공고 수당·세금 설정이 없다).
    v_default_salary := '{"type":"hourly","amount":15000}'::jsonb;
    v_allow_src      := NULL;
    v_tax_src        := NULL;
  ELSE
    -- getPostingRoleStats: schedule.requirements[].timeSlots[].roles[] 를 순회하며
    -- getPostingRoleKey(= role==='other' && customRole ? 'other:'||customRole : role ?? '')
    -- 로 중복 제거하고, salary 는 **roleCatalog 에서 같은 키**로 찾아 붙인다.
    -- ⚠️ 요구사항(requirements)에 등장하지 않는 카탈로그 역할은 목록에 없다 → 매칭 실패 → 폴백.
    -- ⚠️ toRoleRequirement 의 `role.role ?? 'dealer'` 는 **nullish** 라 결측만 dealer 로 만들고
    --    빈 문자열은 통과시킨다. 그래서 `COALESCE(->>)` 만 쓰고 NULLIF 로 '' 를 승격시키면 안 된다 —
    --    승격하면 카탈로그 키까지 dealer 가 되어 없는 단가를 붙이고 JS 와 갈라진다.
    SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb) INTO v_roles
    FROM (
      SELECT DISTINCT ON (d.k) d.k, d.ord, d.e
      FROM (
        SELECT
          CASE WHEN (rl.obj ->> 'role') = 'other' AND COALESCE(rl.obj ->> 'customRole', '') <> ''
               THEN 'other:' || (rl.obj ->> 'customRole')
               ELSE COALESCE(rl.obj ->> 'role', '') END AS k,
          (req.i * 1000000 + ts.i * 1000 + rl.i)                                     AS ord,
          jsonb_build_object(
            'role',       COALESCE(rl.obj ->> 'role', 'dealer'),
            'customRole', rl.obj -> 'customRole'
          )                                                                          AS e
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(p_posting_schedule -> 'requirements') = 'array'
                    THEN p_posting_schedule -> 'requirements' ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS req(obj, i)
        CROSS JOIN LATERAL jsonb_array_elements(
               CASE WHEN jsonb_typeof(req.obj -> 'timeSlots') = 'array'
                    THEN req.obj -> 'timeSlots' ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS ts(obj, i)
        CROSS JOIN LATERAL jsonb_array_elements(
               CASE WHEN jsonb_typeof(ts.obj -> 'roles') = 'array'
                    THEN ts.obj -> 'roles' ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS rl(obj, i)
        WHERE jsonb_typeof(rl.obj) = 'object'
      ) d
      ORDER BY d.k, d.ord
    ) s;

    -- 카탈로그 salary 를 같은 키로 붙인다.
    SELECT COALESCE(jsonb_agg(
             CASE WHEN cat.salary IS NULL THEN r.e ELSE r.e || jsonb_build_object('salary', cat.salary) END
             ORDER BY r.ord), '[]'::jsonb)
      INTO v_roles
    FROM jsonb_array_elements(v_roles) WITH ORDINALITY AS r(e, ord)
    LEFT JOIN LATERAL (
      SELECT NULLIF(c.obj -> 'salary', 'null'::jsonb) AS salary
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(p_posting_role_catalog) = 'array'
                  THEN p_posting_role_catalog ELSE '[]'::jsonb END
           ) AS c(obj)
      WHERE (CASE WHEN (c.obj ->> 'role') = 'other' AND COALESCE(c.obj ->> 'customRole', '') <> ''
                  THEN 'other:' || (c.obj ->> 'customRole')
                  ELSE COALESCE(c.obj ->> 'role', '') END)
            = (CASE WHEN (r.e ->> 'role') = 'other' AND COALESCE(r.e ->> 'customRole', '') <> ''
                    THEN 'other:' || (r.e ->> 'customRole')
                    ELSE COALESCE(r.e ->> 'role', '') END)
      LIMIT 1
    ) cat ON true;

    -- getPostingDefaultSalary: compensation.defaultSalary ?? roleCatalog 의 첫 salary 보유 항목.
    -- ?? 는 nullish 라 amount:0 이어도 객체가 있으면 그대로 채택된다.
    v_default_salary := NULLIF(p_posting_compensation -> 'defaultSalary', 'null'::jsonb);
    IF v_default_salary IS NULL THEN
      SELECT NULLIF(c.obj -> 'salary', 'null'::jsonb) INTO v_default_salary
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(p_posting_role_catalog) = 'array'
                  THEN p_posting_role_catalog ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS c(obj, i)
      WHERE NULLIF(c.obj -> 'salary', 'null'::jsonb) IS NOT NULL
      ORDER BY c.i
      LIMIT 1;
    END IF;

    v_allow_src := NULLIF(p_posting_compensation -> 'allowances', 'null'::jsonb);
    v_tax_src   := NULLIF(p_posting_compensation -> 'taxSettings', 'null'::jsonb);
  END IF;

  -- ==========================================================
  -- 2. 유효 급여/수당/세금 — override 는 **객체 존재 여부**로만 판정한다.
  --    JS 가 `workLog.customAllowances ? … : …` 로 객체 truthy 를 보므로 빈 객체 {} 도 override 다.
  --    "비었으니 공고값으로 폴백" 같은 보정을 넣으면 원본과 달라진다.
  -- 🔴 단, **jsonb 의 JSON null 은 SQL NULL 이 아니다.** `'{"defaultSalary":null}'::jsonb -> 'defaultSalary'`
  --    는 `'null'::jsonb` 를 돌려주고 `IS NULL` 을 통과하지 못한다. 그대로 두면 amount 가 없는
  --    급여 객체로 계산돼 **조용히 0원**이 확정된다(리뷰 지적 + 실측 확증: 3지점에서 0원 재현).
  --    그래서 jsonb 를 꺼내는 모든 지점에 `NULLIF(x, 'null'::jsonb)` 를 건다.
  -- ==========================================================
  IF NULLIF(p_custom_salary_info, 'null'::jsonb) IS NOT NULL THEN
    v_salary := p_custom_salary_info;
  ELSE
    -- getRoleSalaryFromRoles
    -- ⚠️ `!targetRole` 은 NULL 뿐 아니라 **빈 문자열도** 폴백으로 보낸다.
    IF COALESCE(p_role, '') = '' OR jsonb_array_length(v_roles) = 0 THEN
      v_salary := NULL;
    ELSE
      v_effective_role := CASE
        WHEN p_role = 'other' AND COALESCE(p_custom_role, '') <> '' THEN p_custom_role
        ELSE p_role
      END;

      -- Array.prototype.find 의미론 = **첫 일치**. 순서를 지켜야 한다.
      -- 카탈로그 항목이 role='other' + customRole 을 가지면 customRole 로 비교하고,
      -- 아니면 (role || name) 을 그대로 비교한다.
      SELECT NULLIF(r.e -> 'salary', 'null'::jsonb) INTO v_salary
      FROM jsonb_array_elements(v_roles) WITH ORDINALITY AS r(e, ord)
      WHERE CASE
              WHEN (r.e ->> 'role') = 'other' AND COALESCE(r.e ->> 'customRole', '') <> ''
                THEN (r.e ->> 'customRole') = v_effective_role
              ELSE COALESCE(NULLIF(r.e ->> 'role', ''), r.e ->> 'name') = v_effective_role
            END
      ORDER BY r.ord
      LIMIT 1;
    END IF;

    -- roleData?.salary ?? fallback, fallback = defaultSalary ?? DEFAULT_SALARY_INFO
    v_salary := COALESCE(v_salary, v_default_salary, '{"type":"hourly","amount":15000}'::jsonb);
  END IF;

  v_allow := COALESCE(NULLIF(p_custom_allowances, 'null'::jsonb), v_allow_src, '{}'::jsonb);
  v_tax   := COALESCE(NULLIF(p_custom_tax_settings, 'null'::jsonb), v_tax_src, '{"type":"none","value":0}'::jsonb);

  -- ==========================================================
  -- 3. 근무 시간 — 반올림 없는 **원값**이다.
  --    표시용 hoursWorked(2자리 반올림)와 basePay 계산용 시간은 서로 다르다
  --    (SettlementCalculator.ts:174 vs :186 vs :207). 하나로 합치면 조용히 금액이 달라진다.
  -- ==========================================================
  IF p_check_in IS NULL OR p_check_out IS NULL THEN
    v_hours := 0;
  ELSE
    v_diff_s := EXTRACT(EPOCH FROM (p_check_out - p_check_in))::numeric;
    -- 종료가 시작보다 이르면 자정 넘김으로 보고 +24h (원본의 순수 HH:mm 경로 회귀 방어를 그대로 이식)
    IF v_diff_s < 0 THEN
      v_diff_s := v_diff_s + 86400;
    END IF;
    v_hours := GREATEST(0, v_diff_s) / 3600;
  END IF;

  -- 근무 시간이 0 이면 수당·세금이 아무리 있어도 **전 항목 0** 으로 조기 반환한다.
  IF v_hours = 0 THEN
    RETURN jsonb_build_object(
      'hoursWorked', 0, 'basePay', 0, 'allowancePay', 0,
      'totalPay', 0, 'taxAmount', 0, 'afterTaxPay', 0
    );
  END IF;

  -- ==========================================================
  -- 4. 기본급
  -- ==========================================================
  v_amount := CASE WHEN jsonb_typeof(v_salary -> 'amount') = 'number'
                   THEN (v_salary ->> 'amount')::numeric END;

  -- [DIVERGE-1] JS 는 amount 가 undefined 여도 `undefined < 0` 이 false 라 hourly 분기로 들어가
  --   Math.round(hours * undefined) = **NaN** 을 만든다(그 뒤 총액·세금까지 전부 NaN).
  --   NaN 은 어떤 화면에서도 의미가 없는 고장 상태라 여기서는 0 으로 닫는다. 의도된 차이다.
  IF v_amount IS NULL OR v_amount < 0 THEN
    v_base := 0;
  ELSE
    v_base := CASE v_salary ->> 'type'
      -- round(numeric) 은 half-away-from-zero, JS Math.round 는 half-up.
      -- basePay 는 음수가 될 수 없으므로(위 가드) 두 규칙이 일치한다.
      WHEN 'hourly'  THEN round(v_hours * v_amount)
      WHEN 'daily'   THEN v_amount   -- 출근하면 전액, 시간 무관
      WHEN 'monthly' THEN v_amount
      ELSE 0                          -- 'other'(협의)는 0원. default 를 hourly 로 두면 금액이 부푼다.
    END;
  END IF;

  -- ==========================================================
  -- 5. 수당 — meal/transportation/accommodation 은 PROVIDED_FLAG(-1) 제외,
  --    additional 은 **-1 체크가 없다**(원본의 비대칭. 여기에 -1 배제를 넣으면 안 된다).
  --    셋 다 `> 0` 조건이 있어 -1 은 어차피 걸러지지만, 비대칭 자체를 기록으로 남긴다.
  -- ==========================================================
  v_meal  := CASE WHEN jsonb_typeof(v_allow -> 'meal')           = 'number' THEN (v_allow ->> 'meal')::numeric END;
  v_trans := CASE WHEN jsonb_typeof(v_allow -> 'transportation') = 'number' THEN (v_allow ->> 'transportation')::numeric END;
  v_accom := CASE WHEN jsonb_typeof(v_allow -> 'accommodation')  = 'number' THEN (v_allow ->> 'accommodation')::numeric END;
  v_addl  := CASE WHEN jsonb_typeof(v_allow -> 'additional')     = 'number' THEN (v_allow ->> 'additional')::numeric END;

  v_allow_pay :=
      CASE WHEN COALESCE(v_meal,  0) > 0 AND v_meal  IS DISTINCT FROM -1 THEN v_meal  ELSE 0 END
    + CASE WHEN COALESCE(v_trans, 0) > 0 AND v_trans IS DISTINCT FROM -1 THEN v_trans ELSE 0 END
    + CASE WHEN COALESCE(v_accom, 0) > 0 AND v_accom IS DISTINCT FROM -1 THEN v_accom ELSE 0 END
    + CASE WHEN COALESCE(v_addl,  0) > 0                                 THEN v_addl  ELSE 0 END;

  v_total := v_base + v_allow_pay;

  -- ==========================================================
  -- 6. 세금 — TaxCalculator.calculateByItems
  --    'none'/'fixed' 가 아니면 전부 rate 분기다(원본이 else 로 떨어뜨린다).
  -- ==========================================================
  v_tax_type  := v_tax ->> 'type';
  v_tax_value := CASE WHEN jsonb_typeof(v_tax -> 'value') = 'number'
                      THEN (v_tax ->> 'value')::numeric END;

  IF v_tax_type = 'none' THEN
    v_tax_amount := 0;
  ELSIF v_tax_type = 'fixed' THEN
    -- 정액세는 grossPay 와 무관하고 클램프가 없다 → afterTaxPay 가 **음수가 될 수 있다.**
    -- GREATEST(0, …) 를 넣으면 원본과 달라진다.
    -- [DIVERGE-2] value 결측 시 JS 는 undefined(→ 뺄셈에서 NaN). 여기서는 0.
    v_tax_amount := COALESCE(v_tax_value, 0);
  ELSE
    v_items := v_tax -> 'taxableItems';
    -- ⚠️ opt-out 설계: `taxableItems.x !== false` — 키가 없으면 **포함**이다.
    --    `= 'true'` 로 쓰면 미지정 항목이 반대로 판정된다.
    -- ⚠️ 비교는 `->>`(텍스트)가 아니라 `->`(jsonb) 로 한다. `->>` 를 쓰면 문자열 `"false"` 가
    --    불리언 false 와 합류해 제외되는데, JS `!== false` 는 문자열을 **포함**시킨다.
    v_taxable :=
        CASE WHEN NOT COALESCE(v_items -> 'basePay' = 'false'::jsonb, false) THEN v_base ELSE 0 END
      + CASE WHEN NOT COALESCE(v_items -> 'meal' = 'false'::jsonb, false)
                  AND COALESCE(v_meal, 0) > 0 AND v_meal IS DISTINCT FROM -1 THEN v_meal ELSE 0 END
      + CASE WHEN NOT COALESCE(v_items -> 'transportation' = 'false'::jsonb, false)
                  AND COALESCE(v_trans, 0) > 0 AND v_trans IS DISTINCT FROM -1 THEN v_trans ELSE 0 END
      + CASE WHEN NOT COALESCE(v_items -> 'accommodation' = 'false'::jsonb, false)
                  AND COALESCE(v_accom, 0) > 0 AND v_accom IS DISTINCT FROM -1 THEN v_accom ELSE 0 END
      + CASE WHEN NOT COALESCE(v_items -> 'additional' = 'false'::jsonb, false)
                  AND COALESCE(v_addl, 0) > 0 THEN v_addl ELSE 0 END;

    -- 반올림은 **여기 한 곳**(과세표준 합산 후 1회). 항목별 개별 반올림이 아니다.
    -- [DIVERGE-3] JS 는 배정도 부동소수(예: 500 * 0.033 = 16.500000000000004)로 곱하고,
    --   여기는 numeric 정확 연산이다. 곱이 정확히 x.5 로 떨어지는 경계에서 **1원 차이**가
    --   날 수 있다(양수라 반올림 규칙 자체는 일치하지만 부동소수 오차 방향이 다르다).
    --   짝 픽스처 테스트가 실사용 범위를 고정하고, 클라의 mismatch 경고 로그가 실발생을 관측한다.
    v_tax_amount := round(v_taxable * (COALESCE(v_tax_value, 0) / 100));
  END IF;

  RETURN jsonb_build_object(
    'hoursWorked',  round(v_hours, 2),      -- 표시용. basePay 계산에는 쓰이지 않았다.
    'basePay',      v_base,
    'allowancePay', v_allow_pay,
    'totalPay',     v_total,
    'taxAmount',    v_tax_amount,
    'afterTaxPay',  v_total - v_tax_amount  -- 클램프 없음(원본 동일)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_settlement_amount(
  timestamptz, timestamptz, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb
) IS
  '정산 금액 canonical 계산(감사 L1). SettlementRepository.calculateSettlementAmount 체인의 서버 이식본이며 '
  '그 TS 구현은 같은 PR 에서 삭제됐다. 순수 함수라 pgTAP 이 시딩 없이 리터럴 픽스처로 검증하고, '
  'Jest 짝 테스트(settlementAmountParity.test.ts)가 같은 픽스처로 클라 계산기를 고정한다. '
  'JS 가 NaN 을 만드는 두 자리(급여 amount 결측·정액세 value 결측)만 0 으로 닫았다(DIVERGE-1/2).';

REVOKE ALL ON FUNCTION public.fn_settlement_amount(
  timestamptz, timestamptz, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_settlement_amount(
  timestamptz, timestamptz, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb
) TO authenticated;
