/**
 * ScheduleSection — 조건 유도 그룹핑 일정 섹션 (T2/D3)
 *
 * 설계 정본 §3.2·§3.9(F1~F5·F12·F13). 사장은 사실만 입력하고 카드 경계는 조건이 정한다.
 * 여기서 검증하는 것: 단일 카드 축약 · 빈 상태 · 미완성 muted · run 토글 노출 조건 ·
 * 예외 진입 노출 조건 · 날짜 칩 · 30일 축약 · 삭제.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ScheduleSection } from '../ScheduleSection';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

type Groups = NonNullable<OrderSheetFormValues['scheduleGroups']>;

type SlotRoles = Groups[number]['timeSlots'][number]['roles'];

const slots = (
  startTime: string,
  roles: SlotRoles = [{ role: 'dealer', count: 2 }]
): Groups[number]['timeSlots'] => [{ startTime, roles }];

const valuesWith = (scheduleGroups: Groups): OrderSheetFormValues => ({
  postingType: 'regular',
  title: '주말 딜러',
  location: { name: '라운더스', address: '서울', region: 'seoul-gangnam' },
  contactPhone: '010-0000-0000',
  description: '',
  scheduleGroups,
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
});

const noop = () => {};
const baseHandlers = {
  rowError: () => undefined,
  highlightedCardIndex: null,
  onPressDates: noop,
  onPressDateChip: noop,
  onPressCondition: noop,
  onToggleRun: noop,
  onPressException: noop,
  onDeleteCard: noop,
};

const setup = (
  scheduleGroups: Groups,
  overrides: Partial<React.ComponentProps<typeof ScheduleSection>> = {}
) =>
  render(<ScheduleSection values={valuesWith(scheduleGroups)} {...baseHandlers} {...overrides} />);

describe('빈 상태 (F4)', () => {
  const empty: Groups = [{ dates: [], timeSlots: [], grouped: false }];

  it('날짜도 조건도 없으면 단일 CTA 행만 보인다', () => {
    setup(empty);
    expect(screen.getByText('날짜를 골라 시작하세요')).toBeTruthy();
    expect(screen.queryByTestId('order-sheet-card-0')).toBeNull();
    expect(screen.queryByTestId('order-sheet-card-exception-0')).toBeNull();
  });

  it('빈 상태에서도 날짜 행 testID 를 유지한다 (e2e employer-posting-crud 가 가시성으로 참조)', () => {
    setup(empty);
    expect(screen.getByTestId('order-sheet-row-dates')).toBeTruthy();
  });

  it('CTA 를 누르면 날짜 선택으로 간다', () => {
    const onPressDates = jest.fn();
    setup(empty, { onPressDates });
    fireEvent.press(screen.getByTestId('order-sheet-row-dates'));
    expect(onPressDates).toHaveBeenCalled();
  });
});

describe('템플릿 상태 — 날짜 0 + 조건 있음 (규칙 0 보존분의 가시화)', () => {
  it('날짜가 없어도 조건이 있으면 카드를 숨기지 않는다 (침묵 유실 방지)', () => {
    setup([
      { dates: [], timeSlots: slots('19:00'), grouped: false },
      { dates: [], timeSlots: slots('21:00'), grouped: false },
    ]);
    expect(screen.getByTestId('order-sheet-card-0')).toBeTruthy();
    expect(screen.getByTestId('order-sheet-card-1')).toBeTruthy();
    expect(screen.getAllByText('날짜 미설정').length).toBe(2);
  });

  it('날짜 없는 grouped 카드는 묶음 토글을 그리지 않는다 — 해제 불가 좀비 방지', () => {
    // 구 템플릿 프리셋이 dates 만 비우고 grouped:true 를 남기면 빈 라벨의 " 통째로 지원받기"
    // 토글이 켜진 채 뜨는데, 묶을 run 이 없어 스위치를 내려도 아무 일도 일어나지 않았다.
    setup([{ dates: [], timeSlots: slots('19:00'), grouped: true }]);
    expect(screen.queryByTestId('order-sheet-card-run-toggle-0-0')).toBeNull();
  });
});

describe('단일 카드 축약 (F1)', () => {
  const single: Groups = [
    { dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false },
  ];

  it('카드 헤더의 날짜 재표기를 생략한다 — 요약 행이 대신한다', () => {
    setup(single);
    expect(screen.queryByTestId('order-sheet-card-header-0')).toBeNull();
  });

  it('마지막 카드에는 삭제 버튼을 노출하지 않는다 (E4)', () => {
    setup(single);
    expect(screen.queryByTestId('order-sheet-card-delete-0')).toBeNull();
  });

  it('조건 행에 시간·역할 요약이 함께 보인다', () => {
    setup(single);
    expect(screen.getByText('18:00 · 딜러 2')).toBeTruthy();
  });

  it('총원 캡션은 카드 1개일 때 노출하지 않는다 (F3)', () => {
    setup(single);
    expect(screen.queryByText('딜러 2')).toBeNull();
  });
});

describe('카드 2개 이상', () => {
  const two: Groups = [
    { dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false },
    {
      dates: ['2026-08-12'],
      timeSlots: slots('20:00', [{ role: 'floor', count: 1 }]),
      grouped: false,
    },
  ];

  it('카드마다 날짜 요약 헤더와 삭제 버튼이 있다 (F12)', () => {
    setup(two);
    expect(screen.getByTestId('order-sheet-card-header-0')).toBeTruthy();
    expect(screen.getByTestId('order-sheet-card-delete-0')).toBeTruthy();
    expect(screen.getByTestId('order-sheet-card-delete-1')).toBeTruthy();
  });

  it('삭제 버튼 라벨은 "이 날짜들 삭제" 다 (F12)', () => {
    setup(two);
    expect(screen.getByLabelText('8/10~11 날짜들 삭제')).toBeTruthy();
  });

  it('삭제를 누르면 카드 인덱스를 넘긴다', () => {
    const onDeleteCard = jest.fn();
    setup(two, { onDeleteCard });
    fireEvent.press(screen.getByTestId('order-sheet-card-delete-1'));
    expect(onDeleteCard).toHaveBeenCalledWith(1);
  });

  it('총원 캡션을 노출한다 (F3)', () => {
    setup(two);
    expect(screen.getByText('딜러 2 · 플로어 1')).toBeTruthy();
  });

  it('조건 행을 누르면 그 카드 스코프로 시트를 연다', () => {
    const onPressCondition = jest.fn();
    setup(two, { onPressCondition });
    fireEvent.press(screen.getByTestId('order-sheet-card-condition-1'));
    expect(onPressCondition).toHaveBeenCalledWith(1);
  });
});

describe('미완성 카드 표기 (F5 — 미설정은 muted, 에러 아님)', () => {
  it('역할만 비면 "역할을 정해주세요" 로 보인다', () => {
    setup([
      { dates: ['2026-08-10'], timeSlots: [{ startTime: '18:00', roles: [] }], grouped: false },
    ]);
    expect(screen.getByText('18:00 · 역할을 정해주세요')).toBeTruthy();
  });

  it('시간만 비면 "시간을 정해주세요" 로 보인다', () => {
    setup([
      {
        dates: ['2026-08-10'],
        timeSlots: [{ startTime: '', roles: [{ role: 'dealer', count: 2 }] }],
        grouped: false,
      },
    ]);
    expect(screen.getByText('시간을 정해주세요 · 딜러 2')).toBeTruthy();
  });

  it('둘 다 비면 한 문장으로 안내한다', () => {
    setup([{ dates: ['2026-08-10'], timeSlots: [], grouped: false }]);
    expect(screen.getByText('시간과 역할을 정해주세요')).toBeTruthy();
  });
});

describe('묶음지원 run 토글 (§3.5 · F13)', () => {
  it('연속 2일 이상 구간이 있으면 토글이 보인다', () => {
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.getByTestId('order-sheet-card-run-toggle-0-0')).toBeTruthy();
    expect(screen.getByText('8/10~11 통째로 지원받기')).toBeTruthy();
  });

  it('연속 구간이 없으면 토글을 렌더하지 않는다 (무효 조합을 구조적으로 배제)', () => {
    setup([{ dates: ['2026-08-10', '2026-08-13'], timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.queryByTestId('order-sheet-card-run-toggle-0-0')).toBeNull();
  });

  it('grouped 카드의 토글은 켜져 있다', () => {
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: true }]);
    expect(screen.getByTestId('order-sheet-card-run-toggle-0-0').props.value).toBe(true);
  });

  it('토글을 켜면 카드 인덱스·run 날짜·on 을 넘긴다', () => {
    const onToggleRun = jest.fn();
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false }], {
      onToggleRun,
    });
    fireEvent(screen.getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', true);
    expect(onToggleRun).toHaveBeenCalledWith(0, ['2026-08-10', '2026-08-11'], true);
  });

  it('비연속이 섞이면 연속 구간마다 토글이 하나씩 붙는다', () => {
    setup([
      {
        dates: ['2026-08-10', '2026-08-11', '2026-08-14', '2026-08-15', '2026-08-20'],
        timeSlots: slots('18:00'),
        grouped: false,
      },
    ]);
    expect(screen.getByTestId('order-sheet-card-run-toggle-0-0')).toBeTruthy();
    expect(screen.getByTestId('order-sheet-card-run-toggle-0-1')).toBeTruthy();
    expect(screen.queryByTestId('order-sheet-card-run-toggle-0-2')).toBeNull();
  });

  it('토글에 switch 역할과 결과 설명 라벨이 있다 (a11y 대체물)', () => {
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false }]);
    const toggle = screen.getByTestId('order-sheet-card-run-toggle-0-0');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityLabel).toContain('하루만 지원');
  });
});

describe('예외 추출 진입 (F7①)', () => {
  it('카드 날짜가 2개 이상이면 진입 버튼이 보인다', () => {
    setup([{ dates: ['2026-08-10', '2026-08-12'], timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.getByTestId('order-sheet-card-exception-0')).toBeTruthy();
    expect(screen.getByText('일부 날짜만 다르게')).toBeTruthy();
  });

  it('카드 날짜가 1개면 노출하지 않는다', () => {
    setup([{ dates: ['2026-08-10'], timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.queryByTestId('order-sheet-card-exception-0')).toBeNull();
  });

  it('누르면 카드 인덱스를 넘긴다', () => {
    const onPressException = jest.fn();
    setup([{ dates: ['2026-08-10', '2026-08-12'], timeSlots: slots('18:00'), grouped: false }], {
      onPressException,
    });
    fireEvent.press(screen.getByTestId('order-sheet-card-exception-0'));
    expect(onPressException).toHaveBeenCalledWith(0);
  });
});

describe('날짜 요약 행 (F2 · §3.8)', () => {
  it('선택 날짜를 칩으로 나열하고 일수를 표기한다', () => {
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.getByTestId('order-sheet-date-chip-2026-08-10')).toBeTruthy();
    expect(screen.getByText('2일')).toBeTruthy();
  });

  it('칩을 누르면 그 날짜를 넘긴다 (소속 카드로 이동)', () => {
    const onPressDateChip = jest.fn();
    setup([{ dates: ['2026-08-10', '2026-08-11'], timeSlots: slots('18:00'), grouped: false }], {
      onPressDateChip,
    });
    fireEvent.press(screen.getByTestId('order-sheet-date-chip-2026-08-11'));
    expect(onPressDateChip).toHaveBeenCalledWith('2026-08-11');
  });

  it('30일이면 칩을 접고 "외 N일" 로 확장한다 (세로 폭 폭주 방지)', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    setup([{ dates, timeSlots: slots('18:00'), grouped: false }]);
    expect(screen.getByTestId('order-sheet-dates-expand')).toBeTruthy();
    expect(screen.queryByTestId('order-sheet-date-chip-2026-08-30')).toBeNull();
    fireEvent.press(screen.getByTestId('order-sheet-dates-expand'));
    expect(screen.getByTestId('order-sheet-date-chip-2026-08-30')).toBeTruthy();
  });
});

describe('에러 표시 (§3.6 — 카드가 곧 그룹이므로 기존 인덱스 매핑 재사용)', () => {
  it('dates 에러는 요약 행에 붙는다', () => {
    setup([{ dates: [], timeSlots: slots('18:00'), grouped: false }], {
      rowError: (key) => (key === 'dates' ? '날짜를 선택해주세요' : undefined),
    });
    expect(screen.getByText('날짜를 선택해주세요')).toBeTruthy();
  });

  it('시간·역할 에러는 해당 카드에 붙는다', () => {
    setup(
      [
        { dates: ['2026-08-10'], timeSlots: slots('18:00'), grouped: false },
        { dates: ['2026-08-12'], timeSlots: slots('20:00'), grouped: false },
      ],
      { rowError: (key, gi) => (key === 'roles' && gi === 1 ? '역할을 추가해주세요' : undefined) }
    );
    expect(screen.getByText('역할을 추가해주세요')).toBeTruthy();
  });
});
