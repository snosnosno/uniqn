/**
 * EditSlotSheet — 이미 저장된 범위 데이터(레거시) 취급 테스트
 *
 * 예정 종료 시각 저장은 폐지됐다(§K). 하지만 이 시트가 예전에 만든 `'18:00 - 02:00'` 같은
 * 범위 값은 DB 에 남아 있다. 그걸 어떻게 다루느냐가 이 파일의 대상이다.
 *
 * 고정하는 계약:
 *  1. 범위 슬롯을 열면 **출근 예정(시작)만** 보여주고, 종료가 사라진 이유를 밝힌다
 *     (설명 없이 사라지면 사용자는 데이터가 날아간 줄 안다).
 *  2. 시간 축을 건드리지 않고 저장하면 **시간을 아예 보내지 않는다** — 저장된 범위가
 *     조용히 단일값으로 잘리지 않는다. 색상·메모만 고치는 저장이 데이터를 바꾸면 안 된다.
 *  3. 종료 입력·익일 프리뷰·시작==종료 가드는 더 이상 존재하지 않는다(모델에서 제거됨).
 *
 * 이전 파일명: EditSlotSheet.overnight.test.tsx — 익일 프리뷰가 사라지면서 대상이 바뀌었다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { EditSlotSheet } from '../EditSlotSheet';
import { useUpdateSlot, useDeleteSlot } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import type { VenueDaySlot } from '@/repositories/workSchedule';

// 무거운 의존(SheetModal=RNModal+reanimated) 모킹: visible 일 때 children+footer+overlay 렌더
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

const updateMutate = jest.fn();

const BASE_SLOT: VenueDaySlot = {
  workLogId: 'wl-1',
  staffId: 'staff-1',
  staffName: '김하나',
  staffNickname: null,
  staffPhotoUrl: null,
  role: 'dealer',
  customRole: null,
  timeSlot: '18:00 - 02:00',
  status: 'scheduled',
  jobPostingId: 'jp-1',
  isContainer: true,
  color: null,
  notes: null,
};

beforeEach(() => {
  updateMutate.mockReset();
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: jest.fn(), error: jest.fn(), info: jest.fn() })
  );
  mockUseUpdate.mockReturnValue({ mutate: updateMutate, isPending: false });
  mockUseDelete.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

function renderSheet(overrides: Partial<VenueDaySlot> = {}) {
  return render(
    <EditSlotSheet
      visible
      onClose={jest.fn()}
      slot={{ ...BASE_SLOT, ...overrides }}
      date="2026-07-17"
    />
  );
}

describe('EditSlotSheet — 레거시 범위 슬롯', () => {
  it('시작만 출근 예정으로 보여주고 종료 입력·익일 프리뷰는 없다', () => {
    const { getByText, queryByText } = renderSheet();

    expect(getByText('출근 예정')).toBeTruthy();
    expect(getByText('오후 6:00')).toBeTruthy();
    // 종료 축은 모델에서 사라졌다 — 필드도, 익일 프리뷰도, 시작==종료 가드도 없다.
    expect(queryByText('종료')).toBeNull();
    expect(queryByText(/익일/)).toBeNull();
    expect(queryByText(/시작과 종료 시간이 같아요/)).toBeNull();
  });

  it('종료가 더 이상 쓰이지 않는다는 사실을 밝힌다(조용한 소실 방지)', () => {
    const { getByText } = renderSheet();

    expect(getByText(/예정 종료 시간은 더 이상 쓰지 않아요/)).toBeTruthy();
  });

  it('시간을 안 건드리고 저장하면 시간 축을 보내지 않는다(저장된 범위 보존)', () => {
    const { getByText } = renderSheet();

    fireEvent.press(getByText('저장'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(payload.input).not.toHaveProperty('startTime');
    expect(payload.input).not.toHaveProperty('timeUndecided');
    // 시간 외 필드는 정상 전송돼야 한다(부분 업데이트가 무력화되면 안 됨).
    expect(payload.input.staffRole).toBe('dealer');
  });

  it("'미정'을 체크했다 **다시 해제**하면 원래대로 아무것도 보내지 않는다", () => {
    // 되돌리기가 되돌리기여야 한다. dirty 를 한 번 true 로 굳히면, 마음을 바꾼 사용자에게도
    // 저장 시 startTime 이 실려 나가 레거시 범위가 조용히 잘린다.
    const { getByText, getByLabelText } = renderSheet();

    fireEvent.press(getByLabelText('출근 예정 미정'));
    fireEvent.press(getByLabelText('출근 예정 미정'));
    fireEvent.press(getByText('저장'));

    const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(payload.input).not.toHaveProperty('startTime');
    expect(payload.input).not.toHaveProperty('timeUndecided');
  });

  it("'미정'을 명시 선택하면 미정을 보낸다(레거시 범위를 사용자 의사로 비운다)", () => {
    const { getByText, getByLabelText } = renderSheet();

    fireEvent.press(getByLabelText('출근 예정 미정'));
    fireEvent.press(getByText('저장'));

    const payload = updateMutate.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(payload.input.timeUndecided).toBe(true);
    expect(payload.input).not.toHaveProperty('startTime');
  });
});
