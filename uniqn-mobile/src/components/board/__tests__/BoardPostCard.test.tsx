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
