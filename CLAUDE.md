# CLAUDE.md

**UNIQN 프로젝트 개발 가이드** - Claude Code 전용

---

## 목차

1. [최우선 지침](#최우선-지침)
2. [프로젝트 개요](#프로젝트-개요)
3. [공통 규칙](#공통-규칙)
4. [웹앱 개발 가이드 (app2/)](#웹앱-개발-가이드-app2)
5. [모바일앱 개발 가이드 (uniqn-mobile/)](#모바일앱-개발-가이드-uniqn-mobile)
6. [품질 지표](#품질-지표-통합)
7. [주요 문서 참조](#주요-문서-참조)

---

## 최우선 지침

### 필수 규칙 (모든 작업에서 반드시 준수)

```yaml
언어: 항상 한글로 답변
작업 디렉토리:
  - app2/: 기존 웹앱 (React + Capacitor)
  - uniqn-mobile/: 신규 모바일앱 (React Native + Expo) ⭐ 주력
배포 전 검증: npm run type-check && npm run lint && npm run build
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
- **배포 URL**: https://tholdem-ebc18.web.app
- **웹앱 버전**: v0.2.3
- **모바일앱 버전**: v1.0.0

### 프로젝트 구조

```
T-HOLDEM/
├── app2/                    # 웹앱 (React + Capacitor)
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
│
├── uniqn-mobile/            # 모바일앱 (React Native + Expo) ⭐ 주력
│   ├── app/                 # Expo Router (64개 라우트)
│   └── src/                 # 소스 코드 (460+ 파일)
│       ├── components/      # UI 컴포넌트 (198개)
│       ├── hooks/           # Custom Hooks (40개)
│       ├── services/        # 비즈니스 서비스 (33개)
│       ├── stores/          # Zustand Stores (8개)
│       ├── repositories/    # Repository 패턴 (9개)
│       ├── shared/          # 공유 모듈 (22개)
│       ├── types/           # 타입 정의 (28개)
│       ├── schemas/         # Zod 스키마 (18개)
│       └── errors/          # 에러 시스템 (6개)
│
├── specs/                   # 스펙 문서
│   └── react-native-app/    # RN 앱 스펙 (23개 문서)
├── functions/               # Firebase Functions
└── docs/                    # 운영 문서 (46개)
```

### 기술 스택 비교

| 항목 | app2 (웹앱) | uniqn-mobile (모바일앱) |
|------|------------|------------------------|
| **Framework** | React 18.2 | React Native 0.81.5 + Expo 54 |
| **React** | 18.2 | 19.1.0 |
| **TypeScript** | 4.9 | 5.9.2 (strict) |
| **스타일링** | Tailwind CSS 3.3 | NativeWind 4.2.1 |
| **상태관리** | Zustand 5.0 | Zustand 5.0.9 |
| **서버 상태** | React Query 5.17 | TanStack Query 5.90.12 |
| **Firebase** | 11.9 | 12.6.0 (Modular API) |
| **Zod** | 3.23 | 4.1.13 |
| **라우팅** | React Router | Expo Router 6.0.19 |
| **폼** | - | React Hook Form 7.68.0 |

---

## 공통 규칙

### 1. 역할 체계 (통합)

```typescript
// 공통 역할 정의
type UserRole = 'admin' | 'employer' | 'manager' | 'staff' | 'user';

// 권한 계층
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,      // 전체 관리 (모든 권한)
  employer: 50,    // 구인자 (공고 관리, 지원자 관리, 정산)
  manager: 30,     // 매니저 (이벤트 관리, 스태프 관리)
  staff: 10,       // 스태프 (지원, 스케줄 확인, QR 출퇴근)
  user: 1,         // 일반 사용자 (읽기 전용)
};

// 권한 확인
function hasPermission(userRole: UserRole | null, required: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}
```

**역할별 기능**:
| 역할 | 웹앱 기능 | 모바일앱 기능 |
|------|----------|--------------|
| `admin` | 전체 관리 | 사용자/신고/공지/대회 관리 |
| `employer` | 구인공고 관리 | 공고 CRUD, 지원자 관리, 정산 |
| `manager` | 이벤트 관리 | (미구현) |
| `staff` | 근무 관리 | 지원, 스케줄, QR 출퇴근 |
| `user` | 읽기 전용 | 공고 열람만 |

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

## 웹앱 개발 가이드 (app2/)

> 이 섹션은 React + Capacitor 기반 웹앱 개발에 적용됩니다.

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

### 아키텍처 레이어

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

### 데이터 흐름 패턴

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

### 컴포넌트 구조

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

### UI/UX 규칙 (웹)

#### 다크모드 (필수)

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

#### 반응형 디자인

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

#### 로딩/에러 상태

```tsx
// 모든 비동기 작업에 적용
if (loading) return <LoadingSpinner />;
if (error) return <ErrorState message={error.message} />;
if (!data?.length) return <EmptyState />;
```

#### 접근성

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

### 에러 처리 (웹)

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

// 사용자 피드백
import { useToastStore } from '@/stores/toastStore';
const { addToast } = useToastStore();
addToast({ type: 'success', message: '저장되었습니다' });
```

### 성능 규칙 (웹)

```typescript
// 페이지 단위 Lazy Loading
const TournamentPage = lazy(() => import('@/pages/TournamentPage'));

// 청크 그룹화 (lazyChunks.ts)
// - adminChunk: 관리자 페이지
// - tournamentChunk: 토너먼트 관련
// - jobManagementChunk: 구인공고 관리
```

**성능 예산**:
| 메트릭 | 목표 | 현재 |
|--------|------|------|
| 번들 크기 | < 300KB | 299KB |
| LCP | < 2.5s | - |
| FID | < 100ms | - |
| CLS | < 0.1 | - |

### 개발 명령어 (웹)

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

### 코드 리뷰 체크리스트 (웹)

**기능 추가 시**:
- [ ] TypeScript strict mode 준수 (any 타입 없음)
- [ ] logger 사용 (console.log 없음)
- [ ] 다크모드 적용 (dark: 클래스)
- [ ] 로딩/에러 상태 처리
- [ ] 메모이제이션 적용 (필요한 경우)
- [ ] 접근성 고려 (ARIA, 키보드)
- [ ] Zod 스키마로 입력 검증

**Firebase 작업 시**:
- [ ] onSnapshot으로 실시간 구독
- [ ] 클린업 함수 반환
- [ ] 에러 핸들링 + 로깅
- [ ] 배치 작업 사용 (다중 문서)

**배포 전**:
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 테스트 통과

---

## 모바일앱 개발 가이드 (uniqn-mobile/)

> ⚠️ **중요**: 이 섹션은 React Native + Expo 기반 모바일앱 개발에 적용됩니다.

### 프로젝트 현황

```yaml
버전: 1.0.0
상태: Phase 2 완료 (인증 + 구인구직 + Repository 패턴)
```

| 카테고리 | 파일 수 | 설명 |
|---------|--------|------|
| **Routes (app/)** | 64 | Expo Router 라우트 파일 |
| **Components** | 198 | UI 48개 + 기능별 150개 |
| **Hooks** | 40 | 커스텀 훅 |
| **Services** | 33 | 비즈니스 로직 서비스 |
| **Stores** | 8 | Zustand 전역 상태 |
| **Types** | 28 | TypeScript 타입 정의 |
| **Schemas** | 18 | Zod 검증 스키마 |
| **Repositories** | 9 | Repository 패턴 (인터페이스 + 구현) |
| **Shared** | 22 | 공유 유틸리티 (ID, Role, Status, Time) |
| **Errors** | 6 | 에러 시스템 (AppError 계층) |
| **전체 TypeScript** | **460+** | src + app 합계 |

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
├── app/                           # Expo Router (64개 라우트)
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
│   ├── components/               # 198개 (22개 폴더)
│   │   ├── ui/                   # 기본 UI (48개)
│   │   ├── auth/                 # 인증 (15개)
│   │   ├── jobs/                 # 구인공고 (19개)
│   │   ├── employer/             # 구인자 (62개) ⭐ 가장 많음
│   │   ├── schedule/             # 스케줄 (11개)
│   │   ├── qr/                   # QR 코드 (4개)
│   │   ├── notifications/        # 알림 (8개)
│   │   ├── admin/                # 관리자 (15개)
│   │   ├── support/              # 고객지원 (7개)
│   │   └── ...                   # 기타
│   │
│   ├── hooks/                    # 40개 커스텀 훅
│   ├── services/                 # 33개 비즈니스 서비스
│   ├── stores/                   # 8개 Zustand 스토어
│   ├── types/                    # 28개 타입 정의
│   ├── schemas/                  # 18개 Zod 스키마
│   ├── errors/                   # 에러 시스템 (6개)
│   │   ├── AppError.ts           # 기본 에러 클래스
│   │   ├── BusinessErrors.ts     # 비즈니스 로직 에러
│   │   ├── errorUtils.ts         # 에러 유틸리티
│   │   ├── firebaseErrorMapper.ts # Firebase 에러 변환
│   │   └── serviceErrorHandler.ts # 서비스 에러 처리
│   │
│   ├── repositories/             # 9개 (Repository 패턴) ⭐
│   │   ├── interfaces/           # Repository 인터페이스
│   │   │   ├── IApplicationRepository.ts
│   │   │   ├── IJobPostingRepository.ts
│   │   │   └── IWorkLogRepository.ts
│   │   └── firebase/             # Firebase 구현체
│   │       ├── ApplicationRepository.ts
│   │       ├── JobPostingRepository.ts
│   │       └── WorkLogRepository.ts
│   │
│   ├── shared/                   # 22개 (공유 로직) ⭐
│   │   ├── errors/               # hookErrorHandler
│   │   ├── id/                   # IdNormalizer (ID 정규화)
│   │   ├── realtime/             # RealtimeManager (실시간 구독)
│   │   ├── role/                 # RoleResolver (권한 계산)
│   │   ├── status/               # StatusMapper (상태 흐름)
│   │   └── time/                 # TimeNormalizer (시간 정규화)
│   │
│   ├── domains/                  # 도메인 로직 ⭐
│   │   ├── application/
│   │   ├── job/
│   │   ├── schedule/
│   │   ├── settlement/
│   │   └── staff/
│   │
│   ├── utils/                    # 29개 유틸리티
│   ├── lib/                      # 라이브러리 설정 (6개)
│   │   ├── queryClient.ts        # React Query + Query Keys
│   │   ├── firebase.ts           # Firebase 지연 초기화
│   │   ├── mmkvStorage.ts        # MMKV 저장소
│   │   ├── secureStorage.ts      # Secure Storage
│   │   └── env.ts                # 환경변수
│   ├── config/                   # 설정 (2개)
│   │   └── env.ts
│   └── constants/                # 상수 (7개)
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
│  Hooks Layer (40개 커스텀 훅)                               │
│  └─ 상태와 서비스 연결, 로딩/에러 상태 관리                   │
├─────────────────────────────────────────────────────────────┤
│  State Layer (Zustand 8개 + TanStack Query)                 │
│  └─ Zustand: UI/세션 상태  |  Query: 서버 데이터 캐싱        │
├─────────────────────────────────────────────────────────────┤
│  Shared Layer (22개 공유 모듈)                              │
│  └─ IdNormalizer, RoleResolver, StatusMapper, TimeNormalizer │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (33개 서비스)                                │
│  └─ 비즈니스 로직, Repository 호출, 에러 처리                │
├─────────────────────────────────────────────────────────────┤
│  Repository Layer (9개) ⭐                                  │
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
```

### 서비스 레이어 (33개)

```yaml
Core (7개):
  - authService (17.2KB): 로그인/회원가입/소셜로그인
  - jobService (9.6KB): 공고 조회/필터링/검색
  - applicationService (30.7KB): 지원 트랜잭션 (v2.0 Assignment) ⭐ 가장 복잡
  - scheduleService (24.1KB): WorkLogs + Applications 병합
  - workLogService (20.1KB): 근무 기록
  - notificationService (16.4KB): 알림 조회/읽음처리
  - reportService (15.4KB): 양방향 신고 시스템

Employer (5개):
  - jobManagementService (26.9KB): 공고 생성/수정/삭제
  - applicantManagementService (23.4KB): 지원자 확정/거절
  - settlementService (36.3KB): 정산 계산/처리 ⭐ 가장 큰 파일
  - confirmedStaffService (20KB): 확정 스태프 관리
  - applicationHistoryService (25.3KB): 확정/취소 이력

Admin (4개):
  - adminService (12.5KB): 사용자 관리
  - announcementService (14.7KB): 공지 관리
  - tournamentApprovalService (11.3KB): 대회공고 승인
  - inquiryService (10.3KB): 문의 관리

Infrastructure (17개):
  - pushNotificationService (20.5KB): FCM 토큰 관리
  - eventQRService (17KB): QR 생성/검증 (3분 유효)
  - deepLinkService (18.4KB): 딥링크 라우팅
  - storageService (11.9KB): MMKV + SecureStore
  - sessionService (14.6KB): 토큰 관리
  - analyticsService (11.2KB): 이벤트 추적
  - crashlyticsService (11.2KB): 에러 로깅
  - performanceService (9.3KB): 성능 모니터링
  - featureFlagService (7.8KB): 기능 플래그
  - templateService (8.6KB): 공고 템플릿
  - accountDeletionService (13.2KB): 계정 삭제
  - inAppMessageService (9.5KB): 인앱 메시지
  - applicantConversionService (19KB): 지원자 변환
  - jobPostingMigration (9.5KB): 공고 마이그레이션
  - biometricService (12.3KB): 생체인증
  - cacheService (6.6KB): 캐시 관리
```

### 커스텀 훅 (40개)

```yaml
App (2):
  - useAppInitialize (13.3KB): Firebase 인증 상태, 초기화
  - useVersionCheck: 앱 버전 확인

Auth (4):
  - useAuth: 인증 상태 통합 (profile에서 권한 직접 계산)
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
  - useAssignmentSelection: 선택/취소

Schedule (8):
  - useSchedules (12.1KB): 스케줄 목록
  - useSchedulesByMonth, useSchedulesByDate
  - useTodaySchedules, useUpcomingSchedules
  - useScheduleDetail, useScheduleStats, useCalendarView

WorkLog (1):
  - useWorkLogs: 근무 기록

QR (2):
  - useQRCode: QR 생성
  - useEventQR: 이벤트 QR

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

Infrastructure (4):
  - useNavigationTracking: Analytics 추적
  - useNetworkStatus: 네트워크 상태
  - useDeepLink: 딥링크 라우팅
  - usePerformanceTrace: 성능 측정
  - useClearCache: 캐시 제거
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

### UI 컴포넌트 (48개)

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
| ApplicationRepository | applications | findByJobPosting, findByUser, create, updateStatus |
| JobPostingRepository | jobPostings | findActive, findByEmployer, create, update |
| WorkLogRepository | workLogs | findBySchedule, checkIn, checkOut |

### Shared 모듈

```typescript
// ID 정규화 (shared/id/)
const normalizedId = IdNormalizer.normalize(rawId);  // 'job_123' → 'job123'

// 역할 계산 (shared/role/)
const role = RoleResolver.resolve(profile);  // UserRole

// 상태 흐름 (shared/status/)
const nextStatus = StatusMapper.getNext('pending');  // 'confirmed'

// 시간 정규화 (shared/time/)
const normalized = TimeNormalizer.toFirestore(date);  // Timestamp
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

## 품질 지표 (통합)

### 웹앱 (app2/)

| 항목 | 목표 | 현재 |
|------|:----:|:----:|
| TypeScript 에러 | 0개 | 0개 |
| ESLint 경고 | < 10개 | - |
| 번들 크기 | < 300KB | 299KB |
| 테스트 커버리지 | 80% | 65% |
| 다크모드 적용 | 100% | 100% |
| 메모이제이션 | 필수 적용 | 236+ |

### 모바일앱 (uniqn-mobile/)

| 항목 | MVP 기준 | 출시 기준 | 현재 |
|------|:--------:|:---------:|:----:|
| TypeScript strict 에러 | 0개 | 0개 | 0개 |
| ESLint 에러 | 0개 | 0개 | 0개 |
| ESLint 경고 | < 10개 | < 5개 | - |
| 테스트 커버리지 (전체) | 14%+ | 60%+ | 14% |
| 테스트 커버리지 (services/) | 40%+ | 70%+ | 40% |
| Repository 패턴 적용 | 핵심 3개 | 전체 | 3개 |
| Shared 모듈 테스트 | 80%+ | 90%+ | 80%+ |

---

## 주요 문서 참조

### 공통 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 개발 가이드 | docs/core/DEVELOPMENT_GUIDE.md | 상세 개발 지침 |
| 테스트 가이드 | docs/core/TESTING_GUIDE.md | 테스트 작성법 |
| 아키텍처 | docs/reference/ARCHITECTURE.md | 시스템 구조 |
| 데이터 스키마 | docs/reference/DATA_SCHEMA.md | Firestore 스키마 |
| 배포 가이드 | docs/guides/DEPLOYMENT.md | 배포 절차 |
| 보안 가이드 | docs/operations/SECURITY.md | 보안 정책 |

### 모바일앱 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| RN 스펙 개요 | specs/react-native-app/README.md | 모바일앱 설계 개요 |
| 아키텍처 | specs/react-native-app/architecture.md | RN 앱 아키텍처 |
| API 스펙 | specs/react-native-app/api-spec.md | API 명세 |
| 화면 설계 | specs/react-native-app/screens/ | 화면별 상세 스펙 |
| 컴포넌트 | specs/react-native-app/components.md | 컴포넌트 설계 |

---

*마지막 업데이트: 2025-01-30*
*웹앱 버전: v0.2.3 | 모바일앱 버전: v1.0.0*
*문서 기준: 통합 구조 재편 + Repository 패턴 + Shared 모듈 적용 완료*
