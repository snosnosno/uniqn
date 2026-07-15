---
area: architecture
updated: 2026-07-16
status: current
sources:
  - CLAUDE.md
  - uniqn-mobile/src/services/jobs/jobService.ts
  - uniqn-mobile/src/services/jobs/jobManagementService.ts
  - uniqn-mobile/src/hooks/useJobPostings.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql
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

## 흐름 2 — 공고 게시 (쓰기, Service 필수)

검증됨 (`uniqn-mobile/src/services/jobs/jobManagementService.ts:85,93`, `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:470,510`):
```
PostingForm (Presentation)
  → jobManagementService.createSinglePosting()    ← Service
    → jobPostingRepository.createWithTransaction() ← runTransaction
      → supabase.from('job_postings').insert(snakeData)
        → DB: job_postings INSERT + fn_update_job_posting_stats 트리거
```

트리거 `fn_update_job_posting_stats` 정의는 현재 baseline(`uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql`) — 원 마이그(20260421.../20260529... M2 capacity_full)는 baseline squash로 `migrations/archive/` 이동([[prod-parity-baseline]]).

> ⚠️ **제거된 흐름(2026-07-16 교정)**: 과거 유료 게시(`WalletRepository.createJobPostingWithPayment` → `create_job_posting_with_payment_atomically` RPC)와 지갑 요약 조회(`walletService.getWalletSummary`)는 **지갑/IAP 전체 제거(#196~206)로 삭제**됐다(파일·RPC 부재 실측). 현재 게시는 결제 없는 `createWithTransaction` 단일 경로. [[wallet-iap-removal]].

## TanStack Query 읽기 예외 범위

- 허용: `useQuery`/`useInfiniteQuery` 내부에서 Repository 직접 호출
- 금지: mutation(생성/수정/삭제/정산)에서 Repository 직접 호출 — Service 경유 필수

## 실시간 구독 (Realtime)

검증됨 (`uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts`에 `createRealtimeSubscription` 임포트):
Repository가 `supabase.channel().on('postgres_changes')` 래퍼 제공.

## 관련

- [[layers]] — 레이어별 책임 원칙
- [[rls-model]] — Supabase 레이어에서 흐름을 차단/허용하는 RLS
- [[wallet-iap-removal]] — 지갑/유료 게시 흐름이 제거된 맥락(구 흐름 2)
- [[capacity-full]] — 공고 상태 전이가 트리거로 자동화된 흐름 예시
