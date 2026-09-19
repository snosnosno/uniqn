/**
 * DatePickerModal — 전 일정 스코프 어휘 + 빈 선택 확정
 *
 * 이 모달의 프로덕션 소비자는 `ScheduleDatesSheet` 하나이고 거기서 스코프는 **전 일정**이다.
 * 그래서 담긴 선택은 "추가분"이 아니라 **최종 집합**이고, 확인은 추가가 아니라 저장이다.
 * additive 시절의 `existingDates`(선택 불가 잠금 + '이미 추가된 날짜' 블록)는 그 소비자가
 * 항상 빈 배열로 넘겨 죽은 회로였으므로 제거했다.
 *
 * 빈 선택 확정은 `applyDateSelection`(utils/order-sheet/scheduleCardEdits.ts)이 이미 정의한
 * 경로다(카드 1개면 조건 보존·날짜만 비움, 다수면 첫 카드 조건 승계 + 나머지를 removedCards 로
 * 고지). UI 만 그 길을 막고 있었다 — 대신 **날짜가 있었는데 다 지우는 경우에만** 확인을 받는다.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { DatePickerModal } from '../DatePickerModal';

jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/CalendarPicker', () => ({
  CalendarPicker: () => null,
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

const { confirmAction } = jest.requireMock('@/utils/confirmAction') as {
  confirmAction: jest.Mock;
};

describe('DatePickerModal — 전 일정 스코프 어휘', () => {
  beforeEach(() => {
    confirmAction.mockReset();
  });

  it('시드가 없으면 선택 0개 — 확인은 활성이고 라벨은 파괴 어휘가 아니다', () => {
    const { getByText, queryByText } = render(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelectDates={jest.fn()}
        postingType="regular"
      />
    );
    expect(getByText('선택한 날짜 0개')).toBeTruthy();
    // 상한 안내는 통합 블록 한 곳에서만 말한다(중복 문구 제거 회귀 고정)
    expect(getByText('최대 7개까지')).toBeTruthy();
    expect(queryByText(/남은 슬롯:/)).toBeNull();
    // 원래 비어 있었으면 지울 것이 없다 — '비우기'는 거짓말이다
    expect(getByText('일정 저장')).toBeTruthy();
  });

  it('시드가 있으면 그 개수만큼 시드되고 라벨이 저장 어휘다(추가 아님)', () => {
    const { getByText, queryByText } = render(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelectDates={jest.fn()}
        postingType="regular"
        initialSelectedDates={['2026-07-14', '2026-07-15']}
      />
    );
    expect(getByText('선택한 날짜 2개')).toBeTruthy();
    expect(getByText('2일 저장')).toBeTruthy();
    // 전 일정 스코프에는 "추가"라는 개념이 없다 — 담긴 집합이 곧 결과다
    expect(queryByText(/개 추가/)).toBeNull();
  });

  it('additive 잔재가 남아 있지 않다 — 이미 추가된 날짜 블록은 렌더되지 않는다', () => {
    const { queryByText } = render(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelectDates={jest.fn()}
        postingType="regular"
        initialSelectedDates={['2026-07-14']}
      />
    );
    expect(queryByText(/이미 추가된 날짜/)).toBeNull();
  });
});

describe('DatePickerModal — 빈 선택 확정', () => {
  beforeEach(() => {
    confirmAction.mockReset();
  });

  it('원래 비어 있었으면 확인 없이 빈 집합을 확정한다', () => {
    const onSelectDates = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <DatePickerModal
        visible
        onClose={onClose}
        onSelectDates={onSelectDates}
        postingType="regular"
      />
    );

    fireEvent.press(getByText('일정 저장'));

    expect(confirmAction).not.toHaveBeenCalled();
    expect(onSelectDates).toHaveBeenCalledWith([]);
    expect(onClose).toHaveBeenCalled();
  });

  it('날짜가 있었는데 전부 해제하면 파괴 확인을 받고, 확인해야 비운다', () => {
    const onSelectDates = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <DatePickerModal
        visible
        onClose={onClose}
        onSelectDates={onSelectDates}
        postingType="regular"
        initialSelectedDates={['2026-07-14', '2026-07-15']}
      />
    );

    fireEvent.press(getByText('전체 해제'));
    expect(getByText('일정 비우기')).toBeTruthy();

    fireEvent.press(getByText('일정 비우기'));

    // 확인을 받기 전에는 아무것도 확정되지 않는다
    expect(onSelectDates).not.toHaveBeenCalled();
    expect(confirmAction).toHaveBeenCalledTimes(1);
    const options = confirmAction.mock.calls[0]![0] as {
      destructive?: boolean;
      onConfirm: () => void;
    };
    expect(options.destructive).toBe(true);

    act(() => options.onConfirm());
    expect(onSelectDates).toHaveBeenCalledWith([]);
    expect(onClose).toHaveBeenCalled();
  });
});
