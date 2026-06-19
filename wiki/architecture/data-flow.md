---
area: architecture
updated: 2026-06-19
status: current
sources:
  - CLAUDE.md
  - uniqn-mobile/src/services/wallet/walletService.ts
  - uniqn-mobile/src/services/jobs/jobService.ts
  - uniqn-mobile/src/services/jobs/jobManagementService.ts
  - uniqn-mobile/src/hooks/useJobPostings.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/src/repositories/supabase/WalletRepository.ts
  - uniqn-mobile/supabase/migrations/20260421040000_add_job_posting_stats_trigger.sql
  - uniqn-mobile/supabase/migrations/20260529100100_M2_trigger_capacity_full_transition.sql
tags: [architecture, data-flow, tanstack-query, repository]
---

# 데이터 흐름

**한 줄:** UI 조회는 TanStack Query + Service → Repository 경유, 쓰기는 Service → Repository → Supabase RPC 경유.

## 흐름 1 — 공고 목록 조회 (읽기, Service 경유)

검증됨 (`uniqn-mobile/src/hooks/useJobPostings.ts:39`, `uniqn-mobile/src/services/jobs/jobService.ts:47-59`):
```
useJobPostings (Hook)
  → getJobPostings() [jobService]        ← Service 경유
    → jobPostingRepository.getList()
      → supabase.from('job_postings')
          .select(...).in('status', [...])
            → RLS 평가 → rows 반환
  ← 캐시 → Presentation 렌더
```

CLAUDE.md: "TanStack Query 읽기 전용 조회: Repository 직접 호출 허용" — 이 규칙은 직접 호출을 허용하나, 실제 `useJobPostings`는 Service(`getJobPostings`)를 경유함 (검증됨).

## 흐름 2 — 지갑 요약 조회 (읽기, Service 경유)

검증됨 (`uniqn-mobile/src/services/wallet/walletService.ts:20-28`, `uniqn-mobile/src/repositories/supabase/WalletRepository.ts:52-61`):
```
ProfileCard (Presentation)
  → useWallet (Hook)
    → walletService.getWalletSummary()      ← Service 경유
      → WalletRepository.getSummary()
        → supabase.rpc('get_wallet_summary')
```

읽기임에도 Service 경유인 이유: `handleServiceError`가 Supabase 에러를 AppError(E1~E7)로 변환하는 역할을 Service가 담당함(TanStack Query 직접 예외와 무관).

## 흐름 3 — 공고 게시 (쓰기, Service 필수)

검증됨 (`uniqn-mobile/src/services/jobs/jobManagementService.ts:63`, `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:347-402`, `uniqn-mobile/src/repositories/supabase/WalletRepository.ts:130`):
```
PostingForm (Presentation)
  → jobManagementService.createSinglePosting()   ← Service
    → jobPostingRepository.createWithTransaction()
      → WalletRepository.createJobPostingWithPayment()
        → supabase.rpc('create_job_posting_with_payment_atomically')
          → DB: job_postings INSERT (RPC 내부) + fn_update_job_posting_stats 트리거
```

트리거 출처 (주장, 마이그레이션): `uniqn-mobile/supabase/migrations/20260421040000_add_job_posting_stats_trigger.sql`, `20260529100100_M2_trigger_capacity_full_transition.sql`.

## TanStack Query 읽기 예외 범위

- 허용: `useQuery`/`useInfiniteQuery` 내부에서 Repository 직접 호출
- 금지: mutation(생성/수정/삭제/정산)에서 Repository 직접 호출 — Service 경유 필수

## 실시간 구독 (Realtime)

검증됨 (`uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts`에 `createRealtimeSubscription` 임포트):
Repository가 `supabase.channel().on('postgres_changes')` 래퍼 제공.

## 관련

- [[layers]] — 레이어별 책임 원칙
- [[rls-model]] — Supabase 레이어에서 흐름을 차단/허용하는 RLS
- [[revenue-model]] — 지갑 차감 흐름의 비즈니스 맥락
- [[capacity-full]] — 공고 상태 전이가 트리거로 자동화된 흐름 예시
