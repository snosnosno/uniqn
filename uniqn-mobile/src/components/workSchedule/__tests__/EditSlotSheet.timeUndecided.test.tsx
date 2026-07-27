/**
 * EditSlotSheet — 시간 미정 슬롯 덮어쓰기 회귀 가드
 *
 * 결함: time_slot 이 비어 있는(시간 미정) 슬롯을 열면 startTime/endTime 이 화면용 기본값
 * (18:00 / 02:00)으로 채워지는데, handleSave 가 이를 무조건 전송해 **색상·메모만 고치려던
 * 저장이 8시간 근무를 확정**시켰다. 근무시간은 정산 금액의 입력값이라 금전 오염으로 이어진다.
 *
 * 계약: 사용자가 피커로 시간을 직접 고르기 전까지 저장 payload 에 startTime/endTime 을 싣지 않는다
 * (Repository.updateSlot 은 둘 다 있을 때만 time_slot 을 갱신하는 부분 업데이트).
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

it('시간 미정 슬롯을 저장해도 startTime/endTime 을 싣지 않는다(근무시간 확정 방지)', () => {
  const { getByText } = renderSheet(BASE_SLOT);

  fireEvent.press(getByText('저장'));

  expect(updateMutate).toHaveBeenCalledTimes(1);
  const payload = updateMutate.mock.calls[0][0] as {
    workLogId: string;
    input: Record<string, unknown>;
  };

  expect(payload.workLogId).toBe('wl-1');
  expect(payload.input).not.toHaveProperty('startTime');
  expect(payload.input).not.toHaveProperty('endTime');
  // 시간 외 필드는 정상 전송돼야 한다(부분 업데이트가 무력화되면 안 됨).
  expect(payload.input.staffRole).toBe('dealer');
});

it('빈 문자열 time_slot 도 미정으로 취급한다', () => {
  const { getByText } = renderSheet({ ...BASE_SLOT, timeSlot: '' });

  fireEvent.press(getByText('저장'));

  const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
  expect(payload.input).not.toHaveProperty('startTime');
  expect(payload.input).not.toHaveProperty('endTime');
});

it('시간이 정해진 슬롯은 기존대로 시간을 전송한다(무회귀 대조군)', () => {
  const { getByText } = renderSheet({ ...BASE_SLOT, timeSlot: '19:00~03:00' });

  fireEvent.press(getByText('저장'));

  const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
  expect(payload.input.startTime).toBe('19:00');
  expect(payload.input.endTime).toBe('03:00');
});

it('미정 슬롯은 시간 필드를 기본값이 아닌 "시간 선택"으로 보여주고 안내를 렌더한다', () => {
  const { getAllByText, getByText, queryByText } = renderSheet(BASE_SLOT);

  // 18:00/02:00 을 실제 값처럼 보여주면 사용자가 이미 정해진 줄 알고 그대로 저장한다.
  expect(getAllByText('시간 선택').length).toBe(2);
  expect(queryByText('오후 6:00')).toBeNull();
  expect(getByText(/근무 시간이 아직 정해지지 않았어요/)).toBeTruthy();
});
