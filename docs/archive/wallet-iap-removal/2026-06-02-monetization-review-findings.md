# 결제/수익모델 적대적 리뷰 결과 — 유료화 롤아웃 前 게이트

> 작성: 2026-06-02 / 기준: master `ac2a06402` / 방식: 9차원 멀티에이전트 fan-out + critical 4차원 적대적 2차 검증(31 에이전트) + 메인 세션 prod ACL 재확인
> 입력 프롬프트: `docs/planning/2026-06-02-monetization-full-review-prompt.md`

## 한 줄 결론

**유료화 ON 불가 (NO-GO).** 게다가 **현재 cost=0 상태에서도 살아있는 prod 보안 구멍 2건**(무인증 통화 발권 + 무인증 잔액 IDOR)이 발견됨 — 이는 유료화 타이밍과 무관하게 즉시 차단 대상. 원장/환불/충전 핵심 로직은 견고하나 권한(GRANT) 하드닝 누락 + 환불 동시성/관측성 + Lane D 적용 게이트가 ON 전 필수 해소 항목.

---

## 심각도별 findings (적대적 검증 후 보정 심각도)

### 🔴 P0 — 유료화 ON 전 필수 + 일부는 지금 당장 prod 노출

| ID | 제목 | file:line | 검증 | 비고 |
|---|---|---|---|---|
| **anon-credit-mint** | `credit_diamonds_atomically` anon EXECUTE — 공개 anon 키로 임의 user에 무한 다이아 발권(+첫충전 보너스 5💎까지) | `20260427000400_create_credit_diamonds_rpc.sql:102` (REVOKE PUBLIC,authenticated만) + `20260530000006_wallet_grants_hardening.sql`(credit 누락) | CONFIRMED ×2 + **메인 재확인** | **지금 prod 라이브.** auth 가드 0, SECDEF, p_user_id 신뢰. tx_id 매번 랜덤 주면 멱등 우회 |
| **anon-grant-heart-mint** | `grant_heart_atomically` anon EXECUTE — 무인증 하트 발권(하트는 consume 우선차감 = regular 공고 무료화) | `20260427000500_create_grant_heart_rpc.sql:77` + `20260530000006`(누락) | CONFIRMED ×2 + **메인 재확인** | **지금 prod 라이브.** 일일제한은 `grant_daily_attendance` reason에만 — 임의 reason+대량 amount 우회. *심각도 분기: D1=P0 / D5=P1(cost=0이라 환금처 없음). 수정은 동일 REVOKE이므로 P0 게이트로 취급* |
| **extend-idempotency-free-reextend** | (Lane D #160 DRAFT) extend RPC가 consume 멱등(ref_id=posting)과 충돌 — 첫 연장 후 동일 공고 무한 무료 연장·재오픈 | `20260530100100_create_extend_job_posting_rpc.sql:70-90,96-145` | CONFIRMED | **현재는 미적용이라 prod 무해.** #160 마이그 적용 = 즉시 BLOCKER. 적용 前 반드시 수정 |

### 🟠 P1 — ON 전 필수 (일부 지금 노출)

| ID | 제목 | file:line | 검증 | 비고 |
|---|---|---|---|---|
| **get_wallet_summary-anon-idor** | 무인증 anon이 임의 UUID의 잔액/누적구매액 조회(IDOR) — `v_caller IS NULL` 가드 단락 | `20260427000500_create_grant_heart_rpc.sql:121-135` + anon EXECUTE | PARTIAL→**P1 상향** + 메인 ACL 재확인 | **지금 prod 라이브.** claim_daily_attendance는 auth.uid 가드로 안전(REFUTED) |
| **consume-arbitrary-user-burn** | `consume_diamonds_atomically`가 authenticated 개방 + p_user_id를 auth.uid로 강제 안 함 → 타인 잔액 소각 | `20260530000003_consume_idempotency.sql:14-113` | CONFIRMED | 차감만 가능(자기증식 불가) = griefing. 잔액 보유자 존재 시 즉시 발동 |
| **payment-rpc-owner-not-bound** | `create_job_posting_with_payment`가 p_owner_id를 auth.uid로 검증 안 함 → 타인 비용 결제·공고 위조 | `20260530000002_create_payment_server_cost_calc.sql:12-129` | CONFIRMED | 차감은 cost=0이 게이트하나 **공고 위조는 지금도 실재**. 하드닝 마이그 주석이 "내부 auth 체크로 방어"라 했으나 본문에 없음 |
| **webhook-no-environment-gate** | 웹훅이 `event.environment`(SANDBOX) 미필터 → 테스트 결제로 실 다이아 발권 | `revenuecat-webhook/index.ts:122-196` (58행에 필드 선언만) | CONFIRMED | sandbox/TestFlight 빌드가 prod RC 가리키면 무료 발권. 소프트런치 흔한 누출 |
| **refund-idempotency-no-unique** | 환불 멱등이 잠금없는 SELECT-then-INSERT + refund row UNIQUE 부재 → 동시/재시도 이중환불 | `20260530000005_refund_collaborator_auth.sql:34-42,84-100` | CONFIRMED | paid ON 후 동시취소 시 원금 2배 적립. owner+협업자 둘 다 호출 가능(1s 스로틀 무력) |
| **refund-balance-lost-update** | 환불이 `FOR UPDATE` 없이 wallets 읽음 + 트리거가 RPC 계산값 복사 → 동시 차감/환불 시 캐시 drift | `20260530000005_refund_collaborator_auth.sql:84-100` | CONFIRMED | 캐시가 SSOT와 영구 어긋남 → 과대 시 없는 다이아 소비 허용 |
| **refund-failure-swallow** | 환불 실패 best-effort swallow가 Sentry/재시도/아웃박스 없이 warn만 + `success:false`는 무로깅 통과 | `JobPostingRepository.ts:471-481` | CONFIRMED | 취소 성립+환불 누락이 대시보드에 안 잡힘. RPC 멱등이나 재시도 신호 없음 |
| **show-purchase-ui-dead-flag** | `show_purchase_ui` 플래그가 코드에서 0회 읽힘 — 충전 UI 서버 kill-switch 부재 | `purchaseSheetStore.ts:13`, `PurchaseSheet.tsx:18-22` | (D4, 미검증) | RC 사고 시 서버 플래그로 즉시 차단 불가 |
| **rc-keys-missing-on-master** | RC 공개 SDK 키가 master eas.json에 없음 — 미push 브랜치 `worktree-wallet-rc-env`(ab8d20674)에만 | `eas.json:7-13` vs `ab8d20674` | CONFIRMED | master로 빌드하면 isAvailable()=false → 충전 전면불가. OTA 불가(네이티브). **배포 하드 블로커** |
| **native-dep-eas / webhook-secret-e2e / store-iap-prereq** | EAS 신규빌드 강제·webhook secret e2e 미검증·스토어 IAP/ASC/Play 미연동 시 충전불가 또는 돈만받고 미적립 | `package.json:98` / `index.ts:97-104` / `PurchaseSheet.tsx:83-90` | CONFIRMED | 외부설정 게이트 (아래 체크리스트) |
| **extend-no-monetization-gate** | (Lane D) extend/consume RPC에 server-side flag 가드 부재 → 적용 즉시 무조건 과금 | `20260530100100:70-90` | CONFIRMED | cost=0 불변이 UI 미배선에만 의존, DB 미보장 |

### 🟡 P2 — ON 전 권장 / 정합·관측 부채

- **cancellation-blind-deduct**(→P2): 웹훅이 CANCELLATION/BILLING_ISSUE 일괄 차감 + `cancel_reason` 미검사. *소비성 결제에서 CANCELLATION=환불은 정상(원 주장 일부 REFUTED)*, 진짜 결함은 BILLING_ISSUE/BILLING_ERROR 미구분. `index.ts:38,186-196`
- **refund-amount-by-current-product**: 환불 차감액이 원거래 ledger delta가 아닌 현재 `diamond_products` 값 기준 → 시드 ON CONFLICT 변경 시 drift + 음수 잔액 floor 부재. `index.ts:160-187`
- **refund-keeps-first-bonus**(+5💎): 첫구매 전액환불 후 보너스 5💎 잔존(lifetime 미차감, 계정당 1회 한정). *D2=P1 / D1=P2 분기.* `20260427000400:50-91`
- **refund-heart-to-diamond**: 무료 하트로 낸 비용을 만료없는 다이아로 환불(주석상 의도된 정책, 향후 환금기능 시 abuse). `20260530000005:64-100`
- **wallet-tables-dml-grants**: wallet 4테이블에 anon/authenticated DML GRANT 잔존(현재 RLS default-deny로 차단되나 force RLS off). `20260427000100:6-9`
- **webhook-non-constant-time**: secret `===` 비교 timing-safe 아님(실익 낮음). `index.ts:106`
- **first-purchase-bonus-hardcoded**: 보너스가 플래그 아닌 상수 5💎(SSOT 위반). `20260427000400:52`
- **web-paywall-charge-deadend**: 웹 "충전하기" CTA가 막다른 안내로 연결(전환 누수). `create.tsx:158-169`
- **extend-date-multisource / extend-refund-min-rate**(Lane D): 날짜 권위 컬럼 다중 평행이동 / 환불비율 MIN(consume) 기준. 적용 前 도메인 확정
- **purchase-ui-visible-rollout-zero**: 키없는 빌드에서 충전시트 자기모순 안내. `PurchaseSheet.tsx:21,73-78`

### 🟢 P3 — 백로그

consume 멱등 선조회 락밖(unique 인덱스가 방어) / 폴링 false-timeout(self-heal) / rollout `abs(hashtext)` INT_MIN 편향(2^-32) / display-vs-charge 스냅샷(서버권위라 무손실) / useRevenueCatSession uid변경 logOut 처닝 / refund-rate per-row(dormant) / enum SSOT 수기복제 2벌(현 drift 0)

---

## OK로 확인된 항목 (긍정 검증)

- **원장 멱등/오버드로/만료 로직 자체**: consume `uq_wallet_ledger_consume_ref` + 선조회 가드 + `GREATEST(0,...)` floor 견고
- **충전 멱등성**: 웹훅 `event.id` UNIQUE + 첫충전 보너스 `lifetime=0` 가드로 이중지급 방어
- **플래그 4단 게이트**: enabled→paid_types→rollout%→base 정확. prod `paid_types 전부 false + rollout 0` → **cost=0 이중안전 실측 확인**. 환불은 실제 ledger 합산 기반이라 flag 전환 비대칭 면역
- **웹 안전성**: web 번들에 `react-native-purchases` 네이티브 import 0건(Metro 플랫폼 해상도 + `import type` 소거), isAvailable()=false graceful degrade
- **enum 발산 read 증발**: wallet 도메인은 ledger 직접 read 경로 0건(잔액=캐시 컬럼) + read 필드 전부 `z.string()` → payroll_status류 증발 클래스 구조적 차단
- **types/supabase.ts**: prod 스키마 일치(get_posting_cost 반영, p_cost_diamonds 완전 제거)
- **Lane D DRAFT prod 영향 0**: 마이그 미적용·UI 미배선·라이브 orderBy=work_date 유지. 클라 캐스트는 RPC 시그니처 정확 일치(types 재생성 후 제거 가능)

---

## 유료화 ON 가능 여부 판정: **NO-GO**

ON 게이트 (모두 충족 필요):
1. **P0/P1 보안 하드닝** (아래 Fix-1) — 일부는 cost=0인 지금도 prod 노출이므로 **즉시 권장**
2. **환불 동시성/관측성 P1** (Fix-2) — paid_types ON 전 필수
3. **웹훅 environment 게이트 + secret e2e 검증** (Fix-3)
4. **배포 준비** (Fix-4): rc-env 키 머지 + 신규 EAS 스토어 빌드 + 외부설정 체크리스트
5. **Lane D**: extend P0/P1 해소 전 #160 마이그 **적용 금지**

---

## 외부 설정 / 배포 체크리스트 (사용자 작업)

- [ ] Supabase secret `REVENUECAT_WEBHOOK_SECRET`(bare) 설정 + RC 대시보드 Bearer 동일값 대조
- [ ] App Store Connect IAP 6종(`uniqn_diamonds_*`) 등록 + 가격 + 심사통과
- [ ] Play Console 인앱상품 6종 active
- [ ] RC 대시보드 ASC API키 + Play 서비스계정 연동 (미연동 시 getOfferings 빈목록)
- [ ] RC Offering `default`에 6 패키지 attach 확인
- [ ] `worktree-wallet-rc-env`(ab8d20674) master 머지 (eas.json+.env.example 2파일 11줄, 클린)
- [ ] 신규 EAS production 빌드(store 프로파일) → 스토어 submit → 심사 (OTA 불가, 리드타임 크리티컬 패스)
- [ ] EAS dev build + sandbox 실구매 1회 e2e: 결제→웹훅→credit→잔액 반영 통과 (현재 미수행)
- [ ] 구버전(1.0.2) 보급 전 rollout 상향 금지

---

## 제안 수정 PR 계획 (★ 사용자 승인 후 별도 브랜치 + CI green)

- **Fix-1 (P0/P1 권한 하드닝, DB 마이그)**: 신규 마이그로 `credit_diamonds_atomically`·`grant_heart_atomically`·`fn_expire_heart_lots`·`get_wallet_summary`·`claim_daily_attendance` anon REVOKE + `consume`/`create_payment` 진입부 auth.uid 바인딩 가드 + get_wallet_summary `v_caller IS NULL` 가드 교정 + wallet 4테이블 DML REVOKE/force RLS. pgTAP 회귀. **MCP apply_migration 전용**
- **Fix-2 (환불 동시성/관측성)**: refund ledger 부분 UNIQUE 인덱스 + `ON CONFLICT DO NOTHING`(또는 advisory lock), 환불 `FOR UPDATE`, swallow catch에 Sentry + `success:false` 분기 로깅
- **Fix-3 (웹훅)**: SANDBOX 게이트 + BILLING_ISSUE/cancel_reason 구분 + 상수시간 비교
- **Fix-4 (배포/플래그)**: rc-env 키 머지, `show_purchase_ui` kill-switch 코드 연결(또는 dead config 제거)
- **Lane D 후속**: #160 적용 前 extend 멱등(P0) + monetization 게이트(P1) 수정

> ⚠️ 본 리뷰 동안 적용한 변경 없음(읽기 전용). 플래그·마이그·배포·외부설정 무변경, prod cost=0 유지.
