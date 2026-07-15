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
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

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

// 전 행이 채워진 완성 대회 폼 — firstUnsetRow가 null을 반환해 submitLabel이 '승인 요청하기'로 해석되도록 구성.
// location.region('seoul-gangnam')은 등록 슬러그가 아니지만 렌더 경로는 재검증을 돌리지 않아(RHF
// defaultValues는 제출 전까지 resolver 우회) firstUnsetRow/렌더에 영향 없음.
const completeTournamentValues: OrderSheetFormValues = {
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
  location: { name: '강남 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [
    {
      dates: ['2026-08-01'],
      timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 3 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'daily', amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('OrderSheetScreen — 대회 안내·제출 라벨 (S1)', () => {
  const props = {
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
    onSwitchToLegacyForm: jest.fn(),
  };

  it('대회 선택 시 승인 안내 배너를 노출한다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...props} initialValues={completeTournamentValues} />
    );
    expect(getByTestId('order-sheet-tournament-notice')).toBeTruthy();
  });

  it('지원 유형에서는 배너가 없다', () => {
    const { queryByTestId } = render(
      <OrderSheetScreen {...props} initialValues={initialOrderSheetValues()} />
    );
    expect(queryByTestId('order-sheet-tournament-notice')).toBeNull();
  });

  it('완성된 대회는 제출 라벨이 "승인 요청하기"다', () => {
    const { getByText } = render(
      <OrderSheetScreen {...props} initialValues={completeTournamentValues} />
    );
    expect(getByText('승인 요청하기')).toBeTruthy();
  });
});
