/**
 * VenueSelectChips — 지점 선택 칩(표현 컴포넌트) 단위 테스트(B5)
 *
 * 지점 2개+ employer가 "이 공고를 어느 지점 배치에 반영할지" 고르는 칩 줄.
 * 순수 표현 컴포넌트(props only) — 노출 여부/데이터 패칭은 부모(create.tsx)가 담당하므로
 * 여기서는 주어진 venues 렌더·선택 콜백만 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueSelectChips } from '../VenueSelectChips';

const NOOP = jest.fn();
const VENUES = [
  { id: 'v1', name: '강남점' },
  { id: 'v2', name: '홍대점' },
];

function renderChips(overrides: Partial<React.ComponentProps<typeof VenueSelectChips>> = {}) {
  return render(
    <VenueSelectChips venues={VENUES} selectedId={undefined} onSelect={NOOP} {...overrides} />
  );
}

it('주어진 지점들의 이름 칩을 노출한다', () => {
  const { getByText } = renderChips();
  expect(getByText('강남점')).toBeTruthy();
  expect(getByText('홍대점')).toBeTruthy();
});

it('칩을 누르면 해당 지점 id로 onSelect가 호출된다', () => {
  const onSelect = jest.fn();
  const { getByLabelText } = renderChips({ onSelect });
  fireEvent.press(getByLabelText('지점 홍대점'));
  expect(onSelect).toHaveBeenCalledWith('v2');
});

it('selectedId에 해당하는 칩은 selected 접근성 상태를 갖는다', () => {
  const { getByLabelText } = renderChips({ selectedId: 'v1' });
  expect(getByLabelText('지점 강남점').props.accessibilityState?.selected).toBe(true);
  expect(getByLabelText('지점 홍대점').props.accessibilityState?.selected).toBe(false);
});
