# Research: 구인공고 타입 확장 시스템

**Feature**: 001-job-posting-types | **Date**: 2025-10-30
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Research Areas

### 1. Firestore 타입별 쿼리 최적화

**Decision**: 타입별 쿼리 분리 + 복합 인덱스 사용

**Rationale**:
- Firestore는 `where` 절을 사용한 필터링을 지원하며, 단일 필드 인덱스는 자동 생성됨
- 복합 쿼리(정렬 + 필터)는 명시적 인덱스 필요
- 타입별 쿼리 분리로 전체 조회를 방지하여 읽기 비용 절감
- 현재 시스템에서도 `type`, `recruitmentType` 필드로 필터링 사용 중

**Implementation**:
```typescript
// 타입별 쿼리
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'regular'),
  where('status', '==', 'open'),
  orderBy('createdAt', 'desc')
);
```

**Required Firestore Indexes**:
1. `postingType` + `status` + `createdAt` (DESC)
2. `postingType` + `createdBy` + `createdAt` (DESC) - 내 공고 조회용
3. `postingType` + `tournamentConfig.approvalStatus` + `createdAt` (DESC) - 승인 대기 조회용

**Alternatives Considered**:
- ❌ 전체 조회 후 클라이언트 필터링: 읽기 비용 과다, 성능 저하
- ❌ 타입별 컬렉션 분리: 복잡도 증가, 크로스 타입 쿼리 불가
- ✅ 타입별 쿼리 + 인덱스: 최적의 성능과 유연성

### 2. 날짜 슬라이더 구현 패턴

**Decision**: date-fns + 가로 스크롤 + IntersectionObserver

**Rationale**:
- date-fns는 프로젝트에서 이미 사용 중 (4.1.0)
- 16일 범위는 가로 스크롤로 충분히 표시 가능 (모바일 친화적)
- IntersectionObserver로 오늘 날짜 자동 스크롤
- Tailwind CSS로 다크모드 지원

**Implementation**:
```tsx
// 날짜 범위 생성 (어제 ~ +14일)
const dates = useMemo(() => {
  const today = new Date();
  const yesterday = subDays(today, 1);
  return Array.from({ length: 16 }, (_, i) => addDays(yesterday, i));
}, []);

// 날짜 필터링 (클라이언트 측)
const filteredPostings = useMemo(() => {
  if (!selectedDate) return postings;
  return postings.filter(p =>
    p.dateSpecificRequirements.some(req =>
      isSameDay(parseISO(req.date), selectedDate)
    )
  );
}, [postings, selectedDate]);
```

**UI Components**:
- DateSlider: 가로 스크롤 컨테이너
- DateButton: 개별 날짜 버튼 (클릭/터치 지원)
- TodayIndicator: 파란색 배경 강조
- AllButton: 전체 버튼 (필터 해제)

**Alternatives Considered**:
- ❌ React Calendar 라이브러리: 오버킬, 번들 크기 증가
- ❌ Firestore 날짜 쿼리: 비용 증가, 복잡한 쿼리
- ✅ 클라이언트 측 필터링: 간단하고 효율적

### 3. 타입별 시각적 차별화

**Decision**: Tailwind CSS + 조건부 클래스 + Keyframe 애니메이션

**Rationale**:
- Tailwind CSS는 프로젝트 표준 (3.3.3)
- 다크모드 지원이 내장되어 있음
- Keyframe 애니메이션으로 깜빡이는 효과 구현
- 컴포넌트 재사용성 유지

**Implementation**:
```tsx
// 타입별 스타일 맵
const postingStyles = {
  regular: {
    border: 'border-gray-300 dark:border-gray-600',
    icon: '📋',
    bg: 'bg-white dark:bg-gray-800'
  },
  fixed: {
    border: 'border-l-4 border-l-blue-500 dark:border-l-blue-400',
    icon: '📌',
    bg: 'bg-white dark:bg-gray-800'
  },
  tournament: {
    border: 'border-l-4 border-l-purple-500 dark:border-l-purple-400',
    icon: '🏆',
    bg: 'bg-white dark:bg-gray-800'
  },
  urgent: {
    border: 'border-2 border-red-500 dark:border-red-400 animate-pulse-border',
    icon: '🚨',
    bg: 'bg-white dark:bg-gray-800'
  }
};

// Tailwind config 추가
module.exports = {
  theme: {
    extend: {
      animation: {
        'pulse-border': 'pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgb(239 68 68)' },
          '50%': { borderColor: 'rgb(239 68 68 / 0.5)' }
        }
      }
    }
  }
};
```

**Alternatives Considered**:
- ❌ CSS-in-JS (styled-components): 번들 크기 증가, 프로젝트 표준 아님
- ❌ 별도 CSS 파일: 유지보수 어려움, 다크모드 구현 복잡
- ✅ Tailwind + 조건부 클래스: 프로젝트 표준, 다크모드 지원

### 4. 승인 시스템 아키텍처

**Decision**: Firebase Functions + Firestore Trigger + 권한 체크

**Rationale**:
- Firebase Functions는 프로젝트에서 이미 사용 중
- Firestore Trigger로 승인 상태 변경 감지 및 알림 전송
- Security Rules로 admin 권한 체크
- 승인/거부 이력 추적 가능

**Implementation**:
```typescript
// Firebase Function (backend)
export const approveJobPosting = onCall(async (request) => {
  // 1. admin 권한 체크
  if (!request.auth || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin 권한이 필요합니다');
  }

  // 2. 공고 업데이트
  const { postingId } = request.data;
  await db.collection('jobPostings').doc(postingId).update({
    'tournamentConfig.approvalStatus': 'approved',
    'tournamentConfig.approvedBy': request.auth.uid,
    'tournamentConfig.approvedAt': FieldValue.serverTimestamp()
  });

  // 3. 작성자에게 알림 전송 (Firestore Trigger에서 처리)
  return { success: true };
});

// Security Rules
match /jobPostings/{postingId} {
  allow update: if request.auth != null
    && (request.resource.data.tournamentConfig.approvalStatus == null
        || request.auth.token.role == 'admin');
}
```

**Alternatives Considered**:
- ❌ 클라이언트 측 직접 업데이트: 보안 취약, 권한 우회 가능
- ❌ 별도 승인 컬렉션: 데이터 중복, 동기화 문제
- ✅ Firebase Functions + Security Rules: 안전하고 확장 가능

### 5. 레거시 데이터 마이그레이션 전략

**Decision**: 런타임 변환 + 점진적 마이그레이션

**Rationale**:
- 즉시 배포 가능 (데이터 마이그레이션 불필요)
- 기존 공고 정상 작동 보장
- 점진적으로 새 필드로 전환
- 하위 호환성 유지

**Implementation**:
```typescript
// normalizePostingType 함수
export const normalizePostingType = (
  posting: Partial<JobPosting>
): 'regular' | 'fixed' | 'tournament' | 'urgent' => {
  // 1. 새 필드 우선
  if (posting.postingType) {
    return posting.postingType;
  }

  // 2. 레거시 필드 변환
  if (posting.type === 'application' || posting.recruitmentType === 'application') {
    logger.warn('레거시 application 타입을 regular로 변환', { postingId: posting.id });
    return 'regular';
  }

  if (posting.type === 'fixed' || posting.recruitmentType === 'fixed') {
    logger.warn('레거시 fixed 타입을 fixed로 유지', { postingId: posting.id });
    return 'fixed';
  }

  // 3. 기본값
  logger.warn('postingType 필드 없음, regular로 설정', { postingId: posting.id });
  return 'regular';
};
```

**Migration Path**:
1. Phase 1: 런타임 변환 배포 (즉시)
2. Phase 2: 새 공고는 postingType 사용 (1주일)
3. Phase 3: 배치 스크립트로 기존 데이터 업데이트 (선택)
4. Phase 4: 레거시 필드 제거 고려 (6개월 후)

**Alternatives Considered**:
- ❌ 즉시 데이터 마이그레이션: 다운타임 발생, 위험 높음
- ❌ 레거시 필드 제거: 기존 공고 오작동
- ✅ 런타임 변환 + 점진적 마이그레이션: 안전하고 유연

### 6. 확장 가능한 아키텍처 패턴

**Decision**: 설정 기반 + Feature Flag + 동적 탭 생성

**Rationale**:
- 새 타입 추가 시 최소한의 코드 변경
- Feature Flag로 점진적 롤아웃
- 동적 탭 생성으로 UI 자동 업데이트
- 중앙 집중식 설정 관리

**Implementation**:
```typescript
// config/chipPricing.ts
export const CHIP_PRICING = {
  fixed: {
    7: 3,
    30: 5,
    90: 10
  },
  urgent: 5,
  // 향후 추가: premium, sponsored 등
} as const;

// config/boardTabs.ts
export const BOARD_TABS = [
  {
    id: 'regular',
    labelKey: 'jobBoard.tabs.regular',
    icon: '📋',
    postingType: 'regular',
    order: 1,
    enabled: true
  },
  {
    id: 'fixed',
    labelKey: 'jobBoard.tabs.fixed',
    icon: '📌',
    postingType: 'fixed',
    order: 2,
    enabled: true
  },
  {
    id: 'tournament',
    labelKey: 'jobBoard.tabs.tournament',
    icon: '🏆',
    postingType: 'tournament',
    order: 3,
    enabled: FEATURE_FLAGS.TOURNAMENT_POSTINGS  // Feature Flag
  },
  {
    id: 'urgent',
    labelKey: 'jobBoard.tabs.urgent',
    icon: '🚨',
    postingType: 'urgent',
    order: 4,
    enabled: FEATURE_FLAGS.URGENT_POSTINGS
  }
  // 향후 추가: premium, sponsored 등
] as const;

// 동적 탭 생성
const enabledTabs = BOARD_TABS.filter(tab => tab.enabled);
```

**New Type Addition Checklist** (12 steps):
1. `types/jobPosting/jobPosting.ts`에 타입 추가
2. `config/chipPricing.ts`에 칩 가격 정의
3. `config/boardTabs.ts`에 탭 설정 추가
4. `utils/jobPosting/jobPostingHelpers.ts`에 타입 검증 추가
5. `locales/*/translation.json`에 i18n 키 추가
6. `components/jobPosting/JobPostingCard.tsx`에 스타일 추가
7. `firestore.rules`에 Security Rules 추가
8. Feature Flag 추가 (선택)
9. Unit Test 작성
10. Integration Test 작성
11. E2E Test 작성
12. 문서 업데이트

**Alternatives Considered**:
- ❌ 하드코딩: 유지보수 어려움, 확장 불가
- ❌ 별도 컬렉션: 복잡도 증가, 동기화 문제
- ✅ 설정 기반 + Feature Flag: 확장 가능하고 유연

### 7. 성능 최적화 전략

**Decision**: 메모이제이션 + 캐싱 + 가상화

**Rationale**:
- 불필요한 리렌더링 방지
- Firestore 읽기 비용 절감
- 대용량 리스트 성능 보장
- 번들 크기 최적화 (현재 299KB, 목표 350KB 이하)

**Implementation**:
```typescript
// 1. 메모이제이션
const filteredPostings = useMemo(() => {
  return postings.filter(p => p.postingType === activeTab);
}, [postings, activeTab]);

const handleTabChange = useCallback((tab: string) => {
  setActiveTab(tab);
}, []);

// 2. 캐싱 (Zustand store)
interface JobPostingStore {
  postings: Record<PostingType, JobPosting[]>;
  lastFetched: Record<PostingType, number>;
  fetchPostings: (type: PostingType) => Promise<void>;
}

const useJobPostingStore = create<JobPostingStore>((set, get) => ({
  postings: {},
  lastFetched: {},
  fetchPostings: async (type) => {
    const now = Date.now();
    const lastFetch = get().lastFetched[type] || 0;

    // 5분 이내 캐시 사용
    if (now - lastFetch < 5 * 60 * 1000) {
      return;
    }

    // Firestore 조회
    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', type)
    );
    const snapshot = await getDocs(q);

    set(state => ({
      postings: {
        ...state.postings,
        [type]: snapshot.docs.map(doc => doc.data())
      },
      lastFetched: {
        ...state.lastFetched,
        [type]: now
      }
    }));
  }
}));

// 3. 가상화 (react-window) - 대용량 리스트
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={filteredPostings.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <JobPostingCard posting={filteredPostings[index]} />
    </div>
  )}
</FixedSizeList>
```

**Performance Targets**:
- 초기 로드: < 3초 (3G)
- Time to Interactive: < 5초
- First Contentful Paint: < 1.5초
- 번들 크기: < 350KB (gzip)
- Firestore 읽기: 50% 절감 (캐싱)

**Alternatives Considered**:
- ❌ 최적화 없음: 성능 저하, 비용 증가
- ❌ Redux + Saga: 복잡도 증가, 프로젝트 표준 아님
- ✅ Zustand + 메모이제이션: 간단하고 효과적

## Research Summary

모든 기술적 불확실성이 해결되었습니다. 구현 패턴이 확정되었으며, 기존 프로젝트 구조와 일관성을 유지합니다.

**Key Decisions**:
1. Firestore 타입별 쿼리 + 복합 인덱스
2. date-fns + 가로 스크롤 + 클라이언트 필터링
3. Tailwind CSS + 조건부 클래스 + Keyframe 애니메이션
4. Firebase Functions + Firestore Trigger + Security Rules
5. 런타임 변환 + 점진적 마이그레이션
6. 설정 기반 + Feature Flag + 동적 탭 생성
7. 메모이제이션 + 캐싱 (5분 TTL) + 가상화

**Next Steps**: Phase 1 - Design & Contracts (data-model.md, contracts/, quickstart.md)
