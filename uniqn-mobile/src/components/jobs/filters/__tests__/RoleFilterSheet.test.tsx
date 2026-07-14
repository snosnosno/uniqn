/**
 * 역할 필터 시트 — 표준 5종 칩('other' 제외)·토글·적용·미리보기 스코프를 검증한다.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoleFilterSheet } from '../RoleFilterSheet';

const mockUsePostingTypeCounts = jest.fn();

jest.mock('@/hooks/usePostingTypeCounts', () => ({
  usePostingTypeCounts: (options: unknown) => mockUsePostingTypeCounts(options),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return visible ? <ReactNative.View>{children}</ReactNative.View> : null;
  },
}));

describe('RoleFilterSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePostingTypeCounts.mockReturnValue({
      counts: { regular: 3, urgent: 1, fixed: 0, tournament: 0, total: 4 },
      hasCounts: true,
    });
  });

  it("표준 역할 5종만 렌더한다 — 'other'(기타) 제외", () => {
    const { getByText, queryByText } = render(
      <RoleFilterSheet visible onClose={jest.fn()} appliedRoles={[]} onApply={jest.fn()} />
    );

    for (const name of ['딜러', '플로어', '서빙', '매니저', '직원']) {
      expect(getByText(name)).toBeTruthy();
    }
    expect(queryByText('기타')).toBeNull();
  });

  it('칩 토글 후 적용하면 선택 역할을 onApply 로 전달하고 닫는다', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByTestId } = render(
      <RoleFilterSheet visible onClose={onClose} appliedRoles={[]} onApply={onApply} />
    );

    fireEvent.press(getByText('딜러'));
    fireEvent.press(getByText('플로어'));
    fireEvent.press(getByText('플로어')); // 재탭 = 해제
    fireEvent.press(getByTestId('role-filter-apply'));

    expect(onApply).toHaveBeenCalledWith(['dealer']);
    expect(onClose).toHaveBeenCalled();
  });

  it('미리보기 카운트는 적용 중인 지역/급여 필터를 포함한 스코프로 조회한다', () => {
    render(
      <RoleFilterSheet
        visible
        onClose={jest.fn()}
        appliedRoles={['dealer']}
        onApply={jest.fn()}
        appliedRegions={['서울 강남구']}
        appliedSalary={{ type: 'hourly', min: 13000 }}
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

  it('적용 버튼 라벨에 미리보기 총 건수를 표시한다', () => {
    const { getByText } = render(
      <RoleFilterSheet visible onClose={jest.fn()} appliedRoles={[]} onApply={jest.fn()} />
    );
    expect(getByText('공고 4건 보기')).toBeTruthy();
  });
});
