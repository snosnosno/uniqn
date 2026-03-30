import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReportModal } from '../ReportModal';

const mockAddToast = jest.fn();

jest.mock('../../ui/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));

jest.mock('../../ui/Button', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Button: ({ children, onPress, disabled, accessibilityLabel }: any) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockIcon = () => <View />;

  return {
    AlertTriangleIcon: MockIcon,
    CheckIcon: MockIcon,
    AlertCircleIcon: MockIcon,
    UserIcon: MockIcon,
    BriefcaseIcon: MockIcon,
  };
});

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

describe('ReportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a validation toast instead of failing silently when submitted without a report type', async () => {
    const { getByText } = render(
      <ReportModal
        visible={true}
        onClose={jest.fn()}
        mode="employee"
        target={{ id: 'owner-1', name: '구인자' }}
        jobPostingId="job-1"
        onSubmit={jest.fn()}
      />
    );

    fireEvent.press(getByText('신고하기'));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '신고 유형을 선택해주세요.',
      });
    });
  });
});
