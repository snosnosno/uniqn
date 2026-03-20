import React from 'react';
import { render } from '@testing-library/react-native';
import { Input } from '../Input';

describe('Input keyboardType overrides', () => {
  it('respects an explicit keyboardType prop', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="custom keyboard" keyboardType="phone-pad" />
    );

    const input = getByPlaceholderText('custom keyboard');

    expect(input.props.keyboardType).toBe('phone-pad');
  });
});
