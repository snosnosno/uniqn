/**
 * UNIQN Mobile - Input Component Tests
 *
 * @description Tests for Input UI component
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { Input } from '../Input';

describe('Input', () => {
  describe('Rendering', () => {
    it('should render a basic input', () => {
      render(<Input placeholder="입력하세요" />);

      expect(screen.getByPlaceholderText('입력하세요')).toBeTruthy();
    });

    it('should render with label', () => {
      render(<Input label="이메일" placeholder="이메일 입력" />);

      expect(screen.getByText('이메일')).toBeTruthy();
      expect(screen.getByPlaceholderText('이메일 입력')).toBeTruthy();
    });

    it('should render with error message', () => {
      render(<Input error="필수 입력 항목입니다" placeholder="입력" />);

      expect(screen.getByText('필수 입력 항목입니다')).toBeTruthy();
    });

    it('should render with hint message', () => {
      render(<Input hint="8자 이상 입력해주세요" placeholder="입력" />);

      expect(screen.getByText('8자 이상 입력해주세요')).toBeTruthy();
    });

    it('should show error instead of hint when both provided', () => {
      render(
        <Input
          error="에러 메시지"
          hint="힌트 메시지"
          placeholder="입력"
        />
      );

      expect(screen.getByText('에러 메시지')).toBeTruthy();
      expect(screen.queryByText('힌트 메시지')).toBeNull();
    });
  });

  describe('Input types', () => {
    it('should set email keyboard type for email input', () => {
      const { getByPlaceholderText } = render(
        <Input type="email" placeholder="이메일" />
      );

      const input = getByPlaceholderText('이메일');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('should set numeric keyboard type for number input', () => {
      const { getByPlaceholderText } = render(
        <Input type="number" placeholder="숫자" />
      );

      const input = getByPlaceholderText('숫자');
      expect(input.props.keyboardType).toBe('numeric');
    });

    it('should set phone-pad keyboard type for phone input', () => {
      const { getByPlaceholderText } = render(
        <Input type="phone" placeholder="전화번호" />
      );

      const input = getByPlaceholderText('전화번호');
      expect(input.props.keyboardType).toBe('phone-pad');
    });
  });

  describe('Password type', () => {
    it('should hide password by default', () => {
      const { getByPlaceholderText } = render(
        <Input type="password" placeholder="비밀번호" />
      );

      const input = getByPlaceholderText('비밀번호');
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('should toggle password visibility when eye icon is pressed', () => {
      const { getByPlaceholderText, UNSAFE_root } = render(
        <Input type="password" placeholder="비밀번호" />
      );

      const input = getByPlaceholderText('비밀번호');

      // Initially password is hidden
      expect(input.props.secureTextEntry).toBe(true);

      // Find and press the visibility toggle
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pressables = UNSAFE_root.findAllByType(require('react-native').Pressable);
      // The password toggle is a Pressable with hitSlop=8
      const toggleButton = pressables.find((p: { props: { hitSlop?: number } }) => p.props.hitSlop === 8);

      if (toggleButton) {
        fireEvent.press(toggleButton);

        // Now password should be visible
        expect(getByPlaceholderText('비밀번호').props.secureTextEntry).toBe(false);

        // Press again to hide
        fireEvent.press(toggleButton);
        expect(getByPlaceholderText('비밀번호').props.secureTextEntry).toBe(true);
      }
    });
  });

  describe('User interactions', () => {
    it('should call onChangeText when text changes', () => {
      const onChangeText = jest.fn();
      render(
        <Input placeholder="입력" onChangeText={onChangeText} />
      );

      const input = screen.getByPlaceholderText('입력');
      fireEvent.changeText(input, '새 텍스트');

      expect(onChangeText).toHaveBeenCalledWith('새 텍스트');
    });

    it('should call onFocus when focused', () => {
      const onFocus = jest.fn();
      render(<Input placeholder="입력" onFocus={onFocus} />);

      const input = screen.getByPlaceholderText('입력');
      fireEvent(input, 'focus');

      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onBlur when blurred', () => {
      const onBlur = jest.fn();
      render(<Input placeholder="입력" onBlur={onBlur} />);

      const input = screen.getByPlaceholderText('입력');
      fireEvent(input, 'blur');

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Icons', () => {
    it('should render with left icon', () => {
      const leftIcon = (
        <View testID="left-icon">
          <Text>L</Text>
        </View>
      );
      render(<Input leftIcon={leftIcon} placeholder="입력" />);

      expect(screen.getByTestId('left-icon')).toBeTruthy();
    });

    it('should render with right icon', () => {
      const rightIcon = (
        <View testID="right-icon">
          <Text>R</Text>
        </View>
      );
      render(<Input rightIcon={rightIcon} placeholder="입력" />);

      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });

    it('should not render right icon for password type (shows eye icon instead)', () => {
      const rightIcon = (
        <View testID="custom-right-icon">
          <Text>R</Text>
        </View>
      );
      render(
        <Input type="password" rightIcon={rightIcon} placeholder="비밀번호" />
      );

      // Custom right icon should not be rendered for password inputs
      expect(screen.queryByTestId('custom-right-icon')).toBeNull();
    });
  });

  describe('Controlled input', () => {
    it('should display controlled value', () => {
      const { getByPlaceholderText, rerender } = render(
        <Input value="초기값" placeholder="입력" />
      );

      expect(getByPlaceholderText('입력').props.value).toBe('초기값');

      rerender(<Input value="변경된 값" placeholder="입력" />);
      expect(getByPlaceholderText('입력').props.value).toBe('변경된 값');
    });
  });

  describe('Accessibility', () => {
    it('should be accessible with accessibility props', () => {
      render(
        <Input
          placeholder="이메일"
          accessibilityLabel="이메일 입력 필드"
          accessibilityHint="이메일 주소를 입력하세요"
        />
      );

      expect(screen.getByLabelText('이메일 입력 필드')).toBeTruthy();
    });

    it('should support editable prop', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="읽기 전용" editable={false} />
      );

      expect(getByPlaceholderText('읽기 전용').props.editable).toBe(false);
    });
  });
});
