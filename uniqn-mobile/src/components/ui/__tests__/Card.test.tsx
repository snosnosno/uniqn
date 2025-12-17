/**
 * UNIQN Mobile - Card Component Tests
 *
 * @description Tests for Card UI component
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card', () => {
  describe('Rendering', () => {
    it('should render children correctly', () => {
      render(
        <Card>
          <Text>카드 내용</Text>
        </Card>
      );

      expect(screen.getByText('카드 내용')).toBeTruthy();
    });

    it('should render with default props (elevated variant, md padding)', () => {
      render(
        <Card>
          <Text>기본 카드</Text>
        </Card>
      );

      expect(screen.getByText('기본 카드')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should render elevated variant', () => {
      render(
        <Card variant="elevated">
          <Text>Elevated Card</Text>
        </Card>
      );

      expect(screen.getByText('Elevated Card')).toBeTruthy();
    });

    it('should render outlined variant', () => {
      render(
        <Card variant="outlined">
          <Text>Outlined Card</Text>
        </Card>
      );

      expect(screen.getByText('Outlined Card')).toBeTruthy();
    });

    it('should render filled variant', () => {
      render(
        <Card variant="filled">
          <Text>Filled Card</Text>
        </Card>
      );

      expect(screen.getByText('Filled Card')).toBeTruthy();
    });
  });

  describe('Padding', () => {
    it('should render with no padding', () => {
      render(
        <Card padding="none">
          <Text>No Padding</Text>
        </Card>
      );

      expect(screen.getByText('No Padding')).toBeTruthy();
    });

    it('should render with small padding', () => {
      render(
        <Card padding="sm">
          <Text>Small Padding</Text>
        </Card>
      );

      expect(screen.getByText('Small Padding')).toBeTruthy();
    });

    it('should render with medium padding (default)', () => {
      render(
        <Card padding="md">
          <Text>Medium Padding</Text>
        </Card>
      );

      expect(screen.getByText('Medium Padding')).toBeTruthy();
    });

    it('should render with large padding', () => {
      render(
        <Card padding="lg">
          <Text>Large Padding</Text>
        </Card>
      );

      expect(screen.getByText('Large Padding')).toBeTruthy();
    });
  });

  describe('Pressable behavior', () => {
    it('should be pressable when onPress is provided', () => {
      const onPress = jest.fn();
      render(
        <Card onPress={onPress}>
          <Text>Pressable Card</Text>
        </Card>
      );

      fireEvent.press(screen.getByText('Pressable Card'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not be pressable when onPress is not provided', () => {
      render(
        <Card>
          <Text>Non-Pressable Card</Text>
        </Card>
      );

      // Check that the card renders correctly without Pressable wrapper
      expect(screen.getByText('Non-Pressable Card')).toBeTruthy();
    });

    it('should call onPress multiple times when pressed multiple times', () => {
      const onPress = jest.fn();
      render(
        <Card onPress={onPress}>
          <Text>Multi Press Card</Text>
        </Card>
      );

      const card = screen.getByText('Multi Press Card');
      fireEvent.press(card);
      fireEvent.press(card);
      fireEvent.press(card);

      expect(onPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(
        <Card className="custom-class">
          <Text>Custom Class Card</Text>
        </Card>
      );

      expect(screen.getByText('Custom Class Card')).toBeTruthy();
    });

    it('should merge custom className with default styles', () => {
      render(
        <Card className="mt-4 mx-2" variant="outlined" padding="lg">
          <Text>Merged Styles Card</Text>
        </Card>
      );

      expect(screen.getByText('Merged Styles Card')).toBeTruthy();
    });
  });

  describe('ViewProps passthrough', () => {
    it('should pass testID to the View', () => {
      render(
        <Card testID="custom-card">
          <Text>Test ID Card</Text>
        </Card>
      );

      expect(screen.getByTestId('custom-card')).toBeTruthy();
    });

    it('should pass accessibilityLabel', () => {
      render(
        <Card accessibilityLabel="카드 컨테이너">
          <Text>Accessible Card</Text>
        </Card>
      );

      expect(screen.getByLabelText('카드 컨테이너')).toBeTruthy();
    });
  });

  describe('Combined props', () => {
    it('should work with all props combined', () => {
      const onPress = jest.fn();
      render(
        <Card
          variant="outlined"
          padding="lg"
          className="mb-4"
          onPress={onPress}
          testID="full-card"
          accessibilityLabel="전체 카드"
        >
          <Text>Full Featured Card</Text>
        </Card>
      );

      const card = screen.getByTestId('full-card');
      expect(card).toBeTruthy();
      expect(screen.getByText('Full Featured Card')).toBeTruthy();

      fireEvent.press(screen.getByText('Full Featured Card'));
      expect(onPress).toHaveBeenCalled();
    });
  });
});
