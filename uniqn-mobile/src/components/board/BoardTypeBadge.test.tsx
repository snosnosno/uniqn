import React from 'react';
import { render } from '@testing-library/react-native';
import { BoardTypeBadge } from './BoardTypeBadge';
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
