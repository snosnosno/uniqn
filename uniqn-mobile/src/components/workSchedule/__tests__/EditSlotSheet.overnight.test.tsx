/**
 * EditSlotSheet — 익일 프리뷰 + 시작==종료 저장 차단 테스트(Task 3)
 *
 * 기존 EditSlotSheet.test.tsx 의 모킹 방식(SheetModal=children+footer+overlay 렌더,
 * TimeWheelPicker=null, useUpdateSlot/useDeleteSlot, useToastStore)을 그대로 따른다.
 * 검증: (1) 18:00~02:00 슬롯이면 익일 프리뷰(총 8시간)를 보여준다.
 *       (2) 시작==종료면 오류 안내 노출 + 저장 눌러도 mutate 미호출 + 익일 라벨 미노출.
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

// 휠 피커(reanimated) 비활성 — 이 테스트는 프리뷰/저장 가드만 다룬다
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

describe('EditSlotSheet 자정 처리', () => {
  it('18:00~02:00 슬롯이면 익일 프리뷰(총 8시간)를 보여준다', () => {
    const { getByText } = renderSheet();
    expect(getByText(/익일/)).toBeTruthy();
    expect(getByText(/8시간/)).toBeTruthy();
  });

  it('시작과 종료가 같으면 저장이 비활성화되고 오류 안내가 뜬다', () => {
    const { getByText, queryByText } = renderSheet({ timeSlot: '18:00 - 18:00' });
    expect(getByText(/시작과 종료 시간이 같아요/)).toBeTruthy();
    // 저장 버튼 비활성(눌러도 mutate 미호출)
    fireEvent.press(getByText('저장'));
    expect(updateMutate).not.toHaveBeenCalled();
    expect(queryByText(/익일/)).toBeNull();
  });
});
