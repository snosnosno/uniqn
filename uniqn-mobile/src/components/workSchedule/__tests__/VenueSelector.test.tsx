/**
 * VenueSelector — "+ 지점 추가" 진입점 + 지점 1곳일 때 접기(구인자 IA S4)
 *
 * - onAddVenue 제공 시 운영처 0개/N개 모두에서 "지점 추가" 버튼이 노출되고 누르면 콜백 호출.
 * - S4: 고를 게 없는 지점 칩 줄은 지점이 **2곳 이상일 때만** 그린다. 1곳이면 지점명 한 줄로 접되,
 *   같은 줄에 붙어 있던 `지점 설정(⚙)` 과 `+ 지점 추가` 는 **남긴다** — 칩 줄과 함께 숨기면
 *   지점을 늘리거나 고칠 입구가 사라진다(진입점은 신호에 따라 숨기지 않는다).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueSelector } from '../VenueSelector';

const NOOP = jest.fn();

function renderSelector(overrides: Partial<React.ComponentProps<typeof VenueSelector>> = {}) {
  return render(
    <VenueSelector
      workspaces={[{ id: 'ws-1', name: '워크스페이스' } as never]}
      activeWorkspaceId="ws-1"
      onSelectWorkspace={NOOP}
      containers={[]}
      selectedVenueId={null}
      onSelectVenue={NOOP}
      {...overrides}
    />
  );
}

it('운영처 0개에서도 onAddVenue 제공 시 추가 버튼 노출 + 콜백 호출', () => {
  const onAddVenue = jest.fn();
  const { getByLabelText } = renderSelector({ onAddVenue });
  fireEvent.press(getByLabelText('지점 추가'));
  expect(onAddVenue).toHaveBeenCalledTimes(1);
});

it('운영처 N개(칩 노출)에서도 onAddVenue 제공 시 추가 버튼 노출 + 콜백 호출', () => {
  const onAddVenue = jest.fn();
  const { getByLabelText } = renderSelector({
    containers: [{ id: 'v1', name: '강남 홀덤펍' } as never],
    onAddVenue,
  });
  fireEvent.press(getByLabelText('지점 추가'));
  expect(onAddVenue).toHaveBeenCalledTimes(1);
});

it('onAddVenue 미제공 시 추가 버튼 미노출', () => {
  const { queryByLabelText } = renderSelector();
  expect(queryByLabelText('지점 추가')).toBeNull();
});

describe('지점 1곳일 때 접기 (S4)', () => {
  const ONE = [{ id: 'v1', name: '강남 홀덤펍' } as never];
  const TWO = [
    { id: 'v1', name: '강남 홀덤펍' } as never,
    { id: 'v2', name: '홍대 홀덤펍' } as never,
  ];

  it('지점이 1곳이면 고를 칩 대신 지점명만 보인다', () => {
    const { queryByLabelText, getByTestId, getByText } = renderSelector({
      containers: ONE,
      selectedVenueId: 'v1',
    });

    expect(getByTestId('venue-single-row')).toBeTruthy();
    expect(getByText('강남 홀덤펍')).toBeTruthy();
    // 고를 수 있는 칩(버튼)은 없다.
    expect(queryByLabelText('지점 강남 홀덤펍')).toBeNull();
  });

  it('지점이 1곳이어도 지점 설정과 지점 추가는 남는다', () => {
    const onOpenSettings = jest.fn();
    const onAddVenue = jest.fn();
    const { getByLabelText } = renderSelector({
      containers: ONE,
      selectedVenueId: 'v1',
      onOpenSettings,
      onAddVenue,
    });

    fireEvent.press(getByLabelText('지점 강남 홀덤펍 설정'));
    expect(onOpenSettings).toHaveBeenCalledWith('v1');

    fireEvent.press(getByLabelText('지점 추가'));
    expect(onAddVenue).toHaveBeenCalledTimes(1);
  });

  it('지점이 2곳 이상이면 칩으로 고를 수 있다', () => {
    const onSelectVenue = jest.fn();
    const { getByLabelText, queryByTestId } = renderSelector({
      containers: TWO,
      selectedVenueId: 'v1',
      onSelectVenue,
    });

    expect(queryByTestId('venue-single-row')).toBeNull();
    fireEvent.press(getByLabelText('지점 홍대 홀덤펍'));
    expect(onSelectVenue).toHaveBeenCalledWith('v2');
  });

  it('지점을 불러오는 중에는 접지 않고 로딩을 보인다', () => {
    const { getByText, queryByTestId } = renderSelector({
      containers: ONE,
      selectedVenueId: 'v1',
      isLoadingContainers: true,
    });

    expect(getByText('지점 불러오는 중…')).toBeTruthy();
    expect(queryByTestId('venue-single-row')).toBeNull();
  });
});
