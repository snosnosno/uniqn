import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStepTerms } from '../signup/SignupStepTerms';

const mockSetValue = jest.fn();
const mockLoggerWarn = jest.fn();
const mockWatchValues: Record<string, boolean> = {};

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: (data: unknown) => void) => () => fn({}),
    watch: (key: string) => mockWatchValues[key] ?? false,
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
    disabled,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return (
      <ReactNative.Pressable
        onPress={onPress}
        testID={testID}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
      >
        <ReactNative.Text>{children}</ReactNative.Text>
      </ReactNative.Pressable>
    );
  },
}));

jest.mock('../signup/termsContent', () => {
  throw new Error('chunk load failed');
});

function resetWatchValues() {
  for (const key of Object.keys(mockWatchValues)) {
    delete mockWatchValues[key];
  }
}

describe('SignupStepTerms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWatchValues();
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

  // T2 — P0 제3자 제공 동의: 필수 3개 중 1개라도 빠지면 다음 버튼 disabled
  it('disables 다음 button when thirdPartyAgreed is unchecked', () => {
    Object.assign(mockWatchValues, {
      termsAgreed: true,
      privacyAgreed: true,
      thirdPartyAgreed: false,
      marketingAgreed: false,
    });

    const onNext = jest.fn();
    const { getByText } = render(<SignupStepTerms onNext={onNext} />);
    const nextButton = getByText('다음').parent;

    fireEvent.press(nextButton!);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('enables 다음 button when all required 3 (terms + privacy + thirdParty) checked', () => {
    Object.assign(mockWatchValues, {
      termsAgreed: true,
      privacyAgreed: true,
      thirdPartyAgreed: true,
      marketingAgreed: false,
    });

    const onNext = jest.fn();
    const { getByText } = render(<SignupStepTerms onNext={onNext} />);
    const nextButton = getByText('다음').parent;

    fireEvent.press(nextButton!);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('전체 동의 클릭 시 4개 모두 setValue 호출 (thirdPartyAgreed 포함)', () => {
    const { getByLabelText } = render(<SignupStepTerms onNext={jest.fn()} />);
    fireEvent.press(getByLabelText('전체 동의하기'));

    const calls = mockSetValue.mock.calls.map((args) => args[0]);
    expect(calls).toContain('termsAgreed');
    expect(calls).toContain('privacyAgreed');
    expect(calls).toContain('thirdPartyAgreed');
    expect(calls).toContain('marketingAgreed');
  });
});
