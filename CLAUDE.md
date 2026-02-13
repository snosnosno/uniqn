# CLAUDE.md

**UNIQN 프로젝트 개발 가이드** - Claude Code 전용

---

## 목차

1. [최우선 지침](#최우선-지침)
2. [프로젝트 개요](#프로젝트-개요)
3. [공통 규칙](#공통-규칙)
4. [모바일앱 개발 가이드 (uniqn-mobile/)](#모바일앱-개발-가이드-uniqn-mobile)
5. [품질 지표](#품질-지표)
6. [주요 문서 참조](#주요-문서-참조)
7. [레거시 웹앱 참고 (app2/)](#레거시-웹앱-참고-app2)

---

## 최우선 지침

### 필수 규칙 (모든 작업에서 반드시 준수)

```yaml
언어: 항상 한글로 답변
작업 디렉토리: uniqn-mobile/  # React Native + Expo (주력)
레거시 참고: app2/            # 토너먼트 로직 참고용 (개발 중단)
배포 전 검증: npm run quality  # type-check + lint + format:check
```

| 규칙 | 올바른 예 | 금지 예 |
|------|----------|---------|
| **로깅** | `logger.info('메시지', { context })` | `console.log()` |
| **타입** | `const data: StaffData = {...}` | `const data: any = {...}` |
| **다크모드** | `dark:bg-gray-800` (NativeWind/Tailwind) | 라이트 모드만 적용 |
| **경로** | `import { util } from '@/utils/util'` | 절대 시스템 경로 사용 |
| **알림** | `toast.success('완료')` | `alert('완료')` |
| **필드명** | `staffId`, `eventId` | `staff_id`, `event_id` |

---

## 프로젝트 개요

**UNIQN** - 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼

- **프로젝트 ID**: tholdem-ebc18
- **모바일앱 버전**: v1.0.0
- **플랫폼**: iOS, Android, Web (Expo)

### 프로젝트 구조

```
T-HOLDEM/
├── uniqn-mobile/            # 모바일앱 (React Native + Expo) ⭐ 주력
│   ├── app/                 # Expo Router (68개 라우트)
│   └── src/                 # 소스 코드 (497+ 파일, 테스트 제외)
│       ├── components/      # UI 컴포넌트 (245개, 20개 폴더)
│       ├── hooks/           # Custom Hooks (49개)
│       ├── services/        # 비즈니스 서비스 (43개)
│       ├── stores/          # Zustand Stores (8개)
│       ├── repositories/    # Repository 패턴 (22개: 인터페이스 11 + 구현체 11)
│       ├── shared/          # 공유 모듈 (26개, 9개 도메인)
│       ├── domains/         # 도메인 로직 (14개)
│       ├── types/           # 타입 정의 (27개)
│       ├── schemas/         # Zod 스키마 (18개)
│       ├── errors/          # 에러 시스템 (8개)
│       ├── utils/           # 유틸리티 (37개)
│       ├── lib/             # 라이브러리 설정 (7개)
│       ├── constants/       # 상수 (10개)
│       └── config/          # 설정 (3개)
│
├── functions/               # Firebase Functions
├── specs/                   # 스펙 문서
│   └── react-native-app/    # RN 앱 스펙 (25개 문서)
├── docs/                    # 운영 문서 (44개, 대부분 레거시)
└── app2/                    # [레거시] 웹앱 - 토너먼트 로직 참고용
```

### 기술 스택

```yaml
Core:
  - Expo SDK: 54
  - React Native: 0.81.5
  - React: 19.1.0
  - TypeScript: 5.9.2 (strict 모드)

Navigation & State:
  - Expo Router: 6.0.23 (파일 기반 라우팅)
  - Zustand: 5.0.9 (전역 상태)
  - TanStack Query: 5.90.12 (서버 상태)

UI/Styling:
  - NativeWind: 4.2.1 (Tailwind CSS)
  - @shopify/flash-list: 2.0.2 (가상화 리스트)
  - expo-image: 3.0.11 (이미지 최적화)
  - @gorhom/bottom-sheet: 5.2.8

Backend:
  - Firebase: 12.6.0 (Modular API)

Payment:
  - RevenueCat: 인앱 결제 (App Store/Google Play)

Forms & Validation:
  - React Hook Form: 7.68.0
  - Zod: 4.1.13
```

---

## 공통 규칙

### 1. 역할 체계 (통합)

```typescript
// 공통 역할 정의 (3개만 운영 중)
type UserRole = 'admin' | 'employer' | 'staff';

// 권한 계층
const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,      // 전체 관리 (모든 권한)
  employer: 50,    // 구인자 (공고 관리, 지원자 관리, 정산)
  staff: 10,       // 스태프 (지원, 스케줄 확인, QR 출퇴근)
};

// 권한 확인
function hasPermission(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  return USER_ROLE_HIERARCHY[userRole] >= USER_ROLE_HIERARCHY[required];
}
```

**역할별 기능**:
| 역할 | 권한 레벨 | 기능 |
|------|----------|------|
| `admin` | 100 | 사용자/신고/공지/대회 관리 |
| `employer` | 50 | 공고 CRUD, 지원자 관리, 정산 |
| `staff` | 10 | 지원, 스케줄, QR 출퇴근 |

> **하위 호환성**: Firestore에 `manager` 역할이 남아있는 경우 `employer`로 자동 매핑됩니다 (`RoleResolver.normalizeUserRole()`).
> 비로그인 사용자는 `(public)` 라우트에서 공고 열람만 가능합니다.

> **주의: UserRole vs StaffRole 구분**
> - `UserRole`: 앱 기능 접근 권한 (`admin`, `employer`, `staff`)
> - `StaffRole`: 포커룸 직무 역할 (`dealer`, `floor`, `serving`, `manager`, `staff`, `other`)
> - StaffRole의 `manager`는 포커룸 매니저 직무이며, UserRole과는 별개입니다.

---

### 2. 보안 규칙

#### 입력 검증 (Zod + XSS 방지)

```typescript
import { z } from 'zod';
import { xssValidation, sanitizeHtml } from '@/utils/security';

const formSchema = z.object({
  title: z.string()
    .min(2, '최소 2자')
    .max(100, '최대 100자')
    .refine(xssValidation, 'XSS 차단'),
  content: z.string()
    .transform(sanitizeHtml),
});

// 사용
const result = formSchema.safeParse(input);
if (!result.success) {
  logger.warn('검증 실패', { errors: result.error.flatten() });
  return;
}
```

#### 비밀번호 정책

- 최소 8자, 최대 128자
- 대문자/소문자/숫자/특수문자 각 1개 이상
- 3자 이상 연속 금지 (`123`, `abc`)

#### 보안 체크리스트

- [ ] 모든 사용자 입력에 Zod 스키마 적용
- [ ] HTML 출력 시 새니타이징 (DOMPurify/자체 구현)
- [ ] Firebase Security Rules로 문서 레벨 접근 제어
- [ ] 민감한 데이터는 secureStorage 사용
- [ ] API 키는 환경변수로 관리

---

### 3. Git 커밋 컨벤션

```
<타입>: <제목> (한글)

타입:
- feat: 새로운 기능
- fix: 버그 수정
- refactor: 리팩토링
- style: 스타일/UI 변경
- docs: 문서 수정
- test: 테스트 추가/수정
- chore: 기타 (빌드, 설정)
- perf: 성능 개선

예시:
feat: 구인공고 필터링 기능 추가
fix: 다크모드 토글 버그 수정
refactor: useStaffData Hook 성능 최적화
perf: 리스트 렌더링 최적화 (React.memo 적용)
```

---

### 4. 네이밍 컨벤션

```typescript
// 파일명
ComponentName.tsx      // 컴포넌트 (PascalCase)
useHookName.ts        // 훅 (camelCase, use 접두사)
serviceName.ts        // 서비스 (camelCase)
typeName.ts           // 타입 (camelCase)

// 변수/함수
const staffId = '...';           // camelCase
const handleSubmit = () => {};   // handle 접두사 (이벤트 핸들러)
const isLoading = true;          // is/has/can 접두사 (불리언)

// 타입/인터페이스
interface StaffData {}           // PascalCase
type WorkLogStatus = 'pending';  // PascalCase
```

---

### 5. 표준 필드명 (Firebase)

| 컬렉션 | 핵심 필드 |
|--------|-----------|
| staff | staffId, name, role, userId |
| workLogs | staffId, eventId, date, role |
| applications | eventId, applicantId, status |
| jobPostings | id, title, location, salary |
| notifications | userId, type, isRead, data |
| settlements | jobPostingId, staffId, amount, status |

---

### 6. 의존성 규칙

#### 새 의존성 추가 전 확인

```bash
# 1. 기존 유틸리티로 해결 가능한지 확인
# 2. 번들 크기 영향 분석
npm run analyze:bundle

# 3. TypeScript 타입 지원 확인
# 4. 유지보수 상태 확인
```

#### 금지된 패턴

```typescript
// ❌ 직접 import 금지 (번들 크기 증가)
import _ from 'lodash';

// ✅ 필요한 함수만 import
import debounce from 'lodash/debounce';

// ❌ moment.js 금지 (date-fns 사용)
```

---

### 7. Firebase 트랜잭션 규칙

**트랜잭션 필수 사용 케이스**:
```typescript
// ❌ 금지: 여러 문서를 개별 업데이트 (데이터 불일치 위험)
await updateDoc(applicationRef, { status: 'accepted' });
await updateDoc(jobPostingRef, { applicantCount: increment(1) });

// ✅ 필수: runTransaction으로 원자적 처리
await runTransaction(db, async (transaction) => {
  // 1. 모든 읽기 먼저
  const applicationDoc = await transaction.get(applicationRef);
  const jobPostingDoc = await transaction.get(jobPostingRef);

  // 2. 비즈니스 검증
  if (currentCount >= maxApplicants) {
    throw new MaxCapacityReachedError();
  }

  // 3. 모든 쓰기 실행 (원자적)
  transaction.update(applicationRef, { status: 'accepted' });
  transaction.update(jobPostingRef, { applicantCount: currentCount + 1 });
});
```

**트랜잭션 필수 시나리오**:
| 시나리오 | 관련 문서 | 이유 |
|---------|----------|------|
| 지원하기 | applications, jobPostings | 중복 체크 + 카운트 |
| 지원 취소 | applications, jobPostings | 카운트 정합성 |
| QR 출퇴근 | workLogs, applications | 중복 방지 |
| 정산 처리 | workLogs, settlements | 금액 정합성 |

---

## 모바일앱 개발 가이드 (uniqn-mobile/)

> React Native + Expo 기반 모바일앱 개발 가이드

### 프로젝트 현황

```yaml
버전: 1.0.0
상태: Phase 2 완료 (인증 + 구인구직 + Repository 패턴)
```

| 카테고리 | 파일 수 | 설명 |
|---------|--------|------|
| **Routes (app/)** | 68 | Expo Router 라우트 파일 |
| **Components** | 245 | UI 50개 + 기능별 195개 (20개 폴더) |
| **Hooks** | 49 | 커스텀 훅 |
| **Services** | 43 | 비즈니스 로직 서비스 |
| **Stores** | 8 | Zustand 전역 상태 |
| **Types** | 27 | TypeScript 타입 정의 |
| **Schemas** | 18 | Zod 검증 스키마 |
| **Repositories** | 22 | Repository 패턴 (인터페이스 11 + 구현체 11) |
| **Shared** | 26 | 공유 유틸리티 (ID, Role, Status, Time, DeepLink, Firestore, Cache) |
| **Domains** | 14 | 도메인 로직 (Application, Schedule, Settlement 등) |
| **Errors** | 8 | 에러 시스템 (AppError 계층) |
| **Utils** | 37 | 유틸리티 함수 |
| **전체 TypeScript** | **565+** | src (497+) + app (68) 합계, 테스트 제외 |

### 폴더 구조

```
uniqn-mobile/
├── app/                           # Expo Router (68개 라우트)
│   ├── _layout.tsx               # Root Layout (5단계 Provider)
│   ├── index.tsx                 # 스플래시 화면
│   ├── +not-found.tsx            # 404 페이지
│   ├── (public)/                 # 비로그인 접근 가능
│   │   └── jobs/                 # 공고 목록/상세 (읽기 전용)
│   ├── (auth)/                   # 인증 플로우
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (app)/                    # 로그인 필수 (staff+)
│   │   ├── (tabs)/               # 탭 네비게이션 (5개)
│   │   │   ├── index.tsx         # 구인구직 (홈)
│   │   │   ├── schedule.tsx      # 내 스케줄
│   │   │   ├── qr.tsx            # QR 스캔
│   │   │   ├── employer.tsx      # 내 공고 (구인자용)
│   │   │   └── profile.tsx       # 프로필
│   │   ├── jobs/[id]/            # 공고 상세/지원
│   │   ├── applications/         # 지원 내역
│   │   ├── notifications.tsx     # 알림
│   │   ├── notices/              # 공지사항
│   │   ├── support/              # 고객지원
│   │   └── settings/             # 설정
│   ├── (employer)/               # 구인자 전용
│   │   └── my-postings/          # 공고관리, 지원자관리, 정산
│   └── (admin)/                  # 관리자 전용
│       ├── users/                # 사용자 관리
│       ├── reports/              # 신고 관리
│       ├── announcements/        # 공지 관리
│       ├── tournaments/          # 대회공고 승인
│       ├── inquiries/            # 문의 관리
│       └── stats/                # 통계
│
├── src/
│   ├── components/               # 245개 (20개 폴더)
│   │   ├── ui/                   # 기본 UI (50개)
│   │   ├── employer/             # 구인자 (88개) ⭐ 가장 많음
│   │   ├── jobs/                 # 구인공고 (23개)
│   │   ├── schedule/             # 스케줄 (15개)
│   │   ├── admin/                # 관리자 (15개)
│   │   ├── auth/                 # 인증 (13개)
│   │   ├── notifications/        # 알림 (8개)
│   │   ├── support/              # 고객지원 (7개)
│   │   ├── qr/                   # QR 코드 (4개)
│   │   └── ...                   # 기타 (applicant, headers, navigation 등 11개 폴더)
│   │
│   ├── hooks/                    # 49개 커스텀 훅
│   ├── services/                 # 43개 비즈니스 서비스
│   ├── stores/                   # 8개 Zustand 스토어
│   ├── types/                    # 27개 타입 정의
│   ├── schemas/                  # 18개 Zod 스키마
│   ├── errors/                   # 에러 시스템 (8개)
│   │   ├── AppError.ts           # 기본 에러 클래스
│   │   ├── BusinessErrors.ts     # 비즈니스 로직 에러
│   │   ├── NotificationErrors.ts # 알림 에러
│   │   ├── errorUtils.ts         # 에러 유틸리티
│   │   ├── firebaseErrorMapper.ts # Firebase 에러 변환
│   │   ├── guardErrors.ts        # 가드 에러
│   │   └── serviceErrorHandler.ts # 서비스 에러 처리
│   │
│   ├── repositories/             # 22개 (Repository 패턴) ⭐
│   │   ├── interfaces/           # Repository 인터페이스 (11개)
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
│   │   └── firebase/             # Firebase 구현체 (11개)
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
│   ├── shared/                   # 26개 (공유 로직) ⭐
│   │   ├── cache/                # counterSyncCache (카운터 동기화)
│   │   ├── deeplink/             # DeepLink 공유 로직
│   │   ├── errors/               # hookErrorHandler
│   │   ├── firestore/            # Firestore 공유 유틸리티
│   │   ├── id/                   # IdNormalizer (ID 정규화)
│   │   ├── realtime/             # RealtimeManager (실시간 구독)
│   │   ├── role/                 # RoleResolver (권한 계산)
│   │   ├── status/               # StatusMapper (상태 흐름)
│   │   └── time/                 # TimeNormalizer (시간 정규화)
│   │
│   ├── domains/                  # 도메인 로직 (14개) ⭐
│   │   ├── application/          # ApplicationValidator, ApplicationStatusMachine
│   │   ├── job/                  # 공고 도메인 로직
│   │   ├── schedule/             # ScheduleMerger, ScheduleConverter, WorkLogCreator
│   │   ├── settlement/           # SettlementCalculator, TaxCalculator, SettlementCache
│   │   └── staff/                # 스태프 도메인 로직
│   │
│   ├── utils/                    # 37개 유틸리티
│   ├── lib/                      # 라이브러리 설정 (7개)
│   │   ├── queryClient.ts        # React Query + Query Keys
│   │   ├── firebase.ts           # Firebase 지연 초기화
│   │   ├── mmkvStorage.ts        # MMKV 저장소
│   │   ├── secureStorage.ts      # Secure Storage
│   │   ├── invalidationStrategy.ts # 쿼리 무효화 전략
│   │   └── env.ts                # 환경변수
│   ├── config/                   # 설정 (3개)
│   │   └── env.ts
│   └── constants/                # 상수 (10개)
│
├── __tests__/                    # 테스트
├── __mocks__/                    # 모킹 설정
└── functions/                    # Firebase Cloud Functions
```

### 아키텍처 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (app/, components/)                     │
│  └─ UI 렌더링만, 비즈니스 로직/Firebase 직접 호출 금지        │
├─────────────────────────────────────────────────────────────┤
│  Hooks Layer (49개 커스텀 훅)                               │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                   │
├─────────────────────────────────────────────────────────────┤
│  State Layer (Zustand 8개 + TanStack Query)                 │
│  └─ Zustand: UI/세션 상태  |  Query: 서버 데이터 캐싱        │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (14개 도메인 로직) ⭐                          │
│  └─ ApplicationValidator, ScheduleMerger, SettlementCalculator│
├─────────────────────────────────────────────────────────────┤
│  Shared Layer (26개 공유 모듈)                              │
│  └─ IdNormalizer, RoleResolver, StatusMapper, TimeNormalizer │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (43개 서비스)                                │
│  └─ 비즈니스 로직, Repository 호출, 에러 처리                │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer (22개: 인터페이스 11 + 구현체 11) ⭐       │
│  └─ 데이터 접근 추상화, Firebase Modular API 캡슐화          │
├─────────────────────────────────────────────────────────────┤
│  Firebase Layer (Auth, Firestore, Storage, Functions)       │
│  └─ lib/firebase.ts (지연 초기화, Proxy 패턴)               │
└─────────────────────────────────────────────────────────────┘
```

**의존성 규칙 (필수)**:
```
✅ 상위 레이어 → 하위 레이어 의존 가능
✅ 같은 레이어 내 의존 가능
❌ 하위 레이어 → 상위 레이어 의존 금지
❌ Presentation → Firebase 직접 호출 금지
❌ Hooks에서 다른 Hooks의 내부 상태 직접 수정 금지
❌ Service → Firebase 직접 호출 (Repository 통해서만)
```

### Provider 구조 (5단계)

```tsx
// app/_layout.tsx - 실제 구조
<GestureHandlerRootView>
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <BottomSheetModalProvider>
        <AppContent />  // Stack + 전역 훅 (useAuthGuard, useNotificationHandler)
        <ModalManager />
        <ToastManager />
        <InAppMessageManager />
        <OfflineBanner />  // ⭐ 네트워크 상태 표시
      </BottomSheetModalProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Zustand 스토어 (8개)

```yaml
authStore (12.9KB):
  - user, profile, status (idle|loading|authenticated|unauthenticated)
  - isAdmin, isEmployer, isStaff (계산된 플래그)
  - MMKV 영구 저장, Hydration 추적

themeStore (3.3KB):
  - mode (light|dark|system), isDarkMode
  - NativeWind colorScheme 연동
  - 시스템 테마 자동 감지

toastStore (4.2KB):
  - toasts[] (최대 3개), 자동 제거
  - toast.success/error/info 편의 메서드

modalStore (5.4KB):
  - 모달 스택 관리
  - showAlert, showConfirm, showLoading

notificationStore (12.9KB):
  - notifications[], unreadCount, settings
  - 카테고리별 읽지 않은 수
  - 필터 시스템

inAppMessageStore (6.9KB):
  - 우선순위 큐 (critical > high > medium > low)
  - 세션당 1회 표시 (sessionShownIds)
  - 영구 이력 저장

bookmarkStore (5.7KB):
  - 북마크 저장/삭제
  - 즐겨찾기 관리
  - MMKV 영구 저장

tabFiltersStore:
  - 탭별 필터 상태 관리
  - 공고 목록 필터 유지
```

### 서비스 레이어 (43개)

```yaml
Core (8개):
  - authService: 로그인/회원가입/소셜로그인
  - jobService: 공고 조회/필터링/검색
  - applicationService: 지원 트랜잭션 (v2.0 Assignment) ⭐ 가장 복잡
  - scheduleService: WorkLogs + Applications 병합
  - workLogService: 근무 기록
  - notificationService: 알림 조회/읽음처리
  - reportService: 양방향 신고 시스템
  - searchService: 통합 검색

Employer (5개):
  - jobManagementService: 공고 생성/수정/삭제
  - applicantManagementService: 지원자 확정/거절
  - settlementService: 정산 계산/처리 ⭐ 가장 큰 파일
  - confirmedStaffService: 확정 스태프 관리
  - applicationHistoryService: 확정/취소 이력

Admin (4개):
  - adminService: 사용자 관리
  - announcementService: 공지 관리
  - tournamentApprovalService: 대회공고 승인
  - inquiryService: 문의 관리

Infrastructure (25개):
  - pushNotificationService: FCM 토큰 관리
  - notificationSyncService: 알림 동기화
  - eventQRService: QR 생성/검증 (3분 유효)
  - deepLinkService: 딥링크 라우팅
  - storageService: MMKV + SecureStore
  - sessionService: 토큰 관리
  - tokenRefreshService: 토큰 갱신
  - analyticsService: 이벤트 추적
  - crashlyticsService: 에러 로깅
  - performanceService: 성능 모니터링
  - featureFlagService: 기능 플래그
  - templateService: 공고 템플릿
  - accountDeletionService: 계정 삭제
  - identityVerificationService: 본인 인증
  - inAppMessageService: 인앱 메시지
  - applicantConversionService: 지원자 변환
  - jobPostingMigration: 공고 마이그레이션
  - biometricService: 생체인증
  - cacheService: 캐시 관리
  - versionService: 앱 버전 관리
```

### 커스텀 훅 (49개)

```yaml
App (2):
  - useAppInitialize: Firebase 인증 상태, 초기화
  - useVersionCheck: 앱 버전 확인

Auth (4):
  - useAuth: 인증 상태 통합 (profile에서 권한 직접 계산)
  - useAuthGuard: 라우트별 권한 가드
  - useAutoLogin: 자동 로그인
  - useBiometricAuth: 생체인증

Jobs (6):
  - useJobPostings: 무한스크롤 공고 목록
  - useJobDetail: 공고 상세
  - useJobManagement: 공고 CRUD
  - usePostingTypeCounts: 타입별 공고 개수
  - useJobRoles: 공고 역할 관리
  - useJobSchedule: 공고 스케줄 관리

Applications (2):
  - useApplications: 지원 제출/취소 (Optimistic Update)
  - useAssignmentSelection: 선택/취소

Schedule (1):
  - useSchedules: 스케줄 목록/월별/날짜별/통계

WorkLog (1):
  - useWorkLogs: 근무 기록

QR (2):
  - useQRCode: QR 생성
  - useEventQR: 이벤트 QR

Notification (2):
  - useNotifications: 알림 목록
  - useNotificationHandler: 알림 처리

Employer (7):
  - useApplicantManagement: 지원자 관리 (applicant/ 하위 모듈)
    - useApplicantMutations: 지원자 상태 변경
    - useApplicantsByJobPosting: 공고별 지원자 조회
    - useCancellationManagement: 취소 관리
    - useStaffConversion: 스태프 변환
  - useApplicantProfiles: 지원자 프로필 조회
  - useSettlement: 정산
  - useSettlementDateNavigation: 정산 날짜 탐색
  - useConfirmedStaff: 확정 스태프
  - useTemplateManager: 템플릿 관리
  - useBookmarks: 북마크

Admin (4):
  - useAdminDashboard: 대시보드
  - useAdminReports: 신고 관리
  - useTournamentApproval: 대회 승인
  - useAnnouncement: 공지 관리

User (2):
  - useUserProfile: 프로필 관리
  - useOnboarding: 온보딩 플로우

Infrastructure (10):
  - useNavigationTracking: Analytics 추적
  - useNetworkStatus: 네트워크 상태
  - useDeepLink: 딥링크 라우팅
  - useClearCache: 캐시 제거
  - useFeatureFlag: 기능 플래그
  - useInquiry: 문의 관리
  - useRealtimeQuery: 실시간 쿼리 구독
  - useShare: 공유 기능
  - useAllowances: 수당 관리
  - useUnsavedChangesGuard: 미저장 변경 감지
```

### Query Keys 중앙 관리 (14개 도메인)

```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  // 기본
  user: { all, current, profile },
  jobPostings: { all, lists, list, details, detail, mine },
  applications: { all, lists, list, detail, mine, byJobPosting },
  schedules: { all, list, mine, byDate, byMonth },
  workLogs: { all, mine, byDate, bySchedule },
  notifications: { all, list, unread, unreadCount },
  settings: { all, user, notification },

  // 구인자용
  jobManagement: { all, myPostings, stats },
  applicantManagement: { all, byJobPosting, stats, cancellationRequests },
  settlement: { all, byJobPosting, summary, mySummary, calculation },
  confirmedStaff: { all, byJobPosting, byDate, detail, grouped },
  templates: { all, list, detail },
  eventQR: { all, current, history },
  reports: { all, byJobPosting, byStaff },

  // 관리자용
  admin: { all, dashboard, users, userDetail, metrics },
  tournaments: { all, pending, approved, rejected, detail, myPending },
  announcements: { all, published, adminList, detail, unreadCount },
};

// 캐싱 정책
export const cachingPolicies = {
  realtime: 0,              // 항상 fresh (notifications)
  frequent: 2 * 60 * 1000,  // 2분 (jobPostings.list)
  standard: 5 * 60 * 1000,  // 5분 (기본)
  stable: 30 * 60 * 1000,   // 30분 (settings)
  offlineFirst: Infinity,   // 무제한 (mySchedule)
};
```

### UI 컴포넌트 (50개)

```yaml
기본 (6):
  - Button (5 variant), Input (5 type), Card (3 variant)
  - Badge (6 variant), Avatar, Divider

상태 표시 (5):
  - Loading, LoadingOverlay
  - EmptyState (3 variant), ErrorState
  - ErrorBoundary (5가지 세분화)

스켈레톤 (1):
  - Skeleton (shimmer 애니메이션, 10+ 프리셋 포함)

피드백 (4):
  - Toast, ToastManager
  - InAppBanner, InAppModal

모달 & 시트 (4):
  - Modal (Reanimated)
  - BottomSheet, ActionSheet
  - ModalManager

폼 (8):
  - FormField, FormSection, FormSelect
  - Checkbox, Radio
  - DatePicker, TimePicker, TimeWheelPicker
  - CalendarPicker

레이아웃 (3):
  - MobileHeader
  - OptimizedImage (expo-image, Blurhash)
  - CircularProgress

기타 (4):
  - InAppMessageManager
  - OfflineBanner
  - Accordion
  - index.ts (배럴 export)
```

### 라우트 그룹별 권한

| 그룹 | 권한 | 화면 |
|------|------|------|
| `(public)` | 없음 | jobs/index, jobs/[id] |
| `(auth)` | 없음 (로그인 시 리다이렉트) | login, signup, forgot-password |
| `(app)` | staff+ | tabs/*, jobs/[id]/apply, notifications, settings |
| `(employer)` | employer+ | my-postings/*, applicants, settlements |
| `(admin)` | admin | users, reports, announcements, tournaments, stats |

**라우트 가드 패턴**:
```typescript
// app/(app)/_layout.tsx
export default function AppLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;  // useAuthGuard가 리다이렉트 처리

  return (
    <NetworkErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </NetworkErrorBoundary>
  );
}

// app/(employer)/_layout.tsx
export default function EmployerLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const hasEmployerRole = useHasRole('employer');

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!hasEmployerRole) return <Redirect href="/(app)/(tabs)" />;

  return <Stack />;
}
```

### 에러 처리 체계

```typescript
// 에러 클래스 계층 (src/errors/)
AppError (base)
├── AuthError         // E2xxx: 로그인, 토큰 만료
├── NetworkError      // E1xxx: 연결, 타임아웃
├── ValidationError   // E3xxx: 입력 검증 실패
├── PermissionError   // E4xxx: 권한 부족
└── BusinessError     // E6xxx: 비즈니스 로직
    ├── AlreadyAppliedError
    ├── ApplicationClosedError
    ├── MaxCapacityReachedError
    ├── AlreadyCheckedInError
    ├── NotCheckedInError
    ├── InvalidQRCodeError
    ├── ExpiredQRCodeError
    ├── QRSecurityMismatchError
    ├── QRWrongEventError
    ├── QRWrongDateError
    ├── AlreadySettledError
    ├── InvalidWorkLogError
    ├── DuplicateReportError
    ├── ReportNotFoundError
    ├── ReportAlreadyReviewedError
    └── CannotReportSelfError

// 에러 코드 체계
E1xxx: 네트워크 (OFFLINE, TIMEOUT, SERVER_UNREACHABLE)
E2xxx: 인증 (INVALID_CREDENTIALS, TOKEN_EXPIRED, TOO_MANY_REQUESTS)
E3xxx: 검증 (REQUIRED, FORMAT, SCHEMA)
E4xxx: Firebase (PERMISSION_DENIED, DOCUMENT_NOT_FOUND, QUOTA_EXCEEDED)
E5xxx: 보안 (XSS_DETECTED, UNAUTHORIZED_ACCESS)
E6xxx: 비즈니스 (ALREADY_APPLIED, MAX_CAPACITY, INVALID_QR 등)
E7xxx: 알 수 없는 에러

// 필수 속성
interface AppError {
  code: string;           // E1001, E6002 등
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;    // 사용자 친화적 메시지 (한글)
  isRetryable: boolean;   // 재시도 가능 여부
}
```

### Repository 패턴

```typescript
// 인터페이스 정의 (repositories/interfaces/)
interface IJobPostingRepository {
  findById(id: string): Promise<JobPosting | null>;
  findAll(options?: QueryOptions): Promise<JobPosting[]>;
  create(data: CreateJobPostingDTO): Promise<JobPosting>;
  update(id: string, data: Partial<JobPosting>): Promise<void>;
  delete(id: string): Promise<void>;
}

// Firebase 구현체 (repositories/firebase/)
class JobPostingRepository implements IJobPostingRepository {
  async findById(id: string): Promise<JobPosting | null> {
    const docRef = doc(db, 'jobPostings', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as JobPosting : null;
  }
  // ... 기타 메서드
}
```

**Repository 사용 규칙**:
```
✅ Service → Repository → Firebase (권장)
❌ Service → Firebase 직접 호출 (금지)
❌ Hooks → Firebase 직접 호출 (금지)
```

| Repository | 담당 컬렉션 | 주요 메서드 |
|------------|-----------|------------|
| AdminRepository | users (관리) | findAll, updateRole, ban |
| AnnouncementRepository | announcements | findAll, create, update, delete |
| ApplicationRepository | applications | findByJobPosting, findByUser, create, updateStatus |
| ConfirmedStaffRepository | confirmedStaff | findByJobPosting, findByDate |
| EventQRRepository | eventQR | create, validate, findCurrent |
| JobPostingRepository | jobPostings | findActive, findByEmployer, create, update |
| NotificationRepository | notifications | findByUser, markAsRead, create |
| ReportRepository | reports | create, findByTarget, updateStatus |
| SettlementRepository | settlements | findByJobPosting, create, updateStatus |
| UserRepository | users | findById, updateProfile, delete |
| WorkLogRepository | workLogs | findBySchedule, checkIn, checkOut |

### Shared 모듈 (26개, 9개 도메인)

```typescript
// ID 정규화 (shared/id/)
const normalizedId = IdNormalizer.normalize(rawId);  // 'job_123' → 'job123'

// 역할 계산 (shared/role/)
const role = RoleResolver.resolve(profile);  // UserRole

// 상태 흐름 (shared/status/)
const nextStatus = StatusMapper.getNext('pending');  // 'confirmed'

// 시간 정규화 (shared/time/)
const normalized = TimeNormalizer.toFirestore(date);  // Timestamp

// 딥링크 공유 (shared/deeplink/)
const link = DeepLinkBuilder.createJobLink(jobId);

// Firestore 공유 유틸 (shared/firestore/)
const batch = FirestoreBatchHelper.create();
```

### Import 순서 규칙

```typescript
// 1. React/React Native
import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';

// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. 내부 모듈 (절대 경로)
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { jobService } from '@/services/jobService';

// 4. 타입
import type { JobPosting } from '@/types';

// 5. 상대 경로 (같은 기능 내)
import { JobCardSkeleton } from './JobCardSkeleton';
```

### 보안 규칙 (모바일)

```typescript
// ✅ 민감 데이터: expo-secure-store
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('authToken', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// ✅ 일반 데이터: MMKV (AsyncStorage보다 30배 빠름)
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();
storage.set('preferences', JSON.stringify(prefs));

// ✅ XSS 방지: Zod refine
const messageSchema = z.string().refine(xssValidation, '위험한 문자열 감지');
```

### 성능 규칙 (모바일)

```typescript
// ✅ 리스트: FlashList (FlatList 대신)
<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={80}
/>

// ✅ 이미지: expo-image + Blurhash
<Image
  source={uri}
  placeholder={blurhash}
  cachePolicy="memory-disk"
  transition={200}
/>

// ✅ 메모이제이션
const jobs = useMemo(() => data?.pages.flatMap(p => p.items) ?? [], [data]);
const handlePress = useCallback(() => onPress(id), [id, onPress]);
```

**성능 지표**:
| 지표 | 목표 |
|------|------|
| 첫 로드 | < 2초 |
| 화면 전환 | < 300ms |
| 리스트 스크롤 | 60fps |

### 개발 명령어 (모바일)

```bash
cd uniqn-mobile

# 개발
npm start                        # Expo 개발 서버
npm run type-check              # TypeScript 검증
npm run lint                    # ESLint 검사
npm run quality                 # type-check + lint + format:check

# 플랫폼별 실행
npx expo run:ios                # iOS 시뮬레이터
npx expo run:android            # Android 에뮬레이터
npm run build:web               # Web 빌드

# 테스트
npm test                        # Jest 테스트
npm run test:coverage          # 커버리지 리포트

# 빌드 (EAS)
eas build --platform ios        # iOS 빌드
eas build --platform android    # Android 빌드
```

### 코드 리뷰 체크리스트 (모바일)

**기능 추가 시**:
- [ ] TypeScript strict mode 준수 (any 타입 없음)
- [ ] `<Text>` 없이 문자열 렌더링 금지
- [ ] NativeWind 다크모드 적용 (`dark:` 클래스)
- [ ] 로딩/에러/빈 상태 처리
- [ ] `FlashList` 사용 (긴 리스트)
- [ ] `expo-image` 사용 (이미지)
- [ ] 터치 타겟 최소 44px
- [ ] `accessibilityLabel` 적용

**데이터 접근 시**:
- [ ] Repository 패턴 준수 (Service → Repository → Firebase)
- [ ] Firebase 직접 호출 금지 (Service, Hooks에서)
- [ ] Shared 모듈 활용 (IdNormalizer, RoleResolver 등)

**트랜잭션 필요 시**:
- [ ] 여러 문서 업데이트는 runTransaction 사용
- [ ] 읽기 → 검증 → 쓰기 순서 유지
- [ ] BusinessError 클래스로 에러 처리

---

## 품질 지표

| 항목 | MVP 기준 | 출시 기준 | 현재 |
|------|:--------:|:---------:|:----:|
| TypeScript strict 에러 | 0개 | 0개 | 0개 |
| ESLint 에러 | 0개 | 0개 | 0개 |
| ESLint 경고 | < 10개 | < 5개 | - |
| 테스트 커버리지 (전체) | 14%+ | 60%+ | 14% |
| 테스트 커버리지 (services/) | 40%+ | 70%+ | 40% |
| Repository 패턴 적용 | 핵심 3개 | 전체 | 11개 |
| Shared 모듈 테스트 | 80%+ | 90%+ | 80%+ |

---

## 주요 문서 참조

### 문서 우선순위

> **단일 소스 원칙**: 모바일앱 개발 시 이 CLAUDE.md를 최우선으로 참조합니다.
> docs/ 내 문서 대부분은 레거시 웹앱(app2/) 기준이며, specs/react-native-app/의 일부 수치는 본 문서와 차이가 있을 수 있습니다.

### 공통 문서

| 문서 | 경로 | 설명 | 상태 |
|------|------|------|------|
| 개발 가이드 | docs/core/DEVELOPMENT_GUIDE.md | 상세 개발 지침 | 레거시 (app2/) |
| 테스트 가이드 | docs/core/TESTING_GUIDE.md | 테스트 작성법 | 현행 (통합) |
| 아키텍처 | docs/reference/ARCHITECTURE.md | 시스템 구조 | 레거시 (app2/) |
| 데이터 스키마 | docs/reference/DATA_SCHEMA.md | Firestore 스키마 (v3.1) | 현행 (통합) |
| 배포 가이드 | docs/guides/DEPLOYMENT.md | 배포 절차 | 레거시 (app2/) |
| 보안 가이드 | docs/operations/SECURITY.md | 보안 정책 | 부분 현행 (역할 용어 구버전) |

### 모바일앱 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| RN 스펙 개요 | specs/react-native-app/00-overview.md | 모바일앱 설계 개요 |
| 아키텍처 | specs/react-native-app/01-architecture.md | RN 앱 아키텍처 |
| 에러 처리 | specs/react-native-app/09-error-handling.md | 에러 처리 설계 |
| 화면 설계 | specs/react-native-app/04-screens.md | 화면별 상세 스펙 |
| 컴포넌트 | specs/react-native-app/05-components.md | 컴포넌트 설계 |
| 개발 체크리스트 | specs/react-native-app/DEVELOPMENT_CHECKLIST.md | Phase별 진행 상태 |

### 문서 중복/정리 현황

> 아래는 문서 간 중복 분석 결과입니다. 향후 통합 정리 시 참고하세요.

**높은 중복도 (통합 권장):**

| 문서 A | 문서 B | 중복 영역 |
|--------|--------|---------|
| CLAUDE.md | specs/react-native-app/00-overview.md | 기술 스택, 프로젝트 구조, 현황 수치 |
| CLAUDE.md | specs/react-native-app/01-architecture.md | 아키텍처 레이어, 스토어, 서비스 목록 |
| CLAUDE.md | docs/core/DEVELOPMENT_GUIDE.md | 최우선 지침, 공통 규칙, 역할 체계 |
| CLAUDE.md | docs/reference/ARCHITECTURE.md | 폴더 구조, 기술 스택 |
| docs/features/PERMISSION_SYSTEM.md | docs/reference/DATA_SCHEMA.md | 역할 정의, 권한 계층 |
| 결제 문서 4개 | (상호 중복) | 포인트 시스템 설계/구현 40-50% 중복 |
| 알림 문서 3개 | (상호 중복) | 알림 시스템 아키텍처/타입/Functions 37% 중복 |

**결제 문서 중복 상세** (총 4,576줄, 약 22% 중복):
| 문서 | 라인 수 | 중복율 | 대상 독자 | 고유 콘텐츠 |
|------|--------|--------|---------|------------|
| MODEL_B_CHIP_SYSTEM_FINAL.md | 632 | 35-40% | 기획자 | 시각화, 법률, 어뷰징 방지 |
| PAYMENT_SYSTEM_DEVELOPMENT.md | 1,195 | 40-45% | 개발자 | API 명세, 아키텍처, Webhook |
| CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md | 2,062 | 45-50% | 개발자 | 6주 로드맵, 전체 코드 예제 |
| PAYMENT_OPERATIONS.md | 687 | 30-35% | 운영팀 | 긴급대응, FAQ, 체크리스트 |

**알림 문서 중복 상세** (총 2,196줄, 약 37% 중복):
| 문서 | 라인 수 | 중복율 | 대상 독자 | 고유 콘텐츠 |
|------|--------|--------|---------|------------|
| NOTIFICATION_OPERATIONS.md | 364 | 59% | 운영팀 | Functions 관리, 문제해결, 체크리스트 |
| NOTIFICATION_IMPLEMENTATION_STATUS.md | 310 | 42% | 개발팀 | 구현 현황, 테스트, 타임존 이슈 |
| specs/react-native-app/10-notifications.md | 1,522 | 31% | 앱개발자 | FCM, Zustand, UI, 30개 타입 |

**레거시 표시 필요 (app2/ 전용):**
- docs/core/CAPACITOR_MIGRATION_GUIDE.md (Expo 사용으로 불필요)
- docs/guides/MIGRATION_GUIDE.md (대상 불명확)
- docs/reference/API_REFERENCE.md (웹앱/Cloud Functions 구분 필요)
- docs/features/PERMISSION_SYSTEM.md (manager→employer 통합으로 레거시 표시 추가됨)
- specs/001-* 시리즈 (레거시 마이그레이션 스펙)

**알려진 문서 간 불일치:**
- ~~역할 정의: CLAUDE.md(5개 역할) vs DATA_SCHEMA.md(3개 역할)~~ → ✅ 해결됨 (3개 역할로 통합)
- 필드명: CLAUDE.md(eventId) vs DATA_SCHEMA.md(jobPostingId 표준) — 마이그레이션 과도기

---

## 레거시 웹앱 참고 (app2/)

> ⚠️ **개발 중단**: app2는 더 이상 개발되지 않습니다. 토너먼트 로직 참고용으로만 보관합니다.

### 참고 가능한 로직

| 기능 | 파일 위치 | 설명 |
|------|----------|------|
| 토너먼트 관리 | `app2/src/contexts/TournamentContext.tsx` | 토너먼트 상태 관리 |
| 토너먼트 스토어 | `app2/src/stores/tournamentStore.ts` | Zustand 스토어 |
| 칩 관리 | `app2/src/contexts/ChipContext.tsx` | 칩 잔액 관리 |
| 토너먼트 서비스 | `app2/src/services/tournament*.ts` | 비즈니스 로직 |
| 토너먼트 타입 | `app2/src/types/tournament.ts` | 타입 정의 |

### 기술 스택 (참고용)

```yaml
React 18.2 + TypeScript 4.9 + Tailwind CSS 3.3
Zustand 5.0 + React Query 5.17 + Firebase 11.9
Capacitor 7.4 (iOS/Android 하이브리드)
```

---

*마지막 업데이트: 2026-02-13*
*모바일앱 버전: v1.0.0*
*문서 기준: 모바일앱 중심 개발 전환 (파일 수치 코드베이스 동기화 완료)*
