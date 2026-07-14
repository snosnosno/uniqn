/**
 * 급여 필터 시트 — 타입 세그먼트·프리셋 단일선택·적용(null 해제)·협의 제외 캡션을 검증한다.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SalaryFilterSheet } from '../SalaryFilterSheet';

const mockUsePostingTypeCounts = jest.fn();

jest.mock('@/hooks/usePostingTypeCounts', () => ({
  usePostingTypeCounts: (options: unknown) => mockUsePostingTypeCounts(options),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return visible ? <ReactNative.View>{children}</ReactNative.View> : null;
  },
}));

describe('SalaryFilterSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePostingTypeCounts.mockReturnValue({
      counts: { regular: 2, urgent: 0, fixed: 0, tournament: 0, total: 2 },
      hasCounts: true,
    });
  });

  it('기본은 시급 프리셋, 일급 전환 시 프리셋이 바뀌고 금액 선택은 초기화된다', () => {
    const onApply = jest.fn();
    const { getByText, getByTestId, queryByText } = render(
      <SalaryFilterSheet visible onClose={jest.fn()} appliedSalary={null} onApply={onApply} />
    );

    expect(getByText('1.3만+')).toBeTruthy();
    fireEvent.press(getByText('1.3만+'));

    fireEvent.press(getByText('일급'));
    expect(queryByText('1.3만+')).toBeNull();
    expect(getByText('15만+')).toBeTruthy();

    // 타입 전환으로 금액 선택이 초기화 → 적용은 해제(null)
    fireEvent.press(getByTestId('salary-filter-apply'));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('프리셋 선택 후 적용하면 {type, min} 을 전달한다', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByTestId } = render(
      <SalaryFilterSheet visible onClose={onClose} appliedSalary={null} onApply={onApply} />
    );

    fireEvent.press(getByText('1.3만+'));
    fireEvent.press(getByTestId('salary-filter-apply'));

    expect(onApply).toHaveBeenCalledWith({ type: 'hourly', min: 13000 });
    expect(onClose).toHaveBeenCalled();
  });

  it('적용 중 필터로 열면 초기 선택이 복원되고, 협의 제외 캡션이 보인다', () => {
    const { getByText } = render(
      <SalaryFilterSheet
        visible
        onClose={jest.fn()}
        appliedSalary={{ type: 'daily', min: 150000 }}
        onApply={jest.fn()}
      />
    );

    expect(getByText('일급 15만 이상')).toBeTruthy();
    expect(getByText('급여 협의 공고는 제외돼요')).toBeTruthy();
  });

  it('미리보기 카운트는 적용 중인 지역/역할 필터를 포함한 스코프로 조회한다', () => {
    render(
      <SalaryFilterSheet
        visible
        onClose={jest.fn()}
        appliedSalary={{ type: 'hourly', min: 13000 }}
        onApply={jest.fn()}
        appliedRegions={['서울 강남구']}
        appliedRoles={['dealer']}
      />
    );

    expect(mockUsePostingTypeCounts).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: ['서울 강남구'],
        roles: ['dealer'],
        salaryType: 'hourly',
        salaryMin: 13000,
        keepPreviousCounts: true,
      })
    );
  });
});
