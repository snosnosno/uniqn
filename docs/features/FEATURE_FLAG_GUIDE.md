# Feature Flag 시스템 가이드

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: 🚀 **Production Ready**

T-HOLDEM 프로젝트의 기능 플래그 관리 시스템

---

## 📋 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [사용 방법](#사용-방법)
4. [관리 가이드](#관리-가이드)
5. [트러블슈팅](#트러블슈팅)
6. [FAQ](#faq)

---

## 개요

### 목적

Feature Flag 시스템은 **코드 삭제 없이** 기능을 동적으로 활성화/비활성화할 수 있는 메커니즘입니다.

### 주요 기능

- ✅ **코드 안정성**: 기능 코드를 삭제하지 않고 비활성화
- ✅ **유지보수성**: 단일 파일에서 모든 기능 제어
- ✅ **사용자 경험**: "준비 중" 페이지로 친화적 안내
- ✅ **메뉴 자동화**: 비활성 기능은 자동으로 메뉴에서 숨김
- ✅ **타입 안전성**: TypeScript 완전 지원

### 적용 범위

**초기 출시 시 비공개 처리된 페이지 (5개)**

| 페이지 | 경로 | Feature Flag | 상태 |
|--------|------|--------------|------|
| 토너먼트 관리 | `/app/tournaments` | `TOURNAMENTS` | 🚧 비활성 |
| 참가자 관리 | `/app/participants` | `PARTICIPANTS` | 🚧 비활성 |
| 테이블 관리 | `/app/tables` | `TABLES` | 🚧 비활성 |
| 교대 관리 | `/app/admin/shift-schedule` | `SHIFT_SCHEDULE` | 🚧 비활성 |
| 상금 관리 | `/app/admin/prizes` | `PRIZES` | 🚧 비활성 |

**공개된 페이지**

- ✅ 구인구직 (`JOB_BOARD`)
- ✅ 프로필 관리 (`PROFILE`)
- ✅ 스케줄 조회 (`SCHEDULE`)
- ✅ 출석 관리 (`ATTENDANCE`)
- ✅ 알림 시스템 (`NOTIFICATIONS`)
- ✅ 관리자 대시보드 (`ADMIN_DASHBOARD`)
- ✅ 구인공고 관리 (`JOB_POSTING_MANAGEMENT`)
- ✅ 사용자 관리 (`USER_MANAGEMENT`)
- ✅ 문의 관리 (`INQUIRY_MANAGEMENT`)
- ✅ 지원서 승인 (`APPROVALS`)

---

## 시스템 아키텍처

### 핵심 컴포넌트

```
📁 T-HOLDEM/app2/src/
├── 📁 config/
│   └── features.ts              # Feature Flag 설정 (중앙 관리)
├── 📁 components/
│   ├── ComingSoon.tsx           # "준비 중" 페이지 컴포넌트
│   └── 📁 navigation/
│       ├── MobileMenu.tsx       # 모바일 메뉴 (필터링 적용)
│       ├── BottomTabBar.tsx     # 하단 탭바 (필터링 적용)
│       └── ResponsiveNav.tsx    # 데스크톱 네비게이션 (필터링 적용)
└── App.tsx                      # 라우팅 (조건부 렌더링 적용)
```

### 데이터 흐름

```
┌──────────────────────┐
│  features.ts         │  ← 중앙 설정 파일
│  FEATURE_FLAGS       │
└──────────┬───────────┘
           │
           ├─────────────────────────┐
           │                         │
           ▼                         ▼
    ┌──────────────┐        ┌──────────────┐
    │  App.tsx     │        │  Navigation  │
    │  라우팅       │        │  메뉴 필터링  │
    └──────┬───────┘        └──────┬───────┘
           │                       │
           ▼                       ▼
    ┌──────────────┐        ┌──────────────┐
    │ ComingSoon   │        │  메뉴 숨김    │
    │ 준비 중 페이지│        │  처리         │
    └──────────────┘        └──────────────┘
```

---

## 사용 방법

### 1. Feature Flag 설정 파일

**위치**: `src/config/features.ts`

```typescript
export const FEATURE_FLAGS = {
  // 비공개 기능
  TOURNAMENTS: false,      // 토너먼트 관리
  PARTICIPANTS: false,     // 참가자 관리
  TABLES: false,          // 테이블 관리
  SHIFT_SCHEDULE: false,  // 교대 관리
  PRIZES: false,          // 상금 관리

  // 공개 기능
  JOB_BOARD: true,        // 구인구직
  PROFILE: true,          // 프로필 관리
  // ... 기타 공개 기능
} as const;
```

### 2. 라우팅에서 사용

**위치**: `src/App.tsx`

```typescript
import { FEATURE_FLAGS } from './config/features';
import ComingSoon from './components/ComingSoon';

// 조건부 라우팅
<Route path="tournaments" element={
  FEATURE_FLAGS.TOURNAMENTS ? (
    <Suspense fallback={<LoadingSpinner />}>
      <TournamentsPage />
    </Suspense>
  ) : (
    <ComingSoon feature="토너먼트 관리" />
  )
} />
```

### 3. 메뉴에서 사용

**위치**: `src/components/navigation/MobileMenu.tsx`

```typescript
import { FEATURE_FLAGS, FeatureFlag } from '../../config/features';

interface MenuItem {
  path: string;
  label: string;
  featureFlag?: FeatureFlag;  // Feature Flag 추가
}

const menuItems: MenuItem[] = [
  {
    path: '/app/tournaments',
    label: '토너먼트 관리',
    featureFlag: 'TOURNAMENTS',  // Feature Flag 지정
  },
  // ...
];

// 필터링 로직
const filteredMenuItems = menuItems.filter(item => {
  if (item.featureFlag && !FEATURE_FLAGS[item.featureFlag]) {
    return false;  // 비활성 기능은 메뉴에서 숨김
  }
  return true;
});
```

### 4. "준비 중" 페이지 커스터마이징

**위치**: `src/components/ComingSoon.tsx`

```typescript
// 기본 사용
<ComingSoon feature="토너먼트 관리" />

// 상세 정보 포함
<ComingSoon
  feature="토너먼트 관리"
  description="더 나은 경험을 위해 준비 중입니다."
  estimatedRelease="2025년 2분기"
  backPath="/app/profile"
  icon="🏆"
/>
```

### 5. 헬퍼 함수 사용

```typescript
import { isFeatureEnabled, getDisabledFeatures } from './config/features';

// 기능 활성화 여부 확인
if (isFeatureEnabled('TOURNAMENTS')) {
  // 토너먼트 기능 표시
}

// 비활성 기능 목록 조회
const disabledFeatures = getDisabledFeatures();
console.log('비활성 기능:', disabledFeatures);
// 출력: ['TOURNAMENTS', 'PARTICIPANTS', 'TABLES', 'SHIFT_SCHEDULE', 'PRIZES']
```

---

## 관리 가이드

### 기능 활성화 방법

**단계 1**: `src/config/features.ts` 파일 열기

**단계 2**: 해당 Feature Flag를 `true`로 변경

```typescript
export const FEATURE_FLAGS = {
  TOURNAMENTS: true,  // false → true로 변경
  // ...
} as const;
```

**단계 3**: 빌드 및 배포

```bash
npm run build
npm run deploy:all
```

**단계 4**: 배포 확인

- 해당 페이지 접근 가능 확인
- 메뉴에 자동 표시 확인

### 기능 비활성화 방법

**단계 1**: `src/config/features.ts` 파일 열기

**단계 2**: 해당 Feature Flag를 `false`로 변경

```typescript
export const FEATURE_FLAGS = {
  TOURNAMENTS: false,  // true → false로 변경
  // ...
} as const;
```

**단계 3**: 빌드 및 배포

```bash
npm run build
npm run deploy:all
```

### 새로운 Feature Flag 추가

**단계 1**: `src/config/features.ts`에 새 플래그 추가

```typescript
export const FEATURE_FLAGS = {
  // ... 기존 플래그

  /**
   * 새 기능 설명
   * - 경로: /app/new-feature
   * - 설명: 새 기능에 대한 설명
   */
  NEW_FEATURE: false,  // 초기값은 false (비활성)
} as const;
```

**단계 2**: 라우팅에 적용 (`src/App.tsx`)

```typescript
<Route path="new-feature" element={
  FEATURE_FLAGS.NEW_FEATURE ? (
    <NewFeaturePage />
  ) : (
    <ComingSoon feature="새 기능" />
  )
} />
```

**단계 3**: 메뉴에 추가 (필요 시)

```typescript
const menuItems = [
  // ... 기존 메뉴
  {
    path: '/app/new-feature',
    label: '새 기능',
    featureFlag: 'NEW_FEATURE',
  },
];
```

### 환경별 설정 (선택사항)

개발 환경에서만 특정 기능을 활성화하려면:

```typescript
// src/config/features.ts
export const isDevelopment = process.env.NODE_ENV === 'development';

// 개발 환경에서 모든 기능 활성화 (디버깅 용도)
if (isDevelopment) {
  // 특정 기능만 활성화
  (FEATURE_FLAGS as any).TOURNAMENTS = true;
  (FEATURE_FLAGS as any).PARTICIPANTS = true;
}
```

---

## 트러블슈팅

### 문제 1: Feature Flag 변경이 반영되지 않음

**원인**: 브라우저 캐시

**해결 방법**:
```bash
# 1. 개발 서버 재시작
npm start

# 2. 브라우저 하드 리프레시
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### 문제 2: TypeScript 타입 에러

**원인**: FeatureFlag 타입 불일치

**해결 방법**:
```typescript
// 올바른 사용
import { FEATURE_FLAGS, FeatureFlag } from './config/features';

interface MenuItem {
  featureFlag?: FeatureFlag;  // ✅ 정확한 타입
}

// 잘못된 사용
interface MenuItem {
  featureFlag?: string;  // ❌ 타입 불일치
}
```

### 문제 3: 메뉴에 비활성 기능이 계속 표시됨

**원인**: 필터링 로직 누락

**해결 방법**:
```typescript
// 필터링 로직 확인
const filteredMenuItems = menuItems.filter(item => {
  // Feature Flag 체크 추가
  if (item.featureFlag && !FEATURE_FLAGS[item.featureFlag]) {
    return false;
  }
  return true;
});
```

### 문제 4: URL 직접 접근 시 404 에러

**원인**: 라우팅에 Feature Flag 적용 누락

**해결 방법**:
```typescript
// App.tsx에 조건부 라우팅 추가
<Route path="your-feature" element={
  FEATURE_FLAGS.YOUR_FEATURE ? (
    <YourFeaturePage />
  ) : (
    <ComingSoon feature="기능 이름" />
  )
} />
```

### 문제 5: 프로덕션 빌드 실패

**원인**: TypeScript 에러

**해결 방법**:
```bash
# 타입 체크
npm run type-check

# 빌드 테스트
npm run build
```

---

## FAQ

### Q1. Feature Flag는 언제 사용해야 하나요?

**A**: 다음과 같은 경우에 사용합니다:
- 개발 중인 기능을 프로덕션에 배포하되 비활성화하려는 경우
- A/B 테스트를 위해 특정 사용자에게만 기능을 노출하려는 경우
- 점진적 출시(Progressive Rollout)가 필요한 경우
- 긴급 시 특정 기능을 즉시 비활성화해야 하는 경우

### Q2. Feature Flag를 영구적으로 사용해도 되나요?

**A**: 일반적으로 **임시 사용**을 권장합니다.
- ✅ **단기 사용**: 기능 출시 전 준비 기간
- ⚠️ **장기 사용**: 코드 복잡도 증가, 기술 부채 누적
- 💡 **권장**: 기능이 안정화되면 Feature Flag 제거 및 코드 정리

### Q3. 몇 개까지 Feature Flag를 만들 수 있나요?

**A**: 기술적 제한은 없지만, **관리 가능한 수준**을 유지해야 합니다.
- ✅ **권장**: 5-20개 이내
- ⚠️ **주의**: 20개 이상 시 관리 복잡도 증가
- 💡 **팁**: 정기적으로 사용하지 않는 플래그 제거

### Q4. 환경별로 다른 설정을 사용할 수 있나요?

**A**: 가능합니다.

```typescript
// 환경 변수 활용
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export const FEATURE_FLAGS = {
  DEBUG_MODE: isDevelopment,  // 개발 환경에서만 활성화
  ANALYTICS: isProduction,    // 프로덕션 환경에서만 활성화
};
```

### Q5. Feature Flag를 데이터베이스에 저장할 수 있나요?

**A**: 가능하지만, 현재 구현은 **코드 기반**입니다.

**장단점 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| **코드 기반** (현재) | 간단함, 타입 안전성, Git으로 버전 관리 | 변경 시 배포 필요 |
| **DB 기반** | 실시간 변경 가능, 배포 불필요 | 복잡도 증가, 타입 안전성 낮음 |

**고급 기능이 필요하면**: LaunchDarkly, Firebase Remote Config 등 외부 서비스 고려

### Q6. Feature Flag 변경 시 사용자에게 알려야 하나요?

**A**: 경우에 따라 다릅니다.

- ✅ **알려야 함**: 주요 기능 추가, 기능 제거
- ❌ **알릴 필요 없음**: 내부 테스트, 버그 수정
- 💡 **권장**: 공지사항 페이지 또는 알림 시스템 활용

### Q7. Feature Flag를 사용하면 성능에 영향이 있나요?

**A**: **무시할 수 있는 수준**입니다.

- ✅ **컴파일 타임**: 조건부 렌더링이 번들에 포함됨
- ✅ **런타임**: 간단한 boolean 체크만 수행
- 💡 **최적화**: 필요 시 React.memo로 재렌더링 방지

### Q8. 여러 팀원이 동시에 Feature Flag를 수정하면?

**A**: **Git Conflict** 발생 가능성이 있습니다.

**권장 사항**:
1. Feature Flag 변경 전 최신 코드 Pull
2. 변경 후 즉시 Commit & Push
3. Conflict 발생 시 수동 병합

### Q9. 삭제된 기능의 Feature Flag는 어떻게 처리하나요?

**A**: **제거**하는 것이 좋습니다.

```typescript
// 단계 1: Feature Flag 제거
export const FEATURE_FLAGS = {
  // OLD_FEATURE: false,  ← 삭제
  // ...
} as const;

// 단계 2: 관련 코드 제거
// - 라우팅에서 조건부 렌더링 제거
// - 메뉴에서 featureFlag 속성 제거

// 단계 3: 타입 체크 및 빌드
npm run type-check
npm run build
```

### Q10. "준비 중" 페이지를 커스터마이징하고 싶어요.

**A**: `ComingSoon.tsx` 컴포넌트를 수정하거나, Props로 커스터마이징하세요.

```typescript
// Props로 커스터마이징
<ComingSoon
  feature="토너먼트 관리"
  description="더 나은 경험을 위해 개선 중입니다."
  estimatedRelease="2025년 3월"
  icon="🏆"
  backPath="/app/profile"
  backButtonText="프로필로 돌아가기"
/>

// 또는 ComingSoon.tsx 파일 직접 수정
// src/components/ComingSoon.tsx
```

---

## 📚 참고 자료

### 관련 파일

- **설정 파일**: [src/config/features.ts](../../app2/src/config/features.ts)
- **준비 중 페이지**: [src/components/ComingSoon.tsx](../../app2/src/components/ComingSoon.tsx)
- **라우팅**: [src/App.tsx](../../app2/src/App.tsx)
- **레이아웃**: [src/components/layout/Layout.tsx](../../app2/src/components/layout/Layout.tsx)

### 외부 문서

- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [React Conditional Rendering](https://react.dev/learn/conditional-rendering)
- [TypeScript const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0.1 | 2025-12-06 | 삭제된 navigation 컴포넌트 링크 제거 | Claude |
| 1.0.0 | 2025-01-23 | 초기 문서 작성 | Claude |

---

## 📞 문의

Feature Flag 시스템 관련 문의사항은 개발팀에 문의해주세요.

---

*이 문서는 T-HOLDEM 프로젝트의 Feature Flag 시스템을 설명합니다.*
*마지막 업데이트: 2025년 1월 23일*
