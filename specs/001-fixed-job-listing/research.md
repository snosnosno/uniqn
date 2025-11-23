# Research: 고정공고 조회 Hook 및 카드 컴포넌트

**Branch**: `001-fixed-job-listing` | **Date**: 2025-11-23
**Phase**: Phase 0 - Technical Research
**Status**: 🔄 In Progress

## 목표

Phase 3 고정공고 조회 기능 구현에 필요한 기술적 불확실성을 해소하고, React + Firebase 기반 Best Practice를 확정합니다.

---

## R1: IntersectionObserver + React 통합 패턴

### 질문
React에서 IntersectionObserver를 Hook으로 구현하는 Best Practice는?

### 조사 결과

#### 1. useEffect cleanup에서 observer.disconnect() 호출 패턴

**Best Practice**:
```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !loading && hasMore) {
        loadMore();
      }
    },
    { threshold: 0.1 } // 10% 보이면 트리거
  );

  const target = targetRef.current;
  if (target) {
    observer.observe(target);
  }

  return () => {
    if (target) {
      observer.unobserve(target);
    }
    observer.disconnect(); // ✅ cleanup에서 반드시 호출
  };
}, [loading, hasMore, loadMore]);
```

**핵심**:
- `observer.disconnect()`를 cleanup 함수에서 반드시 호출하여 메모리 누수 방지
- `targetRef.current`를 변수에 저장 후 cleanup에서 사용 (closure 문제 회피)
- `observer.unobserve()`로 특정 요소 관찰 중단 후 `disconnect()` 호출

#### 2. 무한 스크롤 중복 요청 방지 (debounce/throttle)

**문제**: IntersectionObserver 콜백이 빠르게 여러 번 호출되어 중복 요청 발생 가능

**해결 방안 1 - 상태 기반 방지** (권장):
```typescript
const [isFetching, setIsFetching] = useState(false);

const loadMore = useCallback(async () => {
  if (isFetching || !hasMore || loading) return; // ✅ 중복 방지

  setIsFetching(true);
  try {
    await fetchNextPage();
  } finally {
    setIsFetching(false);
  }
}, [isFetching, hasMore, loading]);
```

**해결 방안 2 - lodash throttle/debounce** (선택):
```typescript
import { throttle } from 'lodash';

const throttledLoadMore = useMemo(
  () => throttle(loadMore, 1000, { leading: true, trailing: false }),
  [loadMore]
);
```

**권장**: 방안 1 (상태 기반 방지)이 더 명확하고 lodash 의존성 불필요

#### 3. React 18 Strict Mode에서 observer 재구독 문제 해결

**문제**: React 18 개발 모드에서 컴포넌트가 두 번 마운트되어 observer가 중복 생성될 수 있음

**해결**:
```typescript
useEffect(() => {
  let observer: IntersectionObserver | null = null;
  const target = targetRef.current;

  if (target && !loading && hasMore) {
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadMore();
      }
    });
    observer.observe(target);
  }

  return () => {
    if (observer) {
      observer.disconnect(); // ✅ 항상 cleanup
    }
  };
}, [loading, hasMore, loadMore]); // ✅ 의존성 배열 명시
```

**핵심**:
- `observer` 변수를 `let`으로 선언하여 cleanup에서 접근 가능
- 의존성 배열에 `loading`, `hasMore`, `loadMore` 포함하여 재생성 제어
- Strict Mode에서도 cleanup이 올바르게 호출되어 중복 방지

### 결론

✅ **채택 패턴**:
- useEffect cleanup에서 `observer.disconnect()` 필수 호출
- 상태 기반 중복 요청 방지 (`isFetching` 플래그)
- 의존성 배열 명시로 React 18 Strict Mode 대응

---

## R2: Firestore 커서 기반 페이지네이션

### 질문
onSnapshot과 getDocs를 혼용한 페이지네이션 패턴은?

### 조사 결과

#### 1. startAfter() 커서를 사용한 페이지 전환

**패턴**:
```typescript
// 초기 20개: onSnapshot (실시간 구독)
const initialQuery = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'fixed'),
  where('status', '==', 'open'),
  orderBy('createdAt', 'desc'),
  limit(20)
);

const unsubscribe = onSnapshot(initialQuery, (snapshot) => {
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setPostings(docs);
  setLastDoc(snapshot.docs[snapshot.docs.length - 1]); // ✅ 커서 저장
});

// 추가 페이지: getDocs (일회성 조회)
const loadMore = async () => {
  if (!lastDoc || !hasMore) return;

  const nextQuery = query(
    collection(db, 'jobPostings'),
    where('postingType', '==', 'fixed'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc), // ✅ 이전 페이지 마지막 문서부터 시작
    limit(20)
  );

  const snapshot = await getDocs(nextQuery);
  const newDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  setPostings(prev => [...prev, ...newDocs]); // ✅ 기존 데이터에 추가
  setLastDoc(snapshot.docs[snapshot.docs.length - 1]); // ✅ 새 커서 저장
  setHasMore(snapshot.docs.length === 20); // ✅ 20개 미만이면 마지막 페이지
};
```

#### 2. 실시간 구독 중 커서 업데이트 전략

**문제**: onSnapshot으로 초기 20개를 구독 중일 때, 새 공고가 추가되면 커서가 변경될 수 있음

**해결**:
```typescript
onSnapshot(initialQuery, (snapshot) => {
  if (snapshot.docChanges().length > 0) {
    // ✅ 변경 사항이 있으면 postings 업데이트
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setPostings(docs);

    // ✅ 커서는 항상 마지막 문서로 갱신
    setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
  }
});
```

**핵심**:
- 실시간 구독 중 새 공고가 추가되면 자동으로 `postings` 배열 갱신
- `lastDoc` 커서도 자동 갱신되어 다음 페이지 로드 시 올바른 위치부터 시작
- 추가 페이지는 실시간 구독하지 않으므로 페이지 새로고침 시에만 업데이트

#### 3. 페이지 경계에서 중복 문서 방지

**문제**: 초기 20개 실시간 구독 중 새 공고가 추가되면, 다음 페이지 로드 시 중복 가능

**해결**:
```typescript
const loadMore = async () => {
  if (!lastDoc || !hasMore || loading) return;

  const nextQuery = query(
    collection(db, 'jobPostings'),
    where('postingType', '==', 'fixed'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc), // ✅ 마지막 문서 이후부터 조회
    limit(20)
  );

  const snapshot = await getDocs(nextQuery);
  const newDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // ✅ ID 기반 중복 제거 (선택적)
  const existingIds = new Set(postings.map(p => p.id));
  const uniqueNewDocs = newDocs.filter(doc => !existingIds.has(doc.id));

  setPostings(prev => [...prev, ...uniqueNewDocs]);
  setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
  setHasMore(snapshot.docs.length === 20);
};
```

**핵심**:
- `startAfter(lastDoc)`로 이미 조회한 문서는 제외
- 필요 시 ID 기반 중복 제거 로직 추가 (선택 사항)
- 실시간 구독은 초기 20개만 적용하므로 대부분 중복 없음

### 결론

✅ **채택 패턴**:
- 초기 20개: `onSnapshot` + `limit(20)` (실시간 구독)
- 추가 페이지: `getDocs` + `startAfter(lastDoc)` + `limit(20)` (일회성 조회)
- 커서(`lastDoc`) 자동 갱신으로 실시간 구독 중 변경 사항 반영
- `startAfter()`로 중복 방지 (ID 기반 중복 제거는 선택 사항)

---

## R3: onSnapshot 성능 최적화

### 질문
20개 문서 실시간 구독 시 성능 및 비용 최적화 방법은?

### 조사 결과

#### 1. unsubscribe 시점 최적화

**패턴 1 - 컴포넌트 언마운트 시** (권장):
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // ...
  });

  return () => {
    unsubscribe(); // ✅ 컴포넌트 언마운트 시 구독 해제
  };
}, []);
```

**패턴 2 - 페이지 전환 시** (선택):
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // ...
  });

  // react-router-dom 사용 시
  return () => {
    unsubscribe(); // ✅ 페이지 전환 시 자동 호출
  };
}, [location.pathname]);
```

**권장**: 패턴 1 (컴포넌트 언마운트)이 더 간단하고 React 라이프사이클과 일치

#### 2. 복합 인덱스 구성

**Firestore 복합 인덱스**:
```
컬렉션: jobPostings
필드:
  - postingType (오름차순)
  - status (오름차순)
  - createdAt (내림차순)
```

**인덱스 생성 방법**:
1. Firebase Console → Firestore Database → 인덱스 탭
2. 복합 인덱스 추가:
   - `postingType` ASC
   - `status` ASC
   - `createdAt` DESC
3. 또는 쿼리 실행 시 자동 생성 링크 클릭

**성능 이점**:
- 쿼리 속도 10배 이상 향상 (인덱스 없으면 전체 스캔)
- 읽기 비용 감소 (필터링 후 정렬이 아닌 인덱스 직접 조회)

#### 3. React.memo와 useCallback을 활용한 리렌더링 최소화

**패턴**:
```typescript
// 1. 컴포넌트 메모이제이션
const FixedJobCard = React.memo<FixedJobCardProps>(({ posting, onApply, onViewDetail }) => {
  // ...
}, (prevProps, nextProps) => {
  // ✅ 커스텀 비교 함수 (선택 사항)
  return prevProps.posting.id === nextProps.posting.id &&
         prevProps.posting.updatedAt === nextProps.posting.updatedAt;
});

// 2. 부모 컴포넌트에서 콜백 메모이제이션
const JobBoardPage = () => {
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();

  const handleApply = useCallback((posting: FixedJobPosting) => {
    // ✅ useCallback으로 함수 안정화
    navigate(`/apply/${posting.id}`);
  }, [navigate]); // ✅ navigate만 의존성

  const handleViewDetail = useCallback((postingId: string) => {
    navigate(`/job-postings/${postingId}`);
  }, [navigate]);

  return (
    <>
      {postings.map(posting => (
        <FixedJobCard
          key={posting.id}
          posting={posting}
          onApply={handleApply} // ✅ 안정된 참조
          onViewDetail={handleViewDetail}
        />
      ))}
    </>
  );
};
```

**성능 측정**:
- React DevTools Profiler로 리렌더링 횟수 확인
- 목표: onSnapshot 업데이트 시 변경된 카드만 리렌더링

### 결론

✅ **채택 패턴**:
- 컴포넌트 언마운트 시 `unsubscribe()` 호출
- Firestore 복합 인덱스: `postingType + status + createdAt` (내림차순)
- `React.memo` + `useCallback`으로 리렌더링 최소화
- 성능 목표: 초기 로딩 <500ms, 실시간 업데이트 <200ms

---

## R4: React.memo + useCallback 패턴

### 질문
리스트 렌더링에서 메모이제이션 최적화 전략은?

### 조사 결과

#### 1. FixedJobCard를 React.memo로 래핑 시 비교 함수 필요 여부

**기본 사용** (권장):
```typescript
const FixedJobCard = React.memo<FixedJobCardProps>(({ posting, onApply, onViewDetail }) => {
  // 컴포넌트 로직
});
```

**핵심**:
- `React.memo`는 기본적으로 `props`의 얕은 비교(shallow comparison) 수행
- `posting` 객체가 참조 변경되지 않으면 리렌더링 방지
- **커스텀 비교 함수는 대부분 불필요** (성능 이득 미미, 코드 복잡도 증가)

**커스텀 비교 함수가 필요한 경우** (선택):
```typescript
const FixedJobCard = React.memo<FixedJobCardProps>(
  ({ posting, onApply, onViewDetail }) => {
    // ...
  },
  (prevProps, nextProps) => {
    // ✅ posting 내부 특정 필드만 비교하여 성능 최적화
    return (
      prevProps.posting.id === nextProps.posting.id &&
      prevProps.posting.viewCount === nextProps.posting.viewCount &&
      prevProps.posting.status === nextProps.posting.status
    );
  }
);
```

**권장**: 기본 `React.memo`만 사용. 성능 문제 발생 시 커스텀 비교 함수 추가

#### 2. onApply, onViewDetail 콜백의 useCallback 의존성 배열 설정

**패턴**:
```typescript
const JobBoardPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // ✅ 의존성 배열에 필요한 것만 포함
  const handleApply = useCallback((posting: FixedJobPosting) => {
    navigate(`/apply/${posting.id}`);
  }, [navigate]); // ✅ navigate만 의존성 (일반적으로 안정됨)

  const handleViewDetail = useCallback((postingId: string) => {
    // 조회수 증가 로직은 Firebase Function에서 처리
    navigate(`/job-postings/${postingId}`);
  }, [navigate]);

  // ❌ 잘못된 예시: 불필요한 의존성
  const handleApplyWrong = useCallback((posting: FixedJobPosting) => {
    navigate(`/apply/${posting.id}`);
  }, [navigate, posting]); // ❌ posting은 불필요 (매번 재생성)

  return (
    <>
      {postings.map(posting => (
        <FixedJobCard
          key={posting.id}
          posting={posting}
          onApply={handleApply}
          onViewDetail={handleViewDetail}
        />
      ))}
    </>
  );
};
```

**핵심**:
- `navigate`는 `useNavigate()` 훅에서 반환되는 안정된 참조 (의존성으로 안전)
- 콜백 함수 내부에서 사용하지 않는 값은 의존성 배열에 포함하지 않음
- 콜백 파라미터(`posting`, `postingId`)는 의존성 배열에 포함 불필요

#### 3. 부모 컴포넌트 리렌더링 시 자식 컴포넌트 재렌더링 방지

**전략**:
```typescript
const JobBoardPage = () => {
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();

  // ✅ 상태를 최소화하여 리렌더링 원인 제거
  const [filterStatus, setFilterStatus] = useState<'all' | 'open'>('open');

  // ✅ 콜백 메모이제이션
  const handleApply = useCallback((posting: FixedJobPosting) => {
    navigate(`/apply/${posting.id}`);
  }, [navigate]);

  // ✅ 필터링된 데이터를 useMemo로 메모이제이션
  const filteredPostings = useMemo(() => {
    if (filterStatus === 'all') return postings;
    return postings.filter(p => p.status === 'open');
  }, [postings, filterStatus]);

  return (
    <>
      {/* ✅ 필터링 UI는 별도 컴포넌트로 분리하여 격리 */}
      <FilterControls status={filterStatus} onStatusChange={setFilterStatus} />

      {/* ✅ 메모이제이션된 데이터 사용 */}
      {filteredPostings.map(posting => (
        <FixedJobCard
          key={posting.id}
          posting={posting}
          onApply={handleApply}
          onViewDetail={handleViewDetail}
        />
      ))}
    </>
  );
};
```

**핵심**:
- 부모 컴포넌트의 상태 변경을 최소화
- `useMemo`로 계산 비용이 높은 데이터 메모이제이션
- 자식 컴포넌트에 전달하는 props는 모두 안정된 참조 유지

### 결론

✅ **채택 패턴**:
- `React.memo` 기본 사용 (커스텀 비교 함수 불필요)
- `useCallback` 의존성 배열에는 실제 사용하는 외부 값만 포함 (`navigate` 등)
- `useMemo`로 필터링/정렬된 데이터 메모이제이션
- 성능 목표: 20개 카드 렌더링 <100ms, 스크롤 시 버벅임 없음

---

## R5: 다크모드 Tailwind CSS 패턴

### 질문
기존 프로젝트에서 사용 중인 다크모드 클래스 패턴은?

### 조사 결과

#### 1. 기존 컴포넌트에서 dark: 클래스 사용 예시 확인

**조사 대상 파일**:
- `app2/src/components/jobPosting/FixedPostingBadge.tsx`
- `app2/src/components/jobPosting/JobPostingList.tsx`

**예상 패턴** (CLAUDE.md 기준):
```tsx
// 카드 컴포넌트
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
  <h3 className="text-gray-900 dark:text-gray-100 font-bold">제목</h3>
  <p className="text-gray-600 dark:text-gray-300">설명</p>
</div>

// 버튼
<button className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600">
  버튼
</button>

// 배지
<span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
  상태
</span>
```

#### 2. 카드 컴포넌트 배경/텍스트 색상 조합

**권장 조합**:
```tsx
// 카드 배경
bg-white dark:bg-gray-800          // 메인 배경
bg-gray-50 dark:bg-gray-900        // 보조 배경 (구분 필요 시)

// 텍스트
text-gray-900 dark:text-gray-100   // 제목 (강조)
text-gray-700 dark:text-gray-200   // 부제목
text-gray-600 dark:text-gray-300   // 본문
text-gray-500 dark:text-gray-400   // 보조 정보

// 테두리
border-gray-200 dark:border-gray-700

// 그림자
shadow-md dark:shadow-lg           // 다크모드에서 더 강한 그림자
```

**FixedJobCard 예시**:
```tsx
const FixedJobCard = React.memo<FixedJobCardProps>(({ posting, onApply, onViewDetail }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* 제목 */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {posting.title}
      </h3>

      {/* 근무 정보 */}
      <div className="text-gray-600 dark:text-gray-300 mb-4">
        <p>주 {posting.fixedData.workSchedule.daysPerWeek}일 근무</p>
        <p>{posting.fixedData.workSchedule.startTime} - {posting.fixedData.workSchedule.endTime}</p>
      </div>

      {/* 모집 역할 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {posting.fixedData.requiredRolesWithCount.map((role, index) => (
          <span
            key={index}
            className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-3 py-1 rounded-full text-sm"
          >
            {role.name} {role.count}명
          </span>
        ))}
      </div>

      {/* 조회수 */}
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
        조회 {posting.fixedData.viewCount}
      </p>

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetail(posting.id)}
          className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          상세보기
        </button>
        <button
          onClick={() => onApply(posting)}
          className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          지원하기
        </button>
      </div>
    </div>
  );
});
```

#### 3. 호버 및 포커스 상태 다크모드 스타일

**패턴**:
```tsx
// 버튼 호버
hover:bg-blue-700 dark:hover:bg-blue-600

// 링크 호버
hover:text-blue-600 dark:hover:text-blue-400

// 카드 호버 (클릭 가능한 경우)
hover:shadow-lg dark:hover:shadow-xl
hover:bg-gray-50 dark:hover:bg-gray-750

// 포커스 (접근성)
focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
focus:outline-none
```

**FixedJobCard 클릭 가능 영역**:
```tsx
<div
  onClick={() => onViewDetail(posting.id)}
  className="
    bg-white dark:bg-gray-800
    rounded-lg shadow-md dark:shadow-lg
    p-6 border border-gray-200 dark:border-gray-700
    cursor-pointer
    hover:shadow-lg dark:hover:shadow-xl
    hover:bg-gray-50 dark:hover:bg-gray-750
    transition-all duration-200
  "
>
  {/* 카드 내용 */}
</div>
```

### 결론

✅ **채택 패턴**:
- 배경: `bg-white dark:bg-gray-800` (카드), `bg-gray-50 dark:bg-gray-900` (보조)
- 텍스트: `text-gray-900 dark:text-gray-100` (제목), `text-gray-600 dark:text-gray-300` (본문)
- 버튼: `bg-blue-600 dark:bg-blue-700` (primary), `bg-gray-200 dark:bg-gray-700` (secondary)
- 배지: `bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100`
- 호버: `hover:shadow-lg dark:hover:shadow-xl`, `transition-all duration-200`

---

## 종합 결론

### 기술 스택 확정

| 영역 | 기술 | 비고 |
|------|------|------|
| **Hook** | useEffect + onSnapshot/getDocs | 초기 20개 실시간 구독, 추가 페이지 일회성 조회 |
| **무한 스크롤** | IntersectionObserver API | threshold: 0.1, cleanup 필수 |
| **상태 관리** | useState (postings, loading, error, hasMore, lastDoc) | Zustand 불필요 (컴포넌트 레벨 상태) |
| **중복 방지** | isFetching 플래그 | lodash throttle/debounce 불필요 |
| **성능 최적화** | React.memo + useCallback | 커스텀 비교 함수 불필요 |
| **인덱스** | Firestore 복합 인덱스 | postingType + status + createdAt (DESC) |
| **다크모드** | Tailwind dark: 클래스 | bg-white dark:bg-gray-800 등 |

### 구현 우선순위

1. **Phase 1-1**: useFixedJobPostings Hook 구현 (onSnapshot + getDocs)
2. **Phase 1-2**: FixedJobCard 컴포넌트 구현 (다크모드 포함)
3. **Phase 1-3**: IntersectionObserver 무한 스크롤 통합
4. **Phase 1-4**: validateFixedJobPosting 검증 함수
5. **Phase 1-5**: 단위 테스트 작성 (Hook, 컴포넌트, 유틸)
6. **Phase 1-6**: 통합 테스트 작성 (전체 워크플로)

### 남은 작업

- ✅ Research 완료
- ⏳ Phase 1: Design artifacts 생성
  - data-model.md
  - contracts/ 디렉토리
  - quickstart.md
- ⏳ Phase 2: tasks.md 생성 (`/speckit.tasks` 명령)

---

**Status**: ✅ Research 완료 - Phase 1 Design으로 진행 가능
