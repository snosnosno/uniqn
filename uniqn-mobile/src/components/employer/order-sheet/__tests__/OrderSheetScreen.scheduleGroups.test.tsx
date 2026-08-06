/**
 * OrderSheetScreen — 조건 유도 그룹핑 배선 테스트
 *
 * 사장은 사실(날짜·시간·역할)만 입력하고 카드 경계는 조건이 정한다. 여기서 지키는 계약:
 * (1) 날짜 확정이 카드 1개를 편집한다(최빈 — 조건 재입력 요구 없음),
 * (2) 추가 날짜는 인접 카드가 조건을 승계한다(F10),
 * (3) 카드의 마지막 날짜가 빠지면 조건까지 유실되므로 되돌릴 길을 준다(F6),
 * (4) 묶음 토글 ON = 카드 분리 / OFF = 재병합(§3.5),
 * (5) 예외 추출은 다중 날짜를 1회 입력으로 가른다(§3.4),
 * (6) 카드 삭제 + Undo, (7) 제출 유도 라벨의 카드 식별 접두.
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

jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, onConfirm }: any) =>
      visible ? (
        <Pressable testID="mock-time-confirm" onPress={() => onConfirm({ hour: 20, minute: 30 })}>
          <Text>MockPicker</Text>
        </Pressable>
      ) : null,
  };
});

/** 캘린더 스텁 — 시나리오별 날짜 조합을 버튼으로 제공(시트 confirm 흐름만 검증) */
jest.mock('@/components/ui/CalendarPicker', () => {
  const { Pressable, Text, View } = require('react-native');
  const PICKS: Record<string, number[][]> = {
    '714': [[2026, 6, 14]],
    '714-720-721': [
      [2026, 6, 14],
      [2026, 6, 20],
      [2026, 6, 21],
    ],
    '720-721': [
      [2026, 6, 20],
      [2026, 6, 21],
    ],
  };
  return {
    CalendarPicker: ({ onMultiSelectChange }: any) => (
      <View>
        {Object.entries(PICKS).map(([key, days]) => (
          <Pressable
            key={key}
            testID={`calendar-pick-${key}`}
            onPress={() => onMultiSelectChange(days.map((d) => new Date(d[0]!, d[1]!, d[2]!)))}
          >
            <Text>{key}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

const baseProps = { onSubmit: jest.fn(), isSubmitting: false };

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const dealerSlot = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];
const floorSlot = [{ startTime: '21:00', roles: [{ role: 'floor' as const, count: 1 }] }];

const withGroups = (
  scheduleGroups: OrderSheetFormValues['scheduleGroups']
): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups,
  roleSalaries: [
    { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
    { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
  ],
});

const singleCard = (dates: string[], grouped = false) =>
  withGroups([{ dates, timeSlots: dealerSlot, grouped }]);

const twoCards = () =>
  withGroups([
    { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
    { dates: ['2026-07-20', '2026-07-21'], timeSlots: floorSlot, grouped: true },
  ]);

/** onSaveTemplate 로 폼 상태를 회수하기 위한 프리셋(저장 카드 노출용 더미) */
const dummyPreset: OrderSheetPreset = {
  id: 'dummy',
  title: '더미',
  subtitle: '',
  values: initialOrderSheetValues(),
};

const renderWithCapture = (initialValues: OrderSheetFormValues) => {
  const onSaveTemplate = jest.fn();
  const utils = render(
    <OrderSheetScreen
      {...baseProps}
      initialValues={initialValues}
      presets={[dummyPreset]}
      onSaveTemplate={onSaveTemplate}
    />
  );
  /** 저장 버튼을 눌러 현재 폼 값을 회수한다 */
  const readForm = (): OrderSheetFormValues => {
    fireEvent.press(utils.getByTestId('order-sheet-preset-save'));
    return onSaveTemplate.mock.calls.at(-1)?.[0] as OrderSheetFormValues;
  };
  return { ...utils, readForm };
};

describe('날짜 확정 — 전 일정 스코프', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('카드 1개일 때 날짜를 바꿔도 조건은 그대로 남는다 (조건 재입력 요구 없음)', async () => {
    const { getByTestId, readForm } = renderWithCapture(singleCard(['2026-07-14']));

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-720-721'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-20', '2026-07-21']);
    expect(saved.scheduleGroups?.[0]?.timeSlots).toEqual(dealerSlot);
  });

  it('추가한 날짜는 연속으로 인접한 카드가 조건을 승계한다 (F10)', async () => {
    const { getByTestId, readForm } = renderWithCapture(
      withGroups([
        { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
        { dates: ['2026-07-20'], timeSlots: floorSlot, grouped: false },
      ])
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714-720-721')); // 7/21 추가 — 7/20 카드와 연속
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    const saved = readForm();
    const inherited = saved.scheduleGroups?.find((g) => g.dates.includes('2026-07-21'));
    expect(inherited?.dates).toEqual(['2026-07-20', '2026-07-21']);
    expect(inherited?.timeSlots).toEqual(floorSlot);
  });

  it('카드의 마지막 날짜가 빠지면 조건 유실을 고지하고 되돌릴 길을 준다 (F6)', async () => {
    const { getByTestId, readForm } = renderWithCapture(twoCards());

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714')); // 7/20·7/21 카드가 통째로 사라진다
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    const toast = mockAddToast.mock.calls.at(-1)?.[0];
    expect(toast.message).toContain('7/20~21');
    expect(toast.message).toContain('조건이 함께 삭제');
    expect(toast.action.label).toBe('되돌리기');

    await act(async () => {
      toast.action.onPress();
      await Promise.resolve();
    });
    const restored = readForm();
    expect(restored.scheduleGroups).toHaveLength(2);
    expect(restored.scheduleGroups?.[1]?.timeSlots).toEqual(floorSlot);
  });

  it('날짜만 줄어드는 경우에는 소멸 고지를 하지 않는다', async () => {
    const { getByTestId } = renderWithCapture(singleCard(['2026-07-14', '2026-07-15']));

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    expect(mockAddToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('조건이 함께 삭제') })
    );
  });
});

describe('묶음지원 토글 (§3.5)', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('ON — 연속 run 이 묶음 카드로 갈라진다', async () => {
    const { getByTestId, readForm } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15', '2026-07-20'])
    );

    fireEvent(getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', true);
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(2);
    const bundled = saved.scheduleGroups?.find((g) => g.grouped === true);
    expect(bundled?.dates).toEqual(['2026-07-14', '2026-07-15']);
    expect(saved.scheduleGroups?.find((g) => g.dates.includes('2026-07-20'))?.grouped).toBe(false);
  });

  it('OFF — 같은 조건 카드로 되돌아가 병합된다', async () => {
    const { getByTestId, readForm } = renderWithCapture(
      withGroups([
        { dates: ['2026-07-14', '2026-07-15'], timeSlots: dealerSlot, grouped: true },
        { dates: ['2026-07-20'], timeSlots: dealerSlot, grouped: false },
      ])
    );

    fireEvent(getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', false);
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14', '2026-07-15', '2026-07-20']);
    expect(saved.scheduleGroups?.[0]?.grouped).toBe(false);
  });
});

describe('예외 추출 (§3.4)', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('여러 날짜를 1회 입력으로 다른 조건 카드로 가른다', async () => {
    const { getByTestId, getByText, readForm } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15', '2026-07-16'])
    );

    fireEvent.press(getByTestId('order-sheet-card-exception-0'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-16'));
    // 조건을 실제로 바꿔야 갈라진다 — 안 바꾸면 같은 시그니처라 정규화가 도로 합친다(아래 테스트)
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm')); // 20:30
    fireEvent.press(getByText('확인'));
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(2);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14']);
    expect(saved.scheduleGroups?.[1]?.dates).toEqual(['2026-07-15', '2026-07-16']);
    expect(saved.scheduleGroups?.[1]?.timeSlots?.[0]?.startTime).toBe('20:30');
  });

  it('조건을 바꾸지 않은 예외 추출은 정규화가 도로 합친다 (재진입 서프라이즈 소멸)', async () => {
    const { getByTestId, getByText, readForm } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15', '2026-07-16'])
    );

    fireEvent.press(getByTestId('order-sheet-card-exception-0'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));
    fireEvent.press(getByText('확인'));
    await flush();

    // 화면에서 바로 보인다 — 저장했다 다시 열었을 때 뒤늦게 합쳐지는 옛 동작과의 차이가 이것이다
    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14', '2026-07-15', '2026-07-16']);
  });

  it('시간·역할 시트 하단 링크로도 예외 추출에 들어간다 (F7③)', () => {
    const { getByTestId, getByText } = renderWithCapture(singleCard(['2026-07-14', '2026-07-15']));

    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    fireEvent.press(getByTestId('order-sheet-slots-switch-exception'));

    expect(getByText('다르게 할 날짜를 골라주세요')).toBeTruthy();
  });

  it('날짜가 1개인 카드에서는 예외 진입 자체가 없다', () => {
    const { queryByTestId } = renderWithCapture(singleCard(['2026-07-14']));
    expect(queryByTestId('order-sheet-card-exception-0')).toBeNull();
  });
});

describe('카드 삭제 + Undo', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('즉시 반영되고 되돌리기로 복원된다', async () => {
    const { getByTestId, queryByTestId } = renderWithCapture(twoCards());

    expect(getByTestId('order-sheet-card-delete-0')).toBeTruthy();
    fireEvent.press(getByTestId('order-sheet-card-delete-1'));
    await flush();

    // 카드가 1개로 줄면 헤더 날짜 재표기가 생략된다(F1 단일 카드 축약)
    expect(queryByTestId('order-sheet-card-header-0')).toBeNull();

    const toast = mockAddToast.mock.calls.at(-1)?.[0];
    expect(toast.message).toContain('7/20~21');
    expect(toast.duration).toBe(5000);

    await act(async () => {
      toast.action.onPress();
      await Promise.resolve();
    });
    expect(getByTestId('order-sheet-card-header-1')).toBeTruthy();
  });
});

describe('제출 유도 라벨', () => {
  it('카드 2개+의 미설정 행은 날짜 요약 접두로 카드를 식별한다 (Design-M3)', () => {
    const partial = withGroups([
      { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
      {
        dates: ['2026-07-20', '2026-07-21'],
        timeSlots: [{ startTime: '', roles: [] }],
        grouped: true,
      },
    ]);
    const { getByTestId } = render(<OrderSheetScreen {...baseProps} initialValues={partial} />);

    const submit = getByTestId('job-posting-create-submit');
    expect(within(submit).getByText('7/20~21 일정의 시간부터 선택하기')).toBeTruthy();
  });
});
