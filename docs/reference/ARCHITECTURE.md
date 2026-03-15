# 아키텍처 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

현재 아키텍처의 기준은 `uniqn-mobile/`과 `functions/`입니다.

## 시스템 개요

- 앱 프레임워크: Expo + React Native
- 라우팅: Expo Router
- 상태 관리: Zustand
- 서버 데이터: TanStack Query
- 데이터 접근: Repository 패턴
- 백엔드: Firebase Auth / Firestore / Functions / Storage
- 관측성: Sentry, Analytics 서비스, 성능 추적 서비스

## 라우트 구조

`uniqn-mobile/app/` 기준:

- `(public)`: 공개 접근
- `(auth)`: 로그인/회원가입
- `(app)`: 로그인 사용자 공통 기능
- `(employer)`: 구인자 전용 기능
- `(admin)`: 관리자 전용 기능

권한 가드는 `useAuthGuard`, `useAuth`, `RoleResolver`를 통해 처리합니다.

## 레이어 구조

기본 데이터 흐름:

`Screen -> Hook -> Service -> Repository -> Firebase`

### Screen / Component

- 위치: `uniqn-mobile/app/`, `uniqn-mobile/src/components/`
- 역할: UI, 입력 처리, 라우팅

### Hook

- 위치: `uniqn-mobile/src/hooks/`
- 역할: 화면 상태, Query, Mutation, 권한/세션 처리

### Service

- 위치: `uniqn-mobile/src/services/`
- 역할: 비즈니스 규칙, 여러 Repository 조합, 부수효과 처리

### Repository

- 위치: `uniqn-mobile/src/repositories/`
- 역할: Firestore/Functions 접근 추상화
- `src/repositories/index.ts`에서 싱글톤 인스턴스를 내보냅니다.

### Backend

- 앱 클라이언트: `uniqn-mobile/src/lib/firebase.ts`
- 서버 진입점: `functions/src/index.ts`

## 상태 관리

### 로컬 UI/세션 상태

- Zustand store 사용
- 예: `authStore`, `themeStore`, `toastStore`, `notificationStore`

### 서버 상태

- TanStack Query 사용
- 중앙 설정: `uniqn-mobile/src/lib/queryClient.ts`
- 재시도, 오프라인 처리, Query Key를 중앙 관리합니다.

## 역할 체계

현재 사용자 역할은 세 가지입니다.

- `admin`
- `employer`
- `staff`

권한 계층은 `RoleResolver`와 관련 타입이 단일 소스입니다.

## 주요 도메인

- 구인공고
- 지원서
- 스케줄 / 출퇴근 / QR
- 정산
- 공지사항
- 신고
- 문의
- 관리자 통계

## 관측성

- 앱 시작 시 `app/_layout.tsx`에서 Sentry 초기화
- Analytics 서비스는 웹 환경 Firebase Analytics와 연동
- 성능 추적은 `performanceService`
- Feature Flag는 `featureFlagService`

## 백엔드 역할

`functions/src/index.ts`는 주요 callable/trigger export를 모읍니다.

대표 영역:

- 인증/프로필 저장
- 알림 생성
- 문의/신고/공지 관련 처리
- 계정 삭제 스케줄 작업
- 로그인 알림

## 현재 문서에서 제외하는 것

- 레거시 웹앱 전용 Context 아키텍처
- 웹 전용 번들/PWA 설계
- 현재 의존성에 없는 런타임 번역 시스템
- 실제 코드에 없는 결제/구독 런타임을 현재 구조처럼 설명하는 내용
