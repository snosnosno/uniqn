# 아키텍처 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/`

## 시스템 개요

- 앱 프레임워크: Expo + React Native
- 라우팅: Expo Router
- 서버 상태: TanStack Query
- 로컬 상태: Zustand
- 백엔드: Supabase Auth / PostgreSQL / Edge Functions / Storage / Realtime
- 클라이언트 진입점: `uniqn-mobile/src/lib/supabase.ts`
- 관측성: Analytics service, Sentry service, performance service

## 앱 구조

### 라우트 그룹

- `uniqn-mobile/app/(public)`
- `uniqn-mobile/app/(auth)`
- `uniqn-mobile/app/(app)`
- `uniqn-mobile/app/(employer)`
- `uniqn-mobile/app/(admin)`

### 핵심 폴더

- `src/components`: UI 컴포넌트
- `src/hooks`: 화면/도메인 훅
- `src/services`: 비즈니스 로직
- `src/repositories/supabase`: Supabase(PostgreSQL) 접근 추상화
- `src/domains`: 순수 도메인 계산 및 모델링
- `src/shared`: 상태, 역할, 실시간, 딥링크 같은 공통 모듈
- `src/stores`: Zustand 저장소
- `src/schemas`: Zod 기반 입력/문서 스키마
- `src/lib/supabase.ts`: Supabase 클라이언트 진입점 (Auth + DB + Realtime + Storage)

## 기본 데이터 흐름

`Screen -> Hook -> Service -> Repository -> Supabase`

화면은 UI와 라우팅에 집중하고, 비즈니스 로직은 서비스에서, PostgreSQL 접근은 저장소에서 처리합니다. TanStack Query 기반의 읽기 전용 조회는 Repository를 직접 호출할 수 있습니다.

## 인증과 권한

- 저장소: `uniqn-mobile/src/stores/authStore.ts`
- 편의 훅: `uniqn-mobile/src/hooks/useAuth.ts`
- 가드: `uniqn-mobile/src/hooks/useAuthGuard.ts`
- 역할 계산: `uniqn-mobile/src/shared/role/RoleResolver.ts`

현재 사용자 역할:

- `admin`
- `employer`
- `staff`

행 단위 권한 관리는 Supabase RLS(Row Level Security) 정책으로 처리합니다. 앱 역할은 `auth.users.raw_app_meta_data.role`에 동기화되며 RLS 정책에서는 `(auth.jwt() -> 'app_metadata' ->> 'role')` 형태로 참조합니다. 정책 정의는 `uniqn-mobile/supabase/migrations/` 마이그레이션에 포함됩니다.

## 캐시와 오프라인

- QueryClient: `uniqn-mobile/src/lib/queryClient.ts`
- invalidation 전략: `uniqn-mobile/src/lib/invalidationStrategy.ts`
- 오프라인 보조 서비스:
  - `src/services/offline/criticalOfflineCache.ts`
  - `src/services/offline/reconnectSyncService.ts`
  - `src/services/offline/remoteMutationGuard.ts`

## 실시간과 딥링크

- realtime: `uniqn-mobile/src/shared/realtime/` (Supabase Realtime 기반 postgres_changes 구독)
- deep link: `uniqn-mobile/src/shared/deeplink/`
- 알림 클릭 라우팅: `uniqn-mobile/src/hooks/useDeepLink.ts`

## Supabase 백엔드 구조

- Edge Functions: `uniqn-mobile/supabase/functions/` (각 함수별 디렉터리 + `index.ts`)
- 마이그레이션: `uniqn-mobile/supabase/migrations/` — 테이블/RLS/RPC/트리거/스케줄 cron 정의
- RPC (PL/pgSQL 함수): 다중 문서 트랜잭션이 필요한 로직(지원/취소/출퇴근/정산/역할 변경)은 PostgreSQL RPC 함수로 구현
- RLS 정책: 모든 테이블에 활성화. 앱 역할은 JWT `app_metadata.role` 기준
- Scheduled Jobs: `pg_cron` 확장을 통한 PostgreSQL 내장 스케줄링 (계정 정리, 공고 만료, rate limit 정리 등)
- 설정: `uniqn-mobile/supabase/config.toml`
- 타입 재생성: `uniqn-mobile/src/types/supabase.ts` (Supabase CLI 기반 자동 생성)

## 리팩터링 가드레일

- 게시판 기능은 별도 작업 스트림으로 보호합니다.
- `@/types`는 type-only barrel로 유지하고, 런타임 helper/상수는 원본 모듈에서 import합니다.
- 인증/부트스트랩 훅과 인프라 서비스 외에는 Supabase SDK 직접 접근을 줄이고 서비스/저장소 경계를 우선합니다.
- 레거시 호환 동작은 즉시 삭제하지 않고 compat 층으로 격리합니다.

## 현재 문서 범위 밖

아래는 현재 운영 아키텍처 문서에 포함하지 않습니다.

- 저장소 밖 백업으로 옮긴 과거 웹 제품 자산
- 미구현 결제/포인트 런타임
- 현재 코드에 없는 운영 제어 서비스 또는 관리자 추가 설정 라우트
- 과거 웹 중심 확장 설계
