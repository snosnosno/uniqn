---
area: architecture
updated: 2026-07-28
status: current
sources:
  - CLAUDE.md
  - uniqn-mobile/src/services/jobs/jobService.ts
  - uniqn-mobile/src/services/jobs/jobManagementService.ts
  - uniqn-mobile/src/errors/serviceErrorHandler.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - uniqn-mobile/src/stores/authStore.ts
  - uniqn-mobile/src/utils/supabase.ts
  - uniqn-mobile/src/hooks
tags: [architecture, layers, dependency]
---

# 레이어 아키텍처

**한 줄:** `Presentation → Hooks → Service → Repository → Supabase` 단방향 의존 5레이어. (검증됨: CLAUDE.md 아키텍처 섹션)

## 레이어별 책임

| 레이어 | 경로 | 책임 |
|---|---|---|
| **Presentation** | `src/components/`, `src/features/`, `app/` | UI 렌더링. Supabase 직접 호출 **금지** |
| **Hooks** | `src/hooks/` | 화면 상태·이펙트·TanStack Query 조율 |
| **Service** | `src/services/` | 비즈니스 로직 조합. DB 접근의 진입점 |
| **Repository** | `src/repositories/supabase/` | Supabase PostgREST/RPC 쿼리 캡슐화 |
| **Supabase** | (외부) | PostgreSQL + Auth + Realtime |

### Service → Repository 예시

검증됨 (`uniqn-mobile/src/services/jobs/jobManagementService.ts:125,134`):
```
jobManagementService.createSinglePosting()
  → jobPostingRepository.createWithTransaction()   ← runTransaction
    → supabase.from('job_postings').insert(...)
```

Repository 직접 Supabase 호출은 `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:9`에서 `import { supabase } from '@/lib/supabase'` 패턴으로 확인됨.

## 호출 규칙 (검증됨: CLAUDE.md 아키텍처 절)

- **DB 접근**: Service → Repository → Supabase 경유 필수
- **예외 1**: TanStack Query **읽기전용** 조회 — Repository 직접 호출 허용
- **예외 2**: Supabase Auth — `authService` + 인증 hook + **`authStore`**(세션·프로필 갱신 액션 한정: `refreshSession`/`getUser`/`signOut`/`refreshProfile`)만 직접 호출 허용. 실증: `uniqn-mobile/src/stores/authStore.ts:194,213,350,507` 이 `supabase.auth.*` 를 직접 호출한다(**검증됨**)
- **예외 3**: **읽기 전용 realtime 구독** — 훅에서 `createRealtimeSubscription`(`uniqn-mobile/src/utils/supabase.ts:461`) 직접 사용 허용. 단 **콜백은 캐시 무효화(`invalidateQueries`)만**, 쓰기 금지. 실사용 12+ 훅(`src/hooks/ops/*` 8개 · `src/hooks/job-posting/useSharedJobPostings.ts` · `useJobPostingCollaborators.ts` · `src/hooks/workspace/*`)
- **금지**: 위 예외를 벗어난 Presentation/Hooks 의 Supabase 직접 호출

> ⚠️ 2026-07-28 정정: 예외 2 에 `authStore` 가 빠져 있었고 예외 3 은 아예 없었다. 옛 문구("Hooks 에서 Supabase 직접 임포트 금지")대로면 **실사용 중인 훅 12개 이상이 전부 위반으로 읽힌다** — 규칙이 코드보다 뒤처지면 규칙이 아니라 소음이 된다.

## 에러 처리 패턴

검증됨 (`uniqn-mobile/src/services/jobs/jobService.ts:18,74` — import `@/errors/serviceErrorHandler`):
```typescript
import { handleServiceError } from '@/errors/serviceErrorHandler';
// ...
} catch (error) {
  throw handleServiceError(error, { operation: '...', component: 'jobService' });
}
```
Service 계층이 `handleServiceError`로 Supabase 에러를 AppError(E1~E7)로 변환. Presentation은 AppError만 처리.

## 기술 스택 (검증됨: CLAUDE.md)

Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase

## 관련

- [[data-flow]] — 레이어 간 실제 데이터 흐름
- [[rls-model]] — Supabase 레이어의 보안 정책
- [[roles]] — 역할별 앱 권한과 레이어 관계
- [[worktime-ssot]] — Presentation 근무시간 표시는 WorkTimeDisplay SSOT 경유(직접 계산 우회 금지)
- [[nativewind-rn-pitfalls]] — Presentation 레이어 NativeWind/RN 함정(dark: 유실·flex 붕괴·터치 유실)
- [[ops-engine]] — 이 5레이어 위 대회 운영 엔진(쓰기=SECDEF RPC 경계)
