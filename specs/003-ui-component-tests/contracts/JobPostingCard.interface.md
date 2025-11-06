# JobPostingCard Component Interface

**Component**: `JobPostingCard`
**File**: `app2/src/components/common/JobPostingCard.tsx`
**Date**: 2025-11-06

## Component Signature

```typescript
interface JobPostingCardProps {
  post: JobPosting & { applicationCount?: number };
  variant: 'admin-list' | 'user-card' | 'detail-info';
  renderActions?: (post: JobPosting) => React.ReactNode;
  renderExtra?: (post: JobPosting) => React.ReactNode;
  showStatus?: boolean;
  showApplicationCount?: boolean;
  className?: string;
}

export const JobPostingCard: React.FC<JobPostingCardProps>;
```

---

## Dependencies

### External Dependencies

| Dependency | Version | Usage |
|-----------|---------|-------|
| `react` | 18.2 | useEffect, useState |
| `react-i18next` | Latest | useTranslation for i18n |
| `firebase/firestore` | 11.9 | doc, getDoc for user data |

### Internal Dependencies

| Dependency | Path | Usage |
|-----------|------|-------|
| `JobPosting` | `types/jobPosting` | 타입 정의 |
| `formatDate`, `formatSalaryDisplay` | `utils/jobPosting/*` | 데이터 포맷팅 |
| `logger` | `utils/logger` | 로깅 |
| `db` | `firebase` | Firestore 인스턴스 |

---

## Component Behavior Contract

### 1. 렌더링 계약

#### 1.1 기본 정보 렌더링
```typescript
interface BasicInfoDisplay {
  requiredFields: {
    title: string;          // 공고 제목
    location: string;       // 지역 (서울)
    district: string;       // 구 (강남구)
    postingType: PostingType; // 공고 유형 아이콘
  };
  optionalFields: {
    contactPhone?: string;  // 문의 연락처
    chipCost?: number;      // 칩 비용
    applicationCount?: number; // 지원자 수
  };
}
```

#### 1.2 상태별 렌더링
```typescript
interface StatusDisplay {
  open: {
    badge: {
      text: '모집중',
      color: 'green-100 text-green-800',
      darkColor: 'dark:bg-green-900/30 dark:text-green-400'
    }
  };
  closed: {
    badge: {
      text: '마감',
      color: 'red-100 text-red-800',
      darkColor: 'dark:bg-red-900/30 dark:text-red-400'
    }
  };
}
```

#### 1.3 타입별 스타일 렌더링
```typescript
interface PostingTypeStyles {
  regular: {
    icon: '📋',
    border: 'border-gray-300 dark:border-gray-600',
    bg: 'bg-white dark:bg-gray-800'
  };
  fixed: {
    icon: '📌',
    border: 'border-l-4 border-l-blue-500 dark:border-l-blue-400',
    bg: 'bg-white dark:bg-gray-800'
  };
  tournament: {
    icon: '🏆',
    border: 'border-l-4 border-l-purple-500 dark:border-l-purple-400',
    bg: 'bg-white dark:bg-gray-800'
  };
  urgent: {
    icon: '🚨',
    border: 'border-2 border-red-500 dark:border-red-400 animate-pulse-border',
    bg: 'bg-white dark:bg-gray-800',
    badge: {
      text: '긴급',
      animate: 'animate-pulse'
    }
  };
}
```

### 2. 사용자 인터랙션 계약 (확장 테스트 필요)

#### 2.1 카드 클릭 (상세 페이지 이동)
```typescript
interface CardClickBehavior {
  trigger: 'click on card body (not on action buttons)';
  action: 'navigate to /app/job-postings/{post.id}';
  implementation: 'renderActions prop에서 제공 (부모 컴포넌트)';
  testStrategy: 'mock renderActions를 전달하고 호출 검증';
}
```

#### 2.2 지원하기 버튼
```typescript
interface ApplyButtonBehavior {
  trigger: 'click on "지원하기" button';
  preconditions: [
    'user is logged in',
    'user has not applied to this posting',
    'posting status is "open"'
  ];
  action: 'call onApply(post.id)';
  implementation: 'renderActions prop에서 제공';
  testStrategy: 'mock renderActions with apply button, verify onClick';
}
```

#### 2.3 북마크 토글
```typescript
interface BookmarkBehavior {
  trigger: 'click on bookmark icon';
  states: {
    unbookmarked: {
      icon: '🔖 (outline)',
      action: 'call onBookmark(post.id, "add")'
    },
    bookmarked: {
      icon: '🔖 (filled)',
      action: 'call onBookmark(post.id, "remove")'
    }
  };
  implementation: 'renderActions prop에서 제공';
  visualFeedback: 'icon changes immediately';
}
```

#### 2.4 공유 버튼
```typescript
interface ShareBehavior {
  trigger: 'click on share icon';
  action: 'call native share API or show share modal';
  implementation: 'renderActions prop에서 제공';
  fallback: 'copy link to clipboard if share API unavailable';
}
```

### 3. Variant별 렌더링 차이

#### 3.1 admin-list
```typescript
interface AdminListVariant {
  layout: 'horizontal compact',
  hover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  spacing: 'p-4',
  actions: 'renderActions (edit, delete buttons)',
  applicationCount: 'showApplicationCount=true'
}
```

#### 3.2 user-card
```typescript
interface UserCardVariant {
  layout: 'vertical card',
  overflow: 'overflow-hidden',
  shadow: 'shadow-sm',
  actions: 'renderActions (apply, bookmark, share)',
  applicationCount: 'showApplicationCount=false (default)'
}
```

#### 3.3 detail-info
```typescript
interface DetailInfoVariant {
  layout: 'full detail view',
  shadow: 'shadow-md',
  spacing: 'p-6',
  actions: 'renderExtra (additional info)',
  showAll: 'all optional fields visible'
}
```

---

## Accessibility Contract (WCAG 2.1 AA)

### 1. 시맨틱 마크업

```typescript
interface SemanticStructure {
  card: {
    role: 'article',
    ariaLabel: `${post.title} - ${post.location} ${post.district}`
  },
  title: {
    tag: 'h2 or h3',
    ariaLevel: 'depends on context'
  },
  statusBadge: {
    role: 'status',
    ariaLabel: post.status === 'open' ? '모집중' : '마감'
  },
  typeIcon: {
    role: 'img',
    ariaLabel: `${postingType} 공고` // e.g., "토너먼트 공고"
  },
  applyButton: {
    role: 'button',
    ariaLabel: '이 공고에 지원하기',
    ariaDisabled: post.status === 'closed' ? 'true' : 'false'
  },
  bookmarkButton: {
    role: 'button',
    ariaLabel: isBookmarked ? '북마크 제거' : '북마크 추가',
    ariaPressed: isBookmarked ? 'true' : 'false'
  }
}
```

### 2. 키보드 접근성

```typescript
interface KeyboardAccessibility {
  requirements: [
    'Card must be keyboard focusable if clickable',
    'All action buttons must be keyboard accessible',
    'Tab order: card → apply button → bookmark → share'
  ];
  interactions: {
    enter: 'activate focused element (navigate or action)',
    space: 'activate focused button',
    tab: 'move to next focusable element'
  };
}
```

### 3. 색상 대비 (다크모드 포함)

```typescript
interface ColorContrast {
  lightMode: {
    title: 'gray-900 on white (21:1)',
    bodyText: 'gray-600 on white (7:1)',
    statusBadge: {
      open: 'green-800 on green-100 (5:1)',
      closed: 'red-800 on red-100 (5:1)'
    },
    urgentBadge: 'white on red-500 (5:1)'
  },
  darkMode: {
    title: 'gray-100 on gray-800 (15:1)',
    bodyText: 'gray-300 on gray-800 (10:1)',
    statusBadge: {
      open: 'green-400 on green-900/30 (7:1)',
      closed: 'red-400 on red-900/30 (7:1)'
    },
    urgentBadge: 'white on red-600 (5:1)'
  },
  requirement: 'All contrasts must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)'
}
```

### 4. 스크린 리더 지원

```typescript
interface ScreenReaderSupport {
  announcements: [
    'Card announces title, location, and status',
    'Type icon announces posting type (e.g., "토너먼트 공고")',
    'Status badge announces "모집중" or "마감"',
    'Action buttons announce purpose ("지원하기", "북마크 추가")'
  ];
  readingOrder: [
    '1. Title',
    '2. Location (서울 강남구)',
    '3. Status (모집중/마감)',
    '4. Posting type (regular/fixed/tournament/urgent)',
    '5. Date requirements (if any)',
    '6. Salary info (if any)',
    '7. Action buttons'
  ];
}
```

---

## Test Coverage Requirements

### 1. 기존 테스트 (343줄, 다크모드 포함) ✅

| Category | Covered | Lines |
|----------|---------|-------|
| 기본 렌더링 | ✅ | 54-73 |
| 타입별 아이콘 | ✅ | 75-107 |
| 타입별 스타일 | ✅ | 109-141 |
| 긴급 공고 배지 | ✅ | 143-166 |
| 상태 배지 | ✅ | 168-194 |
| 칩 비용 배지 | ✅ | 196-225 |
| 다크모드 스타일 | ✅ | 227-291 |
| Variant별 렌더링 | ✅ | 293-314 |
| 문의 연락처 | ✅ | 316-330 |
| 커스텀 className | ✅ | 332-341 |

### 2. 추가 필요 테스트 (인터랙션)

| Test Case | Priority | Description | 예상 줄수 |
|-----------|----------|-------------|----------|
| 카드 클릭 → 상세 페이지 | P2 | renderActions로 제공된 onClick 호출 | 10-15 |
| 지원 버튼 클릭 | P2 | 지원 처리 함수 호출 검증 | 10-15 |
| 북마크 토글 | P2 | 북마크 추가/제거 함수 호출 | 15-20 |
| 공유 버튼 | P3 | 공유 API 호출 또는 복사 검증 | 10-15 |

### 3. 추가 필요 테스트 (접근성)

| Test Case | Priority | Description | 예상 줄수 |
|-----------|----------|-------------|----------|
| axe-core 검증 | P2 | WCAG 2.1 AA 준수 | 5-10 |
| 키보드 네비게이션 | P2 | Tab으로 카드 및 버튼 포커스 | 15-20 |
| Enter 키 선택 | P3 | Enter로 카드 활성화 | 10-15 |
| Space 키 버튼 활성화 | P3 | Space로 버튼 클릭 | 10-15 |
| 스크린 리더 텍스트 | P3 | aria-label 정확성 검증 | 10-15 |

**예상 추가 테스트 줄수**: 약 95-140줄 → **총 438-483줄 (목표 500줄 달성 가능)**

---

## Mock Dependencies (테스트용)

### Firebase Firestore Mock

```typescript
jest.mock('../../../../firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ name: '테스트 사용자', nickname: '닉네임' })
  })
}));
```

### React Router Mock (인터랙션 테스트용)

```typescript
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));
```

### renderActions Mock (인터랙션 테스트용)

```typescript
const mockOnApply = jest.fn();
const mockOnBookmark = jest.fn();
const mockOnShare = jest.fn();

const mockRenderActions = (post: JobPosting) => (
  <div>
    <button onClick={() => mockOnApply(post.id)}>지원하기</button>
    <button onClick={() => mockOnBookmark(post.id, 'add')}>북마크</button>
    <button onClick={() => mockOnShare(post.id)}>공유</button>
  </div>
);
```

---

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| 초기 렌더링 | <50ms | React DevTools Profiler |
| 카드 100개 렌더링 | <500ms | 가상 스크롤 또는 페이지네이션 |
| 인터랙션 응답 | <100ms | 사용자 체감 지연 없음 |
| 테스트 실행 시간 | <3초 | Jest 실행 시간 |

---

**Contract Version**: 1.0
**Last Updated**: 2025-11-06
