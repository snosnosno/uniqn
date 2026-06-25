# 지갑/IAP 수익모델 제거 계획서

> 작성일: 2026-06-21 | 브랜치: `chore/remove-wallet-iap`

## 배경 및 목적

구인구직 앱에 가상화폐(하트/다이아) 수익모델이 불필요하다고 판단:
- 시장 규모 작고 사용자 이탈 심화
- 직업안정법상 구직자 과금 제한 리스크
- 안티스팸은 PortOne 본인인증 + 지원/공고 한도 + 평판으로 대체 가능

## 선행 충돌 확인 결과 (통과)

- 커밋 `ef3edcfb7`(지갑 강화 작업)이 `fix/anon-rpc-security-hardening` 브랜치에서 PR #195로 squash-merge돼 `8194f547`로 master 포함됨
- 원격 브랜치 삭제 완료, 오픈 워렌트 없음

## 제거 범위

### 클라이언트 코드 (삭제)

| 경로 | 설명 |
|------|------|
| `src/components/wallet/` | BalanceBadge, WalletBalanceBadge, PaywallModal, PurchaseSheet + 테스트 |
| `src/services/purchases/` | RevenueCat SDK 래퍼 |
| `src/services/wallet/` | walletService |
| `src/hooks/usePurchaseDiamonds.ts` | 패키지 구매 훅 |
| `src/hooks/useRestorePurchases.ts` | 영수증 복원 훅 |
| `src/hooks/useRevenueCatSession.ts` | RC 세션 훅 |
| `src/hooks/useWalletBalance.ts` | 잔액 조회 훅 |
| `src/hooks/useWalletLedger.ts` | 거래내역 훅 |
| `src/hooks/usePostingCost.ts` | 공고 비용 조회 훅 |
| `src/hooks/useClaimDailyAttendance.ts` | 출석 적립 훅 |
| `src/hooks/__tests__/` (wallet 관련 6개) | 훅 테스트 |
| `src/repositories/supabase/WalletRepository.ts` | Repository 구현 |
| `src/repositories/interfaces/IWalletRepository.ts` | Repository 인터페이스 |
| `src/repositories/supabase/__tests__/Wallet*.test.ts` (4개) | Repository 테스트 |
| `src/repositories/supabase/__tests__/JobPostingRepository.create.payment.test.ts` | R1 결제 경로 테스트 |
| `src/stores/purchaseSheetStore.ts` | 충전 시트 스토어 |
| `src/stores/__tests__/purchaseSheetStore.test.ts` | 스토어 테스트 |
| `src/types/wallet.ts` | 지갑 타입/스키마 |
| `src/types/__tests__/wallet.test.ts` | 타입 테스트 |
| `src/types/__tests__/walletPaymentSchemas.test.ts` | 결제 스키마 테스트 |
| `src/utils/wallet/` | expiringHearts, walletReasonLabels + 테스트 |
| `app/(app)/wallet/index.tsx` | 지갑 화면 |
| `supabase/functions/revenuecat-webhook/` | RC 웹훅 함수 |

### 클라이언트 코드 (수정)

| 파일 | 변경 내용 |
|------|----------|
| `app/_layout.tsx` | PurchaseSheet import/마운트 제거 |
| `app/(employer)/my-postings/create.tsx` | PaywallModal, WalletBalanceBadge, usePostingCost, useWalletBalance, usePurchaseSheetStore 전부 제거. 보유잔액/게시비용 UI 행 제거. 잔액부족 경고 제거. PaywallModal JSX 제거 |
| `app/(app)/(tabs)/profile.tsx` | 지갑 카드 + 출석 버튼 블록 제거 (Card 전체). WalletBalanceBadge, useClaimDailyAttendance import 제거 |
| `src/hooks/useJobManagement.ts` | onSuccess 내 wallet 쿼리 무효화(6A 주석 포함) 제거 |
| `src/lib/queryClient.ts` | `queryKeys.wallet` + `queryCachingOptions.wallet` 제거 |
| `src/repositories/supabase/JobPostingRepository.ts` | WalletRepository import 제거. `createWithTransaction` → 직접 Supabase INSERT. `deleteWithTransaction` → 직접 status='cancelled' UPDATE |

### 핵심 복원: 공고 생성 경로

**현재**: `createWithTransaction` → `WalletRepository.createJobPostingWithPayment()` → `create_job_posting_with_payment_atomically` RPC

**복원 후**: `createWithTransaction` → 직접 `supabase.from('job_postings').insert(snakeData).select('id').single()`

R1 테스트에서 검증된 payload 필드(title, owner_id, workspace_id, posting_type, schema_version=3, status, schedule, role_catalog, stats, total_positions, id)는 기존 `snakeData` 변수에 그대로 유지되므로 정합성 보장.

멱등키(클라 생성 UUID = payload.id)도 ON CONFLICT(id) → INSERT OR IGNORE 패턴은 RLS 레벨 제약으로 대체.

### DB (마이그레이션 파일 작성, prod 적용 금지)

파일: `supabase/migrations/20260621200000_drop_wallet_tables_and_rpcs.sql`

DROP 대상:
- 테이블: `wallets`, `diamond_products`, `wallet_ledger`, `heart_lots`
- RPC: `create_job_posting_with_payment_atomically`, `cancel_job_posting_with_refund_atomically`, `consume_diamonds_atomically`, `credit_diamonds_atomically`, `grant_heart_atomically`, `claim_daily_attendance`, `get_posting_cost`, `get_wallet_summary`
- CRON: 하트 만료 처리 cron job
- Enum: `wallet_reason`, `wallet_currency_type`

## 영향 분석

### 반드시 유지
- 출퇴근 check-in/out: `useJobManagement.ts`의 close/reopen/update 훅 — 지갑과 무관
- 정산(settlement): `settlementQuery.ts` 지갑 참조 없음 — 안전
- 공고 게시/지원/확정: 공고 생성 경로 직접 INSERT로 복원 — 동일 데이터 보장
- PortOne 본인인증: `verify-and-save-portone-profile` Edge Function — 지갑과 별개

### 주의 사항
- `feat/wallet-featured-extend` (PR #160, DRAFT): 이 브랜치가 WalletRepository에 의존. 해당 PR은 마이그 미적용 DRAFT이므로 충돌 가능성. 이 PR은 wallet 제거 후 폐기 권고.
- `app/(app)/wallet/` 라우트 제거 → profile.tsx 지갑 카드 링크도 함께 제거 (함께 처리)
- `useRevenueCatSession.ts` 존재 여부: hooks 배럴에 포함됐을 수 있으므로 배럴 검토 필요

## 리스크

| 리스크 | 대응 |
|--------|------|
| 기존 사용자 지갑 잔액 손실 | prod 마이그 적용 전 잔액 0 확인 필요 (별도 확인 후 적용) |
| cancel_job_posting_with_refund_atomically 제거 후 미환불 | 이미 flag-off로 cost=0이므로 실질 환불 없음 |
| RC 웹훅 미처리 | RC 구독 해지 후 웹훅 비활성화 필요 (prod 외부 작업) |
| feat/wallet-featured-extend PR 충돌 | PR #160은 이 변경과 base 충돌 예상 — 폐기 권고 |

## 남은 외부 작업 (prod)

1. RevenueCat 대시보드: 제품/구독 비활성화 + 웹훅 URL 제거
2. App Store / Google Play: IAP 항목 제거 또는 비활성화 신청
3. `supabase/migrations/20260621200000_drop_wallet_tables_and_rpcs.sql` prod 적용 (타이밍 확인 후)
4. `app_config` table의 `monetization` 키 제거 (prod)
5. 기존 heart_lots/wallet_ledger 데이터 보관 또는 archiving 확인
