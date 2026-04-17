import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CardStripe } from '@/components/ui/CardStripe';

describe('CardStripe', () => {
  it('children을 렌더한다', () => {
    const { getByText } = render(
      <CardStripe tone="gold">
        <Text>컨텐츠</Text>
      </CardStripe>
    );
    expect(getByText('컨텐츠')).toBeTruthy();
  });

  it('tone에 따라 스트라이프 색 클래스를 적용한다', () => {
    const { getByTestId } = render(
      <CardStripe tone="info" testID="stripe">
        <Text>x</Text>
      </CardStripe>
    );
    const stripe = getByTestId('stripe-bar', { includeHiddenElements: true });
    expect(stripe.props.className).toContain('bg-info-500');
  });
});
