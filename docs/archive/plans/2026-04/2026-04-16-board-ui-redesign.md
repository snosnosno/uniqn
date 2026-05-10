# 게시판 UI 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블라인드 밀도형 UI로 게시판을 리디자인 — 큐레이션 홈 + 미니멀 리스트 + 전 화면 공통 탭 바

**Architecture:** 기존 Presentation → Hooks → Service → Repository 구조 유지. 새 컴포넌트 4개(`BoardTabBar`, `BoardTypeBadge`, `BoardWriteFab`, `PinnedNoticeBanner`)를 `uniqn-mobile/src/components/board/` 아래에 추가. 기존 `BoardPostCard`는 본문/썸네일 제거 + 메타 4종 단일 라인으로 개편. 홈/카테고리 리스트 화면에서 동일 탭 바를 공유하고 탭 이동은 `router.replace()`로 스택을 쌓지 않음.

**Tech Stack:** Expo 55 / React Native 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / expo-router / FlashList / Jest + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-04-16-board-ui-redesign-design.md`

---

## File Structure

**신규 생성:**
- `uniqn-mobile/src/components/board/BoardTypeBadge.tsx` — 게시판 타입별 색상 뱃지
- `uniqn-mobile/src/components/board/BoardTypeBadge.test.tsx` — 5개 타입 렌더링 검증
- `uniqn-mobile/src/components/board/BoardTabBar.tsx` — 상단 수평 스크롤 탭 (홈+5 카테고리)
- `uniqn-mobile/src/components/board/BoardTabBar.test.tsx` — 탭 렌더링/활성 상태/press 핸들러
- `uniqn-mobile/src/components/board/BoardWriteFab.tsx` — 우하단 플로팅 글쓰기 버튼
- `uniqn-mobile/src/components/board/BoardWriteFab.test.tsx` — 렌더링/press 핸들러
- `uniqn-mobile/src/components/board/PinnedNoticeBanner.tsx` — 홈 상단 고정 공지 배너
- `uniqn-mobile/src/components/board/PinnedNoticeBanner.test.tsx` — 빈/단일/다중 케이스
- `uniqn-mobile/src/utils/formatCompactCount.ts` — 1000+ 숫자 compact 포맷(`1.2k`)
- `uniqn-mobile/src/utils/formatCompactCount.test.ts` — 경계값 테스트

**수정:**
- `uniqn-mobile/src/components/board/BoardPostCard.tsx` — Card→Pressable, 본문 제거, 메타 4종 단일 라인
- `uniqn-mobile/src/components/board/__tests__/BoardPostCard.test.tsx` — 신규 레이아웃에 맞게 교체
- `uniqn-mobile/app/(app)/(tabs)/board/index.tsx` — 진입 카드 2×3 제거, 탭 바 + 고정공지 배너 + 섹션 스타일 변경
- `uniqn-mobile/app/(app)/(tabs)/board/[boardType].tsx` — 탭 바 추가, FAB 추가, 라우팅 `replace` 전환

**예상 영향 없음:** `useBoard.ts`, `boardService.ts`, `BoardRepository.ts`, `types/board.ts`

---

## Task 1: `formatCompactCount` 유틸리티

**Files:**
- Create: `uniqn-mobile/src/utils/formatCompactCount.ts`
- Test: `uniqn-mobile/src/utils/formatCompactCount.test.ts`

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/utils/formatCompactCount.test.ts`:

```typescript
import { formatCompactCount } from './formatCompactCount';

describe('formatCompactCount', () => {
  it('returns the number as-is when below 1000', () => {
    expect(formatCompactCount(0)).toBe('0');
    expect(formatCompactCount(1)).toBe('1');
    expect(formatCompactCount(999)).toBe('999');
  });

  it('formats 1000+ as "1.2k" with single decimal', () => {
    expect(formatCompactCount(1000)).toBe('1k');
    expect(formatCompactCount(1200)).toBe('1.2k');
    expect(formatCompactCount(1250)).toBe('1.3k');
    expect(formatCompactCount(12345)).toBe('12.3k');
    expect(formatCompactCount(999999)).toBe('1000k');
  });

  it('handles undefined and null safely', () => {
    expect(formatCompactCount(undefined)).toBe('0');
    expect(formatCompactCount(null)).toBe('0');
  });

  it('handles negative numbers as absolute value fallback to 0', () => {
    expect(formatCompactCount(-5)).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/utils/formatCompactCount.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

Create `uniqn-mobile/src/utils/formatCompactCount.ts`:

```typescript
export function formatCompactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) return '0';
  if (value < 1000) return String(value);

  const kValue = value / 1000;
  const rounded = Math.round(kValue * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.floor(rounded)}k`;
  return `${rounded}k`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest src/utils/formatCompactCount.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/utils/formatCompactCount.ts uniqn-mobile/src/utils/formatCompactCount.test.ts
git commit -m "feat(board): compact count 포맷터 추가"
```

---

## Task 2: `BoardTypeBadge` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/board/BoardTypeBadge.tsx`
- Test: `uniqn-mobile/src/components/board/BoardTypeBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/board/BoardTypeBadge.test.tsx`:

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { BoardTypeBadge } from '../BoardTypeBadge';
import type { BoardType } from '@/types/board';

describe('BoardTypeBadge', () => {
  it.each<[BoardType, string]>([
    ['notice', '공지'],
    ['schedule', '일정'],
    ['free', '자유'],
    ['tda', 'TDA'],
    ['substitute', '대타'],
  ])('renders compact label for %s', (boardType, expected) => {
    const { getByText } = render(<BoardTypeBadge boardType={boardType} />);
    expect(getByText(expected)).toBeTruthy();
  });

  it('includes accessibility label with board type name', () => {
    const { getByLabelText } = render(<BoardTypeBadge boardType="free" />);
    expect(getByLabelText('자유 게시판 배지')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardTypeBadge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `uniqn-mobile/src/components/board/BoardTypeBadge.tsx`:

```typescript
import { Text, View } from 'react-native';
import type { BoardType } from '@/types/board';

const COMPACT_LABELS: Record<BoardType, string> = {
  notice: '공지',
  schedule: '일정',
  free: '자유',
  tda: 'TDA',
  substitute: '대타',
};

const CONTAINER_STYLES: Record<BoardType, string> = {
  notice: 'bg-info-100 dark:bg-info-700/30',
  schedule: 'bg-success-100 dark:bg-success-700/30',
  free: 'bg-primary-100 dark:bg-primary-900/30',
  tda: 'bg-secondary-200 dark:bg-secondary-700/40',
  substitute: 'bg-error-100 dark:bg-error-700/30',
};

const TEXT_STYLES: Record<BoardType, string> = {
  notice: 'text-info-700 dark:text-info-500',
  schedule: 'text-success-700 dark:text-success-500',
  free: 'text-primary-700 dark:text-primary-300',
  tda: 'text-secondary-700 dark:text-secondary-200',
  substitute: 'text-error-700 dark:text-error-500',
};

interface BoardTypeBadgeProps {
  boardType: BoardType;
}

export function BoardTypeBadge({ boardType }: BoardTypeBadgeProps) {
  const label = COMPACT_LABELS[boardType];
  return (
    <View
      className={`rounded-sm px-1.5 py-0.5 ${CONTAINER_STYLES[boardType]}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} 게시판 배지`}
    >
      <Text className={`text-xs font-sans-semibold ${TEXT_STYLES[boardType]}`}>{label}</Text>
    </View>
  );
}

export default BoardTypeBadge;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardTypeBadge.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/components/board/BoardTypeBadge.tsx uniqn-mobile/src/components/board/BoardTypeBadge.test.tsx
git commit -m "feat(board): 게시판 타입별 색상 뱃지 컴포넌트 추가"
```

---

## Task 3: `BoardPostCard` 리디자인 (밀도형)

**Files:**
- Modify: `uniqn-mobile/src/components/board/BoardPostCard.tsx`
- Modify: `uniqn-mobile/src/components/board/__tests__/BoardPostCard.test.tsx`

- [ ] **Step 1: Replace the existing test**

Overwrite `uniqn-mobile/src/components/board/__tests__/BoardPostCard.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardPostCard } from '../BoardPostCard';
import type { BoardPost } from '@/types/board';

function createMockPost(overrides: Partial<BoardPost> = {}): BoardPost {
  return {
    id: 'post-1',
    boardType: 'free',
    source: 'board',
    title: '테스트 글 제목',
    body: '본문 내용은 더 이상 리스트에 표시되지 않습니다',
    authorId: 'user-1',
    authorName: '작성자',
    authorRole: 'staff',
    visibility: 'public',
    status: 'active',
    linkedJobPostingId: null,
    isAutoCreated: false,
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    likeCount: 24,
    dislikeCount: 3,
    commentCount: 12,
    viewCount: 340,
    imageAttachments: [],
    lastActivityAt: new Date('2026-04-15T09:00:00.000Z'),
    createdAt: new Date('2026-04-15T08:00:00.000Z'),
    updatedAt: new Date('2026-04-15T08:30:00.000Z'),
    ...overrides,
  };
}

describe('BoardPostCard', () => {
  it('renders title but not body preview (density mode)', () => {
    const { getByText, queryByText } = render(
      <BoardPostCard post={createMockPost()} onPress={jest.fn()} />
    );
    expect(getByText('테스트 글 제목')).toBeTruthy();
    expect(queryByText('본문 내용은 더 이상 리스트에 표시되지 않습니다')).toBeNull();
  });

  it('renders all four meta counts regardless of board type', () => {
    const { getByText } = render(<BoardPostCard post={createMockPost()} onPress={jest.fn()} />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('340')).toBeTruthy();
    expect(getByText('24')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders all four meta counts for notice posts as well', () => {
    const post = createMockPost({ boardType: 'notice', source: 'announcement' });
    const { getByText } = render(<BoardPostCard post={post} onPress={jest.fn()} />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('340')).toBeTruthy();
    expect(getByText('24')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('formats counts over 1000 using compact notation', () => {
    const post = createMockPost({ viewCount: 1250, commentCount: 2100 });
    const { getByText } = render(<BoardPostCard post={post} onPress={jest.fn()} />);
    expect(getByText('1.3k')).toBeTruthy();
    expect(getByText('2.1k')).toBeTruthy();
  });

  it('calls onPress with the post when tapped', () => {
    const onPress = jest.fn();
    const post = createMockPost();
    const { getByRole } = render(<BoardPostCard post={post} onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(post);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/components/board/__tests__/BoardPostCard.test.tsx`
Expected: FAIL — new test assertions don't match current implementation.

- [ ] **Step 3: Rewrite `BoardPostCard.tsx`**

Overwrite `uniqn-mobile/src/components/board/BoardPostCard.tsx`:

```typescript
import { Pressable, Text, View } from 'react-native';
import {
  ChatbubbleEllipsesOutlineIcon,
  CloseCircleOutlineIcon,
  EyeIcon,
  HeartIcon,
  LockIcon,
  PinIcon,
} from '@/components/icons';
import { BoardTypeBadge } from './BoardTypeBadge';
import { formatCompactCount } from '@/utils/formatCompactCount';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { BoardPost } from '@/types/board';

interface BoardPostCardProps {
  post: BoardPost;
  onPress: (post: BoardPost) => void;
}

function formatMetaDate(post: BoardPost): string {
  const value = post.lastActivityAt ?? post.createdAt ?? post.updatedAt;
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}.${mm}.${dd}`;
  }
  return `${mm}.${dd}`;
}

export function BoardPostCard({ post, onPress }: BoardPostCardProps) {
  return (
    <Pressable
      onPress={() => onPress(post)}
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 게시글 상세 보기`}
      className="border-b border-secondary-200 dark:border-surface-overlay px-1 py-2.5 active:opacity-70"
    >
      <View className="flex-row items-center gap-2 mb-1">
        <BoardTypeBadge boardType={post.boardType} />
        {post.isPinned ? <PinIcon size={14} color="#D4AF37" /> : null}
        {post.isLocked ? <LockIcon size={14} color="#DC2626" /> : null}
        <Text
          numberOfLines={1}
          className="flex-1 text-base font-sans-semibold text-content-primary dark:text-secondary-100"
        >
          {post.title}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1 pl-1">
        <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
          {post.authorName}
        </Text>
        <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
          {formatMetaDate(post)}
        </Text>
        <View className="flex-row items-center">
          <ChatbubbleEllipsesOutlineIcon size={12} color="#D4AF37" />
          <Text className="ml-1 text-xs font-sans-semibold text-primary-700 dark:text-primary-300">
            {formatCompactCount(post.commentCount)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <EyeIcon size={12} color={SECONDARY_PALETTE[500]} />
          <Text className="ml-1 text-xs font-sans text-secondary-500 dark:text-secondary-400">
            {formatCompactCount(post.viewCount)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <HeartIcon size={12} color="#16A34A" />
          <Text className="ml-1 text-xs font-sans text-success-700 dark:text-success-500">
            {formatCompactCount(post.likeCount)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <CloseCircleOutlineIcon size={12} color="#DC2626" />
          <Text className="ml-1 text-xs font-sans text-error-700 dark:text-error-500">
            {formatCompactCount(post.dislikeCount)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default BoardPostCard;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd uniqn-mobile && npx jest src/components/board/__tests__/BoardPostCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Run type-check to ensure no regressions**

Run: `cd uniqn-mobile && npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/components/board/BoardPostCard.tsx uniqn-mobile/src/components/board/__tests__/BoardPostCard.test.tsx
git commit -m "refactor(board): BoardPostCard 밀도형 레이아웃으로 개편"
```

---

## Task 4: `BoardTabBar` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/board/BoardTabBar.tsx`
- Test: `uniqn-mobile/src/components/board/BoardTabBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/board/BoardTabBar.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardTabBar } from './BoardTabBar';

describe('BoardTabBar', () => {
  it('renders all six tabs in order', () => {
    const { getByText } = render(<BoardTabBar activeTab="home" onTabPress={jest.fn()} />);
    for (const label of ['홈', '공지', '일정', '자유', 'TDA', '대타']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('marks the active tab with accessibility selected state', () => {
    const { getByLabelText } = render(
      <BoardTabBar activeTab="free" onTabPress={jest.fn()} />
    );
    const freeTab = getByLabelText('자유 탭');
    expect(freeTab.props.accessibilityState?.selected).toBe(true);

    const homeTab = getByLabelText('홈 탭');
    expect(homeTab.props.accessibilityState?.selected).toBe(false);
  });

  it('invokes onTabPress with the pressed tab key', () => {
    const onTabPress = jest.fn();
    const { getByLabelText } = render(
      <BoardTabBar activeTab="home" onTabPress={onTabPress} />
    );
    fireEvent.press(getByLabelText('TDA 탭'));
    expect(onTabPress).toHaveBeenCalledWith('tda');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardTabBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `uniqn-mobile/src/components/board/BoardTabBar.tsx`:

```typescript
import { Pressable, ScrollView, Text } from 'react-native';
import type { BoardType } from '@/types/board';

export type BoardTabKey = 'home' | BoardType;

interface TabItem {
  key: BoardTabKey;
  label: string;
}

const TABS: TabItem[] = [
  { key: 'home', label: '홈' },
  { key: 'notice', label: '공지' },
  { key: 'schedule', label: '일정' },
  { key: 'free', label: '자유' },
  { key: 'tda', label: 'TDA' },
  { key: 'substitute', label: '대타' },
];

interface BoardTabBarProps {
  activeTab: BoardTabKey;
  onTabPress: (tab: BoardTabKey) => void;
}

export function BoardTabBar({ activeTab, onTabPress }: BoardTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-1.5 px-4 py-2"
      className="border-b border-secondary-200 dark:border-surface-overlay"
    >
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => onTabPress(key)}
            accessibilityRole="tab"
            accessibilityLabel={`${label} 탭`}
            accessibilityState={{ selected: isActive }}
            className={`rounded-xl px-3 py-1.5 ${
              isActive
                ? 'bg-primary-500 dark:bg-primary-400'
                : 'bg-secondary-100 dark:bg-surface-elevated'
            }`}
          >
            <Text
              className={`text-sm font-sans-semibold ${
                isActive
                  ? 'text-white dark:text-black'
                  : 'text-content-muted dark:text-secondary-300'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default BoardTabBar;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardTabBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/components/board/BoardTabBar.tsx uniqn-mobile/src/components/board/BoardTabBar.test.tsx
git commit -m "feat(board): 게시판 상단 탭 바 컴포넌트 추가"
```

---

## Task 5: `BoardWriteFab` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/board/BoardWriteFab.tsx`
- Test: `uniqn-mobile/src/components/board/BoardWriteFab.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/board/BoardWriteFab.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardWriteFab } from './BoardWriteFab';

describe('BoardWriteFab', () => {
  it('renders with the 글쓰기 accessibility label', () => {
    const { getByLabelText } = render(<BoardWriteFab onPress={jest.fn()} />);
    expect(getByLabelText('글쓰기')).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<BoardWriteFab onPress={onPress} />);
    fireEvent.press(getByLabelText('글쓰기'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardWriteFab.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `uniqn-mobile/src/components/board/BoardWriteFab.tsx`:

```typescript
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCircleOutlineIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';

interface BoardWriteFabProps {
  onPress: () => void;
}

export function BoardWriteFab({ onPress }: BoardWriteFabProps) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16 + insets.bottom,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="글쓰기"
        className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 shadow-lg active:opacity-70 dark:bg-primary-400"
      >
        <AddCircleOutlineIcon size={24} color={isDark ? '#000000' : '#FFFFFF'} />
      </Pressable>
    </View>
  );
}

export default BoardWriteFab;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest src/components/board/BoardWriteFab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/components/board/BoardWriteFab.tsx uniqn-mobile/src/components/board/BoardWriteFab.test.tsx
git commit -m "feat(board): 글쓰기 플로팅 FAB 컴포넌트 추가"
```

---

## Task 6: `PinnedNoticeBanner` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/board/PinnedNoticeBanner.tsx`
- Test: `uniqn-mobile/src/components/board/PinnedNoticeBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/board/PinnedNoticeBanner.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PinnedNoticeBanner } from './PinnedNoticeBanner';
import type { BoardPost } from '@/types/board';

function makeNotice(id: string, title: string): BoardPost {
  return {
    id,
    boardType: 'notice',
    source: 'announcement',
    title,
    body: '',
    authorId: 'admin',
    authorName: '관리자',
    authorRole: 'admin',
    visibility: 'public',
    status: 'active',
    linkedJobPostingId: null,
    isAutoCreated: true,
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    viewCount: 0,
    imageAttachments: [],
    isPinned: true,
    lastActivityAt: new Date('2026-04-14T00:00:00.000Z'),
    createdAt: new Date('2026-04-14T00:00:00.000Z'),
    updatedAt: new Date('2026-04-14T00:00:00.000Z'),
  };
}

describe('PinnedNoticeBanner', () => {
  it('returns null when notices is empty', () => {
    const { toJSON } = render(<PinnedNoticeBanner notices={[]} onPress={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders up to two pinned notices', () => {
    const notices = [
      makeNotice('n1', '첫 번째 공지'),
      makeNotice('n2', '두 번째 공지'),
      makeNotice('n3', '세 번째 공지'),
    ];
    const { getByText, queryByText } = render(
      <PinnedNoticeBanner notices={notices} onPress={jest.fn()} />
    );
    expect(getByText('첫 번째 공지')).toBeTruthy();
    expect(getByText('두 번째 공지')).toBeTruthy();
    expect(queryByText('세 번째 공지')).toBeNull();
  });

  it('calls onPress with the tapped notice', () => {
    const onPress = jest.fn();
    const notice = makeNotice('n1', '공지 제목');
    const { getByText } = render(
      <PinnedNoticeBanner notices={[notice]} onPress={onPress} />
    );
    fireEvent.press(getByText('공지 제목'));
    expect(onPress).toHaveBeenCalledWith(notice);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest src/components/board/PinnedNoticeBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `uniqn-mobile/src/components/board/PinnedNoticeBanner.tsx`:

```typescript
import { Pressable, Text, View } from 'react-native';
import { PinIcon } from '@/components/icons';
import type { BoardPost } from '@/types/board';

interface PinnedNoticeBannerProps {
  notices: BoardPost[];
  onPress: (notice: BoardPost) => void;
}

export function PinnedNoticeBanner({ notices, onPress }: PinnedNoticeBannerProps) {
  const visible = notices.slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <View className="mb-4 rounded-md border-l-2 border-primary-500 bg-primary-50 px-3 py-2 dark:border-primary-400 dark:bg-surface-elevated">
      <View className="mb-1 flex-row items-center gap-1">
        <PinIcon size={12} color="#D4AF37" />
        <Text className="text-xs font-sans-semibold text-primary-700 dark:text-primary-300">
          고정 공지
        </Text>
      </View>
      {visible.map((notice) => (
        <Pressable
          key={notice.id}
          onPress={() => onPress(notice)}
          accessibilityRole="button"
          accessibilityLabel={`고정 공지: ${notice.title}`}
          className="py-1 active:opacity-70"
        >
          <Text
            numberOfLines={1}
            className="text-sm font-sans text-content-primary dark:text-secondary-100"
          >
            {notice.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default PinnedNoticeBanner;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest src/components/board/PinnedNoticeBanner.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/components/board/PinnedNoticeBanner.tsx uniqn-mobile/src/components/board/PinnedNoticeBanner.test.tsx
git commit -m "feat(board): 홈 고정 공지 배너 컴포넌트 추가"
```

---

## Task 7: 카테고리 리스트 화면 개편 (`board/[boardType].tsx`)

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/board/[boardType].tsx`

No test file — screens are covered by E2E (Task 9).

- [ ] **Step 1: Rewrite the screen**

Overwrite `uniqn-mobile/app/(app)/(tabs)/board/[boardType].tsx`:

```typescript
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState } from '@/components/ui';
import { DocumentTextOutlineIcon } from '@/components/icons';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { BoardWriteFab } from '@/components/board/BoardWriteFab';
import { useBoardPosts } from '@/hooks/useBoard';
import { BOARD_TYPE_LABELS, type BoardType } from '@/types/board';
import { SECONDARY_PALETTE } from '@/constants/colors';

const SUPPORTED_BOARD_TYPES: BoardType[] = ['notice', 'schedule', 'free', 'tda', 'substitute'];

function navigateToTab(tab: BoardTabKey) {
  if (tab === 'home') {
    router.replace('/(app)/(tabs)/board');
    return;
  }
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardListScreen() {
  const { boardType: rawBoardType } = useLocalSearchParams<{ boardType: string }>();
  const boardType = rawBoardType as BoardType;
  const isValidBoardType = SUPPORTED_BOARD_TYPES.includes(boardType);
  const safeBoardType = isValidBoardType ? boardType : 'notice';
  const isWritable = safeBoardType === 'free' || safeBoardType === 'tda';
  const { data, isLoading, error, refetch, isRefetching } = useBoardPosts(safeBoardType, 50);

  if (!isValidBoardType) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
        <TabHeader title="게시판" />
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시판을 찾을 수 없어요"
            message="잘못된 게시판 경로예요."
            onRetry={() => router.replace('/(app)/(tabs)/board')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title={BOARD_TYPE_LABELS[boardType]} />
      <BoardTabBar activeTab={safeBoardType} onTabPress={navigateToTab} />

      {error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시글 목록을 불러오지 못했어요"
            message={error.message}
            onRetry={refetch}
          />
        </View>
      ) : (
        <FlashList
          data={data ?? []}
          renderItem={({ item }) => (
            <BoardPostCard
              post={item}
              onPress={(post) => router.push(`/(app)/(tabs)/board/post/${post.id}`)}
            />
          )}
          keyExtractor={(item) => item.id}
          // @ts-expect-error - FlashList 2.x runtime prop is available but project types lag behind
          estimatedItemSize={72}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            isLoading ? (
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-sm font-sans text-secondary-500 dark:text-secondary-400">
                  게시글을 불러오는 중이에요...
                </Text>
              </View>
            ) : (
              <EmptyState
                icon={<DocumentTextOutlineIcon size={48} color={SECONDARY_PALETTE[400]} />}
                title="아직 게시글이 없어요"
                description={
                  boardType === 'schedule'
                    ? '접근 가능한 일정 게시판이 아직 없어요.'
                    : boardType === 'substitute'
                      ? '현재 대타 구인 글이 없어요.'
                      : '첫 게시글을 등록해 보세요.'
                }
                actionLabel={isWritable ? '글쓰기' : undefined}
                onAction={
                  isWritable
                    ? () => router.push(`/(app)/(tabs)/board/write?boardType=${safeBoardType}`)
                    : undefined
                }
              />
            )
          }
        />
      )}

      {isWritable ? (
        <BoardWriteFab
          onPress={() =>
            router.push(`/(app)/(tabs)/board/write?boardType=${safeBoardType}`)
          }
        />
      ) : null}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `cd uniqn-mobile && npm run type-check`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `cd uniqn-mobile && npm run lint -- app/\(app\)/\(tabs\)/board/\[boardType\].tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/app/\(app\)/\(tabs\)/board/\[boardType\].tsx
git commit -m "feat(board): 카테고리 리스트에 공통 탭 바와 플로팅 FAB 적용"
```

---

## Task 8: 홈 화면 개편 (`board/index.tsx`)

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/board/index.tsx`

- [ ] **Step 1: Rewrite the screen**

Overwrite `uniqn-mobile/app/(app)/(tabs)/board/index.tsx`:

```typescript
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState, SkeletonListItem } from '@/components/ui';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { PinnedNoticeBanner } from '@/components/board/PinnedNoticeBanner';
import { useBoardHome } from '@/hooks/useBoard';
import { useAuth } from '@/hooks/useAuth';
import type { BoardPost, BoardType } from '@/types';

interface BoardSectionProps {
  title: string;
  emptyTitle: string;
  posts: BoardPost[];
  moreBoardType?: BoardType;
}

function BoardSection({ title, emptyTitle, posts, moreBoardType }: BoardSectionProps) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-sans-semibold uppercase tracking-wider text-secondary-600 dark:text-secondary-400">
          {title}
        </Text>
        {moreBoardType ? (
          <Pressable
            onPress={() => router.replace(`/(app)/(tabs)/board/${moreBoardType}`)}
            accessibilityRole="button"
            accessibilityLabel={`${title} 더보기`}
            className="active:opacity-70"
          >
            <Text className="text-xs font-sans text-primary-700 dark:text-primary-300">
              더보기 ›
            </Text>
          </Pressable>
        ) : null}
      </View>

      {posts.length === 0 ? (
        <EmptyState title={emptyTitle} description="아직 표시할 게시글이 없어요." compact />
      ) : (
        posts.map((post) => (
          <BoardPostCard
            key={post.id}
            post={post}
            onPress={(targetPost) => router.push(`/(app)/(tabs)/board/post/${targetPost.id}`)}
          />
        ))
      )}
    </View>
  );
}

function navigateToTab(tab: BoardTabKey) {
  if (tab === 'home') return;
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardHomeScreen() {
  const { role, isAdmin } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useBoardHome();

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title="게시판" />
      <BoardTabBar activeTab="home" onTabPress={navigateToTab} />

      {isLoading ? (
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <SkeletonListItem key={item} />
          ))}
        </ScrollView>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시판 홈을 불러오지 못했어요"
            message={error.message}
            onRetry={refetch}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-8"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          <PinnedNoticeBanner
            notices={data?.pinnedNotices ?? []}
            onPress={(notice) => router.push(`/(app)/(tabs)/board/post/${notice.id}`)}
          />

          <BoardSection
            title="🔥 인기글"
            emptyTitle="아직 인기글이 없어요"
            posts={data?.popularCommunityPosts ?? []}
            moreBoardType="free"
          />
          <BoardSection
            title={
              isAdmin
                ? '🕒 최근 일정 활동'
                : role === 'employer'
                  ? '🕒 내 공고 최근 활동'
                  : '🕒 내 일정 최근 활동'
            }
            emptyTitle="표시할 일정 활동이 없어요"
            posts={data?.recentSchedulePosts ?? []}
            moreBoardType="schedule"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `cd uniqn-mobile && npm run type-check`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `cd uniqn-mobile && npm run lint -- app/\(app\)/\(tabs\)/board/index.tsx`
Expected: no errors.

- [ ] **Step 4: Run the full test suite for the board module**

Run: `cd uniqn-mobile && npx jest src/components/board/ src/utils/formatCompactCount`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/app/\(app\)/\(tabs\)/board/index.tsx
git commit -m "feat(board): 홈 화면 큐레이션 구조로 재구성"
```

---

## Task 9: E2E 테스트 업데이트

**Files:**
- Modify: `uniqn-mobile/e2e/tests/p2-standard/board.spec.ts`

- [ ] **Step 1: Read the existing E2E file to see current selectors**

Run: `cat uniqn-mobile/e2e/tests/p2-standard/board.spec.ts`

Inspect current `getByRole`/`getByText` calls tied to the old 2×3 grid (e.g. `'공지사항으로 이동'`, `'자유게시판으로 이동'`). These selectors no longer exist — they are replaced by tab pills with `accessibilityLabel={`${label} 탭`}`.

- [ ] **Step 2: Update selectors**

Replace every occurrence of the old 2×3 entry card selector with the new tab label. Map:
- `'공지사항으로 이동'` → `'공지 탭'`
- `'일정게시판으로 이동'` → `'일정 탭'`
- `'자유게시판으로 이동'` → `'자유 탭'`
- `'TDA 토론으로 이동'` → `'TDA 탭'`
- `'대타 구인으로 이동'` → `'대타 탭'`

Also:
- Any assertion that checks for body preview snippets in the list view must be removed (body preview no longer rendered).
- Assertions that relied on the old "engagement hidden for notice" behavior should be rewritten to expect all 4 counters on every post.

Use the Edit tool for each specific replacement; do NOT blindly search-and-replace across files outside this spec file.

- [ ] **Step 3: Add a new assertion for persistent tab bar**

Add a test that proves tabs are visible on both home and category screens:

```typescript
test('tab bar stays visible across home and category screens', async ({ page }) => {
  await page.goto('/board');
  await expect(page.getByLabel('자유 탭')).toBeVisible();
  await page.getByLabel('자유 탭').tap();
  await expect(page.getByLabel('자유 탭')).toBeVisible();
  await expect(page.getByLabel('TDA 탭')).toBeVisible();
});
```

Place this inside the existing `describe` block.

- [ ] **Step 4: Run the E2E test suite (or the single spec file if that is slow)**

Run: `cd uniqn-mobile && npm run e2e -- --grep board`
Expected: all assertions PASS. If the environment cannot run Playwright locally, stage and commit the test changes and rely on CI.

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/e2e/tests/p2-standard/board.spec.ts
git commit -m "test(board): 신규 탭 바 레이아웃에 맞게 E2E 셀렉터 갱신"
```

---

## Task 10: 품질 게이트 + 최종 확인

- [ ] **Step 1: Run the full quality script**

Run: `cd uniqn-mobile && npm run quality`
Expected: type-check + lint + format:check all PASS.

- [ ] **Step 2: Run the board test suite one more time**

Run: `cd uniqn-mobile && npx jest src/components/board src/utils/formatCompactCount app/\\(app\\)/\\(tabs\\)/board`
Expected: all PASS.

- [ ] **Step 3: Manual smoke test (local device / web)**

Run: `cd uniqn-mobile && npm start`

Verify on device or web:
1. `/board` 홈 화면 진입 — 상단 탭 바 보임, `홈` 탭이 활성
2. `🔥 인기글` / `🕒 내 일정 활동` 섹션의 "더보기 ›" 탭 시 해당 카테고리로 이동
3. 카테고리 리스트 화면에서 상단 탭 바 그대로 유지, 현재 카테고리만 활성
4. 자유/TDA 화면에서 우하단 FAB 보임, tap 시 `write` 화면 진입
5. 공지/일정/대타 화면에서 FAB 보이지 않음
6. 리스트 아이템: 제목 1줄 + 뱃지 + 메타 4종(💬·👁·♥·✖) 단일 라인으로 보임, 본문 미리보기 없음
7. 다크모드 토글 — 라이트/다크 모두 정상 렌더링

- [ ] **Step 4: Final sanity commit (none expected; only if smoke test revealed polish fixes)**

If smoke test surfaced minor CSS/spacing issues, fix them and commit with message `style(board): 스모크 테스트 폴리싱`.

---

## Self-Review

**Spec coverage:**
- Spec §3.1 상단 네비게이션: Task 4 (BoardTabBar) + Task 7/8 통합 ✓
- Spec §3.2 홈 화면 구성(고정공지 + 인기글 + 내 일정): Task 6 (PinnedNoticeBanner) + Task 8 ✓
- Spec §3.3 카테고리 리스트: Task 7 ✓
- Spec §4 리스트 아이템(밀도형, 본문/썸네일 제거, 메타 4종): Task 3 ✓
- Spec §4.2 뱃지 색상 5종: Task 2 (BoardTypeBadge) ✓
- Spec §4.3 카운트 포맷 `1.2k`: Task 1 (formatCompactCount) + Task 3 사용 ✓
- Spec §5 신규 컴포넌트 4종(BoardTabBar/BoardTypeBadge/BoardWriteFab/PinnedNoticeBanner): Task 2, 4, 5, 6 ✓
- Spec §6 라우팅 `replace`: Task 7, 8 `navigateToTab` ✓
- Spec §7 아키텍처 가드레일(다크모드 dark: prefix, 로깅): 각 Task 내 className에 반영 ✓
- Spec §8 테스트 전략(유닛 + E2E + 접근성): Task 2-6 단위 테스트, Task 9 E2E, Task 4 accessibilityState ✓

**Placeholder scan:** 없음. 모든 step에 실행 가능한 코드/명령 포함.

**Type consistency:**
- `BoardTabKey = 'home' | BoardType` (Task 4) — Task 7, 8 모두 `navigateToTab(tab: BoardTabKey)` 동일 시그니처 사용 ✓
- `BoardTypeBadge` props `{ boardType: BoardType }` (Task 2) — Task 3 `BoardPostCard`에서 `<BoardTypeBadge boardType={post.boardType} />` 동일 사용 ✓
- `BoardWriteFab` props `{ onPress: () => void }` (Task 5) — Task 7에서 동일 시그니처로 호출 ✓
- `PinnedNoticeBanner` props `{ notices: BoardPost[]; onPress: (notice: BoardPost) => void }` (Task 6) — Task 8에서 동일 사용 ✓
- `formatCompactCount(value: number | null | undefined): string` (Task 1) — Task 3에서 동일 시그니처 호출 ✓
