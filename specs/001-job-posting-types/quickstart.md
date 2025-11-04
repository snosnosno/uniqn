# Quickstart: 구인공고 타입 확장 시스템

**Feature**: 001-job-posting-types | **Date**: 2025-10-30
**Purpose**: Get developers up and running quickly with essential examples

## Prerequisites

```bash
cd app2

# 의존성 설치
npm install

# 타입 체크
npm run type-check

# 테스트 실행
npm run test

# 개발 서버 시작
npm start
```

---

## Quick Examples

### 1. 공고 작성 (4가지 타입)

#### A. 지원 공고 (무료)
```typescript
import { useJobPostingOperations } from '@/hooks/useJobPostingOperations';

const { createPosting } = useJobPostingOperations();

await createPosting({
  title: '홀덤 딜러 모집',
  description: '저녁 시간대 딜러를 찾습니다',
  location: '강남구',
  postingType: 'regular',  // 지원 공고
  dateSpecificRequirements: [
    {
      date: '2025-11-01',
      startTime: '18:00',
      endTime: '23:00',
      requiredCount: 3,
      role: 'dealer'
    }
  ],
  status: 'open'
});
```

#### B. 고정 공고 (유료, 7/30/90일)
```typescript
await createPosting({
  title: '장기 홀덤 딜러 모집',
  description: '경험 많은 딜러를 찾습니다',
  location: '서초구',
  postingType: 'fixed',  // 고정 공고
  fixedConfig: {
    durationDays: 30,    // 30일 노출
    chipCost: 5          // 5칩 비용
  },
  dateSpecificRequirements: [...],
  status: 'open'
});
```

#### C. 대회 공고 (무료, admin 승인 필요)
```typescript
await createPosting({
  title: '대규모 토너먼트 스태프 모집',
  description: '100명 규모 토너먼트',
  location: '서울 전역',
  postingType: 'tournament',  // 대회 공고
  tournamentConfig: {
    approvalStatus: 'pending',    // 승인 대기
    submittedAt: Timestamp.now()
  },
  dateSpecificRequirements: [...],
  status: 'open'
});
```

#### D. 긴급 공고 (유료, 5칩 고정)
```typescript
await createPosting({
  title: '긴급! 오늘 저녁 딜러 모집',
  description: '갑작스런 결원으로 긴급 모집',
  location: '강남구',
  postingType: 'urgent',  // 긴급 공고
  urgentConfig: {
    chipCost: 5,                  // 5칩 고정
    priority: 'high',
    createdAt: Timestamp.now()
  },
  dateSpecificRequirements: [...],
  status: 'open'
});
```

---

### 2. 타입별 공고 조회

```typescript
import { useJobPostings } from '@/hooks/useJobPostings';

function JobBoardPage() {
  const [activeTab, setActiveTab] = useState<PostingType>('regular');

  // 타입별 쿼리
  const { postings, loading } = useJobPostings({
    postingType: activeTab,  // 'regular' | 'fixed' | 'tournament' | 'urgent'
    status: 'open'
  });

  return (
    <div>
      {/* 5개 탭 */}
      <Tabs>
        <Tab onClick={() => setActiveTab('regular')}>지원 📋</Tab>
        <Tab onClick={() => setActiveTab('fixed')}>고정 📌</Tab>
        <Tab onClick={() => setActiveTab('tournament')}>대회 🏆</Tab>
        <Tab onClick={() => setActiveTab('urgent')}>긴급 🚨</Tab>
        <Tab onClick={() => setActiveTab(null)}>내지원</Tab>
      </Tabs>

      {/* 공고 리스트 */}
      {loading ? <Skeleton /> : (
        <ul>
          {postings.map(posting => (
            <JobPostingCard key={posting.id} posting={posting} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### 3. 날짜 슬라이더 필터링

```typescript
import { useMemo, useState } from 'react';
import { addDays, subDays, isSameDay, parseISO } from 'date-fns';

function DateSlider({ postings }: { postings: JobPosting[] }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div>
      {/* 날짜 슬라이더 */}
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setSelectedDate(null)}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded"
        >
          전체
        </button>

        {dates.map(date => (
          <button
            key={date.toISOString()}
            onClick={() => setSelectedDate(date)}
            className={`px-4 py-2 rounded ${
              isToday(date)
                ? 'bg-blue-500 dark:bg-blue-600 text-white'  // 오늘 강조
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <div className="text-xs">
              {isToday(date) ? '오늘' : format(date, 'MM.dd')}
            </div>
          </button>
        ))}
      </div>

      {/* 필터링된 공고 리스트 */}
      <ul>
        {filteredPostings.map(p => (
          <JobPostingCard key={p.id} posting={p} />
        ))}
      </ul>
    </div>
  );
}
```

---

### 4. 타입별 시각적 차별화

```typescript
import { JobPosting, PostingType } from '@/types/jobPosting';

// 타입별 스타일 맵
const POSTING_STYLES: Record<PostingType, {
  border: string;
  icon: string;
  bg: string;
}> = {
  regular: {
    border: 'border border-gray-300 dark:border-gray-600',
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

function JobPostingCard({ posting }: { posting: JobPosting }) {
  const postingType = normalizePostingType(posting);
  const style = POSTING_STYLES[postingType];

  return (
    <div className={`p-4 rounded-lg ${style.border} ${style.bg}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{style.icon}</span>
        <h3 className="text-lg font-semibold">{posting.title}</h3>

        {/* 긴급 공고 깜빡이는 배지 */}
        {postingType === 'urgent' && (
          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded animate-pulse">
            긴급
          </span>
        )}
      </div>

      {/* 칩 비용 표시 */}
      {posting.chipCost && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          💎 {posting.chipCost}칩
        </div>
      )}

      {/* 공고 내용 */}
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        {posting.description}
      </p>
    </div>
  );
}
```

---

### 5. 승인 시스템 (Admin)

```typescript
import { useJobPostingApproval } from '@/hooks/useJobPostingApproval';
import { useAuth } from '@/contexts/AuthContext';

function ApprovalManagementPage() {
  const { role } = useAuth();
  const { pendingPostings, approve, reject, loading } = useJobPostingApproval();
  const [rejectReason, setRejectReason] = useState('');

  // admin 권한 체크
  if (role !== 'admin') {
    return <div>Admin 권한이 필요합니다</div>;
  }

  return (
    <div>
      <h1>승인 대기 중인 대회 공고</h1>

      {loading ? <Skeleton /> : (
        <ul>
          {pendingPostings.map(posting => (
            <div key={posting.id} className="border p-4 rounded">
              <h3>{posting.title}</h3>
              <p>{posting.description}</p>

              <div className="flex gap-2 mt-4">
                {/* 승인 버튼 */}
                <button
                  onClick={() => approve(posting.id)}
                  className="px-4 py-2 bg-green-500 text-white rounded"
                >
                  승인
                </button>

                {/* 거부 버튼 */}
                <button
                  onClick={() => {
                    const reason = prompt('거부 사유를 입력하세요 (최소 10자):');
                    if (reason && reason.length >= 10) {
                      reject(posting.id, reason);
                    } else {
                      toast.error('거부 사유는 최소 10자 이상이어야 합니다');
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded"
                >
                  거부
                </button>
              </div>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### 6. 레거시 데이터 호환성

```typescript
import { normalizePostingType } from '@/utils/jobPosting/jobPostingHelpers';

function displayPosting(posting: JobPosting) {
  // 자동으로 레거시 데이터 변환
  const postingType = normalizePostingType(posting);

  // postingType 사용
  switch (postingType) {
    case 'regular':
      return <RegularPostingCard posting={posting} />;
    case 'fixed':
      return <FixedPostingCard posting={posting} />;
    case 'tournament':
      return <TournamentPostingCard posting={posting} />;
    case 'urgent':
      return <UrgentPostingCard posting={posting} />;
  }
}

// normalizePostingType 함수 (자동 변환)
export const normalizePostingType = (
  posting: Partial<JobPosting>
): PostingType => {
  // 1. 새 필드 우선
  if (posting.postingType) {
    return posting.postingType;
  }

  // 2. 레거시 필드 변환
  const legacyType = posting.type || posting.recruitmentType;

  if (legacyType === 'application') return 'regular';
  if (legacyType === 'fixed') return 'fixed';

  // 3. 기본값
  logger.warn('postingType 필드 없음, regular로 기본 설정');
  return 'regular';
};
```

---

## Common Patterns

### 1. 타입별 쿼리
```typescript
// ✅ 올바른 방법 (타입별 쿼리)
const q = query(
  collection(db, 'jobPostings'),
  where('postingType', '==', 'regular'),
  where('status', '==', 'open')
);

// ❌ 잘못된 방법 (전체 조회)
const q = query(
  collection(db, 'jobPostings'),
  where('status', '==', 'open')
);
```

### 2. 칩 비용 계산
```typescript
import { calculateChipCost } from '@/utils/jobPosting/chipCalculator';

// 고정 공고 칩 비용
const chipCost = calculateChipCost('fixed', 30);  // 5칩

// 긴급 공고 칩 비용
const chipCost = calculateChipCost('urgent');     // 5칩
```

### 3. 날짜 필터링 (클라이언트 측)
```typescript
// ✅ 올바른 방법 (클라이언트 필터링)
const filteredPostings = postings.filter(p =>
  p.dateSpecificRequirements.some(req =>
    isSameDay(parseISO(req.date), selectedDate)
  )
);

// ❌ 잘못된 방법 (Firestore 쿼리) - 복잡하고 비효율적
// 사용하지 마세요
```

### 4. 다크모드 지원
```typescript
// ✅ 올바른 방법 (dark: 클래스)
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-300">텍스트</p>
</div>

// ❌ 잘못된 방법 (dark: 없음)
<div className="bg-white text-gray-900">
  <p className="text-gray-600">텍스트</p>
</div>
```

---

## Firestore Indexes

배포 전에 다음 인덱스를 추가해야 합니다:

```bash
# Firebase Console → Firestore → Indexes

# Index 1: 타입별 공고 조회
Collection: jobPostings
Fields:
  - postingType (ASC)
  - status (ASC)
  - createdAt (DESC)

# Index 2: 내 공고 조회
Collection: jobPostings
Fields:
  - postingType (ASC)
  - createdBy (ASC)
  - createdAt (DESC)

# Index 3: 승인 대기 공고 조회 (admin)
Collection: jobPostings
Fields:
  - postingType (ASC)
  - tournamentConfig.approvalStatus (ASC)
  - createdAt (DESC)
```

---

## Testing

### Unit Tests
```bash
cd app2
npm run test -- normalizePostingType.test.ts
npm run test -- chipCalculator.test.ts
npm run test -- dateFilter.test.ts
```

### Integration Tests
```bash
npm run test -- jobPostingQueries.test.ts
npm run test -- approvalWorkflow.test.ts
npm run test -- legacyDataConversion.test.ts
```

### E2E Tests
```bash
npm run test:e2e -- jobPosting.spec.ts
npm run test:e2e -- boardTabs.spec.ts
npm run test:e2e -- dateSlider.spec.ts
npm run test:e2e -- approval.spec.ts
```

---

## Deployment

### 1. 타입 체크
```bash
npm run type-check  # 에러 0개 확인
```

### 2. 린트
```bash
npm run lint  # 에러 0개 확인
```

### 3. 빌드
```bash
npm run build  # 번들 크기 ≤ 350KB 확인
```

### 4. Firebase 배포
```bash
# Firestore Indexes 먼저 추가 (Firebase Console)

# Functions 배포
cd ../functions
npm run deploy

# Hosting 배포
cd ../app2
firebase deploy --only hosting

# Security Rules 배포
firebase deploy --only firestore:rules
```

---

## Troubleshooting

### Q: 레거시 공고가 표시되지 않아요
**A**: `normalizePostingType` 함수가 자동으로 변환합니다. 개발자 도구에서 경고 로그를 확인하세요.

### Q: Firestore 인덱스 에러가 발생해요
**A**: Firebase Console에서 인덱스 3개를 추가하세요. 에러 메시지의 링크를 클릭하면 자동으로 생성됩니다.

### Q: 승인 버튼이 안 보여요
**A**: admin 권한이 필요합니다. `role === 'admin'`을 확인하세요.

### Q: 날짜 슬라이더가 느려요
**A**: `useMemo`로 날짜 범위와 필터링을 메모이제이션하세요.

### Q: 다크모드가 안 돼요
**A**: 모든 UI 요소에 `dark:` 클래스를 추가하세요.

---

## Next Steps

1. `/speckit.tasks` 명령으로 implementation tasks 생성
2. Phase 1 tasks 부터 시작 (P1 우선순위)
3. TDD Red-Green-Refactor 적용
4. 품질 게이트 5개 모두 통과 확인
5. PR 생성 및 코드 리뷰

**Happy Coding! 🚀**
