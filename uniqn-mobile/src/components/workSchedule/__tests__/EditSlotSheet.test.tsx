/**
 * EditSlotSheet — 근무 빼기(P0-1) 테스트
 *
 * SheetModal 은 children+footer+overlay 렌더로 모킹(확인 패널은 overlay 로 렌더되므로 포함 필수),
 * 변이 훅(useUpdateSlot/useDeleteSlot)을 모킹해 다음을 검증한다:
 * (1) 빼기 버튼 → 확인 overlay 노출(즉시 삭제 아님), (2) 확정 시 슬롯 식별자+date 로 mutate,
 * (3) staffId null 이면 빼기 버튼 미렌더(가드), (4) onSuccess → 토스트+닫기, onError → 에러 토스트.
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

// 휠 피커(reanimated) 비활성 — 이 테스트는 삭제 경로만 다룬다
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

const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

const SLOT: VenueDaySlot = {
  workLogId: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  staffNickname: null,
  staffPhotoUrl: null,
  role: 'dealer',
  customRole: null,
  timeSlot: '18:00~02:00',
  status: 'scheduled',
  jobPostingId: 'jp-1',
  isContainer: true,
  color: null,
  notes: null,
};

beforeEach(() => {
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
  mockUseUpdate.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof EditSlotSheet>> = {}) {
  return render(
    <EditSlotSheet visible onClose={jest.fn()} slot={SLOT} date="2026-07-05" {...overrides} />
  );
}

it('빼기 버튼 탭 → 확인 overlay 노출(즉시 삭제 아님)', () => {
  const deleteMutate = jest.fn();
  mockUseDelete.mockReturnValue({ mutate: deleteMutate, isPending: false });

  const { getByLabelText } = renderSheet();

  fireEvent.press(getByLabelText('근무 빼기'));

  expect(deleteMutate).not.toHaveBeenCalled();
  expect(getByLabelText('근무 빼기 확정')).toBeTruthy();
});

it('확인 overlay 확정 시 슬롯 식별자 + date 로 mutate 호출', () => {
  const deleteMutate = jest.fn();
  mockUseDelete.mockReturnValue({ mutate: deleteMutate, isPending: false });

  const { getByLabelText } = renderSheet();

  fireEvent.press(getByLabelText('근무 빼기'));
  fireEvent.press(getByLabelText('근무 빼기 확정'));

  expect(deleteMutate).toHaveBeenCalledTimes(1);
  expect(deleteMutate.mock.calls[0][0]).toEqual({
    workLogId: 'wl-1',
    jobPostingId: 'jp-1',
    staffId: 'staff-1',
    date: '2026-07-05',
  });
});

it('staffId 가 없으면 빼기 버튼 미렌더(가드)', () => {
  mockUseDelete.mockReturnValue({ mutate: jest.fn(), isPending: false });

  const { queryByLabelText } = renderSheet({ slot: { ...SLOT, staffId: null } });

  expect(queryByLabelText('근무 빼기')).toBeNull();
});

it('onSuccess 콜백: 성공 토스트 + onClose 호출', () => {
  const deleteMutate = jest.fn();
  const onClose = jest.fn();
  mockUseDelete.mockReturnValue({ mutate: deleteMutate, isPending: false });

  const { getByLabelText } = renderSheet({ onClose });

  fireEvent.press(getByLabelText('근무 빼기'));
  fireEvent.press(getByLabelText('근무 빼기 확정'));

  const opts = deleteMutate.mock.calls[0][1] as { onSuccess: () => void; onError: () => void };
  opts.onSuccess();

  expect(toastSuccessSpy).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('onError 콜백: 에러 토스트 호출(시트 유지)', () => {
  const deleteMutate = jest.fn();
  const onClose = jest.fn();
  mockUseDelete.mockReturnValue({ mutate: deleteMutate, isPending: false });

  const { getByLabelText } = renderSheet({ onClose });

  fireEvent.press(getByLabelText('근무 빼기'));
  fireEvent.press(getByLabelText('근무 빼기 확정'));

  const opts = deleteMutate.mock.calls[0][1] as { onSuccess: () => void; onError: () => void };
  opts.onError();

  expect(toastErrorSpy).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
