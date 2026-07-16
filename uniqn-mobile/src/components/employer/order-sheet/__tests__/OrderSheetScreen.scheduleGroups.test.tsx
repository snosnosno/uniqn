/**
 * OrderSheetScreen — 일정 그룹(S1) 배선 테스트
 *
 * (1) 3지 세그먼트 "날짜마다 따로" 분할 시 시간/역할 깊은복사 승계(E6),
 * (2) "연속 날짜 묶음 지원"은 grouped=true(묶음지원 축 — F6, 그 외 false),
 * (3) grouped 그룹 재진입 시 세그먼트 초기값 ②(ⓐ — 무변경 confirm의 침묵 해제 차단),
 * (4) 그룹 삭제 = 즉시 + Undo 토스트 5초(Design-M2), 마지막 그룹은 삭제 버튼 미노출(E4),
 * (5) "+ 일정 추가"는 직전 그룹 시간/역할 깊은복사 시드(Design-L2),
 * (6) 제출 유도 라벨의 그룹 식별 접두(Design-M3).
 */
import { render, fireEvent, act, within } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import type { OrderSheetPreset } from '../PresetCarousel';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

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
// 캘린더는 고정 날짜(7/20·7/21)를 선택하는 버튼으로 스텁 — 시트 confirm 흐름만 검증
jest.mock('@/components/ui/CalendarPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    CalendarPicker: ({ onMultiSelectChange }: any) => (
      <Pressable
        testID="calendar-pick-720-721"
        onPress={() => onMultiSelectChange([new Date(2026, 6, 20), new Date(2026, 6, 21)])}
      >
        <Text>calendar</Text>
      </Pressable>
    ),
  };
});

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const dealerSlot = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];

const filledSingleGroup = (dates: string[], grouped = false): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [{ dates, timeSlots: dealerSlot, grouped }],
  roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
});

const twoGroupValues = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
    {
      dates: ['2026-07-20', '2026-07-21'],
      timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }],
      grouped: true,
    },
  ],
  roleSalaries: [
    { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
  ],
});

/** onSaveTemplate로 폼 상태를 회수하기 위한 프리셋(저장 카드 노출용 더미 포함) */
const dummyPreset: OrderSheetPreset = {
  id: 'dummy',
  title: '더미',
  subtitle: '',
  values: initialOrderSheetValues(),
};

describe('OrderSheetScreen — 일정 그룹(S1)', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('"날짜마다 따로" 분할 — 날짜별 그룹 + 시간/역할 깊은복사 승계(참조 무공유)', async () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={filledSingleGroup(['2026-07-14', '2026-07-16'])}
        presets={[dummyPreset]}
        onSaveTemplate={onSaveTemplate}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-dates')); // 단일 그룹 → whole 모드(세그먼트)
    fireEvent.press(getByTestId('order-sheet-dates-segment-separate'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    // 서브그룹 헤더 2개(7/14·7/16) 렌더
    expect(getByTestId('order-sheet-group-dates-0')).toBeTruthy();
    expect(getByTestId('order-sheet-group-dates-1')).toBeTruthy();

    fireEvent.press(getByTestId('order-sheet-preset-save'));
    const saved = onSaveTemplate.mock.calls[0]?.[0] as OrderSheetFormValues;
    expect(saved.scheduleGroups).toHaveLength(2);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14']);
    expect(saved.scheduleGroups?.[1]?.dates).toEqual(['2026-07-16']);
    expect(saved.scheduleGroups?.every((g) => g.grouped === false)).toBe(true);
    // 깊은복사 승계 — 내용 동일, 참조 무공유(F1/E6)
    expect(saved.scheduleGroups?.[0]?.timeSlots).toEqual(saved.scheduleGroups?.[1]?.timeSlots);
    expect(saved.scheduleGroups?.[0]?.timeSlots).not.toBe(saved.scheduleGroups?.[1]?.timeSlots);
    expect(saved.scheduleGroups?.[0]?.timeSlots?.[0]?.roles).not.toBe(
      saved.scheduleGroups?.[1]?.timeSlots?.[0]?.roles
    );
  });

  it('"연속 날짜 묶음 지원" — 연속 run만 grouped=true (F6: 명시 선택만 묶음지원)', async () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={filledSingleGroup(['2026-07-20', '2026-07-21'])}
        presets={[dummyPreset]}
        onSaveTemplate={onSaveTemplate}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('order-sheet-dates-segment-grouped'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    fireEvent.press(getByTestId('order-sheet-preset-save'));
    const saved = onSaveTemplate.mock.calls[0]?.[0] as OrderSheetFormValues;
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.grouped).toBe(true);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-20', '2026-07-21']);
  });

  it('grouped 그룹 재진입 시 세그먼트 초기값은 ②(연속 날짜 묶음 지원) — 무변경 confirm이 묶음지원을 침묵 해제하지 않는다(ⓐ)', async () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={filledSingleGroup(['2026-07-20', '2026-07-21'], true)}
        presets={[dummyPreset]}
        onSaveTemplate={onSaveTemplate}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    expect(getByTestId('order-sheet-dates-segment-grouped').props.accessibilityState.selected).toBe(
      true
    );

    // 세그먼트 무변경 confirm → grouped 유지
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();
    fireEvent.press(getByTestId('order-sheet-preset-save'));
    const saved = onSaveTemplate.mock.calls[0]?.[0] as OrderSheetFormValues;
    expect(saved.scheduleGroups?.[0]?.grouped).toBe(true);
  });

  it('그룹 삭제 — 즉시 반영 + 되돌리기 액션 토스트(5초), 복원 동작', async () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={twoGroupValues()} />
    );

    expect(getByTestId('order-sheet-group-delete-0')).toBeTruthy();
    fireEvent.press(getByTestId('order-sheet-group-delete-1'));
    await flush();

    // 그룹 1개로 축소 → 단일 레이아웃(서브그룹 헤더·삭제 버튼 미노출 — E4)
    expect(queryByTestId('order-sheet-group-delete-0')).toBeNull();
    expect(getByTestId('order-sheet-row-dates')).toBeTruthy();

    const toast = mockAddToast.mock.calls[0]?.[0];
    expect(toast.message).toContain('7/20~21');
    expect(toast.duration).toBe(5000);
    expect(toast.action.label).toBe('되돌리기');

    await act(async () => {
      toast.action.onPress();
      await Promise.resolve();
    });
    expect(getByTestId('order-sheet-group-dates-1')).toBeTruthy(); // 스냅샷 복원
  });

  it('"+ 일정 추가" — 새 그룹은 직전 그룹 시간/역할 깊은복사 시드(Design-L2)', async () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={filledSingleGroup(['2026-07-14'])}
        presets={[dummyPreset]}
        onSaveTemplate={onSaveTemplate}
      />
    );

    fireEvent.press(getByTestId('order-sheet-add-schedule'));
    fireEvent.press(getByTestId('calendar-pick-720-721')); // 7/20·7/21 선택
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    fireEvent.press(getByTestId('order-sheet-preset-save'));
    const saved = onSaveTemplate.mock.calls[0]?.[0] as OrderSheetFormValues;
    expect(saved.scheduleGroups).toHaveLength(2);
    expect(saved.scheduleGroups?.[1]?.dates).toEqual(['2026-07-20', '2026-07-21']);
    expect(saved.scheduleGroups?.[1]?.grouped).toBe(false);
    expect(saved.scheduleGroups?.[1]?.timeSlots).toEqual(saved.scheduleGroups?.[0]?.timeSlots);
    expect(saved.scheduleGroups?.[1]?.timeSlots).not.toBe(saved.scheduleGroups?.[0]?.timeSlots);
  });

  it('제출 유도 라벨 — 그룹 2개+의 미설정 행은 날짜 요약 접두로 그룹을 식별한다(Design-M3)', async () => {
    const values = twoGroupValues();
    const partial: OrderSheetFormValues = {
      ...values,
      scheduleGroups: [
        values.scheduleGroups![0]!,
        {
          dates: ['2026-07-20', '2026-07-21'],
          timeSlots: [{ startTime: '', roles: [] }],
          grouped: true,
        },
      ],
    };
    const { getByTestId } = render(<OrderSheetScreen {...baseProps} initialValues={partial} />);

    const submit = getByTestId('job-posting-create-submit');
    expect(within(submit).getByText('7/20~21 일정의 시간부터 선택하기')).toBeTruthy();
  });

  it('다그룹 헤더 날짜 탭 — 그룹 스코프 재편집(세그먼트 숨김 ⓓ)으로 열린다', async () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={twoGroupValues()} />
    );

    fireEvent.press(getByTestId('order-sheet-group-dates-1'));
    // 재편집 모드 — 날짜 시트는 열리되 세그먼트 미노출
    expect(getByTestId('job-posting-date-confirm-button')).toBeTruthy();
    expect(queryByTestId('order-sheet-dates-segment-separate')).toBeNull();
  });
});
