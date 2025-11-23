# Quickstart: 고정공고 조회 Hook 및 카드 컴포넌트

**Branch**: `001-fixed-job-listing` | **Date**: 2025-11-23
**Phase**: Phase 1 - Design
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Data Model**: [data-model.md](./data-model.md)

## 개요

이 문서는 고정공고 조회 기능을 빠르게 시작하기 위한 개발 가이드입니다. Hook 사용법, 컴포넌트 통합 방법, 테스트 실행 방법을 단계별로 설명합니다.

---

## 1. 개발 환경 설정

### 1.1. 프로젝트 디렉토리 이동

```bash
cd app2
```

### 1.2. 의존성 설치 (최초 1회)

```bash
npm install
```

### 1.3. Firebase 에뮬레이터 실행 (선택 사항)

개발 중 Firestore 에뮬레이터를 사용하려면:

```bash
npm run emulators
```

**주의**: 에뮬레이터는 별도 터미널 창에서 실행하세요.

### 1.4. 개발 서버 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000` 자동 오픈됩니다.

---

## 2. Hook 사용법

### 2.1. useFixedJobPostings Hook 임포트

```typescript
import { useFixedJobPostings } from '@/hooks/useFixedJobPostings';
```

### 2.2. Hook 사용 예시

```typescript
const JobBoardPage = () => {
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();

  if (loading) {
    return <div className="text-center p-4">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4">
        에러가 발생했습니다: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        고정공고 목록
      </h1>

      {/* 공고 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {postings.map(posting => (
          <FixedJobCard
            key={posting.id}
            posting={posting}
            onApply={handleApply}
            onViewDetail={handleViewDetail}
          />
        ))}
      </div>

      {/* 더 보기 버튼 */}
      {hasMore && (
        <div className="text-center mt-8">
          <button
            onClick={loadMore}
            className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            더 보기
          </button>
        </div>
      )}

      {/* 모든 공고 확인 메시지 */}
      {!hasMore && postings.length > 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
          모든 공고를 확인했습니다.
        </p>
      )}

      {/* 빈 상태 */}
      {!loading && postings.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
          현재 모집 중인 고정공고가 없습니다.
        </p>
      )}
    </div>
  );
};
```

### 2.3. 콜백 함수 메모이제이션

```typescript
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const JobBoardPage = () => {
  const navigate = useNavigate();
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();

  // ✅ useCallback으로 함수 안정화
  const handleApply = useCallback((posting: FixedJobPosting) => {
    navigate(`/apply/${posting.id}`);
  }, [navigate]);

  const handleViewDetail = useCallback((postingId: string) => {
    navigate(`/job-postings/${postingId}`);
  }, [navigate]);

  // ...
};
```

---

## 3. 컴포넌트 사용법

### 3.1. FixedJobCard 컴포넌트 임포트

```typescript
import { FixedJobCard } from '@/components/jobPosting/FixedJobCard';
```

### 3.2. 컴포넌트 사용 예시

```typescript
<FixedJobCard
  posting={posting}
  onApply={handleApply}
  onViewDetail={handleViewDetail}
/>
```

### 3.3. Props 설명

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `posting` | FixedJobPosting | ✅ | 고정공고 데이터 |
| `onApply` | `(posting: FixedJobPosting) => void` | ✅ | 지원하기 버튼 클릭 핸들러 |
| `onViewDetail` | `(postingId: string) => void` | ✅ | 상세보기 핸들러 |

---

## 4. 무한 스크롤 구현

### 4.1. IntersectionObserver 기본 패턴

```typescript
import { useRef, useEffect } from 'react';

const JobBoardPage = () => {
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 이미 로딩 중이거나 더 이상 데이터가 없으면 observer 생성하지 않음
    if (loading || !hasMore) return;

    // IntersectionObserver 생성
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore(); // 하단 요소가 보이면 다음 페이지 로드
        }
      },
      { threshold: 0.1 } // 10% 보이면 트리거
    );

    // 관찰 대상 요소 등록
    const target = loadMoreRef.current;
    if (target) {
      observerRef.current.observe(target);
    }

    // Cleanup: observer 해제
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadMore]);

  return (
    <div>
      {/* 공고 목록 */}
      {postings.map(posting => (
        <FixedJobCard key={posting.id} posting={posting} {...handlers} />
      ))}

      {/* 무한 스크롤 트리거 요소 */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {loading ? (
            <span className="text-gray-500 dark:text-gray-400">로딩 중...</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">스크롤하여 더 보기</span>
          )}
        </div>
      )}
    </div>
  );
};
```

### 4.2. 중복 요청 방지

Hook 내부에서 `isFetching` 플래그로 처리되므로, 컴포넌트에서는 별도 처리 불필요합니다.

```typescript
// ✅ Hook 내부에서 이미 처리됨
const loadMore = () => {
  if (isFetching || !hasMore || loading) return; // 중복 방지
  setIsFetching(true);
  // ...
};
```

---

## 5. 다크모드 지원

### 5.1. 다크모드 클래스 패턴

모든 UI 요소에 `dark:` 클래스를 적용해야 합니다.

```tsx
// ✅ 올바른 다크모드
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
  <button className="bg-blue-600 dark:bg-blue-700">버튼</button>
</div>

// ❌ 다크모드 미적용 (금지)
<div className="bg-white text-gray-900">
  <p className="text-gray-600">텍스트</p>
</div>
```

### 5.2. 권장 색상 조합

| 요소 | 라이트모드 | 다크모드 |
|------|-----------|----------|
| 카드 배경 | `bg-white` | `dark:bg-gray-800` |
| 제목 | `text-gray-900` | `dark:text-gray-100` |
| 본문 | `text-gray-600` | `dark:text-gray-300` |
| 보조 정보 | `text-gray-500` | `dark:text-gray-400` |
| 배지 | `bg-blue-100 text-blue-800` | `dark:bg-blue-900 dark:text-blue-100` |
| 버튼 (primary) | `bg-blue-600` | `dark:bg-blue-700` |
| 버튼 (secondary) | `bg-gray-200` | `dark:bg-gray-700` |

---

## 6. 테스트

### 6.1. 단위 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test useFixedJobPostings.test.ts
npm test FixedJobCard.test.tsx
npm test validation.test.ts
```

### 6.2. 타입 체크

```bash
npm run type-check
```

**중요**: 타입 에러가 0개여야 합니다.

### 6.3. Lint 검사

```bash
npm run lint
```

### 6.4. 빌드 테스트

```bash
npm run build
```

---

## 7. 디버깅

### 7.1. logger 사용

```typescript
import logger from '@/utils/logger';

// ✅ logger 사용
logger.info('고정공고 조회 시작', { userId });
logger.warn('requiredRoles 불일치', { postingId, requiredRoles });
logger.error('Firestore 에러', { error });

// ❌ console.log 사용 금지
console.log('Debug'); // ❌
```

### 7.2. React DevTools Profiler

성능 측정을 위해 React DevTools의 Profiler를 사용하세요:

1. 브라우저에서 React DevTools 열기
2. "Profiler" 탭 선택
3. 녹화 시작 → 스크롤 → 녹화 중지
4. 리렌더링 횟수 및 시간 확인

**목표**:
- 20개 카드 렌더링: <100ms
- 스크롤 시 버벅임 없음

### 7.3. Firestore 쿼리 디버깅

Firebase Console에서 Firestore 쿼리 성능 확인:

1. Firebase Console → Firestore Database
2. "Usage" 탭 → "Query" 섹션
3. 쿼리 실행 시간 및 읽기 수 확인

**목표**:
- 초기 로딩 쿼리: <500ms
- 추가 페이지 쿼리: <200ms

---

## 8. 배포 전 체크리스트

### 8.1. 코드 품질

- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 모든 테스트 통과 (`npm test`)

### 8.2. 기능 검증

- [ ] 초기 20개 공고 로딩 확인
- [ ] 무한 스크롤로 추가 페이지 로드 확인
- [ ] 다크모드 전환 시 UI 정상 표시 확인
- [ ] 지원하기 버튼 동작 확인
- [ ] 상세보기 클릭 시 조회수 증가 확인
- [ ] 에러 처리 (Firestore 연결 실패 시나리오)

### 8.3. 성능 검증

- [ ] 초기 로딩: <500ms
- [ ] 페이지 전환: <200ms
- [ ] 무한 스크롤 로딩: <1초
- [ ] 20개 카드 렌더링: <100ms

### 8.4. Firestore 인덱스 확인

Firebase Console에서 복합 인덱스 생성 확인:

```
컬렉션: jobPostings
필드:
  - postingType (오름차순)
  - status (오름차순)
  - createdAt (내림차순)
```

**생성 방법**:
1. 쿼리 실행 시 자동 생성 링크 클릭
2. 또는 Firebase Console → Firestore Database → 인덱스 → 복합 인덱스 추가

---

## 9. 트러블슈팅

### 9.1. "Hook not found" 에러

**원인**: useFixedJobPostings Hook이 구현되지 않음

**해결**:
```bash
# Hook 파일 존재 여부 확인
ls app2/src/hooks/useFixedJobPostings.ts
```

### 9.2. "타입 에러: FixedJobPosting is not assignable"

**원인**: posting 데이터가 FixedJobPosting 타입이 아님

**해결**:
```typescript
import { isFixedJobPosting } from '@/types/jobPosting/jobPosting';

// 타입 가드 사용
if (isFixedJobPosting(posting)) {
  // ✅ posting은 FixedJobPosting 타입
  renderCard(posting);
}
```

### 9.3. "다크모드 적용 안 됨"

**원인**: `dark:` 클래스 누락

**해결**:
- 모든 배경/텍스트 요소에 `dark:` 클래스 추가
- [research.md#R5](./research.md#R5) 참조

### 9.4. "무한 스크롤이 작동하지 않음"

**원인**: IntersectionObserver cleanup 미호출

**해결**:
```typescript
useEffect(() => {
  const observer = new IntersectionObserver(/* ... */);
  // ...

  return () => {
    observer.disconnect(); // ✅ cleanup 필수
  };
}, [loading, hasMore, loadMore]);
```

### 9.5. "Firestore 쿼리가 느림"

**원인**: 복합 인덱스 미생성

**해결**:
- Firebase Console에서 인덱스 생성
- 또는 쿼리 실행 시 자동 생성 링크 클릭

---

## 10. 참조

- **Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Contracts**: [contracts/](./contracts/)
- **프로젝트 가이드**: [../../CLAUDE.md](../../CLAUDE.md)
- **TypeScript 타입**: [../../app2/src/types/jobPosting/jobPosting.ts](../../app2/src/types/jobPosting/jobPosting.ts)

---

**Status**: ✅ Phase 1 Design 완료 - `/speckit.tasks`로 진행 가능
