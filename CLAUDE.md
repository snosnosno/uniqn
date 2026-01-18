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

> ⚠️ **중요**: 이 섹션은 React Native + Expo 기반 모바일앱 개발에 적용됩니다.

### 프로젝트 현황

```yaml
버전: 1.0.0
상태: Phase 2 진행 중 (인증 + 구인구직)
```

| 카테고리 | 파일 수 | 설명 |
|---------|--------|------|
| **Routes (app/)** | 61 | Expo Router 라우트 파일 |
| **Components** | 192 | UI 34개 + 기능별 158개 |
| **Hooks** | 33 | 커스텀 훅 |
| **Services** | 31 | 비즈니스 로직 서비스 |
| **Stores** | 7 | Zustand 전역 상태 |
| **Types** | 24 | TypeScript 타입 정의 |
| **Schemas** | 18 | Zod 검증 스키마 |
| **전체 TypeScript** | **423** | src + app 합계 |

### 기술 스택 (실제 버전)

```yaml
Core:
  - Expo SDK: 54
  - React Native: 0.81.5
  - React: 19.1.0
  - TypeScript: 5.9.2 (strict 모드)

Navigation & State:
  - Expo Router: 6.0.19 (파일 기반 라우팅)
  - Zustand: 5.0.9 (전역 상태)
  - TanStack Query: 5.90.12 (서버 상태)

UI/Styling:
  - NativeWind: 4.2.1 (Tailwind CSS)
  - @shopify/flash-list: 가상화 리스트
  - expo-image: 3.0.11 (이미지 최적화)
  - @gorhom/bottom-sheet: 5.2.8

Backend:
  - Firebase: 12.6.0 (Modular API)
  # @react-native-firebase 대신 Firebase Modular API 사용

Forms & Validation:
  - React Hook Form: 7.68.0
  - Zod: 4.1.13
  - @hookform/resolvers: 5.2.2
```

### 폴더 구조

```
uniqn-mobile/
├── app/                           # Expo Router (61개 라우트)
│   ├── _layout.tsx               # Root Layout (4단계 Provider)
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
│       └── stats/                # 통계
│
├── src/
│   ├── components/               # 192개 (22개 폴더)
│   │   ├── ui/                   # 기본 UI (34개)
│   │   ├── auth/                 # 인증 (7개)
│   │   ├── jobs/                 # 구인공고 (17개)
│   │   ├── employer/             # 구인자 (21개)
│   │   ├── schedule/             # 스케줄 (6개)
│   │   ├── qr/                   # QR 코드 (4개)
│   │   ├── notifications/        # 알림 (6개)
│   │   ├── admin/                # 관리자 (6개)
│   │   └── ...                   # 기타
│   ├── hooks/                    # 33개 커스텀 훅
│   ├── services/                 # 31개 비즈니스 서비스
│   ├── stores/                   # 7개 Zustand 스토어
│   ├── types/                    # 24개 타입 정의
│   ├── schemas/                  # 18개 Zod 스키마
│   ├── errors/                   # 에러 시스템
│   ├── utils/                    # 유틸리티
│   ├── lib/                      # 라이브러리 설정
│   │   ├── queryClient.ts        # React Query + Query Keys
│   │   ├── firebase.ts           # Firebase 지연 초기화
│   │   ├── mmkvStorage.ts        # MMKV 저장소
│   │   └── secureStorage.ts      # Secure Storage
│   └── constants/                # 상수
│
└── functions/                    # Firebase Cloud Functions
```

### 아키텍처 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (app/, components/)                     │
│  └─ UI 렌더링만, 비즈니스 로직/Firebase 직접 호출 금지        │
├─────────────────────────────────────────────────────────────┤
│  Hooks Layer (33개 커스텀 훅)                               │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                   │
├─────────────────────────────────────────────────────────────┤
│  State Layer (Zustand 7개 + TanStack Query)                 │
│  └─ Zustand: UI/세션 상태  |  Query: 서버 데이터 캐싱        │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (31개 서비스)                                │
│  └─ 비즈니스 로직, Firebase Modular API, 에러 처리           │
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
```

### Provider 구조 (4단계)

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
      </BottomSheetModalProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Zustand 스토어 (7개)

```yaml
authStore (414줄):
  - user, profile, status (idle|loading|authenticated|unauthenticated)
  - isAdmin, isEmployer, isStaff (계산된 플래그)
  - MMKV 영구 저장, Hydration 추적

themeStore (116줄):
  - mode (light|dark|system), isDarkMode
  - NativeWind colorScheme 연동
  - 시스템 테마 자동 감지

toastStore (143줄):
  - toasts[] (최대 3개), 자동 제거
  - toast.success/error/info 편의 메서드

modalStore (205줄):
  - 모달 스택 관리
  - showAlert, showConfirm, showLoading

notificationStore (427줄):
  - notifications[], unreadCount, settings
  - 카테고리별 읽지 않은 수
  - 필터 시스템

inAppMessageStore (239줄):
  - 우선순위 큐 (critical > high > medium > low)
  - 세션당 1회 표시 (sessionShownIds)
  - 영구 이력 저장
```

### 서비스 레이어 (31개)

```yaml
Core (7개):
  - authService: 로그인/회원가입/소셜로그인
  - jobService: 공고 조회/필터링/검색
  - applicationService: 지원 트랜잭션 (v2.0 Assignment)
  - scheduleService: WorkLogs + Applications 병합
  - workLogService: 근무 기록
  - notificationService: 알림 조회/읽음처리
  - reportService: 양방향 신고 시스템

Employer (5개):
  - jobManagementService: 공고 생성/수정/삭제
  - applicantManagementService: 지원자 확정/거절
  - settlementService: 정산 계산/처리
  - confirmedStaffService: 확정 스태프 관리
  - applicationHistoryService: 확정/취소 이력

Admin (4개):
  - adminService: 사용자 관리
  - announcementService: 공지 관리
  - tournamentApprovalService: 대회공고 승인
  - inquiryService: 문의 관리

Infrastructure (15개):
  - pushNotificationService: FCM 토큰 관리
  - eventQRService: QR 생성/검증 (3분 유효)
  - deepLinkService: 딥링크 라우팅
  - storageService: MMKV + SecureStore
  - sessionService: 토큰 관리
  - analyticsService: 이벤트 추적
  - crashlyticsService: 에러 로깅
  - performanceService: 성능 모니터링
  - featureFlagService: 기능 플래그
  - templateService: 공고 템플릿
  - accountDeletionService: 계정 삭제
  - inAppMessageService: 인앱 메시지
  - applicantConversionService: 지원자 변환
  - jobPostingMigration: 공고 마이그레이션
```

### 커스텀 훅 (33개)

```yaml
App (2):
  - useAppInitialize: Firebase 인증 상태, 초기화
  - useVersionCheck: 앱 버전 확인

Auth (3):
  - useAuth: 인증 상태 통합 (profile에서 권한 직접 계산)
  - useAuthGuard: 라우트별 권한 가드
  - useNavigationTracking: Analytics 추적

Jobs (3):
  - useJobPostings: 무한스크롤 공고 목록
  - useJobDetail: 공고 상세
  - usePostingTypeCounts: 타입별 공고 개수

Applications (1):
  - useApplications: 지원 제출/취소 (Optimistic Update)

Schedule (8):
  - useSchedules, useSchedulesByMonth, useSchedulesByDate
  - useTodaySchedules, useUpcomingSchedules
  - useScheduleDetail, useScheduleStats, useCalendarView

WorkLog (6):
  - useWorkLogs, useWorkLogsByDate, useWorkLogDetail
  - useCurrentWorkStatus, useWorkLogStats, useMonthlyPayroll

QR (3):
  - useQRCodeScanner, useQRScannerModal, useQRDisplayModal

Notification (5+):
  - useNotificationList, useNotificationRealtime
  - useUnreadCountRealtime, useMarkAsRead, useMarkAllAsRead

Employer (5+):
  - useJobManagement, useApplicantManagement
  - useSettlement, useConfirmedStaff, useEventQR

Admin (3+):
  - useAdminDashboard, useTournamentApproval, useAnnouncement
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

### UI 컴포넌트 (34개)

```yaml
기본 (7):
  - Button (5 variant), Input (5 type), Card (3 variant)
  - Badge (6 variant), Avatar, Divider, Accordion

상태 표시 (5):
  - Loading, LoadingOverlay, InlineLoadingOverlay
  - EmptyState (3 variant), ErrorState

스켈레톤 (1 + 10 프리셋):
  - Skeleton (shimmer 애니메이션)
  - SkeletonText, SkeletonCard, SkeletonListItem
  - SkeletonJobCard, SkeletonScheduleCard, SkeletonApplicantCard
  - SkeletonNotificationItem, SkeletonProfileHeader, SkeletonSettlementRow

피드백 (5):
  - Toast, ToastManager
  - Modal (Reanimated), AlertModal, ConfirmModal

폼 (8):
  - FormField, FormSection, FormRow, FormSelect
  - Checkbox, CheckboxGroup, Radio
  - DatePicker, TimePicker, CalendarPicker

기타 (8):
  - OptimizedImage (expo-image, Blurhash)
  - MobileHeader, LargeHeader
  - BottomSheet, SelectBottomSheet, ActionSheet
  - CircularProgress, ErrorBoundary (5가지 세분화)
  - ModalManager, InAppBanner, InAppModal, InAppMessageManager
```

### 권한 계층 및 라우트 그룹

```typescript
// 권한 계층
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,     // 관리자: 모든 기능
  employer: 50,   // 구인자: 공고 관리, 지원자 관리
  staff: 10,      // 스태프: 지원, 스케줄 확인
};

// 권한 비교
function hasPermission(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
```

**라우트 그룹별 권한**:
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

### Firebase 트랜잭션 규칙

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
| 지원하기 (applyToJobV2) | applications, jobPostings | 중복 체크 + 카운트 |
| 지원 취소 | applications, jobPostings | 카운트 정합성 |
| QR 출퇴근 | workLogs, applications | 중복 방지 |
| 정산 처리 | workLogs, settlements | 금액 정합성 |

### 보안 규칙

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

**비밀번호 정책** (auth.schema.ts):
- 최소 8자, 최대 128자
- 대문자/소문자/숫자/특수문자 각 1개 이상
- 3자 이상 연속 금지 (`123`, `abc`)

### 성능 규칙

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

### 품질 게이트

| 항목 | MVP 기준 | 출시 기준 | 현재 |
|------|:--------:|:---------:|:----:|
| TypeScript strict 에러 | 0개 | 0개 | 0개 |
| ESLint 에러 | 0개 | 0개 | 0개 |
| ESLint 경고 | < 10개 | < 5개 | - |
| 테스트 커버리지 (전체) | 14%+ | 60%+ | 14% |
| 테스트 커버리지 (services/) | 40%+ | 70%+ | 40% |

### 개발 명령어

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

### 코드 리뷰 체크리스트

**기능 추가 시**:
- [ ] TypeScript strict mode 준수 (any 타입 없음)
- [ ] `<Text>` 없이 문자열 렌더링 금지
- [ ] NativeWind 다크모드 적용 (`dark:` 클래스)
- [ ] 로딩/에러/빈 상태 처리
- [ ] `FlashList` 사용 (긴 리스트)
- [ ] `expo-image` 사용 (이미지)
- [ ] 터치 타겟 최소 44px
- [ ] `accessibilityLabel` 적용

**트랜잭션 필요 시**:
- [ ] 여러 문서 업데이트는 runTransaction 사용
- [ ] 읽기 → 검증 → 쓰기 순서 유지
- [ ] BusinessError 클래스로 에러 처리

---

*마지막 업데이트: 2025-01-18*
*프로젝트 버전: v1.0.0*
