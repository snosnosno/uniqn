---
area: architecture
updated: 2026-06-18
status: current
sources:
  - CLAUDE.md
  - uniqn-mobile/src/services/wallet/walletService.ts
  - uniqn-mobile/src/services/jobs/jobService.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/src/repositories/supabase/WalletRepository.ts
tags: [architecture, data-flow, tanstack-query, repository]
---

# 데이터 흐름

**한 줄:** UI 조회는 TanStack Query + Repository 직접, 쓰기는 Service → Repository → Supabase RPC 경유.

## 흐름 1 — 공고 목록 조회 (읽기, TanStack Query 예외)

검증됨 (`uniqn-mobile/src/services/jobs/jobService.ts:20-50`):
```
useJobPostings (Hook)
  → jobPostingRepository.getList()          ← Repository 직접 (TanStack Query 예외)
    → supabase.from('job_postings')
        .select(...).in('status', [...])
          → RLS 평가 → rows 반환
  ← 캐시 → Presentation 렌더
```

CLAUDE.md: "TanStack Query 읽기 전용 조회: Repository 직접 호출 허용" (검증됨).

## 흐름 2 — 지갑 조회 (쓰기/서비스 경유)

검증됨 (`uniqn-mobile/src/services/wallet/walletService.ts:20-47`):
```
ProfileCard (Presentation)
  → useWallet (Hook)
    → walletService.getWalletSummary()      ← Service 경유
      → WalletRepository.getSummary()
        → supabase.rpc('get_wallet_summary')
```

Service 계층이 비즈니스 검증 + `handleServiceError`(AppError 변환) 담당.

## 흐름 3 — 공고 게시 (쓰기, Service 필수)

검증됨 (`uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:1-40`):
```
PostingForm (Presentation)
  → jobManagementService.createPosting()   ← Service
    → JobPostingRepository.create()
      → supabase.from('job_postings').insert(...)
        → RLS(WITH CHECK) → INSERT
        → fn_update_job_posting_stats 트리거
```

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
