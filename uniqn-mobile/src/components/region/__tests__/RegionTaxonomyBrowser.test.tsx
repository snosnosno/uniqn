/**
 * 지역 택소노미 브라우저 — 선택모델 비의존 공유 본문 검증.
 * 단일선택 하이라이트/픽 · 아코디언 · 시 전체 · 검색 · 그룹전체 슬롯 유무 · a11y role 분기.
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { RegionTaxonomyBrowser } from '../RegionTaxonomyBrowser';

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

describe('RegionTaxonomyBrowser', () => {
  it('단일선택 — 구 칩 픽 시 onPickSlug(slug) 호출, isSelected(slug)만 하이라이트', () => {
    const onPickSlug = jest.fn();
    const { getByText, getByLabelText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={(s) => s === '서울 강남구'}
        onPickSlug={onPickSlug}
      />
    );
    // 기본 그룹 서울 — 구 칩 노출
    fireEvent.press(getByText('강남구'));
    expect(onPickSlug).toHaveBeenCalledWith('서울 강남구');
    // 단일선택 role=radio + selected
    expect(getByLabelText('강남구 지역').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
  });

  it('아코디언 — 확장 칩(부산) 탭은 픽이 아니라 펼침, "부산 전체"와 구 칩이 노출된다', () => {
    const onPickSlug = jest.fn();
    const { getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={onPickSlug}
      />
    );
    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));
    expect(onPickSlug).not.toHaveBeenCalled(); // 펼침은 픽 아님
    expect(getByText('해운대구')).toBeTruthy();
    fireEvent.press(getByText('부산 전체'));
    expect(onPickSlug).toHaveBeenCalledWith('부산'); // 시 전체 = 시 slug
  });

  it('renderGroupAllRow 미지정이면 그룹전체 행이 없다 (단일선택 권역 배제)', () => {
    const { queryByText, getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={jest.fn()}
      />
    );
    fireEvent.press(getByText('경기'));
    expect(queryByText('경기 전체')).toBeNull();
  });

  it('renderGroupAllRow 지정 시 활성 그룹으로 렌더된다 (멀티 필터 슬롯)', () => {
    const { getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="multi"
        isSelected={() => false}
        onPickSlug={jest.fn()}
        renderGroupAllRow={(group) => <Text>{`${group} 전체 행`}</Text>}
      />
    );
    expect(getByText('서울 전체 행')).toBeTruthy();
  });

  it('검색 — 구 결과에 부모 시를 병기하고, 탭 시 onPickSlug(slug)', () => {
    const onPickSlug = jest.fn();
    const { getByTestId, getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={onPickSlug}
        searchInputTestID="test-region-search"
      />
    );
    fireEvent.changeText(getByTestId('test-region-search'), '해운대');
    expect(getByText('경상 · 부산')).toBeTruthy();
    fireEvent.press(getByText('해운대구'));
    expect(onPickSlug).toHaveBeenCalledWith('부산 해운대구');
  });

  it('initialGroup 지정 시 해당 그룹으로 시작한다', () => {
    const { getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={jest.fn()}
        initialGroup="강원"
      />
    );
    expect(getByText('원주시')).toBeTruthy();
  });
});
