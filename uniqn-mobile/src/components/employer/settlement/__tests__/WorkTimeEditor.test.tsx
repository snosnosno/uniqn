import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
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

jest.mock('@/utils/date', () => ({
  formatDate: () => '2026-03-30',
  parseTimeSlotToDate: () => ({
    startTime: new Date('2026-03-30T09:00:00'),
    endTime: new Date('2026-03-30T18:00:00'),
  }),
}));

jest.mock('../../../ui/SheetModal', () => ({
  SheetModal: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
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
      isUndefined,
      onUndefinedChange,
      onOpenPicker,
    }: {
      label: string;
      isUndefined?: boolean;
      onUndefinedChange?: (value: boolean) => void;
      onOpenPicker: () => void;
    }) => (
      <View>
        <Text>{label}</Text>
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
          <Pressable
            testID="confirm-time"
            onPress={() => onConfirm({ hour: title.includes('퇴근') ? 18 : 10, minute: 30 })}
          >
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
    timeSlot: '09:00~18:00',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  } as WorkLog;
}

describe('WorkTimeEditor', () => {
  beforeEach(() => {
    mockUseUserProfile.mockClear();
  });

  it('enables saving when a previously undefined start time is set', async () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <WorkTimeEditor
        workLog={createWorkLog({ checkInTime: null, checkOutTime: null })}
        visible={true}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.press(getByTestId('toggle-출근 시간'));
    fireEvent.press(getByTestId('picker-출근 시간'));
    fireEvent.press(getByTestId('confirm-time'));

    await waitFor(() => {
      expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(false);
    });

    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.any(Date),
        })
      );
    });
  });

  it('allows saving when an existing end time is switched back to undefined', async () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <WorkTimeEditor
        workLog={createWorkLog({
          checkInTime: new Date('2026-03-30T09:00:00'),
          checkOutTime: new Date('2026-03-30T18:00:00'),
        })}
        visible={true}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.press(getByTestId('toggle-퇴근 시간'));

    await waitFor(() => {
      expect(getByTestId('submit-button').props.accessibilityState.disabled).toBe(false);
    });

    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          endTime: null,
        })
      );
    });
  });

  it('uses the shared profile identity for the staff header', () => {
    const { getByText } = render(
      <WorkTimeEditor
        workLog={createWorkLog({
          staffName: '레거시 이름',
          staffNickname: '레거시닉',
          staffPhotoURL: 'https://example.com/legacy.jpg',
        })}
        visible={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(mockUseUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        fallbackName: '레거시 이름',
        fallbackNickname: '레거시닉',
        fallbackPhotoURL: 'https://example.com/legacy.jpg',
      })
    );
    expect(getByText('avatar:김스노(스노):https://example.com/staff.jpg')).toBeTruthy();
  });
});
