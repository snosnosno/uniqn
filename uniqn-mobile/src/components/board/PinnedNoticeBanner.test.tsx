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
    const { getByText } = render(<PinnedNoticeBanner notices={[notice]} onPress={onPress} />);
    fireEvent.press(getByText('공지 제목'));
    expect(onPress).toHaveBeenCalledWith(notice);
  });
});
