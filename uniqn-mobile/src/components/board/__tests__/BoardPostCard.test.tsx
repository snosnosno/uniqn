import React from 'react';
import { render } from '@testing-library/react-native';
import { BoardPostCard } from '../BoardPostCard';
import type { BoardPost } from '@/types/board';

jest.mock('@/components/ui', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Card: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <ReactNative.Pressable onPress={onPress}>{children}</ReactNative.Pressable>
    ),
    Badge: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.Text>{children}</ReactNative.Text>
    ),
  };
});

function createMockPost(overrides: Partial<BoardPost> = {}): BoardPost {
  return {
    id: 'post-1',
    boardType: 'free',
    source: 'board',
    title: '테스트 글',
    body: '본문',
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
    likeCount: 2222,
    dislikeCount: 3333,
    commentCount: 1111,
    viewCount: 4444,
    imageAttachments: [],
    lastActivityAt: new Date('2026-04-05T09:00:00.000Z'),
    createdAt: new Date('2026-04-05T08:00:00.000Z'),
    updatedAt: new Date('2026-04-05T08:30:00.000Z'),
    ...overrides,
  };
}

describe('BoardPostCard', () => {
  it('hides engagement counters for notice posts', () => {
    const { queryByText, getByText } = render(
      <BoardPostCard
        post={createMockPost({ boardType: 'notice', source: 'announcement' })}
        onPress={jest.fn()}
      />
    );

    expect(queryByText('1111')).toBeNull();
    expect(queryByText('2222')).toBeNull();
    expect(queryByText('3333')).toBeNull();
    expect(getByText('4444')).toBeTruthy();
  });

  it('shows engagement counters for community posts', () => {
    const { getByText } = render(<BoardPostCard post={createMockPost()} onPress={jest.fn()} />);

    expect(getByText('1111')).toBeTruthy();
    expect(getByText('2222')).toBeTruthy();
    expect(getByText('3333')).toBeTruthy();
    expect(getByText('4444')).toBeTruthy();
  });
});
