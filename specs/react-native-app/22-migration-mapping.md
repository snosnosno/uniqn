# 22. 마이그레이션 매핑 가이드

> **버전**: v1.0.0
> **상태**: 마이그레이션 완료 (Phase 2)
> **최종 업데이트**: 2026-02-02

## 목차

1. [개요](#1-개요)
2. [마이그레이션 현황](#2-마이그레이션-현황)
3. [아키텍처 비교](#3-아키텍처-비교)
4. [코드베이스 상세](#4-코드베이스-상세)
5. [핵심 개선 사항](#5-핵심-개선-사항)
6. [컴포넌트 매핑](#6-컴포넌트-매핑)
7. [서비스 매핑](#7-서비스-매핑)
8. [훅 매핑](#8-훅-매핑)
9. [상태 관리 변환](#9-상태-관리-변환)
10. [데이터 접근 계층](#10-데이터-접근-계층)
11. [미완료 항목](#11-미완료-항목)
12. [참고 자료](#12-참고-자료)

---

## 1. 개요

### 1.1 마이그레이션 목표

app2/ (React + Capacitor 하이브리드 웹앱)에서 uniqn-mobile/ (React Native + Expo 네이티브 앱)으로의 전환이 완료되었습니다.

```yaml
마이그레이션 목표:
  - 일관성: 코드 패턴, 네이밍, 구조 통일 ✅
  - 성능: FlashList, expo-image, 메모이제이션 ✅
  - 보안: SecureStore, Firebase Security Rules ✅
  - UI/UX: 네이티브 UX 패턴, NativeWind ✅
  - 확장성: Repository 패턴, 모듈화 ✅
  - 데이터 흐름: Zustand + TanStack Query ✅
  - 에러 처리: AppError 계층 구조 ✅
  - 의존성: 번들 최적화, Tree-shaking ✅
```

### 1.2 기술 스택 변환

| 영역 | app2/ (레거시) | uniqn-mobile/ (현재) |
|------|---------------|---------------------|
| **플랫폼** | React + Capacitor | React Native + Expo |
| **SDK** | Capacitor 7.4 | Expo SDK 54 |
| **React** | 18.2 | 19.1.0 |
| **TypeScript** | 4.9 | 5.9.2 (strict) |
| **라우팅** | React Router 6 | Expo Router 6.0 |
| **스타일** | Tailwind CSS 3.3 | NativeWind 4.2.1 |
| **리스트** | react-window | @shopify/flash-list |
| **이미지** | `<img>` | expo-image |
| **Firebase** | Firebase 11.9 | Firebase 12.6 (Modular) |
| **Context** | 6개 Context | Zustand 9개 스토어 |

---

## 2. 마이그레이션 현황

### 2.1 파일 수 비교

```yaml
app2/ (레거시):
  컴포넌트: 132+
  페이지: 57
  훅: 46+
  서비스: 20+
  타입 파일: 50
  유틸리티: 38+
  Zustand 스토어: 5
  Context: 6
  전체: ~350 파일

uniqn-mobile/ (현재):
  컴포넌트: 245개 (22개 폴더)
  라우트: 68개 (app/)
  훅: 40개
  서비스: 45개
  스토어: 9개
  리포지토리: 15개 (인터페이스 + 구현체)
  공유 모듈: 33개
  타입: 23개
  스키마: 18개
  에러 클래스: 7개
  유틸리티: 35개
  전체: 600+ 파일
```

### 2.2 마이그레이션 완료율

| 영역 | 상태 | 완료율 | 비고 |
|------|------|--------|------|
| **인증 시스템** | ✅ 완료 | 100% | 소셜 로그인 포함 |
| **구인구직 코어** | ✅ 완료 | 100% | 공고, 지원, 스케줄 |
| **구인자 기능** | ✅ 완료 | 100% | 공고관리, 지원자관리, 정산 |
| **스태프 기능** | ✅ 완료 | 100% | 지원, 스케줄, QR 출퇴근 |
| **관리자 기능** | ✅ 완료 | 95% | 사용자/신고/공지/대회 |
| **알림 시스템** | ✅ 완료 | 90% | FCM, 인앱 메시지 |
| **오프라인 지원** | ✅ 완료 | 90% | 캐싱, 네트워크 감지 |
| **웹 지원** | ✅ 완료 | 85% | 플랫폼별 분기 처리 |
| **토너먼트** | 🔲 미시작 | 0% | Phase 3 예정 |

---

## 3. 아키텍처 비교

### 3.1 app2/ 아키텍처 (레거시)

```
┌─────────────────────────────────────────┐
│  Pages (React Router)                    │
├─────────────────────────────────────────┤
│  Components + Context (6개 혼용)         │
├─────────────────────────────────────────┤
│  Hooks (Firebase 직접 호출)              │
├─────────────────────────────────────────┤
│  Services (일부만 분리)                  │
├─────────────────────────────────────────┤
│  Firebase SDK 직접 호출                  │
└─────────────────────────────────────────┘

문제점:
- Context와 Zustand 혼용
- Firebase 직접 호출 산재
- 일관되지 않은 에러 처리
- 테스트 어려움
```

### 3.2 uniqn-mobile/ 아키텍처 (현재)

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (app/, components/)                     │
│  └─ UI 렌더링만, 비즈니스 로직/Firebase 직접 호출 금지        │
├─────────────────────────────────────────────────────────────┤
│  Hooks Layer (40개 커스텀 훅)                               │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                   │
├─────────────────────────────────────────────────────────────┤
│  State Layer (Zustand 9개 + TanStack Query)                 │
│  └─ Zustand: UI/세션 상태  |  Query: 서버 데이터 캐싱        │
├─────────────────────────────────────────────────────────────┤
│  Shared Layer (33개 공유 모듈)                              │
│  └─ IdNormalizer, RoleResolver, StatusMapper, TimeNormalizer │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (45개 서비스)                                │
│  └─ 비즈니스 로직, Repository 호출, 에러 처리                │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer (15개) ⭐                                 │
│  └─ 데이터 접근 추상화, Firebase Modular API 캡슐화          │
├─────────────────────────────────────────────────────────────┤
│  Firebase Layer (Auth, Firestore, Storage, Functions)       │
│  └─ lib/firebase.ts (지연 초기화, Proxy 패턴)               │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 의존성 규칙

```typescript
// ✅ 허용
Presentation → Hooks → Service → Repository → Firebase
Presentation → Shared (ID, Role, Status, Time 유틸리티)
Service → Shared (공통 비즈니스 로직)

// ❌ 금지
Presentation → Firebase (직접 호출)
Hooks → Firebase (직접 호출)
Service → Firebase (Repository 없이)
하위 → 상위 레이어 의존
```

---

## 4. 코드베이스 상세

### 4.1 컴포넌트 구조 (245개)

```
src/components/                    # 245개 (22개 폴더)
├── ui/ (48개)                     # 기본 UI 컴포넌트
│   ├── Button.tsx                # 5 variants
│   ├── Input.tsx                 # 5 types
│   ├── Card.tsx                  # 3 variants
│   ├── Badge.tsx                 # 6 variants
│   ├── Avatar.tsx
│   ├── Divider.tsx
│   ├── Loading.tsx
│   ├── LoadingOverlay.tsx
│   ├── Skeleton.tsx              # shimmer, 10+ presets
│   ├── EmptyState.tsx            # 3 variants
│   ├── ErrorState.tsx
│   ├── ErrorBoundary.tsx         # 5가지 세분화
│   ├── Toast.tsx
│   ├── ToastManager.tsx
│   ├── InAppBanner.tsx
│   ├── InAppModal.tsx
│   ├── Modal.tsx
│   ├── BottomSheet.tsx
│   ├── ActionSheet.tsx
│   ├── ModalManager.tsx
│   ├── FormField.tsx
│   ├── FormSection.tsx
│   ├── FormSelect.tsx
│   ├── Checkbox.tsx
│   ├── Radio.tsx
│   ├── DatePicker.tsx
│   ├── TimePicker.tsx
│   ├── TimeWheelPicker.tsx
│   ├── CalendarPicker.tsx
│   ├── MobileHeader.tsx
│   ├── OptimizedImage.tsx        # expo-image, Blurhash
│   ├── CircularProgress.tsx
│   ├── InAppMessageManager.tsx
│   ├── OfflineBanner.tsx         # 3 variants
│   ├── Accordion.tsx
│   └── index.ts
│
├── auth/ (15개)                   # 인증
├── jobs/ (19개)                   # 구인공고
├── employer/ (62개)               # 구인자 ⭐ 가장 많음
├── schedule/ (11개)               # 스케줄
├── qr/ (4개)                      # QR 코드
├── notifications/ (8개)           # 알림
├── admin/ (15개)                  # 관리자
├── support/ (7개)                 # 고객지원
├── profile/ (12개)                # 프로필
├── settings/ (8개)                # 설정
├── common/ (18개)                 # 공통
└── forms/ (12개)                  # 폼 컴포넌트
```

### 4.2 라우트 구조 (68개)

```
app/                               # 68개 라우트
├── _layout.tsx                   # Root Layout (5단계 Provider)
├── index.tsx                     # 스플래시 화면
├── +not-found.tsx                # 404 페이지
│
├── (public)/                     # 비로그인 접근 가능
│   └── jobs/                     # 공고 목록/상세 (읽기 전용)
│
├── (auth)/                       # 인증 플로우
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
│
├── (app)/                        # 로그인 필수 (staff+)
│   ├── (tabs)/                   # 탭 네비게이션 (5개)
│   │   ├── index.tsx             # 구인구직 (홈)
│   │   ├── schedule.tsx          # 내 스케줄
│   │   ├── qr.tsx                # QR 스캔
│   │   ├── employer.tsx          # 내 공고 (구인자용)
│   │   └── profile.tsx           # 프로필
│   ├── jobs/[id]/                # 공고 상세/지원
│   ├── applications/             # 지원 내역
│   ├── notifications.tsx         # 알림
│   ├── notices/                  # 공지사항
│   ├── support/                  # 고객지원
│   └── settings/                 # 설정
│
├── (employer)/                   # 구인자 전용
│   └── my-postings/              # 공고관리, 지원자관리, 정산
│
└── (admin)/                      # 관리자 전용
    ├── users/                    # 사용자 관리
    ├── reports/                  # 신고 관리
    ├── announcements/            # 공지 관리
    ├── tournaments/              # 대회공고 승인
    ├── inquiries/                # 문의 관리
    └── stats/                    # 통계
```

### 4.3 서비스 상세 (45개)

```yaml
Core (10개):
  - authService (17.2KB): 로그인/회원가입/소셜로그인
  - jobService (9.6KB): 공고 조회/필터링/검색
  - applicationService (30.7KB): 지원 트랜잭션 (v2.0 Assignment) ⭐
  - scheduleService (24.1KB): WorkLogs + Applications 병합
  - workLogService (20.1KB): 근무 기록
  - notificationService (16.4KB): 알림 조회/읽음처리
  - reportService (15.4KB): 양방향 신고 시스템
  - userService (11.8KB): 사용자 프로필
  - profileService (8.2KB): 프로필 CRUD
  - bookmarkService (6.3KB): 북마크 관리

Employer (6개):
  - jobManagementService (26.9KB): 공고 생성/수정/삭제
  - applicantManagementService (23.4KB): 지원자 확정/거절
  - settlementService (36.3KB): 정산 계산/처리 ⭐ 가장 큼
  - confirmedStaffService (20KB): 확정 스태프 관리
  - applicationHistoryService (25.3KB): 확정/취소 이력
  - templateService (8.6KB): 공고 템플릿

Admin (5개):
  - adminService (12.5KB): 사용자 관리
  - announcementService (14.7KB): 공지 관리
  - tournamentApprovalService (11.3KB): 대회공고 승인
  - inquiryService (10.3KB): 문의 관리
  - statsService (7.8KB): 통계

Infrastructure (24개):
  - pushNotificationService (20.5KB): FCM 토큰 관리
  - eventQRService (17KB): QR 생성/검증 (3분 유효)
  - deepLinkService (18.4KB): 딥링크 라우팅
  - storageService (11.9KB): MMKV + SecureStore
  - sessionService (14.6KB): 토큰 관리
  - analyticsService (11.2KB): 이벤트 추적
  - crashlyticsService (11.2KB): 에러 로깅
  - performanceService (9.3KB): 성능 모니터링
  - featureFlagService (7.8KB): 기능 플래그
  - cacheService (6.6KB): 캐시 관리/무효화
  - imageService (8.4KB): 이미지 업로드
  - exportService (9.1KB): 데이터 내보내기
  - accountDeletionService (13.2KB): 계정 삭제
  - inAppMessageService (9.5KB): 인앱 메시지
  - applicantConversionService (19KB): 지원자 변환
  - jobPostingMigration (9.5KB): 공고 마이그레이션
  - biometricService (12.3KB): 생체인증
  - networkService (5.8KB): 네트워크 상태
  - validationService (7.2KB): 입력 검증
  - securityService (11.5KB): 보안 검증
  - themeService (4.5KB): 테마 관리
  - localeService (5.2KB): 로케일 관리
  - logService (6.8KB): 로깅
  - errorService (8.9KB): 에러 처리
```

### 4.4 커스텀 훅 상세 (40개)

```yaml
App (2):
  - useAppInitialize (13.3KB): Firebase 인증 상태, 초기화
  - useVersionCheck: 앱 버전 확인

Auth (4):
  - useAuth: 인증 상태 통합
  - useAuthGuard: 라우트별 권한 가드
  - useAutoLogin: 자동 로그인
  - useBiometricAuth: 생체인증

Jobs (4):
  - useJobPostings: 무한스크롤 공고 목록
  - useJobDetail: 공고 상세
  - useJobManagement: 공고 CRUD
  - usePostingTypeCounts: 타입별 공고 개수

Applications (2):
  - useApplications: 지원 제출/취소 (Optimistic Update)
  - useAssignmentSelection: 날짜별 선택/취소

Schedule (8):
  - useSchedules (12.1KB): 스케줄 목록
  - useSchedulesByMonth: 월별 스케줄
  - useSchedulesByDate: 일별 스케줄
  - useTodaySchedules: 오늘 스케줄
  - useUpcomingSchedules: 예정 스케줄
  - useScheduleDetail: 스케줄 상세
  - useScheduleStats: 스케줄 통계
  - useCalendarView: 캘린더 뷰

WorkLog (2):
  - useWorkLogs: 근무 기록
  - useWorkLogStats: 근무 통계

QR (2):
  - useQRCode: QR 생성
  - useEventQR: 이벤트 QR 검증

Notification (5):
  - useNotifications: 알림 목록
  - useNotificationHandler: 알림 처리
  - usePushNotifications: FCM 토큰
  - useUnreadCountRealtime: 실시간 미읽음
  - useMarkAsRead: 읽음 처리

Employer (5):
  - useApplicantManagement: 지원자 관리
  - useSettlement (13.2KB): 정산
  - useConfirmedStaff: 확정 스태프
  - useTemplateManager: 템플릿 관리
  - useBookmarks: 북마크

Admin (3):
  - useAdminDashboard: 대시보드
  - useTournamentApproval: 대회 승인
  - useAnnouncement: 공지 관리

Infrastructure (3):
  - useNetworkStatus: 네트워크 상태 (NetInfo + navigator.onLine)
  - useDeepLink: 딥링크 라우팅
  - useClearCache: 캐시 제거
```

---

## 5. 핵심 개선 사항

### 5.1 Repository 패턴 도입

```typescript
// app2/에서의 문제점
// ❌ Service에서 Firebase 직접 호출 (테스트 어려움)
class StaffService {
  async getById(id: string) {
    const docRef = doc(db, 'staff', id);  // Firebase 직접 호출
    const snapshot = await getDoc(docRef);
    return snapshot.data();
  }
}

// uniqn-mobile/에서의 해결
// ✅ Repository 인터페이스 정의
interface IStaffRepository {
  findById(id: string): Promise<Staff | null>;
  findAll(options?: QueryOptions): Promise<Staff[]>;
  create(data: CreateStaffDTO): Promise<Staff>;
  update(id: string, data: Partial<Staff>): Promise<void>;
  delete(id: string): Promise<void>;
}

// ✅ Firebase 구현체 분리
class FirebaseStaffRepository implements IStaffRepository {
  async findById(id: string): Promise<Staff | null> {
    const docRef = doc(db, 'staff', id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() as Staff : null;
  }
}

// ✅ Service는 Repository 인터페이스만 의존
class StaffService {
  constructor(private repository: IStaffRepository) {}

  async getById(id: string): Promise<Staff | null> {
    return this.repository.findById(id);
  }
}
```

### 5.2 Repository 구현 현황 (15개)

```yaml
인터페이스 (src/repositories/interfaces/):
  - IApplicationRepository.ts
  - IJobPostingRepository.ts
  - IWorkLogRepository.ts
  - IUserRepository.ts
  - INotificationRepository.ts
  - ISettlementRepository.ts
  - IReportRepository.ts
  - IAnnouncementRepository.ts

구현체 (src/repositories/firebase/):
  - ApplicationRepository.ts (24.5KB)
  - JobPostingRepository.ts (18.3KB)
  - WorkLogRepository.ts (15.8KB)
  - UserRepository.ts (11.2KB)
  - NotificationRepository.ts (12.6KB)
  - SettlementRepository.ts (16.7KB)
  - ReportRepository.ts (9.8KB)
```

### 5.3 Shared 모듈 도입 (33개)

```
src/shared/                        # 33개 파일
├── errors/ (3개)
│   ├── hookErrorHandler.ts       # 훅 에러 처리 유틸리티
│   ├── serviceErrorHandler.ts    # 서비스 에러 처리
│   └── errorMessages.ts          # 에러 메시지 상수
│
├── id/ (4개)
│   ├── IdNormalizer.ts           # ID 정규화 ('job_123' → 'job123')
│   ├── IdGenerator.ts            # 고유 ID 생성
│   ├── IdValidator.ts            # ID 형식 검증
│   └── index.ts
│
├── realtime/ (4개)
│   ├── RealtimeManager.ts        # Firebase 실시간 구독 관리
│   ├── SubscriptionRegistry.ts   # 구독 등록/해제
│   ├── ConnectionMonitor.ts      # 연결 상태 모니터링
│   └── index.ts
│
├── role/ (4개)
│   ├── RoleResolver.ts           # 권한 계산 (profile → UserRole)
│   ├── RoleHierarchy.ts          # 역할 계층 정의
│   ├── PermissionChecker.ts      # 권한 확인 유틸리티
│   └── index.ts
│
├── status/ (5개)
│   ├── StatusMapper.ts           # 상태 전이 규칙
│   ├── ApplicationStatus.ts      # 지원 상태 흐름
│   ├── WorkLogStatus.ts          # 근무 기록 상태
│   ├── SettlementStatus.ts       # 정산 상태
│   └── index.ts
│
├── time/ (5개)
│   ├── TimeNormalizer.ts         # 시간 정규화 (Date ↔ Timestamp)
│   ├── DateRangeBuilder.ts       # 날짜 범위 빌더
│   ├── TimeZoneHandler.ts        # 시간대 처리
│   ├── DurationCalculator.ts     # 기간 계산
│   └── index.ts
│
├── validation/ (4개)
│   ├── InputSanitizer.ts         # XSS 방지 입력 정화
│   ├── SchemaValidator.ts        # Zod 스키마 검증 래퍼
│   ├── BusinessRuleValidator.ts  # 비즈니스 규칙 검증
│   └── index.ts
│
└── cache/ (4개)
    ├── QueryKeyFactory.ts        # Query Key 생성 팩토리
    ├── CacheInvalidator.ts       # 캐시 무효화 유틸리티
    ├── StaleTimeConfig.ts        # staleTime 설정
    └── index.ts
```

### 5.4 에러 처리 체계화

```typescript
// app2/에서의 문제점
// ❌ try-catch에서 다양한 처리
try {
  await submitApplication();
} catch (error) {
  console.error(error);
  alert('오류가 발생했습니다');
}

// uniqn-mobile/에서의 해결
// ✅ AppError 계층 구조
export class AppError extends Error {
  constructor(
    public code: string,           // E1001, E6002 등
    public category: ErrorCategory,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public userMessage: string,    // 사용자 친화적 메시지
    public isRetryable: boolean
  ) {}
}

// ✅ 도메인별 구체적 에러
export class AlreadyAppliedError extends AppError {
  constructor(jobPostingId: string) {
    super('E6001', 'BUSINESS', 'medium', '이미 지원한 공고입니다', false);
  }
}

export class MaxCapacityReachedError extends AppError {
  constructor() {
    super('E6002', 'BUSINESS', 'medium', '모집 정원이 마감되었습니다', false);
  }
}

// ✅ 에러 코드 체계
// E1xxx: 네트워크 (OFFLINE, TIMEOUT)
// E2xxx: 인증 (INVALID_CREDENTIALS, TOKEN_EXPIRED)
// E3xxx: 검증 (REQUIRED, FORMAT)
// E4xxx: Firebase (PERMISSION_DENIED, NOT_FOUND)
// E5xxx: 보안 (XSS_DETECTED)
// E6xxx: 비즈니스 (ALREADY_APPLIED, MAX_CAPACITY)
// E7xxx: 알 수 없는 에러
```

### 5.5 Query Keys 중앙 관리 (14개 도메인)

```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  user: { all, current, profile },
  jobPostings: { all, lists, list, details, detail, mine },
  applications: { all, lists, list, detail, mine, byJobPosting },
  schedules: { all, list, mine, byDate, byMonth },
  workLogs: { all, mine, byDate, bySchedule },
  notifications: { all, list, unread, unreadCount },
  settings: { all, user, notification },
  jobManagement: { all, myPostings, stats },
  applicantManagement: { all, byJobPosting, stats, cancellationRequests },
  settlement: { all, byJobPosting, summary, mySummary, calculation },
  confirmedStaff: { all, byJobPosting, byDate, detail, grouped },
  templates: { all, list, detail },
  eventQR: { all, current, history },
  reports: { all, byJobPosting, byStaff },
  admin: { all, dashboard, users, userDetail, metrics },
  tournaments: { all, pending, approved, rejected, detail },
  announcements: { all, published, adminList, detail, unreadCount },
};
```

---

## 6. 컴포넌트 매핑

### 6.1 기본 요소 변환

| React (Web) | React Native | NativeWind |
|-------------|--------------|------------|
| `<div>` | `<View>` | className 유지 |
| `<span>`, `<p>`, `<h1>` | `<Text>` | className 유지 |
| `<button>` | `<Pressable>` | className 유지 |
| `<input>` | `<TextInput>` | className 유지 |
| `<img>` | `<Image>` (expo-image) | - |
| `<a>` | `<Link>` (expo-router) | - |
| `<ul>`, `<ol>` | `<FlashList>` | - |
| `<form>` | `<View>` + Handlers | - |

### 6.2 UI 컴포넌트 매핑

| app2/ | uniqn-mobile/ | 변경 사항 |
|-------|---------------|----------|
| `components/ui/Button.tsx` | `components/ui/Button.tsx` | Pressable, Haptics |
| `components/ui/Input.tsx` | `components/ui/Input.tsx` | TextInput |
| `components/ui/Card.tsx` | `components/ui/Card.tsx` | shadow 스타일 |
| `components/ui/Modal.tsx` | `components/ui/Modal.tsx` | Reanimated |
| `components/ui/Dropdown.tsx` | `components/ui/BottomSheet.tsx` | @gorhom/bottom-sheet |
| `components/ui/Table.tsx` | `components/ui/DataTable.tsx` | FlashList 기반 |
| `components/common/LoadingSpinner.tsx` | `components/ui/Loading.tsx` | ActivityIndicator |
| `components/common/ErrorMessage.tsx` | `components/ui/ErrorState.tsx` | 재시도 버튼 포함 |

### 6.3 기능 컴포넌트 매핑

| app2/ | uniqn-mobile/ | 상태 |
|-------|---------------|------|
| `components/job/JobCard.tsx` | `components/jobs/JobCard.tsx` | ✅ 완료 |
| `components/job/JobList.tsx` | `components/jobs/JobList.tsx` | ✅ FlashList |
| `components/job/JobFilters.tsx` | `components/jobs/JobFilters.tsx` | ✅ BottomSheet |
| `components/staff/StaffCard.tsx` | `components/employer/StaffCard.tsx` | ✅ 완료 |
| `components/schedule/Calendar.tsx` | `components/schedule/CalendarView.tsx` | ✅ 완료 |
| `components/payment/PaymentForm.tsx` | `components/employer/settlement/SettlementForm.tsx` | ✅ 완료 |
| `components/qr/QRScanner.tsx` | `components/qr/QRCodeScanner.tsx` | ✅ 웹/네이티브 분기 |

---

## 7. 서비스 매핑

### 7.1 100% 재사용 (순수 로직)

| app2/ | uniqn-mobile/ | 비고 |
|-------|---------------|------|
| `utils/payrollCalculations.ts` | `utils/payrollCalculations.ts` | 정산 계산 |
| `utils/dateUtils.ts` | `utils/dateUtils.ts` | date-fns |
| `utils/formatters.ts` | `utils/formatters.ts` | 문자열 포맷 |
| `utils/validators.ts` | `utils/validators.ts` | Zod 스키마 |

### 7.2 90% 재사용 (import 변경)

| app2/ | uniqn-mobile/ | 변경 사항 |
|-------|---------------|----------|
| `services/staffService.ts` | `services/staffService.ts` | Repository 패턴 |
| `services/jobService.ts` | `services/jobService.ts` | Repository 패턴 |
| `services/authService.ts` | `services/authService.ts` | Firebase Modular |

### 7.3 새로 작성

| uniqn-mobile/ | 설명 | 크기 |
|---------------|------|------|
| `services/applicationService.ts` | v2.0 Assignment 지원 시스템 | 30.7KB |
| `services/settlementService.ts` | 정산 계산/처리 | 36.3KB |
| `services/eventQRService.ts` | QR 생성/검증 (3분 유효) | 17KB |
| `services/pushNotificationService.ts` | FCM 토큰 관리 | 20.5KB |
| `services/deepLinkService.ts` | 딥링크 라우팅 | 18.4KB |

---

## 8. 훅 매핑

### 8.1 그대로 사용 가능

```typescript
// 플랫폼 독립적 훅
useDebounce.ts      // ✅ 그대로
useAsync.ts         // ✅ 그대로
useForm.ts          // ✅ react-hook-form 사용
useLocalStorage.ts  // → useMmkvStorage.ts (MMKV로 대체)
```

### 8.2 플랫폼 수정 필요

```typescript
// useMediaQuery.ts (Web)
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(
    window.matchMedia(query).matches  // ❌ window 사용
  );
  // ...
};

// useResponsive.ts (React Native)
import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
```

### 8.3 Firebase 훅 변환

```typescript
// app2/ (Web Firebase SDK)
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';

// uniqn-mobile/ (Firebase Modular API)
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';  // 지연 초기화 Proxy

// TanStack Query와 통합
export function useJobPostings(filters: JobFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.jobPostings.list(filters),
    queryFn: ({ pageParam }) => jobService.getList(filters, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: cachingPolicies.frequent,  // 2분
    networkMode: 'offlineFirst',          // 오프라인 우선
  });
}
```

---

## 9. 상태 관리 변환

### 9.1 Context → Zustand 변환

| app2/ Context | uniqn-mobile/ Zustand | 상태 |
|--------------|----------------------|------|
| `AuthContext` | `authStore` | ✅ 완료 |
| `TournamentContext` | (Phase 3) | 🔲 미완료 |
| `ChipContext` | (Phase 3) | 🔲 미완료 |
| `ThemeContext` | `themeStore` | ✅ 완료 |
| `ToastContext` | `toastStore` | ✅ 완료 |
| `ModalContext` | `modalStore` | ✅ 완료 |

### 9.2 Zustand 스토어 (9개)

```yaml
authStore (12.9KB):
  - user, profile, status
  - isAdmin, isEmployer, isStaff
  - MMKV 영구 저장

themeStore (3.3KB):
  - mode (light|dark|system)
  - NativeWind colorScheme 연동

toastStore (4.2KB):
  - toasts[] (최대 3개)
  - toast.success/error/info

modalStore (5.4KB):
  - 모달 스택 관리
  - showAlert, showConfirm

notificationStore (12.9KB):
  - notifications[], unreadCount
  - 카테고리별 필터

inAppMessageStore (6.9KB):
  - 우선순위 큐
  - 세션당 1회 표시

bookmarkStore (5.7KB):
  - 북마크 저장/삭제
  - MMKV 영구 저장

networkStore (3.1KB):
  - isOnline, connectionType
  - 자동 감지

filterStore (4.8KB):
  - 공고 필터 상태
  - 검색어, 지역, 급여
```

### 9.3 TanStack Query 설정

```typescript
// src/lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5분
      gcTime: 30 * 60 * 1000,          // 30분
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      networkMode: 'offlineFirst',      // 오프라인 우선
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// 캐싱 정책 (5단계)
export const cachingPolicies = {
  realtime: 0,                    // 항상 fresh
  frequent: 2 * 60 * 1000,        // 2분
  standard: 5 * 60 * 1000,        // 5분
  stable: 30 * 60 * 1000,         // 30분
  offlineFirst: Infinity,         // 무제한
};
```

---

## 10. 데이터 접근 계층

### 10.1 Repository 패턴 적용

```
┌─────────────────────────────────────────────┐
│  Hooks/Components                           │
│  └─ useJobPostings(), useApplications()    │
├─────────────────────────────────────────────┤
│  Services                                   │
│  └─ jobService, applicationService         │
├─────────────────────────────────────────────┤
│  Repositories (Interface)                   │
│  └─ IJobPostingRepository                  │
├─────────────────────────────────────────────┤
│  Repositories (Implementation)              │
│  └─ FirebaseJobPostingRepository           │
├─────────────────────────────────────────────┤
│  Firebase (Modular API)                     │
│  └─ getDoc, setDoc, updateDoc             │
└─────────────────────────────────────────────┘
```

### 10.2 트랜잭션 처리

```typescript
// 지원하기 트랜잭션 (applicationService.ts)
async function submitApplication(
  jobPostingId: string,
  userId: string,
  selectedDates: string[]
): Promise<Application> {
  return runTransaction(db, async (transaction) => {
    // 1. 읽기 (모든 읽기를 먼저)
    const jobRef = doc(db, 'jobPostings', jobPostingId);
    const jobDoc = await transaction.get(jobRef);

    const existingAppQuery = query(
      collection(db, 'applications'),
      where('jobPostingId', '==', jobPostingId),
      where('applicantId', '==', userId)
    );
    const existingApps = await getDocs(existingAppQuery);

    // 2. 비즈니스 검증
    if (existingApps.docs.length > 0) {
      throw new AlreadyAppliedError(jobPostingId);
    }

    const job = jobDoc.data() as JobPosting;
    if (job.currentApplicants >= job.maxApplicants) {
      throw new MaxCapacityReachedError();
    }

    // 3. 쓰기 (원자적)
    const applicationRef = doc(collection(db, 'applications'));
    transaction.set(applicationRef, {
      jobPostingId,
      applicantId: userId,
      selectedDates,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    transaction.update(jobRef, {
      currentApplicants: increment(1),
    });

    return { id: applicationRef.id, ...applicationData };
  });
}
```

---

## 11. 미완료 항목

### 11.1 Phase 3 예정 (토너먼트)

```yaml
마이그레이션 필요:
  - TournamentContext → tournamentStore
  - ChipContext → chipStore
  - 토너먼트 서비스 (7개)
  - 토너먼트 컴포넌트 (25개)
  - 토너먼트 페이지 (12개)

참고 파일 (app2/):
  - src/contexts/TournamentContext.tsx
  - src/stores/tournamentStore.ts
  - src/contexts/ChipContext.tsx
  - src/services/tournament*.ts
  - src/types/tournament.ts
```

### 11.2 추가 개선 사항

```yaml
오프라인:
  - [ ] 오프라인 큐 (지원, 출퇴근)
  - [ ] 충돌 해결 전략

웹:
  - [ ] SEO 최적화
  - [ ] PWA 매니페스트
  - [ ] 서비스 워커

성능:
  - [ ] 번들 분석 및 최적화
  - [ ] 이미지 CDN
  - [ ] 코드 스플리팅 개선

테스트:
  - [ ] Repository 단위 테스트
  - [ ] Service 통합 테스트
  - [ ] E2E 테스트
```

---

## 12. 참고 자료

### 12.1 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 프로젝트 개요 | [00-overview.md](./00-overview.md) | 전체 개요 |
| 아키텍처 | [01-architecture.md](./01-architecture.md) | 상세 아키텍처 |
| 상태 관리 | [03-state-management.md](./03-state-management.md) | Zustand + Query |
| 보안 | [12-security.md](./12-security.md) | 보안 설계 |
| 오프라인 | [20-offline-caching.md](./20-offline-caching.md) | 캐싱 전략 |
| 웹 지원 | [21-react-native-web.md](./21-react-native-web.md) | RN Web 가이드 |

### 12.2 레거시 참고 (app2/)

```
app2/ (개발 중단 - 참고용만)
├── src/contexts/TournamentContext.tsx  # 토너먼트 상태 관리
├── src/stores/tournamentStore.ts       # 토너먼트 스토어
├── src/contexts/ChipContext.tsx        # 칩 잔액 관리
├── src/services/tournament*.ts         # 토너먼트 서비스
└── src/types/tournament.ts             # 토너먼트 타입
```

---

## 요약

### 마이그레이션 완료 상태

| 영역 | 파일 수 | 완료율 |
|------|--------|--------|
| **컴포넌트** | 245개 | 95% |
| **라우트** | 68개 | 100% |
| **서비스** | 45개 | 95% |
| **훅** | 40개 | 100% |
| **스토어** | 9개 | 100% |
| **리포지토리** | 15개 | 100% |
| **공유 모듈** | 33개 | 100% |
| **타입** | 23개 | 100% |
| **스키마** | 18개 | 100% |
| **에러** | 7개 | 100% |
| **전체** | 600+개 | 95% |

### 핵심 개선 요약

1. **아키텍처**: 6-레이어 → Repository 패턴 + Shared 모듈
2. **상태 관리**: Context 6개 → Zustand 9개 + TanStack Query
3. **에러 처리**: try-catch 산재 → AppError 계층 구조
4. **데이터 접근**: Firebase 직접 호출 → Repository 추상화
5. **타입 안정성**: TypeScript 4.9 → 5.9.2 strict mode
6. **캐싱**: 없음 → 5단계 캐싱 정책 + 오프라인 우선

---

*마지막 업데이트: 2026-02-02*
*버전: v1.0.0*
