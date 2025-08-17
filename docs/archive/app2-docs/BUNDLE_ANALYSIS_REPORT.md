# 🔍 T-HOLDEM 번들 분석 보고서

## 📊 현재 번들 구성 분석

### 대용량 라이브러리 사용 현황

#### 1. **FullCalendar** (~500KB)
- **사용 위치**: `src/pages/MySchedulePage/components/ScheduleCalendar.tsx`
- **사용 모듈**:
  - `@fullcalendar/react`
  - `@fullcalendar/daygrid`
  - `@fullcalendar/timegrid`
  - `@fullcalendar/list`
  - `@fullcalendar/interaction`
- **영향도**: 스케줄 페이지에서만 사용 (Code Splitting으로 분리됨)

#### 2. **react-data-grid** (~200KB) ✅ 최적화 완료
- **사용 위치**: `src/components/ShiftGridComponent.tsx`
- **영향도**: 교대 근무 관리 페이지에서만 사용
- **최적화**: @tanstack/react-table (~25KB)로 교체 완료

#### 3. **Firebase SDK** (~300KB)
- **사용 모듈**:
  - `firebase/app`
  - `firebase/auth`
  - `firebase/firestore`
  - `firebase/storage`
  - `firebase/functions`
- **영향도**: 전체 앱에서 필수적

#### 4. **기타 주요 라이브러리**
- **react-icons** (~50KB) - 아이콘
- **date-fns** (~75KB) - 날짜 처리
- **i18next** (~40KB) - 다국어 지원
- **@dnd-kit** (~100KB) - 드래그 앤 드롭

### 번들 크기 추정치
```
기본 React + TypeScript: ~150KB
Firebase SDK: ~300KB
라우팅 및 상태관리: ~50KB
UI 라이브러리 (Tailwind): ~20KB
유틸리티: ~100KB
-------------------
핵심 번들: ~620KB (gzipped: ~200KB)

동적 로드:
- FullCalendar: ~500KB (gzipped: ~150KB)
- react-data-grid: ~200KB (gzipped: ~60KB)
- 기타 페이지별 코드: ~300KB (gzipped: ~100KB)
```

## 🎯 최적화 대상 및 우선순위

### 🔴 높은 우선순위

#### 1. **FullCalendar 최적화**
**현재 문제점**:
- 5개 모듈 모두 import (실제로는 1-2개만 사용)
- 거대한 CSS 번들 포함

**최적화 방안**:
```typescript
// 현재 (모든 모듈 import)
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

// 개선안 1: 필요한 모듈만 import
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

// 개선안 2: 경량 대체 라이브러리
// react-big-calendar (~100KB) 또는 자체 구현
```

**예상 절감**: 300-400KB

#### 2. **Firebase SDK 최적화**
**현재 문제점**:
- 전체 모듈 import
- Storage는 제한적 사용

**최적화 방안**:
```typescript
// 현재
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// 개선안: 필요시에만 동적 import
const getStorage = () => import('firebase/storage').then(m => m.getStorage);
const getFunctions = () => import('firebase/functions').then(m => m.getFunctions);
```

**예상 절감**: 50-100KB

### 🟡 중간 우선순위

#### 3. **react-data-grid 대체**
**대체 방안**:
- `@tanstack/react-table` (~50KB) + 커스텀 스타일링
- 자체 테이블 컴포넌트 구현

**예상 절감**: 150KB

#### 4. **아이콘 최적화**
**현재 문제점**:
- react-icons에서 여러 아이콘 세트 사용

**최적화 방안**:
```typescript
// 현재
import { FaUser, FaClock } from 'react-icons/fa';
import { MdDashboard } from 'react-icons/md';

// 개선안: 필요한 아이콘만 직접 import
import FaUser from 'react-icons/fa/FaUser';
import FaClock from 'react-icons/fa/FaClock';
```

**예상 절감**: 30KB

### 🟢 낮은 우선순위

#### 5. **이미지 최적화**
- WebP 포맷 사용
- 이미지 lazy loading
- 적절한 크기 제공

#### 6. **폰트 최적화**
- 사용하는 글리프만 포함
- font-display: swap

## 📈 최적화 로드맵

### Phase 1 (1주일) ✅ 완료
- [x] 번들 분석 도구 설치 및 정확한 측정
- [x] FullCalendar 사용 패턴 분석 → LightweightCalendar 개발
- [x] Firebase SDK 동적 import 적용

### Phase 2 (2주일) ✅ 진행중
- [x] FullCalendar 경량 대체 → LightweightCalendar 구현 완료
- [x] react-data-grid 대체 POC → @tanstack/react-table 적용
- [x] 아이콘 최적화 → 커스텀 SVG 아이콘 생성

### Phase 3 (3주일)
- [ ] 선택된 대체 라이브러리 적용 (진행중)
- [ ] 이미지/폰트 최적화
- [ ] 성능 측정 및 검증

## 🎯 목표 메트릭

### 현재 추정치
- **초기 번들**: ~620KB (gzipped: ~200KB)
- **전체 크기**: ~1.6MB (gzipped: ~500KB)
- **LCP**: ~3.5초
- **FID**: ~150ms

### 목표치
- **초기 번들**: < 400KB (gzipped: ~130KB)
- **전체 크기**: < 1MB (gzipped: ~300KB)
- **LCP**: < 2.5초
- **FID**: < 100ms

## 🔧 즉시 실행 가능한 최적화

### 1. 사용하지 않는 의존성 제거
```bash
# 의존성 분석
npm ls
npx depcheck
```

### 2. Production 빌드 최적화
```json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false react-scripts build"
  }
}
```

### 3. 동적 import 추가
```typescript
// 무거운 컴포넌트 동적 로드
const ScheduleCalendar = lazy(() => 
  import('./pages/MySchedulePage/components/ScheduleCalendar')
);

const ShiftGridComponent = lazy(() => 
  import('./components/ShiftGridComponent')
);
```

## 📊 측정 방법

1. **번들 분석**:
   ```bash
   npm run analyze:bundle
   npm run analyze:bundle:interactive
   ```

2. **Lighthouse 측정**:
   - Chrome DevTools > Lighthouse
   - Mobile 설정으로 측정

3. **Web Vitals 모니터링**:
   - 이미 설치된 web-vitals 라이브러리 활용
   - 실사용자 메트릭 수집

## 💡 추가 권장사항

1. **CDN 활용**: 정적 리소스는 CDN으로 제공
2. **Service Worker**: 오프라인 지원 및 캐싱
3. **HTTP/2 Push**: 중요 리소스 미리 전송
4. **Brotli 압축**: gzip보다 20-30% 더 압축

이 보고서를 바탕으로 단계적으로 최적화를 진행하면, 초기 로딩 시간을 50% 이상 단축할 수 있을 것으로 예상됩니다.