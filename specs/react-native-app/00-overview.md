# UNIQN React Native App - 설계 문서

## 프로젝트 개요

**프로젝트명**: UNIQN Mobile
**플랫폼**: iOS, Android, Web (Expo)
**기술 스택**: React Native + Expo + TypeScript
**시작일**: 2024년 12월
**현재 버전**: v1.0.0
**마지막 업데이트**: 2026년 2월

---

## 구현 완료 기능

### Phase 1 완료 (v1.0.0)
| 기능 | 상태 | 구현 파일 |
|------|------|----------|
| 로그인/회원가입 | ✅ 완료 | auth/, authService |
| 내 프로필 | ✅ 완료 | profile/, settings/ |
| 내 스케줄 | ✅ 완료 | schedule/, scheduleService |
| 구인구직 | ✅ 완료 | jobs/, jobService |
| 고객센터 | ✅ 완료 | support/, inquiryService |
| 공고관리 | ✅ 완료 | employer/, jobManagementService |
| 설정 페이지 | ✅ 완료 | settings/ (10개 하위 화면) |
| 알림 | ✅ 완료 | notifications/, notificationService |
| 다크모드 | ✅ 완료 | themeStore, NativeWind |
| QR 코드 | ✅ 완료 | qr/, eventQRService |
| 지원자 관리 | ✅ 완료 | applicant/, applicantManagementService |
| 정산 관리 | ✅ 완료 | employer/settlements/, settlementService |
| 관리자: 사용자관리 | ✅ 완료 | admin/users/ |
| 관리자: 문의관리 | ✅ 완료 | admin/inquiries/ |
| 관리자: 공지관리 | ✅ 완료 | admin/announcements/ |
| 관리자: 신고관리 | ✅ 완료 | admin/reports/ |
| 관리자: 대회승인 | ✅ 완료 | admin/tournaments/ |

### Phase 2 (미구현)
- 토너먼트 관리 시스템 (app2/ 참고용 보관)
- 테이블 관리
- 참가자 관리

> **전략**: React Native + Expo로 iOS, Android, Web 단일 코드베이스 구축 완료.
> 기존 웹앱(app2/)은 토너먼트 로직 참고용으로만 보관.

---

## 기술 스택

> ⚠️ **버전 고정 필수**: 호환성 문제 방지를 위해 아래 버전 준수
> (현재 구현 기준 - 2026년 2월)

```yaml
Core:
  - React Native: 0.81.5       # Expo SDK 54 기준
  - Expo: SDK 54               # 최신 안정 버전
  - React: 19.1.0              # React 19
  - TypeScript: 5.9.2          # strict 모드

Navigation:
  - Expo Router: 6.0.23 (파일 기반 라우팅)

State Management:
  - Zustand: 5.0.9 (전역 상태, MMKV persist)
  - TanStack Query: 5.90.12 (서버 상태, v5 API)

Backend:
  - Firebase: 12.6.0 (Web SDK Modular API)
  - Firebase Auth: 인증
  - Cloud Firestore: 데이터베이스
  - Cloud Functions: 서버리스 함수
  - Cloud Storage: 파일 저장
  - Sentry: 7.2.0 (에러 모니터링)

UI/Styling:
  - NativeWind: 4.2.1 (Tailwind CSS)
  - Tailwind CSS: 3.4.19
  - React Native Reanimated: 4.1.1 (애니메이션)
  - React Native Gesture Handler: 2.28.0 (제스처)
  - @gorhom/bottom-sheet: 5.2.8

Forms & Validation:
  - React Hook Form: 7.68.0 (Zod 연동)
  - Zod: 4.1.13 (스키마 검증)

Storage:
  - react-native-mmkv: 4.1.2 (고성능 저장소)
  - expo-secure-store: 15.0.8 (보안 저장소)

Utilities:
  - date-fns: 4.1.0 (날짜 처리)
  - expo-camera: 17.0.10 (QR 스캐닝)
  - expo-notifications: 0.32.16 (푸시 알림)
  - @shopify/flash-list: 2.0.2 (가상화 리스트)
  - expo-image: 3.0.11 (이미지 최적화)
```

---

## 프로젝트 구조 (현재 구현 기준)

```
uniqn-mobile/
├── app/                           # Expo Router (68개 라우트)
│   ├── _layout.tsx               # Root Layout (5단계 Provider)
│   ├── index.tsx                 # 스플래시 화면
│   ├── +not-found.tsx            # 404 페이지
│   │
│   ├── (public)/                 # 비로그인 접근 가능
│   │   ├── _layout.tsx
│   │   └── jobs/
│   │       ├── index.tsx         # 공고 목록 (비로그인)
│   │       └── [id].tsx          # 공고 상세 (비로그인)
│   │
│   ├── (auth)/                   # 인증 플로우
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   │
│   ├── (app)/                    # 로그인 필수 (staff+)
│   │   ├── _layout.tsx
│   │   ├── notifications.tsx     # 알림
│   │   ├── employer-register.tsx # 구인자 등록
│   │   │
│   │   ├── (tabs)/               # 탭 네비게이션 (5개)
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # 구인구직 (홈)
│   │   │   ├── schedule.tsx      # 내 스케줄
│   │   │   ├── qr.tsx            # QR 스캔
│   │   │   ├── employer.tsx      # 내 공고 (구인자용)
│   │   │   └── profile.tsx       # 프로필
│   │   │
│   │   ├── jobs/[id]/            # 공고 관련
│   │   │   ├── index.tsx         # 공고 상세
│   │   │   └── apply.tsx         # 공고 지원
│   │   │
│   │   ├── applications/[id]/    # 지원 관리
│   │   │   └── cancel.tsx        # 지원 취소
│   │   │
│   │   ├── notices/              # 공지사항
│   │   ├── support/              # 고객지원
│   │   └── settings/             # 설정 (10개 하위 화면)
│   │
│   ├── (employer)/               # 구인자 전용 (employer+)
│   │   ├── _layout.tsx
│   │   └── my-postings/
│   │       ├── index.tsx         # 공고 목록
│   │       ├── create.tsx        # 공고 생성
│   │       └── [id]/
│   │           ├── index.tsx     # 공고 상세
│   │           ├── edit.tsx      # 공고 수정
│   │           ├── applicants.tsx    # 지원자 관리
│   │           ├── cancellation-requests.tsx  # 취소 요청
│   │           └── settlements.tsx   # 정산 관리
│   │
│   └── (admin)/                  # 관리자 전용 (admin)
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── users/                # 사용자 관리
│       ├── reports/              # 신고 관리
│       ├── announcements/        # 공지 관리
│       ├── tournaments/          # 대회공고 승인
│       ├── inquiries/            # 문의 관리
│       └── stats/                # 통계
│
├── src/
│   ├── components/               # 245개 (20개 폴더)
│   │   ├── ui/                   # 기본 UI 컴포넌트
│   │   ├── employer/             # 구인자 전용 ⭐ 가장 많음
│   │   ├── jobs/                 # 공고 관련
│   │   ├── auth/                 # 인증
│   │   ├── admin/                # 관리자
│   │   ├── schedule/             # 스케줄
│   │   ├── applicant/            # 지원자 관리
│   │   ├── applications/         # 지원 내역
│   │   ├── notifications/        # 알림
│   │   ├── support/              # 고객지원
│   │   ├── profile/              # 프로필
│   │   ├── settings/             # 설정
│   │   ├── qr/                   # QR 코드
│   │   ├── notices/              # 공지사항
│   │   ├── modals/               # 모달
│   │   ├── headers/              # 헤더
│   │   ├── navigation/           # 네비게이션
│   │   ├── icons/                # 아이콘
│   │   ├── onboarding/           # 온보딩
│   │   └── lazy/                 # 지연 로딩
│   │
│   ├── hooks/                    # 49개 커스텀 훅
│   │   ├── useAuth.ts, useAuthGuard.ts
│   │   ├── useJobPostings.ts, useJobDetail.ts
│   │   ├── useApplications.ts
│   │   ├── useSchedules.ts (8개 함수)
│   │   ├── useNotifications.ts (9개 함수)
│   │   ├── useSettlement.ts (10개 함수)
│   │   ├── applicant/ (지원자 관리 훅 폴더)
│   │   └── ...
│   │
│   ├── stores/                   # 8개 Zustand 스토어
│   │   ├── authStore.ts          # 인증 상태
│   │   ├── themeStore.ts         # 테마
│   │   ├── toastStore.ts         # Toast 알림
│   │   ├── modalStore.ts         # 모달 스택
│   │   ├── notificationStore.ts  # 알림
│   │   ├── inAppMessageStore.ts  # 인앱 메시지
│   │   ├── bookmarkStore.ts      # 북마크
│   │   ├── tabFiltersStore.ts    # 탭 필터
│   │   └── index.ts
│   │
│   ├── services/                 # 43개 비즈니스 서비스
│   │   ├── authService.ts
│   │   ├── jobService.ts
│   │   ├── applicationService.ts # v2.0 Assignment
│   │   ├── scheduleService.ts
│   │   ├── workLogService.ts
│   │   ├── notificationService.ts
│   │   ├── settlementService.ts
│   │   ├── pushNotificationService.ts
│   │   ├── deepLinkService.ts
│   │   └── ...
│   │
│   ├── repositories/             # 22개 (Repository 패턴: 인터페이스 11 + 구현체 11)
│   │   ├── interfaces/           # 11개 인터페이스
│   │   │   ├── IAdminRepository.ts
│   │   │   ├── IAnnouncementRepository.ts
│   │   │   ├── IApplicationRepository.ts
│   │   │   ├── IConfirmedStaffRepository.ts
│   │   │   ├── IEventQRRepository.ts
│   │   │   ├── IJobPostingRepository.ts
│   │   │   ├── INotificationRepository.ts
│   │   │   ├── IReportRepository.ts
│   │   │   ├── ISettlementRepository.ts
│   │   │   ├── IUserRepository.ts
│   │   │   └── IWorkLogRepository.ts
│   │   └── firebase/             # 11개 구현체
│   │       ├── AdminRepository.ts
│   │       ├── AnnouncementRepository.ts
│   │       ├── ApplicationRepository.ts
│   │       ├── ConfirmedStaffRepository.ts
│   │       ├── EventQRRepository.ts
│   │       ├── JobPostingRepository.ts
│   │       ├── NotificationRepository.ts
│   │       ├── ReportRepository.ts
│   │       ├── SettlementRepository.ts
│   │       ├── UserRepository.ts
│   │       └── WorkLogRepository.ts
│   │
│   ├── shared/                   # 26개 공유 모듈 (9개 도메인)
│   │   ├── id/                   # IdNormalizer
│   │   ├── role/                 # RoleResolver
│   │   ├── status/               # StatusMapper
│   │   ├── time/                 # TimeNormalizer
│   │   ├── realtime/             # RealtimeManager
│   │   ├── deeplink/             # RouteMapper
│   │   └── errors/               # hookErrorHandler
│   │
│   ├── domains/                  # 14개 도메인 모듈
│   │   ├── application/          # ApplicationStatusMachine
│   │   ├── schedule/             # ScheduleMerger, WorkLogCreator
│   │   ├── settlement/           # SettlementCalculator, TaxCalculator
│   │   └── ...
│   │
│   ├── errors/                   # 에러 시스템 (8개)
│   │   ├── AppError.ts           # 기본 에러 클래스
│   │   ├── BusinessErrors.ts     # 비즈니스 로직 에러 (20+ 클래스)
│   │   ├── NotificationErrors.ts # 알림 관련 에러
│   │   ├── errorUtils.ts         # 에러 유틸리티
│   │   ├── firebaseErrorMapper.ts# Firebase 에러 변환
│   │   ├── guardErrors.ts        # 가드 에러
│   │   ├── serviceErrorHandler.ts# 서비스 에러 처리
│   │   └── index.ts              # 배럴 export
│   │
│   ├── types/                    # 28개 타입 정의
│   ├── schemas/                  # 19개 Zod 스키마
│   ├── utils/                    # 36개 유틸리티
│   ├── constants/                # 9개 상수
│   │
│   ├── lib/                      # 7개 라이브러리 설정
│   │   ├── firebase.ts           # 지연 초기화, Proxy 패턴
│   │   ├── queryClient.ts        # Query Keys 중앙 관리
│   │   ├── mmkvStorage.ts        # MMKV 저장소
│   │   ├── secureStorage.ts      # Secure Storage
│   │   └── ...                   # 기타 설정
│   │
│   └── config/                   # 3개 환경설정
│       └── env.ts                # 환경변수
│
├── assets/                       # 정적 자산
├── __tests__/                    # 테스트
├── __mocks__/                    # 모킹 설정
│
├── app.json                      # Expo 설정
├── eas.json                      # EAS Build 설정
├── tailwind.config.js            # NativeWind 설정
├── tsconfig.json
└── package.json
```

### 코드 통계 (v1.0.0 기준)

| 항목 | 개수 | 설명 |
|------|------|------|
| **라우트 파일 (app/)** | 68개 | Expo Router 파일 기반 라우팅 |
| **컴포넌트** | 245개 | 20개 폴더로 구성 |
| **커스텀 훅** | 49개 | 화면별 데이터/상태 관리 |
| **서비스** | 43개 | 비즈니스 로직 |
| **Zustand 스토어** | 8개 | 전역 상태 (MMKV persist) |
| **Repository** | 22개 | 데이터 접근 추상화 (인터페이스 11 + 구현체 11) |
| **공유 모듈** | 26개 | IdNormalizer, RoleResolver 등 (9개 도메인) |
| **도메인 모듈** | 14개 | StatusMachine, Calculator 등 |
| **에러 시스템** | 8개 | AppError 계층 (errors/ 8) |
| **타입 파일** | 27개 | TypeScript 타입 정의 |
| **Zod 스키마** | 18개 | 폼 검증 스키마 |
| **유틸리티** | 37개 | 포매터, 헬퍼 함수 |
| **상수** | 10개 | 공통 상수 정의 |
| **라이브러리 설정** | 7개 | Firebase, QueryClient 등 |
| **환경설정** | 3개 | env, config |
| **전체 src 파일** | 522개 | TypeScript/TSX |

---

## 코드 재사용 계획

### 100% 재사용 (복사)
```
기존 app2/src/ → 새 src/
├── types/           → types/        (타입 정의)
├── schemas/         → schemas/      (Zod 스키마)
├── utils/           → utils/        (유틸리티 함수)
└── services/        → services/     (비즈니스 로직 - 일부 수정)
```

### 70-90% 재사용 (수정 필요)
```
├── hooks/           → hooks/        (React Native 호환 수정)
├── stores/          → stores/       (거의 그대로)
└── contexts/        → hooks/        (Context → Zustand 통합)
```

### 0-20% 재사용 (재작성)
```
├── components/      → components/   (UI 전면 재작성)
└── pages/           → app/          (네비게이션 구조 변경)
```

---

## 개선 목표

### 아키텍처 개선
1. **Provider 지옥 해소**: 8단계 중첩 → 2-3단계로 단순화
2. **상태 관리 통합**: Context + Zustand + React Query → Zustand + React Query
3. **권한 시스템 중앙화**: 분산된 권한 체크 → PermissionService 단일화

### 코드 품질 개선
1. **검증 로직 통합**: 3가지 검증 방식 → Zod 단일화
2. **모달 시스템 개선**: 분산된 상태 → 중앙 모달 매니저
3. **에러 처리 표준화**: 일관된 에러 핸들링 패턴

### 성능 개선
1. **리스트 가상화**: FlashList 적용
2. **이미지 최적화**: expo-image 활용
3. **번들 최적화**: 트리 쉐이킹, 코드 스플리팅

### UX 개선
1. **네이티브 패턴**: iOS/Android 네이티브 UX 적용
2. **오프라인 지원**: 기본적인 오프라인 기능
3. **애니메이션**: 자연스러운 전환 효과

---

## 설계 문서 목록

### 핵심 아키텍처 (01-07)
| 문서 | 설명 |
|------|------|
| [01-architecture.md](./01-architecture.md) | 전체 아키텍처 설계 |
| [02-navigation.md](./02-navigation.md) | 네비게이션 구조 |
| [03-state-management.md](./03-state-management.md) | 상태 관리 전략 |
| [04-screens.md](./04-screens.md) | 화면별 상세 설계 |
| [05-components.md](./05-components.md) | 컴포넌트 시스템 |
| [06-firebase.md](./06-firebase.md) | Firebase 연동 전략 |
| [07-improvements.md](./07-improvements.md) | 기존 문제점 개선 방안 |

### 데이터 및 에러 처리 (08-09)
| 문서 | 설명 |
|------|------|
| [08-data-flow.md](./08-data-flow.md) | 데이터 흐름 패턴 |
| [09-error-handling.md](./09-error-handling.md) | 에러 처리 전략 |

### 사용자 경험 (10-11)
| 문서 | 설명 |
|------|------|
| [10-notifications.md](./10-notifications.md) | 푸시 알림 시스템 |
| [11-ux-guidelines.md](./11-ux-guidelines.md) | UX 가이드라인 |

### 보안 및 테스트 (12-13)
| 문서 | 설명 |
|------|------|
| [12-security.md](./12-security.md) | 보안 설계 (인증, 인증서 피닝, 앱 무결성) |
| [13-testing-strategy.md](./13-testing-strategy.md) | 테스트 전략 (Unit, Integration, E2E) |

### 배포 및 마이그레이션 (14-15)
| 문서 | 설명 |
|------|------|
| [14-migration-plan.md](./14-migration-plan.md) | 마이그레이션 계획 (완전 교체 전략) |
| [15-cicd.md](./15-cicd.md) | CI/CD 파이프라인 (EAS, 스토어 자동화) |

### 분석 및 앱스토어 (16-18)
| 문서 | 설명 |
|------|------|
| [16-analytics.md](./16-analytics.md) | 분석 시스템 (Firebase Analytics, Crashlytics) |
| [17-deep-linking.md](./17-deep-linking.md) | 딥링킹 (Universal Links, App Links) |
| [18-app-store-guide.md](./18-app-store-guide.md) | 앱스토어 심사 가이드 |

### 접근성, 오프라인 및 웹 (19-21)
| 문서 | 설명 |
|------|------|
| [19-accessibility.md](./19-accessibility.md) | 접근성 (WCAG 2.1 AA, VoiceOver/TalkBack) |
| [20-offline-caching.md](./20-offline-caching.md) | 오프라인 지원 및 캐싱 전략 |
| [21-react-native-web.md](./21-react-native-web.md) | React Native Web 전략 (Expo Web) |

### 마이그레이션 상세 (22-23)
| 문서 | 설명 |
|------|------|
| [22-migration-mapping.md](./22-migration-mapping.md) | 코드 변환 매핑 (app2/ → RN, 개선점 분석) |
| [23-api-reference.md](./23-api-reference.md) | Firestore 스키마 및 API 참조 |

---

## 개발 완료 현황

| Phase | 상태 | 내용 |
|-------|------|------|
| **Setup** | ✅ 완료 | 프로젝트 초기화, Firebase 연동 |
| **Core** | ✅ 완료 | 인증, 네비게이션, 테마 시스템 |
| **Profile & Settings** | ✅ 완료 | 프로필, 설정 페이지 (10개 하위 화면) |
| **Job Board** | ✅ 완료 | 구인구직, 지원 시스템, 북마크 |
| **Schedule** | ✅ 완료 | 내 스케줄, 캘린더, 근무 기록 |
| **Job Management** | ✅ 완료 | 공고관리, 지원자관리, 정산 |
| **Admin** | ✅ 완료 | 사용자/신고/공지/문의/대회 관리 |
| **QR System** | ✅ 완료 | QR 생성/스캔, 출퇴근 처리 |
| **Notifications** | ✅ 완료 | 푸시알림, 인앱메시지, 실시간 구독 |

**v1.0.0 릴리스 완료** (2026년 2월)
