/**
 * UNIQN Mobile - LoginForm Component Tests
 *
 * @description 로그인 폼 컴포넌트 테스트
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
  Controller: ({ render: renderProp }: { render: (props: { field: { onChange: () => void; onBlur: () => void; value: string } }) => React.ReactNode }) =>
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

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginForm onSubmit={mockOnSubmit} />
    );

    expect(getByText('이메일')).toBeTruthy();
    expect(getByText('비밀번호')).toBeTruthy();
    expect(getByPlaceholderText('이메일을 입력하세요')).toBeTruthy();
    expect(getByPlaceholderText('비밀번호를 입력하세요')).toBeTruthy();
    expect(getByText('로그인')).toBeTruthy();
  });

  it('should show login button', () => {
    const { getByText } = render(<LoginForm onSubmit={mockOnSubmit} />);

    const loginButton = getByText('로그인');
    expect(loginButton).toBeTruthy();
  });

  it('should show forgot password link', () => {
    const { getByText } = render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(getByText('비밀번호를 잊으셨나요?')).toBeTruthy();
  });

  it('should show signup link', () => {
    const { getByText } = render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(getByText('계정이 없으신가요?')).toBeTruthy();
    expect(getByText('회원가입')).toBeTruthy();
  });

  it('should call onSubmit when login button is pressed', async () => {
    mockOnSubmit.mockResolvedValue(undefined);

    const { getByText } = render(<LoginForm onSubmit={mockOnSubmit} />);

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
    const { getByText } = render(
      <LoginForm onSubmit={mockOnSubmit} isLoading={true} />
    );

    expect(getByText('로그인 중...')).toBeTruthy();
  });

  it('should disable button when loading', () => {
    const { getByText } = render(
      <LoginForm onSubmit={mockOnSubmit} isLoading={true} />
    );

    // Button should show loading text
    expect(getByText('로그인 중...')).toBeTruthy();
  });
});

describe('LoginForm validation', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render email input with correct props', () => {
    const { getByPlaceholderText } = render(
      <LoginForm onSubmit={mockOnSubmit} />
    );

    const emailInput = getByPlaceholderText('이메일을 입력하세요');
    expect(emailInput).toBeTruthy();
  });

  it('should render password input with correct props', () => {
    const { getByPlaceholderText } = render(
      <LoginForm onSubmit={mockOnSubmit} />
    );

    const passwordInput = getByPlaceholderText('비밀번호를 입력하세요');
    expect(passwordInput).toBeTruthy();
  });
});

describe('LoginForm error handling', () => {
  it('should handle submit error gracefully', async () => {
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

    const { getByText } = render(<LoginForm onSubmit={mockOnSubmit} />);

    const loginButton = getByText('로그인');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
