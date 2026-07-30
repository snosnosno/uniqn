/**
 * VenueDayPanel — 근무 수정 시트 → 실제 출퇴근 편집기 인계 순서 (2-B)
 *
 * 예정(time_slot)과 실적(check_in/out) 편집 입구를 근무 수정 시트 하나로 통합하면서,
 * 시트 안의 '출퇴근 시간 수정'이 WorkTimeEditor 를 연다. 그런데 **둘 다 RN Modal** 이라
 * 겹쳐 띄우면 iOS 터치가 먹통이 된다(#186/#188 사고 이력).
 *
 * 고정하는 계약:
 *  1. 인계 시 시트를 **먼저 닫고** 편집기를 연다 — 두 모달이 동시에 열려 있으면 안 된다.
 *  2. 열기에 실패하면(정산 완료로 잠김) 시트를 닫지 않는다. 닫아버리면 사용자는
 *     아무 일도 안 일어난 채 맥락만 잃는다.
 *  3. 컨테이너 직속 배치가 아니면 실적 자체를 넘기지 않는다(공고 스팬 슬롯은 여기서 해소 불가).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueDayPanel } from '../VenueDayPanel';
import { useSetVenueSoftTarget, useVenueDaySlots } from '@/hooks/workSchedule';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { STATUS } from '@/constants';

jest.mock('@/hooks/workSchedule', () => ({
  useSetVenueSoftTarget: jest.fn(),
  useVenueDaySlots: jest.fn(),
}));
jest.mock('@/hooks/useConfirmedStaff', () => ({ useConfirmedStaff: jest.fn() }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useUser: jest.fn(() => ({ uid: 'u1' })) }));
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));

const SLOT = {
  workLogId: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  staffNickname: null,
  staffPhotoUrl: null,
  role: 'dealer',
  customRole: null,
  timeSlot: '19:00',
  status: 'scheduled',
  jobPostingId: 'v1',
  isContainer: true,
  color: null,
  notes: null,
};

// 상세 목: 슬롯 행 탭(=근무 수정 시트 열기)을 버튼 하나로 대체.
jest.mock('../VenueDayDetail', () => {
  const { Text, Pressable } = require('react-native');
  return {
    VenueDayDetail: ({ onSlotPress }: { onSlotPress?: (s: unknown) => void }) => (
      <Pressable
        onPress={() => onSlotPress?.((globalThis as Record<string, unknown>).__TEST_SLOT__)}
      >
        <Text>슬롯 열기</Text>
      </Pressable>
    ),
  };
});

// 시트 목: 열림 여부를 문자열로 드러내고, 실적 수정 입구를 버튼으로 노출.
jest.mock('../EditSlotSheet', () => {
  const { Text, Pressable, View } = require('react-native');
  return {
    EditSlotSheet: ({
      visible,
      onEditAttendance,
    }: {
      visible: boolean;
      onEditAttendance?: () => void;
    }) =>
      visible ? (
        <View>
          <Text>시트 열림</Text>
          {onEditAttendance ? (
            <Pressable onPress={onEditAttendance}>
              <Text>출퇴근 시간 수정</Text>
            </Pressable>
          ) : (
            <Text>실적 입구 없음</Text>
          )}
        </View>
      ) : null,
  };
});

// 편집기 목: 열림 여부만 드러낸다.
jest.mock('@/components/employer/settlement/WorkTimeEditor', () => {
  const { Text } = require('react-native');
  return {
    WorkTimeEditor: ({ visible }: { visible: boolean }) =>
      visible ? <Text>편집기 열림</Text> : null,
  };
});

const mockUseSingle = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockUseConfirmedStaff = useConfirmedStaff as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

const toastErrorSpy = jest.fn();

/** 컨테이너 확정 스태프 1명(= 슬롯의 workLogId 와 같은 id)을 세팅. */
function setConfirmed(payrollStatus?: string) {
  mockUseConfirmedStaff.mockReturnValue({
    grouped: [
      {
        staff: [
          {
            id: 'wl-1',
            staffId: 'staff-1',
            staffName: '김딜러',
            workLog: { id: 'wl-1', date: '2026-07-05' },
            checkInTime: '2026-07-05T19:04:00.000Z',
            checkOutTime: null,
            payrollStatus,
          },
        ],
      },
    ],
    updateWorkTime: jest.fn(),
    isUpdatingTime: false,
    isLoading: false,
  });
}

beforeEach(() => {
  toastErrorSpy.mockReset();
  (globalThis as Record<string, unknown>).__TEST_SLOT__ = SLOT;
  mockUseSingle.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseDaySlots.mockReturnValue({ data: [SLOT] });
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: jest.fn(), error: toastErrorSpy, info: jest.fn() })
  );
  setConfirmed(undefined);
});

function renderPanel() {
  return render(<VenueDayPanel venueId="v1" date="2026-07-05" dateLabel="7월 5일 (일)" />);
}

describe('VenueDayPanel — 예정→실적 편집기 인계', () => {
  it('인계 시 시트를 먼저 닫고 편집기를 연다(두 모달 동시 노출 금지)', () => {
    const api = renderPanel();

    fireEvent.press(api.getByText('슬롯 열기'));
    expect(api.getByText('시트 열림')).toBeTruthy();
    expect(api.queryByText('편집기 열림')).toBeNull();

    fireEvent.press(api.getByText('출퇴근 시간 수정'));

    expect(api.queryByText('시트 열림')).toBeNull();
    expect(api.getByText('편집기 열림')).toBeTruthy();
  });

  it('정산 완료로 잠긴 근무는 편집기를 열지 않고 시트도 닫지 않는다', () => {
    setConfirmed(STATUS.PAYROLL.COMPLETED);
    const api = renderPanel();

    fireEvent.press(api.getByText('슬롯 열기'));
    fireEvent.press(api.getByText('출퇴근 시간 수정'));

    expect(api.getByText('시트 열림')).toBeTruthy();
    expect(api.queryByText('편집기 열림')).toBeNull();
    expect(toastErrorSpy).toHaveBeenCalled();
  });

  it('컨테이너 직속 배치가 아니면 실적 입구를 아예 넘기지 않는다', () => {
    (globalThis as Record<string, unknown>).__TEST_SLOT__ = { ...SLOT, isContainer: false };
    const api = renderPanel();

    fireEvent.press(api.getByText('슬롯 열기'));

    expect(api.getByText('실적 입구 없음')).toBeTruthy();
  });
});
