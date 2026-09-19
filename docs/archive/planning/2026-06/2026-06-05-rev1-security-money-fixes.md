# rev1 보안·머니 리뷰 — 수정 패치 모음 (적용 대기)

> 작성: 2026-06-05 / 브랜치: `review/1-security-money-correctness` / 기준: master `452c56b86`
> 출처: rev1 적대리뷰 결과 + RC/Supabase MCP 외부설정 실측
> ✅ **이미 적용됨(이 브랜치 커밋)**: C-1 웹훅 환경 게이트 화이트리스트 (`107147ec0`)
> ⬜ **본 문서 = 적용 대기 패치** — 안전정책상 작성자(에이전트)는 마이그/RPC/RLS 적용 금지. 사용자가 검토 후 MCP `apply_migration`/별도 PR로 반영.

---

## 1. 🟡 마이그/RPC 패치 (사용자가 MCP apply_migration 으로 적용)

> ⚠️ 공통: 모두 신규 스택 pgTAP Red-Green 후 적용. RPC 재정의는 **현행 본문 diff 필수**(과거 blurhash 누락·이중증가 회귀 전례). prod 적용 전 `mcp__supabase__execute_sql` 로 `SELECT ... LIMIT 0` 컴파일 검증 권장.

### 1-1. [P1] 첫충전 보너스 환불 클로백 — `credit_diamonds_atomically`

**문제**: 첫충전 시 +5💎 보너스(`grant_first_purchase_bonus`)를 별도 row로 적립하나, 환불(p_diamonds<0) 경로는 메인 row만 반전하고 보너스·lifetime을 건드리지 않음 → buy→refund로 계정당 5💎 영구취득. (`20260427000400:50-91`, liveNow=false)

**설계 결정 (적용 전 제품 확정 필요)**:
- `lifetime_purchased_diamonds` 의미를 **gross(총구매)** → **net(구매−환불)** 으로 전환할지. 현재 용도는 첫충전 게이트 단독이라 net 전환이 안전. net이면 전액환불 후 재구매 시 보너스 재취득=정상(실제 retain된 첫구매에만 보너스).
- 부분환불: lifetime>0 유지 → 보너스 유지(보너스는 첫 retained 구매 보상이므로 합리적). lifetime이 0에 도달할 때만 클로백.

**Approach B (자기완결, 권장) — 델타(현행 본문에 추가)**:
```sql
-- credit_diamonds_atomically 재정의 시, DECLARE 에 추가:
--   v_net_bonus INT := 0;   v_lifetime_after INT;
--
-- [기존 step 6 "메인 ledger row INSERT" 직후, step 8 "lifetime 누계" 자리]에 교체:

  -- 6) lifetime + 환불 클로백
  IF p_diamonds > 0 THEN
    UPDATE public.wallets
       SET lifetime_purchased_diamonds = lifetime_purchased_diamonds + p_diamonds
     WHERE user_id = p_user_id;
  ELSE
    -- 환불: lifetime 을 net 으로 감소 (floor 0)
    v_lifetime_after := GREATEST(0, v_wallet.lifetime_purchased_diamonds + p_diamonds);

    -- 미상환 첫충전 보너스 잔액 = (지급 누계) − (기존 클로백 누계)
    SELECT COALESCE(SUM(delta), 0)::int
      INTO v_net_bonus
      FROM public.wallet_ledger
     WHERE user_id = p_user_id
       AND reason = 'grant_first_purchase_bonus';

    -- net lifetime 이 0 으로 떨어졌고 미상환 보너스가 남아있으면 클로백 row 적립
    IF v_lifetime_after = 0 AND v_net_bonus > 0 THEN
      INSERT INTO public.wallet_ledger(
        user_id, currency_type, delta, reason, ref_type,
        balance_after_heart, balance_after_diamond, metadata
      ) VALUES (
        p_user_id, 'diamond', -v_net_bonus, 'grant_first_purchase_bonus', 'revenuecat',
        v_wallet.heart_balance,
        GREATEST(0, v_wallet.diamond_balance + p_diamonds - v_net_bonus),
        jsonb_build_object('clawback', true, 'source_transaction_id', p_revenuecat_transaction_id)
      );
    END IF;

    UPDATE public.wallets
       SET lifetime_purchased_diamonds = v_lifetime_after
     WHERE user_id = p_user_id;
  END IF;
```
> 주의: 잔액 캐시 트리거(`20260427000200`)가 **마지막 ledger row 의 balance_after_diamond** 를 복사하므로, 클로백 row 가 메인 환불 row 뒤에 INSERT 되어 최종 캐시 = 클로백 반영값(floor 0)이 되도록 순서 유지. 메인 환불 row 의 balance_after 가 음수일 수 있는 P3(over-refund floor)는 별건.

**pgTAP Red-Green 케이스(필수)**:
1. 첫구매(+3,+5보너스)=8, lifetime=3 → 전액환불(−3) → 잔액 **0**(8−3−5), lifetime=0, 클로백 row 1건 (현재는 5 잔존 → RED)
2. 첫구매 후 **부분**환불(−1) → lifetime=2(>0), 클로백 없음, 보너스 유지
3. 비첫구매(lifetime>0) 환불 → 클로백 없음(보너스 row 자체 부재)
4. 멱등: 같은 refund event.id 재호출 → idempotent, 클로백 1회만

---

### 1-2. [P2] wallet 테이블 DML REVOKE (+ FORCE RLS는 선택·검증부)

**문제**: `#163`이 함수 EXECUTE만 REVOKE, 계획서가 명시한 테이블 DML REVOKE/FORCE RLS 미구현. 현재 `wallet_ledger` 에 write 정책 부재로 RLS default-deny가 직접위조를 이미 차단 → **지금 무해, 방어심층만**.

**신규 마이그 `20260605000000_wallet_dml_revoke.sql` (안전·권장)**:
```sql
-- 방어심층: PostgREST anon/authenticated 의 wallet 테이블 직접 DML 봉쇄.
-- SECDEF RPC 는 definer(소유자) 권한으로 쓰므로 영향 없음(authenticated GRANT 와 무관).
REVOKE INSERT, UPDATE, DELETE ON public.wallets         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_ledger   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.heart_lots      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.diamond_products FROM anon, authenticated;
```
> ✅ REVOKE 단독은 RPC 무영향(정의자 권한 별개). 테이블 GRANT 가 없으면 RLS 정책이 있어도 INSERT 불가 → "향후 실수로 write 정책 추가" 회귀까지 차단.

**FORCE ROW LEVEL SECURITY 는 선택 — ⚠️ 사전검증 필수**:
```sql
-- ⚠️ FORCE RLS 는 테이블 '소유자'에게도 RLS 적용. SECDEF RPC/잔액 트리거가
--    소유자(postgres) 권한으로 wallets UPDATE 하므로, 소유자가 BYPASSRLS 가 아니거나
--    소유자 허용 정책이 없으면 consume/credit/refund 가 깨진다.
-- 적용 전 반드시: ① RPC 정의자 role 의 rolbypassrls 확인 ② pgTAP 로 consume/credit/refund 회귀 검증.
-- ALTER TABLE public.wallets        FORCE ROW LEVEL SECURITY;   -- 검증 후에만
-- ALTER TABLE public.wallet_ledger  FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.heart_lots     FORCE ROW LEVEL SECURITY;
```
> 권고: **DML REVOKE만 적용**(안전·충분). FORCE RLS는 BYPASSRLS 검증 통과 시에만. `wallets.wallet_admin_all`(FOR ALL)로 admin JWT 직접 잔액 UPDATE 가능한 점도 SELECT-only로 좁힐지 별도 결정.

---

### 1-3. [P3] `_calc_posting_cost` hashtext INT_MIN 오버플로

**문제**: `abs(hashtext(...)) % 100` 에서 `hashtext`가 `-2147483648` 반환 시 `abs()`가 int4 범위 초과 → 예외 → 유료화 ON 상태에서 해당 owner 공고 생성 결정적 차단(확률 1/2³²). (`20260530000001:51`)

**신규 마이그 `20260605000010_fix_calc_posting_cost_hashtext.sql` (전체 재정의, 현행 본문 보존 + 라인51만 교정)**:
```sql
CREATE OR REPLACE FUNCTION public._calc_posting_cost(p_type TEXT, p_owner_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_config JSONB; v_base INT; v_rollout INT;
BEGIN
  IF p_owner_id IS NULL THEN RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL'; END IF;
  v_base := CASE p_type WHEN 'urgent' THEN 10 WHEN 'fixed' THEN 5 WHEN 'tournament' THEN 0 ELSE 1 END;
  IF v_base = 0 THEN RETURN 0; END IF;
  SELECT value INTO v_config FROM public.app_config WHERE key = 'monetization';
  IF v_config IS NULL THEN RETURN 0; END IF;
  IF NOT COALESCE((v_config->>'enabled')::boolean, false) THEN RETURN 0; END IF;
  IF NOT COALESCE((v_config->'paid_types'->>p_type)::boolean, false) THEN RETURN 0; END IF;
  v_rollout := COALESCE((v_config->>'rollout_percentage')::int, 0);
  -- [FIX] abs(int4) INT_MIN 오버플로 회피 + 분포편향 제거: bigint 마스킹으로 0..2^31-1
  IF ((hashtext(p_owner_id::text)::bigint & 2147483647) % 100) >= v_rollout THEN
    RETURN 0;
  END IF;
  RETURN v_base;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) TO authenticated, service_role;
```
> 함께 검토(P3 정보누출): `_calc_posting_cost` 의 authenticated 직접 GRANT 제거(표시는 `get_posting_cost`만). caller≠owner 시 PERMISSION_DENIED 바인딩이면 롤아웃 버킷 프로빙 차단. 단 SECDEF 래퍼 내부호출은 영향 없음.

---

### 1-4. [P2] `applications` 중복 permissive SELECT 정리 (fresh-stack drift)

**문제**: base(`20260409000000:597-598`)가 `applications_select_involved` drop-then-create, 이후 마이그는 별도명 `app_select`만 갱신 → fresh-stack에 SELECT permissive 2정책 공존(노출 동일, perf/advisor 부채). prod는 이미 정리됐을 가능성.

**적용 전 확인 쿼리(execute_sql)**:
```sql
SELECT polname FROM pg_policy
 WHERE polrelid='public.applications'::regclass AND polcmd='r';   -- app_select 단독이면 prod 이미 정리됨(no-op)
SELECT polname FROM pg_policy
 WHERE polrelid='public.work_logs'::regclass AND polcmd='r';      -- base wl_* 중복 여부도 점검
```
**신규 마이그 `20260605000020_drop_dup_select_policies.sql`**:
```sql
DROP POLICY IF EXISTS "applications_select_involved" ON public.applications;
-- work_logs 도 base 중복명 확인 후 동일 처리:
-- DROP POLICY IF EXISTS "<base wl select 정책명>" ON public.work_logs;
```
> `app_select`(상위집합)가 존재함을 위 쿼리로 확인한 뒤에만 DROP. 미존재 시 DROP 금지(접근 상실 위험).

---

## 2. 🟡 클라 코드 수정안 (승인 후 이 브랜치 적용 가능)

### 2-1. [P2] `show_purchase_ui` 서버 kill-switch 복원

**문제**: seed에 `show_purchase_ui:true` 있으나 읽는 코드 0건 → RC/결제 사고 시 원격 차단 불가. (`purchaseSheetStore.ts`, `create.tsx`)

**수정안** (신규 훅 + 시트 진입 가드):
```ts
// src/hooks/useMonetizationConfig.ts (신규) — Repository 경유 app_config 조회
export function useMonetizationConfig() {
  return useQuery({
    queryKey: ['app_config', 'monetization'],
    queryFn: () => AppConfigRepository.getMonetization(), // { enabled, show_purchase_ui, ... }
    staleTime: 5 * 60_000,
  });
}
// PaywallModal onCharge / PurchaseSheet 진입: show_purchase_ui===false 면 open 차단 + '점검 중' 안내.
```
> AppConfigRepository(읽기 전용, app_config SELECT) 추가 필요. 공수 ~1h + 테스트.

### 2-2. [P2] RC SDK 키 OTA fallback (PortOne 패턴 이식)

**문제**: `getApiKey()`가 `process.env.EXPO_PUBLIC_REVENUECAT_*` 직접 읽음 → eas.json 빌드 env에만 존재 → `eas update`(OTA)는 shell env만 평가 → 키 빈값 → `isAvailable()=false` 충전 전면 비활성. (`purchasesService.ts:16-24`, [[pitfall_eas_update_shell_env_not_loaded]])

**수정안** (PortOne `app.config.ts:353-359` 패턴 동일):
```ts
// app.config.ts extra 에 추가 (공개 식별자라 fallback 상수 가능):
extra: {
  // ...portOne,
  revenueCat: {
    iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? 'appl_XiQzYCeHsEBFgRhRPiUQlbzJVcg',
    androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? 'goog_AGqIYvWCfjHvDAHOOHPLZZnHZZF',
  },
},
```
```ts
// purchasesService.ts getApiKey(): Constants.expoConfig?.extra?.revenueCat 우선, env fallback
import Constants from 'expo-constants';
function getApiKey(): string {
  const rc = Constants.expoConfig?.extra?.revenueCat ?? {};
  return (Platform.select({
    ios: rc.iosKey ?? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: rc.androidKey ?? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    default: undefined,
  }) ?? '');
}
```
> 대안(코드무변): 배포 런북에 "OTA 전 `EXPO_PUBLIC_REVENUECAT_*` export 강제". 단 휴먼에러 취약 → 코드 fallback 권장.

### 2-3. [P2] anon app_user_id 과금-미적립 가드

**문제**: `configure()` 실패(silent catch)·logIn 경합 시 RC 익명ID(`$RCAnonymousID:`)로 결제 → 웹훅 `UUID_REGEX` 400 → 영구 드랍(돈은 청구). (`purchasesService.ts:36-56`, webhook `index.ts:134-136`)

**수정안 2갈래**:
- 클라: `purchasePackage` 전 `configured && currentUid===uid` 보장(미충족 시 재configure await, 실패면 구매 차단 + 안내).
- 웹훅: 비-UUID `app_user_id` → 400 대신 **200 + Sentry/reconcile 로그**(RC 무한 retry 폭주 방지 + 영구유실 관측). `original_app_user_id`/alias 로 UUID 복구 시도.

### 2-4. [P3] `usePurchaseDiamonds` 언마운트 setState 가드

**문제**: 폴링(최대 10s) 중 시트 언마운트 시 `setStatus` 누수 경고. (`usePurchaseDiamonds.ts:30-57`)

**수정안**:
```ts
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
const safeSet = (s: PurchaseStatus) => { if (mountedRef.current) setStatus(s); };
// 모든 setStatus → safeSet 치환. pollWalletCredit 에 AbortSignal 추가도 검토.
```
> React 위생 픽스(동작 거의 불변, dev 경고 제거). 결제 머니 로직 무변경이라 비교적 안전하나 충전 훅 변경이라 승인 후 적용.

---

## 3. ⬜ 웹훅 RC 대시보드 조치 (외부설정 — 사용자 수동)

> 실측: RC 프로젝트 `proja58415e9`, 웹훅통합 `uniqn IAP` → `revenuecat-webhook`, `event_types = initial_purchase·cancellation·billing_issue·non_renewing_purchase`, `environment: null`.

### 3-1. 환불 이벤트 타입 커버리지 확인/보강
- 현재 **credit**(initial_purchase·non_renewing_purchase) ✅, **refund 신호 = cancellation** ✅ 구독됨. 분류기는 `CANCELLATION→refund`(BILLING_ERROR 제외) 처리.
- ⚠️ `REFUND` 타입은 미구독. 소비성(consumable) 환불은 RC가 **통상 CANCELLATION으로 전송**하므로 영향 제한적일 수 있으나, **ON 전 RC 문서로 소비성 환불 이벤트 타입을 확정**하고 필요 시 `refund`(+계정이전 `transfer`) 추가.
- RC 대시보드 → Integrations → Webhooks → `uniqn IAP` → Event types 에서 추가.

### 3-2. environment 필터 / fail-closed
- 웹훅 `environment: null` = 샌드박스+prod 둘 다 전송. **edge fn의 환경 게이트가 유일 방어선**.
- ✅ **C-1(`107147ec0`)으로 edge fn을 PRODUCTION 화이트리스트(fail-closed) 전환 완료** — environment 누락/오타/SANDBOX 전부 차단. (단, 이 변경은 **edge fn 재배포 필요** — `revenuecat-webhook` 현재 v7, 사용자 배포 영역.)
- 선택: RC 대시보드에서 웹훅을 PRODUCTION-only로 한정하면 이중 방어.

### 3-3. 시크릿 매칭 (수동 확인)
- Supabase secret `REVENUECAT_WEBHOOK_SECRET`(bare) 값 = RC 웹훅 `Authorization: Bearer <…>` 값 동일한지 대조. (읽기 불가 영역, 사용자 확인)

---

## 4. 적용 순서 권고

1. **즉시(안전)**: §1-2 DML REVOKE, §1-3 hashtext, §1-4 중복정책(확인쿼리 후) — 동작불변/저위험, pgTAP 후 apply_migration.
2. **유료화 ON 게이트(필수)**: §1-1 P1 클로백(제품 결정 + pgTAP Red-Green) + §3 외부설정.
3. **충전 라이브 전**: §2-2 RC OTA fallback, §2-3 과금-미적립 가드, §2-1 kill-switch.
4. **C-1 edge fn 재배포**(`revenuecat-webhook`) — 환경 게이트 화이트리스트 반영.
5. **그 후 재검증**: 신규 스택 pgTAP 전체 + sandbox 실구매 e2e 1회.
