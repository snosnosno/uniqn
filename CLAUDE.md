# CLAUDE.md

**UNIQN 프로젝트 개발 가이드** - Claude Code 전용

---

## 최우선 지침

### 필수 규칙 (모든 작업에서 반드시 준수)

```yaml
언어: 항상 한글로 답변
작업 디렉토리: app2/ (모든 작업은 이 디렉토리에서 진행)
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
├── app2/                    # 메인 애플리케이션
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
├── functions/               # Firebase Functions
└── docs/                    # 문서 (46개)
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

*마지막 업데이트: 2025-11-30*
*프로젝트 버전: v0.2.3*
