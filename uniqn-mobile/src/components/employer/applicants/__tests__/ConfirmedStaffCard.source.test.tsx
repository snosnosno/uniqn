/**
 * ConfirmedStaffCard — 출처 칩 (구인자 IA S4)
 *
 * 근무표 사람 줄에만 출처(`직접 배치` / `OO 공고에서`)를 단다. 공고 [근무] 화면은 이미 그 공고
 * 안이라 출처가 자명하므로 prop 을 넘기지 않고, 그때는 칩이 없어야 한다(무회귀).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { ConfirmedStaff } from '@/types';

import { ConfirmedStaffCard } from '../ConfirmedStaffCard';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: '김딜러',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: null,
  }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

const STAFF = {
  id: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  role: 'dealer',
  date: '2026-07-05',
  status: 'scheduled',
  timeSlot: '19:00',
} as unknown as ConfirmedStaff;

describe('ConfirmedStaffCard — 출처 칩', () => {
  it('source 가 없으면 칩을 그리지 않는다(공고 [근무] 화면 무회귀)', () => {
    render(<ConfirmedStaffCard staff={STAFF} />);

    // 대조군 — 카드 본문은 렌더됐다.
    expect(screen.getByText('김딜러')).toBeTruthy();
    expect(screen.queryByTestId('staff-source-chip')).toBeNull();
  });

  it('공고 출처는 문구를 보이고, 누르면 콜백을 부른다', () => {
    const onPress = jest.fn();
    render(
      <ConfirmedStaffCard staff={STAFF} source={{ label: '토요일 딜러 4명 공고에서', onPress }} />
    );

    expect(screen.getByText('토요일 딜러 4명 공고에서')).toBeTruthy();
    fireEvent.press(screen.getByTestId('staff-source-chip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('누를 곳이 없는 출처(직접 배치)는 버튼이 아니다', () => {
    render(<ConfirmedStaffCard staff={STAFF} source={{ label: '직접 배치' }} />);

    const chip = screen.getByTestId('staff-source-chip');
    expect(screen.getByText('직접 배치')).toBeTruthy();
    expect(chip.props.accessibilityRole).not.toBe('button');
    expect(chip.props.onPress).toBeUndefined();
  });

  it('누를 수 있는 칩은 글자가 작아도 위아래로 44px 에 가까운 누름 여유를 둔다', () => {
    render(
      <ConfirmedStaffCard
        staff={STAFF}
        source={{ label: '토요일 딜러 4명 공고에서', onPress: jest.fn() }}
      />
    );

    // 칩 자체 높이는 약 20px(text-xs + py-0.5) — 위아래 12 씩 더해야 터치 타깃 규칙(44px)에 닿는다.
    const { hitSlop } = screen.getByTestId('staff-source-chip').props;
    expect(hitSlop.top).toBeGreaterThanOrEqual(12);
    expect(hitSlop.bottom).toBeGreaterThanOrEqual(12);
  });

  it('누를 수 있는 칩은 목적지를 스크린리더 라벨로 알린다', () => {
    render(
      <ConfirmedStaffCard
        staff={STAFF}
        source={{ label: '토요일 딜러 4명 공고에서', onPress: jest.fn() }}
      />
    );

    expect(screen.getByLabelText('토요일 딜러 4명 공고에서. 공고 상세 보기')).toBeTruthy();
  });
});
