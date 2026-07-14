/**
 * 지역 필터 시트 — 3단계(그룹>시>구) 아코디언 상호작용을 실제 regions 데이터로 검증한다.
 * 확장 칩 펼침(선택 아님)·구 선택·시 전체·그룹 전환 리셋·검색 병기·구없는 시·승격 규칙(인천).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RegionFilterSheet, type RegionFilterSheetProps } from '../RegionFilterSheet';

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

function renderSheet(overrides?: Partial<RegionFilterSheetProps>) {
  const onApply = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <RegionFilterSheet
      visible
      onClose={onClose}
      appliedTokens={[]}
      onApply={onApply}
      {...overrides}
    />
  );
  return { onApply, onClose, ...utils };
}

describe('RegionFilterSheet — 3단계 아코디언', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePostingTypeCounts.mockReturnValue({
      counts: { regular: 0, urgent: 0, fixed: 0, tournament: 0, total: 0 },
      hasCounts: false,
    });
  });

  it('구 보유 시(부산) 확장 칩 탭은 선택이 아니라 펼침 — 구 칩이 노출되고 시가 pending 에 추가되지 않는다', () => {
    const { getByText, getByTestId, onApply } = renderSheet();

    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));

    expect(getByText('해운대구')).toBeTruthy(); // 펼침 = 구 노출
    fireEvent.press(getByTestId('region-filter-apply'));
    expect(onApply).toHaveBeenCalledWith([]); // 확장 칩 탭은 선택 아님
  });

  it('펼친 구 칩(해운대구) 선택 후 적용하면 onApply 토큰에 "부산 해운대구"가 포함된다', () => {
    const { getByText, getByTestId, onApply } = renderSheet();

    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));
    fireEvent.press(getByText('해운대구'));
    fireEvent.press(getByTestId('region-filter-apply'));

    expect(onApply).toHaveBeenCalledWith(expect.arrayContaining(['부산 해운대구']));
  });

  it('[부산 전체] 칩 선택 후 적용하면 시 slug 토큰("부산")을 전달한다', () => {
    const { getByText, getByTestId, onApply } = renderSheet();

    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));
    fireEvent.press(getByText('부산 전체'));
    fireEvent.press(getByTestId('region-filter-apply'));

    expect(onApply).toHaveBeenCalledWith(['부산']);
  });

  it('그룹 탭을 전환하면 펼침 상태가 리셋된다 (부산 펼침 → 서울 → 경상 복귀 시 접힘)', () => {
    const { getByText, queryByText } = renderSheet();

    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));
    expect(getByText('해운대구')).toBeTruthy();

    fireEvent.press(getByText('서울'));
    fireEvent.press(getByText('경상'));

    expect(queryByText('해운대구')).toBeNull(); // 리셋되어 접혀 있음
  });

  it('검색 결과 행은 구 항목에 부모 시를 병기한다 (해운대 → "경상 · 부산")', () => {
    const { getByTestId, getByText } = renderSheet();

    fireEvent.changeText(getByTestId('region-filter-search-input'), '해운대');

    expect(getByText('경상 · 부산')).toBeTruthy();
  });

  it('구 없는 시(강원 원주시) 칩은 탭 즉시 선택 토글된다', () => {
    const { getByText, getByTestId, onApply } = renderSheet();

    fireEvent.press(getByText('강원'));
    fireEvent.press(getByText('원주시'));
    fireEvent.press(getByTestId('region-filter-apply'));

    expect(onApply).toHaveBeenCalledWith(['강원 원주시']);
  });

  it('단일 시 그룹(인천) 승격 — 시 칩 없이 구 칩이 최상위로 노출된다', () => {
    const { getByText, getAllByText } = renderSheet();

    fireEvent.press(getByText('인천'));

    expect(getByText('부평구')).toBeTruthy(); // 구가 최상위 칩으로 승격
    // '인천' 텍스트는 좌측 그룹 탭 1개뿐 — 시 확장 칩이 없다(있으면 2개). "인천 전체"는 별 문자열.
    expect(getAllByText('인천')).toHaveLength(1);
  });
});
