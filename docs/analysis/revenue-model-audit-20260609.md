# UNIQN 수익모델 전체 분석 (2026-06-09)

> ⛔ **폐기 (2026-06-22~23)** — 이 분석이 전제한 이중통화(하트·다이아) 지갑 + RevenueCat 인앱결제
> 수익 시스템은 PR #196~206 으로 **코드·DB·RevenueCat 대시보드까지 전량 제거**됐다.
> 아래 본문의 현재형 서술과 리스크 항목은 **현행 제품에 존재하지 않는다.**
> 제거 경위: `docs/archive/wallet-iap-removal/`. 현행 수익모델 판단은 `wiki/` 를 우선 확인하라.
> 과거 의사결정 배경을 확인할 때만 참고한다.

> 9개 차원 병렬 감사(A1 DB정합성·A2 가격/게이트·A3 IAP/RevenueCat·A4 하트적립·A5 UI/UX·A6 아키텍처·A7 보안·A8 환불/머니정확·A9 비즈니스/전략) → 종합 → 적대적 코드대조 검증.
> 검증 신뢰도: 적대검증 단계에서 Supabase MCP로 **프로덕션 직접 쿼리**(`app_config.monetization`, `wallet_ledger` reason 집계, `has_function_privilege`, `list_migrations`)로 핵심 주장을 실측 확정.

---

## 1. 한눈에 보는 결론 (TL;DR)

**현 상태**: 수익 시스템(이중통화 + IAP + 공고 차감 + 환불 + 적립)은 **백엔드/Edge/DB가 ship-ready로 빌드·하드닝·prod 적용까지 완료됐으나, 서버 `app_config.monetization` 설정으로 전 공고 비용이 0(무료)인 "이중(사실상 4중) 게이트 휴면" 상태이며 실매출 0·실구매 ledger 0행으로 미출시**다.
- "feature flag OFF"는 부정확 — 실제 prod 시드는 `enabled:true`이고, 무료를 만드는 건 `paid_types` 4종 전부 `false` **AND** `rollout_percentage:0`의 이중 잠금(+`enabled`·`paid_types` 조기 return 포함 사실상 4중 차단).
- **prod `wallet_ledger` 실측 = grant_signup 11행 + grant_daily_attendance 1행이 전부.** purchase/consume/refund/expire/first_purchase_bonus 전부 0행.

**가장 시급한 리스크 Top 3**:
1. **[P1-금전] 하트→다이아 환불 세탁** — 무료·90일만료 하트로 공고 게시 후 취소하면 영구·유료 다이아로 환전되는 통화 무결성 구조 구멍. 유료화 ON 즉시 "매일 출석 하트 → 게시 → 24h내 취소" 무한 무료 다이아 비축 악용. (`20260602000010_refund_idempotency_lock.sql:88,96` + 의도주석 `20260427000700:66`). 현재 게이트 OFF·consume 0건이라 휴면이나 **ON 전 반드시 수정.**
2. **[P0-전략] 다이아 = Consumable IAP 자진 진입 → 스토어 15~30% 세금 + BEP 낙관** — B2B 구인 결제를 게임형 가상화폐로 모델링해 카드 후불(PortOne) 경로를 스스로 봉인. BEP가 15% 수수료 가정(470건/월)이나 기본 IAP는 26~30%.
3. **[P1-심사] App Store IAP 심사 리스크** — `PurchaseSheet`에 결제·환불 고지·약관(EULA)/개인정보 링크·복원(Restore) 전무(제출용 목업엔 존재). 가이드라인 3.1.1/3.1.2 반려 가능.

**보조 결론**: 머니-크리티컬 경로(consume/credit/refund)는 `FOR UPDATE` + drift guard + 멱등 + DML REVOKE 하드닝으로 견고하며 **prod 라이브로 봉쇄 확인**. 출시 차단의 본질은 코드 결함이 아니라 (a) 외부 RC·스토어·secret 설정, (b) 게이트 ON 시 충전 진입로 부재, (c) 무료-하트 경로 drift + 환불 세탁 잠복결함, (d) IAP 30% 전략 리스크다.

---

## 2. 현상황 — 수익모델 구조

### 2.1 통화모델 (이중통화)
| 통화 | 성격 | 만료 | 적립/획득 | 소비 |
|---|---|---|---|---|
| **하트(💖)** | 무료 재화 | **90일**(lot 단위, FIFO) | 가입 +10 / 일일출석 +1 (그 외 4종 미구현) | 공고 차감 시 **우선 소비**(다이아 폴백) |
| **다이아(💎)** | 유료 재화 | **영구(무만료)** | IAP 충전 6종 + 첫충전 보너스 +5 | 하트 소진 후 차감 |

### 2.2 수익원 인벤토리
- **공고 게시 차감**: regular 1💎(하트우선) / urgent 10💎(≈₩3,000) / fixed 5💎(≈₩1,500) / tournament 0💎(영업미끼)
- **다이아 충전(IAP)**: 6종 SKU — ₩1,000=3💎 / ₩3,000=10💎 / ₩10,000=33+2💎 / ₩30,000=100+10💎 / ₩50,000=167+23💎 / ₩100,000=333+67💎 (기본 ~₩300/💎, 대용량 볼륨 디스카운트 ↑20%)
- **첫충전 보너스**: +5💎(RPC 하드코딩)
- **(설계만)** featured/부스트, 공고 연장(extend)/업그레이드(upgrade), 대회사 B2B 구독·패키지, 스태프 직접과금, 채용성사 take-rate

### 2.3 데이터 모델
- `wallets` — 잔액 캐시. CHECK ≥0. **트리거만 갱신**(단일 writer).
- `wallet_ledger` — **append-only 원장**(SSOT). reason enum 14종. `revenuecat_transaction_id UNIQUE`(멱등). `balance_after_*` 감사 스냅샷.
- `heart_lots` — 하트 lot 단위 만료 추적. FIFO 소비.
- `diamond_products` — IAP SKU 카탈로그 6종.
- `app_config.monetization` — 게이트 설정 row(JSON).

### 2.4 결제 게이트 상태 (prod 직접 쿼리 실측)
```
app_config.monetization = {
  enabled: true,
  paid_types: { regular:false, urgent:false, fixed:false, tournament:false },  ← 차감 차단 (1차)
  rollout_percentage: 0,                                                       ← 차감 차단 (2차)
  show_purchase_ui: true,                                                      ← 클라 미소비(데드코드)
  first_purchase_bonus_diamonds: 5                                            ← RPC 안 읽음(하드코딩 5)
}
wallet_ledger = grant_signup 11행 + grant_daily_attendance 1행 (그 외 reason 0행)
Edge Fn revenuecat-webhook = v8 ACTIVE (배포 소스 = repo 하드닝본 동일)
하드닝 마이그레이션 전건 prod 적용 확인 (list_migrations 실측)
```

### 2.5 흐름도
```
[충전]  사용자 → PurchaseSheet → RC purchasePackage → 스토어결제 → RC 웹훅
        → revenuecat-webhook(Edge, secret/환경 화이트리스트 검증) → credit_diamonds_atomically
        → wallet_ledger INSERT(+다이아) → balance 트리거 → wallets 캐시 → 클라 폴링 감지

[차감]  공고작성 → create_job_posting_with_payment_atomically
        → _calc_posting_cost(게이트: enabled/paid_types/rollout) → [현재 cost=0]
        → cost>0이면 consume_diamonds_atomically(하트 FIFO 우선 → 다이아 폴백)
        → ledger INSERT(음수) → 트리거 → wallets

[적립]  가입(handle_new_user 트리거 +10) / 출석(claim_daily_attendance +1)
        → grant_heart_atomically → heart_lots(+90일) + ledger → 트리거 → wallets

[환불]  공고취소 → refund(24h<100% / 이후 50%, FLOOR) → 항상 다이아로 적립 → ledger → 트리거

[만료]  cron '0 15 * * *'(KST 자정) → fn_expire_heart_lots → 만료 lot 소각(ledger 음수)
```

---

## 3. 현재 있는 기능 인벤토리 (구현 상태)

| 기능 | 상태 | 근거(file) | 비고 |
|---|---|---|---|
| 공고 비용 산출(SSOT) | ✅완료 | `_calc_posting_cost` `20260530000001`/`20260605000020` | 표시·과금 동일 함수, 클라 하드코딩 0건 |
| 공고생성+차감(원자) | ✅완료 | `create_job_posting_with_payment_atomically` | 단일 RPC, UUID 멱등키 — **모범적** |
| consume(FIFO+drift guard+멱등) | ✅완료 | `20260530000003` | 하트 FIFO + 음수 차단 + 부분 UNIQUE 멱등 |
| credit(충전 RPC) | ✅완료 | `credit_diamonds_atomically` | service_role 전용, FOR UPDATE |
| 첫충전 보너스 +5💎 | ✅완료 | `20260605000000:58` | **RPC 하드코딩 5**(config 미반영, P3) |
| 환불 보너스 클로백 | ✅완료 | `20260605000000:111-122` | net lifetime, 이중클로백 방지 |
| 공고취소+환불 | 🟡부분 | `JobPostingRepository.ts:467-512` | **비원자·재시도 없음**(P1) |
| 적립 grant_signup(+10) | ✅완료 | `handle_new_user` 트리거 + backfill | prod 11행 방증 |
| 적립 grant_daily_attendance(+1) | ✅완료 | `claim_daily_attendance` + `profile.tsx:191` | 풀스택 완결(버튼까지), prod 1행 |
| 적립 streak/review/referral/admin | ⛔스텁 | enum + `wallet.ts:23-26`만 | **생산자 0건(죽은 enum)** |
| 하트 만료 cron | ✅완료 | `fn_expire_heart_lots`+`cron.schedule` | pg_cron 의존(P3) |
| extend/upgrade(연장·업그레이드) | 📄설계만 | `wallet.ts:16-17` IN-리스트만 | CASE 분기·가격 없음(P2) |
| RC 세션 init | ✅완료 | `useRevenueCatSession.ts`, `AuthenticatedRuntime.tsx` | uid=Supabase UUID |
| 구매 서비스/훅(폴링) | ✅완료 | `purchasesService.ts`+`.web.ts`, `usePurchaseDiamonds.ts` | `react-native-purchases ^10.2.0` |
| RC 웹훅(멱등·인증·환경게이트) | ✅완료(v8 LIVE) | `webhook/index.ts`, `eventClassifier.ts` | 상수시간 비교 + 화이트리스트 fail-closed |
| 잔액 배지 UI | ✅완료 | `WalletBalanceBadge.tsx`, `profile.tsx:189`, `create.tsx:99` | 홈/헤더 상시노출 없음 |
| 충전 시트(PurchaseSheet) | 🟡부분 | `PurchaseSheet.tsx` | 로딩/에러/폴링 견고, **보너스 비가시·footer/약관 부재** |
| 페이월(PaywallModal) | ✅완료 | `PaywallModal.tsx`, `create.tsx:158` | 하트+다이아 합산 결제력 |
| **지갑 거래내역(ledger) 화면** | ⛔미구현 | `app/**/*wallet*`·`*ledger*` = 0건 | 결제통화인데 이력조회 전무(P2) |
| 독립 충전 진입로(지갑 카드 CTA) | ⛔미구현 | `openPurchaseSheet` 호출 = `create.tsx:167` 단 1곳 | "내 지갑" 카드 탭 불가(P2) |
| 클라이언트 DML 방어(REVOKE) | ✅완료(prod) | `20260605000010:12-15` | anon+authenticated 4테이블 회수 |
| owner 바인딩 authz 가드 | ✅완료(prod) | `20260602000001:48-66` | SECDEF 위조 차단 |
| 모네타이제이션 admin 토글 UI | ⛔미구현 | 코드 내 토글 화면 0건 | 수동 SQL 의존(P3) |

---

## 4. 오류·버그 (심각도순)

> 게이트 OFF로 머니 결함 대부분은 **현재 휴면, 유료화 ON 시 즉시 발동**. [ON발동] 표기 = flag 종속.

### P0
- **[P0-전략] IAP 가상화폐 자진 진입 + 30% 수수료 BEP 낙관** — 다이아=Consumable IAP로 Apple/Google 15~30% 세금 강제. design spec BEP 470건/월이 15% 가정(소규모 프로그램 한정)이나 기본 26~30%. B2B 카드 후불 봉인. (전략 결함 — 코드 무관)

### P1
- **[P1-금전, 최우선] 하트→다이아 환불 세탁** [ON발동] — consume은 하트 FIFO 우선 소비하나 환불은 합산액을 **무조건 다이아로 적립**하고 `heart_lots` 미복원. 근거: `20260602000010:88,96`(`'diamond', FLOOR((diamond+heart)*rate)`), 의도주석 `20260427000700:66`. **권고**: 하트분은 신규 heart_lot 복원(만료시각 보존) 또는 환불통화를 결제통화 비례 분리.
- **[P1-아키텍처] 취소+환불 비원자·자동재시도 없음** [ON발동] — 생성은 단일 RPC 원자적인데, 취소는 (1)status update → (2)별개 refund RPC best-effort 호출, 실패 swallow(logger.warn+Sentry만, 재시도 없음). 근거: `JobPostingRepository.ts:467-512`. **권고**: `cancel_job_posting_with_refund_atomically` 단일 RPC 통합 또는 outbox 재시도 큐.
- **[P1-심사] PurchaseSheet 결제·환불 고지·약관 링크 부재** — 목업(`purchase-sheet-mockup.html:121`)엔 footer 있으나 실제 화면엔 결제수단·환불정책·EULA/개인정보·Restore 전무. 근거: `PurchaseSheet.tsx`. **권고**: 시트 하단 고지 + 약관/개인정보 `Linking.openURL` + Restore.
- **[P1-secret, 외부검증] RC 웹훅 secret 운영화 미검증** — `REVENUECAT_WEBHOOK_SECRET`가 RC 대시보드 헤더와 일치하는지, `REVENUECAT_ALLOW_SANDBOX`가 prod에서 false인지 미검증(MCP 불가). 근거: `index.ts:82-94`, `eventClassifier.ts:61-63`. 미설정 시 충전 전면 불능(500 fail-closed) / sandbox=true면 실 발권 누출.
- **[P1-전략] 대회사(최대 ARPU 고객) 과금 설계 0** — tournament=0(미끼)인데 D-7~D-day 버스트 구인용 패키지/후불 정산 경로가 설계 공백. 핵심 수요측 수익화 0.

> ✅ **적대검증으로 해소**: A8이 제기한 "refund 멱등 마이그(`20260602000010`) prod 미적용 → 이중환불 P1 격상" 가능성은 **`list_migrations` 실측으로 전건 적용 확인되어 반증**. 헤더의 "prod 미적용" 주석은 stale. FOR UPDATE 직렬화 + 부분 UNIQUE + ON CONFLICT가 prod 라이브 → 이중환불 위험 현 prod에 부존재.

### P2 (요약)
- **[정합]** grant_heart 무잠금 stale read → `balance_after_heart` 감사컬럼 drift(머니손실 아님, consume이 lot+drift guard 재검증). *(주: `fn_expire_heart_lots`는 heart_lots를 FOR UPDATE 락함 — wallets 스냅샷 읽기만 비락. grant_heart가 진짜 무락.)*
- **[정합]** 재조정(reconciliation) 경로 부재 — drift 발생 시 self-heal 불가, 누적 영구화. 야간 reconcile 잡 권고.
- **[정합]** 일일출석 더블클레임 레이스 — `(user_id, reason, kst_date)` UNIQUE 없이 무잠금 EXISTS. 동시 2회 → +2. partial unique/advisory lock 권고.
- **[정합]** 만료~크론 캐시 over-state 윈도우 — cron 1일 1회, lot 만료 후 최대 ~24h 캐시 과대.
- **[UX, ON종속]** 충전 UI 진입로 단절 — PurchaseSheet 여는 유일 경로=PaywallModal(insufficient_balance 시만). 게이트 OFF→cost=0→페이월 안뜸→충전 도달 불가(ledger 0행 직접 원인). 게이트 켜도 "상시 충전 버튼" 부재.
- **[UX]** `show_purchase_ui` 데드코드 + 독립 충전 진입로 미구현(`2026-05-31-wallet-laneC-revenuecat.md:7` 명시 미구현).
- **[UX]** 지갑 거래내역 화면 전무 + 내지갑 카드 탭 불가(`profile.tsx:183-202` onPress 없음).
- **[UX]** 보너스 다이아 비가시 — `PurchaseSheet.tsx:123` total 합산 단일표시(목업은 "+2 보너스" 분리+배지). 상위 패키지 전환 유인 상실.
- **[아키텍처, ON종속]** 취소 mutation이 `wallet.summary` invalidate 누락(`useJobManagement.ts:192-202`) → 환불 후 잔액 5분 stale.
- **[아키텍처]** wallet 도메인 snake_case가 Presentation 누출(`WalletSummarySchema` → `WalletBalanceBadge.tsx`) — camelCase 규칙 위반.
- **[아키텍처, ON종속]** INSUFFICIENT_BALANCE 문자열 매칭 의존(`JobPostingRepository.ts:394`) → RPC가 SQLSTATE로 바꾸면 무성 파손.
- **[정합]** WalletSummary strict Zod(`.catch()`/`.default()` 부재) → RPC shape drift 시 read-증발(`pitfall_enum_divergence_read_disappearance` 재발 클래스).
- **[보안]** 웹훅 시크릿 = 무제한 다이아 발권의 단일 신뢰경계. RC payload `app_user_id` 전적 신뢰. 유출 시 임의계정 무한 다이아.
- **[금전, ON종속]** 보너스 소진 후 전액환불 = 클로백 floor 미회수(`20260605000000:118`) → 5💎 무료 취득 가능.
- **[금전/감사]** `balance_after_diamond` CHECK 부재 → 음수 저장, 트리거 GREATEST(0) 마스킹 → SUM(delta)와 발산(append-only는 유지).
- **[의존성]** OTA RC키 fallback 부재(`app.config.ts`) → 키 미export 셸서 OTA 시 무성 no-op(`pitfall_eas_update_shell_env_not_loaded`).
- **[전략]** featured/boost 코드 부재(`is_featured` ISSUE-003에서 제거) — 시장표준 핵심 수익원 공백.
- **[전략]** extend RPC 멱등성 결함(Lane D #160 DRAFT, 미적용) — 적용 시 "무한 무료 연장" 발동, 적용 전 수정 필수.

### P3 (요약)
pg_cron 미설치 시 만료 영구 누수 / concurrent 동일-ref consume unhandled unique_violation / 다이아 가격 DB↔RC 이중소스 드리프트 / 모네타이제이션 admin 토글 UI 부재 / 첫충전 보너스 설정 decouple(하드코딩 5) / 결제완료 haptic 전무 / a11y 라벨·min-h-[44px] 미보장 / 가격 폴백 미포맷("1100원") / consume·refund Service 우회(쓰기) / WalletRepository "(read-only)" 라벨 stale / FORCE RLS 미적용(의도적 보류, 재평가 권고) / 환불율 공고종료일·"만료직전" 무인지 / 레거시 전략문서 4종 소실(git 복원 권고).

---

## 5. 정합성(integrity) 이슈

### 5.1 DB 원장/캐시/lot 3자 정합
- **머니-크리티컬 경로 견고**: cache 단일 writer=트리거, consume/credit/refund 전부 `FOR UPDATE` 직렬화, drift guard(`v_remaining > diamond_balance`)가 cache 인플레 상태서도 over-debit 차단, CHECK ≥0. 우회 경로 미발견.
- **무료-하트 경로 취약**: grant_heart 무잠금 → cache drift. **reconcile 부재로 self-heal 불가** — drift 영구화.
- **FIFO 만료소비 정확**: `expires_at > now` + `ORDER BY expires_at ASC`(`20260530000003:70-71`).
- **append-only 준수**: wallet_ledger UPDATE/DELETE 0건, 환불=양수 row, 클로백=음수 row. 단 balance_after 음수 마스킹으로 감사 재구성 발산.

### 5.2 타입↔RPC 정합
- 읽기 strict Zod 위험(WalletSummary `.catch()` 부재) → read-증발. CreatePostingPaymentResult failure 변형 부재(RefundResult와 비대칭).
- 쓰기 변환 일관(`toSnakeCase(removeUndefined(serialized))`). 읽기 변환 누락(wallet read toCamelCase 미적용 → snake_case 누출).

### 5.3 enum 정합
- **DB enum 14종 = `wallet.ts` 14종 완전 일치**.
- **죽은 reason 6종**: streak_7d/review/referral/admin(적립 4) + consume_job_extend/upgrade(차감 2). enum/타입/IN-리스트에만 존재, 실행 0건.

### 5.4 레이어 정합
- **읽기 4계층 정합 ✓**: Presentation→Hook→Service→Repository→RPC. Hooks/Presentation supabase 직접호출 **0건**.
- **쓰기 비대칭**: consume/refund가 Service 우회 Repository orchestration. **원자성 비대칭**: 생성 단일 RPC ✓ vs 취소 2단계 비원자(P1).

---

## 6. 의존성 리스크

| 의존성 | 상태 | 리스크 |
|---|---|---|
| **RevenueCat 대시보드** | 외부·미검증 | 앱·6 product·offering/package/entitlement 구성 미확인(ledger 0행이 미가동 방증) |
| **RC 웹훅 secret** | 미검증(MCP불가) | 미설정 시 충전 불능(500), 불일치 시 발권 불가 |
| **REVENUECAT_ALLOW_SANDBOX** | 미검증 | prod에서 true면 sandbox가 실 발권 |
| **App Store/Play IAP 6종** | 외부·미생성 추정 | 소비성 `uniqn_diamonds_*` 생성·승인 + RC 매칭. 누락 시 PurchaseSheet 버튼 침묵 disabled |
| **react-native-purchases** | ✅설치(^10.2.0) | **네이티브 모듈 — 최초 활성화는 EAS 빌드 필수(OTA 불가)** |
| **EAS env / OTA 키** | 리스크 | RC키 `app.config.ts` fallback 부재 → OTA 무성 no-op |
| **pg_cron** | 런타임 미검증 | 미설치 시 만료 영구 누수 |
| **prod 마이그레이션 적용** | ✅확인됨 | `list_migrations` 실측 — 하드닝 전건 적용(refund_idempotency_lock 포함) |

> ⚠️ **차원 상충 해소**: A9의 "다이아 충전 클라 미구현·react-native-purchases 미설치"는 **stale `implementation-gap.md` 의존**. A3가 prod 직접 검증(패키지 설치·웹훅 v8 ACTIVE·시트/훅 배선 완료)으로 반증. A9의 "하트 적립 루프 미배선"도 A4가 `profile.tsx:191` + `handle_new_user` 트리거 풀스택 체인으로 반증(signup/daily 완료, 미배선은 streak/review/referral/admin 4종뿐). 단 A9의 전략 논점("차감 ON 전 적립 선행 보장")은 유효.

---

## 7. UI/UX 평가

### 강점
- **다크모드 완비**: 전 wallet 컴포넌트 정적 `dark:` 적용, 동적 className 유실 0.
- **로딩/에러/빈/폴링 상태 견고**: skeleton + `accessibilityRole="progressbar"`, "다시 시도", 이중탭 차단.
- **잔액부족→충전 전환 매끄러움**: dead-end 아님, 페이월→PurchaseSheet 연결 정상. 하트+다이아 합산 결제력.
- **만료 임박 경고**: BalanceBadge 인라인 "D-{n} 만료".

### 약점
- [P1] IAP 심사 고지/약관 부재.
- [P2] 지갑 거래내역 화면 전무 + 능동 충전 진입점 없음.
- [P2] 보너스 비가시 + best-value 배지 없음 → 상위 패키지 전환 저해.
- [P3] haptic 전무 + a11y 라벨 부재 + 가격 폴백 미포맷 + min-h 미보장.
- 잔액 노출 묻힘(프로필·공고작성 2곳뿐, 홈/헤더 상시노출 없음).

### 점수
- **UI: 7/10** (다크모드/상태처리 견고, 보너스강조·footer·포맷 감점)
- **UX: 5/10** (전환 동선 매끄러우나 ledger 화면 전무·능동 충전 부재·보너스 비가시·IAP 고지 미흡 결정적 감점)

---

## 8. 개선점 (우선순위 로드맵)

### 단기 (출시 전 필수)
1. **하트→다이아 환불 세탁 봉쇄** — 하트분 신규 lot 복원 또는 통화 비례 분리. (P1)
2. **취소+환불 단일 RPC 원자화** 또는 outbox 재시도 큐. (P1)
3. **PurchaseSheet 결제·환불·약관/개인정보 footer + Restore 버튼.** (P1, 심사)
4. **웹훅 secret 운영화 검증**(로테이트 + ALLOW_SANDBOX false) + **anon RPC 거부 회귀 스모크.** (P1)
5. **grant_heart FOR UPDATE + 일일출석 KST 멱등 UNIQUE + 야간 reconcile 잡.** (P2, flag ON 전)
6. **게이트 ON 시 충전 진입로 구현** — 지갑 카드 CTA + 상시 "충전" 버튼 + ledger 거래내역 화면. (P2)
7. **app.config.ts RC키 fallback 상수** + OTA env 명시 export. (P2)
8. **DB↔RC↔스토어 3자 가격 정합 검증** + RC offering 6종 등록. (P3)

### 중기
- WalletSummary 읽기 Zod `.catch()` 방어 + INSUFFICIENT_BALANCE SQLSTATE 계약 + 취소 mutation `wallet.summary` invalidate.
- 보너스 다이아 분리 강조 + best-value 배지 + haptic + a11y 라벨 + 금액 포맷.
- 하트 적립 funnel 보강(streak/referral/admin 생산자 — 리텐션·바이럴·CS 보상). grant_admin 운영 공백 우선.
- 모네타이제이션 admin 토글 화면(수동 SQL 부분변경 사고 방지).
- balance_after 음수 마스킹 → 원장 재구성 정합(회계감사).
- wallet 도메인 toCamelCase 변환.

### 장기
- **모델 재프레이밍** — 고용주(B2B) 과금을 PortOne 카드 건당/패키지 1급 경로로, 다이아 선불은 선택지로 강등(IAP 30% 회피 + 단발 마찰 제거).
- **대회사 B2B 패키지/후불 + featured 부스팅 설계** — `is_featured` 재도입부터. 최대 ARPU 수익화.
- **인재 다이렉트 제안/검색**(고용주→스태프 역제안 차감) 신규 수익원.
- FORCE RLS 재평가 + reconcile 자동화 + 협업해제 시 JPC 정리.

---

## 9. 더 필요한 것 (미구현·신규 제안)

### 빠진 수익원/기능
1. **대회사 B2B 패키지/후불** (최우선) — "대회 1건=정액 패키지(공고 N건+우선노출+대시보드)" 또는 세금계산서 후불이 다이아 선불보다 압도적 적합. 현재 최대 ARPU 잠재고객 과금 0.
2. **노출 부스팅(featured/boost)** — 알바몬 프리미엄 등 시장표준 핵심 수익원. `is_featured` 제거로 코드 0.
3. **인재 다이렉트 제안/검색** — 고용주→스태프 역제안 차감. 지불의사 높음, 미설계.
4. **매장 월 구독(Track B)** — 상시운영 홀덤펍 상위 코호트. 보류 타당하나 데이터로 시점 판단.
5. **공고 연장/업그레이드** — enum만 예약, 출시 범위 결정 필요.

### 비즈니스·전략 (타깃 = 홀덤펍 단발구인 + 대회사 집중구인)
- **모델 방향성은 옳다**: 공급(스태프) 영구 무료 + 수요(고용주) 사용량 과금 + 구독 보류는 단발/버스트 양면마켓에 타당.
- **수단이 부적합**: 이중통화(다이아 선불)는 게임/콘텐츠 패턴이지 B2B 구인 패턴이 아니다. 단발 사장에게 "urgent 1건(₩3,000) 위해 최소 ₩3,000 다이아팩 선불 구매"는 전환율을 깎는 마찰(잔액 死藏·미사용 환불요구·이탈). 정답은 "그 1건만 PortOne 카드 즉시 결제".
- **가격은 적정~약간 저가**: urgent ₩3,000은 알바보드 부스트(₩7,700~수만원) 대비 저가. 진짜 리스크는 sticker shock이 아니라 (a)무료경쟁(당근알바) 대비 차별화 부재 시 지불의사 0, (b)IAP 차감 후 net 박해짐. **가격 적정성 < 공급 유동성(moat)이 선행 변수.**
- **데이터 먼저**: 과금 스위치보다 "반복 고용주 코호트"(동일 고용주 3회+ 게시율, 지원→confirmed 전환율) 측정 대시보드 선행. urgent 롤아웃 ON 시점의 유일한 근거.

### IAP 30% 수수료 정책 리스크
- 다이아=Consumable IAP 모델링이 15~30% 스토어 세금 자초. BEP 470건/월이 15% 가정(소규모 사업자 프로그램 한정)이나 기본 26~30% → BEP 약 18% 상향.
- 회피하려면 모델 자체 재프레이밍 필요: 가상화폐 형태인 한 IAP 강제(Apple 3.1.1). "다이아 묶음"이 아니라 **"B2B 구인서비스 건당 청구"**로 프레이밍해야 PortOne 카드 외부결제 정당화(실물 인력중개 = 알바몬/사람인 모델). 한국 인앱결제강제금지법 있으나 스토어가 여전히 ~26% 청구해 net 개선 제한적임을 BEP에 반영.
- **권고**: (a) 고용주 B2B 과금 PortOne 카드 분리 검토, (b) BEP를 30% 가정으로 보수 재산정, (c) 무료기간 내 공급 유동성 KPI 미달 시 과금 ON 보류 룰 명문화.

---

## 10. 출시(Go-Live) 체크리스트

**가격/게이트**
- [ ] `app_config.monetization` 이중 변경: `paid_types.{urgent,fixed}=true` **AND** `rollout_percentage>0`(단계출시 점증)
- [ ] DB `diamond_products.price_krw` ↔ RC offering ↔ 스토어 콘솔 3자 가격 정합 검증
- [ ] extend/upgrade 출시범위 결정 / BEP를 IAP 30% 가정으로 재산정 + ON 보류룰 명문화

**웹훅/RC 배포**
- [ ] `REVENUECAT_WEBHOOK_SECRET` edge secret 설정 + RC 헤더 일치
- [ ] `REVENUECAT_ALLOW_SANDBOX` prod 미설정/false 확인
- [ ] RC 대시보드: 앱·6 product·offering/package·entitlement 구성
- [ ] 환불이벤트가 `credit_diamonds_atomically(p_diamonds<0)` 호출하는지 검증

**스토어 IAP**
- [ ] 스토어 소비성 IAP 6종(`uniqn_diamonds_*`) 생성·승인
- [ ] `react-native-purchases` 포함 네이티브 빌드 스토어 제출(OTA 불가)
- [ ] app.config.ts RC키 fallback 상수 추가

**sandbox/스모크**
- [ ] Sandbox e2e: 실구매→웹훅→credit→폴링→잔액
- [ ] 유료화 ON E2E: 하트우선 차감→페이월→충전 도달→환불 24h/50% 라이브 스모크
- [ ] anon 키로 credit/consume/grant/get_wallet_summary 직접호출 42501 거부 회귀

**보안/정합 (ON 전 필수)**
- [x] prod 마이그레이션 전 세트 적용 — `list_migrations` 실측 완료(refund_idempotency_lock·grants_hardening_p0·clawback·dml_revoke·hashtext fix·drop_dup_policies 전건 적용)
- [ ] 하트→다이아 환불 세탁 봉쇄(P1)
- [ ] 취소+환불 원자화/재시도(P1)
- [ ] grant_heart FOR UPDATE + 일일출석 멱등 UNIQUE + reconcile 잡(P2)
- [ ] 하트 적립 루프 ON 순서(적립→잔액표시→차감 강제)

**UI/약관**
- [ ] PurchaseSheet footer(결제수단·소비성·환불정책) + EULA/개인정보 링크 + Restore
- [ ] 독립 충전 진입로(지갑 카드 CTA) + ledger 거래내역 화면
- [ ] 보너스 다이아 분리 강조 + 결제완료 haptic + a11y 라벨

---

## 11. 차원별 점수 요약

| 차원 | 점수 | 핵심 근거 |
|---|---:|---|
| **정합성 (A1)** | **4/10** | 머니경로 견고하나 무료-하트(grant) 무잠금 drift + reconcile 부재로 self-heal 불가 + 일일출석 멱등갭 |
| **보안 (A7)** | **8.5/10** | rev1(#168) P0/P1 라인봉쇄(prod 권한 실측 확정) + DML REVOKE 심층방어. 잔존은 운영성 P2/P3 |
| **금전정확 (A8)** | **6/10** | 멱등·동시성 우수(FOR UPDATE+부분UNIQUE+ON CONFLICT, append-only, FLOOR house유리). 감점: 하트→다이아 세탁(P1)·클로백 floor·음수 마스킹 |
| **UI (A5)** | **7/10** | 다크모드 완비·상태처리 견고. 감점: 보너스강조·footer·포맷 |
| **UX (A5)** | **5/10** | 전환 매끄러움. 감점: ledger 화면 전무·능동충전 부재·보너스 비가시·IAP 고지 |
| **아키텍처 (A6)** | **7.5/10** | 읽기 4계층 정합·생성 단일RPC 원자성·UUID 멱등키·AppError 정규화. 감점: 취소+환불 비원자(P1)·snake_case 누출·문자열매칭 |

**종합 ≈6.3/10** — 보안·아키텍처 ship-ready, 정합성(무료경로 drift)·UX(충전 동선/ledger 부재)가 최대 약점.

---

## 최종 판단

코드/DB/Edge는 결함성 출시 차단요소 0(rev1이 P0/P1 봉쇄, prod 권한·마이그레이션 실측 확정)으로 **빌드 완료·이중 게이트 휴면·미출시** 상태가 정확하다. 출시 차단의 실체는 (1) 외부 RC·스토어·secret 설정, (2) 게이트 ON 시 충전 진입로/ledger 화면 부재, (3) 무료-하트 경로 drift + 하트→다이아 환불 세탁 잠복결함, (4) IAP 30% 전략 리스크다.

**미출시인 지금이 (a) 환불 세탁·취소 원자성·drift를 ON 전 봉쇄하고, (b) 모델을 "다이아 선불"에서 "고용주 건당 카드결제 + 대회사 패키지"로 재정렬할 최적 시점**이다. 단 "cost=0인 지금도 충전(발권) 경로는 라이브"이므로(`monetization-review-findings.md`), 웹훅 secret 검증은 출시 전이 아니라 **즉시** 대상이다.

> **검증된 진성 출시차단 압축**: (a) 외부 RC·스토어·secret 설정, (b) 게이트 ON 전 하트→다이아 세탁·취소 원자성 봉쇄, (c) 충전 진입로/ledger 화면 부재. — 코드/마이그 측은 이미 prod 하드닝 라이브.
