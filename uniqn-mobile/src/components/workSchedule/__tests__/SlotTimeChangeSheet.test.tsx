/**
 * SlotTimeChangeSheet — 시간 일괄 변경 시트
 *
 * 이 파일이 지키는 것:
 *
 * 1) 🔴 **묶음을 바꾸면 앞 묶음의 시각·대상 선택이 남지 않는다.** '뒤로'로 목록에 돌아갔다가
 *    다른 묶음을 고르면 앞에서 고른 시각이 화면에 채워진 채 남아 **본인이 고른 값처럼 읽힌다** —
 *    그대로 [n명 변경]을 누르면 의도하지 않은 시각으로 실행된다. 조용한 오작동이라 테스트로 고정한다.
 *
 * 2) 기본이 전원 체크이고, 해제하면 그 사람만 요청에서 빠진다(사용자 결정 ④).
 *
 * 3) 서버로 보내는 축(공고·역할 키·출발 시각 키)이 화면이 묶은 것과 같다.
 *    갈리면 서버가 SLOT_MISMATCH 로 전체 거부한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { SlotTimeChangeSheet } from '../SlotTimeChangeSheet';
import { useUpdatePostingSlotTime } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import type { VenueDaySlot } from '@/repositories/interfaces/IWorkScheduleRepository';

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

// 휠 피커(reanimated)는 렌더하지 않고, 시각 선택은 onConfirm 을 직접 부르는 버튼으로 대체한다.
jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, onConfirm }: any) =>
      visible ? (
        <Pressable accessibilityLabel="피커확정" onPress={() => onConfirm({ hour: 9, minute: 0 })}>
          <Text>피커확정</Text>
        </Pressable>
      ) : null,
  };
});

jest.mock('@/hooks/workSchedule', () => ({
  useUpdatePostingSlotTime: jest.fn(),
}));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockMutate = jest.fn();

function slot(overrides: Partial<VenueDaySlot> & { workLogId: string }): VenueDaySlot {
  return {
    staffId: `staff-${overrides.workLogId}`,
    staffName: `이름${overrides.workLogId}`,
    staffNickname: null,
    staffPhotoUrl: null,
    role: 'dealer',
    customRole: null,
    timeSlot: '18:00',
    status: 'scheduled',
    jobPostingId: 'jp-1',
    isContainer: false,
    color: null,
    notes: null,
    ...overrides,
  };
}

const SLOTS: VenueDaySlot[] = [
  slot({ workLogId: 'a' }),
  slot({ workLogId: 'b' }),
  slot({ workLogId: 'c', timeSlot: '20:00' }),
];

beforeEach(() => {
  mockMutate.mockReset();
  (useUpdatePostingSlotTime as unknown as jest.Mock).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
  (useToastStore as unknown as jest.Mock).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ success: jest.fn(), error: jest.fn() })
  );
});

function renderSheet() {
  return render(
    <SlotTimeChangeSheet visible onClose={jest.fn()} date="2026-09-05" slots={SLOTS} />
  );
}

describe('SlotTimeChangeSheet — 묶음 선택', () => {
  it('시각·역할별로 묶어 보여준다', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('18:00 · 딜러 2명 시간 변경')).toBeTruthy();
    expect(getByLabelText('20:00 · 딜러 1명 시간 변경')).toBeTruthy();
  });
});

describe('SlotTimeChangeSheet — 대상 선택과 전송 축', () => {
  it('기본 전원 체크 상태로 서버 축과 대상 전량을 보낸다', () => {
    const { getByLabelText, getByText } = renderSheet();

    fireEvent.press(getByLabelText('18:00 · 딜러 2명 시간 변경'));
    fireEvent.press(getByText('시간 선택'));
    fireEvent.press(getByLabelText('피커확정'));
    fireEvent.press(getByLabelText('선택한 인원의 시간 변경'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]![0]).toMatchObject({
      jobPostingId: 'jp-1',
      date: '2026-09-05',
      roleKey: 'dealer',
      fromSlotKey: '18:00',
      workLogIds: ['a', 'b'],
      startTime: '09:00',
    });
  });

  it('체크를 해제한 사람은 요청에서 빠진다', () => {
    const { getByLabelText, getByText } = renderSheet();

    fireEvent.press(getByLabelText('18:00 · 딜러 2명 시간 변경'));
    fireEvent.press(getByLabelText('이름b'));
    fireEvent.press(getByText('시간 선택'));
    fireEvent.press(getByLabelText('피커확정'));
    fireEvent.press(getByLabelText('선택한 인원의 시간 변경'));

    expect(mockMutate.mock.calls[0]![0].workLogIds).toEqual(['a']);
  });
});

describe('SlotTimeChangeSheet — 묶음 전환 시 초기화', () => {
  it('🔴 앞 묶음에서 고른 시각이 다음 묶음으로 넘어가지 않는다', () => {
    const { getByLabelText, getByText, queryByLabelText } = renderSheet();

    // 18:00 묶음에서 09:00 을 고른다.
    fireEvent.press(getByLabelText('18:00 · 딜러 2명 시간 변경'));
    fireEvent.press(getByText('시간 선택'));
    fireEvent.press(getByLabelText('피커확정'));

    // 뒤로 → 다른 묶음(20:00)으로 들어간다.
    fireEvent.press(getByText('뒤로'));
    fireEvent.press(getByLabelText('20:00 · 딜러 1명 시간 변경'));

    // 시각이 비어 있어야 한다 — 채워져 있으면 '09:00' 트리거가 보이고 실행 버튼이 열린다.
    expect(getByText('시간 선택')).toBeTruthy();
    expect(queryByLabelText('선택한 인원의 시간 변경')?.props.accessibilityState?.disabled).toBe(
      true
    );

    // 시각을 안 고른 채 눌러도 mutate 는 나가지 않는다.
    fireEvent.press(getByLabelText('선택한 인원의 시간 변경'));
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
