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
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    CalendarPicker: ({ selectedDates, onMultiSelectChange }: any) => (
      <View>
        {/* 시드 관측창 — 시트가 **전 카드 날짜 합집합**을 받았는지 볼 수 있는 유일한 지점.
            아래 PICKS 버튼은 선택을 통째로 덮어쓰므로, 시드가 죽어도 다른 단언은 전부 green 이다
            (이 프로젝트의 "빌더/오프너 분리 빈 통과" 계열 함정). */}
        <Text testID="calendar-seed">{(selectedDates ?? []).map(ymd).join(',')}</Text>
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

describe('날짜 시트 시드 — 전 일정 스코프 배선 (회귀 가드)', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('시트는 전 카드 날짜의 합집합을 시드로 받는다', () => {
    const { getByTestId } = renderWithCapture(twoCards());

    fireEvent.press(getByTestId('order-sheet-row-dates'));

    // 한 카드 날짜만 넘기면(구 그룹 스코프 시맨틱으로 되감으면) 나머지 카드 날짜가
    // "해제됨"으로 해석되어 확인 한 번에 카드와 조건이 통째로 사라진다.
    expect(getByTestId('calendar-seed').props.children).toBe('2026-07-14,2026-07-20,2026-07-21');
  });

  it('아무것도 바꾸지 않고 확인하면 카드도 조건도 그대로다', async () => {
    const { getByTestId, readForm } = renderWithCapture(twoCards());

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(2);
    expect(saved.scheduleGroups?.[1]?.timeSlots).toEqual(floorSlot);
    expect(mockAddToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('조건이 함께 삭제') })
    );
  });

  it('날짜 상한을 다 써도 시트는 살아 있다 — existingDates 합성 회귀 가드 (구 ORDER-8)', () => {
    const sevenDates = Array.from(
      { length: 7 },
      (_, i) => `2026-07-${String(14 + i).padStart(2, '0')}`
    );
    const { getByTestId, getByText, queryByText } = renderWithCapture(singleCard(sevenDates));

    fireEvent.press(getByTestId('order-sheet-row-dates'));

    // existingDates 를 "담긴 날짜"로 되감으면 remainingSlots = 7-7 = 0 이 되어
    // 확인이 영구 비활성인 막다른 시트가 된다(구 ORDER-8 결함의 부활 경로).
    expect(getByTestId('calendar-seed').props.children).toBe(sevenDates.join(','));
    expect(queryByText('남은 슬롯이 없어요')).toBeNull();
    expect(getByText('최대 7개까지')).toBeTruthy();
  });
});

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

  it('승계를 조용히 하지 않는다 — 어느 조건을 받았는지 알리고 바꿀 길을 준다 (F10)', async () => {
    const { getByTestId } = renderWithCapture(
      withGroups([
        { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
        { dates: ['2026-07-20'], timeSlots: floorSlot, grouped: false },
      ])
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714-720-721'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    const toast = mockAddToast.mock.calls.at(-1)?.[0];
    expect(toast.message).toContain('7/21');
    expect(toast.message).toContain('조건으로 추가');
    expect(toast.action.label).toBe('다른 조건으로');

    // 액션은 그 카드의 예외 추출 시트로 데려간다 — 그 날짜만 다른 조건을 주는 자리다
    await act(async () => {
      toast.action.onPress();
      await Promise.resolve();
    });
    expect(getByTestId('order-sheet-exception-date-2026-07-21')).toBeTruthy();
  });

  it('한 뮤테이션에 토스트는 하나다 — 소멸이 승계를 이긴다 (F6 우선순위)', async () => {
    const { getByTestId } = renderWithCapture(twoCards());
    mockAddToast.mockClear();

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714')); // 카드 소멸 + (승계는 없음)
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast.mock.calls[0]?.[0]?.message).toContain('조건이 함께 삭제');
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

  it('날짜만 줄어드는 경우에는 아무 고지도 하지 않는다 — 자기가 한 일을 되읽지 않는다', async () => {
    const { getByTestId } = renderWithCapture(singleCard(['2026-07-14', '2026-07-15']));
    mockAddToast.mockClear();

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    // 구 구현은 "날짜 수가 줄었다"만 보고 '같은 조건이라 합쳐졌어요'를 띄웠다 —
    // 가장 흔한 조작(날짜 해제)이 병합으로 오고지되고 계기판까지 오염됐다.
    expect(mockAddToast).not.toHaveBeenCalled();
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

describe('예외 추출 — 조건 시트의 "적용할 날짜"로 통합 (§3.4)', () => {
  beforeEach(() => mockAddToast.mockClear());

  it('여러 날짜를 1회 입력으로 다른 조건 카드로 가른다', async () => {
    const { getByTestId, getByText, readForm } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15', '2026-07-16'])
    );

    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
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

    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));
    fireEvent.press(getByText('확인'));
    await flush();

    // 화면에서 바로 보인다 — 저장했다 다시 열었을 때 뒤늦게 합쳐지는 옛 동작과의 차이가 이것이다
    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14', '2026-07-15', '2026-07-16']);
  });

  /**
   * 통합의 헤드라인 계약(사용자 결정 2026-08-07) — 조건 시트는 이제 항상 "적용할 날짜"를
   * 보여주고, **아무것도 안 고르면 카드 전체**에 적용된다. 구 계약(0개=확인 잠금)으로
   * 되돌리면 날짜 확정 직후 연쇄가 막다른 길이 되므로 여기서 잡는다.
   */
  it('날짜를 안 고르고 확인하면 카드 전체에 적용된다 — 갈라지지 않는다', async () => {
    const { getByTestId, getByText, readForm } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15', '2026-07-16'])
    );

    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm')); // 20:30
    fireEvent.press(getByText('확인'));
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups).toHaveLength(1);
    expect(saved.scheduleGroups?.[0]?.dates).toEqual(['2026-07-14', '2026-07-15', '2026-07-16']);
    expect(saved.scheduleGroups?.[0]?.timeSlots?.[0]?.startTime).toBe('20:30');
  });

  it('조건 행 탭이 예외의 유일한 진입로다 — 별도 링크·버튼이 없다', () => {
    const { getByTestId, queryByTestId, getByText } = renderWithCapture(
      singleCard(['2026-07-14', '2026-07-15'])
    );

    expect(queryByTestId('order-sheet-card-exception-0')).toBeNull();
    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    expect(queryByTestId('order-sheet-slots-switch-exception')).toBeNull();
    // 대신 시트 안에 적용할 날짜가 곧바로 있다
    expect(getByTestId('order-sheet-exception-date-2026-07-14')).toBeTruthy();
    expect(getByText('안 고르면 전체 날짜에 적용돼요')).toBeTruthy();
  });

  /**
   * 구 edit→exception 모드 전환은 시트를 리마운트해 방금 고친 값을 되감았다(리뷰 MEDIUM ⑤).
   * 이제 전환 자체가 없어 편집값이 유실될 자리가 구조적으로 사라졌다 — 그걸 고정한다.
   */
  it('날짜를 고르는 동안에도 방금 고친 시간이 유지된다 (전환이 없어 유실될 자리가 없다)', () => {
    const { getByTestId, getByText } = renderWithCapture(singleCard(['2026-07-14', '2026-07-15']));

    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm')); // 19:00 → 20:30 (미확정)
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));

    expect(getByText('출근 20:30')).toBeTruthy();
  });

  it('날짜가 1개인 카드에서는 고를 여지가 없어 날짜 행이 숨는다', () => {
    const { getByTestId, queryByTestId } = renderWithCapture(singleCard(['2026-07-14']));
    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    expect(queryByTestId('order-sheet-exception-date-2026-07-14')).toBeNull();
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

/**
 * 리뷰 HIGH 1 회귀 가드 — 템플릿 프리셋이 만드는 "조건만 있고 날짜 없는 카드".
 *
 * 통합 전에는 이 카드가 **채울 수 없는 유령**이었다: 제출 유도 CTA 가 그 카드의 '날짜' 행을
 * 가리키는데, 그 행이 여는 전 일정 날짜 시트는 무엇을 골라도 인접·첫 카드에 배정해서
 * 이 카드는 영영 비어 있었고 CTA 가 같은 자리를 무한히 가리켰다(실측).
 */
describe('날짜 없는 조건 카드 — 채울 길이 있어야 한다 (리뷰 HIGH 1)', () => {
  const presetLike = () =>
    withGroups([
      { dates: ['2026-07-14', '2026-07-15'], timeSlots: dealerSlot, grouped: false },
      { dates: [], timeSlots: floorSlot, grouped: false },
    ]);

  it('제출 유도 CTA 가 그 카드를 가리킨다', () => {
    const { getByTestId } = renderWithCapture(presetLike());
    expect(
      within(getByTestId('job-posting-create-submit')).getByText('2번째 일정의 날짜부터 선택하기')
    ).toBeTruthy();
  });

  it('CTA 를 누르면 전 일정 날짜 시트가 아니라 그 카드의 조건 시트가 열린다', async () => {
    const { getByTestId, queryByTestId, getByText } = renderWithCapture(presetLike());

    fireEvent.press(getByTestId('job-posting-create-submit'));
    await flush(); // handleSubmit 은 zod 검증을 거치는 비동기 경로다

    // 전 일정 날짜 시트(DatePickerModal)가 아니다 — 그건 이 카드를 채우지 못한다
    expect(queryByTestId('job-posting-date-confirm-button')).toBeNull();
    // 조건 시트가 열리고, 공고 전체 날짜가 후보로 뜬다
    expect(getByTestId('order-sheet-exception-date-2026-07-14')).toBeTruthy();
    expect(getByTestId('order-sheet-exception-date-2026-07-15')).toBeTruthy();
    expect(getByText('이 조건을 쓸 날짜를 골라주세요')).toBeTruthy();
  });

  it('날짜를 고르면 그 카드가 채워지고, 더는 미설정 카드가 남지 않는다', async () => {
    const { getByTestId, getByText, readForm } = renderWithCapture(presetLike());

    fireEvent.press(getByTestId('job-posting-create-submit'));
    await flush();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));
    fireEvent.press(getByText('확인'));
    await flush();

    const saved = readForm();
    expect(saved.scheduleGroups?.every((g) => (g.dates ?? []).length > 0)).toBe(true);
    const filled = saved.scheduleGroups?.find(
      (g) => g.timeSlots?.[0]?.startTime === floorSlot[0]?.startTime
    );
    expect(filled?.dates).toEqual(['2026-07-15']);
    // 원래 주인은 남은 날짜만 유지한다
    expect(
      saved.scheduleGroups?.find((g) => g.timeSlots?.[0]?.startTime === dealerSlot[0]?.startTime)
        ?.dates
    ).toEqual(['2026-07-14']);
  });
});
