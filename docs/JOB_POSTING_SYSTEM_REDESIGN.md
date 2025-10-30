# 공고 시스템 개편 계획서

**프로젝트**: UNIQN (T-HOLDEM)
**문서 버전**: 1.0
**작성일**: 2025-10-30
**상태**: 계획 단계

---

## 📋 목차

1. [개요](#개요)
2. [요구사항 정리](#요구사항-정리)
3. [현재 시스템 분석](#현재-시스템-분석)
4. [설계 명세](#설계-명세)
5. [구현 계획](#구현-계획)
6. [보안 및 확장성](#보안-및-확장성)
7. [마이그레이션 전략](#마이그레이션-전략)

---

## 개요

### 목적
기존 구인공고 시스템을 4가지 타입(지원/고정/대회/긴급)으로 확장하여 사용자 니즈에 맞는 차별화된 공고 서비스 제공

### 배경
- 현재: 지원/고정 2가지 타입만 존재
- 개선: 대회 공고(승인 필요), 긴급 공고(유료, 시각적 강조) 추가
- 향후: 칩 기반 유료 기능 확장 준비

### 핵심 목표
- ✅ 4가지 공고 타입 구분 및 타입별 특화 기능
- ✅ 날짜 기반 필터링 (지원 공고 전용)
- ✅ 대회 공고 승인 시스템 (admin 전용)
- ✅ 긴급 공고 시각적 강조 (빨간색 테마)
- ✅ 칩 시스템 확장 준비 (유료 기능 인프라)

---

## 요구사항 정리

### 1. 공고 타입 시스템

| 타입 | 명칭 | 멀티데이 | 날짜 추가 | 비용 | 승인 | 특징 |
|------|------|----------|-----------|------|------|------|
| **regular** | 지원 | ❌ | ✅ | 무료 | 불필요 | 기본 공고 타입 |
| **fixed** | 고정 | ✅ | ✅ | 칩 1/3/5개 | 불필요 | 고정탭에 7/30/90일 노출 |
| **tournament** | 대회 | ✅ | ✅ | 무료 | admin 승인 (24h) | 대규모 토너먼트 전용 |
| **urgent** | 긴급 | ❌ | ❌ | 칩 차감 | 불필요 | 빨간색 강조, 확정 시 유료 |

#### 세부 요구사항

**지원 공고 (regular)**
- 기존 공고 작성 기능과 동일
- 단일 날짜만 가능 (멀티데이 불가)
- 날짜 추가는 가능 (여러 개의 단일 날짜)
- 날짜 필터링 슬라이더 제공

**고정 공고 (fixed)**
- 새로운 공고 작성 폼 필요
- 노출 기간 선택: 7일/30일/90일
- 칩 비용: 1개/3개/5개 (추후 결제 연동)
- 고정 탭에 일반 카드 형태로 표시
- 모든 기능 사용 가능 (멀티데이, 날짜 추가)

**대회 공고 (tournament)**
- 기존 공고 작성 기능과 동일
- admin 승인 필요 (24시간 이내)
- 승인 기준: 대회 규모, 신원 확인
- 거부 시 수정 후 재신청 가능
- 모든 기능 사용 가능

**긴급 공고 (urgent)**
- 기존 공고 작성 기능과 동일
- 단일 날짜만 가능 (멀티데이 불가)
- 날짜 추가 불가
- 빨간색 카드 강조
- 확정 시 칩 차감 (추후 구현)

### 2. 게시판 개편

**현재 구조**
```
[구인 목록] [내 지원 현황]
```

**변경 후 구조**
```
[지원] [고정] [대회] [긴급] [내 지원 현황]
```

**탭별 기능**
- **지원 탭**: 날짜 선택 슬라이더 추가 (오늘/내일/이번주/날짜 선택)
- **고정 탭**: 고정 공고만 필터링
- **대회 탭**: 승인된 대회 공고만 표시
- **긴급 탭**: 긴급 공고만 필터링, 빨간색 카드
- **내 지원 현황**: 기존과 동일

### 3. 유료 기능 (추후 구현)

**칩 시스템**
- 이용권 형태로 사용
- 고정 공고: 7일(1칩)/30일(3칩)/90일(5칩)
- 긴급 공고: 확정 시 칩 차감
- PG사 연동은 추후 결정 (Toss/KakaoPay 등)

**현재 구현 범위**
- 칩 필드만 데이터 구조에 포함
- 실제 차감 로직은 나중에 추가 가능하도록 구조 설계
- Functions에서 확장 가능하도록 준비

---

## 현재 시스템 분석

### 재활용 가능한 컴포넌트

| 컴포넌트 | 경로 | 재활용 가능 여부 | 활용 방안 |
|----------|------|------------------|-----------|
| JobPostingForm | `components/jobPosting/JobPostingForm.tsx` | ⚠️ 부분 재활용 | 타입 선택 모달 추가, 조건부 폼 분기 |
| JobPostingCard | `components/common/JobPostingCard.tsx` | ✅ 95% 재활용 | 긴급 스타일링만 추가 |
| JobBoardPage | `pages/JobBoard/index.tsx` | ⚠️ 대폭 수정 | 4개 탭 구조로 재설계 |
| useJobBoard | `pages/JobBoard/hooks/useJobBoard.ts` | ⚠️ 부분 재활용 | 타입별 필터링 로직 추가 |

### 데이터 구조 현황

**현재 JobPosting 타입**
```typescript
interface JobPosting {
  id: string;
  title: string;
  type?: 'application' | 'fixed';  // ❌ 중복 필드
  recruitmentType?: 'application' | 'fixed';  // ❌ 중복 필드
  description: string;
  location: string;
  dateSpecificRequirements: DateSpecificRequirement[];
  // ...
}
```

**문제점**
- `type`과 `recruitmentType` 필드 중복
- 2가지 타입만 지원 (지원/고정)
- 타입별 전용 설정 필드 없음

---

## 설계 명세

### 1. 데이터 타입 설계

#### JobPosting 타입 확장

**파일**: `app2/src/types/jobPosting/jobPosting.ts`

```typescript
/**
 * 공고 타입 (4가지)
 */
export type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';

/**
 * 고정 공고 전용 설정
 */
export interface FixedPostingConfig {
  displayDuration: 7 | 30 | 90;  // 노출 기간 (일)
  startDate: string;              // 노출 시작일 (YYYY-MM-DD)
  endDate: string;                // 노출 종료일 (YYYY-MM-DD)
  chipCost: 1 | 3 | 5;           // 칩 비용 (추후 확장)
}

/**
 * 대회 공고 전용 설정
 */
export interface TournamentPostingConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected';  // 승인 상태
  approver?: string;              // 승인자 ID (admin)
  approvedAt?: Timestamp;         // 승인 시각
  rejectionReason?: string;       // 거부 사유
  submittedAt: Timestamp;         // 제출 시각
}

/**
 * 긴급 공고 전용 설정
 */
export interface UrgentPostingConfig {
  postedAt: Timestamp;            // 등록 시각
  chipCost: number;               // 칩 비용 (추후 확장)
  isChipDeducted: boolean;        // 칩 차감 여부
}

/**
 * 공고 메인 인터페이스 (확장)
 */
export interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  district?: string;
  detailedAddress?: string;
  contactPhone?: string;

  // ✅ 새로운 타입 시스템 (단일 필드)
  postingType: PostingType;

  // ✅ 타입별 전용 설정 (optional)
  fixedConfig?: FixedPostingConfig;
  tournamentConfig?: TournamentPostingConfig;
  urgentConfig?: UrgentPostingConfig;

  // 기존 필드들
  dateSpecificRequirements: DateSpecificRequirement[];
  status: 'open' | 'closed';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;

  // 급여, 복리후생, 사전질문 등 기존 필드 유지
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;
  benefits?: Benefits;
  preQuestions?: PreQuestion[];
  useRoleSalary?: boolean;
  roleSalaries?: { [role: string]: RoleSalary };
}
```

#### JobPostingFilters 확장

```typescript
export interface JobPostingFilters {
  status?: 'open' | 'closed' | 'all';
  location?: string;
  district?: string;

  // ✅ 새로운 필터
  postingType?: PostingType | 'all';  // 타입 필터
  selectedDate?: string | null;       // 날짜 필터 (지원 공고 전용)

  // 기존 필터
  role?: string;
  keyword?: string;
  myApplicationsOnly?: boolean;
  userId?: string;
}
```

### 2. UI 컴포넌트 설계

#### 2.1 타입 선택 모달

**새로운 파일**: `app2/src/components/jobPosting/modals/PostingTypeSelectionModal.tsx`

```typescript
interface PostingTypeOption {
  value: PostingType;
  label: string;
  icon: string;
  description: string;
  cost: string;
  badge?: string;
}

const POSTING_TYPE_OPTIONS: PostingTypeOption[] = [
  {
    value: 'regular',
    label: '지원',
    icon: '📋',
    description: '일반적인 구인공고입니다. 단일 날짜로 여러 번 등록 가능합니다.',
    cost: '무료',
  },
  {
    value: 'fixed',
    label: '고정',
    icon: '📌',
    description: '고정 탭에 지속적으로 노출됩니다. 기간별 비용이 발생합니다.',
    cost: '칩 1~5개',
    badge: '유료',
  },
  {
    value: 'tournament',
    label: '대회',
    icon: '🏆',
    description: '대규모 토너먼트 공고입니다. 관리자 승인이 필요합니다.',
    cost: '무료',
    badge: '승인 필요',
  },
  {
    value: 'urgent',
    label: '긴급',
    icon: '🚨',
    description: '급하게 인원이 필요할 때 사용합니다. 확정 시 비용이 발생합니다.',
    cost: '칩 차감',
    badge: '유료',
  },
];

interface PostingTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: PostingType) => void;
}

const PostingTypeSelectionModal: React.FC<PostingTypeSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="공고 타입 선택">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {POSTING_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className="relative p-6 border-2 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all text-left group"
          >
            {/* 배지 */}
            {option.badge && (
              <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
                {option.badge}
              </span>
            )}

            {/* 아이콘 및 제목 */}
            <div className="flex items-center mb-3">
              <span className="text-3xl mr-3">{option.icon}</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {option.label}
              </h3>
            </div>

            {/* 설명 */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {option.description}
            </p>

            {/* 비용 */}
            <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
              <span className="mr-1">💰</span>
              {option.cost}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};
```

#### 2.2 고정 공고 입력 필드

**새로운 파일**: `app2/src/components/jobPosting/FixedPostingFields.tsx`

```typescript
interface FixedPostingFieldsProps {
  displayDuration?: 7 | 30 | 90;
  onDurationChange: (duration: 7 | 30 | 90) => void;
}

const FixedPostingFields: React.FC<FixedPostingFieldsProps> = ({
  displayDuration = 7,
  onDurationChange,
}) => {
  const durationOptions = [
    { value: 7, label: '7일', chipCost: 1, description: '1주일 노출' },
    { value: 30, label: '30일', chipCost: 3, description: '1개월 노출 (추천)' },
    { value: 90, label: '90일', chipCost: 5, description: '3개월 노출' },
  ];

  return (
    <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
        <span className="mr-2">📌</span>
        고정 공고 설정
      </h4>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          노출 기간 선택 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {durationOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onDurationChange(option.value as 7 | 30 | 90)}
              className={`p-4 rounded-lg border-2 transition-all ${
                displayDuration === option.value
                  ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }`}
            >
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {option.description}
              </div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mt-2">
                칩 {option.chipCost}개
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
        ℹ️ 고정 공고는 선택한 기간 동안 고정 탭에 상시 노출됩니다.
      </div>
    </div>
  );
};
```

#### 2.3 날짜 슬라이더

**새로운 파일**: `app2/src/components/jobPosting/DateSlider.tsx`

```typescript
interface DateSliderProps {
  visible: boolean;
  selectedDate: string | null;
  onChange: (date: string | null) => void;
}

const DateSlider: React.FC<DateSliderProps> = ({
  visible,
  selectedDate,
  onChange,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  if (!visible) return null;

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const thisWeekend = getThisWeekendDate();

  const quickOptions = [
    { label: '전체', value: null },
    { label: '오늘', value: today },
    { label: '내일', value: tomorrow },
    { label: '이번 주말', value: thisWeekend },
  ];

  return (
    <div className="flex gap-2 py-3 overflow-x-auto">
      {quickOptions.map((option) => (
        <button
          key={option.label}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
            selectedDate === option.value
              ? 'bg-blue-600 dark:bg-blue-700 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {option.label}
        </button>
      ))}

      <button
        onClick={() => setIsCalendarOpen(true)}
        className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
      >
        📅 날짜 선택
      </button>

      {/* 캘린더 모달 */}
      {isCalendarOpen && (
        <DatePickerModal
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          selectedDate={selectedDate}
          onSelect={(date) => {
            onChange(date);
            setIsCalendarOpen(false);
          }}
        />
      )}
    </div>
  );
};
```

#### 2.4 긴급 공고 카드 스타일

**수정 파일**: `app2/src/components/common/JobPostingCard.tsx`

```typescript
// 카드 테마 함수 추가
const getCardTheme = (postingType: PostingType) => {
  switch (postingType) {
    case 'urgent':
      return 'border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20';
    case 'tournament':
      return 'border-l-4 border-l-purple-500 dark:border-l-purple-600';
    case 'fixed':
      return 'border-l-4 border-l-blue-500 dark:border-l-blue-600';
    default:
      return '';
  }
};

// 컴포넌트에서 적용
return (
  <div className={`${getContainerClasses()} ${getCardTheme(post.postingType)} ${className}`}>
    {/* 긴급 배지 */}
    {post.postingType === 'urgent' && (
      <span className="absolute top-2 right-2 bg-red-600 dark:bg-red-700 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
        🚨 긴급
      </span>
    )}

    {/* 기존 콘텐츠 */}
    {/* ... */}
  </div>
);
```

#### 2.5 게시판 탭 구조

**수정 파일**: `app2/src/pages/JobBoard/index.tsx`

```typescript
const JobBoardPage = () => {
  const [activeTab, setActiveTab] = useState<'regular' | 'fixed' | 'tournament' | 'urgent' | 'myApplications'>('regular');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const {
    regularPostings,
    fixedPostings,
    tournamentPostings,
    urgentPostings,
    myApplications,
    loading,
  } = useJobBoard({ activeTab, selectedDate });

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-4">{t('jobBoard.title')}</h1>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <TabButton
          active={activeTab === 'regular'}
          onClick={() => setActiveTab('regular')}
          icon="📋"
          label="지원"
        />
        <TabButton
          active={activeTab === 'fixed'}
          onClick={() => setActiveTab('fixed')}
          icon="📌"
          label="고정"
        />
        <TabButton
          active={activeTab === 'tournament'}
          onClick={() => setActiveTab('tournament')}
          icon="🏆"
          label="대회"
        />
        <TabButton
          active={activeTab === 'urgent'}
          onClick={() => setActiveTab('urgent')}
          icon="🚨"
          label="긴급"
          badge={urgentPostings.length}
          variant="urgent"
        />
        <TabButton
          active={activeTab === 'myApplications'}
          onClick={() => setActiveTab('myApplications')}
          icon="📝"
          label="내 지원"
        />
      </div>

      {/* 날짜 슬라이더 (지원 탭만) */}
      <DateSlider
        visible={activeTab === 'regular'}
        selectedDate={selectedDate}
        onChange={setSelectedDate}
      />

      {/* 탭별 콘텐츠 */}
      {activeTab === 'regular' && (
        <JobListTab jobPostings={regularPostings} />
      )}
      {activeTab === 'fixed' && (
        <JobListTab jobPostings={fixedPostings} />
      )}
      {activeTab === 'tournament' && (
        <JobListTab jobPostings={tournamentPostings} />
      )}
      {activeTab === 'urgent' && (
        <JobListTab jobPostings={urgentPostings} variant="urgent" />
      )}
      {activeTab === 'myApplications' && (
        <MyApplicationsTab applications={myApplications} />
      )}
    </div>
  );
};
```

### 3. 비즈니스 로직 설계

#### 3.1 useJobBoard Hook 확장

**수정 파일**: `app2/src/pages/JobBoard/hooks/useJobBoard.ts`

```typescript
interface UseJobBoardParams {
  activeTab: 'regular' | 'fixed' | 'tournament' | 'urgent' | 'myApplications';
  selectedDate: string | null;
}

export const useJobBoard = ({ activeTab, selectedDate }: UseJobBoardParams) => {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  // Firestore 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'jobPostings'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JobPosting[];
      setJobPostings(postings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 타입별 필터링
  const { regularPostings, fixedPostings, tournamentPostings, urgentPostings } = useMemo(() => {
    const regular: JobPosting[] = [];
    const fixed: JobPosting[] = [];
    const tournament: JobPosting[] = [];
    const urgent: JobPosting[] = [];

    jobPostings.forEach(post => {
      // 날짜 필터 (지원 공고만)
      if (activeTab === 'regular' && selectedDate) {
        const hasMatchingDate = post.dateSpecificRequirements?.some(req =>
          formatDate(req.date) === selectedDate
        );
        if (!hasMatchingDate) return;
      }

      // 타입별 분류
      switch (post.postingType) {
        case 'regular':
          regular.push(post);
          break;
        case 'fixed':
          // 노출 기간 체크
          if (isWithinDisplayPeriod(post)) {
            fixed.push(post);
          }
          break;
        case 'tournament':
          // 승인된 공고만
          if (post.tournamentConfig?.approvalStatus === 'approved') {
            tournament.push(post);
          }
          break;
        case 'urgent':
          urgent.push(post);
          break;
      }
    });

    // 긴급 공고: 최신순 정렬
    urgent.sort((a, b) =>
      b.urgentConfig!.postedAt.seconds - a.urgentConfig!.postedAt.seconds
    );

    return { regularPostings: regular, fixedPostings: fixed, tournamentPostings: tournament, urgentPostings: urgent };
  }, [jobPostings, activeTab, selectedDate]);

  return {
    regularPostings,
    fixedPostings,
    tournamentPostings,
    urgentPostings,
    loading,
  };
};

// 고정 공고 노출 기간 체크
function isWithinDisplayPeriod(post: JobPosting): boolean {
  if (!post.fixedConfig) return false;

  const now = new Date();
  const endDate = new Date(post.fixedConfig.endDate);

  return now <= endDate;
}
```

### 4. 승인 시스템 설계

#### 4.1 대회 공고 승인 페이지

**새로운 파일**: `app2/src/pages/TournamentApprovalPage.tsx`

```typescript
const TournamentApprovalPage = () => {
  const { user } = useAuth();
  const [pendingPostings, setPendingPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  // admin 권한 체크
  if (!user || user.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  // 승인 대기 중인 공고 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'tournament'),
      where('tournamentConfig.approvalStatus', '==', 'pending'),
      orderBy('tournamentConfig.submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JobPosting[];
      setPendingPostings(postings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 승인 처리
  const handleApprove = async (postingId: string) => {
    try {
      await updateDoc(doc(db, 'jobPostings', postingId), {
        'tournamentConfig.approvalStatus': 'approved',
        'tournamentConfig.approver': user.uid,
        'tournamentConfig.approvedAt': serverTimestamp()
      });

      toast.success('대회 공고가 승인되었습니다.');

      // TODO: 알림 전송
      // await sendTournamentApprovalNotification(postingId);
    } catch (error) {
      logger.error('승인 처리 오류', error);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  // 거부 처리
  const handleReject = async (postingId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'jobPostings', postingId), {
        'tournamentConfig.approvalStatus': 'rejected',
        'tournamentConfig.approver': user.uid,
        'tournamentConfig.rejectionReason': reason
      });

      toast.error('대회 공고가 거부되었습니다.');

      // TODO: 알림 전송
      // await sendTournamentRejectionNotification(postingId, reason);
    } catch (error) {
      logger.error('거부 처리 오류', error);
      toast.error('거부 처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <JobPostingSkeleton count={3} />;
  }

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-4">대회 공고 승인 관리</h1>

      {pendingPostings.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-600 dark:text-gray-300">
            승인 대기 중인 대회 공고가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPostings.map(post => (
            <TournamentApprovalCard
              key={post.id}
              posting={post}
              onApprove={() => handleApprove(post.id)}
              onReject={(reason) => handleReject(post.id, reason)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 4.2 승인 카드 컴포넌트

**새로운 파일**: `app2/src/components/jobPosting/TournamentApprovalCard.tsx`

```typescript
interface TournamentApprovalCardProps {
  posting: JobPosting;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

const TournamentApprovalCard: React.FC<TournamentApprovalCardProps> = ({
  posting,
  onApprove,
  onReject,
}) => {
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const submittedAt = posting.tournamentConfig?.submittedAt;
  const timeElapsed = submittedAt
    ? Math.floor((Date.now() - submittedAt.toMillis()) / 3600000)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-l-4 border-l-purple-500">
      {/* 대기 시간 표시 */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {posting.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            제출: {formatDateDisplay(submittedAt)}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          timeElapsed > 24
            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
        }`}>
          {timeElapsed}시간 경과
        </div>
      </div>

      {/* 공고 정보 */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        <p>📍 {posting.location}</p>
        <p>📅 {getDateRangeDisplay(posting.dateSpecificRequirements)}</p>
        <p className="mt-2 line-clamp-2">{posting.description}</p>
      </div>

      {/* 승인 기준 체크리스트 */}
      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          승인 기준 체크
        </h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>✓ 대회 규모 확인 필요</li>
          <li>✓ 구인자 신원 확인 필요</li>
          <li>✓ 공고 내용 적절성 검토 필요</li>
        </ul>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={onApprove}
          className="flex-1"
        >
          ✅ 승인
        </Button>
        <Button
          variant="secondary"
          onClick={() => setIsRejectModalOpen(true)}
          className="flex-1"
        >
          ❌ 거부
        </Button>
        <Button
          variant="ghost"
          onClick={() => {/* 상세 보기 모달 */}}
        >
          상세
        </Button>
      </div>

      {/* 거부 사유 입력 모달 */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="대회 공고 거부"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              거부 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="거부 사유를 입력하세요. 작성자에게 전달됩니다."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsRejectModalOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (rejectionReason.trim()) {
                  onReject(rejectionReason);
                  setIsRejectModalOpen(false);
                  setRejectionReason('');
                } else {
                  toast.error('거부 사유를 입력해주세요.');
                }
              }}
              className="flex-1"
            >
              거부 확정
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

---

## 보안 및 확장성

### 1. Firestore Security Rules

**파일**: `firestore.rules`

```javascript
// 공고 생성 규칙 강화
match /jobPostings/{postId} {
  // 읽기: 모든 인증된 사용자
  allow read: if isSignedIn();

  // 생성: postingType 필수, 타입별 config 검증
  allow create: if hasValidRole() &&
    request.resource.data.keys().hasAll([
      'title', 'description', 'location',
      'status', 'createdBy', 'postingType'
    ]) &&
    request.resource.data.postingType in [
      'regular', 'fixed', 'tournament', 'urgent'
    ] &&
    request.resource.data.createdBy == request.auth.uid &&

    // 타입별 검증
    (
      // 고정 공고: fixedConfig 필수
      (request.resource.data.postingType == 'fixed' &&
       'fixedConfig' in request.resource.data &&
       request.resource.data.fixedConfig.displayDuration in [7, 30, 90]) ||

      // 대회 공고: tournamentConfig 필수, 초기 상태는 pending
      (request.resource.data.postingType == 'tournament' &&
       'tournamentConfig' in request.resource.data &&
       request.resource.data.tournamentConfig.approvalStatus == 'pending') ||

      // 긴급 공고: urgentConfig 필수
      (request.resource.data.postingType == 'urgent' &&
       'urgentConfig' in request.resource.data) ||

      // 일반 공고: 추가 config 불필요
      request.resource.data.postingType == 'regular'
    );

  // 수정: 작성자 또는 admin
  // admin만 tournamentConfig.approvalStatus 변경 가능
  allow update: if (
    // 일반 수정
    (request.auth.token.role == 'admin') ||
    (hasValidRole() && request.auth.uid == resource.data.createdBy)
  ) || (
    // 승인 전용 (admin만)
    request.auth.token.role == 'admin' &&
    request.resource.data.postingType == 'tournament' &&
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['tournamentConfig'])
  );

  // 삭제: 작성자 또는 admin
  allow delete: if (request.auth.token.role == 'admin') ||
    (hasValidRole() && request.auth.uid == resource.data.createdBy);
}

// 필요한 복합 인덱스
// firebase index create --collection jobPostings
//   --field postingType --field createdAt
// firebase index create --collection jobPostings
//   --field postingType --field tournamentConfig.approvalStatus --field createdAt
```

### 2. 칩 시스템 확장 준비

**파일**: `functions/src/jobPostings/deductChips.ts` (추후 구현)

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

/**
 * 공고 생성 시 칩 차감 (추후 구현)
 */
export const deductChipsForPosting = functions.firestore
  .document('jobPostings/{postId}')
  .onCreate(async (snap, context) => {
    const posting = snap.data() as JobPosting;
    const postingId = context.params.postId;

    try {
      // 유료 공고인지 확인
      if (posting.postingType === 'urgent' || posting.postingType === 'fixed') {
        const chipCost = calculateChipCost(posting);

        // TODO: 칩 차감 로직 구현
        // 현재는 로그만 기록
        logger.info('칩 차감 필요', {
          postingId,
          userId: posting.createdBy,
          postingType: posting.postingType,
          chipCost
        });

        // 추후 구현:
        // const userChipsRef = admin.firestore()
        //   .collection('users').doc(posting.createdBy)
        //   .collection('chips').doc('balance');
        //
        // await admin.firestore().runTransaction(async (transaction) => {
        //   const chipsDoc = await transaction.get(userChipsRef);
        //   const currentBalance = chipsDoc.data()?.balance || 0;
        //
        //   if (currentBalance < chipCost) {
        //     throw new Error('칩이 부족합니다.');
        //   }
        //
        //   transaction.update(userChipsRef, {
        //     balance: currentBalance - chipCost,
        //     updatedAt: admin.firestore.FieldValue.serverTimestamp()
        //   });
        // });
      }
    } catch (error) {
      logger.error('칩 차감 오류', error);
      // 에러 발생 시 공고 삭제
      await snap.ref.delete();
      throw error;
    }
  });

/**
 * 칩 비용 계산
 */
function calculateChipCost(posting: JobPosting): number {
  if (posting.postingType === 'fixed' && posting.fixedConfig) {
    return posting.fixedConfig.chipCost;
  }
  if (posting.postingType === 'urgent' && posting.urgentConfig) {
    return posting.urgentConfig.chipCost;
  }
  return 0;
}
```

### 3. 알림 시스템 연동

**파일**: `functions/src/notifications/tournamentNotifications.ts`

```typescript
import * as admin from 'firebase-admin';
import { sendNotification } from './sendNotification';
import { logger } from '../utils/logger';

/**
 * 대회 공고 승인 알림
 */
export async function sendTournamentApprovalNotification(postingId: string) {
  try {
    const postingDoc = await admin.firestore()
      .collection('jobPostings')
      .doc(postingId)
      .get();

    if (!postingDoc.exists) {
      throw new Error('공고를 찾을 수 없습니다.');
    }

    const posting = postingDoc.data() as JobPosting;

    await sendNotification({
      userId: posting.createdBy,
      type: 'tournament_approved',
      title: '🏆 대회 공고 승인 완료',
      body: `"${posting.title}" 공고가 승인되어 게시되었습니다.`,
      data: { postingId }
    });

    logger.info('대회 공고 승인 알림 전송 완료', { postingId });
  } catch (error) {
    logger.error('대회 공고 승인 알림 전송 오류', error);
    throw error;
  }
}

/**
 * 대회 공고 거부 알림
 */
export async function sendTournamentRejectionNotification(
  postingId: string,
  reason: string
) {
  try {
    const postingDoc = await admin.firestore()
      .collection('jobPostings')
      .doc(postingId)
      .get();

    if (!postingDoc.exists) {
      throw new Error('공고를 찾을 수 없습니다.');
    }

    const posting = postingDoc.data() as JobPosting;

    await sendNotification({
      userId: posting.createdBy,
      type: 'tournament_rejected',
      title: '대회 공고 승인 거부',
      body: `"${posting.title}" 공고가 거부되었습니다. 사유: ${reason}`,
      data: { postingId, reason }
    });

    logger.info('대회 공고 거부 알림 전송 완료', { postingId });
  } catch (error) {
    logger.error('대회 공고 거부 알림 전송 오류', error);
    throw error;
  }
}
```

---

## 구현 계획

### Phase 1: 데이터 Foundation (3일)

#### Day 1: 타입 시스템 구축
- [ ] `jobPosting.ts` 타입 확장
  - `PostingType` enum 추가
  - `FixedPostingConfig` 인터페이스 추가
  - `TournamentPostingConfig` 인터페이스 추가
  - `UrgentPostingConfig` 인터페이스 추가
  - `JobPosting` 인터페이스에 `postingType` 및 config 필드 추가
- [ ] `JobPostingFilters` 타입 확장
  - `postingType` 필터 추가
  - `selectedDate` 필터 추가

#### Day 2: Security Rules 업데이트
- [ ] `firestore.rules` 수정
  - `postingType` 필수 검증 추가
  - 타입별 config 검증 로직 추가
  - 승인 권한 규칙 추가 (admin만)
- [ ] Firebase 인덱스 생성
  ```bash
  firebase index create --collection jobPostings --field postingType --field createdAt
  firebase index create --collection jobPostings --field postingType --field status --field createdAt
  firebase index create --collection jobPostings --field postingType --field tournamentConfig.approvalStatus --field createdAt
  ```

#### Day 3: 마이그레이션 유틸
- [ ] `normalizePostingType` 함수 작성
  - 기존 `type`/`recruitmentType` → `postingType` 변환
- [ ] 기존 데이터 호환성 테스트
- [ ] 타입 검증 유틸 함수 작성

### Phase 2: UI Components (5일)

#### Day 4: 타입 선택 모달
- [ ] `PostingTypeSelectionModal` 컴포넌트 생성
  - 4가지 타입 카드 UI
  - 타입별 설명 및 비용 표시
  - 다크모드 지원

#### Day 5: 고정 공고 입력
- [ ] `FixedPostingFields` 컴포넌트 생성
  - 노출 기간 선택 UI (7/30/90일)
  - 칩 비용 표시
  - 다크모드 지원

#### Day 6: JobPostingForm 수정
- [ ] 타입 선택 플로우 추가
  - 공고 작성 버튼 클릭 시 타입 선택 모달 표시
  - 선택된 타입에 따라 폼 분기
- [ ] 타입별 조건부 렌더링
  - `fixed`: `FixedPostingFields` 표시
  - `tournament`: 승인 안내 메시지
  - `urgent`: 제한사항 안내 메시지
- [ ] 유효성 검증 로직 추가

#### Day 7: 날짜 슬라이더 & 게시판 탭
- [ ] `DateSlider` 컴포넌트 생성
  - 빠른 선택 버튼 (오늘/내일/이번주)
  - 날짜 선택 모달 연동
- [ ] `JobBoardPage` 탭 구조 변경
  - 5개 탭 (지원/고정/대회/긴급/내 지원)
  - 탭별 콘텐츠 렌더링

#### Day 8: 카드 스타일링
- [ ] `JobPostingCard` 긴급 스타일 추가
  - 빨간색 테마 (다크모드 포함)
  - 긴급 배지 (animate-pulse)
  - 타입별 border 스타일

### Phase 3: Logic & State (3일)

#### Day 9: useJobBoard Hook 확장
- [ ] 타입별 필터링 로직 추가
  - `regularPostings`, `fixedPostings`, `tournamentPostings`, `urgentPostings` 분리
- [ ] 날짜 필터링 로직 추가
  - `selectedDate` 기반 필터링 (지원 공고만)
- [ ] 고정 공고 노출 기간 체크
  - `isWithinDisplayPeriod` 함수 구현
- [ ] 대회 공고 승인 상태 필터
  - `approved`만 표시

#### Day 10: 승인 시스템 페이지
- [ ] `TournamentApprovalPage` 생성
  - admin 권한 체크
  - 승인 대기 공고 실시간 구독
  - 승인/거부 처리 함수
- [ ] `TournamentApprovalCard` 컴포넌트 생성
  - 공고 정보 표시
  - 승인 기준 체크리스트
  - 승인/거부 버튼

#### Day 11: 라우팅 및 네비게이션
- [ ] `App.tsx` 라우트 추가
  ```typescript
  <Route path="/app/tournament-approval" element={<TournamentApprovalPage />} />
  ```
- [ ] 네비게이션 메뉴에 승인 페이지 추가 (admin만)
- [ ] 권한 기반 라우트 가드 적용

### Phase 4: Integration (2일)

#### Day 12: 알림 시스템 연동
- [ ] `sendTournamentApprovalNotification` 함수 구현
- [ ] `sendTournamentRejectionNotification` 함수 구현
- [ ] 승인/거부 처리 시 알림 전송 연동

#### Day 13: 테스트 & 최종 점검
- [ ] E2E 테스트 작성
  - 타입별 공고 작성 플로우
  - 승인 시스템 플로우
  - 날짜 필터링
- [ ] 단위 테스트 작성
  - `normalizePostingType`
  - `isWithinDisplayPeriod`
  - 타입별 필터링 로직
- [ ] 다크모드 테스트
- [ ] 성능 테스트 (대량 데이터)

---

## 마이그레이션 전략

### 1. 기존 데이터 호환성 유지

**목표**: 기존 공고 데이터가 새로운 시스템에서도 정상 작동

**전략**:
```typescript
// 모든 공고 읽기 시 자동 변환
export function normalizePostingType(post: JobPosting): JobPosting {
  // 이미 postingType이 있으면 그대로 반환
  if (post.postingType) {
    return post;
  }

  // 기존 type 또는 recruitmentType을 postingType으로 변환
  const legacyType = post.type || post.recruitmentType;

  return {
    ...post,
    postingType: legacyType === 'fixed' ? 'fixed' : 'regular'
  };
}
```

### 2. 점진적 마이그레이션

**Step 1: 읽기 호환성 (배포 직후)**
- 모든 공고 읽기 시 `normalizePostingType` 자동 적용
- 기존 공고는 `regular` 또는 `fixed`로 자동 분류
- 사용자에게 영향 없음

**Step 2: 쓰기 마이그레이션 (배포 1주일 후)**
- 새로운 공고는 `postingType` 필수
- 기존 공고 수정 시 `postingType` 자동 추가
- Firestore Rules에서 `postingType` 필수화

**Step 3: 완전 마이그레이션 (배포 1개월 후)**
- 모든 기존 공고에 `postingType` 추가하는 스크립트 실행
- `type`, `recruitmentType` 필드 제거 (선택적)

### 3. 마이그레이션 스크립트

**파일**: `scripts/migrateJobPostingTypes.ts`

```typescript
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

admin.initializeApp();
const db = admin.firestore();

/**
 * 기존 공고 데이터에 postingType 추가
 */
async function migrateJobPostingTypes() {
  logger.info('공고 타입 마이그레이션 시작');

  const snapshot = await db.collection('jobPostings').get();
  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();

    // 이미 postingType이 있으면 스킵
    if (data.postingType) {
      return;
    }

    // type 또는 recruitmentType을 postingType으로 변환
    const legacyType = data.type || data.recruitmentType;
    const postingType = legacyType === 'fixed' ? 'fixed' : 'regular';

    batch.update(doc.ref, { postingType });
    count++;

    // 배치 제한 (500개)
    if (count % 500 === 0) {
      logger.info(`마이그레이션 진행 중: ${count}개 처리됨`);
    }
  });

  await batch.commit();
  logger.info(`공고 타입 마이그레이션 완료: 총 ${count}개 처리됨`);
}

migrateJobPostingTypes().catch(error => {
  logger.error('마이그레이션 오류', error);
  process.exit(1);
});
```

### 4. 롤백 계획

**문제 발생 시**:
1. 새로운 코드 배포 롤백
2. Firestore Rules 이전 버전으로 복구
3. `normalizePostingType` 함수 유지 (기존 데이터 호환성)
4. 사용자 데이터는 영향 없음

---

## 체크리스트

### 개발 시작 전
- [ ] 요구사항 최종 확인
- [ ] 디자인 시안 검토 (있는 경우)
- [ ] 개발 환경 설정 확인
- [ ] Git 브랜치 생성 (`feature/job-posting-system-redesign`)

### Phase 1 완료 후
- [ ] 타입 정의 검토
- [ ] Security Rules 테스트
- [ ] 인덱스 생성 확인
- [ ] 마이그레이션 유틸 테스트

### Phase 2 완료 후
- [ ] 모든 UI 컴포넌트 다크모드 확인
- [ ] 반응형 디자인 테스트 (모바일/태블릿/데스크톱)
- [ ] 접근성 검증 (키보드 네비게이션, 스크린 리더)

### Phase 3 완료 후
- [ ] 타입별 필터링 동작 확인
- [ ] 승인 시스템 권한 테스트
- [ ] 실시간 업데이트 테스트

### Phase 4 완료 후
- [ ] 알림 전송 확인
- [ ] E2E 테스트 통과
- [ ] 성능 테스트 통과
- [ ] 코드 리뷰 완료

### 배포 전
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] Firestore Rules 배포 확인
- [ ] 인덱스 생성 완료 확인
- [ ] 마이그레이션 스크립트 준비 (필요 시)

### 배포 후
- [ ] 모니터링 확인 (에러, 성능)
- [ ] 사용자 피드백 수집
- [ ] 기존 공고 정상 작동 확인
- [ ] 새로운 타입 공고 작성 테스트

---

## 참고 자료

### 관련 문서
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 개발 가이드
- [FEATURE_FLAG_GUIDE.md](FEATURE_FLAG_GUIDE.md) - Feature Flag 시스템
- [NOTIFICATION_SYSTEM.md](NOTIFICATION_SYSTEM.md) - 알림 시스템
- [MULTI_TENANT_STATUS.md](MULTI_TENANT_STATUS.md) - 멀티테넌트 아키텍처

### 기존 컴포넌트
- `JobPostingForm.tsx` - 공고 작성 폼
- `JobPostingCard.tsx` - 공고 카드 컴포넌트
- `JobBoardPage.tsx` - 게시판 메인 페이지
- `useJobBoard.ts` - 게시판 비즈니스 로직

### Firebase 문서
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Cloud Functions](https://firebase.google.com/docs/functions)

---

**작성자**: Claude (AI Assistant)
**검토자**: [개발자 이름]
**승인자**: [프로젝트 매니저]
**최종 수정일**: 2025-10-30