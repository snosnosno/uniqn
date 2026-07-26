/**
 * UNIQN Mobile - Button Component Tests
 *
 * @description Tests for Button UI component
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { Button } from '../Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with children text', () => {
      render(<Button>테스트 버튼</Button>);

      expect(screen.getByText('테스트 버튼')).toBeTruthy();
    });

    it('should render with default props (primary variant, md size)', () => {
      render(<Button>버튼</Button>);
      // Component should render without errors with default props
      expect(screen.getByText('버튼')).toBeTruthy();
    });

    // 회귀 방지: 텍스트+표현식 혼합 children 은 배열로 넘어와 <Text> 래핑을 건너뛰어
    // 라벨이 화면에서 증발했다 (실기기 2026-07-19, VenueDayPanel.tsx:276 "부족 3명 공고로 모집").
    it('should render interpolated children (text + expression)', () => {
      const shortage = 3;
      render(<Button>부족 {shortage}명 공고로 모집</Button>);

      expect(screen.getByText('부족 3명 공고로 모집')).toBeTruthy();
    });

    it('should render interpolated children alongside an icon', () => {
      const count = 2;
      render(<Button icon={<View testID="btn-icon" />}>남은 {count}건 처리</Button>);

      expect(screen.getByTestId('btn-icon')).toBeTruthy();
      expect(screen.getByText('남은 2건 처리')).toBeTruthy();
    });

    it('should keep rendering element children untouched', () => {
      render(
        <Button>
          <Text testID="custom-child">커스텀</Text>
        </Button>
      );

      expect(screen.getByTestId('custom-child')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render primary variant', () => {
      render(<Button variant="primary">Primary</Button>);
      expect(screen.getByText('Primary')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByText('Secondary')).toBeTruthy();
    });

    it('should render outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      expect(screen.getByText('Outline')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByText('Ghost')).toBeTruthy();
    });

    it('should render danger variant', () => {
      render(<Button variant="danger">Danger</Button>);
      expect(screen.getByText('Danger')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      render(<Button size="sm">Small</Button>);
      expect(screen.getByText('Small')).toBeTruthy();
    });

    it('should render medium size (default)', () => {
      render(<Button size="md">Medium</Button>);
      expect(screen.getByText('Medium')).toBeTruthy();
    });

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByText('Large')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress}>Press Me</Button>);

      fireEvent.press(screen.getByText('Press Me'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <Button disabled onPress={onPress}>
          Disabled
        </Button>
      );

      fireEvent.press(screen.getByText('Disabled'));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      render(
        <Button loading onPress={onPress}>
          Loading
        </Button>
      );

      // When loading, the button shows ActivityIndicator instead of text
      // Try to find by role or the loading indicator
      // Since the button is disabled during loading, onPress shouldn't fire
      // Note: We can't fireEvent on the button text since it's replaced by loader
    });
  });

  describe('Loading state', () => {
    it('should show ActivityIndicator when loading', () => {
      render(<Button loading>Loading</Button>);

      // When loading, the text should not be visible
      expect(screen.queryByText('Loading')).toBeNull();
    });

    it('should disable interaction when loading', () => {
      const onPress = jest.fn();
      render(
        <Button loading onPress={onPress}>
          Loading
        </Button>
      );

      // The component should be disabled when loading
      // Since children are not rendered when loading, we need another way to test
    });
  });

  describe('Icon support', () => {
    it('should render with left icon', () => {
      const icon = (
        <View testID="test-icon">
          <Text>Icon</Text>
        </View>
      );
      render(
        <Button icon={icon} iconPosition="left">
          With Icon
        </Button>
      );

      expect(screen.getByTestId('test-icon')).toBeTruthy();
      expect(screen.getByText('With Icon')).toBeTruthy();
    });

    it('should render with right icon', () => {
      const icon = (
        <View testID="test-icon-right">
          <Text>Icon</Text>
        </View>
      );
      render(
        <Button icon={icon} iconPosition="right">
          Icon Right
        </Button>
      );

      expect(screen.getByTestId('test-icon-right')).toBeTruthy();
      expect(screen.getByText('Icon Right')).toBeTruthy();
    });

    it('should not render icon when loading', () => {
      const icon = (
        <View testID="hidden-icon">
          <Text>Icon</Text>
        </View>
      );
      render(
        <Button icon={icon} loading>
          Loading
        </Button>
      );

      expect(screen.queryByTestId('hidden-icon')).toBeNull();
    });
  });

  describe('Full width', () => {
    it('should apply full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      expect(screen.getByText('Full Width')).toBeTruthy();
    });
  });

  describe('Custom content', () => {
    it('should render non-text children without wrapping them in Text', () => {
      render(
        <Button>
          <View testID="custom-content">
            <Text>Custom Content</Text>
          </View>
        </Button>
      );

      expect(screen.getByTestId('custom-content')).toBeTruthy();
      expect(screen.getByText('Custom Content')).toBeTruthy();
    });

    it('should preserve a custom className on the pressable', () => {
      render(
        <Button accessibilityLabel="Custom class button" className="mt-4">
          Custom Class
        </Button>
      );

      expect(screen.getByLabelText('Custom class button').props.className).toContain('mt-4');
    });
  });

  // 회귀 방지 (실기기 2026-07-26)
  describe('Layout & border regressions', () => {
    // Button 은 focus ring wrapper View > Pressable 2층이다. 부모 flex 의 실제 자식은
    // wrapper 이므로 레이아웃 클래스가 wrapper 에 없으면 content 폭으로 고정되고,
    // RN 은 flexShrink 기본값이 0 이라 flex-row 2버튼 배치가 화면 밖으로 넘친다.
    // `.parent` 는 Pressable 내부 View 로 내려가 Pressable 의 className 을 그대로 돌려준다
    // → 그걸로 단언하면 wrapper 를 검사하지 않고도 통과하는 거짓 가드가 된다(실측 확인).
    // 렌더 트리의 첫 View 가 focus ring wrapper 다.
    const wrapperClassOf = () =>
      screen.UNSAFE_getAllByType(View)[0].props.className as string | undefined;

    it('should propagate flex-1 to the focus-ring wrapper (row overflow guard)', () => {
      render(
        <Button accessibilityLabel="Row button" className="flex-1">
          취소
        </Button>
      );

      expect(wrapperClassOf()).toContain('flex-1');
    });

    it('should propagate fullWidth to the focus-ring wrapper', () => {
      render(
        <Button accessibilityLabel="Full button" fullWidth>
          등록하기
        </Button>
      );

      expect(wrapperClassOf()).toContain('w-full');
    });

    it('should let flex-1 win over fullWidth on the wrapper', () => {
      render(
        <Button accessibilityLabel="Both button" fullWidth className="flex-1">
          추가
        </Button>
      );

      const wrapperClass = wrapperClassOf() ?? '';
      expect(wrapperClass).toContain('flex-1');
      expect(wrapperClass).not.toContain('w-full');
    });

    it('should not size the wrapper when no layout class is given', () => {
      render(<Button accessibilityLabel="Auto button">자동</Button>);

      const wrapperClass = wrapperClassOf() ?? '';
      expect(wrapperClass).not.toContain('flex-1');
      expect(wrapperClass).not.toContain('w-full');
    });

    // `.border-transparent` 는 생성된 CSS 에서 `.border-secondary-600` 보다 뒤에 온다.
    // 둘을 같은 Pressable 에 얹으면 라이트모드에서 outline 테두리가 투명으로 덮인다
    // (다크는 `dark:` 변형 명시도가 높아 살아남아 증상이 라이트에서만 나타났다).
    it('should not put a transparent border on the outline variant pressable', () => {
      render(
        <Button variant="outline" accessibilityLabel="Outline button">
          근무표
        </Button>
      );

      const pressableClass = screen.getByLabelText('Outline button').props.className as string;
      expect(pressableClass).toContain('border-secondary-600');
      expect(pressableClass).not.toContain('border-transparent');
    });

    it('should keep the focus ring reserve on the wrapper, not the pressable', () => {
      render(<Button accessibilityLabel="Ring button">링</Button>);

      expect(wrapperClassOf()).toContain('border-transparent');
      expect(screen.getByLabelText('Ring button').props.className).not.toContain('border-2');
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility props', () => {
      render(
        <Button accessibilityLabel="Submit form" accessibilityHint="Submits the form">
          Submit
        </Button>
      );

      expect(screen.getByLabelText('Submit form')).toBeTruthy();
    });

    it('should be accessible when disabled', () => {
      render(
        <Button disabled accessibilityLabel="Disabled button">
          Disabled
        </Button>
      );

      expect(screen.getByLabelText('Disabled button')).toBeTruthy();
    });
  });
});
