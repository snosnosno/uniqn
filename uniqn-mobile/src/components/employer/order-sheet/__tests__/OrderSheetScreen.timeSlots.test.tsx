/**
 * OrderSheetScreen — 일정·모집 시트 라우팅 테스트
 *
 * 시간·역할이 하나의 시트(ScheduleSlotsSheet)로 통합되어 시트→시트 스왑이 사라졌다.
 * 구 #244 지연 전환(switchSheet) 테스트 4종은 지킬 동작이 없어져 삭제했다.
 * SheetModal 은 children+footer+overlay 렌더로 모킹.
 */
import { render, fireEvent, within } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer, overlay }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

// DatePickerModal(dates 행)의 Modal/CalendarPicker 스텁 — 실제 렌더 크래시로 어설션이 가려지지 않게.
jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/CalendarPicker', () => ({ CalendarPicker: () => null }));

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
};

const withSlots = (slots: { startTime: string; roles: any[] }[]) => ({
  ...initialOrderSheetValues(),
  scheduleGroups: [{ dates: [], timeSlots: slots, grouped: false }],
});

describe('OrderSheetScreen — 일정·모집 라우팅', () => {
  it('역할 행 — 슬롯 1개면 통합 시트에서 시간과 역할을 함께 보여준다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('시간 · 역할')).toBeTruthy();
    // 주문서 본화면의 '시간' 행도 같은 문자열("출근 19:00")을 렌더하므로 전역 getByText 는 중복 매치된다.
    // 펼친 SlotCard 안(order-time-start-0)으로 스코프를 좁혀 통합 시트가 시간을 보여주는지만 단언한다.
    expect(within(getByTestId('order-time-start-0')).getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간 행도 같은 통합 시트를 연다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-time'));
    expect(getByText('시간 · 역할')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('슬롯 복수면 첫 미완성 슬롯이 펼쳐지고 나머지는 접힌다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('출근 21:00')).toBeTruthy(); // 미완성 = 펼침
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy(); // 완성 = 접힘 요약
  });

  it('submit 시 역할 미설정이면 통합 시트가 열린다 (H5 죽은 버튼 방지)', async () => {
    const { getByTestId, findByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...initialOrderSheetValues(),
          title: '주말 딜러 구합니다',
          location: { name: '강남 홀덤펍', region: '서울 강남구' },
          contactPhone: '010-1234-5678',
          scheduleGroups: [
            // 역할만 미설정 → firstUnsetRow={roles, 0} → handleRowPress 경유(OrderSheetScreen.tsx:550)
            {
              dates: ['2026-07-14'],
              timeSlots: [{ startTime: '19:00', roles: [] }],
              grouped: false,
            },
          ],
        }}
      />
    );
    fireEvent.press(getByTestId('job-posting-create-submit'));
    expect(await findByText('시간 · 역할')).toBeTruthy();
  });
});
