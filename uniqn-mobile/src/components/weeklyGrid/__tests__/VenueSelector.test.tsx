/**
 * VenueSelector — "+ 운영처 추가" 진입점 테스트
 *
 * onAddVenue 제공 시 운영처 0개/N개 모두에서 "운영처 추가" 버튼이 노출되고
 * 누르면 콜백이 호출되는지 검증(순수 표현 컴포넌트).
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
  fireEvent.press(getByLabelText('운영처 추가'));
  expect(onAddVenue).toHaveBeenCalledTimes(1);
});

it('운영처 N개(칩 노출)에서도 onAddVenue 제공 시 추가 버튼 노출 + 콜백 호출', () => {
  const onAddVenue = jest.fn();
  const { getByLabelText } = renderSelector({
    containers: [{ id: 'v1', name: '강남 홀덤펍' } as never],
    onAddVenue,
  });
  fireEvent.press(getByLabelText('운영처 추가'));
  expect(onAddVenue).toHaveBeenCalledTimes(1);
});

it('onAddVenue 미제공 시 추가 버튼 미노출', () => {
  const { queryByLabelText } = renderSelector();
  expect(queryByLabelText('운영처 추가')).toBeNull();
});
