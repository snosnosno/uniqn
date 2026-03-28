import React from 'react';
import { render } from '@testing-library/react-native';
import { ConfirmModal } from '../Modal';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

jest.mock('@/utils/platform', () => ({
  isWeb: false,
}));

jest.mock('@/components/ui/WebPortal', () => ({
  WebPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/icons', () => ({
  XMarkIcon: () => null,
}));

jest.mock('@/constants', () => ({
  getIconColor: () => '#111827',
}));

describe('ConfirmModal', () => {
  it('renders confirm and cancel buttons with supplied test ids and labels', () => {
    const { getByTestId, getAllByText } = render(
      <ConfirmModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        message="정말 진행하시겠습니까?"
        confirmText="확인"
        cancelText="취소"
        confirmTestID="confirm-action"
        cancelTestID="cancel-action"
      />
    );

    expect(getByTestId('confirm-action')).toBeTruthy();
    expect(getByTestId('cancel-action')).toBeTruthy();
    expect(getAllByText('확인').length).toBeGreaterThan(0);
    expect(getAllByText('취소').length).toBeGreaterThan(0);
  });
});
