# 💻 T-HOLDEM 개발 가이드

**최종 업데이트**: 2025년 9월 8일  
**버전**: v0.1.0 (개발 단계)  
**대상**: 개발자 및 기여자

> [!NOTE]
> **안내**: 이 문서는 현재 MVP(v0.1.0) 개발 단계를 기준으로 작성되었습니다. 일부 고급 기능(Web Workers 등)은 코드가 존재하더라도 안정화 및 테스트 단계에 있을 수 있습니다.

## 📋 목차

1. [개발 환경 설정](#-개발-환경-설정)
2. [프로젝트 구조](#-프로젝트-구조)
3. [코딩 규칙](#-코딩-규칙)
4. [UnifiedDataContext 사용법](#-unifieddatacontext-사용법)
5. [성능 최적화 가이드](#-성능-최적화-가이드)
6. [테스트 전략](#-테스트-전략)
7. [디버깅 및 로깅](#-디버깅-및-로깅)
8. [배포 준비](#-배포-준비)

## 🛠️ 개발 환경 설정

### 필수 요구사항
- **Node.js**: 18.0.0 이상
- **npm**: 8.0.0 이상
- **Firebase CLI**: 최신 버전

### 초기 설정

1. **프로젝트 클론 및 의존성 설치**
```bash
git clone <repository-url>
cd T-HOLDEM/app2
npm install
```

2. **Firebase CLI 설치**
```bash
npm install -g firebase-tools
firebase login
```

3. **환경 변수 설정**
```bash
# app2/.env 파일 생성
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 개발 서버 실행

```bash
# 개발 서버 시작
npm start

# Firebase 에뮬레이터와 함께 실행
npm run dev

# TypeScript 타입 체크
npm run type-check

# 코드 포맷팅
npm run format
```

## 📂 프로젝트 구조

### 핵심 디렉토리

```
app2/src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── common/         # 공통 컴포넌트 (버튼, 입력 등)
│   ├── tables/         # 테이블 관련 컴포넌트
│   ├── modals/         # 모달 컴포넌트
│   └── tabs/           # 탭 컴포넌트
│
├── contexts/           # React Context 
│   ├── UnifiedDataContext.tsx  # 🎯 통합 데이터 관리
│   └── AuthContext.tsx         # 사용자 인증
│
├── hooks/              # 커스텀 훅
│   ├── useUnifiedData.ts       # 🎯 데이터 접근 훅
│   ├── useSystemPerformance.ts # 성능 모니터링
│   ├── useSmartCache.ts        # 캐싱 최적화
│   └── useResponsive.ts        # 반응형 디자인
│
├── pages/              # 페이지 컴포넌트
│   ├── JobBoard/       # 구인 게시판
│   │   ├── JobListTab.tsx
│   │   └── MyApplicationsTab.tsx
│   ├── JobPostingDetail/   # 구인공고 상세
│   │   ├── ApplicantListTab.tsx
│   │   ├── StaffManagementTab.tsx
│   │   ├── ShiftManagementTab.tsx
│   │   └── EnhancedPayrollTab.tsx
│   ├── MySchedulePage/     # 내 스케줄
│   └── ProfilePage/        # 프로필
│
├── services/           # 비즈니스 로직 서비스
│   ├── unifiedDataService.ts   # 🎯 통합 데이터 서비스
│   ├── ApplicationHistoryService.ts # 지원서 이력
│   ├── BulkOperationService.ts     # 일괄 작업
│   └── EventService.ts             # 이벤트 관리
│
├── types/              # TypeScript 타입 정의
│   ├── unifiedData.ts  # 🎯 통합 데이터 타입
│   ├── common.ts       # 공통 타입
│   └── firebase.ts     # Firebase 타입
│
├── utils/              # 유틸리티 함수
│   ├── payrollCalculations.ts  # 🎯 급여 계산 통합
│   ├── workLogMapper.ts        # 워크로그 데이터 변환
│   ├── logger.ts              # 통합 로깅 시스템
│   ├── smartCache.ts          # 스마트 캐싱
│   ├── dateUtils.ts           # 날짜 처리
│   └── scheduleUtils.ts       # 스케줄 관련
│
└── workers/            # Web Workers
    └── payrollWorker.ts    # 급여 계산 워커
```

### 파일 네이밍 컨벤션

| 유형 | 패턴 | 예시 |
|------|------|------|
| **컴포넌트** | PascalCase | `StaffCard.tsx` |
| **훅** | camelCase (use로 시작) | `useUnifiedData.ts` |
| **서비스** | camelCase | `unifiedDataService.ts` |
| **유틸리티** | camelCase | `payrollCalculations.ts` |
| **타입** | camelCase | `unifiedData.ts` |
| **상수** | UPPER_CASE | `API_ENDPOINTS.ts` |

## 📏 코딩 규칙

### TypeScript 규칙

```typescript
// ✅ 올바른 타입 정의 (표준 필드명 사용)
interface Staff {
  id: string;
  staffId: string;        // 표준 필드명 ✅
  name: string;
  role: 'dealer' | 'server' | 'manager';  // 유니언 타입 활용
  createdAt?: Timestamp;  // 선택적 필드
}

// ✅ 엄격한 타입 체크
const processStaff = (staff: Staff): ProcessedStaff => {
  return {
    ...staff,
    displayName: staff.name.toUpperCase(),
  };
};

// ❌ 금지: any 타입
const badFunction = (data: any) => { /* ... */ };
```

> 📋 **표준 필드명 상세 정보**: [DATA_SCHEMA.md](./DATA_SCHEMA.md#-스키마-개요)에서 모든 컬렉션의 표준 필드명과 레거시 필드 매핑을 확인하세요.

### React 컴포넌트 규칙

```typescript
// ✅ 함수형 컴포넌트 + 메모이제이션
import React, { memo, useMemo, useCallback } from 'react';
import type { FC } from 'react';

interface StaffCardProps {
  staff: Staff;
  onEdit?: (staffId: string) => void;
}

const StaffCard: FC<StaffCardProps> = memo(({ staff, onEdit }) => {
  // ✅ 메모이제이션 활용
  const displayData = useMemo(() => ({
    name: staff.name,
    role: staff.role.toUpperCase(),
    formattedDate: format(staff.createdAt, 'yyyy-MM-dd'),
  }), [staff]);

  // ✅ 콜백 메모이제이션
  const handleEdit = useCallback(() => {
    onEdit?.(staff.staffId);
  }, [onEdit, staff.staffId]);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold">{displayData.name}</h3>
      <p className="text-gray-600">{displayData.role}</p>
      <button onClick={handleEdit}>편집</button>
    </div>
  );
});

// ✅ Display name 설정 (디버깅용)
StaffCard.displayName = 'StaffCard';

export default StaffCard;
```

### 로깅 규칙

```typescript
import { logger } from '../utils/logger';

// ✅ logger 사용 (console.log 금지)
logger.info('스태프 데이터 로딩 시작', { 
  component: 'StaffManagementTab',
  data: { eventId, userRole }
});

logger.error('API 호출 실패', { 
  component: 'unifiedDataService',
  error: error.message,
  data: { userId, operation: 'fetchApplications' }
});

// ❌ console.log 직접 사용 금지
console.log('Debug message');  // ❌
```

### Firebase 사용 규칙

```typescript
// ✅ 실시간 구독 패턴
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'staff'),
    (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Staff));
      setStaff(staffData);
    },
    (error) => {
      logger.error('Firebase 구독 에러', { error });
    }
  );

  return unsubscribe; // ✅ 클린업 필수
}, []);

// ✅ 표준 필드명 사용
const createWorkLog = async (data: CreateWorkLogData) => {
  const workLog = {
    staffId: data.staffId,    // ✅ 표준 필드
    eventId: data.eventId,    // ✅ 표준 필드
    date: data.date,
    // ❌ dealerId, jobPostingId 사용 금지
  };
  
  await addDoc(collection(db, 'workLogs'), workLog);
};
```

## 🎯 UnifiedDataContext 사용법

### 기본 사용법

```typescript
import { useUnifiedData } from '../hooks/useUnifiedData';

const MyComponent: FC = () => {
  // ✅ 통합 데이터 훅 사용
  const { 
    staff, 
    workLogs, 
    applications,
    loading,
    error,
    actions 
  } = useUnifiedData();

  // ✅ 로딩 상태 확인
  if (loading.initial) {
    return <div>데이터 로딩 중...</div>;
  }

  if (error) {
    return <div>오류: {error.message}</div>;
  }

  return (
    <div>
      {staff.map(s => (
        <StaffCard key={s.staffId} staff={s} />
      ))}
    </div>
  );
};
```

### 필터링 및 검색

```typescript
const StaffManagementTab: FC = () => {
  const { staff, workLogs } = useUnifiedData();
  const [selectedEventId, setSelectedEventId] = useState('');

  // ✅ 메모이제이션된 필터링
  const filteredWorkLogs = useMemo(() => 
    workLogs.filter(log => log.eventId === selectedEventId),
    [workLogs, selectedEventId]
  );

  // ✅ 검색 기능
  const searchResults = useMemo(() => 
    staff.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [staff, searchTerm]
  );

  return (
    <div>
      {/* UI 렌더링 */}
    </div>
  );
};
```

### 데이터 업데이트

```typescript
const useStaffActions = () => {
  const { actions } = useUnifiedData();

  const updateAttendance = useCallback(async (
    staffId: string, 
    status: AttendanceStatus
  ) => {
    try {
      await actions.updateAttendance(staffId, status);
      logger.info('출석 상태 업데이트 완료', { staffId, status });
    } catch (error) {
      logger.error('출석 상태 업데이트 실패', { error, staffId, status });
    }
  }, [actions]);

  return { updateAttendance };
};
```

## ⚡ 성능 최적화 가이드

### 1. Web Workers 활용

```typescript
// payrollWorker.ts
self.onmessage = function(e) {
  const { workLogs, jobPosting } = e.data;
  
  // 복잡한 계산을 백그라운드에서 처리
  const result = calculatePayroll(workLogs, jobPosting);
  
  self.postMessage(result);
};

// 컴포넌트에서 사용
const usePayrollWorker = () => {
  const [worker] = useState(() => new Worker('/payrollWorker.js'));
  
  const calculatePayroll = useCallback((workLogs, jobPosting) => {
    return new Promise((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
      worker.postMessage({ workLogs, jobPosting });
    });
  }, [worker]);

  return { calculatePayroll };
};
```

### 2. React Window 가상화

```typescript
import { FixedSizeList as List } from 'react-window';

const VirtualizedStaffList: FC<{ items: Staff[] }> = ({ items }) => {
  const Row = useCallback(({ index, style }) => (
    <div style={style}>
      <StaffCard staff={items[index]} />
    </div>
  ), [items]);

  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={80}
      itemData={items}
    >
      {Row}
    </List>
  );
};
```

### 3. 스마트 캐싱

```typescript
import { useSmartCache } from '../hooks/useSmartCache';

const useOptimizedData = () => {
  const { staff } = useUnifiedData();
  const cache = useSmartCache();

  const processedStaff = useMemo(() => {
    const cacheKey = 'processed-staff';
    
    // 캐시에서 먼저 확인
    let cached = cache.get(cacheKey);
    if (cached) return cached;

    // 캐시 미스 시 계산
    cached = staff.map(s => processStaffData(s));
    cache.set(cacheKey, cached, 300000); // 5분 캐싱
    
    return cached;
  }, [staff, cache]);

  return { processedStaff };
};
```

### 4. 번들 크기 최적화

```typescript
// ✅ 동적 import 활용
const LazyModal = React.lazy(() => 
  import('./StaffProfileModal').then(module => ({
    default: module.StaffProfileModal
  }))
);

// ✅ 트리 셰이킹 최적화
import { format } from 'date-fns'; // ✅ 필요한 함수만
// import * as dateFns from 'date-fns'; // ❌ 전체 import 금지
```

## 🧪 테스트 전략

### 단위 테스트

```typescript
// StaffCard.test.tsx
import { render, screen } from '@testing-library/react';
import { StaffCard } from './StaffCard';
import { mockStaff } from '../__mocks__/staffData';

describe('StaffCard', () => {
  it('스태프 이름이 올바르게 표시되어야 함', () => {
    render(<StaffCard staff={mockStaff} />);
    
    expect(screen.getByText(mockStaff.name)).toBeInTheDocument();
    expect(screen.getByText(mockStaff.role.toUpperCase())).toBeInTheDocument();
  });

  it('편집 버튼 클릭 시 콜백이 호출되어야 함', () => {
    const mockOnEdit = jest.fn();
    render(<StaffCard staff={mockStaff} onEdit={mockOnEdit} />);
    
    screen.getByText('편집').click();
    expect(mockOnEdit).toHaveBeenCalledWith(mockStaff.staffId);
  });
});
```

### E2E 테스트 (Playwright)

```typescript
// tests/staff-management.spec.ts
import { test, expect } from '@playwright/test';

test('스태프 관리 플로우', async ({ page }) => {
  // 로그인
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'admin@test.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-button"]');

  // 스태프 관리 페이지로 이동
  await page.goto('/admin/job-posting/test-id?tab=staff');
  
  // 스태프 목록 확인
  await expect(page.locator('[data-testid="staff-list"]')).toBeVisible();
  
  // 출석 상태 변경
  await page.click('[data-testid="attendance-button"]');
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

### 테스트 실행

```bash
# 단위 테스트
npm test

# 테스트 커버리지
npm run test:coverage

# E2E 테스트
npx playwright test

# CI용 테스트
npm run test:ci
```

### 테스트 목표
- **단위 테스트 커버리지**: > 80%
- **E2E 테스트 통과율**: 100% (현재 달성)
- **중요 플로우 커버리지**: 100%

## 🐛 디버깅 및 로깅

### 로깅 시스템

```typescript
// utils/logger.ts 사용
import { logger } from '../utils/logger';

// 컴포넌트별 로깅
logger.info('컴포넌트 마운트', { 
  component: 'StaffManagementTab',
  props: { eventId, userRole }
});

// 에러 로깅 (Sentry 자동 전송)
logger.error('API 호출 실패', {
  component: 'unifiedDataService',
  error: error.message,
  stack: error.stack,
  context: { userId, operation }
});

// 성능 로깅
logger.performance('렌더링 시간', {
  component: 'VirtualizedStaffTable',
  duration: performance.now() - startTime,
  itemCount: items.length
});
```

### 개발자 도구

```typescript
// React DevTools Profiler
import { Profiler } from 'react';

const onRenderCallback = (id, phase, actualDuration) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${id} ${phase} duration: ${actualDuration}ms`);
  }
};

<Profiler id="StaffManagementTab" onRender={onRenderCallback}>
  <StaffManagementTab />
</Profiler>
```

### Firebase 디버깅

```typescript
// Firebase 에뮬레이터 사용
if (process.env.NODE_ENV === 'development') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}

// 쿼리 성능 모니터링
const enableNetwork = async () => {
  await enableNetwork(db);
  logger.info('Firebase 네트워크 연결 활성화');
};
```

## 🚀 배포 준비

### 빌드 최적화

```bash
# 프로덕션 빌드
npm run build

# 번들 크기 분석
npm run analyze:bundle

# TypeScript 체크
npm run type-check

# 코드 품질 검사
npm run lint
npm run format:check
```

### 배포 전 체크리스트

- [ ] **TypeScript 에러 0개**
- [ ] **ESLint 경고 해결**
- [ ] **테스트 통과율 100%**
- [ ] **번들 크기 < 300KB**
- [ ] **환경 변수 설정 완료**
- [ ] **Firebase 프로덕션 설정**
- [ ] **Sentry 설정 확인**

### 성능 목표

| 지표 | 목표 | 현재 달성 |
|------|------|----------|
| **번들 크기** | < 300KB | 278.56KB ✅ |
| **초기 로딩** | < 2초 | 1.2초 ✅ |
| **Lighthouse 점수** | > 90점 | 91점 ✅ |
| **캐시 히트율** | > 80% | 92% ✅ |

## 🔗 관련 문서

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: 시스템 아키텍처 및 데이터 흐름
- **[DATA_SCHEMA.md](./DATA_SCHEMA.md)**: Firebase 컬렉션 상세 스키마
- **[API_REFERENCE.md](./API_REFERENCE.md)**: API 및 Firebase Functions 명세
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: 개발 중 발생하는 이슈 해결
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: 배포 환경 설정 및 가이드

## 💡 개발 팁

### VSCode 권장 설정

```json
// .vscode/settings.json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.strictNullChecks": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### 권장 확장프로그램

- **ES7+ React/Redux/React-Native snippets**
- **TypeScript Importer**
- **Prettier - Code formatter**
- **ESLint**
- **Firebase Explorer**
- **Error Lens**

---

*마지막 업데이트: 2025년 9월 8일 - UnifiedDataContext 개발 가이드 완성*