/**
 * OrderSheetScreen — 미설정 항목 연쇄 입력 테스트
 *
 * (1) 미설정 행 확인 → 대기 후 다음 미설정 시트 자동 오픈,
 * (2) 대조군: 이미 채워진 행 확인 → 연쇄 없음,
 * (3) 마지막 미설정 항목 확인 → 시트 없음 + CTA '이대로 등록',
 * (4) X 로 닫으면 연쇄 중단, (5) 대기 중 사용자 행 탭이 예약을 이긴다.
 *
 * ⚠️ 시트 식별은 제목 텍스트가 아니라 mock-sheet-title testID 로 한다 —
 * 본화면 행 라벨('연락처'·'급여')과 시트 제목이 같은 문자열이라 getByText 가 중복 매치된다.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import { SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

// 실제 SheetModal 의 닫기 버튼은 텍스트가 아니라 아이콘(accessibilityLabel='닫기')이라
// 모킹 시 사라진다 — 연쇄 중단(X) 경로를 누를 수 있도록 스텁에 닫기 Pressable 을 둔다.
// SheetChainContext 를 소비해 실제 SheetModal 의 onShow(표시 완료 통지) 계약을 재현한다 —
// 이 통지가 없으면 딤 레이어가 걷히는 경로를 테스트할 수 없다.
jest.mock('@/components/ui/SheetModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  const { useSheetChain } = require('@/components/ui/SheetChainContext');
  return {
    SheetModal: ({ visible, title, children, footer, overlay, onClose }: any) => {
      const chain = useSheetChain();
      // 실제 SheetModal 의 onShow 계약 재현 — 마운트 시 1회 통지
      React.useEffect(() => {
        if (visible) chain?.onEntered();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return visible ? (
        <View testID="mock-sheet">
          <Text testID="mock-sheet-title">{title}</Text>
          <Pressable testID="mock-sheet-close" onPress={onClose} accessibilityRole="button" />
          {children}
          {footer}
          {overlay}
        </View>
      ) : null;
    },
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
jest.mock('@/components/ui/CalendarPicker', () => ({ CalendarPicker: () => null }));

const baseProps = { onSubmit: jest.fn(), isSubmitting: false };

/** 제목만 비어 있고 나머지 필수는 전부 채워진 폼 */
const onlyTitleMissing = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '',
  location: { name: '강남 홀덤펍', region: '서울' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: ['2026-07-24'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  useSameSalary: true,
  salary: { type: 'hourly', amount: 15000 },
});

/** 제목·연락처가 비어 있는 폼 — 연쇄 2스텝 검증용 */
const titleAndContactMissing = (): OrderSheetFormValues => ({
  ...onlyTitleMissing(),
  contactPhone: '',
});

/** 일정 그룹 2개 — 그룹0 완성, 그룹1 dates 미설정. 제목 확인 → 그룹1 날짜 시트 연쇄 예약용 */
const secondGroupDatesMissing = (): OrderSheetFormValues => ({
  ...onlyTitleMissing(),
  scheduleGroups: [
    {
      dates: ['2026-07-24'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
    {
      dates: [],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
});

/** 시간은 채워졌지만 역할·역할별 급여가 빈 폼 — 역할 확정의 급여 프리필 부수효과 검증용 */
const rolesAndByRoleSalaryMissing = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    { dates: ['2026-07-24'], timeSlots: [{ startTime: '19:00', roles: [] }], grouped: false },
  ],
  useSameSalary: false,
  roleSalaries: [],
});

const advanceSwap = async () => {
  await act(async () => {
    jest.advanceTimersByTime(SHEET_CHAIN_SWAP_MS);
    await Promise.resolve();
  });
};

/** 지금 떠 있는 시트 제목 — 없으면 null */
const sheetTitleOf = (queryByTestId: (id: string) => { props: { children: unknown } } | null) =>
  (queryByTestId('mock-sheet-title')?.props.children as string | undefined) ?? null;

describe('OrderSheetScreen — 미설정 항목 연쇄 입력', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAddToast.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('미설정 제목을 확인하면 대기 후 다음 미설정 항목(연락처) 시트가 열린다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 전에는 다음 시트가 아직 없다
    expect(sheetTitleOf(queryByTestId)).toBeNull();

    await advanceSwap();

    expect(sheetTitleOf(queryByTestId)).toBe('연락처');
  });

  it('대조군 — 이미 채워진 행을 확인하면 연쇄가 일어나지 않는다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{ ...titleAndContactMissing(), title: '기존 제목' }}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-title')); // 이미 채워진 행
    fireEvent.press(getByText('확인'));

    await advanceSwap();

    expect(sheetTitleOf(queryByTestId)).toBeNull();
  });

  it('마지막 미설정 항목을 확인하면 시트가 닫히고 CTA 가 이대로 등록으로 바뀐다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={onlyTitleMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    await advanceSwap();

    expect(sheetTitleOf(queryByTestId)).toBeNull();
    expect(getByText('이대로 등록')).toBeTruthy();
  });

  it('확인 없이 닫기로 나가면 연쇄가 일어나지 않는다', async () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.press(getByTestId('mock-sheet-close'));

    await advanceSwap();

    expect(sheetTitleOf(queryByTestId)).toBeNull();
  });

  it('대기 중 사용자가 다른 행을 탭하면 예약을 취소하고 그 행이 즉시 열린다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 창 안에서 사용자가 급여 행을 직접 탭
    fireEvent.press(getByTestId('order-sheet-row-salary'));
    expect(sheetTitleOf(queryByTestId)).toBe('급여');

    await advanceSwap();

    // 예약됐던 연락처 시트가 급여 시트를 갈아치우지 않는다
    expect(sheetTitleOf(queryByTestId)).toBe('급여');
  });

  it('대기 중 언마운트되어도 예약 타이머가 정리된다', () => {
    const { getByTestId, getByText, unmount } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // ⚠️ 이 단언을 먼저 두는 이유: 예약이 실제로 걸렸음을 확인하지 않으면
    // 아래 "0" 단언이 공허하게(연쇄 미구현 상태에서도) 통과한다.
    // 또한 async act() 로 감싸면 RNTL 의 마이크로태스크 플러시가 타이머 1개를 남겨
    // getTimerCount() 가 절대 0이 되지 않으므로(실측) 동기 경로로만 센다.
    expect(jest.getTimerCount()).toBe(1);

    unmount();

    // 타이머가 남아 있으면 언마운트된 트리에 setState 하여 경고가 난다
    expect(jest.getTimerCount()).toBe(0);
  });

  it('대기 중 그룹을 삭제하면 예약이 취소되어 stale groupIndex phantom 시트가 열리지 않는다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={secondGroupDatesMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 예약이 실제로 걸렸는지 먼저 고정 — 없으면 아래 "안 열림" 단언이 공허하게 통과한다(언마운트 테스트 관례)
    expect(jest.getTimerCount()).toBe(1);

    // 대기 창 안에서 예약된 그룹(1)을 삭제 — 예약된 groupIndex 가 stale 이 된다
    fireEvent.press(getByTestId('order-sheet-group-delete-1'));

    await advanceSwap();

    // 삭제된 그룹의 날짜 시트(DatePickerModal)가 phantom 으로 열리면 안 된다 —
    // 거기서 확인한 입력은 groupIndex 매치 실패로 조용히 유실된다(silent data loss).
    expect(queryByTestId('job-posting-date-confirm-button')).toBeNull();
    expect(sheetTitleOf(queryByTestId)).toBeNull();
  });

  it('시간·역할 확인 시 급여 자동 프리필이 반영되어 연쇄가 급여 시트를 건너뛴다 (getValues 계약)', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={rolesAndByRoleSalaryMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-roles')); // roles 미설정 → 연쇄 무장 + 시간·역할 시트
    expect(sheetTitleOf(queryByTestId)).toBe('시간 · 역할');

    fireEvent.press(getByTestId('order-role-chip-dealer')); // 칩 1탭 = 즉시 추가(RoleCountEditor)
    fireEvent.press(getByText('확인'));

    await advanceSwap();

    // applyRoleSalarySync 가 확인 대상이 아닌 '급여' 행을 부수효과로 set 으로 바꾼다 —
    // confirmRow 가 stale watch 값(values)을 읽으면 프리필 전 상태로 보여 '급여' 시트가
    // 열리므로 이 단언이 깨진다. form.getValues() 계약(최신 폼 읽기)의 회귀 가드.
    expect(sheetTitleOf(queryByTestId)).toBeNull();
  });

  it('전환 대기 동안 딤이 깔리고, 다음 시트가 올라오면 걷힌다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 중에는 딤이 화면을 덮고 있다
    expect(getByTestId('order-sheet-chain-scrim')).toBeTruthy();

    await advanceSwap();

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();
  });

  it('연쇄가 끝나면(다음 미설정 없음) 딤이 깔리지 않는다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={onlyTitleMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();
  });
});
