---
area: architecture
updated: 2026-06-19
status: current
sources:
  - CLAUDE.md
  - uniqn-mobile/src/services/wallet/walletService.ts
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
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

검증됨 (`uniqn-mobile/src/services/wallet/walletService.ts:22`):
```
walletService.getWalletSummary()
  → WalletRepository.getSummary()
    → supabase.rpc('get_wallet_summary')
```

Repository 직접 Supabase 호출은 `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:9`에서 `import { supabase } from '@/lib/supabase'` 패턴으로 확인됨.

## 호출 규칙 (검증됨: CLAUDE.md)

- **DB 접근**: Service → Repository → Supabase 경유 필수
- **예외 1**: TanStack Query **읽기전용** 조회 — Repository 직접 호출 허용
- **예외 2**: Supabase Auth — `authService` + 인증 hook만 직접 호출 허용
- **금지**: Presentation/Hooks 에서 Supabase 직접 임포트

## 에러 처리 패턴

검증됨 (`uniqn-mobile/src/services/wallet/walletService.ts:23-28`):
```typescript
} catch (error) {
  throw handleServiceError(error, { operation: '지갑 요약 조회', component: 'walletService' });
}
```
Service 계층이 `handleServiceError`로 AppError(E1~E7) 변환. Presentation은 AppError만 처리.

## 기술 스택 (검증됨: CLAUDE.md)

Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase

## 관련

- [[data-flow]] — 레이어 간 실제 데이터 흐름
- [[rls-model]] — Supabase 레이어의 보안 정책
- [[roles]] — 역할별 앱 권한과 레이어 관계
- [[worktime-ssot]] — Presentation 근무시간 표시는 WorkTimeDisplay SSOT 경유(직접 계산 우회 금지)
- [[ops-engine]] — 이 5레이어 위 대회 운영 엔진(쓰기=SECDEF RPC 경계)
