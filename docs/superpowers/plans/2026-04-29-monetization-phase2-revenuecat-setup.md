# Phase 2 — RevenueCat Webhook 외부 작업 가이드

> 작성일: 2026-04-29
> 의존성: Phase 1 DB Foundation 완료 (15 마이그 + 8 RPC)
> 후속: Phase 3 클라이언트 SDK + UI

이 문서는 **사람이 직접 해야 하는** 작업을 정리합니다. Edge Function 코드는 이미
`uniqn-mobile/supabase/functions/revenuecat-webhook/index.ts`에 작성·deploy 완료됐고
(`mcp__supabase__deploy_edge_function`, version 1, ACTIVE), 아래 외부 설정만 끝나면
Apple/Google IAP → 자동 다이아 적립이 시작됩니다.

---

## 0. 현재 상태 (확인용)

- ✅ Edge Function deploy: `revenuecat-webhook` (verify_jwt=false, RC 자체 Bearer 인증)
- ✅ DB: `diamond_products` 6 SKU 시드, `credit_diamonds_atomically` RPC 작동
- ⚠️ `REVENUECAT_WEBHOOK_SECRET` 미설정 → 함수 호출 시 500 server_misconfigured
- ⚠️ RevenueCat 계정 / 상품 / Offering 미설정

---

## 1. RevenueCat 계정 + 프로젝트 (~30분)

1. https://app.revenuecat.com 회원가입 (무료 tier로 시작 가능)
2. **Create Project** → 이름: `UNIQN`
3. 좌측 메뉴 **Project Settings → Apps** → iOS 앱 + Android 앱 등록
   - iOS Bundle ID: `com.uniqn.app` (실 bundle ID 확인)
   - Android Package: `com.uniqn.app`
4. **Project Settings → API Keys** 에서 다음 키 메모:
   - iOS Public SDK Key (앱 빌드 시 사용)
   - Android Public SDK Key

---

## 2. App Store Connect — Consumable IAP 6개 등록 (~1시간)

각 SKU를 **Consumable** 타입으로 등록 (Subscription 아님).

| Product ID | 가격 (KRW) | 다이아 + 보너스 표시 |
|------------|----------|--------------------|
| `uniqn_diamonds_1000`   | 1,000원   | 3💎 |
| `uniqn_diamonds_3000`   | 3,000원   | 10💎 |
| `uniqn_diamonds_10000`  | 10,000원  | 33💎 + 2💎 보너스 |
| `uniqn_diamonds_30000`  | 30,000원  | 100💎 + 10💎 보너스 |
| `uniqn_diamonds_50000`  | 50,000원  | 167💎 + 23💎 보너스 |
| `uniqn_diamonds_100000` | 100,000원 | 333💎 + 67💎 보너스 |

**주의**:
- Product ID는 **반드시 위와 동일하게** 입력 (DB seed에 등록된 값과 매칭)
- **Tax Category**: Consumable IAP
- **Localization**: 한국어 (Korea) 활성화
- 심사용 스크린샷: 각 패키지의 충전 시트 캡처 (Phase 3 UI 완료 후)

---

## 3. Google Play Console — Managed Product 6개 등록 (~1시간)

각 SKU를 **In-app product** 타입으로 등록 (Subscription 아님).

| Product ID | 동일 (App Store와 같음) |
| 가격 | 동일 (App Store 가격 미러링) |
| 활성화 | "활성" 상태로 publish |

**주의**:
- Play Console의 SKU ID = App Store Product ID (반드시 일치)
- **결제 라이브러리** v6+ 필요 (`com.android.billingclient:billing:6.x`) — react-native-purchases가 자동 처리
- 첫 등록 시 **앱 publishing 필수** (internal testing track으로도 충분)

---

## 4. RevenueCat에서 상품 + Offering 연결 (~30분)

1. **Products** 메뉴 → `+ New Product`
   - 6개 SKU 모두 등록 (App Store / Play Store 양쪽 connect)
2. **Entitlements** 메뉴
   - 본 시스템은 consumable이므로 entitlement 불필요 (skip)
3. **Offerings** 메뉴 → `+ New Offering`
   - 이름: `default` (RC SDK가 기본 조회)
   - 6개 product를 packages로 추가:
     - `$rc_three_month` 등 system identifier 대신 custom identifier 사용 가능
     - 예: `pkg_1000`, `pkg_3000`, ... (앱에서 매칭)
   - Display Order: 가격 오름차순

---

## 5. Webhook URL 등록 + Secret 발급 (가장 중요) (~10분)

1. RevenueCat 좌측 **Project Settings → Integrations → Webhooks**
2. `+ Add new webhook`
3. URL 입력:
   ```
   https://ygfxukhktpqymahfrvbz.supabase.co/functions/v1/revenuecat-webhook
   ```
4. **Authorization header value** 입력:
   - 형식: `Bearer <임의 32자 이상 secret>`
   - 예: `Bearer rcw_a3f9bdc7f1e442d8b6e0f9c2a4d7e8f1` (임의 생성)
   - **이 전체 문자열을 메모해두세요. 다음 단계에서 사용.**
5. **Events** 체크 (받을 이벤트):
   - ✅ `INITIAL_PURCHASE`
   - ✅ `NON_RENEWING_PURCHASE`
   - ✅ `CANCELLATION`
   - ✅ `BILLING_ISSUE`
   - ✅ `REFUND`
   - 나머지는 함수가 ignore 처리
6. **Save**

---

## 6. Supabase에 Secret 등록 (~5분)

CLI 사용 (권장):
```bash
cd C:/Users/user/Desktop/T-HOLDEM/uniqn-mobile
supabase secrets set REVENUECAT_WEBHOOK_SECRET="rcw_a3f9bdc7f1e442d8b6e0f9c2a4d7e8f1"
# 위 값은 5단계의 Authorization 헤더 전체 (Bearer 제외한 토큰만)
```

또는 **Supabase Dashboard** (CLI 미설치 시):
1. https://supabase.com/dashboard/project/ygfxukhktpqymahfrvbz/settings/functions
2. **Edge Functions → Manage secrets**
3. `+ Add new secret`
   - Name: `REVENUECAT_WEBHOOK_SECRET`
   - Value: `rcw_a3f9bdc7f1e442d8b6e0f9c2a4d7e8f1` (5단계 Bearer 뒤 토큰만)

---

## 7. 검증 (사용자 액션 후 자동화 가능)

Secret 등록 완료 후 아래 명령으로 즉시 검증 가능:

### 7.1 권한 검증 (잘못된 secret → 401)
```bash
curl -i -X POST "https://ygfxukhktpqymahfrvbz.supabase.co/functions/v1/revenuecat-webhook" \
  -H "Authorization: Bearer wrong_secret" \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"INITIAL_PURCHASE"}}'
# 기대: HTTP 401 {"error":"unauthorized"}
```

### 7.2 정상 결제 (INITIAL_PURCHASE → +35💎)
```bash
SECRET="<5단계의 Bearer 뒤 토큰>"
curl -i -X POST "https://ygfxukhktpqymahfrvbz.supabase.co/functions/v1/revenuecat-webhook" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "api_version": "1.0",
    "event": {
      "type": "INITIAL_PURCHASE",
      "id": "rc_test_event_001",
      "app_user_id": "b2222222-2222-4222-b222-222222222222",
      "product_id": "uniqn_diamonds_10000",
      "transaction_id": "store_txn_abc",
      "purchased_at_ms": 1777665600000,
      "store": "APP_STORE",
      "environment": "SANDBOX"
    }
  }'
# 기대: HTTP 200 success=true, diamonds_credited=35, rpc.first_purchase_bonus=5 (lifetime=0이면)
```

### 7.3 멱등성 (같은 event.id 재호출 → idempotent)
```bash
# 7.2와 동일한 명령을 다시 실행
# 기대: HTTP 200 rpc.idempotent=true (잔액 변화 없음)
```

### 7.4 환불 (REFUND → -35💎)
```bash
curl -i -X POST "https://ygfxukhktpqymahfrvbz.supabase.co/functions/v1/revenuecat-webhook" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "REFUND",
      "id": "rc_test_refund_001",
      "app_user_id": "b2222222-2222-4222-b222-222222222222",
      "product_id": "uniqn_diamonds_10000",
      "transaction_id": "store_txn_abc"
    }
  }'
# 기대: HTTP 200 diamonds_credited=-35, refund_purchase ledger row 생성
```

### 7.5 무시 이벤트 (RENEWAL → 200 ignored)
```bash
curl -i -X POST "https://ygfxukhktpqymahfrvbz.supabase.co/functions/v1/revenuecat-webhook" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"RENEWAL","id":"x","app_user_id":"x","product_id":"x"}}'
# 기대: HTTP 200 {"ignored":true,"type":"RENEWAL"}
```

### 7.6 DB 확인
```sql
-- 7.2~7.4 후 ledger 흐름 확인
SELECT reason, currency_type, delta, balance_after_diamond, revenuecat_transaction_id
FROM public.wallet_ledger
WHERE user_id = 'b2222222-2222-4222-b222-222222222222'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. RC Sandbox로 실제 결제 테스트

코드/설정 검증 후 실제 SDK 흐름 테스트는 **Phase 3** 에서 진행:
1. `react-native-purchases` SDK 설치
2. iOS Sandbox tester 계정으로 인앱 결제
3. RC dashboard에서 webhook 전송 로그 확인
4. Supabase Edge Function logs에서 호출 기록 확인

---

## 9. 운영 체크리스트 (Phase 6 rollout 시)

- [ ] RC dashboard **Webhooks → Recent events** 모니터링
- [ ] Supabase Edge Function **Logs** 페이지에서 4xx/5xx 비율 확인
- [ ] `wallet_ledger` 에서 `revenuecat_transaction_id IS NOT NULL` 거래만 매월 정산
- [ ] `lifetime_purchased_diamonds` 합계 ≈ RC dashboard MTR과 일치 검증
- [ ] 환불 발생 시 알림 (Phase 7 Slack/email)

---

## Phase 2 코드 작업 요약 (참고)

| 산출물 | 위치 |
|--------|------|
| Edge Function | `uniqn-mobile/supabase/functions/revenuecat-webhook/index.ts` |
| Deploy 결과 | revenuecat-webhook v1 ACTIVE, verify_jwt=false |
| 의존 RPC | `credit_diamonds_atomically` (Phase 1 Task 5) |
| 멱등성 키 | `wallet_ledger.revenuecat_transaction_id` UNIQUE |
| 처리 이벤트 | INITIAL_PURCHASE / NON_RENEWING_PURCHASE → +diamonds, REFUND/BILLING_ISSUE/CANCELLATION → -diamonds |
| 무시 이벤트 | RENEWAL / EXPIRATION / PRODUCT_CHANGE / TRANSFER / SUBSCRIBER_ALIAS / TEST |
| 보안 | Bearer secret 일치 + UUID 검증 + product DB 조회 (클라이언트 신뢰 X) |

---

## Phase 3 예고 (다음 plan)

- `react-native-purchases` 설치 + 초기화
- `purchasesService.ts` (SDK wrapper)
- `WalletStore` (Zustand) + `useWalletBalance` (TanStack Query)
- UI 컴포넌트: `BalanceBadge` / `PurchaseSheet` / `PaywallModal`
- Sandbox 테스터 결제 → RC webhook → Edge Function → DB 풀스택 검증
