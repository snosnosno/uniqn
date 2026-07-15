/**
 * OrderSheetScreen — 대회 유형 전환 배선 테스트 (S1 Task 2)
 *
 * 대회 세그먼트는 레거시로 이탈하지 않고 주문서 안에서 postingType='tournament'로 전환된다.
 * 고정 세그먼트만 아직 레거시 폼으로 위임(S2에서 이관).
 * SheetModal 은 children+footer 렌더로 모킹(reanimated 배제) — presets 테스트와 동일 스캐폴딩.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

// 참고: presets 테스트와 동일한 상위 모킹(SheetModal 등)을 재사용한다.
jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

describe('OrderSheetScreen — 대회 유형 전환 (S1)', () => {
  const baseProps = {
    initialValues: initialOrderSheetValues(),
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
  };

  it('대회 세그먼트 선택 시 레거시로 이탈하지 않는다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-tournament'));
    expect(onSwitchToLegacyForm).not.toHaveBeenCalled();
    expect(getByTestId('order-sheet-type-tournament').props.accessibilityState.selected).toBe(true);
  });

  it('고정 세그먼트는 아직 레거시로 위임한다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(onSwitchToLegacyForm).toHaveBeenCalledWith('fixed');
  });
});
