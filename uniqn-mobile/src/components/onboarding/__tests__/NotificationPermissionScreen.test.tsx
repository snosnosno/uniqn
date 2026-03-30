import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NotificationPermissionScreen } from '../NotificationPermissionScreen';

jest.mock('@/components/icons', () => ({
  BellIcon: () => null,
  BriefcaseIcon: () => null,
  CheckCircleIcon: () => null,
  ClockIcon: () => null,
  BanknotesIcon: () => null,
  SettingsIcon: () => null,
}));

describe('NotificationPermissionScreen', () => {
  it('uses the settings action in the denied stage', async () => {
    const onRequestPermission = jest.fn().mockResolvedValue(false);
    const onOpenSettings = jest.fn().mockResolvedValue(undefined);

    const { getByText } = render(
      <NotificationPermissionScreen
        stage="settings"
        onRequestPermission={onRequestPermission}
        onOpenSettings={onOpenSettings}
        onDismiss={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('설정 열기'));
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onRequestPermission).not.toHaveBeenCalled();
  });
});
