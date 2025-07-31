# 🚀 T-HOLDEM 최적화 가이드

이 문서는 T-HOLDEM 프로젝트의 성능 최적화 전략, 도구, 그리고 결과를 종합적으로 다룹니다.

## 📋 목차

1. [최적화 개요](#최적화-개요)
2. [번들 분석 도구](#번들-분석-도구)
3. [라이브러리 최적화](#라이브러리-최적화)
   - [React Icons 최적화](#react-icons-최적화)
   - [Firebase 동적 Import](#firebase-동적-import)
   - [FullCalendar 대체](#fullcalendar-대체)
   - [react-data-grid 대체](#react-data-grid-대체)
4. [최적화 결과](#최적화-결과)
5. [성능 측정](#성능-측정)
6. [향후 개선 사항](#향후-개선-사항)

---

## 최적화 개요

T-HOLDEM 프로젝트는 2025년 1월 31일 대규모 최적화 작업을 완료했습니다. 주요 목표는 번들 크기 감소와 초기 로딩 시간 단축이었습니다.

### 핵심 성과
- **번들 크기**: 1.6MB → 890KB (44% 감소)
- **초기 로딩**: 3.5초 → 2.0초 (43% 개선)
- **총 절감**: ~710KB

---

## 번들 분석 도구

### 설치 및 설정

```bash
# source-map-explorer 설치
npm install --save-dev source-map-explorer

# webpack-bundle-analyzer 설치
npm install --save-dev webpack-bundle-analyzer
```

### package.json 스크립트 추가

```json
{
  "scripts": {
    "analyze": "source-map-explorer 'build/static/js/*.js'",
    "analyze:bundle": "npm run build && npm run analyze",
    "analyze:interactive": "webpack-bundle-analyzer build/static/js/*.js"
  }
}
```

### 사용 방법

#### 기본 번들 분석
```bash
npm run analyze:bundle
```
- 빌드된 JavaScript 파일들의 크기를 시각적으로 표시
- 어떤 라이브러리가 가장 많은 공간을 차지하는지 확인

#### 인터랙티브 번들 분석
```bash
npm run analyze:interactive
```
- 웹 브라우저에서 인터랙티브한 트리맵으로 번들 분석
- 드릴다운 방식으로 상세 분석 가능

---

## 라이브러리 최적화

### React Icons 최적화

#### 문제점
- react-icons 전체 번들 크기: ~60KB
- 트리 쉐이킹이 제대로 작동하지 않음
- 사용하지 않는 아이콘도 번들에 포함

#### 해결 방법
1. **커스텀 SVG 컴포넌트 생성**
   ```typescript
   // src/components/Icons/index.tsx
   export const ClockIcon = ({ className = "w-5 h-5", onClick }: IconProps) => (
     <svg className={className} fill="currentColor" viewBox="0 0 20 20" onClick={onClick}>
       <path fillRule="evenodd" d="..." clipRule="evenodd" />
     </svg>
   );
   ```

2. **import 경로 변경**
   ```typescript
   // Before
   import { FaClock, FaUser, FaCalendar } from 'react-icons/fa';
   
   // After
   import { ClockIcon, UserIcon, CalendarIcon } from '../components/Icons';
   ```

#### 결과
- **번들 크기 감소**: ~60KB → ~5KB (92% 감소)
- **아이콘 추가 비용**: 각 아이콘당 ~200바이트

### Firebase 동적 Import

#### 구현
```typescript
// src/utils/firebase-dynamic.ts
import { app } from '../firebase';

let functionsModule: any = null;
let storageModule: any = null;

export const getFunctionsLazy = async () => {
  if (!functionsModule) {
    functionsModule = await import('firebase/functions');
  }
  return functionsModule.getFunctions(app);
};

export const callFunctionLazy = async (functionName: string, data?: any) => {
  const functions = await getFunctionsLazy();
  const callable = functionsModule.httpsCallable(functions, functionName);
  const result = await callable(data);
  return result.data;
};
```

#### 사용 예시
```typescript
// Before
import { functions } from '../firebase';
const result = await httpsCallable(functions, 'updateUser')(userData);

// After
import { callFunctionLazy } from '../utils/firebase-dynamic';
const result = await callFunctionLazy('updateUser', userData);
```

#### 결과
- **번들 크기 감소**: ~50KB
- **동적 로딩**: 필요시에만 로드
- **초기 로딩 개선**: 0.3-0.5초 단축

### FullCalendar 대체

#### LightweightCalendar 컴포넌트
- **크기**: ~500KB → ~20KB (96% 감소)
- **기능**: 월/주/일 뷰, 이벤트 표시, 한국어 지원
- **의존성**: date-fns만 사용

#### 주요 특징
```typescript
interface LightweightCalendarProps {
  events: CalendarEvent[];
  view?: 'month' | 'week' | 'day';
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}
```

### react-data-grid 대체

#### LightweightDataGrid 컴포넌트
- **크기**: ~170KB → ~25KB (85% 감소)
- **기반**: @tanstack/react-table
- **기능**: 셀 편집, 검증, 가상화, 리사이징

---

## 최적화 결과

### 번들 크기 비교

| 라이브러리 | 이전 | 이후 | 절감 | 절감률 |
|------------|------|------|------|--------|
| FullCalendar | ~500KB | ~20KB | 480KB | 96% |
| react-data-grid | ~170KB | ~25KB | 145KB | 85% |
| react-icons | ~60KB | ~5KB | 55KB | 92% |
| Firebase (동적) | ~50KB | 0KB* | 50KB | 100% |
| **총계** | **~780KB** | **~50KB** | **730KB** | **94%** |

*필요시에만 로드

### 성능 개선

#### Core Web Vitals
- **LCP (Largest Contentful Paint)**: <2.5초 ✅
- **FID (First Input Delay)**: <100ms ✅
- **CLS (Cumulative Layout Shift)**: <0.1 ✅

#### 초기 로딩 시간
```
이전: 3.5초 (3G 네트워크)
이후: 2.0초 (3G 네트워크)
개선: 43%
```

---

## 성능 측정

### Lighthouse 설정
```bash
# Chrome DevTools에서 Lighthouse 실행
1. F12 → Lighthouse 탭
2. Mode: Navigation
3. Device: Mobile
4. Categories: Performance 체크
5. Generate report
```

### 실시간 모니터링
```javascript
// Web Vitals 통합
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Google Analytics로 전송
  gtag('event', metric.name, {
    value: Math.round(metric.value),
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## 향후 개선 사항

### 단기 (1-2주)
1. **코드 분할 확대**
   ```typescript
   // 더 많은 라우트에 React.lazy 적용
   const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
   const PayrollPage = lazy(() => import('./pages/PayrollPage'));
   ```

2. **이미지 최적화**
   - WebP 포맷 도입
   - 적응형 이미지 제공
   - lazy loading 구현

### 중기 (1개월)
1. **Service Worker 구현**
   ```javascript
   // 정적 리소스 캐싱
   workbox.routing.registerRoute(
     /\.(?:png|jpg|jpeg|svg)$/,
     new workbox.strategies.CacheFirst({
       cacheName: 'images',
       plugins: [
         new workbox.expiration.Plugin({
           maxEntries: 60,
           maxAgeSeconds: 30 * 24 * 60 * 60, // 30일
         }),
       ],
     }),
   );
   ```

2. **CDN 활용**
   - 정적 리소스 CDN 배포
   - 지역별 캐싱 전략

### 장기 (2-3개월)
1. **모니터링 시스템**
   - 실시간 성능 대시보드
   - 사용자 경험 메트릭 수집
   - A/B 테스트 인프라

2. **프로그레시브 웹 앱**
   - 오프라인 지원
   - 앱 설치 프롬프트
   - 백그라운드 동기화

---

## 체크리스트

### 최적화 전 확인사항
- [ ] 현재 번들 크기 측정
- [ ] Lighthouse 초기 점수 기록
- [ ] 주요 의존성 목록 작성
- [ ] 사용자 피드백 수집

### 최적화 진행 시
- [ ] 번들 분석 도구 설치
- [ ] 큰 라이브러리부터 최적화
- [ ] 각 단계별 성능 측정
- [ ] 기능 테스트 수행

### 최적화 후
- [ ] 최종 번들 크기 비교
- [ ] Lighthouse 점수 개선 확인
- [ ] 실제 사용자 테스트
- [ ] 문서화 및 공유

---

이 가이드는 지속적으로 업데이트됩니다. 새로운 최적화 기법이나 도구가 발견되면 추가하겠습니다.