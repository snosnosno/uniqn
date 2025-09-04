# 📚 T-HOLDEM 기술 문서

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [최적화 가이드](#최적화-가이드)
3. [마이그레이션 가이드](#마이그레이션-가이드)
4. [성능 분석](#성능-분석)
5. [보안 구현](#보안-구현)
6. [개발 가이드](#개발-가이드)

---

## 프로젝트 개요

T-HOLDEM은 홀덤 포커 토너먼트 운영을 위한 종합 웹 플랫폼입니다.

### 🛠️ 기술 스택

#### Frontend
- **Framework**: React 18 + TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **State Management**: Context API + Zustand
- **Build Tool**: Create React App

#### Backend
- **Platform**: Firebase
  - Authentication
  - Firestore Database
  - Cloud Functions
  - Storage
  - Performance Monitoring

#### Testing & Monitoring
- **Testing**: Jest, React Testing Library
- **Error Tracking**: Sentry
- **Performance**: Firebase Performance, Web Vitals

### 🚀 **핵심 기술 구현 사항**
- ✅ **Web Workers**: 백그라운드 처리 시스템
- ✅ **가상화**: 대용량 리스트 성능 최적화
- ✅ **스마트 캐싱**: IndexedDB 기반 영구 캐시
- ✅ **지연 로딩**: 컴포넌트 코드 스플리팅
- ✅ **E2E 테스트**: Playwright 기반 테스트 프레임워크
- ✅ **UnifiedDataContext**: 통합 데이터 관리
- ✅ **보안 강화**: Firebase 키 및 환경 변수 보호

> 📊 **상세한 성과 지표**는 [PRODUCT_SPEC.md](PRODUCT_SPEC.md) 참조

---

## 최적화 가이드

### 🎯 번들 크기 최적화

#### 1. 라이브러리 교체

##### React Icons → @heroicons/react
```typescript
// Before (14.5KB per icon)
import { FaUser, FaPhone } from 'react-icons/fa';

// After (1.2KB per icon)
import { UserIcon, PhoneIcon } from '@heroicons/react/24/outline';
```
**절감 효과**: ~200KB

##### FullCalendar → LightweightCalendar
```typescript
// 커스텀 경량 캘린더 구현
const LightweightCalendar = React.lazy(() => import('./LightweightCalendar'));
```
**절감 효과**: ~300KB

##### react-data-grid → @tanstack/react-table
```typescript
// 가상화 + 경량 테이블
import { useReactTable } from '@tanstack/react-table';
```
**절감 효과**: ~150KB

#### 2. 동적 Import 전략

##### Firebase 서비스 동적 로딩
```typescript
// firebase-dynamic.ts
export const getStorageLazy = async () => {
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
};

export const getFunctionsLazy = async () => {
  const { getFunctions } = await import('firebase/functions');
  return getFunctions(app);
};
```

##### 코드 분할
```typescript
// 라우트 기반 분할
const CEODashboard = React.lazy(() => import('./pages/admin/CEODashboard'));
const ParticipantsPage = React.lazy(() => import('./pages/ParticipantsPage'));
const TablesPage = React.lazy(() => import('./pages/TablesPage'));
const PrizesPage = React.lazy(() => import('./pages/PrizesPage'));

// 컴포넌트 기반 분할
const QRScannerModal = React.lazy(() => import('./components/QRScannerModal'));
const PerformanceMonitor = React.lazy(() => import('./components/PerformanceMonitor'));
```

### ⚡ 성능 최적화

#### 1. React 최적화

##### 메모이제이션
```typescript
// useMemo로 비용이 큰 계산 최적화
const totalChips = useMemo(() => {
  return participants.reduce((sum, p) => sum + (p.chips || 0), 0);
}, [participants]);

// useCallback으로 함수 재생성 방지
const handleSubmit = useCallback((data: FormData) => {
  // 처리 로직
}, [dependencies]);
```

##### React.memo로 리렌더링 방지
```typescript
export default React.memo(StaffCard, (prevProps, nextProps) => {
  return prevProps.staff.id === nextProps.staff.id &&
         prevProps.isSelected === nextProps.isSelected;
});
```

#### 2. 가상화

##### 대량 데이터 처리
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {Row}
</FixedSizeList>
```

---

## 마이그레이션 가이드

### 🔄 상태 관리 마이그레이션 (Context → Zustand)

#### 완료된 마이그레이션
1. **ToastContext → toastStore** ✅
2. **JobPostingContext → jobPostingStore** ✅

#### 예정된 마이그레이션
- **TournamentContext → tournamentStore** (복잡도 높음)

#### Zustand Store 예시
```typescript
// stores/toastStore.ts
import { create } from 'zustand';

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: Date.now().toString() }]
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  }))
}));
```

### 📐 TypeScript Strict Mode 마이그레이션

#### 설정
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### 일반적인 패턴
```typescript
// Undefined 체크
const value = data?.property || defaultValue;

// 배열 접근 안전성
const item = array[index];
if (item) {
  // 안전하게 사용
}

// Union 타입 처리
function processDate(date: string | Timestamp | undefined) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if ('toDate' in date) return date.toDate().toISOString();
  return '';
}
```

---

## 성능 분석

### 📊 Web Vitals 측정

#### Firebase Performance 통합
```typescript
// utils/firebasePerformance.ts
import { getPerformance, trace } from 'firebase/performance';

export const measureDatabaseOperation = async <T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> => {
  const customTrace = trace(getPerformance(), `db_${operationName}`);
  customTrace.start();
  
  try {
    const result = await operation();
    customTrace.stop();
    return result;
  } catch (error) {
    customTrace.putAttribute('error', 'true');
    customTrace.stop();
    throw error;
  }
};
```

#### 성능 지표
- **FCP (First Contentful Paint)**: < 1.8s
- **LCP (Largest Contentful Paint)**: < 2.5s  
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1
- **TTFB (Time to First Byte)**: < 600ms

### 🔍 번들 분석

#### 분석 도구 설정
```bash
# 설치
npm install --save-dev source-map-explorer webpack-bundle-analyzer

# package.json 스크립트
"scripts": {
  "analyze": "source-map-explorer 'build/static/js/*.js'",
  "analyze:bundle": "npm run build && npm run analyze"
}
```

#### 현재 번들 구성 (2025년 1월)
```
main.js (273KB gzipped)
├── React & React-DOM: ~45KB
├── Firebase Core: ~35KB
├── Tailwind CSS: ~12KB
├── 비즈니스 로직: ~180KB
└── 기타 의존성: ~1KB
```

---

## 보안 구현

### 🛡️ 보안 체크리스트

#### 1. 환경 변수 관리
```typescript
// .env 파일 (Git 제외)
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
```

#### 2. CSP (Content Security Policy)
```html
<!-- public/index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://apis.google.com; 
               style-src 'self' 'unsafe-inline';">
```

#### 3. XSS 방지
```typescript
// DOMPurify 사용
import DOMPurify from 'dompurify';

const sanitizedHTML = DOMPurify.sanitize(userInput);
```

#### 4. Firebase Security Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 읽기 가능
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 관리자만 쓰기 가능
    match /jobPostings/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      request.auth.token.role == 'admin';
    }
  }
}
```

---

## 개발 가이드

### 🚀 시작하기

#### 환경 설정
```bash
# 저장소 클론
git clone https://github.com/your-repo/t-holdem.git
cd t-holdem

# 의존성 설치
cd app2
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 Firebase 설정 추가

# 개발 서버 실행
npm start
```

#### 주요 스크립트
```bash
# 개발 서버
npm start

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test

# 번들 분석
npm run analyze

# 타입 체크
npm run type-check

# 린트
npm run lint
```

### 📁 프로젝트 구조

#### 전체 구조
```
T-HOLDEM/
├── app2/                 # 메인 React 애플리케이션
├── docs/                 # 프로젝트 문서
├── scripts/              # 유틸리티 스크립트
├── functions/            # Firebase Functions
├── SHRIMP/              # 태스크 관리 시스템
└── claude_set/          # Claude Code 설정
```

#### 애플리케이션 구조 (app2/src/)
```
src/
├── components/           # 재사용 가능한 컴포넌트
│   ├── common/          # 공통 UI 컴포넌트
│   ├── staff/           # 스태프 모듈화 컴포넌트 ✨
│   ├── payroll/         # 급여 관련 컴포넌트 ✨
│   ├── jobPosting/      # 구인공고 컴포넌트
│   └── ui/              # 기본 UI 컴포넌트
├── pages/               # 페이지 컴포넌트
│   ├── admin/           # 관리자 페이지
│   └── JobBoard/        # 모듈화된 구인게시판
├── hooks/               # 커스텀 훅
├── stores/              # Zustand 스토어 (3개)
├── contexts/            # Context API (Auth, Tournament)
├── utils/               # 유틸리티 함수
│   └── security/        # 보안 관련 유틸
├── types/               # TypeScript 타입 정의
│   └── unified/         # 통합 타입
└── firebase.ts          # Firebase 설정
```

> 📌 상세한 구조는 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) 참조

### 🔧 코딩 컨벤션

#### TypeScript
- Strict Mode 준수
- 모든 any 타입 제거
- undefined 체크 필수

#### React
- 함수형 컴포넌트 사용
- Custom Hook으로 로직 분리
- 메모이제이션 적극 활용

#### 스타일
- Tailwind CSS 우선 사용
- 컴포넌트별 CSS 모듈 (필요시)
- BEM 네이밍 (커스텀 CSS)

### 🐛 디버깅

#### 구조화된 로깅
```typescript
import { logger } from './utils/logger';

// 사용 예시
logger.info('작업 시작', { component: 'StaffCard', operation: 'update' });
logger.error('작업 실패', error, { context: additionalInfo });
```

#### Firebase 에뮬레이터
```bash
# 에뮬레이터 시작
firebase emulators:start

# 환경 변수 설정
REACT_APP_USE_FIREBASE_EMULATOR=true
```

---

## 📚 참고 자료

### 내부 문서
- [프로젝트 현황](PROJECT_STATUS_2025_01_17.md)
- [마이그레이션 보고서](archive/2025-01/MIGRATION_REPORT.md)
- [프로젝트 가이드](../CLAUDE.md)

### 외부 리소스
- [React 공식 문서](https://react.dev)
- [Firebase 문서](https://firebase.google.com/docs)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

*최종 업데이트: 2025년 1월 17일*
*작성자: Claude Code Assistant*