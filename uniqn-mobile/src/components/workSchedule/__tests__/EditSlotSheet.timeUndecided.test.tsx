/**
 * EditSlotSheet — 시간 미정 슬롯 저장 게이트 회귀 가드
 *
 * 원래 결함: time_slot 이 비어 있는(시간 미정) 슬롯을 열면 startTime/endTime 이 화면용
 * 기본값(18:00 / 02:00)으로 채워졌고, handleSave 가 이를 무조건 전송해 **색상·메모만 고치려던
 * 저장이 8시간 근무를 확정**시켰다. 근무시간은 정산 금액의 입력값이라 금전 오염으로 이어진다.
 *
 * 지금 계약(§K + 결정 4):
 *  - 시각이 정해진 적 없는 슬롯은 **시간을 고르거나 '미정'을 명시 체크하기 전까지 저장 불가**다.
 *    '미정'이 방치의 결과가 아니라 선택이어야, 구직자 화면의 "출근 시간 미정" 안내가 의미를 갖는다.
 *  - 저장 전송의 진실원은 값이 아니라 "사용자가 시간 축을 건드렸는가" 하나다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { EditSlotSheet } from '../EditSlotSheet';
import { useUpdateSlot, useDeleteSlot } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import type { VenueDaySlot } from '@/repositories/workSchedule';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/TimeWheelPicker', () => ({
  TimeWheelPicker: () => null,
}));

jest.mock('@/hooks/workSchedule', () => ({
  useUpdateSlot: jest.fn(),
  useDeleteSlot: jest.fn(),
}));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseUpdate = useUpdateSlot as unknown as jest.Mock;
const mockUseDelete = useDeleteSlot as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

const BASE_SLOT: VenueDaySlot = {
  workLogId: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  staffNickname: null,
  staffPhotoUrl: null,
  role: 'dealer',
  customRole: null,
  timeSlot: null,
  status: 'scheduled',
  jobPostingId: 'jp-1',
  isContainer: true,
  color: null,
  notes: null,
};

let updateMutate: jest.Mock;

beforeEach(() => {
  updateMutate = jest.fn();
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: jest.fn(), error: jest.fn(), info: jest.fn() })
  );
  mockUseUpdate.mockReturnValue({ mutate: updateMutate, isPending: false });
  mockUseDelete.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

function renderSheet(slot: VenueDaySlot) {
  return render(
    <EditSlotSheet visible onClose={jest.fn()} slot={slot} date="2026-07-05" editedBy="op-1" />
  );
}

describe('EditSlotSheet — 시각이 정해진 적 없는 슬롯', () => {
  it('시간을 고르지도 미정을 체크하지도 않으면 저장되지 않는다(저장 게이트)', () => {
    const { getByText } = renderSheet(BASE_SLOT);

    fireEvent.press(getByText('저장'));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(getByText(/출근 시간을 고르거나/)).toBeTruthy();
  });

  it('빈 문자열 time_slot 도 미정으로 취급한다(같은 게이트)', () => {
    const { getByText } = renderSheet({ ...BASE_SLOT, timeSlot: '' });

    fireEvent.press(getByText('저장'));

    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("'미정'을 명시 체크하면 저장되고 미정이 전송된다", () => {
    const { getByText, getByLabelText } = renderSheet(BASE_SLOT);

    fireEvent.press(getByLabelText('출근 예정 미정'));
    fireEvent.press(getByText('저장'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const payload = updateMutate.mock.calls[0][0] as {
      workLogId: string;
      input: Record<string, unknown>;
    };

    expect(payload.workLogId).toBe('wl-1');
    expect(payload.input.timeUndecided).toBe(true);
    expect(payload.input).not.toHaveProperty('startTime');
    // 시간 외 필드는 정상 전송돼야 한다(부분 업데이트가 무력화되면 안 됨).
    expect(payload.input.staffRole).toBe('dealer');
  });

  it('기본값을 실제 값처럼 보여주지 않는다 — 빈 트리거 + 안내', () => {
    const { getByText, queryByText } = renderSheet(BASE_SLOT);

    // 18:00 을 값처럼 보여주면 사용자가 이미 정해진 줄 알고 그대로 저장한다.
    expect(getByText('시간 선택')).toBeTruthy();
    expect(queryByText('오후 6:00')).toBeNull();
    expect(getByText(/출근 시간을 고르거나/)).toBeTruthy();
  });
});

describe('EditSlotSheet — 이미 시각이 있는 슬롯', () => {
  it('게이트를 걸지 않는다(저장 가능) — 다만 시간 축은 안 건드리면 안 보낸다', () => {
    const { getByText, queryByText } = renderSheet({ ...BASE_SLOT, timeSlot: '19:00' });

    expect(queryByText(/출근 시간을 고르거나/)).toBeNull();

    fireEvent.press(getByText('저장'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(payload.input).not.toHaveProperty('startTime');
    expect(payload.input).not.toHaveProperty('timeUndecided');
  });
});
