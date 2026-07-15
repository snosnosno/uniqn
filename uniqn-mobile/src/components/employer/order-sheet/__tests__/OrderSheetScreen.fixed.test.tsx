/**
 * OrderSheetScreen — 고정 유형 전환 배선 테스트 (S2 Task 6)
 *
 * 고정 세그먼트는 레거시로 이탈하지 않고 주문서 안에서 postingType='fixed'로 전환된다.
 * 날짜·시간 축 대신 '근무조건' 행(요일·출근시간) + '역할' 행으로 모집을 구성한다.
 * SheetModal 은 children+footer 렌더로 모킹(reanimated 배제) — tournament 테스트와 동일 스캐폴딩.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

// 참고: tournament/presets 테스트와 동일한 상위 모킹(SheetModal 등)을 재사용한다.
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

describe('OrderSheetScreen — 고정 유형(S2)', () => {
  const baseProps = {
    initialValues: initialOrderSheetValues(),
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
  };

  it('고정 세그먼트 선택 시 레거시로 이탈하지 않는다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(onSwitchToLegacyForm).not.toHaveBeenCalled();
    expect(getByTestId('order-sheet-type-fixed').props.accessibilityState.selected).toBe(true);
  });

  it('고정 선택 시 근무조건 행이 보이고 날짜 행이 없다', () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(getByTestId('order-sheet-row-workConditions')).toBeTruthy();
    expect(queryByTestId('order-sheet-row-dates')).toBeNull();
    // 역할 행은 고정에서도 존재(fixedSchedule.roles 편집 경로)
    expect(getByTestId('order-sheet-row-roles')).toBeTruthy();
  });
});
