# 결제(다이아 충전) 외부 설정 가이드 — 사용자 작업 (2026-05-29)

> 대상: 코드로 할 수 없고 **사용자가 직접 콘솔/대시보드에서 해야 하는** 설정만 정리.
> 백엔드(지갑 DB·`revenuecat-webhook` Edge Function)는 이미 구축됨. 앱 내 충전 화면(Phase 3 클라이언트 SDK)은 **미구현**(별도 작업).
> 기준: [[2026-05-29-monetization-model-recommendation]] · `supabase/functions/revenuecat-webhook/index.ts`

---

## 0. 결정적 전제 (먼저 이해할 것)

1. **상품 ID는 DB와 정확히 일치해야 한다.** 스토어·RevenueCat에 등록할 상품 ID = `diamond_products.product_id` 6개. 한 글자라도 다르면 웹훅이 `product_not_found`로 거부.
2. **다이아 지급량은 서버(DB)가 결정한다.** 클라이언트/스토어 가격이 아니라 `diamond_products` 행을 신뢰. → 스토어 가격을 DB와 맞추는 건 "표시 일관성"용이지, 지급량은 DB가 단일 소스.
3. **RevenueCat `app_user_id` = Supabase 유저 UUID 여야 한다.** 웹훅이 `app_user_id`가 UUID 형식이 아니면 `invalid_app_user_id`로 거부함. RevenueCat 기본 익명 ID(`$RCAnonymousID:...`)는 UUID가 아니므로, 앱이 로그인 시 `Purchases.logIn(supabaseUserId)`를 반드시 호출해야 함 → **이건 Phase 3 클라이언트 구현 몫**. 외부 설정만으로는 안 됨.
4. **상품 유형 = 소모성(Consumable).** 다이아는 쓰면 없어지므로 구독/비소모성 아님.
5. **번들 ID (production)**: iOS `com.uniqn.mobile` / Android `com.uniqn.mobile`.

---

## 1. 등록할 상품 6종 (모든 콘솔 공통)

| 상품 ID (정확히) | 스토어 가격 | 지급 다이아 | 보너스 |
|---|---|---|---|
| `uniqn_diamonds_1000` | ₩1,000 | 3 | 0 |
| `uniqn_diamonds_3000` | ₩3,000 | 10 | 0 |
| `uniqn_diamonds_10000` | ₩10,000 | 33 | +2 |
| `uniqn_diamonds_30000` | ₩30,000 | 100 | +10 |
| `uniqn_diamonds_50000` | ₩50,000 | 167 | +23 |
| `uniqn_diamonds_100000` | ₩100,000 | 333 | +67 |

> 가격은 현재 DB 시드 기준. 바꾸려면 DB(`diamond_products`)와 스토어 둘 다 수정.

---

## 2. App Store Connect (iOS)

1. **App Store Connect** → 해당 앱(`com.uniqn.mobile`) → **수익 창출 → 앱 내 구입(In-App Purchases)**.
2. **+** → 유형 **소모성(Consumable)** 선택.
3. 6개 각각 생성:
   - **제품 ID**: 위 표의 `uniqn_diamonds_XXXX` (정확히).
   - **참조 이름**: 자유 (예: "다이아 3개").
   - **가격**: 한국 ₩ 티어 선택 (위 표 가격).
   - **현지화(한국어)**: 표시 이름/설명 작성 (심사 필수).
   - **심사용 스크린샷**: 충전 화면 캡처 (Phase 3 화면 나온 뒤).
4. **유료 앱 계약(Paid Apps Agreement)** 활성 + **세금/은행 정보** 입력 (이게 없으면 IAP 자체가 동작 안 함).
5. **App-Specific Shared Secret 발급**: 앱 → 수익 창출 → App 정보 → "앱 전용 공유 비밀" 생성 → **복사** (RevenueCat에 입력, 3번 단계에서 사용).
6. (샌드박스 테스트용) **Sandbox 테스터 계정** 생성: 사용자 및 액세스 → Sandbox.

## 3. Google Play Console (Android)

1. **Play Console** → 앱(`com.uniqn.mobile`) → **수익 창출 → 제품 → 인앱 상품**.
   - ⚠️ 인앱 상품 메뉴가 보이려면 앱이 한 번이라도 (내부 테스트 트랙 등에) 업로드되어 있어야 함.
2. **상품 만들기** → 6개 각각:
   - **상품 ID**: `uniqn_diamonds_XXXX` (정확히, 생성 후 변경 불가).
   - **이름/설명**: 한국어.
   - **가격**: ₩ (위 표).
3. **결제 프로필** 등록 (판매자 계정/세금).
4. **서비스 계정 키(JSON) 발급** — RevenueCat이 구글 결제 검증에 사용:
   - Google Cloud Console → 해당 프로젝트 → 서비스 계정 생성 → JSON 키 다운로드.
   - Play Console → 설정 → API 액세스 → 그 서비스 계정에 권한 부여(재무 데이터 보기 + 주문 관리).
5. (테스트용) **라이선스 테스터** 등록: 설정 → 라이선스 테스트에 테스트 Gmail 추가.

## 4. RevenueCat 대시보드

1. **계정/프로젝트 생성** → 프로젝트 이름 "UNIQN".
2. **앱 2개 추가**:
   - **Apple App Store** 앱: 번들 ID `com.uniqn.mobile` + **App-Specific Shared Secret**(2-5에서 복사) 입력.
   - **Google Play Store** 앱: 패키지 `com.uniqn.mobile` + **서비스 계정 JSON**(3-4) 업로드.
3. **Products** → 위 6개 `product_id`를 import/등록 (각 스토어에서 자동 가져오기 가능).
4. **Offerings** → 기본 offering 1개 생성 → 6개 product를 package로 추가.
   - (Phase 3 클라이언트가 이 offering을 읽어 충전 시트를 그림.)
5. **API Keys** (Project Settings → API Keys → **Public app-specific keys**):
   - **Apple 키** (`appl_...`) 복사.
   - **Google 키** (`goog_...`) 복사.
   - → 이 두 개를 앱 환경변수로 넣음 (5번 표 참고). **Secret key가 아니라 public SDK key**를 사용.

## 5. RevenueCat 웹훅 + Supabase 시크릿

1. **웹훅 시크릿 문자열을 하나 정한다** (랜덤 긴 문자열, 예: `openssl rand -hex 32`).
2. **RevenueCat → Project Settings → Integrations → Webhooks**:
   - **URL**: `https://<프로젝트레프>.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header**: `Bearer <위에서 정한 시크릿>` (정확히 `Bearer ` 접두어 포함)
   - 환경: Production + Sandbox 둘 다.
3. **Supabase에 같은 시크릿 등록** (Edge Function이 이 값으로 인증):
   - Supabase Dashboard → Project Settings → Edge Functions → **Secrets** → `REVENUECAT_WEBHOOK_SECRET` = (같은 값).
   - (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`는 기본 제공되므로 추가 불필요.)

---

## 6. 정리: 발급/입력해야 하는 키·시크릿

| 항목 | 발급처 | 들어가는 곳 |
|---|---|---|
| App-Specific Shared Secret | App Store Connect | RevenueCat (Apple 앱 설정) |
| 서비스 계정 JSON | Google Cloud / Play | RevenueCat (Google 앱 설정) |
| RevenueCat Apple public SDK key (`appl_...`) | RevenueCat | 앱 env: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (이름은 Phase 3 구현 때 확정) |
| RevenueCat Google public SDK key (`goog_...`) | RevenueCat | 앱 env: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| 웹훅 시크릿 (직접 생성) | 직접 | RevenueCat 웹훅 헤더 + Supabase secret `REVENUECAT_WEBHOOK_SECRET` |

> ⚠️ EAS OTA 시 `EXPO_PUBLIC_*`는 shell env만 평가됨 → app.config.ts에 공개 fallback 상수 필요. (메모리 `pitfall_eas_update_shell_env_not_loaded`)

---

## 7. 검증 (샌드박스)

1. Phase 3 클라이언트 + RC 키가 들어간 **EAS dev/preview 빌드** 필요 (Expo Go 불가 — 네이티브 모듈).
2. iOS Sandbox 계정 / Android 라이선스 테스터로 로그인 후 충전 시도.
3. 결제 성공 → RevenueCat 대시보드에 이벤트 → 웹훅 발사 → Supabase `wallet_ledger`에 row 생성 → 앱 잔액 증가 확인.
4. 디버깅: Supabase → Edge Functions → `revenuecat-webhook` → Logs 확인. RevenueCat → Webhooks → 전송 로그(응답 코드).
   - `401 unauthorized` → 시크릿 불일치.
   - `invalid_app_user_id` → `Purchases.logIn(supabaseUid)` 누락 (Phase 3 구현 문제).
   - `product_not_found` → 상품 ID 오타.

---

## 8. 지금 당장 vs 나중

- **추천안(2026-05-29) 기준**: 출시 1순위는 양면 채우기. 과금 스위치(`app_config.monetization.paid_types`)는 **반복 고용주 코호트 관측 후** ON. → 위 외부 설정은 "실제 결제를 켤 때" 필요.
- **순서 의존성**: 1~5 외부 설정은 지금 해둘 수 있으나, **검증(7)은 Phase 3 클라이언트 구현이 머지된 뒤**에만 가능. 외부 설정과 Phase 3 구현은 병행 가능.
