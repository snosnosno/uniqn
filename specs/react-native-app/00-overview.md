# UNIQN React Native App - 설계 문서

## 프로젝트 개요

**프로젝트명**: UNIQN Mobile
**플랫폼**: iOS, Android, Web (Expo)
**기술 스택**: React Native + Expo + TypeScript
**시작일**: 2024년 12월

---

## 마이그레이션 범위

### 포함 기능 (Phase 1)
| 기능 | 우선순위 | 복잡도 |
|------|----------|--------|
| 로그인/회원가입 | P0 | 중 |
| 내 프로필 | P0 | 중 |
| 내 스케줄 | P0 | 높음 |
| 구인구직 | P0 | 높음 |
| 고객센터 | P1 | 낮음 |
| 공고관리 | P0 | 매우 높음 |
| 설정 페이지 | P1 | 낮음 |
| 알림 | P1 | 중 |
| 다크모드 | P0 | 낮음 |
| QR 코드 | P1 | 중 |
| 공고상세관리 (전체 탭) | P0 | 높음 |
| 관리자: 사용자관리 | P1 | 중 |
| 관리자: 문의관리 | P1 | 중 |
| 관리자: 토너먼트승인 | P2 | 낮음 |

### 제외 기능 (Phase 2 이후)
- 토너먼트 관리 시스템
- 테이블 관리
- 참가자 관리

> **마이그레이션 전략**: 기존 React 웹앱(app2/)을 완전히 대체하는 전략입니다.
> React Native + Expo로 iOS, Android, Web 단일 코드베이스를 구축합니다.
> 자세한 내용은 [14-migration-plan.md](./14-migration-plan.md) 참조

---

## 기술 스택

> ⚠️ **버전 고정 필수**: 호환성 문제 방지를 위해 아래 버전 준수
> (DEVELOPMENT_CHECKLIST.md 1.2절 버전 기준)

```yaml
Core:
  - React Native: 0.76+        # Expo SDK 52 기준
  - Expo: SDK 52+              # 최신 안정 버전
  - React: 18.3+               # Concurrent 기능
  - TypeScript: 5.3+           # strict 모드

Navigation:
  - Expo Router: 4.0+ (파일 기반 라우팅)

State Management:
  - Zustand: 5.0+ (전역 상태, persist 미들웨어)
  - TanStack Query: 5.17+ (서버 상태, v5 API)

Backend:
  - Firebase: 11.0+ (Modular API)
  - Firebase Auth: 인증
  - Cloud Firestore: 데이터베이스
  - Cloud Functions: 서버리스 함수
  - Cloud Storage: 파일 저장

UI/Styling:
  - NativeWind: 4.0+ (Tailwind v4 호환)
  - React Native Reanimated: 3.0+ (애니메이션)
  - React Native Gesture Handler: 2.0+ (제스처)

Forms & Validation:
  - React Hook Form: 7.54+ (Zod 연동)
  - Zod: 3.23+ (기존 스키마 재사용)

Utilities:
  - date-fns: 날짜 처리
  - expo-camera: QR 스캐닝
  - expo-notifications: 푸시 알림
  - @shopify/flash-list: 가상화 리스트
  - expo-image: 이미지 최적화
```

---

## 프로젝트 구조

```
uniqn-mobile/
├── app/                          # Expo Router (파일 기반 라우팅)
│   ├── (auth)/                   # 인증 그룹 (로그인 전)
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   └── _layout.tsx
│   │
│   ├── (tabs)/                   # 메인 탭 네비게이션
│   │   ├── index.tsx             # 홈 (구인구직)
│   │   ├── schedule.tsx          # 내 스케줄
│   │   ├── profile.tsx           # 내 프로필
│   │   └── _layout.tsx
│   │
│   ├── (stack)/                  # 스택 네비게이션 화면들
│   │   ├── notifications.tsx
│   │   ├── settings/
│   │   │   ├── index.tsx
│   │   │   ├── security.tsx
│   │   │   ├── notifications.tsx
│   │   │   └── account.tsx
│   │   ├── support.tsx
│   │   ├── qr-code.tsx
│   │   └── _layout.tsx
│   │
│   ├── job-posting/              # 공고 관련
│   │   ├── [id]/
│   │   │   ├── index.tsx         # 공고 상세
│   │   │   ├── applicants.tsx    # 지원자 탭
│   │   │   ├── staff.tsx         # 확정 스태프 탭
│   │   │   ├── shifts.tsx        # 시프트 관리 탭
│   │   │   └── payroll.tsx       # 정산 탭
│   │   ├── create.tsx
│   │   └── _layout.tsx
│   │
│   ├── admin/                    # 관리자 전용
│   │   ├── users.tsx
│   │   ├── inquiries.tsx
│   │   ├── approvals.tsx
│   │   └── _layout.tsx
│   │
│   ├── _layout.tsx               # 루트 레이아웃
│   └── +not-found.tsx
│
├── src/
│   ├── components/               # 재사용 컴포넌트
│   │   ├── ui/                   # 기본 UI 요소
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── forms/                # 폼 컴포넌트
│   │   │   ├── FormField.tsx
│   │   │   ├── FormSelect.tsx
│   │   │   └── FormDatePicker.tsx
│   │   │
│   │   ├── job/                  # 구인구직 관련
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobFilters.tsx
│   │   │   └── ApplicationStatus.tsx
│   │   │
│   │   ├── schedule/             # 스케줄 관련
│   │   │   ├── ScheduleCard.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   └── ScheduleStats.tsx
│   │   │
│   │   └── admin/                # 관리자 관련
│   │       ├── UserCard.tsx
│   │       └── InquiryCard.tsx
│   │
│   ├── hooks/                    # 커스텀 훅
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   ├── useNotifications.ts
│   │   ├── useJobPostings.ts
│   │   ├── useSchedule.ts
│   │   └── usePermissions.ts
│   │
│   ├── stores/                   # Zustand 스토어
│   │   ├── authStore.ts
│   │   ├── themeStore.ts
│   │   ├── toastStore.ts
│   │   └── index.ts
│   │
│   ├── services/                 # 비즈니스 로직
│   │   ├── auth/
│   │   │   ├── authService.ts
│   │   │   └── consentService.ts
│   │   ├── job/
│   │   │   ├── jobPostingService.ts
│   │   │   └── applicationService.ts
│   │   ├── notification/
│   │   │   └── notificationService.ts
│   │   └── firebase/
│   │       └── firestoreService.ts
│   │
│   ├── types/                    # TypeScript 타입 (기존 재사용)
│   │   ├── auth.ts
│   │   ├── jobPosting.ts
│   │   ├── schedule.ts
│   │   ├── notification.ts
│   │   └── index.ts
│   │
│   ├── schemas/                  # Zod 스키마 (기존 재사용)
│   │   ├── auth.schema.ts
│   │   ├── jobPosting.schema.ts
│   │   └── index.ts
│   │
│   ├── utils/                    # 유틸리티 (기존 재사용)
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── dateUtils.ts
│   │   └── logger.ts
│   │
│   ├── constants/                # 상수
│   │   ├── colors.ts
│   │   ├── layout.ts
│   │   └── config.ts
│   │
│   └── lib/                      # 외부 라이브러리 설정
│       ├── firebase.ts
│       └── queryClient.ts
│
├── assets/                       # 정적 자산
│   ├── images/
│   ├── fonts/
│   └── icons/
│
├── app.json                      # Expo 설정
├── eas.json                      # EAS Build 설정
├── tailwind.config.js            # NativeWind 설정
├── tsconfig.json
└── package.json
```

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

## 개발 일정 (예상)

| Phase | 기간 | 내용 |
|-------|------|------|
| **Setup** | 1주 | 프로젝트 초기화, Firebase 연동 |
| **Core** | 2주 | 인증, 네비게이션, 테마 시스템 |
| **Profile & Settings** | 1주 | 프로필, 설정 페이지 |
| **Job Board** | 3주 | 구인구직, 지원 시스템 |
| **Schedule** | 2주 | 내 스케줄, 캘린더 |
| **Job Management** | 3주 | 공고관리, 상세 탭들 |
| **Admin** | 2주 | 관리자 기능 |
| **Polish** | 2주 | QA, 성능 최적화, 버그 수정 |

**총 예상: 16주 (4개월)** - 1인 풀타임 기준
