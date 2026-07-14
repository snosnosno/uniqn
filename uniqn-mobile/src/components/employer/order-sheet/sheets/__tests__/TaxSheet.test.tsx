/**
 * TaxSheet — 세금 설정 시트 테스트
 *
 * 미설정(undefined)으로 열면 3.3%가 제안값으로 시드되고, 바로 확인하면 그 제안값이 반영된다(의도된 동작).
 * 기존 설정이 있으면 그 값이 유지된다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { TaxSheet } from '../TaxSheet';
import type { TaxSettings } from '@/types/jobPosting';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

describe('TaxSheet', () => {
  it('미설정으로 열고 바로 확인하면 3.3% 제안값이 반영된다', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <TaxSheet visible value={undefined} onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ type: 'rate', value: 3.3 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('기존 설정이 있으면 그 값이 유지된다', () => {
    const onConfirm = jest.fn();
    const existing: TaxSettings = { type: 'fixed', value: 10000 };
    const { getByText } = render(
      <TaxSheet visible value={existing} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fixed', value: 10000 })
    );
  });
});
