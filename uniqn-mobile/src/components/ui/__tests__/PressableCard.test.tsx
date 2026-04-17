import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PressableCard } from '@/components/ui/PressableCard';

describe('PressableCard', () => {
  it('onPress 호출된다', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PressableCard onPress={onPress} testID="pc">
        <Text>x</Text>
      </PressableCard>
    );
    fireEvent.press(getByTestId('pc'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accessibilityLabel을 전달한다', () => {
    const { getByLabelText } = render(
      <PressableCard onPress={() => {}} accessibilityLabel="카드 탭">
        <Text>x</Text>
      </PressableCard>
    );
    expect(getByLabelText('카드 탭')).toBeTruthy();
  });
});
