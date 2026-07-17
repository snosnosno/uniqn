/**
 * WorkTimeEditor 익일/장시간 동작 테스트 (정산 = 금전 직결)
 *
 * @description 차단 검증 제거 → 자동 익일 판정 + 12시간 초과 비차단 강조 배너.
 * 종료<시작은 오류가 아니라 자동 익일이며, 종료==시작만 저장을 막는다.
 * 저장 시 퇴근 Date가 출근 이후(익일)로 보정되어 음수 근무시간이 저장되지 않는지도 검증한다.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { WorkTimeEditor } from '../WorkTimeEditor';
import type { WorkLog } from '@/types';

const mockUseUserProfile = jest.fn((_params?: unknown) => ({
  displayName: '김스노(스노)',
  profilePhotoURL: 'https://example.com/staff.jpg',
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: (params: unknown) => mockUseUserProfile(params),
}));

jest.mock('../../../ui/Avatar', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Avatar: ({ name, source }: { name?: string; source?: string }) => (
      <Text>{`avatar:${name ?? ''}:${source ?? ''}`}</Text>
    ),
  };
});

// 예정시간(timeSlot) 폴백을 제거해 퇴근 초기값을 "미정"으로 두고, 피커로 직접 입력하는 흐름을 검증한다.
jest.mock('@/utils/date', () => ({
  formatDate: () => '2026-03-30',
  parseTimeSlotToDate: () => ({ startTime: null, endTime: null }),
}));

jest.mock('../../../ui/SheetModal', () => ({
  SheetModal: ({
    visible,
    children,
    footer,
    overlay,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    overlay?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
        {overlay}
      </>
    ) : null,
}));

jest.mock('../../../ui/ModalFooterButtons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    ModalFooterButtons: ({
      onCancel,
      onSubmit,
      submitDisabled,
    }: {
      onCancel: () => void;
      onSubmit: () => void;
      submitDisabled?: boolean;
    }) => (
      <View>
        <Pressable testID="cancel-button" onPress={onCancel}>
          <Text>취소</Text>
        </Pressable>
        <Pressable
          testID="submit-button"
          onPress={onSubmit}
          accessibilityState={{ disabled: Boolean(submitDisabled) }}
        >
          <Text>확인</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('../../../ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../TimeInputField', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    TimeInputField: ({
      label,
      value,
      isUndefined,
      onUndefinedChange,
      onOpenPicker,
    }: {
      label: string;
      value?: string;
      isUndefined?: boolean;
      onUndefinedChange?: (value: boolean) => void;
      onOpenPicker: () => void;
    }) => (
      <View>
        <Text>{label}</Text>
        <Text testID={`undef-${label}`}>{isUndefined ? 'undefined' : 'defined'}</Text>
        <Text testID={`value-${label}`}>{value ?? ''}</Text>
        <Pressable testID={`toggle-${label}`} onPress={() => onUndefinedChange?.(!isUndefined)}>
          <Text>toggle</Text>
        </Pressable>
        <Pressable testID={`picker-${label}`} onPress={onOpenPicker}>
          <Text>picker</Text>
        </Pressable>
      </View>
    ),
  };
});

// 피커가 확정할 시각을 테스트에서 주입하기 위한 가변 홀더 (jest 팩토리는 mock 접두 변수 참조 허용).
const mockPickerValue = { hour: 9, minute: 0 };

jest.mock('../../../ui/TimeWheelPicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    TimeWheelPicker: ({
      visible,
      onConfirm,
      title,
    }: {
      visible: boolean;
      onConfirm: (value: { hour: number; minute: number }) => void;
      title: string;
    }) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          <Pressable testID="confirm-time" onPress={() => onConfirm({ ...mockPickerValue })}>
            <Text>confirm</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

jest.mock('../../../icons', () => ({
  AlertCircleIcon: () => null,
}));

function createWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    staffName: '스태프',
    jobPostingId: 'job-1',
    date: '2026-03-30',
    status: 'scheduled',
    role: 'dealer',
    // timeSlot 미지정 → 퇴근 초기값 "미정"
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkLog;
}

/** 출근 18:00 고정 workLog 렌더 후, 퇴근 시각을 피커로 선택한다. */
function renderWithEndTime(
  hour: number,
  minute: number,
  onSave: jest.Mock = jest.fn(),
  startHour = 18
) {
  const utils = render(
    <WorkTimeEditor
      workLog={createWorkLog({
        checkInTime: new Date(2026, 2, 30, startHour, 0),
        checkOutTime: null,
      })}
      visible
      onClose={jest.fn()}
      onSave={onSave}
    />
  );
  fireEvent.press(utils.getByTestId('picker-퇴근 시간'));
  mockPickerValue.hour = hour;
  mockPickerValue.minute = minute;
  fireEvent.press(utils.getByTestId('confirm-time'));
  return utils;
}

describe('WorkTimeEditor - 자동 익일 / 장시간 강조', () => {
  beforeEach(() => {
    mockUseUserProfile.mockClear();
    mockPickerValue.hour = 9;
    mockPickerValue.minute = 0;
  });

  it('종료<시작(0~23 입력, 18:00→02:00)이면 익일로 계산하고 8시간 표시 + 저장 활성', async () => {
    const { getByTestId, getByText, queryByText } = renderWithEndTime(2, 0);

    // 익일 안내 배너 + 8시간
    await waitFor(() => {
      expect(getByText(/익일 02:00 퇴근으로 계산돼요/)).toBeTruthy();
    });
    expect(getByText('8시간')).toBeTruthy();

    // 저장 활성
    expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(false);

    // 차단 오류 문구가 더 이상 나오지 않는다
    expect(queryByText(/출근보다 빨라요/)).toBeNull();
    expect(queryByText(/25:00 형식/)).toBeNull();
  });

  it('저장 시 퇴근 Date가 출근 이후(익일)로 보정되어 음수 근무시간이 저장되지 않는다', async () => {
    const onSave = jest.fn();
    const { getByTestId } = renderWithEndTime(2, 0, onSave);

    await waitFor(() => {
      expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(false);
    });
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const { startTime, endTime } = onSave.mock.calls[0][0] as {
      startTime: Date;
      endTime: Date;
    };
    // 금전 안전: 퇴근 > 출근이며 정확히 8시간
    expect(endTime.getTime()).toBeGreaterThan(startTime.getTime());
    expect(endTime.getTime() - startTime.getTime()).toBe(8 * 60 * 60 * 1000);
  });

  it('12시간 초과(18:00→07:00=13h)면 비차단 강조 배너를 보여주되 저장은 가능', async () => {
    const { getByTestId, getByText } = renderWithEndTime(7, 0);

    await waitFor(() => {
      expect(getByText(/근무 시간이 13시간이에요\. 맞는지 확인해주세요/)).toBeTruthy();
    });
    // 12시간 초과여도 저장은 막지 않는다(비차단)
    expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(false);
  });

  it('출근==퇴근(09:00→09:00)이면 차단 오류를 보여주고 저장을 막는다', async () => {
    const { getByTestId, getByText } = renderWithEndTime(9, 0, jest.fn(), 9);

    await waitFor(() => {
      expect(getByText(/출근과 퇴근 시간이 같아요/)).toBeTruthy();
    });
    expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(true);
  });
});
