# ⚡ UNIQN 성능 최적화 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (모바일앱 중심 + PortOne 결제 연동)
**상태**: ✅ **Production Ready**

> ⚠️ **LEGACY DOCUMENT**: 이 문서는 **레거시 웹앱(app2/)** 성능 최적화 가이드입니다.
> 웹앱 개발은 중단되었으며, 참고용으로만 보관됩니다.
>
> **📱 모바일앱(uniqn-mobile/) 성능 가이드**는 [CLAUDE.md](../../CLAUDE.md)의 "성능 규칙" 섹션을 참조하세요.
>
> **모바일앱 성능 목표**:
> | 지표 | 목표 |
> |------|------|
> | 첫 로드 | < 2초 |
> | 화면 전환 | < 300ms |
> | 리스트 스크롤 | 60fps (FlashList) |
> | 테스트 커버리지 | 14% → 60% (목표) |

---

## 📋 목차

1. [성능 현황 (v0.2.2)](#-성능-현황-v022)
2. [번들 최적화](#-번들-최적화)
3. [React 성능 최적화](#-react-성능-최적화)
4. [Firebase 성능 최적화](#-firebase-성능-최적화)
5. [고급 최적화 기법](#-고급-최적화-기법)
6. [성능 모니터링](#-성능-모니터링)
7. [성능 테스트](#-성능-테스트)
8. [향후 최적화 계획](#-향후-최적화-계획)

---

## 🎯 성능 현황 (v0.2.2 Production Ready)

### 🏆 주요 성과 지표 (실제 운영 성과)

| 지표 | Before (v0.1.0) | After (v0.2.2) | 개선율 |
|------|------------------|-----------------|--------|
| **메인 번들 크기** | 450KB+ | **278KB** | **38% 감소** |
| **캐시 효율** | 미적용 | **92% 히트율** | **데이터 접근 속도 향상** |
| **TypeScript 에러** | 100+ 개 | **0개** | **100% 해결** |
| **컴포넌트 수** | 47개 | **17개** | **65% 감소** |
| **Web Worker** | 미적용 | **급여 계산 백그라운드 처리** | **UI 블로킹 방지** |
| **가상화 리스트** | 미적용 | **1000+ 아이템 60fps 유지** | **대용량 데이터 성능** |
| **Optimistic Updates** | 미적용 | **즉시 UI 업데이트** | **사용자 경험 향상** |

### 📊 프로덕션 빌드 현황 (실제 운영)
```bash
File sizes after gzip:
  278.56 kB  build\static\js\main.a41411df.js      # 메인 번들
  98.67 kB   build\static\js\164.46dc771a.chunk.js # 두 번째 청크
  27.47 kB   build\static\js\562.95ae6023.chunk.js # 세 번째 청크
  ... (총 38개 청크로 최적화)
```

---

## 📦 번들 최적화

### 현재 적용된 최적화

#### 1. 코드 스플리팅 (Code Splitting)
```typescript
// 페이지 레벨 코드 스플리팅
const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));
const MySchedulePage = lazy(() => import('./pages/MySchedulePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// 컴포넌트 레벨 스플리팅
const VirtualizedStaffTable = lazy(() => 
  import('./components/staff/VirtualizedStaffTable')
);
```

#### 2. Tree Shaking 최적화
```typescript
// ✅ 올바른 import (필요한 것만)
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

// ❌ 피해야 할 import (전체 라이브러리)
import * as React from 'react';
import * as dateFns from 'date-fns';
```

#### 3. 번들 분석
```bash
# 번들 분석 도구 실행
npm run build
npm run analyze

# 주요 최적화 포인트
- date-fns: 필요한 함수만 import
- lodash: lodash-es 사용으로 tree shaking 적용
- Firebase: 필요한 모듈만 import
```

### 추가 최적화 방법

#### 1. 동적 Import 확대
```typescript
// 모달 컴포넌트 지연 로딩
const openModal = async (type: string) => {
  const { Modal } = await import(`./modals/${type}Modal`);
  // 모달 렌더링
};

// 차트 라이브러리 지연 로딩
const loadChart = async () => {
  const { Chart } = await import('chart.js');
  return Chart;
};
```

#### 2. 외부 라이브러리 최적화
```typescript
// 작은 대체 라이브러리 사용
import { clsx } from 'clsx';           // classnames 대신
import { nanoid } from 'nanoid';       // uuid 대신
import { produce } from 'immer';       // 불변성 관리
```

---

### 1. UnifiedDataContext: 5개 → 1개 구독 통합

**성과**: 5개의 개별 Firebase 구독을 단일 `UnifiedDataContext`로 통합하여 **Firestore 읽기 수를 80% 감소**시키고 데이터 동기화 로직을 중앙에서 관리합니다.

```typescript
// 이전: 5개의 개별 구독으로 인한 비효율
const { data: staff } = useCollection(query(collection(db, 'staff')));
const { data: workLogs } = useCollection(query(collection(db, 'workLogs')));
// ... 3개 더 반복

// 현재: 단일 컨텍스트로 모든 데이터 관리
const { state, loading } = useUnifiedData();
const { staff, workLogs, applications } = state;
```

### 2. Web Worker 기반 급여 계산

**성과**: 복잡한 급여 계산 로직을 Web Worker로 이전하여 **메인 스레드 블로킹을 100% 방지**하고, 500명 이상의 스태프에 대한 급여 계산도 2초 이내에 완료합니다.

```typescript
// workers/payrollCalculator.worker.ts
self.onmessage = (event) => {
  const { workLogs, settings } = event.data;
  const results = calculatePayrolls(workLogs, settings);
  self.postMessage(results);
};

// usePayrollWorker.ts 훅
const { results, calculate } = usePayrollWorker();
calculate(workLogs, settings); // UI 블로킹 없이 계산 실행
```

### 현재 적용된 최적화

#### 1. React.memo 적용
```typescript
// ApplicantListTabUnified 최적화
export const ApplicantListTabUnified = React.memo(({ 
  applications, 
  onApprove, 
  onReject 
}: Props) => {
  // 컴포넌트 로직
});

// MemoizedApplicantRow 최적화
const MemoizedApplicantRow = React.memo(ApplicantRow, (prevProps, nextProps) => {
  return (
    prevProps.application.id === nextProps.application.id &&
    prevProps.application.status === nextProps.application.status
  );
});
```

#### 2. 메모이제이션 패턴
```typescript
// useMemo로 비용이 큰 계산 캐싱
const expensiveCalculation = useMemo(() => {
  return workLogs.reduce((total, log) => 
    total + calculateWorkHours(log), 0
  );
}, [workLogs]);

// useCallback으로 함수 참조 안정화
const handleStaffUpdate = useCallback((staffId: string, updates: Partial<Staff>) => {
  updateStaff(staffId, updates);
}, [updateStaff]);
```

#### 3. 가상화 (Virtualization)
```typescript
// 대용량 리스트 가상화
import { FixedSizeList as List } from 'react-window';

const VirtualizedStaffTable = ({ staff }: Props) => (
  <List
    height={600}
    itemCount={staff.length}
    itemSize={60}
    itemData={staff}
  >
    {StaffRow}
  </List>
);
```

### 추가 최적화 기법

#### 1. 상태 분할 (State Splitting)
```typescript
// ❌ 하나의 큰 상태 객체
const [appState, setAppState] = useState({
  staff: [],
  workLogs: [],
  applications: [],
  ui: { loading: false }
});

// ✅ 분할된 상태 관리
const [staff, setStaff] = useState([]);
const [workLogs, setWorkLogs] = useState([]);
const [loading, setLoading] = useState(false);
```

#### 2. 조건부 렌더링 최적화
```typescript
// ✅ 조건부 import와 렌더링
const ConditionalComponent = ({ shouldRender, data }: Props) => {
  if (!shouldRender) return null;
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent data={data} />
    </Suspense>
  );
};
```

---

## 🔥 Firebase 성능 최적화

### 현재 적용된 최적화

#### 1. 실시간 구독 최적화
```typescript
// UnifiedDataContext에서 효율적인 구독 관리
useEffect(() => {
  const unsubscribers: Array<() => void> = [];
  
  // 필요한 컬렉션만 구독
  if (user) {
    unsubscribers.push(
      subscribeToStaff(),
      subscribeToWorkLogs(),
      subscribeToApplications()
    );
  }
  
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}, [user]);
```

#### 2. 쿼리 최적화
```typescript
// 인덱스 활용한 효율적 쿼리
const getStaffWorkLogs = (staffId: string, startDate: Date, endDate: Date) => {
  return query(
    collection(db, 'workLogs'),
    where('staffId', '==', staffId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
    limit(100)
  );
};
```

#### 3. 캐싱 전략
```typescript
// 로컬 상태 캐싱
const [cache, setCache] = useState(new Map());

const getCachedData = useCallback((key: string) => {
  if (cache.has(key)) {
    return cache.get(key);
  }
  // Firebase에서 데이터 가져오기
}, [cache]);
```

### 추가 최적화 방법

#### 1. 오프라인 지원
```typescript
// Firestore 오프라인 지원 활성화
import { enableNetwork, disableNetwork } from 'firebase/firestore';

// 네트워크 상태에 따른 동적 처리
window.addEventListener('online', () => enableNetwork(db));
window.addEventListener('offline', () => disableNetwork(db));
```

#### 2. 데이터 압축
```typescript
// 대용량 데이터 압축 전송
import { compress, decompress } from 'lz-string';

const saveCompressedData = (data: object) => {
  const compressed = compress(JSON.stringify(data));
  return setDoc(doc(db, 'compressed', id), { data: compressed });
};
```

---

## 🚀 고급 최적화 기법

### Web Workers 활용
```typescript
// 급여 계산 Web Worker (현재 구현됨)
// workers/payrollWorker.ts
self.onmessage = (e) => {
  const { workLogs, payRates } = e.data;
  
  const calculations = workLogs.map(log => ({
    staffId: log.staffId,
    totalPay: calculatePay(log, payRates)
  }));
  
  self.postMessage(calculations);
};

// 메인 스레드에서 사용
const calculatePayrollAsync = (workLogs: WorkLog[]) => {
  return new Promise((resolve) => {
    const worker = new Worker('/workers/payrollWorker.js');
    worker.postMessage({ workLogs, payRates });
    worker.onmessage = (e) => resolve(e.data);
  });
};
```

### Service Worker 캐싱
```typescript
// public/sw.js - 정적 자산 캐싱
const CACHE_NAME = 'tholdem-v0.2.2';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

### IndexedDB 캐싱
```typescript
// 로컬 데이터베이스 캐싱
import { openDB } from 'idb';

const dbPromise = openDB('tholdem-cache', 1, {
  upgrade(db) {
    db.createObjectStore('staff');
    db.createObjectStore('workLogs');
  },
});

export const cacheData = async (store: string, key: string, data: any) => {
  const db = await dbPromise;
  await db.put(store, data, key);
};
```

---

## 📊 성능 모니터링

### 현재 모니터링 도구

#### 1. React DevTools Profiler
```typescript
// 성능 측정 래퍼 컴포넌트
const PerformanceWrapper = ({ children, name }: Props) => {
  useEffect(() => {
    const start = performance.now();
    return () => {
      const end = performance.now();
      logger.info(`${name} render time: ${end - start}ms`);
    };
  });
  
  return <>{children}</>;
};
```

#### 2. 웹 바이탈 측정
```typescript
// Web Vitals 측정
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

#### 3. 번들 크기 모니터링
```bash
# package.json scripts
"analyze": "npm run build && npx webpack-bundle-analyzer build/static/js/*.js"
"size-limit": "size-limit"
```

### 성능 예산 설정
```json
// .size-limit.json
[
  {
    "path": "build/static/js/main.*.js",
    "limit": "300 KB"
  },
  {
    "path": "build/static/css/main.*.css",
    "limit": "50 KB"
  }
]
```

---

## 🧪 성능 테스트

### 자동화된 성능 테스트
```typescript
// Playwright 성능 테스트
import { test, expect } from '@playwright/test';

test('페이지 로드 성능', async ({ page }) => {
  const startTime = Date.now();
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000); // 3초 이내
});

test('대용량 데이터 렌더링', async ({ page }) => {
  await page.goto('/staff-management');
  
  // 1000개 스태프 데이터 로드
  await page.evaluate(() => {
    // 대용량 데이터 시뮬레이션
  });
  
  const renderTime = await page.evaluate(() => {
    return performance.measure('render-time').duration;
  });
  
  expect(renderTime).toBeLessThan(1000); // 1초 이내
});
```

### 메모리 누수 테스트
```typescript
// 메모리 사용량 모니터링
const monitorMemory = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    logger.info('Memory usage:', {
      used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
      total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB'
    });
  }
};

// 주기적 메모리 모니터링
setInterval(monitorMemory, 30000);
```

---

## 🎯 향후 최적화 계획

### 단기 계획 (v0.3.0)

#### 1. 추가 번들 최적화
- [ ] Micro-frontend 아키텍처 검토
- [ ] CSS-in-JS 최적화 (emotion → styled-components)
- [ ] 이미지 최적화 (WebP, lazy loading)

#### 2. 런타임 최적화
- [ ] React 18 Concurrent Features 적용
- [ ] Suspense Boundary 확대 적용
- [ ] Error Boundary 성능 최적화

### 중기 계획 (v0.4.0)

#### 1. 고급 캐싱 전략
- [ ] GraphQL 캐싱 (Apollo Client)
- [ ] HTTP 캐싱 헤더 최적화
- [ ] CDN 활용 (Cloudflare)

#### 2. 모바일 최적화
- [ ] PWA 고도화
- [ ] 모바일 특화 컴포넌트
- [ ] 터치 인터랙션 최적화

### 장기 계획 (v0.5.0+)

#### 1. Edge Computing
- [ ] Cloudflare Workers 활용
- [ ] Edge 캐싱 전략
- [ ] 지역별 성능 최적화

#### 2. AI 기반 최적화
- [ ] 예측적 프리로딩
- [ ] 사용자 패턴 기반 최적화
- [ ] 자동 성능 튜닝

---

## 📈 성능 지표 목표

### 현재 상태 (v0.2.2)
- **First Contentful Paint**: ~1.2초
- **Largest Contentful Paint**: ~2.1초
- **Time to Interactive**: ~2.8초
- **번들 크기**: 279KB (gzipped)

### 목표 지표 (v0.3.0)
- **First Contentful Paint**: <1.0초
- **Largest Contentful Paint**: <1.5초
- **Time to Interactive**: <2.0초
- **번들 크기**: <250KB (gzipped)

### Core Web Vitals 목표
- **LCP (Largest Contentful Paint)**: <2.5초
- **FID (First Input Delay)**: <100ms
- **CLS (Cumulative Layout Shift)**: <0.1

---

## 🛠️ 성능 최적화 도구

### 개발 도구
```bash
# 성능 분석 도구
npm run analyze              # 번들 분석
npm run lighthouse          # Lighthouse 성능 측정
npm run size-limit          # 번들 크기 체크
npm run perf:test           # 성능 테스트 실행
```

### 모니터링 도구
- **Lighthouse CI**: 자동화된 성능 측정
- **Web Vitals**: 핵심 웹 지표 모니터링
- **Bundle Analyzer**: 번들 크기 분석
- **React DevTools**: 컴포넌트 성능 프로파일링

---

## 📚 추가 리소스

### 성능 관련 문서
- [React 성능 최적화 가이드](https://react.dev/learn/render-and-commit)
- [웹 성능 최적화](https://web.dev/performance/)
- [Firebase 성능 모니터링](https://firebase.google.com/docs/perf-mon)

### 도구 및 라이브러리
- [React.memo](https://react.dev/reference/react/memo)
- [React Window](https://github.com/bvaughn/react-window)
- [Web Vitals](https://github.com/GoogleChrome/web-vitals)
- [size-limit](https://github.com/ai/size-limit)

---

**⚠️ 이 문서는 레거시 웹앱(app2/) 성능 최적화 가이드입니다.**
**📱 모바일앱(uniqn-mobile/) 성능 가이드는 CLAUDE.md를 참조하세요.**

*마지막 업데이트: 2026년 2월 1일*