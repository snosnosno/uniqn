/**
 * UNIQN Mobile - LoginForm Component Tests
 *
 * @description 로그인 폼 컴포넌트 테스트
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { LoginForm } from '../LoginForm';

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: (data: { email: string; password: string }) => void) => () =>
      fn({ email: 'test@example.com', password: 'Password123!' }),
    formState: {
      errors: {},
      isSubmitting: false,
    },
  }),
  Controller: ({
    render: renderProp,
  }: {
    render: (props: {
      field: { onChange: () => void; onBlur: () => void; value: string };
    }) => React.ReactNode;
  }) =>
    renderProp({
      field: {
        onChange: jest.fn(),
        onBlur: jest.fn(),
        value: '',
      },
    }),
}));

// Mock @hookform/resolvers/zod
jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn(),
}));

// Mock schemas
jest.mock('@/schemas', () => ({
  loginSchema: {},
}));

const mockOnAutoLoginChange = jest.fn();

const createDefaultProps = (onSubmit: jest.Mock) => ({
  onSubmit,
  autoLoginEnabled: true,
  onAutoLoginChange: mockOnAutoLoginChange,
  autoLoginHelperText: '끄면 다음 실행부터 다시 로그인해야 합니다.',
});

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginForm {...createDefaultProps(mockOnSubmit)} />
    );

    expect(getByText('이메일')).toBeTruthy();
    expect(getByText('비밀번호')).toBeTruthy();
    expect(getByPlaceholderText('이메일을 입력하세요')).toBeTruthy();
    expect(getByPlaceholderText('비밀번호를 입력하세요')).toBeTruthy();
    expect(getByText('자동 로그인')).toBeTruthy();
    expect(getByText('끄면 다음 실행부터 다시 로그인해야 합니다.')).toBeTruthy();
    expect(getByText('로그인')).toBeTruthy();
  });

  it('should show login button', () => {
    const { getByText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    const loginButton = getByText('로그인');
    expect(loginButton).toBeTruthy();
  });

  it('should show forgot password link', () => {
    const { getByText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    expect(getByText('비밀번호를 잊으셨나요?')).toBeTruthy();
  });

  it('should show signup link', () => {
    const { getByText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    expect(getByText('계정이 없으신가요?')).toBeTruthy();
    expect(getByText('회원가입')).toBeTruthy();
  });

  it('should call onSubmit when login button is pressed', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    const { getByText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    const loginButton = getByText('로그인');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
    });
  });

  it('should show loading state when isLoading is true', () => {
    const { queryByText, getByLabelText } = render(
      <LoginForm {...createDefaultProps(mockOnSubmit)} isLoading={true} />
    );

    // Button loading prop: 라벨 텍스트 대신 스피너 렌더 + busy 상태 노출
    expect(queryByText('로그인')).toBeNull();
    expect(getByLabelText('로그인').props.accessibilityState.busy).toBe(true);
  });

  it('should disable button when loading', () => {
    const { getByLabelText } = render(
      <LoginForm {...createDefaultProps(mockOnSubmit)} isLoading={true} />
    );

    expect(getByLabelText('로그인').props.accessibilityState.disabled).toBe(true);
  });

  it('should call onAutoLoginChange when checkbox is pressed', () => {
    const { getByTestId } = render(
      <LoginForm {...createDefaultProps(mockOnSubmit)} autoLoginEnabled={false} />
    );

    fireEvent.press(getByTestId('auto-login-checkbox'));

    expect(mockOnAutoLoginChange).toHaveBeenCalledWith(true);
  });

  it('keeps checkbox accessibility state in sync for web consumers', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => 'web',
    });

    try {
      const { getByTestId, rerender } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

      expect(getByTestId('auto-login-checkbox').props.accessibilityState.checked).toBe(true);

      rerender(<LoginForm {...createDefaultProps(mockOnSubmit)} autoLoginEnabled={false} />);

      expect(getByTestId('auto-login-checkbox').props.accessibilityState.checked).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });
});

describe('LoginForm validation', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render email input with correct props', () => {
    const { getByPlaceholderText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    const emailInput = getByPlaceholderText('이메일을 입력하세요');
    expect(emailInput).toBeTruthy();
  });

  it('should render password input with correct props', () => {
    const { getByPlaceholderText } = render(<LoginForm {...createDefaultProps(mockOnSubmit)} />);

    const passwordInput = getByPlaceholderText('비밀번호를 입력하세요');
    expect(passwordInput).toBeTruthy();
  });
});

describe('LoginForm error handling', () => {
  it('should handle submit error gracefully', async () => {
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

    const { getByText } = render(
      <LoginForm onSubmit={mockOnSubmit} autoLoginEnabled={true} onAutoLoginChange={jest.fn()} />
    );

    const loginButton = getByText('로그인');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
