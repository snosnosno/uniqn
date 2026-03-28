/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SocialLoginButtons } from '../SocialLoginButtons';

jest.mock('expo-apple-authentication', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    AppleAuthenticationButton: ({
      onPress,
      testID,
    }: {
      onPress?: () => Promise<void>;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>Apple Button</Text>
      </Pressable>
    ),
    AppleAuthenticationButtonType: {
      SIGN_IN: 'SIGN_IN',
    },
    AppleAuthenticationButtonStyle: {
      BLACK: 'BLACK',
    },
  };
});

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    setPlatformOS('ios');
  });

  afterAll(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('renders the official Apple button when Apple login is available', () => {
    const onAppleLogin = jest.fn();

    const { getByTestId, getByText } = render(
      <SocialLoginButtons onAppleLogin={onAppleLogin} isAppleAvailable />
    );

    expect(getByTestId('apple-login-button')).toBeTruthy();
    expect(getByText('Apple Button')).toBeTruthy();
  });

  it('calls the Apple login handler when the button is pressed', () => {
    const onAppleLogin = jest.fn();

    const { getByTestId } = render(<SocialLoginButtons onAppleLogin={onAppleLogin} />);

    fireEvent.press(getByTestId('apple-login-button'));

    expect(onAppleLogin).toHaveBeenCalledTimes(1);
  });

  it('shows an availability message instead of a tappable button when Apple login is unavailable', () => {
    const { queryByTestId, getByText } = render(
      <SocialLoginButtons
        onAppleLogin={jest.fn()}
        isAppleAvailable={false}
        availabilityMessage="Apple login is not available on this device."
      />
    );

    expect(queryByTestId('apple-login-button')).toBeNull();
    expect(getByText('Apple login is not available on this device.')).toBeTruthy();
  });

  it('renders nothing outside iOS', () => {
    setPlatformOS('android');

    const { toJSON } = render(<SocialLoginButtons onAppleLogin={jest.fn()} />);

    expect(toJSON()).toBeNull();
  });
});
