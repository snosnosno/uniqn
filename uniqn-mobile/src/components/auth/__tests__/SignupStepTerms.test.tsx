import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStepTerms } from '../signup/SignupStepTerms';

const mockSetValue = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: (data: unknown) => void) => () => fn({}),
    watch: jest.fn(() => false),
    setValue: mockSetValue,
    formState: {
      errors: {},
    },
  }),
  Controller: ({
    render: renderProp,
  }: {
    render: (props: { field: { value: boolean; onChange: () => void } }) => React.ReactNode;
  }) =>
    renderProp({
      field: {
        value: false,
        onChange: jest.fn(),
      },
    }),
}));

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn(),
}));

jest.mock('@/schemas', () => ({
  signUpTermsSchema: {},
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({
    visible,
    title,
    children,
    footer,
  }: {
    visible: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return visible ? (
      <ReactNative.View>
        <ReactNative.Text>{title}</ReactNative.Text>
        {children}
        {footer}
      </ReactNative.View>
    ) : null;
  },
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return (
      <ReactNative.Pressable onPress={onPress} testID={testID}>
        <ReactNative.Text>{children}</ReactNative.Text>
      </ReactNative.Pressable>
    );
  },
}));

jest.mock('../signup/termsContent', () => {
  throw new Error('chunk load failed');
});

describe('SignupStepTerms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an error message and retry action when term content loading fails', async () => {
    const { getByTestId, getByText } = render(<SignupStepTerms onNext={jest.fn()} />);

    fireEvent.press(getByTestId('view-term-content-terms'));

    await waitFor(() => {
      expect(getByText('약관 내용을 불러오지 못했습니다. 다시 시도해주세요.')).toBeTruthy();
    });

    expect(getByTestId('retry-term-content')).toBeTruthy();

    fireEvent.press(getByTestId('retry-term-content'));

    await waitFor(() => {
      expect(mockLoggerWarn).toHaveBeenCalledTimes(2);
    });
  });
});
