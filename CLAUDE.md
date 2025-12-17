# CLAUDE.md

**UNIQN 프로젝트 개발 가이드** - Claude Code 전용

---

## 최우선 지침

### 필수 규칙 (모든 작업에서 반드시 준수)

```yaml
언어: 항상 한글로 답변
작업 디렉토리:
  - app2/: 기존 웹앱 (React + Capacitor)
  - uniqn-mobile/: 신규 모바일앱 (React Native + Expo)
배포 전 검증: npm run type-check && npm run lint && npm run build
```

| 규칙 | 올바른 예 | 금지 예 |
|------|----------|---------|
| **로깅** | `logger.info('메시지', { context })` | `console.log()` |
| **타입** | `const data: StaffData = {...}` | `const data: any = {...}` |
| **다크모드** | `className="bg-white dark:bg-gray-800"` | `className="bg-white"` |
| **경로** | `import { util } from '@/utils/util'` | 절대 시스템 경로 사용 |
| **알림** | `toast.success('완료')` | `alert('완료')` |
| **필드명** | `staffId`, `eventId` | `staff_id`, `event_id` |

---

## 프로젝트 개요

**UNIQN** - 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **버전**: v0.2.3

### 프로젝트 구조

```
T-HOLDEM/
├── app2/                    # 기존 웹앱 (React + Capacitor)
│   └── src/
│       ├── components/      # UI 컴포넌트 (40+ 폴더)
│       ├── contexts/        # Context Providers (6개)
│       ├── hooks/           # Custom Hooks (20+)
│       ├── stores/          # Zustand Stores (5개)
│       ├── pages/           # 페이지 컴포넌트 (20+)
│       ├── services/        # 비즈니스 로직 (20+)
│       ├── utils/           # 유틸리티 함수 (50+)
│       ├── types/           # TypeScript 타입 정의
│       ├── schemas/         # Zod 검증 스키마
│       └── config/          # 설정 파일
├── uniqn-mobile/            # 신규 모바일앱 (React Native + Expo) ⭐
│   ├── app/                 # Expo Router (파일 기반 라우팅)
│   └── src/                 # 소스 코드
├── specs/                   # 스펙 문서
│   └── react-native-app/    # RN 앱 스펙 (23개 문서)
├── functions/               # Firebase Functions
└── docs/                    # 운영 문서 (46개)
```

### 기술 스택

```typescript
// 코어
React 18.2 + TypeScript 4.9 (Strict Mode)
Tailwind CSS 3.3 + Zustand 5.0 + React Query 5.17
Firebase 11.9 (Auth, Firestore, Functions)

// UI/UX
@heroicons/react 2.2 + @tanstack/react-table 8.21
다크모드: class 기반 (dark: prefix)

// 유효성 검증
Zod 3.23 (스키마 검증) + DOMPurify 3.2 (XSS 방지)

// 모바일
Capacitor 7.4 (iOS/Android)
```

---

## 아키텍처 규칙

### 1. 상태 관리 계층

```typescript
// Layer 1: Zustand Store (전역 상태)
// - unifiedDataStore: staff, workLogs, applications, attendance
// - toastStore: 토스트 알림
// - jobPostingStore: 구인공고
// - dateFilterStore: 날짜 필터
// - tournamentStore: 토너먼트

// Layer 2: Context API (Provider 패턴)
// - AuthContext: 인증 상태 + 역할
// - ThemeContext: 다크모드
// - ChipContext: 칩 잔액
// - TournamentContext: 토너먼트 데이터

// Layer 3: React Query (서버 상태)
// - 캐싱 (staleTime: 5분)
// - 자동 리프레시
// - 에러 핸들링
```

### 2. 데이터 흐름 패턴

```typescript
// Firebase 실시간 구독 (onSnapshot 필수)
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'staff'),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaff(data);
    },
    (error) => {
      logger.error('구독 실패', error, { component: 'StaffList' });
    }
  );
  return () => unsubscribe(); // 클린업 필수
}, []);

// Index Map 패턴 (O(1) 조회)
const staffById = useMemo(() =>
  new Map(staff.map(s => [s.id, s])),
  [staff]
);
```

### 3. 컴포넌트 구조

```typescript
// 권장 패턴
const MyComponent: React.FC<Props> = React.memo(({ data, onAction }) => {
  // 1. 메모이제이션
  const processedData = useMemo(() =>
    processExpensive(data),
    [data]
  );

  const handleClick = useCallback(() => {
    onAction(processedData);
  }, [onAction, processedData]);

  // 2. 조건부 렌더링
  if (!data) return <EmptyState />;

  // 3. JSX (다크모드 필수)
  return (
    <div className="bg-white dark:bg-gray-800 p-4">
      <button onClick={handleClick}>
        {processedData.label}
      </button>
    </div>
  );
});

MyComponent.displayName = 'MyComponent';
```

---

## 보안 규칙

### 1. 입력 검증 (Zod + XSS 방지)

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

### 2. 인증/권한

```typescript
// 역할 기반 접근 제어
enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
  USER = 'user',
}

// 권한 확인
const { role, isAdmin } = useAuth();
if (!hasAdminPrivilege(role)) {
  return <AccessDenied />;
}
```

### 3. 보안 체크리스트

- [ ] 모든 사용자 입력에 Zod 스키마 적용
- [ ] HTML 출력 시 DOMPurify로 새니타이징
- [ ] Firebase Security Rules로 문서 레벨 접근 제어
- [ ] 민감한 데이터는 secureStorage 사용
- [ ] API 키는 환경변수로 관리

---

## 성능 규칙

### 1. 메모이제이션 전략

```typescript
// useMemo: 비용이 큰 계산에만 사용
const filteredData = useMemo(() =>
  data.filter(item => item.status === 'active')
       .sort((a, b) => b.date - a.date),
  [data]
);

// useCallback: 콜백 안정화
const handleSubmit = useCallback(async (formData: FormData) => {
  await submitForm(formData);
}, [submitForm]);

// React.memo: 조건부 사용
// - Props가 자주 변경되지 않는 컴포넌트
// - 렌더링 비용이 높은 컴포넌트
// - 리스트 아이템 컴포넌트
```

### 2. 코드 스플리팅

```typescript
// 페이지 단위 Lazy Loading
const TournamentPage = lazy(() => import('@/pages/TournamentPage'));

// 청크 그룹화 (lazyChunks.ts)
// - adminChunk: 관리자 페이지
// - tournamentChunk: 토너먼트 관련
// - jobManagementChunk: 구인공고 관리
```

### 3. Firebase 최적화

```typescript
// 쿼리 최적화
const q = query(
  collection(db, 'workLogs'),
  where('eventId', '==', eventId),
  orderBy('createdAt', 'desc'),
  limit(50)
);

// 배치 쓰기
const batch = writeBatch(db);
items.forEach(item => {
  batch.update(doc(db, 'items', item.id), item);
});
await batch.commit();
```

### 4. 성능 예산

| 메트릭 | 목표 | 현재 |
|--------|------|------|
| 번들 크기 | < 300KB | 299KB |
| LCP | < 2.5s | - |
| FID | < 100ms | - |
| CLS | < 0.1 | - |

---

## UI/UX 규칙

### 1. 다크모드 (필수)

```tsx
// 모든 UI 요소에 적용
<div className="
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-gray-700
">
  <p className="text-gray-600 dark:text-gray-400">
    보조 텍스트
  </p>
  <button className="
    bg-blue-600 hover:bg-blue-700
    dark:bg-blue-700 dark:hover:bg-blue-600
  ">
    버튼
  </button>
</div>
```

### 2. 반응형 디자인

```tsx
// 모바일 퍼스트
<div className="
  px-4 md:px-6 lg:px-8
  grid grid-cols-1 md:grid-cols-2
  text-sm md:text-base
">
  ...
</div>

// 터치 타겟: 최소 44px (WCAG)
<button className="min-h-[44px] min-w-[44px]">
```

### 3. 로딩/에러 상태

```tsx
// 모든 비동기 작업에 적용
if (loading) return <LoadingSpinner />;
if (error) return <ErrorState message={error.message} />;
if (!data?.length) return <EmptyState />;
```

### 4. 접근성

```tsx
// 시맨틱 HTML + ARIA
<button
  aria-label="메뉴 열기"
  aria-expanded={isOpen}
  onClick={toggleMenu}
>
  <MenuIcon aria-hidden="true" />
</button>

// 키보드 네비게이션
<FocusTrap active={isModalOpen}>
  <Modal />
</FocusTrap>
```

---

## 에러 처리 규칙

### 1. 구조화된 로깅

```typescript
import { logger } from '@/utils/logger';

// 컨텍스트와 함께 로깅
logger.info('작업 시작', {
  component: 'StaffList',
  operation: 'fetchStaff',
  userId
});

// 에러 로깅 (Error 객체 포함)
logger.error('작업 실패', error, {
  component: 'StaffList',
  staffId,
  errorCode: error.code
});

// 성능 추적 래퍼
await logger.withPerformanceTracking(
  () => fetchData(),
  'fetchData',
  { userId }
);
```

### 2. 에러 바운더리

```typescript
// 전역 에러 바운더리
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>

// Firebase 전용 에러 바운더리
<FirebaseErrorBoundary>
  <FirestoreProvider>
    ...
  </FirestoreProvider>
</FirebaseErrorBoundary>
```

### 3. 사용자 피드백

```typescript
import { useToastStore } from '@/stores/toastStore';

const { addToast } = useToastStore();

// 성공
addToast({ type: 'success', message: '저장되었습니다' });

// 에러 (사용자 친화적 메시지)
addToast({ type: 'error', message: '저장에 실패했습니다. 다시 시도해주세요.' });
```

---

## 의존성 규칙

### 1. 새 의존성 추가 전 확인

```bash
# 1. 기존 유틸리티로 해결 가능한지 확인
# 2. 번들 크기 영향 분석
npm run analyze:bundle

# 3. TypeScript 타입 지원 확인
# 4. 유지보수 상태 확인
```

### 2. 금지된 패턴

```typescript
// 직접 import 금지 (번들 크기 증가)
import _ from 'lodash';

// 필요한 함수만 import
import debounce from 'lodash/debounce';

// date-fns가 있으므로 moment.js 금지
```

---

## 일관성 규칙

### 1. 네이밍 컨벤션

```typescript
// 파일명
ComponentName.tsx      // 컴포넌트
useHookName.ts        // 훅
utilityName.ts        // 유틸리티
typeName.ts           // 타입

// 변수/함수
const staffId = '...';           // camelCase
const handleSubmit = () => {};   // handle 접두사
const isLoading = true;          // is/has/can 접두사

// 타입/인터페이스
interface StaffData {}           // PascalCase
type WorkLogStatus = 'pending';  // PascalCase
```

### 2. 표준 필드명 (Firebase)

| 컬렉션 | 핵심 필드 |
|--------|-----------|
| staff | staffId, name, role, userId |
| workLogs | staffId, eventId, date, role |
| applications | eventId, applicantId, status |
| jobPostings | id, title, location, salary |
| notifications | userId, type, isRead, data |

### 3. 폴더 구조

```
components/
├── common/           # 공통 컴포넌트
├── ui/               # 기본 UI 요소
├── modals/           # 모달 컴포넌트
└── [feature]/        # 기능별 컴포넌트
    ├── index.ts      # 배럴 export
    ├── Component.tsx
    ├── hooks/
    └── types.ts
```

---

## 확장성 규칙

### 1. Feature Flag 시스템

```typescript
// src/config/features.ts
export const FEATURE_FLAGS = {
  TOURNAMENTS: true,
  JOB_BOARD: true,
  NOTIFICATIONS: true,
  SHIFT_SCHEDULE: false,  // 준비 중
  PRIZES: false,          // 준비 중
};

// 사용
if (isFeatureEnabled('TOURNAMENTS')) {
  // 기능 표시
}
```

### 2. 플러그인 패턴

```typescript
// Context Adapter 패턴
<TournamentContextAdapter>
  <TournamentPage />
</TournamentContextAdapter>

// 새 기능 추가 시 Adapter로 래핑
```

### 3. 국제화 (i18n)

```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();
return <h1>{t('page.title')}</h1>;

// 지원 언어: ko, en
```

---

## 개발 명령어

```bash
cd app2

# 개발
npm start                    # 개발 서버
npm run type-check          # TypeScript 검증
npm run lint                # ESLint 검사
npm run lint:fix            # ESLint 자동 수정
npm run format              # Prettier 포맷팅

# 품질 검사 (커밋 전 필수)
npm run quality             # lint + format:check + type-check

# 빌드 & 배포
npm run build               # 프로덕션 빌드
npm run deploy:all          # Firebase 전체 배포
npx cap sync               # 모바일 동기화

# 테스트
npm test                    # Jest 테스트
npm run test:e2e           # Playwright E2E
npm run test:coverage      # 커버리지 리포트

# 분석
npm run analyze:bundle     # 번들 분석
```

---

## 코드 리뷰 체크리스트

### 기능 추가 시

- [ ] TypeScript strict mode 준수 (any 타입 없음)
- [ ] logger 사용 (console.log 없음)
- [ ] 다크모드 적용 (dark: 클래스)
- [ ] 로딩/에러 상태 처리
- [ ] 메모이제이션 적용 (필요한 경우)
- [ ] 접근성 고려 (ARIA, 키보드)
- [ ] Zod 스키마로 입력 검증

### Firebase 작업 시

- [ ] onSnapshot으로 실시간 구독
- [ ] 클린업 함수 반환
- [ ] 에러 핸들링 + 로깅
- [ ] 배치 작업 사용 (다중 문서)

### 배포 전

- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 테스트 통과

---

## 주요 문서 참조

| 문서 | 경로 | 설명 |
|------|------|------|
| 개발 가이드 | docs/core/DEVELOPMENT_GUIDE.md | 상세 개발 지침 |
| 테스트 가이드 | docs/core/TESTING_GUIDE.md | 테스트 작성법 |
| 아키텍처 | docs/reference/ARCHITECTURE.md | 시스템 구조 |
| 데이터 스키마 | docs/reference/DATA_SCHEMA.md | Firestore 스키마 |
| 배포 가이드 | docs/guides/DEPLOYMENT.md | 배포 절차 |
| 보안 가이드 | docs/operations/SECURITY.md | 보안 정책 |

---

## Git 커밋 컨벤션

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

## 품질 지표

| 항목 | 목표 | 현재 |
|------|------|------|
| TypeScript 에러 | 0개 | 0개 |
| ESLint 경고 | < 10개 | - |
| 번들 크기 | < 300KB | 299KB |
| 테스트 커버리지 | 80% | 65% |
| 다크모드 적용 | 100% | 100% |
| 메모이제이션 | 필수 적용 | 236+ |

---

## React Native 앱 개발 가이드 (uniqn-mobile/)

> ⚠️ **중요**: 이 섹션은 React Native + Expo 기반 신규 모바일앱 개발에 적용됩니다.
> 상세 스펙은 `specs/react-native-app/` 폴더의 문서들을 참조하세요.

### 아키텍처 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (Screens, Components)                   │
│  └─ UI 렌더링만, 비즈니스 로직/Firebase 직접 호출 금지        │
├─────────────────────────────────────────────────────────────┤
│  Hooks Layer (useAuth, useJobs, useSchedule)                │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                   │
├─────────────────────────────────────────────────────────────┤
│  State Layer (Zustand + TanStack Query)                     │
│  └─ Zustand: UI 상태, 세션  |  Query: 서버 데이터 캐싱       │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (authService, jobService...)                 │
│  └─ 비즈니스 로직, Firebase 호출, 에러 처리                  │
├─────────────────────────────────────────────────────────────┤
│  Firebase Layer (Auth, Firestore, Storage)                  │
└─────────────────────────────────────────────────────────────┘
```

**의존성 규칙 (필수)**:
```
✅ 상위 레이어 → 하위 레이어 의존 가능
✅ 같은 레이어 내 의존 가능
❌ 하위 레이어 → 상위 레이어 의존 금지
❌ Presentation → Firebase 직접 호출 금지
❌ Hooks에서 다른 Hooks의 내부 상태 직접 수정 금지
```

### Provider 구조 (8→3단계 단순화)

```tsx
// ❌ 기존 (8단계 중첩) - 복잡하고 디버깅 어려움
<ErrorBoundary>
  <FirebaseErrorBoundary>
    <QueryClientProvider>
      <ThemeProvider>
        <AuthProvider>
          <ChipProvider>...

// ✅ React Native (3단계로 단순화)
<QueryClientProvider client={queryClient}>
  <GestureHandlerRootView>
    <ThemeProvider value={theme}>
      <Stack />
      <ModalManager />
      <ToastManager />
    </ThemeProvider>
  </GestureHandlerRootView>
</QueryClientProvider>
```

**Provider 대체 방안**:
| 기존 Provider | 대체 방안 |
|--------------|----------|
| AuthProvider | `useAuthStore` (Zustand) |
| ThemeProvider | `useThemeStore` (Zustand) |
| ChipProvider | `useChipStore` (Zustand) |
| TournamentProvider | 제외 (Phase 2) |

### 상태 분리 원칙

```yaml
Zustand (클라이언트 상태):
  - authStore: 인증 상태, 사용자 세션
  - themeStore: 테마 설정
  - toastStore: 토스트 알림
  - modalStore: 모달 상태
  - filterStore: 필터 조건

TanStack Query (서버 상태):
  - jobPostings: 구인공고 목록/상세
  - applications: 지원 내역
  - schedules: 스케줄 데이터
  - notifications: 알림 목록
```

### Query Keys 중앙 관리

```typescript
// src/lib/queryClient.ts - 모든 Query Key는 여기서 관리
export const queryKeys = {
  jobPostings: {
    all: ['jobPostings'] as const,
    list: (filters: object) => ['jobPostings', 'list', filters] as const,
    detail: (id: string) => ['jobPostings', 'detail', id] as const,
    mine: () => ['jobPostings', 'mine'] as const,
  },
  applications: {
    all: ['applications'] as const,
    mine: () => ['applications', 'mine'] as const,
  },
  schedules: { ... },
  notifications: { ... },
};

// 사용 예시
useQuery({ queryKey: queryKeys.jobPostings.detail(id), ... });
```

### 캐싱 정책 (5단계)

| 정책 | staleTime | 용도 | 예시 |
|------|-----------|------|------|
| `realtime` | 0 | 실시간 데이터 | notifications |
| `frequent` | 2분 | 자주 변경 | jobPostings.list |
| `standard` | 5분 | 보통 빈도 | jobPostings.detail |
| `stable` | 30분 | 드물게 변경 | settings, regions |
| `offlineFirst` | ∞ | 오프라인 우선 | mySchedule |

### 권한 계층 및 라우트 그룹

```typescript
// 권한 계층 (숫자가 높을수록 상위 권한)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,     // 관리자: 모든 기능
  employer: 50,   // 구인자: 공고 관리, 지원자 관리
  staff: 10,      // 스태프: 지원, 스케줄 확인
  // guest: 0     // 비로그인: role === null
};

// 권한 비교 함수
function hasPermission(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
```

**라우트 그룹 구조** (Expo Router):
```
app/
├── (public)/           # 비로그인 접근 가능
│   ├── index.tsx       # 홈/랜딩
│   └── jobs/           # 공고 목록 (읽기 전용)
├── (auth)/             # 인증 플로우
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (app)/              # 로그인 필수 (staff+)
│   ├── _layout.tsx     # AuthGuard 적용
│   ├── jobs/[id]/apply.tsx
│   ├── schedule/
│   └── profile/
├── (employer)/         # employer 이상
│   ├── _layout.tsx     # PermissionGuard(employer)
│   ├── my-postings/
│   └── applicants/
└── (admin)/            # admin 전용
    ├── _layout.tsx     # PermissionGuard(admin)
    └── users/
```

**라우트 가드 패턴**:
```typescript
// app/(app)/_layout.tsx
export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect href="/login" />;

  return <Stack />;
}

// app/(employer)/_layout.tsx
export default function EmployerLayout() {
  const { role } = useAuth();

  if (!hasPermission(role, 'employer')) {
    return <Redirect href="/" />;
  }

  return <Stack />;
}
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
import { jobPostingService } from '@/services/job';

// 4. 타입
import type { JobPosting } from '@/types';

// 5. 상대 경로 (같은 기능 내)
import { JobCardSkeleton } from './JobCardSkeleton';
```

### 기술 스택 (버전 고정 필수)

```yaml
Core:
  - Expo SDK: 52+
  - React Native: 0.76+
  - React: 18.3+
  - TypeScript: 5.3+ (strict 모드)

Navigation & State:
  - Expo Router: 4.0+ (파일 기반 라우팅)
  - Zustand: 5.0+ (전역 상태)
  - TanStack Query: 5.17+ (서버 상태)

UI/Styling:
  - NativeWind: 4.0+ (Tailwind v4 호환)
  - @shopify/flash-list: 가상화 리스트
  - expo-image: 이미지 최적화

Backend:
  - Firebase: 11.0+ (Modular API)
  - @react-native-firebase/*: 네이티브 SDK

Forms & Validation:
  - React Hook Form: 7.54+
  - Zod: 3.23+ (기존 스키마 재사용)
```

### 폴더/파일 네이밍 규칙 (React Native)

```
파일명:
├── 컴포넌트: PascalCase.tsx (JobCard.tsx)
├── 훅: camelCase.ts (useJobPostings.ts)
├── 서비스: camelCase.ts (jobPostingService.ts)
├── 타입: camelCase.ts (jobPosting.ts)
├── 유틸리티: camelCase.ts (formatters.ts)
└── 상수: camelCase.ts (colors.ts)

폴더명:
├── 모두 kebab-case (job-posting/)
└── 라우트 그룹: (parentheses) ((tabs)/, (auth)/)

라우트 파일 (Expo Router):
├── index.tsx         # 기본 라우트
├── [id]/index.tsx    # 동적 라우트
├── _layout.tsx       # 레이아웃
└── +not-found.tsx    # 404 페이지
```

### 플랫폼 분기 패턴

```typescript
// 방법 1: 파일 기반 분기 (권장)
src/components/
├── Button.tsx        // 기본 (iOS/Android)
├── Button.web.tsx    // 웹 전용
└── index.ts          // 자동 선택

// 방법 2: 조건부 분기
import { Platform } from 'react-native';

export function CameraScanner() {
  if (Platform.OS === 'web') {
    return <WebQRScanner />;  // 웹: navigator.mediaDevices
  }
  return <NativeCamera />;    // 네이티브: expo-camera
}
```

**플랫폼별 차이점**:
| 기능 | iOS/Android | Web |
|------|-------------|-----|
| **스토리지** | expo-secure-store | localStorage |
| **푸시 알림** | FCM + APNS | 미지원 (인앱) |
| **카메라/QR** | expo-camera | navigator.mediaDevices |
| **햅틱** | expo-haptics | 미지원 |
| **생체 인증** | expo-local-authentication | 미지원 |

### 코드 변환 규칙 (Web → React Native)

| Web 요소 | RN 요소 | NativeWind |
|---------|---------|:----------:|
| `<div>` | `<View>` | ✅ 그대로 |
| `<span>`, `<p>`, `<h1>` | `<Text>` | ✅ 그대로 |
| `<button>` | `<Pressable>` | ✅ 그대로 |
| `<input>` | `<TextInput>` | ✅ 그대로 |
| `<img>` | `<Image>` (expo-image) | ✅ 그대로 |
| `<a>` | `<Link>` (expo-router) | ✅ 그대로 |
| `onClick` | `onPress` | - |
| `localStorage` | `MMKV` / `SecureStore` | - |

```tsx
// ❌ Web (React)
<div className="p-4 bg-white dark:bg-gray-800">
  <button onClick={handleClick}>클릭</button>
</div>

// ✅ React Native (NativeWind)
<View className="p-4 bg-white dark:bg-gray-800">
  <Pressable onPress={handlePress}>
    <Text>클릭</Text>
  </Pressable>
</View>
```

### 코드 재사용 계획

```yaml
100% 재사용 (복사만):
  - types/: TypeScript 타입 정의
  - schemas/: Zod 스키마
  - constants/: 상수

90% 재사용 (import 경로 수정):
  - utils/: 유틸리티 함수
  - services/: Firebase import 변경

70-80% 재사용 (플랫폼 분기):
  - stores/: Zustand 스토어
  - hooks/: Firebase 훅

재작성 필요:
  - components/: React DOM → React Native
  - pages/ → app/: React Router → Expo Router
```

### Firebase 트랜잭션 규칙

**트랜잭션 필수 사용 케이스**:
```typescript
// ❌ 금지: 여러 문서를 개별 업데이트 (데이터 불일치 위험)
await updateDoc(applicationRef, { status: 'accepted' });
await updateDoc(jobPostingRef, { applicantCount: increment(1) });
await addDoc(workLogsRef, workLogData);

// ✅ 필수: runTransaction으로 원자적 처리
await firestore().runTransaction(async (transaction) => {
  // 1. 모든 읽기 먼저
  const applicationDoc = await transaction.get(applicationRef);
  const jobPostingDoc = await transaction.get(jobPostingRef);

  if (!applicationDoc.exists || !jobPostingDoc.exists) {
    throw new Error('문서가 존재하지 않습니다');
  }

  // 2. 비즈니스 검증
  const currentCount = jobPostingDoc.data()?.applicantCount ?? 0;
  if (currentCount >= maxApplicants) {
    throw new Error('모집 인원이 마감되었습니다');
  }

  // 3. 모든 쓰기 실행 (원자적)
  transaction.update(applicationRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  transaction.update(jobPostingRef, {
    applicantCount: currentCount + 1,
  });
  transaction.set(workLogRef, {
    ...workLogData,
    createdAt: serverTimestamp(),
  });
});
```

**트랜잭션 사용 필수 시나리오**:
| 시나리오 | 관련 문서 | 이유 |
|---------|----------|------|
| 지원 수락/거절 | applications, jobPostings, workLogs | 카운트 정합성 |
| 출퇴근 기록 | workLogs, schedules | 중복 방지 |
| 칩 충전/차감 | users, chipTransactions | 잔액 정합성 |
| 공고 마감 | jobPostings, applications | 상태 일관성 |

**트랜잭션 규칙**:
```
✅ 읽기(get) → 검증 → 쓰기(set/update) 순서 유지
✅ 트랜잭션 내 최대 500개 문서 제한
✅ 실패 시 자동 재시도 (최대 5회)
❌ 트랜잭션 내 비동기 외부 호출 금지
❌ 트랜잭션 내 UI 상태 변경 금지
```

### 에러 처리 체계

```typescript
// 에러 클래스 계층
AppError (base)
├── AuthError         // 인증 (로그인, 토큰 만료)
├── NetworkError      // 연결, 타임아웃
├── ValidationError   // 입력 검증 실패
├── PermissionError   // 권한 부족
└── BusinessError     // 칩 부족, 중복 지원 등

// 에러 코드 체계
E1xxx: 네트워크 에러
E2xxx: 인증 에러
E3xxx: 검증 에러
E4xxx: Firebase 에러
E5xxx: 보안 에러
E6xxx: 비즈니스 에러
E7xxx: 알 수 없는 에러

// 필수 속성
interface AppError {
  code: string;           // 에러 코드
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;    // 사용자 친화적 메시지 (한글)
  isRetryable: boolean;   // 재시도 가능 여부
}
```

### 보안 규칙 (React Native)

```typescript
// ✅ 민감 데이터: expo-secure-store
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('authToken', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

// ✅ 일반 데이터: react-native-mmkv
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();
storage.set('preferences', JSON.stringify(prefs));
```

**비밀번호 정책**:
- 최소 8자, 최대 128자
- 대문자 1개 이상
- 소문자 1개 이상
- 숫자 1개 이상
- 특수문자 1개 이상 (`!@#$%^&*`)
- 3자 이상 연속 금지 (`123`, `abc`)

### 성능 규칙 (React Native)

```typescript
// ✅ 리스트: FlashList (FlatList 대신)
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={80}
  keyExtractor={item => item.id}
/>

// ✅ 이미지: expo-image
import { Image } from 'expo-image';

<Image
  source={uri}
  placeholder={blurhash}
  cachePolicy="memory-disk"
  transition={200}
/>
```

**성능 지표**:
| 지표 | 목표 |
|------|------|
| 첫 로드 (모바일) | < 2초 |
| 화면 전환 | < 300ms |
| 리스트 스크롤 | 60fps |
| 번들 크기 | < 500KB (gzip) |

### Phase별 우선순위

```
P0 (필수): MVP 출시에 반드시 필요
P1 (중요): 출시 전 구현 권장
P2 (나중): 출시 후 구현 가능
```

**Phase 구조**:
```
Phase 1: 프로젝트 기반 (환경 설정, 핵심 컴포넌트)
Phase 2: 인증 + 구인구직 (로그인, 공고 목록/상세/지원)
Phase 3: 스케줄 + 알림 (캘린더, QR 출퇴근, 푸시)
Phase 4: 구인자 기능 (공고 관리, 지원자 관리, 정산)
Phase 5: 최적화 + 배포 준비 (성능, 보안, Analytics)
Phase 6: 앱스토어 출시 (심사, 배포)
```

### 품질 게이트 (React Native)

| 항목 | MVP 기준 | 출시 기준 |
|------|:--------:|:---------:|
| TypeScript strict 에러 | 0개 | 0개 |
| ESLint 에러 | 0개 | 0개 |
| ESLint 경고 | < 10개 | < 5개 |
| 테스트 커버리지 (전체) | 60%+ | 75%+ |
| 테스트 커버리지 (services/) | 70%+ | 85%+ |
| 테스트 커버리지 (utils/) | 80%+ | 90%+ |

### 개발 명령어 (uniqn-mobile/)

```bash
cd uniqn-mobile

# 개발
npx expo start                    # 개발 서버
npm run type-check               # TypeScript 검증
npm run lint                     # ESLint 검사

# 플랫폼별 실행
npx expo run:ios                 # iOS 시뮬레이터
npx expo run:android             # Android 에뮬레이터
npx expo export -p web           # Web 빌드

# 테스트
npm test                         # Jest 테스트
npm run test:coverage           # 커버리지 리포트

# 빌드 (EAS)
eas build --platform ios         # iOS 빌드
eas build --platform android     # Android 빌드
eas submit                       # 스토어 제출
```

### 주요 스펙 문서

| 문서 | 용도 |
|------|------|
| [DEVELOPMENT_CHECKLIST.md](specs/react-native-app/DEVELOPMENT_CHECKLIST.md) | 전체 작업 추적 |
| [00-overview.md](specs/react-native-app/00-overview.md) | 프로젝트 구조 |
| [01-architecture.md](specs/react-native-app/01-architecture.md) | 아키텍처 설계 |
| [05-components.md](specs/react-native-app/05-components.md) | 컴포넌트 시스템 |
| [09-error-handling.md](specs/react-native-app/09-error-handling.md) | 에러 처리 전략 |
| [12-security.md](specs/react-native-app/12-security.md) | 보안 설계 |
| [22-migration-mapping.md](specs/react-native-app/22-migration-mapping.md) | 코드 변환 가이드 |

### 코드 리뷰 체크리스트 (React Native)

**기능 추가 시**:
- [ ] TypeScript strict mode 준수 (any 타입 없음)
- [ ] `<Text>` 없이 문자열 렌더링 금지
- [ ] NativeWind 다크모드 적용 (`dark:` 클래스)
- [ ] 로딩/에러/빈 상태 처리
- [ ] `FlashList` 사용 (긴 리스트)
- [ ] `expo-image` 사용 (이미지)
- [ ] 터치 타겟 최소 44px
- [ ] `accessibilityLabel` 적용

**플랫폼 분기 시**:
- [ ] `Platform.OS` 또는 `.web.tsx` 파일 분리
- [ ] 네이티브 전용 기능 (카메라, 푸시) 웹 대체 구현

---

*마지막 업데이트: 2025-12-16*
*프로젝트 버전: v0.2.3*
