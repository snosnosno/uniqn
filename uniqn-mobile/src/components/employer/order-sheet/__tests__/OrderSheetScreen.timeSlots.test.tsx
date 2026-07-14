/**
 * OrderSheetScreen — 일정·모집 시트 라우팅 + #244 지연 전환(switchSheet) 테스트
 *
 * (1) roles 행: 슬롯 1개면 역할 시트 직접, 복수면 TimeSlotsSheet 진입,
 * (2) TimeSlotsSheet→RolesSheet 스왑은 즉시 스왑이 아니라 닫고 SHEET_DISMISS_ANIMATION_MS 뒤 열림,
 * (3) 전환 예약 중 언마운트 시 타이머 정리(크래시·누수 없음).
 * SheetModal 은 children+footer+overlay 렌더로 모킹(reanimated 타이머 배제 — fake timer 격리).
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';

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

// DatePickerModal(dates 행)의 Modal/CalendarPicker 스텁 — 레이스 회귀 시 실제 렌더 크래시로 어설션이 가려지지 않게.
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
  onSwitchToLegacyForm: jest.fn(),
};

const withSlots = (slots: { startTime: string; roles: any[] }[]) => ({
  ...initialOrderSheetValues(),
  timeSlots: slots,
});

describe('OrderSheetScreen — 일정·모집 라우팅 + #244 전환', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('roles 행 — 슬롯 복수면 TimeSlotsSheet 진입', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByText('출근 21:00')).toBeTruthy();
  });

  it('roles 행 — 슬롯 1개면 역할 시트 직접 진입', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('어떤 역할이 필요하세요?')).toBeTruthy();
  });

  it('TimeSlotsSheet→RolesSheet 스왑은 지연 전환(즉시 스왑 금지)', async () => {
    jest.useFakeTimers();
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles')); // TimeSlotsSheet
    fireEvent.press(getByTestId('order-time-roles-0')); // 슬롯0 역할 편집 → switchSheet
    // onConfirm(setValue shouldValidate)의 RHF 비동기 검증 microtask flush
    await act(async () => {
      await Promise.resolve();
    });

    // 닫힘 직후: TimeSlots 닫히고 RolesSheet 아직 안 열림
    expect(queryByText('출근 19:00')).toBeNull();
    expect(queryByText('어떤 역할이 필요하세요?')).toBeNull();

    // dismiss 애니메이션 경과 후 RolesSheet 열림
    act(() => {
      jest.advanceTimersByTime(SHEET_DISMISS_ANIMATION_MS);
    });
    expect(getByText('어떤 역할이 필요하세요?')).toBeTruthy();
  });

  it('전환 예약 중 언마운트 → 타이머 정리(크래시 없음)', async () => {
    jest.useFakeTimers();
    const { getByTestId, unmount } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    fireEvent.press(getByTestId('order-time-roles-0')); // switchSheet 예약
    await act(async () => {
      await Promise.resolve();
    });
    expect(() => {
      unmount();
      act(() => {
        jest.advanceTimersByTime(SHEET_DISMISS_ANIMATION_MS * 2);
      });
    }).not.toThrow();
  });

  it('submit 시 역할 미설정이면 역할 시트가 열린다 (onInvalid roles — H5 죽은 버튼 방지)', async () => {
    const { getByTestId, findByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...initialOrderSheetValues(),
          title: '주말 딜러 구합니다',
          location: { name: '강남 홀덤펍' },
          contactPhone: '010-1234-5678',
          dates: ['2026-07-14'],
          timeSlots: [{ startTime: '19:00', roles: [] }], // 역할만 미설정 → firstUnsetRow='roles'
        }}
      />
    );
    // 제목~시간은 설정·역할 미설정 상태에서 등록 → 역할 시트 유도(setActiveSheet 직접이면 무반응이던 지점)
    fireEvent.press(getByTestId('job-posting-create-submit'));
    expect(await findByText('어떤 역할이 필요하세요?')).toBeTruthy();
  });

  it('지연 전환 창 중 다른 행 탭은 무시되고 예약된 시트만 열린다 (#244 레이스 가드)', async () => {
    jest.useFakeTimers();
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles')); // TimeSlots
    fireEvent.press(getByTestId('order-time-roles-0')); // switchSheet 예약(activeSheet=null)
    await act(async () => {
      await Promise.resolve();
    });

    // 전환 창(300ms) 중 dates 행 탭 → 가드로 무시(RolesSheet·dates 모두 미개봉)
    fireEvent.press(getByTestId('order-sheet-row-dates'));
    expect(queryByText('어떤 역할이 필요하세요?')).toBeNull();
    expect(queryByText('선택한 날짜 (0개)')).toBeNull();

    // 경과 후 예약된 RolesSheet만 열림 — 사용자 탭이 예약을 clobber하지 않음
    act(() => {
      jest.advanceTimersByTime(SHEET_DISMISS_ANIMATION_MS);
    });
    expect(getByText('어떤 역할이 필요하세요?')).toBeTruthy();
    expect(queryByText('선택한 날짜 (0개)')).toBeNull();
  });
});
