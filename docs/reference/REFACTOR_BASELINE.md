# 리팩터링 기준선

최종 업데이트: 2026-04-18  
범위: 게시판 제외, 현재 기능 무변경

> 주: 본 문서는 2026-04-11 Supabase 전면 이전 이후의 기준선입니다. 이전의 Firebase 기반 baseline(~2026-04-10)은 참고용 아카이브로만 의미가 있으며, 현재 리팩터링 기준은 모두 Supabase(Auth / PostgreSQL / Edge Functions / Storage)를 전제로 합니다.

## 보호 범위

이번 정리 패스에서는 아래 영역을 보호 범위로 취급합니다.

- `uniqn-mobile/app/**/board/**`
- `uniqn-mobile/src/**/board*`
- `uniqn-mobile/src/**/Board*`
- `uniqn-mobile/supabase/functions/notifications/` (board activity 알림 관련)

board 관련 분기를 읽을 수는 있지만, board 소유 코드의 동작과 인터페이스는 변경하지 않습니다.

## 비-board 기준 테스트

리팩터링 전후로 아래 테스트를 기준선으로 사용합니다.

- `src/services/notifications/__tests__/notificationService.test.ts`
- `src/repositories/supabase/workLog/__tests__/timeModificationLogs.test.ts`
- `src/services/observability/__tests__/deepLinkService.test.ts`
- `src/__tests__/hooks/useAppInitialize.test.ts`
- `src/services/observability/__tests__/sessionService.test.ts`
- `src/services/auth/__tests__/authService.test.ts`

## 데이터 흐름 기준

- 기본 흐름: `Screen -> Hook -> Service -> Repository -> Supabase`
- 허용되는 Supabase 직접 접근:
  - authService / 인증 전용 hook (Supabase Auth 브리지)
  - version / observability 같은 infra 서비스
  - TanStack Query 읽기 전용 조회 (Repository 직접 호출 허용)
- 축소 대상:
  - hook 내부 산발적 `supabase.auth.getUser()` 호출
  - service 내부 산발적 PostgreSQL 쿼리 (Repository 경유로 정리)

## 비용 hotspot

아래 모듈은 중복 조회, fallback read, 캐시 전략을 우선 점검합니다.

- `uniqn-mobile/src/repositories/supabase/workLog/workLogQueries.ts`
- `uniqn-mobile/src/repositories/supabase/application/applicationQueries.ts`
- `uniqn-mobile/src/repositories/supabase/NotificationRepository.ts`
- `uniqn-mobile/src/repositories/supabase/UserRepository.ts`
- `uniqn-mobile/src/repositories/supabase/InquiryRepository.ts`

## compat hotspot

이번 패스에서 제거하지 않고 격리 대상으로만 관리하는 항목입니다.

- `legacy` schedule variant
- schema `.passthrough()`
- work log legacy bridge
- legacy notification normalization
- legacy FCM token key (Supabase 이전 전 Firebase Messaging 토큰 키)
- mock/TODO social provider surface

## 이번 패스에서 끝낸 구조화

- `notificationService` 내부 책임 분리
  - message normalization
  - read state
  - settings
  - push bridge
- `deepLinkService` 내부 책임 분리
  - link validation
  - route parsing
  - route serialization
  - navigation execution
- `timeModificationLogs` 책임 분리
  - authoritative reader
  - legacy bridge merger
  - history hydrator
- `useAppInitialize` 인증 세션 대기/조회 어댑터 분리 (Supabase Auth 기준)

## 후속 강경 정리 백로그

- `legacy` schedule variant 제거
- schema `.passthrough()` 제거
- work log bridge 제거
- legacy notification normalization 제거
- legacy FCM token key 제거 (Supabase 이전 이전 잔존 구조)
- Google/Kakao TODO provider 제거
- `checkPhoneExists` Edge Function 권한 정책 재검토 (Supabase RLS + JWT role 기준)
