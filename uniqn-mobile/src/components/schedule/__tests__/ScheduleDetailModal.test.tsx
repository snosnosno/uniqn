import React from 'react';
import { render } from '@testing-library/react-native';
import { ScheduleDetailModal } from '../ScheduleDetailModal';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    Modal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
    Badge: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = () => <View />;

  return {
    XMarkIcon: MockIcon,
    DocumentIcon: MockIcon,
    ClockIcon: MockIcon,
    BanknotesIcon: MockIcon,
    AlertTriangleIcon: MockIcon,
    ChevronLeftIcon: MockIcon,
    ChevronRightIcon: MockIcon,
    CalendarIcon: MockIcon,
  };
});

jest.mock('../tabs', () => ({
  InfoTab: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>info-tab</Text>;
  },
  WorkTab: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>work-tab</Text>;
  },
  SettlementTab: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>settlement-tab</Text>;
  },
}));

jest.mock('@/components/employer/ReportModal', () => ({
  ReportModal: () => null,
}));

jest.mock('@/services/auth', () => ({
  getUserProfile: jest.fn(),
}));

jest.mock('@/services/admin', () => ({
  createReport: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({ showConfirm: jest.fn() }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('ScheduleDetailModal', () => {
  it('hides the duplicate cancellation request action while review is pending', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      applicationId: 'app-1',
      isCancellationPending: true,
    }) as unknown as ScheduleEvent;

    const { queryByText, getByText } = render(
      <ScheduleDetailModal
        schedule={schedule}
        visible={true}
        onClose={jest.fn()}
        onRequestCancellation={jest.fn()}
      />
    );

    expect(getByText('info-tab')).toBeTruthy();
    expect(queryByText('취소 요청')).toBeNull();
  });

  it('shows the cancellation request action again after rejection clears the pending flag', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      applicationId: 'app-1',
    }) as unknown as ScheduleEvent;

    const { getByText } = render(
      <ScheduleDetailModal
        schedule={schedule}
        visible={true}
        onClose={jest.fn()}
        onRequestCancellation={jest.fn()}
      />
    );

    expect(getByText('info-tab')).toBeTruthy();
    expect(getByText('취소 요청')).toBeTruthy();
  });
});
