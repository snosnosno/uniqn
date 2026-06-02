# 다음 세션 프롬프트 — 결제/수익모델 전체 리뷰 (유료화 롤아웃 前 게이트)

> 이 문서를 다음 세션 첫 메시지로 붙여넣어 사용. 목적은 **구현이 아니라 리뷰**다.
> 작성: 2026-06-02 / 기준 브랜치: master (`ac2a06402` 이후)

---

## 한 줄 목표

유료화(과금) 롤아웃을 켜기 **전에**, 결제·수익모델 전체(다이아/하트 지갑 + RevenueCat IAP 충전 + 공고 차감/환불 + 플래그 게이팅)를 **돈이 오가는 관점에서 적대적으로 리뷰**한다. 실제 코드(file:line) 기준, 머지된 #158/#159 + DRAFT #160 + 외부 설정 준비도 + 배포/롤아웃 안전성까지.

## 절대 하지 말 것 (안전 가드)

- ❌ `app_config.monetization` 플래그를 켜지 말 것(paid_types / rollout_percentage 변경 금지). 현재 `cost=0`(prod 안전)이 유지돼야 함.
- ❌ Lane D(#160) 마이그레이션 적용 금지(유료화 ON 이후).
- ❌ EAS 빌드/배포/OTA 트리거 금지(사용자 명시 지시 전).
- ❌ Supabase secret·스토어 IAP 등 외부 설정 변경 금지(사용자 수동 작업 영역).
- 리뷰에서 P0/P1 발견 시: 수정은 **사용자 승인 후 별도 브랜치 + PR + CI green** 경로로만.

## 먼저 읽을 것 (컨텍스트)

- 메모리: `[[project_monetization_phase3_planning]]`(Lane A~D + RC 외부설정 현황·정정 2건), `[[project_track_b_subscription_spec_parked]]`, `[[pitfall_enum_divergence_read_disappearance]]`(payroll_status/posting_status enum 발산), `[[feedback_supabase_migration_workflow]]`
- 갭 분석: `docs/planning/2026-05-29-monetization-implementation-gap.md`(상태 매트릭스 + T1~T12)
- 모델 결정: `docs/planning/2026-05-29-monetization-model-recommendation.md`(Approach A)
- 외부 설정: `docs/planning/2026-05-29-payment-setup-guide.md`(RevenueCat/ASC/Play 셋업)
- 구현 계획: `docs/superpowers/plans/2026-05-31-wallet-laneB2-payment-wiring.md`, `...-laneC-revenuecat.md`

## 현재 상태 스냅샷 (리뷰 출발점)

- ✅ Lane A (DB/RPC, prod 적용): `get_posting_cost`/`_calc_posting_cost`(서버권위 비용, regular=하트1·urgent=10·fixed=5·tournament=0), `consume_diamonds_atomically`(하트→다이아 순), `credit_diamonds_atomically`, `grant_heart_atomically`/`claim_daily_attendance`, `create_job_posting_with_payment_atomically`, `refund_job_cancellation_atomically`(24h 100%/이후 50%). 멱등키 `uq_wallet_ledger_consume_ref`. 마이그 `20260427000000~000900` + 패치 `20260514020000`.
- ✅ Lane B1 (무과금 클라 UI) + B2 (차감/환불 배선) — **PR #158 머지**(master). `WalletRepository.createJobPostingWithPayment`/`refundJobCancellation`, `JobPostingRepository.createWithTransaction`(결제 RPC 경유, id를 멱등키로 유지), `deleteWithTransaction`(취소 시 refund best-effort), `PaywallModal`.
- ✅ Lane C (RevenueCat 충전 클라) — **PR #159 머지**(master). `react-native-purchases@10.2.0`, `src/services/purchases/purchasesService.ts`(+`.web.ts` 스텁), `useRevenueCatSession`, `src/utils/wallet/pollWalletCredit.ts`, `usePurchaseDiamonds`, `PurchaseSheet`. **네이티브 의존 → EAS 빌드 필요(OTA 불가, 미실행)**.
- ✅ RevenueCat 외부설정 — MCP로 대부분 완료(2026-06-01). RC 프로젝트 `proja58415e9`, 웹훅 → `revenuecat-webhook` Edge Function(`Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` 정확비교, secret 미설정 시 500=fail-closed). SDK 공개키는 eas.json에 배선(브랜치 `worktree-wallet-rc-env` `ab8d20674`, **미push**).
- ⚠️ 플래그: prod `monetization={enabled:true, show_purchase_ui:true, paid_types:전부 false, rollout_percentage:0, first_purchase_bonus_diamonds:5}`. `_calc_posting_cost` 4단 게이트(base→enabled→paid_types[type]→rollout%)라 **cost=0**. 단, **클라 지갑 UI는 flag 게이팅 안 함**(상시 노출, 사용자 결정 A).
- ⏳ Lane D (featured/extend) — **PR #160 DRAFT**(마이그 미적용, 유료화 ON 후).
- ⏳ 남은 외부(사용자): 스토어 IAP 6개(`uniqn_diamonds_1000/3000/10000/30000/50000/100000`), ASC API키 + Play 서비스계정, Supabase secret `REVENUECAT_WEBHOOK_SECRET`(bare), EAS dev build + sandbox 실구매 검증.

## 리뷰 차원 (각 항목 file:line 근거 + 심각도 P0~P3)

1. **머니 세이프티 / 원장 정합**: consume·credit 멱등성(재시도 이중과금 방어 — `uq_wallet_ledger_consume_ref`, 선조회 가드), `wallet_ledger` 잔액 = 캐시 트리거 합과 일치하는가(drift), 하트→다이아 소비 순서·만료(lot) 처리, 음수/오버드로 방어.
2. **충전 풀사이클 무결성**: IAP→RC→웹훅→Edge Function→`credit_diamonds_atomically`→`wallet_ledger`→클라 폴링. 웹훅 멱등성(중복 이벤트), 첫충전 보너스 이중지급 방어, 폴링(strict-greater delta·조기종료)과 비동기 적립 사이 레이스, 이중결제 가드(PurchaseSheet 처리중 잠금).
3. **환불 로직**: `refund_job_cancellation_atomically`(24h 100%/이후 50%) 경계값, `deleteWithTransaction`의 best-effort try/catch swallow가 **환불 누락을 은폐**하지 않는가(취소는 성립하되 환불 실패 관측성), 협업자 취소 시 owner 지갑 환불(P0-2 비대칭), RC CANCELLATION(=환불) 이벤트 처리.
4. **플래그 게이팅 / 롤아웃**: `_calc_posting_cost` 4단 게이트가 유료화 ON 시 의도대로 동작하는가, `user_bucket` 해시 롤아웃 분포, flag ON 전환 시 무과금↔과금 경계 안전성, `show_purchase_ui` dead/kill-switch 상태.
5. **보안 / RLS / 권한**: `wallets`/`wallet_ledger` RLS(self-only, initplan), 결제·환불·비용 RPC의 anon/PUBLIC REVOKE 하드닝(Supabase ALTER DEFAULT PRIVILEGES 자동부여 주의), 웹훅 인증(Bearer 정확비교·fail-closed), SECDEF search_path.
6. **웹 안전성 / 플랫폼 분기**: `purchasesService.web.ts` 스텁이 네이티브 import 0건(웹 번들 안전), `isAvailable()` 키 부재 시 graceful degrade, RNW에서 PurchaseSheet 동작.
7. **enum / 스키마 발산**: payroll_status·posting_status류 enum 발산이 wallet/ledger 도메인에도 있는지(`reason`/`currency_type`/`ledger_type` 읽기 Zod `.catch()`/`.or()` 방어), types/supabase.ts stale 여부.
8. **Lane D (#160 DRAFT) 사전 리뷰**: featured priority 컬럼·extend RPC 드래프트 SQL 정합, 클라 캐스트(RPC 타입 부재) 제거 조건, orderBy priority DESC 전환 시 회귀, 유료화 ON 전 prod 영향 0 확인.
9. **배포 / 롤아웃 준비도**: EAS 빌드 필요성(네이티브, OTA 불가), eas.json RC키 배선 브랜치(`worktree-wallet-rc-env`) 머지/push 필요성, 외부 설정 체크리스트 완료도, sandbox 검증 미수행 리스크.

## 진행 방식

1. 위 "먼저 읽을 것"을 읽고 현재 상태를 코드로 재검증(메모리는 시점 기록 — file:line으로 확인).
2. `/cso`(보안·RLS·STRIDE) + `/review` 조합, 또는 9개 차원을 병렬 서브에이전트로 fan-out하는 멀티퍼스펙티브 리뷰(원하면 "workflow" 키워드로 멀티에이전트 오케스트레이션). 머니 세이프티·환불·웹훅은 적대적 검증(refute) 필수.
3. 발견은 P0~P3 + file:line + 재현/근거. P0/P1은 적대적 2차 검증 후 확정.
4. 산출물: 심각도별 findings + "유료화 ON 가능 여부" 판정 + 외부 설정/배포 체크리스트 + (승인 시) 수정 PR 계획.
5. 게이트 위반(플래그 변경·배포·D 마이그)은 절대 금지. 완료 주장 전 fresh 검증(tsc/jest/quality, 해당 시 CI).

## 핵심 파일 (출발 좌표)

- 백엔드: `uniqn-mobile/supabase/migrations/20260427000000~000900*.sql`, `20260514020000*.sql`, `functions/revenuecat-webhook/index.ts`(223줄)
- 차감/환불 배선: `src/repositories/supabase/WalletRepository.ts`, `JobPostingRepository.ts`(`createWithTransaction`/`deleteWithTransaction`), `src/repositories/interfaces/IWalletRepository.ts`
- 충전: `src/services/purchases/purchasesService.ts`(+`.web.ts`), `src/hooks/usePurchaseDiamonds.ts`, `src/utils/wallet/pollWalletCredit.ts`, `src/components/wallet/PurchaseSheet.tsx`/`PaywallModal.tsx`
- 플래그/비용: `_calc_posting_cost`/`get_posting_cost` RPC, `app_config.monetization`, `src/hooks/...usePostingCost`
- 설정: `eas.json`(RC 공개키), `.env.example`
