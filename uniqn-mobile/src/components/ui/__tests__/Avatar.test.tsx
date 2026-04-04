import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

const mockExpoImage = jest.fn();

jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => {
    const ReactNative = jest.requireActual('react-native');
    mockExpoImage(props);
    return (
      <ReactNative.View testID="expo-image">
        <ReactNative.Text>mock-image</ReactNative.Text>
      </ReactNative.View>
    );
  },
}));

describe('Avatar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockExpoImage.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('retries the same image source after a transient load error', () => {
    render(<Avatar source="https://example.com/avatar.jpg" name="Kim" size="md" />);

    expect(screen.getByTestId('expo-image')).toBeTruthy();

    const firstRenderProps = mockExpoImage.mock.calls.at(-1)?.[0] as {
      onError?: () => void;
    };

    act(() => {
      firstRenderProps.onError?.();
    });

    expect(screen.queryByTestId('expo-image')).toBeNull();
    expect(screen.getByText('K')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId('expo-image')).toBeTruthy();
    expect(mockExpoImage).toHaveBeenCalledTimes(2);
  });

  it('stops retrying after the configured retry budget is exhausted', () => {
    render(<Avatar source="https://example.com/avatar.jpg" name="Kim" size="md" />);

    const firstRenderProps = mockExpoImage.mock.calls.at(-1)?.[0] as {
      onError?: () => void;
    };

    act(() => {
      firstRenderProps.onError?.();
      jest.advanceTimersByTime(1500);
    });

    const secondRenderProps = mockExpoImage.mock.calls.at(-1)?.[0] as {
      onError?: () => void;
    };

    act(() => {
      secondRenderProps.onError?.();
      jest.advanceTimersByTime(4000);
    });

    const thirdRenderProps = mockExpoImage.mock.calls.at(-1)?.[0] as {
      onError?: () => void;
    };

    act(() => {
      thirdRenderProps.onError?.();
      jest.advanceTimersByTime(30000);
    });

    expect(screen.getByTestId('expo-image')).toBeTruthy();
    expect(mockExpoImage).toHaveBeenCalledTimes(4);

    const fourthRenderProps = mockExpoImage.mock.calls.at(-1)?.[0] as {
      onError?: () => void;
    };

    act(() => {
      fourthRenderProps.onError?.();
      jest.advanceTimersByTime(60000);
    });

    expect(screen.queryByTestId('expo-image')).toBeNull();
    expect(screen.getByText('K')).toBeTruthy();
    expect(mockExpoImage).toHaveBeenCalledTimes(4);
  });
});
