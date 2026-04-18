/**
 * UNIQN Mobile - Badge Component Tests
 *
 * @description Tests for Badge UI component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '@/components/ui/Badge';

describe('Badge chip variant', () => {
  it('uppercase·letter-spacing·weight 700 적용', () => {
    const { getByText } = render(<Badge variant="chip">장기</Badge>);
    const text = getByText('장기');
    expect(text.props.className).toContain('uppercase');
    expect(text.props.className).toContain('tracking-chip');
    expect(text.props.className).toContain('font-sans-bold');
  });
});
